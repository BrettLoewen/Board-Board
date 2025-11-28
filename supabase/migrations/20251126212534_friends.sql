-- Create a table that allows 2 users to be friends with each other
create table friends
(
  user_id_1 uuid not null references user_profiles(id) on delete cascade,
  user_id_2 uuid not null references user_profiles(id) on delete cascade,
  created_at timestamptz default now(),

  -- A unique friend row should be a unique combination of user ids
  primary key (user_id_1, user_id_2),
    
  -- Users should not be able to become friends with themselves
  constraint no_self_friendship check (user_id_1 <> user_id_2),
    
  -- Prevent cases where (user_id_1, user_id_2) and (user_id_2, user_id_1) could both exist at the same time
  constraint enforce_sorted_ids check (user_id_1 < user_id_2)
);

-- Ensure that friendships can be queried quickly regardless of which column the user's id is in
create index if not exists friends_user_id_2_idx
on public.friends (user_id_2);

-- Set up Row Level Security (RLS)
alter table friends enable row level security;
create policy "Friendships can be viewed by both members of the friendship"
  on friends
  for select
  to authenticated
  using ((select auth.uid()) = user_id_1 or (select auth.uid()) = user_id_2);
  
create policy "Friendships can be deleted by either member of the friendship"
  on friends
  for delete
  to authenticated
  using ((select auth.uid()) = user_id_1 or (select auth.uid()) = user_id_2);

-- Delete all friend request rows in public.user_messages that were sent from the passed message's sender to the passed message's receiver
create or replace function public.delete_friend_request(friend_request_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  request record;
begin
  -- Get and store the whole friend request
  select *
  into request
  from public.user_messages
  where id = friend_request_id;

  -- Ensure users can only delete friend requests that involve them
  if not (request.to_user_id = auth.uid() or request.from_user_id = auth.uid()) then
    raise exception 'You can only delete a friend request that involve you';
  end if;

  -- Ensure users can only delete friend request messages
  if request.message_type <> 'friend_request' then
    raise exception 'You can only delete a friend request if the message is a friend request';
  end if;

  -- Delete this friend request
  delete from public.user_messages
  where id = request.id;

  -- Delete any other friend requests sent from this message's sender to this message's receiver (in case more than one was created).
  -- Requests sent the other direction will be left active.
  delete from public.user_messages
  where from_user_id = request.from_user_id and to_user_id = request.to_user_id and message_type = 'friend_request';

  -- Return true to indicate the deletion was performed successfully
  return true;
end;
$$;

-- Delete any friend requests between the users and create a friends relationship between the users.
-- Returns the sender's id to indicate the insert was performed successfully and so a broadcast message can be sent to them.
create or replace function public.accept_friend_request(friend_request_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  request record;
begin
  -- Get and store the whole friend request
  select *
  into request
  from public.user_messages
  where id = friend_request_id;

  -- Ensure users can only accept friend requests that were sent to them
  if request.to_user_id <> auth.uid() then
    raise exception 'You can only accept a friend request that was sent to you';
  end if;

  -- Ensure users can only accept friend request messages
  if request.message_type <> 'friend_request' then
    raise exception 'You can only accept a friend request if the message is a friend request';
  end if;

  -- Delete all friend requests sent from this message's sender to this message's receiver
  perform public.delete_friend_request(friend_request_id);

  -- Also delete any friend requests sent from this message's receiver to this message's sender (in case requests were sent by both users)
  delete from public.user_messages
  where from_user_id = request.to_user_id and to_user_id = request.from_user_id and message_type = 'friend_request';

  -- Create the friendship
  -- If the request sender has a smaller id, it should go first
  if request.from_user_id < request.to_user_id then
    insert into public.friends (user_id_1, user_id_2)
    values (request.from_user_id, request.to_user_id);
  end if;
  -- If the request sender has a larger id, it should go last
  if request.to_user_id < request.from_user_id then
    insert into public.friends (user_id_1, user_id_2)
    values (request.to_user_id, request.from_user_id);
  end if;

  -- Return the sender's id to indicate the insert was performed successfully and so a broadcast message can be sent to them
  return request.from_user_id;
end;
$$;

-- Update the send_friend_request function created previously to:
--   - Update an existing friend request instead of creating a new one if one already exists.
--   - Do not allow users to send friend requests to users that they are already friends with.
-- Create a friend_request message from `from_user` to the user whose friend code matches `to_friend_code`.
-- Returns the id of the user that receives the friend request so a broadcast message can be sent to them to inform them of the new friend request.
-- To be called as an RPC function.
create or replace function public.send_friend_request(from_user uuid, to_friend_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  to_user uuid := null;
  request record;
  from_username text := '';
  request_body text := '';
begin
  -- Ensure users can only send a friend request from themselves
  if from_user <> auth.uid() then
    raise exception 'You can only send a friend request from yourself';
  end if;

  -- Get the user_id that matches the given friend code and store it in to_user
  select id
  into to_user
  from public.user_profiles
  where friend_code = to_friend_code;

  -- Ensure users can only send a friend request to a valid user
  if to_user is null then
    raise exception 'You can only send a friend request to a valid friend code';
  end if;

  -- Ensure users cannot send friend requests to themselves
  if to_user = from_user then
    raise exception 'You cannot send a friend request to yourself';
  end if;

  -- Ensure they are not already friends
  if exists (
    select 1 
    from public.friends
    where (user_id_1 = from_user and user_id_2 = to_user)
       or (user_id_2 = from_user and user_id_1 = to_user)
  ) then
    raise exception 'You cannot send a friend request to a user that you are already friends with';
  end if;

  -- Check if there is a pre-existing friend request from this sender to this receiver
  select *
  into request
  from public.user_messages
  where from_user_id = from_user and to_user_id = to_user and message_type = 'friend_request'
  limit 1;

  -- If a pre-existing friend request message was found from this sender to this reciever, then update it
  if request.id is not null then
    -- Update the updated_at value to the current timestamp
    update public.user_messages
    set updated_at = now()
    where id = request.id;

    -- Return null to indicate to the function caller that no error occurred but a new friend request was not created
    return null;
  end if;

  -- If a pre-existing friend request message was not found, then create one
  -- Get the sender's username
  select username
  into from_username
  from public.user_profiles
  where id = from_user;

  -- Generate the body of the message
  request_body := from_username || ' sent you a friend request.';

  -- Create the message
  insert into public.user_messages (from_user_id, to_user_id, message_type, message_body, message_status)
  values (from_user, to_user, 'friend_request', request_body, 'sent')
  returning to_user_id into request.to_user_id;

  -- Return the id of the friend request receiver so the caller of the function can send a broadcast message to the user about the friend request
  return request.to_user_id;
end;
$$;
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
create or replace function public.deleteFriendRequest(friend_request_id uuid)
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
  if not (request.to_user_id = auth.uid() or request.from_user_id = auth.id()) then
    raise exception 'You can only delete a friend request that involve you';
  end if;

  -- Ensure users can only delete friend request messages
  if request.message_type <> auth.uid() then
    raise exception 'You can only delete a friend request if the message is a friend request';
  end if;

  -- Delete this friend request
  delete from user_messages
  where id = request.id;

  -- Delete any other friend requests sent from this message's sender to this message's receiver (in case more than one was created).
  -- Requests sent the other direction will be left active.
  delete from user_messages
  where from_user_id = request.from_user_id and to_user_id = request.to_user_id and message_type = 'friend_request';

  -- Return true to indicate the deletion was performed successfully
  return true;
end;
$$;

-- Delete any friend requests between the users and create a friends relationship between the users
create or replace function public.acceptFriendRequest(friend_request_id uuid)
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

  -- Ensure users can only accept friend requests that were sent to them
  if request.to_user <> auth.uid() then
    raise exception 'You can only accept a friend request that was sent to you';
  end if;

  -- Ensure users can only accept friend request messages
  if request.message_type <> auth.uid() then
    raise exception 'You can only accept a friend request if the message is a friend request';
  end if;

  -- Delete all friend requests sent from this message's sender to this message's receiver
  perform deleteFriendRequest(friend_request_id);

  -- Also delete any friend requests sent from this message's receiver to this message's sender (in case requests were sent by both users)
  delete from user_messages
  where from_user_id = request.to_user_id and to_user_id = request.from_user_id and message_type = 'friend_request';

  -- Create the friendship
  insert into public.friends (user_id_1, user_id_2)
  values (request.from_user_id, request.to_user_id);

  -- Return true to indicate the insert was performed successfully
  return true;
end;
$$;
-- Create a table to hold messages for users.
-- A message is sent from the user `from_user_id` to the user `to_user_id`.
-- `from_user_id` can be null to potentially support notifications from the Board Board team (like an update or future shutdown notification).
-- The only `message_type` is curently "friend_request", but "share_board" and possible others will be added in the future.
create table user_messages
(
    id uuid primary key default gen_random_uuid(),
    from_user_id uuid references user_profiles(id) on delete cascade,
    to_user_id uuid not null references user_profiles(id) on delete cascade,
    message_type text not null,
    message_body text not null,
    message_status text not null,
    created_at timestamptz default now(),
    updated_at timestamptz default now(),

    constraint message_type_check check (message_type in ('friend_request')),
    constraint message_status_check check (message_status in ('sent', 'read', 'archived'))
);

-- Set up Row Level Security (RLS)
alter table user_messages enable row level security;
create policy "Messages can be viewed by the sender and receiver"
  on user_messages
  for select
  to authenticated
  using ((select auth.uid()) = from_user_id or (select auth.uid()) = to_user_id);

create policy "Users can send messages"
  on user_messages
  for insert
  to authenticated
  with check ((select auth.uid()) = from_user_id);

create policy "Users can update the messages they send"
  on user_messages
  for update
  to authenticated
  using ((select auth.uid()) = from_user_id)
  with check ((select auth.uid()) = from_user_id);

create policy "Users can delete the messages they send"
  on user_messages
  for delete
  to authenticated
  using ((select auth.uid()) = from_user_id);

-- Create indexes for the `from_user_id` and `to_user_id` columns
create index user_messages_from_user_id_idx
  on public.user_messages(from_user_id);
  
create index user_messages_to_user_id_idx
  on public.user_messages(to_user_id);

-- Create a trigger using the set_updated_at function for the user_messages table
create or replace trigger set_user_messages_updated_at
before update on public.user_messages
for each row
execute procedure public.set_updated_at();

-- Create a friend_request message from `from_user` to the user whose friend code matches `to_friend_code`.
-- To be called as an RPC function.
create or replace function public.send_friend_request(from_user uuid, to_friend_code text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  to_user uuid := null;
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

  -- Get the sender's username
  select username
  into from_username
  from public.user_profiles
  where id = from_user;

  -- Generate the body of the message
  request_body := from_username || ' sent you a friend request.';

  -- Create the message
  insert into public.user_messages (from_user_id, to_user_id, message_type, message_body, message_status)
  values (from_user, to_user, 'friend_request', request_body, 'sent');

  -- Return true to indicate the insert was performed successfully
  return true;
end;
$$;

-- Update the status of a message sent to `to_user` to the given status.
-- To be called as an RPC function.
create or replace function public.mark_message_read(to_user uuid, message_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Ensure users can only update a message that was sent to them
  if to_user <> auth.uid() then
    raise exception 'You can only update a message that was sent to you';
  end if;

  -- Update the message's status to 'read'
  update user_messages
  set message_status = 'read'
  where id = message_id and to_user_id = to_user;

  -- If a message with the id `message_id` was not found or it had a different `to_user_id` value, then the function should fail
  if not found then
    raise exception 'Message not found or access denied';
  end if;

  -- Return true to indicate the update was performed successfully
  return true;
end;
$$;
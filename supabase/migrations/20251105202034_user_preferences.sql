-- There are fixed possible color modes, so define them in an enum to efficiently reference the fixed list
create type color_mode as enum (
    'auto',
    'light',
    'dark'
);

-- Create a table to hold the user's preferences
create table user_preferences
(
    user_id uuid not null primary key references user_profiles(id) on delete cascade,
    color_mode color_mode default 'auto',
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

-- Set up Row Level Security (RLS)
-- See https://supabase.com/docs/guides/database/postgres/row-level-security for more details.
alter table user_preferences enable row level security;
create policy "Users are able to view their own preferences"
  on user_preferences
  for select using ((select auth.uid()) = user_id);
create policy "Users can update their own preferences"
  on user_preferences
  for update using ((select auth.uid()) = user_id);
-- Ensure that only the server and no users are able to insert into the user_preferences table.
-- The insert and trigger below will still succeed.
-- This policy is not necessary, but it doesn't hurt to have it anyway as a safeguard.
create policy "Service role or trigger can insert preferences"
on user_preferences
for insert with check ((select auth.uid()) is null);

-- Create a user_preferences row for any users that existed before the user_preferences table was created
insert into user_preferences(user_id)
select id
from user_profiles
where id not in (select user_id from user_preferences);

-- Will create a new row in user_preferences linked to a given user_profiles row
create or replace function public.handle_new_user_preferences()
returns trigger
set search_path = ''
as $$
begin
  insert into public.user_preferences (user_id)
  values (new.id);
  return new;
end;
$$ language plpgsql security definer;

-- When a user_profiles row is created, create a user_preferences row linked to it
create trigger on_user_profile_created
  after insert on public.user_profiles
  for each row execute procedure public.handle_new_user_preferences();
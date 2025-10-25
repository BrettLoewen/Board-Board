create table user_profiles
(
    id uuid not null primary key references auth.users(id) on delete cascade,
    username text,
    created_at timestamptz default now(),
    updated_at timestamptz default now(),

    constraint username_length check (char_length(username) >= 3)
);

-- Set up Row Level Security (RLS)
-- See https://supabase.com/docs/guides/database/postgres/row-level-security for more details.
alter table user_profiles enable row level security;
create policy "Public profiles are viewable by everyone"
  on user_profiles
  for select using (true);
create policy "Users can insert their own profile"
  on user_profiles
  for insert with check ((select auth.uid()) = id);
create policy "Users can update own profile"
  on user_profiles
  for update using ((select auth.uid()) = id);
create policy "Users can delete their own profile"
  on user_profiles
  for delete using ( auth.uid() = id );

-- This trigger automatically creates a user_profile entry when a new user signs up via Supabase Auth.
-- See https://supabase.com/docs/guides/auth/managing-user-data#using-triggers for more details.
create function public.handle_new_user()
returns trigger
set search_path = ''
as $$
begin
  insert into public.user_profiles (id, username, created_at)
  values (new.id, new.raw_user_meta_data->>'username', now());
  return new;
end;
$$ language plpgsql security definer;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
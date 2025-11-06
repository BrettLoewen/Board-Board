--============ Update RLS Policies ============

-- Add role protection to user_profile policies to improve performance

drop policy if exists "Public profiles are viewable by everyone" on public.user_profiles;
create policy "Public profiles are viewable by everyone"
  on user_profiles
  for select
  to authenticated, anon
  using (true);

drop policy if exists "Users can insert their own profile" on public.user_profiles;
create policy "Users can insert their own profile"
  on user_profiles
  for insert
  to authenticated
  with check ((select auth.uid()) = id);

drop policy if exists "Users can update own profile" on public.user_profiles;
create policy "Users can update their own profile"
  on user_profiles
  for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- This policy should be redundant, since the app deletes the auth.user row and the user_profile row is deleted via cascade which bypasses RLS.
-- Still included because it doesn't hurt to have it anyway as a safeguard.
drop policy if exists "Users can delete their own profile" on public.user_profiles;
create policy "Users can delete their own profile"
  on user_profiles
  for delete
  to authenticated
  using ((select auth.uid()) = id );

-- Add role protection to user_preferences policies to improve performance

drop policy if exists "Users are able to view their own preferences" on public.user_preferences;
create policy "Users are able to view their own preferences"
  on user_preferences
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

-- This policy should not be necessary, but it doesn't hurt to have it anyway as a safeguard.
drop policy if exists "Service role or trigger can insert preferences" on public.user_preferences;
create policy "Users are able to insert preferences"
  on user_preferences
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own preferences" on public.user_preferences;
create policy "Users can update their own preferences"
  on user_preferences
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

--============ Updated_at Function and Triggers ============

-- Will update the updated_at value for the given table
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Create a trigger using the set_updated_at function for both the user_profiles and user_preferences tables
create or replace trigger set_user_profiles_updated_at
before update on public.user_profiles
for each row
execute procedure public.set_updated_at();

create or replace trigger set_user_preferences_updated_at
before update on public.user_preferences
for each row
execute procedure public.set_updated_at();
-- Update user_profiles table with a friend_code column
alter table public.user_profiles
add column if not exists friend_code text unique,
add constraint friend_code_length check (char_length(friend_code) = 8);

-- Generate an 8 character friend code
create or replace function public.generate_friend_code()
returns text
language plpgsql
set search_path = ''
as $$
declare
  possible_chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- does not include I, 1, O, and 0 to prevent misreads
  friend_code text := '';
  i int;
begin
  -- Randomly build an 8 character string from the set of possible characters
  for i in 1..8 loop
    friend_code := friend_code || substr(possible_chars, (floor(random() * length(possible_chars)) + 1)::int, 1);
  end loop;
  return friend_code;
end;
$$;

-- Generate and assign a friend code to a given newly created user profile
create or replace function public.set_friend_code()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.friend_code is null then
    loop
      -- Generate a new friend code for the user
      new.friend_code := public.generate_friend_code();
      -- If another user has the same friend code, retry
      exit when not exists (
        select 1 from public.user_profiles where friend_code = new.friend_code for update
      );
    end loop;
  end if;
  return new;
end;
$$;

-- When a new user profile is created, assign a unique friend code
create or replace trigger set_friend_code_for_new_users
before insert on public.user_profiles
for each row
execute function public.set_friend_code();

-- Generates a new unique friend code and assigns it to the given user.
-- To be called as an RPC function.
create or replace function public.refresh_friend_code(user_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_code text;
begin
  -- Ensure users can only update their own friend code
  if user_id <> auth.uid() then
    raise exception 'You can only refresh your own friend code';
  end if;

  loop
    -- Generate a new friend code
    new_code := public.generate_friend_code();
    -- If another user has the same friend code, retry
    exit when not exists (
      select 1 from public.user_profiles where friend_code = new_code
    );
  end loop;

  -- Update the user's friend code to the newly generated code.
  -- updated_at will automatically be updated by public.set_user_profiles_updated_at.
  update public.user_profiles
  set friend_code = new_code
  where id = user_id;

  return new_code;
end;
$$;

-- Backfill friend codes into user profiles that were created prior to this migration
do $$
declare
  r record;
begin
  -- For each user profile with a null friend_code
  for r in select id from public.user_profiles where friend_code is null loop
    -- Generate a unique friend code
    perform public.refresh_friend_code(r.id);
  end loop;
end $$;
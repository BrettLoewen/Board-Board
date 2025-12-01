-- Update the set_updated_at function to include `set search_path = ''` for security compliance with supabase
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
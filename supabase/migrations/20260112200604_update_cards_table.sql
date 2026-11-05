--============ Modify the Cards table ============
-- - Update the 'card_id' column to be just 'id'
-- - Add a foreign key to the board that owns this card (board_id)
-- - Add timestamp columns
alter table public.cards
drop column card_id,
add column id uuid not null primary key default gen_random_uuid(),
add column board_id uuid not null references boards(id) on delete cascade,
add column created_at timestamptz default now(),
add column updated_at timestamptz default now();

-- Ensure that cards can be queried quickly based on the board_id
create index if not exists cards_board_id_idx
on public.cards (board_id);

-- Create a trigger using the set_updated_at function for the cards table
create or replace trigger set_cards_updated_at
before update on public.cards
for each row
execute procedure public.set_updated_at();

--============ RLS Support ============
-- Function to check if a given user can view a given board. Used to check if the user has access to this card.
-- Uses public.can_select_board from the migration boards.sql.
create or replace function public.can_access_card_board(
  card_board_id uuid,
  user_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  return public.can_select_board(card_board_id, user_id);
end;
$$;

--============ RLS ============
alter table cards enable row level security;

-- Users should be able to view cards in boards that they have access to
create policy "Users can view cards on accessible boards"
on cards
for select
to authenticated
using (
  can_access_card_board(board_id, (select auth.uid()))
);

-- Users should be able to create cards in boards that they have access to
create policy "Users can create cards on accessible boards"
on cards
for insert
to authenticated
with check (
  can_access_card_board(board_id, (select auth.uid()))
);

-- Users should be able to modify cards in boards that they have access to
create policy "Users can update cards on accessible boards"
on cards
for update
to authenticated
using (
  can_access_card_board(board_id, (select auth.uid()))
)
with check (
  can_access_card_board(board_id, (select auth.uid()))
);

-- Users should be able to delete cards in boards that they have access to
create policy "Users can delete cards on accessible boards"
on cards
for delete
to authenticated
using (
  can_access_card_board(board_id, (select auth.uid()))
);
--============ Boards Table ============
-- Create a table that is owned by a user and cards can be owned by
create table boards
(
  id uuid not null primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),

  constraint name check (char_length(name) >= 3)
);

-- Ensure that boards can be queried quickly based on the owner_id
create index if not exists boards_owner_id_idx
on public.boards (owner_id);

-- Create a trigger using the set_updated_at function for the boards table
create or replace trigger set_boards_updated_at
before update on public.boards
for each row
execute procedure public.set_updated_at();

--============ Shared_boards Table ============
-- Create a table that is owned by a user and cards can be owned by
create table shared_boards
(
  board_id uuid not null references boards(id) on delete cascade,
  shared_to_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz default now(),

  -- A unique shared_boards row should be a unique combination of board_id and shared_to_id (one board cannot be shared to one user more than once)
  primary key (board_id, shared_to_id)
);

-- Ensure that shared_boards can be queried quickly based on the shared_to_id
create index if not exists shared_boards_shared_to_id_idx
on public.shared_boards (shared_to_id);

--============ RLS ============
alter table boards enable row level security;
alter table shared_boards enable row level security;

-- A boards row should be viewable by:
-- - Users who own that board
-- - Users that the board was shared to
create policy "Users can view boards they own or that are shared to them"
  on boards
  for select
  to authenticated
  using (
    -- Board owner
    owner_id = auth.uid()
    -- Recipient
    OR EXISTS (
      SELECT 1
      FROM shared_boards sb
      WHERE sb.board_id = boards.id
        AND sb.shared_to_id = auth.uid()
    )
  );

-- A shared_boards row should be viewable by:
-- - Users who own that board
-- - Users that the board was shared to
create policy "Users can view shared_boards for boards they own or that are shared to them"
  on shared_boards
  for select
  to authenticated
  using (
    -- Board owner
    EXISTS (
      SELECT 1
      FROM boards b
      WHERE b.id = shared_boards.board_id
        AND b.owner_id = auth.uid()
    )
    OR
    -- Recipient
    shared_boards.shared_to_id = auth.uid()
  );

-- Users should be able to create a board that they own
create policy "Users can create boards"
  on boards
  for insert
  to authenticated
  with check ((select auth.uid()) = owner_id);

-- Users should be able to create a shared_boards row for the boards that they own
create policy "Users can share boards they own"
  on shared_boards
  for insert
  to authenticated
  with check (
    EXISTS (
      SELECT 1
      FROM boards b
      WHERE b.id = shared_boards.board_id
        AND b.owner_id = auth.uid()
    )
  );

-- Users who created a board should be able to update it
create policy "Users can update their boards"
  on boards
  for update
  to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

-- Users should be able to delete a board that they own
create policy "Users can delete their boards"
  on boards
  for delete
  to authenticated
  using ((select auth.uid()) = owner_id);

-- A shared_boards row should be deletable by:
-- - Users who own that board (remove someone's access to the board)
-- - Users that the board was shared to (remove your own access to a board)
create policy "Users can delete shared_boards if they own the board or were shared to"
  on shared_boards
  for delete
  to authenticated
  using (
    -- Board owner
    EXISTS (
      SELECT 1
      FROM boards b
      WHERE b.id = shared_boards.board_id
        AND b.owner_id = auth.uid()
    )
    OR
    -- Recipient
    shared_to_id = auth.uid()
  );
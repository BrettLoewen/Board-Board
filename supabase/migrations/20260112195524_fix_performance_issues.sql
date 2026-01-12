-- I forgot to use `select auth.ui()` instead of just `auth.uid()` in some RLS policies, so this migration will correct that.
-- This is not mandatory, but these issues do present as performance warnings in the supabase dashboard, so it will be good to correct them.

-- A boards row should be viewable by:
-- - Users who own that board
-- - Users that the board was shared to
drop policy "Users can view boards they own or that are shared to them"
  on public.boards;
create policy "Users can view boards they own or that are shared to them"
  on boards
  for select
  to authenticated
  using (can_select_board(id, (select auth.uid())));

-- A shared_boards row should be viewable by:
-- - Users who own that board
-- - Users that the board was shared to
drop policy "Users can view their shared_boards"
  on shared_boards;
create policy "Users can view their shared_boards"
  on shared_boards
  for select
  to authenticated
  using (can_select_shared_board(board_id, shared_to_id, (select auth.uid())));

-- Users should be able to create a shared_boards row for the boards that they own
drop policy "Users can share boards they own"
  on shared_boards;
create policy "Users can share boards they own"
  on shared_boards
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from boards b
      where b.id = shared_boards.board_id
        and b.owner_id = (select auth.uid())
    )
  );

-- A shared_boards row should be deletable by:
-- - Users who own that board (remove someone's access to the board)
-- - Users that the board was shared to (remove your own access to a board)
drop policy "Users can delete their shared_boards"
  on shared_boards;
create policy "Users can delete their shared_boards"
  on shared_boards
  for delete
  to authenticated
  using (can_select_shared_board(board_id, shared_to_id, (select auth.uid())));
--============ Board realtime ============
-- Each open board has one private realtime channel, 'board:<board id>'. It carries:
-- - broadcasts between clients (cards moving and being edited, before they are written)
-- - broadcasts from the database (every committed card change, sent by the triggers below)
-- - presence (who has the board open, and which card each of them is holding)
-- Note: RLS is already enabled on realtime.messages. Enabling it here would fail with an owner error.

-- Whether the current user can use a board's channel: the same people who can view the board.
-- Topic format: 'board:<uuid>'. Returns false (not an error) for any other topic.
create or replace function public.can_access_board_topic(topic text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if topic !~ '^board:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return false;
  end if;

  return public.can_select_board(substring(topic from 7)::uuid, (select auth.uid()));
end;
$$;

-- Users who can view a board can receive its broadcasts and presence
create policy "Board members can receive board broadcasts and presence"
  on realtime.messages
  for select
  to authenticated
  using (
    realtime.messages.extension in ('broadcast', 'presence')
    and public.can_access_board_topic((select realtime.topic()))
  );

-- Users who can view a board can send broadcasts and presence on its channel
create policy "Board members can send board broadcasts and presence"
  on realtime.messages
  for insert
  to authenticated
  with check (
    realtime.messages.extension in ('broadcast', 'presence')
    and public.can_access_board_topic((select realtime.topic()))
  );

--============ Card changes ============
-- Send every committed card change to the card's board channel, so the database stays the source of truth.
-- The event is the operation ('INSERT', 'UPDATE' or 'DELETE'). Inserts and updates send the new row,
-- and deletes send just the id (smaller than realtime.broadcast_changes, which also sends the old row).
-- A failed broadcast must never fail the card write, so errors only raise a warning.
create or replace function public.broadcast_card_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  begin
    if tg_op = 'DELETE' then
      perform realtime.send(
        jsonb_build_object('id', old.id),
        tg_op,
        'board:' || old.board_id::text,
        true
      );
    else
      perform realtime.send(
        jsonb_build_object('record', to_jsonb(new)),
        tg_op,
        'board:' || new.board_id::text,
        true
      );
    end if;
  exception when others then
    raise warning 'broadcast_card_change failed: %', sqlerrm;
  end;

  return null;
end;
$$;

create or replace trigger broadcast_cards_changes
after insert or update or delete on public.cards
for each row
execute procedure public.broadcast_card_change();

--============ Losing access ============
-- Tell everyone on a board's channel when the board is deleted, so they can leave it
create or replace function public.broadcast_board_deleted()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  begin
    perform realtime.send(
      jsonb_build_object('id', old.id),
      'BOARD_DELETED',
      'board:' || old.id::text,
      true
    );
  exception when others then
    raise warning 'broadcast_board_deleted failed: %', sqlerrm;
  end;

  return null;
end;
$$;

create or replace trigger broadcast_boards_deleted
after delete on public.boards
for each row
execute procedure public.broadcast_board_deleted();

-- Tell a board's channel when someone loses access to it (the owner unshared it, or they left it),
-- so that user's open copy of the board can close. Their realtime access is only re-checked when they
-- next join the channel, so without this they would keep receiving updates until then.
create or replace function public.broadcast_board_access_revoked()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  begin
    perform realtime.send(
      jsonb_build_object('userId', old.shared_to_id),
      'ACCESS_REVOKED',
      'board:' || old.board_id::text,
      true
    );
  exception when others then
    raise warning 'broadcast_board_access_revoked failed: %', sqlerrm;
  end;

  return null;
end;
$$;

create or replace trigger broadcast_shared_boards_revoked
after delete on public.shared_boards
for each row
execute procedure public.broadcast_board_access_revoked();

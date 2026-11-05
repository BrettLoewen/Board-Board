--============ Card Type ============
-- The kinds of cards a board can hold. The shape of a card's `content` column depends on its type.
create type card_type as enum ('note', 'shape', 'draw');

--============ Modify the Cards table ============
-- - Store geometry as `double precision` so zoomed drags (fractional world units) don't drift when re-read
-- - Add the card's type and its type-specific content
-- - Add stacking (layer + last-touched order within the layer)
-- - Add a revision number used to order updates from different clients
-- - Track who created and last updated the card
alter table public.cards
  alter column x      type double precision,
  alter column y      type double precision,
  alter column width  type double precision,
  alter column height type double precision,
  add column type       card_type not null default 'note',  -- Default only fills existing rows, it is dropped below
  add column content    jsonb     not null default '{}'::jsonb,
  add column layer      smallint  not null default 1,       -- 0 Back, 1 Middle, 2 Front
  add column z_order    bigint    not null default 0,       -- Last-touched order within a layer
  add column rev        bigint    not null default 0,       -- Ordering of updates (see set_card_rev)
  add column created_by uuid default auth.uid() references user_profiles(id) on delete set null,
  add column updated_by uuid references user_profiles(id) on delete set null,
  add constraint valid_layer    check (layer between 0 and 2),
  add constraint content_object check (jsonb_typeof(content) = 'object'),
  add constraint content_size   check (octet_length(content::text) < 100000), -- Keeps realtime payloads under the broadcast size limit
  add constraint sane_geometry  check (abs(x) < 100000 and abs(y) < 100000 and width < 100000 and height < 100000);

-- A client bug must not silently create notes, so every insert has to say what type of card it is
alter table public.cards alter column type drop default;

--============ Authorship ============
-- Set created_by/updated_by from the caller's session so clients cannot spoof either field
create or replace function public.set_card_authors()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.created_by = (select auth.uid());
  else
    -- The creator of a card never changes
    new.created_by = old.created_by;
  end if;

  new.updated_by = (select auth.uid());
  return new;
end;
$$;

create or replace trigger set_cards_authors
before insert or update on public.cards
for each row
execute procedure public.set_card_authors();

--============ Revisions ============
-- Orders writes to a card on the server:
-- - A write with a lower rev than the stored one is stale (it arrived out of order), so it is skipped silently
-- - A write with the same rev (conflicting writers, Studio or RPC edits) is accepted and the rev is bumped
-- - A write with a higher rev is accepted as is
create or replace function public.set_card_rev()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.rev < old.rev then
    return null;
  elsif new.rev = old.rev then
    new.rev = old.rev + 1;
  end if;

  return new;
end;
$$;

create or replace trigger set_cards_rev
before update on public.cards
for each row
execute procedure public.set_card_rev();

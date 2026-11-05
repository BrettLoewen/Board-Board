--============ Card defaults ============
-- The colours (and later other options) a user's new cards start with, per card type.
-- For example: { "note": { "color": "yellow", "textColor": "auto" } }
-- Updated whenever the user picks a colour for a card, so new cards match the last colour they used.
alter table public.user_preferences
  add column card_defaults jsonb not null default '{}'::jsonb,
  add constraint card_defaults_object check (jsonb_typeof(card_defaults) = 'object');

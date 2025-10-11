create table cards
(
    card_id uuid primary key default gen_random_uuid(),
    x int not null,
    y int not null,
    width int not null,
    height int not null,
    constraint valid_width check(width > 0),
    constraint valid_height check(height > 0)
);
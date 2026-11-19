create table public.social_profiles (
  scope text not null check (scope in ('publico', 'preview')),
  player_hash text not null check (player_hash ~ '^[a-f0-9]{64}$'),
  name text not null check (char_length(name) between 1 and 24),
  invite text not null check (invite ~ '^[a-f0-9]{32}$'),
  seen_at timestamptz not null,
  played_at timestamptz,
  show_activity boolean not null default true,
  primary key (scope, player_hash),
  unique (scope, invite)
);

create table public.social_contacts (
  scope text not null,
  id uuid primary key,
  first_player text not null,
  second_player text not null,
  blocked_by text,
  messages jsonb not null default '[]'::jsonb check (jsonb_array_length(messages) <= 60),
  version integer not null default 1 check (version > 0),
  unique (scope, first_player, second_player),
  foreign key (scope, first_player) references public.social_profiles (scope, player_hash) on delete cascade,
  foreign key (scope, second_player) references public.social_profiles (scope, player_hash) on delete cascade,
  check (first_player collate "C" < second_player collate "C"),
  check (blocked_by is null or blocked_by in (first_player, second_player))
);

create index social_contacts_second_idx on public.social_contacts (scope, second_player);

alter table public.social_profiles enable row level security;
alter table public.social_contacts enable row level security;
revoke all on public.social_profiles, public.social_contacts from public, anon, authenticated;
grant select, insert, update on public.social_profiles, public.social_contacts to service_role;

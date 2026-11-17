-- Permite tres rondas extra y guarda el desbloqueo por jugador y día.
alter table public.trend_answers drop constraint trend_answers_round_check;
alter table public.trend_answers add constraint trend_answers_round_check check (round between 0 and 5);

create table public.trend_replays (
  scope text not null check (scope in ('publico', 'preview')),
  day date not null,
  player_hash text not null check (player_hash ~ '^[0-9a-f]{64}$'),
  requested_at bigint not null,
  unlocked boolean not null default false,
  primary key (scope, day, player_hash)
);
alter table public.trend_replays enable row level security;
revoke all on table public.trend_replays from public, anon, authenticated;
grant select, insert, update on table public.trend_replays to service_role;

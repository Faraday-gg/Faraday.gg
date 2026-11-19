-- Estado privado por jugador, día de Madrid y modalidad. Decisión 0098.
-- Recibos de anuncios simulados y partidas extra de práctica; nunca saldos ni premios.
create table public.continuation_states (
  scope text not null check (scope ~ '^[a-z0-9-]{1,32}$'),
  day date not null,
  player_hash text not null check (player_hash ~ '^[a-f0-9]{64}$'),
  key text not null check (key ~ '^(ad:(daily|trends|duel|duel3|ranked|practice)|daily:[a-f0-9-]{36})$'),
  state jsonb not null check (jsonb_typeof(state) = 'object'),
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  primary key (scope, day, player_hash, key)
);
alter table public.continuation_states enable row level security;
revoke all on table public.continuation_states from public, anon, authenticated;
grant select, insert, update on table public.continuation_states to service_role;
comment on table public.continuation_states is 'Continuación con anuncios: contador por modalidad/día, recibos de desbloqueo y retos extra sin clasificación ni emisión. Acceso exclusivo del servidor; version evita duplicados concurrentes.';

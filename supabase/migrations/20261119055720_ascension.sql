-- Ascensión: diaria y prácticas, estado privado y reloj del servidor.
-- Solo el servidor accede. Preview y producción no comparten clasificación.
create table public.ascension_runs (
  scope text not null check (scope in ('publico','preview')),
  day date not null,
  player_hash text not null check (player_hash ~ '^[a-f0-9]{64}$'),
  game integer not null check (game >= 0),
  version integer not null check (version >= 0),
  edition text not null,
  score integer not null default 0 check (score between 0 and 700),
  finished_at timestamptz,
  state jsonb not null check (jsonb_typeof(state) = 'object'),
  primary key (scope,day,player_hash,game)
);
create index ascension_daily_scores on public.ascension_runs (scope,day,edition,score desc,player_hash)
  where game = 0 and finished_at is not null;
alter table public.ascension_runs enable row level security;
revoke all on table public.ascension_runs from public,anon,authenticated;
grant select,insert,update on table public.ascension_runs to service_role;
comment on table public.ascension_runs is 'Ascensión: partidas por fecha Madrid, jugador anónimo y entorno. game=0 es la diaria; las prácticas no clasifican. state contiene las categorías y el reloj y solo lo lee el servidor.';

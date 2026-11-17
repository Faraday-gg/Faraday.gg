-- Clasificatorias y rangos de los duelos 1 vs 1 (decisión 0043, lib/rangos.mjs).
-- ranks: una fila por jugador con su valoración (rating: 100 por división, desde 0 = Bronce III; desde 2100, Científico)
-- y sus partidas clasificatorias. seen guarda los últimos duelos apuntados con su resultado para que ninguno cuente dos
-- veces. version permite guardar sin pisarse, como en duels: cada escritura exige la versión leída.
-- Los jugadores se identifican por el SHA-256 de su UUID anónimo, como en answers, duels y leagues.
-- Acceso: como el resto del esquema, solo desde el servidor con la clave secreta (RLS sin políticas).
-- Documentación: docs/base-de-datos.md

create table public.ranks (
  player_hash text primary key check (player_hash ~ '^[0-9a-f]{64}$'),
  rating integer not null default 300 check (rating >= 0),
  games integer not null default 0 check (games >= 0),
  wins integer not null default 0 check (wins >= 0),
  losses integer not null default 0 check (losses >= 0),
  draws integer not null default 0 check (draws >= 0),
  shield integer not null default 0 check (shield between 0 and 10),
  peak integer not null default 300 check (peak >= 0),
  seen jsonb not null default '{}'::jsonb,
  name text not null default '' check (char_length(name) <= 16),
  avatar jsonb not null default '{}'::jsonb,
  version integer not null default 1,
  updated_at timestamptz not null default now()
);

comment on table public.ranks is 'Rango de clasificatoria de cada jugador en los duelos 1 vs 1 (decisión 0043). rating: 100 puntos por división desde Bronce III (0); Científico desde 2100.';
comment on column public.ranks.shield is 'Partidas de colchón que quedan tras subir de división: mientras haya, perder no baja de división.';
comment on column public.ranks.seen is 'Últimos duelos apuntados (id → resultado), para no contar ninguno dos veces.';
comment on column public.ranks.version is 'Control de concurrencia optimista: el servidor solo actualiza la fila si la versión es la que leyó.';

-- Clasificación de la cumbre (Científico): de más a menos puntos.
create index ranks_rating_idx on public.ranks (rating desc) where rating >= 2100;

alter table public.ranks enable row level security;
revoke all on table public.ranks from anon, authenticated;

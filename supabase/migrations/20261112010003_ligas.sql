-- Ligas de amigos (decisión 0031, lib/ligas.mjs).
-- leagues: una fila por liga. league_members: quién está en cada una (máximo 15, lo comprueba un disparador).
-- daily_results: la distancia media del reto diario de cada jugador, solo cuando lo completó el mismo día
-- (lo apunta el servidor desde POST /api/answers y /api/daily-scores; el archivo no cuenta).
-- Los jugadores se identifican por el SHA-256 de su UUID anónimo, como en answers y duels.
-- Acceso: como el resto del esquema, solo desde el servidor con la clave secreta (RLS sin políticas).
-- Documentación: docs/base-de-datos.md

create table public.leagues (
  id uuid primary key,
  code text not null unique check (code ~ '^[A-Z2-9]{6}$'),
  name text not null check (char_length(name) between 1 and 24),
  created_at timestamptz not null default now()
);

comment on table public.leagues is 'Ligas de amigos con clasificación semanal (lunes a domingo, hora de Madrid).';
comment on column public.leagues.code is 'Código de 6 caracteres para invitar (enlace ?liga=CÓDIGO).';

create table public.league_members (
  league_id uuid not null references public.leagues (id) on delete cascade,
  player_hash text not null check (player_hash ~ '^[0-9a-f]{64}$'),
  name text not null check (char_length(name) between 1 and 16),
  avatar jsonb not null default '{}'::jsonb,
  joined_at timestamptz not null default now(),
  primary key (league_id, player_hash)
);

comment on table public.league_members is 'Miembros de cada liga. player_hash = SHA-256 del UUID anónimo; name y avatar son el apodo y las piezas del avatar que eligió el jugador.';

-- «Tus ligas»: buscar por jugador.
create index league_members_player_idx on public.league_members (player_hash);

-- Máximo 15 miembros por liga. Bloquea la fila de la liga para que dos altas a la vez no pasen de 15.
create function public.league_members_limit()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  perform 1 from public.leagues where id = new.league_id for update;
  if (select count(*) from public.league_members where league_id = new.league_id) >= 15 then
    raise exception 'liga_llena' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

comment on function public.league_members_limit() is 'Impide que una liga pase de 15 miembros (decisión 0031).';
revoke execute on function public.league_members_limit() from public, anon, authenticated;

create trigger league_members_limit
  before insert on public.league_members
  for each row execute function public.league_members_limit();

create table public.daily_results (
  player_hash text not null check (player_hash ~ '^[0-9a-f]{64}$'),
  day date not null,
  score double precision not null check (score >= 1),
  created_at timestamptz not null default now(),
  primary key (player_hash, day)
);

comment on table public.daily_results is 'Distancia media (1 = exacto) del reto diario de cada jugador, solo si lo completó el mismo día en hora de Madrid. La usan las ligas de amigos.';

alter table public.leagues enable row level security;
alter table public.league_members enable row level security;
alter table public.daily_results enable row level security;
revoke all on table public.leagues, public.league_members, public.daily_results from anon, authenticated;

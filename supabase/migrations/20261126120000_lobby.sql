-- Lobby público (lib/lobby.mjs, POST /api/lobby): la sala a la que llega cada jugador, con hasta 20 por lobby.
-- No hay ninguna fila compartida: cada jugador escribe solo su fila de presencia y el chat y las señales (retos y
-- peticiones de amistad) son filas nuevas con un número creciente que hace de cursor.
-- Solo accede el servidor con la clave secreta; los navegadores pasan siempre por la API.

-- Presencia: una fila por jugador y entorno. Se escribe cada pocos segundos y no hace falta conservarla si la base
-- de datos se reinicia, así que la tabla es UNLOGGED (no escribe en el WAL). Solo se indexan columnas que casi no
-- cambian (sala) y se deja hueco en cada página para que las actualizaciones no toquen los índices (HOT).
create unlogged table public.lobby_presence (
  scope text not null check (scope in ('publico', 'preview')),
  player_hash text not null check (player_hash ~ '^[a-f0-9]{64}$'),
  id uuid not null unique,
  room integer not null check (room >= 1),
  name text not null check (char_length(name) between 1 and 24),
  look jsonb not null default '{}'::jsonb check (jsonb_typeof(look) = 'object'),
  level integer not null default 1 check (level between 1 and 999),
  x double precision not null default 0 check (x between -1000 and 1000),
  z double precision not null default 0 check (z between -1000 and 1000),
  heading double precision not null default 0 check (heading between -7 and 7),
  act jsonb check (act is null or jsonb_typeof(act) = 'object'),
  place text not null default 'lobby' check (place in ('lobby', 'daily', 'duel', 'trends', 'ascension', 'archivo', 'casino', 'otros')),
  account boolean not null default false,
  joined_at timestamptz not null,
  seen_at timestamptz not null,
  primary key (scope, player_hash)
) with (fillfactor = 60);

create index lobby_presence_room_idx on public.lobby_presence (scope, room);

-- Eventos: mensajes del chat de una sala (to_hash nulo, con body) y señales dirigidas a un jugador (to_hash con
-- valor: reto, reto-no, amistad, amistad-ok). Solo se insertan y se borran al caducar; «n» es el cursor de los clientes.
-- «slot» es el turno: los mensajes de una sala y las invitaciones (reto, amistad) de un jugador van en cadena, cada fila
-- dice detrás de cuál va ('c:<sala>:<n del mensaje anterior>', 'i:<jugador>:<n de su invitación anterior>') y el índice
-- único impide que dos peticiones simultáneas ocupen el mismo turno. Así los límites de envío se cumplen sin funciones
-- SQL: la segunda inserción falla (23505), el servidor vuelve a leer y decide con la primera ya a la vista.
create table public.lobby_events (
  n bigint generated always as identity primary key,
  scope text not null check (scope in ('publico', 'preview')),
  room integer not null check (room >= 1),
  kind text not null check (kind in ('chat', 'reto', 'reto-no', 'amistad', 'amistad-ok')),
  from_hash text not null check (from_hash ~ '^[a-f0-9]{64}$'),
  from_id uuid not null,
  from_name text not null check (char_length(from_name) between 1 and 24),
  from_look jsonb check (from_look is null or jsonb_typeof(from_look) = 'object'),
  to_hash text check (to_hash is null or to_hash ~ '^[a-f0-9]{64}$'),
  body text check (body is null or char_length(body) between 1 and 140),
  game text check (game is null or game in ('estimacion', 'ascension', 'traza', 'archivo')),
  code text check (code is null or code ~ '^[A-Z2-9]{6}$'),
  slot text check (slot is null or slot ~ '^(c:[0-9]{1,9}|i:[a-f0-9]{64}):[0-9]{1,19}$'),
  created_at timestamptz not null default now(),
  check ((kind = 'chat') = (to_hash is null)),
  check ((kind = 'chat') = (body is not null)),
  check ((kind = 'reto') = (code is not null)),
  check ((kind = 'reto') = (game is not null))
);

create index lobby_events_room_idx on public.lobby_events (scope, room, n) where to_hash is null;
create index lobby_events_to_idx on public.lobby_events (scope, to_hash, n) where to_hash is not null;
create index lobby_events_from_idx on public.lobby_events (scope, from_hash, created_at);
create unique index lobby_events_slot_idx on public.lobby_events (scope, slot) where slot is not null;

alter table public.lobby_presence enable row level security;
alter table public.lobby_events enable row level security;
revoke all on public.lobby_presence, public.lobby_events from public, anon, authenticated;
grant select, insert, update, delete on public.lobby_presence to service_role;
grant select, insert, delete on public.lobby_events to service_role;

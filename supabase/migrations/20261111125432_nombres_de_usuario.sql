-- Nombres de usuario únicos (decisión 0025, lib/nombres.mjs).
-- Una fila por jugador que ha reservado nombre. El jugador se identifica, como en answers, por el SHA-256 de su
-- identificador; una cuenta enlaza ese mismo identificador, así que el nombre viaja con ella.
-- name_key es el nombre sin mayúsculas, acentos, espacios ni signos: es lo que no se puede repetir.
-- Acceso: como el resto del esquema, solo desde el servidor con la clave secreta (RLS sin políticas).
-- Documentación: docs/base-de-datos.md

create table public.usernames (
  player_hash text primary key check (player_hash ~ '^[0-9a-f]{64}$'),
  name text not null check (char_length(name) between 3 and 16),
  name_key text not null unique check (char_length(name_key) between 3 and 16 and name_key !~ '[[:space:]]'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.usernames is 'Nombres de usuario reservados. Los escribe solo el servidor (lib/nombres.mjs).';
comment on column public.usernames.player_hash is 'SHA-256 del identificador del jugador, igual que en answers.';
comment on column public.usernames.name is 'Nombre tal y como lo escribió el jugador (3 a 16 caracteres).';
comment on column public.usernames.name_key is 'Nombre normalizado: sin mayúsculas, acentos, espacios ni signos. Único.';

alter table public.usernames enable row level security;
revoke all on table public.usernames from anon, authenticated;

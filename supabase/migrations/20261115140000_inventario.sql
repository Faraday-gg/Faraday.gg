-- Inventario de piezas en el servidor (decisión 0062, lib/catalogo.mjs).
-- items: una fila por cada pieza del catálogo que tiene un jugador con cuenta. De momento solo entran las que se
--   compran en la tienda con cuenta; las que salen de los cofres y las que ya se tenían llegarán con las entregas
--   siguientes. La compra cobra con wallet_move (referencia = la pieza: no se cobra dos veces) y después inserta aquí.
-- Necesita las migraciones 20261114120000_preguntas_comunidad y 20261115120000_libro_contable.
-- Acceso: como el resto del esquema, solo desde el servidor con la clave secreta (RLS sin políticas).
-- Documentación: docs/base-de-datos.md

create table public.items (
  player_hash text not null check (player_hash ~ '^[0-9a-f]{64}$'),
  item text not null check (item ~ '^[a-zA-Z]{1,16}:[a-z0-9-]{1,40}$'),
  source text not null check (source ~ '^[a-z0-9-]{1,32}$'),
  created_at timestamptz not null default now(),
  primary key (player_hash, item)
);

comment on table public.items is 'Piezas del catálogo que tiene cada jugador con cuenta (decisión 0062). item = «hueco:id» de dist/avatar.js; source = de dónde salió (tienda, cofre…).';

alter table public.items enable row level security;
revoke all on table public.items from anon, authenticated;

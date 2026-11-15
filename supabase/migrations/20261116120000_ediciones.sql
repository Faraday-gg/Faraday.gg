-- Ediciones de colección (decisión 0067, lib/catalogo.mjs y lib/comunidad.mjs).
-- collectibles: una fila por cada unidad numerada de una edición, con su dueño. Es lo que más adelante se podrá vender
--   e intercambiar; por eso cada unidad es una fila y no un contador.
-- edition_counters: cuántas unidades se han emitido de cada edición.
-- edition_next: da el siguiente número de serie de una edición, o null si ya no quedan. Es una sola sentencia, así que
--   dos compras a la vez nunca reciben el mismo número ni se pasan de la tirada.
-- La compra cobra con wallet_move (motivo «edicion», referencia = la edición: una por cuenta) y después pide el número.
-- Necesita las migraciones de preguntas_comunidad y libro_contable.
-- Acceso: como el resto del esquema, solo desde el servidor con la clave secreta (RLS sin políticas).
-- Documentación: docs/base-de-datos.md

create table public.edition_counters (
  edition text primary key check (edition ~ '^[a-z0-9-]{1,32}$'),
  minted integer not null default 0 check (minted >= 0)
);

create table public.collectibles (
  id bigint generated always as identity primary key,
  edition text not null check (edition ~ '^[a-z0-9-]{1,32}$'),
  serial integer not null check (serial > 0),
  owner text not null check (owner ~ '^[0-9a-f]{64}$'),
  minted_by text not null check (minted_by ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  unique (edition, serial)
);

comment on table public.collectibles is 'Unidades numeradas de las ediciones de colección (decisión 0067). owner = quien la tiene ahora; minted_by = quien la compró al salir.';

create index collectibles_owner on public.collectibles (owner);

create function public.edition_next(p_edition text, p_total integer)
returns integer language plpgsql set search_path = '' as $$
declare
  v_serial integer;
begin
  insert into public.edition_counters (edition) values (p_edition) on conflict (edition) do nothing;
  update public.edition_counters set minted = minted + 1
   where edition = p_edition and minted < p_total
  returning minted into v_serial;
  return v_serial;
end $$;

alter table public.edition_counters enable row level security;
alter table public.collectibles enable row level security;
revoke all on table public.edition_counters, public.collectibles from anon, authenticated;
revoke execute on function public.edition_next(text, integer) from public, anon, authenticated;

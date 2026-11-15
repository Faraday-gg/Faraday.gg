-- Mercado de artículos de colección (decisión 0073, lib/mercado.mjs y lib/comunidad.mjs).
-- listings: un anuncio a precio fijo de una unidad numerada (collectibles). Mientras está activo, la unidad sigue siendo
--   del vendedor pero queda en depósito: el servidor no la enseña en su armario. Al venderse cambia de dueño.
-- market_list: publica un anuncio si la unidad es del vendedor, no está ya anunciada y no supera su tope de anuncios.
-- market_cancel: retira un anuncio activo del vendedor.
-- market_buy: la compra entera en una sola operación: cobra al comprador, paga al vendedor el precio menos la comisión
--   (que se destruye: no va a ningún saldo), cambia el dueño de la unidad y cierra el anuncio. O se hace todo o nada.
-- Necesita las migraciones de libro_contable y ediciones.
-- Acceso: como el resto del esquema, solo desde el servidor con la clave secreta (RLS sin políticas).
-- Documentación: docs/base-de-datos.md

create table public.listings (
  id bigint generated always as identity primary key,
  collectible_id bigint not null references public.collectibles (id),
  edition text not null check (edition ~ '^[a-z0-9-]{1,32}$'),
  serial integer not null check (serial > 0),
  seller text not null check (seller ~ '^[0-9a-f]{64}$'),
  price integer not null check (price between 1 and 1000000),
  fee integer not null default 0 check (fee >= 0),
  status text not null default 'activo' check (status in ('activo', 'vendido', 'retirado')),
  buyer text check (buyer ~ '^[0-9a-f]{64}$'),
  seller_seen boolean not null default false,
  created_at timestamptz not null default now(),
  closed_at timestamptz
);

comment on table public.listings is 'Anuncios del mercado (decisión 0073). status: activo, vendido o retirado. fee = comisión destruida al venderse; seller_seen = el vendedor ya ha visto el aviso de la venta.';

-- Una unidad solo puede tener un anuncio activo.
create unique index listings_active on public.listings (collectible_id) where status = 'activo';
create index listings_open on public.listings (price, id) where status = 'activo';
create index listings_seller on public.listings (seller, status);
create index listings_sold on public.listings (closed_at desc) where status = 'vendido';

-- Publica un anuncio. Devuelve {id} o {error}: 'no-tuya' (la unidad no existe o no es suya), 'anunciada' (ya tiene un
-- anuncio activo) o 'tope' (ya tiene p_max anuncios activos; p_max null = sin tope).
create function public.market_list(p_seller text, p_edition text, p_serial integer, p_price integer, p_max integer)
returns jsonb language plpgsql set search_path = '' as $$
declare
  v_id bigint;
  v_owner text;
  v_listing bigint;
begin
  -- La fila del saldo del vendedor hace de cerrojo: dos anuncios suyos a la vez van uno detrás de otro.
  insert into public.player_progress (player_hash) values (p_seller) on conflict (player_hash) do nothing;
  perform 1 from public.player_progress where player_hash = p_seller for update;
  select id, owner into v_id, v_owner from public.collectibles where edition = p_edition and serial = p_serial for update;
  if v_id is null or v_owner <> p_seller then return jsonb_build_object('error', 'no-tuya'); end if;
  if exists (select 1 from public.listings where collectible_id = v_id and status = 'activo') then
    return jsonb_build_object('error', 'anunciada');
  end if;
  if p_max is not null and (select count(*) from public.listings where seller = p_seller and status = 'activo') >= p_max then
    return jsonb_build_object('error', 'tope');
  end if;
  insert into public.listings (collectible_id, edition, serial, seller, price)
  values (v_id, p_edition, p_serial, p_seller, p_price) returning id into v_listing;
  return jsonb_build_object('id', v_listing);
end $$;

-- Retira un anuncio activo del vendedor. Devuelve si lo retiró.
create function public.market_cancel(p_listing bigint, p_seller text)
returns boolean language plpgsql set search_path = '' as $$
begin
  update public.listings set status = 'retirado', closed_at = now()
   where id = p_listing and seller = p_seller and status = 'activo';
  return found;
end $$;

-- Compra un anuncio. Devuelve {coins, edition, serial, price, fee} o {error}: 'cerrado' (ya no está en venta),
-- 'propio' (es del comprador) o 'saldo' (con {coins}). p_fee_percent = comisión en tanto por ciento, redondeada hacia arriba.
create function public.market_buy(p_listing bigint, p_buyer text, p_fee_percent integer)
returns jsonb language plpgsql set search_path = '' as $$
declare
  v_listing public.listings;
  v_owner text;
  v_buyer integer;
  v_seller integer;
  v_fee integer;
begin
  select * into v_listing from public.listings where id = p_listing for update;
  if v_listing.id is null or v_listing.status <> 'activo' then return jsonb_build_object('error', 'cerrado'); end if;
  if v_listing.seller = p_buyer then return jsonb_build_object('error', 'propio'); end if;
  -- Los dos saldos se bloquean siempre en el mismo orden, para que dos compras cruzadas no se esperen una a otra.
  insert into public.player_progress (player_hash) values (p_buyer), (v_listing.seller) on conflict (player_hash) do nothing;
  perform 1 from public.player_progress where player_hash in (p_buyer, v_listing.seller) order by player_hash for update;
  select coins into v_buyer from public.player_progress where player_hash = p_buyer;
  select coins into v_seller from public.player_progress where player_hash = v_listing.seller;
  if v_buyer < v_listing.price then return jsonb_build_object('error', 'saldo', 'coins', v_buyer); end if;
  select owner into v_owner from public.collectibles where id = v_listing.collectible_id for update;
  if v_owner is distinct from v_listing.seller then
    -- La unidad ya no es del vendedor: el anuncio no vale.
    update public.listings set status = 'retirado', closed_at = now() where id = p_listing;
    return jsonb_build_object('error', 'cerrado');
  end if;
  v_fee := least(v_listing.price, ceil(v_listing.price * greatest(p_fee_percent, 0) / 100.0)::integer);
  update public.player_progress set coins = v_buyer - v_listing.price, updated_at = now() where player_hash = p_buyer;
  insert into public.ledger (player_hash, amount, reason, source, ref, balance)
  values (p_buyer, -v_listing.price, 'mercado-compra', 'servidor', p_listing::text, v_buyer - v_listing.price);
  if v_listing.price - v_fee > 0 then
    update public.player_progress set coins = v_seller + v_listing.price - v_fee, updated_at = now() where player_hash = v_listing.seller;
    insert into public.ledger (player_hash, amount, reason, source, ref, balance)
    values (v_listing.seller, v_listing.price - v_fee, 'mercado-venta', 'servidor', p_listing::text, v_seller + v_listing.price - v_fee);
  end if;
  update public.collectibles set owner = p_buyer where id = v_listing.collectible_id;
  update public.listings set status = 'vendido', buyer = p_buyer, fee = v_fee, closed_at = now() where id = p_listing;
  return jsonb_build_object('coins', v_buyer - v_listing.price, 'edition', v_listing.edition, 'serial', v_listing.serial, 'price', v_listing.price, 'fee', v_fee);
end $$;

alter table public.listings enable row level security;
revoke all on table public.listings from anon, authenticated;
revoke execute on function public.market_list(text, text, integer, integer, integer) from public, anon, authenticated;
revoke execute on function public.market_cancel(bigint, text) from public, anon, authenticated;
revoke execute on function public.market_buy(bigint, text, integer) from public, anon, authenticated;

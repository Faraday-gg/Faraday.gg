-- Órdenes de compra y lista de deseos del mercado (decisión 0078, lib/mercado.mjs).
-- buy_orders: una orden de compra de una edición: «pago hasta price por cualquier unidad». Los faradios quedan retenidos
--   mientras está abierta y se devuelven si se cancela.
-- wishlist: las ediciones que un jugador ha marcado como deseadas.
-- market_order: pone una orden. Si ya hay un anuncio con «compra ya» a ese precio o menos, compra el más barato.
-- market_order_cancel: cancela una orden abierta y devuelve los faradios.
-- market_sell_now: vende una unidad a la orden más alta de su edición. Queda apuntada en listings como una venta más
--   (sold_by = 'orden'), para el historial de precios y los indicadores.
-- wishlist_counts: en cuántas listas de deseos está cada edición.
-- Cambia la regla de listings.sold_by para aceptar 'orden'. Necesita la migración del mercado.
-- Acceso: como el resto del esquema, solo desde el servidor con la clave secreta (RLS sin políticas).
-- Documentación: docs/base-de-datos.md

alter table public.listings drop constraint listings_sold_by_check;
alter table public.listings add constraint listings_sold_by_check check (sold_by in ('compra', 'puja', 'orden'));

create table public.buy_orders (
  id bigint generated always as identity primary key,
  edition text not null check (edition ~ '^[a-z0-9-]{1,32}$'),
  buyer text not null check (buyer ~ '^[0-9a-f]{64}$'),
  price integer not null check (price between 1 and 1000000),
  status text not null default 'abierta' check (status in ('abierta', 'cumplida', 'cancelada')),
  listing_id bigint references public.listings (id),
  created_at timestamptz not null default now(),
  closed_at timestamptz
);

comment on table public.buy_orders is 'Órdenes de compra del mercado (decisión 0078). price = lo que paga, retenido mientras está abierta. status: abierta, cumplida o cancelada. listing_id = la venta con la que se cumplió.';

create index buy_orders_open on public.buy_orders (edition, price desc, id) where status = 'abierta';
create index buy_orders_buyer on public.buy_orders (buyer, id desc);

create table public.wishlist (
  player_hash text not null check (player_hash ~ '^[0-9a-f]{64}$'),
  edition text not null check (edition ~ '^[a-z0-9-]{1,32}$'),
  created_at timestamptz not null default now(),
  primary key (player_hash, edition)
);

comment on table public.wishlist is 'Lista de deseos del mercado (decisión 0078): las ediciones que cada jugador ha marcado.';

create index wishlist_edition on public.wishlist (edition);

-- Pone una orden de compra. Devuelve lo de market_buy con {bought} si había un anuncio a ese precio o menos, {id, coins}
-- si la orden queda abierta, o {error}: 'tope' (ya tiene p_max órdenes abiertas; p_max null = sin tope) o 'saldo'.
create function public.market_order(p_buyer text, p_edition text, p_price integer, p_max integer, p_fee_percent integer)
returns jsonb language plpgsql set search_path = '' as $$
declare
  v_listing bigint;
  v_coins integer;
  v_order bigint;
begin
  -- La fila del saldo del comprador hace de cerrojo: dos órdenes suyas a la vez van una detrás de otra.
  insert into public.player_progress (player_hash) values (p_buyer) on conflict (player_hash) do nothing;
  select coins into v_coins from public.player_progress where player_hash = p_buyer for update;
  select id into v_listing from public.listings
   where status = 'activo' and edition = p_edition and buy_now is not null and buy_now <= p_price and seller <> p_buyer
     and (ends_at is null or ends_at > now())
   order by buy_now, id limit 1;
  if v_listing is not null then
    return public.market_buy(v_listing, p_buyer, p_fee_percent) || jsonb_build_object('bought', true);
  end if;
  if p_max is not null and (select count(*) from public.buy_orders where buyer = p_buyer and status = 'abierta') >= p_max then
    return jsonb_build_object('error', 'tope');
  end if;
  if v_coins < p_price then return jsonb_build_object('error', 'saldo', 'coins', v_coins); end if;
  insert into public.buy_orders (edition, buyer, price) values (p_edition, p_buyer, p_price) returning id into v_order;
  v_coins := public.market_pay(p_buyer, -p_price, 'mercado-orden', v_order::text);
  return jsonb_build_object('id', v_order, 'coins', v_coins);
end $$;

-- Cancela una orden abierta del comprador y le devuelve los faradios. Devuelve {coins} o {error: 'cerrado'}.
create function public.market_order_cancel(p_order bigint, p_buyer text)
returns jsonb language plpgsql set search_path = '' as $$
declare
  v_order public.buy_orders;
begin
  select * into v_order from public.buy_orders where id = p_order for update;
  if v_order.id is null or v_order.status <> 'abierta' or v_order.buyer <> p_buyer then
    return jsonb_build_object('error', 'cerrado');
  end if;
  update public.buy_orders set status = 'cancelada', closed_at = now() where id = p_order;
  return jsonb_build_object('coins', public.market_pay(p_buyer, v_order.price, 'mercado-orden-devuelta', p_order::text));
end $$;

-- Vende una unidad a la orden de compra más alta de su edición (la más antigua si empatan). El vendedor cobra el precio
-- de la orden menos la comisión, que se destruye; los faradios del comprador ya estaban retenidos. Devuelve
-- {coins, edition, serial, price, fee} o {error}: 'no-tuya', 'anunciada' (la unidad tiene un anuncio activo) o 'sin-ordenes'.
create function public.market_sell_now(p_seller text, p_edition text, p_serial integer, p_fee_percent integer)
returns jsonb language plpgsql set search_path = '' as $$
declare
  v_id bigint;
  v_owner text;
  v_order public.buy_orders;
  v_fee integer;
  v_coins integer;
  v_listing bigint;
begin
  select id, owner into v_id, v_owner from public.collectibles where edition = p_edition and serial = p_serial for update;
  if v_id is null or v_owner <> p_seller then return jsonb_build_object('error', 'no-tuya'); end if;
  if exists (select 1 from public.listings where collectible_id = v_id and status = 'activo') then
    return jsonb_build_object('error', 'anunciada');
  end if;
  select * into v_order from public.buy_orders
   where status = 'abierta' and edition = p_edition and buyer <> p_seller
   order by price desc, id limit 1 for update skip locked;
  if v_order.id is null then return jsonb_build_object('error', 'sin-ordenes'); end if;
  v_fee := least(v_order.price, ceil(v_order.price * greatest(p_fee_percent, 0) / 100.0)::integer);
  v_coins := public.market_pay(p_seller, v_order.price - v_fee, 'mercado-venta', 'orden-' || v_order.id);
  update public.collectibles set owner = v_order.buyer where id = v_id;
  insert into public.listings (collectible_id, edition, serial, seller, buy_now, status, sold_price, sold_by, fee, buyer, seller_seen, closed_at)
  values (v_id, p_edition, p_serial, p_seller, v_order.price, 'vendido', v_order.price, 'orden', v_fee, v_order.buyer, true, now())
  returning id into v_listing;
  update public.buy_orders set status = 'cumplida', closed_at = now(), listing_id = v_listing where id = v_order.id;
  return jsonb_build_object('coins', v_coins, 'edition', p_edition, 'serial', p_serial, 'price', v_order.price, 'fee', v_fee);
end $$;

-- En cuántas listas de deseos está cada edición.
create function public.wishlist_counts()
returns table (edition text, wishes bigint) language sql stable set search_path = '' as $$
  select edition, count(*) from public.wishlist group by edition;
$$;

alter table public.buy_orders enable row level security;
alter table public.wishlist enable row level security;
revoke all on table public.buy_orders, public.wishlist from anon, authenticated;
revoke execute on function public.market_order(text, text, integer, integer, integer) from public, anon, authenticated;
revoke execute on function public.market_order_cancel(bigint, text) from public, anon, authenticated;
revoke execute on function public.market_sell_now(text, text, integer, integer) from public, anon, authenticated;
revoke execute on function public.wishlist_counts() from public, anon, authenticated;

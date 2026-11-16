-- Mercado de artículos de colección (decisiones 0073 y 0074, lib/mercado.mjs).
-- listings: un anuncio de una unidad numerada (collectibles), con precio de «compra ya» (buy_now), subasta con puja de
--   salida (start_bid) y final (ends_at), o las dos cosas. Mientras está activo, la unidad sigue siendo del vendedor pero
--   queda en depósito: el servidor no la enseña en su armario. Al venderse cambia de dueño.
-- bids: las pujas. Los faradios de la puja más alta quedan retenidos; al superarla, se devuelven a quien la hizo.
-- market_list: publica un anuncio si la unidad es del vendedor, no está ya anunciada y no supera su tope de anuncios.
-- market_cancel: retira un anuncio activo sin pujas.
-- market_buy: «compra ya», entera en una sola operación: cobra al comprador, paga al vendedor el precio menos la comisión
--   (que se destruye: no va a ningún saldo), devuelve la puja que hubiera, cambia el dueño y cierra el anuncio.
-- market_bid: puja. Retiene los faradios de quien puja y devuelve los suyos a quien iba ganando.
-- market_settle: cierra las subastas terminadas. Con pujas, la unidad pasa a quien más pujó; sin pujas, el anuncio caduca.
-- market_owners: cuántos dueños distintos y cuántas unidades hay de cada edición.
-- market_pay: mueve faradios de un jugador y lo apunta en el libro (de uso interno de las anteriores).
-- Necesita las migraciones de libro_contable y ediciones.
-- Acceso: como el resto del esquema, solo desde el servidor con la clave secreta (RLS sin políticas).
-- Documentación: docs/base-de-datos.md

create table public.listings (
  id bigint generated always as identity primary key,
  collectible_id bigint not null references public.collectibles (id),
  edition text not null check (edition ~ '^[a-z0-9-]{1,32}$'),
  serial integer not null check (serial > 0),
  seller text not null check (seller ~ '^[0-9a-f]{64}$'),
  buy_now integer check (buy_now between 1 and 1000000),
  start_bid integer check (start_bid between 1 and 1000000),
  top_bid integer,
  top_bidder text check (top_bidder ~ '^[0-9a-f]{64}$'),
  bids integer not null default 0 check (bids >= 0),
  ends_at timestamptz,
  status text not null default 'activo' check (status in ('activo', 'vendido', 'retirado', 'caducado')),
  sold_price integer,
  sold_by text check (sold_by in ('compra', 'puja')),
  fee integer not null default 0 check (fee >= 0),
  buyer text check (buyer ~ '^[0-9a-f]{64}$'),
  seller_seen boolean not null default false,
  buyer_seen boolean not null default false,
  created_at timestamptz not null default now(),
  closed_at timestamptz,
  check (buy_now is not null or start_bid is not null),
  check (start_bid is null or ends_at is not null),
  check (buy_now is null or start_bid is null or buy_now > start_bid)
);

comment on table public.listings is 'Anuncios del mercado (decisiones 0073 y 0074). buy_now = precio de «compra ya»; start_bid y ends_at = subasta. status: activo, vendido, retirado o caducado. sold_by: compra o puja. fee = comisión destruida al venderse.';

-- Una unidad solo puede tener un anuncio activo.
create unique index listings_active on public.listings (collectible_id) where status = 'activo';
create index listings_open on public.listings (id) where status = 'activo';
create index listings_due on public.listings (ends_at) where status = 'activo' and ends_at is not null;
create index listings_seller on public.listings (seller, id desc);
create index listings_buyer on public.listings (buyer) where status = 'vendido' and not buyer_seen;
create index listings_sold on public.listings (closed_at desc) where status = 'vendido';

create table public.bids (
  id bigint generated always as identity primary key,
  listing_id bigint not null references public.listings (id),
  bidder text not null check (bidder ~ '^[0-9a-f]{64}$'),
  amount integer not null check (amount > 0),
  status text not null default 'activa' check (status in ('activa', 'superada', 'ganadora', 'devuelta')),
  seen boolean not null default true,
  created_at timestamptz not null default now()
);

comment on table public.bids is 'Pujas del mercado (decisión 0074). activa = la más alta, con los faradios retenidos; superada o devuelta = ya se devolvieron; ganadora = se llevó la unidad. seen = quien pujó ya ha visto el aviso de que se la devolvieron.';

create index bids_listing on public.bids (listing_id, id desc);
create index bids_bidder on public.bids (bidder, id desc);

-- Mueve faradios de un jugador (p_amount > 0 da, < 0 cobra) y lo apunta en el libro. Devuelve el saldo nuevo. Quien la
-- llama ya ha comprobado que el saldo llega.
create function public.market_pay(p_player text, p_amount integer, p_reason text, p_ref text)
returns integer language plpgsql set search_path = '' as $$
declare
  v_coins integer;
begin
  insert into public.player_progress (player_hash) values (p_player) on conflict (player_hash) do nothing;
  select coins into v_coins from public.player_progress where player_hash = p_player for update;
  if p_amount = 0 then return v_coins; end if;
  update public.player_progress set coins = v_coins + p_amount, updated_at = now() where player_hash = p_player;
  insert into public.ledger (player_hash, amount, reason, source, ref, balance)
  values (p_player, p_amount, p_reason, 'servidor', p_ref, v_coins + p_amount);
  return v_coins + p_amount;
end $$;

-- Publica un anuncio. p_hours = duración de la subasta (solo con p_start_bid). Devuelve {id} o {error}: 'no-tuya' (la
-- unidad no existe o no es suya), 'anunciada' (ya tiene un anuncio activo) o 'tope' (ya tiene p_max anuncios activos;
-- p_max null = sin tope).
create function public.market_list(p_seller text, p_edition text, p_serial integer, p_buy_now integer, p_start_bid integer, p_hours integer, p_max integer)
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
  insert into public.listings (collectible_id, edition, serial, seller, buy_now, start_bid, ends_at)
  values (v_id, p_edition, p_serial, p_seller, p_buy_now, p_start_bid,
          case when p_start_bid is not null then now() + make_interval(hours => p_hours) end)
  returning id into v_listing;
  return jsonb_build_object('id', v_listing);
end $$;

-- Retira un anuncio activo del vendedor. Devuelve {ok} o {error}: 'cerrado' (no está activo o no es suyo) o 'pujas' (ya
-- tiene pujas: no se puede retirar).
create function public.market_cancel(p_listing bigint, p_seller text)
returns jsonb language plpgsql set search_path = '' as $$
declare
  v_listing public.listings;
begin
  select * into v_listing from public.listings where id = p_listing for update;
  if v_listing.id is null or v_listing.status <> 'activo' or v_listing.seller <> p_seller then
    return jsonb_build_object('error', 'cerrado');
  end if;
  if v_listing.bids > 0 then return jsonb_build_object('error', 'pujas'); end if;
  update public.listings set status = 'retirado', closed_at = now(), seller_seen = true where id = p_listing;
  return jsonb_build_object('ok', true);
end $$;

-- «Compra ya». Devuelve {coins, edition, serial, price, fee} o {error}: 'cerrado' (ya no está en venta), 'sin-compra'
-- (solo admite pujas), 'propio' (es del comprador) o 'saldo' (con {coins}). p_fee_percent = comisión en tanto por
-- ciento, redondeada hacia arriba.
create function public.market_buy(p_listing bigint, p_buyer text, p_fee_percent integer)
returns jsonb language plpgsql set search_path = '' as $$
declare
  v_listing public.listings;
  v_owner text;
  v_coins integer;
  v_fee integer;
  v_bid bigint;
begin
  select * into v_listing from public.listings where id = p_listing for update;
  if v_listing.id is null or v_listing.status <> 'activo' or (v_listing.ends_at is not null and v_listing.ends_at <= now()) then
    return jsonb_build_object('error', 'cerrado');
  end if;
  if v_listing.buy_now is null then return jsonb_build_object('error', 'sin-compra'); end if;
  if v_listing.seller = p_buyer then return jsonb_build_object('error', 'propio'); end if;
  -- Los saldos se bloquean siempre en el mismo orden, para que dos operaciones cruzadas no se esperen una a otra.
  insert into public.player_progress (player_hash) values (p_buyer) on conflict (player_hash) do nothing;
  perform 1 from public.player_progress
    where player_hash in (p_buyer, v_listing.seller, coalesce(v_listing.top_bidder, p_buyer)) order by player_hash for update;
  select coins into v_coins from public.player_progress where player_hash = p_buyer;
  -- Si quien compra iba ganando la subasta, su puja retenida cuenta: se le devuelve antes de cobrar.
  if v_coins + (case when v_listing.top_bidder = p_buyer then v_listing.top_bid else 0 end) < v_listing.buy_now then
    return jsonb_build_object('error', 'saldo', 'coins', v_coins);
  end if;
  select owner into v_owner from public.collectibles where id = v_listing.collectible_id for update;
  update public.bids set status = 'devuelta', seen = false where listing_id = p_listing and status = 'activa' returning id into v_bid;
  if v_bid is not null then perform public.market_pay(v_listing.top_bidder, v_listing.top_bid, 'mercado-puja-devuelta', v_bid::text); end if;
  if v_owner is distinct from v_listing.seller then
    -- La unidad ya no es del vendedor: el anuncio no vale.
    update public.listings set status = 'retirado', closed_at = now() where id = p_listing;
    return jsonb_build_object('error', 'cerrado');
  end if;
  v_fee := least(v_listing.buy_now, ceil(v_listing.buy_now * greatest(p_fee_percent, 0) / 100.0)::integer);
  v_coins := public.market_pay(p_buyer, -v_listing.buy_now, 'mercado-compra', p_listing::text);
  perform public.market_pay(v_listing.seller, v_listing.buy_now - v_fee, 'mercado-venta', p_listing::text);
  update public.collectibles set owner = p_buyer where id = v_listing.collectible_id;
  update public.listings set status = 'vendido', buyer = p_buyer, sold_price = v_listing.buy_now, sold_by = 'compra', fee = v_fee,
         closed_at = now(), buyer_seen = true where id = p_listing;
  return jsonb_build_object('coins', v_coins, 'edition', v_listing.edition, 'serial', v_listing.serial, 'price', v_listing.buy_now, 'fee', v_fee);
end $$;

-- Puja. p_step_percent = cuánto hay que subir la puja anterior; p_snipe_seconds = si queda menos que eso, la subasta se
-- alarga hasta que quede eso. Si la puja llega al precio de «compra ya», compra (devuelve lo de market_buy con bought).
-- Devuelve {coins, topBid, bids, endsAt} (endsAt en milisegundos) o {error}: 'cerrado', 'sin-pujas', 'propio',
-- 'ganando' (ya es suya la puja más alta), 'baja' (con {min}) o 'saldo' (con {coins}).
create function public.market_bid(p_listing bigint, p_bidder text, p_amount integer, p_fee_percent integer, p_step_percent integer, p_snipe_seconds integer)
returns jsonb language plpgsql set search_path = '' as $$
declare
  v_listing public.listings;
  v_min integer;
  v_coins integer;
  v_old bigint;
  v_bid bigint;
  v_ends timestamptz;
begin
  select * into v_listing from public.listings where id = p_listing for update;
  if v_listing.id is null or v_listing.status <> 'activo' or (v_listing.ends_at is not null and v_listing.ends_at <= now()) then
    return jsonb_build_object('error', 'cerrado');
  end if;
  if v_listing.start_bid is null then return jsonb_build_object('error', 'sin-pujas'); end if;
  if v_listing.seller = p_bidder then return jsonb_build_object('error', 'propio'); end if;
  if v_listing.top_bidder = p_bidder then return jsonb_build_object('error', 'ganando'); end if;
  v_min := case when v_listing.top_bid is null then v_listing.start_bid
                else v_listing.top_bid + greatest(1, ceil(v_listing.top_bid * p_step_percent / 100.0)::integer) end;
  if p_amount < v_min then return jsonb_build_object('error', 'baja', 'min', v_min); end if;
  if v_listing.buy_now is not null and p_amount >= v_listing.buy_now then
    return public.market_buy(p_listing, p_bidder, p_fee_percent) || jsonb_build_object('bought', true);
  end if;
  insert into public.player_progress (player_hash) values (p_bidder) on conflict (player_hash) do nothing;
  perform 1 from public.player_progress
    where player_hash in (p_bidder, coalesce(v_listing.top_bidder, p_bidder)) order by player_hash for update;
  select coins into v_coins from public.player_progress where player_hash = p_bidder;
  if v_coins < p_amount then return jsonb_build_object('error', 'saldo', 'coins', v_coins); end if;
  update public.bids set status = 'superada', seen = false where listing_id = p_listing and status = 'activa' returning id into v_old;
  if v_old is not null then perform public.market_pay(v_listing.top_bidder, v_listing.top_bid, 'mercado-puja-devuelta', v_old::text); end if;
  insert into public.bids (listing_id, bidder, amount) values (p_listing, p_bidder, p_amount) returning id into v_bid;
  v_coins := public.market_pay(p_bidder, -p_amount, 'mercado-puja', v_bid::text);
  v_ends := greatest(v_listing.ends_at, now() + make_interval(secs => p_snipe_seconds));
  update public.listings set top_bid = p_amount, top_bidder = p_bidder, bids = bids + 1, ends_at = v_ends where id = p_listing;
  return jsonb_build_object('coins', v_coins, 'topBid', p_amount, 'bids', v_listing.bids + 1,
                            'endsAt', floor(extract(epoch from v_ends) * 1000)::bigint);
end $$;

-- Cierra las subastas terminadas, como mucho 100 de una vez. Devuelve cuántas ha cerrado.
create function public.market_settle(p_fee_percent integer)
returns integer language plpgsql set search_path = '' as $$
declare
  v_listing public.listings;
  v_owner text;
  v_fee integer;
  v_bid bigint;
  v_count integer := 0;
begin
  for v_listing in
    select * from public.listings where status = 'activo' and ends_at is not null and ends_at <= now()
     order by id limit 100 for update skip locked
  loop
    v_count := v_count + 1;
    if v_listing.top_bidder is null then
      update public.listings set status = 'caducado', closed_at = now() where id = v_listing.id;
      continue;
    end if;
    select owner into v_owner from public.collectibles where id = v_listing.collectible_id for update;
    if v_owner is distinct from v_listing.seller then
      -- La unidad ya no es del vendedor: se devuelve la puja y el anuncio no vale.
      update public.bids set status = 'devuelta', seen = false where listing_id = v_listing.id and status = 'activa' returning id into v_bid;
      if v_bid is not null then perform public.market_pay(v_listing.top_bidder, v_listing.top_bid, 'mercado-puja-devuelta', v_bid::text); end if;
      update public.listings set status = 'retirado', closed_at = now() where id = v_listing.id;
      continue;
    end if;
    v_fee := least(v_listing.top_bid, ceil(v_listing.top_bid * greatest(p_fee_percent, 0) / 100.0)::integer);
    update public.bids set status = 'ganadora' where listing_id = v_listing.id and status = 'activa';
    perform public.market_pay(v_listing.seller, v_listing.top_bid - v_fee, 'mercado-venta', v_listing.id::text);
    update public.collectibles set owner = v_listing.top_bidder where id = v_listing.collectible_id;
    update public.listings set status = 'vendido', buyer = v_listing.top_bidder, sold_price = v_listing.top_bid, sold_by = 'puja',
           fee = v_fee, closed_at = now() where id = v_listing.id;
  end loop;
  return v_count;
end $$;

-- Dueños distintos y unidades de cada edición.
create function public.market_owners()
returns table (edition text, owners bigint, units bigint) language sql stable set search_path = '' as $$
  select edition, count(distinct owner), count(*) from public.collectibles group by edition;
$$;

alter table public.listings enable row level security;
alter table public.bids enable row level security;
revoke all on table public.listings, public.bids from anon, authenticated;
revoke execute on function public.market_pay(text, integer, text, text) from public, anon, authenticated;
revoke execute on function public.market_list(text, text, integer, integer, integer, integer, integer) from public, anon, authenticated;
revoke execute on function public.market_cancel(bigint, text) from public, anon, authenticated;
revoke execute on function public.market_buy(bigint, text, integer) from public, anon, authenticated;
revoke execute on function public.market_bid(bigint, text, integer, integer, integer, integer) from public, anon, authenticated;
revoke execute on function public.market_settle(integer) from public, anon, authenticated;
revoke execute on function public.market_owners() from public, anon, authenticated;

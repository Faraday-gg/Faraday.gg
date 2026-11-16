-- Intercambios privados de artículos de colección (decisión 0075, lib/intercambios.mjs).
-- trades: un intercambio entre dos cuentas. a = quien lo crea; b = quien entra con el código. offer_a y offer_b = lo
--   que ofrece cada uno, [{"edition": …, "serial": …}]. version sube cada vez que cambia una oferta.
-- trade_join: entra en un intercambio con su código.
-- trade_offer: cambia lo que ofrece un jugador (solo unidades suyas y sin anunciar) y quita las dos confirmaciones.
-- trade_confirm: confirma o quita la confirmación. Con las dos, comprueba otra vez todas las unidades y las cambia de
--   dueño en una sola operación: o se hace entero o no se hace.
-- trade_cancel: cancela un intercambio abierto.
-- trade_free: dice si una unidad es de un jugador y no está anunciada en el mercado (de uso interno).
-- Los intercambios no mueven faradios. Necesita las migraciones de ediciones y mercado.
-- Acceso: como el resto del esquema, solo desde el servidor con la clave secreta (RLS sin políticas).
-- Documentación: docs/base-de-datos.md

create table public.trades (
  id bigint generated always as identity primary key,
  code text not null unique check (code ~ '^[A-Z2-9]{6}$'),
  a text not null check (a ~ '^[0-9a-f]{64}$'),
  b text check (b ~ '^[0-9a-f]{64}$'),
  a_name text not null default '' check (char_length(a_name) <= 40),
  b_name text not null default '' check (char_length(b_name) <= 40),
  a_avatar jsonb not null default '{}'::jsonb,
  b_avatar jsonb not null default '{}'::jsonb,
  offer_a jsonb not null default '[]'::jsonb check (jsonb_typeof(offer_a) = 'array' and jsonb_array_length(offer_a) <= 10),
  offer_b jsonb not null default '[]'::jsonb check (jsonb_typeof(offer_b) = 'array' and jsonb_array_length(offer_b) <= 10),
  ok_a boolean not null default false,
  ok_b boolean not null default false,
  status text not null default 'abierto' check (status in ('abierto', 'hecho', 'cancelado', 'caducado')),
  version integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (b is null or b <> a)
);

comment on table public.trades is 'Intercambios privados de artículos de colección (decisión 0075). a crea, b entra con el código. offer_a y offer_b = [{edition, serial}]. status: abierto, hecho, cancelado o caducado. No mueven faradios.';

create index trades_a on public.trades (a, id desc);
create index trades_b on public.trades (b, id desc);

-- La unidad es de ese jugador y no tiene un anuncio activo en el mercado. Bloquea la unidad hasta el final de la operación.
create function public.trade_free(p_edition text, p_serial integer, p_player text)
returns boolean language plpgsql set search_path = '' as $$
declare
  v_id bigint;
  v_owner text;
begin
  select id, owner into v_id, v_owner from public.collectibles where edition = p_edition and serial = p_serial for update;
  if v_id is null or v_owner <> p_player then return false; end if;
  return not exists (select 1 from public.listings where collectible_id = v_id and status = 'activo');
end $$;

-- Entra con el código. Devuelve el intercambio o {error}: 'cerrado' (no existe o ya no está abierto) o 'lleno'.
create function public.trade_join(p_code text, p_player text, p_name text, p_avatar jsonb)
returns jsonb language plpgsql set search_path = '' as $$
declare
  v_trade public.trades;
begin
  select * into v_trade from public.trades where code = p_code for update;
  if v_trade.id is null or v_trade.status <> 'abierto' then return jsonb_build_object('error', 'cerrado'); end if;
  if v_trade.a = p_player or v_trade.b = p_player then return to_jsonb(v_trade); end if;
  if v_trade.b is not null then return jsonb_build_object('error', 'lleno'); end if;
  update public.trades set b = p_player, b_name = p_name, b_avatar = p_avatar, updated_at = now() where id = v_trade.id returning * into v_trade;
  return to_jsonb(v_trade);
end $$;

-- Cambia lo que ofrece un jugador. Devuelve el intercambio o {error}: 'cerrado' o 'no-disponible' (alguna unidad no
-- es suya o está anunciada en el mercado).
create function public.trade_offer(p_trade bigint, p_player text, p_units jsonb)
returns jsonb language plpgsql set search_path = '' as $$
declare
  v_trade public.trades;
  v_unit jsonb;
begin
  select * into v_trade from public.trades where id = p_trade for update;
  if v_trade.id is null or v_trade.status <> 'abierto' or p_player not in (v_trade.a, coalesce(v_trade.b, '')) then
    return jsonb_build_object('error', 'cerrado');
  end if;
  for v_unit in select * from jsonb_array_elements(p_units) loop
    if not public.trade_free(v_unit->>'edition', (v_unit->>'serial')::integer, p_player) then
      return jsonb_build_object('error', 'no-disponible');
    end if;
  end loop;
  update public.trades
     set offer_a = case when a = p_player then p_units else offer_a end,
         offer_b = case when a = p_player then offer_b else p_units end,
         ok_a = false, ok_b = false, version = version + 1, updated_at = now()
   where id = p_trade returning * into v_trade;
  return to_jsonb(v_trade);
end $$;

-- Confirma (p_ok) o quita la confirmación. p_version = la versión de la oferta que ha visto quien confirma. Con las dos
-- confirmaciones hace el cambio. Devuelve el intercambio o {error}: 'cerrado', 'solo' (aún no ha entrado nadie),
-- 'cambio' (la oferta ha cambiado), 'vacio' (nadie ofrece nada) o 'no-disponible' (alguna unidad ya no se puede dar: se
-- quitan las dos confirmaciones).
create function public.trade_confirm(p_trade bigint, p_player text, p_ok boolean, p_version integer)
returns jsonb language plpgsql set search_path = '' as $$
declare
  v_trade public.trades;
  v_unit jsonb;
  v_ok boolean := true;
begin
  select * into v_trade from public.trades where id = p_trade for update;
  if v_trade.id is null or v_trade.status <> 'abierto' or p_player not in (v_trade.a, coalesce(v_trade.b, '')) then
    return jsonb_build_object('error', 'cerrado');
  end if;
  if v_trade.b is null then return jsonb_build_object('error', 'solo'); end if;
  if v_trade.version <> p_version then return jsonb_build_object('error', 'cambio'); end if;
  if p_ok and jsonb_array_length(v_trade.offer_a) = 0 and jsonb_array_length(v_trade.offer_b) = 0 then
    return jsonb_build_object('error', 'vacio');
  end if;
  update public.trades
     set ok_a = case when a = p_player then p_ok else ok_a end,
         ok_b = case when a = p_player then ok_b else p_ok end, updated_at = now()
   where id = p_trade returning * into v_trade;
  if not (v_trade.ok_a and v_trade.ok_b) then return to_jsonb(v_trade); end if;
  -- Las dos confirmaciones: se comprueban (y se bloquean) todas las unidades antes de mover ninguna.
  for v_unit in select * from jsonb_array_elements(v_trade.offer_a) loop
    v_ok := v_ok and public.trade_free(v_unit->>'edition', (v_unit->>'serial')::integer, v_trade.a);
  end loop;
  for v_unit in select * from jsonb_array_elements(v_trade.offer_b) loop
    v_ok := v_ok and public.trade_free(v_unit->>'edition', (v_unit->>'serial')::integer, v_trade.b);
  end loop;
  if not v_ok then
    update public.trades set ok_a = false, ok_b = false where id = p_trade;
    return jsonb_build_object('error', 'no-disponible');
  end if;
  update public.collectibles c set owner = v_trade.b from jsonb_array_elements(v_trade.offer_a) u
   where c.edition = u->>'edition' and c.serial = (u->>'serial')::integer;
  update public.collectibles c set owner = v_trade.a from jsonb_array_elements(v_trade.offer_b) u
   where c.edition = u->>'edition' and c.serial = (u->>'serial')::integer;
  update public.trades set status = 'hecho', updated_at = now() where id = p_trade returning * into v_trade;
  return to_jsonb(v_trade);
end $$;

-- Cancela un intercambio abierto. Devuelve el intercambio o {error: 'cerrado'}.
create function public.trade_cancel(p_trade bigint, p_player text)
returns jsonb language plpgsql set search_path = '' as $$
declare
  v_trade public.trades;
begin
  update public.trades set status = 'cancelado', updated_at = now()
   where id = p_trade and status = 'abierto' and p_player in (a, coalesce(b, '')) returning * into v_trade;
  if v_trade.id is null then return jsonb_build_object('error', 'cerrado'); end if;
  return to_jsonb(v_trade);
end $$;

alter table public.trades enable row level security;
revoke all on table public.trades from anon, authenticated;
revoke execute on function public.trade_free(text, integer, text) from public, anon, authenticated;
revoke execute on function public.trade_join(text, text, text, jsonb) from public, anon, authenticated;
revoke execute on function public.trade_offer(bigint, text, jsonb) from public, anon, authenticated;
revoke execute on function public.trade_confirm(bigint, text, boolean, integer) from public, anon, authenticated;
revoke execute on function public.trade_cancel(bigint, text) from public, anon, authenticated;

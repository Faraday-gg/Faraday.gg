-- Libro contable de faradios (decisión 0057, primera entrega de la fase 1 de la decisión 0055).
-- ledger: un apunte por cada cambio de saldo, con su motivo, quién lo declara (el servidor o el navegador) y el saldo
--   que queda. No se modifica ni se borra: el saldo de player_progress.coins es siempre la suma de sus apuntes.
-- wallet_move: mueve faradios desde el servidor y lo apunta. Con referencia, el mismo movimiento no se repite.
-- progress_save: además del cambio de saldo recibe su desglose por motivo (p_moves) y lo apunta.
-- community_propose y community_vote: apuntan lo que cobran.
-- ledger_daily: faradios emitidos y gastados por día y motivo, para medir la economía.
-- Necesita la migración 20261114120000_preguntas_comunidad (tabla player_progress), que debe aplicarse antes.
-- Acceso: como el resto del esquema, solo desde el servidor con la clave secreta (RLS sin políticas).
-- Documentación: docs/base-de-datos.md

create table public.ledger (
  id bigint generated always as identity primary key,
  player_hash text not null check (player_hash ~ '^[0-9a-f]{64}$'),
  amount integer not null check (amount <> 0),
  reason text not null check (reason ~ '^[a-z0-9-]{1,32}$'),
  source text not null check (source in ('servidor', 'navegador')),
  ref text,
  balance integer not null,
  day date not null default ((now() at time zone 'Europe/Madrid')::date),
  created_at timestamptz not null default now()
);

comment on table public.ledger is 'Libro contable de faradios (decisión 0057): un apunte por cada cambio de saldo. amount > 0 es emisión y < 0 es gasto; balance es el saldo tras el apunte; source dice si lo calculó el servidor o lo declaró el navegador.';
comment on column public.ledger.ref is 'Referencia de lo que originó el apunte (id de la propuesta, del duelo…). Con referencia, un mismo motivo solo se apunta una vez por jugador.';

create index ledger_player on public.ledger (player_hash, id desc);
create index ledger_day on public.ledger (day, reason);
create unique index ledger_once on public.ledger (player_hash, reason, ref) where ref is not null;

-- Mueve faradios desde el servidor (p_amount > 0 da, < 0 cobra) y lo apunta. Devuelve {coins}, {coins, repeated} si ese
-- motivo y referencia ya estaban apuntados, o {error: 'saldo', coins} si no llega para cobrar.
create function public.wallet_move(p_player text, p_amount integer, p_reason text, p_ref text default null)
returns jsonb language plpgsql as $$
declare
  v_coins integer;
begin
  insert into public.player_progress (player_hash) values (p_player) on conflict (player_hash) do nothing;
  select coins into v_coins from public.player_progress where player_hash = p_player for update;
  if p_ref is not null and exists (select 1 from public.ledger where player_hash = p_player and reason = p_reason and ref = p_ref) then
    return jsonb_build_object('coins', v_coins, 'repeated', true);
  end if;
  if p_amount = 0 then return jsonb_build_object('coins', v_coins); end if;
  if v_coins + p_amount < 0 then return jsonb_build_object('error', 'saldo', 'coins', v_coins); end if;
  update public.player_progress set coins = v_coins + p_amount, updated_at = now() where player_hash = p_player;
  insert into public.ledger (player_hash, amount, reason, source, ref, balance)
  values (p_player, p_amount, p_reason, 'servidor', p_ref, v_coins + p_amount);
  return jsonb_build_object('coins', v_coins + p_amount);
end $$;

-- wallet_move sustituye a progress_credit (premio al autor de una pregunta).
drop function public.progress_credit(text, integer);

-- Guarda el progreso y suma al saldo lo que cambió en el navegador, como antes, y además apunta el desglose por motivo
-- (p_moves = {"motivo": cantidad}). La primera vez se apunta como «saldo-inicial»; lo que el tope diario o el saldo
-- mínimo recortan, como «tope», para que los apuntes sumen siempre el cambio real del saldo.
drop function public.progress_save(text, jsonb, integer, date, integer, integer);
create function public.progress_save(p_player text, p_state jsonb, p_delta integer, p_day date, p_daily_cap integer, p_first_cap integer, p_moves jsonb default '{}'::jsonb)
returns integer language plpgsql as $$
declare
  current_row public.player_progress;
  accepted integer;
  result integer;
  running integer;
  entry record;
begin
  select * into current_row from public.player_progress where player_hash = p_player for update;
  if not found then
    insert into public.player_progress (player_hash, state, coins, gain_day, gained)
    values (p_player, p_state, greatest(0, least(p_delta, p_first_cap)), p_day, 0)
    on conflict (player_hash) do nothing
    returning coins into result;
    if result is not null then
      if result <> 0 then
        insert into public.ledger (player_hash, amount, reason, source, balance, day)
        values (p_player, result, 'saldo-inicial', 'navegador', result, p_day);
      end if;
      return result;
    end if;
    select * into current_row from public.player_progress where player_hash = p_player for update;
  end if;
  if current_row.gain_day is distinct from p_day then current_row.gained := 0; end if;
  accepted := least(p_delta, greatest(0, p_daily_cap - current_row.gained));
  update public.player_progress
     set state = p_state,
         coins = greatest(0, current_row.coins + accepted),
         gain_day = p_day,
         gained = current_row.gained + greatest(accepted, 0),
         updated_at = now()
   where player_hash = p_player
  returning coins into result;
  running := current_row.coins;
  for entry in
    select key as reason, (value #>> '{}')::numeric::integer as amount
      from jsonb_each(coalesce(p_moves, '{}'::jsonb))
     where jsonb_typeof(value) = 'number' and key ~ '^[a-z0-9-]{1,32}$'
  loop
    if entry.amount <> 0 then
      running := running + entry.amount;
      insert into public.ledger (player_hash, amount, reason, source, balance, day)
      values (p_player, entry.amount, entry.reason, 'navegador', running, p_day);
    end if;
  end loop;
  if result <> running then
    insert into public.ledger (player_hash, amount, reason, source, balance, day)
    values (p_player, result - running, 'tope', 'navegador', result, p_day);
  end if;
  return result;
end $$;

-- Proponer y votar: igual que antes, y apuntan lo cobrado con la propuesta como referencia.
create or replace function public.community_propose(p_id uuid, p_round date, p_player text, p_name text, p_avatar jsonb, p_title text, p_unit text, p_note text, p_cost integer, p_max integer)
returns jsonb language plpgsql as $$
declare
  v_coins integer;
begin
  perform 1 from public.player_progress where player_hash = p_player for update;
  if (select count(*) from public.community_proposals where player_hash = p_player and round = p_round) >= p_max then
    return jsonb_build_object('error', 'limite');
  end if;
  update public.player_progress set coins = coins - p_cost, updated_at = now()
   where player_hash = p_player and coins >= p_cost
  returning coins into v_coins;
  if v_coins is null then return jsonb_build_object('error', 'saldo'); end if;
  insert into public.community_proposals (id, round, player_hash, name, avatar, title, unit, note)
  values (p_id, p_round, p_player, p_name, p_avatar, p_title, p_unit, p_note);
  if p_cost <> 0 then
    insert into public.ledger (player_hash, amount, reason, source, ref, balance)
    values (p_player, -p_cost, 'comunidad-proponer', 'servidor', p_id::text, v_coins);
  end if;
  return jsonb_build_object('coins', v_coins);
end $$;

create or replace function public.community_vote(p_proposal uuid, p_round date, p_player text, p_cost integer)
returns jsonb language plpgsql as $$
declare
  proposal public.community_proposals;
  v_coins integer;
begin
  select * into proposal from public.community_proposals where id = p_proposal for update;
  if not found then return jsonb_build_object('error', 'no-existe'); end if;
  if proposal.round <> p_round or proposal.status <> 'abierta' then return jsonb_build_object('error', 'cerrada'); end if;
  if proposal.player_hash = p_player then return jsonb_build_object('error', 'propia'); end if;
  if exists (select 1 from public.community_votes where proposal_id = p_proposal and player_hash = p_player) then
    return jsonb_build_object('error', 'repetido');
  end if;
  update public.player_progress set coins = coins - p_cost, updated_at = now()
   where player_hash = p_player and coins >= p_cost
  returning coins into v_coins;
  if v_coins is null then return jsonb_build_object('error', 'saldo'); end if;
  insert into public.community_votes (proposal_id, player_hash) values (p_proposal, p_player);
  update public.community_proposals set votes = votes + 1 where id = p_proposal;
  if p_cost <> 0 then
    insert into public.ledger (player_hash, amount, reason, source, ref, balance)
    values (p_player, -p_cost, 'comunidad-votar', 'servidor', p_proposal::text, v_coins);
  end if;
  return jsonb_build_object('coins', v_coins, 'votes', proposal.votes + 1);
end $$;

-- Para medir la economía: faradios emitidos y gastados por día (hora de Madrid), motivo y origen.
create view public.ledger_daily with (security_invoker = true) as
select day, reason, source,
       coalesce(sum(amount) filter (where amount > 0), 0)::bigint as emitted,
       coalesce(-sum(amount) filter (where amount < 0), 0)::bigint as spent,
       count(distinct player_hash) as players,
       count(*) as moves
  from public.ledger
 group by day, reason, source;

comment on view public.ledger_daily is 'Faradios emitidos (emitted) y gastados (spent) por día, motivo y origen, con cuántos jugadores y apuntes (decisión 0057).';

alter table public.ledger enable row level security;
revoke all on table public.ledger from anon, authenticated;
revoke all on table public.ledger_daily from anon, authenticated;
revoke execute on function public.wallet_move(text, integer, text, text) from public, anon, authenticated;
revoke execute on function public.progress_save(text, jsonb, integer, date, integer, integer, jsonb) from public, anon, authenticated;

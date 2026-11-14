-- Preguntas de la comunidad (decisión 0049, lib/comunidad.mjs).
-- player_progress: el progreso del jugador con cuenta (faradios, avatar, misiones…) guardado en el servidor. Los
--   faradios van en la columna coins y manda el servidor: el navegador solo manda cuánto han cambiado (con tope diario).
-- community_proposals: preguntas propuestas por los jugadores para la ronda que se publica el lunes `round`.
-- community_votes: un voto por jugador y propuesta.
-- Los jugadores se identifican por el SHA-256 de su UUID anónimo (el de la cuenta), como en answers y duels.
-- Acceso: como el resto del esquema, solo desde el servidor con la clave secreta (RLS sin políticas).
-- Documentación: docs/base-de-datos.md

create table public.player_progress (
  player_hash text primary key check (player_hash ~ '^[0-9a-f]{64}$'),
  state jsonb not null default '{}'::jsonb,
  coins integer not null default 0 check (coins >= 0),
  gain_day date,
  gained integer not null default 0,
  updated_at timestamptz not null default now()
);

comment on table public.player_progress is 'Progreso de los jugadores con cuenta (decisión 0049): state es el progreso del navegador sin los faradios; coins, el saldo, que manda el servidor.';
comment on column public.player_progress.gained is 'Faradios ganados en el navegador y aceptados el día gain_day (tope diario contra trampas).';

create table public.community_proposals (
  id uuid primary key,
  round date not null,
  player_hash text not null check (player_hash ~ '^[0-9a-f]{64}$'),
  name text not null check (char_length(name) between 1 and 16),
  avatar jsonb not null default '{}'::jsonb,
  title text not null check (char_length(title) between 10 and 160),
  unit text not null check (char_length(unit) between 1 and 24),
  note text not null default '' check (char_length(note) <= 280),
  votes integer not null default 0 check (votes >= 0),
  status text not null default 'abierta' check (status in ('abierta', 'publicada', 'descartada')),
  question_id text,
  created_at timestamptz not null default now()
);

comment on table public.community_proposals is 'Preguntas propuestas por los jugadores. round = lunes en que se publican las 3 más votadas (la votación cierra el sábado anterior).';

create index community_proposals_round on public.community_proposals (round, votes desc, created_at);
create index community_proposals_player on public.community_proposals (player_hash, round);

create table public.community_votes (
  proposal_id uuid not null references public.community_proposals (id) on delete cascade,
  player_hash text not null check (player_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  primary key (proposal_id, player_hash)
);

create index community_votes_player on public.community_votes (player_hash);

-- Guarda el progreso y suma al saldo lo que cambió en el navegador (p_delta). Lo que se gana (delta positivo) tiene
-- tope por día de Madrid (p_daily_cap); lo que se gasta (negativo) siempre se resta. La primera vez, como mucho p_first_cap.
create function public.progress_save(p_player text, p_state jsonb, p_delta integer, p_day date, p_daily_cap integer, p_first_cap integer)
returns integer language plpgsql as $$
declare
  current_row public.player_progress;
  accepted integer;
  result integer;
begin
  select * into current_row from public.player_progress where player_hash = p_player for update;
  if not found then
    insert into public.player_progress (player_hash, state, coins, gain_day, gained)
    values (p_player, p_state, greatest(0, least(p_delta, p_first_cap)), p_day, 0)
    on conflict (player_hash) do nothing
    returning coins into result;
    if result is not null then return result; end if;
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
  return result;
end $$;

-- Proponer: como mucho p_max por jugador y ronda, y cobra p_cost faradios del saldo del servidor.
create function public.community_propose(p_id uuid, p_round date, p_player text, p_name text, p_avatar jsonb, p_title text, p_unit text, p_note text, p_cost integer, p_max integer)
returns jsonb language plpgsql as $$
declare
  balance integer;
begin
  perform 1 from public.player_progress where player_hash = p_player for update;
  if (select count(*) from public.community_proposals where player_hash = p_player and round = p_round) >= p_max then
    return jsonb_build_object('error', 'limite');
  end if;
  update public.player_progress set coins = coins - p_cost, updated_at = now()
   where player_hash = p_player and coins >= p_cost
  returning coins into balance;
  if balance is null then return jsonb_build_object('error', 'saldo'); end if;
  insert into public.community_proposals (id, round, player_hash, name, avatar, title, unit, note)
  values (p_id, p_round, p_player, p_name, p_avatar, p_title, p_unit, p_note);
  return jsonb_build_object('coins', balance);
end $$;

-- Votar: una vez por propuesta, nunca la propia y solo en la ronda abierta. Cobra p_cost faradios.
create function public.community_vote(p_proposal uuid, p_round date, p_player text, p_cost integer)
returns jsonb language plpgsql as $$
declare
  proposal public.community_proposals;
  balance integer;
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
  returning coins into balance;
  if balance is null then return jsonb_build_object('error', 'saldo'); end if;
  insert into public.community_votes (proposal_id, player_hash) values (p_proposal, p_player);
  update public.community_proposals set votes = votes + 1 where id = p_proposal;
  return jsonb_build_object('coins', balance, 'votes', proposal.votes + 1);
end $$;

-- Premio al autor cuando su pregunta sale en el reto (no cuenta para el tope diario).
create function public.progress_credit(p_player text, p_amount integer)
returns integer language sql as $$
  insert into public.player_progress (player_hash, coins) values (p_player, greatest(0, p_amount))
  on conflict (player_hash) do update set coins = public.player_progress.coins + greatest(0, p_amount), updated_at = now()
  returning coins;
$$;

alter table public.player_progress enable row level security;
alter table public.community_proposals enable row level security;
alter table public.community_votes enable row level security;
revoke all on table public.player_progress, public.community_proposals, public.community_votes from anon, authenticated;
revoke execute on function public.progress_save(text, jsonb, integer, date, integer, integer) from public, anon, authenticated;
revoke execute on function public.community_propose(uuid, date, text, text, jsonb, text, text, text, integer, integer) from public, anon, authenticated;
revoke execute on function public.community_vote(uuid, date, text, integer) from public, anon, authenticated;
revoke execute on function public.progress_credit(text, integer) from public, anon, authenticated;

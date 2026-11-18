-- Las rondas se numeran de forma continua y cada extra tiene su propio desbloqueo.
alter table public.trend_answers
  drop constraint trend_answers_round_check,
  alter column round type integer,
  add constraint trend_answers_round_check check (round >= 0);

alter table public.trend_replays
  drop constraint trend_replays_pkey,
  add column game integer not null default 1 check (game > 0),
  add primary key (scope, day, player_hash, game);

-- Si una gráfica vuelve a salir, cada jugador cuenta una sola vez en la media.
create or replace function public.trend_community(p_scope text, p_day date, p_chart text, p_player text)
returns jsonb
language sql stable security invoker
set search_path = ''
as $$
  with others as (
    select distinct on (player_hash) guess from public.trend_answers
    where scope = p_scope and day = p_day and chart = p_chart and player_hash <> p_player
    order by player_hash, round
  ),
  positions as (
    select pos, avg(value) as mean
    from others cross join lateral unnest(guess) with ordinality as point(value, pos)
    group by pos
  ),
  sample as (select count(*) as total from others)
  select jsonb_build_object('count', total, 'values',
    case when total >= 3 then (select jsonb_agg(mean order by pos) from positions) end)
  from sample;
$$;

-- Una respuesta queda fijada por ronda, jugador y día. Preview usa su propia muestra.
create table public.trend_answers (
  scope text not null check (scope in ('publico', 'preview')),
  day date not null,
  player_hash text not null check (player_hash ~ '^[0-9a-f]{64}$'),
  round smallint not null check (round between 0 and 2),
  chart text not null,
  guess double precision[] not null check (cardinality(guess) between 1 and 30),
  primary key (scope, day, player_hash, round)
);

create index trend_answers_community on public.trend_answers (scope, day, chart);
alter table public.trend_answers enable row level security;
revoke all on table public.trend_answers from public, anon, authenticated;
grant select, insert on table public.trend_answers to service_role;

create function public.trend_community(p_scope text, p_day date, p_chart text, p_player text)
returns jsonb
language sql stable security invoker
set search_path = ''
as $$
  with others as (
    select guess from public.trend_answers
    where scope = p_scope and day = p_day and chart = p_chart and player_hash <> p_player
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

revoke all on function public.trend_community(text, date, text, text) from public, anon, authenticated;
grant execute on function public.trend_community(text, date, text, text) to service_role;

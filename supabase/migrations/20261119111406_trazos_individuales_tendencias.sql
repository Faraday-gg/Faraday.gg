-- El cursor ordena páginas sin enviar los identificadores de jugadores.
alter table public.trend_answers add column trace_id bigint generated always as identity;
create index trend_answers_trace_page on public.trend_answers (scope, day, chart, trace_id);

create function public.trend_traces(p_scope text, p_day date, p_chart text, p_player text, p_after bigint)
returns jsonb
language sql stable security invoker
set search_path = ''
as $$
  with page as (
    select a.trace_id, a.guess
    from public.trend_answers a
    where a.scope = p_scope and a.day = p_day and a.chart = p_chart
      and a.player_hash <> p_player and a.trace_id > p_after
      and not exists (
        select 1 from public.trend_answers earlier
        where earlier.scope = a.scope and earlier.day = a.day and earlier.chart = a.chart
          and earlier.player_hash = a.player_hash and earlier.round < a.round
      )
    order by a.trace_id
    limit 201
  ), visible as (
    select trace_id, guess from page order by trace_id limit 200
  )
  select jsonb_build_object(
    'traces', coalesce((select jsonb_agg(guess order by trace_id) from visible), '[]'::jsonb),
    'next', case when (select count(*) from page) > 200 then (select max(trace_id) from visible) end
  )
  where exists (
    select 1 from public.trend_answers mine
    where mine.scope = p_scope and mine.day = p_day and mine.chart = p_chart and mine.player_hash = p_player
  );
$$;

revoke all on function public.trend_traces(text, date, text, text, bigint) from public, anon, authenticated;
grant execute on function public.trend_traces(text, date, text, text, bigint) to service_role;

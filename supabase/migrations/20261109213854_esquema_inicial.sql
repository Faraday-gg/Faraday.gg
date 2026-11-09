-- Esquema inicial de Casi Casi.
-- Sustituye el almacenamiento local de runtime/ (answers.json y days/) por tablas compartidas.
-- Acceso: solo desde el servidor con la clave secreta. RLS activado y sin políticas para
-- anon/authenticated: el navegador nunca lee ni escribe directamente en estas tablas.
-- Documentación: docs/base-de-datos.md

-- Jornadas: una fila por fecha publicada (Europe/Madrid).
create table public.days (
  id date primary key,
  name text not null,
  theme text not null default '',
  source text not null check (source in ('piloto', 'banco-editorial')),
  created_at timestamptz not null default now()
);
comment on table public.days is 'Jornadas publicadas. id = fecha de la jornada en Europe/Madrid. Sustituye a runtime/days/.';
comment on column public.days.source is 'piloto = dist/questions.json; banco-editorial = generada por content-engine.mjs.';

-- Preguntas: tres por jornada. El objeto completo que usa la interfaz va en content.
create table public.questions (
  id text primary key,
  day_id date not null references public.days (id) on delete restrict,
  position smallint not null check (position between 1 and 3),
  revision integer not null default 1,
  title text not null,
  unit text not null,
  answer double precision not null check (answer > 0),
  content jsonb not null,
  created_at timestamptz not null default now(),
  unique (day_id, position)
);
comment on table public.questions is 'Preguntas de cada jornada. answer es la cifra de referencia; content guarda el objeto completo (fuentes, imagen, razonamiento) tal y como lo usa dist/.';

-- Respuestas anónimas: una por pregunta y navegador.
create table public.answers (
  id bigint generated always as identity primary key,
  question_id text not null references public.questions (id) on delete restrict,
  player_hash text not null check (player_hash ~ '^[0-9a-f]{64}$'),
  guess double precision not null check (guess > 0 and guess <= 1e30),
  created_at timestamptz not null default now(),
  unique (question_id, player_hash)
);
comment on table public.answers is 'Estimaciones anónimas. player_hash = SHA-256 (hex) del UUID anónimo del navegador; nunca se guarda el UUID. Sustituye a runtime/answers.json.';

-- Seguridad: RLS activado sin políticas y sin permisos para los roles públicos.
alter table public.days enable row level security;
alter table public.questions enable row level security;
alter table public.answers enable row level security;
revoke all on table public.days, public.questions, public.answers from anon, authenticated;

-- Puntuación diaria: media de las distancias multiplicativas de quienes respondieron todas las preguntas del día.
create function public.daily_scores(p_day date)
returns table (player_hash text, score double precision)
language sql
stable
set search_path = ''
as $$
  select a.player_hash,
         avg(greatest(a.guess / q.answer, q.answer / a.guess)) as score
  from public.answers a
  join public.questions q on q.id = a.question_id
  where q.day_id = p_day
  group by a.player_hash
  having count(*) = (select count(*) from public.questions where day_id = p_day);
$$;
comment on function public.daily_scores(date) is 'Puntuación por jugador para una jornada (1 = exacto). Solo incluye a quien completó todas las preguntas del día. Equivale a POST /api/daily-scores.';
revoke execute on function public.daily_scores(date) from public, anon, authenticated;

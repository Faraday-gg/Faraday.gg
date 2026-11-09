-- Respuestas anónimas de Casi Casi: una por pregunta y jugador (hash SHA-256 del identificador del navegador).
-- answers: producción. answers_preview: despliegues de prueba de Vercel, para no mezclar datos.
create table public.answers (
  question_id text not null check (char_length(question_id) between 1 and 120),
  player_hash text not null check (player_hash ~ '^[0-9a-f]{64}$'),
  guess double precision not null check (guess > 0 and guess <= 1e30),
  created_at timestamptz not null default now(),
  primary key (question_id, player_hash)
);
create table public.answers_preview (like public.answers including all);

comment on table public.answers is 'Respuestas anónimas de producción. Solo accesible desde el servidor con la clave secreta.';
comment on table public.answers_preview is 'Respuestas anónimas de los despliegues de prueba (Preview). Misma estructura que answers.';

-- RLS activo y sin políticas: el navegador (anon/authenticated) no puede leer ni escribir.
-- El servidor usa la clave secreta (rol service_role), que omite RLS.
alter table public.answers enable row level security;
alter table public.answers_preview enable row level security;
revoke all on table public.answers, public.answers_preview from anon, authenticated;
grant select, insert on table public.answers, public.answers_preview to service_role;

-- Aviso del asesor de seguridad: la función del disparador de RLS automático no debe ser invocable por la API.
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;

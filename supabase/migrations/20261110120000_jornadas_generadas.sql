-- Jornadas generadas cada noche con la API de OpenAI (lib/generar.mjs, decisión 0017).
-- 1. days.source admite 'ia'.
-- 2. pg_cron llama a las 00:01 de Madrid a https://faraday-gg.vercel.app/api/generar-dia con pg_net.
--    pg_cron trabaja en UTC: se programa a las 22:01 y a las 23:01 UTC, que son las 00:01 de Madrid
--    en horario de verano y de invierno. La otra llamada es un reintento inofensivo: si la jornada ya
--    existe, la API no hace nada.
-- El secreto CRON_SECRET no va en el repositorio: se guarda a mano en Vault con el nombre 'cron_secret'
-- (ver docs/base-de-datos.md) y debe coincidir con la variable CRON_SECRET de Vercel.
-- Documentación: docs/base-de-datos.md

alter table public.days drop constraint days_source_check;
alter table public.days add constraint days_source_check check (source in ('piloto', 'banco-editorial', 'ia'));
comment on column public.days.source is 'piloto = escrita a mano (content/archivo, dist/questions.json); banco-editorial = content-engine.mjs; ia = generada con OpenAI (lib/generar.mjs).';

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

select cron.schedule(
  'generar-jornada',
  '1 22,23 * * *',
  $$
  select net.http_post(
    url := 'https://faraday-gg.vercel.app/api/generar-dia',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || coalesce((select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret'), '')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 300000
  );
  $$
);

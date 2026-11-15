-- Experiencia y misiones en el servidor (decisión 0061, lib/misiones.mjs).
-- player_progress gana tres columnas:
--   xp: la experiencia que lleva el servidor (de ahí salen el nivel y sus premios);
--   stats: los contadores de las misiones de hoy y de la semana, lo ya recogido y la racha de duelos;
--   stats_version: para no pisar un cambio con otro. El servidor solo guarda si la versión es la que leyó
--     (PATCH ...?player_hash=eq.X&stats_version=eq.N), como en la tabla duels.
-- Necesita las migraciones 20261114120000_preguntas_comunidad y 20261115120000_libro_contable.
-- Documentación: docs/base-de-datos.md

alter table public.player_progress
  add column xp integer not null default 0 check (xp >= 0),
  add column stats jsonb not null default '{}'::jsonb,
  add column stats_version integer not null default 0;

comment on column public.player_progress.xp is 'Experiencia que lleva el servidor (decisión 0061). La que hay dentro de state es la que pinta el navegador.';
comment on column public.player_progress.stats is 'Contadores de las misiones del día y de la semana, misiones recogidas y racha de duelos (lib/misiones.mjs).';

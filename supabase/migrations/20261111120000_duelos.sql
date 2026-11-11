-- Duelos 1 vs 1 (decisión 0023, lib/duelos.mjs).
-- Una fila por duelo. El estado completo (jugadores, vida, rondas y respuestas) va en state y lo
-- escribe solo el servidor. version permite guardar sin pisarse: cada escritura exige la versión leída.
-- Acceso: como el resto del esquema, solo desde el servidor con la clave secreta (RLS sin políticas).
-- Documentación: docs/base-de-datos.md

create table public.duels (
  id uuid primary key,
  code text not null unique check (code ~ '^[A-Z2-9]{6}$'),
  status text not null check (status in ('waiting', 'playing', 'finished')),
  public boolean not null default false,
  state jsonb not null,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.duels is 'Duelos 1 vs 1. state guarda el duelo completo tal y como lo usa lib/duelos.mjs; los jugadores se identifican por el SHA-256 de su UUID anónimo, con el apodo y el avatar que eligieron.';
comment on column public.duels.code is 'Código de 6 caracteres para invitar a un amigo.';
comment on column public.duels.public is 'true = partida rápida: cualquiera puede emparejarse mientras está en espera.';
comment on column public.duels.version is 'Control de concurrencia optimista: el servidor solo actualiza la fila si la versión es la que leyó.';

-- Partida rápida: busca duelos públicos en espera cuyo creador sigue conectado.
create index duels_waiting_idx on public.duels (created_at) where status = 'waiting' and public;

alter table public.duels enable row level security;
revoke all on table public.duels from anon, authenticated;

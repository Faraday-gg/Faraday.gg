-- Suscripciones (decisión 0076, lib/suscripcion.mjs).
-- subscriptions: quién tiene la suscripción y hasta cuándo. Una fila por jugador:
--   las filas se escriben a mano (source = 'manual') o las escribe el aviso de pago de Stripe (source = 'stripe',
--   decisión 0077), con la suscripción de Stripe en ref y su cliente en customer.
-- La suscripción está en vigor mientras until sea posterior a ahora: no hay que borrar la fila cuando caduca.
-- Acceso: como el resto del esquema, solo desde el servidor con la clave secreta (RLS sin políticas).
-- Documentación: docs/base-de-datos.md

create table public.subscriptions (
  player_hash text primary key check (player_hash ~ '^[0-9a-f]{64}$'),
  until timestamptz not null,
  source text not null default 'manual' check (source ~ '^[a-z0-9-]{1,32}$'),
  ref text check (char_length(ref) <= 200),
  customer text check (char_length(customer) <= 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.subscriptions is 'Suscripciones (decisión 0076). until = hasta cuándo vale; source = de dónde viene (manual o stripe); ref = la suscripción en Stripe; customer = el cliente en Stripe. En vigor mientras until > now().';

alter table public.subscriptions enable row level security;
revoke all on table public.subscriptions from anon, authenticated;

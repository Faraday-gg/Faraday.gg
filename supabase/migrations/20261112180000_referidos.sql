-- Referidos: el «Circuito» de amigos (decisión 0034, lib/referidos.mjs).
-- referral_codes: el código de cada jugador para invitar (enlaces ?de=CÓDIGO), con el apodo y el avatar que verán sus amigos.
-- referrals: quién invitó a quién. Un invitado tiene un único padrino. connected_at se rellena cuando el invitado juega el
-- reto del día en 3 días distintos dentro de sus primeros 14 (lo calcula el servidor con daily_results).
-- Los *_claimed marcan los premios ya cobrados; el servidor los cambia con un PATCH condicionado a false, así que un
-- premio solo se cobra una vez aunque lleguen dos peticiones a la vez.
-- Los jugadores se identifican por el SHA-256 de su UUID anónimo, como en answers, duels y leagues.
-- Acceso: como el resto del esquema, solo desde el servidor con la clave secreta (RLS sin políticas).
-- Documentación: docs/base-de-datos.md

create table public.referral_codes (
  player_hash text primary key check (player_hash ~ '^[0-9a-f]{64}$'),
  code text not null unique check (code ~ '^[A-Z2-9]{6}$'),
  name text not null check (char_length(name) between 1 and 16),
  avatar jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

comment on table public.referral_codes is 'Código de invitación de cada jugador (enlaces ?de=CÓDIGO), con el apodo y las piezas del avatar que ven sus amigos.';

create table public.referrals (
  invitee_hash text primary key check (invitee_hash ~ '^[0-9a-f]{64}$'),
  inviter_hash text not null check (inviter_hash ~ '^[0-9a-f]{64}$'),
  linked_at timestamptz not null default now(),
  connected_at timestamptz,
  welcome_claimed boolean not null default false,
  invitee_claimed boolean not null default false,
  inviter_claimed boolean not null default false,
  check (invitee_hash <> inviter_hash)
);

comment on table public.referrals is 'Quién invitó a quién (Circuito de amigos). connected_at: cuándo el invitado cumplió 3 retos del día en sus primeros 14 días.';
comment on column public.referrals.welcome_claimed is 'El invitado ya cobró el cofre Rayo de bienvenida (al terminar su primer reto del día).';
comment on column public.referrals.invitee_claimed is 'El invitado ya cobró los faradios por hacerse conexión.';
comment on column public.referrals.inviter_claimed is 'Quien invita ya cobró el premio por esta conexión.';

-- «Tus amigos»: buscar por quien invita.
create index referrals_inviter_idx on public.referrals (inviter_hash);

alter table public.referral_codes enable row level security;
alter table public.referrals enable row level security;
revoke all on table public.referral_codes, public.referrals from anon, authenticated;

-- Amigos con avatar: el aspecto del jugador (las piezas que lleva puestas) se guarda en su perfil social para
-- enseñarlo en la lista de amigos. Es opcional: mientras sea nulo, el amigo sale con el avatar por defecto.
-- El servidor (lib/social-store.mjs) funciona igual antes de aplicar esta migración, sin aspecto.
alter table public.social_profiles
  add column if not exists look jsonb check (look is null or jsonb_typeof(look) = 'object');

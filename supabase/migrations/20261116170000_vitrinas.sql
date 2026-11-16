-- Vitrinas de colecciones (decisión 0079, lib/vitrina.mjs).
-- showcases: la vitrina de un jugador: si la enseña, con qué nombre y avatar, y el código de su enlace. Lo que contiene
--   no se guarda aquí: se lee de collectibles (unidades de colección) y de items (piezas con acabado).
-- showcase_ranking: los coleccionistas que enseñan su vitrina, de más a menos unidades.
-- Necesita la migración de las ediciones.
-- Acceso: como el resto del esquema, solo desde el servidor con la clave secreta (RLS sin políticas).
-- Documentación: docs/base-de-datos.md

create table public.showcases (
  player_hash text primary key check (player_hash ~ '^[0-9a-f]{64}$'),
  code text not null unique check (code ~ '^[A-Z2-9]{8}$'),
  public boolean not null default false,
  name text not null default '' check (char_length(name) <= 40),
  avatar jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.showcases is 'Vitrinas de colecciones (decisión 0079). public = el jugador la enseña; code = lo que va en el enlace (no es la cuenta); name y avatar = con qué se presenta.';

create function public.showcase_ranking(p_limit integer)
returns table (code text, name text, avatar jsonb, units bigint, editions bigint) language sql stable set search_path = '' as $$
  select s.code, s.name, s.avatar, count(*), count(distinct c.edition)
    from public.showcases s join public.collectibles c on c.owner = s.player_hash
   where s.public
   group by s.code, s.name, s.avatar
   order by count(*) desc, count(distinct c.edition) desc, s.code
   limit greatest(1, least(p_limit, 100));
$$;

alter table public.showcases enable row level security;
revoke all on table public.showcases from anon, authenticated;
revoke execute on function public.showcase_ranking(integer) from public, anon, authenticated;

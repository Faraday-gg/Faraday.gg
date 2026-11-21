-- Estado del prototipo por entorno. Los clientes solo acceden mediante la API autenticada.
create table public.casino_rooms (
  scope text primary key check (scope in ('publico', 'preview')),
  version bigint not null check (version > 0),
  state jsonb not null check (jsonb_typeof(state) = 'object')
);

alter table public.casino_rooms enable row level security;
revoke all on public.casino_rooms from public, anon, authenticated;
grant select, insert, update on public.casino_rooms to service_role;

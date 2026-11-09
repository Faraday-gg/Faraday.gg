-- Almacén público de imágenes de las preguntas (Supabase Storage).
-- Lectura pública por URL (/storage/v1/object/public/imagenes/...), sin políticas: las imágenes ya son públicas en la web.
-- Escritura solo con la clave secreta (scripts/publicar-contenido.mjs). Documentación: docs/base-de-datos.md

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('imagenes', 'imagenes', true, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'])
on conflict (id) do nothing;

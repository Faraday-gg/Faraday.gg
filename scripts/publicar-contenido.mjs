// Publica en Supabase el contenido del repositorio (jornadas, preguntas e imágenes), solo lo que haya cambiado.
// Normalmente no hace falta ejecutarlo: lo hace Vercel en cada despliegue de producción (buildCommand de vercel.json).
// A mano, desde la raíz del repo:
//   node --env-file=.env scripts/publicar-contenido.mjs           publica los cambios
//   node --env-file=.env scripts/publicar-contenido.mjs --prueba  solo cuenta lo que cambiaría
// Escribe en la única base de datos (producción). Ver docs/base-de-datos.md.
import {publish} from '../lib/publicar.mjs';

const vercel=process.argv.includes('--vercel'),env=process.env.VERCEL_ENV;
if(vercel&&env!=='production'){
  // Las Preview (preprod y demás ramas) comparten base de datos con producción: no publican.
  console.log(`Publicación de contenido omitida: despliegue «${env||'local'}», solo se publica en producción.`);
  process.exit(0);
}
if(vercel&&!(process.env.SUPABASE_URL&&process.env.SUPABASE_SECRET_KEY)){
  console.warn('Publicación de contenido omitida: faltan SUPABASE_URL o SUPABASE_SECRET_KEY en Vercel (Production). La web usará el contenido del repositorio como respaldo.');
  process.exit(0);
}
try{
  await publish({url:process.env.SUPABASE_URL,key:process.env.SUPABASE_SECRET_KEY,dryRun:process.argv.includes('--prueba')});
}catch(error){
  console.error('No se pudo publicar el contenido en Supabase:',error.message);
  process.exit(1);
}

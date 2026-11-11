// Función única de Vercel para toda la API. vercel.json reescribe aquí /api/<ruta> y /daily-content.js.
// Variables de entorno (Vercel → Settings → Environment Variables):
//   SUPABASE_URL         URL del proyecto de Supabase
//   SUPABASE_SECRET_KEY  clave secreta sb_secret_... (solo servidor; nunca en el navegador)
//   OPENAI_API_KEY       clave de la API de OpenAI para generar la jornada de cada día (solo Production)
//   OPENAI_MODEL         opcional; modelo de OpenAI (por defecto, el de lib/generar.mjs)
//   CRON_SECRET          secreto compartido con pg_cron y el cron de Vercel para llamar a /api/generar-dia
// Esquema de la base de datos: docs/base-de-datos.md
import {createApi,json} from '../lib/api.mjs';
import {supabaseStore} from '../lib/stores.mjs';
import {generateDay} from '../lib/generar.mjs';
import {createAuth} from '../lib/auth.mjs';

const store=supabaseStore({url:process.env.SUPABASE_URL,key:process.env.SUPABASE_SECRET_KEY});
// Solo genera en producción: las Preview comparten base de datos con producción.
const generator=process.env.VERCEL_ENV==='production'&&process.env.CRON_SECRET&&process.env.OPENAI_API_KEY
  ?{secret:process.env.CRON_SECRET,run:date=>generateDay({date,store,apiKey:process.env.OPENAI_API_KEY,model:process.env.OPENAI_MODEL||undefined})}
  :undefined;
// Inicio de sesión (decisión 0018): usa la misma URL y clave secreta; los proveedores se activan en Supabase.
const auth=createAuth({url:process.env.SUPABASE_URL,key:process.env.SUPABASE_SECRET_KEY});
const api=createApi({persistDays:false,store,generator,auth});

export default {
  async fetch(request){return await api.handle(request)??json(404,{error:'Ruta no disponible'})}
};

// Función única de Vercel para toda la API. vercel.json reescribe aquí /api/<ruta> y /daily-content.js.
// Variables de entorno (Vercel → Settings → Environment Variables):
//   SUPABASE_URL         URL del proyecto de Supabase
//   SUPABASE_SECRET_KEY  clave secreta sb_secret_... (solo servidor; nunca en el navegador)
// Esquema de la base de datos: docs/base-de-datos.md
import {createApi,json} from '../lib/api.mjs';
import {supabaseStore} from '../lib/stores.mjs';

const api=createApi({
  persistDays:false,
  store:supabaseStore({url:process.env.SUPABASE_URL,key:process.env.SUPABASE_SECRET_KEY})
});

export default {
  async fetch(request){return await api.handle(request)??json(404,{error:'Ruta no disponible'})}
};

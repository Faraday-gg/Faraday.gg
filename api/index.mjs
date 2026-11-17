// Función única de Vercel para toda la API. vercel.json reescribe aquí /api/<ruta> y /daily-content.js.
// Variables de entorno (Vercel → Settings → Environment Variables):
//   SUPABASE_URL         URL del proyecto de Supabase
//   SUPABASE_SECRET_KEY  clave secreta sb_secret_... (solo servidor; nunca en el navegador)
//   OPENAI_API_KEY       clave de la API de OpenAI para generar la jornada de cada día (solo Production)
//   OPENAI_MODEL         opcional; modelo de OpenAI (por defecto, el de lib/generar.mjs)
//   OPENAI_MODERATION_MODEL opcional; modelo que filtra las preguntas de la comunidad (por defecto, gpt-5-mini)
//   STRIPE_SECRET_KEY    clave secreta de Stripe (sk_...), para cobrar la suscripción (decisión 0077; solo Production)
//   STRIPE_WEBHOOK_SECRET secreto del aviso de pago de Stripe (whsec_...), para comprobar su firma
//   STRIPE_PRICE_ID      el precio de la suscripción en Stripe (price_...)
//   CRON_SECRET          secreto compartido con pg_cron y el cron de Vercel para llamar a /api/generar-dia
// Esquema de la base de datos: docs/base-de-datos.md
import {createApi,json} from '../lib/api.mjs';
import {supabaseStore} from '../lib/stores.mjs';
import {generateDay} from '../lib/generar.mjs';
import {createAuth} from '../lib/auth.mjs';
import {communityDay,openaiModerator} from '../lib/comunidad.mjs';
import {createStripe} from '../lib/stripe.mjs';

const store=supabaseStore({url:process.env.SUPABASE_URL,key:process.env.SUPABASE_SECRET_KEY});
// Solo genera en producción: las Preview comparten base de datos con producción.
const generator=process.env.VERCEL_ENV==='production'&&process.env.CRON_SECRET&&process.env.OPENAI_API_KEY
  // Los lunes salen las 3 preguntas más votadas por la comunidad (lib/comunidad.mjs, decisión 0052).
  ?{secret:process.env.CRON_SECRET,run:date=>{
    const apiKey=process.env.OPENAI_API_KEY,model=process.env.OPENAI_MODEL||undefined;
    return generateDay({date,store,apiKey,model,community:monday=>communityDay({date:monday,community:store.community,apiKey,model})});
  }}
  :undefined;
// Inicio de sesión (decisión 0018): usa la misma URL y clave secreta; los proveedores se activan en Supabase.
const auth=createAuth({url:process.env.SUPABASE_URL,key:process.env.SUPABASE_SECRET_KEY});
// Filtro de las preguntas que proponen los jugadores. Sin OPENAI_API_KEY (Preview) solo hay comprobaciones básicas.
const moderate=openaiModerator({apiKey:process.env.OPENAI_API_KEY});
// El cobro de la suscripción (decisión 0077). Sin las variables de Stripe no se puede contratar; lo demás funciona.
const stripe=createStripe({secret:process.env.STRIPE_SECRET_KEY,webhookSecret:process.env.STRIPE_WEBHOOK_SECRET,price:process.env.STRIPE_PRICE_ID});
const api=createApi({persistDays:false,store,generator,auth,moderate,stripe,trendScope:process.env.VERCEL_ENV==='production'?'publico':'preview'});

export default {
  async fetch(request){return await api.handle(request)??json(404,{error:'Ruta no disponible'})}
};

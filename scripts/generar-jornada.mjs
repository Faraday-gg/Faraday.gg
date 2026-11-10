// Genera a mano, con la API de OpenAI, la jornada de una fecha (por defecto, mañana en Madrid).
// Normalmente no hace falta: lo hace cada noche /api/generar-dia (pg_cron de Supabase y cron de Vercel).
//   node --env-file=.env scripts/generar-jornada.mjs --prueba              genera la de mañana y la muestra, sin guardar
//   node --env-file=.env scripts/generar-jornada.mjs 2026-12-20 --prueba   lo mismo para otra fecha
//   node --env-file=.env scripts/generar-jornada.mjs 2026-12-20            la genera y la guarda en Supabase (producción)
// Necesita OPENAI_API_KEY; para guardar (y para no repetir preguntas recientes), SUPABASE_URL y SUPABASE_SECRET_KEY.
import {generateDay,tomorrow} from '../lib/generar.mjs';
import {supabaseStore} from '../lib/stores.mjs';

const dryRun=process.argv.includes('--prueba'),date=process.argv.slice(2).find(a=>!a.startsWith('--'))||tomorrow();
const store=process.env.SUPABASE_URL&&process.env.SUPABASE_SECRET_KEY?supabaseStore({url:process.env.SUPABASE_URL,key:process.env.SUPABASE_SECRET_KEY}):null;
try{
  const result=await generateDay({date,store,apiKey:process.env.OPENAI_API_KEY,model:process.env.OPENAI_MODEL||undefined,save:!dryRun});
  if(result.day&&dryRun)console.log(JSON.stringify(result.day,null,2));
  console.log(`${date}: ${result.status}${result.reason?` (${result.reason})`:''}`);
}catch(error){
  console.error(error.message);
  process.exit(1);
}

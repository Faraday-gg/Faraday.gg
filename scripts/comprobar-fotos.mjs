// Lista las fotos de ayuda que no cargan en un despliegue. Solo lee: no toca Supabase ni Vercel.
// Desde la raíz del repo:
//   node scripts/comprobar-fotos.mjs                                   producción
//   node scripts/comprobar-fotos.mjs https://faraday-gg-git-preprod-faraday-game.vercel.app
//   node scripts/comprobar-fotos.mjs http://127.0.0.1:4173             servidor local (node preview-server.mjs)
// Sale con código 1 si hay alguna rota.
import {comprobarFotos} from '../lib/fotos.mjs';

const base=process.argv[2]||'https://faraday-gg.vercel.app';
try{
  const {dias,fotos,rotas}=await comprobarFotos({base});
  console.log(`${base}: ${dias} jornadas, ${fotos} fotos, ${rotas.length} rotas.`);
  for(const r of rotas)console.log(`  ${r.dia}  ${r.pregunta}  ${r.estado}  ${r.src}`);
  process.exit(rotas.length?1:0);
}catch(error){
  console.error('No se pudo comprobar:',error.message);
  process.exit(2);
}

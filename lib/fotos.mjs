// Comprueba que cargan las fotos de ayuda de todas las jornadas que sirve un despliegue (archivo incluido).
// Mira lo que devuelve la API, no el repositorio: así detecta también contenido publicado en Supabase que
// apunta a fotos que ya no existen, o un despliegue que no lleva los ficheros de dist/assets.
// Solo hace peticiones GET y HEAD. La usan scripts/comprobar-fotos.mjs y tests/community.test.mjs.
export async function comprobarFotos({base,fetch:request=globalThis.fetch,concurrencia=8}){
  base=base.replace(/\/+$/,'');
  const get=async path=>{const r=await request(base+path,{signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error(`GET ${path} → ${r.status}`);return r.json()};
  const calendar=await get('/api/calendar');
  const ids=[...new Set([...(calendar.archive||[]),...(calendar.days||[])].map(d=>typeof d==='string'?d:d.id||d.date).filter(Boolean))].sort();
  const fotos=[],rotas=[];
  const cola=[...ids];
  await Promise.all(Array.from({length:concurrencia},async()=>{
    for(let id;(id=cola.shift());){
      const day=await get('/api/day?date='+encodeURIComponent(id));
      for(const q of day.questions||[]){
        if(!q.image?.src)continue;
        const src=/^https?:\/\//.test(q.image.src)?q.image.src:`${base}/${q.image.src.replace(/^\/+/,'')}`;
        let estado;
        try{estado=(await request(src,{method:'HEAD',signal:AbortSignal.timeout(15000)})).status}catch(error){estado=error.message}
        const foto={dia:id,pregunta:q.id,src:q.image.src,estado};
        fotos.push(foto);if(estado!==200)rotas.push(foto);
      }
    }
  }));
  const orden=(a,b)=>a.pregunta<b.pregunta?-1:1;
  return {dias:ids.length,fotos:fotos.length,rotas:rotas.sort(orden)};
}

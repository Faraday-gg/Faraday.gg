// Almacenes de respuestas. Ambos exponen la misma interfaz:
//   read(ids)               -> {questionId: {playerHash: guess}}
//   add(id, player, guess)  -> guarda la respuesta si ese jugador aún no respondió esa pregunta
import fs from 'node:fs';
import path from 'node:path';

// Archivo JSON local: una sola instancia del servidor con disco persistente.
export function fileStore(file='runtime/answers.json'){
  const target=path.resolve(file);
  let records={};
  try{records=JSON.parse(fs.readFileSync(target,'utf8'))}catch(error){if(error.code!=='ENOENT')throw error}
  return {
    kind:'archivo local',
    async read(ids){return Object.fromEntries(ids.map(id=>[id,{...(records[id]||{})}]))},
    async add(id,player,guess){
      const rows=records[id]||{};if(rows[player]!==undefined)return;
      const updated={...records,[id]:{...rows,[player]:guess}};
      fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target+'.tmp',JSON.stringify(updated));fs.renameSync(target+'.tmp',target);records=updated;
    }
  };
}

// Supabase mediante su API REST (PostgREST), sin SDK ni dependencias.
// La clave secreta (sb_secret_...) solo se usa en el servidor: va en la cabecera apikey,
// actúa como service_role y no necesita políticas RLS. Nunca debe llegar al navegador.
export function supabaseStore({url,key,table='answers',fetch:request=globalThis.fetch,pageSize=1000}={}){
  function endpoint(){
    if(!url||!key)throw Error('Faltan SUPABASE_URL o SUPABASE_SECRET_KEY');
    if(!/^[a-z_][a-z0-9_]*$/.test(table))throw Error('ANSWERS_TABLE no es un nombre de tabla válido');
    return `${url.replace(/\/+$/,'')}/rest/v1/${table}`;
  }
  async function call(target,init={}){
    const response=await request(target,{...init,headers:{apikey:key,...init.headers},signal:AbortSignal.timeout(8000)});
    if(!response.ok)throw Error(`Supabase respondió ${response.status}: ${(await response.text()).slice(0,200)}`);
    return response;
  }
  return {
    kind:`Supabase (tabla ${table})`,
    async read(ids){
      const result=Object.fromEntries(ids.map(id=>[id,{}]));if(!ids.length)return result;
      // PostgREST limita cada respuesta (1000 filas por defecto): se pagina hasta leerlo todo.
      for(let offset=0;;offset+=pageSize){
        const params=new URLSearchParams({select:'question_id,player_hash,guess',question_id:`in.(${ids.map(id=>JSON.stringify(id)).join(',')})`,order:'question_id,player_hash',limit:String(pageSize),offset:String(offset)});
        const page=await(await call(`${endpoint()}?${params}`)).json();
        for(const row of page)result[row.question_id][row.player_hash]=row.guess;
        if(page.length<pageSize)return result;
      }
    },
    async add(id,player,guess){
      // Clave primaria (question_id, player_hash): si ya existe, se ignora y se conserva la primera respuesta.
      await call(`${endpoint()}?on_conflict=question_id,player_hash`,{method:'POST',headers:{'Content-Type':'application/json',Prefer:'resolution=ignore-duplicates,return=minimal'},body:JSON.stringify({question_id:id,player_hash:player,guess})});
    }
  };
}

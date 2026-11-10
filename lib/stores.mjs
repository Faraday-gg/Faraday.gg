// Almacenes de respuestas. Ambos exponen la misma interfaz:
//   read(ids)                         -> {questionId: {playerHash: guess}}
//   add(id, player, guess, {day,source}) -> guarda la respuesta si ese jugador aún no respondió esa pregunta
//   byPlayer(player)                  -> {questionId: guess} con todas las respuestas de un jugador
// Solo Supabase guarda además el contenido (jornadas y preguntas), que la API lee de ahí:
//   days(from, to)       -> jornadas publicadas entre dos fechas, con sus preguntas en orden
//   lastDay()            -> fecha de la última jornada publicada, o null
//   dayOfQuestion(id)    -> fecha de la jornada de una pregunta, o null
//   dayInfo(date)        -> {source, questions, answered} de una fecha, o null (generación automática)
//   saveGeneratedDay(day, source) -> guarda una jornada generada por lib/generar.mjs
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
    async byPlayer(player){return Object.fromEntries(Object.entries(records).filter(([,rows])=>rows[player]!==undefined).map(([id,rows])=>[id,rows[player]]))},
    async add(id,player,guess){
      const rows=records[id]||{};if(rows[player]!==undefined)return;
      const updated={...records,[id]:{...rows,[player]:guess}};
      fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target+'.tmp',JSON.stringify(updated));fs.renameSync(target+'.tmp',target);records=updated;
    }
  };
}

// Supabase mediante su API REST (PostgREST), sin SDK ni dependencias.
// Esquema: docs/base-de-datos.md (days ──< questions ──< answers).
// La clave secreta (sb_secret_...) solo se usa en el servidor: va en la cabecera apikey,
// actúa como service_role y no necesita políticas RLS. Nunca debe llegar al navegador.
export function supabaseStore({url,key,fetch:request=globalThis.fetch,pageSize=1000}={}){
  const published=new Set();
  function endpoint(table){
    if(!url||!key)throw Error('Faltan SUPABASE_URL o SUPABASE_SECRET_KEY');
    return `${url.replace(/\/+$/,'')}/rest/v1/${table}`;
  }
  async function call(target,init={}){
    const response=await request(target,{...init,headers:{apikey:key,...init.headers},signal:AbortSignal.timeout(8000)});
    if(!response.ok)throw Error(`Supabase respondió ${response.status}: ${(await response.text()).slice(0,200)}`);
    return response;
  }
  // Inserta filas ignorando las que ya existan (misma clave de conflicto).
  const insert=(table,conflict,rows)=>call(`${endpoint(table)}?on_conflict=${conflict}`,{method:'POST',headers:{'Content-Type':'application/json',Prefer:'resolution=ignore-duplicates,return=minimal'},body:JSON.stringify(rows)});
  // answers.question_id exige que la pregunta exista: se publica la jornada y sus preguntas la primera vez.
  async function publish(day,source){
    if(published.has(day.id))return;
    await insert('days','id',{id:day.id,name:day.name,theme:day.theme||'',source});
    await insert('questions','id',day.questions.map((q,i)=>({id:q.id,day_id:day.id,position:i+1,revision:q.revision??1,title:q.title,unit:q.unit,answer:q.answer,content:q})));
    published.add(day.id);
  }
  const toDay=row=>({id:row.id,name:row.name,theme:row.theme,questions:[...row.questions].sort((a,b)=>a.position-b.position).map(q=>q.content)});
  return {
    kind:'Supabase',
    async days(from,to){
      const params=new URLSearchParams({select:'id,name,theme,questions(id,position,content)',order:'id.asc','questions.order':'position.asc'});
      params.append('id',`gte.${from}`);params.append('id',`lte.${to}`);
      const days=(await(await call(`${endpoint('days')}?${params}`)).json()).map(toDay);
      for(const day of days)if(day.questions.length)published.add(day.id);
      return days;
    },
    async lastDay(){
      const rows=await(await call(`${endpoint('days')}?select=id&order=id.desc&limit=1`)).json();
      return rows[0]?.id??null;
    },
    // Estado de una fecha para la generación automática (lib/generar.mjs): origen, preguntas y si ya tiene respuestas.
    async dayInfo(date){
      const [row]=await(await call(`${endpoint('days')}?${new URLSearchParams({select:'id,source,questions(id)',id:`eq.${date}`})}`)).json();
      if(!row)return null;
      const ids=row.questions.map(q=>q.id);
      const answered=ids.length?(await(await call(`${endpoint('answers')}?${new URLSearchParams({select:'question_id',question_id:`in.(${ids.map(id=>JSON.stringify(id)).join(',')})`,limit:'1'})}`)).json()).length>0:false;
      return {source:row.source,questions:ids.length,answered};
    },
    // Guarda una jornada generada: crea o actualiza la fila de days y sustituye sus preguntas.
    // Las preguntas anteriores de esa fecha se borran; si alguna tiene respuestas, la base de datos lo impide y falla.
    async saveGeneratedDay(day,source){
      const upsert=(table,rows)=>call(`${endpoint(table)}?on_conflict=id`,{method:'POST',headers:{'Content-Type':'application/json',Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify(rows)});
      await upsert('days',{id:day.id,name:day.name,theme:day.theme||'',source});
      const old=(await(await call(`${endpoint('questions')}?${new URLSearchParams({select:'id',day_id:`eq.${day.id}`})}`)).json()).map(q=>q.id).filter(id=>!day.questions.some(q=>q.id===id));
      if(old.length)await call(`${endpoint('questions')}?${new URLSearchParams({id:`in.(${old.map(id=>JSON.stringify(id)).join(',')})`})}`,{method:'DELETE'});
      await upsert('questions',day.questions.map((q,i)=>({id:q.id,day_id:day.id,position:i+1,revision:q.revision??1,title:q.title,unit:q.unit,answer:q.answer,content:q})));
      published.add(day.id);
    },
    async dayOfQuestion(id){
      const rows=await(await call(`${endpoint('questions')}?${new URLSearchParams({select:'day_id',id:`eq.${id}`})}`)).json();
      return rows[0]?.day_id??null;
    },
    async read(ids){
      const result=Object.fromEntries(ids.map(id=>[id,{}]));if(!ids.length)return result;
      // PostgREST limita cada respuesta (1000 filas por defecto): se pagina hasta leerlo todo.
      for(let offset=0;;offset+=pageSize){
        const params=new URLSearchParams({select:'question_id,player_hash,guess',question_id:`in.(${ids.map(id=>JSON.stringify(id)).join(',')})`,order:'question_id,player_hash',limit:String(pageSize),offset:String(offset)});
        const page=await(await call(`${endpoint('answers')}?${params}`)).json();
        for(const row of page)result[row.question_id][row.player_hash]=row.guess;
        if(page.length<pageSize)return result;
      }
    },
    async byPlayer(player){
      const params=new URLSearchParams({select:'question_id,guess',player_hash:`eq.${player}`,order:'question_id',limit:'5000'});
      const rows=await(await call(`${endpoint('answers')}?${params}`)).json();
      return Object.fromEntries(rows.map(row=>[row.question_id,row.guess]));
    },
    async add(id,player,guess,{day,source}={}){
      if(!day)throw Error(`Falta la jornada de la pregunta ${id}`);
      await publish(day,source);
      // Única por (question_id, player_hash): si ya existe, se ignora y se conserva la primera respuesta.
      await insert('answers','question_id,player_hash',{question_id:id,player_hash:player,guess});
    }
  };
}

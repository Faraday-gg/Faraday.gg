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
import {memoryLeagues} from './ligas.mjs';
import {memoryReferrals} from './referidos.mjs';

// Archivo JSON local: una sola instancia del servidor con disco persistente.
export function fileStore(file='runtime/answers.json'){
  const target=path.resolve(file);
  let records={};
  try{records=JSON.parse(fs.readFileSync(target,'utf8'))}catch(error){if(error.code!=='ENOENT')throw error}
  return {
    kind:'archivo local',
    // Ligas de amigos (lib/ligas.mjs): junto a las respuestas, en ligas.json.
    leagues:memoryLeagues(path.join(path.dirname(target),'ligas.json')),
    // Referidos (lib/referidos.mjs): en referidos.json.
    referrals:memoryReferrals(path.join(path.dirname(target),'referidos.json')),
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
    // Duelos 1 vs 1 (lib/duelos.mjs, tabla duels): el estado completo va en state y version evita que dos
    // peticiones a la vez se pisen: solo se guarda si la versión sigue siendo la que se leyó.
    duels:{
      async get(id){return (await(await call(`${endpoint('duels')}?${new URLSearchParams({select:'state,version',id:`eq.${id}`})}`)).json())[0]??null},
      async byCode(code){return (await(await call(`${endpoint('duels')}?${new URLSearchParams({select:'state,version',code:`eq.${code}`})}`)).json())[0]??null},
      // Duelos recientes de un jugador (hash SHA-256): el estado guarda players[].hash, así que se busca por contención en jsonb.
      async recent(hash,since){return await(await call(`${endpoint('duels')}?${new URLSearchParams({select:'state,version',state:`cs.${JSON.stringify({players:[{hash}]})}`,updated_at:`gte.${new Date(since).toISOString()}`,order:'updated_at.desc',limit:'5'})}`)).json()},
      async open(since){return await(await call(`${endpoint('duels')}?${new URLSearchParams({select:'state,version',status:'eq.waiting',public:'eq.true',updated_at:`gte.${new Date(since).toISOString()}`,order:'created_at.asc',limit:'5'})}`)).json()},
      async create(state){await call(endpoint('duels'),{method:'POST',headers:{'Content-Type':'application/json',Prefer:'return=minimal'},body:JSON.stringify({id:state.id,code:state.code,status:state.status,public:state.public,state,version:1,updated_at:new Date(state.seenAt).toISOString()})})},
      async save(state,version){
        const rows=await(await call(`${endpoint('duels')}?${new URLSearchParams({id:`eq.${state.id}`,version:`eq.${version}`,select:'version'})}`,{method:'PATCH',headers:{'Content-Type':'application/json',Prefer:'return=representation'},body:JSON.stringify({status:state.status,public:state.public,state,version:version+1,updated_at:new Date().toISOString()})})).json();
        return rows.length===1;
      }
    },
    // Ligas de amigos (lib/ligas.mjs, decisión 0031): tablas leagues, league_members y daily_results.
    // El límite de 15 miembros también lo comprueba la base de datos (disparador league_members_limit).
    leagues:(()=>{
      const select='id,code,name,created_at,league_members(player_hash,name,avatar,joined_at)';
      const toLeague=row=>({id:row.id,code:row.code,name:row.name,createdAt:Date.parse(row.created_at),
        members:row.league_members.map(m=>({hash:m.player_hash,name:m.name,avatar:m.avatar||{},joinedAt:Date.parse(m.joined_at)})).sort((a,b)=>a.joinedAt-b.joinedAt)});
      const get=async params=>(await(await call(`${endpoint('leagues')}?${new URLSearchParams({select,...params})}`)).json()).map(toLeague);
      const json={'Content-Type':'application/json'};
      return {
        async byCode(code){return (await get({code:`eq.${code}`}))[0]??null},
        async forPlayer(player){
          const ids=(await(await call(`${endpoint('league_members')}?${new URLSearchParams({select:'league_id',player_hash:`eq.${player}`})}`)).json()).map(row=>row.league_id);
          return ids.length?await get({id:`in.(${ids.join(',')})`}):[];
        },
        async create(league){
          await call(endpoint('leagues'),{method:'POST',headers:{...json,Prefer:'return=minimal'},body:JSON.stringify({id:league.id,code:league.code,name:league.name,created_at:new Date(league.createdAt).toISOString()})});
          const [owner]=league.members;
          await call(endpoint('league_members'),{method:'POST',headers:{...json,Prefer:'return=minimal'},body:JSON.stringify({league_id:league.id,player_hash:owner.hash,name:owner.name,avatar:owner.avatar,joined_at:new Date(owner.joinedAt).toISOString()})});
        },
        async addMember(league,member,max){
          if(league.members.some(other=>other.hash===member.hash)){
            await call(`${endpoint('league_members')}?${new URLSearchParams({league_id:`eq.${league.id}`,player_hash:`eq.${member.hash}`})}`,{method:'PATCH',headers:{...json,Prefer:'return=minimal'},body:JSON.stringify({name:member.name,avatar:member.avatar})});
            return 'exists';
          }
          if(league.members.length>=max)return 'full';
          try{await insert('league_members','league_id,player_hash',{league_id:league.id,player_hash:member.hash,name:member.name,avatar:member.avatar,joined_at:new Date(member.joinedAt).toISOString()})}
          catch(error){if(/liga_llena/.test(error.message))return 'full';if(/23503/.test(error.message))return 'missing';throw error}
          return 'ok';
        },
        async removeMember(league,player){
          await call(`${endpoint('league_members')}?${new URLSearchParams({league_id:`eq.${league.id}`,player_hash:`eq.${player}`})}`,{method:'DELETE'});
          // Una liga sin nadie se borra (sus miembros se borran en cascada, aunque ya no quede ninguno).
          const left=await(await call(`${endpoint('league_members')}?${new URLSearchParams({select:'player_hash',league_id:`eq.${league.id}`,limit:'1'})}`)).json();
          if(!left.length)await call(`${endpoint('leagues')}?${new URLSearchParams({id:`eq.${league.id}`})}`,{method:'DELETE'});
        },
        async updateProfile(player,{name,avatar}){
          await call(`${endpoint('league_members')}?${new URLSearchParams({player_hash:`eq.${player}`})}`,{method:'PATCH',headers:{...json,Prefer:'return=minimal'},body:JSON.stringify({name,avatar})});
        },
        // Única por (player_hash, day): si ya existe, se conserva la primera.
        async record(player,day,score){await insert('daily_results','player_hash,day',{player_hash:player,day,score})},
        async results(players,from,to){
          const result={};if(!players.length)return result;
          const params=new URLSearchParams({select:'player_hash,day,score',player_hash:`in.(${players.join(',')})`,limit:'1000'});
          params.append('day',`gte.${from}`);params.append('day',`lte.${to}`);
          for(const row of await(await call(`${endpoint('daily_results')}?${params}`)).json())(result[row.player_hash]??={})[row.day]=row.score;
          return result;
        }
      };
    })(),
    // Referidos, el «Circuito» de amigos (lib/referidos.mjs, decisión 0038): tablas referral_codes y referrals.
    // Cobrar un premio es un PATCH condicionado a que siga sin cobrar: si dos peticiones llegan a la vez, solo una lo cobra.
    referrals:(()=>{
      const json={'Content-Type':'application/json'},q=params=>new URLSearchParams(params);
      const toCode=row=>row&&{player:row.player_hash,code:row.code,name:row.name,avatar:row.avatar||{},createdAt:Date.parse(row.created_at)};
      const toLink=row=>({invitee:row.invitee_hash,inviter:row.inviter_hash,linkedAt:Date.parse(row.linked_at),connectedAt:row.connected_at?Date.parse(row.connected_at):null,
        claimed:{welcome:row.welcome_claimed,invitee:row.invitee_claimed,inviter:row.inviter_claimed}});
      const linkSelect='invitee_hash,inviter_hash,linked_at,connected_at,welcome_claimed,invitee_claimed,inviter_claimed';
      const column={welcome:'welcome_claimed',invitee:'invitee_claimed',inviter:'inviter_claimed'};
      const read=async(table,params)=>await(await call(`${endpoint(table)}?${q(params)}`)).json();
      return {
        async codeOf(player){return toCode((await read('referral_codes',{select:'player_hash,code,name,avatar,created_at',player_hash:`eq.${player}`}))[0])??null},
        async byCode(code){return toCode((await read('referral_codes',{select:'player_hash,code,name,avatar,created_at',code:`eq.${code}`}))[0])??null},
        // Si ese jugador ya tenía código, no se toca; si el código está repetido, la base de datos falla y se prueba otro.
        async createCode(entry){await insert('referral_codes','player_hash',{player_hash:entry.player,code:entry.code,name:entry.name,avatar:entry.avatar,created_at:new Date(entry.createdAt).toISOString()})},
        async updateProfile(player,{name,avatar}){await call(`${endpoint('referral_codes')}?${q({player_hash:`eq.${player}`})}`,{method:'PATCH',headers:{...json,Prefer:'return=minimal'},body:JSON.stringify({name,avatar})})},
        async profiles(players){
          if(!players.length)return {};
          return Object.fromEntries((await read('referral_codes',{select:'player_hash,name,avatar',player_hash:`in.(${players.join(',')})`})).map(row=>[row.player_hash,{name:row.name,avatar:row.avatar||{}}]));
        },
        async linkOf(invitee){const [row]=await read('referrals',{select:linkSelect,invitee_hash:`eq.${invitee}`});return row?toLink(row):null},
        async linksOf(inviter){return (await read('referrals',{select:linkSelect,inviter_hash:`eq.${inviter}`,limit:'500'})).map(toLink)},
        async link(row){
          const rows=await(await call(`${endpoint('referrals')}?on_conflict=invitee_hash`,{method:'POST',headers:{...json,Prefer:'resolution=ignore-duplicates,return=representation'},
            body:JSON.stringify({invitee_hash:row.invitee,inviter_hash:row.inviter,linked_at:new Date(row.linkedAt).toISOString()})})).json();
          return rows.length?'ok':'exists';
        },
        async connect(invitee,at){await call(`${endpoint('referrals')}?${q({invitee_hash:`eq.${invitee}`,connected_at:'is.null'})}`,{method:'PATCH',headers:{...json,Prefer:'return=minimal'},body:JSON.stringify({connected_at:new Date(at).toISOString()})})},
        async claim(invitee,which){
          const rows=await(await call(`${endpoint('referrals')}?${q({invitee_hash:`eq.${invitee}`,[column[which]]:'eq.false',select:'invitee_hash'})}`,{method:'PATCH',headers:{...json,Prefer:'return=representation'},body:JSON.stringify({[column[which]]:true})})).json();
          return rows.length===1;
        }
      };
    })(),
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

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
import {refreshTemplateExplanation} from '../content-engine.mjs';
import {memoryLeagues} from './ligas.mjs';
import {memoryReferrals} from './referidos.mjs';
import {memoryRanks,RULES as RANK_RULES,TOP as RANK_TOP} from './rangos.mjs';
import {memoryCommunity} from './comunidad.mjs';
import {fileTrends,ROUNDS as TREND_ROUNDS} from './tendencias.mjs';

// Archivo JSON local: una sola instancia del servidor con disco persistente.
export function fileStore(file='runtime/answers.json'){
  const target=path.resolve(file);
  let records={};
  try{records=JSON.parse(fs.readFileSync(target,'utf8'))}catch(error){if(error.code!=='ENOENT')throw error}
  return {
    kind:'archivo local',
    trends:fileTrends(path.join(path.dirname(target),'tendencias.json')),
    // Ligas de amigos (lib/ligas.mjs): junto a las respuestas, en ligas.json.
    leagues:memoryLeagues(path.join(path.dirname(target),'ligas.json')),
    // Referidos (lib/referidos.mjs): en referidos.json.
    referrals:memoryReferrals(path.join(path.dirname(target),'referidos.json')),
    // Clasificatorias (lib/rangos.mjs): en rangos.json.
    ranks:memoryRanks(path.join(path.dirname(target),'rangos.json')),
    // Preguntas de la comunidad y progreso con cuenta (lib/comunidad.mjs): en comunidad.json.
    community:memoryCommunity(path.join(path.dirname(target),'comunidad.json')),
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
  // Si la jornada ya está en la base de datos pero a medias (le faltan preguntas, o alguna está en otra posición porque
  // el contenido cambió después de publicarse), se completa: primero se mueven a su sitio las que ya están, mientras el
  // sitio esté libre, y después se insertan las que faltan en las posiciones que queden libres.
  async function publish(day,source){
    if(published.has(day.id))return;
    await insert('days','id',{id:day.id,name:day.name,theme:day.theme||'',source});
    const stored=await(await call(`${endpoint('questions')}?${new URLSearchParams({select:'id,position',day_id:`eq.${day.id}`})}`)).json();
    const wanted=new Map(day.questions.map((q,i)=>[q.id,i+1]));
    for(let pass=0;pass<day.questions.length;pass++)for(const row of stored){
      const target=wanted.get(row.id);
      if(!target||target===row.position||stored.some(other=>other!==row&&other.position===target))continue;
      await call(`${endpoint('questions')}?${new URLSearchParams({id:`eq.${row.id}`})}`,{method:'PATCH',headers:{'Content-Type':'application/json',Prefer:'return=minimal'},body:JSON.stringify({position:target})});
      row.position=target;
    }
    const have=new Set(stored.map(row=>row.id)),taken=new Set(stored.map(row=>row.position));
    const rows=day.questions.map((q,i)=>({id:q.id,day_id:day.id,position:i+1,revision:q.revision??1,title:q.title,unit:q.unit,answer:q.answer,content:q})).filter(row=>!have.has(row.id)&&!taken.has(row.position));
    if(rows.length)await insert('questions','id',rows);
    published.add(day.id);
  }
  const toDay=row=>{
    const questions=[...row.questions].sort((a,b)=>a.position-b.position);
    const day={id:row.id,name:row.name,theme:row.theme,questions:questions.map(q=>refreshTemplateExplanation(q.content))};
    // La posición se usa al combinar jornadas incompletas y no forma parte de la API pública.
    return Object.defineProperty(day,'positions',{value:new Map(questions.map(q=>[q.id,q.position-1]))});
  };
  return {
    kind:'Supabase',
    trends:{
      async answers(scope,date,player,game){
        const query=new URLSearchParams({scope:`eq.${scope}`,day:`eq.${date}`,player_hash:`eq.${player}`,
          select:'round,chart,guess',and:`(round.gte.${game*TREND_ROUNDS},round.lt.${(game+1)*TREND_ROUNDS})`});
        return (await call(`${endpoint('trend_answers')}?${query}`)).json();
      },
      async lastRound(scope,date,player){
        const query=new URLSearchParams({scope:`eq.${scope}`,day:`eq.${date}`,player_hash:`eq.${player}`,
          select:'round',order:'round.desc',limit:'1'});
        const [row]=await(await call(`${endpoint('trend_answers')}?${query}`)).json();
        return row?.round??-1;
      },
      async add(row){await insert('trend_answers','scope,day,player_hash,round',row)},
      async replay(scope,date,player,game){
        const query=new URLSearchParams({scope:`eq.${scope}`,day:`eq.${date}`,player_hash:`eq.${player}`,game:`eq.${game}`,select:'requested_at,unlocked'});
        const rows=await(await call(`${endpoint('trend_replays')}?${query}`)).json();
        return rows[0]??null;
      },
      async startReplay(scope,date,player,game,now){
        await insert('trend_replays','scope,day,player_hash,game',{scope,day:date,player_hash:player,game,requested_at:now});
        const query=new URLSearchParams({scope:`eq.${scope}`,day:`eq.${date}`,player_hash:`eq.${player}`,game:`eq.${game}`,unlocked:'eq.false'});
        await call(`${endpoint('trend_replays')}?${query}`,{method:'PATCH',
          headers:{'Content-Type':'application/json'},body:JSON.stringify({requested_at:now})});
      },
      async unlockReplay(scope,date,player,game,requested){
        const query=new URLSearchParams({scope:`eq.${scope}`,day:`eq.${date}`,player_hash:`eq.${player}`,game:`eq.${game}`});
        if(requested!==undefined)query.set('requested_at',`eq.${requested}`);
        const rows=await(await call(`${endpoint('trend_replays')}?${query}`,{method:'PATCH',
          headers:{'Content-Type':'application/json',Prefer:'return=representation'},body:JSON.stringify({unlocked:true})})).json();
        return rows.length===1;
      },
      async traces(scope,date,player,chart,after){
        return (await call(endpoint('rpc/trend_traces'),{method:'POST',headers:{'Content-Type':'application/json'},
          body:JSON.stringify({p_scope:scope,p_day:date,p_player:player,p_chart:chart,p_after:after})})).json();
      }
    },
    async days(from,to){
      const params=new URLSearchParams({select:'id,name,theme,questions(id,position,content)',order:'id.asc','questions.order':'position.asc'});
      params.append('id',`gte.${from}`);params.append('id',`lte.${to}`);
      const days=(await(await call(`${endpoint('days')}?${params}`)).json()).map(toDay);
      // Solo se da por publicada la jornada completa: si está a medias, la primera respuesta la termina de publicar.
      for(const day of days)if(day.questions.length>=3)published.add(day.id);
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
      // Cuándo empezaron los duelos de un jugador que llegaron a jugarse, desde `since` (tope diario, decisión 0076).
      async played(hash,since){return (await(await call(`${endpoint('duels')}?${new URLSearchParams({select:'created_at',state:`cs.${JSON.stringify({players:[{hash}]})}`,status:'neq.waiting',created_at:`gte.${new Date(since).toISOString()}`,limit:'200'})}`)).json()).map(row=>Date.parse(row.created_at))},
      // Sin repetir preguntas (decisión 0048): solo la lista de ids de sus últimos duelos, sin traer el estado entero.
      async seen(hash,limit){return (await(await call(`${endpoint('duels')}?${new URLSearchParams({select:'questions:state->questions',state:`cs.${JSON.stringify({players:[{hash}]})}`,status:'neq.waiting',order:'created_at.desc',limit:String(limit)})}`)).json()).map(row=>Array.isArray(row.questions)?row.questions:[])},
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
    // Clasificatorias (lib/rangos.mjs, decisión 0043): tabla ranks, una fila por jugador. Como en duels, version evita
    // que dos peticiones a la vez se pisen, y seen guarda los últimos duelos apuntados para no contar ninguno dos veces.
    ranks:(()=>{
      const json={'Content-Type':'application/json'},columns='rating,games,wins,losses,draws,shield,peak';
      const toRecord=row=>({rating:row.rating,games:row.games,wins:row.wins,losses:row.losses,draws:row.draws,shield:row.shield,peak:row.peak});
      const read=async player=>(await(await call(`${endpoint('ranks')}?${new URLSearchParams({select:columns+',seen,version',player_hash:`eq.${player}`})}`)).json())[0]??null;
      return {
        async get(player){const row=await read(player);return row?toRecord(row):null},
        async settle(player,duelId,update,profile){
          for(let attempt=0;attempt<5;attempt++){
            const row=await read(player);
            if(row?.seen?.[duelId])return row.seen[duelId];
            const {record,outcome}=update(row?toRecord(row):null);
            const seen={...(row?.seen||{}),[duelId]:outcome},keys=Object.keys(seen);
            for(const key of keys.slice(0,Math.max(0,keys.length-RANK_RULES.history)))delete seen[key];
            const body={...record,seen,name:profile.name,avatar:profile.avatar,updated_at:new Date().toISOString()};
            const rows=row
              ?await(await call(`${endpoint('ranks')}?${new URLSearchParams({player_hash:`eq.${player}`,version:`eq.${row.version}`,select:'version'})}`,{method:'PATCH',headers:{...json,Prefer:'return=representation'},body:JSON.stringify({...body,version:row.version+1})})).json()
              :await(await call(`${endpoint('ranks')}?on_conflict=player_hash`,{method:'POST',headers:{...json,Prefer:'resolution=ignore-duplicates,return=representation'},body:JSON.stringify({...body,player_hash:player,version:1})})).json();
            if(rows.length===1)return outcome;
          }
          throw Error('La ficha de rango está ocupada');
        },
        async top(limit){
          return (await(await call(`${endpoint('ranks')}?${new URLSearchParams({select:'player_hash,name,avatar,rating',rating:`gte.${RANK_TOP}`,games:`gte.${RANK_RULES.placement}`,order:'rating.desc',limit:String(limit)})}`)).json()).map(row=>({hash:row.player_hash,name:row.name,avatar:row.avatar||{},rating:row.rating}));
        }
      };
    })(),
    // Preguntas de la comunidad y progreso con cuenta (lib/comunidad.mjs, decisión 0052): tablas player_progress,
    // community_proposals y community_votes. Cobrar, votar y proponer van en funciones de la base de datos (rpc) para
    // que el saldo no se pueda gastar dos veces con dos peticiones a la vez.
    community:(()=>{
      const json={'Content-Type':'application/json'};
      // Columnas de un anuncio y su paso al formato de lib/mercado.mjs (las fechas, en milisegundos).
      const LISTING='id,edition,serial,seller,buy_now,start_bid,top_bid,top_bidder,bids,ends_at,status,sold_price,sold_by,fee,buyer,created_at,closed_at',stamp=value=>value?Date.parse(value):null;
      const toListing=row=>({id:row.id,edition:row.edition,serial:row.serial,seller:row.seller,buyNow:row.buy_now,startBid:row.start_bid,topBid:row.top_bid,topBidder:row.top_bidder,bids:row.bids,endsAt:stamp(row.ends_at),
        status:row.status,soldPrice:row.sold_price,soldBy:row.sold_by,fee:row.fee,buyer:row.buyer,at:stamp(row.created_at),closedAt:stamp(row.closed_at)});
      const toTrade=row=>row.error?row:{id:row.id,code:row.code,a:row.a,b:row.b,aName:row.a_name,bName:row.b_name,aAvatar:row.a_avatar,bAvatar:row.b_avatar,offerA:row.offer_a,offerB:row.offer_b,okA:row.ok_a,okB:row.ok_b,status:row.status,version:row.version,at:stamp(row.created_at),updatedAt:stamp(row.updated_at)};
      const toShowcase=row=>({player:row.player_hash,code:row.code,public:row.public,name:row.name,avatar:row.avatar||{}});
      const rpc=async(name,args)=>await(await call(`${endpoint('rpc/'+name)}`,{method:'POST',headers:json,body:JSON.stringify(args)})).json();
      const read=async(table,params)=>await(await call(`${endpoint(table)}?${new URLSearchParams(params)}`)).json();
      const toProposal=row=>({id:row.id,round:row.round,player:row.player_hash,name:row.name,avatar:row.avatar||{},title:row.title,unit:row.unit,note:row.note,votes:row.votes,status:row.status,questionId:row.question_id,createdAt:Date.parse(row.created_at)});
      return {
        async progress(player){const [row]=await read('player_progress',{select:'state,coins',player_hash:`eq.${player}`});return row?{state:row.state,coins:row.coins}:null},
        async saveProgress(player,state,delta,day,dailyCap,firstCap,moves={}){return await rpc('progress_save',{p_player:player,p_state:state,p_delta:delta,p_day:day,p_daily_cap:dailyCap,p_first_cap:firstCap,p_moves:moves})},
        // Libro contable (decisión 0057): wallet_move apunta el movimiento y, con referencia, no lo repite.
        async credit(player,amount,reason='premio',ref=null){return (await rpc('wallet_move',{p_player:player,p_amount:Math.max(0,amount),p_reason:reason,p_ref:ref})).coins},
        async move(player,amount,reason,ref=null){return await rpc('wallet_move',{p_player:player,p_amount:amount,p_reason:reason,p_ref:ref})},
        async stats(player){const [row]=await read('player_progress',{select:'xp,stats,stats_version,declared:state->xp',player_hash:`eq.${player}`});return row?{xp:row.xp,stats:row.stats||{},version:row.stats_version,declared:row.declared??0}:null},
        async saveStats(player,xp,stats,version){
          const response=await call(`${endpoint('player_progress')}?${new URLSearchParams({player_hash:`eq.${player}`,stats_version:`eq.${version}`})}`,{method:'PATCH',headers:{...json,Prefer:'return=representation'},body:JSON.stringify({xp,stats,stats_version:version+1})});
          return (await response.json()).length>0;
        },
        async items(player){return (await read('items',{select:'item,source',player_hash:`eq.${player}`,order:'created_at.asc',limit:'2000'}))},
        async hasItem(player,item){return (await read('items',{select:'item',player_hash:`eq.${player}`,item:`eq.${item}`,limit:'1'})).length>0},
        async addItems(player,items,source){await call(`${endpoint('items')}?on_conflict=player_hash,item`,{method:'POST',headers:{...json,Prefer:'resolution=ignore-duplicates,return=minimal'},body:JSON.stringify(items.map(item=>({player_hash:player,item,source})))})},
        async addItem(player,item,source){await call(`${endpoint('items')}?on_conflict=player_hash,item`,{method:'POST',headers:{...json,Prefer:'resolution=ignore-duplicates,return=minimal'},body:JSON.stringify({player_hash:player,item,source})})},
        // Quita piezas del inventario (fundición, decisión 0071). Devuelve las que tenía y ha quitado.
        async removeItems(player,items){
          const response=await call(`${endpoint('items')}?${new URLSearchParams({player_hash:`eq.${player}`,item:`in.(${items.map(item=>`"${item}"`).join(',')})`})}`,{method:'DELETE',headers:{Prefer:'return=representation'}});
          return (await response.json()).map(row=>row.item);
        },
        async editionNext(edition,total){return await rpc('edition_next',{p_edition:edition,p_total:total})},
        async editionCounts(){return Object.fromEntries((await read('edition_counters',{select:'edition,minted'})).map(row=>[row.edition,row.minted]))},
        async addCollectible(edition,serial,owner){await call(`${endpoint('collectibles')}`,{method:'POST',headers:{...json,Prefer:'return=minimal'},body:JSON.stringify({edition,serial,owner,minted_by:owner})})},
        async collectiblesOf(player){return await read('collectibles',{select:'edition,serial',owner:`eq.${player}`,order:'id.asc',limit:'1000'})},
        // Mercado (decisiones 0073 y 0074, lib/mercado.mjs): publicar, retirar, comprar, pujar y cerrar subastas son
        // funciones de la base de datos, cada una de una pieza. toListing pasa una fila al formato de lib/mercado.mjs.
        async marketList(seller,edition,serial,{buyNow=null,startBid=null,hours=null},max){return await rpc('market_list',{p_seller:seller,p_edition:edition,p_serial:serial,p_buy_now:buyNow,p_start_bid:startBid,p_hours:hours,p_max:max})},
        async marketCancel(id,seller){return await rpc('market_cancel',{p_listing:id,p_seller:seller})},
        async marketBuy(id,buyer,percent){return await rpc('market_buy',{p_listing:id,p_buyer:buyer,p_fee_percent:percent})},
        async marketBid(id,bidder,amount,{percent,step,snipe}){return await rpc('market_bid',{p_listing:id,p_bidder:bidder,p_amount:amount,p_fee_percent:percent,p_step_percent:step,p_snipe_seconds:Math.round(snipe/1000)})},
        async marketSettle(percent){return await rpc('market_settle',{p_fee_percent:percent})},
        async marketOpen(){return (await read('listings',{select:LISTING,status:'eq.activo',order:'id.asc',limit:'1000'})).map(toListing)},
        async marketSales(limit){return (await read('listings',{select:'edition,serial,sold_price,fee,sold_by,closed_at',status:'eq.vendido',order:'closed_at.desc',limit:String(limit)})).map(row=>({edition:row.edition,serial:row.serial,price:row.sold_price,fee:row.fee,by:row.sold_by,at:Date.parse(row.closed_at)}))},
        async marketMine(player,limit){return (await read('listings',{select:LISTING,seller:`eq.${player}`,order:'id.desc',limit:String(limit)})).map(toListing)},
        async marketBids(player){
          const rows=await read('bids',{select:'listing_id,amount,status,listings!inner(status)',bidder:`eq.${player}`,'listings.status':'eq.activo',order:'id.desc',limit:'200'}),out=[];
          for(const row of rows)if(!out.some(one=>one.listing===row.listing_id))out.push({listing:row.listing_id,amount:row.amount,status:row.status});
          return out;
        },
        // Lo que el jugador aún no ha visto; al leerlo queda marcado como visto.
        async marketNotices(player){
          const mark=async(table,filter,body,select)=>await(await call(`${endpoint(table)}?${new URLSearchParams({...filter,select})}`,{method:'PATCH',headers:{...json,Prefer:'return=representation'},body:JSON.stringify(body)})).json();
          const [closed,won,outbid]=await Promise.all([
            mark('listings',{seller:`eq.${player}`,status:'in.(vendido,caducado)',seller_seen:'is.false'},{seller_seen:true},'id,edition,serial,status,sold_price,fee'),
            mark('listings',{buyer:`eq.${player}`,status:'eq.vendido',sold_by:'in.(puja,orden)',buyer_seen:'is.false'},{buyer_seen:true},'id,edition,serial,sold_price,fee,sold_by'),
            mark('bids',{bidder:`eq.${player}`,status:'in.(superada,devuelta)',seen:'is.false'},{seen:true},'listing_id,amount,listings(edition,serial)')]);
          const brief=row=>({id:row.id,edition:row.edition,serial:row.serial,price:row.sold_price,fee:row.fee});
          return {sold:closed.filter(row=>row.status==='vendido').map(brief),expired:closed.filter(row=>row.status==='caducado').map(({id,edition,serial})=>({id,edition,serial})),won:won.map(row=>({...brief(row),by:row.sold_by})),
            outbid:outbid.map(row=>({listing:row.listing_id,edition:row.listings?.edition,serial:row.listings?.serial,amount:row.amount}))};
        },
        // Intercambios privados (decisión 0075, lib/intercambios.mjs): entrar, ofrecer, confirmar y cancelar son funciones
        // de la base de datos. toTrade pasa una fila al formato de lib/intercambios.mjs.
        async tradeCreate(player,name,avatar,code){
          const response=await request(`${endpoint('trades')}?on_conflict=code`,{method:'POST',headers:{apikey:key,...json,Prefer:'resolution=ignore-duplicates,return=representation'},body:JSON.stringify({code,a:player,a_name:name,a_avatar:avatar}),signal:AbortSignal.timeout(8000)});
          if(!response.ok)throw Error(`Supabase respondió ${response.status}: ${(await response.text()).slice(0,200)}`);
          const [row]=await response.json();return row?toTrade(row):{error:'codigo'};
        },
        async tradeJoin(code,player,name,avatar){return toTrade(await rpc('trade_join',{p_code:code,p_player:player,p_name:name,p_avatar:avatar}))},
        async tradeOffer(id,player,units){return toTrade(await rpc('trade_offer',{p_trade:id,p_player:player,p_units:units}))},
        async tradeConfirm(id,player,ok,version){return toTrade(await rpc('trade_confirm',{p_trade:id,p_player:player,p_ok:ok,p_version:version}))},
        async tradeCancel(id,player){return toTrade(await rpc('trade_cancel',{p_trade:id,p_player:player}))},
        async tradeGet(id){const [row]=await read('trades',{select:'*',id:`eq.${id}`,limit:'1'});return row?toTrade(row):null},
        async tradesOf(player,limit){return (await read('trades',{select:'*',or:`(a.eq.${player},b.eq.${player})`,order:'id.desc',limit:String(limit)})).map(toTrade)},
        // Vitrinas de colecciones (decisión 0079, lib/vitrina.mjs).
        async showcaseOf(player){const [row]=await read('showcases',{select:'player_hash,code,public,name,avatar',player_hash:`eq.${player}`,limit:'1'});return row?toShowcase(row):null},
        async showcaseByCode(code){const [row]=await read('showcases',{select:'player_hash,code,public,name,avatar',code:`eq.${code}`,limit:'1'});return row?toShowcase(row):null},
        // Si el código ya es de otro jugador, la base de datos lo rechaza (409) y se devuelve false para probar otro.
        async showcaseSave(player,{code,public:open,name,avatar}){
          const response=await request(`${endpoint('showcases')}?on_conflict=player_hash`,{method:'POST',headers:{apikey:key,...json,Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify({player_hash:player,code,public:!!open,name,avatar,updated_at:new Date().toISOString()}),signal:AbortSignal.timeout(8000)});
          if(response.status===409)return false;
          if(!response.ok)throw Error(`Supabase respondió ${response.status}: ${(await response.text()).slice(0,200)}`);
          return true;
        },
        async showcaseRanking(limit){return (await rpc('showcase_ranking',{p_limit:limit})).map(row=>({code:row.code,name:row.name,avatar:row.avatar||{},units:Number(row.units),editions:Number(row.editions)}))},
        async tradeExpire(player,before){await call(`${endpoint('trades')}?${new URLSearchParams({status:'eq.abierto',or:`(a.eq.${player},b.eq.${player})`,updated_at:`lt.${new Date(before).toISOString()}`})}`,{method:'PATCH',headers:{...json,Prefer:'return=minimal'},body:JSON.stringify({status:'caducado'})})},
        // Suscripciones (decisión 0076, lib/suscripcion.mjs).
        async subscriptionOf(player){const [row]=await read('subscriptions',{select:'until,source,customer',player_hash:`eq.${player}`,limit:'1'});return row?{until:Date.parse(row.until),source:row.source,customer:row.customer||null}:null},
        async setSubscription(player,until,source='manual',ref=null,customer=null){await call(`${endpoint('subscriptions')}?on_conflict=player_hash`,{method:'POST',headers:{...json,Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify({player_hash:player,until:new Date(until).toISOString(),source,ref,customer,updated_at:new Date().toISOString()})})},
        // Órdenes de compra, vender ya y lista de deseos (decisión 0078).
        async marketOrder(buyer,edition,price,max,percent){return await rpc('market_order',{p_buyer:buyer,p_edition:edition,p_price:price,p_max:max,p_fee_percent:percent})},
        async marketOrderCancel(id,buyer){return await rpc('market_order_cancel',{p_order:id,p_buyer:buyer})},
        async marketSellNow(seller,edition,serial,percent){return await rpc('market_sell_now',{p_seller:seller,p_edition:edition,p_serial:serial,p_fee_percent:percent})},
        async marketOrders(){return (await read('buy_orders',{select:'id,edition,buyer,price,created_at',status:'eq.abierta',order:'id.asc',limit:'2000'})).map(row=>({id:row.id,edition:row.edition,buyer:row.buyer,price:row.price,at:Date.parse(row.created_at)}))},
        async wishSet(player,edition,on){
          if(on)await call(`${endpoint('wishlist')}?on_conflict=player_hash,edition`,{method:'POST',headers:{...json,Prefer:'resolution=ignore-duplicates,return=minimal'},body:JSON.stringify({player_hash:player,edition})});
          else await call(`${endpoint('wishlist')}?${new URLSearchParams({player_hash:`eq.${player}`,edition:`eq.${edition}`})}`,{method:'DELETE',headers:{Prefer:'return=minimal'}});
        },
        async wishesOf(player){return (await read('wishlist',{select:'edition',player_hash:`eq.${player}`,limit:'500'})).map(row=>row.edition)},
        async wishCounts(){return Object.fromEntries((await rpc('wishlist_counts',{})).map(row=>[row.edition,Number(row.wishes)]))},
        async marketOwners(){return Object.fromEntries((await rpc('market_owners',{})).map(row=>[row.edition,{owners:Number(row.owners),units:Number(row.units)}]))},
        async ledgerHas(player,reason,ref){return (await read('ledger',{select:'id',player_hash:`eq.${player}`,reason:`eq.${reason}`,ref:`eq.${ref}`,limit:'1'})).length>0},
        async ledgerSum(player,reasons,day){return (await read('ledger',{select:'amount',player_hash:`eq.${player}`,day:`eq.${day}`,amount:'gt.0',reason:`in.(${reasons.join(',')})`,limit:'1000'})).reduce((sum,row)=>sum+row.amount,0)},
        async ledgerCount(player,reasons,day){return (await read('ledger',{select:'id',player_hash:`eq.${player}`,day:`eq.${day}`,reason:`in.(${reasons.join(',')})`,limit:'200'})).length},
        async ledger(player,limit=50){return await read('ledger',{select:'amount,reason,source,ref,balance,day',player_hash:`eq.${player}`,order:'id.desc',limit:String(limit)})},
        async propose(entry,cost,max){return await rpc('community_propose',{p_id:entry.id,p_round:entry.round,p_player:entry.player,p_name:entry.name,p_avatar:entry.avatar,p_title:entry.title,p_unit:entry.unit,p_note:entry.note,p_cost:cost,p_max:max})},
        async vote(id,round,player,cost){return await rpc('community_vote',{p_proposal:id,p_round:round,p_player:player,p_cost:cost})},
        async proposals(round,limit=100){return (await read('community_proposals',{select:'id,round,player_hash,name,avatar,title,unit,note,votes,status,question_id,created_at',round:`eq.${round}`,order:'votes.desc,created_at.asc',limit:String(limit)})).map(toProposal)},
        async votedBy(player,ids){
          if(!ids.length)return new Set();
          return new Set((await read('community_votes',{select:'proposal_id',player_hash:`eq.${player}`,proposal_id:`in.(${ids.join(',')})`})).map(row=>row.proposal_id));
        },
        async setStatus(id,status,questionId=null){await call(`${endpoint('community_proposals')}?${new URLSearchParams({id:`eq.${id}`})}`,{method:'PATCH',headers:{...json,Prefer:'return=minimal'},body:JSON.stringify({status,question_id:questionId})})}
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

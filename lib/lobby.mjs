// Lobby público: la sala a la que llega cada jugador al entrar al juego. Hasta 20 por lobby; se llena siempre el de
// número más bajo con hueco y solo entonces se abre el siguiente. Dentro se ve a los demás, se chatea, se reta a
// duelo y se pide amistad. Funciona con cuenta y sin ella (cookie del jugador). Es la acción POST /api/lobby.
//
// No hay conexiones abiertas: el navegador manda un «pulso» cada poco y recibe la vista entera. Para que 20 pulsos
// por segundo no compitan por una misma fila, cada jugador solo escribe la suya (lib/lobby-store.mjs) y el chat y
// las señales son filas nuevas con un número creciente que hace de cursor (`since`).
// Ritmo de los pulsos del navegador (dist/lobby.js): cada 1,5 s mientras hay actividad en la sala, cada 6 s en reposo
// y, dentro de un juego, cada 8 s (3 s con el chat abierto).
import {randomUUID} from 'node:crypto';
import {chatText} from './duelos.mjs';
import {SALON_ACTS,SALON_CHAT} from './casino.mjs';
import {cleanName,lookOf,sameLook,newProfile} from './social.mjs';

// Tamaño de la sala y ritmos. El cliente copia estas cifras: x va de -w/2 a w/2 y z de -d/2 a d/2, con el centro en 0,0.
export const LOBBY={
  w:30,d:22,           // ancho (x) y fondo (z) de la sala
  cap:20,              // jugadores por lobby
  presenceMs:15000,    // sin pulso durante este tiempo, el jugador deja de estar (ver STALE)
  keepAliveMs:4000,    // quieto, la fila se vuelve a escribir cada 4 s
  moveMs:900,          // moviéndose (o al cambiar de nombre o aspecto), como mucho una escritura cada 0,9 s
  actMs:300            // un gesto nuevo o un cambio de «where» se escriben enseguida
};
// La fila no se escribe en cada pulso, así que su última escritura puede ser hasta keepAliveMs anterior al último
// pulso. Para no echar a nadie que sigue mandando pulsos, se da por ausente a quien lleva presenceMs + keepAliveMs
// (19 s) sin escribir: entre 15 y 19 s después de su último pulso. Con los ritmos del navegador hay margen: a 6 u 8 s
// por pulso cada pulso escribe la fila (lleva más de keepAliveMs sin escribirse), así que se puede perder un pulso de
// los de 8 s (16 s sin señal) o dos de los de 6 s (18 s) sin desaparecer de la sala. Una pestaña en segundo plano,
// a la que el navegador deja mandar un pulso por minuto, sí sale y vuelve a entrar (con su mismo identificador).
const STALE=LOBBY.presenceMs+LOBBY.keepAliveMs;
// Chat: los mismos límites que el del Salón (140 caracteres, 6 mensajes cada 10 s, 0,4 s entre dos) y se enseñan 2 minutos.
// roomBurst: además, entre todos los de una sala, 20 mensajes cada 10 s. Cada invitado nuevo (una cookie inventada)
// trae su propio cupo, así que sin este tope bastarían unas cuantas identidades para inundar el chat.
export const LOBBY_CHAT={...SALON_CHAT,maxText:140,roomBurst:20};
export const LOBBY_PLACES=['lobby','daily','duel','trends','ascension','archivo','casino','otros'];
export const LOBBY_GAMES=['estimacion','ascension','traza','archivo'];
export const LOBBY_SIGNALS={
  retoGapMs:15000,     // un reto al mismo jugador cada 15 s
  burst:8,burstMs:60000, // y como mucho 8 retos o peticiones de amistad por minuto en total
  declineMs:300000,    // un reto se puede rechazar hasta 5 minutos después
  friendMs:600000,     // una petición de amistad se puede aceptar durante 10 minutos
  shown:{reto:60000,'reto-no':60000,amistad:600000,'amistad-ok':60000}, // cuánto tiempo se entrega cada señal
  batch:200            // señales que caben en una vista (las más recientes de los últimos 10 minutos)
};
// Lo caducado se borra al entrar alguien, como mucho una vez por minuto en cada instancia del servidor: presencias sin
// señal desde hace 10 minutos y eventos de más de 15.
const KEEP={presenceMs:600000,eventsMs:900000,everyMs:60000};
// Veces que se intenta coger turno para un mensaje o una invitación cuando otra petición se adelanta (lib/lobby-store.mjs).
const TURNS=3;
// Amistades y perfil social de cada cuenta, recordados unos segundos en esta instancia para no consultarlos en cada pulso.
const CIRCLE_MS=10000;

const ACTIONS=new Set(['pulso','salir','chat','retar','rechazar-reto','amistad','aceptar-amistad']);
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/,CODE=/^[A-Z2-9]{6}$/;
const ok=body=>({status:200,body});
const fail=(status,error)=>({status,body:{error}});
const iso=time=>new Date(time).toISOString();
const round=(value,limit,scale)=>Math.round(Math.min(limit,Math.max(-limit,value))*scale)/scale||0;
const levelOf=value=>Number.isInteger(value)&&value>=1?Math.min(value,999):null;
const actOf=act=>!act||typeof act!=='object'||!SALON_ACTS.has(act.name)||!Number.isInteger(act.n)||act.n<1||act.n>1e9?null:{name:act.name,n:act.n};
const uuidOf=value=>typeof value==='string'&&UUID.test(value.toLowerCase())?value.toLowerCase():null;
// Medio emoji suelto (una mitad de par sustituto) no se puede guardar en la base de datos: se quita.
const wellFormed=text=>text.replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g,'');

// Filtro básico de palabras: una lista corta de insultos graves. Es un chat entre desconocidos y no hay moderación:
// esto y el botón de silenciar del cliente son la defensa mínima, no una garantía. Se compara palabra a palabra
// (así «computadora» o «disputa» no saltan), sin mayúsculas ni tildes, con las cifras más usadas como letras
// (put0, put4) y con letras repetidas (puuuta). No detecta palabras separadas por espacios o puntos ni otros idiomas.
const WORDS=['puta','puto','putas','putos','putita','puton','hijoputa','hijaputa','hijueputa','joputa','hdp','gilipollas','gilipolla',
  'subnormal','subnormales','maricon','maricones','maricona','marica','maricas','bollera','bolleras','bujarra','travelo','zorra','zorras',
  'guarra','guarras','furcia','ramera','cabron','cabrona','cabrones','mongolo','mongola','mongolico','mongolica','sudaca','sudacas',
  'negrata','negratas','moromierda','malparido','malparida','suicidate','matate','nigger','niggers','nigga','faggot'];
// Cada letra puede alargarse (p+u+t+a+); una doble (ll, rr) tiene que seguir siendo al menos doble, para no tachar «bolera».
const stretch=word=>word.replace(/(.)\1*/g,(run,letter)=>run.length>1?`${letter}{${run.length},}`:letter+'+');
const BANNED=new RegExp(`^(?:${WORDS.map(stretch).join('|')})$`);
const LEET={0:'o',1:'i',3:'e',4:'a',5:'s',7:'t','@':'a',$:'s'};
const fold=token=>token.toLowerCase().normalize('NFD').replace(/\p{M}/gu,'').replace(/[013457@$]/g,sign=>LEET[sign]);
export function filterWords(text){
  if(typeof text!=='string')return '';
  return text.replace(/[\p{L}\p{M}\p{N}@$]+/gu,token=>BANNED.test(fold(token))?'*'.repeat(Array.from(token).length):token);
}
// Nombre que se enseña a los demás: 24 caracteres, sin caracteres raros y pasado por el filtro. Como el nombre del
// perfil de los duelos, no lleva <>&"'` (el navegador lo pinta como texto, pero así tampoco hace daño si alguna pantalla
// se descuida) y, como el chat, los caracteres invisibles de ancho cero y de dirección se quedan en un espacio.
const MARKUP=/[<>&"'`]/g,HIDDEN=/[\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff]/g;
export const lobbyName=value=>typeof value==='string'?filterWords(cleanName(wellFormed(value).replace(MARKUP,'').replace(HIDDEN,' '))):'';
export const lobbyText=value=>filterWords(wellFormed(chatText(typeof value==='string'?wellFormed(value):value)).trim());

export function createLobby({store,social,scope,now=Date.now}){
  const circles=new Map();
  let purgedAt=null; // última limpieza de esta instancia
  // Perfil social y amistades de una cuenta. Si el almacén social falla, el lobby sigue sin marcar amigos.
  async function circleOf(player,time){
    const hit=circles.get(player);
    if(hit&&time>=hit.at&&time-hit.at<CIRCLE_MS)return hit;
    let entry={at:time,profile:null,friends:new Set()};
    try{
      const [profile,rows]=await Promise.all([social.profile(scope,player),social.friends(scope,player)]);
      entry={at:time,profile,friends:new Set(rows.map(row=>row.first_player===player?row.second_player:row.first_player))};
    }catch{}
    if(circles.size>=500)circles.clear();
    circles.set(player,entry);
    return entry;
  }
  // El lobby de número más bajo con hueco. Dos entradas a la vez pueden ver el mismo hueco: se corrige en view().
  async function pickRoom(player,cutoff){
    const counts=new Map();
    for(const room of await store.rooms(scope,cutoff,player))counts.set(room,(counts.get(room)||0)+1);
    for(let room=1;;room++)if((counts.get(room)||0)<LOBBY.cap)return room;
  }
  async function view(me,account,since,time){
    const player=me.player_hash,cutoff=iso(time-STALE);
    // El chat de la sala y las señales para mí se leen por separado, cada cosa con su ventana (2 minutos de chat;
    // las señales, lo que dura la que más dura) y su tope: por mucho que se hable, una señal vigente no se queda fuera.
    const read=room=>Promise.all([store.room(scope,room,cutoff),
      store.chat(scope,{room,since,after:iso(time-LOBBY_CHAT.shown),limit:LOBBY_CHAT.keep}),
      store.signals(scope,{player,since,after:iso(time-LOBBY_SIGNALS.friendMs),limit:LOBBY_SIGNALS.batch})]);
    let [[rows,talk,calls],circle]=await Promise.all([read(me.room),account?circleOf(player,time):null]);
    // Si varias entradas simultáneas han pasado del tope, los últimos en llegar se mudan al siguiente lobby con hueco.
    if(rows.length>LOBBY.cap&&rows.findIndex(row=>row.player_hash===player)>=LOBBY.cap){
      const room=await pickRoom(player,cutoff);
      if(room!==me.room){
        const patch={room,joined_at:iso(time),seen_at:iso(time)};
        await store.touch(scope,player,patch);
        me={...me,...patch};
        [rows,talk,calls]=await read(room);
      }
    }
    const others=rows.filter(row=>row.player_hash!==player);
    const chat=[],signals=[];
    for(const event of talk){
      const at=Date.parse(event.created_at);
      if(time-at<LOBBY_CHAT.shown)chat.push({n:event.n,id:event.from_id,name:event.from_name,text:event.body,mine:event.from_hash===player,at});
    }
    for(const event of calls){
      const at=Date.parse(event.created_at);
      if(!(time-at<LOBBY_SIGNALS.shown[event.kind]))continue;
      const signal={n:event.n,kind:event.kind,from:{id:event.from_id,name:event.from_name,look:event.from_look||{}},at};
      if(event.kind==='reto')Object.assign(signal,{game:event.game,code:event.code});
      signals.push(signal);
    }
    return {
      room:{n:me.room,count:others.length+1,cap:LOBBY.cap},
      you:{id:me.id,account,social:!!circle?.profile},
      players:others.map(row=>({id:row.id,name:row.name,look:row.look||{},level:row.level,x:row.x,z:row.z,heading:row.heading,act:row.act??null,
        where:row.place,friend:!!circle&&row.account&&circle.friends.has(row.player_hash),account:row.account})),
      chat:chat.slice(-LOBBY_CHAT.keep),signals,
      cursor:Math.max(since,...talk.map(event=>event.n),...calls.map(event=>event.n)),serverTime:time
    };
  }
  // El aspecto con el que se entra al lobby se copia al perfil social, para que los amigos vean el avatar al día.
  async function shareLook(player,look,time){
    if(!Object.keys(look).length)return;
    try{
      const circle=await circleOf(player,time);
      if(!circle.profile||sameLook(circle.profile.look,look))return;
      if(await social.setLook?.(scope,player,look))circle.profile={...circle.profile,look};
    }catch{}
  }

  return async function lobby({player,account},data){
    const action=data.action;
    if(!ACTIONS.has(action))return fail(400,'Acción del lobby no válida.');
    const time=now(),stamp=iso(time),cutoff=iso(time-STALE);
    const since=Number.isSafeInteger(data.since)&&data.since>0?data.since:0;
    let me=await store.presence(scope,player);
    const alive=!!me&&Date.parse(me.seen_at)>time-STALE;
    if(action==='salir'){
      // La fila se conserva (con su identificador público) por si vuelve enseguida; solo deja de contar como presente.
      if(alive)await store.touch(scope,player,{seen_at:iso(time-STALE-1000)});
      return ok({ok:true});
    }
    if(action==='pulso'){
      // Lo que no llega o no vale se queda como estaba.
      const name=lobbyName(data.name)||me?.name||'Jugador';
      const look=data.look&&typeof data.look==='object'&&!Array.isArray(data.look)?lookOf(data.look):lookOf(me?.look);
      const level=levelOf(data.level)??me?.level??1;
      const place=LOBBY_PLACES.includes(data.where)?data.where:me?.place??'lobby';
      const x=Number.isFinite(data.x)?round(data.x,LOBBY.w/2,10):me?.x??0;
      const z=Number.isFinite(data.z)?round(data.z,LOBBY.d/2,10):me?.z??0;
      const heading=Number.isFinite(data.heading)?round(data.heading,Math.PI*2,100):me?.heading??0;
      const act=actOf(data.act)??(alive?me.act:null)??null;
      if(!alive){
        const room=await pickRoom(player,cutoff);
        me={scope,player_hash:player,id:me?.id??randomUUID(),room,name,look,level,x,z,heading,act,place,account,joined_at:stamp,seen_at:stamp};
        await store.enter(me);
        // Limpieza oportunista (no hay tarea programada), como mucho una por minuto: si falla, la entrada sigue.
        if(purgedAt===null||time-purgedAt>=KEEP.everyMs||time<purgedAt){
          purgedAt=time;
          await store.purge(scope,iso(time-KEEP.presenceMs),iso(time-KEEP.eventsMs)).catch(()=>{});
        }
        if(account)await shareLook(player,look,time);
      }else{
        // Como en el Salón, la fila no se escribe en cada pulso: solo si ha cambiado algo o toca dar señal de vida.
        const idle=time-Date.parse(me.seen_at);
        const dressed=me.name!==name||me.level!==level||me.account!==account||!sameLook(me.look,look);
        const moved=me.x!==x||me.z!==z||me.heading!==heading;
        const acted=(!!act&&act.n!==me.act?.n)||me.place!==place;
        if(idle>=LOBBY.keepAliveMs||acted&&idle>=LOBBY.actMs||(moved||dressed)&&idle>=LOBBY.moveMs){
          const patch={name,look,level,x,z,heading,act,place,account,seen_at:stamp};
          await store.touch(scope,player,patch);
          if(account&&!sameLook(me.look,look))await shareLook(player,look,time);
          me={...me,...patch};
        }
      }
      return ok(await view(me,account,since,time));
    }

    if(!alive)return fail(409,'Vuelve a entrar al lobby.');
    const event=(kind,extra)=>({scope,room:me.room,kind,from_hash:player,from_id:me.id,from_name:me.name,from_look:kind==='chat'?null:lookOf(me.look),
      to_hash:null,body:null,game:null,code:null,slot:null,created_at:stamp,...extra});
    // Otro jugador presente en mi mismo lobby, por su identificador público.
    const peer=async()=>{
      const id=uuidOf(data.to),row=id?await store.byId(scope,id):null;
      return row&&row.player_hash!==player&&row.room===me.room&&Date.parse(row.seen_at)>time-STALE?row:null;
    };
    const age=sent=>time-Date.parse(sent.created_at);
    // Una invitación (reto o petición de amistad) a `target`. Las invitaciones de cada jugador van en cadena (ver
    // «Turnos» en lib/lobby-store.mjs): se leen las últimas, se comprueban los límites y se coge el turno siguiente a la
    // más reciente. Si otra petición del mismo jugador se adelanta, se vuelve a leer y a decidir, así que el tope de 8
    // por minuto (y lo que compruebe `check`) vale también con peticiones en paralelo.
    // check(enviadas) devuelve la respuesta que corta el envío, o null para seguir.
    async function invite(kind,target,extra,check){
      for(let attempt=0;attempt<TURNS;attempt++){
        const sent=await store.sent(scope,player),stop=await check(sent);
        if(stop)return stop;
        if(sent.filter(one=>age(one)<LOBBY_SIGNALS.burstMs).length>=LOBBY_SIGNALS.burst)break;
        if(await store.addEvent(event(kind,{to_hash:target.player_hash,...extra,slot:`i:${player}:${sent.at(-1)?.n??0}`})))return ok({ok:true});
      }
      return fail(429,'Has enviado demasiadas invitaciones. Espera un momento.');
    }

    if(action==='chat'){
      const text=lobbyText(data.text);
      if(!text)return fail(400,'Escribe un mensaje.');
      // Los mensajes de una sala van en cadena (ver «Turnos» en lib/lobby-store.mjs): se leen los últimos, se
      // comprueban mi cupo y el de la sala y se coge el turno siguiente al mensaje más reciente. Si otro mensaje se
      // adelanta, se vuelve a leer: así los límites valen también con peticiones en paralelo.
      for(let attempt=0;attempt<TURNS;attempt++){
        const tail=await store.chatTail(scope,me.room),recent=tail.filter(sent=>age(sent)<LOBBY_CHAT.burstMs);
        const mine=recent.filter(sent=>sent.from_hash===player);
        if(mine.length>=LOBBY_CHAT.burst||mine.some(sent=>age(sent)<LOBBY_CHAT.gapMs))return fail(429,'Vas muy rápido. Espera un momento.');
        if(recent.length>=LOBBY_CHAT.roomBurst)break;
        if(await store.addEvent(event('chat',{body:text,slot:`c:${me.room}:${tail.at(-1)?.n??0}`})))return ok(await view(me,account,since,time));
      }
      return fail(429,'El chat va muy rápido. Espera un momento.');
    }
    if(action==='retar'){
      const game=data.game===undefined?'estimacion':data.game,code=typeof data.code==='string'?data.code.trim().toUpperCase():'';
      if(!LOBBY_GAMES.includes(game))return fail(400,'Ese juego no admite retos.');
      if(!CODE.test(code))return fail(400,'Código de duelo no válido.');
      if(uuidOf(data.to)===me.id)return fail(400,'No puedes retarte a ti mismo.');
      const target=await peer();
      if(!target)return fail(404,'Ese jugador ya no está en tu lobby.');
      return invite('reto',target,{game,code},sent=>sent.some(one=>one.kind==='reto'&&one.to_hash===target.player_hash&&age(one)<LOBBY_SIGNALS.retoGapMs)
        ?fail(429,'Ya has retado a este jugador. Espera unos segundos.'):null);
    }
    if(action==='rechazar-reto'){
      const id=uuidOf(data.to);
      const reto=id?await store.find(scope,{kind:'reto',fromId:id,to:player,after:iso(time-LOBBY_SIGNALS.declineMs)}):null;
      if(!reto)return fail(404,'Ese reto ya no está disponible.');
      // Rechazar dos veces el mismo reto no avisa dos veces.
      const done=await store.find(scope,{kind:'reto-no',from:player,to:reto.from_hash,after:iso(Date.parse(reto.created_at)-1)});
      if(!done||done.n<reto.n)await store.addEvent(event('reto-no',{to_hash:reto.from_hash}));
      return ok({ok:true});
    }
    if(action==='amistad'){
      if(!account)return fail(401,'Entra con tu cuenta para pedir amistad.');
      if(uuidOf(data.to)===me.id)return fail(400,'No puedes pedirte amistad a ti mismo.');
      const target=await peer();
      if(!target)return fail(404,'Ese jugador ya no está en tu lobby.');
      if(!target.account)return fail(409,'Ese jugador juega sin cuenta y todavía no puede tener amigos.');
      const [first,second]=[player,target.player_hash].sort();
      const link=await social.pair(scope,first,second);
      if(link)return fail(409,link.blocked_by?'No se puede enviar la solicitud a este jugador.':'Ya sois amigos.');
      // Mientras la petición anterior siga viva no se manda otra (se busca después de leer las enviadas, para que
      // dos peticiones a la vez no dejen dos avisos).
      return invite('amistad',target,{},async()=>await store.find(scope,{kind:'amistad',from:player,to:target.player_hash,after:iso(time-LOBBY_SIGNALS.friendMs)})?ok({ok:true}):null);
    }
    // aceptar-amistad: quien la pidió se saca de la petición guardada, así que vale aunque ya se haya ido del lobby.
    if(!account)return fail(401,'Entra con tu cuenta para aceptar amistades.');
    const id=uuidOf(data.to);
    const ask=id?await store.find(scope,{kind:'amistad',fromId:id,to:player,after:iso(time-LOBBY_SIGNALS.friendMs)}):null;
    if(!ask||ask.from_hash===player)return fail(404,'Esa solicitud de amistad ya no está disponible.');
    const [first_player,second_player]=[player,ask.from_hash].sort();
    let link=await social.pair(scope,first_player,second_player);
    if(link)return fail(409,link.blocked_by?'No se puede aceptar esta solicitud.':'Ya sois amigos.');
    // A quien le falte el perfil social se le crea con su nombre del lobby (y su aspecto, si la columna existe).
    for(const [hash,name,look] of [[player,me.name,me.look],[ask.from_hash,ask.from_name,ask.from_look]]){
      if(await social.profile(scope,hash))continue;
      await social.createProfile(newProfile({scope,player:hash,name,stamp}));
      if(Object.keys(lookOf(look)).length)await Promise.resolve(social.setLook?.(scope,hash,lookOf(look))).catch(()=>false);
    }
    await social.createContact({scope,id:randomUUID(),first_player,second_player,blocked_by:null,messages:[],version:1});
    link=await social.pair(scope,first_player,second_player);
    if(!link||link.blocked_by)return fail(409,'No se pudo crear la amistad. Inténtalo de nuevo.');
    circles.delete(player);circles.delete(ask.from_hash);
    await store.addEvent(event('amistad-ok',{to_hash:ask.from_hash}));
    // friend.id es el identificador de la amistad (el que usa /api/social para el chat); friend.player, el del lobby.
    return ok({ok:true,friend:{id:link.id,name:ask.from_name,player:ask.from_id}});
  };
}

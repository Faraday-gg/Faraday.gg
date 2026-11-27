// Lobby: la portada es una plaza compartida. Nada más entrar, el jugador está en un lobby de hasta 20 personas
// (el servidor reparte las salas, /api/lobby) y ve a los demás con su avatar y su nombre. Se anda con un clic en el
// suelo, con el teclado o con la palanca táctil; un clic en otro jugador hace que el avatar vaya corriendo hasta él
// y, al llegar, se abre un menú para retarle, pedirle amistad, saludarle o silenciarle.
// La plaza la construye lobby-world.js; el personaje, avatar3d.js (Avatar3D.build); la caja de chat, chat-dock.js,
// que habla con este archivo por window.Lobby y los eventos faraday:lobby y faraday:lobby-chat.
// Sin WebGL, con «reducir movimiento» o con ahorro de datos queda la vista plana: el avatar de siempre y la lista
// de jugadores, con las mismas acciones. Un fallo aquí no debe romper la portada: todo lo ajeno va con «?.».
import {EMOTES} from './casino-chat.js';
import {createPlaza,collide,inside,SPAWN} from './lobby-world.js';

const THREE_URL='https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js',API='/api/lobby';
// Ritmo del pulso (cada pulso es una llamada al servidor, que da por ido a quien lleva 15-19 s sin mandar ninguno):
// rápido con el lobby a la vista y actividad reciente; en reposo, cada 6 s; dentro de un juego, cada 8 s (o cada 3 s
// con la caja de chat desplegada, que es cuando se está leyendo). Con la pestaña oculta no hay pulsos.
const FAST=1500,REST=6000,GAME=8000,GAME_CHAT=3000,RETRY=30000,IDLE_AFTER=20000,POKE_GAP=600;
// Tras un fallo de red (o un 5xx) se reintenta a los 3, 6, 15 y 30 s; al tercero seguido se pasa a «solo».
const BACKOFF=[3000,6000,15000,30000];
// CHASE: segundos (de simulación) que se persigue a un jugador; MENU_FAR: metros a los que su menú se cierra solo;
// MENU_GUARD: ms tras abrirse en los que el menú no atiende clics (se abre bajo el cursor de quien venía pulsando).
const REACH=1.4,CHASE=8,MENU_FAR=8,MENU_GUARD=250,WALK=4.6,RUN=3.2,JUMP=6.4,GRAVITY=19;
// Nivel de detalle: cuántos jugadores (los más cercanos) llevan modelo 3D completo; el resto es una imagen plana.
// FULL_STICK: metros de ventaja de quien ya lo lleva, para que no parpadee al cruzar el umbral.
const FULL_WIDE=8,FULL_LITE=5,FULL_STICK=1.5;
const PAPER='#fffdf7',CORAL='#ff6548',YELLOW='#ffdb70',MINT='#9bddb0';
const WHERE={lobby:'En el lobby',daily:'En el reto diario',duel:'En un duelo',trends:'Trazando una tendencia',ascension:'En Ascensión',archivo:'En Archivo Vivo',casino:'En el Salón',otros:'Mirando otras cosas'};
const GAME_NAMES={estimacion:'Estimación',ascension:'Ascensión',traza:'Traza',archivo:'Archivo Vivo'};
// Qué pantalla hay abierta: de ahí sale «where». Los diálogos modales van primero porque tapan todo lo demás.
const DIALOGS=[['casino','casino'],['archivo-vivo','archivo'],['ascension-dialog','ascension'],['trends-dialog','trends'],['social-drawer','otros'],['auth-dialog','otros']];
const SHELLS=[['duel-shell','duel'],['game-shell','daily'],['league-shell','otros'],['community-shell','otros'],['circuit-shell','otros'],['profile-shell','otros'],['market-shell','otros']];
const NICK='casi-casi:duelo:perfil',MUTED='casi-casi:lobby:silenciados',SEEN='casi-casi:lobby:senales',HINTED='faraday:lobby:pista';

const $=id=>document.getElementById(id);
const section=document.querySelector('.portal-avatar'),stage=$('lobby-stage'),canvas=$('lobby-canvas'),bar=$('lobby-bar'),layer=$('lobby-bubbles');
const badge=$('lobby-badge'),count=$('lobby-count'),rosterToggle=$('lobby-roster-toggle'),roster=$('lobby-roster'),rosterList=$('lobby-roster-list'),rosterEmpty=$('lobby-roster-empty');
const emoteToggle=$('lobby-emote-toggle'),wheel=$('lobby-emotes'),expandButton=$('lobby-expand'),noteBox=$('lobby-note'),pad=$('lobby-stick');
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches,saver=!!navigator.connection?.saveData;
const coarse=matchMedia('(pointer: coarse)').matches,narrow=matchMedia('(max-width: 619px)');

// ---------- Utilidades ----------
const clean=(value,max)=>String(value??'').replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim().slice(0,max);
const num=(value,fallback=0)=>{const n=Number(value);return Number.isFinite(n)?n:fallback};
const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a)),round=n=>Math.round(n*100)/100,clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
const emit=(name,detail)=>document.dispatchEvent(new CustomEvent(name,{detail}));
const setText=(node,text)=>{if(node.textContent!==text)node.textContent=text};
// Crea un elemento. «text» va como texto; «html» solo se usa con marcado propio (Avatar.render, iconos), nunca con
// algo escrito por otro jugador.
function el(tag,attrs={},...kids){
  const node=document.createElement(tag);
  for(const [key,value] of Object.entries(attrs)){
    if(key==='class')node.className=value;else if(key==='text')node.textContent=value;else if(key==='html')node.innerHTML=value;
    else if(value===true)node.setAttribute(key,'');else if(value!==false&&value!=null)node.setAttribute(key,value);
  }
  node.append(...kids.filter(kid=>kid!=null&&kid!==false));
  return node;
}
// El look de otro jugador llega de fuera: se pasa por Avatar.normalize, que solo deja piezas del catálogo.
function cleanLook(look){try{return window.Avatar.normalize(look&&typeof look==='object'?look:{})}catch{return {}}}
function chip(look){
  let html='';try{html=window.Avatar.render(look,{bust:true})}catch{}
  return el('span',{class:'duel-avatar small',html});
}
const store={
  get(area,key,fallback){try{return JSON.parse(area.getItem(key))??fallback}catch{return fallback}},
  set(area,key,value){try{area.setItem(key,JSON.stringify(value))}catch{}}
};

// ---------- Quién soy ----------
// El apodo es el de los duelos (duel.js lo guarda en esta misma clave y progress.js lo cambia desde el perfil).
// Si aún no hay ninguno se crea aquí y se avisa, para que el duelo y el lobby enseñen el mismo.
function nickname(){
  const profile=store.get(localStorage,NICK,null);
  if(profile&&typeof profile.name==='string'&&clean(profile.name,16))return clean(profile.name,16);
  const name='Jugador '+(100+Math.floor(Math.random()*900));
  store.set(localStorage,NICK,{...(profile&&typeof profile==='object'?profile:{}),name});
  emit('faraday:apodo',{name});
  return name;
}
let myName=nickname();
const myLook=()=>{try{return window.Progress?.look?.()||{}}catch{return {}}};
function myLevel(){
  try{const raw=window.Progress?.level?.();return Math.max(1,Math.floor(Number(raw&&typeof raw==='object'?raw.level:raw))||1)}catch{return 1}
}
const hasAccount=()=>view?.you?view.you.account===true:typeof currentAccount!=='undefined'&&!!currentAccount;

// ---------- Estado ----------
let view=null,players=[],solo=false,since=0,heard=0,flying=false,hurry=false,timer=0,joined=false,lastPulse=0,fails=0,act=null;
let where='lobby',activeAt=performance.now(),seat=null,chatWas=false;
// Números de mensaje ya enseñados en esta sala: ninguno se repite aunque llegue en dos vistas.
let heardSet=new Set();
const pos=collide({x:SPAWN.x+(Math.random()-.5)*2*SPAWN.rx,z:SPAWN.z+(Math.random()-.5)*2*SPAWN.rz});
let heading=0;
const active=()=>{activeAt=performance.now()};

// ---------- Silenciados ----------
// Lista local. Va por el identificador público del jugador en el lobby, que es lo único que se conoce de él.
let mutedIds=store.get(localStorage,MUTED,[]);
if(!Array.isArray(mutedIds))mutedIds=[];
const muted=id=>mutedIds.includes(String(id));
function mute(id,on=true){
  id=String(id);on=!!on;
  const was=muted(id);
  mutedIds=mutedIds.filter(one=>one!==id);
  if(on){mutedIds.push(id);bubbles.get(id)?.el.remove();bubbles.delete(id)}
  mutedIds=mutedIds.slice(-200);store.set(localStorage,MUTED,mutedIds);
  refresh();
  // La caja de chat oculta (o vuelve a enseñar) lo que ya tenía pintado de ese jugador.
  if(was!==on)emit('faraday:lobby-mute',{id,on});
}

// ---------- Red ----------
async function request(action,extra={}){
  try{
    const response=await fetch(API,{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify({action,...extra}),signal:AbortSignal.timeout(6000)});
    let data=null;try{data=await response.json()}catch{}
    return {ok:response.ok,status:response.status,data,error:clean(data?.error,160)};
  }catch{return {ok:false,status:0,data:null,error:'Se ha perdido la conexión.'}}
}
// Las acciones que no son el pulso piden estar presente: si el servidor ya nos daba por idos (409 «Vuelve a entrar
// al lobby»), se entra otra vez con un pulso y se repite la acción una sola vez.
async function send(action,extra={}){
  let reply=await request(action,extra);
  if(reply.status===409&&/^Vuelve a entrar/i.test(reply.error)){
    const back=await request('pulso',payload());
    if(back.ok&&back.data?.room){apply(back.data);reply=await request(action,'since' in extra?{...extra,since}:extra)}
  }
  return reply;
}
function whereNow(){
  for(const [id,name] of DIALOGS)if($(id)?.open)return name;
  try{if(document.querySelector('dialog:modal'))return 'otros'}catch{}
  for(const [id,name] of SHELLS){const shell=$(id);if(shell&&!shell.hidden)return name}
  return 'lobby';
}
const payload=()=>({x:round(pos.x),z:round(pos.z),heading:round(wrap(heading)),look:myLook(),name:myName,level:myLevel(),where,...(act?{act}:{}),since});
const chatOpen=()=>{try{return !!window.ChatDock?.isOpen?.()}catch{return false}};
// Con un reto enviado y aún sin respuesta (30 s como mucho) se pregunta cada 2 s aunque se esté en la sala de espera
// del duelo: el «sí» o el «no» del otro llegan por el pulso.
const delay=()=>solo?RETRY:pending?2000:where!=='lobby'?(chatOpen()?GAME_CHAT:GAME):onScreen&&performance.now()-activeAt<IDLE_AFTER?FAST:REST;
function plan(ms=delay()){clearTimeout(timer);if(!document.hidden)timer=setTimeout(pulse,ms)}
// Adelanta el siguiente pulso (un gesto, un cambio de pantalla…) sin pisar el que esté en vuelo.
function poke(){
  if(solo)return;
  if(flying){hurry=true;return}
  plan(Math.max(0,POKE_GAP-(performance.now()-lastPulse)));
}
async function pulse(){
  clearTimeout(timer);
  if(flying||document.hidden)return;
  flying=true;lastPulse=performance.now();
  const reply=await request('pulso',payload());
  flying=false;
  let wait=null;
  if(reply.ok&&reply.data?.room)apply(reply.data);
  else{
    fails++;
    // Un gesto que el servidor no conozca no debe dejar al jugador fuera: se quita y se reintenta.
    if(reply.status===400)act=null;
    // Sin identidad (401), sin lobby en este servidor (404, 503): solo desde ya, y se reintenta con calma.
    // Un fallo de red, una espera agotada (estado 0) o un 5xx suelen ser pasajeros: los jugadores se quedan como
    // estaban y se reintenta pronto; solo al tercer fallo seguido se da el lobby por perdido.
    const gone=[401,404,503].includes(reply.status),shaky=reply.status===0||reply.status>=500;
    if(gone||fails>=3)alone(reply.status);
    if(gone)wait=RETRY;else if(shaky)wait=BACKOFF[Math.min(fails,BACKOFF.length)-1];
  }
  plan(wait??(hurry&&!solo?250:delay()));hurry=false;
}
// Sin servidor (503), sin identidad (401) o sin red tres veces seguidas: el lobby sigue, pero solo con el propio avatar.
function alone(status){
  const was=solo;
  solo=true;view=null;joined=false;players=[];
  if(!was)note(status===401?'No hemos podido identificarte en el lobby. Lo reintentamos en un momento.':'El lobby no está disponible ahora mismo: estás solo. Lo reintentamos en un momento.');
  refresh();
}
function player(raw){
  if(!raw||typeof raw!=='object'||raw.id==null)return null;
  const look=cleanLook(raw.look),spot=inside({x:num(raw.x),z:num(raw.z)}),move=raw.act;
  return {id:String(raw.id).slice(0,64),name:clean(raw.name,24)||'Jugador',look,sig:JSON.stringify(look),level:Math.max(1,Math.floor(num(raw.level,1))),
    x:spot.x,z:spot.z,heading:wrap(num(raw.heading)),act:move&&typeof move==='object'&&typeof move.name==='string'&&Number.isInteger(move.n)?{name:move.name,n:move.n}:null,
    where:Object.hasOwn(WHERE,raw.where)?raw.where:'lobby',friend:raw.friend===true,account:raw.account===true};
}
// Aplica una vista del servidor (la de un pulso o la que devuelve el chat).
function apply(data){
  // Otra sala u otra identidad: su historial es otro, así que se vuelve a pedir entero (y llega marcado como antiguo).
  // Volver al mismo sitio tras un corte no cuenta: «seat» sobrevive a los ratos sin conexión.
  const moved=!seat||seat.room!==data.room?.n||seat.id!==data.you?.id;
  seat={room:data.room?.n,id:data.you?.id};
  if(moved){heard=0;since=0;heardSet=new Set()}
  if(solo)note('');
  fails=0;solo=false;joined=true;
  // El servidor nunca devuelve un cursor menor que el «since» que recibe: una vista con el cursor por detrás del
  // nuestro es una respuesta que llega desordenada (un pulso que vuelve después que el chat enviado mientras tanto).
  // Lo que trae es más viejo que lo que ya se ve: solo sirve para saber que el lobby sigue ahí.
  if(!moved&&view&&num(data.cursor,since)<since){emit('faraday:lobby',data);return}
  const before=new Map(players.map(one=>[one.id,one])),list=[],ids=new Set(),me=String(data.you?.id??'');
  for(const raw of Array.isArray(data.players)?data.players.slice(0,40):[]){
    const one=player(raw);
    if(one&&one.id!==me&&!ids.has(one.id)){ids.add(one.id);list.push(one)}
  }
  if(list.length!==before.size||list.some(one=>{const old=before.get(one.id);return !old||Math.abs(old.x-one.x)+Math.abs(old.z-one.z)>.05||old.act?.n!==one.act?.n}))active();
  players=list;
  const serverTime=num(data.serverTime,Date.now());
  const chat=Array.isArray(data.chat)?data.chat.filter(m=>m&&typeof m==='object').sort((a,b)=>num(a.n)-num(b.n)):[];
  for(const raw of chat){
    const n=num(raw.n,-1);
    if(n<=heard||heardSet.has(n))continue;
    heard=n;heardSet.add(n);
    if(heardSet.size>600)heardSet=new Set([...heardSet].slice(-300));
    // «old»: ya estaba al entrar o es antiguo. Va al registro del chat, pero sin bocadillo.
    const message={n,id:String(raw.id??''),name:clean(raw.name,24)||'Jugador',text:clean(raw.text,140),mine:raw.mine===true,at:num(raw.at),old:moved||serverTime-num(raw.at)>8000};
    if(!message.text||(!message.mine&&muted(message.id)))continue;
    active();
    emit('faraday:lobby-chat',message);
    if(!message.old)bubble(message.mine?'me':message.id,message.text);
  }
  view=data;
  for(const raw of Array.isArray(data.signals)?data.signals:[])signal(raw,serverTime);
  since=Math.max(since,num(data.cursor,since));
  refresh();
  emit('faraday:lobby',data);
}
function refresh(){
  paintBadge();paintRoster();syncPeers();paintMenu();
}

// ---------- API pública (contrato con chat-dock.js) ----------
async function say(text){
  text=clean(text,140);
  if(!text)return {error:'Escribe algo antes de enviar.'};
  if(!view||solo)return {error:'El lobby no está disponible ahora mismo.'};
  active();
  const reply=await send('chat',{text,since});
  if(!reply.ok)return {error:reply.error||'No se ha podido enviar el mensaje.'};
  if(reply.data?.room)apply(reply.data);else poke();
  return {ok:true};
}
window.Lobby={
  say,
  players:()=>players.map(({sig,...one})=>({...one,look:{...one.look},act:one.act&&{...one.act}})),
  room:()=>view?.room?{...view.room}:null,
  you:()=>view?.you?{...view.you}:null,
  mute,muted,
  // Los silenciados guardados en este navegador (también los de visitas anteriores), para poder deshacerlo.
  mutedList:()=>[...mutedIds],
  // true mientras el último pulso haya ido bien (hay sala y se puede hablar).
  active:()=>!!view&&!solo,
  // Para depurar el coste del 3D en la consola: llamadas de dibujo y triángulos del último fotograma, y cuántos
  // jugadores van con modelo completo y cuántos como imagen plana.
  stats:()=>renderer?{calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,
    full:[...peers.values()].filter(peer=>peer.body?.model).length,flat:[...peers.values()].filter(peer=>peer.body?.flat).length,shade,ratio,
    who:Object.fromEntries([...peers].map(([id,peer])=>[id,peer.body?.model?'full':peer.body?.flat?'flat':'']))}:null
};

// ---------- Insignia, aviso discreto y lista de jugadores ----------
function paintBadge(){
  // Dos entradas a la vez pueden pasar del tope un instante (el servidor muda al último): no se enseña «21/20».
  const room=view?.room,cap=room?num(room.cap,20):20,total=room?Math.min(cap,Math.max(1,num(room.count,players.length+1))):1;
  setText(badge,solo?'Lobby · sin conexión':room?`Lobby ${num(room.n,1)} · ${total}/${cap}`:'Lobby · conectando…');
  badge.classList.toggle('is-off',solo||!room);
  setText(count,`(${total})`);
}
// Aviso de una línea bajo la plaza. Con «ttl» es pasajero y, al irse, vuelve el aviso fijo que hubiera.
let sticky='',noteTimer=0;
function note(text,ttl=0){
  clearTimeout(noteTimer);
  if(ttl)noteTimer=setTimeout(()=>note(sticky),ttl);else sticky=text;
  noteBox.textContent=text;noteBox.hidden=!text;
}
const rows=new Map();
function paintRoster(){
  if(roster.hidden)return;
  const ids=new Set(players.map(one=>one.id));
  for(const [id,row] of rows)if(!ids.has(id)){row.item.remove();rows.delete(id)}
  for(const one of players){
    let row=rows.get(one.id);
    if(!row){
      const avatar=el('span',{class:'duel-avatar small'}),name=el('b'),doing=el('small');
      const button=el('button',{type:'button',class:'plaza-player','data-id':one.id},avatar,el('span',{class:'plaza-player-text'},name,doing));
      row={item:el('li',{},button),button,avatar,name,doing,sig:''};
      rows.set(one.id,row);rosterList.append(row.item);
    }
    if(row.sig!==one.sig){row.sig=one.sig;try{row.avatar.innerHTML=window.Avatar.render(one.look,{bust:true})}catch{}}
    setText(row.name,one.name);
    setText(row.doing,`Nv. ${one.level} · ${WHERE[one.where]}${one.friend?' · Amigo':''}${muted(one.id)?' · Silenciado':''}`);
    row.button.setAttribute('aria-label',`${one.name}, nivel ${one.level}. ${WHERE[one.where]}. Ver acciones`);
  }
  rosterEmpty.hidden=players.length>0;
  setText(rosterEmpty,solo?'Sin conexión con el lobby.':view?'Aún no hay nadie más en este lobby.':'Entrando en el lobby…');
}
function showRoster(open){
  roster.hidden=!open;rosterToggle.setAttribute('aria-expanded',open);
  if(open){showWheel(false);paintRoster()}
}
rosterToggle?.addEventListener('click',()=>showRoster(roster.hidden));
rosterList?.addEventListener('click',event=>{
  const button=event.target.closest('[data-id]');
  if(button)approach(button.dataset.id,button);
});

// ---------- Avisos de retos y amistades ----------
// Se ven también dentro de un juego. Lo que queda fuera de un <dialog> modal no se ve ni se puede pulsar, así que la
// caja de avisos se cuelga del diálogo modal abierto (o del cuerpo de la página) y se muda si ese diálogo se cierra.
// Va arriba, lejos del campo de respuesta, y no roba el foco a quien está escribiendo. Para que el teclado llegue
// pronto a sus botones, la caja es lo primero de su contenedor (su sitio en pantalla es fijo: no depende del orden).
const noticeBox=el('div',{class:'plaza-notices',role:'region','aria-label':'Avisos del lobby','aria-live':'polite'}),notices=new Map();
let hostTimer=0;
function host(){
  let modals=[];
  try{modals=[...document.querySelectorAll('dialog:modal')]}catch{modals=[...document.querySelectorAll('dialog[open]')]}
  return modals.find(dialog=>dialog.contains(document.activeElement))||modals.at(-1)||document.body;
}
function rehost(){
  const home=host();
  if(noticeBox.parentNode!==home||home.firstElementChild!==noticeBox){
    // Mover el nodo le quita el foco a lo que tenga dentro: se le devuelve.
    const held=noticeBox.contains(document.activeElement)?document.activeElement:null;
    home.prepend(noticeBox);held?.focus({preventScroll:true});
  }
  // El «reto enviado» sobra en cuanto el duelo ha empezado.
  if(inMatch()){
    if(pending){clearTimeout(pending.timer);pending=null}
    for(const key of [...notices.keys()])if(key.startsWith('enviado:'))dismiss(key);
  }
  placeNotices();
}
// En pantallas estrechas, con la portada a la vista, los avisos no van pegados arriba (taparían la cabecera, el título
// y la barra del lobby con «Jugadores» y «Gestos»): se colocan justo bajo esa barra, sobre la plaza, y sin llegar a
// la caja de chat ni a la palanca. En el resto de casos mandan las reglas de lobby.css.
function placeNotices(){
  let top='',room='';
  if(narrow.matches&&noticeBox.parentNode===document.body&&where==='lobby'&&bar&&!bar.hidden){
    const edge=bar.getBoundingClientRect().bottom;
    if(edge>0&&edge<innerHeight*.55){
      top=Math.round(edge+6)+'px';
      const floor=$('lobby-chat-slot')?.getBoundingClientRect().top||0,free=floor-edge-14;
      if(free>=120)room=Math.round(free)+'px';
    }
  }
  if(noticeBox.style.top!==top)noticeBox.style.top=top;
  if(noticeBox.style.maxHeight!==room)noticeBox.style.maxHeight=room;
}
addEventListener('scroll',()=>{if(notices.size)placeNotices()},{passive:true});
function dismiss(key){
  const notice=notices.get(key);
  if(!notice)return;
  clearTimeout(notice.timer);notice.row.remove();notices.delete(key);
  if(!notices.size){noticeBox.remove();clearInterval(hostTimer);hostTimer=0}
}
// parts: trozos de texto; {b:'…'} va en negrita. Los nombres de otros jugadores entran siempre como texto.
function notify({key,from=null,parts,actions=[],ttl=6000,onExpire=null}){
  dismiss(key);
  const text=el('p',{class:'plaza-notice-text'});
  for(const part of parts)text.append(typeof part==='string'?part:el('b',{text:part.b}));
  const bar=el('div',{class:'plaza-notice-actions'});
  for(const action of actions.length?actions:[{label:'Cerrar',close:true}]){
    const button=el('button',{type:'button',class:action.primary?'is-primary':action.close?'is-close':'',text:action.close?'×':action.label,'aria-label':action.close?'Cerrar el aviso':null});
    button.addEventListener('click',()=>{dismiss(key);action.run?.()});
    bar.append(button);
  }
  const meter=el('i',{class:'plaza-notice-timer','aria-hidden':'true'});meter.style.animationDuration=ttl+'ms';
  const row=el('div',{class:'plaza-notice'},from?chip(from.look):null,text,bar,meter);
  noticeBox.append(row);rehost();
  notices.set(key,{row,timer:setTimeout(()=>{dismiss(key);onExpire?.()},ttl)});
  hostTimer||=setInterval(rehost,500);
}
const tell=(text,ttl=5000)=>notify({key:'info:'+text,parts:[text],ttl});

// Nombre del juego para «te reta a un duelo de …» (sin el «Duelo de» que pueda traer la lista).
const gameName=id=>(clean((Array.isArray(window.Duel?.GAMES)?window.Duel.GAMES:[]).find(game=>game?.id===id)?.name,40)||GAME_NAMES[id]||GAME_NAMES.estimacion).replace(/^duelo de\s+/i,'');
const duelGames=()=>{
  const list=(Array.isArray(window.Duel?.GAMES)?window.Duel.GAMES:[]).filter(game=>game&&typeof game.id==='string').map(game=>({id:game.id,name:clean(game.name,40)||GAME_NAMES[game.id]||game.id}));
  return list.length?list:[{id:'estimacion',name:'Estimación'}];
};
// En plena partida de un duelo (marcador a la vista) no se puede aceptar otro.
const inMatch=()=>{const shell=$('duel-shell'),hud=$('duel-hud');return !!shell&&!shell.hidden&&!!hud&&!hud.hidden};
// Para que el duelo no quede tapado: cierra los diálogos y las pantallas que van por encima de él.
function clearOverlays(){
  for(const dialog of document.querySelectorAll('dialog[open]'))try{dialog.close()}catch{}
  for(const name of ['profile','market','league','community','circuit']){const shell=$(name+'-shell');if(shell&&!shell.hidden)$(name+'-close')?.click()}
}
// Las señales siguen llegando un rato (60 s; las de amistad, 10 min) y sin «since» llegan todas las vigentes: las ya
// enseñadas se apuntan en este navegador para no repetirlas al recargar ni en otra pestaña.
let seen=store.get(localStorage,SEEN,[]);
if(!Array.isArray(seen))seen=[];
const challenged=new Map();
// El reto que se ha enviado y aún no tiene respuesta: a quién, con qué código de duelo y el temporizador que lo da
// por no respondido. «lapsed» apunta a quién se le acaba de caducar uno, para no enseñar después un «ha rechazado»
// que ya no dice nada.
let pending=null;
const lapsed=new Map();
// ¿Sigue abierta la sala de espera de ese duelo? (Si el rival ya ha entrado, o el jugador la ha cerrado, no.)
function waitingFor(code){
  const shell=$('duel-shell');
  return !!code&&!!shell&&!shell.hidden&&shell.dataset.screen==='waiting'&&shell.textContent.includes(code);
}
// Sin rival (rechazado, caducado o no enviado) no tiene sentido seguir en la sala de espera del duelo: se cancela y se
// vuelve al lobby. Solo si el duelo sigue en espera: si el rival ya entró, no se toca nada.
async function leaveWaiting(code){
  if(!waitingFor(code))return false;
  try{
    if(typeof window.Duel?.cancel==='function')return (await window.Duel.cancel())?.ok===true;
    // Respaldo: «Cancelar» de la sala de espera y, ya en el portal de duelos, su botón de cerrar.
    const shell=$('duel-shell');
    shell.querySelector('[data-duel="cancel"]')?.click();
    if(shell.dataset.screen==='lobby')$('duel-close')?.click();
    return shell.hidden;
  }catch{return false}
}
// Da por contestado el reto pendiente con ese jugador (y lo devuelve), o null si no era él.
function settle(id){
  if(pending?.id!==id)return null;
  const done=pending;
  clearTimeout(done.timer);pending=null;dismiss('enviado:'+id);
  return done;
}
function signal(raw,serverTime){
  if(!raw||typeof raw!=='object'||typeof raw.kind!=='string')return;
  const from={id:String(raw.from?.id??''),name:clean(raw.from?.name,24)||'Alguien',look:cleanLook(raw.from?.look)};
  const key=`${raw.kind}:${from.id}:${num(raw.at)}:${num(raw.n)}`;
  if(!from.id||seen.includes(key))return;
  seen.push(key);seen=seen.slice(-80);store.set(localStorage,SEEN,seen);
  const age=Math.max(0,serverTime-num(raw.at,serverTime));
  active();
  if(raw.kind==='reto'){
    const code=clean(raw.code,12),left=30000-age,refuse=()=>send('rechazar-reto',{to:from.id});
    if(muted(from.id)||left<1500)return;
    if(inMatch()||!/^[A-Za-z0-9]{4,10}$/.test(code)){refuse();return}
    notify({key:'reto:'+from.id,from,parts:[{b:from.name},' te reta a un duelo de ',{b:gameName(raw.game)},'.'],ttl:left,
      // Si se deja pasar con la página a la vista, quien retó recibe la negativa y no se queda esperando.
      onExpire:()=>{if(!document.hidden)refuse()},
      actions:[{label:'Aceptar',primary:true,run(){
        if(!window.Duel?.join){tell('No se ha podido abrir el duelo.');refuse();return}
        clearOverlays();expand(false);
        Promise.resolve().then(()=>window.Duel.join(code)).then(result=>{if(result?.error)tell(clean(result.error,160))},()=>tell('No se ha podido abrir el duelo.'));
      }},{label:'Rechazar',run:refuse}]});
  }else if(raw.kind==='reto-no'){
    const mine=settle(from.id);
    dismiss('enviado:'+from.id);
    // Ya se le dio por no respondido hace un momento: la negativa que llega ahora no añade nada.
    if(!mine&&Date.now()-(lapsed.get(from.id)||0)<20000)return;
    if(mine)leaveWaiting(mine.code);
    notify({key:'reto-no:'+from.id,from,parts:[{b:from.name},' ha rechazado el reto.'],ttl:7000});
  }else if(raw.kind==='amistad'){
    if(muted(from.id)||age>10*60000)return;
    notify({key:'amistad:'+from.id,from,parts:[{b:from.name},' quiere ser tu amigo.'],ttl:45000,
      actions:[{label:'Aceptar',primary:true,async run(){
        const reply=await send('aceptar-amistad',{to:from.id});
        if(!reply.ok){tell(reply.error||'No se ha podido aceptar la amistad.');return}
        befriended(from.id,reply.data?.friend);
        notify({key:'amigo:'+from.id,from,parts:['Ahora ',{b:from.name},' y tú sois amigos.'],ttl:6000});
      }},{label:'Ahora no'}]});
  }else if(raw.kind==='amistad-ok'){
    befriended(from.id);
    notify({key:'amigo:'+from.id,from,parts:[{b:from.name},' ha aceptado tu solicitud de amistad.'],ttl:7000});
  }
}
// Marca la amistad ya, sin esperar al siguiente pulso, y avisa por si otra pantalla quiere refrescar su lista.
function befriended(id,friend=null){
  const one=players.find(peer=>peer.id===id);
  if(one)one.friend=true;
  refresh();poke();emit('faraday:lobby-amistad',{id,friend:friend&&typeof friend==='object'?friend:null});
}

// ---------- Acciones sobre otro jugador ----------
async function challenge(one,game){
  closeMenu();
  if(!window.Duel?.create){tell('Los retos desde el lobby aún no están disponibles.');return}
  // El servidor admite un reto al mismo jugador cada 15 s: se comprueba antes de crear el duelo.
  if(Date.now()-(challenged.get(one.id)||0)<15000){tell(`Ya has retado a ${one.name}. Espera unos segundos.`);return}
  let made=null;
  try{made=await window.Duel.create({game:game.id})}catch{}
  const code=clean(made?.code,12);
  if(!code){tell(clean(made?.error,160)||'No se ha podido crear el duelo.');return}
  // Un reto anterior sin respuesta deja de esperarse: Duel.create ha reutilizado o sustituido su duelo.
  if(pending)settle(pending.id);
  const reply=await send('retar',{to:one.id,game:game.id,code});
  if(!reply.ok){
    // El reto no ha salido: nadie va a entrar en ese duelo.
    await leaveWaiting(code);
    tell(reply.error||'No se ha podido enviar el reto.');return;
  }
  challenged.set(one.id,Date.now());
  notify({key:'enviado:'+one.id,from:one,parts:['Reto enviado a ',{b:one.name},'. Tiene 30 segundos para aceptar.'],ttl:30000});
  // Quien recibe el reto contesta «no» al caducarle el aviso (30 s); se le dan unos segundos más para que esa
  // negativa llegue. Si no llega nada (se ha ido, tiene la pestaña oculta), el reto se da por no respondido.
  const mine={id:one.id,name:one.name,look:one.look,code,timer:setTimeout(async()=>{
    if(pending!==mine)return;
    pending=null;dismiss('enviado:'+mine.id);
    if(!await leaveWaiting(code))return;
    lapsed.set(mine.id,Date.now());
    notify({key:'reto-no:'+mine.id,from:mine,parts:[{b:mine.name},' no ha respondido al reto.'],ttl:7000});
  },33500)};
  pending=mine;
  poke();
}
async function befriend(one){
  if(!hasAccount()){
    closeMenu();expand(false);
    document.querySelector('[data-auth-open]')?.click();
    notify({key:'cuenta',parts:['Para añadir amigos necesitas una cuenta. Entra y vuelve a pedírselo a ',{b:one.name},'.'],ttl:9000});
    return;
  }
  const reply=await send('amistad',{to:one.id});
  closeMenu();
  if(reply.ok)notify({key:'pedida:'+one.id,from:one,parts:['Solicitud de amistad enviada a ',{b:one.name},'.'],ttl:6000});
  else tell(reply.error||'No se ha podido enviar la solicitud.');
  poke();
}
function wave(one){
  closeMenu();
  const peer=peers.get(one.id);
  if(hero&&peer?.body)face=Math.atan2(peer.body.holder.position.x-pos.x,peer.body.holder.position.z-pos.z);
  emote('saludo');
  if(!running)tell(`Has saludado a ${one.name}.`,3000);
}

// ---------- Menú de acciones ----------
// Se abre al llegar junto al jugador (o desde la lista). En pantallas estrechas es una hoja inferior; en las demás
// sale junto al jugador y se queda donde ha salido: no lo persigue, porque un botón que se mueve bajo el cursor acaba
// en un clic donde no era. No es modal: Esc, andar o tocar fuera lo cierran.
// Su DOM se monta una vez, al abrirse; después paintMenu() solo cambia textos y estados en el sitio, así un pulso que
// llega no se lleva por delante el foco ni un clic a medias.
const menu={box:null,id:null,anchor:null,parts:null,at:0,over:false,placed:false};
const flip=(node,hidden)=>{if(node.hidden!==hidden)node.hidden=hidden};
function openMenu(id,anchor=null){
  if(!players.some(one=>one.id===id))return;
  closeMenu(false);
  const button=(name,text)=>el('button',{type:'button','data-do':name,text});
  const p={look:null,games:null,avatar:el('span',{class:'duel-avatar small'}),name:el('b'),sub:el('small'),
    group:el('div',{class:'plaza-menu-games',role:'group','aria-label':'Retar a un duelo'},el('h3',{text:'Retar a…'})),
    busy:el('small',{text:'Ahora mismo está en un duelo.'}),fact:el('p',{class:'plaza-menu-fact',text:'Ya sois amigos'}),
    friend:button('friend','Añadir a amigos'),why:el('small'),wave:button('wave','Saludar'),mute:button('mute','Silenciar'),
    close:el('button',{type:'button',class:'plaza-menu-close','data-do':'close','aria-label':'Cerrar',text:'×'})};
  p.group.append(p.busy);
  menu.box=el('div',{class:'plaza-menu',role:'dialog'},
    el('header',{},p.avatar,el('div',{},p.name,p.sub),p.close),
    el('div',{class:'plaza-menu-list'},p.group,p.fact,p.friend,p.why,p.wave,p.mute));
  Object.assign(menu,{id,anchor,parts:p,at:performance.now(),over:false,placed:false});
  menu.box.addEventListener('click',menuClick);menu.box.addEventListener('keydown',menuKey);
  menu.box.addEventListener('pointerenter',()=>{menu.over=true});menu.box.addEventListener('pointerleave',()=>{menu.over=false});
  document.body.append(menu.box);
  paintMenu();placeMenu();
  menu.box?.querySelector('.plaza-menu-list button:not(:disabled):not([hidden])')?.focus({preventScroll:true});
}
function closeMenu(refocus=true){
  if(!menu.box)return;
  const held=menu.box.contains(document.activeElement),anchor=menu.anchor;
  menu.box.remove();Object.assign(menu,{box:null,id:null,anchor:null,parts:null,over:false});
  if(refocus&&held)(anchor?.isConnected?anchor:running?canvas:rosterToggle)?.focus({preventScroll:true});
}
// ¿Lo está usando el jugador? (el puntero encima o el foco dentro). Entonces no se cierra solo.
const menuBusy=()=>!!menu.box&&(menu.over||menu.box.matches(':hover')||menu.box.contains(document.activeElement));
function paintMenu(){
  if(!menu.box)return;
  const one=players.find(peer=>peer.id===menu.id);
  if(!one){closeMenu();return}
  const p=menu.parts,quiet=muted(one.id),mine=hasAccount(),busy=one.where==='duel',games=duelGames(),list=games.map(game=>game.id+'='+game.name).join('|');
  const held=menu.box.contains(document.activeElement)?document.activeElement:null,tall=menu.box.offsetHeight,label=`Acciones con ${one.name}`;
  if(menu.box.getAttribute('aria-label')!==label)menu.box.setAttribute('aria-label',label);
  if(p.look!==one.sig){p.look=one.sig;try{p.avatar.innerHTML=window.Avatar.render(one.look,{bust:true})}catch{}}
  setText(p.name,one.name);setText(p.sub,`Nivel ${one.level} · ${WHERE[one.where]}`);
  // Los juegos a los que se puede retar no cambian salvo que duel.js cargue más tarde: solo entonces se rehacen.
  if(p.games!==list){
    p.games=list;
    for(const old of [...p.group.querySelectorAll('button')])old.remove();
    p.busy.before(...games.map(game=>el('button',{type:'button',class:'is-game','data-game':game.id,text:game.name})));
  }
  for(const button of p.group.querySelectorAll('button'))if(button.disabled!==busy)button.disabled=busy;
  flip(p.busy,!busy);flip(p.fact,!one.friend);flip(p.friend,one.friend);
  const blocked=mine&&!one.account;
  if(p.friend.disabled!==blocked)p.friend.disabled=blocked;
  const why=one.friend?'':blocked?`${one.name} juega sin cuenta y no puede tener amigos todavía.`:mine?'':'Necesitas una cuenta: te llevamos a crearla.';
  setText(p.why,why);flip(p.why,!why);
  setText(p.mute,quiet?'Dejar de silenciar':'Silenciar');
  if(p.mute.getAttribute('aria-pressed')!==String(quiet))p.mute.setAttribute('aria-pressed',String(quiet));
  // Si el botón que tenía el foco ya no se puede usar, el foco pasa a «Cerrar» en vez de perderse.
  if(held&&(held.disabled||held.hidden||!held.isConnected))p.close.focus({preventScroll:true});
  // Si ha cambiado de alto (una nota que aparece), se comprueba que sigue cabiendo en la ventana.
  if(menu.placed&&menu.box.offsetHeight!==tall)placeMenu();
}
function menuClick(event){
  // Recién abierto no atiende clics de puntero: el menú sale bajo el cursor de quien venía pulsando en la plaza.
  // (Los del teclado y los de un lector de pantalla llegan con detail 0 y pasan.)
  if(event.detail>0&&performance.now()-menu.at<MENU_GUARD)return;
  const button=event.target.closest('button'),one=players.find(peer=>peer.id===menu.id);
  if(!button||button.disabled||!one)return;
  if(button.dataset.game){const game=duelGames().find(item=>item.id===button.dataset.game);if(game)challenge(one,game)}
  else if(button.dataset.do==='friend')befriend(one);
  else if(button.dataset.do==='wave')wave(one);
  else if(button.dataset.do==='mute')mute(one.id,!muted(one.id));
  else if(button.dataset.do==='close')closeMenu();
}
function menuKey(event){
  const buttons=[...menu.box.querySelectorAll('button:not(:disabled):not([hidden])')],at=buttons.indexOf(document.activeElement);
  if(event.key==='Escape'){event.preventDefault();event.stopPropagation();closeMenu()}
  else if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();buttons[(at+(event.key==='ArrowDown'?1:-1)+buttons.length)%buttons.length]?.focus()}
  else if(event.key==='Tab'&&buttons.length){
    // El foco da la vuelta dentro del menú en lugar de perderse por la página.
    const edge=event.shiftKey?0:buttons.length-1;
    if(at===edge){event.preventDefault();buttons[event.shiftKey?buttons.length-1:0].focus()}
  }else if(WASD[event.code]&&running){closeMenu(false);canvas.focus({preventScroll:true});keys[WASD[event.code]]=1}
}
// Coloca el menú junto al jugador (o junto a su botón de la lista) al abrirse. Después no se mueve: las llamadas
// siguientes solo lo devuelven a la ventana si se saldría de ella (ha cambiado de tamaño, o el menú ha crecido).
function placeMenu(){
  const box=menu.box;
  if(!box)return;
  const sheet=narrow.matches;
  box.classList.toggle('is-sheet',sheet);
  if(sheet){box.style.left=box.style.top='';menu.placed=false;return}
  const w=box.offsetWidth,h=box.offsetHeight;
  let left=parseFloat(box.style.left),top=parseFloat(box.style.top);
  if(!menu.placed||!Number.isFinite(left)||!Number.isFinite(top)){
    const peer=peers.get(menu.id);
    let x,y,gap=70;
    if(running&&peer?.body){
      const rect=canvas.getBoundingClientRect();
      spare.copy(peer.body.holder.position);spare.y+=1.9;spare.project(camera);
      x=rect.left+(spare.x+1)/2*rect.width;y=rect.top+(1-spare.y)/2*rect.height;
    }else if(menu.anchor?.isConnected){
      const rect=menu.anchor.getBoundingClientRect();x=rect.left+rect.width/2;y=rect.top+rect.height/2;gap=rect.width/2+10;
    }else{
      const rect=section.getBoundingClientRect();x=rect.left+rect.width/2-w/2-gap;y=rect.top+rect.height/2;
    }
    left=x+gap;
    if(left+w>innerWidth-8)left=x-gap-w;
    top=y-h/2;menu.placed=true;
  }
  const at=Math.round(clamp(left,8,Math.max(8,innerWidth-w-8)))+'px',up=Math.round(clamp(top,8,Math.max(8,innerHeight-h-8)))+'px';
  if(box.style.left!==at)box.style.left=at;
  if(box.style.top!==up)box.style.top=up;
}
// Tocar fuera del menú lo cierra (el lienzo decide por su cuenta: un clic en el suelo también hace andar).
document.addEventListener('pointerdown',event=>{
  if(menu.box&&!menu.box.contains(event.target)&&event.target!==canvas&&!event.target.closest?.('.plaza-player'))closeMenu(false);
});
// Ir a por un jugador: con mundo 3D el avatar corre hasta él y el menú se abre al llegar; sin él, se abre ya.
function approach(id,anchor=null){
  if(!players.some(one=>one.id===id))return;
  active();
  if(!running||!hero||!peers.get(id)?.body){openMenu(id,anchor);return}
  closeMenu(false);
  if(narrow.matches)showRoster(false);
  goal={peer:id,reach:REACH,run:true,time:0,stuck:0,anchor};
  // Si era una imagen plana, pasa ya a modelo completo.
  rank();
}

// ---------- Gestos ----------
// Los que se pueden hacer: los clips que conoce avatar3d.js. Un nombre que llegue de fuera y no esté ahí se ignora.
let acts=null;
const ACTS=()=>acts||(window.Avatar3D?.clips?.length?acts=new Set(window.Avatar3D.clips):new Set(EMOTES.map(item=>item.id)));
// La rueda: la que tenga elegida el jugador (Progress.emoteWheel, si existe) o la del Salón.
function emoteList(){
  let list=null;try{list=window.Progress?.emoteWheel?.()}catch{}
  const known=new Map(EMOTES.map(item=>[item.id,item])),out=[];
  for(const item of Array.isArray(list)&&list.length?list:EMOTES){
    const id=typeof item==='string'?item:item?.id;
    if(typeof id!=='string'||!ACTS().has(id)||out.some(one=>one.id===id))continue;
    const base=known.get(id),extra=item&&typeof item==='object'?item:{};
    out.push({id,icon:clean(extra.icon??base?.icon??'',8),name:clean(extra.name??base?.name??id,18)});
  }
  return out.length?out.slice(0,16):EMOTES;
}
let wheelList=[];
function showWheel(open){
  if(!wheel||!emoteToggle)return;
  if(open){
    showRoster(false);
    wheelList=emoteList();
    wheel.replaceChildren(el('button',{type:'button','data-emote':'jump'},el('span',{'aria-hidden':'true',text:'⤴'}),'Saltar'),
      ...wheelList.map((item,i)=>el('button',{type:'button','data-emote':item.id},el('span',{'aria-hidden':'true',text:item.icon}),item.name,i<10?el('kbd',{'aria-hidden':'true',text:String((i+1)%10)}):null)));
  }
  wheel.hidden=!open;emoteToggle.setAttribute('aria-expanded',open);
}
emoteToggle?.addEventListener('click',()=>showWheel(wheel.hidden));
wheel?.addEventListener('click',event=>{
  const button=event.target.closest('[data-emote]');
  if(!button)return;
  showWheel(false);emote(button.dataset.emote);
  // El foco vuelve al mundo para que las teclas sigan moviendo al personaje.
  if(running)canvas.focus({preventScroll:true});
});
// Lo que hace el personaje y ven los demás: un salto o un gesto. «n» distingue uno del siguiente.
function sendAct(name){act={name,n:Math.floor(Date.now()/100)%1e9+1};active();poke()}
function jump(){
  if(hero){if(hero.air>0)return;hero.vy=JUMP;hero.air=.001}
  sendAct('jump');
}
function emote(id){
  if(id==='jump')return jump();
  if(!ACTS().has(id))return;
  // Para hacer el gesto se queda quieto (pero sigue girándose hacia quien salude).
  goal=null;
  if(hero){if(hero.air>0)return;hero.gesture=id;hero.gestureUntil=performance.now()+900}
  sendAct(id);
}

// ---------- Mundo 3D ----------
let THREE,renderer,scene,camera,world=null,hero=null,ray,ndc,hitBox,hitPoint,ground,spare,ring,dot,blobShape,blobSkin;
let ready=false,running=false,frame=0,last=0,frames=0,ratio=1,slow=0,shadows=true,onScreen=true,lite=false;
// shade: calidad de las sombras (2, 1 o 0: ver lobby-world.js); lost: el navegador ha quitado el contexto 3D;
// ceil: en estrecho, hasta dónde pueden subir los bocadillos (bajo la barra del lobby).
let shade=0,lost=false,ceil=0;
const cards=new Map();
let yaw=0,pitch=.34,goal=null,face=null,hovered=null,hoverAt=null;
const peers=new Map(),bubbles=new Map(),size={w:1,h:1},focus={x:pos.x,z:pos.z};
const keys={up:0,down:0,left:0,right:0,run:0},stick={x:0,y:0};
const WASD={KeyW:'up',KeyS:'down',KeyA:'left',KeyD:'right'},KEYS={...WASD,ArrowUp:'up',ArrowDown:'down',ArrowLeft:'left',ArrowRight:'right',ShiftLeft:'run',ShiftRight:'run'};

// Un «cuerpo» es lo que se ve de un jugador en la plaza: un grupo propio («holder»), que es lo que se coloca, con su
// etiqueta y, dentro, el modelo 3D completo o —para los que quedan lejos— una imagen plana que mira a la cámara.
// El grupo del modelo queda libre para los gestos, que lo mueven, lo giran y lo estiran (Avatar3D.actor).
// Sombras: las de verdad solo las proyectan los modelos completos; sin ellas (móvil, equipo justo) y en las imágenes
// planas, cada uno lleva un borrón oscuro a los pies.
function addBlob(body){
  if(body.blob)return;
  body.blob=new THREE.Mesh(blobShape,blobSkin);body.blob.rotation.x=-Math.PI/2;body.blob.position.y=.02;body.holder.add(body.blob);
}
const bodyOf=(holder,extra)=>({holder,model:null,flat:null,blob:null,actor:null,walking:true,feet:[],stride:0,air:0,vy:0,pace:0,run:0,gesture:'',gestureUntil:0,tag:null,tagSig:'',...extra});
function stand(model){
  const holder=new THREE.Group(),body=bodyOf(holder,{model,actor:window.Avatar3D.actor?.(model)||null,feet:model.parts.feet.map(shoe=>shoe.position.clone())});
  if(shadows)model.group.traverse(node=>{if(node.isMesh)node.castShadow=true});else addBlob(body);
  holder.add(model.group);scene.add(holder);
  return body;
}
// Imagen plana: la foto de cuerpo entero que hace avatar3d.js (Avatar3D.shot, que la guarda por aspecto) en un
// «sprite»: tres llamadas de dibujo con la etiqueta y el borrón, frente a las cien mallas de un modelo completo.
// Los jugadores con el mismo aspecto comparten textura.
const canFlat=()=>typeof window.Avatar3D?.shot==='function';
function card(look,sig){
  let item=cards.get(sig);
  if(!item){
    const map=new THREE.CanvasTexture(window.Avatar3D.shot(window.Avatar.resolve(look),'full',256));map.colorSpace=THREE.SRGBColorSpace;
    // La foto sale con la luz de estudio de avatar3d.js: se tiñe un poco hacia la luz cálida de la plaza.
    item={uses:0,skin:new THREE.SpriteMaterial({map,transparent:true,alphaTest:.04,color:'#f3e6d0'})};cards.set(sig,item);
  }
  item.uses++;return item.skin;
}
function uncard(sig){
  const item=cards.get(sig);
  if(item&&--item.uses<=0){item.skin.map.dispose();item.skin.dispose();cards.delete(sig)}
}
function standFlat(look,sig){
  const holder=new THREE.Group(),flat=new THREE.Sprite(card(look,sig)),body=bodyOf(holder,{flat,flatSig:sig});
  // El encuadre «full» de la foto mide 3,45 m de alto por 2,3 de ancho, con el suelo a 0,175 m del borde de abajo.
  flat.center.set(.5,0);flat.scale.set(2.3,3.45,1);flat.position.y=-.175;
  holder.add(flat);addBlob(body);scene.add(holder);
  return body;
}
// Quita un cuerpo de la plaza y suelta lo que ocupaba (la etiqueta no: o se hereda o la suelta quien llama).
function scrap(body){
  scene.remove(body.holder);
  if(body.model)window.Avatar3D.dispose(body.model);
  if(body.flat)uncard(body.flatSig);
}
// Cambia un cuerpo por otro recién construido (otra ropa u otro nivel de detalle) sin moverlo del sitio.
function swap(old,next){
  next.holder.position.copy(old.holder.position);next.holder.rotation.y=old.holder.rotation.y;next.holder.scale.copy(old.holder.scale);
  if(old.tag){next.tag=old.tag;next.tagSig=old.tagSig;next.holder.add(old.tag)}
  Object.assign(next,{stride:old.stride,air:old.air,vy:old.vy,pace:old.pace,run:old.run});
  scrap(old);
}
// Etiqueta con el nombre sobre la cabeza (y, debajo, qué está haciendo si no está en el lobby).
function retag(body,name,sub,tone){
  const sig=`${name}|${sub}|${tone}`;
  if(body.tagSig===sig)return;
  body.tagSig=sig;
  const height=sub?150:92,texture=world.paint(512,height,(c,w,h)=>{
    c.fillStyle='#202436e8';c.beginPath();c.roundRect(0,0,w,h,34);c.fill();
    c.textAlign='center';c.textBaseline='middle';c.fillStyle=tone;c.font='700 50px "Space Grotesk",Arial,sans-serif';c.fillText(name,w/2,sub?48:h/2+2,w-40);
    if(sub){c.fillStyle='#c8c4d7';c.font='600 31px "DM Sans",Arial,sans-serif';c.fillText(sub,w/2,108,w-40)}
  });
  if(body.tag){body.tag.material.map.dispose();body.tag.material.map=texture;body.tag.material.needsUpdate=true}
  else{body.tag=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,transparent:true,depthWrite:false}));body.holder.add(body.tag)}
  body.tag.scale.set(2.5,2.5*height/512,1);body.tag.position.y=sub?3.2:3.08;
}
// Deja el cuerpo en su postura neutra, para pasar de un gesto a andar sin arrastrar restos del gesto.
function rest(body){
  const {group,parts}=body.model;
  body.actor?.stop();
  group.position.set(0,0,0);group.rotation.set(0,0,0);group.scale.set(1,1,1);
  parts.body.rotation.set(0,0,0);parts.upper.rotation.set(0,0,0);parts.neck.rotation.set(0,0,0);
  parts.legs.forEach((leg,i)=>{leg.rotation.set(0,0,0);leg.scale.y=1;parts.feet[i].position.copy(body.feet[i]);parts.feet[i].rotation.set(0,parts.feet[i].rotation.y,0)});
  parts.arms.forEach(({arm,fore,side})=>{arm.rotation.set(.02,0,side*.34);fore.rotation.set(-.28,0,side*-.08)});
}
// Quieto y en el suelo, al personaje lo anima el propio avatar (respira, parpadea y hace el gesto pendiente).
// Andando, corriendo o saltando lo mueve esto: piernas y brazos al contrario, y el cuerpo sube y baja un poco.
function pose(body,now){
  const walk=body.pace;
  if(body.actor&&walk<.04&&body.air<=0){
    if(body.walking){body.walking=false;body.actor.reset()}
    if(body.gesture){if(now<body.gestureUntil&&ACTS().has(body.gesture))body.actor.play(body.gesture);body.gesture=''}
    body.actor.step(now);
    return;
  }
  if(body.gesture&&now>body.gestureUntil)body.gesture='';
  if(!body.walking){body.walking=true;rest(body)}
  const {body:trunk,upper,neck,arms,legs,feet}=body.model.parts,run=body.run,stride=body.stride;
  const lift=Math.min(1,body.air/.4),swing=Math.sin(stride)*(.62+run*.2)*walk*(1-lift),breath=Math.sin(now/620)*(1-walk);
  trunk.position.set(0,body.model.base+Math.abs(Math.cos(stride))*(.045+run*.03)*walk,0);trunk.rotation.set(0,0,Math.sin(stride)*.03*walk);
  upper.rotation.set((.06+run*.2)*walk-.12*lift,-Math.sin(stride)*.12*walk,0);neck.rotation.set(-(.04+run*.12)*walk+.1*lift,Math.sin(stride)*.06*walk,0);
  legs.forEach((leg,i)=>{
    const s=(i?-1:1)*swing+(i?.55:-.75)*lift;leg.rotation.x=s;
    const home=body.feet[i];feet[i].position.set(home.x,home.y+Math.max(0,(i?-1:1)*Math.cos(stride))*.11*walk*(1-lift)+.16*lift,home.z-Math.sin(s)*.62);feet[i].rotation.x=s*.5;
  });
  arms.forEach(({arm,fore,side},i)=>{const s=(i?1:-1)*swing*.85;arm.rotation.set(.02+s,0,side*(.34+breath*.012+2*lift));fore.rotation.set(-.28-Math.abs(s)*(.5+run*.5)+breath*.02,0,side*-.08)});
}
function fall(body,dt){
  if(body.air>0){body.vy-=GRAVITY*dt;body.air+=body.vy*dt;if(body.air<=0){body.air=0;body.vy=0}}
}

function build(){
  lite=coarse||innerWidth<620;shadows=!lite;shade=shadows?2:0;
  renderer=new THREE.WebGLRenderer({canvas,antialias:!lite,powerPreference:'high-performance'});
  ratio=Math.min(window.devicePixelRatio||1,lite?1.5:2);renderer.setPixelRatio(ratio);
  renderer.shadowMap.enabled=shadows;if(shadows)renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(52,1,.1,130);
  world=createPlaza({THREE,scene,shadows});
  ray=new THREE.Raycaster();ndc=new THREE.Vector2();hitBox=new THREE.Box3();hitPoint=new THREE.Vector3();spare=new THREE.Vector3();
  ground=new THREE.Plane(new THREE.Vector3(0,1,0),0);
  blobShape=new THREE.CircleGeometry(.52,20);blobSkin=new THREE.MeshBasicMaterial({color:'#0e1020',transparent:true,opacity:.34,depthWrite:false});
  // Marcas en el suelo: el aro bajo el jugador elegido y el punto al que se va andando.
  const mark=(inner,outer,color)=>{const mesh=new THREE.Mesh(new THREE.RingGeometry(inner,outer,40),new THREE.MeshBasicMaterial({color,transparent:true,opacity:.9,depthWrite:false}));mesh.rotation.x=-Math.PI/2;mesh.position.y=.035;mesh.visible=false;scene.add(mesh);return mesh};
  ring=mark(.62,.8,CORAL);dot=mark(.16,.3,YELLOW);
}
function buildHero(){
  const look=myLook(),sig=JSON.stringify(look);
  if(hero?.sig===sig)return;
  const next=stand(window.Avatar3D.build(window.Avatar.resolve(look)));
  next.sig=sig;
  if(hero)swap(hero,next);
  // Al entrar, saluda.
  else{next.gesture='saludo';next.gestureUntil=performance.now()+4000}
  hero=next;
  retag(hero,myName,'',MINT);
}
function resize(){
  if(!renderer)return;
  const w=stage.clientWidth,h=stage.clientHeight;
  if(!w||!h)return;
  size.w=w;size.h=h;
  renderer.setSize(w,h,false);camera.aspect=w/h;camera.fov=w<h?62:50;camera.updateProjectionMatrix();
  // En estrecho, encima de la barra del lobby están el título y sus botones: los bocadillos no pasan de ahí.
  ceil=narrow.matches&&bar&&!bar.hidden?Math.max(0,bar.getBoundingClientRect().bottom-stage.getBoundingClientRect().top+4):0;
}

// Apunta a quien ha llegado y quita a quien se ha ido. Los cuerpos no se construyen aquí sino de uno en uno entre
// fotogramas (buildNext), para no dar tirones.
function syncPeers(){
  if(!world)return;
  const ids=new Set(players.map(one=>one.id));
  for(const id of [...peers.keys()])if(!ids.has(id))dropPeer(id);
  for(const one of players){
    let peer=peers.get(one.id);
    // sig y full: el aspecto y el nivel de detalle del cuerpo que tiene; want: el nivel que le toca (rank).
    if(!peer){peer={data:one,sig:null,body:null,full:false,want:!canFlat(),near:0,grow:0,seen:one.act?.n??0};peers.set(one.id,peer)}
    peer.data=one;
    if(peer.body)tagPeer(peer);
  }
}
const tagPeer=peer=>retag(peer.body,peer.data.name,peer.data.where==='lobby'?'':WHERE[peer.data.where],peer.data.friend?YELLOW:PAPER);
function dropPeer(id){
  const peer=peers.get(id);
  if(!peer)return;
  peers.delete(id);
  bubbles.get(id)?.el.remove();bubbles.delete(id);
  if(hovered===id)hovered=null;
  if(goal?.peer===id){goal=null;note(`${peer.data.name} se ha ido del lobby.`,3500)}
  if(menu.id===id)closeMenu();
  if(!peer.body)return;
  if(peer.body.tag){peer.body.tag.material.map.dispose();peer.body.tag.material.dispose()}
  scrap(peer.body);
}
// Nivel de detalle: un modelo son unas cien mallas y cien mil triángulos, y con el lobby lleno no hay equipo que
// mueva veinte. Solo los más cercanos a mi avatar lo llevan (8, o 5 en móvil), además de aquel a por quien se va y
// el del menú abierto, pase lo que pase. Quien ya lo lleva tiene FULL_STICK metros de ventaja, para que dos jugadores
// a la misma distancia no se lo quiten el uno al otro en cada fotograma.
function rank(){
  if(!canFlat()){for(const peer of peers.values())peer.want=true;return}
  const order=[];
  for(const [id,peer] of peers){
    const spot=peer.body?.holder.position||peer.data;
    peer.near=id===menu.id||id===goal?.peer?-1:Math.hypot(spot.x-pos.x,spot.z-pos.z)-(peer.full&&peer.body?FULL_STICK:0);
    order.push(peer);
  }
  order.sort((a,b)=>a.near-b.near);
  const max=lite?FULL_LITE:FULL_WIDE;
  order.forEach((peer,i)=>{peer.want=i<max});
}
// Una construcción por fotograma: primero quien aún no se ve; después quien ha cambiado de ropa o de nivel de
// detalle; a igualdad, el más cercano.
function buildNext(){
  let next=null,best=Infinity;
  for(const peer of peers.values()){
    if(peer.body&&peer.sig===peer.data.sig&&peer.full===peer.want)continue;
    const score=(peer.body?1000:0)+peer.near;
    if(score<best){best=score;next=peer}
  }
  if(!next)return;
  const one=next.data;
  let body=null;
  try{body=next.want?stand(window.Avatar3D.build(window.Avatar.resolve(one.look))):standFlat(one.look,one.sig)}
  catch(error){console.warn('Lobby: avatar de otro jugador',error);try{body=stand(window.Avatar3D.build(window.Avatar.resolve({})))}catch{}}
  // Se apunta aunque haya fallado, para no reintentarlo en cada fotograma.
  next.sig=one.sig;next.full=next.want;
  if(!body)return;
  if(next.body)swap(next.body,body);
  else{body.holder.position.set(one.x,0,one.z);body.holder.rotation.y=one.heading;body.holder.scale.setScalar(.3);next.grow=0}
  next.body=body;tagPeer(next);
}
// Los demás llegan con un pulso de retraso: van andando (o corriendo, si están lejos) hasta su última posición.
function movePeers(dt,now){
  let index=0;
  for(const peer of peers.values()){
    const body=peer.body;
    if(!body)continue;
    index++;
    const one=peer.data,spot=body.holder.position,gx=one.x-spot.x,gz=one.z-spot.z,d=Math.hypot(gx,gz);
    if(peer.grow<1){peer.grow=Math.min(1,peer.grow+dt*4);body.holder.scale.setScalar(.3+.7*peer.grow*(2-peer.grow))}
    let moving=d>.06,quick=false;
    if(d>13){spot.x=one.x;spot.z=one.z;moving=false}
    else if(moving){
      const speed=clamp(d*1.7,1.4,WALK+RUN+.6),step=Math.min(d,speed*dt);
      spot.x+=gx/d*step;spot.z+=gz/d*step;quick=speed>WALK+1;
      body.stride+=dt*(9.5+body.run*4.5)*Math.min(1,speed/WALK);
    }
    body.holder.rotation.y+=wrap((moving&&d>.4?Math.atan2(gx,gz):one.heading)-body.holder.rotation.y)*Math.min(1,dt*(moving?12:7));
    body.run+=((quick?1:0)-body.run)*Math.min(1,dt*6);
    body.pace+=((moving?1:0)-body.pace)*Math.min(1,dt*10);
    // Un gesto o un salto nuevo de este jugador.
    const move=one.act;
    if(move&&move.n!==peer.seen){
      peer.seen=move.n;
      if(move.name==='jump'){if(body.air<=0){body.vy=JUMP;body.air=.001}}
      else if(body.model){body.gesture=move.name;body.gestureUntil=now+900}
      // Una imagen plana no puede hacer el gesto: da un saltito, para que se note que ha hecho algo.
      else if(body.air<=0){body.vy=JUMP*.45;body.air=.001}
    }
    fall(body,dt);spot.y=body.air;
    // La imagen plana no anda: se mece un poco al moverse.
    if(!body.model){body.flat.position.y=-.175+Math.abs(Math.sin(body.stride))*.07*body.pace;continue}
    // En móvil, los que están quietos respiran a la mitad de fotogramas: no se nota y ahorra.
    if(lite&&!moving&&body.air<=0&&!body.gesture&&(frames+index)%2)continue;
    pose(body,now);
  }
}
const cancelGoal=()=>{goal=null;face=null};
function moveHero(dt,now){
  let ix=keys.right-keys.left+stick.x,iz=keys.down-keys.up+stick.y,dx=0,dz=0,amount=1,moving=false,fast=false,limit=Infinity;
  const len=Math.hypot(ix,iz);
  if(len>.08){
    // A mano: manda sobre cualquier destino y cierra el menú.
    if(goal||face!==null)cancelGoal();
    if(menu.box)closeMenu(false);
    if(len>1){ix/=len;iz/=len}
    dx=ix*Math.cos(yaw)+iz*Math.sin(yaw);dz=-ix*Math.sin(yaw)+iz*Math.cos(yaw);
    const push=Math.hypot(dx,dz)||1;dx/=push;dz/=push;amount=Math.min(1,len);moving=true;
    fast=!!keys.run||Math.hypot(stick.x,stick.y)>.92;
  }else if(goal){
    // Hacia un punto del suelo o hacia otro jugador, al que se sigue si se mueve.
    // El tiempo de persecución es el de la simulación (dt), no el del reloj: a pocos fotogramas por segundo el
    // personaje avanza menos por segundo real y no debe quedarse sin tiempo a medio camino.
    const target=goal.peer?peers.get(goal.peer)?.body?.holder.position:goal;
    goal.time=(goal.time||0)+dt;
    if(!target||(goal.peer&&goal.time>CHASE)){
      if(goal.peer)note('No has llegado a tiempo. Vuelve a intentarlo.',3500);
      cancelGoal();
    }else{
      const gx=target.x-pos.x,gz=target.z-pos.z,d=Math.hypot(gx,gz);
      if(d<=goal.reach){
        const done=goal;goal=null;
        if(done.peer){face=Math.atan2(gx,gz);openMenu(done.peer,done.anchor);poke()}
      }else{dx=gx/d;dz=gz/d;moving=true;fast=goal.run;limit=d-goal.reach+.02}
    }
  }
  if(moving){
    const step=Math.min(limit,(WALK+hero.run*RUN)*amount*dt),bx=pos.x,bz=pos.z;
    pos.x+=dx*step;pos.z+=dz*step;collide(pos);
    heading+=wrap(Math.atan2(dx,dz)-heading)*Math.min(1,dt*12);
    hero.stride+=dt*(9.5+hero.run*4.5)*amount;
    active();
    // Si algo le corta el paso y no avanza, deja de intentarlo.
    if(goal){goal.stuck=Math.hypot(pos.x-bx,pos.z-bz)<step*.2?goal.stuck+dt:0;if(goal.stuck>.9)cancelGoal()}
  }else if(face!==null){
    const turn=wrap(face-heading);
    heading+=turn*Math.min(1,dt*10);
    if(Math.abs(turn)<.02&&!menu.box)face=null;
  }
  hero.run+=((moving&&fast?1:0)-hero.run)*Math.min(1,dt*8);
  hero.pace+=((moving?1:0)-hero.pace)*Math.min(1,dt*10);
  fall(hero,dt);
  hero.holder.position.set(pos.x,hero.air,pos.z);hero.holder.rotation.y=heading;
  pose(hero,now);
  // El menú se cierra si el otro se va lejos, salvo que el jugador lo esté usando (puntero encima o foco dentro):
  // que el otro eche a andar no puede quitárselo de las manos.
  if(menu.box&&running&&!menuBusy()){
    const other=peers.get(menu.id)?.body?.holder.position;
    if(other&&Math.hypot(other.x-pos.x,other.z-pos.z)>MENU_FAR)closeMenu();
  }
}
// Qué hay bajo el puntero: un jugador (su caja de colisión es generosa, más aún con el dedo) o un punto del suelo.
function pick(clientX,clientY,touch=false){
  const rect=canvas.getBoundingClientRect();
  if(!rect.width||!rect.height)return null;
  ndc.set((clientX-rect.left)/rect.width*2-1,-(clientY-rect.top)/rect.height*2+1);
  ray.setFromCamera(ndc,camera);
  const half=touch?.95:.72;
  let best=null,nearest=Infinity;
  for(const [id,peer] of peers){
    if(!peer.body)continue;
    const spot=peer.body.holder.position;
    hitBox.min.set(spot.x-half,0,spot.z-half);hitBox.max.set(spot.x+half,3.5,spot.z+half);
    if(!ray.ray.intersectBox(hitBox,hitPoint))continue;
    const far=hitPoint.distanceTo(ray.ray.origin);
    if(far<nearest){nearest=far;best=id}
  }
  if(best)return {peer:best};
  return ray.ray.intersectPlane(ground,hitPoint)?inside({x:hitPoint.x,z:hitPoint.z}):null;
}
function bubble(id,text){
  if(!running||!layer)return;
  bubbles.get(id)?.el.remove();
  const node=el('p',{class:'plaza-bubble',text});node.hidden=true;
  layer.append(node);
  bubbles.set(id,{el:node,h:0,until:performance.now()+3800+Math.min(4000,text.length*55)});
}
function placeBubbles(now){
  for(const [id,item] of bubbles){
    if(now>item.until){item.el.remove();bubbles.delete(id);continue}
    const body=id==='me'?hero:peers.get(id)?.body;
    let shown=false;
    if(body){
      spare.copy(body.holder.position);spare.y+=3.45;spare.project(camera);
      if(spare.z<1){
        shown=true;
        // Si la cabeza queda fuera del lienzo, el bocadillo se queda en el borde (en estrecho, bajo la barra del
        // lobby: el punto que se coloca es el pie del bocadillo, así que cuenta su alto).
        const tall=item.h||(item.h=item.el.offsetHeight),floor=Math.max(64,ceil?ceil+tall+12:0);
        item.el.style.transform=`translate(${clamp((spare.x+1)/2*size.w,90,Math.max(90,size.w-90)).toFixed(1)}px,${Math.max(floor,(1-spare.y)/2*size.h).toFixed(1)}px)`;
      }
    }
    item.el.hidden=!shown;
    item.el.classList.toggle('is-fading',item.until-now<500);
  }
}
function tick(now){
  if(!running)return;
  frame=requestAnimationFrame(tick);
  // El movimiento admite pasos de hasta 0,1 s: con un tope menor, por debajo de 20 fotogramas por segundo todo iría
  // a cámara lenta. La medida de fotogramas lentos usa el tiempo real.
  const real=Math.max(0,(now-last)/1000),dt=Math.min(.1,real);last=now;frames++;
  // Si el equipo no puede, se baja un escalón cada vez: primero la resolución; con ella al mínimo, el mapa de
  // sombras a la mitad y, si aun así no llega, fuera sombras (cada uno pasa a llevar su borrón a los pies).
  slow=real>.045?slow+1:Math.max(0,slow-1);
  if(slow>90){
    slow=0;
    if(ratio>1){ratio=Math.max(1,ratio-.5);renderer.setPixelRatio(ratio);resize()}
    else if(shade>0){
      world.shade(--shade);
      if(!shade){shadows=false;for(const body of [hero,...[...peers.values()].map(peer=>peer.body)])if(body)addBlob(body)}
    }
  }
  if(frames%8===0)rank();
  buildNext();
  moveHero(dt,now);movePeers(dt,now);world.update(dt,now);
  // Cámara en tercera persona: sigue al personaje con un poco de retraso.
  focus.x+=(pos.x-focus.x)*Math.min(1,dt*9);focus.z+=(pos.z-focus.z)*Math.min(1,dt*9);
  const far=camera.aspect<1?7.8:6.8;
  camera.position.set(focus.x+Math.sin(yaw)*Math.cos(pitch)*far,1.6+Math.sin(pitch)*far,focus.z+Math.cos(yaw)*Math.cos(pitch)*far);
  camera.lookAt(focus.x,1.75,focus.z);camera.updateMatrixWorld();
  if(hoverAt){const under=pick(hoverAt.x,hoverAt.y);hoverAt=null;hovered=under?.peer||null;canvas.style.cursor=hovered?'pointer':''}
  const chosen=peers.get(menu.id||goal?.peer||hovered)?.body;
  ring.visible=!!chosen;
  if(chosen){ring.position.x=chosen.holder.position.x;ring.position.z=chosen.holder.position.z;ring.scale.setScalar(1+Math.sin(now/220)*.06)}
  dot.visible=!!goal&&!goal.peer;
  if(dot.visible){dot.position.x=goal.x;dot.position.z=goal.z;dot.scale.setScalar(1+Math.sin(now/160)*.12)}
  placeBubbles(now);
  renderer.render(scene,camera);
}
// El bucle solo corre con la plaza a la vista: sin pantalla encima, con la pestaña visible y el lienzo en pantalla.
const shouldRun=()=>ready&&!document.hidden&&onScreen&&where==='lobby';
function syncRun(){
  const want=shouldRun();
  if(want===running)return;
  running=want;
  if(!want){
    cancelAnimationFrame(frame);
    for(const key in keys)keys[key]=0;
    stick.x=stick.y=0;hoverAt=null;
    return;
  }
  // Al volver: la ropa puede haber cambiado y los demás se han movido mientras no se pintaba.
  try{buildHero()}catch(error){console.warn('Lobby:',error)}
  for(const peer of peers.values())if(peer.body){peer.body.holder.position.set(peer.data.x,0,peer.data.z);peer.body.holder.rotation.y=peer.data.heading;peer.body.pace=0}
  focus.x=pos.x;focus.z=pos.z;
  resize();last=performance.now();frame=requestAnimationFrame(tick);
}
// Cada cambio de pantalla (abrir un modo, cerrarlo) cambia «where», el ritmo del pulso y si se pinta la plaza.
function watch(){
  const next=whereNow(),chat=chatOpen();
  if(next!==where){
    where=next;
    if(where!=='lobby'){closeMenu(false);cancelGoal();showWheel(false)}
    active();poke();
  }else if(chat&&!chatWas&&where!=='lobby')poke(); // acaba de desplegar el chat dentro de un juego: que no espere al pulso lento
  chatWas=chat;
  syncRun();
}

// ---------- Controles ----------
function controls(){
  // Teclado: solo con el foco en el lienzo, para no robar teclas al resto de la portada.
  canvas.addEventListener('keydown',event=>{
    if(event.ctrlKey||event.metaKey||event.altKey)return;
    if(KEYS[event.code]){keys[KEYS[event.code]]=1;if(!event.code.startsWith('Shift'))event.preventDefault();return}
    const digit=/^Digit(\d)$/.exec(event.code);
    if(event.code==='Space'){event.preventDefault();jump()}
    else if(event.code==='KeyG')showWheel(wheel.hidden);
    else if(digit){const item=(wheelList.length?wheelList:emoteList())[(Number(digit[1])+9)%10];if(item)emote(item.id)}
    else if(event.code==='Enter'||event.code==='KeyT'){
      // La caja de chat es de chat-dock.js: si ya está en su hueco, Enter o T llevan a ella.
      const input=document.querySelector('#lobby-chat-slot input,#lobby-chat-slot textarea');
      if(window.ChatDock?.focus){event.preventDefault();window.ChatDock.focus()}
      else if(input){event.preventDefault();input.focus()}
    }else if(event.code==='Escape'){
      if(menu.box)closeMenu();else if(!wheel.hidden)showWheel(false);else if(goal)cancelGoal();else if(section.classList.contains('is-expanded'))expand(false);else return;
      event.preventDefault();
    }
  });
  canvas.addEventListener('keyup',event=>{if(KEYS[event.code])keys[KEYS[event.code]]=0});
  canvas.addEventListener('blur',()=>{for(const key in keys)keys[key]=0});
  window.addEventListener('blur',()=>{for(const key in keys)keys[key]=0});
  let hinted=false;
  canvas.addEventListener('focus',()=>{
    if(hinted||coarse||!canvas.matches(':focus-visible'))return;
    hinted=true;note('WASD o flechas para andar · Mayús para correr · Espacio para saltar · G para los gestos',7000);
  });
  // Puntero: arrastrar gira la cámara; un clic o un toque sin arrastre va al suelo o a por un jugador.
  let drag=null;
  canvas.addEventListener('pointerdown',event=>{
    if(event.button>0)return;
    drag={id:event.pointerId,x:event.clientX,y:event.clientY,sx:event.clientX,sy:event.clientY,at:performance.now(),moved:false};
    try{canvas.setPointerCapture(event.pointerId)}catch{}
    active();
  });
  canvas.addEventListener('pointermove',event=>{
    if(!drag||drag.id!==event.pointerId){if(event.pointerType==='mouse')hoverAt={x:event.clientX,y:event.clientY};return}
    if(!drag.moved&&Math.hypot(event.clientX-drag.sx,event.clientY-drag.sy)>(event.pointerType==='mouse'?5:10))drag.moved=true;
    if(drag.moved){yaw-=(event.clientX-drag.x)*.006;pitch=clamp(pitch+(event.clientY-drag.y)*.004,.1,1.05)}
    drag.x=event.clientX;drag.y=event.clientY;
  });
  canvas.addEventListener('pointerup',event=>{
    if(drag?.id!==event.pointerId)return;
    const tap=!drag.moved&&performance.now()-drag.at<700;
    drag=null;
    if(!tap||!running||!hero)return;
    const under=pick(event.clientX,event.clientY,event.pointerType!=='mouse');
    showWheel(false);
    if(under?.peer){approach(under.peer);return}
    closeMenu(false);
    if(under){const spot=collide({x:under.x,z:under.z});face=null;goal={x:spot.x,z:spot.z,reach:.14,run:!!keys.run,time:0,stuck:0}}
  });
  canvas.addEventListener('pointercancel',event=>{if(drag?.id===event.pointerId)drag=null});
  canvas.addEventListener('pointerleave',()=>{hoverAt=null;hovered=null;canvas.style.cursor=''});
  // Si el navegador pierde el contexto 3D, se pasa a la vista plana; si lo devuelve (preventDefault lo permite, y
  // three.js vuelve a subir entonces geometrías y texturas), se retoma la plaza donde estaba.
  canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();lost=true;flat('El 3D se ha parado: te dejamos la lista de jugadores.')});
  canvas.addEventListener('webglcontextrestored',()=>{if(lost){lost=false;unflat()}});
  // Palanca táctil para andar.
  if(pad){
    const knob=pad.firstElementChild;let hold=null;
    const move=event=>{
      const box=pad.getBoundingClientRect(),r=box.width/2;let x=(event.clientX-box.left-r)/r,y=(event.clientY-box.top-r)/r;const len=Math.hypot(x,y);
      if(len>1){x/=len;y/=len}
      stick.x=x;stick.y=y;knob.style.transform=`translate(${x*r*.55}px,${y*r*.55}px)`;
    };
    pad.addEventListener('pointerdown',event=>{hold=event.pointerId;try{pad.setPointerCapture(hold)}catch{}move(event);active()});
    pad.addEventListener('pointermove',event=>{if(hold===event.pointerId)move(event)});
    const release=event=>{if(hold!==event.pointerId)return;hold=null;stick.x=stick.y=0;knob.style.transform=''};
    pad.addEventListener('pointerup',release);pad.addEventListener('pointercancel',release);
    pad.hidden=!coarse;
  }
}
// Ampliar la plaza a toda la ventana, y volver. Es una clase de CSS y no la pantalla completa del navegador (que
// en iPhone no existe para esto): así los modos y los diálogos siguen abriéndose por encima.
let shut=[];
function expand(on){
  if(!ready)on=false;
  section.classList.toggle('is-expanded',on);
  expandButton?.setAttribute('aria-pressed',on);
  expandButton?.setAttribute('aria-label',on?'Reducir el lobby':'Ampliar el lobby a pantalla completa');
  if(expandButton)expandButton.title=on?'Reducir':'Ampliar';
  // Ampliado tapa el resto de la portada: se saca también del teclado y de los lectores de pantalla («inert») hasta
  // que se reduce. Los diálogos y las pantallas de los modos cuelgan de <body>, fuera de .home-screen: siguen vivos.
  for(const node of shut)node.inert=false;
  shut=[];
  if(on){
    const top=section.closest('.home-screen')||section.parentNode;
    for(let node=section;node&&node!==top;node=node.parentNode)
      for(const other of node.parentNode.children)if(other!==node&&!other.inert){other.inert=true;shut.push(other)}
  }
  resize();
}
expandButton?.addEventListener('click',()=>{expand(!section.classList.contains('is-expanded'));if(running)canvas.focus({preventScroll:true})});
document.addEventListener('keydown',event=>{
  if(event.key!=='Escape'||where!=='lobby'||!section?.classList.contains('is-expanded')||event.target===canvas||menu.box?.contains(event.target)||event.target.closest?.('input,textarea,select'))return;
  expand(false);
});

// ---------- Vista plana y arranque ----------
// La de siempre (el avatar de la portada) más la lista de jugadores, que en pantallas anchas ya sale abierta.
function flat(reason=''){
  ready=false;running=false;cancelAnimationFrame(frame);
  expand(false);closeMenu(false);cancelGoal();showWheel(false);
  section.classList.remove('is-3d');stage.hidden=true;
  for(const button of [emoteToggle,expandButton])if(button)button.hidden=true;
  if(pad)pad.hidden=true;
  for(const item of bubbles.values())item.el.remove();
  bubbles.clear();
  if(!narrow.matches)showRoster(true);
  if(reason)note(reason,6000);
}
function unflat(){
  if(!renderer||!world||ready)return;
  stage.hidden=false;section.classList.add('is-3d');
  for(const button of [emoteToggle,expandButton])if(button)button.hidden=false;
  if(pad)pad.hidden=!coarse;
  showRoster(false);
  ready=true;resize();syncRun();
  note('El 3D ha vuelto.',4000);
}
const avatarReady=()=>window.Avatar3D?.build?Promise.resolve():new Promise(done=>{
  document.addEventListener('faraday:avatar3d-ready',done,{once:true});setTimeout(done,7000);
});
async function start3d(){
  if(reduced||saver||!canvas||!stage||!layer)return flat();
  try{
    await avatarReady();
    if(!window.Avatar3D?.build||!window.Avatar?.resolve)return flat();
    THREE=await import(THREE_URL);
    // El lienzo necesita tamaño antes de construir nada.
    stage.hidden=false;section.classList.add('is-3d');
    build();buildHero();controls();
    ready=true;
    for(const button of [emoteToggle,expandButton])if(button)button.hidden=false;
    new ResizeObserver(resize).observe(stage);
    new IntersectionObserver(entries=>{onScreen=entries.at(-1).isIntersecting;syncRun()}).observe(stage);
    syncPeers();resize();syncRun();
    if(!store.get(sessionStorage,HINTED,false)){
      store.set(sessionStorage,HINTED,true);
      note(coarse?'Toca el suelo para andar o a un jugador para retarle.':'Haz clic en el suelo para andar o en un jugador para retarle.',8000);
    }
  }catch(error){
    console.warn('Lobby 3D:',error);
    flat();
  }
}
function boot(){
  if(!section||!bar||!badge||!roster||!rosterToggle||!rosterList||!rosterEmpty||!count||!noteBox||!wheel||!emoteToggle)return;
  bar.hidden=false;
  paintBadge();
  document.addEventListener('faraday:apodo',event=>{
    const name=clean(event.detail?.name,16);
    if(!name||name===myName)return;
    myName=name;
    if(hero)retag(hero,myName,'',MINT);
    poke();
  });
  // La rueda de gestos ha cambiado en el perfil.
  document.addEventListener('faraday:emotes',()=>{wheelList=[];if(!wheel.hidden)showWheel(true)});
  // Cambio de ropa: se reconstruye el modelo propio.
  for(const name of ['faraday:look','faraday:progreso'])document.addEventListener(name,()=>{if(running)try{buildHero()}catch{}});
  // Otra cuenta, otra identidad en el lobby: se pregunta ya (apply() nota el cambio y empieza de cero).
  document.addEventListener('faraday:cuenta',()=>{if(!document.hidden)plan(400)});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)clearTimeout(timer);else plan(0);syncRun()});
  window.addEventListener('pagehide',()=>{
    clearTimeout(timer);
    if(!joined)return;
    joined=false;
    try{fetch(API,{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:'{"action":"salir"}',keepalive:true}).catch(()=>{})}catch{}
  });
  window.addEventListener('pageshow',event=>{if(event.persisted)plan(0)});
  // Vuelve la red: no se espera al siguiente reintento.
  window.addEventListener('online',()=>{if(!document.hidden&&(solo||fails))plan(0)});
  narrow.addEventListener?.('change',()=>{if(menu.box)placeMenu()});
  window.addEventListener('resize',()=>{if(menu.box)placeMenu()});
  // Pantallas que se abren y se cierran: se vigilan las conocidas y, por si acaso, se mira una vez por segundo.
  const observer=new MutationObserver(watch);
  for(const [id] of [...DIALOGS,...SHELLS]){const node=$(id);if(node)observer.observe(node,{attributes:true,attributeFilter:['hidden','open']})}
  setInterval(watch,1000);
  where=whereNow();
  // El primer pulso espera a que community.js tenga lista la identidad anónima (la cookie del jugador).
  Promise.resolve(typeof playerReady!=='undefined'?playerReady:null).catch(()=>{}).then(()=>plan(0));
  // El 3D se construye cuando la portada ya se ha pintado.
  if(window.requestIdleCallback)window.requestIdleCallback(()=>start3d(),{timeout:1500});else setTimeout(start3d,200);
  emit('faraday:lobby-ready',null);
}
try{boot()}catch(error){console.warn('Lobby:',error)}

// Referidos: el «Circuito» de amigos (decisión 0038). Quien invita y quien es invitado ganan los dos, siempre con
// cofres, faradios y piezas exclusivas del avatar; nunca con dinero.
//
// El servidor manda en lo que importa: quién invitó a quién y cuándo un invitado ha jugado de verdad. Los premios se
// entregan en el navegador (progress.js), pero solo después de que el servidor los marque como cobrados, una vez.
//
// Reglas (RULES):
//   - Cada jugador tiene un código de 6 caracteres. Los enlaces que se comparten llevan ?de=CÓDIGO.
//   - Solo se apunta el vínculo si quien abre el enlace es un jugador NUEVO (sin ninguna respuesta guardada), no es
//     quien invita y no tenía ya padrino. Un invitado tiene un único padrino.
//   - El invitado pasa a ser «conexión» cuando juega el reto del día (el mismo día, daily_results) en 3 días distintos
//     dentro de sus primeros 14 días. Lo que se juega desde el archivo no cuenta.
//   - Invitado: cofre Rayo de bienvenida al terminar su primer reto del día, y 150 ≈ al hacerse conexión.
//   - Quien invita: un cofre Rayo por cada conexión hasta la 10.ª; desde la 11.ª, 50 ≈ por conexión, como mucho 20
//     al mes. Los escalones (piezas exclusivas en 1, 5 y 10 conexiones y un cofre Tormenta en 3) los aplica el
//     navegador con el número de conexiones que da el servidor.
//   - Corriente compartida: durante los 30 días siguientes al vínculo, cada día que juegan los dos el reto del día,
//     a los dos se les carga la batería +15.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {madridDate} from '../content-engine.mjs';
import {AVATAR_SLOTS} from './duelos.mjs';
import {shiftDate} from './ligas.mjs';

export const RULES={
  days:3,          // retos del día jugados para ser conexión
  window:14,       // días que tiene el invitado para jugarlos, contando el del vínculo
  chests:10,       // conexiones que dan cofre Rayo a quien invita
  extraCoins:50,   // lo que da cada conexión a partir de la 11.ª
  extraPerMonth:20,// conexiones extra que pagan al mes
  inviteeCoins:150,// lo que gana el invitado al hacerse conexión
  current:30,      // días de corriente compartida
  currentCharge:15,// batería extra por cada día que jugáis los dos
  recentDays:7     // días hacia atrás que se miran para la corriente
};

const PLAYER=/^[a-f0-9-]{36}$/i,CODE=/^[A-Z2-9]{6}$/,ALPHABET='ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const hash=player=>createHash('sha256').update(player).digest('hex');
const clone=value=>JSON.parse(JSON.stringify(value));
const clean=(value,max)=>(typeof value==='string'?value:'').replace(/[\u0000-\u001f<>&"'`]/g,'').replace(/\s+/g,' ').trim().slice(0,max);
function cleanAvatar(value){
  const avatar={};
  if(value&&typeof value==='object')for(const slot of AVATAR_SLOTS){const piece=value[slot];if(typeof piece==='string'&&/^[a-z0-9-]{1,24}$/.test(piece))avatar[slot]=piece}
  return avatar;
}
// Identificador opaco de un vínculo para el navegador (la corriente compartida): no deja ver el de nadie.
const linkId=row=>createHash('sha256').update('circuito:'+row.invitee+':'+row.inviter).digest('hex').slice(0,12);

// Almacén en memoria (pruebas) o en un archivo JSON (servidor local). Misma interfaz que el de Supabase (lib/stores.mjs).
//   codes: {player: {code, name, avatar, createdAt}}  links: {invitee: {invitee, inviter, linkedAt, connectedAt, claimed:{...}}}
export function memoryReferrals(file=null){
  let data={codes:{},links:{}};
  if(file){try{data=JSON.parse(fs.readFileSync(file,'utf8'))}catch(error){if(error.code!=='ENOENT')throw error}}
  const save=()=>{if(!file)return;fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file+'.tmp',JSON.stringify(data));fs.renameSync(file+'.tmp',file)};
  return {
    async codeOf(player){return data.codes[player]?{player,...clone(data.codes[player])}:null},
    async byCode(code){const entry=Object.entries(data.codes).find(([,value])=>value.code===code);return entry?{player:entry[0],...clone(entry[1])}:null},
    async createCode(entry){
      if(data.codes[entry.player])return;
      if(Object.values(data.codes).some(value=>value.code===entry.code))throw Error('Código de referido repetido');
      data.codes[entry.player]={code:entry.code,name:entry.name,avatar:entry.avatar,createdAt:entry.createdAt};save();
    },
    async updateProfile(player,{name,avatar}){if(data.codes[player]){Object.assign(data.codes[player],{name,avatar});save()}},
    async profiles(players){return Object.fromEntries(players.filter(player=>data.codes[player]).map(player=>[player,{name:data.codes[player].name,avatar:clone(data.codes[player].avatar)}]))},
    async linkOf(invitee){return data.links[invitee]?clone(data.links[invitee]):null},
    async linksOf(inviter){return Object.values(data.links).filter(link=>link.inviter===inviter).map(clone)},
    // 'ok' si se apunta, 'exists' si ese invitado ya tenía padrino.
    async link(row){if(data.links[row.invitee])return 'exists';data.links[row.invitee]={...clone(row),connectedAt:null,claimed:{welcome:false,invitee:false,inviter:false}};save();return 'ok'},
    async connect(invitee,at){const link=data.links[invitee];if(link&&!link.connectedAt){link.connectedAt=at;save()}},
    // Marca un premio como cobrado. true solo la primera vez: así nadie lo cobra dos veces.
    async claim(invitee,which){const link=data.links[invitee];if(!link||link.claimed[which])return false;link.claimed[which]=true;save();return true}
  };
}

// results(players, from, to) -> {player: {fecha: distancia}}: los retos del día jugados el mismo día (daily_results).
// answered(player) -> true si el jugador ya tiene alguna respuesta guardada (entonces no es nuevo).
export function createReferrals({referrals,results,answered,now=Date.now,random=Math.random}){
  const fail=(status,error)=>({status,body:{error}});
  const today=()=>madridDate(new Date(now()));
  const dayOf=t=>madridDate(new Date(t));
  const newCode=()=>{let code='';for(let i=0;i<6;i++)code+=ALPHABET[Math.floor(random()*ALPHABET.length)];return code};
  const readCode=value=>{const code=typeof value==='string'?value.trim().toUpperCase():'';return CODE.test(code)?code:null};
  const identity=data=>({name:clean(data.name,16)||'Jugador',avatar:cleanAvatar(data.avatar)});
  const deadline=link=>shiftDate(dayOf(link.linkedAt),RULES.window-1);

  async function ensureCode(player,data){
    const own=await referrals.codeOf(player),{name,avatar}=identity(data);
    if(own){if(own.name!==name||JSON.stringify(own.avatar)!==JSON.stringify(avatar))await referrals.updateProfile(player,{name,avatar});return own.code}
    for(let attempt=0;;attempt++){
      const code=newCode();
      try{await referrals.createCode({player,code,name,avatar,createdAt:now()});return (await referrals.codeOf(player)).code}catch(error){if(attempt>=2)throw error}
    }
  }
  // Días jugados por el invitado dentro de su plazo. Si llega a RULES.days, se apunta la conexión (una vez).
  async function evaluate(links){
    const pending=links.filter(link=>!link.connectedAt);
    if(pending.length){
      const from=pending.reduce((min,link)=>dayOf(link.linkedAt)<min?dayOf(link.linkedAt):min,'9999-12-31');
      const played=await results(pending.map(link=>link.invitee),from,today());
      for(const link of pending){
        const days=Object.keys(played[link.invitee]||{}).filter(day=>day>=dayOf(link.linkedAt)&&day<=deadline(link));
        link.days=days.length;
        if(days.length>=RULES.days){link.connectedAt=now();await referrals.connect(link.invitee,link.connectedAt)}
      }
    }
    for(const link of links)if(link.connectedAt)link.days=RULES.days;
    return links;
  }
  // Corriente compartida: días recientes (dentro de los 30 del vínculo) en que jugaron los dos el reto del día.
  async function current(player,links,profiles){
    const day=today(),active=links.filter(link=>shiftDate(dayOf(link.linkedAt),RULES.current-1)>=day);
    if(!active.length)return [];
    const from=shiftDate(day,-(RULES.recentDays-1)),others=active.map(link=>link.invitee===player?link.inviter:link.invitee);
    const played=await results([player,...others],from,day),mine=played[player]||{};
    return active.map((link,i)=>{
      const other=others[i],start=dayOf(link.linkedAt),end=shiftDate(start,RULES.current-1);
      const both=Object.keys(mine).filter(d=>d>=start&&d<=end&&d>=from&&played[other]?.[d]!==undefined).sort();
      return {id:linkId(link),name:profiles[other]?.name||'Jugador',until:end,days:both};
    });
  }

  async function status(player){
    const day=today(),[own,mine]=await Promise.all([referrals.linkOf(player),referrals.linksOf(player)]);
    const links=await evaluate([...mine,...(own?[own]:[])]);
    const profiles=await referrals.profiles([...new Set(links.flatMap(link=>[link.invitee,link.inviter]))]);
    const friends=links.filter(link=>link.inviter===player).sort((a,b)=>a.linkedAt-b.linkedAt);
    const connections=friends.filter(link=>link.connectedAt).length;
    const body={rules:{days:RULES.days,window:RULES.window,chests:RULES.chests,current:RULES.current,currentCharge:RULES.currentCharge},
      connections,
      friends:friends.map(link=>({name:profiles[link.invitee]?.name||'Jugador',avatar:profiles[link.invitee]?.avatar||{},days:link.days,connected:!!link.connectedAt,expired:!link.connectedAt&&deadline(link)<day,until:deadline(link)})),
      current:await current(player,links,profiles),
      pending:0};
    const link=links.find(row=>row.invitee===player);
    if(link){
      // El resultado de hoy de quien te invitó solo se enseña cuando ya has jugado el reto de hoy: no destripa nada.
      const played=await results([player,link.inviter],day,day),yours=played[player]?.[day],theirs=played[link.inviter]?.[day];
      body.sponsor={name:profiles[link.inviter]?.name||'Jugador',avatar:profiles[link.inviter]?.avatar||{},days:link.days,connected:!!link.connectedAt,until:deadline(link),
        expired:!link.connectedAt&&deadline(link)<day,today:yours!==undefined?{yours,theirs:theirs??null}:null};
      const first=Object.keys((await results([player],dayOf(link.linkedAt),day))[player]||{}).length>0;
      body.pending+=(!link.claimed.welcome&&first)+(!link.claimed.invitee&&!!link.connectedAt);
    }
    body.pending+=friends.filter(row=>row.connectedAt&&!row.claimed.inviter).length;
    return body;
  }

  // Cobra los premios pendientes. Cada uno se marca en el servidor antes de devolverlo: si dos peticiones llegan a la
  // vez, solo una lo recibe.
  async function claim(player){
    const day=today(),prizes=[],[own,mine]=await Promise.all([referrals.linkOf(player),referrals.linksOf(player)]);
    const links=await evaluate([...mine,...(own?[own]:[])]);
    const link=links.find(row=>row.invitee===player);
    if(link){
      const first=Object.keys((await results([player],dayOf(link.linkedAt),day))[player]||{}).length>0;
      if(first&&!link.claimed.welcome&&await referrals.claim(player,'welcome'))prizes.push({kind:'bienvenida',chest:'rayo'});
      if(link.connectedAt&&!link.claimed.invitee&&await referrals.claim(player,'invitee'))prizes.push({kind:'conexion-invitado',coins:RULES.inviteeCoins});
    }
    // Las conexiones de quien invita se pagan en el orden en que se cobran: las 10 primeras, cofre; las siguientes,
    // faradios, como mucho RULES.extraPerMonth al mes (contando las cobradas este mes, por la fecha de conexión).
    const connected=links.filter(row=>row.inviter===player&&row.connectedAt).sort((a,b)=>a.connectedAt-b.connectedAt);
    const month=dayOf(now()).slice(0,7),paid=connected.filter(row=>row.claimed.inviter);
    let count=paid.length,extrasThisMonth=Math.max(0,paid.length-RULES.chests)&&paid.slice(RULES.chests).filter(row=>dayOf(row.connectedAt).slice(0,7)===month).length;
    for(const row of connected){
      if(row.claimed.inviter||!await referrals.claim(row.invitee,'inviter'))continue;
      const n=++count;
      if(n<=RULES.chests)prizes.push({kind:'conexion',chest:'rayo',n});
      else if(extrasThisMonth<RULES.extraPerMonth){extrasThisMonth++;prizes.push({kind:'conexion',coins:RULES.extraCoins,n})}
    }
    return {prizes,connections:connected.length};
  }

  async function handle(data){
    if(typeof data.player!=='string'||!PLAYER.test(data.player))return fail(400,'Jugador no válido');
    const player=hash(data.player.toLowerCase());
    switch(data.action){
      // Tu código (se crea la primera vez). Guarda también tu apodo y tu avatar para que te reconozcan tus amigos.
      case 'codigo':return {status:200,body:{code:await ensureCode(player,data)}};
      // Alguien abre un enlace con ?de=CÓDIGO. Solo cuenta si es un jugador nuevo.
      case 'abrir':{
        const code=readCode(data.code);if(!code)return fail(400,'El código tiene 6 letras o números');
        const inviter=await referrals.byCode(code);if(!inviter)return fail(404,'No hay nadie con ese código');
        const sponsor={name:inviter.name||'Jugador',avatar:inviter.avatar||{}};
        if(inviter.player===player)return {status:200,body:{linked:false,reason:'tu-codigo',sponsor}};
        const existing=await referrals.linkOf(player);
        if(existing)return {status:200,body:{linked:false,reason:existing.inviter===inviter.player?'ya':'otro',sponsor}};
        if(await answered(player))return {status:200,body:{linked:false,reason:'ya-jugabas',sponsor}};
        // Quien te invitó no puede ser alguien a quien invitaste tú (no se cierran círculos).
        const back=await referrals.linkOf(inviter.player);if(back?.inviter===player)return {status:200,body:{linked:false,reason:'circulo',sponsor}};
        await ensureCode(player,data);
        const result=await referrals.link({invitee:player,inviter:inviter.player,linkedAt:now()});
        return {status:200,body:{linked:result==='ok',reason:result==='ok'?null:'ya',sponsor,days:RULES.days,window:RULES.window}};
      }
      case 'estado':return {status:200,body:await status(player)};
      case 'reclamar':return {status:200,body:await claim(player)};
      default:return fail(400,'Acción no válida');
    }
  }
  return {handle};
}

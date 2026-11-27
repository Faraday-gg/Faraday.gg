import {randomInt,randomUUID} from 'node:crypto';
import '../dist/casino-rules.js';
import {chatText} from './duelos.mjs';

// Póker entre amigos: Texas Hold'em. Las reglas de la mano están en dist/casino-rules.js (HOLDEM) y aquí se
// guarda la mesa, se oculta lo que cada uno no debe ver y se liquida el monedero compartido.
const {deck,HOLDEM}=globalThis.CasinoRules;
// Ciegas, lo más que se puede llevar a una mano y el tiempo para cada jugada.
const SMALL=5, BIG=10, CAP=200, START=1000, SEATS=4, PRESENCE=9000, TURN_TIME=30000;
const date=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Madrid'});
const validAction=new Set(['pulse','exit','create','join','stand','ready','deal','act','chat']);
// Chat del Salón: mensajes cortos entre amigos, guardados en la misma fila que la presencia. Mismos límites que el
// chat de los duelos (decisión 0040): 6 mensajes cada 10 segundos y nunca dos en menos de 0,4 s.
export const SALON_CHAT={keep:40,burst:6,burstMs:10000,gapMs:400,shown:120000};
// Gestos que un jugador puede enseñar a sus amigos (los mismos que ofrece dist/casino-chat.js) y el salto.
export const SALON_ACTS=new Set(['jump','saludo','puno','giro','bailar','robot','disco','twist','dab','negar','pensar','hombros','suspiro',
  // El resto de emotes del armario (dist/celebrations.js): pueden ser favoritos de la rueda del Lobby.
  'clavada','salto','aspersor','balanceo','correr','casi','encoger','facepalm','horror','desmayo','saludo2']);
// Lo último que ha hecho un jugador: {name, n}. «n» lo lleva su navegador y sube con cada gesto, para que los demás
// sepan cuándo es uno nuevo.
function actOf(act){
  if(!act||typeof act!=='object'||!SALON_ACTS.has(act.name)||!Number.isInteger(act.n)||act.n<1||act.n>1e9)return null;
  return {name:act.name,n:act.n};
}
const validMove=new Set(['fold','check','call','raise']);
const validId=/^[a-f0-9-]{36}$/;
const fail=(status,error)=>({status,body:{error}});
const position=(value,limit)=>Number.isFinite(value)?Math.round(Math.min(limit,Math.max(-limit,value))*10)/10:0;

function lookOf(look){
  if(!look||typeof look!=='object'||Array.isArray(look))return {};
  return Object.fromEntries(Object.entries(look).filter(([key,value])=>
    /^[a-z][a-zA-Z]{0,24}$/.test(key)&&typeof value==='string'&&/^[a-z0-9-]{1,60}$/.test(value)).slice(0,24));
}

const live=table=>!!table.round&&table.round.game.stage!=='done';
// Al terminar la mano, cada monedero recibe la diferencia entre las fichas con que empezó y con las que acaba.
function settle(room,table){
  const round=table.round;
  if(!round||round.paid||round.game.stage!=='done')return;
  round.paid=true;
  round.game.deck=[];
  round.players.forEach((player,i)=>{room.wallets[player].coins+=round.game.seats[i].stack-round.start[i]});
}

function expire(room,time){
  let changed=false;
  for(const [player,entry] of Object.entries(room.presence)){
    if(time-entry.at>PRESENCE){delete room.presence[player];changed=true}
  }
  for(const [id,table] of Object.entries(room.tables)){
    // Una mesa guardada con el póker de descarte anterior no tiene partida de Hold'em: se queda sin mano.
    if(table.round&&!table.round.game){table.round=null;changed=true}
    // A quien se le acaba el tiempo o se ha desconectado se le pasa el turno: pasa si puede y, si no, se retira.
    while(live(table)){
      const {round}=table,{game}=round;
      if(time<round.ends&&room.presence[round.players[game.turn]])break;
      HOLDEM.act(game,game.turn,HOLDEM.legal(game).canCheck?{type:'check'}:{type:'fold'});
      round.ends=time+TURN_TIME;
      settle(room,table);changed=true;
    }
    if(!live(table)){
      const seats=table.seats.filter(player=>room.presence[player]);
      if(seats.length!==table.seats.length){table.seats=seats;table.ready=[];changed=true}
      if(!seats.length){delete room.tables[id];changed=true}
    }
  }
  return changed;
}
const seated=(room,player)=>Object.values(room.tables).find(table=>table.seats.includes(player));
const freshWallet=day=>({coins:START,day});
function wallet(room,player,day){
  const previous=room.wallets[player];
  if(!previous)return (room.wallets[player]=freshWallet(day));
  if(previous.day!==day){previous.day=day;previous.coins=Math.max(100,previous.coins)}
  return previous;
}

function view(room,player,friends,day,time){
  const allowed=id=>id===player||friends.has(id);
  const others=Object.entries(room.presence).filter(([id])=>id!==player&&allowed(id)).slice(0,24);
  const players=others.map(([,entry])=>({
    id:entry.id,name:entry.name,look:entry.look,x:entry.x,z:entry.z,heading:entry.heading,act:entry.act??null
  }));
  const seats=new Map();
  for(const table of Object.values(room.tables)){
    table.seats.forEach((id,index)=>seats.set(id,index));
  }
  players.forEach((entry,index)=>{entry.seat=seats.get(others[index][0])??null});
  const tables=Object.values(room.tables).filter(table=>!live(table)&&
    table.seats.length<SEATS&&table.seats.every(allowed)&&!table.seats.includes(player))
    .map(table=>({id:table.id,name:room.presence[table.seats[0]]?.name,seats:table.seats.length}));
  const table=seated(room,player);
  const round=table?.round,game=round?.game,me=round?round.players.indexOf(player):-1;
  const name=id=>allowed(id)?room.presence[id]?.name||'Desconectado':'Jugador';
  const look=id=>allowed(id)?room.presence[id]?.look??{}:{};
  const balance=room.wallets[player];
  // Solo llegan los mensajes propios y los de amigos, y solo los recientes.
  const chat=(room.chat||[]).filter(message=>allowed(message.from)&&time-message.at<SALON_CHAT.shown)
    .map(message=>({n:message.n,id:message.id,name:message.name,text:message.text,mine:message.from===player,at:message.at}));
  return {
    players,tables,chat,small:SMALL,big:BIG,cap:CAP,serverTime:time,coins:balance?(balance.day===day?balance.coins:Math.max(100,balance.coins)):START,
    table:table?{
      id:table.id,
      host:table.seats[0]===player,
      seat:seats.get(player),
      seats:table.seats.map(id=>({name:name(id),look:look(id),mine:id===player,ready:table.ready.includes(id)})),
      // De la mano solo sale lo que se ve en la mesa: las cartas propias y, al enseñar, las de quien llega al final.
      round:round?{
        id:round.id,stage:game.stage,board:game.board,pot:HOLDEM.pot(game),turn:game.turn,ends:round.ends,button:game.button,
        legal:me>=0&&game.turn===me?HOLDEM.legal(game):null,
        seats:round.players.map((id,i)=>{
          const seat=game.seats[i],shown=game.stage==='done'&&game.result.showdown&&!seat.folded&&allowed(id);
          return {name:name(id),look:look(id),mine:i===me,stack:seat.stack,bet:seat.bet,folded:seat.folded,allin:seat.allin,
            cards:i===me||shown?seat.cards:null,won:game.result?game.result.won[i]:0,hand:shown?game.result.hands[i]:null};
        })
      }:null
    }:null
  };
}

export function createCasino({store,social,scope,now=Date.now}){
  return async function casino(player,data){
    if(!validAction.has(data.action))return fail(400,'Acción del Salón no válida.');
    const profile=await social.profile(scope,player);
    if(!profile)return fail(409,'Activa tu perfil de amigos para entrar al Salón compartido.');
    const contacts=await social.friends(scope,player);
    const friends=new Set(contacts.map(row=>row.first_player===player?row.second_player:row.first_player));
    for(let attempt=0;attempt<7;attempt++){
      const row=await store.get(scope);
      const room=row?.state??{presence:{},wallets:{},tables:{}};
      const time=now(),day=date.format(time);
      let changed=expire(room,time);
      let table=seated(room,player);
      if(data.action==='exit'||data.action==='stand'){
        // Quien se levanta durante una mano se retira de ella. Lo que le quede se abona aunque cierre la pestaña.
        if(table){
          if(live(table)){HOLDEM.leave(table.round.game,table.round.players.indexOf(player));settle(room,table)}
          table.seats=table.seats.filter(id=>id!==player);
          table.ready=[];
          if(!table.seats.length&&!live(table))delete room.tables[table.id];
          changed=true;
        }
        if(data.action==='exit'&&room.presence[player]){delete room.presence[player];changed=true}
      }else{
        const previous=room.presence[player];
        if(data.action==='pulse'){
          const x=position(data.x,12.3),z=position(data.z,9.3),heading=position(data.heading,Math.PI*2);
          // Un gesto nuevo se apunta enseguida, sin esperar al siguiente cambio de sitio.
          const act=actOf(data.act)??previous?.act??null,acted=!!act&&act.n!==previous?.act?.n&&(!previous||time-previous.at>=300);
          if(!previous||acted||time-previous.at>=4000||time-previous.at>=900&&(previous.x!==x||previous.z!==z||previous.heading!==heading)){
            room.presence[player]={id:previous?.id??randomUUID(),name:profile.name,look:previous?.look??lookOf(data.look),at:time,x,z,heading,act};
            changed=true;
          }
        }else{
          if(!previous)return fail(409,'Vuelve a entrar al Salón compartido.');
          if(data.action==='chat'){
            const text=chatText(data.text);
            if(!text)return fail(400,'Escribe un mensaje.');
            const chat=room.chat||(room.chat=[]),mine=chat.filter(message=>message.from===player&&time-message.at<SALON_CHAT.burstMs);
            if(mine.length>=SALON_CHAT.burst||mine.some(message=>time-message.at<SALON_CHAT.gapMs))return fail(429,'Vas muy rápido. Espera un momento.');
            room.chatSeq=(room.chatSeq||0)+1;
            chat.push({n:room.chatSeq,from:player,id:previous.id,name:profile.name,text,at:time});
            if(chat.length>SALON_CHAT.keep)chat.splice(0,chat.length-SALON_CHAT.keep);
            previous.at=time;changed=true;
          }
          const busy=Object.values(room.tables).some(other=>live(other)&&other.round.players.includes(player));
          if(data.action==='create'||data.action==='join'){
            if(table||busy)return fail(409,'Ya estás jugando en una mesa.');
            if(data.action==='create'){
              table={id:randomUUID(),seats:[player],ready:[],round:null,button:-1};
              room.tables[table.id]=table;
            }else{
              table=typeof data.id==='string'&&validId.test(data.id)?room.tables[data.id]:null;
              if(!table||!table.seats.length||live(table)||table.seats.length>=SEATS||
                !table.seats.every(id=>friends.has(id)))return fail(404,'Esta mesa ya no está disponible.');
              table.seats.push(player);
              table.ready=[];
            }
            changed=true;
          }
          if(data.action==='ready'){
            if(!table||live(table)||(data.previous??null)!==(table.round?.id??null)||typeof data.ready!=='boolean')
              return fail(409,'Espera a la siguiente mano.');
            if(data.ready&&wallet(room,player,day).coins<BIG)return fail(409,'No tienes fichas para esta mano.');
            table.ready=table.ready.filter(id=>id!==player);
            if(data.ready)table.ready.push(player);
            changed=true;
          }
          if(data.action==='deal'){
            if(!table||data.id!==table.id||table.seats[0]!==player||live(table)||
              (data.previous??null)!==(table.round?.id??null)||table.seats.length<2)
              return fail(409,'Hace falta una mesa con dos o más jugadores para repartir.');
            if(!table.seats.every(id=>table.ready.includes(id)))return fail(409,'Todos deben estar listos para esta mano.');
            for(const [index,member] of table.seats.entries()){
              if(!room.presence[member]||wallet(room,member,day).coins<BIG)
                return fail(409,'Alguien en la mesa está desconectado o no tiene fichas suficientes.');
              if(member!==player){
                const links=await social.friends(scope,member);
                const linked=new Set(links.map(row=>row.first_player===member?row.second_player:row.first_player));
                if(!table.seats.every((id,i)=>i===index||linked.has(id)))return fail(409,'La mesa solo está disponible entre amigos.');
              }
            }
            // Cada uno se sienta con lo que tiene, hasta el tope de la mesa. El botón pasa al siguiente en cada mano.
            const start=table.seats.map(member=>Math.min(CAP,room.wallets[member].coins));
            table.button=((table.button??-1)+1)%table.seats.length;
            const game=HOLDEM.start({stacks:[...start],button:table.button,small:SMALL,big:BIG,deck:deck(()=>randomInt(2**24)/2**24)});
            table.ready=[];
            table.round={id:randomUUID(),players:[...table.seats],start,game,ends:time+TURN_TIME};changed=true;
          }
          if(data.action==='act'){
            if(!table||!live(table)||data.id!==table.round.id)return fail(409,'Esta mano ya terminó.');
            if(!validMove.has(data.move)||(data.move==='raise'&&!Number.isInteger(data.to)))return fail(400,'Jugada no válida.');
            const {round}=table;
            if(!HOLDEM.act(round.game,round.players.indexOf(player),{type:data.move,to:data.to}))
              return fail(409,'No es tu turno o esa jugada no vale ahora.');
            round.ends=time+TURN_TIME;
            settle(room,table);changed=true;
          }
        }
      }
      if(!changed||await store.put({scope,version:(row?.version??0)+1,state:room},row?.version??null))
        return {status:200,body:view(room,player,friends,day,time)};
    }
    return fail(409,'La mesa se está actualizando. Inténtalo de nuevo.');
  };
}

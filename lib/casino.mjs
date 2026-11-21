import {randomInt,randomUUID} from 'node:crypto';
import '../dist/casino-rules.js';

const {deck,draw,hand,HANDS}=globalThis.CasinoRules;
const ANTE=25, START=1000, SEATS=4, PRESENCE=9000, DRAW_TIME=45000;
const date=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Madrid'});
const validAction=new Set(['pulse','exit','create','join','stand','ready','deal','draw']);
const validId=/^[a-f0-9-]{36}$/;
const fail=(status,error)=>({status,body:{error}});
const position=(value,limit)=>Number.isFinite(value)?Math.round(Math.min(limit,Math.max(-limit,value))*10)/10:0;

function lookOf(look){
  if(!look||typeof look!=='object'||Array.isArray(look))return {};
  return Object.fromEntries(Object.entries(look).filter(([key,value])=>
    /^[a-z][a-zA-Z]{0,24}$/.test(key)&&typeof value==='string'&&/^[a-z0-9-]{1,60}$/.test(value)).slice(0,24));
}

export function pokerRank(cards){
  const type=hand(cards);
  const counts=new Map();
  for(const {r} of cards)counts.set(r,(counts.get(r)||0)+1);
  const groups=[...counts].sort(([a,ac],[b,bc])=>bc-ac||b-a);
  const order=['nothing','pair','twoPair','three','straight','flush','full','four','straightFlush','royal'];
  const kind=type==='jacks'||(type==='nothing'&&groups[0][1]===2)?'pair':type;
  const ranks=groups.map(([r])=>r);
  const straight=kind==='straight'||kind==='straightFlush';
  const tie=straight?[ranks.join()==='14,5,4,3,2'?5:ranks[0]]:ranks;
  return {score:[order.indexOf(kind),...tie],label:kind==='pair'?'Pareja':type==='nothing'?'Carta alta':HANDS[type].name};
}
const compare=(a,b)=>{
  for(let i=0;i<a.length;i++)if(a[i]!==b[i])return a[i]-b[i];
  return 0;
};

function finish(room,table){
  const {hands}=table.round;
  const ranked=hands.map(entry=>({...entry,...pokerRank(entry.cards)})).sort((a,b)=>compare(b.score,a.score));
  const winners=ranked.filter(entry=>compare(entry.score,ranked[0].score)===0);
  const pot=hands.length*ANTE;
  for(const [index,winner] of winners.entries()){
    const prize=Math.floor(pot/winners.length)+(index<pot%winners.length?1:0);
    room.wallets[winner.player].coins+=prize;
    winner.prize=prize;
  }
  table.round={id:table.round.id,result:ranked.map(({player,cards,label,prize=0})=>({player,cards,label,prize}))};
}

function expire(room,time){
  let changed=false;
  for(const [player,entry] of Object.entries(room.presence)){
    if(time-entry.at>PRESENCE){delete room.presence[player];changed=true}
  }
  for(const [id,table] of Object.entries(room.tables)){
    if(table.round?.hands&&time>=table.round.ends){finish(room,table);changed=true}
    if(!table.round?.hands){
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
    id:entry.id,name:entry.name,look:entry.look,x:entry.x,z:entry.z,heading:entry.heading
  }));
  const seats=new Map();
  for(const table of Object.values(room.tables)){
    table.seats.forEach((id,index)=>seats.set(id,index));
  }
  players.forEach((entry,index)=>{entry.seat=seats.get(others[index][0])??null});
  const tables=Object.values(room.tables).filter(table=>!table.round?.hands&&
    table.seats.length<SEATS&&table.seats.every(allowed)&&!table.seats.includes(player))
    .map(table=>({id:table.id,name:room.presence[table.seats[0]]?.name,seats:table.seats.length}));
  const table=seated(room,player);
  const round=table?.round;
  const mine=round?.hands?.find(entry=>entry.player===player);
  const balance=room.wallets[player];
  return {
    players,tables,ante:ANTE,serverTime:time,coins:balance?(balance.day===day?balance.coins:Math.max(100,balance.coins)):START,
    table:table?{
      id:table.id,
      host:table.seats[0]===player,
      seat:seats.get(player),
      seats:table.seats.map(id=>({name:allowed(id)?room.presence[id]?.name||'Desconectado':'Jugador',mine:id===player,ready:table.ready.includes(id)})),
      round:round&&{
        id:round.id,ends:round.ends,waiting:!!mine?.done,cards:mine?.cards,
        results:round.result?.filter(entry=>allowed(entry.player)).map(({player:id,cards,label,prize})=>
          ({name:room.presence[id]?.name||'Jugador',mine:id===player,cards,label,prize}))
      }
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
        // Quien se levanta durante una mano se planta. El premio se abona aunque cierre la pestaña.
        if(table){
          const entry=table.round?.hands?.find(hand=>hand.player===player);
          if(entry)entry.done=true;
          if(table.round?.hands?.every(hand=>hand.done))finish(room,table);
          table.seats=table.seats.filter(id=>id!==player);
          table.ready=[];
          if(!table.seats.length&&!table.round?.hands)delete room.tables[table.id];
          changed=true;
        }
        if(data.action==='exit'&&room.presence[player]){delete room.presence[player];changed=true}
      }else{
        const previous=room.presence[player];
        if(data.action==='pulse'){
          const x=position(data.x,12.3),z=position(data.z,9.3),heading=position(data.heading,Math.PI*2);
          if(!previous||time-previous.at>=4000||time-previous.at>=900&&(previous.x!==x||previous.z!==z||previous.heading!==heading)){
            room.presence[player]={id:previous?.id??randomUUID(),name:profile.name,look:previous?.look??lookOf(data.look),at:time,x,z,heading};
            changed=true;
          }
        }else{
          if(!previous)return fail(409,'Vuelve a entrar al Salón compartido.');
          const busy=Object.values(room.tables).some(other=>other.round?.hands?.some(entry=>entry.player===player));
          if(data.action==='create'||data.action==='join'){
            if(table||busy)return fail(409,'Ya estás jugando en una mesa.');
            if(data.action==='create'){
              table={id:randomUUID(),seats:[player],ready:[],round:null};
              room.tables[table.id]=table;
            }else{
              table=typeof data.id==='string'&&validId.test(data.id)?room.tables[data.id]:null;
              if(!table||!table.seats.length||table.round?.hands||table.seats.length>=SEATS||
                !table.seats.every(id=>friends.has(id)))return fail(404,'Esta mesa ya no está disponible.');
              table.seats.push(player);
              table.ready=[];
              table.round=null;
            }
            changed=true;
          }
          if(data.action==='ready'){
            if(!table||table.round?.hands||(data.previous??null)!==(table.round?.id??null)||typeof data.ready!=='boolean')
              return fail(409,'Espera a la siguiente mano.');
            if(data.ready&&wallet(room,player,day).coins<ANTE)return fail(409,'No tienes fichas para esta mano.');
            table.ready=table.ready.filter(id=>id!==player);
            if(data.ready)table.ready.push(player);
            changed=true;
          }
          if(data.action==='deal'){
            if(!table||data.id!==table.id||table.seats[0]!==player||table.round?.hands||
              (data.previous??null)!==(table.round?.id??null)||table.seats.length<2)
              return fail(409,'Hace falta una mesa con dos o más jugadores para repartir.');
            if(!table.seats.every(id=>table.ready.includes(id)))return fail(409,'Todos deben aceptar la apuesta de esta mano.');
            for(const [index,member] of table.seats.entries()){
              if(!room.presence[member]||wallet(room,member,day).coins<ANTE)
                return fail(409,'Alguien en la mesa está desconectado o no tiene fichas suficientes.');
              if(member!==player){
                const links=await social.friends(scope,member);
                const linked=new Set(links.map(row=>row.first_player===member?row.second_player:row.first_player));
                if(!table.seats.every((id,i)=>i===index||linked.has(id)))return fail(409,'La mesa solo está disponible entre amigos.');
              }
            }
            const pack=deck(()=>randomInt(2**24)/2**24);
            const hands=table.seats.map(member=>{
              room.wallets[member].coins-=ANTE;
              return {player:member,cards:pack.splice(0,5),reserve:pack.splice(0,5),done:false};
            });
            table.ready=[];
            table.round={id:randomUUID(),ends:time+DRAW_TIME,hands};changed=true;
          }
          if(data.action==='draw'){
            if(!table||data.id!==table.round?.id)return fail(409,'Esta mano ya terminó.');
            const entry=table.round.hands?.find(hand=>hand.player===player);
            if(entry&&!entry.done){
              if(!Array.isArray(data.held)||data.held.length!==5||data.held.some(value=>typeof value!=='boolean'))
                return fail(400,'Elige las cartas que quieres guardar.');
              entry.cards=draw(entry.cards,data.held,entry.reserve);
              entry.done=true;
              if(table.round.hands.every(hand=>hand.done))finish(room,table);
              changed=true;
            }
          }
        }
      }
      if(!changed||await store.put({scope,version:(row?.version??0)+1,state:room},row?.version??null))
        return {status:200,body:view(room,player,friends,day,time)};
    }
    return fail(409,'La mesa se está actualizando. Inténtalo de nuevo.');
  };
}

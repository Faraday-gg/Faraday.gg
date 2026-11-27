// Almacén del Lobby público (lib/lobby.mjs). A diferencia del Salón (casino_rooms, una fila JSON por sala que todos
// los latidos se disputan), aquí no hay ninguna fila compartida:
//   · lobby_presence: una fila por jugador. Cada uno solo escribe la suya y lee las de su sala.
//   · lobby_events: el chat de cada sala y las señales dirigidas (retos y amistad). Solo se insertan; «n» es un número
//     creciente común a todo que sirve de cursor.
// Turnos (`slot`): los límites de envío no se pueden comprobar leyendo y después insertando, porque varias peticiones
// a la vez leerían lo mismo. Por eso los mensajes de chat de una sala y las invitaciones de un jugador van en cadena:
// cada fila dice detrás de cuál va («c:<sala>:<n del último mensaje de la sala>», «i:<jugador>:<n de su última
// invitación>») y un índice único impide que dos ocupen el mismo turno. Quien llega segundo recibe null de addEvent,
// vuelve a leer (ahora sí ve la fila que se le adelantó) y decide de nuevo. Así cada fila aceptada ha visto todas las
// anteriores de su cadena y los límites son exactos aunque las peticiones lleguen en paralelo.
// Las fechas son textos ISO (como en social-store.mjs) y siempre se comparan con Date.parse, porque Supabase las
// devuelve con otro formato (+00:00 y microsegundos).
// Los dos almacenes exponen lo mismo:
//   presence(scope,player)            -> la fila del jugador (aunque haya caducado) o null
//   byId(scope,id)                    -> la fila con ese identificador público o null
//   room(scope,room,since)            -> filas de esa sala con señal posterior a `since`, por orden de llegada
//   rooms(scope,since,except)         -> número de sala de cada jugador presente (menos `except`), para repartir
//   enter(row)                        -> crea o sustituye la fila del jugador
//   touch(scope,player,patch)         -> cambia columnas de la fila del jugador
//   addEvent(row)                     -> guarda un evento y lo devuelve con su «n»; null si su turno (`slot`) ya está ocupado
//   chat(scope,{room,since,after,limit})      -> chat de la sala con n > since y posterior a `after`: los `limit` últimos, por orden
//   signals(scope,{player,since,after,limit}) -> señales para `player` con n > since y posteriores a `after`, igual
//   chatTail(scope,room)              -> los últimos 30 mensajes de la sala, por orden y sin límite de fecha (n, from_hash, created_at)
//   sent(scope,player)                -> las últimas 30 invitaciones (retos y peticiones de amistad) del jugador, igual (n, kind, to_hash, created_at)
//   find(scope,{kind,from,fromId,to,after}) -> el último evento de ese tipo entre dos jugadores, o null
//   purge(scope,presenceBefore,eventsBefore) -> borra lo caducado
import fs from 'node:fs';
import path from 'node:path';

const copy=value=>structuredClone(value??null);
const later=(value,limit)=>Date.parse(value)>Date.parse(limit);
const arrival=(a,b)=>Date.parse(a.joined_at)-Date.parse(b.joined_at)||(a.id<b.id?-1:1);
const BRIEF=({n,kind,to_hash,created_at})=>({n,kind,to_hash,created_at});
const TAIL=30,INVITES=['reto','amistad'];

// Memoria (pruebas) o archivo JSON local: una sola instancia del servidor.
export function fileLobby(file=null){
  let data={presence:{},events:[],seq:0};
  if(file){try{data={...data,...JSON.parse(fs.readFileSync(file,'utf8'))}}catch(error){if(error.code!=='ENOENT')throw error}}
  const key=(scope,player)=>scope+':'+player;
  function save(){
    if(!file)return;
    fs.mkdirSync(path.dirname(file),{recursive:true});
    fs.writeFileSync(file+'.tmp',JSON.stringify(data));
    fs.renameSync(file+'.tmp',file);
  }
  const live=(scope,since)=>Object.values(data.presence).filter(row=>row.scope===scope&&later(row.seen_at,since));
  return {
    async presence(scope,player){return copy(data.presence[key(scope,player)])},
    async byId(scope,id){return copy(Object.values(data.presence).find(row=>row.scope===scope&&row.id===id))},
    async room(scope,room,since){return copy(live(scope,since).filter(row=>row.room===room).sort(arrival))},
    async rooms(scope,since,except){return live(scope,since).filter(row=>row.player_hash!==except).map(row=>row.room)},
    async enter(row){data.presence[key(row.scope,row.player_hash)]=copy(row);save()},
    async touch(scope,player,patch){
      const id=key(scope,player);
      if(!data.presence[id])return;
      data.presence[id]={...data.presence[id],...copy(patch)};save();
    },
    async addEvent(row){
      // Como el índice único de la base de datos: dos filas del mismo entorno no pueden ocupar el mismo turno.
      if(row.slot!=null&&data.events.some(event=>event.scope===row.scope&&event.slot===row.slot))return null;
      const event={...copy(row),n:++data.seq};
      data.events.push(event);save();
      return copy(event);
    },
    async chat(scope,{room,since=0,after,limit=40}){
      return copy(data.events.filter(event=>event.scope===scope&&event.to_hash===null&&event.room===room&&event.n>since&&later(event.created_at,after)).slice(-limit));
    },
    async signals(scope,{player,since=0,after,limit=200}){
      return copy(data.events.filter(event=>event.scope===scope&&event.to_hash===player&&event.n>since&&later(event.created_at,after)).slice(-limit));
    },
    async chatTail(scope,room){
      return data.events.filter(event=>event.scope===scope&&event.to_hash===null&&event.room===room).slice(-TAIL).map(({n,from_hash,created_at})=>({n,from_hash,created_at}));
    },
    async sent(scope,player){
      return data.events.filter(event=>event.scope===scope&&event.from_hash===player&&INVITES.includes(event.kind)).slice(-TAIL).map(BRIEF);
    },
    async find(scope,{kind,from,fromId,to,after}){
      return copy(data.events.findLast(event=>event.scope===scope&&event.kind===kind&&event.to_hash===to&&later(event.created_at,after)&&
        (from===undefined||event.from_hash===from)&&(fromId===undefined||event.from_id===fromId)));
    },
    async purge(scope,presenceBefore,eventsBefore){
      const presence=Object.entries(data.presence).filter(([,row])=>row.scope!==scope||!later(presenceBefore,row.seen_at));
      const events=data.events.filter(event=>event.scope!==scope||!later(eventsBefore,event.created_at));
      if(presence.length===Object.keys(data.presence).length&&events.length===data.events.length)return;
      data={...data,presence:Object.fromEntries(presence),events};save();
    }
  };
}

// Supabase por REST (PostgREST), con el `call` y el `endpoint` de lib/stores.mjs. Tablas: migración 20261126120000_lobby.
// Si las tablas no existen, cada llamada falla y /api/lobby responde 503 sin afectar al resto.
export function supabaseLobby({call,endpoint,pageSize=1000}){
  const url=(table,params={})=>endpoint(table)+'?'+new URLSearchParams(params);
  const get=async(table,params)=>(await call(url(table,params))).json();
  const json={'Content-Type':'application/json'};
  const presence='lobby_presence',events='lobby_events';
  const own=(scope,player)=>({scope:'eq.'+scope,player_hash:'eq.'+player});
  return {
    async presence(scope,player){return (await get(presence,{...own(scope,player),limit:'1'}))[0]??null},
    async byId(scope,id){return (await get(presence,{scope:'eq.'+scope,id:'eq.'+id,limit:'1'}))[0]??null},
    room:(scope,room,since)=>get(presence,{scope:'eq.'+scope,room:'eq.'+room,seen_at:'gt.'+since,order:'joined_at.asc,id.asc',limit:'200'}),
    async rooms(scope,since,except){
      const rooms=[];
      for(let offset=0;;offset+=pageSize){
        const page=await get(presence,{scope:'eq.'+scope,seen_at:'gt.'+since,player_hash:'neq.'+except,select:'room',order:'player_hash.asc',offset:String(offset),limit:String(pageSize)});
        rooms.push(...page.map(row=>row.room));
        if(page.length<pageSize)return rooms;
      }
    },
    async enter(row){
      await call(url(presence,{on_conflict:'scope,player_hash'}),{method:'POST',headers:{...json,Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify(row)});
    },
    async touch(scope,player,patch){
      await call(url(presence,own(scope,player)),{method:'PATCH',headers:{...json,Prefer:'return=minimal'},body:JSON.stringify(patch)});
    },
    async addEvent(row){
      let response;
      try{response=await call(url(events),{method:'POST',headers:{...json,Prefer:'return=representation'},body:JSON.stringify(row)})}
      catch(error){
        // Turno ocupado: el índice único lobby_events_slot_idx rechaza la fila y PostgREST responde 409 con el código
        // 23505 de Postgres (lib/stores.mjs lo convierte en un error con ese texto). Cualquier otro fallo sigue su camino.
        const text=String(error?.message||'');
        if(row.slot!=null&&/\b409\b/.test(text)&&text.includes('23505'))return null;
        throw error;
      }
      return (await response.json())[0];
    },
    // El chat y las señales van en consultas separadas, cada una con su ventana y su tope: así una sala con mucho chat
    // no deja fuera una señal dirigida al jugador. Llegan las más recientes y se devuelven en orden.
    async chat(scope,{room,since=0,after,limit=40}){
      return (await get(events,{scope:'eq.'+scope,room:'eq.'+room,to_hash:'is.null',n:'gt.'+since,created_at:'gt.'+after,order:'n.desc',limit:String(limit)})).reverse();
    },
    async signals(scope,{player,since=0,after,limit=200}){
      return (await get(events,{scope:'eq.'+scope,to_hash:'eq.'+player,n:'gt.'+since,created_at:'gt.'+after,order:'n.desc',limit:String(limit)})).reverse();
    },
    async chatTail(scope,room){
      return (await get(events,{scope:'eq.'+scope,room:'eq.'+room,to_hash:'is.null',select:'n,from_hash,created_at',order:'n.desc',limit:String(TAIL)})).reverse();
    },
    async sent(scope,player){
      return (await get(events,{scope:'eq.'+scope,from_hash:'eq.'+player,kind:`in.(${INVITES.join(',')})`,select:'n,kind,to_hash,created_at',order:'n.desc',limit:String(TAIL)})).reverse();
    },
    async find(scope,{kind,from,fromId,to,after}){
      const query={scope:'eq.'+scope,kind:'eq.'+kind,to_hash:'eq.'+to,created_at:'gt.'+after,order:'n.desc',limit:'1'};
      if(from!==undefined)query.from_hash='eq.'+from;
      if(fromId!==undefined)query.from_id='eq.'+fromId;
      return (await get(events,query))[0]??null;
    },
    async purge(scope,presenceBefore,eventsBefore){
      const remove=(table,column,before)=>call(url(table,{scope:'eq.'+scope,[column]:'lt.'+before}),{method:'DELETE',headers:{Prefer:'return=minimal'}});
      await Promise.all([remove(presence,'seen_at',presenceBefore),remove(events,'created_at',eventsBefore)]);
    }
  };
}

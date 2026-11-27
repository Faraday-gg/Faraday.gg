// Lobby público (lib/lobby.mjs, POST /api/lobby). El mismo recorrido se hace dos veces: con el almacén de archivo y
// con el de Supabase contra un PostgREST simulado en memoria que toma las columnas de la migración y repite sus
// comprobaciones (también el índice único de los turnos). Después, con los dos almacenes y con latencia, los límites
// de envío con peticiones en paralelo. No usa red ni credenciales.
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createApi} from '../lib/api.mjs';
import {supabaseStore} from '../lib/stores.mjs';
import {fileLobby} from '../lib/lobby-store.mjs';
import {fileSocial} from '../lib/social-store.mjs';
import {createLobby,filterWords,lobbyName,lobbyText,LOBBY,LOBBY_CHAT,LOBBY_GAMES,LOBBY_PLACES,LOBBY_SIGNALS} from '../lib/lobby.mjs';

const dir=mkdtempSync(join(tmpdir(),'faraday-lobby-'));
const SITE='https://faraday.test',UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const hash=player=>createHash('sha256').update(player).digest('hex');
const iso=time=>new Date(time).toISOString();
let clock=0;

// Cuentas (sesión simulada con la cookie test-user) e invitados (cookie faraday_jugador con su identificador anónimo).
const accounts=Object.fromEntries(['Ana','Beto','Clara','Dani'].map(name=>[name,{player:randomUUID()}]));
const auth={async current(request,readCookie){
  const account=accounts[readCookie(request,'test-user')];
  return account?{account,cookies:['test-renewed=1; HttpOnly']}:null;
}};
const guests=new Map();
const uuidOf=name=>accounts[name]?.player??(guests.get(name)??guests.set(name,randomUUID()).get(name));
const cookieOf=name=>accounts[name]?'test-user='+name:'faraday_jugador='+uuidOf(name);

// Cuenta las llamadas a cada operación del almacén, para comprobar que la presencia no se escribe en cada pulso.
function counted(store){
  const counts={};
  return [Object.fromEntries(Object.keys(store).map(name=>[name,(...args)=>{counts[name]=(counts[name]||0)+1;return store[name](...args)}])),counts];
}

// PostgREST mínimo para lobby_presence y lobby_events: filtros eq, neq, gt, lt, in, is.null y not.is.null, árbol or/and,
// orden, limit y offset, inserción con fusión de duplicados, PATCH y DELETE. Las columnas salen de la migración.
// Como la base de datos, rechaza con 409 (código 23505) una fila cuyo turno (`slot`) ya está ocupado en su entorno.
function fakeRest(){
  const sql=readFileSync('supabase/migrations/20261126120000_lobby.sql','utf8').replaceAll('\r\n','\n');
  const columnsOf=name=>sql.match(new RegExp(`table public\\.${name} \\(\\n([\\s\\S]*?)\\n\\)`))[1].split('\n')
    .map(line=>line.trim().match(/^([a-z_]+) (?:text|uuid|integer|bigint|jsonb|double precision|boolean|timestamptz)\b/)?.[1]).filter(Boolean);
  const tables={lobby_presence:{rows:[],columns:columnsOf('lobby_presence')},lobby_events:{rows:[],columns:columnsOf('lobby_events')}};
  assert.equal(tables.lobby_presence.columns.length,15);assert.equal(tables.lobby_events.columns.length,14);
  assert.match(sql,/create unique index lobby_events_slot_idx on public\.lobby_events \(scope, slot\) where slot is not null;/);
  const SLOT=new RegExp(sql.match(/slot text check \(slot is null or slot ~ '([^']+)'\)/)[1]);
  const TIMES=new Set(['seen_at','joined_at','created_at']),HASH=/^[a-f0-9]{64}$/,calls=[];
  const scopes=['publico','preview'],object=value=>!!value&&typeof value==='object'&&!Array.isArray(value);
  const conflicts={count:0};
  let seq=0;
  // Las mismas comprobaciones que la migración: si el servidor manda algo que Postgres rechazaría, aquí también falla.
  function violation(name,row){
    if(Object.keys(row).some(key=>!tables[name].columns.includes(key)))return 'columna desconocida';
    const time=value=>typeof value==='string'&&Number.isFinite(Date.parse(value));
    if(name==='lobby_presence')return !(scopes.includes(row.scope)&&HASH.test(row.player_hash)&&UUID.test(row.id)&&Number.isInteger(row.room)&&row.room>=1&&
      typeof row.name==='string'&&Array.from(row.name).length>=1&&Array.from(row.name).length<=24&&object(row.look)&&Number.isInteger(row.level)&&row.level>=1&&row.level<=999&&
      Math.abs(row.x)<=1000&&Math.abs(row.z)<=1000&&Math.abs(row.heading)<=7&&(row.act===null||object(row.act))&&LOBBY_PLACES.includes(row.place)&&
      typeof row.account==='boolean'&&time(row.joined_at)&&time(row.seen_at))&&'lobby_presence check';
    const chat=row.kind==='chat',reto=row.kind==='reto';
    return !(scopes.includes(row.scope)&&Number.isInteger(row.room)&&row.room>=1&&['chat','reto','reto-no','amistad','amistad-ok'].includes(row.kind)&&HASH.test(row.from_hash)&&
      UUID.test(row.from_id)&&typeof row.from_name==='string'&&Array.from(row.from_name).length>=1&&Array.from(row.from_name).length<=24&&(row.from_look===null||object(row.from_look))&&
      (row.to_hash===null||HASH.test(row.to_hash))&&(row.body===null||typeof row.body==='string'&&row.body.isWellFormed()&&Array.from(row.body).length>=1&&Array.from(row.body).length<=140)&&
      (row.game===null||LOBBY_GAMES.includes(row.game))&&(row.code===null||/^[A-Z2-9]{6}$/.test(row.code))&&time(row.created_at)&&
      (row.slot===null||typeof row.slot==='string'&&SLOT.test(row.slot))&&
      chat===(row.to_hash===null)&&chat===(row.body!==null)&&reto===(row.code!==null)&&reto===(row.game!==null))&&'lobby_events check';
  }
  function matcher(name,params){
    const known=column=>{assert.ok(tables[name].columns.includes(column),`${name}: columna desconocida «${column}»`);return column};
    const test=(row,column,expr)=>{
      known(column);
      if(expr==='is.null')return row[column]===null;
      if(expr==='not.is.null')return row[column]!==null;
      const list=expr.match(/^in\.\((.+)\)$/s);
      if(list)return list[1].split(',').includes(row[column]);
      const [,op,raw]=expr.match(/^(eq|neq|gt|lt)\.(.*)$/s)||assert.fail('filtro no admitido: '+expr);
      const left=TIMES.has(column)?Date.parse(row[column]):row[column],right=TIMES.has(column)?Date.parse(raw):typeof left==='number'?Number(raw):raw;
      assert.ok(!Number.isNaN(right),'valor no válido en '+column);
      return op==='eq'?left===right:op==='neq'?left!==right:op==='gt'?left>right:left<right;
    };
    const split=inner=>{const parts=[];let depth=0,start=0;for(let i=0;i<inner.length;i++){if(inner[i]==='(')depth++;if(inner[i]===')')depth--;if(inner[i]===','&&!depth){parts.push(inner.slice(start,i));start=i+1}}return [...parts,inner.slice(start)]};
    const term=text=>{
      const group=text.match(/^(and|or)\((.*)\)$/s);
      if(group){const parts=split(group[2]).map(term);return row=>group[1]==='and'?parts.every(part=>part(row)):parts.some(part=>part(row))}
      const dot=text.indexOf('.');return row=>test(row,text.slice(0,dot),text.slice(dot+1));
    };
    const filters=[...params].filter(([key])=>!['select','order','limit','offset','on_conflict'].includes(key))
      .map(([key,value])=>key==='or'?term('or'+value):row=>test(row,key,value));
    return row=>filters.every(filter=>filter(row));
  }
  // Como PostgREST: fechas con +00:00 y jsonb con las claves en otro orden que el enviado.
  const shown=row=>Object.fromEntries(Object.entries(row).map(([key,value])=>[key,TIMES.has(key)?value.replace('Z','+00:00'):object(value)?Object.fromEntries(Object.entries(value).reverse()):value]));
  async function fetch(input,init={}){
    const url=new URL(input),method=init.method||'GET',headers=new Headers(init.headers),params=url.searchParams;
    calls.push({method,url});
    if(headers.get('apikey')!=='clave')return new Response('{"message":"Invalid API key"}',{status:401});
    const name=url.pathname.match(/^\/rest\/v1\/([a-z_]+)$/)?.[1],table=tables[name];
    if(!table)return new Response('{"code":"PGRST205","message":"Could not find the table"}',{status:404});
    const prefer=headers.get('prefer')||'',match=matcher(name,params);
    if(method==='POST'){
      const row=JSON.parse(init.body);
      if(name==='lobby_events'){
        assert.ok(!('n' in row),'n lo pone la base de datos');
        const error=violation(name,row);if(error)return Response.json({code:'23514',message:error},{status:400});
        // El servidor manda siempre el turno que toca: el chat, el de su sala; las invitaciones, el de quien invita.
        assert.match(String(row.slot),row.kind==='chat'?new RegExp(`^c:${row.room}:\\d+$`):['reto','amistad'].includes(row.kind)?new RegExp(`^i:${row.from_hash}:\\d+$`):/^null$/,'turno de '+row.kind);
        if(row.slot!==null){
          const previous=Number(row.slot.split(':').pop());
          assert.ok(previous<=seq,'el turno va detrás de una fila que ya existe');
          if(table.rows.some(other=>other.scope===row.scope&&other.slot===row.slot)){
            conflicts.count++;
            return Response.json({code:'23505',details:`Key (scope, slot)=(${row.scope}, ${row.slot}) already exists.`,hint:null,message:'duplicate key value violates unique constraint "lobby_events_slot_idx"'},{status:409});
          }
        }
        const saved={...row,n:++seq};table.rows.push(saved);
        return /return=representation/.test(prefer)?Response.json([shown(saved)],{status:201}):new Response(null,{status:201});
      }
      assert.equal(params.get('on_conflict'),'scope,player_hash');assert.match(prefer,/resolution=merge-duplicates/);
      const error=violation(name,row);if(error)return Response.json({code:'23514',message:error},{status:400});
      const index=table.rows.findIndex(other=>other.scope===row.scope&&other.player_hash===row.player_hash);
      if(index<0)table.rows.push(row);else table.rows[index]={...table.rows[index],...row};
      return new Response(null,{status:201});
    }
    if(method==='PATCH'){
      const patch=JSON.parse(init.body);
      for(const [index,row] of table.rows.entries())if(match(row)){
        const next={...row,...patch},error=violation(name,next);if(error)return Response.json({code:'23514',message:error},{status:400});
        table.rows[index]=next;
      }
      return new Response(null,{status:204});
    }
    if(method==='DELETE'){
      assert.ok([...params.keys()].length>=2,'un DELETE sin filtros borraría la tabla');
      table.rows=table.rows.filter(row=>!match(row));
      return new Response(null,{status:204});
    }
    let rows=table.rows.filter(match);
    const order=(params.get('order')||'').split(',').filter(Boolean).map(part=>part.split('.'));
    rows.sort((a,b)=>{for(const [column,way] of order){const left=TIMES.has(column)?Date.parse(a[column]):a[column],right=TIMES.has(column)?Date.parse(b[column]):b[column];if(left!==right)return (left<right?-1:1)*(way==='desc'?-1:1)}return 0});
    const offset=Number(params.get('offset')||0),limit=Math.min(Number(params.get('limit')||1000),1000);
    rows=rows.slice(offset,offset+limit).map(shown);
    const select=params.get('select');
    if(select)rows=rows.map(row=>Object.fromEntries(select.split(',').map(column=>{assert.ok(table.columns.includes(column),'select de columna desconocida '+column);return [column,row[column]]})));
    return Response.json(rows);
  }
  return {fetch,tables,calls,conflicts};
}

// El recorrido completo por HTTP. makeLobby() devuelve un almacén nuevo sobre los mismos datos (como otra instancia).
async function scenario(label,makeLobby,rest=null){
  clock=Date.parse('2026-11-26T12:00:00Z');
  const socialFile=join(dir,label+'-social.json');
  let counts;
  const makeApi=(scope='preview')=>{
    const [lobby,tally]=counted(makeLobby());counts=tally;
    return createApi({store:{social:fileSocial(socialFile),lobby},auth,trendScope:scope,now:()=>clock,log:()=>{}});
  };
  let api=makeApi();
  async function call(name,action,extra={},{origin=SITE,route='lobby',from=api}={}){
    const headers={origin};if(name)headers.cookie=cookieOf(name);
    const response=await from.handle(new Request(SITE+'/api/'+route,{method:'POST',headers,body:JSON.stringify({action,...extra})}));
    return {status:response.status,data:await response.json(),cookies:response.headers.getSetCookie()};
  }
  async function expect(status,...args){
    const result=await call(...args);
    assert.equal(result.status,status,label+': '+JSON.stringify(result.data).slice(0,300));
    return result.data;
  }
  const ids={},present=[];
  async function pulse(name,extra){
    const view=await expect(200,name,'pulso',extra);
    ids[name]=view.you.id;if(!present.includes(name))present.push(name);
    return view;
  }
  // Pasa el tiempo sin que nadie caduque: todos (o los indicados) siguen mandando pulsos.
  async function wait(ms,names=present){
    for(let left=ms;left>0;left-=8000){clock+=Math.min(left,8000);for(const name of names)await pulse(name)}
  }
  const peer=(view,name)=>view.players.find(player=>player.id===ids[name]);

  // Identidad, origen y acciones.
  assert.equal((await call(null,'pulso')).status,401,'sin cuenta ni cookie no hay lobby');
  assert.equal((await api.handle(new Request(SITE+'/api/lobby',{method:'POST',headers:{origin:SITE,cookie:'faraday_jugador=no-vale'},body:'{"action":"pulso"}'}))).status,401);
  await expect(403,'g1','pulso',{},{origin:'https://otro.test'});
  assert.equal((await api.handle(new Request(SITE+'/api/lobby',{headers:{cookie:cookieOf('g1')}}))).status,405);
  assert.equal((await api.handle(new Request(SITE+'/api/lobby',{method:'POST',headers:{origin:SITE,cookie:cookieOf('g1')},body:JSON.stringify({action:'pulso',name:'x'.repeat(5000)})}))).status,413);
  await expect(400,'g1','bailar');
  await expect(409,'g1','chat',{text:'hola'});
  await expect(409,'g1','retar',{to:randomUUID(),code:'ABCDEF'});
  assert.deepEqual(await expect(200,'g1','salir'),{ok:true});
  assert.deepEqual((await call('Ana','salir')).cookies,['test-renewed=1; HttpOnly'],'se renuevan las cookies de la sesión');

  // Reparto: 20 por lobby; el 21 abre el segundo.
  const first=[];
  for(let i=1;i<=21;i++){clock+=10;first.push(await pulse('g'+i,{x:1,z:2,heading:0.5,name:'Jugador '+i,look:{top:'camiseta-roja'},level:3}))}
  assert.deepEqual(first.map(view=>view.room.n),[...Array(20).fill(1),2]);
  assert.deepEqual(first.map(view=>view.room.count),[...Array.from({length:20},(_,i)=>i+1),1]);
  let seen=await pulse('g1');
  assert.deepEqual(Object.keys(seen).sort(),['chat','cursor','players','room','serverTime','signals','you']);
  assert.deepEqual(seen.room,{n:1,count:20,cap:20});
  assert.deepEqual(seen.you,{id:ids.g1,account:false,social:false});
  assert.match(seen.you.id,UUID);
  assert.equal(seen.players.length,19);
  assert.ok(!seen.players.some(player=>player.id===seen.you.id),'la vista no me incluye');
  assert.deepEqual(seen.players[0],{id:ids.g2,name:'Jugador 2',look:{top:'camiseta-roja'},level:3,x:1,z:2,heading:0.5,act:null,where:'lobby',friend:false,account:false});
  assert.deepEqual([seen.chat,seen.signals,seen.cursor,seen.serverTime],[[],[],0,clock]);
  for(const player of guests.values())assert.ok(!JSON.stringify(seen).includes(player)&&!JSON.stringify(seen).includes(hash(player)),'ni el identificador ni su hash salen del servidor');
  assert.deepEqual((await pulse('g21')).players,[]);

  // Hueco: al irse uno del lobby 1, el siguiente que llega lo ocupa; quien ya estaba en el 2 se queda en el 2.
  assert.deepEqual(await expect(200,'g5','salir'),{ok:true});
  present.splice(present.indexOf('g5'),1);
  assert.equal((await pulse('g1')).room.count,19);
  assert.deepEqual((await pulse('g22',{name:'Jugador 22'})).room,{n:1,count:20,cap:20});
  assert.deepEqual((await pulse('g21')).room,{n:2,count:1,cap:20});
  assert.deepEqual((await pulse('g23',{name:'Jugador 23'})).room,{n:2,count:2,cap:20});
  const back=await pulse('g5');
  assert.equal(back.room.n,2,'el lobby 1 vuelve a estar lleno');assert.equal(back.you.id,first[4].you.id,'quien vuelve enseguida conserva su identificador público');

  // Caducidad: a los 15 segundos sin pulso (más los 4 que puede tardar en escribirse una señal de vida). Quien vuelve
  // después entra como uno más, al lobby más bajo con hueco.
  present.splice(present.indexOf('g3'),1);
  await wait(14000);
  assert.ok(peer(await pulse('g1'),'g3'),'a los 14 s sigue presente');
  await wait(6000);
  seen=await pulse('g1');
  assert.equal(seen.room.count,19);assert.ok(!peer(seen,'g3'));
  const again=await pulse('g3');
  assert.deepEqual(again.room,{n:1,count:20,cap:20});assert.equal(again.you.id,first[2].you.id);

  // Saneado de lo que manda el navegador.
  clock+=1000;
  await pulse('g2',{x:700,z:-99,heading:9,name:'  Ma‮ld\u0007ito   nombre larguísimo de más de veinticuatro  ',level:5000,where:'luna',
    look:{top:'camiseta-amarilla',_raw:{hair:'bad'},Bad:'x',hat:'<script>'},act:{name:'<script>',n:1}});
  let g2=peer(await pulse('g1'),'g2');
  assert.deepEqual([g2.x,g2.z,g2.heading],[LOBBY.w/2,-LOBBY.d/2,6.28]);
  assert.equal(g2.name,'Ma ld ito nombre larguís');assert.equal(Array.from(g2.name).length,24);
  assert.deepEqual([g2.look,g2.level,g2.where,g2.act],[{top:'camiseta-amarilla'},999,'lobby',null]);
  clock+=1000;
  await pulse('g2',{name:'Gilipollas 99',where:'duel',act:{name:'saludo',n:1}});
  g2=peer(await pulse('g1'),'g2');
  assert.deepEqual([g2.name,g2.where,g2.act],['********** 99','duel',{name:'saludo',n:1}]);
  clock+=1000;
  await pulse('g2',{});
  g2=peer(await pulse('g1'),'g2');
  assert.deepEqual([g2.x,g2.z,g2.name,g2.level,g2.look,g2.act],[15,-11,'********** 99',999,{top:'camiseta-amarilla'},{name:'saludo',n:1}],'lo que no llega se queda como estaba');

  // Escrituras mínimas: la fila solo se escribe si ha cambiado algo o han pasado 4 segundos.
  await wait(1000);
  const still={x:2,z:1,heading:1,name:'Jugador 2',where:'lobby',look:{top:'a',hat:'b'}};
  clock+=5000;await pulse('g2',{...still,x:1});
  let writes=counts.touch;
  const wrote=async(ms,extra,expected,why)=>{clock+=ms;await pulse('g2',{...still,...extra});assert.equal(counts.touch-writes,expected,label+': '+why);writes=counts.touch};
  await wrote(500,{},0,'un movimiento a los 0,5 s espera');
  await wrote(500,{},1,'a los 0,9 s el movimiento se escribe');
  await wrote(1000,{},0,'quieto no escribe');
  await wrote(1000,{},0,'quieto no escribe (el aspecto es el mismo aunque el JSON venga en otro orden)');
  await wrote(2100,{},1,'a los 4 s se da señal de vida');
  await wrote(200,{act:{name:'jump',n:2}},0,'un gesto antes de 0,3 s espera');
  await wrote(200,{act:{name:'jump',n:2}},1,'un gesto nuevo se escribe enseguida');
  await wrote(300,{act:{name:'jump',n:2},where:'daily'},1,'cambiar de sitio se escribe enseguida');
  await wrote(300,{act:{name:'jump',n:2},where:'daily'},0,'sin cambios no escribe');
  await wait(1000);
  if(rest){
    const before=rest.calls.length;clock+=1000;await pulse('g4');
    assert.deepEqual(rest.calls.slice(before).map(entry=>entry.method+' '+entry.url.pathname.split('/').pop()),['GET lobby_presence','GET lobby_presence','GET lobby_events','GET lobby_events'],'un pulso quieto de un invitado son cuatro lecturas y ninguna escritura');
    // El chat de la sala y las señales del jugador van en consultas separadas, cada una con su tope.
    const [talk,calls]=rest.calls.slice(-2).map(entry=>Object.fromEntries(entry.url.searchParams));
    assert.deepEqual([talk.room,talk.to_hash,talk.limit,talk.order],['eq.1','is.null',String(LOBBY_CHAT.keep),'n.desc']);
    assert.match(calls.to_hash,/^eq\.[a-f0-9]{64}$/);assert.deepEqual([calls.room,calls.limit,calls.order],[undefined,String(LOBBY_SIGNALS.batch),'n.desc']);
    assert.equal(Date.parse(talk.created_at.slice(3)),clock-LOBBY_CHAT.shown);assert.equal(Date.parse(calls.created_at.slice(3)),clock-LOBBY_SIGNALS.friendMs);
  }

  // Chat del lobby: saneado, filtro de palabras, límites y cursor.
  await expect(400,'g1','chat',{text:'  ‮  '});
  await expect(400,'g1','chat',{text:42});
  clock+=1000;
  const before=(await pulse('g1')).cursor;
  const said=await expect(200,'g1','chat',{text:'  Hola‮ a\ttodos, sois unos GILIPOLLAS  ',since:before});
  assert.deepEqual(said.chat,[{n:said.cursor,id:ids.g1,name:'Jugador 1',text:'Hola a todos, sois unos **********',mine:true,at:clock}]);
  assert.ok(said.cursor>before);assert.equal(said.room.n,1);
  const heard=await pulse('g2',still);
  assert.deepEqual(heard.chat,[{...said.chat[0],mine:false}]);assert.equal(heard.cursor,said.cursor);
  assert.deepEqual((await pulse('g2',{...still,since:heard.cursor})).chat,[],'con el cursor no se repite');
  assert.deepEqual((await pulse('g21')).chat,[],'el chat es de cada lobby');
  clock+=1000;
  assert.equal((await expect(200,'g2','chat',{text:'x'.repeat(300)})).chat.at(-1).text.length,LOBBY_CHAT.maxText);
  await expect(429,'g2','chat',{text:'otra vez'});
  for(let i=0;i<5;i++){clock+=500;await expect(200,'g2','chat',{text:'mensaje '+i})}
  clock+=500;
  await expect(429,'g2','chat',{text:'el séptimo'});
  const news=await pulse('g1',{since:said.cursor});
  assert.equal(news.chat.length,6);assert.ok(news.chat.every(message=>!message.mine&&message.n>said.cursor&&message.id===ids.g2));
  assert.equal(news.cursor,news.chat.at(-1).n);assert.deepEqual(news.chat.map(message=>message.n),[...news.chat.map(message=>message.n)].sort((a,b)=>a-b));
  clock+=1000;
  assert.equal((await expect(200,'g1','chat',{text:'a'.repeat(139)+'😀',since:news.cursor})).chat.at(-1).text,'a'.repeat(139),'medio emoji no se guarda');
  await wait(LOBBY_CHAT.shown+1000);
  assert.deepEqual((await pulse('g2',still)).chat,[],'pasados dos minutos los mensajes dejan de enviarse');

  // Retos: señal dirigida a un jugador de mi lobby, una cada 15 s por destinatario.
  const cursor=name=>pulse(name).then(view=>view.cursor);
  let mark=await cursor('g2');
  await expect(400,'g1','retar',{to:ids.g2,game:'parchis',code:'ABCDEF'});
  await expect(400,'g1','retar',{to:ids.g2,game:'traza',code:'abc'});
  await expect(400,'g1','retar',{to:ids.g2,game:'traza'});
  await expect(400,'g1','retar',{to:ids.g1,game:'traza',code:'ABCDEF'});
  await expect(404,'g1','retar',{to:ids.g21,code:'ABCDEF'});
  await expect(404,'g1','retar',{to:randomUUID(),code:'ABCDEF'});
  await expect(404,'g1','retar',{to:'no-vale',code:'ABCDEF'});
  assert.deepEqual(await expect(200,'g1','retar',{to:ids.g2,game:'traza',code:'abcdef'}),{ok:true});
  let got=await pulse('g2',{since:mark});
  assert.deepEqual(got.signals,[{n:got.cursor,kind:'reto',from:{id:ids.g1,name:'Jugador 1',look:{top:'camiseta-roja'}},game:'traza',code:'ABCDEF',at:clock}]);
  assert.deepEqual((await pulse('g1')).signals,[]);assert.deepEqual((await pulse('g4')).signals,[],'la señal solo llega a su destinatario');
  assert.deepEqual((await pulse('g2',{since:got.cursor})).signals,[]);
  await expect(429,'g1','retar',{to:ids.g2,code:'ABCDEF'});
  await wait(LOBBY_SIGNALS.retoGapMs+1);
  assert.deepEqual(await expect(200,'g1','retar',{to:ids.g2.toUpperCase(),code:'ABCDEF'}),{ok:true});
  got=await pulse('g2',{since:got.cursor});
  assert.equal(got.signals.at(-1).game,'estimacion','sin juego, el duelo de siempre');
  await expect(404,'g4','rechazar-reto',{to:ids.g1});
  await expect(404,'g2','rechazar-reto',{to:'no-vale'});
  mark=await cursor('g1');
  assert.deepEqual(await expect(200,'g2','rechazar-reto',{to:ids.g1}),{ok:true});
  assert.deepEqual(await expect(200,'g2','rechazar-reto',{to:ids.g1}),{ok:true});
  const declined=(await pulse('g1',{since:mark})).signals;
  assert.deepEqual(declined.map(signal=>[signal.kind,signal.from.id,signal.from.name]),[['reto-no',ids.g2,'Jugador 2']],'rechazar dos veces avisa una');
  assert.deepEqual(Object.keys(declined[0]).sort(),['at','from','kind','n']);
  for(const name of ['g4','g6','g7','g8','g9','g10','g11','g12'])await expect(200,'g3','retar',{to:ids[name],code:'ABCDEF'});
  assert.equal((await expect(429,'g3','retar',{to:ids.g13,code:'ABCDEF'})).error,'Has enviado demasiadas invitaciones. Espera un momento.');

  // Amistad: los dos con cuenta. Al aceptarla se crea en el almacén social (y el perfil de quien no lo tuviera).
  for(const name of Object.keys(accounts)){
    const view=await pulse(name,{name,look:{top:'jersey-'+name.toLowerCase()}});
    assert.equal(view.room.n,2);assert.deepEqual(view.you,{id:ids[name],account:true,social:false});
  }
  assert.deepEqual([peer(await pulse('g21'),'Ana').account,peer(await pulse('Ana'),'g21').account,peer(await pulse('Ana'),'Beto').friend],[true,false,false]);
  await expect(401,'g21','amistad',{to:ids.Ana});
  assert.match((await expect(409,'Ana','amistad',{to:ids.g21})).error,/sin cuenta/);
  await expect(404,'Ana','amistad',{to:ids.g1});
  await expect(400,'Ana','amistad',{to:ids.Ana});
  assert.deepEqual(await expect(200,'Ana','amistad',{to:ids.Beto}),{ok:true});
  assert.deepEqual(await expect(200,'Ana','amistad',{to:ids.Beto}),{ok:true});
  assert.deepEqual((await pulse('Beto')).signals.map(signal=>[signal.kind,signal.from.id,signal.from.name,signal.from.look]),[['amistad',ids.Ana,'Ana',{top:'jersey-ana'}]],'pedirla dos veces avisa una');
  await expect(401,'g21','aceptar-amistad',{to:ids.Ana});
  await expect(404,'Clara','aceptar-amistad',{to:ids.Ana});
  await expect(404,'Beto','aceptar-amistad',{to:randomUUID()});
  assert.equal((await expect(200,'Ana','estado',{},{route:'social'})).enabled,false);
  const accepted=await expect(200,'Beto','aceptar-amistad',{to:ids.Ana});
  assert.deepEqual(accepted,{ok:true,friend:{id:accepted.friend.id,name:'Ana',player:ids.Ana}});assert.match(accepted.friend.id,UUID);
  assert.equal((await expect(409,'Beto','aceptar-amistad',{to:ids.Ana})).error,'Ya sois amigos.');
  assert.equal((await expect(409,'Ana','amistad',{to:ids.Beto})).error,'Ya sois amigos.');
  const ana=await pulse('Ana');
  assert.deepEqual(ana.signals.map(signal=>[signal.kind,signal.from.id]),[['amistad-ok',ids.Beto]]);
  assert.deepEqual([ana.you.social,peer(ana,'Beto').friend,peer(ana,'Clara').friend,peer(ana,'g21').friend],[true,true,false,false]);
  const beto=await pulse('Beto');
  assert.deepEqual([beto.you.social,peer(beto,'Ana').friend],[true,true]);
  // La amistad es la misma del panel de amigos: sale en /api/social con el aspecto del lobby y sirve para su chat.
  const panel=await expect(200,'Ana','amigos',{},{route:'social'});
  assert.deepEqual(panel.friends,[{id:accepted.friend.id,name:'Beto',look:{top:'jersey-beto'},online:true,played:null,activity:true}]);
  assert.deepEqual((await expect(200,'Beto','chat',{id:accepted.friend.id},{route:'social'})).messages,[]);
  // Bloquear desde el panel de amigos: deja de salir como amigo y no se le puede volver a pedir.
  await expect(200,'Ana','bloquear',{id:accepted.friend.id},{route:'social'});
  await wait(10001);
  assert.equal(peer(await pulse('Ana'),'Beto').friend,false);
  assert.equal((await expect(409,'Beto','amistad',{to:ids.Ana})).error,'No se puede enviar la solicitud a este jugador.');

  // Otra instancia del servidor sobre los mismos datos: cada uno sigue en su lobby con su identificador.
  api=makeApi();
  seen=await pulse('g1');
  assert.deepEqual([seen.you.id,seen.room.n,seen.room.count],[first[0].you.id,1,20]);
  // Preview y público no comparten lobby.
  api=makeApi('publico');
  const alone=await expect(200,'g1','pulso');
  assert.deepEqual([alone.room,alone.players],[{n:1,count:1,cap:20},[]]);assert.notEqual(alone.you.id,ids.g1);
  api=makeApi();

  // Una petición de amistad vale 10 minutos. Después, lo caducado se borra cuando entra alguien.
  assert.deepEqual(await expect(200,'Clara','amistad',{to:ids.Dani}),{ok:true});
  assert.equal((await pulse('Dani')).signals.at(-1).kind,'amistad');
  await wait(LOBBY_SIGNALS.friendMs+1000,['Clara','Dani']);
  assert.deepEqual((await pulse('Dani')).signals,[]);
  await expect(404,'Dani','aceptar-amistad',{to:ids.Clara});
  const raw=makeLobby(),old=iso(0);
  assert.ok(await raw.presence('preview',hash(uuidOf('g1'))));
  const saidBy=async(store,name)=>(await store.chatTail('preview',1)).filter(row=>row.from_hash===hash(uuidOf(name))).length;
  assert.equal(await saidBy(raw,'g1'),2);
  await wait(280000,['Clara','Dani']);
  assert.deepEqual((await pulse('g30')).room,{n:1,count:1,cap:20},'los que caducaron ya no ocupan sitio');
  const cleaned=makeLobby();
  assert.equal(await cleaned.presence('preview',hash(uuidOf('g1'))),null,'las presencias antiguas se borran');
  assert.ok(await cleaned.presence('preview',hash(accounts.Clara.player)));
  assert.deepEqual(await cleaned.chatTail('preview',1),[],'los eventos de más de 15 minutos se borran');
  assert.ok(await cleaned.find('preview',{kind:'amistad',from:hash(accounts.Clara.player),to:hash(accounts.Dani.player),after:old}));
  assert.ok(await cleaned.presence('publico',hash(uuidOf('g1'))),'la limpieza es por entorno');
}

try{
  // Filtro de palabras: tacha la palabra entera, no trozos de otras.
  assert.equal(filterWords('Eres un GILIPOLLAS y un hijo de puta.'),'Eres un ********** y un hijo de ****.');
  assert.equal(filterWords('La computadora, la disputa y la reputación de la bolera'),'La computadora, la disputa y la reputación de la bolera');
  assert.equal(filterWords('puuuta put0 PUT4 mar1cón cabrón ¡Subnormal!'),'****** **** **** ******* ****** ¡*********!');
  assert.equal(filterWords('púta bollera'),'***** *******');
  assert.equal(filterWords('hola 😀 ¿qué tal? 1000 puntos'),'hola 😀 ¿qué tal? 1000 puntos');
  assert.equal(filterWords(42),'');
  assert.equal(lobbyName('  Zorra\u0000  del  desierto con un nombre larguísimo'),'***** del desierto con u');
  assert.equal(lobbyName(null),'');
  // El nombre no lleva marcas de HTML ni caracteres invisibles (ancho cero y dirección), como el perfil de los duelos y el chat.
  assert.equal(lobbyName('<img src=x onerror=alert(1)>'),'img src=x onerror=alert(');
  assert.equal(lobbyName('Be\u200bto\u200d \u200e\u200fAna\u202e\u2066x\u2069\ufeff'),'Be to Ana x');
  assert.equal(lobbyName(`"O'Brien" & <b>\`co\`</b>`),'OBrien bco/b');
  assert.equal(lobbyName('<>&"\'`\u200b\u200c'),'','un nombre que se queda vacío no vale (se conserva el anterior)');
  assert.equal(lobbyName('p<u>ta'),'****','el filtro de palabras mira el nombre ya limpio');
  assert.equal(lobbyText('  hola\n\nmundo \ud83d'),'hola mundo');
  assert.deepEqual([LOBBY.cap,LOBBY.presenceMs,LOBBY.w,LOBBY.d],[20,15000,30,22]);

  await scenario('archivo',()=>fileLobby(join(dir,'lobby.json')));
  const rest=fakeRest();
  await scenario('supabase',()=>supabaseStore({url:'https://proyecto.supabase.co/',key:'clave',fetch:rest.fetch}).lobby,rest);
  assert.ok(rest.calls.some(entry=>entry.method==='DELETE'&&entry.url.pathname.endsWith('/lobby_events')));
  assert.ok(rest.calls.every(entry=>entry.url.origin==='https://proyecto.supabase.co'));

  // Entradas simultáneas: las tres ven el mismo hueco y se apuntan al lobby 1 (22 jugadores). Al leer la sala, los
  // últimos en llegar se mudan al siguiente lobby: nadie se queda sin sala y el exceso no dura más de un pulso.
  {
    clock=Date.parse('2026-11-26T18:00:00Z');
    const store=fileLobby(),waiting=[],entered=[];
    let barrier=0;
    const racing={...store,
      // Las consultas de reparto esperan hasta que han llegado las tres: así todas cuentan 19 jugadores en el lobby 1.
      rooms:(...args)=>barrier?new Promise(resolve=>{waiting.push(()=>resolve(store.rooms(...args)));if(waiting.length===barrier){barrier=0;waiting.splice(0).forEach(run=>run())}}):store.rooms(...args),
      enter:row=>{entered.push(row.room);return store.enter(row)}};
    const lobby=createLobby({store:racing,social:fileSocial(),scope:'preview',now:()=>clock});
    const pulse=async index=>{const result=await lobby({player:hash('carrera-'+index),account:false},{action:'pulso',name:'Corredor '+index});assert.equal(result.status,200);return result.body};
    for(let i=1;i<=19;i++)await pulse(i);
    clock+=1000;barrier=3;
    await Promise.all([20,21,22].map(pulse));
    assert.deepEqual(entered.slice(-3),[1,1,1],'las tres entradas vieron el mismo hueco');
    clock+=1000;
    const settled=[];for(const index of [20,21,22])settled.push(await pulse(index));
    assert.deepEqual(settled.map(view=>view.room.n).sort(),[1,2,2]);
    assert.deepEqual((await pulse(1)).room,{n:1,count:20,cap:20});
    assert.deepEqual(settled.map(view=>view.room.count).sort(),[2,2,20]);
    clock+=1000;
    assert.deepEqual((await Promise.all([20,21,22].map(pulse))).map(view=>view.room.n),settled.map(view=>view.room.n),'una vez recolocados, cada uno se queda en su lobby');
  }

  // Límites de envío con peticiones en paralelo y un almacén con latencia (como Supabase): entre que una petición lee
  // y escribe, las demás ya han leído lo mismo. Con los dos almacenes; en el de Supabase, el índice único hace de árbitro.
  // La latencia son unas cuantas vueltas del bucle de eventos, al azar, antes y después de cada operación del almacén:
  // desordena las peticiones igual que la red y no hace esperar al reloj. Solo se activa en las ráfagas (race).
  const lag={on:false};
  const hops=async()=>{if(lag.on)for(let left=1+Math.floor(Math.random()*8);left>0;left--)await new Promise(resolve=>setImmediate(resolve))};
  const slow=store=>Object.fromEntries(Object.keys(store).map(name=>[name,async(...args)=>{await hops();const result=await store[name](...args);await hops();return result}]));
  const race=async tasks=>{lag.on=true;try{return await Promise.all(tasks)}finally{lag.on=false}};
  async function limits(label,store,rest=null){
    clock=Date.parse('2026-11-26T20:00:00Z');
    const lobby=createLobby({store:slow(store),social:fileSocial(),scope:'preview',now:()=>clock});
    const who=name=>({player:hash(label+'-'+name),account:false});
    const send=async(name,action,extra={})=>lobby(who(name),{action,...extra});
    const enter=async name=>{const result=await send(name,'pulso',{name});assert.equal(result.status,200,label);return result.body.you.id};
    const tally=results=>results.reduce((count,result)=>{count[result.status]=(count[result.status]||0)+1;return count},{});
    const alive=async names=>{for(const name of names)await enter(name)};
    const ana=await enter('ana'),beto=await enter('beto');

    // 40 mensajes a la vez del mismo jugador: entra uno (los demás ya lo ven a menos de 0,4 s).
    let results=await race(Array.from({length:40},(_,i)=>send('ana','chat',{text:'a la vez '+i})));
    assert.deepEqual(tally(results),{200:1,429:39},label+': 40 mensajes en paralelo');
    assert.equal((await send('beto','pulso',{since:0})).body.chat.length,1);
    // Ráfagas de 5 en paralelo cada medio segundo: en 10 segundos entran 6, ni uno más.
    let accepted=1;
    for(let wave=1;wave<12;wave++){
      clock+=500;
      const done=tally(await race(Array.from({length:5},(_,i)=>send('ana','chat',{text:`ola ${wave}.${i}`}))));
      assert.ok((done[200]||0)<=1,label+': de una ráfaga entra como mucho uno');accepted+=done[200]||0;
    }
    assert.equal(accepted,LOBBY_CHAT.burst,label+': 6 mensajes cada 10 segundos aunque lleguen en paralelo');
    assert.equal((await send('beto','pulso',{since:0})).body.chat.length,LOBBY_CHAT.burst);
    assert.equal((await send('ana','chat',{text:'uno más'})).body.error,'Vas muy rápido. Espera un momento.');

    // Tope de la sala: 20 mensajes cada 10 segundos entre todos, por muchas identidades nuevas que lleguen.
    clock+=LOBBY_CHAT.burstMs;
    const crowd=Array.from({length:16},(_,i)=>'inv'+i);
    await alive(['ana','beto',...crowd]);
    results=await race(crowd.map(name=>send(name,'chat',{text:'hola de '+name})));
    const first=tally(results)[200]||0;
    assert.ok(first>=1&&first<=crowd.length,label+': mensajes de varios a la vez');
    assert.ok(results.every(result=>result.status===200||result.body.error==='El chat va muy rápido. Espera un momento.'));
    let room=first;
    for(let round=0;round<3&&room<LOBBY_CHAT.roomBurst;round++){
      clock+=500;
      for(const name of crowd){if(room>=LOBBY_CHAT.roomBurst)break;const result=await send(name,'chat',{text:'otra de '+name});if(result.status===200)room++}
    }
    assert.equal(room,LOBBY_CHAT.roomBurst);
    clock+=500;
    results=await race(['beto',...crowd].map(name=>send(name,'chat',{text:'no cabe'})));
    assert.deepEqual(tally(results),{429:17},label+': con la sala llena no entra nadie más');
    assert.ok(results.every(result=>result.body.error==='El chat va muy rápido. Espera un momento.'));
    const heard=(await send('beto','pulso',{since:0})).body.chat.filter(message=>clock-message.at<LOBBY_CHAT.burstMs);
    assert.equal(heard.length,LOBBY_CHAT.roomBurst,label+': 20 mensajes en los últimos 10 segundos');
    clock+=LOBBY_CHAT.burstMs;
    assert.equal((await send('beto','chat',{text:'ya se puede'})).status,200,label+': pasada la ventana se vuelve a hablar');

    // Retos en paralelo: 15 a la vez a 15 jugadores distintos no pasan de 8 por minuto; después, ni uno más.
    await alive(['ana','beto',...crowd]);
    const targets=[];for(const name of crowd.slice(0,15))targets.push((await send(name,'pulso')).body.you.id);
    results=await race(targets.map(to=>send('ana','retar',{to,game:'traza',code:'ABCDEF'})));
    let invited=tally(results)[200]||0;
    assert.ok(invited>=1&&invited<=LOBBY_SIGNALS.burst,label+': retos en paralelo dentro del tope ('+invited+')');
    clock+=LOBBY_SIGNALS.retoGapMs+1;await alive(['ana','beto',...crowd]);
    for(const to of targets){const result=await send('ana','retar',{to,game:'traza',code:'ABCDEF'});if(result.status===200)invited++}
    assert.equal(invited,LOBBY_SIGNALS.burst,label+': 8 invitaciones por minuto');
    assert.equal((await send('ana','retar',{to:beto,code:'ABCDEF'})).body.error,'Has enviado demasiadas invitaciones. Espera un momento.');
    // Diez retos a la vez al mismo jugador: le llega uno.
    results=await race(Array.from({length:10},()=>send('beto','retar',{to:ana,code:'ABCDEF'})));
    assert.deepEqual(tally(results),{200:1,429:9},label+': un reto cada 15 s al mismo jugador');
    assert.equal((await send('ana','pulso',{since:0})).body.signals.filter(signal=>signal.kind==='reto').length,1);

    // Petición de amistad repetida a la vez: todas responden bien y llega un solo aviso.
    const carla={player:hash(label+'-carla'),account:true},dani={player:hash(label+'-dani'),account:true};
    const idDani=(await lobby(dani,{action:'pulso',name:'Dani'})).body.you.id;await lobby(carla,{action:'pulso',name:'Carla'});
    results=await race(Array.from({length:6},()=>lobby(carla,{action:'amistad',to:idDani})));
    assert.deepEqual(tally(results),{200:6},label+': pedir amistad dos veces a la vez no falla');
    assert.equal((await lobby(dani,{action:'pulso',since:0})).body.signals.filter(signal=>signal.kind==='amistad').length,1);
    if(rest)assert.ok(rest.conflicts.count>30,label+': los turnos ocupados los rechaza el índice único (409 de PostgREST)');

    // Una señal no se pierde por mucho que se hable: un reto y, antes del siguiente pulso del retado, 100 mensajes.
    clock+=LOBBY_SIGNALS.burstMs;await alive(['ana','beto',...crowd]);
    const mark=(await send('ana','pulso',{since:0})).body.cursor;
    assert.equal((await send('beto','retar',{to:ana,game:'archivo',code:'QRSTUV'})).status,200);
    let spoken=0;
    for(let step=0;step<25&&spoken<100;step++){
      clock+=2100;
      for(const name of crowd){const result=await send(name,'chat',{text:'bla '+step});if(result.status===200)spoken++;if(spoken>=100)break}
      if(step%4===3)await alive(['ana','beto',...crowd]);
    }
    assert.equal(spoken,100);
    const late=(await send('ana','pulso',{since:mark})).body;
    assert.deepEqual(late.signals.map(signal=>[signal.kind,signal.game,signal.code]),[['reto','archivo','QRSTUV']],label+': el reto llega aunque haya 100 mensajes más nuevos');
    assert.equal(late.chat.length,LOBBY_CHAT.keep);assert.equal(late.cursor,late.chat.at(-1).n);
    assert.deepEqual((await send('ana','pulso',{since:late.cursor})).body.signals,[],label+': con el cursor no se repite');
  }
  await limits('archivo',fileLobby());
  {
    const rest=fakeRest();
    await limits('supabase',supabaseStore({url:'https://proyecto.supabase.co/',key:'clave',fetch:rest.fetch}).lobby,rest);
    // Solo el turno ocupado se convierte en «inténtalo otra vez»: cualquier otro rechazo de la base de datos es un fallo.
    const store=supabaseStore({url:'https://proyecto.supabase.co/',key:'clave',fetch:rest.fetch}).lobby;
    const row={scope:'preview',room:777,kind:'chat',from_hash:hash('x'),from_id:randomUUID(),from_name:'X',from_look:null,to_hash:null,body:'hola',game:null,code:null,slot:'c:777:0',created_at:iso(clock)};
    assert.equal((await store.addEvent(row)).body,'hola');
    assert.equal(await store.addEvent(row),null,'turno ocupado');
    assert.ok(await store.addEvent({...row,scope:'publico'}),'el turno es de cada entorno');
    await assert.rejects(store.addEvent({...row,room:778,slot:'c:778:0',body:''}),/Supabase respondió 400/);
  }

  // La limpieza se lanza al entrar alguien, pero como mucho una vez por minuto en cada instancia.
  {
    clock=Date.parse('2026-11-26T21:00:00Z');
    const [store,counts]=counted(fileLobby());
    const lobby=createLobby({store,social:fileSocial(),scope:'preview',now:()=>clock});
    const enter=index=>lobby({player:hash('limpieza-'+index),account:false},{action:'pulso',name:'Entra '+index});
    for(let i=0;i<6;i++){clock+=5000;await enter(i)}
    assert.equal(counts.purge,1,'seis entradas en medio minuto, una limpieza');
    clock+=36000;await enter(7);
    assert.equal(counts.purge,2,'pasado el minuto se limpia otra vez');
    clock+=1000;await enter(8);
    assert.equal(counts.purge,2);
  }

  // Ritmo del navegador dentro de un juego: un pulso cada 8 s. Se puede perder uno (16 s sin señal) sin salir de la
  // sala; con dos perdidos (24 s) ya no está, y al volver entra de nuevo con su mismo identificador.
  {
    clock=Date.parse('2026-11-26T22:00:00Z');
    const lobby=createLobby({store:fileLobby(),social:fileSocial(),scope:'preview',now:()=>clock});
    const pulse=async name=>(await lobby({player:hash('ritmo-'+name),account:false},{action:'pulso',name,where:'daily'})).body;
    const sees=async()=>{const view=await pulse('mira');return view.players.length};
    const id=(await pulse('juega')).you.id;await pulse('mira');
    for(let i=0;i<5;i++){clock+=8000;await pulse('juega');assert.equal(await sees(),1)}
    clock+=16000;
    assert.equal(await sees(),1,'un pulso perdido no le saca de la sala');
    await pulse('juega');clock+=8000;await pulse('juega');
    clock+=24000;
    assert.equal(await sees(),0,'dos pulsos perdidos, sí');
    assert.equal((await pulse('juega')).you.id,id);assert.equal(await sees(),1);
  }

  // Si las tablas del lobby no existen (migración sin aplicar), /api/lobby responde 503 y lo demás sigue.
  {
    clock=Date.parse('2026-11-26T19:00:00Z');
    const missing=async()=>new Response('{"code":"PGRST205","message":"Could not find the table \'public.lobby_presence\' in the schema cache"}',{status:404});
    const logged=[];
    const api=createApi({store:{social:fileSocial(),lobby:supabaseStore({url:'https://proyecto.supabase.co',key:'clave',fetch:missing}).lobby},auth,trendScope:'preview',now:()=>clock,log:(...args)=>logged.push(args.join(' '))});
    const post=(route,cookie,body)=>api.handle(new Request(SITE+'/api/'+route,{method:'POST',headers:{origin:SITE,cookie},body:JSON.stringify(body)}));
    for(const action of ['pulso','salir','chat']){
      const down=await post('lobby',cookieOf('Ana'),{action,text:'hola'});
      assert.equal(down.status,503);assert.deepEqual(await down.json(),{error:'El lobby no está disponible ahora mismo.'});
    }
    assert.match(logged[0],/API \/api\/lobby: Supabase respondió 404/);
    assert.equal((await post('social',cookieOf('Ana'),{action:'estado'})).status,200);
    assert.equal((await api.handle(new Request(SITE+'/api/calendar'))).status,200);

    // /api/duelo admite cuerpos de hasta 16 KB (la voz); las demás rutas siguen en 2 KB.
    const padded=size=>JSON.stringify({action:'no-existe',relleno:'x'.repeat(size)});
    const sized=async(route,size)=>(await api.handle(new Request(SITE+'/api/'+route,{method:'POST',headers:{origin:SITE},body:padded(size)}))).status;
    assert.notEqual(await sized('duelo',15000),413);
    assert.equal(await sized('duelo',17000),413);
    assert.equal(await sized('liga',3000),413);
    assert.equal(await sized('answers',3000),413);
  }

  console.log('Lobby público: reparto en salas de 20, huecos, caducidad, saneado, escrituras mínimas, chat con filtro y cursor, retos, amistad invitado/cuenta, entradas simultáneas, límites con peticiones en paralelo, tope por sala, señales que no se pierden, limpieza, 401/409/429/503 y contrato REST de Supabase correctos.');
}finally{rmSync(dir,{recursive:true,force:true})}

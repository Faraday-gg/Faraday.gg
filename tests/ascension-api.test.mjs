// Contrato HTTP real y persistencia de Ascensión. Usa un puerto efímero y datos locales;
// no inicia sesiones reales ni llama a Supabase.
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {createApi,PLAYER_COOKIE} from '../lib/api.mjs';
import {fileStore} from '../lib/stores.mjs';
import {supabaseAscension} from '../lib/ascension-store.mjs';

const fixture={version:'http-test',categories:Array.from({length:14},(_,index)=>({
  id:`prueba-http-${index}`,theme:`tema-${index%7}`,title:`Nombra una respuesta válida de prueba ${index}`,
  description:'Banco cerrado para las comprobaciones de HTTP.',sources:[{title:'Catálogo de prueba',url:'https://example.org/catalogo'}],
  answers:[{name:'Respuesta corriente',aliases:['respuesta común'],points:10},
    {name:'Respuesta de cumbre',aliases:['hallazgo secreto'],points:100}]
}))};
const day='2026-11-19',hash=value=>createHash('sha256').update(value).digest('hex');
const directory=fs.mkdtempSync(path.join(os.tmpdir(),'faraday-ascension-api-'));
const file=path.join(directory,'answers.json');
const accountPlayer=randomUUID(),spoofPlayer=randomUUID();
const mockAuth={async current(request){return request.headers.get('x-test-account')==='signed'
  ?{account:{id:'cuenta-ficticia',player:accountPlayer,email:'prueba@example.test'},cookies:['faraday_sesion=renovada; Path=/; HttpOnly; SameSite=Lax']}:null}};
let clock=Date.parse(day+'T11:00:00Z'),server,origin,store,api;
async function start(scope='preview'){
  store=fileStore(file);api=createApi({store,ascensionBank:fixture,now:()=>clock,auth:mockAuth,trendScope:scope,persistDays:false,log:()=>{}});
  server=http.createServer(async(req,res)=>{
    try{
      const chunks=[];for await(const chunk of req)chunks.push(chunk);
      const headers=new Headers();for(const [name,value] of Object.entries(req.headers))if(typeof value==='string')headers.set(name,value);
      const request=new Request(`http://${req.headers.host}${req.url}`,{method:req.method,headers,
        ...(!['GET','HEAD'].includes(req.method)?{body:Buffer.concat(chunks)}:{})});
      const response=await api.handle(request);
      if(!response){res.writeHead(404);res.end();return}
      for(const [name,value] of response.headers)if(name!=='set-cookie')res.setHeader(name,value);
      const cookies=response.headers.getSetCookie();if(cookies.length)res.setHeader('Set-Cookie',cookies);
      res.writeHead(response.status);res.end(Buffer.from(await response.arrayBuffer()));
    }catch(error){res.writeHead(500);res.end(String(error))}
  });
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve)});
  origin=`http://127.0.0.1:${server.address().port}`;
}
async function stop(){
  if(!server)return;
  if(!server.listening){server=null;return}
  const closing=new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));
  server.closeAllConnections();await closing;server=null;
}
async function post(data,{cookie,headers={},url='/api/ascension',method='POST',body}={}){
  const response=await fetch(origin+url,{method,headers:{'Content-Type':'application/json',Origin:origin,...(cookie?{Cookie:cookie}:{}),...headers},
    ...(!['GET','HEAD'].includes(method)?{body:body??JSON.stringify(data)}:{})});
  return {status:response.status,body:await response.json(),headers:response.headers,cookies:response.headers.getSetCookie()};
}
const playerCookie=response=>response.cookies.find(cookie=>cookie.startsWith(PLAYER_COOKIE+'='))?.split(';')[0];
try{
  await start();
  const initial=await post({action:'estado',player:spoofPlayer,score:700,game:0});
  assert.equal(initial.status,200);assert.equal(initial.body.phase,'ready');assert.equal(initial.body.current,null);assert.equal(initial.body.score,0);
  assert.equal(initial.headers.get('cache-control'),'no-store');assert.equal(initial.headers.get('x-content-type-options'),'nosniff');
  const guestCookie=playerCookie(initial);assert(guestCookie);const guest=guestCookie.split('=')[1];
  assert.notEqual(guest,spoofPlayer,'La API ignora el identificador enviado en el cuerpo');
  assert.match(initial.cookies[0],/HttpOnly; SameSite=Lax/);assert(!initial.cookies[0].includes('; Secure'),'En HTTP local no exige Secure');
  assert(!JSON.stringify(initial.body).includes('hallazgo secreto'),'No filtra aliases del banco');
  assert.equal(await store.ascension.get('preview',day,hash(spoofPlayer),0),null);
  assert(await store.ascension.get('preview',day,hash(guest),0),'La clave persistida es el hash del jugador de la cookie');

  const [left,right]=await Promise.all([
    post({action:'empezar',date:day,game:0,round:0,deadline:clock+1e9},{cookie:guestCookie}),
    post({action:'empezar',date:day,game:0,round:0},{cookie:guestCookie})
  ]);
  assert.equal(left.status,200);assert.equal(right.status,200);assert.equal(left.body.deadline,clock+25000);assert.equal(right.body.deadline,left.body.deadline);
  assert(!('answers' in left.body.current));assert(!('sources' in left.body.current));assert(!JSON.stringify(left.body).includes('Respuesta de cumbre'));
  const invalid=await post({action:'responder',date:day,game:0,round:0,answer:'Texto personal que no pertenece al banco'},{cookie:guestCookie});
  assert.equal(invalid.status,422);assert.equal(invalid.body.deadline,left.body.deadline);assert.equal(invalid.body.results.length,0);
  const answered=await post({action:'responder',date:day,game:0,round:0,answer:'RESPUESTA COMÚN',points:700,score:700,player:spoofPlayer},{cookie:guestCookie});
  assert.equal(answered.status,200);assert.equal(answered.body.score,10);assert.equal(answered.body.height,100);assert.equal(answered.body.results[0].answer,'Respuesta corriente');
  const repeated=await post({action:'responder',date:day,game:0,round:0,answer:'hallazgo secreto',points:100},{cookie:guestCookie});
  assert.equal(repeated.body.score,10);assert.equal(repeated.body.results.length,1);assert.equal(repeated.body.repeated,true);
  const disk=fs.readFileSync(path.join(directory,'ascension.json'),'utf8');
  assert(!disk.includes('Texto personal'),'Los intentos rechazados no se guardan');assert(!disk.includes(guest),'No persiste el UUID sin hash');

  await post({action:'siguiente',date:day,game:0,round:0},{cookie:guestCookie});
  const active=await post({action:'empezar',date:day,game:0,round:1},{cookie:guestCookie});
  clock+=12000;await stop();await start();
  const recovered=await post({action:'estado'},{cookie:guestCookie});
  assert.equal(recovered.body.phase,'question');assert.equal(recovered.body.round,1);assert.equal(recovered.body.deadline,active.body.deadline);assert.equal(recovered.body.score,10);
  assert.equal(recovered.cookies.length,0,'La cookie existente se reutiliza al reiniciar');
  clock=active.body.deadline;
  const timeout=await post({action:'responder',date:day,game:0,round:1,answer:'hallazgo secreto'},{cookie:guestCookie});
  assert.equal(timeout.body.results[1].reason,'timeout');assert.equal(timeout.body.results[1].points,0);

  // Una sesión autenticada prevalece tanto sobre la cookie anónima como sobre el cuerpo.
  const signed=await post({action:'estado',player:spoofPlayer},{cookie:guestCookie,headers:{'x-test-account':'signed','x-forwarded-proto':'https'}});
  assert.equal(signed.body.phase,'ready');assert.equal(signed.body.score,0);
  assert.equal(playerCookie(signed),`${PLAYER_COOKIE}=${accountPlayer}`);assert(signed.cookies.some(cookie=>cookie.startsWith(PLAYER_COOKIE+'=')&&cookie.endsWith('; Secure')));
  assert(signed.cookies.some(cookie=>cookie.startsWith('faraday_sesion=renovada')),'Conserva las cookies de renovación de sesión');
  assert(await store.ascension.get('preview',day,hash(accountPlayer),0));
  assert.equal((await store.ascension.get('preview',day,hash(guest),0)).score,10,'No mezcla el progreso anónimo con el de la cuenta');
  assert(!JSON.stringify(signed.body).includes(accountPlayer));
  await store.community.setSubscription(hash(accountPlayer),clock+60000);
  const subscriber=await post({action:'estado',plus:false},{cookie:guestCookie,headers:{'x-test-account':'signed'}});
  assert.equal(subscriber.body.continuation.plus,true,'La suscripción se consulta desde la identidad de la cuenta');
  assert.equal(subscriber.body.continuation.requiresAd,false);
  const spoof=await post({action:'estado',plus:true},{cookie:guestCookie});
  assert.equal(spoof.body.continuation.plus,false,'La declaración del navegador no evita los anuncios');
  await store.community.setSubscription(hash(accountPlayer),clock-1);
  assert.equal((await post({action:'estado'},{headers:{'x-test-account':'signed'}})).body.continuation.plus,false,'La siguiente respuesta reconoce un plan caducado');
  const replaced=await post({action:'estado',player:spoofPlayer},{cookie:`${PLAYER_COOKIE}=no-valida`});
  assert.equal(replaced.status,200);assert(playerCookie(replaced));assert.notEqual(playerCookie(replaced),`${PLAYER_COOKIE}=${spoofPlayer}`);

  assert.equal((await post({action:'estado'},{headers:{Origin:'https://otro-origen.example'}})).status,403);
  assert.equal((await post({action:'estado'},{headers:{Origin:'no-es-url'}})).status,403);
  assert.equal((await post({action:'estado'},{method:'GET'})).status,405);
  assert.equal((await post({}, {body:'{roto'})).status,400);
  assert.equal((await post([],{})).status,400);
  assert.equal((await post({}, {body:JSON.stringify({action:'estado',padding:'x'.repeat(3000)})})).status,413);
  const rewritten=await post({action:'estado'},{cookie:guestCookie,url:'/api?route=ascension'});
  assert.equal(rewritten.status,200);assert.equal(rewritten.body.score,10,'La reescritura de Vercel conserva la ruta');
  assert.equal((await post({action:'estado',scope:'publico'},{cookie:guestCookie})).body.score,10,'El entorno del cuerpo no modifica la selección del servidor');

  const unavailable=createApi({store:{...store,ascension:{get:async()=>{throw Error('detalle interno secreto')}}},ascensionBank:fixture,now:()=>clock,log:()=>{}});
  const unavailableResponse=await unavailable.handle(new Request('https://prueba.test/api/ascension',{method:'POST',headers:{'Content-Type':'application/json'},body:'{"action":"estado"}'}));
  assert.equal(unavailableResponse.status,503);assert(!JSON.stringify(await unavailableResponse.json()).includes('detalle interno'));

  // La ruta común usa los recibos del JSON de Ascensión aunque no exista la tabla
  // de anuncios de otras modalidades: no necesita una migración nueva para funcionar.
  const daily=await store.ascension.get('preview',day,hash(guest),0);
  const finishedState={...daily.state,phase:'finished',round:6,finishedAt:clock,results:Array.from({length:7},(_,round)=>daily.state.results[round]||{round,points:0,answer:null,height:0,sources:[]})};
  await store.ascension.put({...daily,version:daily.version+1,state:finishedState,finished_at:new Date(clock).toISOString()},daily.version);
  const isolatedApi=createApi({store:{...store,continuations:{get:async()=>{throw Error('tabla general pendiente')}}},ascensionBank:fixture,now:()=>clock,trendScope:'preview',log:()=>{}});
  const isolated=async(route,data)=>{
    const response=await isolatedApi.handle(new Request(origin+'/api/'+route,{method:'POST',headers:{'Content-Type':'application/json',Cookie:guestCookie,Origin:origin},body:JSON.stringify(data)}));
    return {status:response.status,body:await response.json()};
  };
  const adState=await isolated('continuacion',{action:'estado',mode:'ascension'});assert.equal(adState.status,200);assert.equal(adState.body.seconds,15);
  const ad=await isolated('ascension',{action:'preparar-practica',date:day,game:0});assert.equal(ad.body.watch,true);
  assert.equal((await isolated('continuacion',{action:'completar',mode:'ascension',date:day,ticket:ad.body.ticket})).status,409);
  clock+=15000;
  assert.equal((await isolated('continuacion',{action:'completar',mode:'ascension',date:day,ticket:ad.body.ticket})).status,200);
  const next=await isolated('ascension',{action:'practica',date:day,game:0,ticket:ad.body.ticket});assert.equal(next.body.game,1);
  assert.equal((await isolated('continuacion',{action:'estado',mode:'ascension'})).body.id,'1');

  await stop();await start('publico');
  const production=await post({action:'estado'},{cookie:guestCookie});
  assert.equal(production.body.phase,'ready');assert.equal(production.body.score,0,'Preview y público no comparten partidas');
  assert(await store.ascension.get('preview',day,hash(guest),0));assert(await store.ascension.get('publico',day,hash(guest),0));
}finally{await stop();fs.rmSync(directory,{recursive:true,force:true})}

// Contrato REST del almacén Supabase: identidad completa, CAS y páginas de puntuaciones
// sin descargar snapshots, respuestas o identificadores de los demás jugadores.
{
  const calls=[],player='a'.repeat(64),edition='edicion-prueba';
  const row={scope:'preview',day,player_hash:player,game:0,version:0,edition,score:0,finished_at:null,state:{phase:'ready'}};
  let operation='get',empty=false;
  const call=async(raw,init={})=>{
    const url=new URL(raw),query=url.searchParams;calls.push({url,init});assert.equal(url.pathname,'/rest/v1/ascension_runs');
    if(operation!=='insert')assert.equal(query.get('scope'),'eq.preview');
    if(operation==='get'){
      assert.equal(query.get('day'),`eq.${day}`);assert.equal(query.get('player_hash'),`eq.${player}`);assert.equal(query.get('game'),'eq.0');assert.equal(query.get('limit'),'1');
      return Response.json(empty?[]:[row]);
    }
    if(operation==='insert'){
      assert.equal(init.method,'POST');assert.equal(query.get('on_conflict'),'scope,day,player_hash,game');
      assert.match(init.headers.Prefer,/resolution=ignore-duplicates/);assert.match(init.headers.Prefer,/return=representation/);
      assert.deepEqual(JSON.parse(init.body),row);return Response.json(empty?[]:[row]);
    }
    if(operation==='update'){
      assert.equal(init.method,'PATCH');assert.equal(query.get('day'),`eq.${day}`);assert.equal(query.get('player_hash'),`eq.${player}`);assert.equal(query.get('game'),'eq.0');assert.equal(query.get('version'),'eq.0');
      const updated=JSON.parse(init.body);assert.equal(updated.version,1);assert.equal(updated.score,100);return Response.json(empty?[]:[updated]);
    }
    if(operation==='latest'){
      assert.equal(query.get('select'),'game');assert.equal(query.get('order'),'game.desc');assert.equal(query.get('limit'),'1');assert.equal(query.get('player_hash'),`eq.${player}`);
      return Response.json(empty?[]:[{game:3}]);
    }
    assert.equal(operation,'scores');assert.equal(query.get('select'),'score');assert.equal(query.get('edition'),`eq.${edition}`);assert.equal(query.get('day'),`eq.${day}`);
    assert.equal(query.get('game'),'eq.0');assert.equal(query.get('finished_at'),'not.is.null');assert.equal(query.get('order'),'player_hash');assert.equal(query.get('limit'),'2');
    assert.equal(query.has('player_hash'),false,'Consulta toda la edición y no solo al jugador actual');
    const all=[10,30,60,85,100],offset=Number(query.get('offset'));return Response.json(all.slice(offset,offset+2).map(score=>({score})));
  };
  const remote=supabaseAscension({call,endpoint:name=>`https://supabase.test/rest/v1/${name}`,pageSize:2});
  assert.deepEqual(await remote.get('preview',day,player,0),row);empty=true;assert.equal(await remote.get('preview',day,player,0),null);empty=false;
  operation='insert';assert.equal(await remote.put(row,null),true);empty=true;assert.equal(await remote.put(row,null),false);empty=false;
  operation='update';const changed={...row,version:1,score:100};assert.equal(await remote.put(changed,0),true);empty=true;assert.equal(await remote.put(changed,0),false);empty=false;
  operation='latest';assert.equal(await remote.latest('preview',day,player),3);empty=true;assert.equal(await remote.latest('preview',day,player),-1);empty=false;
  operation='scores';const before=calls.length;assert.deepEqual(await remote.scores('preview',day,edition),[10,30,60,85,100]);
  assert.deepEqual(calls.slice(before).map(entry=>entry.url.searchParams.get('offset')),['0','2','4'],'Pagina hasta completar la clasificación');
}

console.log('Ascensión HTTP: cookies, cuenta, origen, persistencia, puntos servidor y contrato Supabase correctos');

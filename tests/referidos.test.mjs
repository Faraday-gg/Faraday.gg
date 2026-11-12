// Prueba los referidos, el «Circuito» de amigos (lib/referidos.mjs), a través de la API y con un reloj controlado.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {createApi} from '../lib/api.mjs';
import {fileStore} from '../lib/stores.mjs';
import {RULES} from '../lib/referidos.mjs';
import {editorialDays} from '../content-engine.mjs';

const directory=fs.mkdtempSync(path.join(os.tmpdir(),'casi-referidos-'));
// 10:00 en Madrid del día indicado.
const at=date=>Date.parse(date+'T09:00:00Z');
let clock=at('2026-11-09'),seed=7;
const random=()=>{seed=(seed*16807)%2147483647;return seed/2147483647};
const days=new Map(editorialDays.map(day=>[day.id,day]));

const store=fileStore(path.join(directory,'answers.json'));
const api=createApi({store,persistDays:false,now:()=>clock,random,log:()=>{}});
const post=async(route,body)=>{const response=await api.handle(new Request('http://casi.test/api/'+route,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}));return {status:response.status,data:await response.json()}};
const ref=(action,player,extra={})=>post('referido',{action,player,...extra});
// Juega el reto de un día, ese mismo día, multiplicando cada cifra real por factor.
const play=async(player,date,factor=1.5)=>{clock=at(date);for(const q of days.get(date).questions){const r=await post('answers',{question:q.id,player,guess:q.answer*factor});assert.equal(r.status,200)}};
const noHashes=data=>assert(!JSON.stringify(data).match(/[0-9a-f]{64}/),'Nunca salen los identificadores de nadie');

try{
  const luis=randomUUID(),marta=randomUUID(),pedro=randomUUID(),veterana=randomUUID(),otra=randomUUID();

  // Código: se crea la primera vez y siempre es el mismo. El apodo se limpia.
  assert.equal((await ref('codigo','no-soy-un-uuid')).status,400);
  let r=await ref('codigo',luis,{name:'Luis <b>',avatar:{body:'hombre',top:'<x>'}});
  assert.equal(r.status,200);const code=r.data.code;assert.match(code,/^[A-Z2-9]{6}$/);
  assert.equal((await ref('codigo',luis,{name:'Luis',avatar:{body:'hombre'}})).data.code,code,'El código no cambia');

  // Abrir un enlace: código mal escrito, inexistente o el tuyo propio.
  assert.equal((await ref('abrir',marta,{code:'abc'})).status,400);
  assert.equal((await ref('abrir',marta,{code:'ZZZZZZ'})).status,404);
  r=await ref('abrir',luis,{code});assert.equal(r.data.linked,false);assert.equal(r.data.reason,'tu-codigo');

  // Una jugadora nueva entra por el enlace (en minúsculas también vale) y ve quién la invita.
  r=await ref('abrir',marta,{code:code.toLowerCase(),name:'Marta'});
  assert.equal(r.status,200);assert.equal(r.data.linked,true);assert.equal(r.data.sponsor.name,'Luis');assert.deepEqual(r.data.sponsor.avatar,{body:'hombre'});noHashes(r.data);
  assert.equal((await ref('abrir',marta,{code})).data.reason,'ya','Abrir otra vez no duplica');

  // Otro código no le cambia el padrino.
  const pedroCode=(await ref('codigo',pedro,{name:'Pedro'})).data.code;
  r=await ref('abrir',marta,{code:pedroCode});assert.equal(r.data.linked,false);assert.equal(r.data.reason,'otro');

  // Quien ya jugaba no cuenta como invitado.
  await play(veterana,'2026-11-09');
  r=await ref('abrir',veterana,{code});assert.equal(r.data.linked,false);assert.equal(r.data.reason,'ya-jugabas');

  // No se cierran círculos: Luis (sin jugar aún) no puede entrar por el código de Marta, a quien invitó él.
  const martaCode=(await ref('codigo',marta,{name:'Marta'})).data.code;
  r=await ref('abrir',luis,{code:martaCode});assert.equal(r.data.linked,false);assert.equal(r.data.reason,'circulo');

  // Estado antes de jugar: Marta pendiente, nada que cobrar.
  r=await ref('estado',luis);
  assert.equal(r.data.connections,0);assert.equal(r.data.friends.length,1);assert.equal(r.data.friends[0].name,'Marta');assert.equal(r.data.friends[0].days,0);assert.equal(r.data.pending,0);noHashes(r.data);
  r=await ref('estado',marta);assert.equal(r.data.sponsor.name,'Luis');assert.equal(r.data.sponsor.today,null,'Sin jugar hoy no se enseña el resultado de quien invita');

  // Día 1: juegan los dos. Marta ve el resultado de Luis (después de jugar) y tiene el cofre de bienvenida.
  await play(luis,'2026-11-09',2);await play(marta,'2026-11-09',1.2);
  r=await ref('estado',marta);
  assert(Math.abs(r.data.sponsor.today.yours-1.2)<1e-9);assert(Math.abs(r.data.sponsor.today.theirs-2)<1e-9);assert.equal(r.data.pending,1);
  assert.deepEqual(r.data.current.map(c=>c.days),[['2026-11-09']],'Corriente compartida: el día que jugáis los dos');
  assert.equal((await ref('estado',luis)).data.current[0].name,'Marta');
  r=await ref('reclamar',marta);assert.deepEqual(r.data.prizes,[{kind:'bienvenida',chest:'rayo'}]);
  assert.deepEqual((await ref('reclamar',marta)).data.prizes,[],'La bienvenida se cobra una vez');

  // Días 2 y 3 (con uno en medio sin jugar): Marta se hace conexión.
  await play(marta,'2026-11-10');
  assert.equal((await ref('estado',luis)).data.friends[0].days,2);
  await play(marta,'2026-11-12');
  r=await ref('estado',luis);assert.equal(r.data.connections,1);assert.equal(r.data.friends[0].connected,true);assert.equal(r.data.pending,1);
  r=await ref('reclamar',luis);assert.deepEqual(r.data.prizes,[{kind:'conexion',chest:'rayo',n:1}]);assert.equal(r.data.connections,1);
  assert.deepEqual((await ref('reclamar',luis)).data.prizes,[],'Cada conexión se cobra una vez');
  r=await ref('reclamar',marta);assert.deepEqual(r.data.prizes,[{kind:'conexion-invitado',coins:RULES.inviteeCoins}]);

  // Plazo: quien no juega 3 días en sus primeros 14 ya no cuenta, aunque juegue después.
  clock=at('2026-11-09');assert.equal((await ref('abrir',otra,{code,name:'Otra'})).data.linked,true);
  await play(otra,'2026-11-09');await play(otra,'2026-11-10');
  clock=at('2026-11-23');
  r=await ref('estado',luis);const late=r.data.friends.find(f=>f.name==='Otra');assert.equal(late.expired,true);assert.equal(late.connected,false);assert.equal(r.data.connections,1);

  // La corriente compartida dura 30 días desde el vínculo.
  clock=at('2026-12-09');assert.deepEqual((await ref('estado',marta)).data.current,[]);

  // A partir de la conexión 11, faradios en lugar de cofre.
  const many=Array.from({length:10},()=>randomUUID());
  clock=at('2026-11-09');for(const p of many)assert.equal((await ref('abrir',p,{code})).data.linked,true);
  for(const date of ['2026-11-09','2026-11-10','2026-11-11'])for(const p of many)await play(p,date);
  r=await ref('reclamar',luis);
  assert.equal(r.data.connections,11);
  assert.deepEqual(r.data.prizes.map(p=>p.chest||p.coins),[...Array(9).fill('rayo'),RULES.extraCoins],'Las 10 primeras conexiones dan cofre; la 11.ª, faradios');
  noHashes(r.data);

  console.log('Referidos: todo correcto.');
}finally{fs.rmSync(directory,{recursive:true,force:true})}

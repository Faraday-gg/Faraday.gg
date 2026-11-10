import {spawn} from 'node:child_process';
import {once} from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
const directory=fs.mkdtempSync(path.join(os.tmpdir(),'casi-community-'));
let server;
async function start(){server=spawn(process.execPath,['preview-server.mjs'],{env:{...process.env,PORT:'4174',ANSWERS_FILE:path.join(directory,'answers.json'),DAYS_DIRECTORY:path.join(directory,'days')},stdio:['ignore','pipe','inherit']});await once(server.stdout,'data')}
async function post(player,guess,question='piloto-v2-1'){const response=await fetch('http://127.0.0.1:4174/api/answers',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({player,guess,question})});return {status:response.status,data:await response.json()}}
try{
  await start();const first=randomUUID(),second=randomUUID();
  let r=await post(first,100000);assert.equal(r.status,200);assert.equal(r.data.count,0);
  r=await post(second,200000);assert.equal(r.data.count,1);assert.equal(r.data.bins.reduce((a,b)=>a+b,0),1);
  r=await post(second,200000);assert.equal(r.data.count,1,'Una respuesta repetida no duplica la muestra');
  assert.equal((await post(second,300000)).status,409);
  assert.equal((await post(first,-1)).status,400);
  assert.equal((await post(first,100,'desconocida')).status,400);
  assert.equal((await fetch('http://127.0.0.1:4174/runtime/answers.json')).status,404);
  assert.equal((await fetch('http://127.0.0.1:4174/assets/las-canteras.jpg')).headers.get('content-type'),'image/jpeg');
  const daily=async player=>{const r=await fetch('http://127.0.0.1:4174/api/daily-scores',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({date:'2026-11-09',player})});return {status:r.status,data:await r.json()}};
  assert.equal((await daily(first)).status,409,'Un día incompleto no participa');
  await post(first,60000,'piloto-v2-2');await post(first,4700,'piloto-v2-3');
  assert.equal((await daily(first)).data.count,0,'La segunda persona sigue sin completar el día');
  const third=randomUUID();await post(third,150000);await post(third,90000,'piloto-v2-2');await post(third,8000,'piloto-v2-3');
  const result=await daily(first);assert.equal(result.status,200);assert.equal(result.data.count,1);assert.equal(result.data.bins.reduce((a,b)=>a+b,0),1);
  assert(Math.abs(result.data.own-((129166.66666666667/100000)+(60000/(419725/7))+(4700/(349.3*776.6/7.6**2)))/3)<.000001);
  const tomorrow=await(await fetch('http://127.0.0.1:4174/api/day?date=2026-11-16')).json();assert.equal(tomorrow.questions.length,3);
  assert.equal((await post(randomUUID(),100,tomorrow.questions[0].id)).status,200,'Las nuevas preguntas admiten respuestas');
  server.kill();await once(server,'exit');await start();
  r=await post(first,100000);assert.equal(r.data.count,2,'Las respuestas sobreviven al reinicio');
  const jugador=await fetch('http://127.0.0.1:4174/api/jugador',{method:'POST',headers:{'Content-Type':'application/json',cookie:'faraday_jugador='+first},body:'{}'});
  assert.equal(jugador.headers.get('set-cookie'),`faraday_jugador=${first}; Path=/; Max-Age=31536000; HttpOnly; SameSite=Lax`,'En local (http) la cookie no lleva Secure');
  assert.deepEqual((await jugador.json()).progress,{'2026-11-09':[100000,60000,4700]},'La cookie recupera el progreso del archivo local');
  console.log('OK: muestra real, exclusión propia, idempotencia, validación, archivo privado, imagen, persistencia y cookie de jugador.');
}finally{if(server){server.kill();await once(server,'exit').catch(()=>{})}if(path.resolve(directory).startsWith(path.resolve(os.tmpdir())+path.sep))fs.rmSync(directory,{recursive:true,force:true})}

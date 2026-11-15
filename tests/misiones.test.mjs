// Prueba la experiencia, el nivel y las misiones que lleva el servidor (lib/misiones.mjs, decisión 0061): que las reglas
// son las del navegador y, a través de la API, que se cuentan y se pagan bien. Reloj controlado y cuenta falsa; sin red.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import {randomUUID,createHash} from 'node:crypto';
import {createApi} from '../lib/api.mjs';
import {fileStore} from '../lib/stores.mjs';
import {memoryDuels} from '../lib/duelos.mjs';
import {XP,MISSIONS,levelOf,pick,dailyIds,weeklyIds,mondayOf,roll,addAnswer,addDay,addDuel,missions,claim} from '../lib/misiones.mjs';
import {REASONS} from '../lib/comunidad.mjs';
import {getDay} from '../content-engine.mjs';

// 1. Las reglas del servidor son las del navegador (dist/progress.js y dist/duel.js).
const progressJs=fs.readFileSync(new URL('../dist/progress.js',import.meta.url),'utf8'),duelJs=fs.readFileSync(new URL('../dist/duel.js',import.meta.url),'utf8');
const flat=progressJs.replace(/\s/g,'');
assert.ok(flat.includes(`answerXp:${XP.answer},todayXp:${XP.today},`)&&flat.includes(`archiveXp:${XP.archive},`)&&flat.includes(`missionXp:${XP.mission},`)&&flat.includes(`levelCoins:${XP.levelCoins},`),'REWARD de progress.js ya no coincide con XP');
assert.ok(flat.includes('constlevelOf=xp=>Math.floor((1+Math.sqrt(1+xp/12.5))/2)'));
assert.deepEqual([levelOf(0),levelOf(99),levelOf(100),levelOf(299),levelOf(300),levelOf(4500),levelOf(43500)],[1,1,2,2,3,10,30]);
for(const [id,mission] of Object.entries(MISSIONS))assert.match(progressJs,new RegExp(`'${id}':\\{[^}]*goal:${mission.goal},coins:${mission.coins},`),`La misión ${id} ha cambiado en progress.js`);
// El sorteo de misiones es el mismo: se saca la función del navegador y se compara con muchas fechas.
{
  const source=progressJs.match(/function pick\(pool,count,seed\)\{.*?return list\.slice\(0,count\)\}/s)[0],theirs=vm.runInNewContext(`(${source})`);
  const lists=progressJs.match(/const DAILY=(\[[^\]]+\]),WEEKLY=(\[[^\]]+\])/);
  const DAILY=JSON.parse(lists[1].replaceAll("'",'"')),WEEKLY=JSON.parse(lists[2].replaceAll("'",'"'));
  for(let n=0;n<120;n++){
    const day=new Date(Date.parse('2026-11-01T12:00:00Z')+n*86400000).toISOString().slice(0,10);
    assert.deepEqual(dailyIds(day),['reto-hoy',...Array.from(theirs(DAILY,2,day))]);
    assert.deepEqual(weeklyIds(day),Array.from(theirs(WEEKLY,3,mondayOf(day))));
    assert.deepEqual(pick(DAILY,2,day),Array.from(theirs(DAILY,2,day)));
  }
  assert.equal(mondayOf('2026-11-15'),'2026-11-09');assert.equal(mondayOf('2026-11-16'),'2026-11-16');
}
// La experiencia del duelo es la de dist/duel.js.
for(const text of ["parts.push(['Victoria',100])","parts.push(['Primera victoria del día',50])","Math.min(50,(stats.streak-1)*10)","parts.push(['Empate',60])","parts.push(['Duelo completado',40])","rounds*10","DAILY_FULL=3,CAPPED_FACTOR=.25,BOT_FACTOR=.5"])assert.ok(duelJs.includes(text),'dist/duel.js ha cambiado: '+text);
assert.deepEqual(XP.duel,{win:100,firstWin:50,streakStep:10,streakMax:50,draw:60,loss:40,round:10,full:3,capped:.25,bot:.5});
assert.ok(!REASONS.includes('misiones')&&!REASONS.includes('nivel'));

// 2. Cuentas, sin almacén.
{
  const s=roll(null,'2026-11-16');
  assert.equal(addAnswer(s,{question:'q1',factor:1.1}),5);assert.equal(addAnswer(s,{question:'q1',factor:1.1}),0,'Una pregunta cuenta una vez');
  addAnswer(s,{question:'q2',factor:1.9});addAnswer(s,{question:'q3',factor:7});
  assert.deepEqual(s.day.c,{answers:3,near2:2,near125:1});assert.deepEqual(s.week.c,s.day.c);
  assert.equal(addDay(s,'reto'),30);assert.equal(addDay(s,'archivo'),10);
  // Duelos: victoria con primera del día, racha, empate, derrota, abandono, tope y bot.
  const duel=(id,result,extra={})=>addDuel(s,{id,result,abandoned:false,bot:false,rounds:5,...extra});
  assert.equal(duel('a','win'),100+50+50);assert.equal(duel('a','win'),null,'Un duelo cuenta una vez');
  assert.equal(duel('b','win'),100+10+50,'Segunda victoria seguida: +10 de racha, sin primera del día');
  assert.equal(duel('c','draw'),60+50);
  assert.equal(duel('d','loss'),Math.round((40+50)*.25),'El cuarto del día, al 25 %');
  assert.equal(duel('e','loss',{abandoned:true}),0);assert.equal(s.duel.count,4,'Abandonar no cuenta como duelo jugado');
  assert.deepEqual([s.day.c.duels,s.day.c.wins,s.duel.streak],[4,2,0]);
  const t=roll(null,'2026-11-16');assert.equal(addDuel(t,{id:'x',result:'win',abandoned:false,bot:true,rounds:4}),Math.round((100+50+40)*.5));
  // Al día siguiente los contadores del día empiezan de cero; los de la semana siguen. El lunes, los dos.
  roll(s,'2026-11-17');assert.deepEqual(s.day.c,{});assert.equal(s.week.c.answers,3);assert.equal(s.duel.count,0);
  roll(s,'2026-11-23');assert.deepEqual(s.week.c,{});
  // Recoger: solo las de hoy o de esta semana, completadas y una vez.
  const u=roll(null,'2026-11-16');u.day.c={today:1,near2:1,near125:1,answers:6,archive:1,duels:1,wins:1};
  assert.equal(claim(u,'reto-hoy','2026-11-16').coins,20);assert.equal(claim(u,'reto-hoy','2026-11-16'),null);
  const [,second]=dailyIds('2026-11-16'),other=Object.keys(MISSIONS).find(id=>!id.startsWith('sem-')&&!dailyIds('2026-11-16').includes(id));
  assert.deepEqual(claim(u,second,'2026-11-16'),{coins:MISSIONS[second].coins,xp:10,ref:'2026-11-16:'+second});
  assert.equal(claim(u,other,'2026-11-16'),null,'No es una misión de hoy');
  assert.equal(claim(u,weeklyIds('2026-11-16')[0],'2026-11-16'),null,'La semanal no está completa');
  assert.equal(missions(u,'2026-11-16').length,6);
}

// 3. Por la API.
const directory=fs.mkdtempSync(path.join(os.tmpdir(),'casi-misiones-'));
const at=date=>Date.parse(date+'T09:00:00Z');
let clock=at('2026-11-16');
const auth={async current(request,read){const player=read(request,'faraday_sesion');return player?{account:{id:'u-'+player,email:'x@y.z',player},cookies:[]}:null}};
const duels=memoryDuels(),hashOf=player=>createHash('sha256').update(player).digest('hex');
const api=createApi({playedDays:async()=>200,store:{...fileStore(path.join(directory,'answers.json')),duels},persistDays:false,now:()=>clock,auth,log:()=>{}});
async function post(route,body,player){
  const headers={'Content-Type':'application/json'};if(player)headers.cookie='faraday_sesion='+player;
  const response=await api.handle(new Request('http://casi.test/api/'+route,{method:'POST',headers,body:JSON.stringify(body)}));
  return {status:response.status,data:await response.json()};
}
const progress=(action,player,extra={})=>post('progreso',{action,...extra},player);
const state=async player=>(await progress('estado',player)).data,coinsOf=async player=>(await progress('leer',player)).data.coins;
async function play(player,date,factor=1,count=3){for(const question of getDay(date,{persist:false}).questions.slice(0,count))assert.equal((await post('answers',{question:question.id,player,guess:question.answer*factor})).status,200)}
async function finished(first,second,winner){
  const id=randomUUID(),one=player=>player==='bot'?{hash:'bot',bot:true}:{hash:hashOf(player)};
  await duels.create({id,code:id.slice(0,6).toUpperCase(),public:false,status:'finished',createdAt:clock,seenAt:clock,players:[one(first),one(second)],questions:['q'],rounds:[{},{},{},{},{}],winner,reason:'rondas',next:null});
  return id;
}
try{
  const luis=randomUUID(),ana=randomUUID(),nadie=randomUUID();
  assert.equal((await progress('estado',null)).status,401);assert.equal((await progress('mision',null,{id:'reto-hoy'})).status,401);
  await progress('guardar',luis,{state:{v:1,xp:90},delta:0});
  // La primera vez se parte de la experiencia que declara el navegador (con tope).
  let s=await state(luis);assert.equal(s.xp,90);assert.equal(s.level,1);
  assert.deepEqual(s.missions.map(m=>m.id),[...dailyIds('2026-11-16'),...weeklyIds('2026-11-16')]);
  assert.ok(s.missions.every(m=>m.progress===0&&!m.done&&!m.claimed));
  await progress('guardar',ana,{state:{v:1,xp:9e9},delta:0});assert.equal((await state(ana)).xp,45000,'Tope de la experiencia inicial');

  // Dos respuestas: 10 XP y cruza al nivel 2, que el servidor paga (30 ≈) una sola vez.
  await play(luis,'2026-11-16',1,2);
  s=await state(luis);assert.equal(s.xp,100);assert.equal(s.level,2);assert.equal(await coinsOf(luis),30);
  assert.equal((await progress('mision',luis,{id:'reto-hoy'})).data.code,'incompleto','El reto aún no está completo');
  // Repetir una respuesta no vuelve a contar; quien no tiene cuenta juega igual y no se apunta nada.
  await play(luis,'2026-11-16',1,2);assert.equal((await state(luis)).xp,100);
  await play(nadie,'2026-11-16');assert.equal((await progress('estado',nadie)).status,503);
  // Completa el reto: +5 de la tercera respuesta y +30 al cobrarlo.
  await play(luis,'2026-11-16');
  assert.equal((await progress('premio',luis,{day:'2026-11-16'})).data.amount,37);
  s=await state(luis);assert.equal(s.xp,135);
  const reto=s.missions.find(m=>m.id==='reto-hoy');assert.ok(reto.done&&!reto.claimed);
  // Recoger la misión: 20 ≈ y 10 XP, una vez.
  let r=await progress('mision',luis,{id:'reto-hoy'});
  assert.deepEqual(r.data,{coins:30+37+20,amount:20,xp:145,level:2});
  assert.equal((await progress('mision',luis,{id:'reto-hoy'})).data.code,'incompleto');
  assert.equal((await progress('mision',luis,{id:'no-existe'})).status,400);
  assert.equal(await coinsOf(luis),87);
  // Cobrar el reto otra vez no da más experiencia.
  await progress('premio',luis,{day:'2026-11-16'});assert.equal((await state(luis)).xp,145);

  // Un duelo ganado: 100 + 50 (primera del día) + 50 (cinco rondas) = 200 XP; pasa del nivel 2 al 3 (300 XP) y cobra 30 ≈ más.
  const id=await finished(luis,ana,0);
  r=await progress('premio',luis,{duel:id});assert.equal(r.data.amount,15);
  s=await state(luis);assert.equal(s.xp,345);assert.equal(s.level,3);assert.equal(await coinsOf(luis),87+30+15);
  await progress('premio',luis,{duel:id});assert.equal((await state(luis)).xp,345,'Un duelo cuenta una vez');
  for(const mission of s.missions.filter(m=>['duelo','duelo-gana'].includes(m.id)))assert.ok(mission.done,'Las misiones de duelo del día quedan completas');
  // Contra el bot, la mitad de experiencia; cuenta como duelo jugado.
  await progress('premio',ana,{duel:await finished(ana,'bot',1)});
  assert.equal((await state(ana)).xp,45000+Math.round((40+50)*.5));

  // El libro: nivel y misiones los apunta el servidor, con su referencia, y todo suma el saldo.
  const moves=(await progress('movimientos',luis)).data.moves;
  assert.deepEqual(moves.filter(m=>['nivel','misiones'].includes(m.reason)).map(m=>[m.reason,m.ref,m.amount,m.source]).reverse(),
    [['nivel','nivel-2',30,'servidor'],['misiones','2026-11-16:reto-hoy',20,'servidor'],['nivel','nivel-3',30,'servidor']]);
  assert.equal(moves.reduce((sum,m)=>sum+m.amount,0),await coinsOf(luis));

  // Al día siguiente, misiones nuevas y contadores del día a cero; la semana sigue.
  clock=at('2026-11-17');
  s=await state(luis);
  assert.deepEqual(s.missions.slice(0,3).map(m=>m.id),dailyIds('2026-11-17'));assert.ok(s.missions.slice(0,3).every(m=>m.progress===0));
  const weekly=s.missions.find(m=>m.id==='sem-retos');if(weekly)assert.equal(weekly.progress,1);

  console.log('misiones: OK');
}finally{fs.rmSync(directory,{recursive:true,force:true})}

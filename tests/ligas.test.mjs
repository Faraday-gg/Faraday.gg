// Prueba las ligas de amigos (lib/ligas.mjs) a través de la API, con un reloj controlado: no espera ni usa red.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {createApi} from '../lib/api.mjs';
import {fileStore,supabaseStore} from '../lib/stores.mjs';
import {RULES,weekOf,standings} from '../lib/ligas.mjs';
import {editorialDays} from '../content-engine.mjs';

const directory=fs.mkdtempSync(path.join(os.tmpdir(),'casi-ligas-'));
// 10:00 en Madrid (09:00 UTC en noviembre) del día indicado.
const at=date=>Date.parse(date+'T09:00:00Z');
let clock=at('2026-11-09'),seed=11;
const random=()=>{seed=(seed*16807)%2147483647;return seed/2147483647};
const days=new Map(editorialDays.map(day=>[day.id,day]));
const close=(a,b)=>Math.abs(a-b)<1e-9;

function build(store){
  const api=createApi({store,persistDays:false,now:()=>clock,random,log:()=>{}});
  const post=async(route,body)=>{const response=await api.handle(new Request('http://casi.test/api/'+route,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}));return {status:response.status,data:await response.json()}};
  const league=(action,player,extra={})=>post('liga',{action,player,...extra});
  // Responde las tres preguntas de un día multiplicando cada cifra real por factor.
  const play=async(player,date,factor)=>{for(const q of days.get(date).questions){const r=await post('answers',{question:q.id,player,guess:q.answer*factor});assert.equal(r.status,200)}};
  return {post,league,play};
}

try{
  // Semanas de lunes a domingo.
  assert.deepEqual(weekOf('2026-11-12'),{start:'2026-11-09',end:'2026-11-15',days:['2026-11-09','2026-11-10','2026-11-11','2026-11-12','2026-11-13','2026-11-14','2026-11-15']});
  assert.equal(weekOf('2026-11-15').start,'2026-11-09','El domingo cierra la semana');
  assert.equal(weekOf('2026-11-16').start,'2026-11-16','El lunes empieza otra');
  assert.equal(weekOf('2026-11-01').start,'2026-10-26','Funciona con el cambio de hora de octubre');

  const {post,league,play}=build(fileStore(path.join(directory,'answers.json')));
  const luis=randomUUID(),ana=randomUUID(),otra=randomUUID();

  // Crear: nombre obligatorio y limpio de HTML; el apodo también.
  assert.equal((await league('crear',luis,{leagueName:'   '})).status,400);
  assert.equal((await league('crear','no-soy-un-uuid',{leagueName:'Liga'})).status,400);
  let r=await league('crear',luis,{leagueName:'Los <b>cracks</b> de la oficina del tercero',name:'Luis <script>',avatar:{body:'hombre',top:'<x>'}});
  assert.equal(r.status,200);
  const code=r.data.code;
  assert.match(code,/^[A-Z2-9]{6}$/);
  assert.equal(r.data.name,'Los bcracks/b de la ofic','El nombre se limpia de HTML y se corta');
  assert.equal(r.data.member,true);assert.equal(r.data.rows.length,1);
  assert.equal(r.data.rows[0].name,'Luis script');assert.deepEqual(r.data.rows[0].avatar,{body:'hombre'});
  assert.equal(r.data.rows[0].you,true);assert.equal(r.data.rows[0].average,null,'Sin jugar aún no hay media');
  assert(!JSON.stringify(r.data).match(/[0-9a-f]{64}/),'Nunca salen los identificadores de nadie');

  // Unirse: código no válido, liga inexistente, vista previa para quien aún no es miembro.
  assert.equal((await league('unirse',ana,{code:'abc'})).status,400);
  assert.equal((await league('unirse',ana,{code:'ZZZZZZ'})).status,404);
  r=await league('ver',ana,{code});
  assert.deepEqual(r.data,{code,name:'Los bcracks/b de la ofic',member:false,members:1,max:15,full:false},'Quien no es miembro solo ve el nombre y cuántos son');
  r=await league('unirse',ana,{code:code.toLowerCase(),name:'Ana'});
  assert.equal(r.status,200);assert.equal(r.data.members,2);assert.equal(r.data.rows.find(row=>row.you).name,'Ana');
  r=await league('unirse',ana,{code,name:'Ana B'});
  assert.equal(r.data.members,2,'Unirse dos veces no duplica');assert.equal(r.data.rows.find(row=>row.you).name,'Ana B','Pero actualiza el apodo');

  // Límite de 15 miembros.
  const fillers=Array.from({length:13},()=>randomUUID());
  for(const [i,player] of fillers.entries())assert.equal((await league('unirse',player,{code,name:'Relleno '+i})).status,200);
  r=await league('unirse',otra,{code,name:'Otra'});
  assert.equal(r.status,409);assert.match(r.data.error,/completa/);
  assert.equal((await league('ver',otra,{code})).data.full,true);

  // Lunes: Luis juega el reto de hoy (2×). Ana no.
  await play(luis,'2026-11-09',2);
  r=await league('ver',luis,{code});
  let me=r.data.rows.find(row=>row.you);
  assert.equal(me.position,1);assert(close(me.average,2));assert.deepEqual(me.days[0],{played:2});
  assert.equal(r.data.rows.find(row=>row.name==='Ana B').average,null,'Hoy aún no cuenta para quien no lo ha jugado');

  // Martes: Ana juega el de hoy (1,5×) y el del lunes desde el archivo, que no cuenta.
  clock=at('2026-11-10');
  await play(ana,'2026-11-10',1.5);await play(ana,'2026-11-09',1);
  // Miércoles: el lunes y el martes ya están cerrados. Quien no jugó recibe la peor distancia del día, como poco 10×.
  clock=at('2026-11-11');
  r=await league('ver',ana,{code});
  const row=name=>r.data.rows.find(entry=>entry.name===name);
  assert.deepEqual(row('Ana B').days.slice(0,3),[{missed:10},{played:1.5},null],'El lunes jugado desde el archivo no cuenta');
  assert(close(row('Ana B').average,(10+1.5)/2));assert(close(row('Luis script').average,(2+10)/2));
  assert.equal(row('Ana B').position,1);assert.equal(row('Luis script').position,2);
  assert(close(row('Relleno 0').average,10));assert.equal(row('Relleno 0').played,0);
  assert.equal(row('Relleno 0').position,3);assert.equal(row('Relleno 12').position,3,'Empate: mismo puesto');
  await play(luis,'2026-11-11',1);
  r=await league('ver',luis,{code});
  assert(close(row('Luis script').average,(2+10+1)/3));assert.equal(row('Luis script').position,1,'Hoy cuenta en cuanto se juega');

  // Jueves: alguien juega muy mal (50×). El viernes, quien no jugó el jueves recibe ese 50×: saltarse un día nunca sale mejor.
  clock=at('2026-11-12');await play(fillers[0],'2026-11-12',50);
  clock=at('2026-11-13');
  r=await league('ver',luis,{code});
  assert.deepEqual(row('Luis script').days[3],{missed:50});assert(close(row('Relleno 0').days[3].played,50));

  // Una liga creada a mitad de semana empieza a contar ese día: los anteriores no cuentan para nadie.
  const late=(await league('crear',otra,{leagueName:'Tardía',name:'Otra'})).data;
  assert.equal(late.week.from,'2026-11-13');
  assert.deepEqual(late.rows[0].days.slice(0,5),[null,null,null,null,null]);assert.equal(late.rows[0].average,null);
  await league('salir',otra,{code:late.code});

  // Tus ligas: tu puesto y quién va primero.
  r=await league('mias',luis);
  assert.equal(r.data.leagues.length,1);assert.equal(r.data.leagues[0].position,1);assert.equal(r.data.leagues[0].leader.you,true);

  // Cambio de semana: el lunes 16 la clasificación empieza de cero y llega el resumen de la semana anterior.
  clock=at('2026-11-16');
  r=await league('ver',luis,{code});
  assert.equal(r.data.week.start,'2026-11-16');assert(r.data.rows.every(entry=>entry.average===null),'Semana nueva, nadie ha jugado');
  r=await league('resumen',ana);
  assert.deepEqual(r.data.week,{start:'2026-11-09',end:'2026-11-15'});
  assert.equal(r.data.leagues.length,1);
  let summary=r.data.leagues[0];
  // Luis: 2, 10, 1, 50, 10, 10, 10 → 13,29×. Ana: 10, 1,5, 10, 50, 10, 10, 10 → 14,5×.
  assert.equal(summary.winners.length,1);assert.equal(summary.winners[0].name,'Luis script');assert(close(summary.winners[0].average,93/7));
  assert.deepEqual(summary.winners[0].avatar,{body:'hombre'},'El ganador sale con su avatar');
  assert.equal(summary.position,2);assert(close(summary.average,101.5/7));assert.equal(summary.total,15);
  assert.equal((await league('resumen',luis)).data.leagues[0].winners[0].you,true);

  // Salir de una liga y entrar otra persona: quien entró esta semana no sale en el resumen de la pasada.
  assert.equal((await league('salir',ana,{code})).status,200);
  assert.deepEqual((await league('mias',ana)).data.leagues,[]);
  assert.equal((await league('ver',ana,{code})).data.member,false);
  assert.equal((await league('unirse',otra,{code,name:'Otra'})).status,200,'Al salir alguien queda sitio');
  assert.deepEqual((await league('resumen',otra)).data.leagues,[],'No estaba en la liga la semana pasada');
  summary=(await league('resumen',luis)).data.leagues[0];
  assert.equal(summary.total,14,'Ana ya no está y Otra entró después');

  // Varias ligas a la vez, con un tope; una liga creada esta semana no tiene resumen.
  r=await league('crear',luis,{leagueName:'Familia',name:'Luis'});
  assert.equal(r.status,200);assert.notEqual(r.data.code,code);
  assert.equal((await league('mias',luis)).data.leagues.length,2);
  assert.equal((await league('resumen',luis)).data.leagues.length,1);
  for(let i=2;i<RULES.maxLeagues;i++)assert.equal((await league('crear',luis,{leagueName:'Liga '+i})).status,200);
  assert.equal((await league('crear',luis,{leagueName:'Una más'})).status,409);

  // Cambiar de apodo o avatar se ve en todas tus ligas.
  await league('perfil',luis,{name:'Luis M',avatar:{body:'mujer'}});
  r=await league('ver',luis,{code});
  assert.equal(r.data.rows.find(entry=>entry.you).name,'Luis M');

  // Una liga vacía desaparece.
  const solo=(await league('crear',ana,{leagueName:'Solo yo'})).data.code;
  await league('salir',ana,{code:solo});
  assert.equal((await league('ver',ana,{code:solo})).status,404);

  // Se guarda en disco junto a las respuestas: sobrevive a reiniciar el servidor local.
  const again=build(fileStore(path.join(directory,'answers.json')));
  assert.equal((await again.league('ver',luis,{code})).data.members,15);

  // Desempate: con la misma media gana quien jugó más días.
  const week=weekOf('2026-11-09'),member=(hash,joinedAt=0)=>({hash,name:hash,avatar:{},joinedAt});
  const table=standings([member('a'),member('b')],{a:{'2026-11-09':10},b:{}},week,'2026-11-10');
  assert.deepEqual(table.map(entry=>[entry.member.hash,entry.position]),[['a',1],['b',2]]);

  // Si la base de datos falla (tablas sin crear), las ligas responden 503 y el juego sigue.
  const broken=fileStore(path.join(directory,'roto.json')),boom=async()=>{throw Error('relation "leagues" does not exist')};
  broken.leagues={byCode:boom,forPlayer:boom,create:boom,addMember:boom,removeMember:boom,updateProfile:boom,record:boom,results:boom};
  const down=build(broken);
  r=await down.league('mias',luis);
  assert.equal(r.status,503);assert.equal(r.data.error,'Las ligas no están disponibles ahora mismo');
  clock=at('2026-11-12');await down.play(luis,'2026-11-12',1);

  // Supabase: consultas a las tablas nuevas y el límite de 15 que pone la base de datos.
  const calls=[];
  const fake=async(url,init={})=>{
    calls.push({url:decodeURIComponent(url),method:init.method||'GET',body:init.body});
    if(init.method==='POST'&&url.includes('league_members'))return new Response('{"code":"P0001","message":"liga_llena"}',{status:400});
    if(url.includes('daily_results'))return Response.json([{player_hash:'a'.repeat(64),day:'2026-11-09',score:1.5}]);
    return Response.json([]);
  };
  const db=supabaseStore({url:'https://x.supabase.co',key:'k',fetch:fake}).leagues;
  assert.equal(await db.addMember({id:randomUUID(),members:[]},member('h'),15),'full','El disparador de la base de datos también corta en 15');
  assert.deepEqual(await db.results(['a'.repeat(64)],'2026-11-09','2026-11-15'),{['a'.repeat(64)]:{'2026-11-09':1.5}});
  assert(calls.at(-1).url.includes('day=gte.2026-11-09&day=lte.2026-11-15'));
  assert.deepEqual(await db.forPlayer('b'.repeat(64)),[]);

  console.log('ligas: ok');
}finally{fs.rmSync(directory,{recursive:true,force:true})}

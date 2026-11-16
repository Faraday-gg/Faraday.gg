// Prueba el pase de batalla (lib/pase.mjs, decisión 0079): la tabla de premios (que cada pieza, cofre e insignia existe),
// las cuentas (niveles, impulso, suscripción, cambio de temporada) y, a través de la API, que se avanza jugando, que cada
// premio se recoge una sola vez y que la pista prémium se abre entera al tener la suscripción. Reloj controlado; sin red.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import {randomUUID,createHash} from 'node:crypto';
import {createApi} from '../lib/api.mjs';
import {fileStore} from '../lib/stores.mjs';
import {PIECES,PASS_PIECES} from '../lib/catalogo.mjs';
import {Chests} from '../lib/cofres.mjs';
import {XP} from '../lib/misiones.mjs';
import {PASS,SEASONS,seasonAt,seasonOf,passLevel,rewardOf,passBox,passGain,claimable,claimables,passClaim,passView} from '../lib/pase.mjs';
import {getDay} from '../content-engine.mjs';

const load=file=>{const page={};page.window=page;vm.createContext(page);vm.runInContext(fs.readFileSync(new URL('../dist/'+file,import.meta.url),'utf8'),page);return page};
const {Avatar}=load('avatar.js'),{Medals}=load('medals.js'),progressJs=fs.readFileSync(new URL('../dist/progress.js',import.meta.url),'utf8');
const DAY=86400000,HOUR=3600000;

// 1. La tabla. Una temporada de 30 niveles; la pista prémium da algo en todos y la gratuita en casi todos.
const [t1]=SEASONS;
assert.deepEqual([t1.id,t1.from<t1.to,t1.rewards.length],['t1',true,PASS.levels]);
for(const [a,b] of SEASONS.map((season,i)=>[season,SEASONS[i+1]]).filter(([,next])=>next))assert.ok(a.to<b.from,'Las temporadas no se pisan');
assert.equal(seasonAt('2026-11-15'),null);assert.equal(seasonAt('2026-11-16'),t1);assert.equal(seasonAt('2026-12-31'),t1);assert.equal(seasonAt('2027-01-01'),null);
const all=t1.rewards.flatMap(([free,plus],i)=>[[free,'free',i+1],[plus,'plus',i+1]]).filter(([reward])=>reward),of=(track,kind)=>all.filter(([reward,name])=>name===track&&reward.kind===kind).map(([reward])=>reward);
assert.equal(all.filter(([,track])=>track==='plus').length,PASS.levels,'La pista prémium da un premio en cada nivel');
assert.ok(all.filter(([,track])=>track==='free').length>=20,'La pista gratuita da premio en la mayoría de los niveles');
assert.ok(rewardOf(t1,1,'free')&&rewardOf(t1,PASS.levels,'free'),'El primer nivel y el último dan premio gratis');
assert.equal(rewardOf(t1,1,'plus').kind,'item','Quien se suscribe estrena una pieza en el momento');
for(const [reward,track,level] of all){
  const where=`nivel ${level}, pista ${track}`;
  if(reward.kind==='coins')assert.ok(Number.isInteger(reward.amount)&&reward.amount>0&&reward.amount<=300,where);
  else if(reward.kind==='chest')assert.ok(Object.hasOwn(Chests.CHESTS,reward.type),where);
  else if(reward.kind==='boost')assert.ok(Number.isInteger(reward.hours)&&reward.hours>0,where);
  else if(reward.kind==='medal'){const found=Medals.parse(reward.id);assert.ok(found&&found.def.kind==='insignia'&&found.def.stat===reward.id,where);assert.ok(progressJs.includes(`'${reward.id}'`),`progress.js conoce la insignia ${reward.id}`)}
  else{
    assert.equal(reward.kind,'item',where);
    // Cada pieza del pase existe para los dos cuerpos, y ni se compra, ni sale en cofres, ni lleva acabado.
    const keys=PASS_PIECES.get(reward.id);assert.equal(keys?.length,2,where);
    for(const key of keys){const [slot,id]=key.split(':'),piece=Avatar.find(slot,id);assert.ok(piece.pase===t1.id&&piece.price===0);assert.equal(PIECES.has(key),false);assert.equal(Avatar.rarity(piece),'nivel');assert.equal(Avatar.finishable(piece),false)}
    assert.deepEqual(keys.map(key=>Avatar.find(...key.split(':')).for).sort(),['hombre','mujer']);
  }
}
const items=all.filter(([reward])=>reward.kind==='item').map(([reward])=>reward.id);
assert.equal(new Set(items).size,items.length,'Ninguna pieza sale dos veces');assert.equal(items.length,PASS_PIECES.size,'Todas las piezas del pase están en la tabla');
const medals=all.filter(([reward])=>reward.kind==='medal').map(([reward])=>reward.id);assert.equal(new Set(medals).size,medals.length);
// Los faradios del pase son pocos al lado de lo que se gana jugando (tope de 400 al día): no es comprar moneda.
const sum=list=>list.reduce((total,reward)=>total+reward.amount,0);
assert.equal(sum(of('free','coins')),620);assert.equal(sum(of('plus','coins')),1060);
// El navegador no da por tuya una pieza del pase que no esté en el inventario.
assert.ok(progressJs.includes('&&!item.edition&&!item.pase)||'));

// 2. Las cuentas.
assert.deepEqual([0,149,150,299,300,PASS.step*29-1,PASS.step*29,1e9,-5,NaN].map(passLevel),[1,1,2,2,3,29,30,30,1,1]);
{
  const stats={},today='2026-11-20',now=Date.parse('2026-11-20T10:00:00Z');
  assert.equal(passGain(stats,0,{today,now}),0);assert.equal(passGain({},50,{today:'2026-11-15',now}),0,'Fuera de temporada no suma');
  assert.equal(passGain(stats,100,{today,now}),100);assert.equal(passGain(stats,100,{today,now,plus:true}),120,'Con la suscripción, un 20 % más');
  assert.deepEqual(stats.pass,{s:'t1',xp:220,free:[],plus:[],boost:0});
  // Solo lo alcanzado, lo que da premio, una vez, y la pista prémium con la suscripción.
  assert.ok(claimable(stats.pass,1,'free',false));assert.ok(!claimable(stats.pass,1,'plus',false));assert.ok(claimable(stats.pass,1,'plus',true));
  assert.ok(!claimable(stats.pass,3,'free',true),'Nivel sin alcanzar');assert.ok(!claimable(stats.pass,2.5,'free',true));assert.ok(!claimable(stats.pass,1,'otra',true));assert.ok(!claimable(null,1,'free',true));
  assert.deepEqual(claimables(stats.pass,false),[{level:1,track:'free'},{level:2,track:'free'}]);assert.equal(claimables(stats.pass,true).length,4);
  assert.deepEqual(passClaim(stats,stats.pass,1,'free',{plus:false,now}),{level:1,track:'free',ref:'t1:free:1',kind:'coins',amount:30});
  assert.equal(passClaim(stats,stats.pass,1,'free',{plus:false,now}),null,'Una vez');assert.equal(passClaim(stats,stats.pass,1,'plus',{plus:false,now}),null);
  // Un nivel sin premio en la pista gratuita (el 7) no se puede recoger.
  stats.pass.xp=PASS.step*29;assert.equal(rewardOf(t1,7,'free'),null);assert.ok(!claimable(stats.pass,7,'free',true));
  // El impulso dobla la experiencia mientras dura; recoger otro lo alarga.
  assert.deepEqual(rewardOf(t1,3,'plus'),{kind:'boost',hours:24});
  passClaim(stats,stats.pass,3,'plus',{plus:true,now});assert.equal(stats.pass.boost,now+24*HOUR);
  const before=stats.pass.xp;assert.equal(passGain(stats,10,{today,now:now+HOUR}),20);assert.equal(passGain(stats,10,{today,now:now+HOUR,plus:true}),24);assert.equal(passGain(stats,10,{today:'2026-11-21',now:now+25*HOUR}),10);assert.equal(stats.pass.xp,before+54);
  passClaim(stats,stats.pass,9,'plus',{plus:true,now:now+HOUR});assert.equal(stats.pass.boost,now+48*HOUR,'Se suma al que quedaba');
  // Lo que venga roto se limpia.
  const broken={pass:{s:'t1',xp:'x',free:[1,1,99,'a',2],plus:null,boost:NaN}};passBox(broken,today);assert.deepEqual(broken.pass,{s:'t1',xp:0,free:[1,2],plus:[],boost:0});
  // Cambio de temporada: el pase anterior se guarda para recoger lo pendiente y el nuevo empieza de cero.
  SEASONS.push({id:'t2',n:2,name:'Prueba',from:'2027-01-01',to:'2027-02-01',rewards:t1.rewards});
  try{
    const old=structuredClone(stats.pass);assert.equal(passBox(stats,'2027-01-05'),seasonOf('t2'));
    assert.deepEqual(stats.pass,{s:'t2',xp:0,free:[],plus:[],boost:0});assert.deepEqual(stats.passOld,old);
    const view=passView(stats,{today:'2027-01-05',now:Date.parse('2027-01-05T10:00:00Z'),plus:false});
    assert.deepEqual([view.season.id,view.level,view.previous.id,view.previous.pending],['t2',1,'t1',claimables(old,false).length]);
    assert.ok(claimable(stats.passOld,30,'free',false),'Lo pendiente de la temporada anterior se sigue pudiendo recoger');
  }finally{SEASONS.pop()}
  assert.deepEqual(passView(stats,{today:'2027-03-01',now:0}),{season:null});
}

// 3. A través de la API.
const directory=fs.mkdtempSync(path.join(os.tmpdir(),'casi-pase-'));
let clock=Date.parse('2026-11-20T09:00:00Z');
const auth={async current(request,read){const player=read(request,'faraday_sesion');return player?{account:{id:'u-'+player,email:'x@y.z',player},cookies:[]}:null}};
const store=fileStore(path.join(directory,'answers.json')),hashOf=player=>createHash('sha256').update(player).digest('hex');
const api=createApi({playedDays:async()=>200,store,persistDays:false,now:()=>clock,auth,log:()=>{}});
async function post(route,body,player){
  const headers={'Content-Type':'application/json'};if(player)headers.cookie='faraday_sesion='+player;
  const response=await api.handle(new Request('http://casi.test/api/'+route,{method:'POST',headers,body:JSON.stringify(body)}));
  return {status:response.status,data:await response.json()};
}
const pass=async player=>(await post('progreso',{action:'pase'},player)).data,take=(player,body)=>post('progreso',{action:'pase-recoger',...body},player);
// Pone la experiencia del pase de un jugador, como si la hubiera ganado jugando.
async function setXp(player,xp){const row=await store.community.stats(hashOf(player));row.stats.pass.xp=xp;assert.ok(await store.community.saveStats(hashOf(player),row.xp,row.stats,row.version))}
try{
  const luis=randomUUID(),ana=randomUUID();
  // Sin cuenta se ve la temporada y sus premios, pero no hay avance ni nada que recoger.
  let view=await pass(null);
  assert.deepEqual([view.account,view.season.id,view.season.name,view.level,view.xp,view.ready,view.track.length,view.season.days],[false,'t1','Pioneros de la ciencia',1,0,1,PASS.levels,41]);
  assert.equal((await take(null,{level:1,track:'free'})).status,401);
  for(const player of [luis,ana])await post('progreso',{action:'guardar',state:{v:1,xp:0},delta:0},player);

  // Con cuenta: nivel 1, con su premio gratis listo y el prémium esperando a la suscripción.
  view=await pass(luis);
  assert.deepEqual([view.account,view.plus,view.level,view.into,view.ready,view.waiting],[true,false,1,0,1,1]);
  assert.deepEqual(view.track[0],{level:1,free:{kind:'coins',amount:30,state:'ready'},plus:{kind:'item',id:'top:pase-curie',state:'waiting'}});
  assert.deepEqual([view.track[1].free.state,view.track[6].free],['locked',null]);

  // Se avanza jugando: una respuesta da su experiencia también al pase.
  const question=getDay('2026-11-20',{persist:false}).questions[0];
  assert.equal((await post('answers',{question:question.id,player:luis,guess:question.answer*1.5})).status,200);
  assert.equal((await pass(luis)).xp,XP.answer);

  // Recoger: paga una vez, queda apuntado en el libro con su motivo y no se repite.
  const coins=async player=>(await post('progreso',{action:'leer'},player)).data.coins,start=await coins(luis);
  let got=await take(luis,{level:1,track:'free'});
  assert.equal(got.status,200);assert.deepEqual(got.data.rewards,[{level:1,track:'free',kind:'coins',amount:30}]);assert.equal(got.data.coins,start+30);
  assert.equal(got.data.pass.track[0].free.state,'claimed');assert.equal(got.data.pass.ready,0);
  const [move]=(await post('progreso',{action:'movimientos'},luis)).data.moves;assert.deepEqual([move.reason,move.amount,move.ref,move.source],['pase',30,'t1:free:1','servidor']);
  for(const body of [{level:1,track:'free'},{level:1,track:'plus'},{level:2,track:'free'},{all:true}]){const again=await take(luis,body);assert.deepEqual([again.status,again.data.code],[409,'incompleto'])}
  for(const body of [{level:1.5,track:'free'},{level:1,track:'oro'},{}])assert.equal((await take(luis,body)).status,400);
  assert.equal(await coins(luis),start+30);

  // Con niveles ganados y sin suscripción: «recoger todo» da solo la pista gratuita; la prémium sigue esperando.
  await setXp(luis,PASS.step*5+10);view=await pass(luis);
  assert.deepEqual([view.level,view.into,view.ready,view.waiting],[6,10,5,6]);
  got=await take(luis,{all:true});
  assert.deepEqual(got.data.rewards.map(reward=>[reward.level,reward.track,reward.kind]),[[2,'free','chest'],[3,'free','item'],[4,'free','coins'],[5,'free','chest'],[6,'free','coins']]);
  assert.equal(got.data.coins,start+30+30+40);assert.deepEqual([got.data.chests.chispa,got.data.chests.iman],[1,1],'Los cofres van a los cofres del jugador');
  const owned=async player=>(await post('progreso',{action:'inventario'},player)).data.items;
  assert.deepEqual((await owned(luis)).filter(one=>one.source==='pase').map(one=>one.item).sort(),['top:mj-pase-atomo','top:pase-atomo'],'La pieza, para los dos cuerpos');
  assert.deepEqual([got.data.pass.ready,got.data.pass.waiting],[0,6]);

  // Al tener la suscripción, todo lo prémium de los niveles ya ganados se recoge de golpe.
  await store.community.setSubscription(hashOf(luis),clock+30*DAY,'manual');
  view=await pass(luis);assert.deepEqual([view.plus,view.ready,view.waiting],[true,6,0]);
  got=await take(luis,{all:true});
  assert.deepEqual(got.data.rewards.map(reward=>[reward.level,reward.kind]),[[1,'item'],[2,'coins'],[3,'boost'],[4,'chest'],[5,'coins'],[6,'item']]);assert.ok(got.data.rewards.every(reward=>reward.track==='plus'));
  assert.equal(got.data.coins,start+100+60+100);assert.equal(got.data.pass.boost,clock+24*HOUR);
  assert.deepEqual((await owned(luis)).filter(one=>one.source==='pase').length,6);
  // Con el impulso y la suscripción, la siguiente respuesta da más: 5 × 2 × 1,2.
  const second=getDay('2026-11-20',{persist:false}).questions[1],xp=(await pass(luis)).xp;
  await post('answers',{question:second.id,player:luis,guess:second.answer*1.5});assert.equal((await pass(luis)).xp,xp+XP.answer*PASS.boost*(1+PASS.plusBonus));
  // Si la suscripción caduca, lo recogido se queda y lo prémium que falte vuelve a esperar.
  await setXp(luis,PASS.step*7);clock+=31*DAY;view=await pass(luis);
  assert.deepEqual([view.plus,view.level,view.track[0].plus.state,view.track[6].plus.state,view.boost],[false,8,'claimed','waiting',null]);
  assert.equal((await take(luis,{level:7,track:'plus'})).status,409);

  // El pase entero: 30 niveles, y al final no queda nada por recoger.
  await store.community.setSubscription(hashOf(ana),clock+30*DAY,'manual');await pass(ana);await setXp(ana,PASS.step*40);
  view=await pass(ana);assert.deepEqual([view.level,view.into,view.ready],[PASS.levels,PASS.step,all.length]);
  const before=await coins(ana);got=await take(ana,{all:true});
  assert.equal(got.data.rewards.length,all.length);assert.equal(got.data.coins,before+620+1060);
  assert.deepEqual([got.data.pass.ready,got.data.pass.waiting],[0,0]);assert.equal((await take(ana,{all:true})).status,409);
  assert.equal((await owned(ana)).filter(one=>one.source==='pase').length,PASS_PIECES.size*2);
  // Una temporada que no es la suya no se recoge.
  assert.equal((await take(ana,{all:true,season:'t9'})).status,409);

  console.log(`pase: OK (${PASS.levels} niveles, ${all.length} premios, ${PASS_PIECES.size} piezas y ${medals.length} insignias)`);
}finally{fs.rmSync(directory,{recursive:true,force:true})}

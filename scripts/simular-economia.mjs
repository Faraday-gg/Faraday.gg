// Simulador de la economía de faradios (fase 0 de la decisión 0055). Juega muchos jugadores de mentira durante meses con
// las reglas del juego y cuenta cuántos faradios se emiten, cuántos se gastan y cuánto tarda en agotarse el catálogo.
// Sirve para fijar las cifras de la economía nueva antes de programarla. No toca el juego ni ningún servicio.
//
//   node scripts/simular-economia.mjs            tabla de los tres perfiles con las reglas de hoy y las propuestas
//   node scripts/simular-economia.mjs 365 400    días simulados y jugadores por perfil
//
// Los cofres y el catálogo son los de verdad (dist/chests.js y dist/avatar.js). Los premios de dist/progress.js y
// dist/duel.js están copiados en HOY porque esos archivos necesitan la página; tests/economia.test.mjs avisa si cambian.
import fs from 'node:fs';
import vm from 'node:vm';
import {pathToFileURL} from 'node:url';

const page={};page.window=page;vm.createContext(page);
for(const file of ['dist/avatar.js','dist/chests.js'])vm.runInContext(fs.readFileSync(new URL('../'+file,import.meta.url),'utf8'),page,{filename:file});
export const {Avatar,Chests}=page;

// Lo que da cada misión (dist/progress.js, MISSIONS). test = cuándo cuenta, sobre lo jugado en el día o en la semana.
export const MISSIONS={
  'reto-hoy':{coins:20,test:d=>d.today},'cerca-2':{coins:15,test:d=>d.near2>=1},'cerca-125':{coins:25,test:d=>d.near125>=1},
  'seis':{coins:20,test:d=>d.answers>=6},'archivo':{coins:15,test:d=>d.archive>=1},'duelo':{coins:15,test:d=>d.duels>=1},
  'duelo-gana':{coins:25,test:d=>d.wins>=1},
  'sem-retos':{coins:80,test:w=>w.today>=5},'sem-cerca':{coins:60,test:w=>w.near2>=10},'sem-duelos':{coins:80,test:w=>w.wins>=3},
  'sem-jugar':{coins:60,test:w=>w.duels>=5}
};
const DAILY=['cerca-2','cerca-125','seis','archivo','duelo','duelo-gana'],WEEKLY=['sem-retos','sem-cerca','sem-duelos','sem-jugar'];

// Reglas de antes de la economía nueva (decisiones 0024, 0027, 0036, 0039, 0044 y 0052). Se conservan para comparar.
export const HOY={
  name:'Antes',welcome:100,answerXp:5,todayXp:30,todayCoins:20,archiveXp:10,archiveCoins:5,streakCoins:2,streakCap:7,missionXp:10,
  accuracy:[[1.5,15],[2,10],[3,5]],duel:{win:15,loss:5,full:3,capped:.25,rounds:5},levelCoins:30,
  charge:{today:40,archive:10,duel:20,duelCapped:5,full:100},
  // Premio por completar las tres misiones del día y las tres de la semana.
  dailySet:{chest:'chispa',coins:0},weeklySet:{chest:'rayo',coins:0},
  hint:100,vote:10,propose:50,buyCap:Chests.BUY_CAP,
  // Apuestas: contra la banca (gana otro tanto) o bote entre los dos con comisión.
  bets:{mode:'banca',rake:0,cap:5,tiers:[[15,150],[12,60],[10,25]]},
  // Lo que todavía no existe: ediciones de colección, protector de racha, comisión del mercado y tope diario de ganancias.
  editions:null,protector:null,market:null,reroll:null,cap:null,
  // Lote de faradios cuando el cofre trae una pieza de una rareza que ya se tiene entera, en veces el de dist/chests.js.
  // Antes era cuatro veces el de ahora (40, 90, 180, 380 y 800).
  fallback:4
};
// Economía nueva (decisiones 0055, 0056 y 0066). Lo que ya está en el juego: las tres misiones del día dan faradios,
// el lote reducido, el tope diario, las apuestas en bote, las ediciones, el protector de racha y cambiar una misión
// (decisiones 0067 y 0069). Lo que falta: el mercado.
export const PROPUESTA={
  ...HOY,name:'Propuesta',
  // Un cofre Chispa gratis al día en vez de dos: completar las misiones del día da faradios, no cofre.
  dailySet:{chest:null,coins:40},
  bets:{...HOY.bets,mode:'bote',rake:.1},
  // Una edición de colección cada `every` días, a `price` faradios, desde el nivel `level`. Es venta del juego: se destruye entera.
  editions:{every:7,price:1200,level:10},
  protector:{price:150,from:3},
  // Comisión destruida de lo que el jugador mueve en el mercado cada semana (profile.market).
  market:{fee:.1,level:10},
  reroll:{price:30},
  cap:400,fallback:1
};

// Tres jugadores tipo. playToday = probabilidad de jugar el reto cada día; sigma = dispersión de sus respuestas (menos es
// mejor); archive y duels = partidas al día; winRate = duelos ganados; policy = en qué gasta: 'tienda' elige pieza y ahorra,
// 'cofres' compra el cofre más rentable que puede pagar.
export const PERFILES={
  ocasional:{name:'Ocasional',playToday:.6,sigma:1.1,archive:0,duels:0,winRate:.45,hints:.02,votes:0,proposals:0,bets:0,market:0,rerolls:0,policy:'tienda'},
  diario:{name:'Diario',playToday:.92,sigma:.85,archive:.3,duels:2,winRate:.5,hints:.05,votes:2,proposals:0,bets:0,market:300,rerolls:1,policy:'tienda'},
  intenso:{name:'Intenso',playToday:.99,sigma:.65,archive:1,duels:5,winRate:.6,hints:.1,votes:5,proposals:1,bets:5,market:1200,rerolls:3,policy:'cofres'}
};

export const levelOf=xp=>Math.floor((1+Math.sqrt(1+xp/12.5))/2);
function seeded(seed){return()=>{seed=(seed*16807)%2147483647;return (seed-1)/2147483646}}
const times=(mean,random)=>Math.floor(mean)+(random()<mean%1?1:0);
function sample(pool,count,random){const list=[...pool];for(let i=list.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[list[i],list[j]]=[list[j],list[i]]}return list.slice(0,count)}
// Catálogo que ve un cuerpo: lo que se compra y puede salir en cofres.
export function catalog(body='hombre'){
  return Avatar.CATALOG.filter(item=>item.price>0&&!item.level&&(!item.for||item.for===body)).map(item=>({key:item.slot+':'+item.id,rarity:Avatar.rarity(item),price:item.price}));
}

// Simula un jugador. Devuelve lo emitido y lo gastado por concepto, el valor de las piezas recibidas en cofres, el día en
// que completó el catálogo (o null) y una foto diaria del saldo.
export function simulate({rules=HOY,profile=PERFILES.diario,days=180,seed=1,body='hombre'}={}){
  const random=seeded(seed*7919+17),missing=new Map(catalog(body).map(item=>[item.key,item]));
  const total=missing.size,emitted={},spent={},s={coins:0,xp:0,streak:0,charge:0,pity:0,chests:0,itemValue:0,target:null,complete:null,earnedToday:0,week:null,moved:0,daily:[],flow:[]};
  const add=(bag,key,amount)=>{bag[key]=(bag[key]||0)+amount},sum=bag=>Object.values(bag).reduce((a,b)=>a+b,0);
  // Lo que se gana pasa por el tope diario, si lo hay. Lo que sale de un cofre o de vender no cuenta para el tope.
  function earn(source,amount,capped=true){
    if(capped&&rules.cap!=null){amount=Math.max(0,Math.min(amount,rules.cap-s.earnedToday));s.earnedToday+=amount}
    if(amount>0){s.coins+=amount;add(emitted,source,amount)}
  }
  function pay(sink,amount){if(s.coins<amount)return false;s.coins-=amount;add(spent,sink,amount);return true}
  function open(type){
    s.chests++;
    const result=Chests.roll(type,{items:[...missing.values()],pity:s.pity,random});s.pity=result.pity;
    for(const reward of result.rewards){
      if(reward.kind==='coins')earn(reward.instead?'cofres (pieza repetida)':'cofres (lote)',reward.instead?Math.round(reward.amount*rules.fallback):reward.amount,false);
      else{s.itemValue+=missing.get(reward.key).price;missing.delete(reward.key)}
    }
  }
  function gain(xp){
    const before=levelOf(s.xp);s.xp+=xp;
    for(let level=before+1;level<=levelOf(s.xp);level++){earn('nivel',rules.levelCoins);open(Chests.levelChest(level))}
  }
  function charge(amount){s.charge+=amount;while(s.charge>=rules.charge.full){s.charge-=rules.charge.full;open('chispa')}}
  function set(prize){if(prize.chest)open(prize.chest);if(prize.coins)earn('misiones',prize.coins)}
  // En qué se van los faradios que sobran.
  function shop(day){
    if(rules.editions&&levelOf(s.xp)>=rules.editions.level&&day%rules.editions.every===0)s.edition=true;
    if(s.edition&&pay('ediciones',rules.editions.price))s.edition=false;
    // Quien quiere la edición ahorra para ella antes de gastar en lo demás.
    if(s.edition)return;
    if(profile.policy==='cofres'){
      const prices={};for(const rarity of Chests.RARITIES){const left=[...missing.values()].filter(item=>item.rarity===rarity);prices[rarity]=left.length?left.reduce((sum,item)=>sum+item.price,0)/left.length:Chests.FALLBACK[rarity]*rules.fallback}
      for(let bought=0;bought<rules.buyCap;bought++){
        const best=Chests.TYPES.filter(type=>Chests.CHESTS[type].price<=s.coins).map(type=>[Chests.value(type,prices)/Chests.CHESTS[type].price,type]).sort((a,b)=>b[0]-a[0])[0];
        // Solo compra si de media sale a cuenta.
        if(!best||best[0]<=1||!missing.size)break;
        pay('cofres comprados',Chests.CHESTS[best[1]].price);open(best[1]);
      }
      return;
    }
    for(;;){
      if(!s.target||!missing.has(s.target)){const left=[...missing.keys()];if(!left.length)return;s.target=left[Math.floor(random()*left.length)]}
      const item=missing.get(s.target);if(!pay('tienda',item.price))return;
      missing.delete(s.target);s.target=null;
    }
  }

  earn('bienvenida',rules.welcome,false);open('chispa');
  for(let day=1;day<=days;day++){
    s.earnedToday=0;
    if((day-1)%7===0)s.week={ids:sample(WEEKLY,3,random),done:new Set(),today:0,near2:0,wins:0,duels:0};
    const d={today:false,answers:0,near2:0,near125:0,archive:0,duels:0,wins:0},week=s.week;
    const answer=()=>{const factor=Math.exp(Math.abs(profile.sigma*Math.sqrt(-2*Math.log(1-random()))*Math.cos(2*Math.PI*random())));d.answers++;if(factor<2){d.near2++;week.near2++}if(factor<1.25)d.near125++;gain(rules.answerXp);return factor};
    // Reto de hoy y racha.
    if(random()<profile.playToday){
      d.today=true;week.today++;s.streak++;
      const average=(answer()+answer()+answer())/3,bonus=(rules.accuracy.find(([limit])=>average<limit)||[0,0])[1];
      charge(rules.charge.today);const prize=Chests.streakChest(s.streak);if(prize)open(prize);
      earn('reto del día',rules.todayCoins+bonus+Math.min(s.streak,rules.streakCap)*rules.streakCoins);gain(rules.todayXp);
    }else if(rules.protector&&s.streak>=rules.protector.from&&pay('protector de racha',rules.protector.price)){/* la racha se conserva */}
    else s.streak=0;
    // Archivo.
    for(let n=times(profile.archive,random);n>0;n--){answer();answer();answer();d.archive++;charge(rules.charge.archive);earn('archivo',rules.archiveCoins);gain(rules.archiveXp)}
    // Duelos, con su tope diario, y apuestas.
    const betTier=rules.bets.tiers.find(([level])=>levelOf(s.xp)>=level);
    for(let n=0,count=times(profile.duels,random);n<count;n++){
      const win=random()<profile.winRate,capped=n>=rules.duel.full,factor=capped?rules.duel.capped:1;
      if(betTier&&n<Math.min(profile.bets,rules.bets.cap)&&s.coins>=betTier[1]){
        const stake=betTier[1];s.coins-=stake;
        if(rules.bets.mode==='banca'){if(win){s.coins+=stake*2;add(emitted,'apuestas',stake)}else add(spent,'apuestas',stake)}
        // En el bote lo que se gana sale del rival y lo que se pierde va al rival: no se crea ni se destruye. Solo la
        // comisión sale de la economía, a medias entre los dos.
        else{const fee=Math.round(stake*rules.bets.rake);add(spent,'apuestas (comisión)',fee);if(win){s.coins+=stake*2-fee*2;s.moved+=stake-fee}else s.moved-=stake-fee}
      }
      d.duels++;week.duels++;if(win){d.wins++;week.wins++}
      earn('duelos',Math.round(rules.duel[win?'win':'loss']*factor));charge(capped?rules.charge.duelCapped:rules.charge.duel);
      gain(Math.round(((win?100+(d.wins===1?50:0):40)+rules.duel.rounds*10)*factor));
    }
    // Misiones del día (la del reto y dos al azar) y de la semana.
    const ids=['reto-hoy',...sample(DAILY,2,random)];let done=0;
    for(const id of ids)if(MISSIONS[id].test(d)){done++;earn('misiones',MISSIONS[id].coins);gain(rules.missionXp)}
    if(done<3&&rules.reroll&&profile.rerolls&&random()<profile.rerolls/7)pay('repetir misión',rules.reroll.price);
    if(done===3)set(rules.dailySet);
    for(const id of week.ids)if(!week.done.has(id)&&MISSIONS[id].test(week)){week.done.add(id);earn('misiones',MISSIONS[id].coins);gain(rules.missionXp);if(week.done.size===3)set(rules.weeklySet)}
    // Gastos pequeños: pistas, votos, propuestas y comisión del mercado.
    if(d.today&&random()<profile.hints)pay('pistas',rules.hint);
    if(day%7===0){
      for(let n=0;n<profile.votes;n++)pay('comunidad',rules.vote);
      for(let n=0;n<profile.proposals;n++)pay('comunidad',rules.propose);
      if(rules.market&&levelOf(s.xp)>=rules.market.level)pay('comisión del mercado',Math.round(Math.min(profile.market,s.coins)*rules.market.fee));
    }
    shop(day);
    if(!missing.size&&s.complete==null)s.complete=day;
    s.daily.push(s.coins);s.flow.push([sum(emitted),sum(spent)]);
  }
  return {moved:s.moved,flow:s.flow,emitted,spent,emittedTotal:sum(emitted),spentTotal:sum(spent),itemValue:s.itemValue,chests:s.chests,level:levelOf(s.xp),balance:s.coins,complete:s.complete,
    owned:total-missing.size,total,daily:s.daily};
}

// Media de muchos jugadores del mismo perfil.
export function average({rules,profile,days=180,players=200}){
  const runs=Array.from({length:players},(_,seed)=>simulate({rules,profile,days,seed:seed+1})),mean=pick=>runs.reduce((sum,run)=>sum+pick(run),0)/players;
  const bag=key=>{const out={};for(const run of runs)for(const [name,amount] of Object.entries(run[key]))out[name]=(out[name]||0)+amount/players;return out};
  const emitted=mean(run=>run.emittedTotal),spent=mean(run=>run.spentTotal),items=mean(run=>run.itemValue),done=runs.filter(run=>run.complete!=null);
  // Las piezas de cofres comprados no son un regalo: se pagaron. Lo que el jugador recibe sin pagar es lo emitido más las
  // piezas de los cofres ganados; se aproxima quitando lo pagado en cofres.
  const bought=mean(run=>run.spent['cofres comprados']||0),gifted=Math.max(0,items-bought);
  return {days,players,emitted:bag('emitted'),spent:bag('spent'),perDay:emitted/days,itemsPerDay:gifted/days,coinShare:emitted/(emitted+gifted),
    sinkRatio:spent/emitted,balance:mean(run=>run.balance),level:mean(run=>run.level),owned:mean(run=>run.owned/run.total),
    completed:done.length/players,completeDay:done.length?done.reduce((sum,run)=>sum+run.complete,0)/done.length:null,
    // Gasto frente a emisión en los últimos 60 días: dice si la moneda sigue teniendo salida cuando el jugador ya lleva tiempo.
    lateRatio:(()=>{const from=Math.max(0,days-60);let e=0,g=0;for(const run of runs){const [e0,g0]=from?run.flow[from-1]:[0,0],[e1,g1]=run.flow[days-1];e+=e1-e0;g+=g1-g0}return g/e})(),
    moved:mean(run=>run.moved)};
}

if(import.meta.url===pathToFileURL(process.argv[1]||'').href){
  const days=Number(process.argv[2])||180,players=Number(process.argv[3])||200,int=n=>Math.round(n).toLocaleString('es-ES'),pct=n=>Math.round(n*100)+' %';
  for(const rules of [HOY,PROPUESTA]){
    console.log(`\n== ${rules.name}: ${days} días, ${players} jugadores por perfil ==`);
    console.table(Object.fromEntries(Object.values(PERFILES).map(profile=>{
      const r=average({rules,profile,days,players});
      return [profile.name,{'≈ emitidos/día':int(r.perDay),'piezas de cofre gratis/día (≈)':int(r.itemsPerDay),'peso de la moneda':pct(r.coinShare),'gastado/emitido':pct(r.sinkRatio),
        'gastado/emitido (últimos 60 d)':pct(r.lateRatio),'saldo final':int(r.balance),'nivel':int(r.level),'catálogo':pct(r.owned),'lo completan':pct(r.completed)+(r.completeDay?` (día ${int(r.completeDay)})`:'')}];
    })));
    const r=average({rules,profile:PERFILES.diario,days,players});
    console.log('Jugador diario, faradios emitidos por concepto:',Object.fromEntries(Object.entries(r.emitted).map(([k,v])=>[k,int(v)])));
    console.log('Jugador diario, faradios gastados por concepto:',Object.fromEntries(Object.entries(r.spent).map(([k,v])=>[k,int(v)])));
  }
}

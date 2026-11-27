// Juegos de los duelos. Un duelo puede ser de estimación (el de siempre), de Ascensión, de Traza la tendencia o de
// Archivo Vivo. Aquí viven los tiempos de cada juego y los adaptadores de los tres nuevos: qué rondas pueden salir,
// cómo se valida y se puntúa una respuesta, qué ve el jugador en la pregunta y en el resultado, y cómo juega Faraday-bot.
// El motor (lib/duelos.mjs) no sabe nada de cada juego: solo llama a estas funciones. El de estimación está en el motor.
//
// Un adaptador es un objeto con:
//   rules                 → tiempos y rondas del juego (GAME_RULES)
//   pool(ahora)           → ids de las rondas que pueden salir hoy (sin lo que sale en la edición diaria de ese modo)
//   pick(ids, cuántas)    → las rondas del duelo, ya ordenadas de menos vistas a más vistas (opcional)
//   item(id)              → la ronda completa, con la solución (nunca sale tal cual del servidor)
//   shape(respuesta)      → true si la respuesta tiene la forma que toca (si no, 400)
//   accept(item, resp.)   → {guess} con lo que se guarda, o {status, error, code} si no vale
//   score(item, guess)    → puntos de 0 a 5000, la misma escala que la estimación, para que vida y daño funcionen igual
//   question(item)        → lo que se manda durante la pregunta (sin la solución)
//   solved(item, guesses) → lo que se añade a la ronda al resolverla: {marks, reveal}
//   review(item, guesses) → lo mismo, resumido, para el repaso del final
//   bot(item, azar)       → la respuesta de Faraday-bot
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import {madridDate} from '../content-engine.mjs';
import {gameStakes} from './apuestas.mjs';
import {ASCENSION_TIERS,ascensionAnswer,ascensionEdition,validateAscensionBank} from './ascension.mjs';
import {simulateTrends,trendEdition,trendScore} from './tendencias.mjs';
import * as archive from '../dist/archivo-vivo-rondas.js';

export const MAX_POINTS=5000;
export const GAME_IDS=['estimacion','ascension','traza','archivo'];
export const GAME_NAMES={estimacion:'Estimación',ascension:'Ascensión',traza:'Traza la tendencia',archivo:'Archivo Vivo'};
// Tiempos (decididos para que dé tiempo a leer, pensar y escribir, pero no a buscarlo en internet):
//   roundMs = plazo de la ronda; rushMs = lo que les queda a los demás cuando alguien responde;
//   revealMs = cuánto se ve el resultado; maxRounds = rondas como mucho; bot = [mínimo, margen] de lo que tarda el bot
//   (siempre responde con tiempo de sobra para que a la persona le quede entero el plazo recortado).
export const GAME_RULES={
  estimacion:{roundMs:60000,rushMs:20000,revealMs:10000,maxRounds:10,bot:[8000,30000]},
  ascension:{roundMs:25000,rushMs:10000,revealMs:10000,maxRounds:7,bot:[5000,9000]},
  traza:{roundMs:45000,rushMs:15000,revealMs:12000,maxRounds:5,bot:[12000,17000]},
  archivo:{roundMs:45000,rushMs:15000,revealMs:12000,maxRounds:5,bot:[9000,20000]}
};
// Juego pedido por el navegador: sin campo es estimación (los duelos de antes no lo llevan); uno desconocido, null.
export const gameId=value=>value===undefined||value===null||value===''?'estimacion':GAME_IDS.includes(value)?value:null;
// Lo que el portal de duelos necesita saber de cada juego antes de empezar uno. stakes = si sus duelos admiten apuesta
// y pagan faradios (lib/apuestas.mjs): con false, el portal no enseña el selector de apuesta ni promete premio.
export const gameList=()=>GAME_IDS.map(id=>{const {roundMs,rushMs,maxRounds}=GAME_RULES[id];return {id,name:GAME_NAMES[id],rules:{roundMs,rushMs,maxRounds},ranked:id==='estimacion',sizes:[2,3],bot:true,stakes:gameStakes(id)}});

const read=name=>JSON.parse(fs.readFileSync(new URL('../content/'+name,import.meta.url),'utf8'));
const today=now=>madridDate(new Date(now));
// Variedad: recorre los ids en su orden y deja pasar como mucho `limit` de cada grupo; si faltan, completa con el resto.
function spread(ids,count,groupOf,limit=2){
  const chosen=[],used=new Map();
  for(const id of ids){
    if(chosen.length===count)break;
    const groups=groupOf(id).filter(Boolean);
    if(groups.some(group=>(used.get(group)||0)>=limit))continue;
    chosen.push(id);for(const group of groups)used.set(group,(used.get(group)||0)+1);
  }
  return [...chosen,...ids.filter(id=>!chosen.includes(id))].slice(0,count);
}

// Ascensión: una categoría y una respuesta escrita. Cuanto más rara es la respuesta, más puntos (10–100 → 500–5000).
// Una respuesta que no está en el banco no se guarda: se puede probar otra mientras quede tiempo, como en el modo.
function ascensionGame(raw){
  const bank=validateAscensionBank(raw||read('ascension.json')),byId=new Map(bank.categories.map(category=>[category.id,category]));
  const tierOf=points=>ASCENSION_TIERS.find(tier=>tier.points===points)||ASCENSION_TIERS[0];
  const found=(category,name)=>name==null?null:category.answers.find(answer=>answer.name===name)||null;
  const mark=answer=>answer?{raw:answer.points,tier:answer.million?'million':tierOf(answer.points).id,label:answer.million?'1 de un millón':tierOf(answer.points).name}:null;
  let daily={day:'',ids:new Set()};
  function edition(now){
    const day=today(now);
    if(daily.day!==day){let ids=[];try{ids=ascensionEdition(day,bank,0).map(category=>category.id)}catch{}daily={day,ids:new Set(ids)}}
    return daily.ids;
  }
  // Otras respuestas de la categoría, una por nivel de rareza, sin las que ya han dado los jugadores.
  function examples(category,guesses){
    const order=name=>createHash('sha256').update(category.id+'/'+name).digest('hex');
    const rest=category.answers.filter(answer=>!answer.million&&!guesses.includes(answer.name)).sort((a,b)=>order(a.name).localeCompare(order(b.name)));
    return ASCENSION_TIERS.slice(1).flatMap(tier=>{const answer=rest.find(one=>one.points===tier.points);return answer?[{name:answer.name,...mark(answer)}]:[]});
  }
  const solved=(category,guesses)=>({marks:guesses.map(guess=>mark(found(category,guess))),
    reveal:{count:category.answers.length,examples:examples(category,guesses),sources:category.sources.map(({title,url,license,attribution})=>({title,url,...(license?{license}:{}),...(attribution?{attribution}:{})}))}});
  return {id:'ascension',rules:GAME_RULES.ascension,
    pool:now=>{const skip=edition(now);return bank.categories.filter(category=>!skip.has(category.id)).map(category=>category.id)},
    // Como mucho dos categorías del mismo tema y dos de las difíciles por duelo.
    pick:(ids,count)=>spread(ids,count,id=>{const category=byId.get(id);return ['tema:'+category.theme,category.audience==='challenge'?'reto':'']}),
    item:id=>byId.get(id),
    shape:guess=>typeof guess==='string'&&guess.trim().length>0&&guess.length<=160&&!/[\u0000-\u001f]/.test(guess),
    accept(category,guess){
      const hit=ascensionAnswer(category,guess.trim());
      return hit.answer?{guess:hit.answer.name}:{status:422,code:'unknown',error:'No encontramos una coincidencia clara. Prueba otra mientras quede tiempo.'};
    },
    score:(category,guess)=>(found(category,guess)?.points||0)*MAX_POINTS/100,
    question:({id,title,description,theme,answers})=>({id,title,description,theme,count:answers.length}),
    solved,review:(category,guesses)=>({question:{id:category.id,title:category.title},...solved(category,guesses)}),
    // El bot suele dar una respuesta conocida y solo a veces una rara.
    bot(category,{random}){
      const roll=random(),points=roll<.5?10:roll<.78?30:roll<.92?60:roll<.98?85:100;
      const plain=category.answers.filter(answer=>!answer.million),same=plain.filter(answer=>answer.points===points);
      const options=same.length?same:plain.filter(answer=>answer.points===Math.min(...plain.map(one=>one.points)));
      return options[Math.floor(random()*options.length)].name;
    }};
}

// Traza la tendencia: se ve el principio de una serie y se dibuja el resto. Puntos = los del modo (0–1000) × 5.
function trendGame(charts){
  const bank=charts||read('tendencias-estables.json'),byId=new Map(bank.map(chart=>[chart.id,chart]));
  const hidden=chart=>chart.values.length-chart.cut-1;
  const viewOf=chart=>{const {id,title,detail,unit,start,cut,min,max,tick,precision,period,labels}=chart;
    return {id,title,detail,unit,start,cut,min,max,tick,precision,period,labels,history:chart.values.slice(0,cut+1),end:start+chart.values.length-1}};
  const marks=(chart,guesses)=>guesses.map(guess=>{if(guess==null)return null;const {score,error}=trendScore(chart,guess);return {score,error:Number(error.toFixed(4))}});
  const reveal=chart=>({actual:chart.values.slice(chart.cut+1),source:chart.source,context:chart.context||null});
  return {id:'traza',rules:GAME_RULES.traza,
    pool(now){let skip=[];try{skip=trendEdition(today(now)).map(chart=>chart.id)}catch{}return bank.filter(chart=>!skip.includes(chart.id)).map(chart=>chart.id)},
    pick:(ids,count)=>spread(ids,count,id=>[byId.get(id).category]),
    item:id=>byId.get(id),
    shape:guess=>Array.isArray(guess)&&guess.length>0&&guess.length<=60&&guess.every(value=>Number.isFinite(value)),
    accept:(chart,guess)=>guess.length===hidden(chart)&&guess.every(value=>value>=chart.min&&value<=chart.max)
      ?{guess:guess.map(value=>Number(value.toFixed(chart.precision)))}:{status:400,error:'Completa todos los puntos dentro de la gráfica'},
    score:(chart,guess)=>trendScore(chart,guess).score*MAX_POINTS/1000,
    question:viewOf,
    solved:(chart,guesses)=>({marks:marks(chart,guesses),reveal:reveal(chart)}),
    review:(chart,guesses)=>({question:{id:chart.id,title:chart.title,unit:chart.unit},marks:marks(chart,guesses),reveal:{source:chart.source}}),
    // El bot dibuja uno de los trazos simulados que el modo enseña cuando aún no hay trazos de otros jugadores.
    bot(chart,{random}){const traces=simulateTrends(viewOf(chart));return traces[Math.floor(random()*traces.length)]}};
}

// Archivo Vivo: una foto y un año entre 1840 y 2020. Puntos = los del modo (0–1000) × 5. Las fotos retiradas del modo
// (las que no tienen recreación en 360°) sí salen aquí: el duelo enseña la foto plana y el banco es pequeño.
function archiveGame(scenes=archive.scenes){
  const byId=new Map(scenes.map(scene=>[scene.id,scene]));
  const marks=(scene,guesses)=>guesses.map(guess=>guess==null?null:{off:Math.abs(guess-scene.year)});
  // La autoría y la licencia de la foto viajan siempre con el resultado.
  const reveal=({year,title,place,story,credit,rights,source,ground})=>({year,title,place,story,credit,rights,source,...(ground?.reference&&ground.reference!==source?{reference:ground.reference}:{})});
  const photo=id=>`assets/archivo-vivo/${id}-foto.jpg`;
  return {id:'archivo',rules:GAME_RULES.archivo,
    pool(now){let skip=[];try{skip=archive.initialSceneIdsForDay(today(now))}catch{}return scenes.filter(scene=>!skip.includes(scene.id)).map(scene=>scene.id)},
    item:id=>byId.get(id),
    shape:guess=>Number.isInteger(guess)&&guess>=archive.MIN_YEAR&&guess<=archive.MAX_YEAR,
    accept:(scene,guess)=>({guess}),
    score:(scene,guess)=>archive.scoreYear(guess,scene.year)*MAX_POINTS/archive.MAX_POINTS,
    question:({id,alt,detail})=>({id,photo:photo(id),alt,detail,minYear:archive.MIN_YEAR,maxYear:archive.MAX_YEAR}),
    solved:(scene,guesses)=>({marks:marks(scene,guesses),reveal:reveal(scene)}),
    review:(scene,guesses)=>({question:{id:scene.id,photo:photo(scene.id),alt:scene.alt},marks:marks(scene,guesses),reveal:reveal(scene)}),
    bot:(scene,{gauss})=>Math.min(archive.MAX_YEAR,Math.max(archive.MIN_YEAR,Math.round(scene.year+gauss()*14)))};
}

// Los adaptadores de los tres juegos nuevos. Cada banco se puede sustituir en las pruebas.
export function createDuelGames({ascensionBank,charts,scenes}={}){
  return {ascension:ascensionGame(ascensionBank),traza:trendGame(charts),archivo:archiveGame(scenes)};
}

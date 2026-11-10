// Cifras documentadas y respuestas anónimas del servidor que sirve esta app.
let anonymousPlayer;
const PLAYER_KEY='casi-casi:anonymous-player',validPlayer=id=>/^[a-f0-9-]{36}$/i.test(id||'');
// Al cargar, el servidor guarda el identificador en una cookie propia (sin registro, sin IP ni huella).
// Si el navegador perdió localStorage (Safari lo vacía a los 7 días sin visitas), la cookie lo devuelve
// junto con las respuestas guardadas, y se rellenan los días que no tengan progreso local.
const playerReady=(async()=>{
  let stored=null;try{stored=localStorage.getItem(PLAYER_KEY)}catch{}
  try{
    const response=await fetch('/api/jugador',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(validPlayer(stored)?{player:stored}:{}),credentials:'same-origin',signal:AbortSignal.timeout(8000)});
    if(!response.ok)return;
    const data=await response.json();if(validPlayer(stored)||!validPlayer(data.player)||anonymousPlayer)return;
    anonymousPlayer=data.player;try{localStorage.setItem(PLAYER_KEY,anonymousPlayer)}catch{}
    let restored=0;
    for(const [date,guesses] of Object.entries(data.progress||{})){
      if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Array.isArray(guesses)||!guesses.length||!guesses.every(n=>Number.isFinite(n)&&n>0))continue;
      try{if(localStorage.getItem(`casi-casi:v2:${date}`))continue;localStorage.setItem(`casi-casi:v2:${date}`,JSON.stringify(guesses.slice(0,3)));restored++}catch{}
    }
    if(restored){if(typeof renderWeek==='function')renderWeek();if(typeof showToast==='function')showToast(`Hemos recuperado tu progreso de ${restored} ${restored===1?'día':'días'}.`)}
  }catch{}
})();
function playerId(){
  if(anonymousPlayer)return anonymousPlayer;
  try{anonymousPlayer=localStorage.getItem(PLAYER_KEY)}catch{}
  if(!validPlayer(anonymousPlayer))anonymousPlayer=crypto.randomUUID();
  try{localStorage.setItem(PLAYER_KEY,anonymousPlayer)}catch{}
  return anonymousPlayer;
}
function questionMedia(q){
  if(!q.image)return '';
  const photo=q.image;
  return `<figure class="question-photo"><a href="${photo.src}" target="_blank" rel="noopener" aria-label="Ampliar fotografía"><img src="${photo.src}" alt="${escapeHtml(photo.alt)}" loading="eager"></a><figcaption><a href="${photo.url}" target="_blank" rel="noopener">${photo.credit}</a> · <a href="${photo.licenseUrl}" target="_blank" rel="noopener">${photo.license}</a></figcaption></figure>`;
}
function sourceMarkup(q){return `<details class="sources"><summary>Fuentes y supuestos</summary><p class="source-confidence">${q.confidence} · Comprobado el 09/11/2026</p><ul>${q.sources.map(s=>`<li><a href="${s.url}" target="_blank" rel="noopener">${escapeHtml(s.title)} ↗</a><p>${escapeHtml(s.fact)}</p></li>`).join('')}</ul><p class="source-assumptions"><strong>Qué estamos suponiendo</strong>${escapeHtml(q.assumptions)}</p></details>`}
function populationMarkup(q){return `<section class="population" aria-label="Cómo respondieron los demás"><div id="population-${q.id}"><p class="population-status">Cargando…</p></div></section>`}
// Panel «Cómo se calcula»: el razonamiento paso a paso, la cuenta de referencia, la foto y las fuentes.
function explainMarkup(q){
  const steps=q.reasoning?`<ol class="explain-steps">${q.reasoning.steps.map(step=>`<li>${escapeHtml(step)}</li>`).join('')}</ol>`:`<p>${escapeHtml(q.math)}</p>`;
  const sum=q.referenceExpression?`<p class="explain-sum"><code>${escapeHtml(q.referenceExpression)}</code><strong>≈ ${format(q.answer)} ${escapeHtml(q.unit)}</strong></p>`:'';
  const sources=`<ul class="explain-sources">${q.sources.map(s=>`<li><a href="${s.url}" target="_blank" rel="noopener">${escapeHtml(s.title)}</a></li>`).join('')}</ul>`;
  return `<div class="explain-head"><h3>Cómo se calcula</h3><button type="button" class="game-back" id="explain-close" aria-label="Cerrar">×</button></div><p class="explain-question">${escapeHtml(q.title)}</p>${steps}${sum}${q.assumptions?`<p class="explain-note">${escapeHtml(q.assumptions)}</p>`:''}${questionMedia(q)}<h4>Fuentes</h4>${sources}`;
}
function compactNumber(value){return new Intl.NumberFormat('es-ES',{notation:value>=1e12?'scientific':'compact',maximumFractionDigits:1}).format(value)}
function reasoningMarkup(q){
  if(!q.reasoning)return `<section class="reasoning"><h3>Cómo se calcula</h3><p>${escapeHtml(q.math)}</p></section>`;
  return `<section class="reasoning"><h3>Cómo se calcula</h3><ol>${q.reasoning.steps.map(step=>`<li>${escapeHtml(step)}</li>`).join('')}</ol><details class="reference-calculation"><summary>Ver el cálculo de referencia</summary><code>${escapeHtml(q.referenceExpression||'')}</code><p>= ${format(q.answer,6)} ${escapeHtml(q.unit)}</p><p>${escapeHtml(q.math)}</p></details></section>`;
}
async function loadDailyDistribution(day,guesses){
  const chart=document.getElementById('daily-score-chart'),caption=document.getElementById('daily-score-caption');if(!chart||!caption)return;
  try{
    await playerReady;const player=playerId();
    const saved=await Promise.all(day.questions.map((q,i)=>fetch('/api/answers',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({question:q.id,player,guess:guesses[i]}),signal:AbortSignal.timeout(8000)})));
    if(saved.some(response=>!response.ok))throw Error('No se pudo sincronizar el día');
    const response=await fetch('/api/daily-scores',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({date:day.id,player}),signal:AbortSignal.timeout(8000)});if(!response.ok)throw Error('Sin comparación');
    const data=await response.json();if(!chart.isConnected)return;
    chart.innerHTML=dailyScoreSvg(data);
    caption.textContent=data.count?`Tu posición entre ${format(data.count)} ${data.count===1?'participante que ha':'participantes que han'} completado este día.${data.count>=5?` Tu puntuación es mejor que el ${data.closerPercent}% de esta muestra.`:' La muestra aún es pequeña.'}`:'Tu marcador ya está situado. La distribución aparecerá cuando otros jugadores completen las tres preguntas.';
  }catch{if(caption.isConnected)caption.textContent='No se ha podido consultar la distribución diaria. Tu puntuación está guardada.'}
}
function dailyScoreSvg(data){
  const {bins,count,high,own}=data,baseline=170,width=520,max=Math.max(1,...bins),barWidth=width/bins.length;
  const bars=bins.map((n,i)=>n?`<rect x="${20+i*barWidth+1}" y="${baseline-n/max*125}" width="${barWidth-2}" height="${n/max*125}" rx="3"/>`:'').join('');
  let curve='';if(count>=5){const values=Array.from({length:97},(_,i)=>bins.reduce((sum,n,j)=>sum+n*Math.exp(-.5*((i/96*bins.length-j-.5)/1.2)**2),0)),peak=Math.max(...values);curve=`<path class="daily-density" d="${values.map((v,i)=>`${i?'L':'M'}${20+i/96*width},${baseline-v/peak*125}`).join(' ')}"/>`}
  const ownX=20+Math.log10(own)/high*width;
  return `<svg viewBox="0 0 560 220" class="daily-distribution-svg"><path class="chart-grid" d="M20 170H540"/><g class="daily-bars">${bars}</g>${curve}<path class="daily-you-line" d="M${ownX} 25V178"/><rect class="daily-you-pill" x="${Math.max(20,Math.min(484,ownX-28))}" y="181" width="56" height="24" rx="12"/><text class="daily-you-label" x="${Math.max(48,Math.min(512,ownX))}" y="198" text-anchor="middle">Tú</text><text class="axis-label" x="20" y="218">1×</text><text class="axis-label" x="540" y="218" text-anchor="end">${compactNumber(10**high)}×</text></svg>`;
}
async function refreshDailyCalendar(){
  try{const response=await fetch('/api/calendar',{cache:'no-store',signal:AbortSignal.timeout(6000)});if(!response.ok)return;const data=await response.json();if(data.date===todayKey)return;DAYS=data.days;todayKey=data.date;currentDay=DAYS.find(day=>day.id===todayKey)||null;renderWeek();showToast(currentDay?'Ya están disponibles los tres retos de hoy.':'La próxima edición está en preparación.')}catch{}
}
setInterval(refreshDailyCalendar,60000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshDailyCalendar()});
async function loadDistribution(q,guess){
  const target=document.getElementById(`population-${q.id}`);if(!target)return;
  const rank=document.getElementById(`rank-${q.id}`),factor=Math.max(guess/q.answer,q.answer/guess);
  let data=null;
  try{
    await playerReady;
    const response=await fetch('/api/answers',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({question:q.id,player:playerId(),guess}),signal:AbortSignal.timeout(8000)});
    if(response.ok)data=await response.json();
  }catch{}
  if(!target.isConnected)return;
  if(data&&data.count>=SIM_MIN){
    target.innerHTML=distributionSvg(q,guess,{...data,simulated:false});
    if(rank)rank.textContent=`Más cerca que el ${data.closerPercent}% de ${format(data.count)} jugadores`;
    return;
  }
  const logs=simulatedLogs(q),low=-1,high=1,bins=Array(26).fill(0);
  for(const value of logs)if(value>=low&&value<=high)bins[Math.min(25,Math.floor((value-low)/(high-low)*26))]++;
  const farther=logs.filter(value=>Math.abs(value)>Math.log10(factor)).length;
  target.innerHTML=distributionSvg(q,guess,{bins,low,high,count:logs.length,simulated:true});
  if(rank)rank.textContent=`Más cerca que el ${Math.round(farther/logs.length*100)}% · simulación`;
}
// Muestra simulada (decisión 0014): mientras haya menos de SIM_MIN respuestas reales, el gráfico usa
// estimaciones simuladas, siempre las mismas para cada pregunta, y lo dice en el propio gráfico. Nunca se guardan.
const SIM_MIN=30,SIM_SIZE=600;
function seededRandom(text){let h=1779033703^text.length;for(let i=0;i<text.length;i++){h=Math.imul(h^text.charCodeAt(i),3432918353);h=h<<13|h>>>19}return()=>{h=Math.imul(h^h>>>16,2246822507);h=Math.imul(h^h>>>13,3266489909);h^=h>>>16;return (h>>>0)/4294967296}}
function simulatedLogs(q){
  // log10(estimación / referencia): campana algo desplazada hacia abajo (se suele subestimar) y con colas más anchas.
  const random=seededRandom(q.id),normal=()=>Math.sqrt(-2*Math.log(1-random()))*Math.cos(2*Math.PI*random());
  return Array.from({length:SIM_SIZE},()=>random()<.82?-.06+.42*normal():-.25+1.05*normal());
}
function distributionSvg(q,guess,{bins,low,high,count,simulated}){
  const position=value=>20+(value-low)/(high-low)*520,ownLog=Math.log10(guess/q.answer),max=Math.max(1,...bins),height=120,base=166,barWidth=520/bins.length;
  const bars=bins.map((n,i)=>n?`<rect x="${(20+i*barWidth+1.5).toFixed(1)}" y="${(base-n/max*height).toFixed(1)}" width="${(barWidth-3).toFixed(1)}" height="${(n/max*height).toFixed(1)}" rx="3"/>`:'').join('');
  const outside=ownLog<low?'left':ownLog>high?'right':'',own=outside==='left'?20:outside==='right'?540:position(ownLog),answer=position(0);
  const label=outside==='left'?'‹ Tú':outside==='right'?'Tú ›':'Tú',tagWidth=outside?50:40,tagX=Math.max(20,Math.min(540-tagWidth,own-tagWidth/2));
  return `<svg class="distribution-svg" viewBox="0 0 560 214" role="img" aria-label="${simulated?'Distribución simulada':count+' respuestas de otros jugadores'}. Tu estimación ${format(guess)}; referencia ${format(q.answer)}. Escala logarítmica."><path class="chart-grid" d="M20 166H540"/><g class="distribution-bars">${bars}</g><path class="reference-line" d="M${answer} 40V172"/><path class="guess-line" d="M${own} 36V172"/><rect class="you-tag" x="${tagX}" y="10" width="${tagWidth}" height="24" rx="12"/><text class="you-tag-text" x="${tagX+tagWidth/2}" y="27" text-anchor="middle">${label}</text><text class="axis-label" x="20" y="192">${compactNumber(q.answer*10**low)}</text><text class="axis-label answer-axis" x="${answer}" y="192" text-anchor="middle">${compactNumber(q.answer)}</text><text class="axis-label" x="540" y="192" text-anchor="end">${compactNumber(q.answer*10**high)}</text><text class="axis-caption" x="${answer}" y="209" text-anchor="middle">real</text>${simulated?'<text class="chart-sim-label" x="540" y="22" text-anchor="end">simulación</text>':''}</svg>`;
}
document.addEventListener('click',event=>{const button=event.target.closest('[data-refresh-distribution]');if(!button)return;const index=activeDay.questions.findIndex(q=>q.id===button.dataset.refreshDistribution);if(index>=0)loadDistribution(activeDay.questions[index],getGuesses(activeDay)[index])});

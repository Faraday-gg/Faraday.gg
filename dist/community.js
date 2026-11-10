// Cifras documentadas y respuestas anónimas del servidor que sirve esta app.
let anonymousPlayer;
function playerId(){
  if(anonymousPlayer)return anonymousPlayer;
  try{anonymousPlayer=localStorage.getItem('casi-casi:anonymous-player')}catch{}
  if(!/^[a-f0-9-]{36}$/i.test(anonymousPlayer||''))anonymousPlayer=crypto.randomUUID();
  try{localStorage.setItem('casi-casi:anonymous-player',anonymousPlayer)}catch{}
  return anonymousPlayer;
}
function questionMedia(q){
  if(!q.image)return '';
  const photo=q.image;
  return `<figure class="question-photo"><a href="${photo.src}" target="_blank" rel="noopener" aria-label="Ampliar fotografía"><img src="${photo.src}" alt="${escapeHtml(photo.alt)}" loading="eager"></a><figcaption><a href="${photo.url}" target="_blank" rel="noopener">${photo.credit}</a> · <a href="${photo.licenseUrl}" target="_blank" rel="noopener">${photo.license}</a></figcaption></figure>`;
}
function sourceMarkup(q){return `<details class="sources"><summary>Fuentes y supuestos</summary><p class="source-confidence">${q.confidence} · Comprobado el 09/11/2026</p><ul>${q.sources.map(s=>`<li><a href="${s.url}" target="_blank" rel="noopener">${escapeHtml(s.title)} ↗</a><p>${escapeHtml(s.fact)}</p></li>`).join('')}</ul><p class="source-assumptions"><strong>Qué estamos suponiendo</strong>${escapeHtml(q.assumptions)}</p></details>`}
function populationMarkup(q){return `<section class="population" aria-label="Distribución de respuestas"><h3>Así respondieron los demás</h3><div id="population-${q.id}" aria-live="polite"><p class="population-status">Cargando respuestas…</p></div></section>`}
function compactNumber(value){return new Intl.NumberFormat('es-ES',{notation:value>=1e12?'scientific':'compact',maximumFractionDigits:1}).format(value)}
function reasoningMarkup(q){
  if(!q.reasoning)return `<section class="reasoning"><h3>Cómo se calcula</h3><p>${escapeHtml(q.math)}</p></section>`;
  return `<section class="reasoning"><h3>Cómo se calcula</h3><ol>${q.reasoning.steps.map(step=>`<li>${escapeHtml(step)}</li>`).join('')}</ol><details class="reference-calculation"><summary>Ver el cálculo de referencia</summary><code>${escapeHtml(q.referenceExpression||'')}</code><p>= ${format(q.answer,6)} ${escapeHtml(q.unit)}</p><p>${escapeHtml(q.math)}</p></details></section>`;
}
async function loadDailyDistribution(day,guesses){
  const chart=document.getElementById('daily-score-chart'),caption=document.getElementById('daily-score-caption');if(!chart||!caption)return;
  try{
    const player=playerId();
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
  try{
    const response=await fetch('/api/answers',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({question:q.id,player:playerId(),guess}),signal:AbortSignal.timeout(8000)});
    if(!response.ok)throw Error('Servidor no disponible');
    const data=await response.json();if(!target.isConnected)return;
    target.innerHTML=distributionSvg(q,guess,data)+`<div class="population-legend"><span><i class="legend-other"></i>Otras respuestas</span><span><i class="legend-answer"></i>Referencia</span><span><i class="legend-you"></i>Tú</span></div><p class="population-status">${data.count?`${format(data.count)} ${data.count===1?'respuesta anónima de otro jugador':'respuestas anónimas de otros jugadores'}.${data.count<5?' Muestra pequeña; aún no dibujamos una curva suavizada.':` Tu estimación fue más cercana que el ${data.closerPercent}% de esta muestra.`}`:'Aún no hay respuestas de otros jugadores. La tuya ya está registrada; la distribución aparecerá cuando participen más personas.'}</p><div class="population-footer"><span>Tu respuesta queda fuera del histograma.</span><button type="button" data-refresh-distribution="${q.id}">Actualizar ↻</button></div>`;
  }catch{if(target.isConnected)target.innerHTML='<p class="population-status">La comparación no está disponible ahora. Tus resultados siguen guardados en este navegador. El gráfico necesita el servidor de respuestas.</p>'}
}
function distributionSvg(q,guess,data){
  const {low,high,bins,count}=data,position=value=>20+(Math.log10(value/q.answer)-low)/(high-low)*520;
  const max=Math.max(1,...bins),height=110,base=166,barWidth=520/bins.length;
  const bars=bins.map((n,i)=>n?`<rect x="${20+i*barWidth+1}" y="${base-n/max*height}" width="${barWidth-2}" height="${n/max*height}" rx="2"><title>${n} respuestas entre ${compactNumber(q.answer*10**(low+i/bins.length*(high-low)))} y ${compactNumber(q.answer*10**(low+(i+1)/bins.length*(high-low)))}</title></rect>`:'').join('');
  let curve='';
  if(count>=5){const values=Array.from({length:97},(_,i)=>{const x=i/96*bins.length;return bins.reduce((sum,n,j)=>sum+n*Math.exp(-.5*((x-j-.5)/1.15)**2),0)}),peak=Math.max(...values);curve=`<path class="density-line" d="${values.map((v,i)=>`${i?'L':'M'}${20+i/96*520},${base-v/peak*height}`).join(' ')}"/>`}
  const own=position(guess),answer=position(q.answer);
  return `<svg class="distribution-svg" viewBox="0 0 560 220" role="img" aria-label="${count} respuestas de otros jugadores. Tu estimación ${format(guess)}; referencia ${format(q.answer)}. Las barras muestran frecuencias en escala logarítmica."><path class="chart-grid" d="M20 56H540M20 111H540M20 166H540"/><g class="distribution-bars">${bars}</g>${curve}<path class="reference-line" d="M${answer} 48V174"/><path class="guess-line" d="M${own} 35V174"/><rect class="you-tag" x="${Math.max(20,Math.min(498,own-21))}" y="10" width="42" height="24" rx="12"/><text class="you-tag-text" x="${Math.max(41,Math.min(519,own))}" y="27" text-anchor="middle">Tú</text><text class="axis-label" x="20" y="197">${compactNumber(q.answer*10**low)}</text><text class="axis-label answer-axis" x="${answer}" y="197" text-anchor="middle">${compactNumber(q.answer)}</text><text class="axis-label" x="540" y="197" text-anchor="end">${compactNumber(q.answer*10**high)}</text><text class="axis-caption" x="${answer}" y="214" text-anchor="middle">referencia</text>${count?'':'<text class="chart-empty-label" x="280" y="100" text-anchor="middle">Esperando más estimaciones</text>'}</svg>`;
}
document.addEventListener('click',event=>{const button=event.target.closest('[data-refresh-distribution]');if(!button)return;const index=activeDay.questions.findIndex(q=>q.id===button.dataset.refreshDistribution);if(index>=0)loadDistribution(activeDay.questions[index],getGuesses(activeDay)[index])});

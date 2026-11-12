let DAYS = window.PILOT_DAYS;

const $ = (selector) => document.querySelector(selector);
const format = (n, digits=2) => new Intl.NumberFormat('es-ES',{maximumFractionDigits:digits}).format(n);
const prettyDate = (id) => new Intl.DateTimeFormat('es-ES',{day:'numeric',month:'long',year:'numeric',timeZone:'Europe/Madrid'}).format(new Date(`${id}T12:00:00Z`));
const dateParts = Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'Europe/Madrid',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()).map(part=>[part.type,part.value]));
let todayKey = window.DAILY_CALENDAR?.date || `${dateParts.year}-${dateParts.month}-${dateParts.day}`;
let currentDay = DAYS.find(day=>day.id===todayKey) || null;
const FIRST_DAY = window.DAILY_CALENDAR?.first || '2026-08-09';
const editionNumber = (id) => Math.round((Date.parse(id+'T12:00:00Z')-Date.parse(FIRST_DAY+'T12:00:00Z'))/86400000)+1;
const categoriesOf = (day) => day.categories || (day.questions||[]).map(q=>q.category);
const icons = (day, className) => categoriesOf(day).map(key=>window.categoryIcon?.(key,className)||'').join('');
const loadedDays = new Map();
let activeDay = currentDay;
let activeIndex = 0;
let toastTimer;
const sessionGuesses = new Map();
const sessionWorkspaces = new Map();
let workspaceData = {note:'',history:[]};

function getGuesses(day){if(sessionGuesses.has(day.id))return sessionGuesses.get(day.id);try{const saved=JSON.parse(localStorage.getItem(`casi-casi:v2:${day.id}`)||'[]');return Array.isArray(saved)?saved:[]}catch{return []}}
function saveGuesses(day,guesses){sessionGuesses.set(day.id,guesses);try{localStorage.setItem(`casi-casi:v2:${day.id}`,JSON.stringify(guesses))}catch{showToast('Las respuestas durarán solo hasta cerrar esta pestaña.')}}
function score(guess,answer){return Math.max(guess/answer,answer/guess)}
function art(kind){
  const common='fill="none" stroke="#202630" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"';
  const paths={
    coffee:`<rect x="85" y="54" width="108" height="68" rx="7" fill="#fffdf7" stroke="#202630" stroke-width="4"/><path d="M193 68h19c31 0 28 39-1 39h-18M92 122h119" ${common}/><path d="M108 38c-15-15 15-17 0-31M140 38c-15-15 15-17 0-31M171 38c-15-15 15-17 0-31" ${common}/><ellipse cx="139" cy="127" rx="87" ry="8" fill="#ff6548"/>`,
    pizza:`<circle cx="150" cy="76" r="64" fill="#ff6548" stroke="#202630" stroke-width="4"/><circle cx="150" cy="76" r="52" fill="#ffdb70" stroke="#202630" stroke-width="3"/><path d="M150 24v104M98 76h104M113 39l74 74M113 113l74-74" ${common}/><circle cx="126" cy="58" r="6" fill="#202630"/><circle cx="174" cy="56" r="6" fill="#202630"/><circle cx="157" cy="101" r="6" fill="#202630"/>`,
    duck:`<path d="M88 100c11 25 95 35 126-2l-22-10c7-16 3-30-10-38-10-7-20-6-32 0-3 17-13 28-35 31l-27-7-14 12z" fill="#ffdb70" stroke="#202630" stroke-width="4"/><path d="M153 53c9-14 27-16 39-5" ${common}/><circle cx="172" cy="58" r="3" fill="#202630"/><path d="M193 68l32 8-30 12" fill="#ff6548" stroke="#202630" stroke-width="3"/><path d="M65 124c25-8 35 8 60 0s36 8 60 0 38 8 62 0" ${common}/>`,
    plane:`<path d="M35 72 255 19 173 132 137 89 35 72Z" fill="#fffdf7" stroke="#202630" stroke-width="4"/><path d="m137 89 118-70-82 113-8-52" ${common}/><path d="M38 107c19-3 23 13 41 12M42 126c13 1 22 12 37 9" ${common}/>`,
    moon:`<circle cx="166" cy="75" r="62" fill="#fffdf7" stroke="#202630" stroke-width="4"/><circle cx="146" cy="59" r="11" fill="#b9d6e1"/><circle cx="185" cy="96" r="15" fill="#b9d6e1"/><circle cx="193" cy="44" r="6" fill="#b9d6e1"/><path d="M63 104h59M80 86h42M96 68h26" ${common}/><path d="M40 29l5-13 5 13 13 5-13 5-5 13-5-13-13-5z" fill="#ff6548" stroke="#202630" stroke-width="3"/>`,
    confetti:`<path d="M82 123 168 22l52 52-138 49z" fill="#ff6548" stroke="#202630" stroke-width="4"/><path d="M95 109 202 56M102 31l-8-16M202 21l13-12M233 105l19 3M58 47l-19-6" ${common}/><circle cx="247" cy="47" r="7" fill="#b9d6e1" stroke="#202630" stroke-width="3"/><rect x="54" y="105" width="12" height="12" fill="#fffdf7" stroke="#202630" stroke-width="3"/>`,
    balloons:`<path d="M130 78c-23-18-26-54-8-67 20-14 40 9 28 47l-12 20zM163 74c-9-30 4-64 27-63 26 3 25 39-9 63zM95 87C63 78 51 45 70 30c19-16 46 8 44 43z" fill="#ff6548" stroke="#202630" stroke-width="4"/><path d="M138 78 151 137M174 73 151 137M104 87 151 137" ${common}/><rect x="136" y="130" width="30" height="19" rx="3" fill="#202630"/>`,
    umbrella:`<path d="M40 78c14-70 96-76 110-76s96 6 110 76c-19-15-38-14-55 0-18-15-37-15-55 0-18-15-37-15-55 0-17-14-36-15-55 0z" fill="#ff6548" stroke="#202630" stroke-width="4"/><path d="M150 78v43c0 26 31 28 31 5" ${common}/><path d="M66 109v12M91 104v12M212 105v12M237 108v12" stroke="#4d92b1" stroke-width="5" stroke-linecap="round"/>`,
    earth:`<circle cx="150" cy="76" r="61" fill="#b9d6e1" stroke="#202630" stroke-width="4"/><path d="M113 29 99 50l12 16 29-5 10-27-17-13M187 28l-17 17 10 18 24-2 6 22-16 21-16-7-14 19" fill="#85aa76" stroke="#202630" stroke-width="3"/><path d="M31 75c18 30 62 48 119 48s101-18 119-48" ${common}/>`
  };return paths[kind]?`<div class="question-visual" aria-hidden="true"><svg viewBox="0 0 300 150" xmlns="http://www.w3.org/2000/svg">${paths[kind]}</svg></div>`:'';
}
function renderWeek(){
  $('#today-date').textContent=prettyDate(todayKey).toUpperCase();
  $('.section-kicker').textContent=currentDay?'RETO Nº '+editionNumber(todayKey):'NUEVA EDICIÓN EN PREPARACIÓN';
  document.querySelectorAll('[data-play]').forEach(button=>button.disabled=!currentDay);
  if(!currentDay)$('#hero-play').textContent='Retos en preparación';
  const roundsList=$('#hero-rounds');
  roundsList.innerHTML=currentDay?currentDay.questions.map((q,i)=>{const category=window.CATEGORIES?.[q.category];return category?`<li><span class="round-number">P${i+1}</span>${window.categoryIcon(q.category,'cat-icon cat-icon-hero')}<span class="sr-only">${category.label}</span></li>`:''}).join(''):'';
  roundsList.hidden=!roundsList.innerHTML;
  renderArchives();
}
async function openDate(id){
  let day=loadedDays.get(id)||DAYS.find(d=>d.id===id&&d.questions);
  if(!day){
    try{const response=await fetch('/api/day?date='+encodeURIComponent(id),{signal:AbortSignal.timeout(8000)});if(!response.ok)throw Error();day=await response.json();loadedDays.set(id,day)}
    catch{showToast('No se ha podido cargar ese día. Inténtalo de nuevo.');return}
  }
  openDay(day);
}
// El juego ocupa toda la pantalla. activeIndex 0-2 es una pregunta (o su resultado si ya está respondida) y 3 es el resumen.
// Abrir el juego añade una entrada al historial: el botón «atrás» del navegador o del móvil vuelve a la portada.
function openDay(day){workspaceId=null;activeDay=day;activeIndex=getGuesses(day).length;workspaceData=loadWorkspace(day);renderWorkspace();toggleWorkspace(false);const wasOpen=!$('#game-shell').hidden;$('#game-shell').hidden=false;document.body.classList.add('modal-open');if(!wasOpen&&!history.state?.faradayGame)history.pushState({faradayGame:true},'');renderGame()}
function hideGame(){toggleMenu(false);toggleWorkspace(false);$('#game-shell').hidden=true;document.body.classList.remove('modal-open');renderWeek()}
function closeGame(){if(history.state?.faradayGame)history.back();else hideGame()}
window.addEventListener('popstate',()=>{if(!$('#game-shell').hidden)hideGame()});
function renderGame(){
  const guesses=getGuesses(activeDay);activeIndex=Math.max(0,Math.min(activeIndex,guesses.length===3?3:guesses.length));
  const view=activeIndex===3?'summary':activeIndex<guesses.length?'result':'question';
  $('#game-content').className='game-content is-'+view;$('#game-shell').dataset.view=view;$('#game-shell').dataset.tone=view==='question'?(window.CATEGORIES?.[activeDay.questions[activeIndex].category]?.tone||'coral'):'';
  $('.game-card')?.classList.remove('explaining');
  if(view==='summary')renderSummary();else if(view==='result')renderResult(guesses);else renderQuestion();
  renderBar(guesses);$('.game-panel').scrollTop=0;
}
function renderBar(guesses){
  $('#game-edition').textContent='Nº '+editionNumber(activeDay.id);
  const steps=activeDay.questions.map((q,i)=>`<button type="button" class="game-step${i<guesses.length?' done':''}" data-step="${i}"${i>guesses.length?' disabled':''}${i===activeIndex?' aria-current="step"':''} aria-label="Pregunta ${i+1}${i<guesses.length?', respondida':''}">${window.categoryIcon?.(q.category,'cat-icon')||''}<span>${i+1}</span></button>`);
  steps.push(`<button type="button" class="game-step${guesses.length===3?' done':''}" data-step="3"${guesses.length<3?' disabled':''}${activeIndex===3?' aria-current="step"':''}><span>Total</span></button>`);
  $('#game-steps').innerHTML=steps.join('');
}
function renderQuestion(){const q=activeDay.questions[activeIndex],workspaceOpen=!$('#workspace-panel').hidden;$('#game-content').innerHTML=`${q.image?`<div class="hint-photo">${questionMedia(q)}</div>`:''}<h2 id="game-title">${q.title}</h2><form id="guess-form"><label class="sr-only" for="guess-input">Tu estimación, en ${q.unit}</label><div class="guess-row"><input id="guess-input" type="text" inputmode="decimal" autocomplete="off" placeholder="Tu estimación" aria-describedby="guess-help" required><span class="guess-unit">${q.unit}</span></div><div class="form-error" id="guess-help" role="alert"></div><div class="game-actions"><button class="workspace-launch" type="button" id="workspace-toggle" aria-label="${workspaceOpen?'Cerrar':'Abrir'} calculadora y notas" aria-expanded="${workspaceOpen}" aria-controls="workspace-panel" title="Calculadora y notas"><svg aria-hidden="true" viewBox="0 0 32 36" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="1.5" width="25" height="33" rx="3.5"/><rect x="8" y="6" width="16" height="7" rx="1"/><path d="M9 19h3m6 0h3M9 24h3m6 0h3M9 29h3m6 0h3"/></svg></button><button class="game-primary" type="submit">Confirmar <span aria-hidden="true">→</span></button></div></form>`;$('#guess-input').focus()}
// Tarjeta de respuesta (decisión 0012): tu cifra frente a la real arriba, debajo el multiplicador y la distribución.
// La pregunta y la explicación no se ven; «Cómo se calcula» abre un panel dentro de la tarjeta.
const whole=(n)=>new Intl.NumberFormat('es-ES',{maximumFractionDigits:n<10?2:0,useGrouping:'always'}).format(n);
const rounded=(n)=>new Intl.NumberFormat('es-ES',{maximumSignificantDigits:3,useGrouping:'always'}).format(n);
const times=(f)=>new Intl.NumberFormat('es-ES',{maximumFractionDigits:f<10?2:f<100?1:0,useGrouping:'always'}).format(f)+'×';
function renderResult(guesses){
  const q=activeDay.questions[activeIndex],guess=guesses[activeIndex],factor=score(guess,q.answer);
  const verdict=guess<q.answer?['low','↓','Corto']:guess>q.answer?['high','↑','Te pasaste']:['exact','✓','Exacto'];
  $('#game-content').innerHTML=`<h2 id="game-title" class="sr-only">Resultado de la pregunta ${activeIndex+1}: ${q.title}</h2>
<dl class="ledger${Math.max(whole(guess).length,rounded(q.answer).length)>=9?' is-long':''}"><div><dt>Tú</dt><dd>${whole(guess)}</dd></div><div class="ledger-real"><dt>Real</dt><dd>≈ ${rounded(q.answer)}</dd><p class="ledger-source">${sourceLine(q)}</p></div><p class="ledger-unit">${q.unit}</p></dl>
<div class="verdict verdict-${verdict[0]}${times(factor).length>=11?' is-long is-xlong':times(factor).length>=8?' is-long':''}"><strong class="verdict-x">${times(factor)}</strong><span class="verdict-chip"><span aria-hidden="true">${verdict[1]}</span> ${verdict[2]}</span><span class="verdict-rank" id="rank-${q.id}" aria-live="polite"></span></div>
${populationMarkup(q)}
<div class="card-actions"><button class="workspace-launch" type="button" id="workspace-toggle" aria-label="Abrir calculadora y notas" aria-expanded="false" aria-controls="workspace-panel" title="Calculadora y notas"><svg aria-hidden="true" viewBox="0 0 32 36" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="1.5" width="25" height="33" rx="3.5"/><rect x="8" y="6" width="16" height="7" rx="1"/><path d="M9 19h3m6 0h3M9 24h3m6 0h3M9 29h3m6 0h3"/></svg></button><button class="explain-toggle" type="button" id="explain-toggle" aria-expanded="false" aria-controls="explain-panel">Cómo se calcula <span aria-hidden="true">▴</span></button><button class="game-primary" id="next-question" type="button">${activeIndex===2?'Ver total':'Siguiente'} <span aria-hidden="true">→</span></button></div>
<div class="explain-panel" id="explain-panel" role="region" aria-labelledby="explain-toggle" hidden><div class="explain-inner">${explainMarkup(q)}</div></div>`;
  animateTimes($('.verdict-x'),factor);loadDistribution(q,guess);$('#next-question').focus()
}
function sourceLine(q){const source=q.sources?.[0];if(!source)return '';const title=source.title.length>70?source.title.slice(0,68).trimEnd()+'…':source.title;return `Fuente: <a href="${source.url}" target="_blank" rel="noopener">${escapeHtml(title)}</a>`}
// El multiplicador sube desde 1× hasta su valor en escala logarítmica, para que 2× y 961.538× tarden lo mismo (decisión 0020):
// siempre con los decimales de la cifra final y su ancho reservado, para que no baile, y frenando despacio al llegar.
function animateTimes(element,factor){
  if(!element||factor<=1.01||matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  const final=times(factor),digits=(final.split(',')[1]||'').replace(/D/g,'').length,
    fmt=new Intl.NumberFormat('es-ES',{minimumFractionDigits:digits,maximumFractionDigits:digits,useGrouping:'always'}),
    start=performance.now()+420,duration=Math.min(2200,1300+Math.log10(factor)*180),end=Math.log10(factor);
  element.style.minWidth=element.getBoundingClientRect().width+'px';
  element.classList.add('counting');
  const finish=()=>{element.textContent=final;element.classList.remove('counting')};
  const step=now=>{if(!element.isConnected)return;const t=Math.max(0,Math.min(1,(now-start)/duration));if(t<1){element.textContent=fmt.format(10**(end*(1-(1-t)**4)))+'×';requestAnimationFrame(step)}else finish()};
  element.textContent=fmt.format(1)+'×';requestAnimationFrame(step);
  // Si la pestaña está en segundo plano, requestAnimationFrame se pausa: se asegura la cifra final.
  setTimeout(()=>{if(element.isConnected&&element.classList.contains('counting'))finish()},duration+700);
}
// «Cómo se calcula» (decisión 0021): una hoja translúcida que sube dentro de la tarjeta, entre el multiplicador (bajo «Tú» y «Real») y los botones.
// El resultado queda detrás, atenuado, y «Siguiente» sigue a la vista: no hace falta desplazarse. Si el texto no cabe, solo se desplaza la hoja.
function placeExplain(){
  const card=$('.game-card'),panel=$('#explain-panel'),verdict=$('.verdict'),actions=$('.card-actions');if(!card||!panel||!verdict||!actions)return;
  const box=card.getBoundingClientRect(),bottom=box.bottom-actions.getBoundingClientRect().top+10;
  let top=verdict.getBoundingClientRect().bottom-box.top+14;
  if(box.height-top-bottom<260)top=14; // Pantallas bajas: la hoja ocupa también el hueco del multiplicador.
  panel.style.bottom=bottom+'px';panel.style.maxHeight=(box.height-top-bottom)+'px'; // Crece desde los botones y se ajusta al texto.
}
function toggleExplain(open){const panel=$('#explain-panel'),button=$('#explain-toggle'),card=$('.game-card');if(!panel)return false;open??=panel.hidden;button.setAttribute('aria-expanded',String(open));
  if(open){
    // Si la tarjeta no cabe entera, se recoloca una vez con el multiplicador arriba.
    const view=$('.game-panel'),box=card.getBoundingClientRect();if(box.bottom>innerHeight||box.top<0)view.scrollTop+=box.top-8; // Pantallas bajas: el multiplicador arriba; los botones quedan pegados abajo (sticky).
    placeExplain();panel.hidden=false;panel.scrollTop=0;card.classList.add('explaining');markMore(panel);requestAnimationFrame(()=>requestAnimationFrame(()=>panel.classList.add('open')));
  }else{panel.classList.remove('open');card.classList.remove('explaining');setTimeout(()=>{if(!panel.classList.contains('open'))panel.hidden=true},380)}
  return true}
addEventListener('resize',()=>{if($('#explain-panel.open'))placeExplain()});
// Degradado abajo mientras quede texto por leer dentro de la hoja.
function markMore(panel){panel.classList.toggle('more',panel.scrollTop+panel.clientHeight<panel.scrollHeight-6)}
document.addEventListener('scroll',event=>{if(event.target.id==='explain-panel')markMore(event.target)},true);
function renderSummary(){const guesses=getGuesses(activeDay),scores=activeDay.questions.map((q,i)=>score(guesses[i],q.answer)),average=scores.reduce((a,b)=>a+b,0)/3;$('#game-content').innerHTML=`<p class="result-question">${activeDay.name} · ${prettyDate(activeDay.id)}</p><h2 id="game-title" class="sr-only">Tu resultado</h2><div class="daily-score-visual"><div id="daily-score-chart" aria-hidden="true"></div><div class="summary-score">${format(average)}×</div></div><p class="daily-population-caption" id="daily-score-caption" aria-live="polite">Consultando las puntuaciones del día…</p><div class="summary-list">${activeDay.questions.map((q,i)=>`<button type="button" class="summary-row" data-review-index="${i}"><span>${q.title}</span><strong>${format(scores[i])}×</strong></button>`).join('')}</div><div class="summary-actions"><button class="game-primary" id="share-result" type="button">Compartir</button><button class="game-secondary" id="another-day" type="button">Volver al inicio</button></div>${moreDaysMarkup(activeDay)}`;loadDailyDistribution(activeDay,guesses)}
// «Otros días» (decisión 0021): el día anterior y el siguiente del archivo, con su estado, y el calendario completo en el menú.
function moreDaysMarkup(day){
  const days=archiveDays(),i=days.findIndex(d=>d.id===day.id),prev=i>0?days[i-1]:null,next=i>=0&&i<days.length-1?days[i+1]:null;
  const short=id=>new Intl.DateTimeFormat('es-ES',{day:'numeric',month:'short',timeZone:'Europe/Madrid'}).format(new Date(id+'T12:00:00Z')).replace('.','');
  const state=d=>{const value=dayScore(d);return value==null?(getGuesses(d).length?'A medias':'Sin jugar'):format(value)+'×'};
  const link=(d,dir)=>d?`<button type="button" class="more-day more-day-${dir}" data-open-day="${d.id}"><span class="more-day-arrow" aria-hidden="true">${dir==='prev'?'←':'→'}</span><span><small>${dir==='prev'?'Anterior':'Siguiente'} · Nº ${editionNumber(d.id)}</small><b>${d.id===todayKey?'Hoy':short(d.id)}</b><em>${state(d)}</em></span></button>`:'<span class="more-day more-day-empty" aria-hidden="true"></span>';
  const today=currentDay&&day.id!==todayKey&&getGuesses(currentDay).length<3?`<button type="button" class="game-primary more-today" data-open-day="${todayKey}">Jugar el reto de hoy <span aria-hidden="true">→</span></button>`:'';
  return `<section class="more-days" aria-labelledby="more-days-title"><h3 id="more-days-title">Seguir jugando</h3>${today}<div class="more-days-nav">${link(prev,'prev')}<button type="button" class="more-calendar" id="more-calendar"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/></svg><span>Elegir día</span></button>${link(next,'next')}</div></section>`;
}
function formatEstimateInput(input){
  const cursor=input.selectionStart??input.value.length;
  const meaningful=input.value.slice(0,cursor).replace(/[^\d,]/g,'').length;
  const clean=input.value.replace(/[^\d,]/g,''),parts=clean.split(',');
  const integer=parts[0].replace(/^0+(?=\d)/,'');
  input.value=integer.replace(/\B(?=(\d{3})+(?!\d))/g,'.')+(parts.length>1?','+parts.slice(1).join(''):'');
  let position=0,count=0;while(position<input.value.length&&count<meaningful){if(/[\d,]/.test(input.value[position]))count++;position++}
  input.setSelectionRange(position,position)
}
function submitGuess(event){event.preventDefault();const raw=$('#guess-input').value.trim().replace(/[.\s]/g,'').replace(',','.');const guess=Number(raw);if(!/^\d+(\.\d+)?$/.test(raw)||!Number.isFinite(guess)||guess<=0){$('#guess-help').textContent='Escribe un número mayor que cero. Usa coma para los decimales.';return}const guesses=getGuesses(activeDay);if(guesses.length!==activeIndex)return;guesses.push(guess);saveGuesses(activeDay,guesses);notifyProgress(guess,guesses);renderGame()}
// Avisa a progress.js (experiencia, faradios y misiones) de cada respuesta y de cada reto completado.
function notifyProgress(guess,guesses){const today=activeDay.id===todayKey,detail={factor:score(guess,activeDay.questions[activeIndex].answer),day:activeDay.id,today};document.dispatchEvent(new CustomEvent('faraday:answer',{detail}));if(guesses.length===3)document.dispatchEvent(new CustomEvent('faraday:day',{detail:{day:activeDay.id,today,average:activeDay.questions.reduce((sum,q,i)=>sum+score(guesses[i],q.answer),0)/3}}))}
function loadWorkspace(day){
  if(sessionWorkspaces.has(day.id))return sessionWorkspaces.get(day.id);
  try{const saved=JSON.parse(localStorage.getItem(`casi-casi:workspace:${day.id}`)||'{}');return {note:typeof saved.note==='string'?saved.note:'',history:Array.isArray(saved.history)?saved.history.filter(item=>item&&typeof item.expression==='string'&&Number.isFinite(item.result)).slice(0,40):[]}}
  catch{return {note:'',history:[]}}
}
// workspaceId: el duelo comparte el bloc con el reto diario, con sus propias notas (duel.js lo fija mientras está abierto).
let workspaceId=null;
function saveWorkspace(){const id=workspaceId||activeDay.id;sessionWorkspaces.set(id,workspaceData);try{localStorage.setItem(`casi-casi:workspace:${id}`,JSON.stringify(workspaceData))}catch{showToast('El bloc durará solo hasta cerrar esta pestaña.')}}
function escapeHtml(value){return String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]))}
function renderWorkspace(){$('#scratch-note').value=workspaceData.note;$('#scratch-expression').value='';$('#scratch-result').textContent='=';renderHistory()}
function renderHistory(){$('#history-list').innerHTML=workspaceData.history.length?workspaceData.history.map((item,index)=>`<li class="history-item"><div><span>${escapeHtml(item.expression)}</span><strong>= ${format(item.result,6)}</strong></div><button type="button" data-use-result="${index}" aria-label="Usar resultado del cálculo ${index+1}">Usar</button><button type="button" data-remove-history="${index}" aria-label="Borrar cálculo ${index+1}">×</button></li>`).join(''):'<li class="history-empty">Tus operaciones aparecerán aquí.</li>'}
function toggleWorkspace(open){const panel=$('#workspace-panel'),toggle=$('#workspace-toggle');panel.hidden=!open;$('#game-layout').classList.toggle('workspace-open',open);if(toggle){toggle.setAttribute('aria-expanded',String(open));toggle.setAttribute('aria-label',`${open?'Cerrar':'Abrir'} calculadora y notas`)}if(open&&!matchMedia('(max-width:760px)').matches)$('#scratch-expression').focus();else if(!$('#game-shell').hidden)(toggle||$('#next-question')||$('#menu-toggle')).focus()}
function evaluateCalculation(source){
  const expression=source.trim().replace(/,/g,'.').replace(/×/g,'*').replace(/÷/g,'/').replace(/−/g,'-').replace(/\s+/g,'');
  if(!expression||expression.length>100||!/^[\d.+*/()-]+$/.test(expression))throw Error('Operación no válida');
  let index=0;
  function factor(){if(expression[index]==='+'){index++;return factor()}if(expression[index]==='-'){index++;return -factor()}if(expression[index]==='('){index++;const value=addition();if(expression[index++]!==')')throw Error('Paréntesis incompletos');return value}const match=/^(?:\d+(?:\.\d*)?|\.\d+)/.exec(expression.slice(index));if(!match)throw Error('Falta un número');index+=match[0].length;return Number(match[0])}
  function multiplication(){let value=factor();while(expression[index]==='*'||expression[index]==='/'){const operator=expression[index++],right=factor();value=operator==='*'?value*right:value/right}return value}
  function addition(){let value=multiplication();while(expression[index]==='+'||expression[index]==='-'){const operator=expression[index++],right=multiplication();value=operator==='+'?value+right:value-right}return value}
  const result=addition();if(index!==expression.length||!Number.isFinite(result))throw Error('Operación no válida');return result
}
function calculate(){const source=$('#scratch-expression').value.trim();try{const result=evaluateCalculation(source);$('#scratch-result').textContent=`= ${format(result,6)}`;workspaceData.history.unshift({expression:source,result});workspaceData.history=workspaceData.history.slice(0,40);saveWorkspace();renderHistory()}catch{$('#scratch-result').textContent='Revisa la operación'}}
function pressCalcKey(key){const input=$('#scratch-expression');if(key==='='){calculate();return}const start=input.selectionStart??input.value.length,end=input.selectionEnd??start;if(key==='C'){input.value='';input.focus();input.setSelectionRange(0,0)}else if(key==='⌫'){const from=start===end?Math.max(0,start-1):start;input.setRangeText('',from,end,'end');input.focus()}else{input.setRangeText(key,start,end,'end');input.focus()}$('#scratch-result').textContent='='}
function insertInNote(text){const input=$('#scratch-note'),start=input.selectionStart??input.value.length,end=input.selectionEnd??start;input.setRangeText(text,start,end,'end');input.focus();workspaceData.note=input.value;saveWorkspace()}
function showToast(message){const toast=$('#toast');toast.textContent=message;toast.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>toast.classList.remove('show'),3000)}
async function shareResult(){const guesses=getGuesses(activeDay),scores=activeDay.questions.map((q,i)=>score(guesses[i],q.answer)),average=scores.reduce((a,b)=>a+b,0)/3,text=`Faraday.gg · ${activeDay.name} ${prettyDate(activeDay.id)}\nMi distancia media: ${format(average)}×\n${scores.map((s,i)=>`${i+1}. ${format(s)}×`).join(' · ')}\n¿Y tú qué tanto te acercas?`;try{if(navigator.share){await navigator.share({title:'Mi resultado en Faraday.gg',text,url:location.href});return}await navigator.clipboard.writeText(`${text}\n${location.href}`);showToast('Resultado copiado al portapapeles.')}catch{showToast('No se pudo compartir ahora mismo.')}}

// Menú hamburguesa (decisión 0016): en el juego y en la portada. Reto de hoy, volver al inicio y el archivo para saltar a otro día.
const menuArchive=createArchive($('#menu-archive'),{compact:true});
window.openArchiveDay=(id)=>{toggleMenu(false);openDate(id)};
function menuOpen(){return document.body.classList.contains('menu-open')}
function toggleMenu(open=!menuOpen()){
  if(open===menuOpen())return;
  const drawer=$('#menu-drawer'),inGame=!$('#game-shell').hidden,toggle=$(inGame?'#menu-toggle':'#home-menu-toggle');
  document.body.classList.toggle('menu-open',open);drawer.setAttribute('aria-hidden',String(!open));drawer.inert=!open;
  document.querySelectorAll('.menu-toggle').forEach(button=>{button.setAttribute('aria-expanded',String(open));button.setAttribute('aria-label',open?'Cerrar menú':'Abrir menú')});
  $('#menu-home').hidden=!inGame;
  if(open){
    $('#menu-today').disabled=!currentDay;$('#menu-today-number').textContent=currentDay?'Nº '+editionNumber(todayKey):'';
    if(inGame&&activeDay)menuArchive.month=activeDay.id.slice(0,7);renderArchive(menuArchive);
    setTimeout(()=>drawer.querySelector('.menu-link:not(:disabled)')?.focus(),60);
  }else toggle.focus();
}
createArchive($('#home-archive'));
renderWeek();
document.querySelectorAll('[data-play]').forEach(button=>button.addEventListener('click',()=>{if(currentDay)openDay(currentDay)}));
$('#menu-toggle').addEventListener('click',()=>toggleMenu());
$('#home-menu-toggle').addEventListener('click',()=>toggleMenu());
document.querySelectorAll('[data-menu-close]').forEach(el=>el.addEventListener('click',()=>toggleMenu(false)));
$('#menu-today').addEventListener('click',()=>{toggleMenu(false);if(currentDay)openDay(currentDay)});
$('#menu-home').addEventListener('click',closeGame);
$('#workspace-close').addEventListener('click',()=>toggleWorkspace(false));
$('#workspace-panel').addEventListener('click',event=>{if(event.target===event.currentTarget)toggleWorkspace(false)});
$('#calc-keys').addEventListener('click',event=>{const key=event.target.closest('[data-calc-key]')?.dataset.calcKey;if(key)pressCalcKey(key)});
$('#scratch-expression').addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();calculate()}});
$('#scratch-expression').addEventListener('input',()=>{$('#scratch-result').textContent='='});
$('#scratch-note').addEventListener('input',event=>{workspaceData.note=event.target.value;saveWorkspace()});
$('#insert-bullet').addEventListener('click',()=>{const input=$('#scratch-note'),before=input.value.slice(0,input.selectionStart??input.value.length);insertInNote(before&&!before.endsWith('\n')?'\n• ':'• ')});
$('#insert-paragraph').addEventListener('click',()=>insertInNote('\n\n'));
$('#clear-note').addEventListener('click',()=>{if(workspaceData.note&&window.confirm('¿Borrar la nota de este día?')){workspaceData.note='';$('#scratch-note').value='';saveWorkspace();$('#scratch-note').focus()}});
$('#clear-history').addEventListener('click',()=>{if(workspaceData.history.length&&window.confirm('¿Borrar todo el historial de este día?')){workspaceData.history=[];saveWorkspace();renderHistory()}});
$('#history-list').addEventListener('click',event=>{const use=event.target.closest('[data-use-result]'),remove=event.target.closest('[data-remove-history]');if(use){$('#scratch-expression').value=String(workspaceData.history[Number(use.dataset.useResult)].result);$('#scratch-result').textContent='=';$('#scratch-expression').focus()}if(remove){workspaceData.history.splice(Number(remove.dataset.removeHistory),1);saveWorkspace();renderHistory()}});
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&menuOpen()&&$('#game-shell').hidden){toggleMenu(false);return}if(event.key==='Escape'&&!$('#game-shell').hidden){if(menuOpen()){toggleMenu(false)}else if(!$('#workspace-panel').hidden)toggleWorkspace(false);else if($('#explain-panel')&&!$('#explain-panel').hidden){toggleExplain(false);$('#explain-toggle').focus()}else closeGame()}});
$('#game-content').addEventListener('submit',event=>{if(event.target.id==='guess-form')submitGuess(event)});
$('#game-content').addEventListener('input',event=>{if(event.target.id==='guess-input'&&!event.isComposing)formatEstimateInput(event.target)});
$('#game-content').addEventListener('beforeinput',event=>{const input=event.target;if(input.id!=='guess-input'||input.selectionStart!==input.selectionEnd)return;const cursor=input.selectionStart;if(event.inputType==='deleteContentBackward'&&input.value[cursor-1]==='.'){event.preventDefault();input.setRangeText('',Math.max(0,cursor-2),cursor,'end');formatEstimateInput(input)}else if(event.inputType==='deleteContentForward'&&input.value[cursor]==='.'){event.preventDefault();input.setRangeText('',cursor,cursor+2,'end');formatEstimateInput(input)}});
$('#game-content').addEventListener('click',event=>{if($('.game-card.explaining')&&event.target.closest('.verdict,.ledger,.population')){toggleExplain(false);return}const id=event.target.closest('button')?.id;if(id==='workspace-toggle')toggleWorkspace($('#workspace-panel').hidden);if(id==='explain-toggle')toggleExplain();if(id==='explain-close')toggleExplain(false);if(id==='next-question'){activeIndex++;renderGame()}if(id==='share-result')shareResult();if(id==='another-day')closeGame();if(id==='more-calendar')toggleMenu(true);const other=event.target.closest('[data-open-day]');if(other)openDate(other.dataset.openDay);});
$('#game-steps').addEventListener('click',event=>{const step=event.target.closest('[data-step]');if(step&&!step.disabled){activeIndex=Number(step.dataset.step);renderGame()}});

$('#game-content').addEventListener('click',event=>{const review=event.target.closest('[data-review-index]');if(review){activeIndex=Number(review.dataset.reviewIndex);renderGame()}});

// Portada: al pasar el ratón por una tarjeta de ejemplo, sus cifras cuentan desde cero hasta su valor.
(() => {
  if(matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const format=(n,decimals)=>new Intl.NumberFormat('es-ES',{minimumFractionDigits:decimals,maximumFractionDigits:decimals,useGrouping:'always'}).format(n);
  document.querySelectorAll('.demo').forEach(card=>{
    const numbers=[...card.querySelectorAll('.demo-verdict strong,.demo-ledger b,.demo-score,.demo-rows b')].map(el=>{
      const text=el.textContent.trim(),match=text.match(/^([\d.,]+)(.*)$/);
      if(!match) return null;
      const decimals=(match[1].split(',')[1]||'').length;
      return {el,text,suffix:match[2],decimals,value:parseFloat(match[1].replace(/\./g,'').replace(',','.'))};
    }).filter(Boolean);
    if(!numbers.length) return;
    let frame=0;
    card.addEventListener('pointerenter',()=>{
      cancelAnimationFrame(frame);const start=performance.now(),duration=900;
      const tick=(now)=>{
        const t=Math.max(0,Math.min(1,(now-start)/duration)),eased=1-Math.pow(1-t,3);
        numbers.forEach(n=>{n.el.textContent=t<1?format(n.value*eased,n.decimals)+n.suffix:n.text});
        if(t<1) frame=requestAnimationFrame(tick);
      };
      frame=requestAnimationFrame(tick);
    });
  });
})();

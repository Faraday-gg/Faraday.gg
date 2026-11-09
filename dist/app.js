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
let archiveOpen = false;
const ARCHIVE_PREVIEW = 7;
let activeDay = currentDay;
let activeIndex = 0;
let showingResult = false;
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
  ['#header-play','#hero-play','#bottom-play'].forEach(selector=>$(selector).disabled=!currentDay);
  if(!currentDay)$('#hero-play').textContent='Retos en preparación';
  const roundsList=$('#hero-rounds');
  roundsList.innerHTML=currentDay?currentDay.questions.map((q,i)=>{const category=window.CATEGORIES?.[q.category];return category?`<li><span class="round-number">P${i+1}</span>${window.categoryIcon(q.category,'cat-icon cat-icon-hero')}<span class="sr-only">${category.label}</span></li>`:''}).join(''):'';
  roundsList.hidden=!roundsList.innerHTML;
  // Archivo: jornadas completas del calendario y resúmenes de las antiguas, de la más reciente a la más antigua, sin las futuras.
  const byId=new Map([...(window.DAILY_CALENDAR?.archive||[]),...DAYS].map(day=>[day.id,day]));
  const past=[...byId.values()].filter(day=>day.id<=todayKey).sort((a,b)=>a.id<b.id?1:-1);
  const shown=archiveOpen?past:past.slice(0,ARCHIVE_PREVIEW);
  $('#archive-count').textContent=past.length;
  $('#week-list').innerHTML=shown.map(day=>{
    const done=getGuesses(day).length===3,today=day.id===todayKey;
    return `<button type="button" class="week-item ${today?'today':''}" data-date="${day.id}" aria-label="Jugar el reto número ${editionNumber(day.id)}, ${day.name} ${prettyDate(day.id)}: ${day.theme}"><span class="week-day">Nº ${editionNumber(day.id)}</span><strong>${day.name}: ${day.theme}${today?'<span class="week-badge">HOY</span>':''}${done?'<span class="week-badge">HECHO</span>':''}</strong><span class="week-icons" aria-hidden="true">${icons(day)}</span><span class="week-date">${prettyDate(day.id)}</span><span class="week-arrow">↗</span></button>`;
  }).join('');
  const more=$('#archive-more');more.hidden=past.length<=ARCHIVE_PREVIEW;
  more.textContent=archiveOpen?'Ver solo los últimos días':`Ver todo el archivo (${past.length} días)`;
}
async function openDate(id){
  let day=loadedDays.get(id)||DAYS.find(d=>d.id===id&&d.questions);
  if(!day){
    try{const response=await fetch('/api/day?date='+encodeURIComponent(id),{signal:AbortSignal.timeout(8000)});if(!response.ok)throw Error();day=await response.json();loadedDays.set(id,day)}
    catch{showToast('No se ha podido cargar ese día. Inténtalo de nuevo.');return}
  }
  openDay(day);
}
function openDay(day){activeDay=day;const guesses=getGuesses(day);activeIndex=Math.min(guesses.length,2);showingResult=false;workspaceData=loadWorkspace(day);renderWorkspace();toggleWorkspace(false);$('#game-shell').hidden=false;document.body.classList.add('modal-open');renderGame();$('#game-close').focus()}
function closeGame(){toggleWorkspace(false);$('#game-shell').hidden=true;document.body.classList.remove('modal-open');renderWeek()}
function renderGame(){const guesses=getGuesses(activeDay);if(guesses.length===3&&!showingResult)renderSummary();else if(showingResult)renderResult(guesses);else renderQuestion();$('.game-panel').scrollTop=0}
function topMarkup(){return `<div class="game-top"><span>Nº ${editionNumber(activeDay.id)} · ${activeDay.name.toUpperCase()} · ${prettyDate(activeDay.id).toUpperCase()}</span><span>${activeIndex+1} / 3</span></div><div class="progress-dots" aria-label="Pregunta ${activeIndex+1} de 3">${[0,1,2].map(i=>`<span class="${i<activeIndex?'done':i===activeIndex?'active':''}"></span>`).join('')}</div>`}
function renderQuestion(){const q=activeDay.questions[activeIndex],workspaceOpen=!$('#workspace-panel').hidden;$('#game-content').innerHTML=`${topMarkup()}<span class="question-tag">${window.categoryIcon?.(q.category,'cat-icon cat-icon-tag')||''}${q.tag}</span><h2 id="game-title">${q.title}</h2>${questionMedia(q)}<form id="guess-form"><label class="guess-label" for="guess-input">TU ESTIMACIÓN</label><div class="guess-row"><input id="guess-input" type="text" inputmode="decimal" autocomplete="off" placeholder="Escribe una cifra" aria-describedby="guess-help" required><span class="guess-unit">${q.unit}</span></div><div class="form-error" id="guess-help" role="alert"></div><div class="game-actions"><button class="workspace-launch" type="button" id="workspace-toggle" aria-label="${workspaceOpen?'Cerrar':'Abrir'} calculadora y notas" aria-expanded="${workspaceOpen}" aria-controls="workspace-panel" title="Calculadora y notas"><svg aria-hidden="true" viewBox="0 0 32 36" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="1.5" width="25" height="33" rx="3.5"/><rect x="8" y="6" width="16" height="7" rx="1"/><path d="M9 19h3m6 0h3M9 24h3m6 0h3M9 29h3m6 0h3"/></svg></button><button class="button button-coral" type="submit">Confirmar respuesta <span aria-hidden="true">↗</span></button></div><p class="answer-sharing">Tu cifra se comparte de forma anónima para comparar estimaciones.</p></form>`;$('#guess-input').focus()}
function renderResult(guesses){
  const q=activeDay.questions[activeIndex],guess=guesses[activeIndex],factor=score(guess,q.answer),direction=guess<q.answer?'Te quedaste corto':guess>q.answer?'Te pasaste':'¡Exacto!';
  $('#game-content').innerHTML=`${topMarkup()}<span class="question-tag">RESULTADO ${activeIndex+1}</span><h2 id="game-title">${q.title}</h2><div class="result-banner"><span class="label">TU DISTANCIA</span><strong>${format(factor)}×</strong><span>${direction}</span></div><div class="answer-grid"><div class="answer-box"><span class="label">TU RESPUESTA</span><strong>${format(guess)}</strong><small>${q.unit}</small></div><div class="answer-box"><span class="label">REFERENCIA</span><strong>≈ ${format(q.answer)}</strong><small>${q.unit}</small></div></div>${populationMarkup(q)}${reasoningMarkup(q)}${sourceMarkup(q)}<p class="result-comment">Cuanto más cerca de 1×, mejor. Las estimaciones usan las condiciones indicadas en cada reto.</p><button class="button button-dark" id="next-question" type="button">${guesses.length===3?'Ver mi resultado':'Siguiente pregunta'} <span aria-hidden="true">→</span></button>`;
  loadDistribution(q,guess);$('#next-question').focus()
}
function renderSummary(){const guesses=getGuesses(activeDay),scores=activeDay.questions.map((q,i)=>score(guesses[i],q.answer)),average=scores.reduce((a,b)=>a+b,0)/3;$('#game-content').innerHTML=`<div class="game-top"><span>${activeDay.name.toUpperCase()} · ${prettyDate(activeDay.id).toUpperCase()}</span><span>3 / 3</span></div><div class="progress-dots"><span class="done"></span><span class="done"></span><span class="done"></span></div><span class="question-tag">RETO COMPLETADO</span><h2 id="game-title">¡Casi, casi!</h2><p class="question-detail">Tu distancia media a las tres respuestas fue de:</p><div class="daily-score-visual"><div id="daily-score-chart" aria-hidden="true"></div><div class="summary-score">${format(average)}×</div></div><p class="daily-population-caption" id="daily-score-caption" aria-live="polite">Consultando las puntuaciones del día…</p><p class="result-comment">1× sería un pleno. Tu puntuación es la media de las distancias; cuanto menor, mejor.</p><div class="summary-list">${activeDay.questions.map((q,i)=>`<div class="summary-row"><div><span>${i+1}. ${q.title}</span><button type="button" class="summary-review" data-review-index="${i}">Ver fuentes y distribución ↗</button></div><strong>${format(scores[i])}×</strong></div>`).join('')}</div><div class="summary-actions"><button class="button button-coral" id="share-result" type="button">Compartir resultado ↗</button><button class="button secondary-button" id="another-day" type="button">Ver la semana →</button></div>`;loadDailyDistribution(activeDay,guesses)}
function formatEstimateInput(input){
  const cursor=input.selectionStart??input.value.length;
  const meaningful=input.value.slice(0,cursor).replace(/[^\d,]/g,'').length;
  const clean=input.value.replace(/[^\d,]/g,''),parts=clean.split(',');
  const integer=parts[0].replace(/^0+(?=\d)/,'');
  input.value=integer.replace(/\B(?=(\d{3})+(?!\d))/g,'.')+(parts.length>1?','+parts.slice(1).join(''):'');
  let position=0,count=0;while(position<input.value.length&&count<meaningful){if(/[\d,]/.test(input.value[position]))count++;position++}
  input.setSelectionRange(position,position)
}
function submitGuess(event){event.preventDefault();const raw=$('#guess-input').value.trim().replace(/[.\s]/g,'').replace(',','.');const guess=Number(raw);if(!/^\d+(\.\d+)?$/.test(raw)||!Number.isFinite(guess)||guess<=0){$('#guess-help').textContent='Escribe un número mayor que cero. Usa coma para los decimales.';return}const guesses=getGuesses(activeDay);if(guesses.length!==activeIndex)return;guesses.push(guess);saveGuesses(activeDay,guesses);showingResult=true;renderGame()}
function loadWorkspace(day){
  if(sessionWorkspaces.has(day.id))return sessionWorkspaces.get(day.id);
  try{const saved=JSON.parse(localStorage.getItem(`casi-casi:workspace:${day.id}`)||'{}');return {note:typeof saved.note==='string'?saved.note:'',history:Array.isArray(saved.history)?saved.history.filter(item=>item&&typeof item.expression==='string'&&Number.isFinite(item.result)).slice(0,40):[]}}
  catch{return {note:'',history:[]}}
}
function saveWorkspace(){sessionWorkspaces.set(activeDay.id,workspaceData);try{localStorage.setItem(`casi-casi:workspace:${activeDay.id}`,JSON.stringify(workspaceData))}catch{showToast('El bloc durará solo hasta cerrar esta pestaña.')}}
function escapeHtml(value){return String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]))}
function renderWorkspace(){$('#scratch-note').value=workspaceData.note;$('#scratch-expression').value='';$('#scratch-result').textContent='=';renderHistory()}
function renderHistory(){$('#history-list').innerHTML=workspaceData.history.length?workspaceData.history.map((item,index)=>`<li class="history-item"><div><span>${escapeHtml(item.expression)}</span><strong>= ${format(item.result,6)}</strong></div><button type="button" data-use-result="${index}" aria-label="Usar resultado del cálculo ${index+1}">Usar</button><button type="button" data-remove-history="${index}" aria-label="Borrar cálculo ${index+1}">×</button></li>`).join(''):'<li class="history-empty">Tus operaciones aparecerán aquí.</li>'}
function toggleWorkspace(open){const panel=$('#workspace-panel'),toggle=$('#workspace-toggle');panel.hidden=!open;$('#game-layout').classList.toggle('workspace-open',open);if(toggle){toggle.setAttribute('aria-expanded',String(open));toggle.setAttribute('aria-label',`${open?'Cerrar':'Abrir'} calculadora y notas`)}if(open)$('#scratch-expression').focus();else if(!$('#game-shell').hidden)(toggle||$('#next-question')||$('#game-close')).focus()}
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

renderWeek();
['#header-play','#hero-play','#bottom-play'].forEach(selector=>$(selector).addEventListener('click',()=>{if(currentDay)openDay(currentDay)}));
$('#week-list').addEventListener('click',event=>{const button=event.target.closest('[data-date]');if(button)openDate(button.dataset.date)});
$('#archive-more').addEventListener('click',()=>{archiveOpen=!archiveOpen;renderWeek();if(!archiveOpen)$('#semana').scrollIntoView()});
$('#game-close').addEventListener('click',closeGame);
$('#workspace-close').addEventListener('click',()=>toggleWorkspace(false));
$('#calc-keys').addEventListener('click',event=>{const key=event.target.closest('[data-calc-key]')?.dataset.calcKey;if(key)pressCalcKey(key)});
$('#scratch-expression').addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();calculate()}});
$('#scratch-expression').addEventListener('input',()=>{$('#scratch-result').textContent='='});
$('#scratch-note').addEventListener('input',event=>{workspaceData.note=event.target.value;saveWorkspace()});
$('#insert-bullet').addEventListener('click',()=>{const input=$('#scratch-note'),before=input.value.slice(0,input.selectionStart??input.value.length);insertInNote(before&&!before.endsWith('\n')?'\n• ':'• ')});
$('#insert-paragraph').addEventListener('click',()=>insertInNote('\n\n'));
$('#clear-note').addEventListener('click',()=>{if(workspaceData.note&&window.confirm('¿Borrar la nota de este día?')){workspaceData.note='';$('#scratch-note').value='';saveWorkspace();$('#scratch-note').focus()}});
$('#clear-history').addEventListener('click',()=>{if(workspaceData.history.length&&window.confirm('¿Borrar todo el historial de este día?')){workspaceData.history=[];saveWorkspace();renderHistory()}});
$('#history-list').addEventListener('click',event=>{const use=event.target.closest('[data-use-result]'),remove=event.target.closest('[data-remove-history]');if(use){$('#scratch-expression').value=String(workspaceData.history[Number(use.dataset.useResult)].result);$('#scratch-result').textContent='=';$('#scratch-expression').focus()}if(remove){workspaceData.history.splice(Number(remove.dataset.removeHistory),1);saveWorkspace();renderHistory()}});
$('#game-shell').addEventListener('click',event=>{if(event.target.classList.contains('game-backdrop'))closeGame()});
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!$('#game-shell').hidden){if(!$('#workspace-panel').hidden)toggleWorkspace(false);else closeGame()}});
$('#game-content').addEventListener('submit',event=>{if(event.target.id==='guess-form')submitGuess(event)});
$('#game-content').addEventListener('input',event=>{if(event.target.id==='guess-input'&&!event.isComposing)formatEstimateInput(event.target)});
$('#game-content').addEventListener('beforeinput',event=>{const input=event.target;if(input.id!=='guess-input'||input.selectionStart!==input.selectionEnd)return;const cursor=input.selectionStart;if(event.inputType==='deleteContentBackward'&&input.value[cursor-1]==='.'){event.preventDefault();input.setRangeText('',Math.max(0,cursor-2),cursor,'end');formatEstimateInput(input)}else if(event.inputType==='deleteContentForward'&&input.value[cursor]==='.'){event.preventDefault();input.setRangeText('',cursor,cursor+2,'end');formatEstimateInput(input)}});
$('#game-content').addEventListener('click',event=>{const id=event.target.closest('button')?.id;if(id==='workspace-toggle')toggleWorkspace($('#workspace-panel').hidden);if(id==='next-question'){showingResult=false;activeIndex++;renderGame()}if(id==='share-result')shareResult();if(id==='another-day'){closeGame();$('#semana').scrollIntoView({behavior:'smooth'})}});

$('#game-content').addEventListener('click',event=>{const review=event.target.closest('[data-review-index]');if(review){activeIndex=Number(review.dataset.reviewIndex);showingResult=true;renderGame()}});

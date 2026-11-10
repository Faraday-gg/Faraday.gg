// Archivo de retos (decisión 0016): un calendario por meses con la puntuación de cada día jugado y un «Reto sorpresa».
// Se dibuja en la portada y en el menú del juego. Usa las variables globales de app.js (DAYS, todayKey, getGuesses…).
const ARC_MONTH = new Intl.DateTimeFormat('es-ES',{month:'long',timeZone:'UTC'});
const ARC_WEEKDAY = new Intl.DateTimeFormat('es-ES',{weekday:'long',timeZone:'UTC'});
const ARC_DICE = '<svg viewBox="0 0 32 32" aria-hidden="true"><rect x="3" y="3" width="26" height="26" rx="7" fill="currentColor"/><g fill="var(--arc-pip,#202630)"><circle cx="10.5" cy="10.5" r="2.4"/><circle cx="21.5" cy="10.5" r="2.4"/><circle cx="16" cy="16" r="2.4"/><circle cx="10.5" cy="21.5" r="2.4"/><circle cx="21.5" cy="21.5" r="2.4"/></g></svg>';
const archives = [];
const monthKey = (id) => id.slice(0,7);
const shiftMonth = (key,delta) => {const [y,m]=key.split('-').map(Number),d=new Date(Date.UTC(y,m-1+delta,1));return d.toISOString().slice(0,7)};
const titleCase = (text) => text.charAt(0).toUpperCase()+text.slice(1);

// Días jugables: las jornadas completas del calendario y los resúmenes de las antiguas, sin las futuras.
function archiveDays(){
  const byId=new Map([...(window.DAILY_CALENDAR?.archive||[]),...DAYS,...loadedDays.values()].map(day=>[day.id,day]));
  return [...byId.values()].filter(day=>day.id<=todayKey).sort((a,b)=>a.id<b.id?-1:1);
}
// Puntuación media de un día jugado. Las jornadas antiguas llegan sin respuestas, así que se guarda al calcularla.
function dayScore(day){
  const guesses=getGuesses(day);if(guesses.length!==3)return null;
  const key=`casi-casi:score:${day.id}`;
  if(day.questions?.every(q=>Number.isFinite(q.answer))){
    const value=day.questions.reduce((sum,q,i)=>sum+score(guesses[i],q.answer),0)/3;
    try{localStorage.setItem(key,String(value))}catch{}
    return value;
  }
  try{const saved=Number(localStorage.getItem(key));return saved>=1?saved:0}catch{return 0}
}
const shortTimes = (value) => value?new Intl.NumberFormat('es-ES',value<1000?{maximumFractionDigits:value<10?1:0}:{notation:'compact',maximumFractionDigits:0}).format(value).replace(/\s/g,' ')+'×':'✓';

function createArchive(container,{compact=false}={}){
  const state={container,compact,month:monthKey(todayKey),visible:false,rolling:false,direction:0};
  container.classList.add('arc');if(compact)container.classList.add('arc-compact');
  container.innerHTML=`<div class="arc-top">
    <div class="arc-progress"><p><strong data-arc-played>0</strong> de <span data-arc-total>0</span> <span class="arc-progress-label">retos jugados</span></p><div class="arc-bar" aria-hidden="true"><i data-arc-fill></i></div></div>
    <button class="arc-dice" type="button" data-arc-random><span class="arc-dice-icon">${ARC_DICE}</span><span>Reto sorpresa</span></button>
  </div>
  <div class="arc-month">
    <button class="arc-nav" type="button" data-arc-step="-1" aria-label="Mes anterior">←</button>
    <h3 class="arc-month-name" aria-live="polite"></h3>
    <button class="arc-nav" type="button" data-arc-step="1" aria-label="Mes siguiente">→</button>
  </div>
  <div class="arc-weekdays" aria-hidden="true"><span>L</span><span>M</span><span>X</span><span>J</span><span>V</span><span>S</span><span>D</span></div>
  <div class="arc-grid" data-arc-grid></div>
  <div class="arc-legend" aria-hidden="true"><span><i class="arc-key-done"></i>Jugado</span><span><i class="arc-key-open"></i>Por jugar</span><span><i class="arc-key-today"></i>Hoy</span></div>
  <div class="arc-peek" data-arc-peek aria-live="polite"></div>`;
  container.addEventListener('click',event=>{
    const step=event.target.closest('[data-arc-step]');
    if(step&&!step.disabled){changeMonth(state,Number(step.dataset.arcStep));return}
    if(event.target.closest('[data-arc-random]')){surprise(state);return}
    const tile=event.target.closest('[data-date]');
    if(tile&&!state.rolling)window.openArchiveDay?.(tile.dataset.date);
  });
  const peekFrom=event=>{const tile=event.target.closest?.('.arc-tile[data-date]');if(tile&&!state.rolling)renderPeek(state,tile.dataset.date)};
  container.addEventListener('pointerover',peekFrom);container.addEventListener('focusin',peekFrom);
  container.addEventListener('pointerleave',()=>{if(!state.rolling)renderPeek(state)});
  // La animación de entrada empieza cuando el archivo aparece en pantalla.
  if('IntersectionObserver' in window&&!compact){
    const observer=new IntersectionObserver(entries=>{if(entries.some(entry=>entry.isIntersecting)){observer.disconnect();state.visible=true;container.classList.add('is-visible')}},{threshold:.2});
    observer.observe(container);
  }else{state.visible=true;container.classList.add('is-visible')}
  archives.push(state);renderArchive(state);return state;
}

function renderArchive(state){
  const days=archiveDays(),byId=new Map(days.map(day=>[day.id,day]));
  const first=monthKey(days[0]?.id||todayKey),last=monthKey(todayKey);
  state.month=state.month<first?first:state.month>last?last:state.month;
  const played=days.filter(day=>getGuesses(day).length===3).length;
  const $in=(selector)=>state.container.querySelector(selector);
  $in('[data-arc-played]').textContent=played;$in('[data-arc-total]').textContent=days.length;
  $in('[data-arc-fill]').style.setProperty('--p',days.length?played/days.length:0);
  $in('[data-arc-random]').disabled=!days.some(day=>getGuesses(day).length<3);
  const [year,month]=state.month.split('-').map(Number),start=new Date(Date.UTC(year,month-1,1));
  $in('.arc-month-name').innerHTML=`${titleCase(ARC_MONTH.format(start))} <small>${year}</small>`;
  $in('[data-arc-step="-1"]').disabled=state.month<=first;$in('[data-arc-step="1"]').disabled=state.month>=last;
  const blanks=(start.getUTCDay()+6)%7,length=new Date(Date.UTC(year,month,0)).getUTCDate();
  const cells=Array.from({length:blanks},()=>'<span class="arc-cell arc-blank"></span>');
  for(let n=1;n<=length;n++){
    const id=`${state.month}-${String(n).padStart(2,'0')}`,day=byId.get(id),i=cells.length;
    if(!day){cells.push(`<span class="arc-cell arc-tile arc-off" style="--i:${i}"><span class="arc-n">${n}</span></span>`);continue}
    const value=dayScore(day),done=value!==null,today=id===todayKey;
    const dots=categoriesOf(day).map(key=>`<i class="cat-${window.CATEGORIES?.[key]?.color||'paper'}"></i>`).join('');
    const label=`Reto número ${editionNumber(id)}, ${prettyDate(id)}${today?', el de hoy':''}${done?`, jugado: ${shortTimes(value)}`:', sin jugar'}`;
    cells.push(`<button type="button" class="arc-cell arc-tile ${done?'arc-done':'arc-open'}${today?' arc-today':''}" data-date="${id}" style="--i:${i}" aria-label="${label}"><span class="arc-n">${n}</span>${done?`<b class="arc-score">${shortTimes(value)}</b>`:`<span class="arc-dots" aria-hidden="true">${dots}</span>`}${today?'<span class="arc-flag">Hoy</span>':''}</button>`);
  }
  const grid=$in('[data-arc-grid]');
  grid.dataset.direction=state.direction<0?'prev':state.direction>0?'next':'';
  grid.innerHTML=cells.join('');state.direction=0;
  renderPeek(state);
}
// Debajo del calendario: el día que señalas o, si no, el último reto que te falta.
function renderPeek(state,id){
  const days=archiveDays(),peek=state.container.querySelector('[data-arc-peek]');
  const day=id?days.find(d=>d.id===id):[...days].reverse().find(d=>getGuesses(d).length<3);
  if(!day){state.peekKey='';peek.innerHTML='<p class="arc-peek-done">Has jugado todo el archivo. Mañana, otro reto.</p>';return}
  const done=getGuesses(day).length===3,today=day.id===todayKey,value=done?dayScore(day):null;
  // pointerover salta al pasar por cada elemento de la casilla: solo se redibuja si cambia el día o su estado.
  const key=`${day.id}|${done}|${!!id}`;if(key===state.peekKey)return;state.peekKey=key;
  const kicker=id?(today?'El de hoy':done?'Ya jugado':'Por jugar'):'Te espera';
  peek.innerHTML=`<button type="button" class="arc-peek-card" data-date="${day.id}"><span class="arc-peek-kicker">${kicker} · Nº ${editionNumber(day.id)}</span><strong>${titleCase(ARC_WEEKDAY.format(new Date(day.id+'T12:00:00Z')))} ${prettyDate(day.id).replace(/ de \d{4}$/,'')}</strong><span class="arc-peek-theme">${day.theme||''}</span><span class="arc-peek-icons" aria-hidden="true">${icons(day,'cat-icon')}</span><span class="arc-peek-go">${done?`${shortTimes(value)} · Repasar`:'Jugar'} <span aria-hidden="true">→</span></span></button>`;
}
function changeMonth(state,delta){state.direction=delta;state.month=shiftMonth(state.month,delta);renderArchive(state)}
// «Reto sorpresa»: elige un día sin jugar, va a su mes y hace una ruleta por los días pendientes antes de abrirlo.
function surprise(state){
  if(state.rolling)return;
  const pending=archiveDays().filter(day=>getGuesses(day).length<3&&day.id!==todayKey);
  const pool=pending.length?pending:archiveDays().filter(day=>getGuesses(day).length<3);
  if(!pool.length)return;
  const pick=pool[Math.floor(Math.random()*pool.length)];
  if(matchMedia('(prefers-reduced-motion: reduce)').matches){window.openArchiveDay?.(pick.id);return}
  state.rolling=true;state.container.classList.add('is-rolling');
  if(monthKey(pick.id)!==state.month){state.direction=monthKey(pick.id)<state.month?-1:1;state.month=monthKey(pick.id);renderArchive(state)}
  const tiles=[...state.container.querySelectorAll('.arc-open[data-date]')],target=tiles.find(tile=>tile.dataset.date===pick.id);
  let hops=0,delay=55,last;
  const hop=()=>{
    last?.classList.remove('arc-hit');
    if(hops>=14&&target){target.classList.add('arc-hit','arc-picked');renderPeek(state,pick.id);setTimeout(()=>{state.rolling=false;state.container.classList.remove('is-rolling');target.classList.remove('arc-hit','arc-picked');window.openArchiveDay?.(pick.id)},650);return}
    last=tiles[Math.floor(Math.random()*tiles.length)];last?.classList.add('arc-hit');hops++;delay*=1.13;setTimeout(hop,delay);
  };
  setTimeout(hop,280);
}
function renderArchives(){archives.forEach(state=>{if(state.container.isConnected)renderArchive(state)})}

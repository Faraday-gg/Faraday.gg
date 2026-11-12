// Momento «¡Casi casi!» (decisión 0030): cuando una respuesta del reto diario o del archivo queda a menos de 1,1× de la
// cifra real, la tarjeta de respuesta lo celebra (destello, sello «¡CASI CASI!» y un sonido propio) y dice cuántos más lo
// han clavado. Estimar con esa precisión es raro: es un logro que apetece contar (moneda social) y el pico de la partida.
// Aquí vive la regla (qué cuenta como «Casi casi», el contador sin repeticiones y el texto del dato social) y el adorno de
// la tarjeta. progress.js guarda el contador y desbloquea la pieza exclusiva del avatar; duel.js solo enseña un indicador.
// Sin presión ni castigos (juegan menores): no hay cuenta atrás ni se pierde nada por no clavarla.
(()=>{
  const LIMIT=1.1,GOAL=10,KEEP=300;
  // Cuenta como «Casi casi» un multiplicador por debajo de 1,1× (1× es exacto).
  const is=factor=>Number.isFinite(factor)&&factor>=1&&factor<LIMIT;
  // Contador guardado en el progreso: n = total; ids = preguntas ya contadas (las últimas KEEP), para no contar dos veces.
  function normalize(saved){
    const ids=Array.isArray(saved?.ids)?[...new Set(saved.ids.filter(id=>typeof id==='string'&&id))].slice(-KEEP):[];
    const n=Number.isInteger(saved?.n)&&saved.n>=0?saved.n:0;
    return {n:Math.max(n,ids.length),ids};
  }
  // Suma uno si la respuesta es «Casi casi» y esa pregunta no se había contado ya. Devuelve el contador nuevo.
  function record(saved,{question,factor}={}){
    const current=normalize(saved);
    if(!is(factor)||typeof question!=='string'||!question||current.ids.includes(question))return {record:current,counted:false};
    return {record:{n:current.n+1,ids:[...current.ids,question].slice(-KEEP)},counted:true};
  }
  // Dato social con la distribución real. Con la muestra simulada (decisión 0014) no se inventa ningún porcentaje.
  // data = respuesta de /api/answers ({count, near}) o null si la tarjeta está usando la simulación.
  const percent=value=>new Intl.NumberFormat('es-ES',{maximumFractionDigits:0}).format(value)+' %';
  function social(data,{today=true}={}){
    const when=today?' hoy':'';
    if(!data||!Number.isInteger(data.near)||!Number.isInteger(data.count)||data.count<1)return {real:false,text:'¡Lo has clavado! Aún hay pocas respuestas para saber cuántos más lo han hecho.'};
    const share=data.near/data.count*100;
    const text=!data.near?`Nadie más lo ha clavado${when}.`:share<1?`Menos del 1 % lo ha clavado${when}.`:share<=50?`Solo el ${percent(share)} lo ha clavado${when}.`:`El ${percent(share)} lo ha clavado${when}.`;
    return {real:true,text};
  }
  window.CasiCasi={LIMIT,GOAL,is,normalize,record,social};
  if(typeof document==='undefined'||!document.addEventListener)return;

  // La celebración completa (destello y sonido) solo al responder; al volver a abrir la pregunta, el sello queda quieto.
  let fresh=null;
  document.addEventListener('faraday:answer',({detail})=>{fresh=detail?.question||null});
  const calm=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
  // Lo llama renderResult (app.js) con la tarjeta ya pintada.
  function card(q,factor,{today=true}={}){
    const verdict=document.querySelector('#game-content .verdict'),box=verdict?.closest('.game-card'),justNow=fresh===q.id;fresh=null;
    if(!verdict||!box||!is(factor))return;
    const count=justNow&&window.Progress?.casi?window.Progress.casi():0;
    verdict.insertAdjacentHTML('afterend',`<div class="casi-moment" role="status"><strong class="casi-stamp">¡CASI CASI!</strong>${count?`<small class="casi-count">Tu nº ${count}</small>`:''}<p class="casi-social" data-casi-social="${q.id}" data-today="${today}"></p></div>`);
    box.classList.add('is-casi');
    if(justNow){box.classList.remove('casi-fresh');void box.offsetWidth;box.classList.add('casi-fresh');window.Sound?.resume?.();window.Sound?.casi?.(calm()?.05:.75)}
  }
  // community.js avisa cuando tiene la distribución de la pregunta (real o simulada).
  document.addEventListener('faraday:distribucion',({detail})=>{
    const line=[...document.querySelectorAll('[data-casi-social]')].find(el=>el.dataset.casiSocial===detail?.question);if(!line)return;
    const result=social(detail.data,{today:line.dataset.today==='true'});line.textContent=result.text;line.classList.toggle('is-estimate',!result.real);
  });
  window.CasiCasi.card=card;
})();

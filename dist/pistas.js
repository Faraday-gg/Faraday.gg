// Pistas (decisión 0039): una por pregunta del reto (del día o del archivo), nunca en los duelos.
// Se desbloquea pagando faradios (Pistas.COST) o viendo un anuncio (ads.js, de momento simulado).
// La pista sale de lo que ya trae cada pregunta, sin escribir nada nuevo: entre qué potencias de 10 está la
// respuesta y, si la pregunta tiene razonamiento, por dónde empezar (su título).
// Qué preguntas tienen la pista desbloqueada se guarda en este navegador, como el resto del progreso.
(()=>{
  const KEY='casi-casi:pistas',COST=100;
  let saved={};
  try{const data=JSON.parse(localStorage.getItem(KEY));if(data&&typeof data==='object')saved=data}catch{}
  const store=()=>{try{localStorage.setItem(KEY,JSON.stringify(saved))}catch{}};
  const used=id=>saved[id]?.via||null;

  // 10^n en palabras sencillas: 1.000, 10.000, 1 millón, 100 millones, 10.000 millones, 1 billón…
  const group=n=>new Intl.NumberFormat('es-ES',{maximumFractionDigits:12,useGrouping:'always'}).format(n);
  function power(exp){
    if(exp>=12)return exp===12?'1 billón':`${group(10**(exp-12))} billones`;
    if(exp>=6)return exp===6?'1 millón':`${group(10**(exp-6))} millones`;
    return group(Number(`1e${exp}`));
  }
  // Las dos potencias de 10 entre las que está la respuesta (la de abajo incluida).
  function range(answer){
    const exp=Math.floor(Math.log10(answer)+1e-9);
    return [power(exp),power(exp+1)];
  }
  const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  function box(q){
    const [low,high]=range(q.answer),start=q.reasoning?.heading;
    return `<aside class="hint-box" aria-label="Pista"><p class="hint-kicker"><span aria-hidden="true">💡</span> Pista</p><p>La respuesta está <b>entre ${low} y ${high}</b>${/ones$/.test(high)?' de':''} ${esc(q.unit)}.</p>${start?`<p class="hint-start">Por dónde empezar: ${esc(start)}</p>`:''}</aside>`;
  }
  const BULB='<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.6 10.8c.7.5 1.1 1.3 1.1 2.2h5c0-.9.4-1.7 1.1-2.2A6 6 0 0 0 12 3Z"/></svg>';
  // Lo que se pinta en la pregunta: la pista si ya está desbloqueada; si no, nada (el botón va aparte).
  const markup=q=>used(q.id)?box(q):'';
  const button=q=>used(q.id)?'':`<button class="workspace-launch hint-launch" type="button" id="hint-toggle" aria-haspopup="dialog" title="Pedir una pista">${BULB}<span class="sr-only">Pedir una pista</span></button>`;

  // Ventana de oferta: pagar faradios o ver un anuncio.
  let dialog=null,current=null;
  function build(){
    if(dialog)return dialog;
    dialog=document.createElement('dialog');
    dialog.className='hint-dialog';dialog.setAttribute('aria-labelledby','hint-title');
    document.body.append(dialog);
    dialog.addEventListener('keydown',e=>{if(e.key==='Escape')e.stopPropagation()}); // Que Escape cierre la ventana, no el juego.
    dialog.addEventListener('click',e=>{
      if(e.target===dialog||e.target.closest('[data-hint-close]'))dialog.close();
      else if(e.target.closest('[data-hint-pay]'))pay();
      else if(e.target.closest('[data-hint-ad]'))watch();
    });
    dialog.addEventListener('close',()=>{if(current&&!used(current.q.id))document.getElementById('hint-toggle')?.focus()});
    return dialog;
  }
  function render(){
    const coins=window.Progress?.coins?.()??0,short=Math.max(0,COST-coins),ad=window.Ads;
    dialog.innerHTML=`<button type="button" class="share-close" aria-label="Cerrar" data-hint-close>×</button>
<p class="hint-dialog-icon" aria-hidden="true">💡</p>
<h2 id="hint-title">¿Quieres una pista?</h2>
<p class="hint-dialog-text">Te diremos entre qué cifras está la respuesta y por dónde empezar a calcularla. Una por pregunta.</p>
<div class="hint-options">
<button type="button" class="game-primary" data-hint-pay${short?' disabled':''}>Usar ${COST} <span class="coin" aria-hidden="true">≈</span><span class="sr-only"> faradios</span></button>
<p class="hint-balance">${short?`Tienes ${coins} ≈: te faltan ${short}.`:`Tienes ${coins} ≈.`}</p>
${ad?`<button type="button" class="game-secondary" data-hint-ad><span aria-hidden="true">▶</span> Ver un anuncio</button>${ad.simulated?'<p class="hint-balance">De momento el anuncio es de prueba.</p>':''}`:''}
</div>`;
  }
  function unlock(via){
    const {q,onUnlock}=current;
    saved[q.id]={via,at:new Date().toISOString().slice(0,10)};store();
    if(dialog.open)dialog.close();
    document.dispatchEvent(new CustomEvent('faraday:hint',{detail:{question:q.id,via}}));
    onUnlock?.(box(q),via);
  }
  function pay(){
    if(!current||used(current.q.id))return;
    if(!window.Progress?.spend?.(COST)){render();return}
    unlock('coins');
  }
  async function watch(){
    if(!current||used(current.q.id)||!window.Ads)return;
    const entry=current;dialog.close();
    const watched=await window.Ads.rewarded();
    if(current!==entry||used(entry.q.id))return;
    if(watched)unlock('ad');
    else{window.showToast?.('Sin anuncio completo no hay pista.');document.getElementById('hint-toggle')?.focus()}
  }
  // Abre la oferta para una pregunta. onUnlock(html, via) recibe la pista ya pintada.
  function open(q,onUnlock){
    if(used(q.id))return;
    current={q,onUnlock};build();render();dialog.showModal();
  }

  window.Pistas={COST,used,markup,button,open,range};
})();

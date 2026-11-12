// Reconectar a la partida (decisión 0042). Si sales de un duelo sin rendirte (cierras la pestaña, recargas, vuelves a
// la portada o se cae la conexión), el servidor sigue teniéndolo en marcha. Al volver, esto le pregunta si tienes uno
// y enseña «Reconectar a la partida» en la portada y en el menú. El duelo en sí lo pinta duel.js (DueloReconectar.open).
(()=>{
  const shell=$('#duel-shell'),COUNTED='casi-casi:duelo:contados';
  const int=n=>new Intl.NumberFormat('es-ES',{maximumFractionDigits:0,useGrouping:'always'}).format(n);
  const esc=text=>String(text).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let active=null,checking=false;

  const pill=document.createElement('button');
  pill.type='button';pill.className='duel-reconnect';pill.hidden=true;
  document.body.append(pill);
  let menuLink=null;
  function ensureMenuLink(){
    if(menuLink?.isConnected)return menuLink;
    // Menú rediseñado (decisión 0041): primera fila de la lista «Juega», con el mismo formato que las demás.
    const list=document.querySelector('.menu-list');if(!list)return null;
    menuLink=document.createElement('li');menuLink.className='menu-reconnect-item';menuLink.hidden=true;
    menuLink.innerHTML='<button type="button" class="menu-link menu-link-reconnect"></button>';
    list.prepend(menuLink);menuLink.firstChild.addEventListener('click',go);return menuLink;
  }

  const counted=()=>{try{return JSON.parse(localStorage.getItem(COUNTED))||[]}catch{return[]}};
  function describe(duel){
    const rival=duel.rival?.name?esc(duel.rival.name):'';
    if(duel.status==='finished')return {title:'Ver cómo acabó tu duelo',note:rival?`contra ${rival}`:''};
    if(duel.status==='waiting')return {title:'Reconectar a la partida',note:`Esperando rival · código ${esc(duel.code)}`};
    const round=duel.round?`Ronda ${duel.round} de ${duel.maxRounds} · `:'';
    return {title:'Reconectar a la partida',note:`${round}${int(duel.hp[0])} – ${int(duel.hp[1])} de vida${rival?` · contra ${rival}`:''}`};
  }
  function render(){
    const show=!!active&&shell.hidden;
    pill.hidden=!show;
    const link=ensureMenuLink();if(link)link.hidden=!show;
    if(!show)return;
    const {title,note}=describe(active),finished=active.status==='finished';
    pill.classList.toggle('is-finished',finished);
    pill.innerHTML=`<span class="duel-reconnect-dot" aria-hidden="true"></span><span class="duel-reconnect-text"><b>${title}</b>${note?`<small>${note}</small>`:''}</span><span aria-hidden="true">→</span>`;
    if(link)link.firstChild.innerHTML=`<span class="menu-ico" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${finished?'<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>':'<path d="M3 12a9 9 0 0 1 15.5-6.2L21 8M21 3v5h-5M21 12a9 9 0 0 1-15.5 6.2L3 16M3 21v-5h5"/>'}</svg></span><span class="menu-text"><b>${title}</b>${note?`<small>${note}</small>`:''}</span><svg class="menu-chev" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 6 6 6-6 6"/></svg>`;
  }
  async function check(){
    if(checking||document.hidden||!shell.hidden||typeof playerId!=='function')return;
    checking=true;
    try{
      await playerReady;
      const response=await fetch('/api/duelo',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'activo',player:playerId()}),signal:AbortSignal.timeout(8000)});
      const data=response.ok?await response.json():null;
      active=data?.active&&!(data.active.status==='finished'&&counted().includes(data.active.id))?data.active:null;
    }catch{/* sin conexión: se deja lo que había */}
    checking=false;render();
  }
  function go(){
    if(!active)return;
    if(window.DueloReconectar)window.DueloReconectar.open(active.id);
    else document.querySelector('[data-open-duel]')?.click();
  }
  pill.addEventListener('click',go);

  // Cuándo volver a preguntar: al cargar, al volver a la pestaña, al cerrar el duelo y cada 20 s mientras se mira la portada.
  new MutationObserver(()=>{if(shell.hidden)check();else render()}).observe(shell,{attributes:true,attributeFilter:['hidden']});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)check()});
  window.addEventListener('focus',check);
  window.addEventListener('storage',event=>{if(event.key&&event.key.startsWith('casi-casi:duelo:'))check()});
  setInterval(check,20000);
  check();
})();

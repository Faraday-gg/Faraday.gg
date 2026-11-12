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
    const links=document.querySelector('.menu-links');if(!links)return null;
    menuLink=document.createElement('button');menuLink.type='button';menuLink.className='menu-link menu-link-reconnect';menuLink.hidden=true;
    links.prepend(menuLink);menuLink.addEventListener('click',go);return menuLink;
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
    if(link)link.innerHTML=`<span>${title}</span><small aria-hidden="true">${finished?'🏁':'⚔'}</small>`;
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

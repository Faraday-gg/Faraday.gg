// Anuncios con recompensa (decisión 0039). De momento es solo la interfaz: un anuncio SIMULADO con cuenta atrás.
// Cuando se integren anuncios de verdad, se cambia solo este archivo: quien lo usa llama a Ads.rewarded() y recibe
// una promesa que vale true si el anuncio se vio entero (hay premio) y false si se cerró antes o falló (no lo hay).
(()=>{
  const SECONDS=15;
  let dialog=null,pending=null,timer=null;

  function build(){
    if(dialog)return dialog;
    dialog=document.createElement('dialog');
    dialog.className='ad-dialog';dialog.setAttribute('aria-labelledby','ad-title');
    dialog.innerHTML=`<p class="ad-top"><span class="ad-label">Publicidad</span><button type="button" class="ad-close" aria-label="Cerrar el anuncio" data-ad-close>×</button></p>
<h2 id="ad-title" class="sr-only">Anuncio</h2>
<div class="ad-slot" aria-hidden="true"><span class="ad-mock-mark">≈</span><b>Aquí irá el anuncio</b><small>Anuncio simulado · aún no hay anuncios reales</small></div>
<div class="ad-progress" aria-hidden="true"><i></i></div>
<p class="ad-status" aria-live="polite"></p>
<button type="button" class="game-primary ad-done" hidden>Ver la pista <span aria-hidden="true">→</span></button>`;
    document.body.append(dialog);
    dialog.addEventListener('keydown',e=>{if(e.key==='Escape')e.stopPropagation()}); // Que Escape cierre el anuncio, no el juego.
    dialog.addEventListener('cancel',()=>finish(false));
    dialog.addEventListener('click',e=>{if(e.target.closest('[data-ad-close]'))finish(false);else if(e.target.closest('.ad-done'))finish(true)});
    return dialog;
  }

  function finish(watched){
    clearInterval(timer);timer=null;
    if(dialog?.open)dialog.close();
    const resolve=pending;pending=null;resolve?.(watched);
  }

  // Muestra un anuncio y espera a que termine. Si ya hay uno abierto, no abre otro.
  function rewarded(){
    if(pending)return Promise.resolve(false);
    const d=build(),bar=d.querySelector('.ad-progress i'),status=d.querySelector('.ad-status'),done=d.querySelector('.ad-done');
    const total=(window.Ads.SECONDS||SECONDS)*1000,start=Date.now();
    done.hidden=true;bar.style.setProperty('--p','0');
    const tick=()=>{
      const left=Math.max(0,total-(Date.now()-start));bar.style.setProperty('--p',String(1-left/total));
      if(left>0){status.textContent=`La pista llega en ${Math.ceil(left/1000)} s · si lo cierras antes, no hay pista`;return}
      clearInterval(timer);timer=null;status.textContent='¡Listo! Ya puedes ver tu pista.';done.hidden=false;done.focus();
    };
    tick();timer=setInterval(tick,250);
    d.showModal();
    return new Promise(resolve=>{pending=resolve});
  }

  // simulated: true mientras no haya anuncios reales (lo usa la interfaz para avisar).
  window.Ads={rewarded,SECONDS,simulated:true};
})();

// Continuación común: cada anuncio desbloquea una partida; el servidor lleva el contador diario.
(()=>{
  const handlers=new Map(),states=new Map(),loading=new Set();
  const labels={daily:'otro reto de tres preguntas',trends:'otras tres gráficas',duel:'otro duelo',duel3:'otro duelo de tres',ranked:'otra clasificatoria',practice:'otra partida de práctica',ascension:'otra ascensión','archivo-vivo':'con otras tres fotos'};
  let busy=false;
  const text=value=>escapeHtml(String(value));
  async function request(action,mode,extra={}){
    await playerReady;
    const response=await fetch('/api/continuacion',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',
      body:JSON.stringify({action,mode,...extra}),signal:AbortSignal.timeout(12000)});
    const data=await response.json();if(!response.ok)throw Error(data.error||'No se pudo continuar.');return data;
  }
  function paint(slot,state){
    const mode=slot.dataset.continueSlot,label=labels[mode]||'otra partida';
    const key=JSON.stringify({state,busy});if(slot.dataset.continueKey===key)return;slot.dataset.continueKey=key;
    if(state.unavailable){slot.innerHTML=`<p class="continue-status">Los anuncios para continuar no están disponibles ahora. <button class="game-secondary" type="button" data-retry-continue="${text(mode)}">Reintentar</button></p>`;return}
    slot.innerHTML=`<section class="continue-offer" aria-label="Continuar jugando">
      <h4>${state.plus||state.free?'Tu siguiente partida te espera':'También puedes seguir gratis'}</h4>
      <button class="game-secondary" type="button" data-watch-continue="${text(mode)}" ${busy?'disabled':''}>${state.free?'Jugar la partida de hoy':state.id||state.ready?'Continuar la partida desbloqueada':`${state.plus?'Jugar':`Ver anuncio de prueba · ${state.seconds} s y jugar`} ${text(label)}`}</button>
      <p>${state.free?'La primera partida del día es gratis.':state.id||state.ready?'Tu partida ya está desbloqueada, sin otro anuncio.':state.plus?'Plus activo · sin anuncios.':`Sin límite de anuncios. El primero de hoy en esta modalidad dura 15 s; los siguientes, 60 s.`}</p>
      ${state.plus||state.free?'':'<small>Duración de prueba. Con anuncios reales, la duración y la recompensa las confirma el proveedor.</small>'}
      </section>`;
  }
  function refresh(){
    for(const slot of document.querySelectorAll('[data-continue-slot]')){
      const mode=slot.dataset.continueSlot;
      if(states.get(mode)?.date&&states.get(mode).date<todayKey)states.delete(mode);
      const state=states.get(mode);
      if(state){paint(slot,state);continue}
      if(loading.has(mode))continue;loading.add(mode);
      slot.innerHTML='<p class="continue-status" role="status">Consultando la opción de continuar…</p>';
      request('estado',mode).then(info=>{states.set(mode,info);refresh()}).catch(()=>{states.set(mode,{unavailable:true});refresh()}).finally(()=>loading.delete(mode));
    }
  }
  async function play(mode,origin){
    if(busy)return false;
    const handler=handlers.get(mode);if(!handler){showToast('Esta modalidad no está disponible ahora.');return false}
    busy=true;refresh();let offer,granted=false;
    try{
      offer=handler.prepare?await handler.prepare():await request('preparar',mode);
      if(offer.watch){
        const watched=await window.Ads.rewarded({kind:'continuation',seconds:offer.seconds,doneLabel:'Continuar jugando →'});
        if(!watched){await request('cancelar',mode,{date:offer.date,ticket:offer.ticket});return false}
        await request('completar',mode,{date:offer.date,ticket:offer.ticket});granted=true;
      }
      if(origin&&(!origin.isConnected||origin.closest('[hidden]')||origin.closest('dialog')&&!origin.closest('dialog').open))return false;
      await handler.play(offer);return true;
    }catch(error){
      showToast(error.message||'No se pudo continuar. Inténtalo de nuevo.');
      if(offer?.watch&&!granted)request('cancelar',mode,{date:offer.date,ticket:offer.ticket}).catch(()=>{});
      return false;
    }finally{busy=false;states.delete(mode);for(const slot of document.querySelectorAll('[data-continue-slot]'))delete slot.dataset.continueKey;refresh()}
  }
  function register(mode,play,prepare){handlers.set(mode,{play,prepare})}
  register('daily',async offer=>{
    const day=await request('reto-extra','daily',{date:offer.date,ticket:offer.ticket,id:offer.id});
    openDay({...day,id:'extra-'+day.id,extraId:day.id});
  });
  window.Continuations={register,play,refresh,answer:(id,index,guess)=>request('responder-extra','daily',{id,index,guess})};
  document.addEventListener('click',event=>{
    const retry=event.target.closest('[data-retry-continue]');if(retry){states.delete(retry.dataset.retryContinue);refresh();return}
    const button=event.target.closest('[data-watch-continue]');if(button)play(button.dataset.watchContinue,button.closest('[data-continue-slot]'));
  });
  for(const name of ['faraday:cuenta','faraday:plan'])document.addEventListener(name,()=>{states.clear();refresh()});
  document.addEventListener('faraday:cuenta',()=>{if(activeDay?.practice&&!document.getElementById('game-shell').hidden)hideGame()});
  let scheduled=false;
  new MutationObserver(()=>{if(scheduled)return;scheduled=true;Promise.resolve().then(()=>{scheduled=false;refresh()})}).observe(document.documentElement,{childList:true,subtree:true});
  refresh();
})();

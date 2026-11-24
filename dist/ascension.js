// El servidor guarda respuestas, reloj y puntos. El navegador muestra el vuelo.
(()=>{
  const dialog=document.getElementById('ascension-dialog'),content=document.getElementById('ascension-content'),stage=document.getElementById('ascension-scene');
  if(!dialog||!window.AscensionFlight)return;
  const alert=document.getElementById('ascension-alert'),steps=document.getElementById('ascension-steps'),modeLine=document.getElementById('ascension-mode');
  const fmt=new Intl.NumberFormat('es-ES',{maximumFractionDigits:0,useGrouping:'always'}).format,esc=value=>escapeHtml(String(value??''));
  const metres=document.getElementById('ascension-metres'),zone=document.getElementById('ascension-zone');
  const canAutoFocus=matchMedia('(pointer: fine)');
  function paintFlight({height,zone:label}){
    const value=fmt(Math.floor(height));
    if(metres.textContent!==value)metres.textContent=value;
    if(zone.textContent!==label)zone.textContent=label;
  }
  function focusAnswer(){
    if(canAutoFocus.matches)content.querySelector('#ascension-answer')?.focus({preventScroll:true});
  }
  const motion=matchMedia('(prefers-reduced-motion: reduce)'),reduced=()=>motion.matches;
  window.PlusOffers?.register('ascension',{
    title:'Tu próxima aventura empieza en Faraday.',
    description:'Sigue ascendiendo sin anuncios con Faraday Plus. También puedes continuar gratis viendo un anuncio de prueba.'
  });
  let run=null,scene=null,opener=null,token=0,controller=null,pending=false,ticker=0,offset=0,timeoutSent=false,flying=false;
  let replayKey='',syncAfterFlight=false,clockCue=false;
  const audio=window.AscensionAudio;
  const refs=()=>({date:run.date,game:run.game,round:run.round});
  const viewKey=value=>value?`${value.date}:${value.game}:${value.round}:${value.phase}`:'';
  const notice=message=>{alert.textContent=message||''};
  function stopClock(){clearInterval(ticker);ticker=0}
  function mount(){if(!scene)scene=AscensionFlight.mount(stage,Progress.look(),{onProgress:paintFlight});else scene.refreshLook(Progress.look())}
  const cue=points=>points>=100?'clavada':points>=85?'acierto':points>=60?'cerca':points>=30?'lejos':points>0?'fallo':'ko';
  const sources=result=>(result.sources||[]).map(source=>`<li><a href="${esc(source.url)}" target="_blank" rel="noopener noreferrer">${esc(source.title)}</a></li>`).join('');
  async function request(action,extra={}){
    const stamp=token;
    await playerReady;
    if(stamp!==token)throw Error('La ascensión cambió de sesión.');
    const activeController=new AbortController();controller=activeController;
    const timer=setTimeout(()=>activeController.abort(),12000);
    try{
      const response=await fetch('/api/ascension',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,...extra}),signal:activeController.signal});
      const data=await response.json();if(!response.ok)throw Object.assign(new Error(data.error||'No se pudo completar la acción.'),{status:response.status,data});return data;
    }finally{clearTimeout(timer);if(controller===activeController)controller=null}
  }
  function adopt(data){run=data;if(Array.isArray(data?.results))window.Progress?.tally?.('ascension',`${data.date}:${data.game}`,data.results.map(one=>one.height),data.rounds,data.results.map(one=>one.points===100));offset=data.now-Date.now();timeoutSent=false;paintTop()}
  function paintTop(){
    dialog.dataset.phase=run.phase;
    modeLine.innerHTML=`<strong>${run.game?`Práctica ${run.game}`:'Edición diaria'}</strong><span>${run.phase==='finished'?`${fmt(run.score)} puntos`:`Pregunta ${Math.min(run.round+1,run.rounds)}/${run.rounds}`}</span>`;
    steps.innerHTML=Array.from({length:run.rounds},(_,i)=>`<li class="${i<run.results.length?'done':i===run.round?'active':''}" aria-label="Pregunta ${i+1}${i<run.results.length?`, ${run.results[i].points} puntos`:''}"></li>`).join('');
  }
  function button(label,action,primary=true,extra=''){return `<button class="game-${primary?'primary':'secondary'}" type="button" data-ascension="${action}" ${extra}>${label}</button>`}
  function render({animate=false}={}){
    if(run.phase==='result')content.querySelector('#ascension-answer')?.blur?.();
    stopClock();notice();paintTop();mount();dialog.scrollTop=0;
    if(run.phase==='ready')ready();else if(run.phase==='question')question();else if(run.phase==='result')result(animate);else summary();
  }
  function ready(){
    scene.setState('idle',{height:run.height,round:run.results.length});
    const first=run.round===0;
    content.innerHTML=`<section class="ascension-card">
      <h3 tabindex="-1">¿Hasta dónde<br><em>puedes llegar?</em></h3>
      <p class="ascension-lead">Encuentra una respuesta válida. Cuanto más rara sea, más lejos volará tu avatar.</p>
      <div class="ascension-actions">${button(first?'Despegar ↑':`Continuar · pregunta ${run.round+1}`,'start')}</div>
      <details class="ascension-fine"><summary>Cómo se juega</summary>
        <p>${run.rounds} preguntas y ${run.seconds} segundos para cada una. Puedes pasar o reintentar una respuesta desconocida mientras quede tiempo.</p>
        <p>Ganas de 10 a 100 puntos por respuesta y 10 m por punto. «1 de un millón» es un nivel editorial de rareza extrema que añade 500 m de impulso.</p>
        ${run.game?'<p>Las prácticas quedan fuera de la clasificación diaria.</p>':'<p>La edición cambia a medianoche de Madrid. Al terminar puedes abrir prácticas con un anuncio de prueba o con Plus.</p>'}
      </details></section>`;
    content.querySelector('h3').focus({preventScroll:true});
  }
  function question(){
    clockCue=false;
    scene.setState('thinking',{height:run.height,round:run.round+1});
    content.innerHTML=`<section class="ascension-card">
      <div class="ascension-clock" aria-label="Tiempo disponible"><div class="ascension-clock-track" aria-hidden="true"><i></i></div><strong id="ascension-seconds">${run.seconds} s</strong></div>
      <h3 class="ascension-question" tabindex="-1">${esc(run.current.title)}</h3><p class="ascension-lead">${esc(run.current.description)}</p>
      <form class="ascension-entry" id="ascension-form">
        <label class="ascension-sr" for="ascension-answer">Tu respuesta</label>
        <input class="ascension-input" id="ascension-answer" type="text" autocomplete="off" autocapitalize="sentences" enterkeyhint="go" spellcheck="false" maxlength="120" placeholder="Tu respuesta" required>
        <button class="game-primary" type="submit" id="ascension-submit">Confirmar</button>
      </form>
      <div class="ascension-question-footer"><button type="button" class="ascension-skip" data-ascension="pass">Pasar pregunta</button><p>${fmt(run.current.count||0)} respuestas válidas</p></div>
    </section>`;
    if(!canAutoFocus.matches)content.querySelector('h3').focus({preventScroll:true});
    tick();ticker=setInterval(tick,150);
    if(!pending)focusAnswer();
  }
  function tick(){
    if(!run||run.phase!=='question'||!dialog.open)return;
    const seconds=Math.max(0,Math.ceil((run.deadline-(Date.now()+offset))/1000)),clock=content.querySelector('.ascension-clock');
    if(clock){clock.classList.toggle('is-urgent',seconds<=7);clock.style.setProperty('--remaining',String(Math.max(0,(run.deadline-Date.now()-offset)/(run.seconds*1000))));content.querySelector('#ascension-seconds').textContent=`${seconds} s`}
    if(seconds>0&&seconds<=5&&!clockCue){clockCue=true;if(!pending)audio?.play('clock')}
    if(seconds===0&&!pending&&!timeoutSent){timeoutSent=true;submit('')}
  }
  function flightSound(event,last,replay=false){
    if(event==='launch')audio?.launch(last.points,Boolean(last.bonusHeight));
    if(event==='land'){
      if(replay)audio?.play('settled');
      else audio?.response(last.points,{bonus:Boolean(last.bonusHeight),reason:last.reason});
    }
  }
  function flightControls(){
    const next=content.querySelector('#ascension-next');
    const controls=content.querySelector('.ascension-flight-controls');
    const label=content.querySelector('#ascension-flight-status');
    const skip=content.querySelector('[data-ascension="skip-flight"]');
    const replay=content.querySelector('[data-ascension="replay-flight"]');
    const canReplay=!flying&&replayKey===viewKey(run)&&!reduced()&&scene?.canReplay?.()!==false&&typeof scene?.replay==='function';
    if(next)next.disabled=pending;
    if(controls)controls.hidden=!flying&&!canReplay;
    if(label)label.textContent=flying?'En vuelo':'Vuelo completado';
    if(skip)skip.hidden=!flying||typeof scene?.finish!=='function';
    if(replay)replay.hidden=!canReplay;
  }
  async function playFlight(play,{replaying=false}={}){
    const stamp=token,key=viewKey(run);
    const moveFocus=replaying&&document.activeElement===content.querySelector('[data-ascension="replay-flight"]');
    flying=true;
    flightControls();
    if(replaying)dialog.scrollTop=0;
    if(moveFocus)content.querySelector('[data-ascension="skip-flight"]:not([hidden])')?.focus({preventScroll:true});
    const finish=()=>{
      if(stamp!==token||!dialog.open||key!==viewKey(run))return;
      const skip=content.querySelector('[data-ascension="skip-flight"]');
      const focusNext=skip&&document.activeElement===skip;
      flying=false;
      flightControls();
      if(focusNext)content.querySelector('#ascension-next')?.focus({preventScroll:true});
      if(syncAfterFlight&&!document.hidden){
        syncAfterFlight=false;
        load({silent:true});
      }
    };
    try{await play()}
    catch{
      if(stamp===token&&dialog.open&&key===viewKey(run)){
        replayKey='';
        scene?.setHeight(run.height,{animate:false});
      }
    }finally{finish()}
  }
  function result(animate){
    const last=run.results.at(-1),tier=last.tier||{id:'miss',name:'Sin impulso'};
    const reaction=Progress.reaction('ascension',cue(last.points),{animate});
    const bonus=Boolean(last.bonusHeight),distance=fmt(last.height);
    const answer=last.points?last.answer:last.reason==='timeout'?'Se acabó el tiempo':'Pregunta pasada';
    const flightOptions={animate,points:last.points,bonus,reaction,round:run.round+1};
    content.innerHTML=`<section class="ascension-card ascension-result" data-tier="${esc(tier.id)}">
      ${last.points?`<p class="ascension-eyebrow">${esc(tier.name)}</p>`:''}
      <h3 tabindex="-1" aria-describedby="ascension-outcome">${esc(answer)}</h3>
      ${last.corrected?'<p class="ascension-corrected">Ortografía corregida</p>':''}
      <div class="ascension-outcome" id="ascension-outcome">
        <p><strong>${last.height?'+':''}${distance} m</strong><small>${last.points?'+':''}${fmt(last.points)} puntos</small></p>
        ${bonus?`<p class="ascension-bonus">Incluye +${fmt(last.bonusHeight)} m de impulso extra</p>`:''}
      </div>
      <div class="ascension-actions">
        ${button(run.results.length===run.rounds?'Ver mi ascensión':'Siguiente pregunta','next',true,'id="ascension-next"')}
        ${last.points>0?`<div class="ascension-flight-controls" hidden>
          <span id="ascension-flight-status" class="ascension-sr" role="status"></span>
          <button class="ascension-flight-action" type="button" data-ascension="skip-flight" hidden>Saltar vuelo</button>
          <button class="ascension-flight-action" type="button" data-ascension="replay-flight" hidden>Repetir vuelo</button>
        </div>`:''}
      </div>
      <div class="ascension-result-details">
        ${last.discoveries?.length?`<details><summary>Otras respuestas</summary><ul>${last.discoveries.map(one=>`<li>${esc(one.name)} · ${one.points} pts</li>`).join('')}</ul></details>`:''}
        <details><summary>Ver pregunta y fuentes</summary><p>${esc(last.title)}</p><ul>${sources(last)}</ul></details>
      </div>
    </section>`;
    if(animate&&last.points>0&&!reduced()){
      replayKey=viewKey(run);
      playFlight(()=>scene.setHeight(run.height,{...flightOptions,onCue:event=>flightSound(event,last)}));
    }else{
      scene.setHeight(run.height,flightOptions);
      if(animate)audio?.response(last.points,{bonus,reason:last.reason});
      flightControls();
    }
    content.querySelector('h3').focus({preventScroll:true});
  }
  function summary(){
    const rank=run.ranking,total=run.score,maxScore=run.maxScore||700;
    scene.setState('overview',{height:run.height,round:run.rounds,reaction:Progress.reaction('ascension',cue(total/run.rounds),{animate:false})});
    const histogram=window.AscensionChart?.render(rank,total)||'';
    const ranked=run.game?'<div class="ascension-rank"><strong>Un camino para practicar</strong><p>Esta ascensión no modifica tu resultado diario ni la clasificación.</p></div>':rank?`<div class="ascension-rank"><strong>${rank.others?`Puesto ${fmt(rank.position)} de ${fmt(rank.total)}${rank.tied>1?' · compartido':''}`:'Has abierto camino'}</strong><p>${rank.others?`Superas al ${rank.percentile} % de las otras ascensiones completadas de esta edición.`:'Todavía no hay otras partidas terminadas para comparar. Vuelve más tarde para ver cómo quedas.'}</p>${histogram}</div>`:'';
    content.innerHTML=`<section class="ascension-card"><p class="ascension-eyebrow">${run.game?'Práctica completada':'Tu ascensión de hoy'}</p><h3 tabindex="-1">Has llegado <em>hasta aquí.</em></h3>
      <div class="ascension-total"><b>${fmt(total)}</b><span>de ${fmt(maxScore)} puntos<br>${fmt(run.height)} metros</span></div>${ranked}
      <div class="ascension-actions">${button('Compartir mi ascensión','share',false)}${button('Refrescar clasificación','refresh',false,!run.game?'':'hidden')}</div><p class="ascension-share-status" role="status"></p>
      <details class="ascension-log"><summary>Ver las ${run.rounds} respuestas</summary><ol>${run.results.map(one=>`<li><span>${esc(one.answer||(one.reason==='timeout'?'Sin tiempo':'Sin respuesta'))}</span> · <b>+${fmt(one.height)} m</b><p>${esc(one.title)}<br>${esc(one.tier?.name||'')} · ${one.points} puntos<br>${(one.sources||[]).map(source=>`<a href="${esc(source.url)}" target="_blank" rel="noopener noreferrer">${esc(source.title)}</a>`).join(' · ')}</p></li>`).join('')}</ol></details>
      <h4>Sigue practicando</h4><div data-continue-slot="ascension"></div><div data-plus-slot="ascension"></div></section>`;
    window.PlusOffers?.refresh(content);window.Continuations?.refresh();
    content.querySelector('h3').focus({preventScroll:true});
  }
  async function load({silent=false}={}){
    if(flying){syncAfterFlight=true;return}
    if(pending)return;
    syncAfterFlight=false;
    const stamp=token,key=viewKey(run);
    pending=true;if(!silent){dialog.dataset.phase='loading';content.innerHTML='<p class="ascension-loading">Preparando el vuelo…</p>'}
    try{
      const data=await request('estado',run?{date:run.date,game:run.game}:{});if(stamp!==token)return;
      adopt(data);pending=false;
      if(silent&&key===viewKey(run)&&run.phase!=='finished'){tick();return}
      render();
    }catch(error){
      if(stamp!==token)return;
      if(error.data?.code==='edition'){run=null;pending=false;load();return}
      if(!silent)content.innerHTML=`<section class="ascension-card"><h3>No pudimos cargar la partida.</h3><p class="ascension-lead">${esc(error.message||'Comprueba tu conexión.')}</p>${button('Reintentar','refresh')}</section>`;
      notice(error.status?error.message:'Comprueba tu conexión. Tu progreso aceptado sigue guardado.');
    }finally{if(stamp===token)pending=false}
  }
  async function mutate(action,extra={}){
    if(pending||flying||!run)return;
    pending=true;notice();const stamp=token;
    for(const b of content.querySelectorAll('button'))b.disabled=true;
    try{
      let data=await request(action,{...refs(),...extra});if(stamp!==token)return;
      adopt(data);
      if(action==='responder'&&run.phase==='result')document.dispatchEvent(new Event('faraday:played'));
      if(action==='siguiente'&&run.phase==='ready'){data=await request('empezar',refs());if(stamp!==token)return;adopt(data)}
      pending=false;render({animate:action==='responder'});
      if(action==='empezar'&&run.phase==='question')audio?.play('start');
      if(action==='siguiente'&&run.phase==='finished')audio?.play('summary');
    }catch(error){
      if(stamp!==token)return;
      if(error.data?.phase){const wasQuestion=run.phase==='question';adopt(error.data);if(!wasQuestion||run.phase!=='question')render()}
      if(action==='responder'&&run.phase==='question'&&error.status===422)audio?.play('retry');
      notice(error.status?error.message:'No hemos podido confirmar la respuesta. Reintenta o vuelve a cargar la partida.');
      if(['date','edition'].includes(error.data?.code)){run=null;pending=false;load();return}
      if(!error.status){alert.innerHTML=`${esc(alert.textContent)} <button type="button" class="duel-link" data-ascension="refresh">Reconectar</button>`}
    }finally{if(stamp===token){pending=false;for(const b of content.querySelectorAll('button'))b.disabled=false;flightControls();focusAnswer();tick()}}
  }
  const submit=answer=>mutate('responder',{answer});
  function next(){
    if(flying){scene?.finish({cue:false});flying=false}
    mutate('siguiente');
  }

  window.Continuations?.register('ascension',async offer=>{
    if(!dialog.open)return;
    const stamp=token;
    const data=offer.activate?await request('practica',{date:offer.date,game:offer.game,ticket:offer.ticket}):offer;
    if(stamp!==token||!dialog.open)return;
    adopt(data);render();
  },async()=>{
    if(pending||flying||run?.phase!=='finished')throw Error('Termina la partida antes de continuar.');
    return request('preparar-practica',{...refs(),game:run.continuation?.fromGame??run.game});
  });
  async function share(){
    const text=`Mi Ascensión en Faraday: ${fmt(run.score)}/${fmt(run.maxScore||700)} puntos · ${fmt(run.height)} m\n${run.results.map(one=>one.bonusHeight?'✦':one.points>=85?'🟪':one.points>=60?'🟦':one.points>=30?'🟨':one.points?'⬜':'⬛').join('')}${run.game?'\nPartida de práctica':''}`;
    const url=new URL(location.pathname,location.origin);url.searchParams.set('ascension','1');
    const status=content.querySelector('.ascension-share-status');
    try{if(navigator.share)await navigator.share({title:'Mi Ascensión — Faraday.gg',text,url:url.href});else{await navigator.clipboard.writeText(text+'\n'+url.href);status.textContent='Resultado copiado. ¡Compártelo con tu gente!'}}catch(error){if(error.name!=='AbortError')status.textContent='No se pudo compartir desde este navegador.'}
  }
  function open(button){dialog.querySelector('[data-ascension=sound]').setAttribute('aria-pressed',String(Sound.on));opener=button;if(typeof menuOpen==='function'&&menuOpen())toggleMenu(false);token++;run=null;pending=false;flying=false;mount();dialog.showModal();load()}
  document.querySelectorAll('[data-open-ascension]').forEach(button=>button.addEventListener('click',()=>open(button)));
  dialog.addEventListener('click',event=>{
    const button=event.target.closest('button');if(!button)return;
    if(button.hasAttribute('data-close-ascension')){dialog.close();return}
    const action=button.dataset.ascension;
    if(action==='start')mutate('empezar');else if(action==='pass')submit('');else if(action==='next')next();else if(action==='refresh')load();else if(action==='share')share();
    else if(action==='skip-flight'&&flying)scene?.finish?.();
    else if(action==='replay-flight'&&!pending&&!flying&&!reduced()&&run?.phase==='result'&&replayKey===viewKey(run)&&typeof scene?.replay==='function'){
      const last=run.results.at(-1);
      playFlight(()=>scene.replay({onCue:event=>flightSound(event,last,true)}),{replaying:true});
    }
    else if(action==='wardrobe'){dialog.close();Progress.open('celebraciones');const select=document.querySelector('[data-celebration-mode]');if(select){select.value='ascension';select.dispatchEvent(new Event('change',{bubbles:true}))}}
    else if(action==='sound'){Sound.toggle();button.setAttribute('aria-pressed',String(Sound.on))}
  });
  dialog.addEventListener('submit',event=>{if(event.target.id!=='ascension-form')return;event.preventDefault();const input=content.querySelector('#ascension-answer');if(input?.value.trim())submit(input.value.trim())});
  dialog.addEventListener('keydown',event=>{
    if(event.key==='Escape'){event.stopPropagation();event.preventDefault();dialog.close()}
    else if(event.key==='Enter'&&run?.phase==='result'&&!pending&&event.target===content.querySelector('h3')){
      event.preventDefault();next();
    }
  });
  function clearScene(){
    token++;controller?.abort();controller=null;stopClock();
    pending=false;flying=false;replayKey='';syncAfterFlight=false;
    scene?.destroy();scene=null;
  }
  dialog.addEventListener('close',()=>{clearScene();opener?.focus({preventScroll:true})});
  motion.addEventListener?.('change',flightControls);
  document.addEventListener('visibilitychange',()=>{if(dialog.open&&!document.hidden)load({silent:true})});
  window.addEventListener('online',()=>{if(dialog.open)load({silent:true})});
  document.addEventListener('faraday:before-plan',event=>{
    if(!dialog.open)return;
    if(run?.phase!=='finished'||pending||flying){event.preventDefault();return}
    dialog.close();
  });
  document.addEventListener('faraday:sonido',()=>dialog.querySelector('[data-ascension=sound]').setAttribute('aria-pressed',String(Sound.on)));
  for(const name of ['faraday:look','faraday:progreso'])document.addEventListener(name,()=>{if(dialog.open)scene?.refreshLook(Progress.look())});
  document.addEventListener('faraday:cuenta',()=>{if(dialog.open){clearScene();run=null;mount();load()}});
  if(new URLSearchParams(location.search).has('ascension'))setTimeout(()=>open(document.querySelector('[data-open-ascension]')),0);
})();

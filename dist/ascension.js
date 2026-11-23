// Ascensión: el servidor guarda respuestas, reloj y puntos. Aquí se cuenta la expedición del avatar.
(()=>{
  const dialog=document.getElementById('ascension-dialog'),content=document.getElementById('ascension-content'),stage=document.getElementById('ascension-scene');
  if(!dialog||!window.AscensionScene)return;
  const alert=document.getElementById('ascension-alert'),steps=document.getElementById('ascension-steps'),modeLine=document.getElementById('ascension-mode');
  const fmt=n=>new Intl.NumberFormat('es-ES',{maximumFractionDigits:0,useGrouping:'always'}).format(n),esc=value=>escapeHtml(String(value??''));
  const motion=matchMedia('(prefers-reduced-motion: reduce)'),reduced=()=>motion.matches;
  window.PlusOffers?.register('ascension',{
    title:'Tu próxima aventura empieza en Faraday.',
    description:'Sigue ascendiendo sin anuncios con Faraday Plus. También puedes continuar gratis viendo un anuncio de prueba.'
  });
  const TIERS=[{points:10,name:'Conocida'},{points:30,name:'Ingeniosa'},{points:60,name:'Rara'},{points:85,name:'Extraordinaria'},{points:100,name:'De cumbre'}];
  let run=null,scene=null,opener=null,token=0,controller=null,pending=false,ticker=0,offset=0,timeoutSent=false,climbing=false;
  let replayKey='',syncAfterClimb=false;
  const refs=()=>({date:run.date,game:run.game,round:run.round});
  const viewKey=value=>value?`${value.date}:${value.game}:${value.round}:${value.phase}`:'';
  const notice=message=>{alert.textContent=message||''};
  function stopClock(){clearInterval(ticker);ticker=0}
  function mount(){if(!scene)scene=AscensionScene.mount(stage,Progress.look());else scene.refreshLook(Progress.look())}
  const scales=()=>`<div class="ascension-tier-scale" aria-label="Puntos por rareza editorial">${TIERS.map(tier=>`<span data-points="${tier.points}">${tier.name}<b>${tier.points}</b></span>`).join('')}</div>`;
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
    modeLine.innerHTML=`<strong>${run.game?`Práctica ${run.game}`:'La ascensión del día'}</strong><span>${run.phase==='finished'?`${fmt(run.score)} puntos`:`Repisa ${Math.min(run.round+1,run.rounds)} de ${run.rounds}`}</span>`;
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
    const catalog=run.catalog||run.bank||{},first=run.round===0;
    content.innerHTML=`<section class="ascension-card"><p class="ascension-eyebrow">${run.game?'Explora a tu ritmo':'Tu avatar. Tu camino a la cima.'}</p>
      <h3 tabindex="-1">Una respuesta.<br><em>Un paso más arriba.</em></h3>
      <p class="ascension-lead">Elige la vía Directa o la Travesía. Con una respuesta más rara, tu avatar escala más deprisa y llega más alto.</p>
      <div class="ascension-intro-stats"><div><b>7</b><span>categorías</span></div><div><b>25 s</b><span>por respuesta</span></div><div><b>7.000</b><span>metros de cima</span></div></div>
      ${scales()}<div class="ascension-actions">${button(first?'Empezar ascensión →':`Continuar · pregunta ${run.round+1} →`,'start')}</div>
      <p class="ascension-fine">${run.game?'Esta práctica no cuenta para la clasificación.':'La misma edición para todos. Un intento diario y prácticas al terminar: gratis con anuncio de prueba, o sin anuncios con Plus. La edición cambia a medianoche de Madrid; completa tu partida antes.'}</p>
      <details class="ascension-fine"><summary>Cómo se eligen las respuestas y los puntos</summary><p>La rareza es editorial y queda fijada para la edición. No representa el porcentaje de jugadores que escribe cada respuesta. ${catalog.answers?`El banco inicial reúne ${fmt(catalog.answers)} respuestas en ${fmt(catalog.categories)} categorías.`:''} Aceptamos variantes regionales y corregimos automáticamente las erratas claras. Una respuesta desconocida permite reintentar mientras quede tiempo.</p><p>El reloj comienza al mostrar la categoría y continúa si sales de la partida. Si no conoces una respuesta, puedes pasar.</p></details></section>`;
    content.querySelector('h3').focus({preventScroll:true});
  }
  function question(){
    scene.setState('thinking',{height:run.height,round:run.round+1});
    content.innerHTML=`<section class="ascension-card"><div class="ascension-clock" aria-label="Tiempo disponible"><strong id="ascension-seconds">25 s</strong><div class="ascension-clock-track" aria-hidden="true"><i></i></div></div>
      <p class="ascension-eyebrow">Busca una respuesta poco evidente</p><h3 class="ascension-question">${esc(run.current.title)}</h3><p class="ascension-lead">${esc(run.current.description)}</p>
      <form class="ascension-form" id="ascension-form"><label for="ascension-answer">Tu respuesta</label><input class="ascension-input" id="ascension-answer" type="text" autocomplete="off" autocapitalize="sentences" spellcheck="false" maxlength="120" placeholder="Escribe una respuesta…" required>
      <div class="ascension-actions">${button('Confirmar y ascender →','answer',true,'id="ascension-submit"')}</div></form>
      <button type="button" class="ascension-skip" data-ascension="pass">Pasar esta categoría</button><p class="ascension-fine">${fmt(run.current.count||0)} respuestas admitidas · las erratas claras se corrigen solas</p></section>`;
    // El botón principal mantiene el comportamiento nativo de Enter y la validación de campo vacío.
    content.querySelector('#ascension-submit').type='submit';
    tick();ticker=setInterval(tick,150);if(!pending)content.querySelector('input').focus({preventScroll:true});
  }
  function tick(){
    if(!run||run.phase!=='question'||!dialog.open)return;
    const seconds=Math.max(0,Math.ceil((run.deadline-(Date.now()+offset))/1000)),clock=content.querySelector('.ascension-clock');
    if(clock){clock.classList.toggle('is-urgent',seconds<=7);clock.style.setProperty('--remaining',String(Math.max(0,(run.deadline-Date.now()-offset)/25000)));content.querySelector('#ascension-seconds').textContent=`${seconds} s`}
    if(seconds===0&&!pending&&!timeoutSent){timeoutSent=true;submit('')}
  }
  function sound(points){
    if(!window.Sound?.on||document.hidden)return;
    const root=points>=85?659:points>=30?523:392;
    (points?[1,1.25,1.5,2]:[1,.8]).forEach((ratio,i)=>Sound.tone(root*ratio,i*.075,.25,{type:'triangle',gain:.035}));
  }
  function climbSound(event,points){
    if(!window.Sound?.on||document.hidden)return;
    if(event==='grip'){
      Sound.noise?.(0,.065,{gain:.034,from:900,to:510,q:1.25,attack:.006});
    }else if(event==='land'){
      Sound.noise?.(0,.105,{gain:.052,from:400,to:160,q:.8,attack:.006});
      sound(points);
    }
  }
  function climbControls(){
    const next=content.querySelector('#ascension-next');
    const controls=content.querySelector('.ascension-climb-controls');
    const label=content.querySelector('#ascension-climb-status');
    const skip=content.querySelector('[data-ascension="skip-climb"]');
    const replay=content.querySelector('[data-ascension="replay-climb"]');
    const canReplay=!climbing&&replayKey===viewKey(run)&&!reduced()&&scene?.canReplay?.()!==false&&typeof scene?.replay==='function';
    if(next)next.disabled=pending||climbing;
    if(controls)controls.hidden=!climbing&&!canReplay;
    if(label)label.textContent=climbing?'Escalando…':'Repisa alcanzada';
    if(skip)skip.hidden=!climbing||typeof scene?.finish!=='function';
    if(replay)replay.hidden=!canReplay;
  }
  async function playClimb(play,{replaying=false}={}){
    const stamp=token,key=viewKey(run);
    const moveFocus=replaying&&document.activeElement===content.querySelector('[data-ascension="replay-climb"]');
    climbing=true;
    climbControls();
    if(replaying)dialog.scrollTop=0;
    if(moveFocus)content.querySelector('[data-ascension="skip-climb"]:not([hidden])')?.focus({preventScroll:true});
    const finish=()=>{
      if(stamp!==token||!dialog.open||key!==viewKey(run))return;
      const skip=content.querySelector('[data-ascension="skip-climb"]');
      const focusNext=skip&&document.activeElement===skip;
      climbing=false;
      climbControls();
      if(focusNext)content.querySelector('#ascension-next')?.focus({preventScroll:true});
      if(syncAfterClimb&&!document.hidden){
        syncAfterClimb=false;
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
    const last=run.results.at(-1),tier=last.tier||{id:'miss',name:'Otro intento'};
    const reaction=Progress.reaction('ascension',cue(last.points),{animate});
    content.innerHTML=`<section class="ascension-card ascension-result" data-tier="${esc(tier.id)}"><p class="ascension-eyebrow">${esc(tier.name)} · repisa ${last.round+1}</p>
      <h3 tabindex="-1">${last.points?'Buen hallazgo.':'La montaña sigue aquí.'}</h3><p class="ascension-result-answer">${last.points?esc(last.answer):last.reason==='timeout'?'Se acabó el tiempo':'Categoría pasada'}</p>
      ${last.corrected?'<p class="ascension-corrected">Ortografía ajustada automáticamente</p>':''}
      <div class="ascension-result-points"><b>+${last.points}</b><span>puntos<br>+${fmt(last.height)} metros</span></div>
      ${last.points>0?`<div class="ascension-climb-controls">
        <span id="ascension-climb-status" role="status"></span>
        <button class="ascension-climb-action" type="button" data-ascension="skip-climb" hidden>Saltar animación</button>
        <button class="ascension-climb-action" type="button" data-ascension="replay-climb" hidden>Repetir escalada</button>
      </div>`:''}
      <div class="ascension-actions">${button(run.results.length===run.rounds?'Ver mi ascensión →':'Siguiente categoría →','next',true,'id="ascension-next"')}</div>
      <p class="ascension-fine">${esc(last.title)}</p>${last.discoveries?.length?`<details class="ascension-discoveries"><summary>Otros caminos que podías tomar</summary><ul>${last.discoveries.map(answer=>`<li><span>${esc(answer.name)}</span><b>${answer.points} pts</b></li>`).join('')}</ul></details>`:''}<details class="ascension-source"><summary>La categoría y sus fuentes</summary><ul>${sources(last)}</ul><p>Los puntos son una valoración editorial fija. Tus cosméticos y emotes no cambian la puntuación.</p></details></section>`;
    if(animate&&last.points>0&&!reduced()){
      replayKey=viewKey(run);
      playClimb(()=>scene.setHeight(run.height,{animate:true,points:last.points,reaction,round:run.round+1,onCue:event=>climbSound(event,last.points)}));
    }else{
      scene.setHeight(run.height,{animate,points:last.points,reaction,round:run.round+1});
      if(animate)sound(last.points);
      climbControls();
    }
    content.querySelector('h3').focus({preventScroll:true});
  }
  function summary(){
    const rank=run.ranking,total=run.score;
    scene.setState('overview',{height:run.height,round:run.rounds,reaction:Progress.reaction('ascension',cue(total/run.rounds),{animate:false})});
    const histogram=window.AscensionChart?.render(rank,total)||'';
    const ranked=run.game?'<div class="ascension-rank"><strong>Un camino para practicar</strong><p>Esta ascensión no modifica tu resultado diario ni la clasificación.</p></div>':rank?`<div class="ascension-rank"><strong>${rank.others?`Puesto ${fmt(rank.position)} de ${fmt(rank.total)}${rank.tied>1?' · compartido':''}`:'Has abierto camino'}</strong><p>${rank.others?`Superas al ${rank.percentile} % de las otras ascensiones completadas de esta edición.`:'Todavía no hay otras partidas terminadas para comparar. Vuelve más tarde para ver cómo quedas.'}</p>${histogram}</div>`:'';
    content.innerHTML=`<section class="ascension-card"><p class="ascension-eyebrow">${run.game?'Práctica completada':'Tu ascensión de hoy'}</p><h3 tabindex="-1">Has llegado <em>hasta aquí.</em></h3>
      <div class="ascension-total"><b>${fmt(total)}</b><span>de 700 puntos<br>${fmt(run.height)} metros</span></div>${ranked}
      <div class="ascension-actions">${button('Compartir mi ascensión','share',false)}${button('Refrescar clasificación','refresh',false,!run.game?'':'hidden')}</div><p class="ascension-share-status" role="status"></p>
      <div class="ascension-log">${run.results.map((one,i)=>`<details><summary><i>${i+1}</i><span>${esc(one.answer|| (one.reason==='timeout'?'Sin tiempo':'Sin respuesta'))}</span><b>+${one.points}</b></summary><p>${esc(one.title)}<br>${esc(one.tier?.name||'')} · +${fmt(one.height)} m<br>${(one.sources||[]).map(source=>`<a href="${esc(source.url)}" target="_blank" rel="noopener noreferrer">${esc(source.title)}</a>`).join(' · ')}</p></details>`).join('')}</div>
      <h3 style="font-size:23px">Hay más caminos por descubrir.</h3><p class="ascension-lead">Otras siete categorías, una montaña nueva. Sigue practicando con tu avatar.</p><div data-continue-slot="ascension"></div><p class="ascension-fine">Las prácticas no cuentan para la clasificación. Retomar una partida abierta no requiere otro anuncio.</p><div data-plus-slot="ascension"></div></section>`;
    window.PlusOffers?.refresh(content);window.Continuations?.refresh();
    content.querySelector('h3').focus({preventScroll:true});
  }
  async function load({silent=false}={}){
    if(climbing){syncAfterClimb=true;return}
    if(pending)return;
    syncAfterClimb=false;
    const stamp=token,key=viewKey(run);
    pending=true;if(!silent)content.innerHTML='<p class="ascension-loading">Preparando tu expedición…</p>';
    try{
      const data=await request('estado',run?{date:run.date,game:run.game}:{});if(stamp!==token)return;
      adopt(data);pending=false;
      if(silent&&key===viewKey(run)&&run.phase!=='finished'){tick();return}
      render();
    }catch(error){
      if(stamp!==token)return;
      if(error.data?.code==='edition'){run=null;pending=false;load();return}
      if(!silent)content.innerHTML=`<section class="ascension-card"><h3>No pudimos abrir el camino.</h3><p class="ascension-lead">${esc(error.message||'Comprueba tu conexión.')}</p>${button('Reintentar','refresh')}</section>`;
      notice(error.status?error.message:'Comprueba tu conexión. Tu progreso aceptado sigue guardado.');
    }finally{if(stamp===token)pending=false}
  }
  async function mutate(action,extra={}){
    if(pending||climbing||!run)return;
    pending=true;notice();const stamp=token;
    for(const b of content.querySelectorAll('button'))b.disabled=true;
    try{
      let data=await request(action,{...refs(),...extra});if(stamp!==token)return;
      adopt(data);
      if(action==='responder'&&run.phase==='result')document.dispatchEvent(new Event('faraday:played'));
      if(action==='siguiente'&&run.phase==='ready'){data=await request('empezar',refs());if(stamp!==token)return;adopt(data)}
      pending=false;render({animate:action==='responder'});
    }catch(error){
      if(stamp!==token)return;
      if(error.data?.phase){const wasQuestion=run.phase==='question';adopt(error.data);if(!wasQuestion||run.phase!=='question')render()}
      notice(error.status?error.message:'No hemos podido confirmar la respuesta. Reintenta o vuelve a cargar la partida.');
      if(['date','edition'].includes(error.data?.code)){run=null;pending=false;load();return}
      if(!error.status){alert.innerHTML=`${esc(alert.textContent)} <button type="button" class="duel-link" data-ascension="refresh">Reconectar</button>`}
    }finally{if(stamp===token){pending=false;for(const b of content.querySelectorAll('button'))b.disabled=false;climbControls();content.querySelector('#ascension-answer')?.focus({preventScroll:true});tick()}}
  }
  const submit=answer=>mutate('responder',{answer});
  window.Continuations?.register('ascension',async offer=>{
    if(!dialog.open)return;
    const stamp=token;
    const data=offer.activate?await request('practica',{date:offer.date,game:offer.game,ticket:offer.ticket}):offer;
    if(stamp!==token||!dialog.open)return;
    adopt(data);render();
  },async()=>{
    if(pending||climbing||run?.phase!=='finished')throw Error('Termina la partida antes de continuar.');
    return request('preparar-practica',{...refs(),game:run.continuation?.fromGame??run.game});
  });
  async function share(){
    const text=`Mi Ascensión en Faraday: ${fmt(run.score)}/700 puntos · ${fmt(run.height)} m\n${run.results.map(one=>one.points>=85?'🟪':one.points>=60?'🟦':one.points>=30?'🟨':one.points?'⬜':'⬛').join('')}${run.game?'\nPartida de práctica':''}`;
    const url=new URL(location.pathname,location.origin);url.searchParams.set('ascension','1');
    const status=content.querySelector('.ascension-share-status');
    try{if(navigator.share)await navigator.share({title:'Mi Ascensión — Faraday.gg',text,url:url.href});else{await navigator.clipboard.writeText(text+'\n'+url.href);status.textContent='Resultado copiado. ¡Compártelo con tu gente!'}}catch(error){if(error.name!=='AbortError')status.textContent='No se pudo compartir desde este navegador.'}
  }
  function open(button){dialog.querySelector('[data-ascension=sound]').setAttribute('aria-pressed',String(Sound.on));opener=button;if(typeof menuOpen==='function'&&menuOpen())toggleMenu(false);token++;run=null;pending=false;climbing=false;mount();dialog.showModal();load()}
  document.querySelectorAll('[data-open-ascension]').forEach(button=>button.addEventListener('click',()=>open(button)));
  dialog.addEventListener('click',event=>{
    const button=event.target.closest('button');if(!button)return;
    if(button.hasAttribute('data-close-ascension')){dialog.close();return}
    const action=button.dataset.ascension;
    if(action==='start')mutate('empezar');else if(action==='pass')submit('');else if(action==='next')mutate('siguiente');else if(action==='refresh')load();else if(action==='share')share();
    else if(action==='skip-climb'&&climbing)scene?.finish?.();
    else if(action==='replay-climb'&&!pending&&!climbing&&!reduced()&&run?.phase==='result'&&replayKey===viewKey(run)&&typeof scene?.replay==='function'){
      const {points}=run.results.at(-1);
      playClimb(()=>scene.replay({onCue:event=>climbSound(event,points)}),{replaying:true});
    }
    else if(action==='wardrobe'){dialog.close();Progress.open('celebraciones');const select=document.querySelector('[data-celebration-mode]');if(select){select.value='ascension';select.dispatchEvent(new Event('change',{bubbles:true}))}}
    else if(action==='sound'){Sound.toggle();button.setAttribute('aria-pressed',String(Sound.on))}
  });
  dialog.addEventListener('submit',event=>{if(event.target.id!=='ascension-form')return;event.preventDefault();const input=content.querySelector('#ascension-answer');if(input?.value.trim())submit(input.value.trim())});
  dialog.addEventListener('keydown',event=>{
    if(event.key==='Escape'){event.stopPropagation();event.preventDefault();dialog.close()}
    else if(event.key==='Enter'&&run?.phase==='result'&&!pending&&!climbing&&event.target===content.querySelector('h3')){
      event.preventDefault();mutate('siguiente');
    }
  });
  function clearScene(){
    token++;controller?.abort();controller=null;stopClock();
    pending=false;climbing=false;replayKey='';syncAfterClimb=false;
    scene?.destroy();scene=null;
  }
  dialog.addEventListener('close',()=>{clearScene();opener?.focus({preventScroll:true})});
  motion.addEventListener?.('change',climbControls);
  document.addEventListener('visibilitychange',()=>{if(dialog.open&&!document.hidden)load({silent:true})});
  window.addEventListener('online',()=>{if(dialog.open)load({silent:true})});
  document.addEventListener('faraday:before-plan',event=>{
    if(!dialog.open)return;
    if(run?.phase!=='finished'||pending||climbing){event.preventDefault();return}
    dialog.close();
  });
  document.addEventListener('faraday:sonido',()=>dialog.querySelector('[data-ascension=sound]').setAttribute('aria-pressed',String(Sound.on)));
  for(const name of ['faraday:look','faraday:progreso'])document.addEventListener(name,()=>{if(dialog.open)scene?.refreshLook(Progress.look())});
  document.addEventListener('faraday:cuenta',()=>{if(dialog.open){clearScene();run=null;mount();load()}});
  if(new URLSearchParams(location.search).has('ascension'))setTimeout(()=>open(document.querySelector('[data-open-ascension]')),0);
})();

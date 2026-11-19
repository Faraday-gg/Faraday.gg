// Duelos 1 vs 1 (decisión 0023). El servidor manda (lib/duelos.mjs): aquí solo se le pregunta cada segundo
// por el estado del duelo y se pinta: avatares, barras de vida, temporizador, avisos y sonidos.
// El perfil (apodo y avatar) y el progreso (nivel, racha) se guardan en este navegador, como el resto del juego.
(()=>{
  const KEY='casi-casi:duelo:',shell=$('#duel-shell'),content=$('#duel-content'),hud=$('#duel-hud');
  const saved={get(key,fallback){try{return JSON.parse(localStorage.getItem(KEY+key))??fallback}catch{return fallback}},set(key,value){try{localStorage.setItem(KEY+key,JSON.stringify(value))}catch{}},remove(key){try{localStorage.removeItem(KEY+key)}catch{}}};
  const int=n=>new Intl.NumberFormat('es-ES',{maximumFractionDigits:0,useGrouping:'always'}).format(n);
  const times=n=>'×'+new Intl.NumberFormat('es-ES',{maximumFractionDigits:2}).format(n);
  const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;

  let profile=saved.get('perfil',null);
  if(!profile||typeof profile.name!=='string')profile={name:'Jugador '+(100+Math.floor(Math.random()*900))};
  const DAILY_FULL=3,CAPPED_FACTOR=.25,BOT_FACTOR=.5;
  let stats={xp:0,wins:0,losses:0,draws:0,streak:0,best:0,lastWin:'',...saved.get('progreso',{})};
  // El nivel, la experiencia, los faradios y el aspecto del avatar viven en progress.js.

  let duel=null,offset=0,shown='',pollTimer=0,ticker=0,endTimer=0,lastSecond=-1,inviteCode='',revealed='',finishedPolls=0,chatWake=0,busy=false;
  let quotaState=null,quotaRequest=0,lastOfferMode='duel';
  const serverNow=()=>Date.now()+offset;
  // Duelo de tres (decisión 0082): duel.size===3. rival() es el primero de los otros; others() son los demás con su asiento.
  const three=()=>duel?.size===3;
  const others=()=>duel.players.map((player,seat)=>({player,seat})).filter(one=>one.seat!==duel.you);
  const me=()=>duel.players[duel.you],rival=()=>three()?others()[0]?.player:duel.players[1-duel.you];
  const joinNames=list=>{const names=list.map(name=>`<b>${escapeHtml(name)}</b>`);return names.length>1?names.slice(0,-1).join(', ')+' y '+names.at(-1):names[0]||''};

  // Sonidos: tonos cortos y suaves generados en el navegador (sound.js, sin archivos). Se pueden silenciar.
  const tone=Sound.tone;let audio=null;
  const sfx={
    tap:()=>tone(520,0,.07,{gain:.03}),
    found:()=>{tone(523,0,.16,{type:'triangle'});tone(784,.13,.3,{type:'triangle'})},
    send:()=>{tone(660,0,.12);tone(990,.09,.22)},
    rival:()=>{tone(784,0,.2,{type:'triangle',gain:.07});tone(1175,.14,.4,{type:'triangle',gain:.07})},
    tick:()=>tone(880,0,.05,{gain:.022}),
    go:()=>tone(1047,0,.25,{type:'triangle'}),
    hit:()=>tone(170,0,.32,{to:55,gain:.16}),
    // Golpe seco cuando el «VS» cae en el centro de la pantalla.
    slam:()=>{tone(140,0,.45,{to:45,gain:.2});tone(1400,0,.18,{to:300,type:'triangle',gain:.035})},
    good:()=>[523,659,784].forEach((f,i)=>tone(f,i*.09,.25,{type:'triangle'})),
    even:()=>tone(440,0,.25,{type:'triangle',gain:.04}),
    win:()=>[523,659,784,1047,1319].forEach((f,i)=>tone(f,i*.11,.4,{type:'triangle',gain:.07})),
    lose:()=>[392,330,262].forEach((f,i)=>tone(f,i*.18,.45,{type:'triangle',gain:.05})),
    level:()=>[784,988,1175,1568].forEach((f,i)=>tone(f,.5+i*.08,.3,{gain:.05})),
    // Campana de ring: dos golpes con parciales inarmónicos, cuando alguien responde y arranca el reloj de 30 s.
    bell:()=>{for(const at of [0,.34])[[1,.09,1.9],[2.76,.045,1.2],[5.4,.025,.7],[8.93,.012,.4]].forEach(([k,gain,length])=>tone(660*k,at,length,{gain}))},
    // Tensión al encontrar rival: golpe grave, latidos, dos notas que chocan y un barrido que sube.
    tension:()=>{tone(92,0,1,{to:36,gain:.2});[0,.28,1,1.28,2,2.28].forEach((at,i)=>tone(58,at,.2,{to:42,gain:i%2?.09:.14}));tone(196,0,2.9,{type:'triangle',gain:.028});tone(207.65,0,2.9,{type:'triangle',gain:.022});tone(110,.2,2.7,{type:'sawtooth',gain:.016,to:440})}
  };
  // Música del duelo: dos bucles generados con osciladores (sin archivos). 'calm' acompaña mientras se piensa, con aire
  // de curiosidad; 'rush' suena cuando alguien ha respondido y corre el reloj de 30 segundos: más rápida y cada vez más aguda.
  const N={D2:73.42,E2:82.41,A2:110,B2:123.47,D4:293.66,E4:329.63,F4:349.23,Fs4:369.99,G4:392,A4:440,B4:493.88,C5:523.25,D5:587.33,E5:659.25};
  const CALM=[N.D4,0,N.A4,0,N.F4,N.A4,N.C5,0,N.B4,0,N.G4,0,N.E4,N.G4,N.A4,0,N.D4,0,N.A4,0,N.F4,N.A4,N.D5,0,N.C5,0,N.A4,N.G4,N.E4,0,N.F4,0];
  const RUSH=[N.E4,N.G4,N.B4,N.E5,N.B4,N.G4,N.Fs4,N.B4];
  let music=null;
  function musicStep(mode,step,at){
    if(mode==='calm'){
      const note=CALM[step%32];if(note)tone(note,at,.26,{type:'triangle',gain:.032});
      if(step%16===0)tone(N.D2,at,.9,{gain:.05});if(step%16===8)tone(N.A2,at,.9,{gain:.045});
      if(step%8===7)tone(note?note*2:1174.66,at,.18,{gain:.012});
    }else{
      const up=2**(Math.min(5,Math.floor(step/32))/12);
      tone(RUSH[step%8]*up,at,.13,{type:'triangle',gain:.034});tone((step%2?N.E2*2:N.E2)*up,at,.12,{type:'sawtooth',gain:.022});
      if(step%4===0)tone(1760,at,.03,{type:'square',gain:.012});if(step%8===4)tone(N.B2*up,at,.2,{gain:.05});
    }
  }
  function pump(){if(!music||!audio)return;while(music.next<audio.currentTime+.3){musicStep(music.mode,music.step++,Math.max(0,music.next-audio.currentTime));music.next+=music.gap}}
  function stopMusic(){if(music){clearInterval(music.timer);music=null}}
  function startMusic(mode){
    if(!Sound.on){stopMusic();return}
    if(music?.mode===mode)return;stopMusic();
    audio=Sound.context();if(!audio)return;
    music={mode,step:0,gap:mode==='calm'?.3:.165,next:audio.currentTime+.08,timer:setInterval(pump,90)};pump();
  }

  async function call(action,extra={}){
    try{
      await playerReady;
      const response=await fetch('/api/duelo',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,player:playerId(),...extra}),signal:AbortSignal.timeout(8000)});
      return {ok:response.ok,status:response.status,data:await response.json()};
    }catch{return {ok:false,status:0,data:{error:'Sin conexión con el servidor'}}}
  }
  // badge = la medalla destacada (decisión 0035): viaja con el avatar y el rival la ve junto al nombre.
  // bet = la apuesta elegida (decisión 0044, bets.js), o null.
  const identity=()=>({name:profile.name,avatar:{...Progress.look(),badge:Progress.badge()},level:Progress.level(),bet:window.Bets?.choice()||null,
    gestures:Object.fromEntries(['duel','duel3','ranked'].map(mode=>[mode,Object.fromEntries(Object.entries(Progress.gestures(mode)).filter(([,value])=>value!=='default'))]))});
  const reactionMode=()=>three()?'duel3':duel?.mode==='ranked'?'ranked':'duel';
  function playerReaction(player,cue){
    const mode=reactionMode();
    if(player===me())return Progress.reaction(mode,cue);
    return Celebrations.reaction(Celebrations.normalize(player.gestures),mode,cue);
  }
  function reactionOptions(player,cue){
    const reaction=playerReaction(player,cue);
    return {reaction,zoom:reaction.clip==='desmayo'?'stage':''};
  }
  const answerReaction=(player,guess,answer)=>reactionOptions(player,Celebrations.tierOf(guess==null?Infinity:Math.max(guess/answer,answer/guess)).id);
  const betChip=player=>window.Bets?Bets.chip(player):'';
  const badge=player=>player.bot?'':Medals.chip(player.avatar?.badge);
  // El bot tiene su propio aspecto de robot (piel de metal, cascos y gafas oscuras) y siempre se llama Faraday-bot.
  const BOT_LOOK={_raw:{skin:'robot',face:'serio',hair:'calvo',hairColor:'gris',top:'plumas',topColor:'gris',trimColor:'negro',print:'',bottom:'cargo',bottomColor:'gris',shoes:'plataforma',shoesColor:'negro',hat:'',extras:['cascos','sol']}};
  const lookOf=player=>player.bot?BOT_LOOK:player.avatar;
  const avatar=(player,extra='')=>`<span class="duel-avatar ${extra}" aria-hidden="true">${Avatar.render(lookOf(player),{bust:true})}</span>`;
  // Cuerpo entero y animado para las pantallas grandes (portal, presentación, resultado de la ronda y final).
  const figure=(player,extra='',options={})=>`<span class="duel-figure ${extra}" aria-hidden="true">${Avatar.render(lookOf(player),{live:true,...options})}</span>`;
  const setView=(view,tone='')=>{shell.dataset.view=view;shell.dataset.tone=tone;shell.dataset.screen=duel?.phase||'lobby'};
  function alertBar(html,ms=4200){const bar=$('#duel-alert');bar.innerHTML=html;bar.classList.add('show');clearTimeout(alertBar.timer);alertBar.timer=setTimeout(()=>bar.classList.remove('show'),ms)}

  function offerMode(){
    if(duel?.players?.some(player=>player.bot))return 'practice';
    if(three())return 'duel3';
    return duel?.mode==='ranked'?'ranked':lastOfferMode;
  }
  function paintQuota(data,mode=offerMode(),focus=false){
    if(shell.hidden||(shown!=='lobby'&&shell.dataset.screen!=='end'))return;
    let slot=content.querySelector('[data-duel-plan]');
    if(!slot&&focus){slot=document.createElement('div');slot.dataset.duelPlan='';content.append(slot)}
    if(!slot)return;
    if(data?.plus||data?.limit===null){slot.innerHTML='';return}
    const valid=Number.isInteger(data?.limit)&&data.limit>=0&&Number.isInteger(data?.played)&&data.played>=0;
    slot.innerHTML=window.PlusOffers?.render(mode,{...(typeof data?.plus==='boolean'?{plus:data.plus}:{}),
      ...(valid?{limit:data.limit,remaining:Math.max(0,data.limit-data.played),exhausted:data.played>=data.limit,compact:data.played<data.limit}:{compact:true})})||'';
    if(focus&&slot.firstElementChild){slot.tabIndex=-1;slot.focus();slot.scrollIntoView({block:'center',behavior:reduced()?'auto':'smooth'})}
  }
  async function refreshQuota(){
    const slot=content.querySelector('[data-duel-plan]'),request=++quotaRequest;
    if(!slot)return;
    const response=await call('limite');
    if(request!==quotaRequest||!slot.isConnected||shell.hidden)return;
    quotaState=response.ok?response.data:null;
    paintQuota(quotaState);
  }

  // Marcador: avatar, nombre, nivel y barra de vida de cada jugador. La vida perdida se queda un momento
  // marcada en la barra antes de desaparecer, y la cifra del golpe sube flotando.
  function renderHud(){
    hud.classList.toggle('is-three',three());
    const vitals=who=>`<div class="duel-vitals"><span class="hp-num" data-hp-num="${who}"></span><strong class="duel-boost" data-boost="${who}" title="Multiplicador de daño" hidden><span class="sr-only">Multiplicador de daño: </span><span data-boost-value></span></strong></div>`;
    if(three()){
      const card=(player,seat)=>`<div class="duel-player${player.hp<=0?' is-out':''}" data-side="${seat===duel.you?'you':'rival'}" data-seat="${seat}">${avatar(player)}<div class="duel-who"><span class="duel-name">${seat===duel.you?'Tú':escapeHtml(player.name)}</span>${badge(player)}${betChip(player)}<span class="duel-level">${'Nv. '+player.level}</span><span class="duel-check" data-check="${seat}" hidden>✓</span></div><div class="hp" role="img" data-hp="${seat}"><i class="hp-ghost"></i><i class="hp-fill"></i></div>${vitals(seat)}</div>`;
      hud.innerHTML=`<div class="duel-mid"><span id="duel-round"></span><b id="duel-mult"></b></div>`+[duel.you,...others().map(one=>one.seat)].map(seat=>card(duel.players[seat],seat)).join('');
      hud.hidden=false;hud.dataset.duel=duel.id;setHp(false);return;
    }
    const side=(player,who)=>`<div class="duel-player" data-side="${who}">${avatar(player)}<div class="duel-who"><span class="duel-name">${escapeHtml(player.name)}</span>${badge(player)}${betChip(player)}<span class="duel-level">${player.bot?'Bot':'Nv. '+player.level}</span>${window.Ranked&&duel.mode==='ranked'?Ranked.chip(player.rank):''}<span class="duel-check" data-check="${who}" hidden>✓</span></div><div class="hp" role="img" data-hp="${who}"><i class="hp-ghost"></i><i class="hp-fill"></i></div>${vitals(who)}</div>`;
    hud.innerHTML=side(me(),'you')+`<div class="duel-mid"><span id="duel-round"></span><b id="duel-mult"></b></div>`+side(rival(),'rival');
    hud.hidden=false;hud.dataset.duel=duel.id;setHp(false);
  }
  function setHp(animate=true){
    for(const [who,player] of three()?duel.players.map((one,seat)=>[String(seat),one]):[['you',me()],['rival',rival()]]){
      const bar=hud.querySelector(`[data-hp="${who}"]`),number=hud.querySelector(`[data-hp-num="${who}"]`);if(!bar)continue;
      const ratio=player.hp/duel.maxHp,previous=Number(bar.dataset.value??player.hp);
      bar.style.setProperty('--hp',ratio);bar.dataset.level=ratio>.5?'high':ratio>.25?'mid':'low';bar.dataset.value=player.hp;bar.parentElement.classList.toggle('is-out',player.hp<=0);
      bar.setAttribute('aria-label',`Vida de ${player.name}: ${int(player.hp)} de ${int(duel.maxHp)}`);
      if(animate&&previous>player.hp){
        const hit=document.createElement('span');hit.className='hp-hit';hit.textContent='−'+int(previous-player.hp);bar.parentElement.append(hit);setTimeout(()=>hit.remove(),1900);
        bar.parentElement.classList.remove('is-hit');void bar.offsetWidth;bar.parentElement.classList.add('is-hit');
        count(number,previous,player.hp,900);
      }else number.textContent=int(player.hp);
    }
  }
  function count(element,from,to,ms,format=int){
    if(!element)return;if(reduced()){element.textContent=format(to);return}
    const start=performance.now(),step=now=>{if(!element.isConnected)return;const t=Math.min(1,(now-start)/ms);element.textContent=format(from+(to-from)*(1-(1-t)**3));if(t<1)requestAnimationFrame(step)};
    requestAnimationFrame(step);setTimeout(()=>{if(element.isConnected)element.textContent=format(to)},ms+300);
  }
  function setRoundInfo(){
    const round=duel.round;if(!round||!$('#duel-round'))return;
    $('#duel-round').textContent=`Ronda ${round.number}`;
    $('#duel-mult').textContent=round.multipliers?'Daño':`Daño ${times(round.multiplier)}`;
    for(const [who,index] of three()?duel.players.map((one,seat)=>[String(seat),seat]):[['you',duel.you],['rival',1-duel.you]]){
      const check=hud.querySelector(`[data-check="${who}"]`);
      check.hidden=!(duel.phase==='question'&&round.answered[index]);
      const boost=hud.querySelector(`[data-boost="${who}"]`),value=round.multipliers?.[index];
      boost.hidden=value==null;
      if(value==null)continue;
      const label=times(value),number=boost.querySelector('[data-boost-value]');
      if(number.textContent!==label){
        number.textContent=label;
        boost.classList.toggle('is-boosted',value>1);
      }
    }
  }
  function nextRoundNote(round){
    if(round.nextMultipliers){
      const winner=round.nextMultipliers.findIndex((value,seat)=>value>round.multipliers[seat]);
      if(winner===duel.you)return `Tu daño sube a <b>${times(round.nextMultipliers[winner])}</b> en la siguiente ronda.`;
      if(winner>=0)return `${joinNames([duel.players[winner].name])} sube a <b>${times(round.nextMultipliers[winner])}</b> en la siguiente ronda.`;
    }else if(round.nextMultiplier>round.multiplier){
      return `Atención: en la siguiente ronda el daño sube a ${times(round.nextMultiplier)}.`;
    }
    return 'Prepárate para la siguiente pregunta.';
  }

  // Pantallas
  function renderLobby(message=''){
    duel=null;shown='lobby';hud.hidden=true;hideVersus(true);setView('result');stopTimers();saved.remove('actual');window.DuelChat?.reset();
    const progress=Progress.info();
    lastOfferMode=window.Ranked?.mode()==='ranked'?'ranked':'duel';
    content.innerHTML=`<p class="duel-kicker">Duelo 1 vs 1</p>
<h2 id="duel-title">La misma pregunta para los dos. <em>Quien más se aleja pierde vida.</em></h2>
${inviteCode?`<div class="duel-invite"><p><strong>Te han retado a un duelo.</strong> Código ${escapeHtml(inviteCode)}</p><button class="game-primary" type="button" data-duel="accept">Aceptar el duelo <span aria-hidden="true">→</span></button></div>`:''}
<div class="duel-profile">
  <div class="duel-stage">${figure({avatar:Progress.look()},'',{drag:true})}<button type="button" class="duel-edit" data-open-profile-inline="armario" aria-label="Personalizar avatar" title="Personalizar avatar"><svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/></svg></button></div>
  <div class="duel-me-info">
    <label class="duel-name-field"><span class="sr-only">Tu apodo</span><input id="duel-name" type="text" maxlength="16" autocomplete="nickname" value="${escapeHtml(profile.name)}"></label>
    <div class="duel-xp"><span><b>Nivel ${progress.level}</b><small>${int(progress.done)} / ${int(progress.need)} XP</small></span><div class="duel-xpbar"><i style="--xp:${progress.ratio}"></i></div></div>
    <p class="duel-record">${stats.wins+stats.losses?`${stats.wins} ${stats.wins===1?'victoria':'victorias'} · ${stats.losses} ${stats.losses===1?'derrota':'derrotas'}${stats.streak?` · 🔥 racha de ${stats.streak}`:''}`:'Aún no has jugado ningún duelo'}</p>
  </div>
</div>
${window.Bets?Bets.picker():''}
<p class="form-error" id="duel-error" role="alert">${escapeHtml(message)}</p>
${window.Ranked?Ranked.lobby():''}
<div class="duel-modes duel-cta"><button class="game-primary" type="button" data-duel="quick">${window.Ranked?.mode()==='ranked'?'Buscar clasificatoria':'Partida rápida'} <span aria-hidden="true">→</span></button><button class="game-secondary" type="button" data-duel="friend">Retar a un amigo</button></div>
<div class="duel-modes duel-three-modes"><span class="duel-three-label">Nuevo · 1 vs 1 vs 1</span><button class="game-secondary" type="button" data-duel="quick3">Partida de tres</button><button class="game-secondary" type="button" data-duel="friend3">Retar a dos amigos</button></div>
<details class="duel-join-box"${message?' open':''}><summary>¿Tienes un código de duelo?</summary><form class="duel-join" id="duel-join"><label class="sr-only" for="duel-code">Código de duelo</label><input id="duel-code" type="text" maxlength="6" autocomplete="off" autocapitalize="characters" placeholder="ABC123"><button class="game-secondary" type="submit">Unirme</button></form></details>
<div data-duel-plan></div>
<p class="duel-rules">${int(6000)} de vida · 3 min por pregunta · 30 s cuando responde tu rival · contra otros jugadores, tu daño empieza en ×1 y sube +0,5 por cada ronda ganada</p>`;
    window.Ranked?.paint();if(window.Ranked?.unlocked())Ranked.refresh();
    refreshQuota();
  }
  function renderWaitingThree(){
    hud.hidden=true;setView('result');
    const friend=!duel.public,link=`${location.origin}${location.pathname}?duelo=${duel.code}`,missing=3-duel.players.length;
    content.innerHTML=`<p class="duel-kicker">Duelo de tres · ${friend?'con amigos':'partida rápida'}</p>
<div class="duel-search is-three">${duel.players.map(player=>figure(player,'mid')).join('')}${'<span class="duel-avatar big ghost" aria-hidden="true">?</span>'.repeat(missing)}</div>
<h2 id="duel-title">${friend?'Comparte el código':'Buscando rivales…'}</h2>
${friend?`<p class="duel-code" aria-label="Código del duelo">${duel.code}</p>`:''}
<p class="duel-note">${duel.players.length} de 3 en la sala. ${friend?`Empieza en cuanto entren ${missing===1?'el que falta':'los '+missing+' que faltan'} con el enlace o el código.`:`Faltan ${missing}: emparejando con quien entre.`}</p>
${friend?`<div class="duel-modes"><button class="game-primary" type="button" data-duel="share" data-link="${link}">Copiar enlace</button></div>`:''}
<button class="duel-link" type="button" data-duel="cancel">Cancelar</button>`;
  }
  function renderWaiting(){
    if(three())return renderWaitingThree();
    hud.hidden=true;setView('result');
    const friend=!duel.public,link=`${location.origin}${location.pathname}?duelo=${duel.code}`;
    content.innerHTML=`<p class="duel-kicker">${friend?'Duelo con un amigo':duel.mode==='ranked'?'Clasificatoria':'Partida rápida'}</p>
<div class="duel-search">${figure(me(),'mid')}<span class="duel-dots" aria-hidden="true"><i></i><i></i><i></i></span><span class="duel-avatar big ghost" aria-hidden="true">?</span></div>
<h2 id="duel-title">${friend?'Comparte el código':'Buscando rival…'}</h2>
${friend?`<p class="duel-code" aria-label="Código del duelo">${duel.code}</p><p class="duel-note">El duelo empieza en cuanto tu amigo abra el enlace o escriba el código.</p><div class="duel-modes"><button class="game-primary" type="button" data-duel="share" data-link="${link}">Copiar enlace</button><button class="game-secondary" type="button" data-duel="bot">Practicar con el bot</button></div>`
:`<p class="duel-note" id="duel-wait-note">Emparejando con la primera persona que entre.</p><div class="duel-modes" id="duel-bot-offer" hidden><button class="game-primary" type="button" data-duel="bot">Jugar contra Faraday-bot</button></div>`}
<button class="duel-link" type="button" data-duel="cancel">Cancelar</button>`;
  }
  function renderIntro(){
    renderHud();hud.hidden=true;setView('question','coral');
    content.innerHTML=`<p class="duel-kicker">Rival encontrado</p><h2 id="duel-title">${escapeHtml(me().name)} contra ${escapeHtml(rival().name)}</h2><p class="duel-note">${int(duel.maxHp)} de vida cada uno. ${duel.round.multipliers?'Tu daño empieza en ×1 y sube +0,5 cada vez que ganas una ronda.':'El daño empieza flojo y sube en cada ronda.'}</p>`;
    showVersus();sfx.tension();
  }
  // Pantalla «VS» a toda pantalla al encontrar rival: cada jugador entra por su lado en una franja diagonal, con el avatar
  // en grande y el apodo debajo; el VS cae en el centro con un destello. Dura lo que la fase «intro» del servidor (5 s)
  // y se va en cuanto empieza la primera pregunta.
  let versus=null;
  function showVersus(){
    hideVersus(true);
    if(three()){
      const card=(player,seat)=>`<div class="versus-card" data-seat="${seat}" data-you="${seat===duel.you}"><div class="versus-figure">${Avatar.render(lookOf(player),{live:true,emote:seat===duel.you?'wave':'',turn:(seat-1)*.4})}</div><div class="versus-tag"><small>${seat===duel.you?'Tú':'Rival'}</small><strong>${escapeHtml(player.name)}</strong><span class="versus-meta">${badge(player)}<b>Nv. ${player.level}</b>${betChip(player)}</span></div></div>`;
      versus=document.createElement('div');versus.className='duel-versus is-three';
      versus.innerHTML=`<div class="versus-cards">${duel.players.map(card).join('')}</div><span class="versus-flash" aria-hidden="true"></span><span class="versus-mark" aria-hidden="true">VS</span><p class="versus-count" aria-live="polite"><span class="sr-only">El duelo empieza en </span><span id="duel-countdown">${Math.max(1,Math.ceil((duel.round.startsAt-serverNow())/1000))}</span></p>`;
      shell.append(versus);if(!reduced())setTimeout(()=>{if(versus)sfx.slam()},520);return;
    }
    const ranked=player=>window.Ranked&&duel.mode==='ranked'?Ranked.chip(player.rank):'';
    const side=(player,who)=>`<div class="versus-side" data-side="${who}"><span class="versus-band" aria-hidden="true"></span><div class="versus-player"><div class="versus-figure">${Avatar.render(lookOf(player),{live:true,emote:who==='you'?'wave':'',turn:who==='you'?.45:-.45})}</div><div class="versus-tag"><small>${who==='you'?'Tú':player.bot?'Bot de práctica':'Rival'}</small><strong>${escapeHtml(player.name)}</strong><span class="versus-meta">${badge(player)}${player.bot?'':'<b>Nv. '+player.level+'</b>'}${ranked(player)}${betChip(player)}</span></div></div></div>`;
    versus=document.createElement('div');versus.className='duel-versus';
    versus.innerHTML=side(me(),'you')+side(rival(),'rival')+`<span class="versus-flash" aria-hidden="true"></span><span class="versus-mark" aria-hidden="true">VS</span><p class="versus-count" aria-live="polite"><span class="sr-only">El duelo empieza en </span><span id="duel-countdown">${Math.max(1,Math.ceil((duel.round.startsAt-serverNow())/1000))}</span></p>`;
    shell.append(versus);
    if(!reduced())setTimeout(()=>{if(versus)sfx.slam()},520);
  }
  function hideVersus(now=false){
    const element=versus;versus=null;if(!element)return;
    if(now||reduced()){element.remove();return}
    element.classList.add('is-out');setTimeout(()=>element.remove(),500);
  }
  function renderQuestion(){
    if(hud.dataset.duel!==duel.id||hud.hidden)renderHud();
    const round=duel.round,q=round.question;switchWorkspace(`duelo:${duel.id}:${round.number}`);setView('question',window.CATEGORIES?.[q.category]?.tone||'coral');setHp(false);setRoundInfo();
    content.innerHTML=`<div class="duel-top"><span class="duel-kicker">Ronda ${round.number}${round.multipliers?'':` · daño ${times(round.multiplier)}`}</span><div class="duel-tools"><div class="duel-timer" id="duel-timer" role="timer" aria-label="Tiempo restante"><svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2M9.5 2.5h5"/></svg><b id="duel-time">3:00</b></div></div></div>
<div class="duel-timebar" aria-hidden="true"><i id="duel-timebar"></i></div>
<h2 id="duel-title">${q.title}</h2>${q.image?questionMedia(q,{eager:true,links:false}):''}
<div id="duel-answer"></div>`;
    lastSecond=-1;renderAnswerBox(true);sfx.go();
    const done=duel.players.flatMap((player,seat)=>seat!==duel.you&&round.answered[seat]?[player]:[]);
    if(done.length&&round.yourGuess==null)alertBar(`${avatar(done[0],'tiny')}<span>${joinNames(done.map(player=>player.name))} ${done.length>1?'ya han respondido':'ya ha respondido'}</span>`);
  }
  function renderAnswerBox(focus){
    const round=duel.round,box=$('#duel-answer');if(!box)return;
    if(three()&&!round.alive.includes(duel.you)){
      box.innerHTML='<div class="duel-sent"><small>Estás fuera</small><strong>Sin vida</strong><span>Mira cómo acaban los demás</span></div><p class="duel-rival-state" id="duel-rival-state"></p>';
    }else if(round.yourGuess!=null){
      box.innerHTML=`<div class="duel-sent"><small>Tu respuesta</small><strong>${whole(round.yourGuess)}</strong><span>${round.question.unit}</span></div><p class="duel-rival-state" id="duel-rival-state"></p>`;
    }else if(!$('#duel-form')){
      box.innerHTML=`<form id="duel-form"><label class="sr-only" for="duel-guess">Tu estimación, en ${round.question.unit}</label><div class="guess-row"><input id="duel-guess" type="text" inputmode="decimal" autocomplete="off" placeholder="Tu estimación" aria-describedby="duel-help" required><span class="guess-unit">${round.question.unit}</span></div><div class="form-error" id="duel-help" role="alert"></div><div class="game-actions"><button class="workspace-launch" type="button" data-duel="calc" aria-label="${panel.hidden?'Abrir':'Cerrar'} calculadora y notas" aria-expanded="${!panel.hidden}" title="Calculadora y notas">${calcIcon}</button><p class="duel-rival-state" id="duel-rival-state"></p><button class="game-primary" type="submit">Confirmar <span aria-hidden="true">→</span></button></div></form>`;
      if(focus)$('#duel-guess').focus();
    }
    updateRivalState();
  }
  function updateRivalState(){
    const element=$('#duel-rival-state');if(!element||!duel.round)return;
    if(three()){
      const round=duel.round,rest=others().filter(one=>round.alive.includes(one.seat)),done=rest.filter(one=>round.answered[one.seat]),waiting=rest.filter(one=>!round.answered[one.seat]);
      element.innerHTML=`${avatar((done[0]||rest[0]||others()[0]).player,'tiny')}<span>${round.yourGuess!=null&&waiting.length?`Esperando a ${joinNames(waiting.map(one=>one.player.name))}…`:done.length?`${joinNames(done.map(one=>one.player.name))} ${done.length>1?'ya han respondido':'ya ha respondido'}`:'Estáis pensando…'}</span>`;
      element.classList.toggle('done',!waiting.length);return;
    }
    const answered=duel.round.answered[1-duel.you],name=escapeHtml(rival().name);
    element.innerHTML=`${avatar(rival(),'tiny')}<span>${answered?`<b>${name}</b> ya ha respondido`:duel.round.yourGuess!=null?`Esperando a <b>${name}</b>…`:`<b>${name}</b> está pensando…`}</span>`;
    element.classList.toggle('done',answered);
  }
  // «Cómo se calcula», el mismo panel del reto diario (explainMarkup, community.js), plegado: se abre solo si se quiere.
  // Sin la foto: ya se vio en la pregunta.
  function explainInner(question,answer,explain){
    if(!explain||typeof explainMarkup!=='function')return '';
    const {image,...q}=question;
    return `<div class="explain-inner">${explainMarkup({...q,answer,...explain})}</div>`;
  }
  function explainBlock(question,answer,explain,extra=''){
    const inner=explainInner(question,answer,explain);
    return inner?`<details class="duel-explain"><summary>Cómo se calcula${extra}</summary>${inner}</details>`:'';
  }
  // Repaso al final del duelo: cada pregunta con las dos respuestas y su cálculo.
  function reviewMarkup(){
    const rounds=(duel.rounds||[]).filter(r=>r.question);if(!rounds.length)return '';
    const guess=(value,unit)=>value==null?'Sin respuesta':`${whole(value)} ${unit}`;
    return `<section class="duel-review" aria-labelledby="duel-review-title"><h3 id="duel-review-title">Repasa las preguntas</h3>${rounds.map((r,i)=>{const q=r.question;
      return `<details class="duel-review-item"><summary><span>R${i+1}</span>${escapeHtml(q.title)}</summary><dl class="duel-review-guesses"><div><dt>Real</dt><dd>≈ ${rounded(q.answer)} ${q.unit}</dd></div><div><dt>Tú</dt><dd>${guess(r.guesses?.[duel.you],q.unit)}</dd></div>${others().map(one=>`<div><dt>${escapeHtml(one.player.name)}</dt><dd>${guess(r.guesses?.[one.seat],q.unit)}</dd></div>`).join('')}</dl>${explainInner(q,q.answer,r.explain)}</details>`}).join('')}</section>`;
  }
  function renderReveal(final){
    if(hud.dataset.duel!==duel.id||hud.hidden)renderHud();
    if(three())return renderRevealThree(final);
    const round=duel.round,q=round.question,mine=round.guesses[duel.you],theirs=round.guesses[1-duel.you],myPoints=round.points[duel.you],theirPoints=round.points[1-duel.you];
    setView('result');setRoundInfo();revealed=duel.id+':'+round.number;
    const column=(player,guess,pointsWon,who)=>`<div class="duel-col${round.loser&&round.loser!==who?' is-best':''}">${figure(player,'col',answerReaction(player,guess,round.answer))}<span class="duel-col-name">${who==='you'?'Tú':escapeHtml(player.name)}</span><strong class="duel-col-guess">${guess==null?'Sin respuesta':whole(guess)}</strong><span class="duel-col-x">${guess==null?'—':times(Math.max(guess/round.answer,round.answer/guess))}</span>${guess!=null&&window.CasiCasi?.is(Math.max(guess/round.answer,round.answer/guess))?'<em class="duel-casi">¡Casi casi!</em>':''}<b class="duel-col-points" data-points="${pointsWon}">0</b><small>puntos</small></div>`;
    const outcome=round.loser===null?'Empate en esta ronda: nadie pierde vida.':round.loser==='rival'?`Le quitas <b>${int(round.damage)}</b> de vida a ${escapeHtml(rival().name)}.`:`Pierdes <b>${int(round.damage)}</b> de vida.`;
    const damageDetail=round.multipliers?`${int(Math.abs(myPoints-theirPoints))} ${times(round.multiplier)}`:`Daño ${times(round.multiplier)}`;
    content.innerHTML=`<div class="duel-top"><span class="duel-kicker">Resultado · ronda ${round.number}</span><span class="duel-kicker" id="duel-countdown"></span></div>
<h2 id="duel-title" class="duel-q-small">${q.title}</h2>
<div class="duel-real"><small>Real</small><strong>≈ ${rounded(round.answer)}</strong><span>${q.unit}</span>${round.source?`<a href="${round.source.url}" target="_blank" rel="noopener">Fuente: ${escapeHtml(round.source.title.length>60?round.source.title.slice(0,58)+'…':round.source.title)}</a>`:''}</div>
<div class="duel-cols">${column(me(),mine,myPoints,'you')}${column(rival(),theirs,theirPoints,'rival')}</div>
<p class="duel-outcome is-${round.loser||'even'}">${outcome}${round.loser?` <small>${damageDetail}</small>`:''}</p>
${explainBlock(q,round.answer,round.explain,final?'':' <small>· también al final del duelo</small>')}
${final?'':`<p class="duel-note">${nextRoundNote(round)}</p>`}`;
    content.querySelectorAll('[data-points]').forEach(element=>count(element,0,Number(element.dataset.points),1000));
    // La barra de vida baja un instante después de ver los puntos, con su golpe.
    setTimeout(()=>{if(!duel||revealed!==duel.id+':'+round.number)return;setHp(true);(round.loser==='you'?sfx.hit:round.loser==='rival'?sfx.good:sfx.even)()},reduced()?0:1100);
  }
  // Resultado de una ronda de tres: una columna por jugador, con sus puntos y el daño que recibe.
  function renderRevealThree(final){
    const round=duel.round,q=round.question;setView('result');setRoundInfo();revealed=duel.id+':'+round.number;
    const seats=[duel.you,...others().map(one=>one.seat)];
    const column=seat=>{
      const player=duel.players[seat],guess=round.guesses[seat],ratio=guess==null?null:Math.max(guess/round.answer,round.answer/guess),hurt=round.damages[seat]>0,out=!round.alive.includes(seat);
      return `<div class="duel-col${round.best.includes(seat)&&!out?' is-best':''}${out?' is-out':''}">${figure(player,'col',answerReaction(player,out?null:guess,round.answer))}<span class="duel-col-name">${seat===duel.you?'Tú':escapeHtml(player.name)}</span><strong class="duel-col-guess">${out?'Fuera':guess==null?'Sin respuesta':whole(guess)}</strong><span class="duel-col-x">${ratio==null?'—':times(ratio)}</span>${ratio!=null&&window.CasiCasi?.is(ratio)?'<em class="duel-casi">¡Casi casi!</em>':''}<b class="duel-col-points" data-points="${round.points[seat]}">0</b><small>puntos</small>${hurt?`<span class="duel-col-hit">−${int(round.damages[seat])}</span>`:'<span class="duel-col-hit is-safe">sin daño</span>'}</div>`;
    };
    const hit=seats.filter(seat=>round.damages[seat]>0);
    const outcome=hit.length?hit.map(seat=>seat===duel.you?`Pierdes <b>${int(round.damages[seat])}</b> de vida.`:`${joinNames([duel.players[seat].name])} pierde <b>${int(round.damages[seat])}</b>.`).join(' '):'Empate en esta ronda: nadie pierde vida.';
    content.innerHTML=`<div class="duel-top"><span class="duel-kicker">Resultado · ronda ${round.number}</span><span class="duel-kicker" id="duel-countdown"></span></div>
<h2 id="duel-title" class="duel-q-small">${q.title}</h2>
<div class="duel-real"><small>Real</small><strong>≈ ${rounded(round.answer)}</strong><span>${q.unit}</span>${round.source?`<a href="${round.source.url}" target="_blank" rel="noopener">Fuente: ${escapeHtml(round.source.title.length>60?round.source.title.slice(0,58)+'…':round.source.title)}</a>`:''}</div>
<div class="duel-cols is-three">${seats.map(column).join('')}</div>
<p class="duel-outcome is-${round.damages[duel.you]>0?'you':hit.length?'rival':'even'}">${outcome}${hit.length?` <small>Daño ${times(round.multiplier)}</small>`:''}</p>
${explainBlock(q,round.answer,round.explain,final?'':' <small>· también al final del duelo</small>')}
${final?'':`<p class="duel-note">${nextRoundNote(round)}</p>`}`;
    content.querySelectorAll('[data-points]').forEach(element=>count(element,0,Number(element.dataset.points),1000));
    setTimeout(()=>{if(!duel||revealed!==duel.id+':'+round.number)return;setHp(true);(round.damages[duel.you]>0?sfx.hit:round.best.includes(duel.you)?sfx.good:sfx.even)()},reduced()?0:1100);
  }
  function finishStats(){
    const counted=saved.get('contados',[]);if(counted.includes(duel.id)||duel.reason==='cancelado'||duel.players.length<(duel.size||2))return null;
    saved.set('contados',[...counted,duel.id].slice(-30));
    const today=new Date().toLocaleDateString('en-CA'),rounds=duel.rounds?.length||0,parts=[];
    if(duel.winner==='you'){
      stats.wins++;stats.streak++;stats.best=Math.max(stats.best,stats.streak);parts.push(['Victoria',100]);
      if(stats.lastWin!==today){parts.push(['Primera victoria del día',50]);stats.lastWin=today}
      if(stats.streak>1)parts.push([`Racha de ${stats.streak}`,Math.min(50,(stats.streak-1)*10)]);
    }else if(duel.winner==='draw'){stats.draws++;parts.push(['Empate',60])}
    else{stats.losses++;stats.streak=0;if(duel.reason!=='abandono')parts.push(['Duelo completado',40])}
    const left=three()?!!me().left:duel.winner==='rival'&&duel.reason==='abandono';
    if(rounds&&!left)parts.push([`${rounds} ${rounds===1?'ronda':'rondas'}`,rounds*10]);
    // Tope diario: los tres primeros duelos del día premian entero y los siguientes al 25 %. Contra el bot,
    // la mitad de experiencia y faradios solo en el primero del día: practicar no debe rendir más que el reto diario.
    const bot=!!rival()?.bot,daily=stats.day?.date===today?stats.day:{date:today,count:0,bot:0};
    const capped=daily.count>=DAILY_FULL,factor=(capped?CAPPED_FACTOR:1)*(bot?BOT_FACTOR:1);
    const notes=[];if(bot)notes.push(daily.bot?'Práctica con el bot: mitad de XP, sin faradios':'Práctica con el bot: mitad de XP');
    if(capped)notes.push(`Tope diario: premio al ${Math.round(CAPPED_FACTOR*100)} %`);
    const fromRatio=Progress.info().ratio,abandoned=left;
    const gained=Math.round(parts.reduce((sum,[,xp])=>sum+xp,0)*factor);
    const key=duel.winner==='you'?'win':duel.winner==='draw'?'draw':'loss';
    const coins=abandoned||(bot&&daily.bot)?0:Math.round(Progress.REWARD.duel[key]*(capped?CAPPED_FACTOR:1));
    if(!abandoned)stats.day={date:today,count:daily.count+1,bot:daily.bot+(bot?1:0)};
    saved.set('progreso',stats);
    // Con cuenta, los faradios del duelo los calcula y los paga el servidor (decisión 0059): aquí solo se piden.
    const online=Progress.linked(),outcome=Progress.reward({xp:gained,coins:online?0:coins,reason:'duelos'});if(online&&coins)Progress.claim('duelo:'+duel.id);
    // charge: lo que este duelo carga la batería de cofres (progress.js); sigue el mismo tope que el premio.
    document.dispatchEvent(new CustomEvent('faraday:duel',{detail:{result:key,rounds,abandoned,bot,flawless:key==='win'&&me().hp>=duel.maxHp,charge:abandoned||(bot&&daily.bot)?0:capped?5:20}}));
    return {parts,notes,gained,coins,fromRatio,levelUp:outcome.levelUp,levelCoins:outcome.levelCoins};
  }
  function renderEnd(){
    clearTimeout(endTimer);
    if(duel.reason==='cancelado'||duel.players.length<(duel.size||2)){renderLobby();return}
    if(hud.dataset.duel!==duel.id||hud.hidden)renderHud();setHp(false);
    const won=duel.winner==='you',draw=duel.winner==='draw',result=finishStats(),progress=Progress.info(),name=escapeHtml(rival().name);
    setView(won?'summary':'result');saved.remove('actual');shell.dataset.screen='end';
    const place=duel.places?.[duel.you];
    const why=three()?(me().left?'Has abandonado el duelo.':duel.reason==='abandono'?(won?'Los demás han abandonado el duelo.':'Ha terminado: los demás han abandonado.'):duel.reason==='rondas'?(draw?'Diez rondas y la misma vida arriba: empatáis.':won?'Diez rondas: ganas con más vida.':'Diez rondas: gana quien conserva más vida.'):won?'Eres el último en pie.':me().hp<=0?'Te has quedado sin vida.':'Otro jugador ha ganado la partida.')
      :duel.reason==='abandono'?(won?`${name} ha abandonado el duelo.`:'Has abandonado el duelo.'):duel.reason==='rondas'?(draw?'Diez rondas y la misma vida. Nadie cede.':`Diez rondas: gana quien conserva más vida.`):won?`Has dejado a ${name} sin vida.`:`${name} te ha dejado sin vida.`;
    content.innerHTML=`<p class="duel-kicker">Duelo terminado</p>
<div class="duel-final">${figure(me(),'end',reactionOptions(me(),won?'victory':draw?'draw':'defeat'))}<h2 id="duel-title">${won?'¡Victoria!':draw?'Empate':three()?`${place}.º puesto`:'Derrota'}</h2></div>
<p class="duel-note">${why}</p>
${three()?`<ol class="duel-podium">${duel.players.map((player,seat)=>({player,seat})).sort((a,b)=>duel.places[a.seat]-duel.places[b.seat]||a.seat-b.seat).map(one=>`<li class="${one.seat===duel.you?'is-you':''}"><b>${duel.places[one.seat]}.º</b><span>${one.seat===duel.you?'Tú':escapeHtml(one.player.name)}</span><small>${one.player.left?'abandonó':int(one.player.hp)+' de vida'}</small></li>`).join('')}</ol>`:''}
${window.Ranked?Ranked.result(duel):''}
<div class="duel-reward"><div class="duel-xp"><span><b>Nivel ${progress.level}${result?.levelUp?' <em>¡Subes de nivel!</em>':''}</b><small>${result?`+${result.gained} XP · +${result.coins+result.levelCoins} ≈`:`${int(progress.done)} / ${int(progress.need)} XP`}</small></span><div class="duel-xpbar"><i style="--xp:${result&&!result.levelUp?result.fromRatio:0}" data-xp="${progress.ratio}"></i></div></div>
${result?`<ul class="duel-chips">${result.parts.map(([label,xp])=>`<li>${escapeHtml(label)} <b>+${xp}</b></li>`).join('')}${stats.streak>1?`<li class="hot">🔥 ${stats.streak} seguidas</li>`:''}${result.notes.map(note=>`<li>${escapeHtml(note)}</li>`).join('')}</ul>`:''}</div>
${window.Bets?Bets.result(duel):''}
${duel.rounds?.length&&three()?`<ol class="duel-rounds is-three">${duel.rounds.map((r,i)=>`<li><span>R${i+1}</span>${[duel.you,...others().map(one=>one.seat)].map(seat=>`<b class="${r.best?.includes(seat)?'up':''}">${int(r.points[seat])}</b>`).join('<i>·</i>')}<em class="${r.damages[duel.you]?'you':'even'}">${r.damages[duel.you]?'−'+int(r.damages[duel.you]):'='}</em></li>`).join('')}</ol>`:duel.rounds?.length?`<ol class="duel-rounds">${duel.rounds.map((r,i)=>`<li><span>R${i+1}</span><b class="${r.loser==='rival'?'up':''}">${int(r.points[duel.you])}</b><i>–</i><b class="${r.loser==='you'?'up':''}">${int(r.points[1-duel.you])}</b><em class="${r.loser||'even'}">${r.loser===null?'=':r.loser==='rival'?'+'+int(r.damage):'−'+int(r.damage)}</em></li>`).join('')}</ol>`:''}
${reviewMarkup()}
${window.Bets&&!rival().bot?Bets.picker({compact:true}):''}
<p class="form-error" id="duel-error" role="alert"></p>
<div class="duel-modes"><button class="game-primary" type="button" data-duel="rematch" id="duel-rematch">Revancha <span aria-hidden="true">→</span></button><button class="game-secondary" type="button" data-duel="again">Nuevo rival</button></div>
<button class="duel-link" type="button" data-duel="share-result">Compartir resultado</button>
<div data-duel-plan></div>`;
    requestAnimationFrame(()=>requestAnimationFrame(()=>{const bar=content.querySelector('[data-xp]');if(bar)bar.style.setProperty('--xp',bar.dataset.xp)}));
    (won?sfx.win:draw?sfx.even:sfx.lose)();if(result?.levelUp)sfx.level();
    window.Ranked?.animate();updateRematch();refreshQuota();
  }
  function updateRematch(){
    const button=$('#duel-rematch');if(!button||!duel?.next||button.dataset.offer)return;
    button.dataset.offer='1';button.innerHTML=`Aceptar revancha <span aria-hidden="true">→</span>`;button.classList.add('is-offer');
    alertBar(`${avatar(rival(),'tiny')}<span>${three()?'Hay una revancha esperando':`<b>${escapeHtml(rival().name)}</b> quiere la revancha`}</span>`,6000);sfx.rival();
  }

  // Estado que llega del servidor: se repinta al cambiar de fase y, dentro de la misma fase, solo se actualiza lo que cambia.
  function apply(view){
    const previous=duel;offset=view.now-Date.now();duel=view;window.Bets?.track(view);
    if(view.status!=='finished')saved.set('actual',view.id);
    const key=`${view.id}:${view.phase}:${view.round?.number||0}`;
    if(key!==shown){
      quotaRequest++;
      shown=key;clearTimeout(endTimer);
      if(view.phase!=='intro')hideVersus();
      if(view.phase==='waiting')renderWaiting();
      else if(view.phase==='intro')renderIntro();
      else if(view.phase==='question')renderQuestion();
      else if(view.phase==='reveal')renderReveal(false);
      else if(view.round&&view.round.resolvedAt&&revealed!==view.id+':'+view.round.number&&view.reason!=='abandono'){renderReveal(true);endTimer=setTimeout(()=>{if(duel?.id===view.id)renderEnd()},reduced()?2500:5200)}
      else renderEnd();
    }else if(view.phase==='question'){
      const before=previous?.round,round=view.round;
      const fresh=before?view.players.flatMap((player,seat)=>seat!==view.you&&!before.answered[seat]&&round.answered[seat]?[player]:[]):[];
      if(fresh.length){
        // Un rival ha respondido: campana (o aviso corto si tú ya habías respondido) y el reloj baja a 30 segundos.
        if(before.answered[view.you])sfx.rival();
        if(round.yourGuess==null)alertBar(`<span class="duel-bell" aria-hidden="true">🔔</span>${avatar(fresh[0],'tiny')}<span>${joinNames(fresh.map(player=>player.name))} ${fresh.length>1?'han respondido':'ha respondido'} · te quedan <b>${Math.max(1,Math.ceil((round.deadline-serverNow())/1000))} s</b></span>`,5000);
      }
      // La primera respuesta de la ronda, sea de quien sea, toca la campana: empieza la cuenta atrás.
      if(before&&!before.answered.some(Boolean)&&round.answered.some(Boolean))sfx.bell();
      if(before&&before.yourGuess==null&&round.yourGuess!=null)renderAnswerBox(false);
      setRoundInfo();updateRivalState();
    }else if(view.phase==='finished'){updateRematch();window.Ranked?.update(view)}
    window.DuelChat?.update(view);
    startTimers();
  }
  function tick(){
    if(!duel||shell.hidden)return;
    const now=serverNow(),round=duel.round;
    if(duel.phase==='question')startMusic(round.rushed?'rush':'calm');else stopMusic();
    shell.dataset.rush=duel.phase==='question'&&round.rushed?'1':'';
    if(duel.phase==='waiting'&&duel.public&&!three()){const offer=$('#duel-bot-offer');if(offer?.hidden&&now-(tick.waitFrom||(tick.waitFrom=now))>9000){offer.hidden=false;$('#duel-wait-note').textContent='Ahora mismo no hay nadie buscando duelo. Puedes seguir esperando o practicar con el bot.'}}
    else tick.waitFrom=0;
    if(duel.phase==='intro'){const element=$('#duel-countdown'),left=Math.max(1,Math.ceil((round.startsAt-now)/1000));if(element&&element.textContent!==String(left)){element.textContent=left;element.classList.remove('pop');void element.offsetWidth;element.classList.add('pop');sfx.tick()}}
    if(duel.phase==='question'){
      const left=Math.max(0,round.deadline-now),seconds=Math.ceil(left/1000),rush=round.rushed,total=rush?30000:180000,time=$('#duel-time'),timer=$('#duel-timer');
      if(time){
        time.textContent=`${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;
        $('#duel-timebar').style.setProperty('--t',Math.min(1,left/total));
        const mine=round.yourGuess==null;timer.classList.toggle('is-rush',rush&&mine);timer.classList.toggle('is-last',seconds<=10&&mine);content.classList.toggle('is-rush',rush&&mine);
        if(seconds!==lastSecond){lastSecond=seconds;if(mine&&seconds<=10&&seconds>0)sfx.tick()}
      }
    }
    if(duel.phase==='reveal'){const element=$('#duel-countdown');if(element)element.textContent=`Siguiente en ${Math.max(0,Math.ceil((round.nextAt-now)/1000))} s`}
  }
  async function poll(){
    clearTimeout(pollTimer);if(!duel||shell.hidden)return;
    const id=duel.id,response=await call('estado',{id});
    if(!duel||duel.id!==id||shell.hidden)return;
    if(response.ok)apply(response.data);else if(response.status===404||response.status===403){renderLobby('Ese duelo ya no existe.');return}
    schedule();
  }
  function schedule(){
    clearTimeout(pollTimer);if(!duel||shell.hidden)return;
    // Terminado: se sigue mirando un rato por si el rival pide la revancha.
    // Tras escribir en el chat con el duelo terminado se mira un par de veces más, por si el rival (o el bot) contesta.
    if(duel.phase==='finished'){if(chatWake>0)chatWake--;else if(duel.next||rival()?.bot||++finishedPolls>60)return;pollTimer=setTimeout(poll,chatWake?1500:3000);return}
    finishedPolls=0;pollTimer=setTimeout(poll,duel.phase==='waiting'?1500:1000);
  }
  function startTimers(){if(!ticker)ticker=setInterval(tick,200);tick();schedule()}
  function stopTimers(){clearTimeout(pollTimer);clearTimeout(endTimer);clearInterval(ticker);ticker=0;stopMusic();shell.dataset.rush=''}

  // Acciones
  function readProfile(){const input=$('#duel-name');if(input){profile.name=input.value.replace(/\s+/g,' ').trim().slice(0,16)||profile.name}saved.set('perfil',profile)}
  async function begin(action,extra={}){
    if(busy)return;busy=true;readProfile();shell.classList.add('is-busy');
    const origin=content.firstElementChild;
    const mode=extra.size===3?'duel3':action==='bot'?'practice':duel?offerMode():extra.mode==='ranked'?'ranked':'duel';
    lastOfferMode=mode;
    const response=await call(action,{...identity(),...extra});busy=false;shell.classList.remove('is-busy');
    if(shell.hidden||!origin?.isConnected)return;
    if(response.ok){inviteCode='';revealed='';shown='';tick.waitFrom=0;apply(response.data)}
    else{
      const error=$('#duel-error');if(error)error.textContent=response.data.error||'No se ha podido empezar el duelo.';else showToast(response.data.error||'No se ha podido empezar el duelo.');
      if(response.data.code==='limite'){quotaRequest++;quotaState=response.data;paintQuota(quotaState,mode,true)}
    }
  }
  async function submit(event){
    event.preventDefault();if(busy||!duel||duel.phase!=='question')return;
    const raw=$('#duel-guess').value.trim().replace(/[.\s]/g,'').replace(',','.'),guess=Number(raw);
    if(!/^\d+(\.\d+)?$/.test(raw)||!Number.isFinite(guess)||guess<=0){$('#duel-help').textContent='Escribe un número mayor que cero. Usa coma para los decimales.';return}
    busy=true;const response=await call('responder',{id:duel.id,guess});busy=false;
    if(response.ok){sfx.send();const first=!response.data.round?.answered.some((done,seat)=>done&&seat!==response.data.you)&&response.data.phase==='question';apply(response.data);if(first)alertBar(`<span class="duel-bell" aria-hidden="true">🔔</span><span>Has respondido primero · ${three()?'a los demás les quedan':`a <b>${escapeHtml(rival().name)}</b> le quedan`} <b>30 s</b></span>`,3500)}
    else if($('#duel-help'))$('#duel-help').textContent=response.data.error||'No se ha podido enviar. Inténtalo otra vez.';
  }
  // Chat de la partida (duel-chat.js, decisión 0040): el envío pasa por aquí para pintar al momento el estado que devuelve.
  async function chatSend(kind,value){
    if(!duel)return {ok:false,data:{}};
    const id=duel.id,response=await call('chat',{id,kind,value});
    if(response.ok&&duel?.id===id){if(duel.phase==='finished')chatWake=3;apply(response.data)}
    return response;
  }
  window.DuelChat?.connect({send:chatSend,rival:()=>duel?.players?.[1]?rival():null,speaker:message=>three()?duel.players[message.seat]:null,refresh:()=>{if(duel)DuelChat.render(duel)}});
  async function share(text,url){
    if(window.Circuito)url=Circuito.link(url); // con tu código del Circuito de amigos (?de=)
    try{if(navigator.share){await navigator.share({title:'Duelo en Faraday.gg',text,url});return}await navigator.clipboard.writeText(`${text}\n${url}`);showToast('Copiado al portapapeles.')}
    catch(error){if(error?.name!=='AbortError')showToast('No se pudo compartir ahora mismo.')}
  }
  // Calculadora y notas: el mismo bloc del reto diario, que se coloca al lado del duelo mientras está abierto.
  // Cada ronda tiene su propio bloc (duelo:id:ronda), así una pregunta no hereda el historial de la anterior.
  const panel=$('#workspace-panel'),duelLayout=$('#duel-layout');
  const calcIcon='<svg aria-hidden="true" viewBox="0 0 32 36" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="1.5" width="25" height="33" rx="3.5"/><rect x="8" y="6" width="16" height="7" rx="1"/><path d="M9 19h3m6 0h3M9 24h3m6 0h3M9 29h3m6 0h3"/></svg>';
  function toggleCalc(open=panel.hidden){
    panel.hidden=!open;
    const button=content.querySelector('[data-duel=calc]');
    if(button){button.setAttribute('aria-expanded',String(open));button.setAttribute('aria-label',`${open?'Cerrar':'Abrir'} calculadora y notas`)}
    if(open)$('#scratch-expression').focus();else $('#guess-input')?.focus();
  }
  function attachWorkspace(){
    duelLayout.append(panel);panel.hidden=true;switchWorkspace('duelo:');
  }
  function detachWorkspace(){
    panel.hidden=true;$('#game-layout').append(panel);switchWorkspace();
  }
  // resume: id de un duelo al que se vuelve desde «Reconectar a la partida» (decisión 0042); también se puede ver uno ya terminado.
  async function open(code='',resume=''){
    attachWorkspace();
    inviteCode=/^[A-Za-z2-9]{6}$/.test(code)?code.toUpperCase():'';
    // renderLobby() borra «actual», así que se lee antes de pintarlo.
    let current=resume||saved.get('actual',null);
    shell.hidden=false;document.body.classList.add('modal-open');$('#duel-sound').setAttribute('aria-pressed',String(Sound.on));
    if(typeof toggleMenu==='function')toggleMenu(false);
    renderLobby();
    // Si se recarga la página (o se vuelve más tarde) en mitad de un duelo, se vuelve a él. Si el navegador no lo recuerda, se le pregunta al servidor.
    if(!current&&!inviteCode){const found=await call('activo');if(found.ok&&found.data.active&&found.data.active.status!=='finished')current=found.data.active.id}
    if(current&&!inviteCode){const response=await call('estado',{id:current});if(response.ok&&(response.data.status!=='finished'||resume)&&!shell.hidden&&!duel)apply(response.data);else if(!response.ok||response.data.status==='finished')saved.remove('actual')}
    $('#duel-close').focus();
  }
  async function close(){
    quotaRequest++;
    if(duel&&['intro','question','reveal'].includes(duel.phase)){
      if(!(three()&&me().hp<=0)&&!window.confirm(three()?'¿Abandonar el duelo? Quedarás eliminado y los otros dos seguirán jugando.':'¿Abandonar el duelo? Tu rival ganará la partida.'))return;
      const response=await call('salir',{id:duel.id});if(response.ok){duel=response.data;window.Bets?.track(duel);finishStats()}
    }else if(duel?.phase==='waiting')call('salir',{id:duel.id});
    stopTimers();hideVersus(true);duel=null;shown='';hud.hidden=true;shell.hidden=true;saved.remove('actual');detachWorkspace();window.DuelChat?.reset();
    if($('#game-shell').hidden)document.body.classList.remove('modal-open');
  }

  shell.addEventListener('click',event=>{
    Sound.resume();
    const action=event.target.closest('[data-duel]')?.dataset.duel;if(!action)return;
    sfx.tap();
    if(action==='calc'){toggleCalc();return}
    if(action==='quick')begin('buscar',{mode:window.Ranked?.mode()||'normal'});
    if(action==='friend')begin('crear');
    if(action==='accept')begin('unirse',{code:inviteCode});
    if(action==='bot')begin('bot',{id:duel.id});
    if(action==='rematch')begin('revancha',{id:duel.id});
    if(action==='quick3')begin('buscar',{size:3});
    if(action==='friend3')begin('crear',{size:3});
    if(action==='again'){const again3=duel?.size===3;renderLobby();begin('buscar',again3?{size:3}:{mode:window.Ranked?.mode()||'normal'})}
    if(action==='cancel'){call('salir',{id:duel.id});renderLobby()}
    if(action==='share')share(`Te reto a un duelo en Faraday.gg. Código: ${duel.code}`,event.target.closest('[data-link]').dataset.link);
    // Con la tarjeta para stories cargada, el resultado se comparte como imagen con el avatar (decisión 0081).
    if(action==='share-result'&&window.ShareCard?.openDuel){
      const rounds=duel.rounds||[],rank=duel.mode==='ranked'&&duel.rankResult?.rank&&!duel.rankResult.rank.placing?duel.rankResult.rank:null;
      ShareCard.openDuel({result:duel.winner==='you'?'win':duel.winner==='draw'?'draw':'loss',name:me().name,rival:three()?others().map(one=>one.player.name).join(' y '):rival().name,won:three()?rounds.filter(r=>r.best?.includes(duel.you)).length:rounds.filter(r=>r.loser==='rival').length,lost:three()?rounds.filter(r=>r.damages?.[duel.you]>0).length:rounds.filter(r=>r.loser==='you').length,
        level:Progress.level(),ranked:duel.mode==='ranked',rank:rank?.label||'',rankColor:rank?.color||'',medal:window.Medals?Medals.label(Progress.badge()):''},event.target.closest('[data-duel]'));
    }else if(action==='share-result')share(`${duel.winner==='you'?'He ganado':duel.winner==='draw'?'He empatado':'He perdido'} un duelo en Faraday.gg contra ${three()?others().map(one=>one.player.name).join(' y '):rival().name} (${three()?duel.players.map(player=>int(player.hp)).join(' – '):int(me().hp)+' – '+int(rival().hp)} de vida). ¿Te atreves?`,location.origin+location.pathname);
  });
  content.addEventListener('submit',event=>{
    if(event.target.id==='duel-form')submit(event);
    if(event.target.id==='duel-join'){event.preventDefault();begin('unirse',{code:$('#duel-code').value})}
  });
  content.addEventListener('input',event=>{if(event.target.id==='duel-guess'&&!event.isComposing)formatEstimateInput(event.target);if(event.target.id==='duel-code')event.target.value=event.target.value.toUpperCase().replace(/[^A-Z0-9]/g,'')});
  content.addEventListener('change',event=>{if(event.target.id==='duel-name')readProfile()});
  $('#duel-close').addEventListener('click',close);
  // Al volver del armario, el portal del duelo enseña el avatar nuevo.
  document.addEventListener('faraday:look',()=>{if(!shell.hidden&&shown==='lobby'){readProfile();renderLobby()}});
  $('#workspace-close').addEventListener('click',()=>{if(!shell.hidden)toggleCalc(false)});
  // El botón de sonido es el control de volumen de sound.js; aquí solo se para la música al silenciar.
  document.addEventListener('faraday:sonido',event=>{if(!event.detail.on)stopMusic()});
  document.addEventListener('faraday:before-plan',event=>{
    // Las ofertas solo viven en el portal y en el resumen: nunca abandonan una ronda en marcha.
    if(shell.hidden)return;
    if(busy)event.preventDefault();
    else if(!duel||duel.phase==='finished')close();
    else event.preventDefault();
  });
  document.addEventListener('click',event=>{
    if(event.target.closest('[data-ranked-mode]')&&shown==='lobby'&&!shell.hidden){
      lastOfferMode=window.Ranked?.mode()==='ranked'?'ranked':'duel';paintQuota(quotaState);
    }
  });
  for(const name of ['faraday:plan','faraday:cuenta'])document.addEventListener(name,()=>{
    if(!shell.hidden&&(shown==='lobby'||shell.dataset.screen==='end'))refreshQuota();
  });
  document.querySelectorAll('[data-open-duel]').forEach(button=>button.addEventListener('click',()=>open()));
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!shell.hidden){event.stopImmediatePropagation();if(window.DuelChat?.isOpen())DuelChat.close();else if(!panel.hidden)toggleCalc(false);else close()}},true);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&duel&&!shell.hidden)poll()});
  // Enlace de invitación: ?duelo=CÓDIGO abre el duelo directamente.
  window.DueloReconectar={open:id=>open('',id)};
  const invited=new URLSearchParams(location.search).get('duelo');
  if(invited){history.replaceState(history.state,'',location.pathname);open(invited)}
})();

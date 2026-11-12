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

  let duel=null,offset=0,shown='',pollTimer=0,ticker=0,endTimer=0,lastSecond=-1,inviteCode='',revealed='',finishedPolls=0,busy=false;
  const serverNow=()=>Date.now()+offset;
  const me=()=>duel.players[duel.you],rival=()=>duel.players[1-duel.you];

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
  const identity=()=>({name:profile.name,avatar:{...Progress.look(),badge:Progress.badge()},level:Progress.level()});
  const badge=player=>player.bot?'':Medals.chip(player.avatar?.badge);
  // El bot tiene su propio aspecto de robot (piel de metal, cascos y gafas oscuras) y siempre se llama Faraday-bot.
  const BOT_LOOK={_raw:{skin:'robot',face:'serio',hair:'calvo',hairColor:'gris',top:'plumas',topColor:'gris',trimColor:'negro',print:'',bottom:'cargo',bottomColor:'gris',shoes:'plataforma',shoesColor:'negro',hat:'',extras:['cascos','sol']}};
  const lookOf=player=>player.bot?BOT_LOOK:player.avatar;
  const avatar=(player,extra='')=>`<span class="duel-avatar ${extra}" aria-hidden="true">${Avatar.render(lookOf(player),{bust:true})}</span>`;
  // Cuerpo entero y animado para las pantallas grandes (portal, presentación, resultado de la ronda y final).
  const figure=(player,extra='',options={})=>`<span class="duel-figure ${extra}" aria-hidden="true">${Avatar.render(lookOf(player),{live:true,...options})}</span>`;
  const setView=(view,tone='')=>{shell.dataset.view=view;shell.dataset.tone=tone;shell.dataset.screen=duel?.phase||'lobby'};
  function alertBar(html,ms=4200){const bar=$('#duel-alert');bar.innerHTML=html;bar.classList.add('show');clearTimeout(alertBar.timer);alertBar.timer=setTimeout(()=>bar.classList.remove('show'),ms)}

  // Marcador: avatar, nombre, nivel y barra de vida de cada jugador. La vida perdida se queda un momento
  // marcada en la barra antes de desaparecer, y la cifra del golpe sube flotando.
  function renderHud(){
    const side=(player,who)=>`<div class="duel-player" data-side="${who}">${avatar(player)}<div class="duel-who"><span class="duel-name">${escapeHtml(player.name)}</span>${badge(player)}<span class="duel-level">${player.bot?'Bot':'Nv. '+player.level}</span><span class="duel-check" data-check="${who}" hidden>✓</span></div><div class="hp" role="img" data-hp="${who}"><i class="hp-ghost"></i><i class="hp-fill"></i></div><span class="hp-num" data-hp-num="${who}"></span></div>`;
    hud.innerHTML=side(me(),'you')+`<div class="duel-mid"><span id="duel-round"></span><b id="duel-mult"></b></div>`+side(rival(),'rival');
    hud.hidden=false;hud.dataset.duel=duel.id;setHp(false);
  }
  function setHp(animate=true){
    for(const [who,player] of [['you',me()],['rival',rival()]]){
      const bar=hud.querySelector(`[data-hp="${who}"]`),number=hud.querySelector(`[data-hp-num="${who}"]`);if(!bar)continue;
      const ratio=player.hp/duel.maxHp,previous=Number(bar.dataset.value??player.hp);
      bar.style.setProperty('--hp',ratio);bar.dataset.level=ratio>.5?'high':ratio>.25?'mid':'low';bar.dataset.value=player.hp;
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
    $('#duel-round').textContent=`Ronda ${round.number}`;$('#duel-mult').textContent=`Daño ${times(round.multiplier)}`;
    for(const [who,index] of [['you',duel.you],['rival',1-duel.you]]){const check=hud.querySelector(`[data-check="${who}"]`);if(check)check.hidden=!(duel.phase==='question'&&round.answered[index])}
  }

  // Pantallas
  function renderLobby(message=''){
    duel=null;shown='lobby';hud.hidden=true;setView('result');stopTimers();saved.remove('actual');
    const progress=Progress.info();
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
<p class="form-error" id="duel-error" role="alert">${escapeHtml(message)}</p>
<div class="duel-modes"><button class="game-primary" type="button" data-duel="quick">Partida rápida <span aria-hidden="true">→</span></button><button class="game-secondary" type="button" data-duel="friend">Retar a un amigo</button></div>
<details class="duel-join-box"${message?' open':''}><summary>¿Tienes un código de duelo?</summary><form class="duel-join" id="duel-join"><label class="sr-only" for="duel-code">Código de duelo</label><input id="duel-code" type="text" maxlength="6" autocomplete="off" autocapitalize="characters" placeholder="ABC123"><button class="game-secondary" type="submit">Unirme</button></form></details>
<p class="duel-rules">${int(6000)} de vida · 3 min por pregunta · 30 s cuando responde tu rival</p>`;
  }
  function renderWaiting(){
    hud.hidden=true;setView('result');
    const friend=!duel.public,link=`${location.origin}${location.pathname}?duelo=${duel.code}`;
    content.innerHTML=`<p class="duel-kicker">${friend?'Duelo con un amigo':'Partida rápida'}</p>
<div class="duel-search">${figure(me(),'mid')}<span class="duel-dots" aria-hidden="true"><i></i><i></i><i></i></span><span class="duel-avatar big ghost" aria-hidden="true">?</span></div>
<h2 id="duel-title">${friend?'Comparte el código':'Buscando rival…'}</h2>
${friend?`<p class="duel-code" aria-label="Código del duelo">${duel.code}</p><p class="duel-note">El duelo empieza en cuanto tu amigo abra el enlace o escriba el código.</p><div class="duel-modes"><button class="game-primary" type="button" data-duel="share" data-link="${link}">Copiar enlace</button><button class="game-secondary" type="button" data-duel="bot">Practicar con el bot</button></div>`
:`<p class="duel-note" id="duel-wait-note">Emparejando con la primera persona que entre.</p><div class="duel-modes" id="duel-bot-offer" hidden><button class="game-primary" type="button" data-duel="bot">Jugar contra Faraday-bot</button></div>`}
<button class="duel-link" type="button" data-duel="cancel">Cancelar</button>`;
  }
  function renderIntro(){
    renderHud();hud.hidden=true;setView('question','coral');
    content.innerHTML=`<span class="duel-flash" aria-hidden="true"></span><p class="duel-kicker">Rival encontrado</p><div class="duel-vs"><div>${figure(me())}<strong>${escapeHtml(me().name)}${badge(me())}</strong><small>Nv. ${me().level}</small></div><span class="duel-vs-mark">VS</span><div>${figure(rival())}<strong>${escapeHtml(rival().name)}${badge(rival())}</strong><small>${rival().bot?'Bot de práctica':'Nv. '+rival().level}</small></div></div>
<h2 id="duel-title" class="duel-count" aria-live="polite"><span id="duel-countdown">3</span></h2><p class="duel-note">${int(duel.maxHp)} de vida cada uno. El daño empieza flojo y sube en cada ronda.</p>`;
    sfx.tension();
  }
  function renderQuestion(){
    if(hud.dataset.duel!==duel.id||hud.hidden)renderHud();
    const round=duel.round,q=round.question;setView('question',window.CATEGORIES?.[q.category]?.tone||'coral');setHp(false);setRoundInfo();
    content.innerHTML=`<div class="duel-top"><span class="duel-kicker">Ronda ${round.number} · daño ${times(round.multiplier)}</span><div class="duel-tools"><button class="workspace-launch" type="button" data-duel="calc" aria-label="${panel.hidden?'Abrir':'Cerrar'} calculadora y notas" aria-expanded="${!panel.hidden}" title="Calculadora y notas">${calcIcon}</button><div class="duel-timer" id="duel-timer" role="timer" aria-label="Tiempo restante"><svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2M9.5 2.5h5"/></svg><b id="duel-time">3:00</b></div></div></div>
<div class="duel-timebar" aria-hidden="true"><i id="duel-timebar"></i></div>
<h2 id="duel-title">${q.title}</h2>${q.image?questionMedia(q):''}
<div id="duel-answer"></div>`;
    lastSecond=-1;renderAnswerBox(true);sfx.go();
    if(round.answered[1-duel.you]&&round.yourGuess==null)alertBar(`${avatar(rival(),'tiny')}<span><b>${escapeHtml(rival().name)}</b> ya ha respondido</span>`);
  }
  function renderAnswerBox(focus){
    const round=duel.round,box=$('#duel-answer');if(!box)return;
    if(round.yourGuess!=null){
      box.innerHTML=`<div class="duel-sent"><small>Tu respuesta</small><strong>${whole(round.yourGuess)}</strong><span>${round.question.unit}</span></div><p class="duel-rival-state" id="duel-rival-state"></p>`;
    }else if(!$('#duel-form')){
      box.innerHTML=`<form id="duel-form"><label class="sr-only" for="duel-guess">Tu estimación, en ${round.question.unit}</label><div class="guess-row"><input id="duel-guess" type="text" inputmode="decimal" autocomplete="off" placeholder="Tu estimación" aria-describedby="duel-help" required><span class="guess-unit">${round.question.unit}</span></div><div class="form-error" id="duel-help" role="alert"></div><div class="game-actions"><p class="duel-rival-state" id="duel-rival-state"></p><button class="game-primary" type="submit">Confirmar <span aria-hidden="true">→</span></button></div></form>`;
      if(focus)$('#duel-guess').focus();
    }
    updateRivalState();
  }
  function updateRivalState(){
    const element=$('#duel-rival-state');if(!element||!duel.round)return;
    const answered=duel.round.answered[1-duel.you],name=escapeHtml(rival().name);
    element.innerHTML=`${avatar(rival(),'tiny')}<span>${answered?`<b>${name}</b> ya ha respondido`:duel.round.yourGuess!=null?`Esperando a <b>${name}</b>…`:`<b>${name}</b> está pensando…`}</span>`;
    element.classList.toggle('done',answered);
  }
  function renderReveal(final){
    if(hud.dataset.duel!==duel.id||hud.hidden)renderHud();
    const round=duel.round,q=round.question,mine=round.guesses[duel.you],theirs=round.guesses[1-duel.you],myPoints=round.points[duel.you],theirPoints=round.points[1-duel.you];
    setView('result');setRoundInfo();revealed=duel.id+':'+round.number;
    const column=(player,guess,pointsWon,who)=>`<div class="duel-col${round.loser&&round.loser!==who?' is-best':''}">${figure(player,'col',{emote:round.loser===who?'hurt':round.loser?'cheer':''})}<span class="duel-col-name">${who==='you'?'Tú':escapeHtml(player.name)}</span><strong class="duel-col-guess">${guess==null?'Sin respuesta':whole(guess)}</strong><span class="duel-col-x">${guess==null?'—':times(Math.max(guess/round.answer,round.answer/guess))}</span>${guess!=null&&window.CasiCasi?.is(Math.max(guess/round.answer,round.answer/guess))?'<em class="duel-casi">¡Casi casi!</em>':''}<b class="duel-col-points" data-points="${pointsWon}">0</b><small>puntos</small></div>`;
    const outcome=round.loser===null?'Empate en esta ronda: nadie pierde vida.':round.loser==='rival'?`Le quitas <b>${int(round.damage)}</b> de vida a ${escapeHtml(rival().name)}.`:`Pierdes <b>${int(round.damage)}</b> de vida.`;
    content.innerHTML=`<div class="duel-top"><span class="duel-kicker">Resultado · ronda ${round.number}</span><span class="duel-kicker" id="duel-countdown"></span></div>
<h2 id="duel-title" class="duel-q-small">${q.title}</h2>
<div class="duel-real"><small>Real</small><strong>≈ ${rounded(round.answer)}</strong><span>${q.unit}</span>${round.source?`<a href="${round.source.url}" target="_blank" rel="noopener">Fuente: ${escapeHtml(round.source.title.length>60?round.source.title.slice(0,58)+'…':round.source.title)}</a>`:''}</div>
<div class="duel-cols">${column(me(),mine,myPoints,'you')}${column(rival(),theirs,theirPoints,'rival')}</div>
<p class="duel-outcome is-${round.loser||'even'}">${outcome}${round.loser?` <small>Daño ${times(round.multiplier)}</small>`:''}</p>
${final?'':`<p class="duel-note">${round.nextMultiplier>round.multiplier?`Atención: en la siguiente ronda el daño sube a ${times(round.nextMultiplier)}.`:'Prepárate para la siguiente pregunta.'}</p>`}`;
    content.querySelectorAll('[data-points]').forEach(element=>count(element,0,Number(element.dataset.points),1000));
    // La barra de vida baja un instante después de ver los puntos, con su golpe.
    setTimeout(()=>{if(!duel||revealed!==duel.id+':'+round.number)return;setHp(true);(round.loser==='you'?sfx.hit:round.loser==='rival'?sfx.good:sfx.even)()},reduced()?0:1100);
  }
  function finishStats(){
    const counted=saved.get('contados',[]);if(counted.includes(duel.id)||duel.reason==='cancelado'||duel.players.length<2)return null;
    saved.set('contados',[...counted,duel.id].slice(-30));
    const today=new Date().toLocaleDateString('en-CA'),rounds=duel.rounds?.length||0,parts=[];
    if(duel.winner==='you'){
      stats.wins++;stats.streak++;stats.best=Math.max(stats.best,stats.streak);parts.push(['Victoria',100]);
      if(stats.lastWin!==today){parts.push(['Primera victoria del día',50]);stats.lastWin=today}
      if(stats.streak>1)parts.push([`Racha de ${stats.streak}`,Math.min(50,(stats.streak-1)*10)]);
    }else if(duel.winner==='draw'){stats.draws++;parts.push(['Empate',60])}
    else{stats.losses++;stats.streak=0;if(duel.reason!=='abandono')parts.push(['Duelo completado',40])}
    if(rounds&&!(duel.winner==='rival'&&duel.reason==='abandono'))parts.push([`${rounds} ${rounds===1?'ronda':'rondas'}`,rounds*10]);
    // Tope diario: los tres primeros duelos del día premian entero y los siguientes al 25 %. Contra el bot,
    // la mitad de experiencia y faradios solo en el primero del día: practicar no debe rendir más que el reto diario.
    const bot=!!rival()?.bot,daily=stats.day?.date===today?stats.day:{date:today,count:0,bot:0};
    const capped=daily.count>=DAILY_FULL,factor=(capped?CAPPED_FACTOR:1)*(bot?BOT_FACTOR:1);
    const notes=[];if(bot)notes.push(daily.bot?'Práctica con el bot: mitad de XP, sin faradios':'Práctica con el bot: mitad de XP');
    if(capped)notes.push(`Tope diario: premio al ${Math.round(CAPPED_FACTOR*100)} %`);
    const fromRatio=Progress.info().ratio,abandoned=duel.winner==='rival'&&duel.reason==='abandono';
    const gained=Math.round(parts.reduce((sum,[,xp])=>sum+xp,0)*factor);
    const key=duel.winner==='you'?'win':duel.winner==='draw'?'draw':'loss';
    const coins=abandoned||(bot&&daily.bot)?0:Math.round(Progress.REWARD.duel[key]*(capped?CAPPED_FACTOR:1));
    if(!abandoned)stats.day={date:today,count:daily.count+1,bot:daily.bot+(bot?1:0)};
    saved.set('progreso',stats);const outcome=Progress.reward({xp:gained,coins});
    // charge: lo que este duelo carga la batería de cofres (progress.js); sigue el mismo tope que el premio.
    document.dispatchEvent(new CustomEvent('faraday:duel',{detail:{result:key,rounds,abandoned,bot,flawless:key==='win'&&me().hp>=duel.maxHp,charge:abandoned||(bot&&daily.bot)?0:capped?5:20}}));
    return {parts,notes,gained,coins,fromRatio,levelUp:outcome.levelUp,levelCoins:outcome.levelCoins};
  }
  function renderEnd(){
    clearTimeout(endTimer);
    if(duel.reason==='cancelado'||duel.players.length<2){renderLobby();return}
    if(hud.dataset.duel!==duel.id||hud.hidden)renderHud();setHp(false);
    const won=duel.winner==='you',draw=duel.winner==='draw',result=finishStats(),progress=Progress.info(),name=escapeHtml(rival().name);
    setView(won?'summary':'result');saved.remove('actual');shell.dataset.screen='end';
    const why=duel.reason==='abandono'?(won?`${name} ha abandonado el duelo.`:'Has abandonado el duelo.'):duel.reason==='rondas'?(draw?'Diez rondas y la misma vida. Nadie cede.':`Diez rondas: gana quien conserva más vida.`):won?`Has dejado a ${name} sin vida.`:`${name} te ha dejado sin vida.`;
    content.innerHTML=`<p class="duel-kicker">Duelo terminado</p>
<div class="duel-final">${figure(me(),'end',{emote:won?'cheer':draw?'':'sad'})}<h2 id="duel-title">${won?'¡Victoria!':draw?'Empate':'Derrota'}</h2></div>
<p class="duel-note">${why}</p>
<div class="duel-reward"><div class="duel-xp"><span><b>Nivel ${progress.level}${result?.levelUp?' <em>¡Subes de nivel!</em>':''}</b><small>${result?`+${result.gained} XP · +${result.coins+result.levelCoins} ≈`:`${int(progress.done)} / ${int(progress.need)} XP`}</small></span><div class="duel-xpbar"><i style="--xp:${result&&!result.levelUp?result.fromRatio:0}" data-xp="${progress.ratio}"></i></div></div>
${result?`<ul class="duel-chips">${result.parts.map(([label,xp])=>`<li>${escapeHtml(label)} <b>+${xp}</b></li>`).join('')}${stats.streak>1?`<li class="hot">🔥 ${stats.streak} seguidas</li>`:''}${result.notes.map(note=>`<li>${escapeHtml(note)}</li>`).join('')}</ul>`:''}</div>
${duel.rounds?.length?`<ol class="duel-rounds">${duel.rounds.map((r,i)=>`<li><span>R${i+1}</span><b class="${r.loser==='rival'?'up':''}">${int(r.points[duel.you])}</b><i>–</i><b class="${r.loser==='you'?'up':''}">${int(r.points[1-duel.you])}</b><em class="${r.loser||'even'}">${r.loser===null?'=':r.loser==='rival'?'+'+int(r.damage):'−'+int(r.damage)}</em></li>`).join('')}</ol>`:''}
<p class="form-error" id="duel-error" role="alert"></p>
<div class="duel-modes"><button class="game-primary" type="button" data-duel="rematch" id="duel-rematch">Revancha <span aria-hidden="true">→</span></button><button class="game-secondary" type="button" data-duel="again">Nuevo rival</button></div>
<button class="duel-link" type="button" data-duel="share-result">Compartir resultado</button>`;
    requestAnimationFrame(()=>requestAnimationFrame(()=>{const bar=content.querySelector('[data-xp]');if(bar)bar.style.setProperty('--xp',bar.dataset.xp)}));
    (won?sfx.win:draw?sfx.even:sfx.lose)();if(result?.levelUp)sfx.level();
    updateRematch();
  }
  function updateRematch(){
    const button=$('#duel-rematch');if(!button||!duel?.next||button.dataset.offer)return;
    button.dataset.offer='1';button.innerHTML=`Aceptar revancha <span aria-hidden="true">→</span>`;button.classList.add('is-offer');
    alertBar(`${avatar(rival(),'tiny')}<span><b>${escapeHtml(rival().name)}</b> quiere la revancha</span>`,6000);sfx.rival();
  }

  // Estado que llega del servidor: se repinta al cambiar de fase y, dentro de la misma fase, solo se actualiza lo que cambia.
  function apply(view){
    const previous=duel;offset=view.now-Date.now();duel=view;
    if(view.status!=='finished')saved.set('actual',view.id);
    const key=`${view.id}:${view.phase}:${view.round?.number||0}`;
    if(key!==shown){
      shown=key;clearTimeout(endTimer);
      if(view.phase==='waiting')renderWaiting();
      else if(view.phase==='intro')renderIntro();
      else if(view.phase==='question')renderQuestion();
      else if(view.phase==='reveal')renderReveal(false);
      else if(view.round&&view.round.resolvedAt&&revealed!==view.id+':'+view.round.number&&view.reason!=='abandono'){renderReveal(true);endTimer=setTimeout(()=>{if(duel?.id===view.id)renderEnd()},reduced()?2500:5200)}
      else renderEnd();
    }else if(view.phase==='question'){
      const before=previous?.round,round=view.round,theirs=1-view.you;
      if(before&&!before.answered[theirs]&&round.answered[theirs]){
        // El rival ha respondido: campana (o aviso corto si tú ya habías respondido) y el reloj baja a 30 segundos.
        if(before.answered[view.you])sfx.rival();
        if(round.yourGuess==null)alertBar(`<span class="duel-bell" aria-hidden="true">🔔</span>${avatar(rival(),'tiny')}<span><b>${escapeHtml(rival().name)}</b> ha respondido · te quedan <b>${Math.max(1,Math.ceil((round.deadline-serverNow())/1000))} s</b></span>`,5000);
      }
      // La primera respuesta de la ronda, sea de quien sea, toca la campana: empieza la cuenta atrás.
      if(before&&!before.answered.some(Boolean)&&round.answered.some(Boolean))sfx.bell();
      if(before&&before.yourGuess==null&&round.yourGuess!=null)renderAnswerBox(false);
      setRoundInfo();updateRivalState();
    }else if(view.phase==='finished')updateRematch();
    startTimers();
  }
  function tick(){
    if(!duel||shell.hidden)return;
    const now=serverNow(),round=duel.round;
    if(duel.phase==='question')startMusic(round.rushed?'rush':'calm');else stopMusic();
    shell.dataset.rush=duel.phase==='question'&&round.rushed?'1':'';
    if(duel.phase==='waiting'&&duel.public){const offer=$('#duel-bot-offer');if(offer?.hidden&&now-(tick.waitFrom||(tick.waitFrom=now))>9000){offer.hidden=false;$('#duel-wait-note').textContent='Ahora mismo no hay nadie buscando duelo. Puedes seguir esperando o practicar con el bot.'}}
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
    if(duel.phase==='finished'){if(duel.next||rival()?.bot||++finishedPolls>60)return;pollTimer=setTimeout(poll,3000);return}
    finishedPolls=0;pollTimer=setTimeout(poll,duel.phase==='waiting'?1500:1000);
  }
  function startTimers(){if(!ticker)ticker=setInterval(tick,200);tick();schedule()}
  function stopTimers(){clearTimeout(pollTimer);clearTimeout(endTimer);clearInterval(ticker);ticker=0;stopMusic();shell.dataset.rush=''}

  // Acciones
  function readProfile(){const input=$('#duel-name');if(input){profile.name=input.value.replace(/\s+/g,' ').trim().slice(0,16)||profile.name}saved.set('perfil',profile)}
  async function begin(action,extra={}){
    if(busy)return;busy=true;readProfile();shell.classList.add('is-busy');
    const response=await call(action,{...identity(),...extra});busy=false;shell.classList.remove('is-busy');
    if(response.ok){inviteCode='';revealed='';shown='';tick.waitFrom=0;apply(response.data)}
    else{const error=$('#duel-error');if(error)error.textContent=response.data.error||'No se ha podido empezar el duelo.';else showToast(response.data.error||'No se ha podido empezar el duelo.')}
  }
  async function submit(event){
    event.preventDefault();if(busy||!duel||duel.phase!=='question')return;
    const raw=$('#duel-guess').value.trim().replace(/[.\s]/g,'').replace(',','.'),guess=Number(raw);
    if(!/^\d+(\.\d+)?$/.test(raw)||!Number.isFinite(guess)||guess<=0){$('#duel-help').textContent='Escribe un número mayor que cero. Usa coma para los decimales.';return}
    busy=true;const response=await call('responder',{id:duel.id,guess});busy=false;
    if(response.ok){sfx.send();const first=!response.data.round?.answered[1-response.data.you]&&response.data.phase==='question';apply(response.data);if(first)alertBar(`<span class="duel-bell" aria-hidden="true">🔔</span><span>Has respondido primero · a <b>${escapeHtml(rival().name)}</b> le quedan <b>30 s</b></span>`,3500)}
    else if($('#duel-help'))$('#duel-help').textContent=response.data.error||'No se ha podido enviar. Inténtalo otra vez.';
  }
  async function share(text,url){
    if(window.Circuito)url=Circuito.link(url); // con tu código del Circuito de amigos (?de=)
    try{if(navigator.share){await navigator.share({title:'Duelo en Faraday.gg',text,url});return}await navigator.clipboard.writeText(`${text}\n${url}`);showToast('Copiado al portapapeles.')}
    catch(error){if(error?.name!=='AbortError')showToast('No se pudo compartir ahora mismo.')}
  }
  // Calculadora y notas: el mismo bloc del reto diario, que se coloca al lado del duelo mientras está abierto.
  const panel=$('#workspace-panel'),duelLayout=$('#duel-layout');
  const calcIcon='<svg aria-hidden="true" viewBox="0 0 32 36" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="1.5" width="25" height="33" rx="3.5"/><rect x="8" y="6" width="16" height="7" rx="1"/><path d="M9 19h3m6 0h3M9 24h3m6 0h3M9 29h3m6 0h3"/></svg>';
  function toggleCalc(open=panel.hidden){
    panel.hidden=!open;
    const button=content.querySelector('[data-duel=calc]');
    if(button){button.setAttribute('aria-expanded',String(open));button.setAttribute('aria-label',`${open?'Cerrar':'Abrir'} calculadora y notas`)}
    if(open)$('#scratch-expression').focus();else $('#guess-input')?.focus();
  }
  function attachWorkspace(){
    duelLayout.append(panel);panel.hidden=true;workspaceId='duelo';
    workspaceData=loadWorkspace({id:'duelo'});renderWorkspace();
  }
  function detachWorkspace(){
    panel.hidden=true;$('#game-layout').append(panel);workspaceId=null;
  }
  // resume: id de un duelo al que se vuelve desde «Reconectar a la partida» (decisión 0039); también se puede ver uno ya terminado.
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
    if(duel&&['intro','question','reveal'].includes(duel.phase)){
      if(!window.confirm('¿Abandonar el duelo? Tu rival ganará la partida.'))return;
      const response=await call('salir',{id:duel.id});if(response.ok){duel=response.data;finishStats()}
    }else if(duel?.phase==='waiting')call('salir',{id:duel.id});
    stopTimers();duel=null;shown='';hud.hidden=true;shell.hidden=true;saved.remove('actual');detachWorkspace();
    if($('#game-shell').hidden)document.body.classList.remove('modal-open');
  }

  shell.addEventListener('click',event=>{
    Sound.resume();
    const action=event.target.closest('[data-duel]')?.dataset.duel;if(!action)return;
    sfx.tap();
    if(action==='calc'){toggleCalc();return}
    if(action==='quick')begin('buscar');
    if(action==='friend')begin('crear');
    if(action==='accept')begin('unirse',{code:inviteCode});
    if(action==='bot')begin('bot',{id:duel.id});
    if(action==='rematch')begin('revancha',{id:duel.id});
    if(action==='again'){renderLobby();begin('buscar')}
    if(action==='cancel'){call('salir',{id:duel.id});renderLobby()}
    if(action==='share')share(`Te reto a un duelo en Faraday.gg. Código: ${duel.code}`,event.target.closest('[data-link]').dataset.link);
    if(action==='share-result')share(`${duel.winner==='you'?'He ganado':duel.winner==='draw'?'He empatado':'He perdido'} un duelo en Faraday.gg contra ${rival().name} (${int(me().hp)} – ${int(rival().hp)} de vida). ¿Te atreves?`,location.origin+location.pathname);
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
  $('#duel-sound').addEventListener('click',()=>{const on=Sound.toggle();$('#duel-sound').setAttribute('aria-pressed',String(on));if(on)sfx.send();else stopMusic()});
  document.querySelectorAll('[data-open-duel]').forEach(button=>button.addEventListener('click',()=>open()));
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!shell.hidden){event.stopImmediatePropagation();if(!panel.hidden)toggleCalc(false);else close()}},true);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&duel&&!shell.hidden)poll()});
  // Enlace de invitación: ?duelo=CÓDIGO abre el duelo directamente.
  window.DueloReconectar={open:id=>open('',id)};
  const invited=new URLSearchParams(location.search).get('duelo');
  if(invited){history.replaceState(history.state,'',location.pathname);open(invited)}
})();

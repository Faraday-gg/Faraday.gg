// Pase de batalla (decisión 0079). Pantalla propia: arriba, la temporada sobre su fondo ilustrado (un laboratorio de
// noche), con el nivel, lo que falta para el siguiente y el avatar probándose las piezas; debajo, la pista de premios
// nivel a nivel, con la columna gratuita a un lado y la prémium (la de la suscripción) al otro.
// Aquí no hay reglas: todo lo que se pinta lo dice el servidor (lib/pase.mjs, a través de /api/progreso, acciones
// «pase» y «pase-recoger»). Sin cuenta se ve la temporada y sus premios, pero no se avanza.
(()=>{
  const int=n=>new Intl.NumberFormat('es-ES',{maximumFractionDigits:0,useGrouping:'always'}).format(n);
  const COIN='<span class="coin" aria-hidden="true">≈</span>',SEEN='casi-casi:pase:nivel';
  const button=document.getElementById('home-pass');
  // view = lo último que dijo el servidor; billing = si la suscripción se puede contratar y a qué precio;
  // trying = la pieza que lleva puesta el avatar de la cabecera; busy = hay una petición en marcha.
  let view=null,billing=null,trying='',busy=false;

  const shell=document.createElement('div');shell.className='pass-shell';shell.id='pass-shell';shell.hidden=true;
  shell.innerHTML=`<div class="pass-layout" role="dialog" aria-modal="true" aria-labelledby="pass-title"><header class="game-bar"><button class="game-back" id="pass-close" type="button" aria-label="Cerrar el pase de batalla">×</button><a class="game-brand brand-link" href="/" data-go-home aria-label="Ir al inicio"><span class="brand-mark" aria-hidden="true">≈</span><span aria-hidden="true">Faraday<span class="brand-dot">.</span>gg</span></a><span class="coin-pill" id="pass-coins" title="Faradios: se ganan jugando"></span></header><div class="pass-main" id="pass-main"></div></div>`;
  document.body.append(shell);
  const main=shell.querySelector('#pass-main'),pill=shell.querySelector('#pass-coins');

  // El fondo de la temporada 1: un laboratorio de noche, con la pizarra, una bobina de Tesla, matraces y un átomo.
  const ART=`<svg class="pass-art" viewBox="0 0 800 520" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
<defs><linearGradient id="pa-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#141a3a"/><stop offset=".6" stop-color="#2a1f57"/><stop offset="1" stop-color="#3b2470"/></linearGradient>
<radialGradient id="pa-glow" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#ffdb70" stop-opacity=".55"/><stop offset=".55" stop-color="#ff6548" stop-opacity=".16"/><stop offset="1" stop-color="#ff6548" stop-opacity="0"/></radialGradient>
<radialGradient id="pa-coil" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#b9d6ff" stop-opacity=".7"/><stop offset="1" stop-color="#6a8dff" stop-opacity="0"/></radialGradient></defs>
<rect width="800" height="520" fill="url(#pa-sky)"/>
<g fill="#fff" opacity=".5"><circle cx="60" cy="50" r="1.6"/><circle cx="190" cy="28" r="1.1"/><circle cx="330" cy="70" r="1.4"/><circle cx="470" cy="34" r="1.2"/><circle cx="610" cy="60" r="1.7"/><circle cx="745" cy="30" r="1.2"/><circle cx="120" cy="130" r="1"/><circle cx="700" cy="150" r="1.1"/><circle cx="410" cy="120" r=".9"/></g>
<g class="pa-board" fill="#dfe6ff" font-family="Georgia,'Times New Roman',serif" font-style="italic" opacity=".22"><text x="34" y="96" font-size="30">E = mc²</text><text x="250" y="150" font-size="22">F = ma</text><text x="40" y="190" font-size="20">ε = −dΦ/dt</text><text x="420" y="92" font-size="20">∇·B = 0</text><text x="300" y="232" font-size="18">PV = nRT</text><text x="60" y="262" font-size="17">iℏ ∂ψ/∂t = Ĥψ</text><text x="470" y="200" font-size="24">π ≈ 3,14159</text><text x="220" y="60" font-size="16">ΔxΔp ≥ ℏ/2</text></g>
<circle cx="610" cy="270" r="250" fill="url(#pa-glow)"/>
<g class="pa-atom" fill="none" stroke="#ffdb70" stroke-width="2.2" opacity=".5" transform="translate(610 250)"><ellipse rx="190" ry="62"/><ellipse rx="190" ry="62" transform="rotate(60)"/><ellipse rx="190" ry="62" transform="rotate(120)"/><circle class="pa-e" cx="190" cy="0" r="6" fill="#ffdb70" stroke="none"/><circle class="pa-e pa-e2" cx="-95" cy="164" r="6" fill="#ff6548" stroke="none"/><circle class="pa-e pa-e3" cx="-95" cy="-164" r="6" fill="#b9d6e1" stroke="none"/></g>
<g transform="translate(96 520)"><circle cx="0" cy="-232" r="92" fill="url(#pa-coil)"/><path d="M-46 0h92l-10-22h-72z" fill="#0f1430"/><rect x="-13" y="-178" width="26" height="158" rx="5" fill="#1b2350"/><g stroke="#ff8a5c" stroke-width="3" opacity=".8"><path d="M-13-40h26M-13-56h26M-13-72h26M-13-88h26M-13-104h26M-13-120h26M-13-136h26M-13-152h26"/></g><ellipse cx="0" cy="-196" rx="46" ry="15" fill="#2c3876"/><ellipse cx="0" cy="-232" rx="30" ry="30" fill="#39479a"/><ellipse cx="-9" cy="-242" rx="9" ry="7" fill="#8ea2ff" opacity=".6"/>
<g class="pa-bolt" fill="none" stroke="#ffe9a8" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M26-246l34-22-8 18 40-20-10 22 34-12"/><path d="M-26-250l-30-26 6 20-34-12"/><path d="M6-264l10-40-14 12 8-44"/></g></g>
<g transform="translate(0 520)" fill="#0f1430"><rect x="0" y="-18" width="800" height="18"/><path d="M214-18l16-52v-30h-8v-8h36v8h-8v30l16 52z"/><path d="M300-18v-64a22 22 0 0 1 44 0v64z"/><path d="M372-18l22-40v-22h-6v-7h28v7h-6v22l22 40z"/></g>
<g transform="translate(0 520)" opacity=".85"><path d="M222-24l11-34h20l11 34z" fill="#3fc5f0"/><rect x="304" y="-60" width="36" height="38" fill="#2fd67b"/><path d="M381-24l14-26h10l14 26z" fill="#ff7aa8"/><g class="pa-bubble" fill="#fff" opacity=".7"><circle cx="243" cy="-66" r="3"/><circle cx="322" cy="-74" r="3.5"/><circle cx="400" cy="-58" r="2.5"/></g></g>
</svg>`;

  // La pieza de un premio para el cuerpo que se lleva puesto (las de mujer llevan «mj-» en el identificador).
  const bodyOf=()=>window.Progress?.look?.().body==='mujer'?'mujer':'hombre';
  function piece(id){const [slot,name]=String(id).split(':');return (bodyOf()==='mujer'&&Avatar.find(slot,'mj-'+name))||Avatar.find(slot,name)}
  const ZOOM={top:'torso',neck:'torso',bottom:'legs',shoes:'shoes'};
  const BOLT='<svg class="pass-boost" viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="21"/><path d="M27 6 12 27h10l-2 15 16-22H25z"/></svg>';
  // Cómo se enseña un premio: {art, name, text}. text = la frase larga, para el aviso al recogerlo.
  function show(reward){
    if(reward.kind==='coins')return {art:`<span class="pass-coin" aria-hidden="true">≈</span>`,name:`+${int(reward.amount)}`,text:`${int(reward.amount)} faradios`};
    if(reward.kind==='chest'){const chest=window.Chests?.CHESTS?.[reward.type];return {art:window.ChestOpen?.art?.(reward.type)||'',name:`Cofre ${chest?.name||''}`,text:`Cofre ${chest?.name||''}`}}
    if(reward.kind==='boost')return {art:BOLT,name:`XP ×${view?.boostBy||2} · ${reward.hours} h`,text:`Experiencia del pase ×${view?.boostBy||2} durante ${reward.hours} horas`};
    if(reward.kind==='medal'){const found=window.Medals?.parse(reward.id);return {art:window.Medals?.art(reward.id)||'',name:found?.def.name||'Insignia',text:`Insignia «${found?.def.name||''}»`}}
    const item=piece(reward.id),zoom=item?ZOOM[item.slot]||'':'';
    return {art:item?Avatar.render(Avatar.preview(item,bodyOf()),{bust:!zoom,zoom}):'',name:item?.name||'Pieza',text:item?.name||'Pieza nueva'};
  }
  const KIND={coins:'Faradios',chest:'Cofre',boost:'Impulso',medal:'Insignia',item:'Pieza exclusiva'};
  const LOCK='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 11V8a5 5 0 0 1 10 0v3M5.5 11h13v9.5h-13z"/></svg>';

  // Un premio de la pista. Sin cuenta, nada está listo: todo se ve como por conseguir.
  function cell(row,track){
    const reward=row[track];
    if(!reward)return `<span class="pass-cell is-empty" data-track="${track}" aria-hidden="true"></span>`;
    const state=!view.account&&reward.state==='ready'?'locked':reward.state,look=show(reward),picked=reward.kind==='item'&&trying===reward.id;
    const badge=state==='claimed'?'<i class="pass-mark is-done" aria-hidden="true">✓</i>':state==='ready'?'<i class="pass-mark is-ready">Recoger</i>':state==='waiting'?`<i class="pass-mark is-wait">${LOCK}Te espera</i>`:track==='plus'&&!view.plus?`<i class="pass-mark is-lock" aria-hidden="true">${LOCK}</i>`:'';
    const label=`Nivel ${row.level}, ${track==='plus'?'prémium':'gratis'}: ${look.text}. ${state==='claimed'?'Recogido':state==='ready'?'Listo para recoger':state==='waiting'?'Te espera con la suscripción':'Por conseguir'}`;
    return `<button type="button" class="pass-cell${picked?' is-picked':''}" data-track="${track}" data-level="${row.level}" data-state="${state}" data-kind="${reward.kind}" aria-label="${label.replace(/"/g,'&quot;')}"><span class="pass-cell-art">${look.art}</span><span class="pass-cell-name">${look.name}</span><small>${KIND[reward.kind]}</small>${badge}</button>`;
  }
  const price=()=>billing?.price&&Number.isFinite(billing.price.amount)?`${new Intl.NumberFormat('es-ES',{style:'currency',currency:(billing.price.currency||'eur').toUpperCase()}).format(billing.price.amount/100)}${{month:' al mes',year:' al año',week:' a la semana',day:' al día'}[billing.price.interval]||''}`:'';
  // El botón que abre la pista prémium: entrar, suscribirse o, si ya se tiene, nada.
  function premiumCta(big){
    if(view.plus)return big?'<p class="pass-premium-on">👑 Pase prémium activo: va con tu suscripción</p>':'';
    const perks=`Todos los premios prémium, +${Math.round(view.bonus*100)} % de experiencia en el pase y duelos sin límite.`;
    if(!view.account)return `<div class="pass-cta"><button type="button" class="pass-gold" data-pass-login>Entrar para empezar el pase</button>${big?'<small>Con tu cuenta, cada partida suma al pase. Es gratis.</small>':''}</div>`;
    if(!billing?.enabled)return big?`<div class="pass-cta"><small>👑 La pista prémium va con la suscripción, que todavía no se puede contratar.</small></div>`:'';
    return `<div class="pass-cta"><button type="button" class="pass-gold" data-pass-subscribe>👑 Desbloquear prémium${price()?` · ${price()}`:''}</button>${big?`<small>${view.waiting?`<b>${view.waiting} ${view.waiting===1?'premio te espera':'premios te esperan'} ya.</b> `:''}${perks} Va con la suscripción: se cancela cuando quieras.</small>`:''}</div>`;
  }
  function timeLeft(){const days=view.season.days;return days<=0?'Termina hoy':days===1?'Termina mañana':`Termina en ${days} días`}
  function boostLeft(){const ms=view.boost-Date.now(),hours=Math.ceil(ms/3600000);return hours>=2?`quedan ${hours} h`:`quedan ${Math.max(1,Math.ceil(ms/60000))} min`}
  // La última pieza de la pista prémium es la portada de la temporada, hasta que se pruebe otra.
  const cover=()=>trying||[...view.track].reverse().map(row=>row.plus).find(reward=>reward?.kind==='item')?.id||'';
  function hero(){
    const top=view.level>=view.levels,item=piece(cover()),base=window.Progress?.look?.()||Avatar.DEFAULT,look=item?{...base,[item.slot]:item.id}:base;
    const row=item&&view.track.find(one=>['free','plus'].some(track=>one[track]?.kind==='item'&&one[track].id===cover())),where=row?`Nivel ${row.level} · ${row.plus?.id===cover()&&row.plus.kind==='item'?'prémium':'gratis'}`:'';
    return `<section class="pass-hero">${ART}<div class="pass-hero-copy"><p class="pass-kicker">Temporada ${view.season.n} · Pase de batalla</p><h2 id="pass-title">${view.season.name}</h2><p class="pass-time"><span aria-hidden="true">⏳</span> ${timeLeft()}</p>
<div class="pass-level"><span class="pass-level-badge" aria-hidden="true"><b>${view.level}</b></span><div class="pass-level-bar"><div class="pass-bar" role="img" aria-label="${top?'Pase completado':`${view.into} de ${view.step} puntos de experiencia para el nivel ${view.level+1}`}"><i style="--p:${top?1:view.into/view.step}"></i></div><p><b>Nivel ${view.level}</b> · ${top?'¡pase completado!':`${int(view.into)} / ${int(view.step)} XP para el ${view.level+1}`}</p></div></div>
<ul class="pass-chips">${view.boost?`<li class="is-boost">⚡ XP ×${view.boostBy} · ${boostLeft()}</li>`:''}${view.plus?`<li>👑 +${Math.round(view.bonus*100)} % de XP</li>`:''}<li>Juega y sube: retos, misiones y duelos</li></ul>${premiumCta(true)}</div>
<div class="pass-hero-figure"><span class="pass-figure">${Avatar.render(look,{label:item?`Tu avatar con ${item.name}`:'Tu avatar',live:true,drag:true,emote:'wave'})}</span>${item?`<p class="pass-figure-tag"><b>${item.name}</b><small>${where}</small></p>`:''}</div></section>`;
  }
  function draw(){
    if(shell.hidden)return;
    pill.innerHTML=`${int(window.Progress?.coins?.()??0)} ${COIN}<span class="sr-only"> faradios</span>`;
    if(!view){main.innerHTML='<p class="pass-empty">Cargando el pase de batalla…</p>';return}
    if(!view.season){main.innerHTML='<div class="pass-empty"><h2 id="pass-title">Pase de batalla</h2><p>Ahora mismo no hay ninguna temporada en marcha. La siguiente está al caer.</p></div>';return}
    const scroll=shell.querySelector('.pass-layout').scrollTop;
    const rows=view.track.map(row=>`<li class="pass-row${row.level<view.level?' is-done':row.level===view.level?' is-done is-now':''}" data-row="${row.level}">${cell(row,'free')}<span class="pass-node" aria-hidden="true"><b>${row.level}</b></span>${cell(row,'plus')}</li>`).join('');
    const old=view.previous?`<div class="pass-old"><p>Te quedan <b>${view.previous.pending}</b> ${view.previous.pending===1?'premio':'premios'} sin recoger de «${view.previous.name}».</p><button type="button" class="game-secondary" data-pass-old="${view.previous.id}">Recoger</button></div>`:'';
    main.innerHTML=`${hero()}<section class="pass-track" aria-label="Premios de la temporada">${old}<div class="pass-track-head"><span>Gratis</span><span aria-hidden="true"></span><span class="is-plus">👑 Prémium</span></div><ol class="pass-rows">${rows}</ol>
<p class="pass-note">La experiencia del pase es la misma que ganas jugando: respuestas, retos, misiones y duelos. Las piezas y las insignias que recojas son para siempre. Los premios de un nivel ya alcanzado no se pierden si te suscribes más tarde: se recogen todos de golpe.</p></section>
${view.account&&view.ready?`<div class="pass-dock"><button type="button" class="pass-gold" data-pass-all>Recoger todo · ${view.ready} ${view.ready===1?'premio':'premios'}</button></div>`:!view.plus&&view.waiting?`<div class="pass-dock is-wait">${premiumCta(false)||`<p>👑 ${view.waiting} premios prémium te esperan</p>`}</div>`:''}`;
    shell.querySelector('.pass-layout').scrollTop=scroll;
  }

  // La entrada de la portada: nivel, avance y cuántos premios esperan.
  function paintHome(){
    if(!button)return;
    if(!view?.season){button.hidden=true;return}
    const ready=view.account?view.ready:0,top=view.level>=view.levels;
    button.hidden=false;
    button.innerHTML=`<span class="home-pass-ico" aria-hidden="true"><svg viewBox="0 0 24 24"><ellipse cx="12" cy="12" rx="10" ry="4"/><ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(60 12 12)"/><ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(120 12 12)"/><circle cx="12" cy="12" r="1.8"/></svg></span><span class="home-pass-text"><b>Pase de batalla <em>Nv. ${view.level}</em></b><small>${view.season.name} · ${timeLeft().toLowerCase()}</small><i class="home-pass-bar"><i style="--p:${top?1:view.into/view.step}"></i></i></span>${ready?`<i class="profile-dot" aria-label="${ready} premios por recoger">${ready}</i>`:'<span class="home-pass-go" aria-hidden="true">→</span>'}`;
  }
  // Al subir de nivel desde la última vez que se miró, un aviso (una vez por nivel y temporada).
  function levelNote(){
    if(!view?.season||!view.account)return;
    let seen={};try{seen=JSON.parse(localStorage.getItem(SEEN))||{}}catch{}
    const before=seen.s===view.season.id?seen.level:null;
    if(before!==view.level){try{localStorage.setItem(SEEN,JSON.stringify({s:view.season.id,level:view.level}))}catch{}}
    if(Number.isInteger(before)&&view.level>before&&shell.hidden&&typeof showToast==='function')showToast(`¡Nivel ${view.level} del pase de batalla! ${view.ready?'Tienes premios por recoger.':''}`);
  }
  function apply(next){
    if(!next||typeof next!=='object')return;
    view=next;
    // Las insignias ya recogidas cuentan como conseguidas, también en otro dispositivo.
    if(view.track)window.Progress?.passBadges?.(view.track.flatMap(row=>[row.free,row.plus]).filter(reward=>reward?.kind==='medal'&&reward.state==='claimed').map(reward=>reward.id));
    paintHome();levelNote();draw();
  }
  let loading=null;
  function load(){
    if(!window.Progress?.cloud)return Promise.resolve();
    return loading??=Progress.cloud('pase').then(apply).catch(()=>{}).finally(()=>{loading=null});
  }
  async function loadBilling(){
    if(!Progress.linked?.())return;
    try{const state=await Progress.cloud('estado');billing=state.billing||null;draw()}catch{}
  }

  // Lo recién recogido, a toda pantalla: qué es cada premio y dónde encontrarlo.
  function reveal(rewards){
    const kinds=new Set(rewards.map(reward=>reward.kind)),old=document.querySelector('.pass-reveal');old?.remove();
    const box=document.createElement('div');box.className='pass-reveal';box.setAttribute('role','dialog');box.setAttribute('aria-modal','true');box.setAttribute('aria-labelledby','pass-reveal-title');
    box.innerHTML=`<span class="pass-rays" aria-hidden="true"></span><div class="pass-reveal-box"><p class="pass-kicker">Pase de batalla</p><h2 id="pass-reveal-title">${rewards.length===1?'¡Premio recogido!':`¡${rewards.length} premios recogidos!`}</h2>
<ul class="pass-reveal-list">${rewards.map((reward,i)=>{const look=show(reward);return `<li style="--i:${Math.min(i,12)}" data-kind="${reward.kind}" data-track="${reward.track}"><span class="pass-cell-art">${look.art}</span><b>${look.text}</b><small>${reward.track==='plus'?'👑 Prémium':'Gratis'} · nivel ${reward.level}</small></li>`}).join('')}</ul>
<p class="pass-reveal-note">${[kinds.has('item')?'Las piezas ya están en tu armario.':'',kinds.has('chest')?'Los cofres te esperan en tu perfil.':'',kinds.has('boost')?'El impulso ya está en marcha.':''].filter(Boolean).join(' ')}</p>
<div class="pass-reveal-actions">${kinds.has('chest')?'<button type="button" class="pass-gold" data-go="cofres">Abrir los cofres</button>':kinds.has('item')?'<button type="button" class="pass-gold" data-go="armario">Ir al armario</button>':''}<button type="button" class="pass-ghost" data-go="">Seguir</button></div></div>`;
    const close=()=>{document.removeEventListener('keydown',onKey,true);box.remove()};
    const onKey=event=>{if(event.key==='Escape'){event.stopImmediatePropagation();close()}};
    box.addEventListener('click',event=>{const target=event.target.closest('[data-go]');if(!target&&event.target!==box)return;close();if(target?.dataset.go)Progress.open(target.dataset.go)});
    document.addEventListener('keydown',onKey,true);document.body.append(box);box.querySelector('button')?.focus();
    try{window.Sound?.resume?.();[523,659,784,1047,1319].forEach((f,i)=>window.Sound?.tone?.(f,i*.09,.35,{type:'triangle',gain:.05}))}catch{}
  }
  async function claim(body){
    if(busy)return;busy=true;
    const data=await Progress.ask('pase-recoger',body,'No se pudo recoger el premio. Inténtalo otra vez.','Ese premio ya no se puede recoger.');
    busy=false;
    if(!data){load();return}
    Progress.serverCoins(data.coins);apply(data.pass);
    // Las piezas y los cofres nuevos están en el servidor: se traen al armario y al perfil.
    if(data.rewards.some(reward=>reward.kind==='item'||reward.kind==='chest'))Progress.syncItems();
    Progress.passBadges?.(data.rewards.filter(reward=>reward.kind==='medal').map(reward=>reward.id));
    reveal(data.rewards);
  }

  function open(){
    shell.hidden=false;document.body.classList.add('modal-open');trying='';
    if(typeof toggleMenu==='function')toggleMenu(false);
    draw();shell.querySelector('#pass-close').focus();
    load().then(()=>{
      // Se abre mirando al nivel en el que se está, con el anterior a la vista.
      const row=main.querySelector(`[data-row="${Math.max(1,(view?.level||1)-1)}"]`),track=main.querySelector('.pass-track');
      if(row&&track&&matchMedia('(min-width:960px)').matches)track.scrollTop=row.offsetTop-track.querySelector('.pass-rows').offsetTop;
    });
    loadBilling();
  }
  function close(){
    shell.hidden=true;
    if(['game-shell','duel-shell','profile-shell'].every(id=>document.getElementById(id)?.hidden!==false))document.body.classList.remove('modal-open');
  }
  shell.addEventListener('click',event=>{
    const target=event.target.closest('button');if(!target)return;
    if(target.id==='pass-close'){close();return}
    if('passLogin' in target.dataset){close();document.getElementById('home-account')?.click();return}
    if('passSubscribe' in target.dataset){
      if(target.disabled)return;target.disabled=true;
      Progress.ask('suscribirse',{},'No se pudo abrir la página de pago. Inténtalo otra vez.','Ya tienes la suscripción activa.').then(data=>{if(data?.url)location.href=data.url;else{target.disabled=false;load()}});
      return;
    }
    if('passAll' in target.dataset){claim({all:true});return}
    if(target.dataset.passOld){claim({all:true,season:target.dataset.passOld});return}
    if(target.dataset.level){
      const level=Number(target.dataset.level),track=target.dataset.track,state=target.dataset.state,reward=view.track[level-1]?.[track];if(!reward)return;
      if(state==='ready'){claim({level,track});return}
      // Una pieza se prueba en el avatar de la cabecera; lo demás dice qué es y qué falta.
      if(reward.kind==='item'){trying=trying===reward.id?'':reward.id;draw();if(!matchMedia('(min-width:960px)').matches)shell.querySelector('.pass-layout').scrollTo({top:0,behavior:'smooth'})}
      const look=show(reward);
      if(typeof showToast==='function')showToast(state==='claimed'?`${look.text}: ya lo recogiste.`:!view.account?`${look.text}. Entra con tu cuenta para empezar el pase.`:state==='waiting'?`${look.text}: te espera en cuanto tengas el pase prémium.`:`${look.text}: llega al nivel ${level}${track==='plus'&&!view.plus?' y ten el pase prémium':''} para recogerlo.`);
    }
  });
  document.addEventListener('click',event=>{const target=event.target.closest('[data-open-pass]');if(target){event.preventDefault();open()}});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!shell.hidden&&!document.querySelector('.pass-reveal')&&document.getElementById('profile-shell')?.hidden!==false){event.stopImmediatePropagation();close()}},true);

  // Se vuelve a preguntar al servidor cuando cambia algo que mueve el pase: jugar, entrar o salir de la cuenta, volver a la pestaña.
  let timer=0;const soon=(ms=4000)=>{clearTimeout(timer);timer=setTimeout(load,ms)};
  for(const name of ['faraday:answer','faraday:day','faraday:duel'])document.addEventListener(name,()=>soon());
  document.addEventListener('faraday:progreso',()=>{soon(300);if(!shell.hidden)loadBilling()});
  document.addEventListener('faraday:cuenta',()=>soon(1200));
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)soon(500)});
  window.Pase={open,load,view:()=>view};
  load();
})();

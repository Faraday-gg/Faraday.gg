// Clasificatorias y rangos de los duelos (decisión 0043). Los PR los calcula y guarda el servidor (lib/rangos.mjs):
// aquí solo se pintan las insignias, el selector «Normal / Clasificatoria», la tarjeta de rango del portal y del perfil
// y el resultado «+18 PR» con su animación al subir o bajar. El rango se recuerda en este navegador solo para pintarlo
// al momento; manda lo que diga el servidor.
(()=>{
  const KEY='casi-casi:rango:',MIN_LEVEL=10; // mismo umbral que lib/rangos.mjs (RANKED_MIN_LEVEL) y las apuestas
  const saved={get(key,fallback){try{return JSON.parse(localStorage.getItem(KEY+key))??fallback}catch{return fallback}},set(key,value){try{localStorage.setItem(KEY+key,JSON.stringify(value))}catch{}}};
  const int=n=>new Intl.NumberFormat('es-ES',{maximumFractionDigits:0,useGrouping:'always'}).format(n);
  const RANKS={
    bronce:{name:'Bronce',color:'#b0703f',line:'Todo el mundo empieza contando con los dedos.'},
    plata:{name:'Plata',color:'#8d9aa8',line:'Ya sabes si algo son cientos o millones.'},
    oro:{name:'Oro',color:'#d29a1e',line:'Aciertas el orden de magnitud casi siempre.'},
    calculista:{name:'Calculista',color:'#1f9a8a',line:'Haces la cuenta de cabeza antes de que el rival abra la calculadora.'},
    estimador:{name:'Estimador',color:'#2f74d0',line:'Lo tuyo es el ≈: no sabes la cifra, pero la clavas.'},
    doctorando:{name:'Doctorando',color:'#7a4cd0',line:'Cuatro años de tesis para responder «depende», pero con intervalo de confianza.'},
    eminencia:{name:'Eminencia',color:'#c43d6c',line:'Te citan en las sobremesas: «lo ha dicho una eminencia».'},
    cientifico:{name:'Científico',color:'#ff5a36',line:'La cumbre: sin divisiones, solo puntos y la clasificación.'},
    'sin-rango':{name:'Sin clasificar',color:'#8a8f98',line:'Juega 5 partidas de posicionamiento para conocer tu rango.'}
  };
  // Icono de cada rango, en blanco sobre el escudo (viewBox 48×56, centro en 24,27).
  const S='fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"';
  const ICONS={
    bronce:`<path ${S} d="M15 31l9-7 9 7"/>`,
    plata:`<path ${S} d="M15 26l9-7 9 7M15 34l9-7 9 7"/>`,
    oro:`<path fill="#fff" d="M24 15l3.5 7.2 7.9 1.1-5.7 5.6 1.4 7.9-7.1-3.7-7.1 3.7 1.4-7.9-5.7-5.6 7.9-1.1z"/>`,
    calculista:`<path ${S} d="M24 16v12M18 22h12M18 34h12"/>`,
    estimador:`<path ${S} d="M15 23c3-3 6-3 9 0s6 3 9 0M15 31c3-3 6-3 9 0s6 3 9 0"/>`,
    doctorando:`<path fill="#fff" d="M11 23l13-6.5L37 23l-13 6.5z"/><path ${S} stroke-width="2.6" d="M17.5 26.5v5.5c4.3 3 8.7 3 13 0v-5.5M35 23.5v7"/>`,
    eminencia:`<path ${S} d="M24 15a7.5 7.5 0 0 1 4.5 13.5V31h-9v-2.5A7.5 7.5 0 0 1 24 15zM21 35h6"/>`,
    cientifico:`<g ${S} stroke-width="2.2"><ellipse cx="24" cy="27" rx="12" ry="4.6"/><ellipse cx="24" cy="27" rx="12" ry="4.6" transform="rotate(60 24 27)"/><ellipse cx="24" cy="27" rx="12" ry="4.6" transform="rotate(-60 24 27)"/></g><circle cx="24" cy="27" r="2.6" fill="#fff"/>`,
    'sin-rango':`<text x="24" y="34" text-anchor="middle" font-size="20" font-weight="800" fill="#fff" font-family="Space Grotesk,Arial,sans-serif">?</text>`
  };
  const PIPS={III:1,II:2,I:3};
  let uid=0;
  // Insignia: escudo con degradado del color del rango, su icono y las marcas de la división (III = 1, II = 2, I = 3).
  function badge(rank,{size=48,label=true}={}){
    const id=rank?.id&&RANKS[rank.id]?rank.id:'sin-rango',info=RANKS[id],g='rk'+(++uid),pips=PIPS[rank?.division]||0;
    const marks=pips?Array.from({length:pips},(_,i)=>`<circle cx="${24+(i-(pips-1)/2)*7}" cy="47.5" r="2.2" fill="#fff"/>`).join(''):'';
    const crown=id==='cientifico'?`<path d="M14 6l5 4 5-6 5 6 5-4-1.5 7h-17z" fill="#ffd25e" stroke="#7a2a12" stroke-width="1"/>`:'';
    return `<svg class="ranked-badge" data-rank="${id}" viewBox="0 0 48 56" width="${size}" height="${Math.round(size*56/48)}" ${label?`role="img" aria-label="${escapeHtml(rank?.label||info.name)}"`:'aria-hidden="true"'}><defs><linearGradient id="${g}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${info.color}" stop-opacity=".72"/><stop offset=".55" stop-color="${info.color}"/><stop offset="1" stop-color="#20263066"/></linearGradient></defs><path d="M24 3l20 7v17c0 13-9 22-20 27C13 49 4 40 4 27V10z" fill="${info.color}"/><path d="M24 3l20 7v17c0 13-9 22-20 27C13 49 4 40 4 27V10z" fill="url(#${g})" stroke="#20263055" stroke-width="1.5"/><path d="M24 7.5l16 5.6V27c0 10.4-7 17.7-16 22-9-4.3-16-11.6-16-22V13.1z" fill="none" stroke="#ffffff55" stroke-width="1.2"/>${ICONS[id]}${marks}${crown}</svg>`;
  }
  const text=rank=>!rank||rank.placing?`Sin clasificar${rank?.placementLeft?` · ${rank.placementLeft} de posicionamiento`:''}`:rank.top?`Científico · ${int(rank.pr)} PR`:`${rank.label} · ${rank.pr} PR`;
  // Chip pequeño para el marcador y la presentación del duelo.
  const chip=rank=>rank?`<span class="ranked-chip" title="${escapeHtml(text(rank))}">${badge(rank,{size:16,label:false})}<span>${escapeHtml(rank.placing?'Posic.':rank.label)}</span></span>`:'';

  const level=()=>window.Progress?.level?.()??1;
  const unlocked=()=>level()>=MIN_LEVEL;
  const mode=()=>unlocked()&&saved.get('modo','normal')==='ranked'?'ranked':'normal';
  let mine=saved.get('mio',null),top=[],position=null;

  async function refresh(){
    try{
      await playerReady;
      const response=await fetch('/api/duelo',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'rango',player:playerId()}),signal:AbortSignal.timeout(8000)});
      if(!response.ok)return;
      const data=await response.json();mine=data.rank;top=data.top||[];position=data.position;saved.set('mio',mine);paint();
    }catch{}
  }
  // Barra de PR dentro de la división (o de las partidas de posicionamiento).
  const bar=(rank,ratio=null)=>{const value=ratio??(rank?.placing?(5-rank.placementLeft)/5:rank?.top?1:(rank?.pr||0)/100);return `<div class="ranked-bar"><i style="--pr:${Math.max(0,Math.min(1,value))}"></i></div>`};
  function card(){
    if(!unlocked())return `<div class="ranked-card is-locked">${badge(null,{size:44,label:false})}<div><b>Clasificatoria</b><small><span aria-hidden="true">🔒</span> Se desbloquea en el nivel ${MIN_LEVEL}${level()<MIN_LEVEL?` · llevas el ${level()}`:''}</small></div></div>`;
    const rank=mine;
    return `<div class="ranked-card">${badge(rank,{size:44})}<div><b>${escapeHtml(rank&&!rank.placing?rank.label:'Sin clasificar')}${rank?.top&&position?` <em>n.º ${position}</em>`:''}</b><small>${rank&&!rank.placing?rank.top?`${int(rank.pr)} PR`:`${rank.pr} / 100 PR`:`Posicionamiento: ${5-(rank?.placementLeft??5)} de 5 partidas jugadas`}</small>${bar(rank)}</div>${top.length?`<details class="ranked-top"><summary>Cumbre</summary><ol>${top.map(row=>`<li class="${row.you?'you':''}"><span>${row.position}</span><b>${escapeHtml(row.name)}</b><i>${int(row.pr)} PR</i></li>`).join('')}</ol></details>`:''}</div>`;
  }
  // Selector del portal del duelo: «Normal» o «Clasificatoria» (con candado por debajo del nivel 10).
  function lobby(){
    const current=mode(),lock=!unlocked();
    return `<div class="ranked-lobby" id="ranked-lobby"><div class="ranked-modes" role="radiogroup" aria-label="Modo de juego"><button type="button" role="radio" aria-checked="${current==='normal'}" data-ranked-mode="normal">Normal</button><button type="button" role="radio" aria-checked="${current==='ranked'}" data-ranked-mode="ranked"${lock?' aria-disabled="true" title="Se desbloquea en el nivel '+MIN_LEVEL+'"':''}>${lock?'<span aria-hidden="true">🔒</span> ':''}Clasificatoria</button></div><div id="ranked-card-slot">${card()}</div></div>`;
  }
  function paint(){
    const slot=document.getElementById('ranked-card-slot');if(slot)slot.innerHTML=card();
    const quick=document.querySelector('#duel-content [data-duel="quick"]');if(quick)quick.innerHTML=`${mode()==='ranked'?'Buscar clasificatoria':'Partida rápida'} <span aria-hidden="true">→</span>`;
    injectProfile();
  }
  document.addEventListener('click',event=>{
    const button=event.target.closest('[data-ranked-mode]');if(!button)return;
    if(button.dataset.rankedMode==='ranked'&&!unlocked()){if(typeof showToast==='function')showToast(`Las clasificatorias se desbloquean en el nivel ${MIN_LEVEL}.`);return}
    saved.set('modo',button.dataset.rankedMode);
    document.querySelectorAll('[data-ranked-mode]').forEach(other=>other.setAttribute('aria-checked',String(other===button)));paint();
  });

  // Resultado de una clasificatoria en la pantalla final: «+18 PR», barra y animación al cambiar de división o rango.
  const CHANGE={'rank-up':'¡Subes de rango!','division-up':'¡Subes de división!','rank-down':'Bajas de rango','division-down':'Bajas de división','placed':'¡Ya tienes rango!'};
  function result(duel){
    if(duel?.mode!=='ranked')return '';
    const r=duel.rankResult;
    if(!r)return `<div class="ranked-result" id="ranked-result" data-pending="1"><p class="ranked-pending">Calculando tus PR…</p></div>`;
    const rank=r.rank,up=r.delta>0,changed=CHANGE[r.change],dir=/up|placed/.test(r.change)?'up':/down/.test(r.change)?'down':'';
    mine=rank;saved.set('mio',rank);
    const from=r.change==='same'?Math.max(0,(rank.pr-r.delta)/100):0;
    return `<div class="ranked-result${dir?' is-'+dir:''}" id="ranked-result" data-change="${r.change}">
<div class="ranked-result-badge">${badge(rank,{size:64})}${dir?'<span class="ranked-burst" aria-hidden="true"></span>':''}</div>
<div class="ranked-result-info"><p class="ranked-result-head"><b>${escapeHtml(rank.placing?'Posicionamiento':rank.label)}</b><span class="ranked-delta ${up?'up':r.delta<0?'down':'even'}">${r.delta>0?'+':r.delta<0?'−':'±'}${Math.abs(r.delta)} PR</span></p>
${changed?`<p class="ranked-change">${changed}</p>`:''}
<div class="ranked-bar"><i style="--pr:${from}" data-pr="${rank.placing?(5-rank.placementLeft)/5:rank.top?1:rank.pr/100}"></i></div>
<small>${rank.placing?`Te quedan ${rank.placementLeft} ${rank.placementLeft===1?'partida':'partidas'} de posicionamiento`:rank.top?`${int(rank.pr)} PR en la cumbre`:`${rank.pr} / 100 PR`}${r.shielded?' · <b>Colchón:</b> acabas de subir y no bajas de división':''}${r.score===.5?' · Empate: nadie gana ni pierde PR':''}</small></div></div>`;
  }
  // Tras pintar la pantalla final: la barra se llena y, si cambia el rango, suena y la insignia salta.
  function animate(){
    const box=document.getElementById('ranked-result');if(!box||box.dataset.pending)return;
    requestAnimationFrame(()=>requestAnimationFrame(()=>{const fill=box.querySelector('[data-pr]');if(fill)fill.style.setProperty('--pr',fill.dataset.pr)}));
    if(window.Sound?.on&&Sound.tone){
      if(box.classList.contains('is-up'))[659,784,988,1319].forEach((f,i)=>Sound.tone(f,.6+i*.1,.35,{type:'triangle',gain:.06}));
      if(box.classList.contains('is-down'))[440,370].forEach((f,i)=>Sound.tone(f,.6+i*.2,.4,{type:'triangle',gain:.04}));
    }
  }
  // Si el resultado llega después de pintar la pantalla final, se completa.
  function update(duel){const box=document.getElementById('ranked-result');if(box?.dataset.pending&&duel?.rankResult){box.outerHTML=result(duel);animate()}}

  // Perfil: el rango debajo del nivel. progress.js repinta el perfil entero, así que se vuelve a poner cada vez.
  function injectProfile(){
    const level=document.querySelector('#profile-main .profile-level');if(!level)return;
    const html=card(),current=level.nextElementSibling?.classList.contains('ranked-profile')?level.nextElementSibling:null;
    if(!current)level.insertAdjacentHTML('afterend',`<div class="ranked-profile">${html}</div>`);else if(current.innerHTML!==html)current.innerHTML=html;
  }
  const main=document.getElementById('profile-main');
  if(main)new MutationObserver(injectProfile).observe(main,{childList:true});
  document.querySelectorAll('[data-open-profile],[data-open-duel]').forEach(button=>button.addEventListener('click',()=>{if(unlocked())refresh()}));

  window.Ranked={MIN_LEVEL,RANKS,badge,chip,text,lobby,mode,unlocked,refresh,result,animate,update,paint};
})();

// Preguntas de la comunidad (decisión 0052). Los jugadores con cuenta proponen preguntas y votan las de los demás
// con faradios; las 3 más votadas de la semana salen el lunes en el reto, resueltas por la IA con sus fuentes y el
// cálculo paso a paso. El servidor manda (lib/comunidad.mjs): cobra del saldo de la cuenta y decide la ronda abierta.
// El apodo es el mismo de los duelos y las ligas, y el avatar, el del armario.
// Las propuestas se enseñan como una clasificación con la línea de corte de las que saldrían el lunes. Votar
// actualiza la lista sin recargar la pantalla y lo que se escribe en el formulario se guarda como borrador.
(()=>{
  const shell=$('#community-shell'),content=$('#community-content');
  const PROFILE='casi-casi:duelo:perfil',DRAFT='casi-casi:comunidad:borrador';
  const WINNERS=3;   // las que salen el lunes (lib/comunidad.mjs): la línea de corte de la clasificación
  const readName=()=>{try{const value=JSON.parse(localStorage.getItem(PROFILE));if(typeof value?.name==='string'&&value.name.trim())return value.name}catch{}return ''};
  const writeName=value=>{let profile={};try{profile=JSON.parse(localStorage.getItem(PROFILE))||{}}catch{}try{localStorage.setItem(PROFILE,JSON.stringify({...profile,name:value}))}catch{}};
  const readDraft=()=>{try{const value=JSON.parse(localStorage.getItem(DRAFT));if(value&&typeof value==='object')return value}catch{}return {}};
  const writeDraft=value=>{try{if(value)localStorage.setItem(DRAFT,JSON.stringify(value));else localStorage.removeItem(DRAFT)}catch{}};
  const avatar=(look,size='small')=>`<span class="duel-avatar ${size}" aria-hidden="true">${window.Avatar?Avatar.render(look||{},{bust:true}):''}</span>`;
  const badge=look=>window.Medals?Medals.chip(look?.badge):'';
  const COIN='<span class="coin" aria-hidden="true">≈</span>';
  const coins=n=>`${n} ${COIN}<span class="sr-only"> faradios</span>`;
  const longDate=id=>new Intl.DateTimeFormat('es-ES',{weekday:'long',day:'numeric',month:'long',timeZone:'Europe/Madrid'}).format(new Date(id+'T12:00:00Z'));
  const daysBetween=(from,to)=>Math.round((Date.parse(to+'T12:00:00Z')-Date.parse(from+'T12:00:00Z'))/86400000);
  const votes=n=>`${n} ${n===1?'voto':'votos'}`;
  // Ideas para empezar: rellenan el formulario con una pregunta de ejemplo que se puede cambiar.
  const IDEAS=[
    {title:'¿Cuántos ascensores hay en España?',unit:'ascensores'},
    {title:'¿Cuántos litros de agua caben en un campo de fútbol lleno hasta el larguero?',unit:'litros'},
    {title:'¿Cuántos kilómetros recorre un cartero a lo largo de su vida laboral?',unit:'km'},
    {title:'¿Cuántas pizzas se comen en Italia en un año?',unit:'pizzas'}
  ];
  // Lo mismo que hace el servidor con el título (checkProposal en lib/comunidad.mjs), para la vista previa.
  const polish=text=>{
    let title=String(text||'').replace(/\s+/g,' ').trim();if(!title)return '';
    if(!/\?$/.test(title))title=(title.startsWith('¿')?title:'¿'+title)+'?';
    if(!title.startsWith('¿'))title='¿'+title;
    return '¿'+title.slice(1).charAt(0).toLocaleUpperCase('es')+title.slice(2);
  };
  let round=null,busy=false,seq=0,filter='todas';

  async function call(action,extra={}){
    try{
      await playerReady;
      const response=await fetch('/api/comunidad',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify({action,...extra}),signal:AbortSignal.timeout(action==='proponer'?60000:10000)});
      return {ok:response.ok,status:response.status,data:await response.json()};
    }catch{return {ok:false,status:0,data:{error:'Sin conexión con el servidor'}}}
  }
  const say=text=>{const error=$('#community-error');if(error)error.textContent=text||'';else if(text)showToast(text)};

  // Cuándo se cierra la votación, contado desde hoy (hora de Madrid, la que manda el servidor).
  function countdown(r){
    const left=daysBetween(r.today,r.closes);
    if(left<=0)return 'Se cierra <b>hoy a medianoche</b>';
    if(left===1)return 'Se cierra <b>mañana a medianoche</b>';
    return `Quedan <b>${left} días</b> · hasta el ${longDate(r.closes)}`;
  }

  function card(p,{winner=false,place=0,top=0,cut=0}={}){
    const r=round,poor=r?.account&&Number.isInteger(r.coins)&&r.coins<r.rules.voteCost;
    const action=winner?'':p.mine?'<span class="community-tag">Tuya</span>'
      :p.voted?'<span class="community-tag is-voted">Votada ✓</span>'
      :r?.account?`<button class="game-secondary community-vote" type="button" data-community-vote="${p.id}"${poor?' disabled title="No tienes faradios suficientes"':''}>Votar · ${coins(r.rules.voteCost)}</button>`:'';
    // Fuera de las 3 primeras: cuántos votos le faltan para pasar a la tercera (a igualdad, gana la más antigua).
    const inTop=!winner&&place&&place<=WINNERS&&p.votes>0;
    const note=!winner&&place>WINNERS&&cut?`<small class="community-gap">A ${votes(Math.max(1,cut-p.votes+1))} de entrar</small>`
      :inTop?'<small class="community-gap is-in">Saldría el lunes</small>':'';
    const bar=!winner&&top?`<span class="community-bar" aria-hidden="true"><i style="width:${Math.round(100*p.votes/top)}%"></i></span>`:'';
    return `<li class="community-card${p.mine?' is-mine':''}${inTop?' is-top':''}"${winner?'':` data-id="${p.id}"`}>
<div class="community-author">${place?`<span class="community-place" aria-label="Puesto ${place}">${place}</span>`:''}${avatar(p.avatar)}<span><b>${escapeHtml(p.name)}${badge(p.avatar)}</b><small>${winner?'Salió en el reto':'propone'}</small></span><strong class="community-votes">${votes(p.votes)}</strong></div>
${bar}<p class="community-question">${escapeHtml(p.title)}</p><p class="community-unit">Se responde en ${escapeHtml(p.unit)}${p.note?` · ${escapeHtml(p.note)}`:''}</p>
${action||note?`<div class="community-foot">${action}${note}</div>`:''}</li>`;
  }

  // La clasificación, en el orden del servidor: más votos primero y, a igualdad, la que se propuso antes.
  function ranking(){
    const r=round,all=r.proposals;
    if(!all.length)return `<div class="community-empty"><p><b>Aún no hay ninguna propuesta.</b></p><p>La primera que llegue tiene todas las papeletas para salir el lunes.</p></div>`;
    const top=Math.max(1,...all.map(p=>p.votes)),cut=all.length>WINNERS?all[WINNERS-1].votes:0;
    const mine=all.filter(p=>p.mine).length,pending=all.filter(p=>!p.mine&&!p.voted).length;
    const tabs=r.account?[['todas','Todas',all.length],['pendientes','Sin votar',pending],...(mine?[['mias','Las mías',mine]]:[])]:[];
    if(!tabs.some(([id])=>id===filter))filter='todas';
    const list=all.map((p,index)=>({p,place:index+1})).filter(({p})=>filter==='todas'||(filter==='mias'?p.mine:!p.mine&&!p.voted));
    const items=list.map(({p,place})=>card(p,{place,top,cut})
      +(filter==='todas'&&place===WINNERS&&all.length>WINNERS?'<li class="community-cut" aria-hidden="true"><span>Hasta aquí salen el lunes</span></li>':'')).join('');
    return `${tabs.length>1?`<div class="community-tabs" role="group" aria-label="Filtrar las propuestas">${tabs.map(([id,label,count])=>`<button type="button" aria-pressed="${id===filter}" data-community-filter="${id}">${label} <span>${count}</span></button>`).join('')}</div>`:''}
${items?`<ol class="community-list">${items}</ol>`:`<p class="duel-note">${filter==='pendientes'?'Ya has votado todas las que podías. Vuelve más tarde, que llegarán más.':'No hay ninguna aquí.'}</p>`}`;
  }

  function preview({title,unit,note}={}){
    const text=polish(title);
    if(!text)return '';
    return `<span class="community-preview-label">Así la verán los demás</span><p class="community-question">${escapeHtml(text)}</p><p class="community-unit">Se responde en ${escapeHtml(String(unit||'').trim()||'…')}${String(note||'').trim()?` · ${escapeHtml(String(note).trim())}`:''}</p>`;
  }
  function form(){
    const r=round,rules=r.rules,mine=r.proposals.filter(p=>p.mine).length,left=Math.max(0,rules.maxProposals-mine);
    if(!r.account)return `<div class="community-login"><p><b>Entra con tu cuenta para proponer y votar.</b> Los votos se pagan con faradios y tu saldo se guarda en tu cuenta.</p><button class="game-primary" type="button" data-community-login>Entrar o crear cuenta <span aria-hidden="true">→</span></button></div>`;
    if(!left)return `<p class="community-note">Ya has propuesto ${rules.maxProposals} preguntas esta semana. Ahora, ¡a votar las de los demás!</p>`;
    const draft=readDraft(),short=Number.isInteger(r.coins)&&r.coins<rules.proposeCost;
    return `<details class="community-compose"${draft.title||!r.proposals.length?' open':''}><summary><span>Propón tu pregunta</span><small>${left===1?'Te queda':'Te quedan'} ${left} de ${rules.maxProposals} esta semana</small></summary>
<form class="community-form" id="community-form">
<div class="community-ideas"><span>¿Sin ideas? Prueba con:</span>${IDEAS.map((idea,index)=>`<button type="button" class="community-idea" data-community-idea="${index}">${escapeHtml(idea.title)}</button>`).join('')}</div>
<label class="duel-name-field"><span>Tu pregunta <small class="community-count" id="community-count">${(draft.title||'').length}/160</small></span><textarea id="community-title" maxlength="160" rows="2" required placeholder="¿Cuántos plátanos mide la Torre Eiffel?">${escapeHtml(draft.title||'')}</textarea></label>
<div class="community-row"><label class="duel-name-field"><span>Se responde en…</span><input id="community-unit" type="text" maxlength="24" required placeholder="plátanos, km, personas…" value="${escapeHtml(draft.unit||'')}"></label>
<label class="duel-name-field"><span>Sale con tu nombre</span><input id="community-name" type="text" maxlength="16" required autocomplete="nickname" value="${escapeHtml(readName())}" placeholder="Tu apodo"></label></div>
<label class="duel-name-field"><span>Aclaración (opcional)</span><input id="community-note" type="text" maxlength="280" placeholder="Por ejemplo: plátanos puestos de punta" value="${escapeHtml(draft.note||'')}"></label>
<div class="community-preview" id="community-preview">${preview(draft)}</div>
<p class="community-small">Funciona mejor si la respuesta es <b>un solo número</b> que se pueda buscar en fuentes fiables y si sorprende un poco.</p>
<div class="community-submit"><button class="game-primary" type="submit"${short?' disabled':''}>Proponer · ${coins(rules.proposeCost)}</button>
<p class="community-small">${short?`Te faltan <b>${rules.proposeCost-r.coins} ≈</b>. Juega el reto, duelos y misiones para ganar más.`:'La IA la revisa al momento: si no encaja (no tiene una cifra comprobable o no es apropiada), no se cobra.'}</p></div></form></details>`;
  }

  const totals=r=>r.proposals.length?`${r.proposals.length} ${r.proposals.length===1?'propuesta':'propuestas'} · ${votes(r.proposals.reduce((sum,p)=>sum+p.votes,0))}`:'';
  function render(message=''){
    const r=round,rules=r.rules,sunday=!r.previous.resolved;
    const previous=sunday
      ?`<div class="community-note">La votación de la semana pasada ya está cerrada: la IA está resolviendo las más votadas y salen <b>mañana, ${longDate(r.previous.round)}</b>, en el reto de hoy.</div>`
      :r.previous.winners.length?`<details class="community-past"><summary>Salieron el ${longDate(r.previous.round)}</summary><ul class="community-list">${r.previous.winners.map(p=>card(p,{winner:true})).join('')}</ul></details>`:'';
    content.innerHTML=`<p class="duel-kicker">Preguntas de la comunidad</p>
<h2 id="community-title-h">Tú preguntas, todos votan. <em>El lunes, al reto.</em></h2>
<p class="community-lead">Las <b>3 más votadas</b> de la semana salen el lunes en el reto de todos, con el nombre y el avatar de quien las propuso. La IA busca la cifra en fuentes fiables y explica cómo se llega a ella.</p>
<ol class="community-steps" aria-label="Cómo funciona, en tres pasos">
<li><b>Propón</b><span>${coins(rules.proposeCost)}</span></li><li><b>Vota</b><span>${coins(rules.voteCost)} por voto</span></li><li><b>Sale el lunes</b><span>+${coins(rules.authorPrize)} para quien la propuso</span></li></ol>
<div class="community-meta"><span class="community-clock">${countdown(r)}</span>${r.account&&Number.isInteger(r.coins)?`<span class="coin-pill" id="community-coins">${coins(r.coins)}</span>`:''}</div>
${previous}
${form()}
<p class="form-error" id="community-error" role="alert">${escapeHtml(message)}</p>
<div class="community-head"><h3 class="league-subtitle">Propuestas para el ${longDate(r.round)}</h3><span id="community-totals">${totals(r)}</span></div>
<div id="community-ranking">${ranking()}</div>
<details class="league-rules"><summary>Cómo funciona</summary><ul>
<li>Proponer cuesta <b>${rules.proposeCost} faradios</b> y votar, <b>${rules.voteCost}</b> por voto. Puedes proponer hasta ${rules.maxProposals} por semana y votar todas las que quieras, una vez cada una, pero no las tuyas.</li>
<li>La votación va del domingo al sábado (hora de Madrid). El domingo la IA resuelve las más votadas y el lunes salen en el reto.</li>
<li>A igualdad de votos va delante la que se propuso antes. Si la IA no encuentra una cifra fiable para una pregunta, pasa a la siguiente más votada.</li>
<li>Las propuestas que no salen no devuelven los faradios.</li>
<li>Para proponer y votar hace falta cuenta: así tu saldo de faradios se guarda en el servidor y nadie puede inventarse votos.</li></ul></details>`;
  }
  // Solo la clasificación, el recuento y el saldo: el formulario (y lo que se esté escribiendo) no se toca.
  function refreshRanking(){
    $('#community-ranking').innerHTML=ranking();
    $('#community-totals').textContent=totals(round);
    const pill=$('#community-coins');if(pill&&Number.isInteger(round.coins))pill.innerHTML=coins(round.coins);
  }

  async function load(message=''){
    const token=++seq;
    if(!round)content.innerHTML='<p class="duel-kicker">Preguntas de la comunidad</p><p class="duel-note">Cargando las propuestas…</p>';
    const response=await call('ronda');if(shell.hidden||token!==seq)return;
    if(!response.ok){content.innerHTML=`<p class="duel-kicker">Preguntas de la comunidad</p><h2 id="community-title-h">${escapeHtml(response.data.error||'No se han podido cargar las propuestas.')}</h2><p class="duel-note">El reto diario sigue funcionando. Vuelve a intentarlo más tarde.</p><button class="game-secondary" type="button" data-community="retry">Reintentar</button>`;return}
    round=response.data;
    if(round.account&&Number.isInteger(round.coins)&&window.Progress?.linked())Progress.serverCoins(round.coins);
    render(message);
  }
  async function act(action,extra){
    if(busy)return null;busy=true;shell.classList.add('is-busy');say(action==='proponer'?'Revisando tu pregunta…':'');
    const response=await call(action,extra);busy=false;shell.classList.remove('is-busy');
    if(!response.ok){
      say(response.data.code==='saldo'?`${response.data.error} Juega el reto, duelos y misiones para ganar más.`:response.data.error||'No se ha podido completar.');
      if(response.data.code==='cuenta')load();
      return null;
    }
    say('');
    if(window.Progress)Progress.serverCoins(response.data.coins);
    return response.data;
  }
  // Tras votar: se apunta el voto, se recoloca la propuesta (más votos primero; a igualdad, el orden que ya traía)
  // y se repinta la clasificación sin recargar la pantalla.
  function voted(id,data){
    const r=round,order=new Map(r.proposals.map((p,index)=>[p.id,index])),p=r.proposals.find(item=>item.id===id);
    if(!p)return;
    p.voted=true;p.votes=Number.isInteger(data.votes)?data.votes:p.votes+1;
    if(Number.isInteger(data.coins))r.coins=data.coins;
    r.proposals.sort((a,b)=>b.votes-a.votes||order.get(a.id)-order.get(b.id));
    refreshRanking();
    content.querySelector(`.community-card[data-id="${id}"]`)?.classList.add('is-bumped');
  }

  function open(){
    shell.hidden=false;document.body.classList.add('modal-open');
    if(typeof toggleMenu==='function')toggleMenu(false);
    $('#community-close').focus();load();
  }
  function close(){
    shell.hidden=true;seq++;
    if($('#game-shell').hidden&&$('#duel-shell').hidden)document.body.classList.remove('modal-open');
  }
  const formValues=()=>({title:$('#community-title')?.value||'',unit:$('#community-unit')?.value||'',note:$('#community-note')?.value||''});
  function typed(){
    const values=formValues();
    writeDraft(values.title||values.unit||values.note?values:null);
    const count=$('#community-count');if(count)count.textContent=`${values.title.length}/160`;
    const box=$('#community-preview');if(box)box.innerHTML=preview(values);
  }
  shell.addEventListener('click',async event=>{
    const id=event.target.closest('[data-community-vote]')?.dataset.communityVote;
    if(id){const done=await act('votar',{id});if(done){showToast('¡Voto dado! −'+round.rules.voteCost+' ≈');voted(id,done)}return}
    const tab=event.target.closest('[data-community-filter]')?.dataset.communityFilter;
    if(tab){filter=tab;$('#community-ranking').innerHTML=ranking();$(`[data-community-filter="${tab}"]`)?.focus();return}
    const idea=event.target.closest('[data-community-idea]')?.dataset.communityIdea;
    if(idea!==undefined){const pick=IDEAS[Number(idea)];$('#community-title').value=pick.title;$('#community-unit').value=pick.unit;typed();$('#community-title').focus();return}
    if(event.target.closest('[data-community="retry"]'))load();
    // El diálogo de la cuenta se abre encima; al entrar, faraday:cuenta vuelve a cargar la ronda.
    if(event.target.closest('[data-community-login]'))$('#menu-account').click();
  });
  content.addEventListener('input',event=>{if(event.target.closest('#community-form'))typed()});
  content.addEventListener('submit',async event=>{
    if(event.target.id!=='community-form')return;event.preventDefault();
    const name=$('#community-name').value.replace(/\s+/g,' ').trim().slice(0,16);if(name)writeName(name);
    const look=window.Progress?{...Progress.look(),badge:Progress.badge()}:{};
    const done=await act('proponer',{...formValues(),name,avatar:look});
    if(done){writeDraft(null);filter='todas';showToast('¡Pregunta enviada! Que empiecen los votos.');load()}
  });
  $('#community-close').addEventListener('click',close);
  document.querySelectorAll('[data-open-community]').forEach(button=>button.addEventListener('click',open));
  // Al entrar o salir de la cuenta con la pantalla abierta, se vuelve a pedir la ronda.
  document.addEventListener('faraday:progreso',()=>{if(!shell.hidden)load()});
  document.addEventListener('faraday:cuenta',()=>{if(!shell.hidden)load()});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!shell.hidden){event.stopImmediatePropagation();close()}},true);
})();

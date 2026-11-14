// Preguntas de la comunidad (decisión 0052). Los jugadores con cuenta proponen preguntas y votan las de los demás
// con faradios; las 3 más votadas de la semana salen el lunes en el reto, resueltas por la IA con sus fuentes y el
// cálculo paso a paso. El servidor manda (lib/comunidad.mjs): cobra del saldo de la cuenta y decide la ronda abierta.
// El apodo es el mismo de los duelos y las ligas, y el avatar, el del armario.
(()=>{
  const shell=$('#community-shell'),content=$('#community-content');
  const PROFILE='casi-casi:duelo:perfil';
  const readName=()=>{try{const value=JSON.parse(localStorage.getItem(PROFILE));if(typeof value?.name==='string'&&value.name.trim())return value.name}catch{}return ''};
  const writeName=value=>{let profile={};try{profile=JSON.parse(localStorage.getItem(PROFILE))||{}}catch{}try{localStorage.setItem(PROFILE,JSON.stringify({...profile,name:value}))}catch{}};
  const avatar=(look,size='small')=>`<span class="duel-avatar ${size}" aria-hidden="true">${window.Avatar?Avatar.render(look||{},{bust:true}):''}</span>`;
  const badge=look=>window.Medals?Medals.chip(look?.badge):'';
  const COIN='<span class="coin" aria-hidden="true">≈</span>';
  const longDate=id=>new Intl.DateTimeFormat('es-ES',{weekday:'long',day:'numeric',month:'long',timeZone:'Europe/Madrid'}).format(new Date(id+'T12:00:00Z'));
  const votes=n=>`${n} ${n===1?'voto':'votos'}`;
  let round=null,busy=false,seq=0;

  async function call(action,extra={}){
    try{
      await playerReady;
      const response=await fetch('/api/comunidad',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify({action,...extra}),signal:AbortSignal.timeout(action==='proponer'?60000:10000)});
      return {ok:response.ok,status:response.status,data:await response.json()};
    }catch{return {ok:false,status:0,data:{error:'Sin conexión con el servidor'}}}
  }
  const say=text=>{const error=$('#community-error');if(error)error.textContent=text||'';else if(text)showToast(text)};

  function card(p,{winner=false}={}){
    const action=winner?'':p.mine?'<span class="community-tag">Tuya</span>'
      :p.voted?'<span class="community-tag is-voted">Votada ✓</span>'
      :round?.account?`<button class="game-secondary community-vote" type="button" data-community-vote="${p.id}">Votar · ${round.rules.voteCost} ${COIN}<span class="sr-only"> faradios</span></button>`:'';
    return `<li class="community-card${p.mine?' is-mine':''}">
<div class="community-author">${avatar(p.avatar)}<span><b>${escapeHtml(p.name)}${badge(p.avatar)}</b><small>${winner?'Salió en el reto':'propone'}</small></span><strong class="community-votes">${votes(p.votes)}</strong></div>
<p class="community-question">${escapeHtml(p.title)}</p><p class="community-unit">Se responde en ${escapeHtml(p.unit)}${p.note?` · ${escapeHtml(p.note)}`:''}</p>${action}</li>`;
  }

  function render(message=''){
    const r=round,rules=r.rules,mine=r.proposals.filter(p=>p.mine).length,left=Math.max(0,rules.maxProposals-mine);
    const sunday=!r.previous.resolved;
    const previous=sunday
      ?`<div class="community-note">La votación de la semana pasada ya está cerrada: la IA está resolviendo las más votadas y salen <b>mañana, ${longDate(r.previous.round)}</b>, en el reto de hoy.</div>`
      :r.previous.winners.length?`<h3 class="league-subtitle">Salieron el ${longDate(r.previous.round)}</h3><ul class="community-list">${r.previous.winners.map(p=>card(p,{winner:true})).join('')}</ul>`:'';
    const form=!r.account
      ?`<div class="community-login"><p><b>Entra con tu cuenta para proponer y votar.</b> Los votos se pagan con faradios y tu saldo se guarda en tu cuenta.</p><button class="game-primary" type="button" data-community-login>Entrar o crear cuenta <span aria-hidden="true">→</span></button></div>`
      :left?`<form class="community-form" id="community-form">
<label class="duel-name-field"><span>Tu pregunta</span><textarea id="community-title" maxlength="160" rows="2" required placeholder="¿Cuántos plátanos mide la Torre Eiffel?"></textarea></label>
<div class="community-row"><label class="duel-name-field"><span>Se responde en…</span><input id="community-unit" type="text" maxlength="24" required placeholder="plátanos, km, personas…"></label>
<label class="duel-name-field"><span>Sale con tu nombre</span><input id="community-name" type="text" maxlength="16" required autocomplete="nickname" value="${escapeHtml(readName())}" placeholder="Tu apodo"></label></div>
<label class="duel-name-field"><span>Aclaración (opcional)</span><input id="community-note" type="text" maxlength="280" placeholder="Por ejemplo: plátanos puestos de punta"></label>
<button class="game-primary" type="submit">Proponer · ${rules.proposeCost} ${COIN}<span class="sr-only"> faradios</span></button>
<p class="community-small">Te ${left===1?'queda':'quedan'} ${left} de ${rules.maxProposals} esta semana. La IA la revisa al momento: si no encaja (no tiene una cifra comprobable o no es apropiada), no se cobra.</p></form>`
      :`<p class="duel-note">Ya has propuesto ${rules.maxProposals} preguntas esta semana. Ahora, ¡a votar!</p>`;
    content.innerHTML=`<p class="duel-kicker">Preguntas de la comunidad</p>
<h2 id="community-title-h">Tú preguntas, todos votan. <em>El lunes, al reto.</em></h2>
<p class="community-lead">Las <b>3 más votadas</b> de la semana salen el lunes en el reto de todos, con tu nombre y tu avatar. La IA busca la cifra en fuentes fiables y explica cómo se llega a ella. Si sale la tuya, ganas <b>${rules.authorPrize} ${COIN}</b>.</p>
<div class="community-meta"><span>Votación abierta hasta el <b>${longDate(r.closes)}</b> a medianoche</span>${r.account&&Number.isInteger(r.coins)?`<span class="coin-pill">${r.coins} ${COIN}<span class="sr-only"> faradios</span></span>`:''}</div>
${previous}
${form}
<p class="form-error" id="community-error" role="alert">${escapeHtml(message)}</p>
<h3 class="league-subtitle">Propuestas para el ${longDate(r.round)}</h3>
${r.proposals.length?`<ul class="community-list">${r.proposals.map(p=>card(p)).join('')}</ul>`:'<p class="duel-note">Aún no hay ninguna. ¡Estrena la semana con la tuya!</p>'}
<details class="league-rules"><summary>Cómo funciona</summary><ul>
<li>Proponer cuesta <b>${rules.proposeCost} faradios</b> y votar, <b>${rules.voteCost}</b> por voto. Puedes votar todas las que quieras, una vez cada una, pero no las tuyas.</li>
<li>La votación va del domingo al sábado (hora de Madrid). El domingo la IA resuelve las más votadas y el lunes salen en el reto.</li>
<li>Si la IA no encuentra una cifra fiable para una pregunta, pasa a la siguiente más votada.</li>
<li>Para proponer y votar hace falta cuenta: así tu saldo de faradios se guarda en el servidor y nadie puede inventarse votos.</li></ul></details>`;
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
    if(window.Progress)Progress.serverCoins(response.data.coins);
    return response.data;
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
  shell.addEventListener('click',async event=>{
    const id=event.target.closest('[data-community-vote]')?.dataset.communityVote;
    if(id){const done=await act('votar',{id});if(done){showToast('¡Voto dado! −'+round.rules.voteCost+' ≈');load()}return}
    if(event.target.closest('[data-community="retry"]'))load();
    // El diálogo de la cuenta se abre encima; al entrar, faraday:cuenta vuelve a cargar la ronda.
    if(event.target.closest('[data-community-login]'))$('#menu-account').click();
  });
  content.addEventListener('submit',async event=>{
    if(event.target.id!=='community-form')return;event.preventDefault();
    const name=$('#community-name').value.replace(/\s+/g,' ').trim().slice(0,16);if(name)writeName(name);
    const look=window.Progress?{...Progress.look(),badge:Progress.badge()}:{};
    const done=await act('proponer',{title:$('#community-title').value,unit:$('#community-unit').value,note:$('#community-note').value,name,avatar:look});
    if(done){showToast('¡Pregunta enviada! Que empiecen los votos.');load()}
  });
  $('#community-close').addEventListener('click',close);
  document.querySelectorAll('[data-open-community]').forEach(button=>button.addEventListener('click',open));
  // Al entrar o salir de la cuenta con la pantalla abierta, se vuelve a pedir la ronda.
  document.addEventListener('faraday:progreso',()=>{if(!shell.hidden)load()});
  document.addEventListener('faraday:cuenta',()=>{if(!shell.hidden)load()});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!shell.hidden){event.stopImmediatePropagation();close()}},true);
})();

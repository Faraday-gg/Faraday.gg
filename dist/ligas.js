// Ligas de amigos (decisión 0031). El servidor manda (lib/ligas.mjs): calcula la clasificación semanal con las
// respuestas guardadas; aquí solo se pide y se pinta. El apodo es el mismo de los duelos y el avatar, el del armario.
// Enlace de invitación: ?liga=CÓDIGO. Al abrir la app en una semana nueva se enseña el resumen de la anterior.
(()=>{
  const KEY='casi-casi:ligas:',shell=$('#league-shell'),content=$('#league-content');
  const saved={get(key,fallback){try{return JSON.parse(localStorage.getItem(KEY+key))??fallback}catch{return fallback}},set(key,value){try{localStorage.setItem(KEY+key,JSON.stringify(value))}catch{}}};
  const PROFILE='casi-casi:duelo:perfil'; // apodo compartido con los duelos
  const readName=()=>{try{const value=JSON.parse(localStorage.getItem(PROFILE));if(typeof value?.name==='string'&&value.name.trim())return value.name}catch{}return ''};
  let nickname=readName(),invite=null,current=null,busy=false,seq=0; // seq: descarta respuestas que llegan tarde
  const DAY=86400000,shift=(id,n)=>new Date(Date.parse(id+'T12:00:00Z')+n*DAY).toISOString().slice(0,10);
  const monday=id=>shift(id,-((new Date(id+'T12:00:00Z').getUTCDay()+6)%7));
  const shortDate=id=>new Intl.DateTimeFormat('es-ES',{day:'numeric',month:'long',timeZone:'Europe/Madrid'}).format(new Date(id+'T12:00:00Z'));
  const WEEKDAYS=['L','M','X','J','V','S','D'];
  const times=n=>n==null?'—':format(n)+'×';
  const ordinal=n=>n+'º';
  const avatar=(look,size='small')=>`<span class="duel-avatar ${size}" aria-hidden="true">${window.Avatar?Avatar.render(look||{},{bust:true}):''}</span>`;
  const identity=()=>({name:nickname||'Jugador',avatar:window.Progress?Progress.look():{}});

  async function call(action,extra={}){
    try{
      await playerReady;
      const response=await fetch('/api/liga',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,player:playerId(),...extra}),signal:AbortSignal.timeout(8000)});
      return {ok:response.ok,status:response.status,data:await response.json()};
    }catch{return {ok:false,status:0,data:{error:'Sin conexión con el servidor'}}}
  }
  // Se recuerdan los códigos de tus ligas para no preguntar al servidor por el resumen si no estás en ninguna.
  const remember=codes=>saved.set('mias',codes);
  const known=()=>saved.get('mias',[]);

  function saveName(){
    const input=$('#league-name');if(!input)return;
    const value=input.value.replace(/\s+/g,' ').trim().slice(0,16);if(!value)return;nickname=value;
    let profile={};try{profile=JSON.parse(localStorage.getItem(PROFILE))||{}}catch{}
    try{localStorage.setItem(PROFILE,JSON.stringify({...profile,name:value}))}catch{}
    syncProfile();
  }
  // Si cambias de apodo o de avatar, se actualiza en todas tus ligas.
  async function syncProfile(){
    if(!known().length)return;
    const sent=JSON.stringify(identity());if(saved.get('perfil','')===sent)return;
    const response=await call('perfil',identity());if(response.ok)saved.set('perfil',sent);
  }

  const nameField=()=>`<label class="duel-name-field league-name-field"><span>Tu apodo en las ligas</span><input id="league-name" type="text" maxlength="16" autocomplete="nickname" placeholder="Cómo te verán tus amigos" value="${escapeHtml(nickname)}"></label>`;
  const rules=`<details class="league-rules"><summary>Cómo se puntúa</summary><ul>
<li>La clasificación va de <b>lunes a domingo</b> (hora de Madrid) y empieza de cero cada semana.</li>
<li>Cuenta tu <b>distancia media del reto de cada día</b>, jugado ese mismo día. Lo que juegas desde el archivo no cuenta.</li>
<li>Un día que no juegas cuenta como <b>la peor distancia de la liga ese día</b>, y nunca menos de 10×. Saltarse un día nunca sale mejor que jugarlo.</li>
<li>Gana la media más baja. Si hay empate, quien jugó más días.</li></ul></details>`;

  function renderLobby(message='',leagues=null){
    current=null;shell.dataset.screen='lobby';
    const list=leagues?leagues.length?`<ul class="league-list">${leagues.map(league=>`<li><button type="button" class="league-item" data-league-open="${league.code}">
<span class="league-item-main"><b>${escapeHtml(league.name)}</b><small>${league.members} ${league.members===1?'persona':'personas'}${league.position?` · vas ${ordinal(league.position)}`:''}${league.average!=null?` · ${times(league.average)}`:''}</small></span>
${league.leader?`<span class="league-item-leader" title="Va primero: ${escapeHtml(league.leader.name)}">${avatar(league.leader.avatar,'tiny')}<small>${league.leader.you?'Tú':escapeHtml(league.leader.name)}</small></span>`:''}<span aria-hidden="true">→</span></button></li>`).join('')}</ul>`
      :'<p class="duel-note">Aún no estás en ninguna liga. Crea una y comparte el enlace con tu grupo.</p>'
      :'<p class="duel-note league-loading">Cargando tus ligas…</p>';
    const inviteCard=invite?`<div class="duel-invite league-invite">${invite.full?`<p><strong>«${escapeHtml(invite.name)}» está completa.</strong> Ya tiene ${invite.max} personas.</p>`
      :`<p><strong>Te han invitado a «${escapeHtml(invite.name)}».</strong> ${invite.members} de ${invite.max} personas.</p><button class="game-primary" type="button" data-league="accept">Unirme a la liga <span aria-hidden="true">→</span></button>`}</div>`:'';
    content.innerHTML=`<p class="duel-kicker">Ligas con amigos</p>
<h2 id="league-title">Tu grupo, cada semana. <em>Gana quien más se acerca.</em></h2>
${inviteCard}${nameField()}
<p class="form-error" id="league-error" role="alert">${escapeHtml(message)}</p>
<h3 class="league-subtitle">Tus ligas</h3>${list}
<form class="league-create" id="league-create"><label for="league-new">Crear una liga</label><div class="league-row"><input id="league-new" type="text" maxlength="24" autocomplete="off" placeholder="Nombre, p. ej. «Los del curro»" required><button class="game-primary" type="submit">Crear</button></div></form>
<form class="duel-join league-join" id="league-join"><label class="sr-only" for="league-code">Código de liga</label><input id="league-code" type="text" maxlength="6" autocomplete="off" autocapitalize="characters" placeholder="¿Tienes un código?"><button class="game-secondary" type="submit">Unirme</button></form>
${rules}`;
  }
  async function loadLobby(message=''){
    renderLobby(message,null);const token=++seq;
    const response=await call('mias');if(shell.hidden||current||token!==seq)return;
    if(!response.ok){
      // Sin servidor de ligas (por ejemplo, 503 mientras la migración no está aplicada) no se ofrece crear ni unirse.
      content.innerHTML=`<p class="duel-kicker">Ligas con amigos</p><h2 id="league-title">${escapeHtml(response.data.error||'No se han podido cargar tus ligas.')}</h2><p class="duel-note">El reto diario y los duelos siguen funcionando. Vuelve a intentarlo más tarde.</p><button class="game-secondary" type="button" data-league="retry">Reintentar</button>`;
      return;
    }
    remember(response.data.leagues.map(league=>league.code));renderLobby(message,response.data.leagues);syncProfile();
  }

  function dayCell(day,id,today,from){
    const label=new Intl.DateTimeFormat('es-ES',{weekday:'long',timeZone:'Europe/Madrid'}).format(new Date(id+'T12:00:00Z'));
    if(day?.played!=null)return `<i class="league-day is-played${day.played<2?' is-good':day.played>=5?' is-bad':''}" title="${label}: ${times(day.played)}"></i>`;
    if(day?.missed!=null)return `<i class="league-day is-missed" title="${label}: sin jugar (cuenta ${times(day.missed)})"></i>`;
    return `<i class="league-day${id===today?' is-today':''}${id<from?' is-before':''}" title="${label}: ${id<from?'antes de crear la liga, no cuenta':id>today?'aún no':'hoy, sin jugar todavía'}"></i>`;
  }
  function renderLeague(league){
    current=league;shell.dataset.screen='league';
    const week=league.week,me=league.rows.find(row=>row.you),playedToday=me?.days[week.days.indexOf(week.today)]?.played!=null;
    const today=typeof currentDay!=='undefined'&&currentDay&&!playedToday?`<button class="game-primary league-play" type="button" data-league="play">Jugar el reto de hoy <span aria-hidden="true">→</span></button>`:'';
    content.innerHTML=`<button class="duel-link league-back" type="button" data-league="back">← Tus ligas</button>
<p class="duel-kicker">Semana del ${shortDate(week.start)} al ${shortDate(week.end)}</p>
<h2 id="league-title">${escapeHtml(league.name)}</h2>
<div class="league-share"><span class="league-code" aria-label="Código de la liga">${league.code}</span><span class="league-count">${league.members} de ${league.max}</span><button class="${league.members===1?'game-primary':'game-secondary'}" type="button" data-league="share">Invitar a tu grupo</button></div>
${league.members===1?'<p class="duel-note">Comparte el enlace con tu grupo: entran con un toque y sin registrarse.</p>':''}
${today}
<ol class="league-table" aria-label="Clasificación de la semana">
<li class="league-head" aria-hidden="true"><span></span><span></span><span class="league-week">${WEEKDAYS.map(d=>`<i>${d}</i>`).join('')}</span><span>Media</span></li>
${league.rows.map(row=>`<li class="league-row-item${row.you?' is-you':''}"><span class="league-pos">${row.average==null?'–':ordinal(row.position)}</span>
<span class="league-who">${avatar(row.avatar)}<span><b>${escapeHtml(row.name)}${row.you?' <small>(tú)</small>':''}</b><small>${row.played} ${row.played===1?'día':'días'}</small></span></span>
<span class="league-week" aria-label="${row.played} de 7 días jugados">${row.days.map((day,i)=>dayCell(day,week.days[i],week.today,week.from||week.start)).join('')}</span>
<strong class="league-avg">${times(row.average)}</strong></li>`).join('')}
</ol>
<p class="league-legend"><i class="league-day is-played is-good"></i> jugado <i class="league-day is-missed"></i> sin jugar: cuenta la peor distancia del día (mín. ${league.missed}×)</p>
${rules}
<button class="duel-link league-leave" type="button" data-league="leave">Salir de la liga</button>`;
  }
  async function openLeague(code){
    const token=++seq,response=await call('ver',{code});if(shell.hidden||token!==seq)return;
    if(!response.ok){loadLobby(response.data.error||'No se ha podido abrir la liga.');return}
    if(!response.data.member){invite=response.data;loadLobby();return}
    renderLeague(response.data);
  }

  // Resumen de la semana pasada: el ganador (o los ganadores, si empatan) con su avatar y tu puesto.
  function renderSummary(data){
    current=null;shell.dataset.screen='summary';
    content.innerHTML=`<p class="duel-kicker">Semana del ${shortDate(data.week.start)} al ${shortDate(data.week.end)}</p>
<h2 id="league-title">Así acabó la semana</h2>
${data.leagues.map(league=>{const top=league.winners[0],won=league.winners.some(w=>w.you);return `<section class="league-summary${won?' is-winner':''}">
<p class="league-summary-name">${escapeHtml(league.name)}</p>
<div class="league-summary-winner">${avatar(top.avatar,'big')}<span class="league-crown" aria-hidden="true">👑</span></div>
<p class="league-summary-text">${won?'<b>¡Has ganado!</b>':`Ganó <b>${league.winners.map(w=>escapeHtml(w.name)).join(' y ')}</b>`} con ${times(top.average)}</p>
<p class="league-summary-you">${won?`${league.total} personas en la liga`:`Quedaste <b>${ordinal(league.position)}</b> de ${league.total} · ${times(league.average)}`}</p>
<button class="game-secondary" type="button" data-league-open="${league.code}">Ver la liga de esta semana</button></section>`}).join('')}
<button class="game-primary league-summary-close" type="button" data-league="close">Seguir</button>`;
  }
  async function checkSummary(){
    if(!known().length||typeof todayKey==='undefined')return;
    const last=shift(monday(todayKey),-7);if(saved.get('resumen','')===last)return;
    const response=await call('resumen');if(!response.ok)return;
    saved.set('resumen',response.data.week.start);
    if(response.data.leagues.length&&shell.hidden&&$('#game-shell').hidden){open();renderSummary(response.data)}
  }

  async function act(action,extra={}){
    if(busy)return null;busy=true;saveName();shell.classList.add('is-busy');
    const response=await call(action,{...identity(),...extra});busy=false;shell.classList.remove('is-busy');
    if(!response.ok){const error=$('#league-error');if(error)error.textContent=response.data.error||'No se ha podido completar.';else showToast(response.data.error||'No se ha podido completar.');return null}
    return response.data;
  }
  async function share(league){
    const url=`${location.origin}${location.pathname}?liga=${league.code}`,text=`Únete a mi liga «${league.name}» en Faraday.gg: tres estimaciones al día y clasificación cada semana. Código ${league.code}`;
    try{if(navigator.share){await navigator.share({title:'Liga en Faraday.gg',text,url});return}await navigator.clipboard.writeText(`${text}\n${url}`);showToast('Enlace copiado. Pégalo en tu grupo de WhatsApp.')}
    catch(error){if(error?.name!=='AbortError')showToast('No se pudo compartir ahora mismo.')}
  }
  function open(){
    shell.hidden=false;document.body.classList.add('modal-open');
    if(typeof toggleMenu==='function')toggleMenu(false);
    $('#league-close').focus();
  }
  function close(){
    shell.hidden=true;current=null;invite=null;seq++;
    if($('#game-shell').hidden&&$('#duel-shell').hidden)document.body.classList.remove('modal-open');
  }

  shell.addEventListener('click',async event=>{
    const opener=event.target.closest('[data-league-open]');if(opener){openLeague(opener.dataset.leagueOpen);return}
    const action=event.target.closest('[data-league]')?.dataset.league;if(!action)return;
    if(action==='retry')loadLobby();
    if(action==='back'||action==='close'){if(action==='close'&&shell.dataset.screen==='summary'){close();return}loadLobby()}
    if(action==='accept'){const league=await act('unirse',{code:invite.code});if(league){invite=null;remember([...new Set([...known(),league.code])]);renderLeague(league);showToast(`Ya estás en «${league.name}».`)}}
    if(action==='share'&&current)share(current);
    if(action==='play'){close();if(currentDay)openDay(currentDay)}
    if(action==='leave'&&current&&window.confirm(`¿Salir de «${current.name}»? Podrás volver a entrar con el código si queda sitio.`)){
      const code=current.code;if(await act('salir',{code})){remember(known().filter(c=>c!==code));showToast('Has salido de la liga.');loadLobby()}
    }
  });
  content.addEventListener('submit',async event=>{
    event.preventDefault();
    if(event.target.id==='league-create'){const league=await act('crear',{leagueName:$('#league-new').value});if(league){remember([...new Set([...known(),league.code])]);renderLeague(league)}}
    if(event.target.id==='league-join'){const league=await act('unirse',{code:$('#league-code').value});if(league){remember([...new Set([...known(),league.code])]);renderLeague(league)}}
  });
  content.addEventListener('input',event=>{if(event.target.id==='league-code')event.target.value=event.target.value.toUpperCase().replace(/[^A-Z0-9]/g,'')});
  content.addEventListener('change',event=>{if(event.target.id==='league-name')saveName()});
  $('#league-close').addEventListener('click',close);
  document.querySelectorAll('[data-open-league]').forEach(button=>button.addEventListener('click',()=>{nickname=readName()||nickname;open();loadLobby()}));
  document.addEventListener('faraday:look',()=>syncProfile());
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!shell.hidden&&$('#profile-shell').hidden){event.stopImmediatePropagation();close()}},true);

  // Enlace de invitación: ?liga=CÓDIGO abre la invitación; si no, al cargar se mira si hay resumen de la semana pasada.
  const invited=(new URLSearchParams(location.search).get('liga')||'').toUpperCase();
  if(/^[A-Z2-9]{6}$/.test(invited)){
    history.replaceState(history.state,'',location.pathname);open();
    (async()=>{const response=await call('ver',{code:invited});
      if(response.ok&&response.data.member){remember([...new Set([...known(),invited])]);renderLeague(response.data)}
      else{if(response.ok)invite=response.data;await loadLobby(response.ok?'':response.data.error||'')}})();
  }else checkSummary();
})();

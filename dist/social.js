// Amistades mediante enlace, actividad y chat directo con cuentas de Faraday.
// La lista de amigos se pinta en dos sitios con una sola petición («amigos»): en el cajón (#social-friends) y, compacta,
// en el bloque «Con amigos» de la portada (#portal-friends, que se crea aquí). En los dos va separada en «En línea» y
// «Desconectados», con la cara de cada amigo en un círculo (su avatar; el propio viaja en el pulso). Estilos: amigos.css.
(()=>{
  const drawer=$('#social-drawer'),friendsSection=$('#social-friends'),chat=$('#social-chat');
  const feedback=$('#social-feedback'),messages=chat.querySelector('.social-messages'),form=$('#social-message-form');
  const field=$('#social-message'),send=form.querySelector('button');
  const invitePattern=/^#amigo=([a-f0-9]{32})$/;
  const date=new Intl.DateTimeFormat('es-ES',{day:'numeric',month:'short',timeZone:'Europe/Madrid'});
  const hour=new Intl.DateTimeFormat('es-ES',{hour:'2-digit',minute:'2-digit',timeZone:'Europe/Madrid'});
  const escape=escapeHtml;
  let invite=null,enabled=null,friends=[],friend=null,opener=null;
  let generation=0,chatRequest=0,busy=false,sendRetry=null,lastInteraction=Date.now(),pendingLogin=false;
  // list = la última respuesta de «amigos» (se conserva si un refresco falla); listError = por qué no hay lista;
  // loading = la carga en curso (nunca hay dos a la vez); era = cambia con la cuenta, para descartar respuestas de la
  // anterior; known = ya se sabe si hay cuenta; wantInvite = abrir el cajón por «Invitar a un amigo»; sentLook = el
  // aspecto del avatar que ya se envió.
  let list=null,listError='',loading=null,era=0,known=false,wantInvite=false,sentLook='';
  // La lista de la portada: se inserta en «Con amigos», entre el botón y los atajos. PORTAL_MAX = amigos por grupo.
  const PORTAL_MAX=6,portalHost=document.querySelector('.portal-social'),portal=portalHost?document.createElement('div'):null;
  if(portal){
    portal.id='portal-friends';portal.className='portal-friends';
    const actions=portalHost.querySelector('.portal-social-actions');
    if(actions)actions.before(portal);else portalHost.append(portal);
  }

  function consumeInvite(){
    const match=invitePattern.exec(location.hash);
    if(!match)return false;
    invite=match[1];
    try{sessionStorage.setItem('faraday:amigo',invite)}catch{}
    history.replaceState(history.state,'',location.pathname+location.search);
    return true;
  }
  function forgetInvite(){
    invite=null;
    try{sessionStorage.removeItem('faraday:amigo')}catch{}
  }
  function say(message=''){feedback.textContent=message}
  async function call(action,extra={}){
    try{
      const response=await fetch('/api/social',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,...extra}),signal:AbortSignal.timeout(6500)});
      const data=await response.json();
      return {ok:response.ok,status:response.status,...data};
    }catch{return {ok:false,error:'Sin conexión. Inténtalo de nuevo.'}}
  }

  function renderGuest(){
    friendsSection.innerHTML=`<h3>${invite?'Te han invitado a conectar':'Conecta con tus amigos'}</h3>
      <p>Entra con tu cuenta para aceptar invitaciones, ver quién está en línea y chatear.</p>
      <button class="game-primary" type="button" data-social-login>Entrar o crear cuenta</button>`;
  }
  function renderSetup(){
    friendsSection.innerHTML=`<h3>${invite?'Activa tu perfil para aceptar la invitación':'Activa tu perfil de amigos'}</h3>
      <p>Tus amistades podrán ver tu apodo, si estás en línea y cuándo jugaste. Puedes ocultar la actividad en cualquier momento.</p>
      <form id="social-setup"><label for="social-name">Tu apodo</label><input id="social-name" name="nickname" maxlength="24" autocomplete="nickname" required><button class="game-primary" type="submit">Activar amigos</button></form>`;
  }
  function activity(player){
    if(!player.activity)return 'Actividad privada';
    const played=player.played?' · Jugó el '+date.format(new Date(player.played)):'';
    return (player.online?'En línea':'Fuera de línea')+played;
  }
  // La cara del amigo en un círculo, como en «Tu perfil», con el punto de estado. Sin aspecto, el avatar por defecto.
  // El aspecto llega del servidor (lo escribió el navegador del amigo): antes de volverse HTML pasa por
  // Avatar.normalize, que solo deja piezas del catálogo.
  const safeLook=look=>{try{return Avatar.normalize(look&&typeof look==='object'?look:{})}catch{return {}}};
  const face=player=>`<span class="friend-face"><span class="duel-avatar small" aria-hidden="true">${window.Avatar?Avatar.render(safeLook(player.look),{bust:true}):''}</span><i class="social-status-dot friend-dot${player.online?' is-online':''}" aria-hidden="true"></i></span>`;
  const groupsOf=all=>[['online','En línea',all.filter(player=>player.online)],['offline','Desconectados',all.filter(player=>!player.online)]];
  // Lista compacta de la portada. Solo se toca el DOM si cambia algo: el refresco periódico no mueve nada ni roba el foco.
  function paintPortal(){
    if(!portal)return;
    const cta=(action,title,note)=>`<button type="button" class="friends-cta" ${action}><span><b>${title}</b>${note?`<small>${note}</small>`:''}</span><span aria-hidden="true">›</span></button>`;
    let state='loading',markup='<p class="friends-note">Cargando amigos…</p>';
    if(!known);
    else if(!currentAccount){state='guest';markup=cta('data-portal-login','Entra para ver a tus amigos','Quién está en línea y chat directo')}
    else if(enabled===false){state='setup';markup=cta('data-portal-open','Activa tu perfil de amigos','Para ver quién está conectado')}
    else if(list&&!list.friends.length){state='empty';markup='<p class="friends-note">Aún no tienes amigos aquí.</p>'+cta('data-portal-invite','Invita a alguien','Comparte tu enlace de amistad')}
    else if(list){
      const row=player=>`<li><button type="button" class="friend-row" data-portal-friend="${escape(player.id)}" aria-label="Chatear con ${escape(player.name)}. ${escape(activity(player))}">${face(player)}<span class="friend-text"><b>${escape(player.name)}</b><small>${escape(activity(player))}</small></span></button></li>`;
      const groups=groupsOf(list.friends);
      state='ready';
      markup=groups.map(([id,label,all])=>`<section class="friends-group" data-group="${id}"><h3>${label} <span>(${all.length})</span></h3>${all.length?`<ul>${all.slice(0,PORTAL_MAX).map(row).join('')}</ul>`:`<p class="friends-none">${id==='online'?'Nadie conectado ahora.':'Nadie desconectado.'}</p>`}</section>`).join('')
        +(groups.some(([,,all])=>all.length>PORTAL_MAX)?`<button type="button" class="friends-more" data-portal-open>Ver todos (${list.friends.length})</button>`:'');
    }
    else if(listError){state='error';markup='<p class="friends-note">No se han podido cargar tus amigos.</p>'+cta('data-portal-retry','Reintentar','')}
    if(portal.markup===markup)return;
    const focused=portal.contains(document.activeElement)?document.activeElement:null;
    const mark=focused&&[...focused.attributes].find(({name})=>name.startsWith('data-portal-'));
    portal.dataset.state=state;portal.innerHTML=markup;portal.markup=markup;
    if(mark)(portal.querySelector(`[${mark.name}="${CSS.escape(mark.value)}"]`)||portalHost.querySelector('.portal-social-open'))?.focus({preventScroll:true});
  }
  portal?.addEventListener('click',event=>{
    const button=event.target.closest('button');if(!button)return;
    if('portalLogin' in button.dataset){$('#home-account').click();return}
    if('portalRetry' in button.dataset){refreshList(true);return}
    if('portalInvite' in button.dataset){wantInvite=true;open(button);return}
    if('portalOpen' in button.dataset){open(button);return}
    // Pulsar un amigo abre el cajón en su chat.
    const player=friends.find(entry=>entry.id===button.dataset.portalFriend);
    if(player){open(button);openChat(player)}
  });
  function renderFriends(data){
    const share=new URL('/',location.origin);
    share.hash='amigo='+data.invite;
    const invitation=invite?`<div class="social-invite"><p>Te han invitado a conectar como amigos.</p>
      <button class="game-primary" type="button" data-social-accept>Aceptar amistad</button>
      <button class="game-secondary" type="button" data-social-dismiss>Descartar</button></div>`:'';
    const row=player=>`<li><div class="friend-who">${face(player)}<div><b>${escape(player.name)}</b><small>${escape(activity(player))}</small></div></div><button class="game-secondary" type="button" data-social-chat="${escape(player.id)}" aria-label="Chatear con ${escape(player.name)}">Chat</button></li>`;
    const rows=data.friends.length?groupsOf(data.friends).map(([id,label,all])=>`<h4 class="friend-group-title" id="social-group-${id}">${label} <span>(${all.length})</span></h4>${all.length?`<ul class="social-list" aria-labelledby="social-group-${id}">${all.map(row).join('')}</ul>`:`<p class="friend-none">${id==='online'?'Ahora mismo no hay nadie conectado.':'No hay nadie desconectado.'}</p>`}`).join('')
      :'<p>Aún no tienes amigos aquí. Comparte tu enlace para empezar.</p>';
    const markup=`${invitation}<h3>Tus amigos</h3>${rows}
      <details class="social-invite"><summary>Invitar a un amigo</summary>
        <label for="social-link">Enlace de amistad</label><input id="social-link" type="url" readonly value="${escape(share.href)}">
        <button class="game-primary" type="button" data-social-copy>Copiar enlace</button>
        <button class="game-secondary" type="button" data-social-renew>Renovar enlace</button></details>
      <label class="social-privacy"><input type="checkbox" id="social-privacy" ${data.activity?'checked':''}> Mostrar mi actividad a mis amigos</label>`;
    // Evita que el sondeo interrumpa la lectura del teclado o cierre el enlace al copiarlo.
    if(friendsSection.markup!==markup){
      const options=friendsSection.querySelector('details');
      const focused=document.activeElement;
      const control=focused?.closest('[data-social-copy],[data-social-renew],[data-social-accept],[data-social-dismiss]');
      const selector=focused?.id?'#'+focused.id:focused?.dataset.socialChat?'[data-social-chat="'+CSS.escape(focused.dataset.socialChat)+'"]':
        control?'['+control.getAttributeNames().find(name=>name.startsWith('data-social-'))+']':focused?.matches('summary')?'summary':null;
      friendsSection.innerHTML=markup;friendsSection.markup=markup;
      if(options?.open)friendsSection.querySelector('details').open=true;
      if(selector&&focused!==document.activeElement)(friendsSection.querySelector(selector)||drawer.querySelector('[data-social-close]')).focus({preventScroll:true});
    }
    // Quien llega desde «Invita a alguien» encuentra el enlace ya desplegado.
    if(wantInvite){wantInvite=false;const options=friendsSection.querySelector('details');if(options){options.open=true;options.querySelector('summary').focus({preventScroll:true})}}
  }
  // Pide al servidor lo que haga falta (si el perfil está activado y la lista) y lo deja en enabled, list y listError.
  // Si ya hay una carga en marcha, es esa: portada, cajón y refresco periódico comparten la misma petición.
  function load(){
    if(loading)return loading;
    const mine=era,job=(async()=>{
      if(!currentAccount){list=null;listError='';return}
      if(enabled!==true){
        const state=await call('estado');
        if(mine!==era)return;
        if(!state.ok){listError=state.error||'Sin conexión. Inténtalo de nuevo.';return}
        enabled=state.enabled;
      }
      if(!enabled){list=null;listError='';return}
      const data=await call('amigos');
      if(mine!==era)return;
      if(data.ok&&Array.isArray(data.friends)){list=data;friends=data.friends;listError=''}
      else if(data.status===409){enabled=false;list=null;listError=''}
      else listError=data.error||'Sin conexión. Inténtalo de nuevo.';
    })();
    loading=job;job.finally(()=>{if(loading===job)loading=null});
    return job;
  }
  // La lista del cajón, con lo que se sabe ahora. No pinta mientras se ve un chat o hay un cambio a medias.
  function paintDrawer(){
    if(!drawer.open||friend||busy)return;
    if(!currentAccount){renderGuest();return}
    if(enabled===false){if(!friendsSection.querySelector('#social-setup'))renderSetup();return}
    if(list){renderFriends(list);return}
    // El error y el «Cargando» se pintan una vez: un refresco que vuelve a fallar no quita el foco de «Reintentar».
    if(listError){if(!friendsSection.querySelector('[data-social-retry]')){friendsSection.innerHTML='<button class="game-secondary" type="button" data-social-retry>Reintentar</button>';friendsSection.markup='';say(listError)}return}
    if(!friendsSection.querySelector('.friend-loading')){friendsSection.innerHTML='<p class="friend-loading">Cargando amigos…</p>';friendsSection.markup=''}
  }
  function paint(){paintPortal();paintDrawer()}
  // retry = el jugador pide volver a intentarlo: se quita el error y se ve «Cargando» mientras tanto.
  async function refreshList(retry=false){
    const mine=era;
    if(retry)listError='';
    paint();
    await load();
    if(mine===era)paint();
  }

  function drawMessages(list){
    const nearBottom=messages.scrollHeight-messages.scrollTop-messages.clientHeight<68;
    const markup=list.length?list.map(message=>`<li${message.mine?' class="mine"':''}><span class="sr-only">${message.mine?'Tú: ':'Tu amigo: '}</span>${escape(message.text)}<time datetime="${escape(message.at)}">${date.format(new Date(message.at))} · ${hour.format(new Date(message.at))}</time></li>`).join('')
      :'<li>Todavía no hay mensajes.</li>';
    if(markup===messages.markup)return;
    messages.innerHTML=markup;messages.markup=markup;
    if(nearBottom)messages.scrollTop=messages.scrollHeight;
  }
  async function refreshChat(){
    if(!drawer.open||!friend||busy)return;
    const sequence=++chatRequest,id=friend.id;
    const data=await call('chat',{id});
    if(!drawer.open||friend?.id!==id||sequence!==chatRequest||busy)return;
    if(data.ok)drawMessages(data.messages);
    else if(data.status===404){back();say(data.error)}
    else if(!messages.innerHTML)say(data.error);
  }
  function openChat(player){
    friend=player;sendRetry=null;field.value='';messages.innerHTML='';messages.markup='';
    $('#social-chat-title').textContent=player.name;
    friendsSection.hidden=true;chat.hidden=false;say();
    field.focus();refreshChat();
  }
  function back(){
    const id=friend?.id;
    friend=null;chat.hidden=true;friendsSection.hidden=false;say();refreshList();
    // El foco vuelve a ese amigo en la lista; si ya no está (amistad bloqueada, otra cuenta), al botón de cerrar.
    if(id)(friendsSection.querySelector(`[data-social-chat="${CSS.escape(id)}"]`)||drawer.querySelector('[data-social-close]'))?.focus();
  }
  function open(button){
    if(drawer.open)return;
    if(menuOpen())toggleMenu(false);
    opener=button;friendsSection.markup='';say();drawer.showModal();refreshList(true);
  }
  drawer.addEventListener('close',()=>{
    generation++;chatRequest++;busy=false;friend=null;wantInvite=false;chat.hidden=true;friendsSection.hidden=false;
    const fallback=$('#game-shell').hidden?$('.home-friends'):$('#menu-toggle');
    // Si la lista de la portada se repintó mientras tanto, el foco vuelve al mismo amigo.
    const row=opener?.dataset.portalFriend&&!opener.isConnected?portal.querySelector(`[data-portal-friend="${CSS.escape(opener.dataset.portalFriend)}"]`):null,target=row||opener;
    (target?.getClientRects().length&&!target.closest('[inert]')?target:fallback).focus({preventScroll:true});
  });
  document.querySelectorAll('[data-open-social]').forEach(button=>button.addEventListener('click',()=>open(button)));
  drawer.addEventListener('click',event=>{
    if(event.target===drawer&&(event.clientX<drawer.getBoundingClientRect().left))drawer.close();
    if(event.target.closest('[data-social-close]'))drawer.close();
    const league=event.target.closest('[data-social-league]'),circuit=event.target.closest('[data-social-circuit]'),duel=event.target.closest('[data-social-duel]');
    if(league||circuit||duel){
      const shortcut=duel?'[data-open-duel-friends]':league?'#menu-drawer [data-open-league]':'#menu-drawer [data-open-circuit]';
      drawer.addEventListener('close',()=>$(shortcut)?.click(),{once:true});
      drawer.close();
      return;
    }
    if(event.target.closest('[data-social-back]'))back();
    if(event.target.closest('[data-social-login]')){
      pendingLogin=true;
      drawer.addEventListener('close',()=>$('#home-account').click(),{once:true});
      drawer.close();
    }
    const chatButton=event.target.closest('[data-social-chat]');
    const player=chatButton&&friends.find(entry=>entry.id===chatButton.dataset.socialChat);
    if(player)openChat(player);
    if(event.target.closest('[data-social-retry]')){say();refreshList(true)}
    if(event.target.closest('[data-social-dismiss]')){forgetInvite();refreshList()}
    if(event.target.closest('[data-social-copy]')){
      const link=$('#social-link');link.select();
      navigator.clipboard?.writeText(link.value)?.then(()=>say('Enlace copiado.'),()=>say('Copia el enlace seleccionado.'))??say('Copia el enlace seleccionado.');
    }
    if(event.target.closest('[data-social-accept]'))mutate('agregar',{code:invite});
    if(event.target.closest('[data-social-renew]')&&confirm('¿Renovar tu enlace? El anterior dejará de funcionar.'))mutate('renovar');
    if(event.target.closest('[data-social-block]')&&friend&&confirm('¿Bloquear esta amistad? Se borrará vuestra conversación y dejaréis de aparecer en la lista del otro.'))mutate('bloquear',{id:friend.id});
  });

  async function mutate(action,extra={}){
    if(busy)return;
    busy=true;const serial=generation;
    const data=await call(action,extra);
    // Una carga que empezó antes del cambio trae la lista de antes: no vale, se pide otra al acabar.
    const stale=loading;
    if(serial!==generation||!drawer.open){if(data.ok)(stale||Promise.resolve()).then(()=>refreshList());return}
    busy=false;
    if(data.ok){
      if(action==='activar'){enabled=true;friendsSection.markup='';pulse()}
      if(action==='agregar')forgetInvite();
      if(action==='bloquear'){if(list){list={...list,friends:list.friends.filter(player=>player.id!==extra.id)};friends=list.friends}back()}
      if(stale)await stale;
      await refreshList();
      if(serial!==generation||!drawer.open)return;
      say(({activar:'Perfil de amigos activado.',agregar:'Amistad aceptada.',renovar:'Enlace renovado.',privacidad:'Preferencia guardada.',bloquear:'Amistad bloqueada.'})[action]);
    }else{
      say(data.error);
      if(action==='privacidad'&&$('#social-privacy'))$('#social-privacy').checked=!extra.activity;
    }
  }

  drawer.addEventListener('submit',event=>{
    if(event.target.id!=='social-setup')return;
    event.preventDefault();mutate('activar',{name:$('#social-name').value});
  });
  drawer.addEventListener('change',event=>{
    if(event.target.id==='social-privacy')mutate('privacidad',{activity:event.target.checked});
  });
  form.addEventListener('submit',async event=>{
    event.preventDefault();if(!friend||busy)return;
    const text=field.value.trim();if(!text)return;
    if(!sendRetry||sendRetry.text!==text)sendRetry={text,message:crypto.randomUUID()};
    busy=true;send.disabled=true;field.readOnly=true;
    const serial=generation,id=friend.id,data=await call('enviar',{id,...sendRetry});
    send.disabled=false;field.readOnly=false;
    if(serial!==generation)return;
    busy=false;
    if(friend?.id!==id)return;
    if(data.ok){field.value='';sendRetry=null;say();await refreshChat();messages.scrollTop=messages.scrollHeight}
    else if(data.status===404){back();say(data.error)}
    else say(data.error);
    if(friend?.id===id)field.focus();
  });

  // El pulso lleva el aspecto del avatar, para que los amigos vean tu cara en su lista.
  const myLook=()=>{const look=window.Progress?.look?.();return look&&typeof look==='object'?look:null};
  function pulse(played=false){
    if(!currentAccount||enabled!==true||document.hidden)return;
    if(!played&&Date.now()-lastInteraction>=5*60_000)return;
    const look=myLook();sentLook=look?JSON.stringify(look):'';
    call('pulso',{played,...(look?{look}:{})});
  }
  // Al cambiar de cuenta (entrar, salir u otra): se olvida la lista anterior y se carga la de la cuenta nueva, también
  // con el cajón cerrado, para la portada.
  async function syncAccount(){
    era++;loading=null;list=null;listError='';friends=[];enabled=null;known=true;sentLook='';
    generation++;chatRequest++;busy=false;friendsSection.markup='';
    if(drawer.open)back();
    const mine=era;await refreshList();
    if(mine!==era||!currentAccount)return;
    if(enabled)pulse();
    if(pendingLogin){
      pendingLogin=false;
      const auth=$('#auth-dialog');
      if(auth.open)auth.addEventListener('close',()=>open($('.home-friends')),{once:true});
      else open($('.home-friends'));
    }
  }
  document.addEventListener('faraday:cuenta',syncAccount);
  // Una amistad recién hecha en el lobby (lobby.js avisa a los dos al aceptarse): «Con amigos» se recarga ya, sin
  // esperar al refresco periódico. Una carga que estuviera en marcha es de antes de la amistad: se espera y se pide
  // otra. El servidor puede haber creado el perfil de amigos en ese momento, así que se vuelve a preguntar si lo hay.
  document.addEventListener('faraday:lobby-amistad',()=>{
    if(!currentAccount)return;
    const mine=era;
    (loading||Promise.resolve()).catch(()=>{}).then(()=>{if(mine!==era)return;if(enabled===false)enabled=null;refreshList()});
  });
  for(const event of ['pointerdown','keydown','focus'])window.addEventListener(event,()=>{lastInteraction=Date.now()},{passive:true});
  for(const event of ['faraday:answer','faraday:duel','faraday:played'])document.addEventListener(event,()=>pulse(true));
  // Al cambiarse de ropa (el perfil avisa al cerrarse), el aspecto nuevo sale sin esperar al pulso del minuto.
  document.addEventListener('faraday:look',()=>{const look=myLook();if(look&&JSON.stringify(look)!==sentLook)pulse()});
  // La lista de la portada solo se refresca si se está viendo: en la portada, sin un juego ni el perfil encima, y con
  // el jugador presente en los últimos minutos (como el pulso).
  const portalLive=()=>!!portal?.getClientRects().length&&!document.body.classList.contains('modal-open')&&Date.now()-lastInteraction<5*60_000;
  const listLive=()=>!document.hidden&&!friend&&enabled&&(drawer.open||portalLive());
  document.addEventListener('visibilitychange',()=>{if(!document.hidden){lastInteraction=Date.now();pulse();if(listLive())refreshList()}});
  setInterval(()=>{if(!document.hidden&&friend)refreshChat()},6000);
  setInterval(()=>{if(listLive())refreshList()},24000);
  setInterval(()=>pulse(),60000);
  window.addEventListener('hashchange',()=>{if(consumeInvite()){if(drawer.open)back();else open($('.home-friends'))}});

  const fresh=consumeInvite();
  if(!fresh)try{invite=sessionStorage.getItem('faraday:amigo')}catch{}
  paintPortal();
  playerReady.then(()=>{
    // La lista de la portada se carga al entrar, sin abrir el cajón (si faraday:cuenta ya la está cargando, es esa).
    if(currentAccount&&enabled===null&&!loading)syncAccount();
    else if(!known){known=true;paintPortal()}
    if(invite)open($('.home-friends'));
  });
})();

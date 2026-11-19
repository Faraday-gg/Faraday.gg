// Amistades mediante enlace, actividad y chat directo con cuentas de Faraday.
(()=>{
  const drawer=$('#social-drawer'),friendsSection=$('#social-friends'),chat=$('#social-chat');
  const feedback=$('#social-feedback'),messages=chat.querySelector('.social-messages'),form=$('#social-message-form');
  const field=$('#social-message'),send=form.querySelector('button');
  const invitePattern=/^#amigo=([a-f0-9]{32})$/;
  const date=new Intl.DateTimeFormat('es-ES',{day:'numeric',month:'short',timeZone:'Europe/Madrid'});
  const hour=new Intl.DateTimeFormat('es-ES',{hour:'2-digit',minute:'2-digit',timeZone:'Europe/Madrid'});
  const escape=escapeHtml;
  let invite=null,enabled=null,friends=[],friend=null,opener=null;
  let generation=0,listRequest=0,chatRequest=0,busy=false,sendRetry=null,lastInteraction=Date.now(),pendingLogin=false;

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
  function renderFriends(data){
    friends=data.friends;
    const share=new URL('/',location.origin);
    share.hash='amigo='+data.invite;
    const invitation=invite?`<div class="social-invite"><p>Te han invitado a conectar como amigos.</p>
      <button class="game-primary" type="button" data-social-accept>Aceptar amistad</button>
      <button class="game-secondary" type="button" data-social-dismiss>Descartar</button></div>`:'';
    const list=friends.length?`<ul class="social-list">${friends.map(player=>`<li><div><b>${escape(player.name)}</b><small><i class="social-status-dot${player.online?' is-online':''}" aria-hidden="true"></i>${escape(activity(player))}</small></div><button class="game-secondary" type="button" data-social-chat="${player.id}" aria-label="Chatear con ${escape(player.name)}">Chat</button></li>`).join('')}</ul>`
      :'<p>Aún no tienes amigos aquí. Comparte tu enlace para empezar.</p>';
    const markup=`${invitation}<h3>Tus amigos</h3>${list}
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
      const selector=focused?.id?'#'+focused.id:focused?.dataset.socialChat?'[data-social-chat="'+focused.dataset.socialChat+'"]':
        control?'['+control.getAttributeNames().find(name=>name.startsWith('data-social-'))+']':focused?.matches('summary')?'summary':null;
      friendsSection.innerHTML=markup;friendsSection.markup=markup;
      if(options?.open)friendsSection.querySelector('details').open=true;
      if(selector&&focused!==document.activeElement)(friendsSection.querySelector(selector)||drawer.querySelector('[data-social-close]')).focus({preventScroll:true});
    }
  }
  async function refreshList(showLoading=false){
    if(!drawer.open||friend||busy)return;
    const sequence=++listRequest,serial=generation;
    if(!currentAccount){renderGuest();return}
    if(showLoading){friendsSection.innerHTML='<p>Cargando amigos…</p>';friendsSection.markup=''}
    function current(){return drawer.open&&!friend&&!busy&&serial===generation&&sequence===listRequest}
    if(enabled!==true){
      const state=await call('estado');
      if(!current())return;
      if(!state.ok){friendsSection.innerHTML='<button class="game-secondary" type="button" data-social-retry>Reintentar</button>';say(state.error);return}
      enabled=state.enabled;
    }
    if(!enabled){if(!friendsSection.querySelector('#social-setup'))renderSetup();return}
    const data=await call('amigos');
    if(!current())return;
    if(data.ok)renderFriends(data);
    else if(showLoading||!friendsSection.querySelector('h3')){friendsSection.innerHTML='<button class="game-secondary" type="button" data-social-retry>Reintentar</button>';say(data.error)}
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
    ++listRequest;friend=player;sendRetry=null;field.value='';messages.innerHTML='';messages.markup='';
    $('#social-chat-title').textContent=player.name;
    friendsSection.hidden=true;chat.hidden=false;say();
    field.focus();refreshChat();
  }
  function back(){
    const id=friend?.id;
    friend=null;chat.hidden=true;friendsSection.hidden=false;say();refreshList();
    if(id)friendsSection.querySelector(`[data-social-chat="${id}"]`)?.focus();
  }
  function open(button){
    if(drawer.open)return;
    if(menuOpen())toggleMenu(false);
    opener=button;friendsSection.markup='';say();drawer.showModal();refreshList(true);
  }
  drawer.addEventListener('close',()=>{
    generation++;listRequest++;chatRequest++;busy=false;friend=null;chat.hidden=true;friendsSection.hidden=false;
    const fallback=$('#game-shell').hidden?$('.home-friends'):$('#menu-toggle');
    (opener?.getClientRects().length&&!opener.closest('[inert]')?opener:fallback).focus({preventScroll:true});
  });
  document.querySelectorAll('[data-open-social]').forEach(button=>button.addEventListener('click',()=>open(button)));
  drawer.addEventListener('click',event=>{
    if(event.target===drawer&&(event.clientX<drawer.getBoundingClientRect().left))drawer.close();
    if(event.target.closest('[data-social-close]'))drawer.close();
    const league=event.target.closest('[data-social-league]'),circuit=event.target.closest('[data-social-circuit]');
    if(league||circuit){
      drawer.addEventListener('close',()=>$(league?'.portal-links [data-open-league]':'#menu-drawer [data-open-circuit]').click(),{once:true});
      drawer.close();
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
    if(serial!==generation||!drawer.open)return;
    busy=false;
    if(data.ok){
      if(action==='activar'){enabled=true;friendsSection.markup='';pulse()}
      if(action==='agregar')forgetInvite();
      if(action==='bloquear')back();
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

  function pulse(played=false){
    if(!currentAccount||enabled!==true||document.hidden)return;
    if(played||Date.now()-lastInteraction<5*60_000)call('pulso',{played});
  }
  async function syncAccount(){
    enabled=null;generation++;listRequest++;chatRequest++;busy=false;friendsSection.markup='';
    if(drawer.open)back();
    if(!currentAccount)return;
    const serial=generation,data=await call('estado');
    if(serial!==generation)return;
    if(data.ok){enabled=data.enabled;pulse()}
    if(pendingLogin){
      pendingLogin=false;
      const auth=$('#auth-dialog');
      if(auth.open)auth.addEventListener('close',()=>open($('.home-friends')),{once:true});
      else open($('.home-friends'));
    }
  }
  document.addEventListener('faraday:cuenta',syncAccount);
  for(const event of ['pointerdown','keydown','focus'])window.addEventListener(event,()=>{lastInteraction=Date.now()},{passive:true});
  for(const event of ['faraday:answer','faraday:duel','faraday:played'])document.addEventListener(event,()=>pulse(true));
  document.addEventListener('visibilitychange',()=>{if(!document.hidden){lastInteraction=Date.now();pulse()}});
  setInterval(()=>{if(!document.hidden&&friend)refreshChat()},6000);
  setInterval(()=>{if(!document.hidden&&!friend&&enabled)refreshList()},24000);
  setInterval(()=>pulse(),60000);
  window.addEventListener('hashchange',()=>{if(consumeInvite()){if(drawer.open)back();else open($('.home-friends'))}});

  const fresh=consumeInvite();
  if(!fresh)try{invite=sessionStorage.getItem('faraday:amigo')}catch{}
  playerReady.then(()=>{
    if(currentAccount&&enabled===null)syncAccount();
    if(invite)open($('.home-friends'));
  });
})();

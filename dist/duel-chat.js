// Chat de la partida en los duelos (decisión 0040): reacciones con un toque, frases ya escritas y mensajes cortos.
// El servidor guarda los mensajes dentro del duelo (lib/duelos.mjs) y llegan con la misma consulta de cada segundo;
// aquí solo se pintan: un botón con el número de mensajes sin leer, el panel del chat y bocadillos junto al marcador.
// duel.js conecta el envío (connect) y pasa cada estado nuevo (update).
(()=>{
  // Mismas claves que CHAT en lib/duelos.mjs: el servidor rechaza cualquier otra.
  const REACTIONS={ok:'👍',risa:'😂',sorpresa:'😮',sudor:'😅',fuego:'🔥',miedo:'😱',cerebro:'🤯',aplauso:'👏',pensar:'🤔',llorar:'😭'};
  const PHRASES={suerte:'¡Suerte!',igualmente:'¡Igualmente!',bien:'¡Bien jugado!',casi:'¡Casi casi!',uff:'Uff, por los pelos','ni-idea':'Ni idea de esta',facil:'Esta era fácil',remontada:'Aún puedo remontar',gg:'GG',revancha:'¿La revancha?',gracias:'¡Gracias!',vamos:'¡Vamos!'};
  // Las frases que encajan con cada momento salen primero; el resto, detrás.
  const FIRST={intro:['suerte','igualmente','vamos'],question:['ni-idea','facil','uff','pensar'],reveal:['bien','casi','uff','remontada','gracias'],finished:['gg','revancha','gracias','bien']};
  const KEY='casi-casi:duelo:chat-texto',MAX=140;
  const shell=document.getElementById('duel-shell'),hud=document.getElementById('duel-hud'),panelHost=shell?.querySelector('.duel-panel');
  if(!shell||!hud||!panelHost)return;
  const esc=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  let showText=true;try{showText=JSON.parse(localStorage.getItem(KEY))??true}catch{}

  const dock=document.createElement('div');dock.className='chat-dock';dock.hidden=true;
  dock.innerHTML=`<section class="duel-chat" id="duel-chat" hidden aria-labelledby="duel-chat-title">
  <header class="chat-head"><b id="duel-chat-title">Chat</b><button type="button" class="chat-x" data-chat="close" aria-label="Cerrar el chat">×</button></header>
  <ol class="chat-log" id="chat-log" aria-live="polite" aria-relevant="additions"></ol>
  <div class="chat-reactions" role="group" aria-label="Reacciones">${Object.entries(REACTIONS).map(([id,emoji])=>`<button type="button" data-react="${id}" aria-label="Reaccionar ${emoji}">${emoji}</button>`).join('')}</div>
  <div class="chat-phrases" id="chat-phrases" role="group" aria-label="Frases rápidas"></div>
  <form class="chat-form" id="chat-form"><label class="sr-only" for="chat-input">Mensaje</label><input id="chat-input" type="text" maxlength="${MAX}" autocomplete="off" enterkeyhint="send" placeholder="Escribe un mensaje…"><button type="submit" aria-label="Enviar"><svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12h15M13 6l6 6-6 6"/></svg></button></form>
  <div class="chat-foot"><label class="chat-mute"><input type="checkbox" id="chat-show-text"${showText?' checked':''}> Ver los mensajes escritos del rival</label><span class="chat-error" id="chat-error" role="alert"></span></div>
</section>
<p class="chat-peek" id="chat-peek" aria-hidden="true"></p>
<button type="button" class="chat-fab" data-chat="toggle" aria-controls="duel-chat" aria-expanded="false" aria-label="Abrir el chat"><svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5.5h16v10H9.5L5 19.5v-4H4z"/><path d="M8.5 10.5h.01M12 10.5h.01M15.5 10.5h.01" stroke-width="2.8"/></svg><span class="chat-badge" id="chat-badge" hidden></span></button>`;
  panelHost.append(dock);
  const box=dock.querySelector('#duel-chat'),log=dock.querySelector('#chat-log'),fab=dock.querySelector('.chat-fab'),badge=dock.querySelector('#chat-badge');
  const input=dock.querySelector('#chat-input'),error=dock.querySelector('#chat-error'),phrases=dock.querySelector('#chat-phrases'),peek=dock.querySelector('#chat-peek');

  let bridge=null,duelId='',seen=new Set(),unread=0,phase='',sending=false,errorTimer=0,peekTimer=0;
  const isOpen=()=>!box.hidden;
  const content=m=>m.kind==='reaction'?REACTIONS[m.value]:m.kind==='phrase'?PHRASES[m.value]:m.value;
  const hidden=m=>m.kind==='text'&&m.from==='rival'&&!showText;

  function bubbleHtml(m){
    if(m.kind==='reaction')return `<span class="chat-emoji">${REACTIONS[m.value]||''}</span>`;
    if(hidden(m))return `<span class="chat-hidden">Mensaje escrito oculto</span>`;
    return `<span class="chat-text${m.kind==='phrase'?' is-phrase':''}">${esc(content(m)||'')}</span>`;
  }
  function renderLog(messages){
    const rival=bridge?.rival();
    log.innerHTML=messages.length?messages.map(m=>`<li class="chat-msg" data-from="${m.from}" data-kind="${m.kind}">${m.from==='rival'?`<small>${esc(rival?.name||'Rival')}</small>`:''}${bubbleHtml(m)}</li>`).join('')
      :`<li class="chat-empty">${rival?.bot?'Faraday-bot no lee mensajes, pero a veces reacciona.':'Saluda a tu rival o reacciona a la jugada.'}</li>`;
    log.scrollTop=log.scrollHeight;
  }
  function renderPhrases(){
    const first=(FIRST[phase]||[]).filter(id=>PHRASES[id]),order=[...first,...Object.keys(PHRASES).filter(id=>!first.includes(id))];
    const html=order.map(id=>`<button type="button" data-phrase="${id}">${esc(PHRASES[id])}</button>`).join('');
    if(phrases.dataset.phase!==phase){phrases.innerHTML=html;phrases.dataset.phase=phase;phrases.scrollLeft=0}
  }
  function setBadge(){badge.hidden=!unread;badge.textContent=unread>9?'9+':String(unread);fab.setAttribute('aria-label',unread?`Abrir el chat (${unread} sin leer)`:'Abrir el chat')}
  // Bocadillo junto al jugador en el marcador. Si el marcador no se ve (pantalla «VS»), sale encima del botón del chat.
  function bubble(m){
    if(hidden(m))return;
    const card=hud.hidden?null:hud.querySelector(`.duel-player[data-side="${m.from}"]`);
    if(card){
      card.querySelector('.chat-bubble')?.remove();
      const element=document.createElement('span');element.className='chat-bubble'+(m.kind==='reaction'?' is-emoji':'');element.setAttribute('aria-hidden','true');
      element.textContent=content(m)||'';card.append(element);setTimeout(()=>element.remove(),m.kind==='reaction'?2600:4200);return;
    }
    if(m.from!=='rival'||isOpen())return;
    peek.textContent=`${bridge?.rival()?.name||'Rival'}: ${content(m)||''}`;peek.classList.add('show');
    clearTimeout(peekTimer);peekTimer=setTimeout(()=>peek.classList.remove('show'),3800);
  }
  function blip(){if(window.Sound){Sound.tone(880,0,.09,{type:'triangle',gain:.035});Sound.tone(1320,.07,.12,{type:'triangle',gain:.03})}}
  function showError(message){error.textContent=message;clearTimeout(errorTimer);errorTimer=setTimeout(()=>{error.textContent=''},3500)}

  // Estado nuevo del duelo: se pinta el chat y se avisa de lo que ha llegado desde la última vez.
  function update(view){
    const live=view&&view.players?.length>1&&view.status!=='waiting'&&view.round;
    dock.hidden=!live;if(!live){if(isOpen())close(false);return}
    const first=view.id!==duelId;
    if(first){duelId=view.id;seen=new Set();unread=0;phrases.dataset.phase='';log.innerHTML=''}
    phase=view.phase;renderPhrases();
    const messages=view.chat||[],fresh=messages.filter(m=>!seen.has(m.n));
    messages.forEach(m=>seen.add(m.n));
    dock.querySelector('#duel-chat-title').textContent=`Chat con ${bridge?.rival()?.name||'tu rival'}`;
    if(first||fresh.length)renderLog(messages);
    if(first)return; // al volver a un duelo (recarga) no se repiten los avisos de lo ya escrito
    for(const m of fresh){
      if(m.from==='rival'){if(!isOpen()){unread++;bubble(m)}else bubble(m);blip()}
      else bubble(m);
    }
    setBadge();
  }
  function open(){
    box.hidden=false;fab.setAttribute('aria-expanded','true');dock.classList.add('is-open');unread=0;setBadge();peek.classList.remove('show');
    log.scrollTop=log.scrollHeight;
    // En móvil no se abre el teclado solo: tapaba las reacciones, que es lo que más se usa.
    if(matchMedia('(min-width:561px)').matches)input.focus({preventScroll:true});
  }
  function close(focus=true){box.hidden=true;fab.setAttribute('aria-expanded','false');dock.classList.remove('is-open');if(focus)fab.focus({preventScroll:true})}
  async function send(kind,value){
    if(!bridge||sending)return false;sending=true;
    const response=await bridge.send(kind,value);sending=false;
    if(!response.ok){showError(response.data?.error||'No se ha podido enviar.');return false}
    return true;
  }
  function reset(){dock.hidden=true;close(false);duelId='';seen=new Set();unread=0;setBadge();log.innerHTML='';hud.querySelectorAll('.chat-bubble').forEach(element=>element.remove())}

  dock.addEventListener('click',event=>{
    const target=event.target.closest('button');if(!target)return;
    if(target.dataset.chat==='toggle'){isOpen()?close():open();return}
    if(target.dataset.chat==='close'){close();return}
    if(target.dataset.react)send('reaction',target.dataset.react);
    if(target.dataset.phrase)send('phrase',target.dataset.phrase);
  });
  dock.querySelector('#chat-form').addEventListener('submit',async event=>{
    event.preventDefault();const text=input.value.replace(/\s+/g,' ').trim();if(!text)return;
    if(await send('text',text.slice(0,MAX)))input.value='';
  });
  dock.querySelector('#chat-show-text').addEventListener('change',event=>{
    showText=event.target.checked;try{localStorage.setItem(KEY,JSON.stringify(showText))}catch{}
    bridge?.refresh();
  });
  // Las teclas del chat no deben llegar al resto del duelo (Intro no confirma la respuesta, por ejemplo).
  input.addEventListener('keydown',event=>{if(event.key!=='Escape')event.stopPropagation()});

  window.DuelChat={connect(next){bridge=next},update,reset,isOpen,close,
    render(view){if(view&&view.id===duelId)renderLog(view.chat||[])}};
})();

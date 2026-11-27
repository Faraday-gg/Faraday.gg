// Chat del lobby fuera del Lobby 3D (window.ChatDock): una sola caja que acompaña al jugador en la portada y dentro de
// los juegos que no tienen chat propio (reto diario y archivo, Traza, Ascensión, Archivo Vivo, ligas, comunidad y
// circuito). Los mensajes no se piden aquí: los trae lobby.js (window.Lobby) y avisa con dos eventos en document,
// «faraday:lobby» (la vista de cada pulso) y «faraday:lobby-chat» (cada mensaje nuevo). Este archivo solo los pinta y
// decide dónde va la caja.
//
// Es un único nodo que se cambia de sitio. En la portada va en #lobby-chat-slot (o flotando abajo a la izquierda si no
// existe). Dentro de un juego se cuelga de la barra de arriba de ese juego, como un botón más: los juegos que son
// <dialog> abiertos con showModal() viven en la capa superior del navegador y nada de fuera se ve ni se puede pulsar,
// y en la barra no tapa el campo de respuesta, la calculadora, los botones de enviar ni los relojes.
// No aparece en el duelo ni en el Salón (tienen su chat), ni en el perfil, el mercado, el inicio de sesión o el cajón
// de amigos. Dentro de un juego va plegada y lo que llega solo suma al contador: sin sonido, sin bocadillos, sin foco.
(()=>{
  // STALE: sin vistas del lobby durante este tiempo, el chat se da por caído. Dentro de un juego el pulso va cada 8 s
  // y un fallo de red se reintenta a los 3 y a los 6 s: el margen cubre dos fallos seguidos sin dar falsas alarmas.
  const W=window,MAX=140,KEEP=60,STALE=40000,KEY='casi-casi:lobby:chat';
  // Pantallas, de la que más tapa a la que menos. «el» es su id; «dialog», que se abre con showModal(); «bar», la barra
  // de la que se cuelga la caja (null: en esa pantalla no hay chat del lobby); «keep», lo que el panel desplegado no
  // debe tapar en escritorio (el reloj, el enunciado y el campo de respuesta de ese juego).
  const SCREENS=[
    {id:'casino',el:'casino',dialog:true,bar:null},
    {id:'auth',el:'auth-dialog',dialog:true,bar:null},
    {id:'social',el:'social-drawer',dialog:true,bar:null},
    {id:'archivo',el:'archivo-vivo',dialog:true,bar:'.archivo-vivo-header',keep:'#av-timer,.av-panel'},
    {id:'ascension',el:'ascension-dialog',dialog:true,bar:'.ascension-header',keep:'.ascension-play'},
    {id:'trends',el:'trends-dialog',dialog:true,bar:'.trends-header',keep:'#trends-timer,.trends-card'},
    {id:'market',el:'market-shell',bar:null},
    {id:'profile',el:'profile-shell',bar:null},
    {id:'circuit',el:'circuit-shell',bar:'.game-bar'},
    {id:'community',el:'community-shell',bar:'.game-bar'},
    {id:'league',el:'league-shell',bar:'.game-bar'},
    {id:'duel',el:'duel-shell',bar:null},
    {id:'game',el:'game-shell',bar:'.game-bar',keep:'.game-card'}
  ];

  // ── Lógica pura (se prueba en tests/chat-dock.test.mjs) ──
  // Qué pantalla manda: la primera abierta de la lista; si no hay ninguna, la portada.
  const pickScreen=open=>SCREENS.find(screen=>open?.[screen.id])?.id||'home';
  // Dónde se ancla la caja en esa pantalla: «slot» (hueco del lobby), «home» (flotando en la portada), el id del juego
  // (en su barra) o «none» (no se enseña).
  const placeOf=(screen,slot)=>screen==='home'?(slot?'slot':'home'):SCREENS.some(one=>one.id===screen&&one.bar)?screen:'none';
  const inGame=place=>place!=='home'&&place!=='slot'&&place!=='none';
  // Desplegada o no: en un juego, solo si el jugador la ha abierto ahí; en la portada, lo último que eligió y, si no
  // ha elegido, plegada (también en escritorio: desplegada tapa media plaza a quien acaba de llegar).
  const isOpen=(place,state)=>place==='none'?false:inGame(place)?!!state.game:state.folded===false;
  // Dónde poner el panel desplegado dentro de un juego, en escritorio, para que no tape lo importante (keep: cajas del
  // reloj, el enunciado y la respuesta). Prueba debajo del botón (alineado a un lado o al otro) y pegado a cada lado
  // de lo que hay que respetar, con tres anchos; gana lo que menos tape y, a igualdad, lo más ancho y cercano al botón.
  // Todo en coordenadas de la ventana: fab = caja del botón, view = {w,h} de la ventana. Devuelve {x,y,w,h} o null.
  function fitPanel(fab,keep,view,gap=10){
    let best=null;
    for(const w of [320,280,240]){
      if(w>view.w-16)continue;
      const xs=[fab.left,fab.right-w,...keep.flatMap(box=>[box.left-w-gap,box.right+gap])].map(x=>Math.max(8,Math.min(view.w-w-8,x)));
      const ys=[fab.bottom+gap,...keep.map(box=>box.bottom+gap).filter(y=>y>fab.bottom+gap)];
      for(const y of ys){
        const h=Math.min(380,view.h-y-12);
        if(h<220)continue;
        for(const x of xs){
          const cover=keep.reduce((sum,box)=>sum+Math.max(0,Math.min(x+w,box.right)-Math.max(x,box.left))*Math.max(0,Math.min(y+h,box.bottom)-Math.max(y,box.top)),0);
          const cost=Math.abs(x-fab.left)+Math.abs(y-fab.bottom-gap)+(320-w)*2;
          if(!best||cover<best.cover-1||(cover<best.cover+1&&cost<best.cost))best={x,y,w,h,cover,cost};
        }
      }
    }
    return best&&{x:Math.round(best.x),y:Math.round(best.y),w:best.w,h:Math.round(best.h),cover:Math.round(best.cover)};
  }
  const clean=text=>String(text??'').replace(/\s+/g,' ').trim().slice(0,MAX);
  // Contador de caracteres: solo aparece al acercarse al límite.
  const counter=length=>length>=MAX-30?String(Math.max(0,MAX-length)):'';
  const badge=count=>count>99?'99+':count>0?String(count):'';
  function roomTitle(room){
    const n=Number(room?.n),count=Number(room?.count);
    if(!Number.isFinite(n)||n<1)return 'Lobby';
    return `Lobby ${n}`+(Number.isFinite(count)&&count>0?` · ${count} ${count===1?'jugador':'jugadores'}`:'');
  }
  function clock(at){
    const time=typeof at==='number'?(at<1e11?at*1000:at):Date.parse(at);
    if(!Number.isFinite(time))return '';
    const date=new Date(time),two=value=>String(value).padStart(2,'0');
    return `${two(date.getHours())}:${two(date.getMinutes())}`;
  }
  // Un mensaje suma al contador si es de otro, no es del historial que llega al conectar, su autor no está silenciado,
  // el chat no está oculto y el registro no se está viendo en ese momento.
  const countsUnread=(message,state)=>message.kind!=='note'&&!message.mine&&!message.quiet&&!state.muted&&!state.hidden&&!state.reading;
  // Registro: guarda los últimos «max» y no repite un mensaje ya visto (mismo n). add() devuelve los que salen por
  // arriba, o null si estaba repetido.
  function createLog(max=KEEP){
    const items=[];let seen=new Set();
    return {items,
      add(item){
        if(item.n!=null){
          const key=String(item.n);if(seen.has(key))return null;
          seen.add(key);if(seen.size>max*8)seen=new Set([...seen].slice(-max*4));
        }
        items.push(item);return items.splice(0,Math.max(0,items.length-max));
      },
      forget(){seen=new Set()}};
  }

  const pure={SCREENS,MAX,KEEP,STALE,pickScreen,placeOf,inGame,isOpen,fitPanel,clean,counter,badge,roomTitle,clock,countsUnread,createLog};
  const api={open(){},close(){},toggle(){},focus(){},hide(){},refresh(){},mount:()=>false,unread:()=>0,isOpen:()=>false,place:()=>'none',_:pure};
  W.ChatDock=api;
  // Un fallo del chat nunca puede romper un juego: si el arranque falla, queda la API vacía y nada más.
  try{start()}catch(error){try{W.console?.warn?.('ChatDock: no ha podido arrancar',error)}catch{}}

  function start(){
    const doc=W.document;
    if(!doc?.body||typeof doc.createElement!=='function')return;
    const safe=run=>{try{return run()}catch{return undefined}};
    const later=run=>{if(typeof W.setTimeout==='function')W.setTimeout(()=>safe(run),0);else Promise.resolve().then(()=>safe(run))};
    const el=(tag,cls,attrs)=>{
      const node=doc.createElement(tag);if(cls)node.className=cls;
      for(const [key,value] of Object.entries(attrs||{})){if(key==='text')node.textContent=value;else if(key==='html')node.innerHTML=value;else node.setAttribute(key,value)}
      return node;
    };
    const setText=(node,text)=>{if(node.textContent!==text)node.textContent=text};
    const ICON={
      chat:'<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5.5h16v10H9.5L5 19.5v-4H4z"/><path d="M8.5 10.5h.01M12 10.5h.01M15.5 10.5h.01" stroke-width="2.8"/></svg>',
      more:'<svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><circle cx="5.5" cy="12" r="1.9"/><circle cx="12" cy="12" r="1.9"/><circle cx="18.5" cy="12" r="1.9"/></svg>',
      send:'<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12h15M13 6l6 6-6 6"/></svg>'
    };

    // Lo que se recuerda entre visitas: si el jugador ha ocultado el chat y si lo dejó plegado en la portada.
    let prefs={oculto:false,plegado:null};
    safe(()=>{const saved=JSON.parse(W.localStorage.getItem(KEY));if(saved&&typeof saved==='object')prefs={oculto:saved.oculto===true,plegado:typeof saved.plegado==='boolean'?saved.plegado:null}});
    const save=()=>safe(()=>W.localStorage.setItem(KEY,JSON.stringify(prefs)));
    const mobile=()=>!!safe(()=>W.matchMedia('(max-width:560px)').matches);

    // Todo el DOM se construye aquí (index.html no tiene nada del chat). Lo que escribe otro jugador entra siempre
    // como texto (textContent), nunca como HTML, y no hay enlaces.
    const root=el('div','cdock');root.hidden=true;
    const fab=el('button','cdock-fab',{type:'button','aria-controls':'cdock-panel','aria-expanded':'false',html:ICON.chat});
    const fabLabel=el('span','cdock-fab-label'),mark=el('span','cdock-badge',{'aria-hidden':'true'});mark.hidden=true;
    fab.append(fabLabel,mark);
    const panel=el('section','cdock-panel',{id:'cdock-panel','aria-label':'Chat del lobby'});
    const title=el('span','cdock-room',{text:'Lobby'});
    const more=el('button','cdock-more',{type:'button','aria-label':'Opciones del chat','aria-expanded':'false','aria-controls':'cdock-menu',html:ICON.more});
    const shut=el('button','cdock-x',{type:'button','aria-label':'Cerrar el chat',text:'×'});
    const head=el('div','cdock-head');head.append(title,more,shut);
    const menu=el('div','cdock-menu',{id:'cdock-menu',role:'group','aria-label':'Opciones del chat'});menu.hidden=true;
    const list=el('ol','cdock-log',{'aria-live':'polite','aria-relevant':'additions','aria-label':'Mensajes del lobby'});
    const empty=el('li','cdock-note cdock-empty',{text:'Nadie ha escrito todavía. Saluda al lobby.'});list.append(empty);
    const off=el('div','cdock-off',{role:'status',text:'Conectando con el lobby…'});
    const form=el('form','cdock-form',{autocomplete:'off'});
    const input=el('input','cdock-input',{id:'cdock-input',type:'text',maxlength:String(MAX),autocomplete:'off',enterkeyhint:'send',placeholder:'Escribe al lobby…'});
    const left=el('span','cdock-count',{'aria-hidden':'true'});
    form.append(el('label','cdock-sr',{for:'cdock-input',text:'Mensaje para el lobby'}),input,left,el('button','cdock-send',{type:'submit','aria-label':'Enviar',html:ICON.send}));
    panel.append(head,menu,list,off,form);
    const show=el('button','cdock-show',{type:'button','aria-label':'Mostrar el chat del lobby',html:ICON.chat});
    show.append(el('span','cdock-show-label',{text:'Mostrar chat'}));show.hidden=true;
    root.append(fab,panel,show);

    const log=createLog(KEEP),muted=new Map(),born=Date.now();
    let place='none',forced=null,bad=null,cursor=0,openGame=false,unread=0,room=null,ever=false,primed=false,last=0,sending=false,menuFrom=null,returnTo=null,now=()=>Date.now();

    const expanded=()=>isOpen(place,{mobile:mobile(),folded:prefs.plegado,game:openGame});
    // Hay conexión si lobby.js está, dice que sigue activo y ha llegado una vista hace poco.
    const online=()=>ever&&now()-last<STALE&&typeof W.Lobby?.say==='function'&&safe(()=>W.Lobby.active?.())!==false;
    const reading=()=>place!=='none'&&!root.hidden&&!prefs.oculto&&expanded()&&doc.hidden!==true;
    const isMuted=id=>muted.has(id)||!!safe(()=>W.Lobby?.muted?.(id));
    const scrollEnd=()=>{list.scrollTop=list.scrollHeight};
    // El nombre de un jugador del que solo se tiene el identificador: el de la lista del lobby o el de su último mensaje.
    const nameOf=id=>muted.get(id)||clean(safe(()=>W.Lobby?.players?.().find(one=>String(one?.id)===id)?.name)).slice(0,32)||[...log.items].reverse().find(item=>item.kind==='msg'&&item.id===id)?.name||'';
    // Todos los silenciados que se pueden deshacer: los de esta sesión y los que guarda lobby.js de visitas anteriores
    // (Lobby.mutedList), siempre que se sepa quiénes son (siguen en el lobby o tienen mensajes aquí).
    function mutedAll(){
      const all=new Map(muted);
      for(const raw of safe(()=>W.Lobby?.mutedList?.())||[]){const id=String(raw),name=all.has(id)?'':nameOf(id);if(name)all.set(id,name)}
      return all;
    }
    // Dentro de un juego, en escritorio, el panel se coloca donde no tape el reloj ni el enunciado (fitPanel). En móvil
    // es una hoja inferior y en la portada manda el hueco: ahí no se toca nada (se quitan las medidas puestas).
    // Con fresh=false (lo que se hace en cada pulso) solo se mueve si lo que hay que respetar ha cambiado y ahora lo tapa.
    function fit(fresh=true){
      const style=panel.style;if(!style)return;
      let spot=null;
      const info=inGame(place)&&SCREENS.find(one=>one.id===place);
      if(info?.keep&&!mobile()&&!panel.hidden&&typeof root.getBoundingClientRect==='function'){
        const keep=[...doc.getElementById(info.el).querySelectorAll(info.keep)].map(node=>node.getBoundingClientRect()).filter(box=>box.width>0&&box.height>0);
        const now=panel.getBoundingClientRect();
        if(!fresh&&style.width&&!keep.some(box=>Math.min(now.right,box.right)-Math.max(now.left,box.left)>1&&Math.min(now.bottom,box.bottom)-Math.max(now.top,box.top)>1))return;
        const base=root.getBoundingClientRect(),found=keep.length?fitPanel(fab.getBoundingClientRect(),keep,{w:W.innerWidth,h:W.innerHeight}):null;
        if(found)spot={left:found.x-Math.round(base.left)+'px',top:found.y-Math.round(base.top)+'px',right:'auto',width:found.w+'px',height:found.h+'px'};
      }
      for(const key of ['left','top','right','width','height']){const value=spot?spot[key]:'';if(style[key]!==value)style[key]=value}
    }

    function paint(){
      const open=expanded(),live=online(),count=badge(unread),name=roomTitle(room);
      // Fuera del hueco del lobby no se enseña nada hasta que el lobby ha respondido alguna vez: un botón que no hace
      // nada distrae. En el hueco sí, con «Conectando…» o «Chat no disponible» en vez del campo.
      root.hidden=place==='none'||(place!=='slot'&&!ever);
      root.dataset.place=place;
      root.classList.toggle('is-open',open&&!prefs.oculto);
      root.classList.toggle('is-off',!live);
      fab.hidden=prefs.oculto;show.hidden=!prefs.oculto;panel.hidden=prefs.oculto||!open;
      fab.setAttribute('aria-expanded',String(open));
      fab.setAttribute('aria-label',open?'Cerrar el chat del lobby':unread?`Abrir el chat del lobby (${unread} sin leer)`:'Abrir el chat del lobby');
      mark.hidden=!count;setText(mark,count);
      setText(title,name);setText(fabLabel,`Chat · ${name}`);
      shut.setAttribute('aria-label',place==='slot'?'Plegar el chat':'Cerrar el chat');setText(shut,place==='slot'?'–':'×');
      form.hidden=!live;off.hidden=live;
      setText(off,ever||Date.now()-born>12000?'Chat no disponible':'Conectando con el lobby…');
    }

    function closeMenu(focus){
      if(menu.hidden)return false;
      menu.hidden=true;more.setAttribute('aria-expanded','false');
      if(focus)safe(()=>menuFrom?.focus({preventScroll:true}));
      menuFrom=null;return true;
    }
    function openMenu(entries,from){
      menu.replaceChildren(...entries.map(([text,run])=>{
        const button=el('button','',{type:'button',text});
        button.addEventListener('click',()=>{closeMenu(false);safe(run)});
        return button;
      }));
      menu.hidden=false;menuFrom=from;more.setAttribute('aria-expanded',String(from===more));
      safe(()=>menu.firstElementChild?.focus({preventScroll:true}));
    }

    function setOpen(on,focus=true){
      if(place==='none')return;
      on=!!on;const was=expanded()&&!prefs.oculto,inside=root.contains(doc.activeElement);
      if(on)prefs.oculto=false;
      if(inGame(place))openGame=on;else prefs.plegado=!on;
      save();
      if(on&&!was)returnTo=safe(()=>doc.activeElement)||null;
      if(on)unread=0;
      closeMenu(false);paint();
      safe(fit);
      if(on){
        scrollEnd();
        // En móvil no se abre el teclado solo: taparía el registro, que es lo primero que se quiere leer.
        if(focus)safe(()=>(online()&&!mobile()?input:shut).focus({preventScroll:true}));
      }else if(focus&&was&&inside){
        // Al cerrar, el foco vuelve a donde estaba (el campo del juego, por ejemplo); si ya no existe, al botón del chat.
        // Solo si el foco estaba dentro de la caja: cerrarla desde fuera (ChatDock.close()) no le quita el foco a nadie.
        const back=returnTo&&returnTo!==doc.body&&returnTo.isConnected!==false&&!root.contains(returnTo)?returnTo:fab;
        returnTo=null;safe(()=>back.focus({preventScroll:true}));
      }
    }
    // Ocultar el chat: queda un botón pequeño para volver a enseñarlo. Mientras está oculto no se cuentan mensajes.
    function hide(on=true){
      const inside=root.contains(doc.activeElement);
      prefs.oculto=!!on;save();
      if(on){unread=0;closeMenu(false)}
      paint();
      if(inside)safe(()=>(on?show:expanded()?input:fab).focus({preventScroll:true}));
    }

    function push(item){
      const out=log.add(item);if(!out)return false;
      empty.remove();
      const stick=item.mine||list.scrollHeight-list.scrollTop-list.clientHeight<48;
      list.append(item.el);for(const old of out)old.el?.remove();
      if(stick)scrollEnd();
      return true;
    }
    // Mensaje de sistema, discreto: errores de envío, cambios de lobby y avisos de silenciar.
    function note(text,{error=false,action=null}={}){
      const before=log.items[log.items.length-1];
      if(before?.kind==='note'&&before.text===text&&!action)return;
      const item={kind:'note',text,el:el('li','cdock-note'+(error?' is-error':''),{text})};
      if(action){
        const button=el('button','cdock-link',{type:'button',text:action[0]});
        button.addEventListener('click',()=>{button.remove();safe(action[1])});
        item.el.append(' ',button);
      }
      push(item);
    }
    // Silenciar: oculta los mensajes ya pintados de ese jugador y lo deja dicho en el registro. Vale igual si se
    // silencia aquí que desde el menú del jugador en el Lobby 3D (lobby.js avisa con «faraday:lobby-mute»).
    function showMute(id,name,on){
      if(on)muted.set(id,name);else muted.delete(id);
      for(const item of log.items)if(item.kind==='msg'&&!item.mine&&item.id===id&&item.el)item.el.hidden=on;
      if(on)note(`Has silenciado a ${name}.`,{action:['Deshacer',()=>setMute(id,name,false)]});
      else note(`Vuelves a leer a ${name}.`);
      if(!on)scrollEnd();
    }
    // Desde la caja: además avisa a lobby.js, que deja de mandar sus mensajes y lo recuerda para otras visitas.
    function setMute(id,name,on){
      showMute(id,name,on);
      safe(()=>W.Lobby?.mute?.(id,on));
    }
    function onMute(detail){
      const id=String(detail?.id??''),on=detail?.on!==false;
      if(!id)return;
      // Ya está aquí como dice el aviso (lo ha cambiado esta misma caja, o no había nada suyo pintado): nada que hacer.
      const hiding=log.items.some(item=>item.kind==='msg'&&!item.mine&&item.id===id&&item.el?.hidden===true);
      if(on?muted.has(id):!muted.has(id)&&!hiding)return;
      const name=nameOf(id);
      if(name)showMute(id,name,on);
    }
    function onChat(data,fromView){
      if(!data||typeof data!=='object'||(fromView&&data.n==null))return;
      const text=String(data.text??'').replace(/\s+/g,' ').trim().slice(0,400);if(!text)return;
      const id=data.id==null?'':String(data.id),mine=data.mine===true;
      if(!mine&&id&&isMuted(id))return;
      // «quiet»: historial que ya estaba al conectar (o que lobby.js marca como antiguo, «old»); no cuenta como sin leer.
      const item={kind:'msg',n:data.n,id,name:clean(data.name).slice(0,32)||'Jugador',text,mine,at:data.at,quiet:!primed||data.old===true};
      const line=el('li','cdock-msg'+(mine?' is-mine':'')),time=clock(item.at);
      if(time)line.setAttribute('title',time);
      // Pulsar el nombre de otro jugador ofrece silenciarlo.
      const who=mine?el('span','cdock-who',{text:'Tú'}):el('button','cdock-who',{type:'button','aria-haspopup':'true',text:item.name});
      if(!mine&&id)who.addEventListener('click',()=>openMenu([[isMuted(id)?`Dejar de silenciar a ${item.name}`:`Silenciar a ${item.name}`,()=>setMute(id,item.name,!isMuted(id))]],who));
      line.append(who,el('span','cdock-text',{text}));item.el=line;
      if(!push(item))return;
      if(countsUnread(item,{muted:false,hidden:prefs.oculto,reading:reading()})){unread++;paint()}
    }
    function onView(view){
      if(!view||typeof view!=='object')return;
      last=now();ever=true;
      let moved=false;
      if(view.room&&typeof view.room==='object'){
        // Otro lobby: su numeración de mensajes es otra y conviene decir que la gente ha cambiado.
        if(room&&Number(room.n)!==Number(view.room.n)){moved=true;log.forget();cursor=0;if(primed&&Number(view.room.n)>0)note(`Has pasado al Lobby ${Number(view.room.n)}.`)}
        room={n:view.room.n,count:view.room.count,cap:view.room.cap};
      }
      // El servidor nunca devuelve un cursor menor que el que se le manda: una vista con el cursor por detrás del ya
      // visto es una respuesta que llega desordenada (un pulso que vuelve después que el chat enviado mientras tanto).
      // Su chat es más viejo que lo pintado: se ignora, y no se olvida nada (olvidar repetía el mensaje propio).
      const upTo=Number(view.cursor),late=!moved&&Number.isFinite(upTo)&&upTo<cursor;
      if(Number.isFinite(upTo)&&!late)cursor=upTo;
      // Por si el aviso por mensaje no llega: los de la vista también se pintan (no se repiten: mismo n).
      if(!late&&Array.isArray(view.chat))for(const message of view.chat)onChat(message,true);
      // Lo que llega con la primera vista es historial: se pinta, pero no cuenta como «sin leer».
      if(!primed)later(()=>{primed=true});
      sync();
    }

    // Dónde va la caja ahora mismo. Se llama cada vez que se abre o se cierra una pantalla y con cada pulso del lobby
    // (así se arregla sola si un juego rehace su barra o el hueco de la portada aparece más tarde).
    // El hueco sirve si se ve. Vacío no se ve nunca (lobby.css lo oculta con :empty), así que entonces se mira a su
    // padre: si el lobby entero está oculto (sin plaza, portada tapada), la caja flota. Un hueco que sigue sin verse
    // con la caja dentro se descarta («bad») hasta que algo cambie, para no ir y venir en cada pulso.
    const seen=node=>!!node&&(typeof node.getClientRects!=='function'||node.getClientRects().length>0);
    const usable=slot=>slot&&slot!==bad&&slot.isConnected!==false&&(slot.contains(root)?seen(slot):seen(slot.parentNode))?slot:null;
    function sync(){
      safe(()=>{
        const open={};
        for(const screen of SCREENS){const node=doc.getElementById(screen.el);open[screen.id]=!!node&&(screen.dialog?node.open===true:node.hidden!==true)}
        const screen=pickScreen(open),slot=usable(forced)||usable(doc.getElementById('lobby-chat-slot'));
        let next=placeOf(screen,!!slot),host=doc.body;
        if(next==='slot')host=slot;
        else if(inGame(next)){
          const info=SCREENS.find(one=>one.id===next);
          host=doc.getElementById(info.el)?.querySelector(info.bar);
          if(!host){next='none';host=doc.body}
        }
        if(next!==place){
          closeMenu(false);returnTo=null;
          if(inGame(next))openGame=false; // en cada juego empieza plegada
          place=next;
        }
        // Un solo nodo: append lo mueve con su registro, su borrador y su estado; nunca se duplica.
        const moved=root.parentNode!==host;
        if(moved)host.append(root);
        if(moved&&next==='slot'&&!seen(host)){bad=host;place='home';doc.body.append(root)}
        paint();
        if(unread&&reading()){unread=0;paint()}
        fit(moved);
        if(moved&&expanded())scrollEnd();
      });
    }

    // ── Interacción ──
    fab.addEventListener('click',()=>setOpen(!expanded()));
    shut.addEventListener('click',()=>setOpen(false));
    show.addEventListener('click',()=>hide(false));
    more.addEventListener('click',()=>{
      if(!menu.hidden&&menuFrom===more){closeMenu(true);return}
      openMenu([['Ocultar chat',()=>hide(true)],...[...mutedAll()].map(([id,name])=>[`Dejar de silenciar a ${name}`,()=>setMute(id,name,false)])],more);
    });
    input.addEventListener('input',()=>{const text=counter(input.value.length);setText(left,text);left.classList.toggle('is-low',text!==''&&Number(text)<=10)});
    form.addEventListener('submit',async event=>{
      event.preventDefault();
      const text=clean(input.value);
      if(!text||sending)return;
      if(!online()){paint();return}
      sending=true;root.classList.add('is-sending');
      let result=null;
      try{result=await W.Lobby.say(text)}catch{}
      sending=false;root.classList.remove('is-sending');
      // El error del servidor (ir demasiado rápido, por ejemplo) se enseña tal cual y el borrador se conserva.
      if(!result||result.error){note(String(result?.error||'').replace(/\s+/g,' ').trim().slice(0,200)||'No se ha podido enviar el mensaje.',{error:true});return}
      if(clean(input.value)===text){input.value='';setText(left,'');left.classList.remove('is-low')}
    });
    // Tocar fuera del menú lo cierra. Y nada de lo que pasa dentro de la caja sube al juego que la aloja: sus
    // manejadores delegados (clics, envíos, cambios) no tienen que ver los del chat. No se cortan los eventos de
    // soltar (pointerup, keyup…) para no dejar a medias un arrastre o una tecla que empezó fuera.
    root.addEventListener('click',event=>{if(!menu.hidden&&!menu.contains(event.target)&&!menuFrom?.contains?.(event.target))closeMenu(false)});
    for(const type of ['click','dblclick','mousedown','pointerdown','touchstart','wheel','contextmenu','submit','input','change','beforeinput','paste'])
      root.addEventListener(type,event=>event.stopPropagation(),{passive:true});
    // Teclado: lo que se teclea dentro de la caja no llega a los atajos de los juegos ni del Lobby 3D (WASD, Espacio,
    // Enter…). Va en captura y en window porque varios juegos escuchan Escape en captura en document. Escape cierra
    // primero el menú, luego el panel (o suelta el campo en la portada); si no hay nada que cerrar, es del juego.
    const keys=event=>{
      if(!root.contains(event.target))return;
      if(event.type==='keydown'&&event.key==='Escape'){
        if(closeMenu(true)){}
        else if(inGame(place)&&expanded()&&!prefs.oculto)setOpen(false);
        else if(event.target===input)input.blur();
        else return;
        event.preventDefault();
      }
      event.stopImmediatePropagation();
    };
    W.addEventListener?.('keydown',event=>safe(()=>keys(event)),true);
    W.addEventListener?.('keypress',event=>safe(()=>keys(event)),true);
    // El botón «atrás» del móvil (o cualquier petición de cierre que no pase por el teclado) cierra antes el panel
    // del chat que el juego que lo aloja.
    doc.addEventListener('cancel',event=>safe(()=>{
      if(inGame(place)&&expanded()&&!prefs.oculto&&!root.hidden&&event.target?.contains?.(root)){event.preventDefault();setOpen(false)}
    }),true);

    // ── Lo que llega del lobby ──
    doc.addEventListener('faraday:lobby',event=>safe(()=>onView(event.detail)));
    doc.addEventListener('faraday:lobby-chat',event=>safe(()=>onChat(event.detail,false)));
    doc.addEventListener('faraday:lobby-mute',event=>safe(()=>onMute(event.detail)));
    doc.addEventListener('visibilitychange',()=>safe(()=>{if(unread&&reading()){unread=0;paint()}}));

    // ── Aperturas y cierres de pantallas, sin tocar los juegos: el atributo «open» de los diálogos y «hidden» de los shells ──
    doc.body.append(root);
    if(typeof W.MutationObserver==='function'){
      const watcher=new W.MutationObserver(()=>sync());
      for(const screen of SCREENS){
        const node=doc.getElementById(screen.el);if(!node)continue;
        safe(()=>watcher.observe(node,{attributes:true,attributeFilter:['open','hidden']}));
        if(screen.dialog)safe(()=>node.addEventListener('close',()=>sync()));
      }
    }
    // lobby.js avisa cuando ha montado la portada (y con ella el hueco); al cambiar de tamaño, el hueco puede aparecer o no.
    doc.addEventListener('faraday:lobby-ready',()=>{bad=null;sync()});
    W.addEventListener?.('resize',()=>{bad=null;sync();safe(fit)});
    W.addEventListener?.('load',()=>sync());
    // Sin vistas durante un rato, el campo se cambia por «Chat no disponible» (y vuelve solo cuando llegan).
    if(typeof W.setInterval==='function')W.setInterval(()=>safe(paint),4000);
    sync();later(sync);

    Object.assign(api,{
      open(){setOpen(true)},
      close(){setOpen(false)},
      toggle(){setOpen(!(expanded()&&!prefs.oculto))},
      // Abre la caja y deja el cursor en el campo (para un atajo «Enter = chat» del Lobby 3D, por ejemplo).
      focus(){setOpen(true,false);safe(()=>input.focus({preventScroll:true}))},
      hide(on=true){hide(on)},
      // Ancla la caja de la portada en ese elemento en vez de en #lobby-chat-slot. mount(null) lo deshace.
      mount(node){forced=node&&typeof node.append==='function'?node:null;sync();return place==='slot'},
      refresh(){sync()},
      unread:()=>unread,
      isOpen:()=>expanded()&&!prefs.oculto&&place!=='none',
      place:()=>place
    });
    Object.assign(pure,{
      // Para las pruebas y para depurar en la consola.
      state:()=>({place,open:expanded(),hidden:prefs.oculto,unread,online:online(),ever,messages:log.items.length,muted:[...muted.keys()],parent:root.parentNode}),
      setNow(run){now=typeof run==='function'?run:()=>Date.now()},
      root
    });
  }
})();

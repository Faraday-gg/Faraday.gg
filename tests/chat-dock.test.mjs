// Chat del lobby dentro de los juegos (dist/chat-dock.js). Primero la lógica pura (ChatDock._) y después la caja
// entera sobre un DOM mínimo simulado: un solo nodo que cambia de sitio, contador de no leídos, recorte del registro,
// silenciar, ocultar, errores de envío y teclado.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../dist/chat-dock.js',import.meta.url),'utf8');
const tick=()=>new Promise(resolve=>setTimeout(resolve,5));
const plain=value=>JSON.parse(JSON.stringify(value));

// ── 1. Lógica pura: sin document, el archivo solo deja la API vacía y las funciones puras ──
{
  const context={window:{}};vm.createContext(context);vm.runInContext(source,context);
  const D=context.window.ChatDock,P=D._;
  assert.equal(D.unread(),0);assert.equal(D.place(),'none');assert.equal(D.isOpen(),false);
  D.open();D.close();D.toggle();D.hide(true);D.focus();D.refresh();assert.equal(D.mount({}),false,'Sin DOM no hace nada, pero tampoco falla');

  // Qué pantalla manda
  assert.equal(P.pickScreen({}),'home');
  assert.equal(P.pickScreen(null),'home');
  assert.equal(P.pickScreen({game:true}),'game');
  assert.equal(P.pickScreen({game:true,trends:true}),'trends','Un diálogo abierto desde el reto manda sobre el reto');
  assert.equal(P.pickScreen({game:true,league:true}),'league');
  assert.equal(P.pickScreen({game:true,profile:true}),'profile');
  assert.equal(P.pickScreen({game:true,duel:true}),'duel');
  assert.equal(P.pickScreen({ascension:true,auth:true}),'auth','El inicio de sesión tapa el juego');
  assert.equal(P.pickScreen({archivo:true,social:true}),'social');
  assert.equal(P.pickScreen({casino:true,game:true,trends:true}),'casino');
  // Dónde se ancla
  assert.equal(P.placeOf('home',true),'slot');
  assert.equal(P.placeOf('home',false),'home');
  for(const id of ['game','league','community','circuit','trends','ascension','archivo']){
    assert.equal(P.placeOf(id,true),id);assert.equal(P.placeOf(id,false),id);assert.equal(P.inGame(id),true);
  }
  for(const id of ['duel','casino','profile','market','auth','social','inventada'])assert.equal(P.placeOf(id,true),'none',`${id} no lleva chat del lobby`);
  for(const id of ['home','slot','none'])assert.equal(P.inGame(id),false);
  assert.deepEqual(plain(P.SCREENS.filter(screen=>screen.bar).map(screen=>screen.id)),['archivo','ascension','trends','circuit','community','league','game']);
  // Plegado
  assert.equal(P.isOpen('slot',{mobile:false,folded:null,game:false}),false,'Portada en escritorio: plegada hasta que el jugador la abre');
  assert.equal(P.isOpen('slot',{mobile:true,folded:null,game:false}),false,'Portada en móvil: plegada');
  assert.equal(P.isOpen('home',{mobile:false,folded:null,game:true}),false,'Lo abierto dentro de un juego no despliega la de la portada');
  assert.equal(P.isOpen('slot',{mobile:false,folded:false,game:false}),true,'Si la dejó desplegada, así sigue');
  assert.equal(P.isOpen('home',{mobile:true,folded:false,game:false}),true,'Lo que eligió el jugador manda');
  assert.equal(P.isOpen('slot',{mobile:false,folded:true,game:true}),false);
  assert.equal(P.isOpen('game',{mobile:false,folded:false,game:false}),false,'Dentro de un juego va plegada');
  assert.equal(P.isOpen('trends',{mobile:true,folded:true,game:true}),true);
  assert.equal(P.isOpen('none',{mobile:false,folded:false,game:true}),false);
  // Textos
  assert.equal(P.clean('  hola \n\t mundo  '),'hola mundo');
  assert.equal(P.clean('x'.repeat(200)).length,140);
  assert.equal(P.clean(null),'');assert.equal(P.clean(undefined),'');
  assert.equal(P.counter(0),'');assert.equal(P.counter(109),'');assert.equal(P.counter(110),'30');assert.equal(P.counter(140),'0');assert.equal(P.counter(150),'0');
  assert.equal(P.badge(0),'');assert.equal(P.badge(-2),'');assert.equal(P.badge(7),'7');assert.equal(P.badge(99),'99');assert.equal(P.badge(100),'99+');
  assert.equal(P.roomTitle({n:1,count:7,cap:20}),'Lobby 1 · 7 jugadores');
  assert.equal(P.roomTitle({n:3,count:1}),'Lobby 3 · 1 jugador');
  assert.equal(P.roomTitle({n:2}),'Lobby 2');
  assert.equal(P.roomTitle(null),'Lobby');assert.equal(P.roomTitle({n:'x'}),'Lobby');
  const when=new Date(2026,10,26,9,5).getTime();
  assert.equal(P.clock(when),'09:05');assert.equal(P.clock(when/1000),'09:05','También admite segundos');
  assert.equal(P.clock(new Date(when).toISOString()),'09:05');
  assert.equal(P.clock(undefined),'');assert.equal(P.clock('ayer'),'');
  // Contador de no leídos
  const calm={muted:false,hidden:false,reading:false};
  assert.equal(P.countsUnread({kind:'msg'},calm),true);
  assert.equal(P.countsUnread({kind:'msg',mine:true},calm),false,'Los propios no cuentan');
  assert.equal(P.countsUnread({kind:'msg',quiet:true},calm),false,'El historial al conectar no cuenta');
  assert.equal(P.countsUnread({kind:'note'},calm),false,'Los avisos del sistema no cuentan');
  assert.equal(P.countsUnread({kind:'msg'},{...calm,muted:true}),false);
  assert.equal(P.countsUnread({kind:'msg'},{...calm,hidden:true}),false,'Con el chat oculto no se cuenta');
  assert.equal(P.countsUnread({kind:'msg'},{...calm,reading:true}),false,'Si se está leyendo, ya está leído');
  // Registro: recorte y repetidos
  const log=P.createLog(3);
  assert.equal(log.add({n:1}).length,0);assert.equal(log.add({n:1}),null,'Mismo n: repetido');
  log.add({n:2});log.add({text:'aviso'});
  const out=log.add({n:4});
  assert.deepEqual(plain(out),[{n:1}]);assert.deepEqual(plain(log.items),[{n:2},{text:'aviso'},{n:4}]);
  assert.equal(log.add({n:2}),null);log.forget();assert.equal(log.add({n:2}).length,1,'Tras cambiar de lobby la numeración es otra');
  assert.equal(P.createLog().add({n:9}).length,0);assert.equal(P.KEEP,60);assert.equal(P.MAX,140);
  const many=P.createLog(60);for(let n=1;n<=1000;n++)many.add({n});
  assert.equal(many.items.length,60);assert.equal(many.items[0].n,941);assert.equal(many.add({n:1000}),null);
  // Colocación del panel dentro de un juego (escritorio): no tapa lo que hay que respetar.
  const box=(left,top,width,height)=>({left,top,right:left+width,bottom:top+height}),screen={w:1280,h:800};
  const hits=(spot,keep)=>keep.some(k=>spot.x<k.right&&spot.x+spot.w>k.left&&spot.y<k.bottom&&spot.y+spot.h>k.top);
  // Reto diario: botón arriba a la izquierda y tarjeta centrada. Cabe a la izquierda de la tarjeta.
  const daily=[box(340,100,600,537)],dailySpot=P.fitPanel(box(76,12,44,44),daily,screen);
  assert.equal(dailySpot.cover,0);assert.equal(hits(dailySpot,daily),false);assert.equal(dailySpot.w,320);assert.equal(dailySpot.y,66);assert.equal(dailySpot.x+dailySpot.w<=340,true);
  // Ascensión: botón arriba a la derecha, justo encima de la tarjeta de la pregunta. Se va al lado libre (la izquierda).
  const climb=[box(752,212,480,410)],climbSpot=P.fitPanel(box(1154,12,44,44),climb,screen);
  assert.equal(climbSpot.cover,0);assert.equal(hits(climbSpot,climb),false);assert.equal(climbSpot.x+climbSpot.w<=752,true,'A la izquierda de la tarjeta');
  // Traza: columna estrecha a la izquierda de la tarjeta. Encoge el ancho antes que tapar el enunciado.
  const trace=[box(1045,33,182,28),box(303,113,944,700)],traceSpot=P.fitPanel(box(19,104,44,44),trace,screen);
  assert.equal(traceSpot.cover,0);assert.equal(traceSpot.w,280);assert.equal(traceSpot.x+traceSpot.w<=303,true);
  // Archivo Vivo: el reloj va en una fila propia bajo el botón. El panel baja hasta dejarla libre.
  const photo=[box(110,150,1060,26),box(811,213,358,398)],photoSpot=P.fitPanel(box(158,92,44,44),photo,screen);
  assert.equal(photoSpot.cover,0);assert.equal(photoSpot.y>=176,true,'Por debajo de la fila del reloj');assert.equal(photoSpot.x+photoSpot.w<=811,true);
  // Sin hueco libre (ventana pequeña ocupada entera): devuelve lo que menos tapa, dentro de la ventana.
  const full=P.fitPanel(box(10,10,44,44),[box(0,60,700,640)],{w:700,h:700});
  assert.equal(full.cover>0,true);assert.equal(full.x>=8&&full.x+full.w<=692,true);assert.equal(full.y+full.h<=688,true);
  assert.equal(P.fitPanel(box(10,10,44,44),[box(0,60,300,200)],{w:300,h:260}),null,'Si no cabe un panel útil, no se toca nada');
}

// ── 2. La caja entera sobre un DOM simulado ──
function page({mobile=false,storage=new Map(),withSlot=true}={}){
  let active=null;const ids=new Map();
  class Node{
    constructor(tag){
      Object.assign(this,{tagName:String(tag).toUpperCase(),children:[],parentNode:null,attrs:{},listeners:{},dataset:{},hidden:false,className:'',own:'',value:'',innerHTML:'',scrollTop:0,scrollHeight:0,clientHeight:0,found:{}});
      const names=()=>this.className.split(' ').filter(Boolean),set=list=>{this.className=list.join(' ')};
      this.classList={contains:name=>names().includes(name),add:name=>{if(!names().includes(name))set([...names(),name])},remove:name=>set(names().filter(one=>one!==name)),
        toggle:(name,on)=>{on?this.classList.add(name):this.classList.remove(name)}};
    }
    get textContent(){return this.own+this.children.map(child=>typeof child==='string'?child:child.textContent).join('')}
    set textContent(value){for(const child of this.children)if(typeof child!=='string')child.parentNode=null;this.children=[];this.own=String(value)}
    setAttribute(key,value){this.attrs[key]=String(value);if(key==='id'){this.id=String(value);ids.set(this.id,this)}}
    getAttribute(key){return this.attrs[key]??null}
    append(...nodes){for(const node of nodes){if(typeof node!=='string'){node.remove();node.parentNode=this}this.children.push(node)}}
    remove(){const parent=this.parentNode;if(!parent)return;parent.children=parent.children.filter(child=>child!==this);this.parentNode=null}
    replaceChildren(...nodes){for(const child of this.children)if(typeof child!=='string')child.parentNode=null;this.children=[];this.append(...nodes)}
    contains(node){for(let one=node;one;one=one.parentNode)if(one===this)return true;return false}
    get firstElementChild(){return this.children.find(child=>typeof child!=='string')||null}
    get isConnected(){return body.contains(this)}
    addEventListener(type,run){(this.listeners[type]??=[]).push(run)}
    dispatch(type,extra={}){
      const event={type,target:this,defaultPrevented:false,stopped:false,preventDefault(){this.defaultPrevented=true},stopPropagation(){this.stopped=true},stopImmediatePropagation(){this.stopped=true},...extra};
      for(let node=this;node&&!event.stopped;node=node.parentNode)for(const run of node.listeners[type]||[])run(event);
      return event;
    }
    click(){return this.dispatch('click')}
    focus(){active=this}
    blur(){if(active===this)active=body}
    querySelector(selector){return this.found[selector]||null}
  }
  const body=new Node('body');active=body;
  const docListeners={},winListeners={};let observer=null;
  const document={body,hidden:false,createElement:tag=>new Node(tag),getElementById:id=>{const node=ids.get(id);return node&&node.isConnected?node:null},
    get activeElement(){return active},addEventListener(type,run,capture){(docListeners[type]??=[]).push(run)}};
  // Las pantallas del juego, como en index.html: shells con «hidden» y diálogos con «open», cada uno con su barra.
  const screens={},bars={};
  const make=(key,id,dialog,barSelector)=>{
    const node=new Node(dialog?'dialog':'div');node.setAttribute('id',id);if(dialog)node.open=false;else node.hidden=true;
    if(barSelector){const bar=new Node('header');bar.className=barSelector.slice(1);node.append(bar);node.found[barSelector]=bar;bars[key]=bar}
    body.append(node);screens[key]=node;
  };
  make('game','game-shell',false,'.game-bar');make('duel','duel-shell',false,'.game-bar');make('league','league-shell',false,'.game-bar');
  make('community','community-shell',false,'.game-bar');make('circuit','circuit-shell',false,'.game-bar');make('profile','profile-shell',false,'.game-bar');
  make('market','market-shell',false,'.game-bar');make('auth','auth-dialog',true,null);make('social','social-drawer',true,null);make('casino','casino',true,null);
  make('archivo','archivo-vivo',true,'.archivo-vivo-header');make('ascension','ascension-dialog',true,'.ascension-header');make('trends','trends-dialog',true,'.trends-header');
  let slot=null;
  // Como en lobby.css: el hueco vacío no se ve (#lobby-chat-slot:empty{display:none}).
  if(withSlot){slot=new Node('div');slot.setAttribute('id','lobby-chat-slot');slot.getClientRects=()=>slot.children.length?[{}]:[];body.append(slot)}
  const lobby={said:[],mutes:[],mutedIds:new Set(),reply:{ok:true},on:true,
    say(text){this.said.push(text);return Promise.resolve(this.reply)},
    mute(id,on=true){this.mutes.push([id,on]);on?this.mutedIds.add(id):this.mutedIds.delete(id)},
    muted(id){return this.mutedIds.has(id)},active(){return this.on}};
  const window={document,Lobby:lobby,setTimeout,
    localStorage:{getItem:key=>storage.has(key)?storage.get(key):null,setItem:(key,value)=>storage.set(key,String(value))},
    matchMedia:()=>({matches:mobile}),
    addEventListener(type,run,capture){(winListeners[type]??=[]).push(run)},
    MutationObserver:class{constructor(run){observer=run}observe(){}}};
  const context={window};vm.createContext(context);vm.runInContext(source,context);
  const D=window.ChatDock,root=D._.root;
  const all=(cls,from=root)=>{const found=[];(function walk(node){if(typeof node==='string')return;if(node.classList.contains(cls))found.push(node);node.children.forEach(walk)})(from);return found};
  const one=cls=>all(cls)[0];
  return {D,root,body,slot,screens,bars,lobby,storage,document,all,one,Node,
    emit:(type,detail)=>{for(const run of docListeners[type]||[])run({type,detail,target:document})},
    // Abrir o cerrar una pantalla como lo hace cada juego, y avisar como lo haría el MutationObserver.
    show(key,on=true){const node=screens[key];if('open' in node)node.open=on;else node.hidden=!on;observer?.([])},
    key(target,key,type='keydown'){const event={type,key,target,defaultPrevented:false,stopped:false,preventDefault(){this.defaultPrevented=true},stopImmediatePropagation(){this.stopped=true},stopPropagation(){this.stopped=true}};for(const run of winListeners[type]||[])run(event);return event},
    focused:()=>active,focus:node=>{active=node}};
}
const view=(extra={})=>({room:{n:1,count:7,cap:20},you:{id:'yo',account:true,social:true},players:[],chat:[],signals:[],cursor:0,serverTime:Date.now(),...extra});
const message=(n,id,name,text,mine=false)=>({n,id,name,text,mine,at:Date.now()});

{
  const p=page(),{D}=p,state=()=>D._.state();
  // Arranque: en el hueco de la portada, sin conexión todavía.
  assert.equal(D.place(),'slot');assert.equal(p.root.parentNode,p.slot);assert.equal(p.root.hidden,false);
  assert.equal(p.one('cdock-form').hidden,true,'Sin lobby no hay campo');assert.equal(p.one('cdock-off').hidden,false);
  assert.equal(p.one('cdock-off').textContent,'Conectando con el lobby…');
  assert.equal(state().online,false);

  // Primera vista: cabecera, historial sin contar y campo disponible.
  p.emit('faraday:lobby',view({chat:[message(1,'a','Ana','hola a todos')]}));
  p.emit('faraday:lobby-chat',message(1,'a','Ana','hola a todos'));
  p.emit('faraday:lobby-chat',message(2,'b','Beto','buenas'));
  assert.equal(p.one('cdock-room').textContent,'Lobby 1 · 7 jugadores');
  assert.equal(state().messages,2,'El mensaje que llega por la vista y por el aviso no se repite');
  assert.equal(D.unread(),0);assert.equal(state().online,true);
  assert.equal(p.one('cdock-form').hidden,false);assert.equal(p.one('cdock-off').hidden,true);
  assert.equal(D.isOpen(),false,'Portada en escritorio: plegada hasta que el jugador la abre');
  assert.equal(p.one('cdock-panel').hidden,true);assert.equal(p.one('cdock-fab').getAttribute('aria-expanded'),'false');
  assert.equal(p.storage.has('casi-casi:lobby:chat'),false,'Sin elegir, no se guarda nada');
  assert.equal(p.all('cdock-empty').length,0);
  assert.match(p.all('cdock-msg')[0].getAttribute('title'),/^\d\d:\d\d$/,'La hora va en title');
  await tick();

  // Entrar en el reto diario: el mismo nodo pasa a la barra del juego, plegado, con su borrador.
  const input=p.one('cdock-input');input.value='a medio escribir';
  p.show('game');
  assert.equal(D.place(),'game');assert.equal(p.root.parentNode,p.bars.game);assert.equal(p.slot.children.length,0);
  assert.equal(p.all('cdock',p.body).length,1,'Un solo nodo, sin duplicados');
  assert.equal(D.isOpen(),false,'Dentro de un juego va plegada');assert.equal(p.one('cdock-panel').hidden,true);
  assert.equal(p.one('cdock-input'),input);assert.equal(input.value,'a medio escribir');assert.equal(state().messages,2);
  assert.equal(p.root.dataset.place,'game');assert.equal(p.slot.getClientRects().length,0,'El hueco vacío vuelve a ocultarse');

  // Mensajes nuevos durante la ronda: solo suman al contador; nadie roba el foco.
  const answer=new p.Node('input');p.bars.game.parentNode.append(answer);p.focus(answer);
  p.emit('faraday:lobby-chat',message(3,'a','Ana','¿alguien para un duelo?'));
  p.emit('faraday:lobby',view({chat:[message(3,'a','Ana','¿alguien para un duelo?'),message(4,'yo','Yo','yo mismo',true)]}));
  assert.equal(D.unread(),1,'El propio no cuenta y el repetido tampoco');
  assert.equal(p.one('cdock-badge').textContent,'1');assert.equal(p.one('cdock-badge').hidden,false);
  assert.match(p.one('cdock-fab').getAttribute('aria-label'),/1 sin leer/);
  assert.equal(p.focused(),answer,'El foco sigue en el campo del juego');
  p.emit('faraday:lobby-chat',{...message(40,'b','Beto','esto es de hace un rato'),old:true});
  assert.equal(D.unread(),1,'Lo que lobby.js marca como antiguo no cuenta');
  assert.equal(p.all('is-mine').length,1);assert.equal(p.all('is-mine')[0].textContent,'Túyo mismo');

  // Abrir: se marca leído y el cursor va al campo. Las teclas no salen de la caja; Escape cierra y devuelve el foco.
  D.open();
  assert.equal(D.isOpen(),true);assert.equal(D.unread(),0);assert.equal(p.one('cdock-badge').hidden,true);assert.equal(p.focused(),input);
  assert.equal(p.one('cdock-fab').getAttribute('aria-expanded'),'true');
  const letter=p.key(input,'w');assert.equal(letter.stopped,true,'WASD escrito en el chat no llega al juego');assert.equal(letter.defaultPrevented,false,'pero se escribe');
  const enter=p.key(input,'Enter');assert.equal(enter.stopped,true);assert.equal(enter.defaultPrevented,false);
  assert.equal(p.key(input,' ','keypress').stopped,true);
  const outside=p.key(answer,'Enter');assert.equal(outside.stopped,false,'Las teclas del juego no se tocan');
  assert.equal(p.key(answer,'Escape').stopped,false,'Escape fuera de la caja es del juego');assert.equal(D.isOpen(),true);
  const escape=p.key(input,'Escape');
  assert.equal(escape.defaultPrevented,true);assert.equal(escape.stopped,true);assert.equal(D.isOpen(),false);assert.equal(p.focused(),answer,'Devuelve el foco');
  const idle=p.key(p.one('cdock-fab'),'Escape');assert.equal(idle.defaultPrevented,false,'Sin nada que cerrar, Escape sigue siendo del juego');assert.equal(idle.stopped,false);

  // Un diálogo modal abierto desde el reto (Traza): la caja entra en el diálogo; al cerrarlo vuelve a la barra del reto.
  D.open();p.show('trends');
  assert.equal(D.place(),'trends');assert.equal(p.root.parentNode,p.bars.trends);assert.equal(D.isOpen(),false,'En cada juego empieza plegada');
  p.show('trends',false);assert.equal(D.place(),'game');assert.equal(p.root.parentNode,p.bars.game);
  p.show('ascension');assert.equal(p.root.parentNode,p.bars.ascension);p.show('ascension',false);
  p.show('archivo');assert.equal(p.root.parentNode,p.bars.archivo);
  // El inicio de sesión por encima de un juego: fuera.
  p.show('auth');assert.equal(D.place(),'none');assert.equal(p.root.hidden,true);assert.equal(p.root.parentNode,p.body);
  p.show('auth',false);assert.equal(D.place(),'archivo');p.show('archivo',false);
  for(const key of ['league','community','circuit']){p.show(key);assert.equal(D.place(),key);assert.equal(p.root.parentNode,p.bars[key]);p.show(key,false)}
  assert.equal(D.place(),'game');

  // Duelo, Salón, perfil, mercado y cajón de amigos: no aparece, pero lo que llega se cuenta para la vuelta.
  for(const key of ['duel','casino','profile','market','social']){p.show(key);assert.equal(D.place(),'none',key);assert.equal(p.root.hidden,true);assert.equal(D.isOpen(),false);p.show(key,false)}
  p.show('duel');
  p.emit('faraday:lobby-chat',message(5,'b','Beto','me apunto'));p.emit('faraday:lobby-chat',message(6,'b','Beto','¿quién crea?'));
  assert.equal(D.unread(),2);
  p.show('duel',false);assert.equal(D.place(),'game');assert.equal(p.one('cdock-badge').textContent,'2');
  // De vuelta en la portada sigue plegada (lo abierto dentro del juego no cuenta) y con su contador; al desplegarla
  // queda leído y se recuerda la elección.
  p.show('game',false);
  assert.equal(D.place(),'slot');assert.equal(p.root.parentNode,p.slot);assert.equal(D.isOpen(),false);assert.equal(D.unread(),2);
  assert.match(p.one('cdock-fab').getAttribute('aria-label'),/2 sin leer/);
  p.one('cdock-fab').click();
  assert.equal(D.isOpen(),true);assert.equal(D.unread(),0);assert.equal(JSON.parse(p.storage.get('casi-casi:lobby:chat')).plegado,false);
  assert.equal(p.all('cdock',p.body).length,1);assert.equal(input.value,'a medio escribir');assert.equal(state().messages,7);

  // Silenciar: pulsar el nombre ofrece «Silenciar a X»; sus mensajes pintados se ocultan y los nuevos no entran.
  const ana=p.all('cdock-who').find(node=>node.textContent==='Ana');
  assert.equal(ana.tagName,'BUTTON');assert.equal(p.all('cdock-who').find(node=>node.textContent==='Tú').tagName,'SPAN','A uno mismo no se le silencia');
  ana.click();
  const menu=p.one('cdock-menu');assert.equal(menu.hidden,false);assert.equal(menu.children.length,1);assert.equal(menu.children[0].textContent,'Silenciar a Ana');
  menu.children[0].click();
  assert.equal(menu.hidden,true);assert.deepEqual(p.lobby.mutes,[['a',true]]);assert.deepEqual(plain(state().muted),['a']);
  const lines=()=>p.all('cdock-msg').map(node=>[node.textContent,node.hidden]);
  assert.deepEqual(lines().filter(([text])=>text.startsWith('Ana')).map(([,hidden])=>hidden),[true,true]);
  assert.deepEqual(lines().filter(([text])=>text.startsWith('Beto')).map(([,hidden])=>hidden),[false,false,false,false]);
  const notes=()=>p.all('cdock-note').map(node=>node.textContent);
  assert.match(notes().at(-1),/^Has silenciado a Ana\./);
  const before=state().messages;
  p.emit('faraday:lobby',view({chat:[message(7,'a','Ana','sigo aquí')]}));
  assert.equal(state().messages,before,'Los mensajes de la vista de alguien silenciado no se pintan');
  // «Opciones» ofrece ocultar el chat y dejar de silenciar; «Deshacer» en el aviso hace lo mismo.
  p.one('cdock-more').click();
  assert.deepEqual(menu.children.map(node=>node.textContent),['Ocultar chat','Dejar de silenciar a Ana']);
  p.one('cdock-room').click();assert.equal(menu.hidden,true,'Tocar fuera cierra el menú');
  p.all('cdock-link')[0].click();
  assert.deepEqual(p.lobby.mutes,[['a',true],['a',false]]);assert.deepEqual(plain(state().muted),[]);
  assert.deepEqual(lines().filter(([text])=>text.startsWith('Ana')).map(([,hidden])=>hidden),[false,false]);
  assert.equal(notes().at(-1),'Vuelves a leer a Ana.');
  // Silenciar desde el menú del jugador en el Lobby 3D (lobby.js avisa con «faraday:lobby-mute»): lo ya pintado se
  // oculta igual, con su «Deshacer», y al quitarlo desde allí vuelve a verse.
  const lobbyMutes=p.lobby.mutes.length;
  p.lobby.players=()=>[{id:'b',name:'Beto'}];
  p.lobby.mutedIds.add('b');p.emit('faraday:lobby-mute',{id:'b',on:true});
  assert.deepEqual(lines().filter(([text])=>text.startsWith('Beto')).map(([,hidden])=>hidden),[true,true,true,true]);
  assert.match(notes().at(-1),/^Has silenciado a Beto\./);assert.deepEqual(plain(state().muted),['b']);
  assert.equal(p.lobby.mutes.length,lobbyMutes,'No se le devuelve el aviso a lobby.js');
  p.emit('faraday:lobby-mute',{id:'b',on:true});assert.equal(notes().filter(text=>/^Has silenciado a Beto/.test(text)).length,1,'El mismo aviso dos veces no repite nada');
  p.lobby.mutedIds.delete('b');p.emit('faraday:lobby-mute',{id:'b',on:false});
  assert.deepEqual(lines().filter(([text])=>text.startsWith('Beto')).map(([,hidden])=>hidden),[false,false,false,false]);
  assert.equal(notes().at(-1),'Vuelves a leer a Beto.');assert.deepEqual(plain(state().muted),[]);
  // Silenciados de visitas anteriores (Lobby.mutedList): «Opciones» deja deshacerlos si se sabe quiénes son.
  p.lobby.mutedIds.add('b');p.lobby.mutedIds.add('fantasma');p.lobby.mutedList=()=>[...p.lobby.mutedIds];
  p.one('cdock-more').click();
  assert.deepEqual(menu.children.map(node=>node.textContent),['Ocultar chat','Dejar de silenciar a Beto'],'El desconocido (ya no está ni ha escrito) no sale');
  menu.children[1].click();
  assert.deepEqual(p.lobby.mutes.at(-1),['b',false]);assert.equal(p.lobby.mutedIds.has('b'),false);
  p.lobby.mutedIds.delete('fantasma');p.emit('faraday:lobby-mute',{id:'nadie',on:true});p.emit('faraday:lobby-mute',null);

  // Texto ajeno: siempre como texto.
  p.emit('faraday:lobby-chat',message(8,'c','<b>Eva</b>','<img src=x onerror=alert(1)> https://ejemplo.test'));
  const evil=p.all('cdock-msg').at(-1);
  assert.equal(evil.children[0].textContent,'<b>Eva</b>');assert.equal(evil.children[1].textContent,'<img src=x onerror=alert(1)> https://ejemplo.test');
  assert.equal(evil.children[0].innerHTML,'');assert.equal(evil.children[1].innerHTML,'');assert.equal(p.all('cdock-msg').every(node=>node.children.every(child=>child.tagName!=='A')),true,'Sin enlaces');

  // Envío: el error del servidor se enseña tal cual y el borrador se queda; si va bien, el campo se vacía.
  input.value='  hola   lobby ';p.lobby.reply={error:'Vas demasiado rápido. Espera un momento.'};
  const submit=p.one('cdock-form').dispatch('submit');assert.equal(submit.defaultPrevented,true);assert.equal(submit.stopped,true,'El envío no sube al juego');
  await tick();
  assert.deepEqual(p.lobby.said,['hola lobby']);assert.equal(notes().at(-1),'Vas demasiado rápido. Espera un momento.');
  assert.equal(p.all('is-error').length,1);assert.equal(input.value,'  hola   lobby ');
  p.lobby.reply={ok:true};p.one('cdock-form').dispatch('submit');await tick();
  assert.equal(input.value,'');assert.deepEqual(p.lobby.said,['hola lobby','hola lobby']);
  p.lobby.say=()=>Promise.reject(new Error('red'));input.value='otra';p.one('cdock-form').dispatch('submit');await tick();
  assert.equal(notes().at(-1),'No se ha podido enviar el mensaje.');assert.equal(input.value,'otra');
  input.value='   ';p.lobby.say=()=>{throw new Error('No debe enviar mensajes vacíos')};p.one('cdock-form').dispatch('submit');await tick();
  // Contador de caracteres al acercarse al límite.
  input.value='x'.repeat(105);input.dispatch('input');assert.equal(p.one('cdock-count').textContent,'');
  input.value='x'.repeat(132);const typed=input.dispatch('input');assert.equal(p.one('cdock-count').textContent,'8');assert.equal(p.one('cdock-count').classList.contains('is-low'),true);
  assert.equal(typed.stopped,true);input.value='';

  // Recorte: solo los últimos 60.
  for(let n=100;n<180;n++)p.emit('faraday:lobby-chat',message(n,'b','Beto',`mensaje ${n}`));
  assert.equal(state().messages,60);assert.equal(p.one('cdock-log').children.length,60);
  assert.equal(p.one('cdock-log').children[0].textContent,'Betomensaje 120');assert.equal(p.one('cdock-log').children.at(-1).textContent,'Betomensaje 179');

  // Cambio de lobby: aviso y cabecera nueva.
  p.emit('faraday:lobby',view({room:{n:2,count:1,cap:20},chat:[message(1,'d','Dani','hola, lobby 2')]}));
  assert.equal(p.one('cdock-room').textContent,'Lobby 2 · 1 jugador');
  assert.deepEqual(p.one('cdock-log').children.slice(-2).map(node=>node.textContent),['Has pasado al Lobby 2.','Danihola, lobby 2']);
  // Respuestas desordenadas: el pulso que vuelve después que el chat enviado mientras tanto trae un cursor menor.
  // Su chat se ignora y no se olvida lo ya visto, así que el mensaje propio no se repite cuando vuelve a llegar.
  const room2={n:2,count:1,cap:20},count=()=>p.one('cdock-log').children.length;
  p.emit('faraday:lobby',view({room:room2,cursor:50,chat:[message(1,'d','Dani','hola, lobby 2')]}));
  assert.equal(p.one('cdock-log').children.at(-1).textContent,'Danihola, lobby 2','Mismo n: repetido');
  p.emit('faraday:lobby',view({room:room2,cursor:60,chat:[message(60,'yo','Yo','mensaje de carrera',true)]}));
  p.emit('faraday:lobby-chat',message(60,'yo','Yo','mensaje de carrera',true));
  assert.equal(p.one('cdock-log').children.at(-1).textContent,'Túmensaje de carrera');
  const painted=count();
  p.emit('faraday:lobby',view({room:room2,cursor:50,chat:[message(55,'d','Dani','llega con la vista atrasada')]}));
  assert.equal(count(),painted,'El chat de una vista con el cursor por detrás no se pinta');
  p.emit('faraday:lobby',view({room:room2,cursor:60,chat:[message(1,'d','Dani','hola, lobby 2'),message(60,'yo','Yo','mensaje de carrera',true)]}));
  assert.equal(count(),painted,'Ni se repite el mensaje propio al volver a llegar el historial');
  assert.equal(p.all('is-mine').filter(node=>node.textContent==='Túmensaje de carrera').length,1);
  assert.equal(state().online,true,'La vista atrasada sí cuenta como señal de vida');

  // Ocultar chat: queda el botón pequeño, se recuerda y deja de contar.
  D.hide(true);
  assert.equal(p.one('cdock-fab').hidden,true);assert.equal(p.one('cdock-panel').hidden,true);assert.equal(p.one('cdock-show').hidden,false);assert.equal(D.isOpen(),false);
  assert.equal(JSON.parse(p.storage.get('casi-casi:lobby:chat')).oculto,true);
  p.show('game');p.emit('faraday:lobby-chat',message(300,'b','Beto','¿hola?'));assert.equal(D.unread(),0);
  assert.equal(p.root.hidden,false,'El botón para volver a enseñarlo sigue en el juego');
  const again=page({storage:p.storage});
  assert.equal(again.D._.state().hidden,true,'Se recuerda en localStorage');assert.equal(again.one('cdock-show').hidden,false);
  p.one('cdock-show').click();
  assert.equal(p.one('cdock-fab').hidden,false);assert.equal(p.one('cdock-show').hidden,true);assert.equal(JSON.parse(p.storage.get('casi-casi:lobby:chat')).oculto,false);
  p.show('game',false);

  // Sin conexión: «Chat no disponible» en vez del campo. Vuelve solo con la siguiente vista.
  p.lobby.on=false;D.refresh();
  assert.equal(p.one('cdock-form').hidden,true);assert.equal(p.one('cdock-off').hidden,false);assert.equal(p.one('cdock-off').textContent,'Chat no disponible');
  p.lobby.on=true;D.refresh();assert.equal(p.one('cdock-form').hidden,false);
  D._.setNow(()=>Date.now()+60000);D.refresh();
  assert.equal(state().online,false,'Sin vistas durante un rato');assert.equal(p.one('cdock-form').hidden,true);assert.equal(p.root.classList.contains('is-off'),true);
  p.emit('faraday:lobby',view({room:{n:2,count:2,cap:20}}));assert.equal(state().online,true);assert.equal(p.one('cdock-form').hidden,false);
  D._.setNow(null);

  // API: toggle, close, focus y mount.
  D.close();assert.equal(D.isOpen(),false);assert.equal(JSON.parse(p.storage.get('casi-casi:lobby:chat')).plegado,true,'El plegado de la portada se recuerda');
  D.toggle();assert.equal(D.isOpen(),true);D.toggle();assert.equal(D.isOpen(),false);
  D.focus();assert.equal(D.isOpen(),true);assert.equal(p.focused(),input);
  const custom=new p.Node('div');p.body.append(custom);
  assert.equal(D.mount(custom),true);assert.equal(p.root.parentNode,custom);
  assert.equal(D.mount(null),true);assert.equal(p.root.parentNode,p.slot);
  // Si un juego rehace su barra y se lleva la caja por delante, se recoloca sola con el siguiente pulso.
  p.show('game');p.root.remove();p.emit('faraday:lobby',view());assert.equal(p.root.parentNode,p.bars.game);
}

// Sin hueco en la portada: flota, pero no se enseña hasta que el lobby responde. En móvil, plegada.
{
  const p=page({withSlot:false,mobile:true}),{D}=p;
  assert.equal(D.place(),'home');assert.equal(p.root.parentNode,p.body);assert.equal(p.root.hidden,true);
  p.show('game');assert.equal(p.root.hidden,true,'En un juego tampoco hay botón si el lobby no ha respondido nunca');p.show('game',false);
  p.emit('faraday:lobby',view());
  assert.equal(p.root.hidden,false);assert.equal(D.isOpen(),false,'En móvil empieza plegada');assert.equal(p.root.dataset.place,'home');
  await tick();
  p.emit('faraday:lobby-chat',message(1,'a','Ana','hola'));assert.equal(D.unread(),1);
  // En móvil abrir no saca el teclado: el foco va al botón de cerrar.
  p.one('cdock-fab').click();assert.equal(D.isOpen(),true);assert.equal(D.unread(),0);assert.equal(p.focused(),p.one('cdock-x'));
  // El hueco aparece más tarde (lo crea lobby.js): la caja se muda a él con el siguiente pulso.
  const slot=new p.Node('div');slot.setAttribute('id','lobby-chat-slot');p.body.append(slot);
  p.emit('faraday:lobby',view());assert.equal(D.place(),'slot');assert.equal(p.root.parentNode,slot);
  // Un hueco que no se ve (display:none) no sirve: vuelve a flotar.
  slot.getClientRects=()=>[];D.refresh();assert.equal(D.place(),'home');assert.equal(p.root.parentNode,p.body);
  // …y no se vuelve a intentar en cada pulso (sin idas y venidas) hasta que lobby.js avisa o cambia el tamaño.
  let moves=0;const append=slot.append.bind(slot);slot.append=(...nodes)=>{moves++;append(...nodes)};
  D.refresh();assert.equal(moves,1,'Un intento');assert.equal(D.place(),'home');assert.equal(p.root.parentNode,p.body);
  D.refresh();p.emit('faraday:lobby',view());assert.equal(moves,1,'Descartado: ni un intento más');assert.equal(D.place(),'home');
  slot.getClientRects=()=>[{}];p.emit('faraday:lobby-ready',null);assert.equal(D.place(),'slot');assert.equal(p.root.parentNode,slot);
  assert.equal(p.all('cdock',p.body).length,1);
}

// Sin window.Lobby (lobby.js no ha cargado): nada se rompe y no hay campo.
{
  const p=page(),state=()=>p.D._.state();
  p.lobby.say=undefined;
  p.emit('faraday:lobby',view());
  assert.equal(state().online,false);assert.equal(p.one('cdock-form').hidden,true);assert.equal(p.one('cdock-off').textContent,'Chat no disponible');
  // Datos raros del lobby: se ignoran sin romper nada.
  p.emit('faraday:lobby',null);p.emit('faraday:lobby-chat',null);p.emit('faraday:lobby-chat',{text:''});p.emit('faraday:lobby',{room:'x',chat:'y'});
  p.emit('faraday:lobby',view({chat:[{id:'a',name:'Ana',text:'sin número'}]}));
  assert.equal(state().messages,0,'Un mensaje de la vista sin número no se puede distinguir de su aviso: no se pinta dos veces');
  p.lobby.muted=()=>{throw new Error('lobby roto')};p.lobby.active=()=>{throw new Error('lobby roto')};
  p.emit('faraday:lobby-chat',{n:1,id:'a',name:'',text:'hola'});
  assert.equal(state().messages,1);assert.equal(p.all('cdock-who')[0].textContent,'Jugador');
  // Cerrar desde fuera (ChatDock.close()) no le quita el foco a quien lo tenga.
  const field=new p.Node('input');p.body.append(field);p.focus(field);p.D.close();assert.equal(p.focused(),field);
}

console.log('chat-dock: ok');

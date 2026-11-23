// Salón (prototipo): un mundo en 3D por el que el jugador pasea con su avatar, en tercera persona, y se acerca a la
// ruleta, las tragaperras, la mesa de póker y las pantallas de crash para jugarse faradios de prueba. La sala la
// construye casino-world.js. Al acercarse a una mesa la cámara va hasta ella: se ve la mesa y su crupier, y encima
// van el tapete y los botones (casino-tables.js). Sin 3D, la mesa ocupa la pantalla. Las reglas y las cuentas están
// en casino-rules.js; el personaje lo construye avatar3d.js (Avatar3D.build) y aquí solo se le hace andar.
//
// Los faradios de prueba viven en este navegador (localStorage) y no tocan el saldo real ni el servidor: el saldo real
// de quien tiene cuenta lo lleva el servidor (decisión 0057) y un prototipo no debe escribir en él.
// Usa la misma copia de Three.js que avatar3d.js (misma dirección, así que el navegador la carga una sola vez).
import {casinoFriends} from './casino-friends.js';
import {dealer,rouletteLayout,createWheel,pokerTable,pokerActions} from './casino-tables.js';
import {slotBody,mountSlots} from './casino-slots.js';
import {createWorld,ROOM,STATIONS,SOLIDS,CAMERAS,pokerSeats} from './casino-world.js';

let THREE;
let opening = false;

const R=window.CasinoRules,dialog=document.getElementById('casino');
const INK='#1b1f27',PAPER='#fffdf7',CORAL='#ff6548',YELLOW='#ffdb70',BLUE='#b9d6e1',NIGHT='#1c2030',PANEL='#2a2e42';
const KEY='casi-casi:casino',reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const $=id=>document.getElementById(id);
const int=n=>new Intl.NumberFormat('es-ES',{maximumFractionDigits:0,useGrouping:'always'}).format(n);
const coins=n=>`${int(n)} <span class="casino-coin" aria-hidden="true">≈</span><span class="sr-only"> faradios de prueba</span>`;
const madrid=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Madrid'}).format(new Date());
const wait=ms=>new Promise(resolve=>setTimeout(resolve,reduced?0:ms));

// El monedero de prueba empieza con la misma cantidad para todos.
function loadWallet(){let saved=null;try{saved=JSON.parse(localStorage.getItem(KEY))}catch{}return R.wallet(saved,madrid())}
let wallet=loadWallet();
const keep=()=>{try{localStorage.setItem(KEY,JSON.stringify(wallet))}catch{}};
function showWallet(){
  const left=Math.max(0,R.DAILY_LOSS-Math.max(0,wallet.net));
  $('casino-wallet').innerHTML=`<b>${coins(wallet.coins)}</b><small>${left?`De prueba · ${int(left)} de margen hoy`:'De prueba · límite de hoy'}</small>`;
}
const WHY={bet:`La apuesta va de ${R.MIN_BET} a ${R.MAX_BET}.`,coins:'No te llegan los faradios de prueba.',limit:'Elige una ficha más pequeña o vuelve mañana.'};

// ---------- Mundo ----------
// La sala la construye casino-world.js; aquí se mueve el personaje y la cámara.
let renderer,scene,camera,world=null,hero,running=false,frame=0,last=0,built=false,near=null,game=null;
const peers=new Map();
let presence=[],mySeat=null,sitting=false;
const pos={x:0,z:6},keys={up:0,down:0,left:0,right:0},stick={x:0,y:0};
let yaw=0,pitch=.32,heading=Math.PI,stride=0,pace=0;
// Cámara: «zoom» va de 0 (sigue al personaje) a 1 (mira la mesa a la que se ha acercado, «shot»).
let zoom=0,shot=null;
const view={w:1,h:1},eye={};
// El juego abierto se juega dentro de la sala si hay mundo 3D y ese juego tiene cámara (las tragaperras no).
const liveShot=()=>running&&game?CAMERAS[game==='friends'?'poker':game]||null:null;

function buildHero(){
  if(hero){scene.remove(hero.entry.group);window.Avatar3D.dispose(hero.entry);hero=null}
  if(!window.Avatar3D?.build)throw new Error('Avatar no disponible');
  const look=window.Avatar.resolve(window.Progress?.look?.()),entry=window.Avatar3D.build(look);
  entry.group.traverse(node=>{if(node.isMesh)node.castShadow=true});
  scene.add(entry.group);hero={entry,feet:entry.parts.feet.map(shoe=>shoe.position.clone())};
}
// Andar: piernas y brazos se balancean al contrario, los pies siguen a las piernas y el cuerpo sube y baja un poco.
function poseHero(dt,now){
  if(!hero)return;
  const {body,upper,neck,arms,legs,feet}=hero.entry.parts,walk=pace,swing=Math.sin(stride)*.62*walk,breath=Math.sin(now/620)*(1-walk);
  hero.entry.group.position.set(pos.x,0,pos.z);hero.entry.group.rotation.y=heading;
  body.position.set(0,hero.entry.base+Math.abs(Math.cos(stride))*.045*walk,0);body.rotation.set(0,0,Math.sin(stride)*.03*walk);
  upper.rotation.set(.06*walk,-Math.sin(stride)*.12*walk,0);neck.rotation.set(-.04*walk,Math.sin(stride)*.06*walk,0);
  legs.forEach((leg,i)=>{
    const s=(i?-1:1)*swing;leg.rotation.x=s;leg.rotation.z=0;leg.scale.y=1;
    const home=hero.feet[i];feet[i].position.set(home.x,home.y+Math.max(0,(i?-1:1)*Math.cos(stride))*.11*walk,home.z-Math.sin(s)*.62);feet[i].rotation.x=s*.5;
  });
  arms.forEach(({arm,fore,side},i)=>{const s=(i?1:-1)*swing*.85;arm.rotation.set(.02+s,0,side*(.34+breath*.012));fore.rotation.set(-.28-Math.abs(s)*.5+breath*.02,0,side*-.08)});
  if(mySeat!==null||sitting)seatPose(hero.entry);
}

function build(){
  const canvas=$('casino-canvas');
  renderer=new THREE.WebGLRenderer({canvas,antialias:true});renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(52,1,.1,90);
  world=createWorld({THREE,R,scene,screens:crashScreens,rivals:RIVALS});
  world.felt(rt.bets);
  Object.assign(eye,{at:new THREE.Vector3(),look:new THREE.Vector3(),spare:new THREE.Vector3()});
  built=true;
}
function resize(){
  if(!renderer)return;const w=dialog.clientWidth,h=dialog.clientHeight;if(!w||!h)return;
  view.w=w;view.h=h;
  renderer.setSize(w,h,false);camera.aspect=w/h;camera.fov=w<h?66:52;camera.updateProjectionMatrix();
}

// Choques: paredes, mesas, barra y demás muebles (círculos o cajas).
function collide(){
  const W=ROOM.w/2-.75,D=ROOM.d/2-.75;pos.x=Math.max(-W,Math.min(W,pos.x));pos.z=Math.max(-D,Math.min(D,pos.z));
  for(const s of SOLIDS){
    if(s.box){const [hw,hd]=s.box,dx=pos.x-s.x,dz=pos.z-s.z,px=hw+.35-Math.abs(dx),pz=hd+.35-Math.abs(dz);if(px>0&&pz>0){if(px<pz)pos.x+=Math.sign(dx||1)*px;else pos.z+=Math.sign(dz||1)*pz}continue}
    const dx=pos.x-s.x,dz=pos.z-s.z,d=Math.hypot(dx,dz)||.001;if(d<s.r){pos.x=s.x+dx/d*s.r;pos.z=s.z+dz/d*s.r}
  }
}
function seatPose(model){
  model.group.position.y=-.28;
  for(const leg of model.parts.legs)leg.rotation.x=-1.12;
}
// Coloca al personaje en un sitio y deja la cámara a su espalda para cuando se levante.
function place(spot){pos.x=spot.x;pos.z=spot.z;heading=spot.heading;yaw=Math.PI-heading}
function showPeers(players,seat=null){
  presence=players||[];
  if(seat!==mySeat&&pokerSeats[seat])place(pokerSeats[seat]);
  mySeat=seat;
  dialog.classList.toggle('is-seated',mySeat!==null);
  const status=$('casino-presence');
  status.hidden=!players;
  status.textContent=presence.length?`Con amigos · ${presence.map(peer=>peer.name).join(', ')}`:'Salón compartido · Esperando a tus amigos';
  const ids=new Set(presence.map(peer=>peer.id));
  for(const [id,peer] of peers){
    if(ids.has(id))continue;
    scene.remove(peer.model.group);
    peer.model.group.remove(peer.tag);
    peer.tag.material.map.dispose();
    peer.tag.material.dispose();
    window.Avatar3D.dispose(peer.model);
    peers.delete(id);
  }
}
function movePeers(dt){
  for(const friend of presence){
    const target=pokerSeats[friend.seat]??friend;
    let peer=peers.get(friend.id);
    if(!peer){
      const model=window.Avatar3D.build(window.Avatar.resolve(friend.look));
      const texture=world.paint(512,92,(context,w,h)=>{
        context.fillStyle='#202436';context.beginPath();context.roundRect(0,0,w,h,30);context.fill();
        context.fillStyle=PAPER;context.font='bold 48px Arial';context.textAlign='center';context.textBaseline='middle';
        context.fillText(friend.name,w/2,h/2,w-32);
      });
      const tag=new THREE.Sprite(new THREE.SpriteMaterial({map:texture}));
      tag.position.y=3;tag.scale.set(2.4,.43,1);
      model.group.add(tag);model.group.position.set(friend.x,0,friend.z);
      model.group.rotation.y=friend.heading;
      scene.add(model.group);
      peer={model,tag,stride:0};
      peers.set(friend.id,peer);
    }
    const {group,parts}=peer.model;
    const speed=Math.min(1,dt*5);
    const distance=Math.hypot(target.x-group.position.x,target.z-group.position.z);
    group.position.x+=(target.x-group.position.x)*speed;
    group.position.z+=(target.z-group.position.z)*speed;
    const turn=target.heading-group.rotation.y;
    group.rotation.y+=Math.atan2(Math.sin(turn),Math.cos(turn))*speed;
    peer.stride+=dt*9;
    const swing=reduced?0:Math.sin(peer.stride)*Math.min(.45,distance);
    parts.legs.forEach((leg,i)=>{leg.rotation.x=i?swing:-swing});
    parts.arms.forEach(({arm},i)=>{arm.rotation.x=i?-swing:swing});
    group.position.y=0;
    if(pokerSeats[friend.seat])seatPose(peer.model);
  }
}
function nearest(){
  let best=null,dist=Infinity;
  for(const s of STATIONS){
    const dx=Math.abs(pos.x-s.x),dz=Math.abs(pos.z-s.z);
    const d=s.box?Math.hypot(Math.max(0,dx-s.box[0]),Math.max(0,dz-s.box[1])):Math.hypot(dx,dz)-s.r;
    if(d<1.4&&d<dist){best=s;dist=d}
  }
  return best;
}
function tick(now){
  if(!running)return;frame=requestAnimationFrame(tick);
  const dt=Math.min(.05,(now-last)/1000);last=now;
  let ix=keys.right-keys.left+stick.x,iz=keys.down-keys.up+stick.y;const len=Math.hypot(ix,iz),moving=len>.08&&!game&&mySeat===null;
  if(moving){
    if(len>1){ix/=len;iz/=len}
    const dx=ix*Math.cos(yaw)+iz*Math.sin(yaw),dz=-ix*Math.sin(yaw)+iz*Math.cos(yaw),speed=4.6;
    pos.x+=dx*speed*dt;pos.z+=dz*speed*dt;collide();
    let turn=Math.atan2(dx,dz)-heading;turn=Math.atan2(Math.sin(turn),Math.cos(turn));heading+=turn*Math.min(1,dt*12);
    stride+=dt*9.5*Math.min(1,len);
  }
  pace+=((moving?1:0)-pace)*Math.min(1,dt*10);if(reduced)pace=0;
  poseHero(dt,now);
  movePeers(dt);
  stepCrash(now);
  // Con amigos sentados, los jugadores de la casa les dejan la mesa.
  world.guests(mySeat===null&&!presence.some(peer=>pokerSeats[peer.seat]));
  world.update(dt,now,camera,pos,reduced);
  // La cámara sigue al personaje; al acercarse a una mesa se va hasta ella y vuelve al levantarse.
  const live=liveShot();
  if(live)shot=live;
  zoom=reduced?(live?1:0):zoom+((live?1:0)-zoom)*Math.min(1,dt*3.4);
  const dist=camera.aspect<1?7.4:6.4,cx=Math.sin(yaw)*Math.cos(pitch)*dist,cz=Math.cos(yaw)*Math.cos(pitch)*dist;
  const W=ROOM.w/2-.6,D=ROOM.d/2-.6;
  eye.at.set(Math.max(-W,Math.min(W,pos.x+cx)),1.5+Math.sin(pitch)*dist,Math.max(-D,Math.min(D,pos.z+cz)));eye.look.set(pos.x,1.35,pos.z);
  let lift=0;
  if(shot&&zoom>.002){
    const k=zoom*zoom*(3-2*zoom),narrow=camera.aspect<1,far=narrow?1.5:1,[ax,ay,az]=shot.at,[lx,ly,lz]=shot.look;
    eye.at.lerp(eye.spare.set(lx+(ax-lx)*far,ly+(ay-ly)*far,lz+(az-lz)*far),k);eye.look.lerp(eye.spare.set(lx,ly,lz),k);
    lift=shot.lift*(narrow?1.35:1)*k;
  }
  camera.position.copy(eye.at);camera.lookAt(eye.look);
  if(lift)camera.setViewOffset(view.w,view.h,0,view.h*lift,view.w,view.h);else if(camera.view)camera.clearViewOffset();
  // El bocadillo de la crupier va sobre su cabeza.
  const speaker=live&&game!=='crash'&&world.head(game==='roulette'?'roulette':'poker',eye.spare);
  if(speaker){
    speaker.project(camera);
    stage.style.setProperty('--say-x',`${((speaker.x+1)/2*view.w).toFixed(1)}px`);stage.style.setProperty('--say-y',`${((1-speaker.y)/2*view.h).toFixed(1)}px`);
  }
  const next=game||mySeat!==null?null:nearest();
  near=next;
  const prompt=$('casino-prompt'),seated=mySeat!==null&&!game;
  const label=seated?'Volver a la mesa':near?`Jugar a ${near.name} <kbd>E</kbd>`:'';
  if(prompt.dataset.label!==label){prompt.dataset.label=label;prompt.hidden=!label;prompt.innerHTML=label}
  // Las tragaperras tapan el salón: mientras tanto no hace falta pintarlo.
  if(!game||live)renderer.render(scene,camera);
}

// ---------- Controles ----------
const KEYS={KeyW:'up',ArrowUp:'up',KeyS:'down',ArrowDown:'down',KeyA:'left',ArrowLeft:'left',KeyD:'right',ArrowRight:'right'};
const typing=event=>event.target instanceof HTMLInputElement;
dialog.addEventListener('keydown',event=>{
  if(typing(event))return;
  if(KEYS[event.code]&&!game){keys[KEYS[event.code]]=1;event.preventDefault()}
  if((event.code==='KeyE'||event.code==='Enter')&&near&&!game&&!(event.target instanceof HTMLButtonElement)){event.preventDefault();openGame(near.id)}
});
dialog.addEventListener('keyup',event=>{if(KEYS[event.code])keys[KEYS[event.code]]=0});
window.addEventListener('blur',()=>{for(const key in keys)keys[key]=0});
{
  // Arrastrar sobre el mundo gira la cámara.
  const canvas=$('casino-canvas');let drag=null;
  canvas.addEventListener('pointerdown',event=>{drag={id:event.pointerId,x:event.clientX,y:event.clientY};canvas.setPointerCapture(event.pointerId)});
  canvas.addEventListener('pointermove',event=>{if(!drag||drag.id!==event.pointerId)return;yaw-=(event.clientX-drag.x)*.006;pitch=Math.max(.08,Math.min(1.05,pitch+(event.clientY-drag.y)*.004));drag.x=event.clientX;drag.y=event.clientY});
  const drop=event=>{if(drag?.id===event.pointerId)drag=null};canvas.addEventListener('pointerup',drop);canvas.addEventListener('pointercancel',drop);
  // Palanca táctil para andar.
  const pad=$('casino-stick'),knob=pad.firstElementChild;let hold=null;
  const move=event=>{const box=pad.getBoundingClientRect(),r=box.width/2;let x=(event.clientX-box.left-r)/r,y=(event.clientY-box.top-r)/r;const len=Math.hypot(x,y);if(len>1){x/=len;y/=len}stick.x=x;stick.y=y;knob.style.transform=`translate(${x*r*.55}px,${y*r*.55}px)`};
  pad.addEventListener('pointerdown',event=>{hold=event.pointerId;pad.setPointerCapture(hold);move(event)});
  pad.addEventListener('pointermove',event=>{if(hold===event.pointerId)move(event)});
  const release=event=>{if(hold!==event.pointerId)return;hold=null;stick.x=stick.y=0;knob.style.transform=''};pad.addEventListener('pointerup',release);pad.addEventListener('pointercancel',release);
}
$('casino-prompt').addEventListener('click',()=>{
  if(mySeat!==null)openGame('friends');
  else if(near)openGame(near.id);
});

// ---------- Juegos ----------
// Sentarse a una mesa cambia la pantalla entera: se ve la mesa, con su crupier, y no un cuadro encima del salón.
const stage=$('casino-stage'),H=R.HOLDEM;
const shell=(title,note,body,bar,after='')=>`<header class="stage-head"><button class="casino-exit" type="button" data-casino-leave aria-label="Volver al salón">← <span>Salón</span></button>
  <div><h3>${title}</h3><p>${note}</p></div></header><div class="stage-body">${body}${after}</div><footer class="stage-bar">${bar}</footer>`;
const friends=casinoFriends({
  panel:stage,shell,onPresence:showPeers,position:()=>({...pos,heading}),closeSalon:()=>dialog.close()
});
let bet=R.CHIPS[1],busy=false;
const chips=(values=R.CHIPS,on=bet)=>`<div class="casino-chips" role="group" aria-label="Valor de la ficha">${values.map(n=>`<button type="button" class="casino-chip is-${n}${n===on?' is-on':''}" data-bet="${n}" aria-pressed="${n===on}">${n}</button>`).join('')}</div>`;
const outcome=last=>!last?'<p class="casino-result" aria-live="polite"></p>':`<p class="casino-result ${last.delta>0?'is-win':last.delta<0?'is-loss':''}" aria-live="polite">${last.text} <b>${last.delta>0?'+':last.delta<0?'−':''}${coins(Math.abs(last.delta))}</b></p>`;
const plus='<div data-plus-slot="casino" data-compact="true"></div>';
function refreshWallet(){wallet=loadWallet();showWallet()}
const say=text=>{const bubble=stage.querySelector('[data-dealer-say]');if(bubble)bubble.textContent=text};

// ---- Ruleta: se dejan fichas por el tapete y la bola decide.
const rt={bets:{},moves:[],previous:null,history:[],chip:5,wheel:null,note:'',hit:null};
const rtTotal=()=>Object.values(rt.bets).reduce((sum,n)=>sum+n,0);
function rouletteView(){
  // Dentro de la sala, la rueda y la crupier son las de la mesa; sin 3D se dibujan aquí.
  const number='<output class="rt-number" id="rt-number" aria-label="Número que ha salido"></output>';
  return shell('Ruleta','Europea, un solo cero. Pleno 35 a 1, caballo 17 a 1, transversal 11 a 1, cuadro 8 a 1, seisena 5 a 1.',`
    <div class="rt">
      ${liveShot()?'':`<div class="rt-wheel"><canvas id="rt-canvas" aria-hidden="true"></canvas>${number}</div>`}
      <div class="rt-dealer">${dealer('Hagan juego')}${liveShot()?number:''}<ol class="rt-history" id="rt-history" aria-label="Últimos números"></ol></div>
      <div class="rt-felt">
        <div class="rt-layout" id="rt-layout" role="group" aria-label="Tapete de apuestas">${rouletteLayout(R)}</div>
        <div class="rt-calls" role="group" aria-label="Apuestas anunciadas">${Object.entries(R.CALLS).map(([id,call])=>`<button type="button" class="casino-option" data-call="${id}">${call.name} <small>${call.chips.reduce((sum,[,n])=>sum+n,0)} fichas</small></button>`).join('')}</div>
      </div>
    </div>`,`
    ${chips(R.TABLE_CHIPS,rt.chip)}
    <p class="rt-total" id="rt-total"></p>
    <div class="stage-actions">
      <button type="button" class="casino-option" data-rt="undo">Deshacer</button>
      <button type="button" class="casino-option" data-rt="clear">Borrar</button>
      <button type="button" class="casino-option" data-rt="repeat">Repetir</button>
      <button type="button" class="casino-play" data-spin>Girar</button>
    </div>
    <p class="casino-result" id="rt-result" aria-live="polite"></p>`,'<div id="rt-plus"></div>');
}
function updateRoulette(){
  const total=rtTotal();
  for(const button of stage.querySelectorAll('[data-spot]')){
    const amount=rt.bets[button.dataset.spot]||0;let chip=button.querySelector('.rt-chip');
    if(!amount){chip?.remove();continue}
    if(!chip){chip=document.createElement('i');chip.className='rt-chip';button.append(chip)}
    chip.textContent=amount;chip.dataset.tone=R.TABLE_CHIPS.findLast(n=>n<=amount);
  }
  for(const button of stage.querySelectorAll('[data-bet]')){const on=Number(button.dataset.bet)===rt.chip;button.classList.toggle('is-on',on);button.setAttribute('aria-pressed',on)}
  $('rt-total').innerHTML=`Sobre la mesa <b>${coins(total)}</b><small>De ${R.MIN_BET} a ${R.MAX_BET} por giro</small>`;
  stage.querySelector('[data-rt="undo"]').disabled=stage.querySelector('[data-rt="clear"]').disabled=busy||!total;
  stage.querySelector('[data-rt="repeat"]').disabled=busy||!!total||!rt.previous;
  stage.querySelector('[data-spin]').disabled=busy||total<R.MIN_BET;
  $('rt-history').innerHTML=rt.history.map(n=>`<li class="is-${R.color(n)}">${n}</li>`).join('');
  if(rt.note!==null){const result=$('rt-result');result.className='casino-result is-loss';result.textContent=rt.note}
  world?.felt(rt.bets,rt.hit);
}
// Deja fichas en una o varias casillas de una vez (las anunciadas cubren varias). No pasa del máximo por giro.
function placeChips(list){
  if(busy)return;
  if(rtTotal()+list.reduce((sum,[,n])=>sum+n,0)>R.MAX_BET)rt.note=`El máximo por giro son ${R.MAX_BET} faradios de prueba.`;
  else{for(const [id,n] of list)rt.bets[id]=(rt.bets[id]||0)+n;rt.moves.push(list);rt.note=''}
  updateRoulette();
}
function editRoulette(action){
  if(busy)return;
  if(action==='clear'){rt.bets={};rt.moves=[]}
  else if(action==='undo')for(const [id,n] of rt.moves.pop()||[]){rt.bets[id]-=n;if(!rt.bets[id])delete rt.bets[id]}
  else if(action==='repeat'&&rt.previous&&!rtTotal()){rt.bets={...rt.previous};rt.moves=[Object.entries(rt.bets)]}
  rt.note='';updateRoulette();
}
async function spinRoulette(){
  const total=R.rouletteStake(rt.bets);
  if(busy||!(total>=R.MIN_BET))return;
  refreshWallet();
  const status=R.check(wallet,total);
  if(!status.ok){rt.note=WHY[status.reason];return updateRoulette()}
  busy=true;rt.note=null;
  const n=R.spin(),back=R.rouletteReturn(rt.bets,n),result=R.settle(wallet,total,back/total);
  // Se cobra al lanzar la bola: cerrar la pestaña no deshace el giro. El monedero se enseña al acabar.
  wallet=result.wallet;keep();
  stage.classList.add('is-rolling');$('rt-result').textContent='';$('rt-plus').innerHTML='';
  $('rt-number').textContent='';$('rt-number').className='rt-number';
  stage.querySelectorAll('.is-hit,.is-won,.is-lost').forEach(el=>el.classList.remove('is-hit','is-won','is-lost'));
  updateRoulette();say('No va más');
  await (rt.wheel?rt.wheel.spin(n):world.spin(n,reduced));
  showWallet();
  rt.history=[n,...rt.history].slice(0,12);rt.hit=n;world?.felt(rt.bets,n);
  const tone={green:'verde',red:'rojo',black:'negro'}[R.color(n)];
  say(`¡${n}, ${tone}${n?n%2?', impar':', par':''}!`);
  $('rt-number').textContent=n;$('rt-number').className=`rt-number is-${R.color(n)}`;
  for(const button of stage.querySelectorAll('[data-spot]')){
    const id=button.dataset.spot;
    if(id==='n'+n)button.classList.add('is-hit');
    if(rt.bets[id])button.classList.add(R.roulette(id,n)?'is-won':'is-lost');
  }
  const text=$('rt-result');
  text.className=`casino-result ${result.delta>0?'is-win':result.delta<0?'is-loss':''}`;
  text.innerHTML=`Sale el ${n}, ${tone}. ${back?`Cobras ${coins(back)}`:'Pierdes'} <b>${result.delta>0?'+':result.delta<0?'−':''}${coins(Math.abs(result.delta))}</b>`;
  $('rt-history').innerHTML=rt.history.map(k=>`<li class="is-${R.color(k)}">${k}</li>`).join('');
  await wait(2600);
  rt.previous=rt.bets;rt.bets={};rt.moves=[];rt.hit=null;busy=false;
  stage.classList.remove('is-rolling');
  if(game!=='roulette')return world?.felt();
  stage.querySelectorAll('.is-won,.is-lost').forEach(el=>el.classList.remove('is-won','is-lost'));
  say('Hagan juego');updateRoulette();$('rt-plus').innerHTML=plus;
}

// ---- Tragaperras «Tormenta»: rejilla de 6 × 5 sin líneas, con caídas, esferas y tiradas gratis (STORM en
// casino-rules.js). La jugada se resuelve y se cobra al pulsar; casino-slots.js la reproduce en pantalla.
const sl={ui:null,grid:null,fast:false,last:null,note:''};
function slotsView(){
  return shell('Tormenta','Sin líneas: 8 iguales o más pagan estén donde estén, caen y pueden volver a pagar. 4 chispas dan tiradas gratis.',slotBody(R),`
    ${chips()}
    <div class="stage-actions">
      <button type="button" class="casino-option st-toggle" data-slot="fast" aria-pressed="false">Rápido</button>
      <button type="button" class="casino-play st-spin" data-slot="spin"></button>
      <button type="button" class="casino-option st-toggle" data-slot="sound" aria-pressed="false">Sonido</button>
    </div>
    <p class="casino-result" id="st-result" aria-live="polite"></p>`,'<div id="st-plus"></div>');
}
function updateSlots(){
  const status=R.check(wallet,bet),spin=stage.querySelector('[data-slot="spin"]'),result=$('st-result');
  for(const button of stage.querySelectorAll('[data-bet]')){const on=Number(button.dataset.bet)===bet;button.classList.toggle('is-on',on);button.setAttribute('aria-pressed',on);button.disabled=busy}
  // Con la jugada en marcha, el botón sirve para saltarse lo que queda de animación.
  spin.innerHTML=busy?'Saltar':`Girar <small>${int(bet)} ≈</small>`;spin.disabled=!busy&&!status.ok;
  stage.querySelector('[data-slot="fast"]').setAttribute('aria-pressed',sl.fast);
  stage.querySelector('[data-slot="sound"]').setAttribute('aria-pressed',window.Sound?.on??false);
  if(busy){result.className='casino-result';result.textContent='';return}
  const why=status.ok?'':WHY[status.reason],last=sl.last;
  result.className=`casino-result ${why?'is-loss':last?.delta>0?'is-win':last?.delta<0?'is-loss':''}`;
  result.innerHTML=why||(last?`${last.text} <b>${last.delta>0?'+':last.delta<0?'−':''}${coins(Math.abs(last.delta))}</b>`:'');
}
async function pullSlots(){
  refreshWallet();
  if(busy||!sl.ui||!R.check(wallet,bet).ok)return updateSlots();
  busy=true;$('st-plus').innerHTML='';
  const stake=bet,round=R.STORM.play(),result=R.settle(wallet,stake,round.total),back=Math.round(stake*round.total);
  // Se cobra y se paga al pulsar: cerrar la pestaña no cambia el resultado. Mientras gira, el monedero enseña solo
  // la apuesta descontada; el premio aparece al acabar.
  wallet=result.wallet;keep();
  $('casino-wallet').querySelector('b').innerHTML=coins(wallet.coins-back);
  updateSlots();
  sl.grid=await sl.ui.play(round,stake);
  showWallet();
  const free=round.spins.length-1;
  sl.last={delta:result.delta,text:back?`${free?`${free} tiradas gratis. `:''}${back>stake?'Ganas':back===stake?'Recuperas la apuesta':`Vuelven ${int(back)} de ${int(stake)}`}`:'Sin premio'};
  busy=false;
  if(game!=='slots')return;
  updateSlots();$('st-plus').innerHTML=plus;
}

// ---- Póker: Texas Hold'em contra cuatro jugadores de la casa. Te sientas con 100 faradios de prueba y, al
// levantarte, vuelven al monedero las fichas que te queden. Las fichas de la mesa se apuntan aparte para que no
// se pierdan si se cierra la pestaña con una mano a medias (lo que ya esté en el bote, sí).
const BUYIN=R.MAX_BET,BLINDS=[1,2],SEAT_KEY='casi-casi:casino-mesa';
const RIVALS=[
  {name:'Volta',look:{body:'mujer',hairColor:'rubio',top:'mj-top-blanco'}},{name:'Ohm',look:{hairColor:'castano',skin:'canela'}},
  {name:'Curie',look:{body:'mujer',hairColor:'negro',skin:'cacao'}},{name:'Tesla',look:{hairColor:'rojo',skin:'claro'}}
];
const pk={seated:false,hand:null,stacks:[0,BUYIN,BUYIN,BUYIN,BUYIN],button:0,notes:[],run:0,raise:0,cards:0,shown:-1,message:'',say:'¿Te sientas?'};
// Devuelve faradios de prueba al monedero (fichas que se retiran de una mesa o un premio ya apostado).
function pay(amount){if(amount>0){wallet=loadWallet();wallet.coins+=amount;wallet.net-=amount;keep();showWallet()}}
function credit(amount){
  pay(amount);
  try{localStorage.removeItem(SEAT_KEY)}catch{}
}
// Lleva la mano a la mesa de la sala: cartas comunes, quién sigue y el bote. La crupier reparte cuando salen cartas.
function syncPoker(){
  if(!world)return;
  const s=game==='poker'?pk.hand:null;
  if(!s){pk.shown=-1;return world.poker(null)}
  if(s.board.length!==pk.shown){pk.shown=s.board.length;if(world.dealers.poker)world.dealers.poker.gesture=1}
  world.poker({board:s.board,live:s.seats.map(p=>!p.folded),pot:s.stage!=='done'&&H.pot(s)});
}
const keepSeat=()=>{try{localStorage.setItem(SEAT_KEY,String(pk.hand?pk.hand.seats[0].stack:pk.stacks[0]))}catch{}};
// Fichas que quedaron en la mesa en una visita anterior.
function recoverSeat(){
  if(pk.seated)return;
  let left=0;try{left=Math.floor(Number(localStorage.getItem(SEAT_KEY)))||0}catch{}
  if(left>0)credit(Math.min(left,100000));
}
function sitPoker(){
  refreshWallet();
  const status=R.check(wallet,BUYIN);
  if(pk.seated||!status.ok){pk.message=status.ok?'':WHY[status.reason];return render()}
  wallet=R.settle(wallet,BUYIN,0).wallet;keep();showWallet();
  Object.assign(pk,{seated:true,message:''});pk.stacks[0]=BUYIN;
  dealPoker();
}
function standPoker(){
  if(!pk.seated)return;
  pk.run++;
  if(pk.hand&&pk.hand.stage!=='done')H.leave(pk.hand,0);
  credit(pk.hand?pk.hand.seats[0].stack:pk.stacks[0]);
  Object.assign(pk,{seated:false,hand:null,message:'',say:'¿Te sientas?'});pk.stacks[0]=0;
}
function dealPoker(){
  if(!pk.seated||(pk.hand&&pk.hand.stage!=='done'))return;
  pk.stacks=pk.stacks.map((stack,i)=>i&&stack<BLINDS[1]*10?BUYIN:stack);
  pk.button=(pk.button+1)%pk.stacks.length;
  pk.hand=H.start({stacks:[...pk.stacks],button:pk.button,small:BLINDS[0],big:BLINDS[1],deck:R.deck()});
  Object.assign(pk,{notes:[],raise:0,cards:0,shown:-1,message:'',say:'Cartas repartidas'});
  keepSeat();playPoker();
}
// Los de la casa juegan con una idea aproximada de lo que llevan: suben con mano fuerte, igualan si sale barato.
function rivalMove(s,i){
  const rules=H.legal(s),p=s.seats[i],pot=H.pot(s);
  let strength;
  if(!s.board.length){
    const [a,b]=p.cards.map(card=>card.r).sort((x,y)=>y-x);
    strength=(a+b)/40+(a===b?.35:0)+(p.cards[0].s===p.cards[1].s?.06:0)+(a-b===1?.04:0);
  }else{
    const mine=H.best([...p.cards,...s.board]).score,shared=H.best(s.board).score;
    // Lo que ya está en las cartas comunes lo tiene todo el mundo: no cuenta como mano propia.
    strength=H.compare(mine,shared)>0&&mine[0]>shared[0]?[.2,.56,.78,.86,.92,.95,.98,1,1][mine[0]]:.12+mine[1]/90;
  }
  strength+=(Math.random()-.5)*.22;
  const price=rules.toCall/(pot+rules.toCall||1);
  if(rules.canRaise&&strength>.76&&Math.random()<.75)
    return {type:'raise',to:Math.min(rules.maxTo,Math.max(rules.minTo,s.current+Math.round(pot*(.5+Math.random()*.5))))};
  if(rules.canCheck)return rules.canRaise&&Math.random()<.07?{type:'raise',to:rules.minTo}:{type:'check'};
  return strength>price+.24||(strength>.44&&rules.toCall<=s.big*2)?{type:'call'}:{type:'fold'};
}
const moveNote=(move,s,before)=>move.type==='fold'?'':move.type==='check'?'Pasa':move.type==='call'?'Iguala':before?`Sube a ${int(move.to)}`:`Apuesta ${int(move.to)}`;
async function playPoker(){
  const run=++pk.run,s=pk.hand;
  for(;;){
    if(s.board.length!==pk.cards){pk.cards=s.board.length;pk.notes=[];pk.say=['','','','El flop','El turn','El river'][pk.cards]||''}
    if(s.turn===null)break;
    if(game==='poker')render();
    if(s.turn===0){pk.say='Tú hablas';if(game==='poker')render();return}
    await new Promise(resolve=>setTimeout(resolve,reduced?250:700+Math.random()*700));
    if(run!==pk.run)return;
    const i=s.turn,before=s.current,move=rivalMove(s,i);
    H.act(s,i,move);pk.notes[i]=moveNote(move,s,before);
  }
  pk.stacks=s.seats.map(p=>p.stack);
  const names=s.result.winners.map(i=>i?RIVALS[i-1].name:'Tú');
  pk.say=names.length?`${names.join(' y ')} ${names.length>1||!names.includes('Tú')?names.length>1?'se reparten':'se lleva':'te llevas'} el bote`:'Bote devuelto';
  pk.notes=[];
  if(pk.stacks[0]<BLINDS[1]){credit(pk.stacks[0]);pk.stacks[0]=0;pk.seated=false;pk.message='Te has quedado sin fichas en la mesa.'}
  else keepSeat();
  if(game==='poker')render();
}
function pokerMove(type){
  const s=pk.hand;
  if(!s||s.turn!==0)return;
  const rules=H.legal(s),before=s.current,move={type,to:Math.min(rules.maxTo,Math.max(rules.minTo,pk.raise||rules.minTo))};
  if(!H.act(s,0,move))return;
  pk.notes[0]=moveNote(move,s,before);pk.raise=0;keepSeat();playPoker();
}
function pokerView(){
  const s=pk.hand,done=s?.stage==='done',rules=s&&s.turn===0?H.legal(s):null;
  const seats=[{name:'Tú',look:window.Progress?.look?.()},...RIVALS].map((player,i)=>{
    const p=s?.seats[i];
    return {...player,stack:p?p.stack:i?pk.stacks[i]:pk.seated?pk.stacks[0]:undefined,bet:p?.bet,folded:p?.folded,allin:p?.allin&&!done,
      cards:!p?.cards?undefined:!i||(done&&s.result.showdown&&!p.folded)?p.cards:null,
      button:!!s&&s.button===i,turn:s?.turn===i,note:pk.notes[i],won:done?s.result.won[i]>p.total?s.result.won[i]:0:0,hand:done&&s.result.hands[i]||''};
  });
  const mine=s&&!s.seats[0].folded&&s.board.length?`Llevas <b>${H.best([...s.seats[0].cards,...s.board]).name}</b>`:'';
  const center=pk.seated?'':`<p>${pk.message||`Texas Hold'em sin límite. Ciegas ${BLINDS.join(' y ')}.`}</p>`;
  const why=pk.seated?'':(status=>status.ok?'':WHY[status.reason])(R.check(wallet,BUYIN));
  const bar=rules?pokerActions(rules,pk.raise,BLINDS[1])
    :!pk.seated?`<div class="stage-actions"><button type="button" class="casino-play" data-poker="sit"${why?' disabled':''}>Sentarme con ${int(BUYIN)} ≈</button>
        <button type="button" class="casino-option" data-casino-friends>Jugar con amigos</button></div>${why?`<p class="casino-result is-loss">${why}</p>`:''}`
    :done?`<div class="stage-actions"><button type="button" class="casino-play" data-poker="deal">Repartir otra mano</button>
        <button type="button" class="casino-option" data-poker="stand">Levantarme y cobrar ${int(pk.stacks[0])} ≈</button></div>`
    :`<div class="stage-actions"><p class="pk-wait">Juega ${RIVALS[s.turn-1]?.name||'la mesa'}…</p><button type="button" class="casino-option" data-poker="stand">Levantarme</button></div>`;
  return shell('Póker',`Texas Hold'em · ciegas ${BLINDS.join('/')} · dos cartas para ti y cinco en la mesa.`,
    pokerTable({seats,board:s?.board,pot:s&&!done?H.pot(s):0,say:pk.say,center,mine}),bar,done?plus:'');
}

// ---- Crash: las rondas corren solas en las pantallas de la sala, se juegue o no. Se apuesta mientras se espera la
// salida, la apuesta se cobra al despegar y hay que retirarse antes de que reviente.
const BETS_MS=7000,BUST_MS=3800;
const times=m=>m.toFixed(2).replace('.',',')+'×';
const blank=(width,height)=>Object.assign(document.createElement('canvas'),{width,height});
const crashScreens={main:blank(1024,512),history:blank(400,512),guide:blank(400,512)};
const cr={phase:'bets',from:0,point:1,m:1,history:[],next:0,bet:0,result:null,cashed:0,note:''};
const type=(size,weight=700)=>`${weight} ${size}px "Space Grotesk",Arial,sans-serif`;
const crashTone=m=>m>=10?'is-top':m>=2?'is-good':'is-low';
function drawCrash(now){
  const c=crashScreens.main.getContext('2d'),w=1024,h=512;
  c.fillStyle='#0d1020';c.fillRect(0,0,w,h);
  c.strokeStyle='#ffffff12';c.lineWidth=2;c.beginPath();
  for(let x=60;x<w;x+=96){c.moveTo(x,0);c.lineTo(x,h)}
  for(let y=82;y<h;y+=76){c.moveTo(0,y);c.lineTo(w,y)}
  c.stroke();
  c.textBaseline='middle';c.textAlign='left';c.fillStyle=CORAL;c.font=type(34);c.fillText('CRASH ≈',34,44);
  if(cr.bet||cr.next){c.textAlign='right';c.fillStyle=YELLOW;c.font=type(28);c.fillText(cr.bet?`Tu apuesta: ${int(cr.bet)} ≈`:`Apuestas ${int(cr.next)} ≈`,w-34,44)}
  c.textAlign='center';
  if(cr.phase==='bets'){
    const left=Math.max(0,BETS_MS-(now-cr.from));
    c.fillStyle='#cfd3e6';c.font=type(40);c.fillText('PRÓXIMA RONDA',w/2,160);
    c.fillStyle=PAPER;c.font=type(170,800);c.fillText((left/1000).toFixed(1).replace('.',',')+' s',w/2,290);
    c.fillStyle='#ffffff22';c.fillRect(212,410,600,16);c.fillStyle=YELLOW;c.fillRect(212,410,600*left/BETS_MS,16);
    return;
  }
  const bust=cr.phase==='crash',m=cr.m,T=Math.max(.001,R.CRASH.time(m)),spanT=Math.max(6,T*1.12),spanM=Math.max(1.8,m*1.15);
  const X=t=>60+(w-130)*t/spanT,Y=v=>h-46-(h-150)*(v-1)/(spanM-1);
  c.beginPath();c.moveTo(X(0),Y(1));
  for(let i=1;i<=48;i++){const t=T*i/48;c.lineTo(X(t),Y(Math.min(m,R.CRASH.at(t))))}
  c.lineWidth=9;c.lineJoin='round';c.strokeStyle=bust?CORAL:'#9bddb0';c.stroke();
  c.lineTo(X(T),Y(1));c.closePath();c.fillStyle=bust?'#ff654826':'#9bddb026';c.fill();
  c.beginPath();c.arc(X(T),Y(m),15,0,7);c.fillStyle=bust?CORAL:YELLOW;c.fill();
  c.fillStyle=bust?CORAL:PAPER;c.font=type(180,800);c.fillText(times(m),w/2,236);
  c.font=type(40);
  if(bust)c.fillText('¡REVENTÓ!',w/2,110);
  else if(cr.cashed){c.fillStyle=YELLOW;c.fillText(`Te retiraste a ${times(cr.cashed)}`,w/2,110)}
}
// Las dos pantallas pequeñas: las últimas rondas y cómo se juega.
function drawCrashSides(){
  const panel=(canvas,title)=>{
    const c=canvas.getContext('2d');
    c.fillStyle='#0d1020';c.fillRect(0,0,400,512);c.textAlign='center';c.textBaseline='middle';c.fillStyle=CORAL;c.font=type(38);c.fillText(title,200,52);
    c.fillStyle='#ffffff30';c.fillRect(40,88,320,3);
    return c;
  };
  let c=panel(crashScreens.history,'ÚLTIMAS');
  c.font=type(50,800);
  cr.history.slice(0,7).forEach((m,i)=>{c.fillStyle={'is-top':YELLOW,'is-good':'#9bddb0','is-low':'#ff8a75'}[crashTone(m)];c.globalAlpha=1-i*.09;c.fillText(times(m),200,136+i*56)});
  c.globalAlpha=1;
  if(!cr.history.length){c.fillStyle='#cfd3e6';c.font=type(30);c.fillText('Primera ronda',200,270)}
  c=panel(crashScreens.guide,'CÓMO SE JUEGA');
  c.font=type(34);
  [['1',YELLOW,'Apuesta antes','de la salida'],['2','#9bddb0','Mira cómo','sube'],['3','#ff8a75','Retírate antes','de que reviente']].forEach(([n,tone,a,b],i)=>{
    const y=150+i*124;
    c.fillStyle=tone;c.beginPath();c.arc(64,y+20,30,0,7);c.fill();c.fillStyle='#0d1020';c.fillText(n,64,y+22);
    c.fillStyle=PAPER;c.fillText(a,236,y);c.fillText(b,236,y+42);
  });
}
drawCrashSides();
function cashOut(){
  if(cr.phase!=='fly'||!cr.bet)return;
  const m=R.CRASH.cash(cr.m),back=Math.round(cr.bet*m);
  pay(back);
  Object.assign(cr,{result:{delta:back-cr.bet,text:`Te retiras a ${times(m)}. ${back>cr.bet?'Ganas':'Recuperas la apuesta'}`},cashed:m,bet:0});
}
// Avanza la ronda. Lo llama el mundo en cada fotograma (o, sin 3D, la propia pantalla del juego).
function stepCrash(now){
  if(!cr.from){cr.from=now;cr.point=R.CRASH.point()}
  let changed=false;
  if(cr.phase==='bets'&&now-cr.from>=BETS_MS){
    Object.assign(cr,{phase:'fly',from:now,m:1,result:null,cashed:0,note:''});
    // La apuesta se cobra al despegar: cerrar la pestaña no la devuelve.
    if(cr.next){
      refreshWallet();
      const status=R.check(wallet,cr.next);
      if(status.ok){wallet=R.settle(wallet,cr.next,0).wallet;keep();showWallet();cr.bet=cr.next}else cr.note=WHY[status.reason];
      cr.next=0;
    }
    changed=true;
  }else if(cr.phase==='fly'){
    cr.m=R.CRASH.at((now-cr.from)/1000);
    if(cr.m>=cr.point){
      if(cr.bet)cr.result={delta:-cr.bet,text:`Reventó a ${times(cr.point)}. Pierdes`};
      Object.assign(cr,{phase:'crash',from:now,m:cr.point,bet:0,history:[cr.point,...cr.history].slice(0,12)});
      drawCrashSides();changed=true;
    }
  }else if(cr.phase==='crash'&&now-cr.from>=BUST_MS){Object.assign(cr,{phase:'bets',from:now,m:1,cashed:0,point:R.CRASH.point()});changed=true}
  drawCrash(now);
  if(game!=='crash')return;
  if(changed)render();else crashHud(now);
}
// Lo que cambia en cada fotograma mientras se mira el juego: el marcador y lo que se cobraría al retirarse.
function crashHud(now){
  const text=(id,value)=>{const el=$(id);if(el&&el.textContent!==value)el.textContent=value};
  text('cr-now',cr.phase==='bets'?`Sale en ${Math.ceil(Math.max(0,BETS_MS-(now-cr.from))/1000)} s`:cr.phase==='fly'?times(cr.m):`Reventó a ${times(cr.point)}`);
  if(cr.bet)text('cr-cash',`${int(Math.round(cr.bet*R.CRASH.cash(cr.m)))} ≈`);
  $('cr-canvas')?.getContext('2d').drawImage(crashScreens.main,0,0);
}
function crashFrame(now){
  if(game!=='crash'||running)return;
  stepCrash(now);requestAnimationFrame(crashFrame);
}
function crashView(){
  const flying=cr.phase==='fly',status=R.check(wallet,bet),why=cr.note||(flying||cr.next||status.ok?'':WHY[status.reason]);
  const main=flying
    ?cr.bet?'<button class="casino-play is-cash" type="button" data-crash="cash">Retirarme con <b id="cr-cash"></b></button>'
      :`<button class="casino-play" type="button" disabled>${cr.cashed?'Te has retirado':'Ronda en vuelo'}</button>`
    :cr.next?`<button class="casino-option" type="button" data-crash="cancel">Quitar mi apuesta de ${int(cr.next)} ≈</button>`
      :`<button class="casino-play" type="button" data-crash="bet"${status.ok?'':' disabled'}>Apostar ${int(bet)} ≈</button>`;
  return shell('Crash','El multiplicador sube hasta que revienta. Retírate antes y cobras tu apuesta por lo que marque.',`
    <div class="cr">
      ${liveShot()?'':'<canvas class="cr-screen" id="cr-canvas" width="1024" height="512" aria-hidden="true"></canvas>'}
      <p class="cr-now is-${cr.phase}" id="cr-now" aria-hidden="true"></p>
      <ol class="cr-history" aria-label="Últimas rondas">${cr.history.map(m=>`<li class="${crashTone(m)}">${times(m)}</li>`).join('')}</ol>
    </div>`,`
    ${chips()}
    <div class="stage-actions">${main}</div>
    ${why?`<p class="casino-result is-loss">${why}</p>`:cr.next?'<p class="casino-result" aria-live="polite">Apuesta puesta para la próxima ronda.</p>':outcome(cr.result)}`,cr.result&&!flying?plus:'');
}

const VIEWS={roulette:rouletteView,slots:slotsView,poker:pokerView,crash:crashView};
function render(){
  if(!game||game==='friends')return;
  if(game==='roulette')return updateRoulette();
  if(game==='slots')return updateSlots();
  const focused=document.activeElement;
  const action=stage.contains(focused)?Object.entries(focused.dataset)[0]:null;
  stage.innerHTML=VIEWS[game]();
  if(game==='poker')syncPoker();
  if(game==='crash')crashHud(performance.now());
  if(action){
    const [key,value]=action;
    const next=[...stage.querySelectorAll('button:not(:disabled)')].find(button=>button.dataset[key]===value);
    (next||stage.querySelector('.casino-play:not(:disabled), [data-casino-leave]'))?.focus();
  }
}
function openGame(id){
  if(game||(id!=='friends'&&!Object.hasOwn(VIEWS,id)))return;
  refreshWallet();
  game=id;
  for(const key in keys)keys[key]=0;
  stage.hidden=false;$('casino-prompt').hidden=true;near=null;
  dialog.classList.add('is-playing');
  // Con mundo 3D la mesa se ve en la sala: el personaje se coloca en su sitio y la cámara va hasta allí.
  const live=liveShot();
  dialog.classList.toggle('is-live',!!live);stage.classList.toggle('is-world',!!live);stage.dataset.game=game;
  if(live?.stand&&game!=='friends'){place(live.stand);sitting=game==='poker'}
  if(game==='friends'){dialog.classList.add('is-social');friends.open()}
  else if(game==='roulette'){
    stage.innerHTML=rouletteView();rt.note='';
    rt.wheel=live?null:createWheel($('rt-canvas'),R,reduced);rt.wheel?.start();updateRoulette();
  }else if(game==='slots'){
    stage.innerHTML=slotsView();sl.ui=mountSlots($('st'),{R,reduced,grid:sl.grid});sl.ui.fast(sl.fast);updateSlots();
  }else render();
  if(game==='crash'&&!running)requestAnimationFrame(crashFrame);
  stage.querySelector('.casino-play:not(:disabled),[data-casino-leave]')?.focus();
}
function leaveGame(){
  if(busy)return;
  if(game==='friends'){friends.hide();dialog.classList.remove('is-social')}
  // Levantarse de la mesa de póker con una mano a medias es retirarse de ella.
  if(game==='poker')standPoker();
  if(game==='roulette'){rt.wheel?.stop();rt.wheel=null}
  if(game==='slots'){sl.ui?.stop();sl.ui=null}
  // Irse de las pantallas de crash con la ronda en vuelo es retirarse; una apuesta aún sin cobrar se quita.
  if(game==='crash'){cashOut();cr.next=0}
  // Al levantarse de la silla se queda de pie junto a la mesa.
  if(sitting){sitting=false;pos.z+=1.1}
  game=null;stage.hidden=true;stage.innerHTML='';dialog.classList.remove('is-playing','is-live');stage.classList.remove('is-world');last=performance.now();
  syncPoker();
  if(dialog.open)(running?$('casino-canvas'):dialog.querySelector('[data-casino-game]')).focus();
}
stage.addEventListener('click',event=>{
  const el=event.target.closest('button');if(!el)return;
  if(busy&&el.dataset.slot==='spin')return sl.ui?.hurry();
  if(busy&&!('casinoLeave' in el.dataset))return;
  if('casinoLeave' in el.dataset)return leaveGame();
  if(game==='friends')return friends.click(event);
  if('casinoFriends' in el.dataset){leaveGame();return openGame('friends')}
  if(el.dataset.bet){
    if(game==='roulette'){rt.chip=Number(el.dataset.bet);return updateRoulette()}
    bet=Number(el.dataset.bet);return render();
  }
  if(el.dataset.spot)return placeChips([[el.dataset.spot,rt.chip]]);
  if(el.dataset.call)return placeChips(R.CALLS[el.dataset.call].chips.map(([id,n])=>[id,n*rt.chip]));
  if(el.dataset.rt)return editRoulette(el.dataset.rt);
  if('spin' in el.dataset)return spinRoulette();
  if(el.dataset.slot==='spin')return pullSlots();
  if(el.dataset.slot){
    if(el.dataset.slot==='fast'){sl.fast=!sl.fast;sl.ui?.fast(sl.fast)}else window.Sound?.toggle();
    return updateSlots();
  }
  if(el.dataset.crash){
    if(el.dataset.crash==='cash')cashOut();
    else if(cr.phase!=='fly'){refreshWallet();cr.next=el.dataset.crash==='bet'&&R.check(wallet,bet).ok?bet:0}
    return render();
  }
  const move=el.dataset.poker;
  if(move==='sit')return sitPoker();
  if(move==='deal')return dealPoker();
  if(move==='stand'){standPoker();return render()}
  if(move)return pokerMove(move);
});
stage.addEventListener('input',event=>{
  if(!('pokerRaise' in event.target.dataset))return;
  const to=Number(event.target.value);
  if(game==='friends')friends.raise(to);else pk.raise=to;
  stage.querySelector('[data-poker-to]').textContent=int(to);
});

// ---------- Abrir y cerrar ----------
async function open(){
  if(dialog.open||opening)return;
  refreshWallet();recoverSeat();keep();
  dialog.showModal();document.body.classList.add('modal-open');
  const status=$('casino-fallback');
  status.textContent='Cargando el salón 3D… Puedes elegir una mesa mientras tanto.';
  opening=true;
  try{
    THREE??=await import('https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js');
    if(!dialog.open)return;
    if(!built)build();
    buildHero();
    Object.assign(pos,{x:(Math.random()-.5)*3,z:6});yaw=0;pitch=.32;heading=Math.PI;
    dialog.classList.remove('is-flat');
    status.textContent='';
    resize();running=true;last=performance.now();frame=requestAnimationFrame(tick);
    if(!game&&document.activeElement===dialog.querySelector('[data-casino-close]'))$('casino-canvas').focus();
  }catch(error){
    console.warn('Salón 3D:',error);
    status.textContent='No se pudo cargar el mundo 3D. Elige una mesa para jugar.';
  }finally{opening=false}
}
document.querySelectorAll('[data-open-casino]').forEach(button=>button.addEventListener('click',open));
dialog.querySelector('[data-casino-close]').addEventListener('click',()=>{if(!busy)dialog.close()});
// Escape sale primero del juego y, si no hay ninguno abierto, del salón.
dialog.addEventListener('cancel',event=>{if(game||busy){event.preventDefault();leaveGame()}});
dialog.addEventListener('close',()=>{running=false;cancelAnimationFrame(frame);leaveGame();friends.stop();stick.x=stick.y=0;for(const key in keys)keys[key]=0;document.body.classList.remove('modal-open')});
// Sin 3D (is-flat) no hay mundo por el que andar: los juegos se abren desde una lista.
dialog.querySelectorAll('[data-casino-game]').forEach(button=>button.addEventListener('click',()=>openGame(button.dataset.casinoGame)));
window.addEventListener('resize',resize);
window.addEventListener('pagehide',()=>friends.stop());
document.addEventListener('faraday:cuenta',event=>{if(event.detail&&'account' in event.detail)friends.stop()});
window.PlusOffers?.register('casino',{
  title:'Descubre Faraday Plus',
  description:'Consulta el plan desde tu perfil.',
  benefits:''
});
document.addEventListener('faraday:before-plan',event=>{
  if(!dialog.open||event.detail?.mode!=='casino')return;
  if(busy||cr.bet||(pk.hand&&pk.hand.stage!=='done'))event.preventDefault();
  else dialog.close();
});
window.Casino={open};

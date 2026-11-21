// Salón (prototipo): un mundo en 3D por el que el jugador pasea con su avatar, en tercera persona, y se acerca a la
// ruleta, las tragaperras y la mesa de póker para jugarse faradios de prueba. Al sentarse a una mesa se ve la mesa
// a pantalla completa (casino-tables.js la dibuja). Las reglas y las cuentas están en casino-rules.js; el personaje
// lo construye avatar3d.js (Avatar3D.build) y aquí solo se le hace andar.
//
// Los faradios de prueba viven en este navegador (localStorage) y no tocan el saldo real ni el servidor: el saldo real
// de quien tiene cuenta lo lleva el servidor (decisión 0057) y un prototipo no debe escribir en él.
// Usa la misma copia de Three.js que avatar3d.js (misma dirección, así que el navegador la carga una sola vez).
import {casinoFriends} from './casino-friends.js';
import {dealer,rouletteLayout,createWheel,pokerTable,pokerActions} from './casino-tables.js';

let THREE, ramp, inkLine;
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
const ROOM={w:26,d:20},STATIONS=[
  {id:'roulette',name:'la ruleta',x:-7,z:-3,r:2.1},
  {id:'slots',name:'las tragaperras',x:0,z:-8.2,r:2.6,box:[3.4,1]},
  {id:'poker',name:'el póker',x:7,z:-3,r:2.3}
];
const pokerSeats=[{x:7,z:-.7,heading:Math.PI},{x:4.6,z:-3,heading:Math.PI/2},
  {x:9.4,z:-3,heading:-Math.PI/2},{x:7,z:-5.3,heading:0}];
let renderer,scene,camera,hero,wheel,running=false,frame=0,last=0,built=false,near=null,game=null;
const peers=new Map();
let presence=[],mySeat=null;
const pos={x:0,z:6},keys={up:0,down:0,left:0,right:0},stick={x:0,y:0};
let yaw=0,pitch=.32,heading=Math.PI,stride=0,pace=0,wheelSpin=0;


const toon=(color,map=null)=>new THREE.MeshToonMaterial({color:map?'#ffffff':color,map,gradientMap:ramp});

function solid(geometry,material,[x=0,y=0,z=0]=[],parent=scene,edges=true){
  const mesh=new THREE.Mesh(geometry,material);mesh.position.set(x,y,z);mesh.castShadow=mesh.receiveShadow=true;
  if(edges)mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(geometry,30),inkLine));
  parent.add(mesh);return mesh;
}
const box=(w,h,d,color,at,parent)=>solid(new THREE.BoxGeometry(w,h,d),toon(color),at,parent);
const drum=(r,h,color,at,parent,sides=40)=>solid(new THREE.CylinderGeometry(r,r,h,sides),toon(color),at,parent);
function paint(width,height,draw){
  const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;draw(canvas.getContext('2d'),width,height);
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=4;return texture;
}
function sign(text,color,[x,y,z],width=4,parent=scene){
  const texture=paint(768,192,(c,w,h)=>{
    c.fillStyle=NIGHT;c.beginPath();c.roundRect(6,6,w-12,h-12,60);c.fill();c.lineWidth=10;c.strokeStyle=color;c.stroke();
    c.fillStyle=color;c.font='700 104px "Space Grotesk",Arial,sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillText(text,w/2,h/2+6);
  });
  const plane=new THREE.Mesh(new THREE.PlaneGeometry(width,width/4),new THREE.MeshBasicMaterial({map:texture,transparent:true}));
  plane.position.set(x,y,z);parent.add(plane);return plane;
}

function buildRoom(){
  scene.background=new THREE.Color(NIGHT);scene.fog=new THREE.Fog(NIGHT,22,46);
  scene.add(new THREE.HemisphereLight('#fff6e6','#3a3f5c',1.35));
  const sun=new THREE.DirectionalLight('#fff3e0',1.9);sun.position.set(6,14,9);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);sun.shadow.bias=-.0006;sun.shadow.radius=5;
  Object.assign(sun.shadow.camera,{left:-16,right:16,top:14,bottom:-14,near:1,far:40});scene.add(sun);
  for(const [color,x,z] of [[CORAL,-7,-3],[YELLOW,0,-7],[BLUE,7,-3]]){const lamp=new THREE.PointLight(color,26,11,1.6);lamp.position.set(x,3.4,z);scene.add(lamp)}
  // Suelo de baldosas en dos tonos de la portada.
  const tiles=paint(256,256,(c,w)=>{c.fillStyle='#262b40';c.fillRect(0,0,w,w);c.fillStyle='#2f3550';c.fillRect(0,0,w/2,w/2);c.fillRect(w/2,w/2,w/2,w/2);c.strokeStyle='#1b1f2c';c.lineWidth=4;c.strokeRect(0,0,w/2,w/2);c.strokeRect(w/2,w/2,w/2,w/2)});
  tiles.wrapS=tiles.wrapT=THREE.RepeatWrapping;tiles.repeat.set(ROOM.w/4,ROOM.d/4);
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(ROOM.w,ROOM.d),toon('#fff',tiles));floor.rotation.x=-Math.PI/2;floor.receiveShadow=true;scene.add(floor);
  // Paredes con zócalo y una franja de color.
  const W=ROOM.w/2,D=ROOM.d/2,H=5.2;
  for(const [w,d,x,z] of [[ROOM.w,.4,0,-D],[ROOM.w,.4,0,D],[.4,ROOM.d,-W,0],[.4,ROOM.d,W,0]]){
    box(w,H,d,'#343a57',[x,H/2,z]);box(w+.06,.5,d+.06,INK,[x,.25,z]);box(w+.04,.16,d+.04,CORAL,[x,3.7,z]);
  }
  for(const x of [-W+1.2,W-1.2])for(const z of [-D+1.2,D-1.2]){drum(.42,H,PAPER,[x,H/2,z]);drum(.6,.3,YELLOW,[x,.15,z])}
  // Alfombras redondas bajo cada juego y en la entrada.
  for(const [color,x,z,r] of [[CORAL,-7,-3,3.2],[BLUE,7,-3,3.2],[YELLOW,0,6,2.2]]){
    const rug=new THREE.Mesh(new THREE.CircleGeometry(r,48),toon(color));rug.rotation.x=-Math.PI/2;rug.position.set(x,.012,z);rug.receiveShadow=true;scene.add(rug);
    const rim=new THREE.Mesh(new THREE.RingGeometry(r-.14,r,48),new THREE.MeshBasicMaterial({color:INK}));rim.rotation.x=-Math.PI/2;rim.position.set(x,.016,z);scene.add(rim);
  }
  sign('SALÓN ≈',YELLOW,[0,3.2,D-.26],5.5).rotation.y=Math.PI;
}

function buildRoulette({x,z}){
  const group=new THREE.Group();group.position.set(x,0,z);scene.add(group);
  drum(.5,.8,INK,[0,.4,0],group);drum(1.75,.22,'#7a4b33',[0,.91,0],group);drum(1.55,.06,'#2f7d5b',[0,1.04,0],group);
  // La rueda: gajos rojos y negros con el cero en verde, en el orden real.
  const top=paint(512,512,(c,w)=>{
    const m=w/2,step=Math.PI*2/37;
    R.WHEEL.forEach((n,i)=>{c.beginPath();c.moveTo(m,m);c.arc(m,m,m-6,i*step-step/2,i*step+step/2);c.closePath();c.fillStyle={green:'#2f9d63',red:CORAL,black:INK}[R.color(n)];c.fill();
      c.save();c.translate(m,m);c.rotate(i*step);c.fillStyle=PAPER;c.font='700 22px "DM Sans",Arial';c.textAlign='center';c.fillText(n,m-30,8);c.restore()});
    c.beginPath();c.arc(m,m,m*.52,0,7);c.fillStyle='#7a4b33';c.fill();c.lineWidth=6;c.strokeStyle=INK;c.stroke();
    c.beginPath();c.arc(m,m,m*.13,0,7);c.fillStyle=YELLOW;c.fill();c.stroke();
  });
  wheel=new THREE.Group();wheel.position.y=1.09;group.add(wheel);
  const disc=new THREE.Mesh(new THREE.CircleGeometry(1.2,64),new THREE.MeshBasicMaterial({map:top}));disc.rotation.x=-Math.PI/2;wheel.add(disc);
  drum(.08,.36,YELLOW,[0,.18,0],wheel,12);
  sign('RULETA',CORAL,[0,3,0],3,group).userData.face=true;
}
function buildSlots({x,z}){
  const group=new THREE.Group();group.position.set(x,0,z);scene.add(group);
  [-2.2,0,2.2].forEach((dx,i)=>{
    const color=[CORAL,YELLOW,BLUE][i];
    box(1.5,2.5,1.1,color,[dx,1.25,0],group);box(1.62,.3,1.22,INK,[dx,.15,0],group);box(1.62,.36,1.22,PAPER,[dx,2.68,0],group);
    const screen=paint(256,128,(c,w,h)=>{c.fillStyle=PAPER;c.fillRect(0,0,w,h);c.strokeStyle=INK;c.lineWidth=6;c.strokeRect(3,3,w-6,h-6);c.beginPath();c.moveTo(w/3,0);c.lineTo(w/3,h);c.moveTo(w*2/3,0);c.lineTo(w*2/3,h);c.stroke();
      c.fillStyle=INK;c.font='700 70px "Space Grotesk",Arial';c.textAlign='center';c.textBaseline='middle';['≈','7','★'].forEach((g,k)=>c.fillText([g,'7','★'][(k+i)%3],w/6+k*w/3,h/2+4))});
    const face=new THREE.Mesh(new THREE.PlaneGeometry(1.2,.6),new THREE.MeshBasicMaterial({map:screen}));face.position.set(dx,1.75,.56);group.add(face);
    box(1.3,.12,.5,INK,[dx,1.12,.6],group);
    const lever=drum(.05,.9,INK,[dx+.86,1.6,.1],group,10);lever.rotation.z=-.25;solid(new THREE.SphereGeometry(.14,16,12),toon(CORAL),[dx+.98,2.06,.1],group,false);
  });
  sign('TRAGAPERRAS',YELLOW,[0,3.45,.2],4.2,group);
}
function buildPoker({x,z}){
  const group=new THREE.Group();group.position.set(x,0,z);scene.add(group);
  drum(.45,.82,INK,[0,.41,0],group);
  const rail=drum(1.9,.2,'#7a4b33',[0,.92,0],group);rail.scale.z=.72;const felt=drum(1.72,.06,'#5d8ea3',[0,1.04,0],group);felt.scale.z=.7;
  // Cinco cartas abiertas en abanico.
  for(let i=0;i<5;i++){
    const card=paint(96,136,(c,w,h)=>{c.fillStyle=PAPER;c.beginPath();c.roundRect(3,3,w-6,h-6,12);c.fill();c.lineWidth=5;c.strokeStyle=INK;c.stroke();const red=i%2;c.fillStyle=red?CORAL:INK;c.font='700 52px "Space Grotesk",Arial';c.textAlign='center';c.fillText(['A','K','Q','J','10'][i],w/2,62);c.font='44px Arial';c.fillText(['♠','♥','♣','♦','♠'][i],w/2,112)});
    const mesh=new THREE.Mesh(new THREE.PlaneGeometry(.34,.48),new THREE.MeshBasicMaterial({map:card}));mesh.rotation.x=-Math.PI/2;mesh.rotation.z=(2-i)*.16;mesh.position.set((i-2)*.36,1.08+i*.002,.1-Math.abs(i-2)*.05);group.add(mesh);
  }
  for(const [dx,dz,color] of [[-1.1,-.5,CORAL],[-.95,-.62,YELLOW],[1.05,-.5,BLUE]])drum(.11,.12,color,[dx,1.13,dz],group,20);
  for(const seat of pokerSeats){
    drum(.16,.36,INK,[seat.x,.18,seat.z],scene,16);
    drum(.4,.16,BLUE,[seat.x,.41,seat.z],scene,20);
  }
  sign('PÓKER',BLUE,[0,3,0],3,group).userData.face=true;
}

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
  if(mySeat!==null)seatPose(hero.entry);
}

function build(){
  ramp=new THREE.DataTexture(new Uint8Array([110,110,110,255,190,190,190,255,255,255,255,255]),3,1);
  ramp.minFilter=ramp.magFilter=THREE.NearestFilter;
  ramp.needsUpdate=true;
  inkLine=new THREE.LineBasicMaterial({color:INK});
  const canvas=$('casino-canvas');
  renderer=new THREE.WebGLRenderer({canvas,antialias:true});renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(52,1,.1,80);
  buildRoom();buildRoulette(STATIONS[0]);buildSlots(STATIONS[1]);buildPoker(STATIONS[2]);built=true;
}
function resize(){
  if(!renderer)return;const w=dialog.clientWidth,h=dialog.clientHeight;if(!w||!h)return;
  renderer.setSize(w,h,false);camera.aspect=w/h;camera.fov=w<h?66:52;camera.updateProjectionMatrix();
}

// Choques: paredes, columnas y juegos. Los juegos son círculos, menos la fila de tragaperras, que es una caja.
function collide(){
  const W=ROOM.w/2-.75,D=ROOM.d/2-.75;pos.x=Math.max(-W,Math.min(W,pos.x));pos.z=Math.max(-D,Math.min(D,pos.z));
  for(const s of STATIONS){
    if(s.box){const [hw,hd]=s.box,dx=pos.x-s.x,dz=pos.z-s.z,px=hw+.45-Math.abs(dx),pz=hd+.45-Math.abs(dz);if(px>0&&pz>0){if(px<pz)pos.x+=Math.sign(dx||1)*px;else pos.z+=Math.sign(dz||1)*pz}continue}
    const dx=pos.x-s.x,dz=pos.z-s.z,d=Math.hypot(dx,dz)||.001,min=s.r-.25;if(d<min){pos.x=s.x+dx/d*min;pos.z=s.z+dz/d*min}
  }
}
function seatPose(model){
  model.group.position.y=-.28;
  for(const leg of model.parts.legs)leg.rotation.x=-1.12;
}
function showPeers(players,seat=null){
  presence=players||[];
  if(seat!==mySeat&&pokerSeats[seat]){
    const target=pokerSeats[seat];
    pos.x=target.x;
    pos.z=target.z;
    heading=target.heading;
    yaw=Math.PI-heading;
  }
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
      const texture=paint(512,92,(context,w,h)=>{
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
  for(const s of STATIONS){const d=Math.hypot(pos.x-s.x,pos.z-s.z)-(s.box?s.box[1]:s.r);if(d<1.5&&d<dist){best=s;dist=d}}
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
  if(wheel){wheel.rotation.y+=dt*(.25+wheelSpin);wheelSpin*=Math.exp(-dt*1.1)}
  const dist=camera.aspect<1?7.4:6.4,cx=Math.sin(yaw)*Math.cos(pitch)*dist,cz=Math.cos(yaw)*Math.cos(pitch)*dist;
  const W=ROOM.w/2-.5,D=ROOM.d/2-.5;
  camera.position.set(Math.max(-W,Math.min(W,pos.x+cx)),1.5+Math.sin(pitch)*dist,Math.max(-D,Math.min(D,pos.z+cz)));camera.lookAt(pos.x,1.35,pos.z);
  scene.traverse(node=>{if(node.userData.face)node.rotation.y=Math.atan2(camera.position.x-node.parent.position.x,camera.position.z-node.parent.position.z)});
  const next=game||mySeat!==null?null:nearest();
  near=next;
  const prompt=$('casino-prompt'),seated=mySeat!==null&&!game;
  const label=seated?'Volver a la mesa':near?`Jugar a ${near.name} <kbd>E</kbd>`:'';
  if(prompt.dataset.label!==label){prompt.dataset.label=label;prompt.hidden=!label;prompt.innerHTML=label}
  // Sentado a una mesa el salón queda tapado: no hace falta pintarlo.
  if(!game)renderer.render(scene,camera);
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
const state={slots:{reels:[0,1,2],last:null}};
const chips=(values=R.CHIPS,on=bet)=>`<div class="casino-chips" role="group" aria-label="Valor de la ficha">${values.map(n=>`<button type="button" class="casino-chip is-${n}${n===on?' is-on':''}" data-bet="${n}" aria-pressed="${n===on}">${n}</button>`).join('')}</div>`;
const outcome=last=>!last?'<p class="casino-result" aria-live="polite"></p>':`<p class="casino-result ${last.delta>0?'is-win':last.delta<0?'is-loss':''}" aria-live="polite">${last.text} <b>${last.delta>0?'+':last.delta<0?'−':''}${coins(Math.abs(last.delta))}</b></p>`;
const plus='<div data-plus-slot="casino" data-compact="true"></div>';
function refreshWallet(){wallet=loadWallet();showWallet()}
const say=text=>{const bubble=stage.querySelector('[data-dealer-say]');if(bubble)bubble.textContent=text};

// ---- Ruleta: se dejan fichas por el tapete y la bola decide.
const rt={bets:{},moves:[],previous:null,history:[],chip:5,wheel:null,note:''};
const rtTotal=()=>Object.values(rt.bets).reduce((sum,n)=>sum+n,0);
function rouletteView(){
  return shell('Ruleta','Europea, un solo cero. Pleno 35 a 1, caballo 17 a 1, transversal 11 a 1, cuadro 8 a 1, seisena 5 a 1.',`
    <div class="rt">
      <div class="rt-wheel"><canvas id="rt-canvas" aria-hidden="true"></canvas><output class="rt-number" id="rt-number" aria-label="Número que ha salido"></output></div>
      <div class="rt-dealer">${dealer('Hagan juego')}<ol class="rt-history" id="rt-history" aria-label="Últimos números"></ol></div>
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
  wheelSpin=9;
  await rt.wheel.spin(n);
  showWallet();
  rt.history=[n,...rt.history].slice(0,12);
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
  rt.previous=rt.bets;rt.bets={};rt.moves=[];busy=false;
  stage.classList.remove('is-rolling');
  if(game!=='roulette')return;
  stage.querySelectorAll('.is-won,.is-lost').forEach(el=>el.classList.remove('is-won','is-lost'));
  say('Hagan juego');updateRoulette();$('rt-plus').innerHTML=plus;
}

// ---- Tragaperras.
function slotsView(){
  const s=state.slots,status=R.check(wallet,bet),why=status.ok?'':WHY[status.reason];
  return shell('Tragaperras','Tres iguales, o los dos primeros iguales.',`
    <div class="sl">
      <div class="sl-machine"><p class="sl-sign">≈ Faraday ≈</p>
        <div class="casino-reels" id="casino-reels">${s.reels.map(i=>`<span>${R.SYMBOLS[i].glyph}</span>`).join('')}</div>
        <span class="sl-lever" aria-hidden="true"></span></div>
      <ul class="casino-pays">${R.SYMBOLS.map(sym=>`<li><span>${sym.glyph}${sym.glyph}${sym.glyph}</span><b>×${sym.pays}</b></li>`).join('')}<li><span>dos primeros</span><b>×${R.PAIR}</b></li></ul>
    </div>`,`
    ${chips()}
    <div class="stage-actions"><button class="casino-play" type="button" data-pull${why||busy?' disabled':''}>Tirar</button></div>
    ${why?`<p class="casino-result is-loss">${why}</p>`:outcome(s.last)}`,s.last&&!busy?plus:'');
}
async function pullSlots(){
  const s=state.slots;
  refreshWallet();
  if(busy||!R.check(wallet,bet).ok)return render();
  busy=true;s.last=null;render();
  const final=R.pull(),cells=[...$('casino-reels').children],rolling=[true,true,true];
  const multiplier=R.slots(final),result=R.settle(wallet,bet,multiplier);
  wallet=result.wallet;keep();
  stage.querySelector('.sl-machine').classList.add('is-pulled');
  const roll=reduced?0:setInterval(()=>cells.forEach((cell,i)=>{if(rolling[i])cell.textContent=R.SYMBOLS[Math.floor(Math.random()*R.SYMBOLS.length)].glyph}),60);
  for(let i=0;i<3;i++){await wait(i?420:900);rolling[i]=false;cells[i].textContent=R.SYMBOLS[final[i]].glyph;cells[i].classList.add('is-set')}
  clearInterval(roll);showWallet();
  s.reels=final;s.last={delta:result.delta,text:multiplier?(final[1]===final[2]?'¡Trío! Ganas':'Pareja. Ganas'):'Nada. Pierdes'};busy=false;render();
}

// ---- Póker: Texas Hold'em contra cuatro jugadores de la casa. Te sientas con 100 faradios de prueba y, al
// levantarte, vuelven al monedero las fichas que te queden. Las fichas de la mesa se apuntan aparte para que no
// se pierdan si se cierra la pestaña con una mano a medias (lo que ya esté en el bote, sí).
const BUYIN=R.MAX_BET,BLINDS=[1,2],SEAT_KEY='casi-casi:casino-mesa';
const RIVALS=[
  {name:'Volta',look:{body:'mujer',hairColor:'rubio',top:'mj-top-blanco'}},{name:'Ohm',look:{hairColor:'castano',skin:'canela'}},
  {name:'Curie',look:{body:'mujer',hairColor:'negro',skin:'cacao'}},{name:'Tesla',look:{hairColor:'rojo',skin:'claro'}}
];
const pk={seated:false,hand:null,stacks:[0,BUYIN,BUYIN,BUYIN,BUYIN],button:0,notes:[],run:0,raise:0,cards:0,message:'',say:'¿Te sientas?'};
function credit(amount){
  if(amount>0){wallet=loadWallet();wallet.coins+=amount;wallet.net-=amount;keep();showWallet()}
  try{localStorage.removeItem(SEAT_KEY)}catch{}
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
  Object.assign(pk,{notes:[],raise:0,cards:0,message:'',say:'Cartas repartidas'});
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

const VIEWS={roulette:rouletteView,slots:slotsView,poker:pokerView};
function render(){
  if(!game||game==='friends')return;
  if(game==='roulette')return updateRoulette();
  const focused=document.activeElement;
  const action=stage.contains(focused)?Object.entries(focused.dataset)[0]:null;
  stage.innerHTML=VIEWS[game]();
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
  if(game==='friends'){dialog.classList.add('is-social');friends.open()}
  else if(game==='roulette'){
    stage.innerHTML=rouletteView();rt.note='';
    rt.wheel=createWheel($('rt-canvas'),R,reduced);rt.wheel.start();updateRoulette();
  }else render();
  stage.querySelector('.casino-play:not(:disabled),[data-casino-leave]')?.focus();
}
function leaveGame(){
  if(busy)return;
  if(game==='friends'){friends.hide();dialog.classList.remove('is-social')}
  // Levantarse de la mesa de póker con una mano a medias es retirarse de ella.
  if(game==='poker')standPoker();
  if(game==='roulette'){rt.wheel?.stop();rt.wheel=null}
  game=null;stage.hidden=true;stage.innerHTML='';dialog.classList.remove('is-playing');last=performance.now();
  if(dialog.open)(running?$('casino-canvas'):dialog.querySelector('[data-casino-game]')).focus();
}
stage.addEventListener('click',event=>{
  const el=event.target.closest('button');if(!el||busy&&!('casinoLeave' in el.dataset))return;
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
  if('pull' in el.dataset)return pullSlots();
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
  if(busy||(pk.hand&&pk.hand.stage!=='done'))event.preventDefault();
  else dialog.close();
});
window.Casino={open};

// Salón: la sala en 3D. Aquí se construye lo que se ve al pasear (la sala, la mesa de ruleta con su rueda, su tapete
// y su crupier, la mesa de póker con la suya y los jugadores de la casa, las tragaperras, el bar y las pantallas de
// crash) y se anima lo que se mueve solo. casino.js lleva al jugador, la cámara, las apuestas y el monedero.
const INK='#1b1f27',PAPER='#fffdf7',CORAL='#ff6548',YELLOW='#ffdb70',BLUE='#b9d6e1',NIGHT='#161827';
const GOLD='#d9a84e',WOOD='#5b3423',WOOD_DARK='#3a2418',FELT='#1f7a55',WINE='#7a1f31',CREAM='#efe2c4',WALL='#2c3254';
const CHIP_TONES={1:'#7f879b',5:'#d8402f',10:'#2f6fd0',25:'#2f9d63',50:'#c9781a'};

export const ROOM={w:26,d:20,h:6};
const RT={x:-6.5,z:-2.5},PK={x:6.5,z:-2.5},SL={x:0,z:-8.3},CR={x:ROOM.w/2-.25,z:3.6},BAR={x:-ROOM.w/2,z:3.5};
// Sitios alrededor de la mesa de póker, por ángulo (90° = delante, mirando desde la entrada). La crupier va detrás.
function around(degrees,rx=3,rz=2.35){
  const a=degrees*Math.PI/180,x=PK.x+Math.cos(a)*rx,z=PK.z+Math.sin(a)*rz;
  return {x,z,heading:Math.atan2(PK.x-x,PK.z-z)};
}
// Asientos de quien juega (el primero es el del jugador contra la casa) y de los cuatro jugadores de la casa.
export const pokerSeats=[90,180,0,222].map(a=>around(a));
const rivalSeats=[180,222,318,0].map(a=>around(a));
// Juegos a los que uno se acerca. Con «box» = [medio ancho, medio fondo] es una caja; con «r», un círculo.
export const STATIONS=[
  {id:'roulette',name:'la ruleta',x:RT.x,z:RT.z,box:[2.8,1.2]},
  {id:'slots',name:'las tragaperras',x:SL.x,z:SL.z+.3,box:[5.5,1.6]},
  {id:'poker',name:'el póker',x:PK.x,z:PK.z,r:3.45},
  {id:'crash',name:'crash',x:CR.x-1.25,z:CR.z,box:[.8,3.4]}
];
// Lo que no se puede atravesar.
export const SOLIDS=[
  {x:RT.x,z:RT.z-.45,box:[2.8,1.7]},{x:SL.x,z:SL.z+.3,box:[5.5,1.6]},{x:PK.x,z:PK.z,r:3.45},{x:CR.x-1.3,z:CR.z,box:[1.5,3.4]},
  {x:BAR.x+1.75,z:BAR.z,box:[1.85,3.2]},{x:-1.95,z:6.6,box:[.12,2.6]},{x:1.95,z:6.6,box:[.12,2.6]},
  ...[[-11.7,-8.7],[11.7,-8.7],[-5.2,9],[5.2,9],[-11.7,8.8]].map(([x,z])=>({x,z,r:.75}))
];
// Desde dónde se mira cada juego al acercarse: «at» es la cámara, «look» a dónde apunta, «lift» cuánto se sube la
// imagen para que la mesa quede por encima de los botones, y «stand» dónde se coloca el personaje.
export const CAMERAS={
  roulette:{at:[RT.x-.2,3.7,RT.z+4.9],look:[RT.x-.2,1.2,RT.z-.5],lift:.17,stand:{x:RT.x+3.75,z:RT.z+.5,heading:-Math.PI/2}},
  poker:{at:[PK.x,5.2,PK.z+5.6],look:[PK.x,1.1,PK.z-.5],lift:.2,stand:pokerSeats[0]},
  crash:{at:[CR.x-8.3,2.7,CR.z],look:[CR.x,3,CR.z],lift:.05,stand:{x:CR.x-3.3,z:CR.z+5.6,heading:Math.PI/2}}
};

export function createWorld({THREE,R,scene,screens,rivals=[]}){
  const ramp=new THREE.DataTexture(new Uint8Array([110,110,110,255,190,190,190,255,255,255,255,255]),3,1);
  ramp.minFilter=ramp.magFilter=THREE.NearestFilter;ramp.needsUpdate=true;
  const inkLine=new THREE.LineBasicMaterial({color:INK});
  const toon=(color,map=null)=>new THREE.MeshToonMaterial({color:map?'#ffffff':color,map,gradientMap:ramp});
  const plain=(color,map=null)=>new THREE.MeshBasicMaterial({color:map?'#ffffff':color,map});
  const faces=[];

  function solid(geometry,material,[x=0,y=0,z=0]=[],parent=scene,edges=true){
    const mesh=new THREE.Mesh(geometry,material);mesh.position.set(x,y,z);mesh.castShadow=mesh.receiveShadow=true;
    if(edges)mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(geometry,30),inkLine));
    parent.add(mesh);return mesh;
  }
  const box=(w,h,d,color,at,parent,edges)=>solid(new THREE.BoxGeometry(w,h,d),toon(color),at,parent,edges);
  const drum=(r,h,color,at,parent,sides=40,edges)=>solid(new THREE.CylinderGeometry(r,r,h,sides),toon(color),at,parent,edges);
  const ball=(r,material,at,parent)=>solid(new THREE.SphereGeometry(r,16,12),material,at,parent,false);
  function paint(width,height,draw){
    const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;draw(canvas.getContext('2d'),width,height);
    const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=4;return texture;
  }
  const live=canvas=>{const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=4;return texture};
  // Algo tumbado en el suelo o sobre una mesa. No hace sombra.
  function flat(geometry,material,[x,y,z],parent=scene){
    const mesh=new THREE.Mesh(geometry,material);mesh.rotation.x=-Math.PI/2;mesh.position.set(x,y,z);mesh.receiveShadow=true;parent.add(mesh);return mesh;
  }
  // Resplandor: un disco de luz que siempre mira a la cámara. Hace de brillo de lámparas, rótulos y pantallas.
  const halo=paint(128,128,(c,w)=>{const g=c.createRadialGradient(w/2,w/2,0,w/2,w/2,w/2);g.addColorStop(0,'#ffffffd0');g.addColorStop(.35,'#ffffff50');g.addColorStop(1,'#ffffff00');c.fillStyle=g;c.fillRect(0,0,w,w)});
  function glow(color,size,[x,y,z],parent=scene,opacity=.6){
    const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:halo,color,opacity,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false}));
    sprite.position.set(x,y,z);sprite.scale.set(size,size,1);parent.add(sprite);return sprite;
  }
  function sign(text,color,[x,y,z],width=4,parent=scene,face=false){
    const texture=paint(768,192,(c,w,h)=>{
      c.fillStyle=NIGHT;c.beginPath();c.roundRect(6,6,w-12,h-12,60);c.fill();c.lineWidth=10;c.strokeStyle=color;c.stroke();
      c.shadowColor=color;c.shadowBlur=26;c.fillStyle=color;c.font='700 104px "Space Grotesk",Arial,sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillText(text,w/2,h/2+6);
    });
    const plane=new THREE.Mesh(new THREE.PlaneGeometry(width,width/4),new THREE.MeshBasicMaterial({map:texture,transparent:true}));
    plane.position.set(x,y,z);parent.add(plane);glow(color,width*1.25,[0,0,-.06],plane,.3);
    if(face)faces.push(plane);
    return plane;
  }
  const lamp=(color,[x,y,z],power=30,reach=12)=>{const light=new THREE.PointLight(color,power,reach,1.6);light.position.set(x,y,z);scene.add(light)};

  // ---------- La sala ----------
  const W=ROOM.w/2,D=ROOM.d/2,H=ROOM.h;
  function chandelier(x,z,size=1,drop=1.1){
    const group=new THREE.Group();group.position.set(x,H,z);scene.add(group);
    const gold=plain(GOLD),bulb=plain('#fff3cf'),crystal=plain('#ffe2a0');
    solid(new THREE.CylinderGeometry(.03,.03,drop,8),gold,[0,-drop/2,0],group,false).castShadow=false;
    [[.95*size,0,10],[.55*size,.38*size,6]].forEach(([radius,up,count])=>{
      const ring=new THREE.Mesh(new THREE.TorusGeometry(radius,.045,8,40),gold);ring.rotation.x=Math.PI/2;ring.position.y=-drop+up;group.add(ring);
      for(let i=0;i<count;i++){
        const a=i/count*Math.PI*2,px=Math.cos(a)*radius,pz=Math.sin(a)*radius;
        const light=new THREE.Mesh(new THREE.SphereGeometry(.085*size,10,8),bulb);light.position.set(px,-drop+up+.12,pz);group.add(light);
        const drip=new THREE.Mesh(new THREE.ConeGeometry(.05*size,.24*size,6),crystal);drip.rotation.x=Math.PI;drip.position.set(px,-drop+up-.16,pz);group.add(drip);
      }
    });
    const tip=new THREE.Mesh(new THREE.ConeGeometry(.12*size,.4*size,8),crystal);tip.rotation.x=Math.PI;tip.position.y=-drop-.3*size;group.add(tip);
    glow('#ffc978',4.6*size,[0,-drop+.1,0],group,.5);
  }
  // Una pared, construida mirando hacia +z y girada después. «clear» son los tramos que tapa otra cosa (no llevan cuadro).
  function wall(length,x,z,turn,clear=[]){
    const group=new THREE.Group();group.position.set(x,0,z);group.rotation.y=turn;scene.add(group);
    box(length,H,.4,WALL,[0,H/2,-.2],group,false);
    box(length,1.3,.1,WOOD,[0,.65,.05],group,false);box(length,.2,.16,INK,[0,.1,.08],group,false);box(length,.09,.16,GOLD,[0,1.34,.08],group,false);
    box(length,.12,.14,GOLD,[0,H-.62,.07],group,false);box(length,.5,.3,CREAM,[0,H-.25,.15],group,false);
    const bays=Math.round(length/3.25),step=length/bays;
    for(let i=0;i<=bays;i++){
      const px=-length/2+i*step;
      box(.46,H-2,.14,CREAM,[px,1.38+(H-2)/2,.07],group);box(.6,.16,.2,GOLD,[px,H-.72,.1],group,false);
      if(i&&i<bays){box(.12,.3,.16,GOLD,[px,3.05,.2],group,false);ball(.1,plain('#fff3cf'),[px,3.3,.24],group).castShadow=false;glow('#ffc978',1.7,[px,3.3,.34],group,.55)}
      if(i===bays)break;
      const mid=px+step/2;
      if(clear.some(([from,to])=>mid>from&&mid<to))continue;
      box(step-1.1,2.5,.05,GOLD,[mid,3.05,.03],group,false);box(step-1.3,2.3,.07,'#39406a',[mid,3.05,.04],group,false);
    }
    return group;
  }
  function plant(x,z){
    drum(.34,.55,CREAM,[x,.275,z]);drum(.38,.08,GOLD,[x,.56,z],scene,24,false);
    const green=toon('#2f7d4f');
    for(let i=0;i<6;i++){
      const leaf=solid(new THREE.ConeGeometry(.2,1.5,5),green,[x,1.2,z]);
      leaf.rotation.set(0,i*Math.PI/3,i?-.55:0);leaf.position.x+=i?Math.cos(i*Math.PI/3)*.3:0;leaf.position.z-=i?Math.sin(i*Math.PI/3)*.3:0;
      if(!i)leaf.scale.y=1.25;
    }
  }
  {
    scene.background=new THREE.Color(NIGHT);scene.fog=new THREE.Fog(NIGHT,24,50);
    scene.add(new THREE.HemisphereLight('#ffe9c9','#3a2a3c',1.25));
    const sun=new THREE.DirectionalLight('#ffe6c2',1.6);sun.position.set(5,14,9);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.bias=-.0006;sun.shadow.radius=5;
    Object.assign(sun.shadow.camera,{left:-16,right:16,top:14,bottom:-14,near:1,far:40});scene.add(sun);
    lamp('#ffe7c4',[RT.x,4.4,RT.z+1],15);lamp('#ffe7c4',[PK.x,4.4,PK.z+1],15);lamp(YELLOW,[SL.x,3.6,SL.z+1.6],22,10);
    lamp('#8fd8ff',[CR.x-2.6,3.2,CR.z],24,10);lamp('#ffb070',[BAR.x+2.6,3.2,BAR.z],20,9);lamp('#ffd9a8',[0,4.4,3],26,13);
    // Moqueta granate con rombos dorados.
    const carpet=paint(256,256,(c,w)=>{
      const m=w/2,rhombus=()=>{c.beginPath();c.moveTo(m,0);c.lineTo(w,m);c.lineTo(m,w);c.lineTo(0,m);c.closePath()};
      c.fillStyle='#5a1627';c.fillRect(0,0,w,w);rhombus();c.fillStyle='#671b2e';c.fill();
      c.lineWidth=9;c.strokeStyle='#43101d';c.stroke();c.lineWidth=2.5;c.strokeStyle='#c9963f';c.stroke();
      c.fillStyle='#c9963f';
      for(const [x,y] of [[m,m],[0,0],[w,0],[0,w],[w,w]]){c.beginPath();c.moveTo(x,y-20);c.quadraticCurveTo(x,y,x+20,y);c.quadraticCurveTo(x,y,x,y+20);c.quadraticCurveTo(x,y,x-20,y);c.quadraticCurveTo(x,y,x,y-20);c.fill()}
    });
    carpet.wrapS=carpet.wrapT=THREE.RepeatWrapping;carpet.repeat.set(ROOM.w/2.6,ROOM.d/2.6);
    flat(new THREE.PlaneGeometry(ROOM.w,ROOM.d),toon('#fff',carpet),[0,0,0]);
    // Techo artesonado. Solo se ve desde abajo: con la cámara alta no estorba.
    const coffer=paint(256,256,(c,w)=>{c.fillStyle='#191c2e';c.fillRect(0,0,w,w);c.fillStyle='#262b47';c.fillRect(22,22,w-44,w-44);c.lineWidth=5;c.strokeStyle='#a9803a';c.strokeRect(22,22,w-44,w-44);c.strokeStyle='#31385c';c.strokeRect(46,46,w-92,w-92)});
    coffer.wrapS=coffer.wrapT=THREE.RepeatWrapping;coffer.repeat.set(8,6);
    const ceiling=new THREE.Mesh(new THREE.PlaneGeometry(ROOM.w,ROOM.d),plain('#fff',coffer));ceiling.rotation.x=Math.PI/2;ceiling.position.y=H;scene.add(ceiling);
    wall(ROOM.w,0,-D,0,[[-6,6]]);wall(ROOM.w,0,D,Math.PI,[[-2.4,2.4]]);
    wall(ROOM.d,-W,0,Math.PI/2,[[-7,0]]);wall(ROOM.d,W,0,-Math.PI/2,[[-1.6,8.9]]);
    for(const x of [-W+1,W-1])for(const z of [-D+1,D-1]){drum(.42,H,CREAM,[x,H/2,z]);drum(.6,.36,GOLD,[x,.18,z]);drum(.56,.3,GOLD,[x,H-.65,z])}
    // Alfombras: un medallón en el centro, óvalos bajo las mesas y una pasarela desde la puerta.
    const medal=paint(512,512,(c,w)=>{
      const m=w/2;c.fillStyle='#232842';c.beginPath();c.arc(m,m,m,0,7);c.fill();
      c.strokeStyle=GOLD;for(const [r,l] of [[m-8,10],[m-40,3],[m*.52,5]]){c.lineWidth=l;c.beginPath();c.arc(m,m,r,0,7);c.stroke()}
      c.fillStyle=GOLD;for(let i=0;i<16;i++){c.save();c.translate(m,m);c.rotate(i*Math.PI/8);c.beginPath();c.moveTo(0,-m*.56);c.lineTo(15,-m*.72);c.lineTo(0,-m*.86);c.lineTo(-15,-m*.72);c.closePath();c.fill();c.restore()}
      c.fillStyle=YELLOW;c.font='700 210px "Space Grotesk",Arial,sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillText('≈',m,m+6);
    });
    flat(new THREE.CircleGeometry(2.7,56),toon('#fff',medal),[0,.014,1.2]);
    for(const [x,z] of [[RT.x,RT.z-.2],[PK.x,PK.z]]){
      flat(new THREE.CircleGeometry(1,56),toon('#173f36'),[x,.012,z]).scale.set(4.4,3.5,1);
      flat(new THREE.RingGeometry(.955,1,56),plain(GOLD),[x,.016,z]).scale.set(4.4,3.5,1);
    }
    const runner=paint(128,256,(c,w,h)=>{c.fillStyle='#8e2233';c.fillRect(0,0,w,h);c.fillStyle=GOLD;c.fillRect(8,0,5,h);c.fillRect(w-13,0,5,h)});
    flat(new THREE.PlaneGeometry(3.2,5.6),toon('#fff',runner),[0,.013,7.1]);
    // La puerta y sus cordones.
    box(3.5,4,.2,GOLD,[0,2,D-.3]);
    for(const side of [-1,1]){
      box(1.55,3.7,.12,WOOD_DARK,[side*.8,1.85,D-.42]);box(1.1,1.2,.05,WOOD,[side*.8,2.7,D-.5],scene,false);box(1.1,1.2,.05,WOOD,[side*.8,1.1,D-.5],scene,false);
      ball(.07,plain(GOLD),[side*.14,1.9,D-.52]);
      for(let i=0;i<4;i++){
        const pz=9-i*1.6;
        drum(.2,.06,GOLD,[side*1.95,.03,pz],scene,20,false);drum(.05,1,GOLD,[side*1.95,.5,pz],scene,10,false);ball(.09,toon(GOLD),[side*1.95,1.04,pz]);
        if(i<3){const rope=solid(new THREE.CylinderGeometry(.035,.035,1.6,8),toon(WINE),[side*1.95,.86,pz-.8],scene,false);rope.rotation.x=Math.PI/2}
      }
    }
    sign('SALÓN ≈',YELLOW,[0,4.75,D-.5],5).rotation.y=Math.PI;
    for(const [x,z] of [[RT.x,RT.z],[PK.x,PK.z]])chandelier(x,z,1,1.15);
    chandelier(0,1.2,1.5,1.3);chandelier(SL.x,SL.z+2.6,.9,1);chandelier(0,7.4,.9,1);
    plant(-11.7,-8.7);plant(11.7,-8.7);plant(-5.2,9);plant(5.2,9);plant(-11.7,8.8);
  }
  // El bar, contra la pared de la izquierda.
  {
    const x=BAR.x,z=BAR.z;
    box(.5,3.6,6.2,WOOD_DARK,[x+.45,1.8,z]);
    const mirror=paint(64,64,(c,w)=>{const g=c.createLinearGradient(0,0,w,w);g.addColorStop(0,'#3d4a78');g.addColorStop(.5,'#8fa6c9');g.addColorStop(1,'#2a3154');c.fillStyle=g;c.fillRect(0,0,w,w)});
    const glass=new THREE.Mesh(new THREE.PlaneGeometry(5.6,2.2),plain('#fff',mirror));glass.rotation.y=Math.PI/2;glass.position.set(x+.71,2.4,z);scene.add(glass);
    const tints=[CORAL,YELLOW,'#9bddb0',BLUE,PAPER,'#c9781a','#7a4bd0'];
    [1.5,2.25,3].forEach((y,row)=>{
      box(.42,.06,5.8,GOLD,[x+.9,y,z],scene,false);
      for(let i=0;i<11;i++){
        const bz=z-2.6+i*.52+(row%2)*.14,tint=toon(tints[(i+row*2)%tints.length]);
        solid(new THREE.CylinderGeometry(.075,.085,.34,10),tint,[x+.92,y+.2,bz],scene,false);solid(new THREE.CylinderGeometry(.03,.04,.16,8),tint,[x+.92,y+.45,bz],scene,false);
      }
    });
    box(.95,1.1,5.8,WOOD,[x+2.3,.55,z]);box(1.2,.1,6.1,CREAM,[x+2.3,1.15,z]);box(1,.08,5.84,GOLD,[x+2.3,.3,z],scene,false);
    for(let i=0;i<4;i++){
      const sz=z-2.1+i*1.4;
      drum(.22,.05,GOLD,[x+3.3,.025,sz],scene,20,false);drum(.05,.74,GOLD,[x+3.3,.4,sz],scene,10,false);drum(.3,.14,WINE,[x+3.3,.82,sz],scene,24);
      if(i<3){drum(.09,.2,PAPER,[x+2.2,1.3,sz+.5],scene,12);
        const shade=solid(new THREE.ConeGeometry(.3,.36,16,1,true),toon(CORAL),[x+2.3,3.3,sz+.7],scene,false);shade.material.side=THREE.DoubleSide;
        solid(new THREE.CylinderGeometry(.015,.015,H-3.48,6),plain(INK),[x+2.3,(H+3.48)/2,sz+.7],scene,false);glow('#ffb070',1.5,[x+2.3,3.18,sz+.7],scene,.7)}
    }
    sign('BAR',CORAL,[x+.75,4.35,z],2.6).rotation.y=Math.PI/2;
  }

  // ---------- Ruleta: mesa larga con la rueda a un lado, el tapete al otro y la crupier detrás ----------
  const FW=1400,FH=460,U=100;
  const feltCanvas=document.createElement('canvas');feltCanvas.width=FW;feltCanvas.height=FH;
  const feltTexture=live(feltCanvas);
  // Pinta el tapete con las fichas que hay puestas. «hit» es el número que acaba de salir.
  function felt(bets={},hit=null){
    const c=feltCanvas.getContext('2d');
    c.fillStyle=FELT;c.fillRect(0,0,FW,FH);c.textAlign='center';c.textBaseline='middle';
    for(const [id,{name,numbers,at}] of Object.entries(R.SPOTS)){
      if(at.w===undefined)continue;
      const tone=id[0]==='n'?R.color(numbers[0]):id==='red'||id==='black'?id:'';
      c.fillStyle={red:'#d8402f',black:INK,green:'#2f9d63'}[tone]||'#1a6a4a';c.fillRect(at.x*U,at.y*U,at.w*U,at.h*U);
      c.lineWidth=4;c.strokeStyle='#f4e9c8';c.strokeRect(at.x*U,at.y*U,at.w*U,at.h*U);
      c.fillStyle=PAPER;c.font=`700 ${at.h<1?40:48}px "Space Grotesk",Arial,sans-serif`;c.fillText(name,(at.x+at.w/2)*U,(at.y+at.h/2)*U+3);
      if(id==='n'+hit){c.lineWidth=14;c.strokeStyle=YELLOW;c.strokeRect(at.x*U+7,at.y*U+7,at.w*U-14,at.h*U-14)}
    }
    for(const [id,amount] of Object.entries(bets)){
      const at=R.SPOTS[id]?.at;if(!at||!amount)continue;
      const x=(at.x+(at.w||0)/2)*U,y=(at.y+(at.h||0)/2)*U;
      c.beginPath();c.arc(x+3,y+5,29,0,7);c.fillStyle='#0008';c.fill();
      c.beginPath();c.arc(x,y,29,0,7);c.fillStyle=CHIP_TONES[R.TABLE_CHIPS.findLast(n=>n<=amount)]||CHIP_TONES[5];c.fill();
      c.setLineDash([9,7]);c.lineWidth=5;c.strokeStyle=PAPER;c.beginPath();c.arc(x,y,23,0,7);c.stroke();c.setLineDash([]);
      c.fillStyle=PAPER;c.font='700 26px "Space Grotesk",Arial,sans-serif';c.fillText(amount,x,y+2);
    }
    feltTexture.needsUpdate=true;
  }
  const step=Math.PI*2/37,TRACK=.87,POCKET=.52;
  let wheel,marble,roll=null,rest=null;
  {
    const group=new THREE.Group();group.position.set(RT.x,0,RT.z);scene.add(group);
    for(const dx of [-1.7,1.7]){box(.7,.86,1.5,WOOD_DARK,[dx,.43,0],group);box(.95,.1,1.8,GOLD,[dx,.05,0],group,false)}
    box(5.7,.3,2.4,WOOD,[0,.94,0],group);box(5.74,.06,2.44,GOLD,[0,.82,0],group,false);box(5.5,.08,2.2,'#2a1a14',[0,1.1,0],group,false);
    box(5.3,.06,2,FELT,[0,1.13,0],group,false);
    felt();
    flat(new THREE.PlaneGeometry(3.4,3.4*FH/FW),plain('#fff',feltTexture),[1.05,1.165,0],group);
    // La rueda: gajos rojos y negros con el cero en verde, en el orden real.
    const top=paint(768,768,(c,w)=>{
      const m=w/2,outer=m-4,mid=m*.78,inner=m*.56;
      R.WHEEL.forEach((n,i)=>{
        const from=i*step-step/2,fill={green:'#2f9d63',red:'#d8402f',black:INK}[R.color(n)];
        c.beginPath();c.arc(m,m,outer,from,from+step);c.arc(m,m,inner,from+step,from,true);c.closePath();c.fillStyle=fill;c.fill();c.lineWidth=3;c.strokeStyle='#e9c46a';c.stroke();
        c.save();c.translate(m,m);c.rotate(i*step+Math.PI/2);c.fillStyle=PAPER;c.font='700 34px "Space Grotesk",Arial,sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillText(n,0,-(outer+mid)/2);c.restore();
      });
      c.beginPath();c.arc(m,m,mid,0,7);c.arc(m,m,inner,0,7,true);c.fillStyle='#0004';c.fill();
      for(const r of [outer,mid,inner]){c.beginPath();c.arc(m,m,r,0,7);c.lineWidth=5;c.strokeStyle='#e9c46a';c.stroke()}
      const cone=c.createRadialGradient(m-40,m-40,10,m,m,inner);cone.addColorStop(0,'#b98358');cone.addColorStop(1,'#6b4029');
      c.beginPath();c.arc(m,m,inner-3,0,7);c.fillStyle=cone;c.fill();
    });
    const bowl=new THREE.Group();bowl.position.set(-1.75,0,0);group.add(bowl);
    solid(new THREE.LatheGeometry([[.77,1.36],[.77,1.43],[.99,1.43],[1.03,1.13]].map(([r,y])=>new THREE.Vector2(r,y)),56),toon('#8a5a3c'),[0,0,0],bowl,false).material.side=THREE.DoubleSide;
    drum(.78,.06,WOOD_DARK,[0,1.35,0],bowl,48,false);
    flat(new THREE.RingGeometry(.75,.775,56),plain(GOLD),[0,1.434,0],bowl);flat(new THREE.RingGeometry(.965,.99,56),plain(GOLD),[0,1.434,0],bowl);
    wheel=new THREE.Group();wheel.position.y=1.385;bowl.add(wheel);
    flat(new THREE.CircleGeometry(.76,64),plain('#fff',top),[0,0,0],wheel);
    drum(.1,.14,GOLD,[0,.07,0],wheel,16);
    for(let i=0;i<4;i++){const arm=box(.62,.035,.05,GOLD,[0,.12,0],wheel,false);arm.rotation.y=i*Math.PI/4}
    solid(new THREE.ConeGeometry(.07,.2,12),toon(GOLD),[0,.24,0],wheel);ball(.05,toon(GOLD),[0,.36,0],wheel);
    marble=ball(.042,plain(PAPER),[0,0,0],bowl);marble.visible=false;
    // Fichas de la casa junto a la crupier.
    [[CORAL,5],[YELLOW,7],['#2f6fd0',4],['#2f9d63',6],[INK,3],[CORAL,6]].forEach(([color,count],i)=>{
      for(let k=0;k<count;k++)drum(.085,.035,color,[-.55+i*.2,1.18+k*.036,-.82],group,16,k===count-1);
    });
    sign('RULETA',CORAL,[0,3.6,0],3,group,true);
  }

  // ---------- Tragaperras ----------
  {
    const group=new THREE.Group();group.position.set(SL.x,0,SL.z);scene.add(group);
    ['#d8402f',YELLOW,BLUE,'#9bddb0',CORAL].forEach((color,i)=>{
      const dx=(i-2)*2.2;
      box(1.5,2.5,1.1,color,[dx,1.25,0],group);box(1.62,.3,1.22,INK,[dx,.15,0],group);box(1.62,.4,1.22,PAPER,[dx,2.7,0],group);
      // La pantalla enseña la rejilla de gemas de «Tormenta».
      const screen=paint(240,200,(c,w,h)=>{
        const sky=c.createLinearGradient(0,0,0,h);sky.addColorStop(0,'#2a2f6e');sky.addColorStop(1,'#0f1434');c.fillStyle=sky;c.fillRect(0,0,w,h);
        const tones=['#58a8ff','#4fd08a','#b47bff','#ffb84a','#ff6a5a',YELLOW];
        for(let x=0;x<6;x++)for(let y=0;y<5;y++){
          const tone=tones[(x*7+y*3+i*2+(x*y)%4)%tones.length],px=20+x*40,py=20+y*40;
          c.fillStyle=tone;c.beginPath();if((x+y+i)%3)c.arc(px,py,13,0,7);else{c.moveTo(px,py-15);c.lineTo(px+15,py);c.lineTo(px,py+15);c.lineTo(px-15,py)}c.fill();
          c.fillStyle='#ffffff70';c.beginPath();c.arc(px-4,py-5,4,0,7);c.fill();
        }
        c.lineWidth=8;c.strokeStyle=GOLD;c.strokeRect(4,4,w-8,h-8);
      });
      const face=new THREE.Mesh(new THREE.PlaneGeometry(1.26,1.05),plain('#fff',screen));face.position.set(dx,1.82,.56);group.add(face);
      box(1.3,.12,.5,INK,[dx,1.12,.6],group);
      const lever=drum(.05,.9,INK,[dx+.86,1.6,.1],group,10);lever.rotation.z=-.25;ball(.14,toon(CORAL),[dx+.98,2.06,.1],group);
      ball(.16,plain('#fff3cf'),[dx,3.02,0],group).castShadow=false;glow(color,1.5,[dx,3.05,.2],group,.5);
      drum(.05,.6,GOLD,[dx,.3,1.5],group,10,false);drum(.3,.14,WINE,[dx,.66,1.5],group,24);
    });
    sign('TORMENTA ≈',YELLOW,[0,4.2,.2],4.6,group);
  }

  // ---------- Póker: mesa ovalada, la crupier al fondo y los cuatro jugadores de la casa sentados ----------
  const cardFaces=new Map(),RANKS={11:'J',12:'Q',13:'K',14:'A'},SUITS=['♠','♥','♦','♣'];
  const cardBack=paint(96,136,(c,w,h)=>{c.fillStyle=PAPER;c.beginPath();c.roundRect(2,2,w-4,h-4,12);c.fill();c.fillStyle='#b3362f';c.beginPath();c.roundRect(9,9,w-18,h-18,8);c.fill();c.strokeStyle='#e58a7f';c.lineWidth=4;for(let i=-h;i<w;i+=16){c.beginPath();c.moveTo(i,h);c.lineTo(i+h,0);c.stroke()}c.lineWidth=4;c.strokeStyle=INK;c.beginPath();c.roundRect(2,2,w-4,h-4,12);c.stroke()});
  function cardFace(card){
    const key=card.r+'-'+card.s;
    if(!cardFaces.has(key))cardFaces.set(key,paint(96,136,(c,w,h)=>{c.fillStyle=PAPER;c.beginPath();c.roundRect(2,2,w-4,h-4,12);c.fill();c.lineWidth=4;c.strokeStyle=INK;c.stroke();c.fillStyle=card.s===1||card.s===2?'#c8322f':INK;c.textAlign='center';c.font='700 56px "Space Grotesk",Arial';c.fillText(RANKS[card.r]||card.r,w/2,64);c.font='48px Arial';c.fillText(SUITS[card.s],w/2,116)}));
    return cardFaces.get(key);
  }
  const board=[],holes=[],potChips=[];
  {
    const group=new THREE.Group();group.position.set(PK.x,0,PK.z);scene.add(group);
    const oval=mesh=>{mesh.scale.z=.72;return mesh};
    drum(.55,.84,WOOD_DARK,[0,.42,0],group);drum(.9,.1,GOLD,[0,.05,0],group,32,false);
    oval(drum(2.5,.22,WOOD,[0,.93,0],group));oval(drum(2.4,.1,'#2a1a14',[0,1.06,0],group,48,false));oval(drum(2.1,.06,FELT,[0,1.1,0],group,48,false));
    flat(new THREE.RingGeometry(1.66,1.69,64),plain(GOLD),[0,1.134,0],group).scale.y=.72;
    for(let i=0;i<5;i++){
      const card=flat(new THREE.PlaneGeometry(.3,.425),new THREE.MeshBasicMaterial({map:cardBack}),[(i-2)*.36,1.14,-.12],group);card.visible=false;board.push(card);
    }
    // Dos cartas boca abajo delante de cada sitio: el del jugador y los cuatro de la casa.
    for(const seat of [pokerSeats[0],...rivalSeats]){
      const dx=(seat.x-PK.x)*.56,dz=(seat.z-PK.z)*.56,pair=new THREE.Group();pair.position.set(dx,1.14,dz);pair.rotation.y=seat.heading;pair.visible=false;group.add(pair);
      for(const side of [-1,1]){const card=flat(new THREE.PlaneGeometry(.2,.283),plain('#fff',cardBack),[side*.09,side*.002+.002,0],pair);card.rotation.z=side*.14}
      holes.push(pair);
    }
    [[CORAL,0,0],[YELLOW,.17,.05],['#2f6fd0',-.16,.07],[CORAL,.05,.2],['#2f9d63',-.08,-.13]].forEach(([color,dx,dz],i)=>{
      for(let k=0;k<3+i%3;k++){const chip=drum(.08,.034,color,[dx,1.15+k*.035,.42+dz],group,16,false);chip.visible=false;potChips.push(chip)}
    });
    // La bandeja de fichas y el mazo, del lado de la crupier.
    box(1,.06,.3,INK,[0,1.15,-1.24],group);
    [CORAL,YELLOW,'#2f6fd0','#2f9d63',PAPER].forEach((color,i)=>{const stack=drum(.07,.18,color,[-.36+i*.18,1.2,-1.24],group,14,false);stack.rotation.z=Math.PI/2});
    box(.22,.08,.31,CREAM,[.74,1.17,-1.12],group);
    for(const seat of [...pokerSeats,rivalSeats[2]]){
      drum(.3,.06,GOLD,[seat.x,.03,seat.z],scene,20,false);drum(.07,.4,INK,[seat.x,.22,seat.z],scene,12,false);drum(.4,.16,WINE,[seat.x,.44,seat.z],scene,24);
    }
    sign('PÓKER',BLUE,[0,3.6,0],3,group,true);
  }
  // Mesa de póker: cartas comunes, quién sigue en la mano (el jugador y los cuatro de la casa) y si hay bote.
  function poker(state){
    board.forEach((mesh,i)=>{const card=state?.board?.[i];mesh.visible=!!card;if(card&&mesh.material.map!==cardFace(card)){mesh.material.map=cardFace(card);mesh.material.needsUpdate=true}});
    holes.forEach((pair,i)=>{pair.visible=!!state?.live?.[i]});
    for(const chip of potChips)chip.visible=!!state?.pot;
  }

  // ---------- Crash: tres pantallas en la pared de la derecha y un mostrador delante ----------
  const screenTextures=[];
  {
    const x=CR.x,z=CR.z;
    box(.16,3.1,9.9,INK,[x-.08,3,z]);box(.08,3.3,10.1,GOLD,[x-.03,3,z],scene,false);
    [[screens.main,4.8,0],[screens.history,2.05,-3.75],[screens.guide,2.05,3.75]].forEach(([canvas,width,dz])=>{
      const texture=live(canvas);screenTextures.push(texture);
      const plane=new THREE.Mesh(new THREE.PlaneGeometry(width,2.6),plain('#fff',texture));plane.rotation.y=-Math.PI/2;plane.position.set(x-.17,3,z+dz);scene.add(plane);
    });
    glow('#7fd4ff',7,[x-.5,3,z],scene,.22);
    // Mostrador con botones, y taburetes para mirar.
    box(.9,1,6.4,'#232842',[x-1.25,.5,z]);box(1,.08,6.5,GOLD,[x-1.25,1.04,z],scene,false);
    const slope=box(.7,.06,6.2,INK,[x-1.3,1.14,z],scene,false);slope.rotation.z=.25;
    for(let i=0;i<9;i++)drum(.07,.05,[CORAL,YELLOW,'#9bddb0'][i%3],[x-1.4,1.17,z-2.6+i*.65],scene,12,false);
    for(let i=0;i<3;i++){const sz=z-2+i*2;drum(.24,.05,GOLD,[x-2.3,.025,sz],scene,20,false);drum(.05,.66,GOLD,[x-2.3,.36,sz],scene,10,false);drum(.3,.14,WINE,[x-2.3,.74,sz],scene,24)}
    sign('CRASH',CORAL,[x-.2,4.95,z],3.4).rotation.y=-Math.PI/2;
  }

  // ---------- Gente de la casa ----------
  const A3=window.Avatar3D,dealers={},guests=new THREE.Group();scene.add(guests);
  function person(look,{x,z,heading},seated,parent=scene){
    const model=A3.build(look);
    model.group.traverse(node=>{if(node.isMesh)node.castShadow=true});
    model.group.position.set(x,seated?-.28:0,z);model.group.rotation.y=heading;parent.add(model.group);
    if(seated)for(const leg of model.parts.legs)leg.rotation.x=-1.12;
    return {model,x,z,heading,gesture:0,hand:1,seed:Math.random()*20};
  }
  const sitters=[];
  if(A3?.build&&window.Avatar){
    const dress=(look,extra)=>({...window.Avatar.resolve(look),...extra});
    dealers.roulette=person(dress({body:'mujer',hair:'mj-ondas',hairColor:'castano',neck:'mj-perlas',face:'mj-feliz'},
      {top:'camiseta',topColor:'rojo',trimColor:'burdeos',print:'',bottom:'falda',bottomColor:'rojo',shoesColor:'negro'}),{x:RT.x-.55,z:RT.z-1.78,heading:0});
    dealers.poker=person(dress({body:'mujer',hair:'mj-coleta-alta',hairColor:'negro',skin:'canela',extra:'mj-aros',face:'mj-chula'},
      {top:'camiseta',topColor:'negro',trimColor:'amarillo',print:'',bottom:'falda',bottomColor:'burdeos',shoesColor:'negro'}),{x:PK.x,z:PK.z-2.4,heading:0});
    rivals.forEach((rival,i)=>{if(rivalSeats[i])sitters.push(person(window.Avatar.resolve(rival.look),rivalSeats[i],true,guests))});
  }
  const turn=a=>Math.atan2(Math.sin(a),Math.cos(a));
  // La crupier respira, sigue con la mirada a quien pasa y tiene las manos sobre la mesa. «gesture» va de 1 a 0
  // mientras lanza la bola o reparte.
  function pose(who,now,dt,target,still){
    const {upper,neck,arms}=who.model.parts,t=now/1000+who.seed;
    upper.rotation.set(.07+(still?0:Math.sin(t*1.3)*.012),still?0:Math.sin(t*.45)*.05,0);
    const dx=target.x-who.x,dz=target.z-who.z,want=Math.hypot(dx,dz)<10?Math.max(-.75,Math.min(.75,turn(Math.atan2(dx,dz)-who.heading))):0;
    neck.rotation.y+=(want-neck.rotation.y)*Math.min(1,dt*4);
    const lead=who.gesture>0?Math.sin(Math.PI*(1-who.gesture)):0;who.gesture=Math.max(0,who.gesture-dt/.9);
    arms.forEach(({arm,fore,side},i)=>{const g=i===who.hand?lead:0;arm.rotation.set(-.4-g*.85,0,side*(.2-g*.12));fore.rotation.set(-1+g*.65,0,side*-.28)});
  }

  const spinTime=6200;
  return {
    paint,felt,poker,dealers,
    // Los jugadores de la casa dejan la mesa cuando se sientan amigos.
    guests(show){guests.visible=show},
    // Dónde queda la cabeza de la crupier, para colocarle el bocadillo.
    head(id,into){const who=dealers[id];return who?into.set(who.x,2.28,who.z):null},
    // Lanza la bola hacia el número n. La promesa se cumple cuando se queda quieta.
    spin(n,reduced){
      const index=R.WHEEL.indexOf(n);
      if(dealers.roulette)dealers.roulette.gesture=1;
      if(reduced){rest=index;return Promise.resolve()}
      rest=null;
      return new Promise(done=>{roll={index,from:0,done}});
    },
    update(dt,now,camera,target,reduced){
      if(wheel){
        if(!reduced)wheel.rotation.y+=dt*.6;
        let at=null,radius=POCKET,height=1.44;
        if(roll){
          roll.from||=now;
          const u=Math.min(1,(now-roll.from)/spinTime),left=1-u;
          at=roll.index*step-wheel.rotation.y+Math.PI*2*5.5*left*left*left;
          // La bola aguanta en el borde, baja hacia los números y da un par de botes antes de quedarse.
          const fall=Math.min(1,Math.max(0,(u-.55)/.33)),eased=fall*fall*(3-2*fall),settle=Math.max(0,(u-.88)/.12);
          radius=TRACK+(POCKET-TRACK)*eased+(u>.88&&u<1?Math.sin(settle*Math.PI*2)*.035*(1-settle):0);
          height=1.475+(1.44-1.475)*eased+(u>.88&&u<1?Math.abs(Math.sin(settle*Math.PI*2))*.03*(1-settle):0);
          if(u>=1){rest=roll.index;const done=roll.done;roll=null;done()}
        }else if(rest!==null)at=rest*step-wheel.rotation.y;
        marble.visible=at!==null;
        if(at!==null)marble.position.set(Math.cos(at)*radius,height,Math.sin(at)*radius);
      }
      for(const id in dealers)pose(dealers[id],now,dt,target,reduced);
      if(guests.visible&&!reduced)for(const who of sitters){
        const {upper,neck,arms}=who.model.parts,t=now/1000+who.seed;
        upper.rotation.set(.16+Math.sin(t*.8)*.02,Math.sin(t*.37)*.08,0);neck.rotation.y=Math.sin(t*.23)*.3;
        arms.forEach(({arm,fore,side})=>{arm.rotation.set(-.5,0,side*.22);fore.rotation.set(-.95+Math.sin(t*.9+side)*.04,0,side*-.3)});
      }
      for(const plane of faces)plane.rotation.y=Math.atan2(camera.position.x-plane.parent.position.x,camera.position.z-plane.parent.position.z);
      for(const texture of screenTextures)texture.needsUpdate=true;
    }
  };
}

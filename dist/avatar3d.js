// Avatar en 3D (decisión 0025). Personaje propio, de estética de calle: cabeza de cubo redondeado, mirada con párpado
// caído, ropa ancha y contorno de tinta. Todo se construye con formas de Three.js y texturas pintadas en un lienzo
// (chaquetas, estampados, puños): no hay modelos descargados ni logotipos o diseños de terceros (marcas inventadas: ≈, FRDY).
// avatar.js escribe en la página huecos <span class="avatar-view"> con el look ya traducido; este archivo los rellena.
// Hay un solo contexto 3D para toda la página: cada avatar se dibuja en él y se copia a su propio lienzo.
// PENDIENTE: Three.js se carga desde una CDN; hay que traer la librería al repositorio (docs/mejoras).
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js';

const INK='#1b1f27',PAPER='#fffdf7',GOLD='#ffc93c';
const {SKIN,HAIR:HAIR_COLORS,CLOTH,DENIM}=window.Avatar.PALETTE;
const BUF_W=640,BUF_H=960,renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});
renderer.setPixelRatio(1);renderer.setSize(BUF_W,BUF_H,false);renderer.setClearColor(0x000000,0);renderer.setScissorTest(true);
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(27,1,.1,50);
scene.add(new THREE.HemisphereLight('#ffffff','#cdbfa6',1.25));
const key=new THREE.DirectionalLight('#fff3e0',2.4);key.position.set(2.8,5,4.4);key.castShadow=true;key.shadow.mapSize.set(1024,1024);key.shadow.radius=7;key.shadow.bias=-.0006;
Object.assign(key.shadow.camera,{left:-2.6,right:2.6,top:3.6,bottom:-1,near:.5,far:14});scene.add(key);
const rim=new THREE.DirectionalLight('#9fc4ff',1.1);rim.position.set(-3,2.6,-4);scene.add(rim);
const floor=new THREE.Mesh(new THREE.CircleGeometry(2.4,48),new THREE.ShadowMaterial({opacity:.22}));floor.rotation.x=-Math.PI/2;floor.receiveShadow=true;scene.add(floor);

// Sombreado por tonos (tres escalones) y contorno de tinta: le dan aire de cómic en vez de plástico blando.
const ramp=new THREE.DataTexture(new Uint8Array([120,120,120,255,196,196,196,255,255,255,255,255]),3,1);ramp.minFilter=ramp.magFilter=THREE.NearestFilter;ramp.needsUpdate=true;
const mat=(color,map=null)=>new THREE.MeshToonMaterial({color:map?'#ffffff':color,map,gradientMap:ramp});
const flat=(color,opacity=1)=>new THREE.MeshBasicMaterial({color,transparent:opacity<1,opacity});
const lineMat=new THREE.MeshBasicMaterial({color:INK,side:THREE.BackSide});
const shade=(hex,k)=>'#'+new THREE.Color(hex).multiplyScalar(k).getHexString();
const light=hex=>new THREE.Color(hex).getHSL({h:0,s:0,l:0}).l>.6;
function add(parent,geometry,material,[x=0,y=0,z=0]=[],[sx=1,sy=1,sz=1]=[],[rx=0,ry=0,rz=0]=[],line=0){
  const mesh=new THREE.Mesh(geometry,material);mesh.position.set(x,y,z);mesh.scale.set(sx,sy,sz);mesh.rotation.set(rx,ry,rz);mesh.castShadow=true;parent.add(mesh);
  if(line){const edge=new THREE.Mesh(geometry,lineMat);edge.scale.setScalar(1+line);mesh.add(edge)}
  return mesh;
}
const sphere=(r=1,w=28,h=20)=>new THREE.SphereGeometry(r,w,h),capsule=(r,length)=>new THREE.CapsuleGeometry(r,length,8,20);
const ring=(r,tube,arc=Math.PI*2)=>new THREE.TorusGeometry(r,tube,10,36,arc);
// Cubo redondeado: se lleva cada vértice de una esfera a la «esfera» de norma n. Las normales salen de la fórmula.
function blob(geometry,n=4){
  const p=geometry.attributes.position,normal=geometry.attributes.normal,v=new THREE.Vector3();
  for(let i=0;i<p.count;i++){
    v.fromBufferAttribute(p,i);const size=v.length()||1;v.divideScalar(size);
    const k=(Math.abs(v.x)**n+Math.abs(v.y)**n+Math.abs(v.z)**n)**(-1/n);p.setXYZ(i,v.x*k*size,v.y*k*size,v.z*k*size);
    v.set(Math.sign(v.x)*Math.abs(v.x)**(n-1),Math.sign(v.y)*Math.abs(v.y)**(n-1),Math.sign(v.z)*Math.abs(v.z)**(n-1)).normalize();normal.setXYZ(i,v.x,v.y,v.z);
  }
  return geometry;
}
const box=(n=4)=>blob(sphere(1,32,24),n);
const shell=(n,phi0,phi,theta0,theta)=>blob(new THREE.SphereGeometry(1,40,20,phi0,phi,theta0,theta),n);
// Cabeza: cubo redondeado de radios A × B × C. onHead devuelve el punto de la superficie para ojos, cejas y boca.
const HEAD={a:.64,b:.585,c:.6,n:2.7};
const onHead=(x,y,out=1)=>[x*out,y*out,HEAD.c*Math.max(0,1-Math.abs(x/HEAD.a)**HEAD.n-Math.abs(y/HEAD.b)**HEAD.n)**(1/HEAD.n)*out];
// Cuerpo de revolución a partir de un perfil [radio, altura]; la textura se reparte por altura (v) y por ángulo (u).
function lathe(profile,segments=48){
  const curve=new THREE.SplineCurve(profile.map(([r,y])=>new THREE.Vector2(Math.max(0,r),y))),geometry=new THREE.LatheGeometry(curve.getPoints(44).map(point=>new THREE.Vector2(Math.max(0,point.x),point.y)),segments);
  const p=geometry.attributes.position,uv=geometry.attributes.uv,low=profile[0][1],high=profile[profile.length-1][1];
  for(let i=0;i<p.count;i++)uv.setY(i,(p.getY(i)-low)/(high-low));
  return geometry;
}
// Lienzo → textura. En el torso, el frente queda centrado en x = 0,75 y la espalda en x = 0,25 (la costura, bajo el brazo).
function paint(draw,size=512){
  const canvas=document.createElement('canvas');canvas.width=canvas.height=size;draw(canvas.getContext('2d'),size);
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.wrapS=THREE.RepeatWrapping;texture.anisotropy=4;return texture;
}
const wave=(c,x,y,w,color,width)=>{c.strokeStyle=color;c.lineWidth=width;c.lineCap='round';for(const dy of [-w*.2,w*.2]){c.beginPath();c.moveTo(x-w/2,y+dy);c.bezierCurveTo(x-w/4,y+dy-w*.28,x-w/8,y+dy+w*.28,x,y+dy);c.bezierCurveTo(x+w/8,y+dy-w*.28,x+w/4,y+dy+w*.28,x+w/2,y+dy);c.stroke()}};
function torsoTexture(type,main,trim,print){
  const texture=paint((c,S)=>{
    const F=s=>(.75+s*.25)*S,B=s=>(.25+s*.25)*S,Y=v=>(1-v)*S,dark=shade(main,.78),on=light(main)?INK:PAPER,onTrim=light(trim)?INK:PAPER;
    // Dibuja con proporción real: en el lienzo, lo vertical está 2,6 veces más estirado que lo horizontal.
    const at=(x,y,fn)=>{c.save();c.translate(x,y);c.scale(1,2.6);fn();c.restore()};
    const badge=(x,y,r,bg,fg)=>at(x,y,()=>{c.fillStyle=bg;c.beginPath();c.arc(0,0,r,0,7);c.fill();c.lineWidth=r*.14;c.strokeStyle=fg;c.stroke();wave(c,0,0,r*1.15,fg,r*.2)});
    const word=(text,x,y,size,fill,stroke,italic=true)=>at(x,y,()=>{c.font=`${italic?'italic ':''}900 ${size}px "Arial Black",Arial,sans-serif`;c.textAlign='center';c.textBaseline='middle';if(stroke){c.lineWidth=size*.22;c.lineJoin='round';c.strokeStyle=stroke;c.strokeText(text,0,0)}c.fillStyle=fill;c.fillText(text,0,0)});
    const bands=(v0,v1,colors)=>colors.forEach((color,i)=>{c.fillStyle=color;c.fillRect(0,Y(v1)+(Y(v0)-Y(v1))*i/colors.length,S,(Y(v0)-Y(v1))/colors.length+1)});
    const graphic=(x,v,scale)=>{
      if(print==='logo')badge(x,Y(v),30*scale,trim,onTrim);
      if(print==='frdy')word('FRDY',x,Y(v),40*scale,trim,onTrim);
      if(print==='tag')at(x,Y(v),()=>{c.rotate(-.14);c.font=`italic 900 ${46*scale}px "Arial Black",Arial,sans-serif`;c.textAlign='center';c.textBaseline='middle';c.lineWidth=9*scale;c.lineJoin='round';c.strokeStyle=INK;c.strokeText('1,2×',0,0);c.fillStyle=trim;c.fillText('1,2×',0,0);c.fillStyle=PAPER;c.fillRect(-52*scale,24*scale,104*scale,5*scale)});
    };
    c.fillStyle=main;c.fillRect(0,0,S,S);
    if(print==='ajedrez'&&type!=='universitaria'){const n=32,h=(Y(.3)-Y(.46))/2;for(let i=0;i<n;i++)for(let j=0;j<2;j++){c.fillStyle=(i+j)%2?PAPER:INK;c.fillRect(i*S/n,Y(.46)+j*h,S/n+1,h+1)}}
    if(print==='llamas'&&type!=='universitaria')for(const [color,top] of [['#ff6548',.44],['#ffc93c',.27]]){
      c.fillStyle=color;c.beginPath();c.moveTo(0,S);for(let i=0;i<=24;i++)c.lineTo((i+(i%2?.5:0))*S/24,Y(i%2?top:top*.4));c.lineTo(S,S);c.fill();
    }
    if(type==='universitaria'){
      bands(0,.11,[trim,PAPER,trim,PAPER,trim]);bands(.9,1,[trim,PAPER,trim]);
      c.fillStyle=INK;c.fillRect(F(0)-2,Y(.9),4,Y(.11)-Y(.9));for(const v of [.2,.36,.52,.68,.82]){c.fillStyle=PAPER;c.beginPath();c.ellipse(F(0),Y(v),5,9,0,0,7);c.fill();c.strokeStyle=INK;c.lineWidth=2;c.stroke()}
      c.strokeStyle=trim;c.lineWidth=6;c.lineCap='round';for(const s of [-1,1]){c.beginPath();c.moveTo(F(s*.5),Y(.4));c.lineTo(F(s*.62),Y(.24));c.stroke()}
      badge(F(.44),Y(.68),20,PAPER,main);word('26',F(-.44),Y(.68),24,trim,null,false);
      word('FRDY',B(0),Y(.72),52,PAPER,trim);badge(B(0),Y(.42),40,trim,onTrim);
    }
    if(type==='sudadera'){
      bands(0,.09,[dark]);c.fillStyle=dark;c.beginPath();c.roundRect(F(-.5),Y(.36),F(.5)-F(-.5),Y(.12)-Y(.36),18);c.fill();c.strokeStyle=shade(main,.6);c.lineWidth=3;c.stroke();
      graphic(F(0),.62,1.25);word('FRDY',B(0),Y(.7),30,on,null);
    }
    if(type==='camiseta'){bands(.93,1,[dark]);graphic(F(0),.6,1.5);badge(B(0),Y(.8),14,on,main)}
    if(type==='chandal'){
      c.fillStyle=trim;c.fillRect(0,0,S,Y(.62));c.fillStyle=PAPER;c.fillRect(0,Y(.62)-5,S,10);bands(0,.08,[dark]);bands(.92,1,[shade(trim,.8)]);
      c.fillStyle=PAPER;c.fillRect(F(0)-3,Y(.92),6,Y(.08)-Y(.92));c.fillStyle=INK;c.fillRect(F(0)-5,Y(.86),10,26);
      badge(F(.44),Y(.5),15,PAPER,main);word('FRDY',B(0),Y(.46),38,PAPER,null);
    }
    if(type==='baloncesto'){
      bands(0,.06,[trim]);bands(.93,1,[trim]);for(const s of [-1,1]){c.fillStyle=trim;c.fillRect(F(s)-9,Y(.93),18,Y(.5)-Y(.93));c.fillRect(B(s)-9,Y(.93),18,Y(.5)-Y(.93))}
      word('FRDY',F(0),Y(.74),26,trim,onTrim);word('12',F(0),Y(.46),74,trim,onTrim,false);word('12',B(0),Y(.5),84,trim,onTrim,false);
    }
  });
  texture.offset.set(.75,0);return texture;
}
const stripes=colors=>paint((c,S)=>colors.forEach((color,i)=>{c.fillStyle=color;c.fillRect(0,i*S/colors.length,S,S/colors.length+1)}),64);
// Manga de chándal: dos franjas finas por fuera (no las tres bandas de nadie).
const sleeveTexture=(main,line)=>paint((c,S)=>{c.fillStyle=main;c.fillRect(0,0,S,S);c.fillStyle=line;for(const u of [.25,.75])for(const d of [-.035,.035])c.fillRect((u+d)*S-4,0,8,S)},128);
const capLogo=(bg,fg)=>paint((c,S)=>{c.clearRect(0,0,S,S);c.fillStyle=bg;c.beginPath();c.roundRect(S*.08,S*.2,S*.84,S*.6,S*.12);c.fill();c.strokeStyle=fg;c.lineWidth=S*.04;c.stroke();wave(c,S/2,S/2,S*.5,fg,S*.07)},128);
const dotted=()=>paint((c,S)=>{c.fillStyle='#e5383b';c.fillRect(0,0,S,S);c.fillStyle=PAPER;for(let i=0;i<8;i++)for(let j=0;j<6;j++){c.beginPath();c.arc((i+(j%2)/2)*S/8+S/16,j*S/6+S/12,S/60,0,7);c.fill()}},128);

// Construye el personaje de un look ya traducido (Avatar.resolve) y devuelve el grupo y las partes que se animan.
function buildModel(look){
  const model=new THREE.Group();
  const has=id=>(look.extras||[]).includes(id),skin=mat(SKIN[look.skin]||SKIN.miel),hairC=HAIR_COLORS[look.hairColor]||HAIR_COLORS.negro,hairM=mat(hairC);
  const main=CLOTH[look.topColor]||PAPER,trim=CLOTH[look.trimColor]||INK,pantsC=DENIM[look.bottomColor]||DENIM.lavado,pants=mat(pantsC),pantsDark=mat(shade(pantsC,.78));
  const ink=flat(INK),white=mat(PAPER),gold=new THREE.MeshStandardMaterial({color:GOLD,roughness:.28,metalness:.75});
  const type=look.top,sleeved=!['camiseta','baloncesto'].includes(type),bare=type==='baloncesto',O=.03;
  const body=new THREE.Group();model.add(body);

  // Piernas: pantalón ancho que se arruga sobre la zapatilla
  const chunky=look.shoes==='plataforma',lift=chunky?.08:0,short=look.bottom==='corto';body.position.y=lift;
  add(body,sphere(),pants,[0,.64,0],[.35,.17,.27],[],O);
  for(const side of [-1,1]){
    const leg=new THREE.Group();leg.position.set(side*.18,.64,0);body.add(leg);
    if(short){add(leg,capsule(.1,.2),skin,[0,-.4,0],[],[],O);add(leg,capsule(.185,.16),pants,[0,-.17,0],[1,1,.95],[],O);add(leg,new THREE.CylinderGeometry(.108,.108,.16,20),white,[0,-.46,0],[],[],O)}
    else{add(leg,capsule(.178,.22),pants,[0,-.26,0],[1,1,.95],[],O);for(const [y,r] of [[-.4,.172],[-.475,.182]])add(leg,ring(r,.045),pants,[0,y,0],[1,1,1],[Math.PI/2,0,0],O)}
    if(look.bottom==='cargo')add(leg,box(5),pantsDark,[side*.17,-.24,0],[.05,.1,.11],[],O);
    if(look.bottom==='chandal')for(const d of [-.035,.035])add(leg,new THREE.BoxGeometry(.012,short?.3:.5,.03),flat(PAPER),[side*.181,short?-.17:-.26,d]);
    const shoe=new THREE.Group();shoe.position.set(side*.18,-lift,.07);shoe.rotation.y=side*.14;body.add(shoe);
    const shoeC=CLOTH[look.shoesColor]||PAPER,upper=mat(shoeC),sole=mat(light(shoeC)?'#e6e0d0':PAPER);
    add(shoe,box(),upper,[0,.15+lift,.02],[.17,.115,.265],[],O);
    add(shoe,box(),sole,[0,.055+lift/2,.02],[.185,.06+lift/2,.285],[],O);
    add(shoe,box(),sole,[0,.12+lift,.215],[.15,.07,.08]);
    add(shoe,box(),mat(shade(shoeC,light(shoeC)?.86:1.5)),[0,.27+lift,.06],[.095,.09,.05],[-.45,0,0],O);
    if(look.shoes==='altas')add(shoe,capsule(.14,.05),upper,[0,.3,-.07],[1,1,1.05],[],O);
    add(shoe,new THREE.BoxGeometry(.012,.05,.16),flat(light(shoeC)?INK:PAPER),[side*.172,.17+lift,.03]);
  }

  // Torso: perfil cuadrado y corto, con la prenda pintada alrededor
  const profile=type!=='baloncesto'?[[0,-.4],[.3,-.4],[.36,-.385],[.372,-.33],[.4,-.27],[.412,-.05],[.4,.14],[.36,.27],[.26,.36],[.12,.4],[0,.4]]:[[0,-.4],[.27,-.4],[.33,-.37],[.35,-.2],[.345,.1],[.3,.27],[.2,.36],[.1,.4],[0,.4]];
  const torso=add(body,lathe(profile),type==='plumas'?mat(main):mat(main,torsoTexture(type,main,trim,look.print)),[0,.94,0],[1.06,1,.8],[],O);
  if(type==='plumas')for(const y of [.68,.84,1,1.16])add(body,ring(.37,.062),mat(main),[0,y,0],[1.1,.82,1],[Math.PI/2,0,0],O);
  if(type==='plumas')add(body,new THREE.BoxGeometry(.02,.6,.02),flat(INK),[0,.92,.35]);
  const arms=[];
  for(const side of [-1,1]){
    const arm=new THREE.Group();arm.position.set(side*.41,1.16,0);arm.rotation.z=side*.42;body.add(arm);arms.push(arm);
    const sleeveC=type==='universitaria'?trim:main,sleeve=type==='chandal'?mat(main,sleeveTexture(main,PAPER)):mat(sleeveC);
    add(arm,capsule(.09,.36),skin,[0,-.27,0],[],[],O);
    if(sleeved){
      add(arm,capsule(.145,.27),sleeve,[0,-.19,0],[],[],O);
      const cuff=type==='universitaria'?mat(null,stripes([trim,PAPER,trim,PAPER,trim])):mat(shade(sleeveC,.78));
      if(type!=='plumas')add(arm,new THREE.CylinderGeometry(.125,.118,.085,24),cuff,[0,-.42,0],[],[],O);else for(const y of [-.1,-.24,-.38])add(arm,ring(.135,.05),sleeve,[0,y,0],[1,1,1],[Math.PI/2,0,0],O);
    }else if(!bare)add(arm,capsule(.165,.1),mat(main),[0,-.09,0],[],[],O);
    add(arm,sphere(),skin,[0,-.55,0],[.105,.125,.09],[],O);add(arm,sphere(.045),skin,[0,-.52,.085]);
  }
  if(type==='sudadera'||type==='plumas'){
    if(look.hat!=='capucha')add(body,ring(.27,.125),mat(shade(main,.85)),[0,1.27,-.17],[1.2,1,1],[Math.PI/2+.5,0,0],O);
    if(type==='sudadera')for(const x of [-.075,.075])add(body,new THREE.CylinderGeometry(.014,.014,.2),white,[x,1.08,.33]);
  }
  if(has('cadena'))add(body,ring(.25,.022),gold,[0,1.13,.1],[1,1.3,1],[2.05,0,0]);

  // Cabeza y cara: ojos altos con párpado caído, cejas y media sonrisa
  const head=new THREE.Group();head.position.set(0,1.8,0);body.add(head);
  add(head,box(HEAD.n),skin,[],[HEAD.a,HEAD.b,HEAD.c],[],.022);
  for(const side of [-1,1]){
    add(head,sphere(),skin,[side*.635,-.06,-.02],[.07,.12,.1],[],O);
    if(has('aros'))add(head,ring(.05,.013),gold,[side*.66,-.19,-.02],[1,1,1],[0,Math.PI/2,0]);
  }
  const eyes=[],lids=[],face=look.face,hidden=has('sol');
  if(!hidden)for(const side of [-1,1]){
    const eye=add(head,sphere(.07),ink,onHead(side*.215,-.04,1.004),[1,1.55,.4]);eye.castShadow=false;eyes.push(eye);
    add(eye,sphere(.024),flat(PAPER),[side*-.012,.022,.06],[1,.65,1]).castShadow=false;
    if(face!=='feliz'){const lid=add(head,sphere(),skin,onHead(side*.215,.055,1.02),[.095,.075,.04],[0,0,side*(face==='serio'?.32:.16)]);lid.castShadow=false;lids.push(lid)}
  }
  for(const side of [-1,1]){
    const brow=add(head,capsule(.02,.12),flat(shade(hairC,.6)),onHead(side*.215,face==='feliz'?.2:.15,1.02),[1,1,.6],[0,0,Math.PI/2+side*(face==='feliz'?-.12:face==='serio'?.38:.24)]);brow.castShadow=false;
  }
  const mouth=onHead(face==='chulo'?.06:0,-.27,1.012);
  if(face==='serio')add(head,capsule(.016,.13),ink,mouth,[1,1,.6],[0,0,Math.PI/2+.04]).castShadow=false;
  else add(head,ring(.09,.017,Math.PI*(face==='chulo'?.62:1)),ink,mouth,[1,1,1],[.38,0,Math.PI+(face==='chulo'?.5:0)]).castShadow=false;
  if(has('oro')&&face!=='serio')add(head,new THREE.BoxGeometry(.035,.04,.02),gold,[mouth[0]+.03,mouth[1]-.045,mouth[2]+.004],[],[.38,0,0]);
  if(hidden){
    const frame=flat(INK);add(head,new THREE.BoxGeometry(.56,.105,.03),frame,[0,-.03,.595]);
    for(const side of [-1,1]){add(head,new THREE.BoxGeometry(.2,.065,.01),flat('#3d4656'),[side*.15,-.022,.612]);add(head,new THREE.BoxGeometry(.03,.03,.5),frame,[side*.3,-.02,.36],[],[0,side*-.3,0])}
  }
  if(has('gafas')&&!hidden){
    const frame=flat(INK);for(const side of [-1,1]){add(head,ring(.125,.018),frame,[side*.215,-.04,.61]);add(head,new THREE.BoxGeometry(.02,.02,.46),frame,[side*.36,-.03,.38],[],[0,side*-.28,0])}
    add(head,new THREE.BoxGeometry(.18,.02,.02),frame,[0,-.02,.62]);
  }
  if(has('panuelo')){
    add(head,shell(HEAD.n,0,Math.PI*2,Math.PI*.58,Math.PI*.3),mat(null,dotted()),[0,-.02,0],[HEAD.a*1.05,HEAD.b*1.08,HEAD.c*1.06]).material.side=THREE.DoubleSide;
    add(head,sphere(),mat('#e5383b'),[0,-.3,-.62],[.1,.08,.07],[],O);
  }

  // Pelo: una capa sobre el cráneo y, encima, los mechones de cada peinado. Con gorro solo asoma lo que cabe.
  const hat=look.hat,hair=look.hair,hooded=hat==='capucha',covered=!!hat&&!['capucha','corona','aureola'].includes(hat);
  const scalp=(arc=.5,tilt=-.5,grow=1.045)=>add(head,shell(HEAD.n,0,Math.PI*2,0,Math.PI*arc),hairM,[0,.012,-.01],[HEAD.a*grow,HEAD.b*grow,HEAD.c*grow],[tilt,0,0],.02);
  const spike=(x,y,z,rx,rz,size=1)=>add(head,new THREE.ConeGeometry(.1*size,.3*size,8),hairM,[x,y,z],[1,1,.7],[rx,0,rz],.05);
  if(hair!=='calvo'){
    if(hair==='rapado'||hair==='degradado'||hair==='mono')add(head,shell(HEAD.n,0,Math.PI*2,0,Math.PI*.56),mat(shade(hairC,light(hairC)?.8:1.7)),[0,.005,-.005],[HEAD.a*1.012,HEAD.b*1.012,HEAD.c*1.012],[-.5,0,0]);
    else scalp(hair==='afro'?.55:.5);
    if(!hooded){
      if(hair==='mullet')add(head,box(3),hairM,[0,-.36,-.42],[.46,.34,.2],[.25,0,0],O);
      if(hair==='trenzas')for(const side of [-1,1])for(let i=0;i<6;i++)add(head,sphere(.085-i*.006),hairM,[side*(.5+i*.012),-.3-i*.13,-.3+i*.012],[],[],.06);
      if(hair==='rastas')for(let i=0;i<11;i++){const a=Math.PI*i/10,length=.5+((i*7)%3)*.09;add(head,capsule(.055,length),hairM,[Math.cos(a)*.63,-.08-length/2,-Math.sin(a)*.57-.03],[],[0,0,Math.cos(a)*.1],.07)}
    }
    if(hair==='puntas'||hair==='mullet')for(const [x,rz,size] of [[-.34,.5,1],[-.17,.22,1.15],[0,0,1.25],[.18,-.25,1.1],[.35,-.52,.95]])spike(x,covered?.2:.27,.57,Math.PI-.3,rz,size*(covered?.75:1));
    if(hair==='cortina')for(const side of [-1,1])add(head,box(3),hairM,[side*.33,covered||hooded?.2:.31,.5],[.3,.13,.1],[.12,side*.25,side*-.55],O);
    if(!covered&&!hooded){
      if(hair==='puntas'||hair==='mullet')for(const [x,z,rz] of [[-.2,.1,.3],[.05,.2,-.1],[.25,0,-.4],[0,-.2,.1]])spike(x,.66,z,0,rz,1.1);
      if(hair==='degradado')add(head,box(4),hairM,[0,.5,.04],[.44,.19,.47],[-.1,0,0],O);
      if(hair==='rizos'||hair==='rastas')for(let i=0;i<14;i++){const a=i/14*Math.PI*2,r=i%2?.4:.2;add(head,sphere(.17),hairM,[Math.sin(a)*r,.56-r*.3,Math.cos(a)*r*.95],[],[],.06)}
      if(hair==='afro')add(head,sphere(.8,32,24),hairM,[0,.34,-.2],[],[],.025);
      if(hair==='mono'){add(head,box(3),hairM,[0,.5,-.02],[.3,.14,.4],[],O);add(head,sphere(.2),hairM,[0,.76,-.14],[],[],.05)}
      if(hair==='trenzas')add(head,new THREE.BoxGeometry(.012,.02,.9),flat(shade(hairC,.6)),[0,.6,-.1],[],[-.5,0,0]);
    }
  }
  // Gorros
  if(covered){
    const cap=new THREE.Group(),hatC=CLOTH[look.hatColor]||INK,hatTrim=CLOTH[look.hatTrim]||trim,color=mat(hatC),dark=mat(shade(hatC,.72));head.add(cap);
    if(['plana','atras','ladeada'].includes(hat)){
      cap.rotation.set(-.14,hat==='atras'?Math.PI:hat==='ladeada'?-.7:0,hat==='ladeada'?.1:0);
      add(cap,shell(3.2,0,Math.PI*2,0,Math.PI*.5),color,[0,.14,0],[.69,.6,.66],[],.025);
      add(cap,shell(3.2,Math.PI/2-.62,1.24,.12,Math.PI/2-.12),mat(hatTrim),[0,.14,0],[.7,.608,.67]);
      add(cap,new THREE.CylinderGeometry(.5,.5,.045,36,1,false,-Math.PI/2,Math.PI),dark,[0,.16,.5],[1.02,1,.86],[.06,0,0],.03);
      add(cap,sphere(.05),dark,[0,.745,0]);
      add(cap,new THREE.PlaneGeometry(.3,.3),new THREE.MeshBasicMaterial({map:capLogo(PAPER,INK),transparent:true}),[0,.42,.665],[],[-.2,0,0]).castShadow=false;
      add(cap,new THREE.CircleGeometry(.07,20),flat(GOLD),[.24,.188,.75],[],[-Math.PI/2+.06,0,0]).castShadow=false;
    }
    if(hat==='gorro'){cap.rotation.x=-.3;add(cap,shell(3,0,Math.PI*2,0,Math.PI*.5),color,[0,.12,0],[.685,.66,.655],[],.025);add(cap,ring(.63,.085),dark,[0,.16,0],[1.07,1.02,1],[Math.PI/2,0,0],.03);add(cap,sphere(),color,[0,.66,-.2],[.26,.18,.26],[.5,0,0],O)}
    if(hat==='pescador'){cap.rotation.x=-.16;add(cap,shell(3.4,0,Math.PI*2,0,Math.PI*.5),color,[0,.2,0],[.67,.5,.64],[],.025);add(cap,new THREE.CylinderGeometry(.66,.95,.2,40,1,true),color,[0,.2,0]).material.side=THREE.DoubleSide;add(cap,ring(.675,.03),mat(hatTrim),[0,.3,0],[1,.97,1],[Math.PI/2,0,0])}
  }
  if(hat==='aureola')add(head,ring(.36,.045),gold,[0,.86,-.04],[1,1,1],[Math.PI/2-.14,0,0]);
  if(hat==='corona'){
    add(head,new THREE.CylinderGeometry(.4,.36,.2,24,1,true),gold,[0,.66,-.03],[],[-.1,0,0]).material.side=THREE.DoubleSide;
    for(let i=0;i<7;i++){const a=i/7*Math.PI*2;add(head,new THREE.ConeGeometry(.085,.2,4),gold,[Math.sin(a)*.4,.84,Math.cos(a)*.4-.05]);add(head,sphere(.035),mat(CLOTH.rojo),[Math.sin(a)*.4,.96,Math.cos(a)*.4-.05])}
  }
  if(hooded){
    add(head,shell(2.8,Math.PI/2+.85,Math.PI*2-1.7,0,Math.PI*.78),mat(shade(main,.92)),[0,.03,-.04],[HEAD.a*1.2,HEAD.b*1.2,HEAD.c*1.16]).material.side=THREE.DoubleSide;
    add(head,ring(.62,.05,Math.PI*1.25),mat(shade(main,.75)),[0,.03,.33],[1.05,1.05,1],[0,0,-Math.PI*.125]);
  }
  if(has('cascos')){
    add(head,ring(.7,.04,Math.PI),mat(INK),[0,0,-.02],[1,1.03,1],[],.06);
    for(const side of [-1,1])add(head,box(3),mat(CLOTH.coral),[side*.7,-.06,-.02],[.08,.2,.17],[],O);
  }
  return {group:model,parts:{body,torso,head,arms,eyes,lids},base:lift};
}

// ---------- Motor: un solo contexto 3D que dibuja cada avatar y lo copia a su lienzo
const SCALE=Math.min(window.devicePixelRatio||1,2),TURN=-.3,reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
// Encuadres: frame = alto que debe caber, width = ancho, target = altura a la que mira la cámara.
const VIEWS={full:{ratio:2/3,frame:3.1,width:2.05,target:1.38},bust:{ratio:1,frame:1.9,target:1.87},legs:{ratio:1,frame:1.3,target:.42},torso:{ratio:1,frame:1.6,target:1}};
const TAN=Math.tan(THREE.MathUtils.degToRad(13.5));
function shoot(context,width,height,entry,mode,turn){
  const view=VIEWS[mode]||VIEWS.full,aspect=width/height,distance=Math.max(view.frame/2/TAN,(view.width||view.frame)/2/TAN/aspect);
  camera.aspect=aspect;camera.position.set(0,view.target+distance*.03,distance);camera.lookAt(0,view.target,0);camera.updateProjectionMatrix();
  entry.group.rotation.y=turn;scene.add(entry.group);
  renderer.setViewport(0,0,width,height);renderer.setScissor(0,0,width,height);renderer.clear();renderer.render(scene,camera);
  scene.remove(entry.group);
  context.clearRect(0,0,width,height);context.drawImage(renderer.domElement,0,BUF_H-height,width,height,0,0,width,height);
}
const dispose=entry=>entry.group.traverse(o=>{if(o.material===lineMat)return;o.geometry?.dispose();o.material?.map?.dispose();o.material?.dispose()});
const sizeOf=(el,mode)=>{const view=VIEWS[mode]||VIEWS.full,width=Math.min(BUF_W,Math.ceil(el.clientWidth*SCALE/16)*16,Math.floor(BUF_H*view.ratio));return [width,Math.round(width/view.ratio)]};
// Imágenes fijas (marcador, avisos, tienda): se dibujan una vez y se guardan.
const shots=new Map();
function snapshot(look,mode,width,height){
  const id=mode+width+JSON.stringify(look);let canvas=shots.get(id);
  if(!canvas){
    canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
    const entry=buildModel(look);shoot(canvas.getContext('2d'),width,height,entry,mode,TURN);dispose(entry);
    if(shots.size>400)shots.delete(shots.keys().next().value);shots.set(id,canvas);
  }
  return canvas;
}
// Avatares animados (portada, perfil, duelo): respiran, parpadean y hacen gestos.
const live=new Set(),queue=new Set(),asleep=new Set();
function animate(item,now){
  const {body,torso,head,arms,eyes,lids}=item.entry.parts,t=now/1000,age=(now-item.born)/1000,move=reduced?0:1,emote=reduced?'':item.data.emote;
  if(!item.dragging){item.turn+=item.spin;item.spin*=.92}
  body.position.set(0,item.entry.base+Math.sin(t*1.9)*.012*move,0);torso.scale.y=1+Math.sin(t*1.9)*.012*move;body.rotation.z=Math.sin(t*.95)*.018*move;
  head.rotation.set(0,Math.sin(t*.6)*.12*move,Math.sin(t*.95)*.035*move-.03);
  arms.forEach((arm,i)=>{arm.rotation.z=(i?1:-1)*.42;arm.rotation.x=Math.sin(t*1.9+i*Math.PI)*.06*move});
  const blink=t%4.2<.13&&move;eyes.forEach(eye=>{eye.scale.y=blink?.15:1.55});lids.forEach(lid=>{lid.visible=!blink});
  if(emote==='wave'&&age<1.9){arms[1].rotation.z=2.5+Math.sin(age*13)*.3;arms[1].rotation.x=0;head.rotation.z=.12}
  if(emote==='cheer'&&age%4<1.5){const k=age%4;body.position.y+=Math.abs(Math.sin(k*Math.PI/.5))*.26;arms.forEach((arm,i)=>{arm.rotation.z=(i?1:-1)*(2.6+Math.sin(k*18)*.12);arm.rotation.x=0})}
  if(emote==='sad'){head.rotation.x=.3;head.rotation.y=0;arms.forEach((arm,i)=>{arm.rotation.z=(i?1:-1)*.2})}
  if(emote==='hurt'&&age<.7)body.position.x=Math.sin(age*46)*.07*(1-age/.7);
}
let running=false,last=0;
function loop(now){
  if(!live.size){running=false;return}
  requestAnimationFrame(loop);if(document.hidden||now-last<30)return;last=now;
  const covered=document.body.classList.contains('modal-open');
  for(const item of live){
    if(!item.el.isConnected){dispose(item.entry);live.delete(item);continue}
    if(!item.el.clientWidth||(covered&&item.home))continue;
    const [width,height]=sizeOf(item.el,item.data.mode);
    if(item.canvas.width!==width||item.canvas.height!==height){item.canvas.width=width;item.canvas.height=height}
    animate(item,now);shoot(item.context,width,height,item.entry,item.data.mode,item.turn);
  }
}
function grab(item){
  const el=item.el;let lastX=0;el.style.touchAction='pan-y';el.style.cursor='grab';
  el.addEventListener('pointerdown',event=>{item.dragging=true;lastX=event.clientX;el.setPointerCapture(event.pointerId)});
  el.addEventListener('pointermove',event=>{if(!item.dragging)return;const delta=(event.clientX-lastX)*.014;item.turn+=delta;item.spin=delta;lastX=event.clientX});
  for(const name of ['pointerup','pointercancel'])el.addEventListener(name,()=>{item.dragging=false});
}
function hydrate(el){
  if(el.dataset.ready||!el.isConnected)return;
  if(!el.clientWidth){asleep.add(el);return}
  let data;try{data=JSON.parse(decodeURIComponent(el.dataset.avatar))}catch{return}
  const [width,height]=sizeOf(el,data.mode),canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;el.dataset.ready='1';
  if(data.live){
    const item={el,canvas,context:canvas.getContext('2d'),entry:buildModel(data.look),data,turn:TURN,spin:0,dragging:false,born:performance.now(),home:!!el.closest('.home')};
    animate(item,item.born);shoot(item.context,width,height,item.entry,data.mode,item.turn);
    el.replaceChildren(canvas);live.add(item);if(data.drag)grab(item);
    if(!running){running=true;requestAnimationFrame(loop)}
  }else{canvas.getContext('2d').drawImage(snapshot(data.look,data.mode,width,height),0,0);el.replaceChildren(canvas)}
}
// Los huecos se rellenan por tandas cortas para no bloquear la página (la tienda tiene decenas de piezas).
let scheduled=false;
function schedule(){
  if(scheduled)return;scheduled=true;
  requestAnimationFrame(()=>{scheduled=false;const stop=performance.now()+12;for(const el of queue){queue.delete(el);hydrate(el);if(performance.now()>stop)break}if(queue.size)schedule()});
}
function enqueue(root){
  if(root.nodeType!==1)return;
  if(root.classList.contains('avatar-view'))queue.add(root);
  root.querySelectorAll('.avatar-view:not([data-ready])').forEach(el=>queue.add(el));
  if(queue.size)schedule();
}
new MutationObserver(records=>{for(const record of records)for(const node of record.addedNodes)enqueue(node)}).observe(document.body,{childList:true,subtree:true});
// Los que nacen dentro de algo oculto esperan a tener tamaño.
setInterval(()=>{for(const el of asleep){if(!el.isConnected)asleep.delete(el);else if(el.clientWidth){asleep.delete(el);queue.add(el)}}if(queue.size)schedule()},350);
enqueue(document.body);
window.Avatar3D={ready:true,views:live};

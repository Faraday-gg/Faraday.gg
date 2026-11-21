// Avatar en 3D (decisión 0025). Personaje propio, de estética de calle: cabeza de cubo redondeado, mirada con párpado
// caído, ropa ancha y contorno de tinta. Hay dos cuerpos, hombre y mujer (decisión 0028). Todo se construye con formas de Three.js y texturas pintadas en un lienzo
// (chaquetas, estampados, puños): no hay modelos descargados ni logotipos o diseños de terceros. Las piezas de marca
// (decisión 0026) son la excepción: llevan el logotipo real (avatar-logos.js, o dibujado aquí en DRAWN).
// avatar.js escribe en la página huecos <span class="avatar-view"> con el look ya traducido; este archivo los rellena.
// Hay un solo contexto 3D para toda la página: cada avatar se dibuja en él y se copia a su propio lienzo.
// PENDIENTE: Three.js se carga desde una CDN; hay que traer la librería al repositorio (docs/mejoras).
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js';
import {LOGOS} from './avatar-logos.js';

const INK='#1b1f27',PAPER='#fffdf7',GOLD='#ffc93c';
const {SKIN,HAIR:HAIR_COLORS,CLOTH,DENIM}=window.Avatar.PALETTE;
const BUF_W=640,BUF_H=960,renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});
renderer.setPixelRatio(1);renderer.setSize(BUF_W,BUF_H,false);renderer.setClearColor(0x000000,0);renderer.setScissorTest(true);
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(27,1,.1,50);
scene.add(new THREE.HemisphereLight('#ffffff','#cdbfa6',1.25));
// La luz principal está alta para que la sombra sea corta y quepa en todos los encuadres. La cámara de sombras y el suelo
// son mucho más grandes que el personaje: si no, la sombra se corta con una línea recta.
const key=new THREE.DirectionalLight('#fff3e0',2.4);key.position.set(.8,6,3.4);key.castShadow=true;key.shadow.mapSize.set(2048,2048);key.shadow.radius=7;key.shadow.bias=-.0006;
Object.assign(key.shadow.camera,{left:-4,right:4,top:4.5,bottom:-4,near:.5,far:16});scene.add(key);
const rim=new THREE.DirectionalLight('#9fc4ff',1.1);rim.position.set(-3,2.6,-4);scene.add(rim);
const floor=new THREE.Mesh(new THREE.CircleGeometry(8,64),new THREE.ShadowMaterial({opacity:.22}));floor.rotation.x=-Math.PI/2;floor.receiveShadow=true;scene.add(floor);

// Sombreado por tonos (tres escalones) y contorno de tinta: le dan aire de cómic en vez de plástico blando.
const ramp=new THREE.DataTexture(new Uint8Array([120,120,120,255,196,196,196,255,255,255,255,255]),3,1);ramp.minFilter=ramp.magFilter=THREE.NearestFilter;ramp.needsUpdate=true;
// Acabados (decisión 0072). Mientras `finish` tiene un acabado, mat() hace el material con un «matcap»: una bola
// pintada que dice qué color se ve según hacia dónde mira cada punto de la superficie. Da brillo de metal sin luces
// ni reflejos de verdad, y el holográfico cambia de color al girar el avatar. buildModel lo activa en cada prenda.
let finish='';
const FINISH_TINT='#f4f4f4',matcaps={};
const BANDS={cr:['#ffffff','#dde5ee','#8793a3','#eef2f7','#5d6878','#262d38'],or:['#fffbe0','#ffd75e','#c2820c','#ffe88f','#96600a','#4f3204']};
function matcap(kind){
  return matcaps[kind]||=(()=>{const canvas=document.createElement('canvas'),S=canvas.width=canvas.height=256,c=canvas.getContext('2d');
    const radial=stops=>{const g=c.createRadialGradient(S*.4,S*.34,0,S*.5,S*.5,S*.52);stops.forEach(([at,color])=>g.addColorStop(at,color));return g};
    if(kind==='ho'){
      // Arcoíris en abanico, aclarado en el centro y oscurecido en el borde.
      const hues=[330,280,210,170,90,50,20,330];let g;
      if(c.createConicGradient){g=c.createConicGradient(.6,S/2,S/2);hues.forEach((hue,i)=>g.addColorStop(i/(hues.length-1),`hsl(${hue} 95% 72%)`))}
      else{g=c.createLinearGradient(0,0,S,S);hues.forEach((hue,i)=>g.addColorStop(i/(hues.length-1),`hsl(${hue} 95% 72%)`))}
      c.fillStyle=g;c.fillRect(0,0,S,S);
      c.fillStyle=radial([[0,'#ffffffee'],[.3,'#ffffff55'],[.7,'#ffffff00'],[1,'#2a1f4a88']]);c.fillRect(0,0,S,S);
    }else{const colors=BANDS[kind]||BANDS.cr;c.fillStyle=radial([0,.22,.5,.68,.86,1].map((at,i)=>[at,colors[i]]));c.fillRect(0,0,S,S)}
    const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;return texture})();
}
const mat=(color,map=null)=>finish?new THREE.MeshMatcapMaterial({color:map?'#ffffff':color,map,matcap:matcap(finish)}):new THREE.MeshToonMaterial({color:map?'#ffffff':color,map,gradientMap:ramp});
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
// Miembro: cápsula que se estrecha de r1 (arriba, en y = 0) a r2 (abajo, en y = -length). El brazo y el antebrazo comparten
// radio en el codo, así que estirados forman una sola pieza, sin anillos en la unión.
function limb(r1,r2,length){
  const points=[];
  for(let i=0;i<=8;i++){const a=Math.PI/2*i/8;points.push(new THREE.Vector2(Math.sin(a)*r2,-length-Math.cos(a)*r2))}
  for(let i=0;i<=8;i++){const a=Math.PI/2*i/8;points.push(new THREE.Vector2(Math.cos(a)*r1,Math.sin(a)*r1))}
  return new THREE.LatheGeometry(points,22);
}
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
// Casquete de pelo: la misma forma de la cabeza, un poco más grande y sin girar (así no asoma el cráneo por ninguna
// esquina), recortada por la línea del pelo. La línea baja de la frente (front) a la nuca (back) pasando por encima de las
// orejas. Los ángulos se miden desde la coronilla, en fracciones de media vuelta; power mueve la línea de las sienes.
function hairCap(front=.34,back=.8,burn=.1,power=1.4,W=64,H=22){
  const position=[],normal=[],index=[],n=HEAD.n,v=new THREE.Vector3();
  for(let j=0;j<=H;j++)for(let i=0;i<=W;i++){
    const phi=i/W*Math.PI*2,facing=(Math.sin(phi)+1)/2,theta=j/H*Math.PI*(front+(back-front)*(1-facing)**power+burn*Math.exp(-(((facing-.66)/.07)**2)));
    v.set(-Math.cos(phi)*Math.sin(theta),Math.cos(theta),Math.sin(phi)*Math.sin(theta));
    const k=(Math.abs(v.x)**n+Math.abs(v.y)**n+Math.abs(v.z)**n)**(-1/n);position.push(v.x*k,v.y*k,v.z*k);
    v.set(Math.sign(v.x)*Math.abs(v.x)**(n-1),Math.sign(v.y)*Math.abs(v.y)**(n-1),Math.sign(v.z)*Math.abs(v.z)**(n-1)).normalize();normal.push(v.x,v.y,v.z);
  }
  for(let j=0;j<H;j++)for(let i=0;i<W;i++){const a=j*(W+1)+i,b=a+W+1;index.push(a+1,a,b+1,a,b,b+1)}
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(position,3));geometry.setAttribute('normal',new THREE.Float32BufferAttribute(normal,3));geometry.setIndex(index);return geometry;
}
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
// Banderas de las camisetas de selección (decisión 0045): versiones simplificadas, sin escudos detallados. Cada una se
// dibuja centrada en el origen con ancho w y alto h. Código de dos letras → [siglas de la espalda, dibujo].
const W='#ffffff';
function drawFlag(c,code,w,h){
  const def=FLAGS[code];if(!def)return;
  const x0=-w/2,y0=-h/2,rect=(x,y,ww,hh,color)=>{c.fillStyle=color;c.fillRect(x,y,ww+.5,hh+.5)};
  const H=colors=>colors.forEach((color,i)=>rect(x0,y0+h*i/colors.length,w,h/colors.length,color));
  const V=colors=>colors.forEach((color,i)=>rect(x0+w*i/colors.length,y0,w/colors.length,h,color));
  const disc=(x,y,r,color,ring='')=>{c.fillStyle=color;c.beginPath();c.arc(x,y,r,0,7);c.fill();if(ring){c.lineWidth=r*.28;c.strokeStyle=ring;c.stroke()}};
  const star=(x,y,r,color)=>{c.fillStyle=color;c.beginPath();for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5,k=i%2?r*.42:r;c.lineTo(x+Math.cos(a)*k,y+Math.sin(a)*k)}c.closePath();c.fill()};
  const tri=(depth,color)=>{c.fillStyle=color;c.beginPath();c.moveTo(x0,y0);c.lineTo(x0+depth,0);c.lineTo(x0,y0+h);c.closePath();c.fill()};
  const sun=(x,y,r,color)=>{c.strokeStyle=color;c.lineWidth=r*.3;for(let i=0;i<12;i++){const a=i*Math.PI/6;c.beginPath();c.moveTo(x+Math.cos(a)*r,y+Math.sin(a)*r);c.lineTo(x+Math.cos(a)*r*1.7,y+Math.sin(a)*r*1.7);c.stroke()}disc(x,y,r,color)};
  c.save();c.beginPath();c.rect(x0,y0,w,h);c.clip();
  def[1]({w,h,x0,y0,rect,H,V,disc,star,tri,sun,c});
  c.restore();c.lineWidth=Math.max(2,h*.06);c.lineJoin='round';c.strokeStyle=INK;c.strokeRect(x0,y0,w,h);
}
const FLAGS={
  // Países hispanohablantes.
  es:['ESP',({H,rect,x0,w,h})=>{H(['#c60b1e','#ffc400','#ffc400','#c60b1e']);rect(x0+w*.2,-h*.13,w*.1,h*.26,'#ad1519')}],
  mx:['MEX',({V,disc,h})=>{V(['#006847',W,'#ce1126']);disc(0,0,h*.13,'#8c5a2b','#5f8f3e')}],
  co:['COL',({H})=>H(['#fcd116','#fcd116','#003893','#ce1126'])],
  ar:['ARG',({H,sun,h})=>{H(['#75aadb',W,'#75aadb']);sun(0,0,h*.08,'#f6b40e')}],
  pe:['PER',({V})=>V(['#d91023',W,'#d91023'])],
  ve:['VEN',({H,star,h})=>{H(['#ffcc00','#00247d','#cf142b']);for(let i=0;i<8;i++){const a=Math.PI*(1.15+i*.7/7);star(Math.cos(a)*h*.27,h*.17+Math.sin(a)*h*.27,h*.045,W)}}],
  cl:['CHI',({rect,star,x0,y0,w,h})=>{rect(x0,y0,w,h/2,W);rect(x0,0,w,h/2,'#d52b1e');rect(x0,y0,h/2,h/2,'#0039a6');star(x0+h/4,y0+h/4,h*.13,W)}],
  ec:['ECU',({H,disc,h})=>{H(['#ffdd00','#ffdd00','#034ea2','#ed1c24']);disc(0,0,h*.13,'#7a5230','#ffdd00')}],
  gt:['GUA',({V,disc,h})=>{V(['#4997d0',W,'#4997d0']);disc(0,0,h*.12,W,'#4f9a3a')}],
  cu:['CUB',({H,tri,star,x0,w,h})=>{H(['#002a8f',W,'#002a8f',W,'#002a8f']);tri(w*.43,'#cf142b');star(x0+w*.15,0,h*.14,W)}],
  bo:['BOL',({H})=>H(['#d52b1e','#f9e300','#007934'])],
  do:['DOM',({rect,disc,x0,y0,w,h})=>{const b=h*.14;rect(x0,y0,w,h,W);rect(x0,y0,w/2-b/2,h/2-b/2,'#002d62');rect(b/2,y0,w/2-b/2,h/2-b/2,'#ce1126');rect(x0,b/2,w/2-b/2,h/2-b/2,'#ce1126');rect(b/2,b/2,w/2-b/2,h/2-b/2,'#002d62');disc(0,0,b*.6,'#0a7a3d')}],
  hn:['HON',({H,star,w,h})=>{H(['#0073cf',W,'#0073cf']);for(const [x,y] of [[0,0],[-1,-1],[1,-1],[-1,1],[1,1]])star(x*w*.11,y*h*.07,h*.05,'#0073cf')}],
  py:['PAR',({H,disc,star,h})=>{H(['#d52b1e',W,'#0038a8']);disc(0,0,h*.1,W,'#2e8b3a');star(0,0,h*.05,'#f7d116')}],
  sv:['SLV',({H,disc,h})=>{H(['#0047ab',W,'#0047ab']);disc(0,0,h*.1,'#f5c400','#2e8b3a')}],
  ni:['NCA',({H,c,h})=>{H(['#0067c6',W,'#0067c6']);c.fillStyle='#3a9bd9';c.strokeStyle='#c8a000';c.lineWidth=h*.025;c.beginPath();c.moveTo(0,-h*.12);c.lineTo(h*.12,h*.09);c.lineTo(-h*.12,h*.09);c.closePath();c.fill();c.stroke()}],
  cr:['CRC',({H})=>H(['#002b7f',W,'#ce1126','#ce1126',W,'#002b7f'])],
  pa:['PAN',({rect,star,x0,y0,w,h})=>{rect(x0,y0,w,h,W);rect(0,y0,w/2,h/2,'#da121a');rect(x0,0,w/2,h/2,'#072357');star(x0+w/4,y0+h/4,h*.12,'#072357');star(w/4,h/4,h*.12,'#da121a')}],
  uy:['URU',({H,rect,sun,x0,y0,h})=>{H([W,'#0038a8',W,'#0038a8',W,'#0038a8',W,'#0038a8',W]);const s=h*5/9;rect(x0,y0,s,s,W);sun(x0+s/2,y0+s/2,h*.09,'#fcd116')}],
  pr:['PUR',({H,tri,star,x0,w,h})=>{H(['#ed0000',W,'#ed0000',W,'#ed0000']);tri(w*.43,'#0050f0');star(x0+w*.15,0,h*.14,W)}],
  gq:['GEQ',({H,tri,disc,h,w})=>{H(['#3e9a00',W,'#e32118']);tri(w*.22,'#0073ce');disc(0,0,h*.08,'#b8b8b8','#3e9a00')}],
  // Europa.
  fr:['FRA',({V})=>V(['#002395',W,'#ed2939'])],
  it:['ITA',({V})=>V(['#009246',W,'#ce2b37'])],
  pt:['POR',({rect,disc,x0,y0,w,h})=>{rect(x0,y0,w*.4,h,'#046a38');rect(x0+w*.4,y0,w*.6,h,'#da291c');disc(x0+w*.4,0,h*.18,'#ffe900','#da291c');rect(x0+w*.4-h*.07,-h*.08,h*.14,h*.16,W)}],
  de:['GER',({H})=>H(['#000000','#dd0000','#ffce00'])],
  gb:['GBR',({rect,c,x0,y0,w,h})=>{rect(x0,y0,w,h,'#012169');c.lineCap='butt';for(const [color,width] of [[W,h*.2],['#c8102e',h*.07]]){c.strokeStyle=color;c.lineWidth=width;c.beginPath();c.moveTo(x0,y0);c.lineTo(-x0,-y0);c.moveTo(x0,-y0);c.lineTo(-x0,y0);c.stroke()}rect(x0,-h*.17,w,h*.34,W);rect(-h*.17,y0,h*.34,h,W);rect(x0,-h*.1,w,h*.2,'#c8102e');rect(-h*.1,y0,h*.2,h,'#c8102e')}],
  ie:['IRL',({V})=>V(['#169b62',W,'#ff883e'])],
  nl:['NED',({H})=>H(['#ae1c28',W,'#21468b'])],
  be:['BEL',({V})=>V(['#000000','#fae042','#ed2939'])],
  gr:['GRE',({H,rect,x0,y0,h})=>{H(['#0d5eaf',W,'#0d5eaf',W,'#0d5eaf',W,'#0d5eaf',W,'#0d5eaf']);const s=h*5/9,b=h/9;rect(x0,y0,s,s,'#0d5eaf');rect(x0,y0+s/2-b/2,s,b,W);rect(x0+s/2-b/2,y0,b,s,W)}],
  ch:['SUI',({rect,x0,y0,w,h})=>{rect(x0,y0,w,h,'#da291c');rect(-h*.1,-h*.32,h*.2,h*.64,W);rect(-h*.32,-h*.1,h*.64,h*.2,W)}],
  se:['SWE',({rect,x0,y0,w,h})=>{rect(x0,y0,w,h,'#006aa7');rect(x0+w*5/16,y0,w/8,h,'#fecc00');rect(x0,-h*.1,w,h*.2,'#fecc00')}],
  pl:['POL',({H})=>H([W,'#dc143c'])]
};
// stretch = cuánto más estirado está lo vertical que lo horizontal en el lienzo (depende del largo de la prenda); k = tamaño del estampado.
// Piezas que solo se ganan (decisión 0080). '%rango': la prenda toma el color del rango (los de lib/rangos.mjs), lleva
// su escudo en el pecho y su nombre a la espalda. '&medalla': un disco dorado con el icono de la medalla (los trazos de
// dist/medals.js, en un lienzo de 24 × 24) y su nombre a la espalda.
const RANK_PRINTS={oro:['ORO','#d29a1e'],calculista:['CALCULISTA','#1f9a8a'],estimador:['ESTIMADOR','#2f74d0'],doctorando:['DOCTORANDO','#7a4cd0'],eminencia:['EMINENCIA','#c43d6c'],cientifico:['CIENTÍFICO','#ff5a36']};
const MEDAL_PRINTS={
  racha:['RACHA DE 30','M12 3c1 3.5 5 5.5 5 10a5 5 0 0 1-10 0c0-2 1-3.2 2-4 .2 1.6 1 2.4 1.8 2.6C11 9.5 10.5 6 12 3z'],
  clavo:['EN EL CLAVO','M6 12a6 6 0 1 0 12 0a6 6 0 1 0-12 0M12 2v5M12 17v5M2 12h5M17 12h5M11.5 12h1'],
  duelista:['DUELISTA','M5 4l9.5 9.5M5 4v3M5 4h3M19 4l-9.5 9.5M19 4v3M19 4h-3M8 14l-3.5 3.5 2 2L10 16M16 14l3.5 3.5-2 2L14 16']
};
const SHIELD='M24 3l20 7v17c0 13-9 22-20 27C13 49 4 40 4 27V10z';
function torsoTexture(type,main,trim,print,{stretch=2.6,k=1}={}){
  const rank=print[0]==='%'&&RANK_PRINTS[print.slice(1)]?print.slice(1):'',emblem=print[0]==='&'&&MEDAL_PRINTS[print.slice(1)]?print.slice(1):'';
  if(rank)trim=RANK_PRINTS[rank][1];
  const texture=paint((c,S)=>{
    const F=s=>(.75+s*.25)*S,B=s=>(.25+s*.25)*S,Y=v=>(1-v)*S,dark=shade(main,.78),on=light(main)?INK:PAPER,onTrim=light(trim)?INK:PAPER;
    // brand = logotipo de una marca real ('@nike'): sustituye a FRDY y al sello ≈ de la prenda.
    const brand=print[0]==='@'?print.slice(1):'',tag=brand||(rank?RANK_PRINTS[rank][0]:'FRDY');
    // flag = bandera de una camiseta de selección ('#es'): delante, la bandera; a la espalda, las siglas del país.
    const flag=print[0]==='#'&&FLAGS[print.slice(1)]?print.slice(1):'';
    // Dibuja con proporción real: en el lienzo, lo vertical está más estirado que lo horizontal (2,6 veces en el torso de hombre).
    const at=(x,y,fn)=>{c.save();c.translate(x,y);c.scale(1,stretch);fn();c.restore()};
    const badge=(x,y,r,bg,fg)=>brand||at(x,y,()=>{c.fillStyle=bg;c.beginPath();c.arc(0,0,r,0,7);c.fill();c.lineWidth=r*.14;c.strokeStyle=fg;c.stroke();wave(c,0,0,r*1.15,fg,r*.2)});
    const word=(text,x,y,size,fill,stroke,italic=true,max=200)=>at(x,y,()=>{c.font=`${italic?'italic ':''}900 ${size}px "Arial Black",Arial,sans-serif`;c.textAlign='center';c.textBaseline='middle';const fit=Math.min(1,max/c.measureText(text).width);c.scale(fit,fit);if(stroke){c.lineWidth=size*.22;c.lineJoin='round';c.strokeStyle=stroke;c.strokeText(text,0,0)}c.fillStyle=fill;c.fillText(text,0,0)});
    const bands=(v0,v1,colors)=>colors.forEach((color,i)=>{c.fillStyle=color;c.fillRect(0,Y(v1)+(Y(v0)-Y(v1))*i/colors.length,S,(Y(v0)-Y(v1))/colors.length+1)});
    const mark=(x,y,w,h,color=trim)=>at(x,y,()=>fitLogo(c,brand,color,w,h));
    const graphic=(x,v,scale)=>{
      if(brand)mark(x,Y(v),88*scale,40*scale);
      if(brand==='gucci')at(x,Y(v-.07*scale),()=>['#1f6b45','#c8102e','#1f6b45'].forEach((color,i)=>{c.fillStyle=color;c.fillRect(-44*scale,(i-1.5)*4*scale,88*scale,4*scale+.5)}));
      if(flag)at(x,Y(v),()=>drawFlag(c,flag,68*scale,46*scale));
      if(print==='logo')badge(x,Y(v),30*scale,trim,onTrim);
      if(emblem)at(x,Y(v),()=>{
        c.fillStyle='#ffc93c';c.beginPath();c.arc(0,0,36*scale,0,7);c.fill();c.lineWidth=5*scale;c.strokeStyle=INK;c.stroke();
        c.lineWidth=2*scale;c.strokeStyle='#b8860b';c.beginPath();c.arc(0,0,29*scale,0,7);c.stroke();
        c.scale(2.1*scale,2.1*scale);c.translate(-12,-12);c.lineWidth=2.2;c.lineCap=c.lineJoin='round';c.strokeStyle=INK;c.stroke(new Path2D(MEDAL_PRINTS[emblem][1]));
      });
      if(print==='frdy')word('FRDY',x,Y(v),40*scale,trim,onTrim);
      if(print==='tag')at(x,Y(v),()=>{c.rotate(-.14);c.font=`italic 900 ${46*scale}px "Arial Black",Arial,sans-serif`;c.textAlign='center';c.textBaseline='middle';c.lineWidth=9*scale;c.lineJoin='round';c.strokeStyle=INK;c.strokeText('1,2×',0,0);c.fillStyle=trim;c.fillText('1,2×',0,0);c.fillStyle=PAPER;c.fillRect(-52*scale,24*scale,104*scale,5*scale)});
      // Sudadera exclusiva «Casi casi» (decisión 0030): «1,1×» sobre una diana delante y el lema a la espalda.
      // Piezas exclusivas del Circuito de amigos (decisión 0038): un rayo dentro de un círculo.
      if(print==='rayo')at(x,Y(v),()=>{c.fillStyle=trim;c.beginPath();c.arc(0,0,34*scale,0,7);c.fill();c.lineWidth=5*scale;c.strokeStyle=INK;c.stroke();c.beginPath();for(const [px,py] of [[6,-26],[-14,4],[-1,4],[-7,26],[15,-6],[2,-6],[8,-26]])c.lineTo(px*scale,py*scale);c.closePath();c.fillStyle=INK;c.fill()});
      if(print==='casi'){at(x,Y(v),()=>{c.lineWidth=5*scale;c.strokeStyle=trim;for(const r of [36,24,12]){c.beginPath();c.arc(0,0,r*scale,0,7);c.stroke()}c.rotate(-.12);c.font=`italic 900 ${42*scale}px "Arial Black",Arial,sans-serif`;c.textAlign='center';c.textBaseline='middle';c.lineWidth=10*scale;c.lineJoin='round';c.strokeStyle=INK;c.strokeText('1,1×',0,0);c.fillStyle=PAPER;c.fillText('1,1×',0,0)})}
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
      if(rank)at(F(.44),Y(.68),()=>{c.scale(.9,.9);c.translate(-24,-28);const shield=new Path2D(SHIELD);c.fillStyle=trim;c.fill(shield);c.lineWidth=3;c.lineJoin='round';c.strokeStyle=PAPER;c.stroke(shield)});
      else badge(F(.44),Y(.68),20,PAPER,main);
      word('26',F(-.44),Y(.68),24,trim,null,false);
      word(tag,B(0),Y(.72),52,PAPER,trim);badge(B(0),Y(.42),40,trim,onTrim);
    }
    if(type==='sudadera'){
      bands(0,.09,[dark]);c.fillStyle=dark;c.beginPath();c.roundRect(F(-.5),Y(.36),F(.5)-F(-.5),Y(.12)-Y(.36),18);c.fill();c.strokeStyle=shade(main,.6);c.lineWidth=3;c.stroke();
      graphic(F(0),brand?.47:.62,(brand?1.05:1.25)*k);if(brand)mark(B(0),Y(.62),84,40,on);else if(print==='casi')word('CASI CASI',B(0),Y(.7),30,trim,null);else if(emblem)word(MEDAL_PRINTS[emblem][0],B(0),Y(.7),30,trim,null);else if(print==='rayo')word('CIRCUITO',B(0),Y(.7),30,trim,null);else if(flag)word(FLAGS[flag][0],B(0),Y(.7),34,trim,INK,false);else word('FRDY',B(0),Y(.7),30,on,null);
    }
    if(type==='camiseta'){bands(.93,1,[dark]);graphic(F(0),.6,1.5*k);if(flag){at(B(0),Y(.8),()=>drawFlag(c,flag,30,20));word(FLAGS[flag][0],B(0),Y(.56),64,trim,INK,false)}else badge(B(0),Y(.8),14,on,main)}
    if(type==='chandal'){
      if(!brand){c.fillStyle=trim;c.fillRect(0,0,S,Y(.62));c.fillStyle=PAPER;c.fillRect(0,Y(.62)-5,S,10)}bands(0,.08,[dark]);bands(.92,1,[shade(trim,.8)]);
      c.fillStyle=PAPER;c.fillRect(F(0)-3,Y(.92),6,Y(.08)-Y(.92));c.fillStyle=INK;c.fillRect(F(0)-5,Y(.86),10,26);
      badge(F(.44),Y(.5),15,PAPER,main);if(brand){mark(F(.46),Y(.62),46,22);mark(B(0),Y(.56),96,44)}else word('FRDY',B(0),Y(.46),38,PAPER,null);
    }
    if(type==='baloncesto'){
      bands(0,.06,[trim]);bands(.93,1,[trim]);for(const s of [-1,1]){c.fillStyle=trim;c.fillRect(F(s)-9,Y(.93),18,Y(.5)-Y(.93));c.fillRect(B(s)-9,Y(.93),18,Y(.5)-Y(.93))}
      const number=brand?'23':'12';if(brand)mark(F(0),Y(.69),46,26);else word('FRDY',F(0),Y(.74),26,trim,onTrim);word(number,F(0),Y(brand?.4:.46),brand?58:74,trim,onTrim,false);word(number,B(0),Y(.5),84,trim,onTrim,false);
    }
  });
  texture.offset.set(.75,0);return texture;
}
const stripes=colors=>paint((c,S)=>colors.forEach((color,i)=>{c.fillStyle=color;c.fillRect(0,i*S/colors.length,S,S/colors.length+1)}),64);
// Manga de chándal: dos franjas finas por fuera (no las tres bandas de nadie).
const sleeveTexture=(main,line,three=false)=>paint((c,S)=>{c.fillStyle=main;c.fillRect(0,0,S,S);c.fillStyle=line;for(const u of [.25,.75])for(const d of three?[-.055,0,.055]:[-.035,.035])c.fillRect((u+d)*S-S/(three?44:32),0,S/(three?22:16),S)},128);
const capLogo=(bg,fg)=>paint((c,S)=>{c.clearRect(0,0,S,S);c.fillStyle=bg;c.beginPath();c.roundRect(S*.08,S*.2,S*.84,S*.6,S*.12);c.fill();c.strokeStyle=fg;c.lineWidth=S*.04;c.stroke();wave(c,S/2,S/2,S*.5,fg,S*.07)},128);
// Logotipos de marcas reales (decisión 0026). Los de avatar-logos.js son trazados exactos; los de DRAWN se dibujan aquí,
// en el mismo cuadro de 24 × 24, porque no están en esa colección.
const DRAWN={
  supreme(c){c.fillStyle='#e4002b';c.fillRect(1,8,22,7.4);c.fillStyle='#fff';c.font='italic 900 4.6px "Arial Black",Arial,sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillText('Suprimo',11.8,11.9)},
  gucci(c,color){c.strokeStyle=color;c.lineWidth=1.5;for(const s of [1,-1]){c.save();c.translate(12,12);c.scale(s,1);c.beginPath();c.arc(-2.6,0,4.6,0,Math.PI*2-.85);c.stroke();c.beginPath();c.moveTo(2.75,0);c.lineTo(-2.2,0);c.stroke();c.restore()}},
  gucciweb(c){['#1f6b45','#c8102e','#1f6b45'].forEach((color,i)=>{c.fillStyle=color;c.fillRect(8+i*2.7,3,2.75,18)})},
  balenciaga(c,color){c.fillStyle=color;c.font='700 3.6px Arial,Helvetica,sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillText('BALENCIAGA',12,12)},
  adidas3(c,color){c.fillStyle=color;for(let i=0;i<3;i++){c.beginPath();c.moveTo(4+i*5.2,18);c.lineTo(8.5+i*5.2,6);c.lineTo(11.3+i*5.2,6);c.lineTo(6.8+i*5.2,18);c.fill()}},
  vans(c,color){c.strokeStyle=color;c.lineWidth=2;c.lineCap='round';c.beginPath();c.moveTo(2,15);c.bezierCurveTo(7,15.5,8,8.5,12.5,9.5);c.bezierCurveTo(16,10.3,18.5,12.5,22,8.5);c.stroke()},
  converse(c,color){c.fillStyle=PAPER;c.beginPath();c.arc(12,12,10.5,0,7);c.fill();c.strokeStyle=color;c.lineWidth=1.2;c.beginPath();c.arc(12,12,9.2,0,7);c.stroke();c.fillStyle=color;c.beginPath();for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5,r=i%2?2.6:6.4;c.lineTo(12+Math.cos(a)*r,12+Math.sin(a)*r)}c.fill()}
};
const rawLogo=(c,name,color)=>{if(LOGOS[name]){c.fillStyle=color;c.fill(new Path2D(LOGOS[name]))}else if(DRAWN[name])DRAWN[name](c,color)};
// Hueco que ocupa cada logotipo dentro de su cuadro: se mide una vez, pintándolo en pequeño.
const logoBoxes=new Map();
function logoBox(name){
  if(!logoBoxes.has(name)){
    const n=96,canvas=document.createElement('canvas');canvas.width=canvas.height=n;const c=canvas.getContext('2d',{willReadFrequently:true});c.scale(n/24,n/24);rawLogo(c,name,'#000');
    const data=c.getImageData(0,0,n,n).data;let x0=n,y0=n,x1=0,y1=0;
    for(let y=0;y<n;y++)for(let x=0;x<n;x++)if(data[(y*n+x)*4+3]>40){x0=Math.min(x0,x);x1=Math.max(x1,x+1);y0=Math.min(y0,y);y1=Math.max(y1,y+1)}
    logoBoxes.set(name,x1>x0?[x0,y0,x1,y1].map(v=>v*24/n):[0,0,24,24]);
  }
  return logoBoxes.get(name);
}
// Dibuja el logotipo centrado en el origen, tan grande como quepa en w × h.
function fitLogo(c,name,color,w,h){const [x0,y0,x1,y1]=logoBox(name),k=Math.min(w/(x1-x0),h/(y1-y0));c.save();c.scale(k,k);c.translate(-(x0+x1)/2,-(y0+y1)/2);rawLogo(c,name,color);c.restore()}
const logoTexture=(name,color)=>paint((c,S)=>{c.clearRect(0,0,S,S);c.translate(S/2,S/2);fitLogo(c,name,color,S*.94,S*.94)},256);
// Logotipo pegado sobre una pieza (gorros, plumas, pantalones, zapatillas). flip = -1 lo pone en espejo.
const decal=(parent,name,color,position,size,rotation=[],flip=1)=>{add(parent,new THREE.PlaneGeometry(size,size),new THREE.MeshBasicMaterial({map:logoTexture(name,color),transparent:true,alphaTest:.05,side:THREE.DoubleSide}),position,[flip,1,1],rotation).castShadow=false};
// Tablas de la falda: líneas verticales algo más oscuras.
const pleats=color=>paint((c,S)=>{c.fillStyle=color;c.fillRect(0,0,S,S);c.fillStyle=shade(color,.8);for(let i=0;i<14;i++)c.fillRect(i*S/14,0,S/80,S)},128);
const heart=()=>{const shape=new THREE.Shape();shape.moveTo(0,-.11);shape.bezierCurveTo(-.2,.02,-.1,.16,0,.06);shape.bezierCurveTo(.1,.16,.2,.02,0,-.11);return new THREE.ShapeGeometry(shape,10)};
const dotted=()=>paint((c,S)=>{c.fillStyle='#e5383b';c.fillRect(0,0,S,S);c.fillStyle=PAPER;for(let i=0;i<8;i++)for(let j=0;j<6;j++){c.beginPath();c.arc((i+(j%2)/2)*S/8+S/16,j*S/6+S/12,S/60,0,7);c.fill()}},128);

// Peinados de mujer: se montan con piezas. skirt = falda de pelo de las sienes a la mandíbula; back = melena por la espalda
// (medio largo); sides = mechones sobre los hombros; fringe = flequillo; y coletas, moños y trenzas.
const FEM_HAIR={calva:{bald:1},liso:{skirt:1,back:.42,sides:.4,fringe:'cortina'},bob:{skirt:1,fringe:'recto'},ondas:{skirt:1,back:.34,curls:1,fringe:'cortina'},pixie:{fringe:'lado',nape:1},
  media:{skirt:1,back:.27,fringe:'lado'},'mono-alto':{bun:1,fringe:'cortina'},'dos-trenzas':{braids:2,fringe:'recto'},coletas:{tails:1,fringe:'recto'},box:{box:1},afro:{afro:1},
  flequillo:{skirt:1,back:.42,sides:.4,fringe:'recto'},'coleta-alta':{pony:1,fringe:'lado'},trenza:{braids:1,nape:1,fringe:'lado'},semi:{skirt:1,back:.42,sides:.4,knot:1,fringe:'cortina'},
  monos:{skirt:1,buns:1,fringe:'recto'},extra:{skirt:1,back:.62,sides:.62,fringe:'cortina'}};
// Esqueleto: body (cadera) → upper (gira por la cintura: torso y brazos) → neck (cuello) → head. Cada brazo dobla por el codo
// (fore) y las zapatillas van aparte de las piernas para que se queden en el suelo cuando la cadera se mueve.
const WAIST=.7,NECK=1.3,SHOULDER=1.16,ELBOW=.3,HIP=.64;
// Construye el personaje de un look ya traducido (Avatar.resolve) y devuelve el grupo y las partes que se animan.
function buildModel(look){
  const model=new THREE.Group(),fem=look.body==='mujer',K=fem?.88:1; // K: la mujer es algo más fina de brazos y piernas
  const has=id=>(look.extras||[]).includes(id),skin=mat(SKIN[look.skin]||SKIN.miel),hairC=HAIR_COLORS[look.hairColor]||HAIR_COLORS.negro,hairM=mat(hairC);
  // Con acabado, la prenda pierde su color: queda clara (y su segundo color, gris) y el brillo lo pone el material.
  const tint=(color,key,k=1)=>look[key]?shade(FINISH_TINT,k):color;
  finish=look.bottomFinish||'';
  const main=tint(CLOTH[look.topColor]||PAPER,'topFinish'),trim=tint(CLOTH[look.trimColor]||INK,'topFinish',.6),pantsC=tint(DENIM[look.bottomColor]||DENIM.lavado,'bottomFinish'),pants=mat(pantsC),pantsDark=mat(shade(pantsC,.78));
  finish='';
  const ink=flat(INK),white=mat(PAPER),gold=new THREE.MeshStandardMaterial({color:GOLD,roughness:.28,metalness:.75});
  const type=look.top,sleeved=!['camiseta','baloncesto'].includes(type),bare=type==='baloncesto',O=.03,brandKey=look.print&&look.print[0]==='@'?look.print.slice(1):'';
  const body=new THREE.Group(),upper=new THREE.Group(),up=new THREE.Group(),neck=new THREE.Group(),head=new THREE.Group();
  model.add(body);upper.position.y=WAIST;up.position.y=-WAIST;upper.add(up);body.add(upper);neck.position.y=NECK;up.add(neck);head.position.y=1.8-NECK;neck.add(head);

  finish=look.bottomFinish||'';
  // Piernas: pantalón ancho que se arruga sobre la zapatilla. En mujer hay además falda (con calcetín) y mallas.
  const lift={plataforma:.08,runner:.04,botas:.03}[look.shoes]||0,boots=look.shoes==='botas',short=look.bottom==='corto',skirt=fem&&look.bottom==='falda',tights=fem&&look.bottom==='mallas',gap=fem?.16:.18,legs=[],feet=[];body.position.y=lift;
  if(skirt){
    add(body,lathe([[0,-.215],[.4,-.215],[.42,-.2],[.36,-.05],[.3,.1],[.285,.15],[.25,.17],[0,.17]]),mat(pantsC,pleats(pantsC)),[0,.62,0],[1.02,1,.84],[],O);
    add(body,ring(.285,.03),pantsDark,[0,.765,0],[1.02,.84,1],[Math.PI/2,0,0]);
    if(look.bottomLogo==='levis')add(body,new THREE.BoxGeometry(.03,.05,.014),flat('#c8102e'),[.2,.69,.268]);
  }else if(fem&&(look.top==='camiseta'||!['camiseta','baloncesto'].includes(look.top))){
    // Con top corto o prenda corta, la cintura se ve: es una pieza que envuelve la tripa (antes era una esfera aplastada que
    // sobresalía como un flotador y la atravesaba) y acaba en una cinturilla más oscura.
    add(body,lathe([[0,.46],[.26,.46],[.3,.52],[.315,.6],[.31,.67],[.3,.72],[.28,.735],[0,.735]]),pants,[0,0,0],[1.04,1,.78],[],O);
    add(body,ring(.3,.02),pantsDark,[0,.712,0],[1.04,.78,1],[Math.PI/2,0,0]);
  }else add(body,sphere(),pants,[0,.64,0],fem?[.325,.15,.26]:[.35,.17,.27],[],O);
  for(const side of [-1,1]){
    finish=look.bottomFinish||'';
    const leg=new THREE.Group();leg.position.set(side*gap,.64,0);body.add(leg);legs.push(leg);
    if(skirt){add(leg,capsule(.092,.3),skin,[0,-.3,0],[],[],O);add(leg,new THREE.CylinderGeometry(.1,.1,.13,20),white,[0,-.47,0],[],[],O)}
    else if(tights)add(leg,capsule(.125,.3),pants,[0,-.28,0],[1,1,.95],[],O);
    else if(short){add(leg,capsule(.1*K,.2),skin,[0,-.4,0],[],[],O);add(leg,capsule(.185*K,fem?.1:.16),pants,[0,fem?-.13:-.17,0],[1,1,.95],[],O);add(leg,new THREE.CylinderGeometry(.108*K,.108*K,.16,20),white,[0,-.46,0],[],[],O)}
    else{add(leg,capsule(.178*K,.22),pants,[0,-.26,0],[1,1,.95],[],O);for(const [y,r] of [[-.39,.176],[-.465,.188]])add(leg,ring(r*K,.05),pants,[0,y,0],[1,1,1],[Math.PI/2,0,0],O)}
    if(look.bottom==='cargo')add(leg,box(5),pantsDark,[side*.17*K,-.24,0],[.05,.1,.11],[],O);
    const bands=look.bottomLogo==='adidas'?[-.05,0,.05]:look.bottomLogo?[]:[-.035,.035];
    if(look.bottom==='chandal')for(const d of bands)add(leg,new THREE.BoxGeometry(.012,short?.3:.5,.03),flat(PAPER),[side*.181*K,short?-.17:-.26,d]);
    if(tights&&look.bottomLogo==='adidas')for(const d of bands)add(leg,new THREE.BoxGeometry(.012,.46,.024),flat(PAPER),[side*.127,-.28,d*.8]);
    if(look.bottomLogo==='levis'){if(!skirt)add(leg,new THREE.BoxGeometry(.014,.05,.028),flat('#c8102e'),[side*.192*K,-.1,-.05])}
    else if(look.bottomLogo&&side===1&&!(tights&&look.bottomLogo==='adidas'))decal(leg,look.bottomLogo,light(pantsC)?INK:PAPER,[0,short?(fem?-.13:-.17):-.2,tights?.128:(short?.184:.178)*K],tights?.1:.12);
    // Con pantalón largo, lo que queda dentro del bajo (lengüeta, caña de las altas y de las botas) no se dibuja: asomaba por la tela.
    const tucked=!skirt&&!tights&&!short;
    const shoe=new THREE.Group();shoe.position.set(side*gap,-lift,.07);shoe.rotation.y=side*.14;if(fem)shoe.scale.setScalar(.92);shoe.userData.home=[side*gap,-lift,.07];body.add(shoe);feet.push(shoe);
    finish=look.shoesFinish||'';
    const shoeC=tint(CLOTH[look.shoesColor]||PAPER,'shoesFinish'),trimC=CLOTH[look.shoesTrim]&&tint(CLOTH[look.shoesTrim],'shoesFinish',.6),upperM=mat(shoeC),sole=mat(boots?'#2e2823':look.shoesSole==='goma'?'#b98a4f':light(shoeC)?'#e6e0d0':PAPER),accent=trimC?mat(trimC):null;
    add(shoe,box(),upperM,[0,.15+lift,.02],[.17,.115,.265],[],O);
    add(shoe,box(),sole,[0,.055+lift/2,.02],[.185,.06+lift/2,.285],[],O);
    add(shoe,box(),sole,[0,.12+lift,.215],[.15,.07,.08]);
    if(!tucked)add(shoe,box(),accent||mat(shade(shoeC,light(shoeC)?.86:1.5)),[0,.27+lift,.06],[.095,.09,.05],[-.45,0,0],O);
    if(look.shoes==='altas'&&!tucked)add(shoe,capsule(.14,.05),look.shoesLogo==='converse'?upperM:accent||upperM,[0,.3,-.07],[1,1,1.05],[],O);
    if(look.shoesLogo){const ankle=look.shoesLogo==='converse'&&!tucked;decal(shoe,look.shoesLogo,CLOTH[look.shoesLogoColor]||trimC||INK,ankle?[side*.153,.31,-.07]:[side*.18,.17+lift,.02],ankle?.14:.26,[0,side*Math.PI/2,0],side)}
    else add(shoe,new THREE.BoxGeometry(.012,trimC?.075:.05,trimC?.21:.16),flat(trimC||(light(shoeC)?INK:PAPER)),[side*.172,.17+lift,.03]);
    // Dos colores: lengüeta, franja y talón en el segundo color. Las botas lo llevan solo en el pespunte de la suela.
    if(accent&&!boots){add(shoe,box(),accent,[0,.175+lift,-.2],[.15,.1,.075],[],O);add(shoe,box(),accent,[0,.222+lift,.15],[.125,.045,.085],[-.25,0,0],O)}
    if(look.shoes==='runner'){add(shoe,box(),sole,[0,.1+lift,-.11],[.193,.09,.17],[],O);add(shoe,box(3),accent||mat(shade(shoeC,.8)),[0,.085+lift,-.13],[.199,.032,.1])}
    if(boots){if(!tucked){add(shoe,capsule(.15,.12),upperM,[0,.34,-.06],[1,1,1.05],[],O);add(shoe,ring(.135,.035),mat(shade(shoeC,light(shoeC)?.7:1.6)),[0,.47,-.06],[1,1.05,1],[Math.PI/2,0,0],O)}add(shoe,box(),accent||sole,[0,.122+lift,.02],[.192,.014,.292])}
  }

  finish=look.topFinish||'';
  // Torso: perfil cuadrado y corto, con la prenda pintada alrededor. En mujer, con cintura: la camiseta es un top corto (crop)
  // que deja ver una franja de tripa, y las prendas de manga larga llegan solo hasta la cintura (cut).
  const crop=fem&&type==='camiseta',cut=fem&&sleeved,tscale=fem?[1.04,1,.78]:[1.06,1,.8];
  const profile=crop?[[0,-.1],[.27,-.1],[.3,-.085],[.305,-.02],[.32,.1],[.335,.2],[.32,.28],[.25,.36],[.12,.4],[0,.4]]
    :cut?[[0,-.2],[.3,-.2],[.345,-.185],[.355,-.13],[.365,-.02],[.37,.12],[.355,.24],[.32,.3],[.24,.36],[.12,.4],[0,.4]]
    :fem?[[0,-.4],[.25,-.4],[.3,-.37],[.31,-.28],[.285,-.12],[.275,-.02],[.295,.1],[.32,.2],[.29,.29],[.2,.36],[.1,.4],[0,.4]]
    :type!=='baloncesto'?[[0,-.4],[.3,-.4],[.36,-.385],[.372,-.33],[.4,-.27],[.412,-.05],[.4,.14],[.36,.27],[.26,.36],[.12,.4],[0,.4]]:[[0,-.4],[.27,-.4],[.33,-.37],[.35,-.2],[.345,.1],[.3,.27],[.2,.36],[.1,.4],[0,.4]];
  if(crop)add(up,lathe([[0,-.4],[.25,-.4],[.29,-.3],[.275,-.15],[.27,-.05],[.28,.04],[0,.04]]),skin,[0,.94,0],tscale,[],O);
  const torso=add(up,lathe(profile),type==='plumas'?mat(main):mat(main,torsoTexture(type,main,trim,look.print,fem?{stretch:crop?3.8:cut?3.1:2.4,k:crop?.72:.9}:{})),[0,.94,0],tscale,[],O);
  if(type==='plumas'){
    for(const y of fem?[.8,.94,1.07,1.2]:[.68,.84,1,1.16])add(up,ring(fem?.335:.37,fem?.058:.062),mat(brandKey&&y>1.1?trim:main),[0,y,0],[1.1,.82,1],[Math.PI/2,0,0],O);
    add(up,new THREE.BoxGeometry(.02,fem?.46:.6,.02),flat(INK),[0,fem?1:.92,fem?.318:.35]);
    if(brandKey)decal(up,brandKey,light(trim)?INK:PAPER,fem?[.17,1.17,.335]:[.2,1.15,.365],fem?.15:.17,[0,.5,0]);
  }
  const arms=[];
  for(const side of [-1,1]){
    const arm=new THREE.Group(),fore=new THREE.Group();arm.position.set(side*(bare?(fem?.335:.385):fem?.355:.41),SHOULDER,0);arm.rotation.z=side*.34;fore.position.y=-ELBOW;fore.rotation.set(-.28,0,side*-.08);arm.add(fore);up.add(arm);
    const sleeveC=type==='universitaria'?trim:main,sleeve=type==='chandal'&&(!brandKey||brandKey==='adidas')?mat(main,sleeveTexture(main,brandKey?trim:PAPER,!!brandKey)):mat(sleeveC);
    const thick=bare?1.1:1;add(arm,limb(.1*K*thick,.09*K*thick,ELBOW),skin,[],[],[],O);add(fore,limb(.09*K*thick,.078*K*thick,.2),skin,[],[],[],O);
    if(sleeved){
      add(arm,capsule(.145*K,.12),sleeve,[0,-.13,0],[],[],O);add(fore,capsule(.138*K,.02),sleeve,[0,-.03,0],[],[],O);
      const cuff=type==='universitaria'?mat(null,stripes([trim,PAPER,trim,PAPER,trim])):mat(shade(sleeveC,.78));
      if(type!=='plumas')add(fore,new THREE.CylinderGeometry(.125*K,.118*K,.085,24),cuff,[0,-.12,0],[],[],O);
      else for(const [part,y] of [[arm,-.1],[arm,-.24],[fore,-.08]])add(part,ring(.135*K,.05),brandKey&&part===arm&&y>-.2?mat(trim):sleeve,[0,y,0],[1,1,1],[Math.PI/2,0,0],O);
    }else if(!bare)add(arm,capsule(crop?.132:.165,crop?.07:.1),mat(main),[0,crop?-.07:-.09,0],[],[],O);
    const hand=new THREE.Group();hand.position.y=-.2;hand.rotation.y=side*-.7;hand.scale.setScalar(K*1.15);fore.add(hand);arms.push({arm,fore,hand,side});
    add(hand,box(3),skin,[0,-.04,0],[.056,.07,.086],[],.045);
    // Los dedos salen en abanico y un poco curvados hacia la palma; el contorno de cada uno dibuja la línea entre dedos.
    for(const [z,length] of [[.064,.05],[.022,.064],[-.021,.06],[-.063,.042]])add(hand,capsule(.0245,length),skin,[side*-.014,-.098-length/2-Math.abs(z)*.25,z*1.08],[],[-z*3.2,0,side*-.25],.3);
    add(hand,capsule(.028,.04),skin,[side*-.02,-.055,.103],[],[-1,0,0],.3);
  }
  if(type==='sudadera'||type==='plumas'){
    // Capucha caída: un rollo alrededor del cuello, con el centro relleno para que por detrás no se vea el hueco.
    if(look.hat!=='capucha'){
      const r=fem?.24:.27,tube=fem?.11:.125,fold=mat(shade(type==='plumas'&&brandKey?trim:main,.85)),z=fem?-.15:-.17;
      add(up,ring(r,tube),fold,[0,1.27,z],[1.2,1,1],[Math.PI/2+.5,0,0],O);add(up,sphere(),fold,[0,1.27,z],[r*1.2,r,tube*.85],[Math.PI/2+.5,0,0]);
    }
    if(type==='sudadera')for(const x of [-.075,.075])add(up,new THREE.CylinderGeometry(.014,.014,fem?.16:.2),white,[x,fem?1.1:1.08,fem?.295:.33]);
  }
  finish='';
  // Collares: un aro inclinado que cae sobre el pecho. onChain da el punto del aro en el ángulo a (π/2 = delante y abajo).
  const chain=fem?{r:.2,z:.04}:{r:.25,z:.1},onChain=a=>[Math.cos(a)*chain.r,1.13+Math.sin(a)*chain.r*1.3*Math.cos(2.05),chain.z+Math.sin(a)*chain.r*1.3*Math.sin(2.05)];
  if(has('cadena'))add(up,ring(chain.r,.022),gold,[0,1.13,chain.z],[1,1.3,1],[2.05,0,0]);
  if(has('colgante')){const [x,y,z]=onChain(Math.PI/2);add(up,ring(chain.r,.011),gold,[0,1.13,chain.z],[1,1.3,1],[2.05,0,0]);add(up,heart(),mat(CLOTH.rojo),[x,y-.01,z+.025],[.5,.5,1]).castShadow=false}
  if(has('perlas'))for(let i=0;i<22;i++)add(up,sphere(.03,12,8),white,onChain(i/22*Math.PI*2));

  // Cabeza y cara: ojos altos con párpado caído, cejas y media sonrisa. La mujer lleva pestañas y la ceja más fina.
  add(head,box(HEAD.n),skin,[],[HEAD.a,HEAD.b,HEAD.c],[],.022);
  for(const side of [-1,1]){
    add(head,sphere(),skin,[side*.635,-.06,-.02],[.07,.12,.1],[],O);
    if(has('aros'))add(head,ring(.05,.013),gold,[side*.66,-.19,-.02],[1,1,1],[0,Math.PI/2,0]);
    if(has('arosg'))add(head,ring(.09,.014),gold,[side*.665,-.25,-.02],[1,1,1],[0,Math.PI/2,0]);
    if(has('diamantes'))add(head,new THREE.OctahedronGeometry(.045),new THREE.MeshStandardMaterial({color:'#dff3ff',roughness:.1,metalness:.55}),[side*.66,-.17,-.02]);
  }
  const eyes=[],lids=[],face=look.face,hidden=has('sol')||has('visor')||has('visor2')||has('corazon');
  if(!hidden)for(const side of [-1,1]){
    const eye=add(head,sphere(fem?.074:.07),ink,onHead(side*.215,-.04,1.004),[1,1.55,.4]);eye.castShadow=false;eye.userData.x=eye.position.x;eye.userData.y=eye.position.y;eyes.push(eye);
    add(eye,sphere(.024),flat(PAPER),[side*-.012,.022,.06],[1,.65,1]).castShadow=false;
    if(fem)for(const [dx,dy,rz] of [[.062,.1,.75],[.09,.062,1.15]])add(head,capsule(.011,.045),ink,onHead(side*(.215+dx),-.04+dy,1.012),[1,1,.6],[0,0,-side*rz]).castShadow=false;
    if(face!=='feliz'){const lid=add(head,sphere(),skin,onHead(side*.215,.055,1.02),[.095,.075,.04],[0,0,side*(face==='serio'?.32:.16)]);lid.castShadow=false;lids.push(lid)}
  }
  for(const side of [-1,1]){
    const brow=add(head,capsule(fem?.015:.02,.12),flat(shade(hairC,.6)),onHead(side*.215,face==='feliz'?.2:.15,1.02),[1,1,.6],[0,0,Math.PI/2+side*(face==='feliz'?-.12:face==='serio'?.38:.24)]);brow.castShadow=false;
    if(fem&&face==='feliz')add(head,new THREE.CircleGeometry(.075,20),flat('#ff7aa8',.38),onHead(side*.37,-.2,1.025),[1,.7,1],[0,side*.55,0]).castShadow=false;
  }
  const mouth=onHead(face==='chulo'?.06:0,-.27,1.012);
  if(face==='serio')add(head,capsule(.016,.13),ink,mouth,[1,1,.6],[0,0,Math.PI/2+.04]).castShadow=false;
  let lips=null;
  if(face!=='serio'){lips=add(head,ring(.09,.017,Math.PI*(face==='chulo'?.62:1)),ink,mouth,[1,1,1],[.38,0,Math.PI+(face==='chulo'?.5:0)]);lips.castShadow=false;lips.userData={y:lips.position.y,rz:lips.rotation.z,frown:face==='chulo'?.6:0}}
  // Boca abierta de grito o de risa: un óvalo de tinta que tapa la boca normal mientras dura (canal «open»).
  const shout=add(head,sphere(.052),ink,[mouth[0],mouth[1]-.012,mouth[2]+.004],[1,1.2,.3]);shout.castShadow=false;shout.visible=false;
  if(has('oro')&&face!=='serio')add(head,new THREE.BoxGeometry(.035,.04,.02),gold,[mouth[0]+.03,mouth[1]-.045,mouth[2]+.004],[],[.38,0,0]);
  if(has('visor')||has('visor2')){
    const frame=flat(INK),[lens,band]=has('visor')?['#ff6548','#ffc93c']:['#ff9dbd','#cdbcff'];add(head,new THREE.BoxGeometry(.6,.03,.035),frame,[0,.035,.6]);add(head,new THREE.BoxGeometry(.58,.14,.02),flat(lens),[0,-.045,.6]);add(head,new THREE.BoxGeometry(.5,.035,.012),flat(band),[0,-.005,.612]);
    add(head,new THREE.BoxGeometry(.07,.05,.03),frame,[0,-.115,.6]);for(const side of [-1,1])add(head,new THREE.BoxGeometry(.035,.05,.5),frame,[side*.31,-.01,.36],[],[0,side*-.3,0]);
  }
  if(has('aviador')||has('redondas')){
    const tall=has('aviador')?1.12:1;
    for(const side of [-1,1]){add(head,new THREE.CircleGeometry(.125,28),flat('#2f3a4a',.72),[side*.2,-.05,.606],[1,tall,1]).castShadow=false;add(head,ring(.125,.012),gold,[side*.2,-.05,.608],[1,tall,1]);add(head,new THREE.BoxGeometry(.016,.016,.46),gold,[side*.35,-.01,.38],[],[0,side*-.28,0])}
    if(has('aviador')){add(head,new THREE.BoxGeometry(.16,.014,.014),gold,[0,.02,.615]);add(head,new THREE.BoxGeometry(.1,.014,.014),gold,[0,-.03,.615])}else add(head,new THREE.BoxGeometry(.1,.014,.014),gold,[0,-.02,.615]);
  }
  if(has('sol')){
    const frame=flat(INK);add(head,new THREE.BoxGeometry(.56,.105,.03),frame,[0,-.03,.595]);
    for(const side of [-1,1]){add(head,new THREE.BoxGeometry(.2,.065,.01),flat('#3d4656'),[side*.15,-.022,.612]);add(head,new THREE.BoxGeometry(.03,.03,.5),frame,[side*.3,-.02,.36],[],[0,side*-.3,0])}
  }
  if(has('corazon')){
    const frame=flat(INK);add(head,new THREE.BoxGeometry(.12,.022,.02),frame,[0,-.01,.612]);
    for(const side of [-1,1]){add(head,heart(),frame,[side*.2,-.032,.604],[1.2,1.2,1]).castShadow=false;add(head,heart(),flat('#e5383b'),[side*.2,-.03,.611]).castShadow=false;add(head,new THREE.BoxGeometry(.03,.03,.5),frame,[side*.33,-.01,.36],[],[0,side*-.3,0])}
  }
  if(has('gafas')&&!hidden){
    const frame=flat(INK);for(const side of [-1,1]){add(head,ring(.125,.018),frame,[side*.215,-.04,.61]);add(head,new THREE.BoxGeometry(.02,.02,.46),frame,[side*.36,-.03,.38],[],[0,side*-.28,0])}
    add(head,new THREE.BoxGeometry(.18,.02,.02),frame,[0,-.02,.62]);
  }
  if(has('gato')&&!hidden){
    const frame=flat(CLOTH.burdeos);for(const side of [-1,1]){add(head,ring(.12,.02),frame,[side*.215,-.04,.61],[1.1,.84,1]);add(head,new THREE.ConeGeometry(.035,.1,4),frame,[side*.345,.045,.6],[1,1,.4],[0,0,-side]);add(head,new THREE.BoxGeometry(.02,.02,.46),frame,[side*.37,-.01,.38],[],[0,side*-.28,0])}
    add(head,new THREE.BoxGeometry(.16,.02,.02),frame,[0,-.01,.62]);
  }
  if(has('panuelo')){
    add(head,shell(HEAD.n,0,Math.PI*2,Math.PI*.58,Math.PI*.3),mat(null,dotted()),[0,-.02,0],[HEAD.a*1.05,HEAD.b*1.08,HEAD.c*1.06]).material.side=THREE.DoubleSide;
    add(head,sphere(),mat('#e5383b'),[0,-.3,-.62],[.1,.08,.07],[],O);
  }

  // Pelo: una capa sobre el cráneo y, encima, los mechones de cada peinado. Con gorro solo asoma lo que cabe.
  // sway = lo que cuelga (melena, coletas, trenzas): al animar se balancea con retardo respecto a la cabeza.
  const hat=look.hat,hair=look.hair,hooded=hat==='capucha',covered=!!hat&&!['capucha','corona','aureola','atomo','lazo','diadema','tiara'].includes(hat),F=fem?FEM_HAIR[hair]:null,sway=[];
  const scalp=(front=.34,back=.8,grow=1.045)=>add(head,hairCap(front,back),hairM,[],[HEAD.a*grow,HEAD.b*grow,HEAD.c*grow],[],.02);
  const spike=(x,y,z,rx,rz,size=1)=>add(head,new THREE.ConeGeometry(.1*size,.3*size,8),hairM,[x,y,z],[1,1,.7],[rx,0,rz],.05);
  // Flequillo de cortina: dos mechones pegados a la frente, dentro de la silueta de la cabeza (antes sobresalían como dos
  // cojines por encima y por los lados y dejaban ver el cráneo entre ellos).
  const curtain=low=>{for(const side of [-1,1]){const y=low?.21:.31,[x,,z]=onHead(side*.25,y,1.04);add(head,box(3),hairM,[x,y,z],[.27,.11,.065],[.32,side*.32,side*-.5],O)}};
  const dangle=(x,y,z)=>{const group=new THREE.Group();group.position.set(x,y,z);head.add(group);sway.push(group);return group};
  if(F){if(!F.bald){
    const low=covered||hooded;scalp();
    if(F.fringe==='cortina')curtain(low);
    if(F.fringe==='recto')add(head,box(3),hairM,[0,low?.2:.3,.5],[.5,.15,.11],[.16,0,0],O);
    if(F.fringe==='lado'){add(head,box(3),hairM,[.1,low?.2:.32,.5],[.46,.15,.11],[.14,.12,-.3],O);add(head,box(3),hairM,[-.42,low?.15:.24,.4],[.16,.12,.1],[.1,-.5,.5],O)}
    if(!hooded){
      if(F.skirt)add(head,shell(2.8,Math.PI/2+.8,Math.PI*2-1.6,Math.PI*.27,Math.PI*.5),hairM,[0,.02,-.03],[HEAD.a*1.13,HEAD.b*1.1,HEAD.c*1.1],[],.02).material.side=THREE.DoubleSide;
      if(F.back)add(dangle(0,-.1,-.42),box(3),hairM,[0,.05-F.back,0],[.52,F.back,.2],[.1,0,0],O);
      if(F.sides)for(const side of [-1,1])add(dangle(side*.62,-.2,-.1),capsule(.1,F.sides),hairM,[0,-.1-F.sides/2,0],[.8,1,1.2],[0,0,side*-.06],.06);
      if(F.curls)for(let i=0;i<9;i++){const a=Math.PI*i/8;add(head,sphere(.17),hairM,[Math.cos(a)*.66,-.62-(i%2)*.1,-Math.sin(a)*.5-.05],[],[],.06)}
      if(F.nape)add(head,box(3),hairM,[0,-.3,-.45],[.42,.2,.16],[.2,0,0],O);
      if(F.pony){const tail=dangle(0,covered?.05:.42,-.6);add(tail,sphere(.14),hairM,[],[],[],.06);add(tail,capsule(.11,.5),hairM,[0,-.36,-.03],[1,1,.8],[.07,0,0],.06)}
      if(F.tails)for(const side of [-1,1]){const tail=dangle(side*.62,covered?0:.22,-.12);add(tail,sphere(.12),hairM,[],[],[],.06);add(tail,capsule(.105,.45),hairM,[side*.07,-.36,0],[1,1,.85],[0,0,side*.16],.06)}
      if(F.braids)for(const side of F.braids===2?[-1,1]:[1]){const braid=dangle(side*.5,-.28,F.braids===2?-.15:-.05),fwd=F.braids===2?.03:.05;for(let i=0;i<9;i++)add(braid,sphere(.095-i*.005),hairM,[side*i*.012,-i*.125,i*fwd],[],[],.06);add(braid,sphere(.05),mat(CLOTH.coral),[side*.1,-1.07,9*fwd])}
      if(F.box)for(let i=0;i<13;i++){const a=Math.PI*i/12,length=.75+((i*7)%3)*.1;add(head,capsule(.05,length),hairM,[Math.cos(a)*.63,-.08-length/2,-Math.sin(a)*.57-.03],[],[0,0,Math.cos(a)*.08],.07)}
    }
    if(!low){
      if(F.bun){add(head,box(3),hairM,[0,.5,-.02],[.34,.14,.42],[],O);add(head,sphere(.23),hairM,[0,.78,-.12],[],[],.05)}
      if(F.buns)for(const side of [-1,1])add(head,sphere(.2),hairM,[side*.4,.63,-.08],[],[],.05);
      if(F.knot)add(head,sphere(.15),hairM,[0,.52,-.42],[],[],.06);
      if(F.afro)add(head,sphere(.82,32,24),hairM,[0,.34,-.2],[],[],.025);
    }
  }}else if(hair!=='calvo'){
    if(['rapado','degradado','mono','cresta'].includes(hair))add(head,hairCap(.36,.8,.06),mat('#'+new THREE.Color(hairC).lerp(new THREE.Color(SKIN[look.skin]||SKIN.miel),.45).getHexString()),[],[HEAD.a*1.028,HEAD.b*1.028,HEAD.c*1.028],[],.016);
    else scalp();
    if(!hooded){
      if(hair==='mullet')add(head,box(3),hairM,[0,-.36,-.42],[.46,.34,.2],[.25,0,0],O);
      if(hair==='coleta'){const tail=dangle(0,.28,-.62);add(tail,sphere(.13),hairM,[],[],[],.06);add(tail,capsule(.095,.34),hairM,[0,-.27,-.03],[1,1,.8],[.08,0,0],.06)}
      // Melena: una falda de pelo abierta por delante, de las sienes a la mandíbula (o hasta los hombros si es larga).
      if(hair==='melena'||hair==='largo'){
        add(head,shell(2.8,Math.PI/2+.8,Math.PI*2-1.6,Math.PI*.27,Math.PI*.5),hairM,[0,.02,-.03],[HEAD.a*1.13,HEAD.b*1.1,HEAD.c*1.1],[],.02).material.side=THREE.DoubleSide;
        if(hair==='largo'){add(head,box(3),hairM,[0,-.5,-.42],[.52,.5,.2],[.12,0,0],O);for(const side of [-1,1])add(head,capsule(.1,.42),hairM,[side*.62,-.5,-.12],[.8,1,1.2],[0,0,side*-.06],.06)}
      }
      if(hair==='trenzas')for(const side of [-1,1])for(let i=0;i<6;i++)add(head,sphere(.085-i*.006),hairM,[side*(.5+i*.012),-.3-i*.13,-.3+i*.012],[],[],.06);
      if(hair==='rastas')for(let i=0;i<11;i++){const a=Math.PI*i/10,length=.5+((i*7)%3)*.09;add(head,capsule(.055,length),hairM,[Math.cos(a)*.63,-.08-length/2,-Math.sin(a)*.57-.03],[],[0,0,Math.cos(a)*.1],.07)}
    }
    if(hair==='puntas'||hair==='mullet')for(const [x,rz,size] of [[-.34,.5,1],[-.17,.22,1.15],[0,0,1.25],[.18,-.25,1.1],[.35,-.52,.95]])spike(x,covered?.2:.27,.57,Math.PI-.3,rz,size*(covered?.75:1));
    if(['cortina','melena','largo'].includes(hair))curtain(covered||hooded);
    if(!covered&&!hooded){
      if(hair==='puntas'||hair==='mullet')for(const [x,z,rz] of [[-.2,.1,.3],[.05,.2,-.1],[.25,0,-.4],[0,-.2,.1]])spike(x,.66,z,0,rz,1.1);
      if(hair==='degradado')add(head,box(4),hairM,[0,.5,.04],[.44,.19,.47],[-.1,0,0],O);
      if(hair==='tupe'){add(head,box(3),hairM,[0,.52,-.06],[.46,.15,.42],[],O);add(head,box(3),hairM,[0,.62,.3],[.4,.2,.27],[-.4,0,0],O)}
      if(hair==='cresta')for(let i=0;i<7;i++){const z=.45-i*.15,y=HEAD.b*Math.max(0,1-Math.abs(z/HEAD.c)**HEAD.n)**(1/HEAD.n);spike(0,y+.13,z,z*.9,0,1.3)}
      if(hair==='monos')for(const side of [-1,1])add(head,sphere(.21),hairM,[side*.4,.62,-.08],[],[],.05);
      if(hair==='rizos'||hair==='rastas')for(let i=0;i<14;i++){const a=i/14*Math.PI*2,r=i%2?.4:.2;add(head,sphere(.17),hairM,[Math.sin(a)*r,.56-r*.3,Math.cos(a)*r*.95],[],[],.06)}
      if(hair==='afro')add(head,sphere(.8,32,24),hairM,[0,.34,-.2],[],[],.025);
      if(hair==='mono'){add(head,box(3),hairM,[0,.5,-.02],[.3,.14,.4],[],O);add(head,sphere(.2),hairM,[0,.76,-.14],[],[],.05)}
    }
  }
  // Gorros
  finish=look.hatFinish||'';
  if(covered){
    const cap=new THREE.Group(),hatC=tint(CLOTH[look.hatColor]||INK,'hatFinish'),hatTrim=tint(CLOTH[look.hatTrim]||trim,'hatFinish',.6),color=mat(hatC),dark=mat(shade(hatC,.72));head.add(cap);
    if(['plana','atras','ladeada'].includes(hat)){
      cap.rotation.set(-.14,hat==='atras'?Math.PI:hat==='ladeada'?-.7:0,hat==='ladeada'?.1:0);
      add(cap,shell(3.2,0,Math.PI*2,0,Math.PI*.5),color,[0,.14,0],[.69,.6,.66],[],.025);
      add(cap,shell(3.2,Math.PI/2-.62,1.24,.12,Math.PI/2-.12),mat(hatTrim),[0,.14,0],[.7,.608,.67]);
      add(cap,new THREE.CylinderGeometry(.5,.5,.045,36,1,false,-Math.PI/2,Math.PI),dark,[0,.16,.5],[1.02,1,.86],[.06,0,0],.03);
      add(cap,sphere(.05),dark,[0,.745,0]);
      add(cap,new THREE.PlaneGeometry(.3,.3),new THREE.MeshBasicMaterial({map:look.hatBrand?logoTexture(look.hatBrand,light(hatTrim)?INK:PAPER):capLogo(PAPER,INK),transparent:true}),[0,.42,.665],[look.hatBrand?1.15:1,look.hatBrand?1.15:1,1],[-.2,0,0]).castShadow=false;
      add(cap,new THREE.CircleGeometry(.07,20),flat(GOLD),[.24,.188,.75],[],[-Math.PI/2+.06,0,0]).castShadow=false;
    }
    if(hat==='gorro'){cap.rotation.x=-.3;add(cap,shell(3,0,Math.PI*2,0,Math.PI*.5),color,[0,.12,0],[.685,.66,.655],[],.025);add(cap,ring(.63,.085),dark,[0,.16,0],[1.07,1.02,1],[Math.PI/2,0,0],.03);add(cap,sphere(),color,[0,.66,-.2],[.26,.18,.26],[.5,0,0],O);if(look.hatBrand)decal(cap,look.hatBrand,light(shade(hatC,.72))?INK:PAPER,[0,.16,.75],.2)}
    if(hat==='pescador'){cap.rotation.x=-.16;add(cap,shell(3.4,0,Math.PI*2,0,Math.PI*.5),color,[0,.2,0],[.67,.5,.64],[],.025);add(cap,new THREE.CylinderGeometry(.66,.95,.2,40,1,true),color,[0,.2,0]).material.side=THREE.DoubleSide;add(cap,ring(.675,.03),mat(hatTrim),[0,.3,0],[1,.97,1],[Math.PI/2,0,0]);if(look.hatBrand)decal(cap,look.hatBrand,light(hatC)?INK:PAPER,[0,.45,.66],.2,[-.12,0,0])}
    if(hat==='boina'){cap.rotation.set(-.12,0,.16);add(cap,sphere(1,32,20),color,[.05,.52,-.03],[.76,.25,.74],[],.025);add(cap,ring(.66,.045),dark,[0,.37,0],[1.06,1,1],[Math.PI/2,0,0],.03);add(cap,capsule(.022,.05),color,[.05,.79,-.03])}
  }
  if(hat==='aureola')add(head,ring(.36,.045),gold,[0,.86,-.04],[1,1,1],[Math.PI/2-.14,0,0]);
  // Átomo de los Científicos (decisión 0080): tres órbitas doradas y el núcleo, flotando sobre la cabeza.
  if(hat==='atomo'){
    for(const turn of [0,Math.PI/3,-Math.PI/3])add(head,ring(.3,.028),gold,[0,1.08,-.04],[1,.4,1],[0,0,turn]);
    add(head,sphere(.07),mat('#ff5a36'),[0,1.08,-.04]);
  }
  if(hat==='corona'){
    add(head,new THREE.CylinderGeometry(.4,.36,.2,24,1,true),gold,[0,.66,-.03],[],[-.1,0,0]).material.side=THREE.DoubleSide;
    for(let i=0;i<7;i++){const a=i/7*Math.PI*2;add(head,new THREE.ConeGeometry(.085,.2,4),gold,[Math.sin(a)*.4,.84,Math.cos(a)*.4-.05]);add(head,sphere(.035),mat(CLOTH.rojo),[Math.sin(a)*.4,.96,Math.cos(a)*.4-.05])}
  }
  if(hat==='lazo'){
    const bow=new THREE.Group(),color=mat(CLOTH[look.hatColor]||CLOTH.rojo);bow.position.set(.3,.64,.14);bow.rotation.set(-.2,0,-.4);head.add(bow);
    for(const side of [-1,1])add(bow,box(3),color,[side*.17,0,0],[.17,.125,.07],[0,0,side*.2],O);add(bow,box(3),color,[0,0,.02],[.07,.09,.075],[],O);
  }
  if(hat==='diadema')add(head,ring(.7,.04,Math.PI),look.hatColor==='oro'?gold:mat(CLOTH[look.hatColor]||INK),[0,.02,.06],[1,1.02,1],[-.12,0,0],look.hatColor==='oro'?0:.05);
  if(hat==='tiara'){
    const tiara=new THREE.Group();tiara.position.set(0,.56,0);tiara.rotation.x=-.12;head.add(tiara);
    add(tiara,new THREE.CylinderGeometry(.43,.41,.08,24,1,true,-Math.PI*.3,Math.PI*.6),gold).material.side=THREE.DoubleSide;
    for(let i=-2;i<=2;i++){const a=i*.24,h=.2-Math.abs(i)*.05;add(tiara,new THREE.ConeGeometry(.055,h,4),gold,[Math.sin(a)*.42,.04+h/2,Math.cos(a)*.42])}
    add(tiara,sphere(.04),mat(CLOTH.rosa),[0,.27,.42]);
  }
  finish=look.topFinish||'';
  if(hooded){
    add(head,shell(2.8,Math.PI/2+.85,Math.PI*2-1.7,0,Math.PI*.78),mat(shade(main,.92)),[0,.03,-.04],[HEAD.a*1.2,HEAD.b*1.2,HEAD.c*1.16]).material.side=THREE.DoubleSide;
    add(head,ring(.62,.05,Math.PI*1.25),mat(shade(main,.75)),[0,.03,.33],[1.05,1.05,1],[0,0,-Math.PI*.125]);
  }
  finish='';
  if(has('cascos')||has('cascos2')){
    const alt=has('cascos2');add(head,ring(.7,.04,Math.PI),mat(alt?PAPER:INK),[0,0,-.02],[1,1.03,1],[],.06);
    for(const side of [-1,1])add(head,box(3),mat(alt?CLOTH.lila:CLOTH.coral),[side*.7,-.06,-.02],[.08,.2,.17],[],O);
  }
  return {group:model,parts:{body,upper,torso,neck,head,arms,legs,feet,eyes,lids,lips,shout,sway},base:lift,fem};
}

// ---------- Motor: un solo contexto 3D que dibuja cada avatar y lo copia a su lienzo
const SCALE=Math.min(window.devicePixelRatio||1,2),TURN=-.3,reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
// Encuadres: frame = alto que debe caber, width = ancho, target = altura a la que mira la cámara, x = desplazamiento lateral.
// shoes se ve de lado, para que se vea el logotipo (la puntera queda a la izquierda, por eso se desplaza). Todos dejan margen
// para el pelo más alto (afro, moño, corona), los saltos y la sombra, que no deben cortarse con el borde del lienzo.
const VIEWS={full:{ratio:2/3,frame:3.45,width:2.3,target:1.55},bust:{ratio:1,frame:2.2,target:2},legs:{ratio:1,frame:1.5,target:.46},shoes:{ratio:1,frame:1.05,target:.24,x:-.08},torso:{ratio:1,frame:1.75,target:1},stage:{ratio:1,frame:3.5,target:1.58},home:{ratio:1,frame:3.45,width:3.6,target:1.5}};
const TAN=Math.tan(THREE.MathUtils.degToRad(13.5));
function renderAvatarFrame(context,width,height,viewCamera){
  renderer.setViewport(0,0,width,height);renderer.setScissor(0,0,width,height);renderer.clear();renderer.render(scene,viewCamera);
  context.clearRect(0,0,width,height);context.drawImage(renderer.domElement,0,BUF_H-height,width,height,0,0,width,height);
}
function shoot(context,width,height,entry,mode,turn,climbPose){
  const view=VIEWS[mode]||VIEWS.full,aspect=width/height,distance=Math.max(view.frame/2/TAN,(view.width||view.frame)/2/TAN/aspect);
  const x=view.x||0;camera.aspect=aspect;camera.position.set(x,view.target+distance*.03,distance);camera.lookAt(x,view.target,0);camera.updateProjectionMatrix();camera.updateMatrixWorld(true);
  entry.group.rotation.y=turn;scene.add(entry.group);
  if(climbPose||entry.climbing)climbingPose(entry,climbPose,turn);
  floor.visible=!climbPose||(climbPose.mix??1)<.5;
  renderAvatarFrame(context,width,height,camera);
  scene.remove(entry.group);floor.visible=true;
}

function dispose(entry){
  const geometry=new Set(),materials=new Set();
  entry.group.traverse(part=>{
    if(part.geometry)geometry.add(part.geometry);
    if(part.material&&part.material!==lineMat)materials.add(part.material);
  });
  for(const item of geometry)item.dispose();
  for(const item of materials){item.map?.dispose();item.dispose()}
  for(const rig of entry.climbRigs||[])rig.skeleton.dispose();
}
// El cuerpo se proyecta desde los ojos. Los dos antebrazos enmarcan la vista y dejan libre el centro del panorama.
function firstPerson(canvas, look) {
  const context = canvas.getContext('2d');
  if (!context) return null;
  const entry = buildModel(look);
  const { body, neck, arms, legs, feet } = entry.parts;
  const armAnchor = new THREE.Group();
  const eye = new THREE.PerspectiveCamera(75, 1, 0.07, 8);
  const target = new THREE.Vector3();
  eye.position.set(0, 1.62 + entry.base, 0.58);
  neck.visible = false;
  entry.group.add(armAnchor);
  for (const { arm, fore, hand, side } of arms) {
    armAnchor.add(arm);
    arm.scale.setScalar(0.96);
    arm.rotation.set(1.54, 0, side * 0.28, 'ZXY');
    fore.rotation.set(1.02, -side * 0.08, side * 0.20, 'ZXY');
    hand.rotation.set(-0.18, side * 0.36, side * 0.11);
  }
  // Un pie adelantado abre la vista entre la ropa del torso, las perneras y las punteras.
  for (const [index, leg] of legs.entries()) {
    leg.position.z += 0.13;
    leg.rotation.x = -0.16 - index * 0.09;
    feet[index].position.z += 0.20 + index * 0.07;
  }
  let lastPitch;

  return {
    draw({ pitch, width, height }) {
      if (renderer.getContext().isContextLost()) {
        lastPitch = undefined;
        context.clearRect(0, 0, canvas.width, canvas.height);
        return false;
      }
      const scale = Math.min(SCALE, BUF_W / width, BUF_H / height);
      const pixelsWide = Math.max(1, Math.round(width * scale));
      const pixelsHigh = Math.max(1, Math.round(height * scale));
      if (pitch === lastPitch && canvas.width === pixelsWide && canvas.height === pixelsHigh) return true;
      lastPitch = pitch;
      if (canvas.width !== pixelsWide || canvas.height !== pixelsHigh) {
        canvas.width = pixelsWide;
        canvas.height = pixelsHigh;
      }
      eye.aspect = width / height;
      const halfHeight = THREE.MathUtils.clamp(0.90 / Math.sqrt(eye.aspect), 0.63, 1.12);
      eye.position.z = eye.aspect < 0.75 ? 0.63 : 0.58;
      eye.fov = THREE.MathUtils.radToDeg(2 * Math.atan(halfHeight));
      eye.updateProjectionMatrix();
      target.copy(eye.position);
      target.y += Math.sin(pitch);
      target.z += Math.cos(pitch);
      eye.lookAt(target);

      body.visible = pitch < -0.33;
      armAnchor.position.copy(eye.position);
      armAnchor.quaternion.copy(eye.quaternion);
      // Al mirar los pies, los brazos ceden el centro de la imagen sin saltos de postura.
      const feetView = THREE.MathUtils.smoothstep(-pitch, 0.55, 1.25);
      const shoulderX = (0.78 + 0.29 * feetView) * halfHeight * eye.aspect;
      const shoulderY = -(0.70 + 0.36 * feetView) * halfHeight;
      for (const { arm, side } of arms) arm.position.set(-side * shoulderX, shoulderY, -0.72);

      const shadows = renderer.shadowMap.enabled;
      scene.add(entry.group);
      floor.visible = false;
      renderer.shadowMap.enabled = false;
      try {
        renderAvatarFrame(context, pixelsWide, pixelsHigh, eye);
      } finally {
        scene.remove(entry.group);
        floor.visible = true;
        renderer.shadowMap.enabled = shadows;
      }
      return true;
    },
    destroy() {
      dispose(entry);
      context.clearRect(0, 0, canvas.width, canvas.height);
    }
  };
}

const sizeOf=(el,mode)=>{const view=VIEWS[mode]||VIEWS.full,width=Math.min(BUF_W,Math.ceil(el.clientWidth*SCALE/16)*16,Math.floor(BUF_H*view.ratio));return [width,Math.round(width/view.ratio)]};
// Imágenes fijas (marcador, avisos, tienda): se dibujan una vez y se guardan.
const shots=new Map();
function snapshot(look,mode,width,height){
  const id=mode+width+JSON.stringify(look);let canvas=shots.get(id);
  if(!canvas){
    canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
    const entry=buildModel(look);shoot(canvas.getContext('2d'),width,height,entry,mode,mode==='shoes'?-1.05:TURN);dispose(entry);
    if(shots.size>400)shots.delete(shots.keys().next().value);shots.set(id,canvas);
  }
  return canvas;
}
// Avatares animados (portada, perfil, duelo): respiran, parpadean, cambian de postura y hacen gestos.
const live=new Set(),queue=new Set(),asleep=new Set();
// ---------- Animación (decisión 0028). Hay una postura base que respira y se mece sin repetirse, y encima gestos sueltos
// («clips») que entran y salen suaves; cada cierto rato se elige uno al azar. Cada canal persigue a su objetivo con retardo:
// la cabeza y los antebrazos llegan un poco después que el cuerpo, que es lo que evita el aire de robot.
// Canales: px, py, air = cadera (lado, altura, salto); ry, rz = giro y balanceo del cuerpo; s* = cintura; h* = cuello;
// en cada brazo (a = el de la izquierda de la pantalla, b = el de la derecha): S = adelante/atrás, O = abrir, E = doblar el
// codo, I = antebrazo hacia dentro, Y = hombro; fa, fb = punteras; eye, eyeY = mirada (lado, altura); fall, gx, gy = el personaje entero se
// tumba en el plano de la pantalla y se desplaza (desmayo). Sin suavizar: lid = párpados, wide = ojos como platos,
// frown = boca hacia abajo, open = boca abierta.
// Para los golpes con gracia (decisión 0113): la, lb = cada pierna hacia delante (patada, sentarse); oa, ob = pierna hacia
// fuera; sq = aplastarse (positivo) o estirarse (negativo), como un dibujo animado; zm = tamaño del personaje entero;
// hd = la cabeza se hunde entre los hombros. Y sin suavizar, los adornos que se pintan encima del lienzo (effects):
// stars = estrellas dando vueltas a la cabeza, tears = lágrimas a chorro, bolts = rayos, rage = marca de enfado,
// dust = nube de polvo (de 0 a 1 según avanza) en el punto dustX, dustY.
const KEYS=['px','py','air','ry','rz','sx','sy','sz','hx','hy','hz','aS','aO','aE','aI','aY','bS','bO','bE','bI','bY','fa','fb','eye','eyeY','fall','gx','gy','la','lb','oa','ob','sq','zm','hd'];
const RATE={px:30,py:26,air:45,fa:40,fb:40,hx:10,hy:10,hz:10,aE:13,aI:13,bE:13,bI:13,eye:22,eyeY:22,fall:16,gx:16,gy:16,la:22,lb:22,oa:22,ob:22,sq:34,zm:14,hd:30};
const ease=x=>x<=0?0:x>=1?1:x*x*(3-2*x),hold=(u,a=.2,b=.8)=>ease(u/a)*ease((1-u)/(1-b));
// Deriva irregular: tres ondas de periodos que no casan, para que el vaivén no se note en bucle.
const drift=(t,seed)=>Math.sin(t*1.13+seed)*.5+Math.sin(t*.71+seed*2.3)*.3+Math.sin(t*1.93+seed*.7)*.2;
const both=values=>{const result={};for(const key in values){result['a'+key]=values[key];result['b'+key]=values[key]}return result};
const scaled=(values,k)=>{const result={};for(const key in values)result[key]=values[key]*k;return result};
// Para los gestos largos, que se escriben en segundos: tramo lineal, tramo suave, arco, ventana (entra y sale), muelle que
// se apaga, rebote contra el suelo y avance de una nube de polvo.
const seg=(x,a,b)=>x<=a?0:x>=b?1:(x-a)/(b-a),glide=(x,a,b)=>ease(seg(x,a,b)),arc=(x,a,b)=>Math.sin(seg(x,a,b)*Math.PI),win=(x,a,b,e=.15)=>glide(x,a,a+e)*(1-glide(x,b-e,b));
const spring=(x,a,f,decay)=>x<a?0:Math.sin((x-a)*f)*Math.exp(-(x-a)*decay),thump=(x,a,f=14,decay=6)=>x<a?0:Math.abs(Math.sin((x-a)*f))*Math.exp(-(x-a)*decay),puff=(x,a,d=.5)=>x>a&&x<a+d?(x-a)/d:0;
// Altura del centro del cuerpo (alrededor de él gira la voltereta) y altura a la que queda el eje del cuerpo tumbado.
const CENTER=1.15,FLOOR=.3;
// Tumbado tras el desmayo: lo que se suma a la postura normal. El giro (ry) depende de hacia dónde mira el avatar.
const KO={fall:Math.PI/2,gx:1.35,gy:.74,sx:-.06,hx:-.2,aS:-.25,aO:1.25,aE:.2,bS:.15,bO:.55,bE:-.75,bI:-.5};
const koTurn=item=>1.2-item.turn;
function basePose(item,t){
  const P=neutralPose(item,t),mood=item.mood,m=reduced?0:1;
  // Nervioso (mientras se responde): se mece de un pie a otro y se muerde las uñas. 'wait' es lo mismo con el resultado
  // a punto de salir: las dos manos en la boca, los ojos como platos y pendiente de la tarjeta.
  if(mood==='nervous'||mood==='wait'){
    const wait=mood==='wait'?1:0,w=t*(wait?3.6:2.2)+item.seed,side=Math.sin(w)*m,jit=Math.sin(t*23)*m,tap=Math.sin(t*.5+item.seed)>.2?Math.max(0,Math.sin(t*10))*m:0;
    P.px+=side*.08;P.rz-=side*.035;P.sz+=side*.05;P.py-=Math.abs(Math.cos(w))*.014*m;
    P.hx+=.1;P.hy=wait?item.turn>0?-.3:.3:Math.sin(t*.8+item.seed)*.3*m;P.hz+=side*.05;P.sx+=.05;
    P.bS-=1.32;P.bE-=1.72-jit*.05;P.bI-=.6;P.bO-=.2;
    if(wait){P.aS-=1.32;P.aE-=1.72+jit*.05;P.aI-=.6;P.aO-=.2}else{P.aS-=.3;P.aE-=1.2;P.aI-=1.1;P.fb=tap*.4}
    P.wide=wait?1:.3;P.eye=wait?0:Math.sin(t*1.7+item.seed)*.9*m;P.frown=1;
  }
  if(mood==='meh')P.frown=1;
  if(mood==='ko'){for(const key in KO)P[key]+=KO[key];P.ry+=koTurn(item);P.lid=1;P.frown=1}
  return P;
}
function neutralPose(item,t){
  const s=item.seed,m=reduced?0:1,sad=item.mood==='sad'?1:0,lean=['nervous','wait','ko'].includes(item.mood)?0:item.lean,br=Math.sin(t*(sad?1.2:1.7)+s)*m,d=(speed,offset,size)=>drift(t*speed,s+offset)*size*m;
  return {fall:0,gx:0,gy:0,wide:0,frown:sad,br,px:lean*.035+d(.5,0,.008),py:0,air:0,ry:d(.3,2,.03),rz:-lean*.02,sx:.02+sad*.1+d(.33,9,.014),sy:d(.27,4,.03),sz:lean*.045+d(.4,5,.012),
    hx:sad*.3+d(.45,3,.04),hy:d(.36,1,sad?.05:.15),hz:-lean*.05-.02+d(.3,7,.03),
    aS:.02+d(.6,11,.05),aO:.34-sad*.1+br*.012,aE:-.28+sad*.1+br*.02,aI:-.08,aY:br*.006-sad*.02,
    bS:.02+d(.55,12,.05),bO:.34-sad*.1+br*.012,bE:-.28+sad*.1-br*.015,bI:-.08,bY:br*.006-sad*.02,
    fa:0,fb:0,eye:d(.8,13,.5),eyeY:0,lid:sad*.3,la:0,lb:0,oa:0,ob:0,sq:0,zm:0,hd:0,open:0,stars:0,tears:0,bolts:0,rage:0,dust:0,dustX:0,dustY:0};
}
// Gestos. d = duración en segundos; f(u, t, item) = lo que suma a la postura base (u va de 0 a 1).
const CLIPS={
  // Para cuando está tranquilo
  mirar:{d:3.6,f:u=>{const k=hold(u,.15,.85),side=Math.sin(u*Math.PI*2);return {hy:side*.55*k,sy:side*.14*k,eye:side*k,hx:-.05*k}}},
  peso:{d:1.3,start:item=>{item.lean=-item.lean},f:u=>({py:-.016*Math.sin(u*Math.PI)})},
  estirar:{d:3.4,f:u=>{const k=hold(u,.3,.72);return {...both({O:2.3*k,E:.25*k,I:.25*k,Y:.04*k}),sx:-.13*k,hx:-.2*k,py:.03*k,lid:.8*k}}},
  rascar:{d:2.8,f:(u,t)=>{const k=hold(u,.22,.78);return {aO:1.75*k,aI:(1.45+Math.sin(t*15)*.13)*k,aE:.2*k,hz:.15*k,hx:.06*k,sz:.05*k}}},
  jarras:{d:4.4,f:(u,t,item)=>{const k=hold(u,.14,.88);return {...both({O:.6*k,I:(item.entry.fem?-1.95:-1.75)*k,S:.3*k,E:.1*k}),sx:-.05*k,hx:-.04*k}}},
  botar:{d:1.5,f:u=>{const h=Math.abs(Math.sin(u*Math.PI*2)),k=hold(u,.1,.9);return {air:h*.07*k,py:-.03*(1-h)*k,...both({O:.12*h*k,E:-.2*h*k})}}},
  pie:{d:2.6,f:(u,t)=>{const k=hold(u,.15,.85);return {fb:Math.max(0,Math.sin(t*11))*.4*k,hx:.12*k,hy:.18*k,...both({S:.25*k,O:-.1*k,I:-.5*k})}}},
  hombros:{d:1.9,f:u=>{const k=hold(u,.3,.7);return {...both({Y:.07*k,O:.28*k,E:-.8*k,I:.35*k}),hz:.14*k,sx:-.03*k}}},
  bailar:{d:4,f:(u,t)=>{const k=hold(u,.12,.88),w=t*5.2,s=Math.sin(w);return {px:s*.05*k,rz:-s*.04*k,ry:Math.sin(w*.5)*.25*k,py:-Math.abs(s)*.03*k,sz:s*.08*k,hz:Math.sin(w+.6)*.1*k,hx:.05*k,aE:(-1.1+s*.35)*k,bE:(-1.1-s*.35)*k,aO:.25*k,bO:.25*k,aS:s*.3*k,bS:-s*.3*k}}},
  cuello:{d:3.2,f:u=>{const k=hold(u,.15,.85),a=u*Math.PI*2;return {hz:Math.sin(a)*.26*k,hx:(.08-Math.cos(a)*.16)*k,...both({Y:.02*k}),lid:k}}},
  pensar:{d:4,f:u=>{const k=hold(u,.18,.82);return {bS:-1.25*k,bE:-1.75*k,bI:-.55*k,bO:-.15*k,aS:-.5*k,aE:-.9*k,aI:-.9*k,hz:-.1*k,hx:-.06*k,hy:-.2*k,eye:-.8*k,sz:-.03*k}}},
  // Saludos
  saludo:{d:2.4,f:(u,t)=>{const k=hold(u,.18,.8);return {bO:2.05*k,bI:(.2+Math.sin(t*11)*.4)*k,bE:.2*k,hz:.1*k,sz:-.05*k,aO:.06*k}}},
  saludo2:{d:2.2,f:(u,t)=>{const k=hold(u,.2,.8);return {bO:.9*k,bI:(1.85+Math.sin(t*12)*.3)*k,bE:.15*k,bS:-.2*k,hz:-.08*k,hy:.1*k}}},
  // Celebrar
  salto:{d:1.5,f:u=>{const crouch=u<.22?Math.sin(u/.22*Math.PI/2):u<.3?1-(u-.22)/.08:u>.82?Math.sin((1-u)/.18*Math.PI)*.6:0,fly=u>.26&&u<.82?Math.sin((u-.26)/.56*Math.PI):0,arms=ease((u-.18)/.14)*ease((1-u)/.2);return {py:-.08*crouch,air:.3*fly,...both({O:2.3*arms,E:.2*arms}),hx:-.15*fly}}},
  puno:{d:1.9,f:u=>{const k=hold(u,.15,.85),p=Math.max(0,Math.sin(u*Math.PI*5));return {bO:(1.7+p*.6)*k,bI:(1-p*.8)*k,bE:.15*k,air:p*.05*k,aO:.1*k,aE:-.9*k,hx:-.1*k,sz:-.06*k}}},
  giro:{d:1.5,end:item=>{item.pose.ry-=Math.PI*2},f:u=>{const k=hold(u,.2,.8);return {ry:ease(u)*Math.PI*2,air:Math.sin(u*Math.PI)*.12,...both({O:k,E:.2*k})}}},
  // Lamentarse
  suspiro:{d:2.8,f:u=>{const k=Math.sin(u*Math.PI)**2*(u<.5?1:-.4);return {...both({Y:.05*k}),sx:-.06*k,hx:-.1*k}}},
  negar:{d:2.2,f:u=>{const k=hold(u,.15,.85);return {hy:Math.sin(u*Math.PI*5)*.3*k,hx:.05*k,lid:.4*k}}},
  // Le tocan con el ratón o el dedo: «¡Ay!». Respinga con los ojos apretados y se frota la cabeza, o se encoge con las dos
  // manos en la cabeza.
  ay:{d:1.25,f:(u,t)=>{const k=ease(u/.05)*(1-ease((u-.6)/.4)),jolt=Math.sin(u*Math.PI*10)*(1-u)*ease(u/.04);return {air:Math.sin(Math.min(1,u/.28)*Math.PI)*.07,py:-.035*k,sx:-.12*k,hx:-.24*k+jolt*.05,hz:.2*k,sz:.07*k,px:jolt*.035,aO:1.75*k,aI:(1.45+Math.sin(t*17)*.14)*k,aE:.2*k,bO:.55*k,bE:-.7*k,bI:.3*k,eye:0,lid:u<.62?1:0,frown:1}}},
  ay2:{d:1.15,f:(u,t)=>{const k=ease(u/.05)*(1-ease((u-.55)/.45)),jolt=Math.sin(u*Math.PI*12)*(1-u)*ease(u/.04);return {...both({O:1.8*k,I:1.5*k,E:.2*k,Y:.06*k}),air:Math.sin(Math.min(1,u/.25)*Math.PI)*.05,py:-.06*k,sx:.1*k,hx:.12*k+jolt*.05,px:jolt*.04,rz:-jolt*.03,lid:u<.55?1:0,frown:1}}},
  // ---- Golpes con gracia (decisión 0113): quince reacciones más al toque, cada una con su sonido (Sound.gag). Las
  // largas se escriben en segundos (s). wide = necesita sitio a los lados (se tumba); lock = segundos durante los que
  // no se le puede volver a tocar; dodge = lo esquiva, así que no hay estallido de golpe.
  // Voltereta: el golpe lo lanza por los aires dando una vuelta y cuarto hacia atrás, encogido; cae de espaldas, rebota,
  // ve las estrellas, se incorpora frotándose la cabeza, se pone en pie haciendo palanca y vuelve a su sitio a saltitos.
  voltereta:{d:5.8,wide:1,lock:5.2,end:item=>{item.pose.fall-=Math.PI*2},f:(u,t,item)=>{
    const s=u*5.8,fly=seg(s,.18,1.2),up=glide(s,3.9,4.9),back=glide(s,4.9,5.6),turn=fly<1?Math.PI*2.5*(.45*fly+.55*ease(fly)):Math.PI*2+Math.PI/2*(1-up);
    const jump=1.05*4*fly*(1-fly)-(CENTER-FLOOR)*fly*fly,tuck=win(s,.22,1.12,.2),down=glide(s,1.12,1.28)*(1-glide(s,2.9,3.4)),sit=glide(s,3,3.6)*(1-up),rub=win(s,3.3,4.6,.25);
    return {fall:turn,gx:fly<1?CENTER*Math.sin(turn):CENTER*(1-back),gy:fly<1?CENTER*(1-Math.cos(turn))+jump:FLOOR*(1-up)+thump(s,1.2)*.14,
      air:back<1?Math.abs(Math.sin(back*Math.PI*3))*.07:0,ry:koTurn(item)*glide(s,.2,1.1)*(1-glide(s,4,4.9)),sq:s>1.2?.16*Math.exp(-(s-1.2)*9):0,
      px:spring(s,0,40,9)*.05+spring(s,4.9,9,2.6)*.05,la:.9*tuck,lb:.7*tuck,sx:.35*tuck+1.2*sit,hx:.35*tuck+KO.hx*down+.15*sit,hy:-.85*sit,hz:Math.sin(t*6)*.12*win(s,3.5,4.9,.3),
      aS:-tuck,aE:-1.5*tuck+.2*down,aO:1.25*down+1.75*rub,aI:(1.45+Math.sin(t*15)*.13)*rub,bS:-tuck+.15*down,bE:-1.5*tuck-.75*down,bO:.55*down,bI:-.5*down,
      fb:Math.max(0,Math.sin(s*20))*.5*win(s,1.9,2.6),wide:s<1.2?1:0,open:s<1.25?1:0,lid:s>1.2&&s<3.2?1:s>=3.2&&s<4.9?.5:0,frown:s<5.3?1:0,stars:win(s,1.3,4.6,.3),dust:puff(s,1.2)}}},
  // Culetazo: se le van los pies hacia delante y cae sentado, con rebote; se queda un momento dolorido y se levanta.
  culetazo:{d:3.6,lock:3,f:u=>{
    const s=u*3.6,up=glide(s,2.5,3.2),sit=glide(s,.1,.4)*(1-up),land=.5;
    return {la:(1.45+arc(s,.1,.55)*.25)*sit,lb:(1.45-arc(s,.1,.55)*.1)*sit,py:-.5*glide(s,.3,.5)*(1-up),air:arc(s,.06,.5)*.2+thump(s,land,13,7)*.07,sq:s>land?.2*Math.exp(-(s-land)*10):0,
      sx:-.28*sit+.4*arc(s,2.5,3.3),hx:.2*sit,hz:.16*win(s,1.3,2.4),px:spring(s,3.2,10,4)*.04,...both({O:1.5*arc(s,.05,.6)+.3*sit,S:.55*sit*glide(s,.5,.8),E:.25*sit}),
      wide:s<1.1?1:0,open:s<.75?1:0,lid:s>1.3&&s<2.4?1:0,frown:s<3.3?1:0,dust:puff(s,land)}}},
  // A la pata coja: se agarra el dolor en un pie y da una vuelta entera a saltitos, braceando para no caerse.
  cojo:{d:2.8,end:item=>{item.pose.ry-=Math.PI*2},f:(u,t)=>{
    const s=u*2.8,k=win(s,.05,2.6,.2),hop=Math.abs(Math.sin(s*Math.PI*2.6)),w=Math.sin(t*14);
    return {air:hop*.12*k,py:-.035*(1-hop)*k,lb:1.05*k,ob:.12*k,ry:glide(s,.25,2.45)*Math.PI*2,aO:(1.15+w*.45)*k,bO:(1.15-w*.45)*k,...both({E:.15*k}),hz:w*.08*k,sz:-.08*k,rz:.05*k,
      open:hop>.55?k:0,lid:hop<.35?k:0,wide:.5*k,frown:1}}},
  // Trompo: el toque lo pone a girar como una peonza, tres vueltas que se van frenando, y se queda mareado.
  trompo:{d:3.4,end:item=>{item.pose.ry-=Math.PI*6},f:(u,t)=>{
    const s=u*3.4,fast=win(s,.04,1.7,.2),dizzy=win(s,1.6,3.25,.3),a=t*7;
    return {ry:(1-(1-seg(s,.04,1.8))**3)*Math.PI*6,...both({O:1.3*fast+.4*dizzy,E:.2*fast}),air:.04*fast,sq:-.06*fast,hz:Math.sin(a)*.24*dizzy,hx:Math.cos(a)*.12*dizzy,
      px:Math.sin(a*.8)*.08*dizzy,rz:-Math.sin(a*.8)*.06*dizzy,sz:Math.sin(a*.8+1)*.07*dizzy,eye:Math.sin(t*9)*1.5*dizzy,eyeY:Math.cos(t*9)*1.2*dizzy,
      stars:dizzy,wide:fast,open:fast>.5?1:0,lid:.35*dizzy,frown:dizzy>.3?1:0}}},
  // Cohete: se encoge del susto, sale disparado hacia arriba hasta perderse de vista y vuelve a caer con un buen aplastón.
  cohete:{d:3.5,lock:3,f:u=>{
    const s=u*3.5,charge=win(s,.05,.5,.12),drop=seg(s,1.75,2.05),high=(1-(1-seg(s,.45,.8))**2)*(1-drop*drop),land=2.05;
    return {air:5*high,py:-.06*charge,sq:.3*charge-.25*(arc(s,.45,.85)+arc(s,1.7,land))+(s>land?.32*Math.exp(-(s-land)*5.5)*Math.cos((s-land)*15):0),px:spring(s,2.5,9,3)*.04,
      ...both({O:.5*charge+2.3*win(s,.45,1.9,.12)+.6*win(s,land,2.7,.1),E:-.6*charge}),wide:s<.5||(s>1.7&&s<land)?1:0,open:s>.3&&s<land?1:0,lid:s>land&&s<2.5?1:0,frown:s>.2&&s<3?1:0,dust:puff(s,land)}}},
  // Gelatina: tiembla entero como un flan, aplastándose y estirándose cada vez menos.
  gelatina:{d:2.2,f:u=>{
    const s=u*2.2,k=Math.exp(-s*2.1),w=Math.sin(s*17)*k*ease(s/.05);
    return {sq:.3*w,...both({O:(.45+w*.5)*k,E:-.2*k}),hz:w*.12,sz:w*.05,wide:s<1.2?.8:0,open:s<.9?.7:0,frown:s<1.4?1:0}}},
  // Tortuga: esconde la cabeza entre los hombros, asoma los ojos a un lado y a otro y la saca de golpe, con muelle.
  tortuga:{d:2.8,f:u=>{
    const s=u*2.8,hide=glide(s,.03,.14)*(1-seg(s,1.7,1.76)),pop=s>1.76?Math.exp(-(s-1.76)*4.5)*Math.cos((s-1.76)*19):0,peek=win(s,.55,1.6,.12);
    return {hd:.3*hide-.11*pop,...both({Y:.09*hide,E:-.9*hide,O:.12*hide,I:-.3*hide}),py:-.04*hide,eye:Math.sign(Math.sin(s*5.5))*1.3*peek,hz:pop*.16,
      wide:peek+(s>1.7&&s<2.1?1:0),lid:s<.5?1:0,frown:s<1.7?1:0,open:s>1.72&&s<2?.8:0}}},
  // Berrinche: patalea de rabia con los puños apretados, se da la vuelta con los brazos cruzados y mira de reojo.
  berrinche:{d:3.7,lock:3.2,f:u=>{
    const s=u*3.7,A=win(s,.1,1.75,.15),st=Math.sin(s*11),B=win(s,1.85,3.25,.2);
    return {la:Math.max(0,st)*.85*A,lb:Math.max(0,-st)*.85*A,py:-Math.abs(st)*.03*A,air:(1-Math.abs(st))*.05*A,px:st*.05*A,rz:-st*.04*A,aS:st*.45*A-.55*B,bS:-st*.45*A-.55*B,...both({E:-1.2*A-1.5*B,I:-1.05*B,O:.1*A}),
      hy:Math.sin(s*17)*.22*A+1.3*win(s,2.45,2.95,.14),sy:.45*win(s,2.45,2.95,.14),hx:.08*A-.16*B,sx:.06*A-.05*B,ry:Math.PI*(glide(s,1.75,2.05)-glide(s,3.15,3.5)),rage:A,lid:.35*A,frown:1,open:A>.5&&st>.6?1:0}}},
  // Llorera: hace pucheros, se frota los ojos con los puños y llora a chorros; al final se sorbe los mocos y se seca.
  llorera:{d:3.9,lock:3.2,f:(u,t)=>{
    const s=u*3.9,C=win(s,.25,3.1,.22),sob=Math.abs(Math.sin(s*3.5)),wipe=win(s,3.05,3.8,.2),b=Math.max(C,wipe);
    return {aS:-1.32*C,aE:-1.72*C,aI:-.6*C,aO:-.2*C,bS:-1.32*b,bE:-1.72*b,bI:(-.6+Math.sin(t*9)*.25*wipe)*b,bO:-.2*b,...both({Y:.06*sob*C}),py:-.025*sob*C,hx:.14*C-.1*sob*C,sx:.07*C,
      px:s<.3?Math.sin(t*42)*.012:0,tears:C,lid:C>.3?1:.4*wipe,wide:s<.3?1:0,frown:s<3.7?1:0,open:C>.5&&sob>.55?1:0}}},
  // Karate: se revuelve. Guardia de lado, dos puñetazos, una patada y un saludo final muy serio.
  karate:{d:2.9,f:u=>{
    const s=u*2.9,K=win(s,.06,2.15,.14),p1=arc(s,.6,.86),p2=arc(s,.95,1.21),kick=arc(s,1.38,1.85),bow=arc(s,2.15,2.9);
    return {ry:.5*K,py:-.08*K,air:arc(s,.04,.3)*.1,aS:-K-.55*p2,aE:-1.6*K+1.5*p2,bS:-.85*K-.7*p1,bE:-1.7*K+1.6*p1,...both({O:.15*K}),sy:(.35*p2-.35*p1)*K,
      la:1.45*kick,sx:-.28*kick+.6*bow,hx:.25*bow,open:p1>.5||p2>.5||kick>.4?1:0,frown:K>.3?1:0,lid:bow>.3?1:0}}},
  // Tronco: se queda tieso del susto y se cae de lado como un árbol talado. Tumbado abre un ojo a ver si ya pasó, y se
  // vuelve a levantar tal cual, rígido, cimbreando como un tope de puerta.
  tronco:{d:5,wide:1,lock:4.4,f:u=>{
    const s=u*5,lie=seg(s,.6,1.35)**2.4-glide(s,3.4,4.3),stiff=win(s,.05,4.5,.1),peek=s>2.2&&s<2.9;
    return {fall:Math.PI/2*lie+spring(s,4.3,13,3)*.16,gx:.8*glide(s,.6,1.35)*(1-glide(s,4.3,4.9)),gy:.36*lie*lie+(s<3.4?thump(s,1.35)*.1:0),...both({O:-.3*stiff,E:.26*stiff}),
      eye:s<.55?Math.sign(Math.sin(s*13))*1.2:peek?Math.sin(s*9)*1.2:0,wide:s<.6?1:peek?.6:0,lid:(s>1.35&&s<=2.2)||(s>=2.9&&s<3.4)?1:0,dust:puff(s,1.35),dustX:s>1.3&&s<2?-.4:0}}},
  // Desinflar: se le escapa el aire y se queda pequeñito, protesta dando saltos y se vuelve a hinchar en tres bombeos.
  desinflar:{d:4.3,lock:3.7,f:(u,t)=>{
    const s=u*4.3,pump=(glide(s,2.45,2.55)+glide(s,2.8,2.9)+glide(s,3.15,3.25))/3,tiny=win(s,1.15,2.4,.12),leak=win(s,.15,1.1,.1);
    return {zm:-.62*glide(s,.15,1.1)*(1-pump)+.13*arc(s,3.2,3.7),sq:.1*leak-.1*(arc(s,2.45,2.7)+arc(s,2.8,3.05)+arc(s,3.15,3.4)),rz:Math.sin(t*31)*.07*leak,px:Math.sin(t*23)*.05*leak,
      air:Math.abs(Math.sin(s*11))*.12*tiny,...both({O:2*tiny+.5*leak,I:Math.sin(t*20)*.3*tiny,E:.2*tiny}),hx:-.3*tiny,wide:leak,open:leak>.4||tiny>.5?1:0,frown:s<3.3?1:0}}},
  // Calambre: le da la corriente (para algo es Faraday). Se queda en estrella, vibrando entre rayos, y acaba echando humo.
  calambre:{d:2.5,f:(u,t)=>{
    const s=u*2.5,Z=win(s,.03,1.25,.06),after=win(s,1.3,2.3,.2),cough=arc(s,1.6,1.8)+arc(s,1.9,2.1);
    return {...both({O:1.45*Z,E:.25*Z}),oa:.42*Z,ob:.42*Z,air:.07*Z,px:Math.sin(t*71)*.03*Z,sq:Math.sin(t*57)*.05*Z,hz:Math.sin(t*63)*.07*Z,sx:.16*after+.1*cough,hx:.22*after+.12*cough,py:-.04*after,
      wide:Z,open:Z>.4||cough>.5?1:0,bolts:Z,lid:after*.5,frown:after>.3?1:0,dust:puff(s,1.28,.7),dustY:s>1.2?2.75:0}}},
  // Cosquillas: no le duele, le hace gracia. Se retuerce de risa abrazándose la tripa y se seca una lágrima.
  cosquillas:{d:2.9,f:(u,t)=>{
    const s=u*2.9,L=win(s,.05,2.3,.2),w=Math.sin(t*16),ha=Math.abs(Math.sin(s*Math.PI*5)),wipe=arc(s,2.2,2.9);
    return {sz:w*.12*L,rz:-w*.05*L,px:w*.03*L,aS:-.5*L,aE:-1.5*L,aI:-1.1*L,bS:-.5*L-1.32*wipe,bE:-1.5*L-1.72*wipe,bI:-1.1*L-.6*wipe,...both({Y:.05*ha*L}),hx:-.14*L,air:.03*ha*L,
      lid:L>.2?1:.5*wipe,open:L>.4&&ha>.5?1:0}}},
  // Matrix: lo ve venir y lo esquiva doblándose hacia atrás a cámara lenta; luego dice que no con el dedo, muy chulo.
  matrix:{d:3,dodge:1,f:(u,t)=>{
    const s=u*3,bend=win(s,.04,1.5,.22),w=Math.sin(t*6.5),wag=win(s,1.85,2.85,.15);
    return {sx:-.95*bend+spring(s,1.5,16,5)*.12,hx:-.2*bend,py:-.12*bend,aO:(1.2+w*.9)*bend+.6*wag,bO:(1.2-w*.9)*bend+.9*wag,aS:.4*bend+.3*wag,bS:.4*bend-.2*wag,aI:-1.75*wag,
      bI:(1.85+Math.sin(t*12)*.32)*wag,bE:.15*wag,hy:Math.sin(s*11)*.18*wag,hz:-.08*wag,wide:.6*bend,lid:.45*wag}}},
  // Encajar un golpe
  golpe:{d:.9,f:u=>{const k=(1-u)*ease(u/.08);return {px:Math.sin(u*30)*.07*k,sx:-.22*k,hx:-.25*k,...both({O:.5*k,E:-.5*k}),lid:u<.5?1:0}}},
  tambaleo:{d:1.5,f:u=>{const k=(1-u)*ease(u/.08),w=u*9.5;return {px:Math.sin(w)*.1*k,rz:-Math.sin(w)*.1*k,sz:Math.sin(w+1)*.1*k,hz:Math.sin(w+2)*.15*k,...both({O:.5*k}),lid:u<.4?1:0}}},
  // ---- Reacciones al resultado de una pregunta del reto (decisión 0033), de mejor a peor
  // Clavada: giro en el aire y tres botes con los brazos arriba.
  clavada:{d:2.8,end:item=>{item.pose.ry-=Math.PI*2},f:(u,t)=>{const a=Math.min(1,u/.42),hop=u>.42?Math.abs(Math.sin((u-.42)/.58*Math.PI*3)):0,k=hold(u,.08,.9);return {ry:ease(a)*Math.PI*2,air:Math.sin(a*Math.PI)*.22+hop*.15*k,py:-.03*(1-hop)*k*(u>.42?1:0),...both({O:2.35*k,E:.15*k}),aI:Math.sin(t*14)*.25*k,bI:-Math.sin(t*14)*.25*k,hx:-.18*k,wide:.4*k}}},
  // Por poco (1,9× a 5×): «¡uy!», echa el puño hacia abajo y da un pisotón.
  casi:{d:1.9,f:u=>{const k=hold(u,.1,.75),swing=ease((u-.12)/.16);return {bS:(-1.5+1.7*swing)*k,bE:(-1.5+.9*swing)*k,bO:.25*k,bI:-.3*k,fb:u>.22&&u<.34?.9:0,py:-.05*swing*k,sx:.12*swing*k,hx:.12*k,hz:.16*k,lid:.6*k,frown:k}}},
  // Lejos (5× a 10×): se encoge de hombros con las palmas hacia fuera.
  encoger:{d:2.8,f:u=>{const k=hold(u,.16,.78);return {...both({Y:.09*k,O:.5*k,E:-1.05*k,I:.55*k,S:-.1*k}),hz:.22*k,hx:.04*k,sx:-.04*k,frown:k}}},
  // Fallo (10× a 20×): se tapa la cara con la mano y niega despacio.
  facepalm:{d:3.4,f:u=>{const k=hold(u,.13,.86);return {bS:-1.45*k,bE:-1.95*k,bI:-.7*k,bO:-.25*k,hx:.2*k,sx:.07*k,hy:Math.sin(u*Math.PI*6)*.13*k,py:-.03*k,lid:k,frown:k}}},
  // Desastre (20× a 100×): manos a la cabeza, se tambalea y acaba hundido.
  horror:{d:3.4,f:(u,t)=>{const k=hold(u,.07,.86),drop=ease((u-.55)/.2),w=Math.sin(t*9)*(1-drop);return {...both({O:1.8*k,I:1.5*k,E:.2*k}),sx:(-.2+.34*drop)*k,hx:(-.25+.5*drop)*k,px:w*.06*k,rz:-w*.04*k,sz:w*.05*k,py:-.1*drop*k,wide:k*(1-drop),lid:drop*k,frown:k}}},
  // Desmayo (100× o más): se marea, da una vuelta sobre sí mismo y cae redondo. Al acabar se queda tumbado (mood 'ko').
  desmayo:{d:3.4,end:item=>{item.pose.ry-=Math.PI*2},f:(u,t,item)=>{
    const lie=u<.62?0:Math.min(1,((u-.62)/.16)**2),bounce=u>.78?Math.sin((u-.78)/.22*Math.PI*2)*(1-(u-.78)/.22)*.06:0,dizzy=ease(u/.1)*(1-lie),a=t*7,hand=hold(Math.min(1,u/.5),.2,.7);
    return {...scaled(KO,lie),fall:(lie-Math.abs(bounce))*KO.fall,ry:ease((u-.16)/.46)*(Math.PI*2+koTurn(item)),hz:Math.sin(a)*.24*dizzy,hx:(-.12+Math.cos(a)*.12)*dizzy+KO.hx*lie,px:Math.sin(a*.8)*.07*dizzy,rz:-Math.sin(a*.8)*.05*dizzy,
      aO:1.75*hand+KO.aO*lie,aI:1.45*hand,bO:.9*ease((u-.2)/.2)*(1-lie)+KO.bO*lie,air:Math.sin(Math.min(1,Math.max(0,(u-.2)/.4))*Math.PI)*.05,lid:u>.1?1:.5,frown:1}}},
  // Tumbado: de vez en cuando le da un tic en el pie.
  espasmo:{d:1.1,f:u=>{const k=Math.sin(u*Math.PI);return {fb:Math.max(0,Math.sin(u*Math.PI*6))*.6*k,bE:Math.sin(u*Math.PI*6)*.12*k}}},
  // Nervioso: un escalofrío.
  temblor:{d:1.2,f:(u,t)=>{const k=Math.sin(u*Math.PI);return {px:Math.sin(t*38)*.014*k,...both({Y:.05*k}),hx:-.08*k,wide:.5*k}}},
  // ---- Bailes (decisión 0053). Pasos de baile social de dominio común (robot, aspersor, disco, twist, balanceo de
  // brazos, dab, correr en el sitio), programados desde cero sobre este esqueleto: no copian la animación, el ritmo ni el
  // nombre de ningún juego. Los pasos sueltos de baile social no tienen copyright; una coreografía concreta, sí.
  // Robot: posturas fijas que cambian a golpes, con los codos en ángulo recto y la cabeza a tirones.
  robot:{d:4,f:u=>{const k=hold(u,.08,.92),beat=Math.floor(u*16),side=beat%4<2?1:-1,tick=beat%2?1:-1;return {ry:side*.22*k,hy:-side*.3*k,hx:tick*.04*k,aS:(side>0?-.9:.3)*k,bS:(side>0?.3:-.9)*k,...both({E:-1.55*k,O:.3*k}),aI:(side>0?.2:-.2)*k,bI:(side>0?-.2:.2)*k,py:-.02*k,eye:-side*.6*k}}},
  // Aspersor: una mano en la nuca y el otro brazo estirado, que barre a saltitos y vuelve de golpe.
  aspersor:{d:3.6,f:(u,t)=>{const k=hold(u,.1,.9),cycle=(u*3)%1,step=Math.floor(cycle*5)/4,sweep=cycle<.8?step:1-(cycle-.8)/.2;return {aO:1.75*k,aI:1.45*k,aE:.2*k,bS:-.35*k,bO:1.5*k,bE:.05*k,ry:(-.4+sweep*.8)*k,hy:(-.2+sweep*.4)*k,py:-Math.abs(Math.sin(t*12))*.012*k,sx:.04*k}}},
  // Disco: el dedo al cielo en diagonal y luego cruzando hacia la cadera contraria, con la cadera al compás.
  disco:{d:4,f:(u,t)=>{const k=hold(u,.1,.9),s=Math.sin(t*5.4),up=s>0?1:0;return {bO:(.3+2.2*up)*k,bE:.08*k,bI:(up?.1:-.9)*k,bS:(up?-.15:-.55)*k,aO:.4*k,aE:-1.2*k,aI:-.9*k,px:s*.05*k,rz:-s*.035*k,sz:s*.06*k,hz:-s*.08*k,hy:(up?.25:-.15)*k,py:-Math.abs(s)*.025*k}}},
  // Twist: la cadera gira a un lado y los hombros al otro, con las rodillas flexionadas y los brazos doblados.
  twist:{d:3.8,f:(u,t)=>{const k=hold(u,.12,.88),s=Math.sin(t*7.2);return {ry:s*.3*k,sy:-s*.42*k,hy:s*.2*k,py:(-.05-Math.abs(s)*.015)*k,sx:.06*k,...both({E:-1.3*k,O:.35*k}),aS:s*.35*k,bS:-s*.35*k,fa:Math.max(0,s)*.25*k,fb:Math.max(0,-s)*.25*k}}},
  // Balanceo: los dos brazos estirados van juntos a un lado mientras la cadera va al contrario, a buen ritmo.
  balanceo:{d:3.6,f:(u,t)=>{const k=hold(u,.1,.9),w=t*9,s=Math.sin(w),front=Math.cos(w)>0?1:-1;return {aO:(.45+s*.85)*k,bO:(.45-s*.85)*k,aS:front*.45*k,bS:-front*.45*k,...both({E:.05*k,I:.15*k}),px:-s*.07*k,rz:s*.05*k,sz:-s*.06*k,hz:s*.05*k}}},
  // Dab: la cara se esconde en el codo de un brazo mientras el otro se estira hacia arriba y afuera. Es corto y seco.
  dab:{d:1.8,f:u=>{const k=hold(u,.12,.75);return {bS:-1.25*k,bE:-1.85*k,bI:-.75*k,bO:.35*k,aO:2.15*k,aE:.05*k,aS:-.2*k,hx:.32*k,hz:-.25*k,hy:-.3*k,sz:-.08*k,sx:.08*k,lid:.6*k}}},
  // Correr en el sitio: bota sobre los pies alternos con los brazos bombeando.
  correr:{d:3.4,f:(u,t)=>{const k=hold(u,.1,.9),w=t*9.5,s=Math.sin(w);return {py:-Math.abs(s)*.035*k,air:Math.max(0,Math.cos(w*2))*.025*k,fa:Math.max(0,s)*.6*k,fb:Math.max(0,-s)*.6*k,aS:s*.6*k,bS:-s*.6*k,...both({E:-1.35*k,O:.2*k}),sx:.05*k,hx:-.03*k,px:s*.015*k}}}
};
const DANCES=['robot','aspersor','disco','twist','balanceo','dab','correr'];
// Lo que puede salir al tocarlo: el «¡Ay!» de siempre, los golpes cortos y los largos (más probables cuanto más se insiste).
const POKES=['ay','ay2'],GAGS=['cojo','trompo','gelatina','tortuga','karate','calambre','cosquillas','matrix'],BIG=['voltereta','culetazo','cohete','berrinche','llorera','tronco','desinflar'];
const IDLE=['mirar','peso','estirar','rascar','jarras','botar','pie','hombros','bailar','cuello','pensar','mirar','peso','robot','twist','balanceo'];
const POOL={still:[],cheer:['salto','puno','giro','bailar',...DANCES],sad:['suspiro','negar','pie'],meh:['hombros','rascar','negar','suspiro'],nervous:['mirar','temblor','mirar','botar'],wait:[],ko:['espasmo']},FIRST={wave:['saludo','saludo2'],cheer:['salto','puno'],hurt:['golpe','tambaleo']};
const any=list=>list[Math.random()*list.length|0];
function play(item,name,t){const clip=CLIPS[name];if(!clip)return;item.clip=clip;item.clipAt=t;item.lastClip=name;if(clip.start)clip.start(item)}
function nextClip(item,t){let pool=item.quiet?[]:item.repeat?[item.repeat]:POOL[item.mood]||(item.data.emote==='wave'?[...IDLE,'saludo','saludo2']:IDLE);if(attentive(item)&&!item.repeat)pool=pool.filter(name=>name!=='mirar'&&name!=='pensar')||pool;if(!pool.length){item.wait=t+1;return}let name=any(pool);while(pool.length>1&&name===item.lastClip)name=any(pool);play(item,name,t)}
// Cambia el estado de un avatar animado desde fuera (reactions.js): mood = cómo se queda; clip = gesto que hace ahora;
// then = estado al que pasa cuando el gesto termina.
function apply(item,{mood='',clip='',then=null,repeat='',quiet=false}={}){
  const t=(performance.now()-item.born)/1000;item.clip=null;item.mood=mood;item.after=null;item.repeat=CLIPS[repeat]?repeat:'';item.quiet=quiet;
  if(clip&&!reduced){item.after=then;play(item,clip,t)}else{if(then!==null)item.mood=then;item.wait=t+1.2+Math.random()*2}
}
// ---------- Sigue al ratón con la cabeza y la mirada. Se apunta la última posición del puntero; cada avatar calcula hacia
// dónde queda desde su cabeza (item.at, proyectada en el fotograma anterior) como si el espectador estuviera a un palmo
// de la pantalla. La dirección se suaviza despacio (LOOK) y luego pasa por los canales normales, así que los ojos llegan
// antes y la cabeza les sigue con calma. Si el ratón se queda quieto un rato o sale de la ventana, vuelve a lo suyo.
// Durante los gestos grandes (bailes, celebraciones, el «¡Ay!») la cabeza apenas se desvía; los ojos sí siguen.
const pointer={x:0,y:0,at:-1e9},targets=new WeakMap(),LOOK=3.2,ATTEND=4500;
const CALM=new Set(['peso','botar','jarras','rascar','pie','hombros','estirar','temblor']);
const noted=event=>{pointer.x=event.clientX;pointer.y=event.clientY;pointer.at=performance.now()};
window.addEventListener('pointermove',event=>{if(event.pointerType!=='touch')noted(event)},{passive:true});
window.addEventListener('pointerdown',noted,{passive:true});
document.addEventListener('mouseout',event=>{if(!event.relatedTarget)pointer.at=-1e9});
const clamp=(x,a,b)=>Math.min(b,Math.max(a,x)),wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
function aimFor(item){
  const target=targets.get(item.el);
  return target&&performance.now()-target.at<ATTEND?target:pointer;
}
const attentive=item=>!reduced&&performance.now()-aimFor(item).at<ATTEND;
function gaze(item,P,dt){
  const look=item.look||(item.look={w:0,y:0,p:0}),r=item.at&&item.canvas.getBoundingClientRect();
  const aim=aimFor(item);
  let w=0,yaw=0,pitch=0;
  if(r?.width&&!reduced&&performance.now()-aim.at<ATTEND&&!item.dragging&&item.mood!=='ko'&&!item.pose?.fall&&!(P.stars>.2)){
    // Píxeles de la cabeza en pantalla y distancia imaginaria del espectador (más cerca en los avatares pequeños).
    const x=r.left+(item.at.x+1)/2*r.width,y=r.top+(1-item.at.y)/2*r.height,far=item.home?Math.max(150,r.height*.48):Math.max(240,r.height*.9);
    yaw=wrap(Math.atan2(aim.x-x,far)-item.turn-(item.pose?.ry||0));pitch=Math.atan2(aim.y-y,far);
    // De espaldas no se gira a mirar.
    w=Math.abs(yaw)>1.5?0:1;yaw=clamp(yaw,-.9,.9);pitch=clamp(pitch,-.4,.5);
  }
  const k=1-Math.exp(-dt*(item.home?9:LOOK));look.w+=(w-look.w)*(1-Math.exp(-dt*(item.home?8:2.4)));look.y+=(yaw-look.y)*k;look.p+=(pitch-look.p)*k;
  if(look.w<.001)return;
  const home=item.home,head=(item.clip&&!CALM.has(item.lastClip)?(home ? .55 : .25):1)*(item.mood==='wait'?.2:1)*look.w,eyes=look.w;
  const headYaw=home?1.02:.72;
  P.hy+=(look.y*headYaw-P.hy*.6)*head;P.sy+=look.y*(home ? .24 : .16)*head;P.hx+=(look.p*(home ? .85 : .62)-P.hx*.4)*head;P.hz*=1-.4*head;
  // Los ojos apuntan del todo, también lo que la cabeza aún no ha girado.
  P.eye+=(clamp((yaw-look.y*headYaw*head)*2.4+look.y*.4,-2,2)-P.eye)*eyes;P.eyeY+=(clamp(-pitch*2.6,-1.4,1.4)-P.eyeY)*eyes;
}
function animate(item,now){
  const R=item.entry.parts,t=(now-item.born)/1000,dt=Math.min(.1,Math.max(0,(now-item.last)/1000));item.last=now;
  if(!item.dragging){item.turn+=item.spin;item.spin*=.92}
  if(!reduced){
    if(item.clip&&t-item.clipAt>=item.clip.d){if(item.clip.end)item.clip.end(item);item.clip=null;if(item.after!=null){item.mood=item.after;item.after=null}item.wait=t+(item.mood==='cheer'?.5+Math.random()*.9:2.2+Math.random()*4)}
    if(!item.clip&&t>=item.wait)nextClip(item,t);
    // Parpadeo a intervalos irregulares; de vez en cuando, doble.
    if(t>=item.blinkAt){item.blinkFrom=t;item.blinkAt=t+(Math.random()<.18?.3:1.8+Math.random()*4.2)}
  }
  const P=basePose(item,t);
  if(item.clip){const extra=item.clip.f(Math.max(0,(t-item.clipAt)/item.clip.d),t,item);for(const key in extra)P[key]+=extra[key]}
  gaze(item,P,dt);
  const cur=item.pose||(item.pose={...P});
  for(const key of KEYS)cur[key]+=(P[key]-cur[key])*(1-Math.exp(-dt*(RATE[key]||18)));
  R.body.position.set(cur.px,item.entry.base+cur.py+cur.air,0);R.body.rotation.set(0,cur.ry,cur.rz);
  // Caída: gira el personaje entero alrededor de los pies, en el plano de la pantalla (después del giro sobre sí mismo).
  const whole=item.entry.group;whole.rotation.order='ZYX';whole.rotation.z=cur.fall;whole.position.set(cur.gx,cur.gy,0);
  // Aplastarse y estirarse conservando el volumen (lo que pierde de alto lo gana de ancho), y tamaño del personaje entero.
  const size=Math.max(.05,1+cur.zm),girth=size*(1+cur.sq*.5);whole.scale.set(girth,size*(1-cur.sq),girth);
  R.upper.rotation.set(cur.sx,cur.sy,cur.sz);R.torso.scale.y=1+P.br*.012;
  R.neck.position.x=0;R.neck.position.y=NECK+P.br*.007-cur.hd;R.neck.rotation.set(cur.hx,cur.hy,cur.hz);
  R.arms.forEach(({arm,fore,side},i)=>{const p=i?'b':'a';arm.position.y=SHOULDER+P.br*.008+cur[p+'Y'];arm.rotation.set(cur[p+'S'],0,side*cur[p+'O']);fore.rotation.set(cur[p+'E'],0,side*cur[p+'I'])});
  // Los pies se quedan en el suelo: la pierna se inclina y se encoge para seguir a la cadera. En el aire, las punteras caen.
  const tilt=-Math.atan(cur.px/.55),stretch=1+cur.py/.55,toes=Math.min(.5,cur.air*3);
  // Una pierna levantada (la/lb hacia delante, oa/ob hacia fuera) deja de seguir al suelo: gira desde la cadera y la
  // zapatilla va con ella, en la punta. free = cuánto se ha soltado del suelo.
  R.legs.forEach((leg,i)=>{
    const side=i?1:-1,lift=cur[i?'lb':'la'],out=side*cur[i?'ob':'oa'],free=Math.min(1,(Math.abs(lift)+Math.abs(out))*2.5),shoe=R.feet[i],[x,y,z]=shoe.userData.home,tap=cur[i?'fb':'fa'];
    leg.rotation.set(-lift,0,tilt*(1-free)+out);leg.scale.y=stretch+(1-stretch)*free;
    shoe.position.set(x-cur.px*(1-free)+HIP*Math.sin(out),y-cur.py*(1-free)+tap*.05+HIP*(1-Math.cos(out)*Math.cos(lift)),z+HIP*Math.cos(out)*Math.sin(lift));
    shoe.rotation.x=toes-tap-lift;shoe.rotation.z=out;
  });
  const since=t-item.blinkFrom,lid=Math.min(1,Math.max(P.lid,since<.15?Math.sin(since/.15*Math.PI):0));
  const wide=Math.min(1,P.wide)*(1-lid),open=Math.min(1,P.open);
  const eyeTravel=item.home ? .021 : .014;
  R.eyes.forEach(eye=>{eye.scale.y=1.55*(1-.9*lid)*(1+.28*wide);eye.scale.x=1+.2*wide;eye.position.x=eye.userData.x+cur.eye*eyeTravel;eye.position.y=eye.userData.y+cur.eyeY*eyeTravel});R.lids.forEach(part=>{part.visible=lid<.5&&wide<.25});
  if(R.lips){const down=P.frown>.5,{y,rz,frown}=R.lips.userData;R.lips.rotation.z=down?frown:rz;R.lips.position.y=down?y-.075:y;R.lips.visible=open<.3}
  R.shout.visible=open>=.3;if(open>=.3)R.shout.scale.set(.7+.5*open,.5+.8*open,.3);
  item.fx=P;item.fxT=t;
  // La melena, las coletas y las trenzas cuelgan: compensan en parte la inclinación de la cabeza y la siguen con retardo.
  const roll=cur.rz+cur.sz+cur.hz,nod=cur.sx+cur.hx,lag=1-Math.exp(-dt*5);
  if(item.lagRoll===undefined){item.lagRoll=roll;item.lagNod=nod}item.lagRoll+=(roll-item.lagRoll)*lag;item.lagNod+=(nod-item.lagNod)*lag;
  for(const group of R.sway){group.rotation.z=-roll*.7+(item.lagRoll-roll)*1.2;group.rotation.x=-nod*.7+(item.lagNod-nod)*1.2}
}
// La escena da objetivos en coordenadas normalizadas del lienzo. La misma
// cámara que dibuja al avatar calcula el rayo de cada presa.
const DOWN=new THREE.Vector3(0,-1,0);
const THIGH=.28,SHIN=.28,HAND=.08;
const SOLE=new THREE.Vector3(0,.014,.065);
const climbPoses=new WeakMap(),animatedItems=new WeakMap();
function atDepth([x,y],z){
  const point=new THREE.Vector3(x*2-1,1-y*2,0).unproject(camera);
  const ray=point.sub(camera.position);
  return ray.multiplyScalar((z-camera.position.z)/ray.z).add(camera.position);
}
function twoBone(start,target,upper,lower,pole){
  const direction=target.clone().sub(start),length=direction.length();
  if(length<.0001)direction.copy(DOWN);
  else direction.divideScalar(length);
  const distance=Math.max(Math.abs(upper-lower)+.001,Math.min(upper+lower-.001,length));
  const along=(upper*upper-lower*lower+distance*distance)/(2*distance);
  const bend=pole.addScaledVector(direction,-pole.dot(direction));
  if(bend.lengthSq()<.0001){
    if(Math.abs(direction.z)<.9)bend.set(0,0,1).addScaledVector(direction,-direction.z);
    else bend.set(1,0,0).addScaledVector(direction,-direction.x);
  }
  bend.normalize().multiplyScalar(Math.sqrt(Math.max(0,upper*upper-along*along)));
  return {
    joint:start.clone().addScaledVector(direction,along).add(bend),
    end:start.clone().addScaledVector(direction,distance)
  };
}
const alongBone=(start,end)=>new THREE.Quaternion().setFromUnitVectors(DOWN,end.clone().sub(start).normalize());
const palmTarget=(point,shoulder)=>atDepth(point,shoulder.z+.16);
const foreReach=hand=>.2+HAND*hand.scale.y;
const anklePosition=(shoe,base)=>shoe.localToWorld(new THREE.Vector3(0,.158+base,-.035));
const ankleTarget=(point,hip,shoe,ankle)=>atDepth(point,hip.z+.025)
  .sub(shoe.localToWorld(SOLE.clone())).add(ankle);

function gripHand({arm,fore,hand,side},point,mix){
  const shoulder=arm.getWorldPosition(new THREE.Vector3());
  // Cada mano alcanza un plano próximo a la altura de su propio hombro.
  const target=palmTarget(point,shoulder);
  const {joint,end}=twoBone(shoulder,target,ELBOW,foreReach(hand),
    new THREE.Vector3(side*.52,-.33,.56));
  const upper=alongBone(shoulder,joint),lower=alongBone(joint,end);
  const worldToParent=arm.parent.getWorldQuaternion(new THREE.Quaternion()).invert();
  arm.quaternion.slerp(worldToParent.multiply(upper),mix);
  fore.quaternion.slerp(upper.clone().invert().multiply(lower),mix);
}

// El pantalón original se usa para generar una variante de dos huesos. Se
// conservan texturas, pespuntes, materiales y trazos. Las mallas originales
// vuelven a ser visibles al soltar la pared y no se alteran en los otros modos.
function rigLeg(leg){
  const rest=[...leg.children],meshes=[],thigh=new THREE.Bone(),shin=new THREE.Bone();
  shin.position.y=-THIGH;thigh.add(shin);thigh.updateMatrixWorld(true);
  const skeleton=new THREE.Skeleton([thigh,shin]);
  const make=(source,matrix)=>{
    const geometry=source.geometry.clone().applyMatrix4(matrix),positions=geometry.getAttribute('position');
    const indices=new Uint16Array(positions.count*4),weights=new Float32Array(positions.count*4);
    for(let vertex=0;vertex<positions.count;vertex++){
      const t=THREE.MathUtils.clamp((-positions.getY(vertex)-THIGH+.09)/.18,0,1);
      const weight=t*t*(3-2*t),address=vertex*4;
      indices[address+1]=1;
      weights[address]=1-weight;weights[address+1]=weight;
    }
    geometry.setAttribute('skinIndex',new THREE.BufferAttribute(indices,4));
    geometry.setAttribute('skinWeight',new THREE.BufferAttribute(weights,4));
    const mesh=new THREE.SkinnedMesh(geometry,source.material);
    mesh.bindMode=THREE.DetachedBindMode;
    mesh.bind(skeleton,new THREE.Matrix4());
    mesh.castShadow=source.castShadow;
    mesh.frustumCulled=false;
    leg.add(mesh);meshes.push(mesh);
  };
  for(const source of rest){
    source.updateMatrix();
    make(source,source.matrix);
    for(const edge of source.children){
      edge.updateMatrix();
      make(edge,source.matrix.clone().multiply(edge.matrix));
    }
  }
  return {rest,meshes,thigh,shin,skeleton};
}
function showRig(rig,climbing){
  for(const piece of rig.rest)piece.visible=!climbing;
  for(const piece of rig.meshes)piece.visible=climbing;
}
function gripFoot(leg,shoe,rig,base,point,side,mix){
  const hip=leg.getWorldPosition(new THREE.Vector3()),original=shoe.getWorldPosition(new THREE.Vector3());
  const ankle=anklePosition(shoe,base),target=ankleTarget(point,hip,shoe,ankle);
  const {joint,end}=twoBone(hip,target,THIGH,SHIN,new THREE.Vector3(side*.75,-.05,.72));
  const origin=original.addScaledVector(end.clone().sub(ankle),mix);
  shoe.position.copy(shoe.parent.worldToLocal(origin));
  const knee=leg.worldToLocal(joint),foot=leg.worldToLocal(end);
  const upper=alongBone(new THREE.Vector3(),knee),lower=alongBone(knee,foot);
  rig.thigh.quaternion.identity().slerp(upper,mix);
  rig.shin.quaternion.identity().slerp(upper.clone().invert().multiply(lower),mix);
  rig.thigh.updateMatrixWorld(true);
}

// Ajusta la altura de la cadera dentro del alcance común de los cuatro apoyos.
// Ayuda a conservar los contactos cuando el peso pasa de un pie al otro.
function weightShift({arms,legs,feet},base,pose){
  let low=-Infinity,high=Infinity;
  function include(origin,target,reach){
    const {x,y,z}=target.sub(origin);
    const vertical=Math.sqrt(Math.max(0,reach*reach-x*x-z*z));
    low=Math.max(low,y-vertical);high=Math.min(high,y+vertical);
  }
  for(let i=0;i<2;i++){
    if(pose.hands?.[i]){
      const {arm,hand}=arms[i],shoulder=arm.getWorldPosition(new THREE.Vector3());
      include(shoulder,palmTarget(pose.hands[i],shoulder),ELBOW+foreReach(hand)-.019);
    }
    if(pose.feet?.[i]){
      const hip=legs[i].getWorldPosition(new THREE.Vector3());
      include(hip,ankleTarget(pose.feet[i],hip,feet[i],anklePosition(feet[i],base)),THIGH+SHIN-.015);
    }
  }
  const shift=low<=high?THREE.MathUtils.clamp(0,low,high):(low+high)/2;
  return THREE.MathUtils.clamp(shift,-.13,.13);
}

function climbingPose(entry,pose,neutralTurn){
  const {parts,group}=entry;
  if(!pose||pose.mix===0){
    if(entry.climbing){for(const rig of entry.climbRigs)showRig(rig,false);entry.climbing=false}
    return;
  }
  const mix=THREE.MathUtils.clamp(pose.mix??1,0,1);
  const lean=THREE.MathUtils.clamp(pose.lean||0,-1,1),crouch=THREE.MathUtils.clamp(pose.crouch||0,0,1);
  const turn=pose.turn??.65;
  group.rotation.y=neutralTurn+(turn-neutralTurn)*mix;
  group.rotation.z*=1-mix;group.position.multiplyScalar(1-mix);
  const {body,upper,neck,arms,legs,feet}=parts;
  body.position.x=THREE.MathUtils.lerp(body.position.x,lean*.06,mix);
  body.position.y=THREE.MathUtils.lerp(body.position.y,entry.base-.025-crouch*.15,mix);
  body.rotation.y*=1-mix;body.rotation.z=THREE.MathUtils.lerp(body.rotation.z,-lean*.09,mix);
  upper.rotation.x=THREE.MathUtils.lerp(upper.rotation.x,.12+crouch*.16,mix);
  upper.rotation.y*=1-mix;upper.rotation.z*=1-mix;
  neck.rotation.x=THREE.MathUtils.lerp(neck.rotation.x,-.16-crouch*.16,mix);
  neck.rotation.y=THREE.MathUtils.lerp(neck.rotation.y,.21,mix);
  // Despeja la mano que se estira sin tapar el rostro ni cambiar el encuadre.
  neck.position.x=-lean*.19*mix;
  neck.rotation.z=THREE.MathUtils.lerp(neck.rotation.z,lean*.27,mix);
  for(const leg of legs){
    leg.rotation.z*=1-mix;
    leg.scale.y=THREE.MathUtils.lerp(leg.scale.y,1,mix);
  }
  group.updateMatrixWorld(true);
  const shift=weightShift(parts,entry.base,pose)*mix;
  if(Math.abs(shift)>.001){body.position.y+=shift;group.updateMatrixWorld(true)}
  entry.climbRigs??=legs.map(rigLeg);
  entry.climbing=true;
  for(let i=0;i<2;i++){
    const rig=entry.climbRigs[i];
    showRig(rig,Boolean(pose.feet?.[i]));
    if(pose.hands?.[i])gripHand(arms[i],pose.hands[i],mix);
    if(pose.feet?.[i])gripFoot(legs[i],feet[i],rig,entry.base,pose.feet[i],i?1:-1,mix);
  }
}

let running=false,last=0;
function loop(now){
  if(!live.size){running=false;return}
  requestAnimationFrame(loop);if(document.hidden||now-last<(live.size>2?30:14))return;last=now;
  const covered=document.body.classList.contains('modal-open');
  for(const item of live){
    if(!item.el.isConnected){dispose(item.entry);live.delete(item);continue}
    if(!item.el.clientWidth||(covered&&item.home))continue;
    if(now-item.climbFrame<24)continue;
    drawAvatar(item,now);
  }
}
function drawAvatar(item,now){
  const [width,height]=sizeOf(item.el,item.data.mode);
  if(item.canvas.width!==width||item.canvas.height!==height){item.canvas.width=width;item.canvas.height=height}
  let pose=climbPoses.get(item.el);
  const release=item.climbRelease;
  if(!pose&&release){
    const amount=1-Math.max(0,now-release.at)/150;
    if(amount>0)pose={...release.pose,mix:(release.pose.mix??1)*amount};
    else item.climbRelease=null;
  }
  animate(item,now);
  shoot(item.context,width,height,item.entry,item.data.mode,item.turn,pose);
  effects(item,width,height,now);
  locate(item);
}
function climb(el,pose){
  if(!el?.isConnected)return;
  const item=animatedItems.get(el);
  if(!pose){
    const last=climbPoses.get(el);
    climbPoses.delete(el);
    if(last&&item)item.climbRelease={pose:last,at:performance.now()};
    return;
  }
  climbPoses.set(el,pose);
  if(!item||!el.clientWidth||document.hidden)return;
  item.climbRelease=null;
  item.climbFrame=performance.now();
  drawAvatar(item,item.climbFrame);
}
// Dónde queda la cara en el lienzo (de -1 a 1), con la cámara tal como acaba de dibujarlo: de ahí sale la mirada.
const FACE=new THREE.Vector3();
function locate(item){FACE.set(0,-.04,.5);item.entry.parts.head.localToWorld(FACE).project(camera);item.at={x:FACE.x,y:FACE.y}}
// ---------- Adornos de cómic de los golpes con gracia (decisión 0113). Se pintan en 2D encima del avatar ya dibujado, con el
// mismo contorno de tinta: estallido donde se le toca, estrellas del mareo, lágrimas, rayos, marca de enfado y polvo.
const SPOT=new THREE.Vector3(),BLUE='#7fd6ff',RED='#ff4b3a';
function effects(item,width,height,now){
  const P=item.fx,hit=item.hit&&now-item.hit.at<280?item.hit:null;
  if(!P||!(hit||P.stars>.02||P.tears>.02||P.bolts>.02||P.rage>.02||P.dust>0))return;
  const c=item.context,t=item.fxT,at=(x,y)=>{SPOT.set(x,y,0).project(camera);return [(SPOT.x+1)/2*width,(1-SPOT.y)/2*height]};
  const U=at(0,0)[1]-at(0,1)[1],line=Math.max(1.5,U*.024),head=item.entry.parts.head.getWorldPosition(SPOT).clone(),[hx,hy]=at(head.x,head.y);
  const inked=(fill,alpha=1)=>{c.globalAlpha=alpha;c.lineWidth=line;c.lineJoin='round';c.strokeStyle=INK;c.stroke();c.fillStyle=fill;c.fill()};
  const spiky=(x,y,r,n,inner,turn=0)=>{c.beginPath();for(let i=0;i<n*2;i++){const a=turn+i*Math.PI/n,k=i%2?r*inner:r;c.lineTo(x+Math.cos(a)*k,y+Math.sin(a)*k)}c.closePath()};
  c.save();
  if(P.dust>0){
    // Polvo: cinco nubecillas que se abren hacia los lados y se deshacen.
    const p=P.dust,[x,y]=at(P.dustX,P.dustY);
    for(let i=0;i<5;i++){const d=(i-2)/2;c.beginPath();c.arc(x+d*(.25+.8*p**.6)*U,y-(.06+.26*Math.sin(p*Math.PI)*(1-Math.abs(d)*.5))*U,(.1+.13*p)*(1-.3*Math.abs(d))*U,0,7);inked(PAPER,1-p*p)}
  }
  if(P.bolts>.02){
    // Rayos: zigzags alrededor del cuerpo que cambian de sitio muchas veces por segundo.
    const [x,y]=at(head.x,head.y-.7),tick=Math.floor(t*15),rnd=n=>{const v=Math.sin(tick*91.7+n*47.3)*43758.5;return v-Math.floor(v)};
    c.lineCap=c.lineJoin='round';
    for(let i=0;i<8;i++){
      if(rnd(i)<.3)continue;
      const a=i*Math.PI/4+rnd(i+20)*.5,r0=(.75+rnd(i+40)*.2)*U,r1=r0+(.35+rnd(i+60)*.3)*U,nx=-Math.sin(a),ny=Math.cos(a);
      c.beginPath();for(let j=0;j<=3;j++){const r=r0+(r1-r0)*j/3,off=(j%2?1:-1)*(j&&j<3?.09:0)*U;c.lineTo(x+Math.cos(a)*r+nx*off,y+Math.sin(a)*r+ny*off)}
      c.globalAlpha=P.bolts;c.strokeStyle=INK;c.lineWidth=line*3;c.stroke();c.strokeStyle=GOLD;c.lineWidth=line*1.5;c.stroke();
    }
  }
  if(P.tears>.02)for(const side of [-1,1])for(let j=0;j<4;j++){
    // Lágrimas a chorro: gotas que salen de cada ojo en arco.
    const ph=(t*1.5+j/4+(side>0?.12:0))%1;
    c.beginPath();c.arc(hx+side*(.3+ph*.85)*U,hy-(.02+1.1*ph-2*ph*ph)*U,(.075-.025*ph)*U,0,7);inked(BLUE,P.tears*(1-ph**3));
  }
  if(P.stars>.02){
    // Estrellas del mareo: tres, en una órbita achatada sobre la cabeza; las de delante se ven más grandes.
    const [x,y]=at(head.x,head.y+.74),list=[0,1,2].map(i=>t*4.2+i*Math.PI*2/3).sort((a,b)=>Math.sin(a)-Math.sin(b));
    for(const a of list){spiky(x+Math.cos(a)*.52*U,y+Math.sin(a)*.13*U,(.105+.03*Math.sin(a))*U*P.stars,5,.46,-Math.PI/2+t*2);inked(GOLD,Math.min(1,P.stars*1.5))}
  }
  if(P.rage>.02){
    // Marca de enfado: cuatro trazos curvos en cruz, como en los tebeos, latiendo junto a la cabeza.
    const [x,y]=at(head.x+.56,head.y+.5),r=.13*U*(1+.14*Math.sin(t*18))*P.rage;
    c.lineCap='round';
    for(const [color,width] of [[INK,line*2.6],[RED,line*1.4]]){c.globalAlpha=P.rage;c.strokeStyle=color;c.lineWidth=width;for(let i=0;i<4;i++){const a=i*Math.PI/2+Math.PI/4,mx=x+Math.cos(a)*r*.45,my=y+Math.sin(a)*r*.45;c.beginPath();c.arc(mx+Math.cos(a)*r,my+Math.sin(a)*r,r,a+Math.PI-.75,a+Math.PI+.75);c.stroke()}}
  }
  if(hit){
    // Estallido donde cae el toque.
    const age=(now-hit.at)/280,x=hit.x*width,y=hit.y*height,r=(.14+.2*ease(age*1.6))*U;
    spiky(x,y,r,9,.56,.3);inked(PAPER,1-age**3);spiky(x,y,r*.5,9,.56,.65);c.globalAlpha=1-age**3;c.fillStyle=GOLD;c.fill();
  }
  c.restore();
}
// Un toque (clic o dedo, sin arrastrar) encima del personaje: «¡Ay!». Solo cuenta si cae sobre el dibujo, no en el aire
// de alrededor. El armario se abre con el botón de edición debajo del escenario.
function poke(item){
  const el=item.el;let down=null;
  el.addEventListener('pointerdown',event=>{down={x:event.clientX,y:event.clientY,at:performance.now()}});
  el.addEventListener('click',event=>{
    const start=down;down=null;
    if(climbPoses.has(el)||!start||!event.detail||Math.hypot(event.clientX-start.x,event.clientY-start.y)>8||performance.now()-start.at>600||!touches(item,event))return;
    event.preventDefault();event.stopPropagation();
    const t=(performance.now()-item.born)/1000;
    if(item.mood==='ko'||item.clip===CLIPS.desmayo||(item.clip&&item.lastClip===item.poked&&t-item.clipAt<(item.clip.lock||.35)))return;
    // Cuanto más se insiste (toques a menos de 7 s del anterior), más fácil es que salga una de las reacciones largas.
    // Mientras responde o espera el resultado (manos en la boca) y en los encuadres que no son de cuerpo entero, solo
    // el «¡Ay!» corto. Las que se tumban de lado necesitan un lienzo ancho.
    item.combo=t-(item.pokedAt??-99)<7?(item.combo||0)+1:0;item.pokedAt=t;
    const view=VIEWS[item.data.mode]||VIEWS.full,whole=['full','stage','home'].includes(item.data.mode)&&item.mood!=='nervous'&&item.mood!=='wait',roomy=(view.width||view.frame)>=3.4;
    const big=Math.min(.8,.22+.18*item.combo),luck=Math.random(),pool=(!whole?POKES:luck<big?BIG:luck<big+(1-big)*.75?GAGS:POKES).filter(name=>roomy||!CLIPS[name].wide);
    let name=any(pool);while(pool.length>1&&name===item.poked)name=any(pool);
    // Si corta un gesto que daba vueltas, el giro pendiente se da por hecho para que no las deshaga.
    if(item.pose)for(const key of ['ry','fall'])item.pose[key]=wrap(item.pose[key]);
    item.after=null;item.poked=name;play(item,name,t);item.wait=t+CLIPS[name].d+1.5;
    if(!CLIPS[name].dodge){const r=item.canvas.getBoundingClientRect();item.hit={x:(event.clientX-r.left)/r.width,y:(event.clientY-r.top)/r.height,at:performance.now()}}
    if(POKES.includes(name))window.Sound?.ay?.();else window.Sound?.gag?.(name);
  });
}
function touches(item,event){
  const r=item.canvas.getBoundingClientRect();if(!r.width)return false;
  const x=Math.round((event.clientX-r.left)*item.canvas.width/r.width),y=Math.round((event.clientY-r.top)*item.canvas.height/r.height),s=Math.round(6*SCALE);
  try{const {data}=item.context.getImageData(Math.max(0,x-s),Math.max(0,y-s),s*2,s*2);for(let i=3;i<data.length;i+=4)if(data[i]>60)return true}catch{return true}
  return false;
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
    const born=performance.now(),emote=reduced?'':data.emote;
    const item={el,canvas,context:canvas.getContext('2d'),entry:buildModel(data.look),data,turn:data.turn??TURN,spin:0,dragging:false,born,last:born,home:!!el.closest('.home'),after:null,
      seed:Math.random()*100,lean:Math.random()<.5?-1:1,mood:emote==='cheer'||emote==='sad'?emote:'',clip:null,wait:1.2+Math.random()*2.6,blinkAt:.8+Math.random()*3,blinkFrom:-9};
    if(FIRST[emote])play(item,any(FIRST[emote]),0);
    // En la portada, al pasar el ratón por encima vuelve a saludar.
    if(emote==='wave')el.addEventListener('pointerenter',()=>{if(!item.clip)play(item,any(FIRST.wave),(performance.now()-item.born)/1000)});
    if(el._react||data.reaction)apply(item,el._react||data.reaction);
    drawAvatar(item,item.born);
    el.replaceChildren(canvas);live.add(item);animatedItems.set(el,item);if(data.drag)grab(item);if(!reduced)poke(item);
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
// play(nombre) lanza un gesto en todos los avatares animados (o solo en el de la posición index): sirve para probarlos desde la consola.
// react(el) aplica a ese avatar el estado que reactions.js ha dejado en el._react (si aún no está dibujado, lo recoge al nacer).
// Foto fija del avatar para dibujarla en otro lienzo (las tarjetas para compartir, decisión 0081): look ya traducido
// (Avatar.resolve), en un encuadre de VIEWS y con el ancho pedido, sin pasar del tamaño del lienzo de trabajo.
const shot=(look,mode='full',width=BUF_W)=>{const view=VIEWS[mode]||VIEWS.full,w=Math.max(16,Math.min(BUF_W,Math.round(width),Math.floor(BUF_H*view.ratio)));return snapshot(look,mode,w,Math.round(w/view.ratio))};
window.Avatar3D={ready:true,shot,climb,firstPerson,lookAt:(el,x,y)=>{if(el?.isConnected)targets.set(el,{x,y,at:performance.now()})},views:live,clips:Object.keys(CLIPS),dances:DANCES,gags:[...GAGS,...BIG],react:el=>{for(const item of live)if(item.el===el)apply(item,el._react)},play:(name,index)=>{[...live].forEach((item,i)=>{if(index===undefined||index===i)play(item,name,(performance.now()-item.born)/1000)})}};
document.dispatchEvent(new Event('faraday:avatar3d-ready'));

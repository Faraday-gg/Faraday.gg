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
function torsoTexture(type,main,trim,print,{stretch=2.6,k=1}={}){
  const texture=paint((c,S)=>{
    const F=s=>(.75+s*.25)*S,B=s=>(.25+s*.25)*S,Y=v=>(1-v)*S,dark=shade(main,.78),on=light(main)?INK:PAPER,onTrim=light(trim)?INK:PAPER;
    // brand = logotipo de una marca real ('@nike'): sustituye a FRDY y al sello ≈ de la prenda.
    const brand=print[0]==='@'?print.slice(1):'',tag=brand||'FRDY';
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
      badge(F(.44),Y(.68),20,PAPER,main);word('26',F(-.44),Y(.68),24,trim,null,false);
      word(tag,B(0),Y(.72),52,PAPER,trim);badge(B(0),Y(.42),40,trim,onTrim);
    }
    if(type==='sudadera'){
      bands(0,.09,[dark]);c.fillStyle=dark;c.beginPath();c.roundRect(F(-.5),Y(.36),F(.5)-F(-.5),Y(.12)-Y(.36),18);c.fill();c.strokeStyle=shade(main,.6);c.lineWidth=3;c.stroke();
      graphic(F(0),brand?.47:.62,(brand?1.05:1.25)*k);if(brand)mark(B(0),Y(.62),84,40,on);else if(print==='casi')word('CASI CASI',B(0),Y(.7),30,trim,null);else if(print==='rayo')word('CIRCUITO',B(0),Y(.7),30,trim,null);else if(flag)word(FLAGS[flag][0],B(0),Y(.7),34,trim,INK,false);else word('FRDY',B(0),Y(.7),30,on,null);
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
  supreme(c){c.fillStyle='#e4002b';c.fillRect(1,8,22,7.4);c.fillStyle='#fff';c.font='italic 900 4.6px "Arial Black",Arial,sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillText('Supreme',11.8,11.9)},
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
const WAIST=.7,NECK=1.3,SHOULDER=1.16,ELBOW=.3;
// Construye el personaje de un look ya traducido (Avatar.resolve) y devuelve el grupo y las partes que se animan.
function buildModel(look){
  const model=new THREE.Group(),fem=look.body==='mujer',K=fem?.88:1; // K: la mujer es algo más fina de brazos y piernas
  const has=id=>(look.extras||[]).includes(id),skin=mat(SKIN[look.skin]||SKIN.miel),hairC=HAIR_COLORS[look.hairColor]||HAIR_COLORS.negro,hairM=mat(hairC);
  const main=CLOTH[look.topColor]||PAPER,trim=CLOTH[look.trimColor]||INK,pantsC=DENIM[look.bottomColor]||DENIM.lavado,pants=mat(pantsC),pantsDark=mat(shade(pantsC,.78));
  const ink=flat(INK),white=mat(PAPER),gold=new THREE.MeshStandardMaterial({color:GOLD,roughness:.28,metalness:.75});
  const type=look.top,sleeved=!['camiseta','baloncesto'].includes(type),bare=type==='baloncesto',O=.03,brandKey=look.print&&look.print[0]==='@'?look.print.slice(1):'';
  const body=new THREE.Group(),upper=new THREE.Group(),up=new THREE.Group(),neck=new THREE.Group(),head=new THREE.Group();
  model.add(body);upper.position.y=WAIST;up.position.y=-WAIST;upper.add(up);body.add(upper);neck.position.y=NECK;up.add(neck);head.position.y=1.8-NECK;neck.add(head);

  // Piernas: pantalón ancho que se arruga sobre la zapatilla. En mujer hay además falda (con calcetín) y mallas.
  const lift={plataforma:.08,runner:.04,botas:.03}[look.shoes]||0,boots=look.shoes==='botas',short=look.bottom==='corto',skirt=fem&&look.bottom==='falda',tights=fem&&look.bottom==='mallas',gap=fem?.16:.18,legs=[],feet=[];body.position.y=lift;
  if(skirt){
    add(body,lathe([[0,-.215],[.4,-.215],[.42,-.2],[.36,-.05],[.3,.1],[.285,.15],[.25,.17],[0,.17]]),mat(pantsC,pleats(pantsC)),[0,.62,0],[1.02,1,.84],[],O);
    add(body,ring(.285,.03),pantsDark,[0,.765,0],[1.02,.84,1],[Math.PI/2,0,0]);
    if(look.bottomLogo==='levis')add(body,new THREE.BoxGeometry(.03,.05,.014),flat('#c8102e'),[.2,.69,.268]);
  }else add(body,sphere(),pants,[0,.64,0],fem?[.325,.15,.26]:[.35,.17,.27],[],O);
  for(const side of [-1,1]){
    const leg=new THREE.Group();leg.position.set(side*gap,.64,0);body.add(leg);legs.push(leg);
    if(skirt){add(leg,capsule(.092,.3),skin,[0,-.3,0],[],[],O);add(leg,new THREE.CylinderGeometry(.1,.1,.13,20),white,[0,-.47,0],[],[],O)}
    else if(tights)add(leg,capsule(.125,.3),pants,[0,-.28,0],[1,1,.95],[],O);
    else if(short){add(leg,capsule(.1*K,.2),skin,[0,-.4,0],[],[],O);add(leg,capsule(.185*K,fem?.1:.16),pants,[0,fem?-.13:-.17,0],[1,1,.95],[],O);add(leg,new THREE.CylinderGeometry(.108*K,.108*K,.16,20),white,[0,-.46,0],[],[],O)}
    else{add(leg,capsule(.178*K,.22),pants,[0,-.26,0],[1,1,.95],[],O);for(const [y,r] of [[-.4,.172],[-.475,.182]])add(leg,ring(r*K,.045),pants,[0,y,0],[1,1,1],[Math.PI/2,0,0],O)}
    if(look.bottom==='cargo')add(leg,box(5),pantsDark,[side*.17*K,-.24,0],[.05,.1,.11],[],O);
    const bands=look.bottomLogo==='adidas'?[-.05,0,.05]:look.bottomLogo?[]:[-.035,.035];
    if(look.bottom==='chandal')for(const d of bands)add(leg,new THREE.BoxGeometry(.012,short?.3:.5,.03),flat(PAPER),[side*.181*K,short?-.17:-.26,d]);
    if(tights&&look.bottomLogo==='adidas')for(const d of bands)add(leg,new THREE.BoxGeometry(.012,.46,.024),flat(PAPER),[side*.127,-.28,d*.8]);
    if(look.bottomLogo==='levis'){if(!skirt)add(leg,new THREE.BoxGeometry(.014,.05,.028),flat('#c8102e'),[side*.192*K,-.1,-.05])}
    else if(look.bottomLogo&&side===1&&!(tights&&look.bottomLogo==='adidas'))decal(leg,look.bottomLogo,light(pantsC)?INK:PAPER,[0,short?(fem?-.13:-.17):-.2,tights?.128:(short?.184:.178)*K],tights?.1:.12);
    const shoe=new THREE.Group();shoe.position.set(side*gap,-lift,.07);shoe.rotation.y=side*.14;if(fem)shoe.scale.setScalar(.92);shoe.userData.home=[side*gap,-lift,.07];body.add(shoe);feet.push(shoe);
    const shoeC=CLOTH[look.shoesColor]||PAPER,trimC=CLOTH[look.shoesTrim],upperM=mat(shoeC),sole=mat(boots?'#2e2823':look.shoesSole==='goma'?'#b98a4f':light(shoeC)?'#e6e0d0':PAPER),accent=trimC?mat(trimC):null;
    add(shoe,box(),upperM,[0,.15+lift,.02],[.17,.115,.265],[],O);
    add(shoe,box(),sole,[0,.055+lift/2,.02],[.185,.06+lift/2,.285],[],O);
    add(shoe,box(),sole,[0,.12+lift,.215],[.15,.07,.08]);
    add(shoe,box(),accent||mat(shade(shoeC,light(shoeC)?.86:1.5)),[0,.27+lift,.06],[.095,.09,.05],[-.45,0,0],O);
    if(look.shoes==='altas')add(shoe,capsule(.14,.05),look.shoesLogo==='converse'?upperM:accent||upperM,[0,.3,-.07],[1,1,1.05],[],O);
    if(look.shoesLogo){const ankle=look.shoesLogo==='converse';decal(shoe,look.shoesLogo,CLOTH[look.shoesLogoColor]||trimC||INK,ankle?[side*.153,.31,-.07]:[side*.18,.17+lift,.02],ankle?.14:.26,[0,side*Math.PI/2,0],side)}
    else add(shoe,new THREE.BoxGeometry(.012,trimC?.075:.05,trimC?.21:.16),flat(trimC||(light(shoeC)?INK:PAPER)),[side*.172,.17+lift,.03]);
    // Dos colores: lengüeta, franja y talón en el segundo color. Las botas lo llevan solo en el pespunte de la suela.
    if(accent&&!boots){add(shoe,box(),accent,[0,.175+lift,-.2],[.15,.1,.075],[],O);add(shoe,box(),accent,[0,.222+lift,.15],[.125,.045,.085],[-.25,0,0],O)}
    if(look.shoes==='runner'){add(shoe,box(),sole,[0,.1+lift,-.11],[.193,.09,.17],[],O);add(shoe,box(3),accent||mat(shade(shoeC,.8)),[0,.085+lift,-.13],[.199,.032,.1])}
    if(boots){add(shoe,capsule(.15,.12),upperM,[0,.34,-.06],[1,1,1.05],[],O);add(shoe,ring(.135,.035),mat(shade(shoeC,light(shoeC)?.7:1.6)),[0,.47,-.06],[1,1.05,1],[Math.PI/2,0,0],O);add(shoe,box(),accent||sole,[0,.122+lift,.02],[.192,.014,.292])}
  }

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
    const arm=new THREE.Group(),fore=new THREE.Group();arm.position.set(side*(bare?(fem?.335:.385):fem?.355:.41),SHOULDER,0);arm.rotation.z=side*.34;fore.position.y=-ELBOW;fore.rotation.set(-.28,0,side*-.08);arm.add(fore);up.add(arm);arms.push({arm,fore,side});
    const sleeveC=type==='universitaria'?trim:main,sleeve=type==='chandal'&&(!brandKey||brandKey==='adidas')?mat(main,sleeveTexture(main,brandKey?trim:PAPER,!!brandKey)):mat(sleeveC);
    const thick=bare?1.1:1;add(arm,limb(.1*K*thick,.09*K*thick,ELBOW),skin,[],[],[],O);add(fore,limb(.09*K*thick,.078*K*thick,.2),skin,[],[],[],O);
    if(sleeved){
      add(arm,capsule(.145*K,.12),sleeve,[0,-.13,0],[],[],O);add(fore,capsule(.138*K,.02),sleeve,[0,-.03,0],[],[],O);
      const cuff=type==='universitaria'?mat(null,stripes([trim,PAPER,trim,PAPER,trim])):mat(shade(sleeveC,.78));
      if(type!=='plumas')add(fore,new THREE.CylinderGeometry(.125*K,.118*K,.085,24),cuff,[0,-.12,0],[],[],O);
      else for(const [part,y] of [[arm,-.1],[arm,-.24],[fore,-.08]])add(part,ring(.135*K,.05),brandKey&&part===arm&&y>-.2?mat(trim):sleeve,[0,y,0],[1,1,1],[Math.PI/2,0,0],O);
    }else if(!bare)add(arm,capsule(crop?.132:.165,crop?.07:.1),mat(main),[0,crop?-.07:-.09,0],[],[],O);
    const hand=new THREE.Group();hand.position.y=-.2;hand.rotation.y=side*-.7;hand.scale.setScalar(K*1.15);fore.add(hand);
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
    const eye=add(head,sphere(fem?.074:.07),ink,onHead(side*.215,-.04,1.004),[1,1.55,.4]);eye.castShadow=false;eye.userData.x=eye.position.x;eyes.push(eye);
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
  const hat=look.hat,hair=look.hair,hooded=hat==='capucha',covered=!!hat&&!['capucha','corona','aureola','lazo','diadema','tiara'].includes(hat),F=fem?FEM_HAIR[hair]:null,sway=[];
  const scalp=(front=.34,back=.8,grow=1.045)=>add(head,hairCap(front,back),hairM,[],[HEAD.a*grow,HEAD.b*grow,HEAD.c*grow],[],.02);
  const spike=(x,y,z,rx,rz,size=1)=>add(head,new THREE.ConeGeometry(.1*size,.3*size,8),hairM,[x,y,z],[1,1,.7],[rx,0,rz],.05);
  const dangle=(x,y,z)=>{const group=new THREE.Group();group.position.set(x,y,z);head.add(group);sway.push(group);return group};
  if(F){if(!F.bald){
    const low=covered||hooded;scalp();
    if(F.fringe==='cortina')for(const side of [-1,1])add(head,box(3),hairM,[side*.33,low?.2:.31,.5],[.3,.13,.1],[.12,side*.25,side*-.55],O);
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
    if(['cortina','melena','largo'].includes(hair))for(const side of [-1,1])add(head,box(3),hairM,[side*.33,covered||hooded?.2:.31,.5],[.3,.13,.1],[.12,side*.25,side*-.55],O);
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
  if(covered){
    const cap=new THREE.Group(),hatC=CLOTH[look.hatColor]||INK,hatTrim=CLOTH[look.hatTrim]||trim,color=mat(hatC),dark=mat(shade(hatC,.72));head.add(cap);
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
  if(hooded){
    add(head,shell(2.8,Math.PI/2+.85,Math.PI*2-1.7,0,Math.PI*.78),mat(shade(main,.92)),[0,.03,-.04],[HEAD.a*1.2,HEAD.b*1.2,HEAD.c*1.16]).material.side=THREE.DoubleSide;
    add(head,ring(.62,.05,Math.PI*1.25),mat(shade(main,.75)),[0,.03,.33],[1.05,1.05,1],[0,0,-Math.PI*.125]);
  }
  if(has('cascos')||has('cascos2')){
    const alt=has('cascos2');add(head,ring(.7,.04,Math.PI),mat(alt?PAPER:INK),[0,0,-.02],[1,1.03,1],[],.06);
    for(const side of [-1,1])add(head,box(3),mat(alt?CLOTH.lila:CLOTH.coral),[side*.7,-.06,-.02],[.08,.2,.17],[],O);
  }
  return {group:model,parts:{body,upper,torso,neck,head,arms,legs,feet,eyes,lids,lips,sway},base:lift,fem};
}

// ---------- Motor: un solo contexto 3D que dibuja cada avatar y lo copia a su lienzo
const SCALE=Math.min(window.devicePixelRatio||1,2),TURN=-.3,reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
// Encuadres: frame = alto que debe caber, width = ancho, target = altura a la que mira la cámara. shoes se ve de lado, para que se vea el logotipo.
const VIEWS={full:{ratio:2/3,frame:3.1,width:2.05,target:1.38},bust:{ratio:1,frame:1.9,target:1.87},legs:{ratio:1,frame:1.3,target:.42},shoes:{ratio:1,frame:.8,target:.2},torso:{ratio:1,frame:1.6,target:1},stage:{ratio:1,frame:3.5,target:1.58}};
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
// codo, I = antebrazo hacia dentro, Y = hombro; fa, fb = punteras; eye = mirada; fall, gx, gy = el personaje entero se
// tumba en el plano de la pantalla y se desplaza (desmayo). Sin suavizar: lid = párpados, wide = ojos como platos,
// frown = boca hacia abajo.
const KEYS=['px','py','air','ry','rz','sx','sy','sz','hx','hy','hz','aS','aO','aE','aI','aY','bS','bO','bE','bI','bY','fa','fb','eye','fall','gx','gy'];
const RATE={px:30,py:26,air:45,fa:40,fb:40,hx:10,hy:10,hz:10,aE:13,aI:13,bE:13,bI:13,eye:22,fall:16,gx:16,gy:16};
const ease=x=>x<=0?0:x>=1?1:x*x*(3-2*x),hold=(u,a=.2,b=.8)=>ease(u/a)*ease((1-u)/(1-b));
// Deriva irregular: tres ondas de periodos que no casan, para que el vaivén no se note en bucle.
const drift=(t,seed)=>Math.sin(t*1.13+seed)*.5+Math.sin(t*.71+seed*2.3)*.3+Math.sin(t*1.93+seed*.7)*.2;
const both=values=>{const result={};for(const key in values){result['a'+key]=values[key];result['b'+key]=values[key]}return result};
const scaled=(values,k)=>{const result={};for(const key in values)result[key]=values[key]*k;return result};
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
    fa:0,fb:0,eye:d(.8,13,.5),lid:sad*.3};
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
  temblor:{d:1.2,f:(u,t)=>{const k=Math.sin(u*Math.PI);return {px:Math.sin(t*38)*.014*k,...both({Y:.05*k}),hx:-.08*k,wide:.5*k}}}
};
const IDLE=['mirar','peso','estirar','rascar','jarras','botar','pie','hombros','bailar','cuello','pensar','mirar','peso'];
const POOL={cheer:['salto','puno','giro','bailar'],sad:['suspiro','negar','pie'],meh:['hombros','rascar','negar','suspiro'],nervous:['mirar','temblor','mirar','botar'],wait:[],ko:['espasmo']},FIRST={wave:['saludo','saludo2'],cheer:['salto','puno'],hurt:['golpe','tambaleo']};
const any=list=>list[Math.random()*list.length|0];
function play(item,name,t){const clip=CLIPS[name];if(!clip)return;item.clip=clip;item.clipAt=t;item.lastClip=name;if(clip.start)clip.start(item)}
function nextClip(item,t){const pool=POOL[item.mood]||(item.data.emote==='wave'?[...IDLE,'saludo','saludo2']:IDLE);if(!pool.length){item.wait=t+1;return}let name=any(pool);while(pool.length>1&&name===item.lastClip)name=any(pool);play(item,name,t)}
// Cambia el estado de un avatar animado desde fuera (reactions.js): mood = cómo se queda; clip = gesto que hace ahora;
// then = estado al que pasa cuando el gesto termina.
function apply(item,{mood='',clip='',then=null}={}){
  const t=(performance.now()-item.born)/1000;item.clip=null;item.mood=mood;item.after=null;
  if(clip&&!reduced){item.after=then;play(item,clip,t)}else{if(then!==null)item.mood=then;item.wait=t+1.2+Math.random()*2}
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
  const cur=item.pose||(item.pose={...P});
  for(const key of KEYS)cur[key]+=(P[key]-cur[key])*(1-Math.exp(-dt*(RATE[key]||18)));
  R.body.position.set(cur.px,item.entry.base+cur.py+cur.air,0);R.body.rotation.set(0,cur.ry,cur.rz);
  // Caída: gira el personaje entero alrededor de los pies, en el plano de la pantalla (después del giro sobre sí mismo).
  const whole=item.entry.group;whole.rotation.order='ZYX';whole.rotation.z=cur.fall;whole.position.set(cur.gx,cur.gy,0);
  R.upper.rotation.set(cur.sx,cur.sy,cur.sz);R.torso.scale.y=1+P.br*.012;
  R.neck.position.y=NECK+P.br*.007;R.neck.rotation.set(cur.hx,cur.hy,cur.hz);
  R.arms.forEach(({arm,fore,side},i)=>{const p=i?'b':'a';arm.position.y=SHOULDER+P.br*.008+cur[p+'Y'];arm.rotation.set(cur[p+'S'],0,side*cur[p+'O']);fore.rotation.set(cur[p+'E'],0,side*cur[p+'I'])});
  // Los pies se quedan en el suelo: la pierna se inclina y se encoge para seguir a la cadera. En el aire, las punteras caen.
  const tilt=-Math.atan(cur.px/.55),stretch=1+cur.py/.55,toes=Math.min(.5,cur.air*3);
  R.legs.forEach(leg=>{leg.rotation.z=tilt;leg.scale.y=stretch});
  R.feet.forEach((shoe,i)=>{const [x,y,z]=shoe.userData.home,tap=cur[i?'fb':'fa'];shoe.position.set(x-cur.px,y-cur.py+tap*.05,z);shoe.rotation.x=toes-tap});
  const since=t-item.blinkFrom,lid=Math.min(1,Math.max(P.lid,since<.15?Math.sin(since/.15*Math.PI):0));
  const wide=Math.min(1,P.wide)*(1-lid);
  R.eyes.forEach(eye=>{eye.scale.y=1.55*(1-.9*lid)*(1+.28*wide);eye.scale.x=1+.2*wide;eye.position.x=eye.userData.x+cur.eye*.014});R.lids.forEach(part=>{part.visible=lid<.5&&wide<.25});
  if(R.lips){const down=P.frown>.5,{y,rz,frown}=R.lips.userData;R.lips.rotation.z=down?frown:rz;R.lips.position.y=down?y-.075:y}
  // La melena, las coletas y las trenzas cuelgan: compensan en parte la inclinación de la cabeza y la siguen con retardo.
  const roll=cur.rz+cur.sz+cur.hz,nod=cur.sx+cur.hx,lag=1-Math.exp(-dt*5);
  if(item.lagRoll===undefined){item.lagRoll=roll;item.lagNod=nod}item.lagRoll+=(roll-item.lagRoll)*lag;item.lagNod+=(nod-item.lagNod)*lag;
  for(const group of R.sway){group.rotation.z=-roll*.7+(item.lagRoll-roll)*1.2;group.rotation.x=-nod*.7+(item.lagNod-nod)*1.2}
}
let running=false,last=0;
function loop(now){
  if(!live.size){running=false;return}
  requestAnimationFrame(loop);if(document.hidden||now-last<(live.size>2?30:14))return;last=now;
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
    const born=performance.now(),emote=reduced?'':data.emote;
    const item={el,canvas,context:canvas.getContext('2d'),entry:buildModel(data.look),data,turn:data.turn??TURN,spin:0,dragging:false,born,last:born,home:!!el.closest('.home'),after:null,
      seed:Math.random()*100,lean:Math.random()<.5?-1:1,mood:emote==='cheer'||emote==='sad'?emote:'',clip:null,wait:1.2+Math.random()*2.6,blinkAt:.8+Math.random()*3,blinkFrom:-9};
    if(FIRST[emote])play(item,any(FIRST[emote]),0);
    // En la portada, al pasar el ratón por encima vuelve a saludar.
    if(emote==='wave')el.addEventListener('pointerenter',()=>{if(!item.clip)play(item,any(FIRST.wave),(performance.now()-item.born)/1000)});
    if(el._react)apply(item,el._react);
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
// play(nombre) lanza un gesto en todos los avatares animados (o solo en el de la posición index): sirve para probarlos desde la consola.
// react(el) aplica a ese avatar el estado que reactions.js ha dejado en el._react (si aún no está dibujado, lo recoge al nacer).
window.Avatar3D={ready:true,views:live,clips:Object.keys(CLIPS),react:el=>{for(const item of live)if(item.el===el)apply(item,el._react)},play:(name,index)=>{[...live].forEach((item,i)=>{if(index===undefined||index===i)play(item,name,(performance.now()-item.born)/1000)})}};

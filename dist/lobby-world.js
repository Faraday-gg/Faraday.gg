// Lobby: la plaza en 3D de la portada. Aquí se construye lo que se ve al pasear (el suelo, el murete, las farolas,
// los árboles, el arco del fondo y los rótulos de los modos) y se anima lo poco que se mueve solo. lobby.js lleva al
// jugador, a los demás, la cámara y la red. Es una plaza al aire libre, de noche, con los colores de la portada:
// no es el Salón (casino-world.js) ni comparte muebles con él.
const INK='#1b1f27',PAPER='#fffdf7',CORAL='#ff6548',YELLOW='#ffdb70',NIGHT='#1b1e2c',PANEL='#2a2e42',WALL='#343951';

// Tamaño de la plaza, en metros. Es el único sitio donde se define: el servidor (lib/lobby.mjs) debe usar el mismo.
export const ROOM={w:30,d:22};
// Hasta dónde se puede llegar: medio cuerpo antes del murete.
const MARGIN=.8;
// Dónde aparece quien entra: un rectángulo delante del centro («rx» y «rz» son la mitad de su ancho y de su fondo).
export const SPAWN={x:0,z:4.5,rx:4.5,rz:2.2};
const LAMPS=[[-9,-5],[9,-5],[-9,5.5],[9,5.5]],TREES=[[-13,-9],[13,-9],[-13,9],[13,9]],PILLARS=[[-4.4,-9.6],[4.4,-9.6]];
// Lo que no se atraviesa. Son círculos: al chocar, el personaje resbala por el borde en vez de quedarse clavado.
// El radio ya cuenta con el cuerpo de quien camina.
export const SOLIDS=[
  ...LAMPS.map(([x,z])=>({x,z,r:.75})),...TREES.map(([x,z])=>({x,z,r:1.35})),...PILLARS.map(([x,z])=>({x,z,r:1.05}))
];
// Recorta un punto a la plaza.
export function inside(point){
  const W=ROOM.w/2-MARGIN,D=ROOM.d/2-MARGIN;
  point.x=Math.max(-W,Math.min(W,point.x));point.z=Math.max(-D,Math.min(D,point.z));
  return point;
}
// Choques: los límites de la plaza y lo que hay plantado en ella.
export function collide(pos){
  inside(pos);
  for(const s of SOLIDS){
    const dx=pos.x-s.x,dz=pos.z-s.z,d=Math.hypot(dx,dz)||.001;
    if(d<s.r){pos.x=s.x+dx/d*s.r;pos.z=s.z+dz/d*s.r}
  }
  return inside(pos);
}

export function createPlaza({THREE,scene,shadows=true}){
  const ramp=new THREE.DataTexture(new Uint8Array([110,110,110,255,190,190,190,255,255,255,255,255]),3,1);
  ramp.minFilter=ramp.magFilter=THREE.NearestFilter;ramp.needsUpdate=true;
  const inkLine=new THREE.LineBasicMaterial({color:INK});
  const toon=(color,map=null)=>new THREE.MeshToonMaterial({color:map?'#ffffff':color,map,gradientMap:ramp});
  const plain=(color,map=null)=>new THREE.MeshBasicMaterial({color:map?'#ffffff':color,map});

  function solid(geometry,material,[x=0,y=0,z=0]=[],parent=scene,edges=true){
    const mesh=new THREE.Mesh(geometry,material);mesh.position.set(x,y,z);mesh.castShadow=mesh.receiveShadow=shadows;
    if(edges)mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(geometry,30),inkLine));
    parent.add(mesh);return mesh;
  }
  const box=(w,h,d,color,at,parent,edges)=>solid(new THREE.BoxGeometry(w,h,d),toon(color),at,parent,edges);
  const drum=(r,h,color,at,parent,sides=24,edges)=>solid(new THREE.CylinderGeometry(r,r,h,sides),toon(color),at,parent,edges);
  function paint(width,height,draw){
    const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;draw(canvas.getContext('2d'),width,height);
    const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=4;return texture;
  }
  // Algo tumbado en el suelo. No hace sombra.
  function flat(geometry,material,[x,y,z],parent=scene){
    const mesh=new THREE.Mesh(geometry,material);mesh.rotation.x=-Math.PI/2;mesh.position.set(x,y,z);mesh.receiveShadow=shadows;parent.add(mesh);return mesh;
  }
  // Resplandor: un disco de luz que siempre mira a la cámara. Hace de brillo de farolas y rótulos sin gastar luces.
  const halo=paint(128,128,(c,w)=>{const g=c.createRadialGradient(w/2,w/2,0,w/2,w/2,w/2);g.addColorStop(0,'#ffffffd0');g.addColorStop(.35,'#ffffff50');g.addColorStop(1,'#ffffff00');c.fillStyle=g;c.fillRect(0,0,w,w)});
  function glow(color,size,[x,y,z],parent=scene,opacity=.6){
    const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:halo,color,opacity,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false}));
    sprite.position.set(x,y,z);sprite.scale.set(size,size,1);parent.add(sprite);return sprite;
  }
  // Rótulo de neón. Se construye mirando hacia +z; «turn» lo gira.
  function sign(text,color,[x,y,z],width=4,turn=0){
    const texture=paint(768,192,(c,w,h)=>{
      c.fillStyle='#161827';c.beginPath();c.roundRect(6,6,w-12,h-12,60);c.fill();c.lineWidth=10;c.strokeStyle=color;c.stroke();
      c.shadowColor=color;c.shadowBlur=26;c.fillStyle=color;c.font='700 96px "Space Grotesk",Arial,sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillText(text,w/2,h/2+6,w-70);
    });
    const plane=new THREE.Mesh(new THREE.PlaneGeometry(width,width/4),new THREE.MeshBasicMaterial({map:texture,transparent:true}));
    plane.position.set(x,y,z);plane.rotation.y=turn;scene.add(plane);glow(color,width*1.2,[0,0,-.06],plane,.26);
    return plane;
  }

  const W=ROOM.w/2,D=ROOM.d/2;
  // ---------- Cielo, luces y suelo ----------
  scene.background=new THREE.Color(NIGHT);scene.fog=new THREE.Fog(NIGHT,26,64);
  scene.add(new THREE.HemisphereLight('#fff1e0','#4a4262',1.3));
  const sun=new THREE.DirectionalLight('#ffe6c2',1.7);sun.position.set(7,15,9);
  if(shadows){
    sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.bias=-.0006;sun.shadow.radius=4;
    Object.assign(sun.shadow.camera,{left:-19,right:19,top:15,bottom:-15,near:1,far:44});
  }
  scene.add(sun);
  {
    const count=150,spots=new Float32Array(count*3);
    for(let i=0;i<count;i++){
      const a=Math.random()*Math.PI*2,up=.12+Math.random()*.6,r=58;
      spots.set([Math.cos(a)*Math.cos(up)*r,Math.sin(up)*r,Math.sin(a)*Math.cos(up)*r],i*3);
    }
    const stars=new THREE.BufferGeometry();stars.setAttribute('position',new THREE.BufferAttribute(spots,3));
    scene.add(new THREE.Points(stars,new THREE.PointsMaterial({color:'#e8dcf5',size:.42,transparent:true,opacity:.75,fog:false,depthWrite:false})));
  }
  // Lo de fuera de la plaza: un suelo oscuro que se pierde en la niebla.
  flat(new THREE.PlaneGeometry(170,170),plain('#1e2132'),[0,-.03,0]).receiveShadow=false;
  // Baldosas: la misma cuadrícula tenue de la portada.
  const tile=paint(256,256,(c,w)=>{
    const m=w/2;c.fillStyle='#2b2e45';c.fillRect(0,0,w,w);c.fillStyle='#31344e';c.fillRect(0,0,m,m);c.fillRect(m,m,m,m);
    c.strokeStyle='#d7c4e430';c.lineWidth=3;c.strokeRect(0,0,w,w);c.beginPath();c.moveTo(m,0);c.lineTo(m,w);c.moveTo(0,m);c.lineTo(w,m);c.stroke();
  });
  tile.wrapS=tile.wrapT=THREE.RepeatWrapping;tile.repeat.set(ROOM.w/4,ROOM.d/4);
  flat(new THREE.PlaneGeometry(ROOM.w,ROOM.d),toon('#fff',tile),[0,0,0]);
  // El medallón del centro, con la marca.
  const medal=paint(512,512,(c,w)=>{
    const m=w/2;c.fillStyle='#3a3350';c.beginPath();c.arc(m,m,m,0,7);c.fill();
    c.strokeStyle=YELLOW;c.lineWidth=8;c.beginPath();c.arc(m,m,m-10,0,7);c.stroke();
    c.setLineDash([14,14]);c.lineWidth=4;c.strokeStyle='#f9deed';c.beginPath();c.arc(m,m,m-38,0,7);c.stroke();c.setLineDash([]);
    c.fillStyle=CORAL;c.beginPath();c.arc(m,m,m*.5,0,7);c.fill();c.lineWidth=8;c.strokeStyle=INK;c.stroke();
    c.fillStyle=INK;c.font='500 280px "Space Grotesk",Arial,sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillText('≈',m,m+10);
  });
  flat(new THREE.CircleGeometry(3.5,56),toon('#fff',medal),[0,.012,0]);

  // ---------- Murete, con un remate de color ----------
  for(const [length,x,z,turn] of [[ROOM.w+1,0,-D-.25,0],[ROOM.w+1,0,D+.25,0],[ROOM.d,-W-.25,0,Math.PI/2],[ROOM.d,W+.25,0,Math.PI/2]]){
    const group=new THREE.Group();group.position.set(x,0,z);group.rotation.y=turn;scene.add(group);
    box(length,.8,.5,WALL,[0,.4,0],group,false);box(length,.1,.6,CORAL,[0,.85,0],group,false);
  }
  for(const x of [-W-.25,W+.25])for(const z of [-D-.25,D+.25]){drum(.5,1.3,PANEL,[x,.65,z]);solid(new THREE.SphereGeometry(.3,14,10),plain('#fff3cf'),[x,1.6,z],scene,false).castShadow=false;glow('#ffc978',2,[x,1.6,z],scene,.5)}

  // ---------- Farolas ----------
  for(const [x,z] of LAMPS){
    drum(.32,.18,PANEL,[x,.09,z]);drum(.09,3.4,INK,[x,1.8,z],scene,10,false);drum(.2,.08,YELLOW,[x,3.5,z],scene,14,false);
    solid(new THREE.SphereGeometry(.3,14,10),plain('#fff3cf'),[x,3.82,z],scene,false).castShadow=false;
    glow('#ffc978',3.2,[x,3.82,z],scene,.55);
  }
  // ---------- Árboles en maceta, en las esquinas ----------
  for(const [x,z] of TREES){
    drum(.95,.7,WALL,[x,.35,z]);drum(1,.1,YELLOW,[x,.74,z],scene,24,false);drum(.16,1,'#5b3423',[x,1.25,z],scene,10,false);
    const green=toon('#3f9a72');
    [[1.15,1.5,2.2],[.9,1.3,3.1],[.62,1.1,3.9]].forEach(([r,h,y],i)=>{solid(new THREE.ConeGeometry(r,h,7),green,[x,y,z]).rotation.y=i*.5});
  }
  // ---------- El arco del fondo, con el rótulo y la moneda que gira encima ----------
  for(const [x,z] of PILLARS){drum(.6,5.2,PANEL,[x,2.6,z]);drum(.72,.3,YELLOW,[x,.15,z],scene,24,false);drum(.68,.24,YELLOW,[x,5.1,z],scene,24,false)}
  box(10.4,.7,1,PANEL,[0,5.55,-9.6]);box(10.6,.12,1.1,CORAL,[0,5.96,-9.6],scene,false);
  sign('FARADAY.GG',CORAL,[0,4.35,-9.5],6.4);
  const coin=new THREE.Group();coin.position.set(0,7.2,-9.6);scene.add(coin);
  {
    const face=paint(256,256,(c,w)=>{const m=w/2;c.fillStyle=CORAL;c.beginPath();c.arc(m,m,m,0,7);c.fill();c.lineWidth=12;c.strokeStyle=INK;c.beginPath();c.arc(m,m,m-6,0,7);c.stroke();c.fillStyle=INK;c.font='500 190px "Space Grotesk",Arial,sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillText('≈',m,m+8)});
    const rim=solid(new THREE.CylinderGeometry(.9,.9,.16,36),toon(CORAL),[0,0,0],coin,false);rim.rotation.x=Math.PI/2;rim.castShadow=false;
    for(const side of [-1,1]){const disc=new THREE.Mesh(new THREE.CircleGeometry(.9,36),plain('#fff',face));disc.position.z=side*.085;if(side<0)disc.rotation.y=Math.PI;coin.add(disc)}
    glow(CORAL,4.4,[0,0,0],coin,.28);
  }
  // ---------- Rótulos de los modos, en los laterales ----------
  [['DUELOS','#fba99f',-1,-3.4],['TRAZA','#83dbb5',-1,3.6],['ASCENSIÓN','#f7c874',1,-3.4],['ARCHIVO VIVO','#bed1ff',1,3.6]].forEach(([text,color,side,z])=>{
    const x=side*(W+.25);
    for(const dz of [-1.5,1.5])drum(.07,2.3,INK,[x,1.95,z+dz],scene,8,false);
    sign(text,color,[x-side*.12,3,z],3.6,-side*Math.PI/2);
  });

  return {
    paint,
    update(dt,now){coin.rotation.y+=dt*.9;coin.position.y=7.2+Math.sin(now/900)*.12},
    // Calidad de las sombras: 2 = mapa de 2048 (el de partida), 1 = mapa de 1024, 0 = sin sombras. lobby.js baja un
    // escalón cuando el equipo no llega. Sin luz que las proyecte, three.js no hace la pasada de sombras.
    shade(level){
      if(!shadows)return;
      sun.castShadow=level>0;
      const side=level>1?2048:1024;
      if(level>0&&sun.shadow.mapSize.x!==side){sun.shadow.mapSize.set(side,side);sun.shadow.map?.dispose();sun.shadow.map=null}
    }
  };
}

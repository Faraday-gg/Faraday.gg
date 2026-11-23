// Skins completas del avatar (decisión 0112): personajes que sustituyen al muñeco entero (cuerpo, cabeza y cara) en vez de
// vestirlo. Se montan sobre el mismo esqueleto que el avatar normal (avatar3d.js, buildModel) y devuelven las mismas
// partes, así que valen todos los gestos, los bailes, la escalada y la vista en primera persona. El estilo es el del
// avatar: cabeza de cubo redondeado, contorno de tinta, sombreado por tonos y detalles pintados en un lienzo.
// Son dibujos propios, hechos con formas básicas: no hay modelos, imágenes ni trazados copiados de nadie. Los personajes
// sí son de terceros (ver los riesgos en la decisión 0112).
// createSkins recibe de avatar3d.js sus utilidades de dibujo y devuelve {identificador: () => personaje}.
export function createSkins(kit){
  const {THREE,add,mat,flat,metal,shade,sphere,capsule,ring,limb,box,lathe,paint,drawHand,onHead,HEAD,INK,PAPER,WAIST,NECK,SHOULDER,ELBOW}=kit;
  const O=.03,PI=Math.PI;
  // Azar con semilla: las manchas salen siempre en el mismo sitio.
  const rand=seed=>()=>(seed=seed*16807%2147483647)/2147483647;
  const cone=(r,h,sides=10)=>new THREE.ConeGeometry(r,h,sides);
  const quiet=mesh=>{mesh.castShadow=false;return mesh};
  // Brazos y piernas con dibujo: la textura se reparte por altura. Tal como salen, casi toda se va en los extremos redondos.
  const tall=geometry=>{
    const p=geometry.attributes.position,uv=geometry.attributes.uv;geometry.computeBoundingBox();const {min,max}=geometry.boundingBox;
    for(let i=0;i<p.count;i++)uv.setY(i,(p.getY(i)-min.y)/(max.y-min.y));return geometry;
  };

  // Esqueleto vacío, con las mismas medidas y el mismo orden de partes que el avatar normal.
  function puppet({gap=.18,shoulder=.41,handSize=1.15}={}){
    const model=new THREE.Group(),body=new THREE.Group(),upper=new THREE.Group(),up=new THREE.Group(),neck=new THREE.Group(),head=new THREE.Group();
    model.add(body);upper.position.y=WAIST;up.position.y=-WAIST;upper.add(up);body.add(upper);neck.position.y=NECK;up.add(neck);head.position.y=1.8-NECK;neck.add(head);
    const legs=[],feet=[],arms=[];
    for(const side of [-1,1]){
      const leg=new THREE.Group();leg.position.set(side*gap,.64,0);body.add(leg);legs.push(leg);
      const shoe=new THREE.Group();shoe.position.set(side*gap,0,.07);shoe.rotation.y=side*.14;shoe.userData.home=[side*gap,0,.07];body.add(shoe);feet.push(shoe);
    }
    for(const side of [-1,1]){
      const arm=new THREE.Group(),fore=new THREE.Group(),hand=new THREE.Group();arm.position.set(side*shoulder,SHOULDER,0);arm.rotation.z=side*.34;
      fore.position.y=-ELBOW;fore.rotation.set(-.28,0,side*-.08);arm.add(fore);up.add(arm);hand.position.y=-.2;hand.rotation.y=side*-.7;hand.scale.setScalar(handSize);fore.add(hand);arms.push({arm,fore,hand,side});
    }
    const P={model,body,upper,up,neck,head,legs,feet,arms,eyes:[],sway:[],lips:null,torso:null};
    P.done=()=>({group:model,parts:{body,upper,torso:P.torso,neck,head,arms,legs,feet,eyes:P.eyes,lids:[],lips:P.lips,sway:P.sway},base:0,fem:false});
    return P;
  }
  // Pie de monstruo: empeine, tres dedos gordos y una garra en cada uno.
  function paw(shoe,fur,claw,width=.19,toe=.075){
    add(shoe,box(),fur,[0,.14,0],[width,.13,.27],[],O);
    for(const x of [-1,0,1]){const tip=add(shoe,sphere(toe,16,12),fur,[x*width*.62,.08,.27-Math.abs(x)*.03],[1,.9,1.15],[],.06);add(tip,cone(toe*.36,toe*1.1,8),claw,[0,-.012,toe*1.1],[],[PI/2,0,0])}
  }
  // Lienzo del torso. Se dibuja con proporción real (1 unidad ≈ 4 mm): 512 de ancho (la vuelta entera) por 512 / stretch
  // de alto. F(s) y B(s) = posición horizontal en el frente y en la espalda (s de -1 a 1); Y(v) = altura (v de 0 a 1).
  function wrapTex(draw,stretch=2.6){
    const texture=paint((c,S)=>{c.scale(1,stretch);draw(c,{S,H:S/stretch,F:s=>(.75+s*.25)*S,B:s=>(.25+s*.25)*S,Y:v=>(1-v)*S/stretch})});
    texture.offset.set(.75,0);return texture;
  }
  // Lienzo de la cabeza, en unidades de su superficie: (0, 0) es el centro de la cara, x hacia la derecha de la pantalla e
  // y hacia arriba. La cara ocupa más o menos de -0,6 a 0,6; la nuca queda en x = ±2. La vuelta entera mide HEAD_W.
  const HEAD_W=4.02,HEAD_H=1.84;
  const headTex=draw=>paint((c,S)=>{c.translate(S/4,S/2);c.scale(S/HEAD_W,-S/HEAD_H);draw(c)});
  const skull=(head,texture,material=null)=>add(head,box(HEAD.n),material||mat(null,texture),[],[HEAD.a,HEAD.b,HEAD.c],[],.022);
  // Pelaje: color liso con mechones cortos más oscuros y, si se piden, manchas. where(u, v) = probabilidad de mancha.
  // stretch = cuánto más estirado queda lo vertical que lo horizontal sobre la pieza, para que las manchas salgan redondas.
  function furTex(base,{spot='',spots=0,size=[10,20],where=()=>1,seed=7,S=256,ticks=70,stretch=1}={}){
    return paint((c,W)=>{
      const next=rand(seed),H=W/stretch;c.scale(1,stretch);c.fillStyle=base;c.fillRect(0,0,W,H);
      c.strokeStyle=shade(base,.87);c.lineWidth=W/110;c.lineCap='round';
      for(let i=0;i<ticks;i++){const x=next()*W,y=next()*H,k=W/56;c.beginPath();c.moveTo(x-k,y-k*.6);c.lineTo(x,y+k*.6);c.lineTo(x+k,y-k*.6);c.stroke()}
      c.fillStyle=spot;
      for(let i=0;i<spots;i++){
        const x=next()*W,y=next()*H,r=(size[0]+next()*(size[1]-size[0]))*W/256,turn=next()*PI,squash=.62+next()*.3;
        if(next()>where(x/W,1-y/H))continue;
        for(const dx of [-W,0,W]){c.beginPath();c.ellipse(x+dx,y,r,r*squash,turn,0,7);c.fill()}
      }
    },S);
  }
  // Ojo con blanco, iris y pupila. Parpadea y se abre como los del avatar normal (animate le cambia la escala).
  function eyeball(P,side,{x,y,r,tall=1.15,iris}){
    const eye=new THREE.Group(),inner=new THREE.Group(),[px,py,pz]=onHead(side*x,y,1.004);
    eye.position.set(px,py,pz);eye.scale.set(1,1.55,1);eye.userData.x=px;eye.userData.y=py;inner.scale.y=1/1.55;eye.add(inner);P.head.add(eye);P.eyes.push(eye);
    quiet(add(inner,sphere(r),flat(PAPER),[],[1,tall,.3],[],.1));
    quiet(add(inner,sphere(r*.62),flat(iris),[side*-.012,0,r*.2],[1,1,.3]));
    quiet(add(inner,sphere(r*.34),flat(INK),[side*-.012,0,r*.33],[1,1,.3]));
    quiet(add(inner,sphere(r*.14),flat(PAPER),[side*-.04,r*.24,r*.46],[1,.8,.3]));
    return eye;
  }
  // Sonrisa: un arco de tinta. Guarda lo que animate necesita para darle la vuelta cuando el gesto es de disgusto.
  // El arco se inclina lo justo para apoyarse en la cara por el centro y por las comisuras.
  function smile(P,y,radius,arc,tube=.018){
    const drop=Math.cos(arc/2),low=onHead(0,y-radius,1.015)[2],end=onHead(radius*Math.sin(arc/2),y-radius*drop,1.015)[2],lean=Math.min(.8,Math.max(0,(end-low)/(radius*(1-drop))));
    const lips=quiet(add(P.head,ring(radius,tube,arc),flat(INK),[0,y,low+radius*lean],[],[Math.asin(lean),0,PI+(PI-arc)/2]));
    lips.userData={y:lips.position.y,rz:lips.rotation.z,frown:(PI-arc)/2};P.lips=lips;return lips;
  }

  // ---------- Sulley: monstruo peludo turquesa con manchas moradas, cuernos, cola y garras.
  function sulley(immersive){
    const FUR='#2bb6c9',SPOT='#8d5fc7',P=puppet({gap:.2,shoulder:.44,handSize:1.25});
    const fur=mat(FUR),claw=mat('#eef1f3'),horn=mat('#efe5cb');
    const spotted=(seed,stretch=2)=>mat(null,furTex(FUR,{spot:SPOT,spots:8,size:[20,32],seed,stretch,ticks:36}));
    const limbs=spotted(11),thigh=spotted(31),tailFur=spotted(17,2);
    add(P.body,sphere(),fur,[0,.64,0],[.42,.21,.33],[],O);
    P.legs.forEach((leg,i)=>{const side=i?1:-1;add(leg,tall(capsule(.2,.18)),thigh,[0,-.25,0],[1,1,.98],[],O);add(leg,cone(.06,.16),fur,[side*.19,-.2,-.02],[1,1,.7],[0,0,-side*2.3],.08)});
    P.feet.forEach(shoe=>paw(shoe,fur,claw));
    // Torso de barril: manchas por la espalda y los costados, la barriga limpia.
    const back=u=>{const d=Math.abs(u-.25),turn=Math.min(d,1-d);return 1.05-turn*2.5};
    P.torso=add(P.up,lathe([[0,-.4],[.34,-.4],[.42,-.36],[.46,-.2],[.47,0],[.45,.16],[.4,.28],[.28,.36],[.12,.4],[0,.4]]),mat(null,(()=>{
      const texture=furTex(FUR,{spot:SPOT,spots:34,size:[7,13],where:back,seed:5,S:512,ticks:90,stretch:2.6});texture.offset.set(.75,0);return texture})()),[0,.94,0],[1.06,1,.86],[],O);
    for(const {arm,fore,hand:group,side} of P.arms){
      add(arm,tall(limb(.155,.135,ELBOW)),limbs,[],[],[],O);add(fore,tall(limb(.135,.115,.2)),limbs,[],[],[],O);
      for(const [y,turn,size] of [[.1,1,1.15],[.02,1.45,1]])add(arm,cone(.06*size,.17*size),fur,[side*.11,y,0],[1,1,.7],[0,0,-side*turn],.08);
      for(const [z,turn] of [[-.1,.75],[-.05,1.2]])add(fore,cone(.055,.16),fur,[0,-.02,z],[.7,1,1],[PI+turn,0,0],.08);
      drawHand(group,side,fur,{immersive,claw});
    }
    // Cola gruesa que cae y se levanta en la punta; se balancea con retardo, como las coletas.
    const root=new THREE.Group(),tail=new THREE.Group();root.position.set(0,.62,-.26);root.add(tail);P.body.add(root);P.sway.push(tail);
    for(let i=0;i<8;i++){const t=i/7;add(tail,sphere(.155-t*.095,18,14),tailFur,[0,-.3*Math.sin(t*PI*.78),-.04-i*.095],[],[],.05)}
    // Cabeza: manchas por la nuca y la coronilla.
    skull(P.head,furTex(FUR,{spot:SPOT,spots:70,size:[6,10],where:(u,v)=>v>.8?.9:Math.abs(u-.75)<.2?1:Math.abs(u-.25)<.17?0:.35,seed:23,S:512,ticks:150,stretch:HEAD_W/HEAD_H}));
    for(const side of [-1,1]){
      const base=new THREE.Group();base.position.set(side*.4,.5,-.02);base.rotation.z=-side*.55;P.head.add(base);
      add(base,new THREE.CylinderGeometry(.1,.145,.17,16),horn,[0,.06,0],[],[],.06);add(base,cone(.103,.22,16),horn,[side*-.04,.23,0],[],[0,0,side*.42],.06);
      eyeball(P,side,{x:.2,y:.02,r:.1,tall:1.2,iris:'#6fb9ea'});
      quiet(add(P.head,capsule(.03,.14),flat('#156a82'),onHead(side*.2,.21,1.03),[1,1,.6],[0,0,PI/2-side*.2]));
      for(let i=0;i<3;i++)add(P.head,cone(.06,.17-i*.02),fur,[side*.62,-.2-i*.12,.04-i*.02],[1,1,.7],[0,0,-side*(1.9+i*.25)],.08);
    }
    for(const [x,turn] of [[-.1,.35],[0,0],[.1,-.35]])add(P.head,cone(.055,.16),fur,[x,.6-Math.abs(x)*.25,.14],[1,1,.7],[.35,0,turn],.08);
    add(P.head,sphere(),mat('#1e5a78'),onHead(0,-.115,1),[.105,.068,.06],[],.05);
    quiet(add(P.head,sphere(.02),flat('#9fd3e6'),onHead(-.035,-.09,1.09),[1.4,.8,.5]));
    smile(P,-.2,.2,PI*.72,.02);
    return P.done();
  }

  // ---------- Stitch: criatura azul de orejas enormes con muesca, barriga y contorno de ojos claros, y nariz grande.
  function stitch(immersive){
    const BLUE='#4a8be0',LIGHT='#a9d6f6',DARK='#27408f',NOSE='#1c2b68',PINK='#dd8fc4',P=puppet({gap:.19,shoulder:.42,handSize:1.3});
    const blue=mat(BLUE),claw=mat(DARK);
    add(P.body,sphere(),blue,[0,.64,0],[.4,.2,.33],[],O);
    add(P.body,sphere(.085),blue,[0,.6,-.33],[],[],.06);
    P.legs.forEach(leg=>add(leg,capsule(.17,.18),blue,[0,-.25,0],[1,1,.98],[],O));
    P.feet.forEach(shoe=>paw(shoe,blue,claw,.18,.07));
    // Torso de pera: barriga clara delante y una marca oscura en la espalda.
    P.torso=add(P.up,lathe([[0,-.4],[.33,-.4],[.42,-.34],[.45,-.18],[.43,.02],[.37,.2],[.28,.32],[.14,.39],[0,.4]]),mat(null,wrapTex((c,{S,H,F,B,Y})=>{
      c.fillStyle=BLUE;c.fillRect(0,0,S,H);
      c.fillStyle=LIGHT;c.beginPath();c.ellipse(F(0),Y(.4),66,74,0,0,7);c.fill();
      c.fillStyle=DARK;c.beginPath();c.ellipse(B(0),Y(.66),46,30,0,0,7);c.fill();c.beginPath();c.ellipse(B(0),Y(.36),28,20,0,0,7);c.fill();
    })),[0,.94,0],[1.05,1,.9],[],O);
    for(const {arm,fore,hand:group,side} of P.arms){add(arm,limb(.13,.115,ELBOW),blue,[],[],[],O);add(fore,limb(.115,.1,.2),blue,[],[],[],O);drawHand(group,side,blue,{immersive,claw})}
    // Cabeza: antifaz claro alrededor de los ojos, barbilla clara y una marca oscura en la nuca.
    skull(P.head,headTex(c=>{
      c.fillStyle=BLUE;c.fillRect(-2,-1,7,2);
      c.fillStyle=LIGHT;c.beginPath();c.ellipse(0,-.5,.47,.36,0,0,7);c.fill();
      for(const side of [-1,1]){c.beginPath();c.ellipse(side*.26,.05,.24,.19,side*.5,0,7);c.fill()}
      c.fillStyle=DARK;c.beginPath();c.moveTo(HEAD_W/2,.5);c.bezierCurveTo(HEAD_W/2+.5,.3,HEAD_W/2+.28,-.1,HEAD_W/2,-.28);c.bezierCurveTo(HEAD_W/2-.28,-.1,HEAD_W/2-.5,.3,HEAD_W/2,.5);c.fill();
    }));
    // Orejas: una hoja larga con una muesca en el borde de abajo y el interior rosa. Cuelgan y se balancean con retardo.
    const leaf=new THREE.Shape();leaf.moveTo(-.1,0);leaf.bezierCurveTo(-.26,.25,-.2,.62,.02,.82);leaf.bezierCurveTo(.12,.7,.2,.5,.2,.38);leaf.lineTo(.12,.34);leaf.lineTo(.19,.27);leaf.bezierCurveTo(.18,.14,.14,.05,.1,0);leaf.closePath();
    for(const side of [-1,1]){
      const ear=new THREE.Group(),hold=new THREE.Group();ear.position.set(side*.52,.16,-.06);hold.rotation.set(0,side*-.22,-side*.85);hold.scale.set(side*.88,.88,.88);ear.add(hold);P.head.add(ear);P.sway.push(ear);
      const outer=new THREE.ExtrudeGeometry(leaf,{depth:.05,bevelEnabled:true,bevelThickness:.015,bevelSize:.015,bevelSegments:2,curveSegments:12});outer.computeBoundingBox();
      const mid=outer.boundingBox.getCenter(new THREE.Vector3());outer.translate(-mid.x,-mid.y,-mid.z);
      add(hold,outer,blue,[mid.x,mid.y,0],[],[],.07);
      const inside=new THREE.ShapeGeometry(leaf,12);inside.translate(-mid.x,-mid.y,0);
      quiet(add(hold,inside,mat(PINK),[mid.x+.01,mid.y-.02,.044],[.66,.7,1]));
      // Ojos negros, grandes y rasgados hacia fuera.
      const eye=new THREE.Group(),inner=new THREE.Group(),slant=new THREE.Group(),[px,py,pz]=onHead(side*.26,.05,1.004);
      eye.position.set(px,py,pz);eye.scale.set(1,1.55,1);eye.userData.x=px;eye.userData.y=py;inner.scale.y=1/1.55;slant.rotation.z=side*.55;inner.add(slant);eye.add(inner);P.head.add(eye);P.eyes.push(eye);
      quiet(add(slant,sphere(.12),flat(INK),[],[1.3,1,.3]));
      quiet(add(slant,sphere(.03),flat(PAPER),[side*-.05,.04,.035],[1.2,1,.3]));quiet(add(slant,sphere(.014),flat(PAPER),[side*.03,-.04,.035],[1,1,.3]));
    }
    for(const [x,turn,size] of [[-.07,.4,.9],[0,0,1.15],[.07,-.4,.9]])add(P.head,cone(.045*size,.15*size),mat(shade(BLUE,.86)),[x,.61-Math.abs(x)*.3,.06],[1,1,.7],[.2,0,turn],.08);
    add(P.head,sphere(),mat(NOSE),onHead(0,-.1,1),[.155,.105,.09],[],.05);
    quiet(add(P.head,sphere(.026),flat('#8fa6e8'),onHead(-.05,-.06,1.13),[1.5,.8,.5]));
    smile(P,-.13,.26,PI*.62);
    return P.done();
  }

  // ---------- Iron Man: armadura roja y dorada de metal pulido, con el reactor del pecho y los ojos encendidos.
  function ironman(immersive){
    const RED='#c2161f',GOLD='#f2b632',GLOW='#e4fbff',P=puppet({gap:.18,shoulder:.44});
    const red=metal(RED),gold=metal('#f6f6f6','or'),glow=flat(GLOW),dark=mat('#2b2f3a'),seam=shade(RED,.5);
    add(P.body,sphere(),red,[0,.64,0],[.34,.17,.27],[],O);
    P.legs.forEach(leg=>{add(leg,capsule(.155,.2),gold,[0,-.24,0],[1,1,.95],[],O);add(leg,sphere(.12,18,14),red,[0,-.37,.07],[1,.85,.7],[],.05)});
    P.feet.forEach(shoe=>{
      add(shoe,box(),red,[0,.15,.02],[.18,.12,.27],[],O);add(shoe,box(),dark,[0,.05,.02],[.19,.052,.285],[],O);
      add(shoe,capsule(.16,.1),red,[0,.33,-.06],[1,1,1.05],[],O);add(shoe,ring(.15,.032),gold,[0,.45,-.06],[1,1.05,1],[PI/2,0,0],O);
      add(shoe,box(),gold,[0,.2,.17],[.13,.05,.1],[-.3,0,0],O);
    });
    P.torso=add(P.up,lathe([[0,-.4],[.29,-.4],[.34,-.37],[.35,-.22],[.37,-.02],[.42,.14],[.4,.27],[.28,.36],[.12,.4],[0,.4]]),metal(null,'cr',wrapTex((c,{S,H,F,B,Y})=>{
      const line=(points,width=2.4,color=seam)=>{c.beginPath();points.forEach(([x,y])=>c.lineTo(x,y));c.lineWidth=width;c.lineJoin=c.lineCap='round';c.strokeStyle=color;c.stroke()};
      const plate=(points,color)=>{c.beginPath();points.forEach(([x,y])=>c.lineTo(x,y));c.closePath();c.fillStyle=color;c.fill();c.lineWidth=2.6;c.lineJoin='round';c.strokeStyle=INK;c.stroke()};
      c.fillStyle=RED;c.fillRect(0,0,S,H);
      c.fillStyle=GOLD;c.fillRect(0,0,S,Y(.9));c.fillStyle=INK;c.fillRect(0,Y(.9)-1.3,S,2.6);
      c.fillStyle=shade(RED,.62);c.fillRect(0,Y(.08),S,H);
      // Placas doradas del abdomen (a los lados) y de la columna.
      for(const s of [-1,1])plate([[F(s*.36),Y(.45)],[F(s*.98),Y(.52)],[F(s*.98),Y(.13)],[F(s*.46),Y(.11)],[F(s*.3),Y(.28)]],GOLD);
      plate([[B(-.13),Y(.84)],[B(.13),Y(.84)],[B(.09),Y(.14)],[B(-.09),Y(.14)]],GOLD);
      for(const v of [.68,.52,.36])line([[B(-.11),Y(v)],[B(.11),Y(v)]],2,INK);
      for(const s of [-1,1])plate([[B(s*.3),Y(.74)],[B(s*.66),Y(.7)],[B(s*.6),Y(.5)],[B(s*.32),Y(.54)]],shade(RED,.78));
      // Pectorales y abdominales.
      line([[F(-.86),Y(.8)],[F(-.16),Y(.84)],[F(0),Y(.77)],[F(.16),Y(.84)],[F(.86),Y(.8)]]);
      line([[F(-.86),Y(.53)],[F(-.22),Y(.47)],[F(0),Y(.51)],[F(.22),Y(.47)],[F(.86),Y(.53)]]);
      for(const v of [.36,.23])line([[F(-.3),Y(v)],[F(.3),Y(v)]],2);
      line([[F(0),Y(.45)],[F(0),Y(.1)]],2);
      c.fillStyle=INK;c.beginPath();c.arc(F(0),Y(.655),25,0,7);c.fill();
    })),[0,.94,0],[1.06,1,.8],[],O);
    // Reactor: un disco encendido con su aro dorado, sobre el pecho.
    quiet(add(P.torso,new THREE.CircleGeometry(.076,28),glow,[0,.215,.42],[1/1.06,1,1],[-.16,0,0]));
    quiet(add(P.torso,ring(.082,.017),gold,[0,.215,.418],[1/1.06,1,1],[-.16,0,0]));
    quiet(add(P.torso,new THREE.CircleGeometry(.034,20),flat('#ffffff'),[0,.215,.425],[1/1.06,1,1],[-.16,0,0]));
    for(const {arm,fore,hand:group,side} of P.arms){
      add(arm,limb(.118,.105,ELBOW),gold,[],[],[],O);add(arm,sphere(),red,[side*.02,.01,0],[.17,.15,.17],[],O);
      add(fore,sphere(.118,18,14),red,[],[],[],.05);add(fore,limb(.13,.115,.2),red,[],[],[],O);add(fore,ring(.118,.022),gold,[0,-.17,0],[],[PI/2,0,0],O);
      drawHand(group,side,red,{immersive});quiet(add(group,new THREE.CircleGeometry(.03,16),glow,[side*-.061,-.045,0],[],[0,-side*PI/2,0]));
    }
    // Casco: la careta dorada, las ranuras de los ojos y las juntas van pintadas; los ojos llevan encima una pieza de luz.
    skull(P.head,null,metal(null,'cr',headTex(c=>{
      const line=(points,width=.02)=>{c.beginPath();points.forEach(([x,y])=>c.lineTo(x,y));c.lineWidth=width;c.lineJoin=c.lineCap='round';c.strokeStyle=INK;c.stroke()};
      c.fillStyle=RED;c.fillRect(-2,-1,7,2);
      for(const dx of [0,-HEAD_W])line([[.42+dx,-.1],[1.2+dx,-.16],[2.01+dx,-.1],[2.82+dx,-.16],[3.6+dx,-.1]]);
      line([[2.01,.9],[2.01,-.1]]);
      c.beginPath();for(const [x,y] of [[-.41,.3],[-.13,.335],[0,.27],[.13,.335],[.41,.3],[.43,-.08],[.28,-.37],[.15,-.48],[-.15,-.48],[-.28,-.37],[-.43,-.08]])c.lineTo(x,y);c.closePath();
      c.fillStyle=GOLD;c.fill();c.lineWidth=.03;c.lineJoin='round';c.strokeStyle=INK;c.stroke();
      for(const s of [-1,1]){
        c.beginPath();for(const [x,y] of [[.065,.045],[.31,.105],[.325,.025],[.075,-.04]])c.lineTo(s*x,y);c.closePath();c.fillStyle=GLOW;c.fill();c.lineWidth=.02;c.strokeStyle=INK;c.stroke();
        line([[s*.43,-.08],[s*.3,-.06],[s*.23,-.22]],.016);line([[s*.14,-.31],[s*.21,-.42]],.016);line([[s*.13,.335],[s*.1,.46]],.016);
      }
      line([[-.14,-.31],[.14,-.31]],.024);
    })));
    const slit=new THREE.Shape();slit.moveTo(0,.04);slit.lineTo(.235,.095);slit.lineTo(.25,.02);slit.lineTo(.01,-.042);slit.closePath();
    for(const side of [-1,1]){
      const hold=new THREE.Group(),[x,y,z]=onHead(side*.068,.004,1.012);hold.position.set(x,y,z);hold.rotation.y=side*.24;hold.scale.x=side;P.head.add(hold);
      quiet(add(hold,new THREE.ShapeGeometry(slit),new THREE.MeshBasicMaterial({color:GLOW,side:THREE.DoubleSide})));
      add(P.head,new THREE.CylinderGeometry(.11,.11,.05,22),red,[side*.635,-.03,-.02],[],[0,0,PI/2],.06);add(P.head,new THREE.CylinderGeometry(.058,.058,.064,18),gold,[side*.635,-.03,-.02],[],[0,0,PI/2]);
    }
    return P.done();
  }

  // ---------- Spider-Man: traje rojo y azul con la telaraña, la araña del pecho y los ojos blancos de la máscara.
  function spiderman(immersive){
    const RED='#d8212c',BLUE='#2557c9',P=puppet({gap:.17,shoulder:.4});
    const red=mat(RED),blue=mat(BLUE);
    // Telaraña sobre una zona: hilos rectos y, entre ellos, tramos que cuelgan.
    const net=(c,x0,y0,x1,y1,step,row,width)=>{
      c.lineWidth=width;c.lineCap='round';c.strokeStyle=INK;c.beginPath();
      for(let x=x0;x<=x1+.001;x+=step){c.moveTo(x,y0);c.lineTo(x,y1)}
      for(let y=y0+row;y<y1+row;y+=row)for(let x=x0;x<x1-.001;x+=step){c.moveTo(x,y-row*.3);c.quadraticCurveTo(x+step/2,y+row*.12,x+step,y-row*.3)}
      c.stroke();
    };
    const web=()=>mat(null,paint((c,S)=>{c.fillStyle=RED;c.fillRect(0,0,S,S);net(c,0,0,S,S,S/6,S/4,S/44)},128));
    // Araña: cuerpo en dos piezas y cuatro patas a cada lado, las de arriba hacia arriba y las de abajo hacia abajo.
    const spider=(c,x,y,k,fat=1)=>{
      c.save();c.translate(x,y);c.scale(k,k);c.fillStyle=c.strokeStyle=INK;c.lineWidth=.085;c.lineJoin='miter';c.lineCap='round';
      c.beginPath();c.ellipse(0,.3,.17*fat,.33,0,0,7);c.fill();c.beginPath();c.arc(0,-.13,.14*fat,0,7);c.fill();
      for(const s of [-1,1])for(const leg of [[[.1,-.16],[.5,-.38],[.58,-.8]],[[.1,-.08],[.64,-.12],[.82,-.52]],[[.1,.04],[.64,.2],[.82,.66]],[[.08,.14],[.42,.46],[.5,.98]]]){c.beginPath();for(const [px,py] of leg)c.lineTo(s*px,py);c.stroke()}
      c.restore();
    };
    add(P.body,sphere(),blue,[0,.64,0],[.33,.16,.26],[],O);
    P.legs.forEach(leg=>add(leg,capsule(.13,.3),blue,[0,-.28,0],[1,1,.95],[],O));
    const boots=web(),soles=mat(shade(RED,.62));
    P.feet.forEach(shoe=>{add(shoe,box(),red,[0,.14,.02],[.16,.11,.26],[],O);add(shoe,box(),soles,[0,.042,.02],[.168,.04,.272],[],O);add(shoe,tall(capsule(.15,.07)),boots,[0,.29,-.07],[],[],O)});
    P.torso=add(P.up,lathe([[0,-.4],[.27,-.4],[.31,-.36],[.32,-.2],[.34,0],[.385,.15],[.365,.27],[.26,.36],[.12,.4],[0,.4]]),mat(null,wrapTex((c,{S,H,F,B,Y})=>{
      c.fillStyle=BLUE;c.fillRect(0,0,S,H);
      // Rojo: hombros, una banda que baja por el centro del pecho y de la espalda, y el cinturón.
      const zone=new Path2D(),edge=new Path2D();zone.rect(0,0,S,Y(.74));zone.rect(0,Y(.075),S,H);
      for(const [at,wide,narrow] of [[F,.44,.34],[B,.5,.4]]){
        zone.moveTo(at(-1),Y(.74));zone.lineTo(at(-wide),Y(.5));zone.lineTo(at(-narrow),Y(.075));zone.lineTo(at(narrow),Y(.075));zone.lineTo(at(wide),Y(.5));zone.lineTo(at(1),Y(.74));zone.closePath();
        for(const s of [-1,1]){edge.moveTo(at(s),Y(.74));edge.lineTo(at(s*wide),Y(.5));edge.lineTo(at(s*narrow),Y(.075));edge.lineTo(at(s),Y(.075))}
      }
      c.fillStyle=RED;c.fill(zone);c.save();c.clip(zone);net(c,0,0,S,H,16,15,1.7);c.restore();
      c.lineWidth=2.6;c.lineJoin='round';c.strokeStyle=INK;c.stroke(edge);
      spider(c,F(0),Y(.6),36);spider(c,B(0),Y(.5),46,1.5);
    })),[0,.94,0],[1.06,1,.78],[],O);
    const sleeves=web();
    for(const {arm,fore,hand:group,side} of P.arms){add(arm,tall(limb(.115,.1,ELBOW)),sleeves,[],[],[],O);add(arm,sphere(.125,18,14),sleeves,[0,.005,0],[],[],.05);add(fore,tall(limb(.1,.086,.2)),sleeves,[],[],[],O);drawHand(group,side,red,{immersive})}
    // Máscara: la telaraña nace entre los ojos y da la vuelta a la cabeza.
    skull(P.head,headTex(c=>{
      c.fillStyle=RED;c.fillRect(-2,-1,7,2);c.lineWidth=.017;c.lineCap='round';c.strokeStyle=INK;
      const N=20,rings=[.13,.27,.43,.62,.84,1.08,1.34,1.62,1.92,2.24,2.58];
      for(const dx of [-HEAD_W,0,HEAD_W]){
        c.beginPath();
        for(let i=0;i<N;i++){
          const a=(i+.5)/N*PI*2,b=(i+1.5)/N*PI*2,m=(a+b)/2;c.moveTo(dx,.03);c.lineTo(dx+Math.cos(a)*2.9,.03+Math.sin(a)*2.9);
          for(const r of rings){c.moveTo(dx+Math.cos(a)*r,.03+Math.sin(a)*r);c.quadraticCurveTo(dx+Math.cos(m)*r*.84,.03+Math.sin(m)*r*.84,dx+Math.cos(b)*r,.03+Math.sin(b)*r)}
        }
        c.stroke();
      }
    }));
    // Ojos: lágrima blanca con un borde negro ancho. Se entornan al parpadear, como en las películas.
    const lens=new THREE.Shape();lens.moveTo(-.15,-.085);lens.bezierCurveTo(-.11,.06,.02,.175,.17,.155);lens.bezierCurveTo(.2,.02,.11,-.1,-.02,-.125);lens.bezierCurveTo(-.07,-.13,-.115,-.115,-.15,-.085);
    for(const side of [-1,1]){
      const eye=new THREE.Group(),inner=new THREE.Group(),[px,py,pz]=onHead(side*.25,.01,1.02);
      eye.position.set(px,py,pz);eye.scale.set(1,1.55,1);eye.userData.x=px;eye.userData.y=py;inner.scale.set(side,1/1.55,1);inner.rotation.y=side*.3;eye.add(inner);P.head.add(eye);P.eyes.push(eye);
      quiet(add(inner,new THREE.ShapeGeometry(lens,16),new THREE.MeshBasicMaterial({color:INK,side:THREE.DoubleSide}),[],[1.12,1.12,1]));
      quiet(add(inner,new THREE.ShapeGeometry(lens,16),new THREE.MeshBasicMaterial({color:PAPER,side:THREE.DoubleSide}),[.008,.006,.006],[.76,.74,1]));
    }
    return P.done();
  }
  return {sulley,stitch,ironman,spiderman};
}

// Reacciones del reto diario (decisión 0029): el avatar acompaña a la tarjeta, y cada respuesta tiene su gesto, su sonido
// y, si es un acierto, su celebración. app.js avisa con el evento faraday:view de lo que acaba de pintar; aquí se decide
// qué hace el avatar (avatar3d.js lo anima), qué suena (sound.js, sin archivos) y qué se ve encima de la tarjeta.
//
// Mientras se responde, el avatar está nervioso. Al confirmar, espera con las manos en la boca mientras el multiplicador
// cuenta, y reacciona cuando la cifra se para: así no la destripa. Al repasar una respuesta ya dada solo se queda con el
// ánimo que le tocó, sin sonido ni confeti.
(()=>{
  const stage=document.getElementById('game-avatar'),shell=document.getElementById('game-shell'),mute=document.getElementById('game-sound');
  if(!stage||!shell||!window.Avatar||!window.Sound)return;
  const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
  // Vibración (solo en móviles que la tienen). El navegador la bloquea si todavía no ha habido un toque real.
  const buzz=pattern=>{try{if(navigator.userActivation?.hasBeenActive!==false)navigator.vibrate?.(pattern)}catch{}};

  // Tramos del multiplicador, de mejor a peor. max = primer valor que ya no entra; clip = gesto al conocer el resultado;
  // rest = ánimo con el que se queda después; label = lo que dice la etiqueta en los aciertos.
  const TIERS=[
    {id:'clavada',max:1.2,clip:'clavada',rest:'cheer',label:'¡Clavada!'},
    {id:'acierto',max:1.9,clip:'salto',rest:'cheer',label:'¡Casi casi!'},
    {id:'cerca',max:5,clip:'casi',rest:''},
    {id:'lejos',max:10,clip:'encoger',rest:'meh'},
    {id:'fallo',max:20,clip:'facepalm',rest:'sad'},
    {id:'desastre',max:100,clip:'horror',rest:'sad'},
    {id:'ko',max:Infinity,clip:'desmayo',rest:'ko'}
  ];
  const tierOf=factor=>TIERS.find(tier=>factor<tier.max)||TIERS[TIERS.length-1];
  const isHit=tier=>!!tier.label;

  // ---------- Avatar: un solo hueco animado junto a la tarjeta, que se conserva de una pregunta a otra.
  let lookKey='';
  function mount(){
    const look=window.Progress?.look?.();if(!look)return null;
    const key=JSON.stringify(look);
    if(key!==lookKey||!stage.firstElementChild){lookKey=key;stage.innerHTML=Avatar.render(look,{zoom:'stage',live:true,turn:.3})}
    return stage.firstElementChild;
  }
  function act(state){const el=mount();if(!el)return;el._react=state;window.Avatar3D?.react?.(el)}

  // ---------- Sonido. Todo son tonos y ruido de sound.js; nada dura más de un par de segundos.
  const tone=(...args)=>Sound.tone(...args),noise=(...args)=>Sound.noise(...args);
  const sfx={
    // Mientras el multiplicador cuenta: clics que suben de tono y se van espaciando, como una ruleta que frena.
    count(ms){
      const span=(ms-420)/1000,n=Math.round(9+span*7);
      for(let i=0;i<n;i++){const v=i/n;tone(392*2**(v*1.25),.42+span*v**1.9,.05,{type:'triangle',gain:.014+.014*v})}
    },
    // Acierto. Tres capas: un golpe grave (peso), un arpegio mayor rápido (subida) y una campana que se queda sonando
    // (premio). Cada acierto seguido en el mismo día sube el tono un escalón: el tercero suena más alto que el primero.
    // La clavada alarga el arpegio, cierra con acorde y deja caer un reguero de brillos.
    hit(perfect,streak){
      const root=523.25*2**(Math.min(streak,3)*2/12),ratios=perfect?[1,1.26,1.5,2,2.52,3]:[1,1.26,1.5,2],step=.062,end=ratios.length*step;
      tone(root/4,0,.2,{to:root/8,gain:.15});noise(0,.14,{from:3500,to:9000,gain:.035,filter:'highpass'});
      ratios.forEach((ratio,i)=>tone(root*ratio,i*step,.2,{type:'triangle',gain:.05+i*.004}));
      [[1,.075,1.3],[2,.03,.9],[3.01,.014,.6],[4.2,.008,.4]].forEach(([k,gain,length])=>tone(root*2*k,end,length,{gain}));
      if(!perfect)return;
      [1,1.26,1.5].forEach(ratio=>tone(root*ratio,end,1.4,{type:'triangle',gain:.034}));tone(root/4,end,1.1,{gain:.12});
      noise(end,1.1,{from:7000,to:10000,gain:.022,filter:'highpass'});
      for(let i=0;i<12;i++)tone(root*4*[1,1.125,1.26,1.5,1.68,2][Math.random()*6|0],end+.12+i*.075+Math.random()*.03,.09,{gain:.02});
    },
    // Por poco: dos notas blandas que bajan un tono. No castiga.
    near(){tone(494,0,.13,{type:'triangle',gain:.045});tone(440,.11,.24,{type:'triangle',gain:.045})},
    // Lejos: un «mmm» que baja una tercera.
    far(){tone(349,0,.16,{type:'triangle',gain:.05});tone(294,.15,.34,{type:'triangle',gain:.05,to:277})},
    // Fallo: dos notas que se desinflan.
    miss(){tone(262,0,.26,{type:'triangle',gain:.055,to:247});tone(196,.27,.5,{type:'triangle',gain:.055,to:165});tone(98,.27,.5,{gain:.06,to:82})},
    // Desastre: el trombón triste de toda la vida, cuatro notas que bajan y la última se cae.
    disaster(){[311,294,277].forEach((f,i)=>{tone(f,i*.3,.27,{type:'sawtooth',gain:.02});tone(f,i*.3,.27,{type:'triangle',gain:.05})});tone(262,.9,.9,{type:'sawtooth',gain:.02,to:175});tone(262,.9,.9,{type:'triangle',gain:.05,to:175})},
    // Desmayo: silbido que cae mientras da la vuelta…
    swoon(){tone(1500,.5,1.55,{gain:.045,to:190});tone(1508,.5,1.55,{gain:.02,to:194})},
    // …golpe contra el suelo…
    thud(){tone(120,0,.34,{to:42,gain:.22});noise(0,.16,{from:380,gain:.09,filter:'lowpass'})},
    // …y pajaritos.
    birds(){for(let i=0;i<6;i++){const at=i*.17+(i%2)*.05;tone(2300+(i%3)*260,at,.07,{gain:.018,to:2900+(i%3)*260})}}
  };
  const FAIL_SOUND={cerca:sfx.near,lejos:sfx.far,fallo:sfx.miss,desastre:sfx.disaster};

  // ---------- Confeti sobre un lienzo propio que cubre el juego y no recibe clics.
  const COLORS=['#ffdb70','#ff6548','#fff8ec','#3fc5f0','#2fd67b','#b49bff'];
  let canvas=null,pen=null,parts=[],frameId=0,width=0,height=0;
  function fit(){
    if(!canvas){canvas=document.createElement('canvas');canvas.className='game-fx';canvas.setAttribute('aria-hidden','true');shell.append(canvas);pen=canvas.getContext('2d')}
    const ratio=Math.min(2,window.devicePixelRatio||1);width=canvas.clientWidth;height=canvas.clientHeight;canvas.width=width*ratio;canvas.height=height*ratio;pen.setTransform(ratio,0,0,ratio,0,0);
  }
  function frame(){
    pen.clearRect(0,0,width,height);parts=parts.filter(p=>p.life<p.max&&p.y<height+40);
    for(const p of parts){
      p.life++;p.vy+=p.gravity;p.vx*=.985;p.vy*=.985;p.x+=p.vx;p.y+=p.vy;p.turn+=p.spin;
      pen.globalAlpha=Math.min(1,(1-p.life/p.max)*2);pen.fillStyle=p.color;pen.save();pen.translate(p.x,p.y);pen.rotate(p.turn);
      if(p.shape===1){pen.beginPath();pen.arc(0,0,p.size*.7,0,7);pen.fill()}else pen.fillRect(-p.size,-p.size*.5*Math.abs(Math.cos(p.turn*1.7)),p.size*2,p.size*Math.abs(Math.cos(p.turn*1.7))+1);
      pen.restore();
    }
    pen.globalAlpha=1;frameId=parts.length?requestAnimationFrame(frame):0;
  }
  const add=p=>{parts.push({life:0,turn:Math.random()*6,spin:(Math.random()-.5)*.5,size:3+Math.random()*4,shape:parts.length%4===0?1:0,color:COLORS[parts.length%COLORS.length],...p});if(!frameId)frameId=requestAnimationFrame(frame)};
  // Estallido hacia arriba desde un punto.
  function burst(x,y,count,power){for(let i=0;i<count;i++){const angle=-Math.PI/2+(Math.random()-.5)*2.5,speed=power*(.3+Math.random());add({x,y,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed,gravity:.24,max:70+Math.random()*60})}}
  function rain(count){for(let i=0;i<count;i++)add({x:Math.random()*width,y:-20-Math.random()*height*.4,vx:(Math.random()-.5)*2,vy:2+Math.random()*3,gravity:.035,max:230})}
  function clearFx(){cancelAnimationFrame(frameId);frameId=0;parts=[];pen?.clearRect(0,0,width,height)}

  // ---------- Lo que se ve en la tarjeta
  const card=()=>shell.querySelector('.game-card');
  const FLAGS=['is-hit','is-perfect','is-thud'];
  // La etiqueta «Te pasaste» / «Corto» pasa a decir «¡Casi casi!» o «¡Clavada!» y se pone del color del multiplicador.
  function crown(tier,pop){
    const chip=shell.querySelector('#game-content .verdict-chip'),number=shell.querySelector('#game-content .verdict-x');if(!chip)return;
    chip.classList.add('is-hit');chip.classList.toggle('pop',pop);if(chip.lastChild?.nodeType===3)chip.lastChild.textContent=' '+tier.label;
    if(pop)number?.classList.add('is-hit');
  }
  function celebrate(tier,streak){
    const perfect=tier.id==='clavada';
    sfx.hit(perfect,streak);buzz(perfect?[14,50,14,50,30]:[14,50,22]);crown(tier,!reduced());
    if(reduced())return;
    card()?.classList.add(perfect?'is-perfect':'is-hit');
    const number=shell.querySelector('#game-content .verdict-x')?.getBoundingClientRect();if(!number)return;
    fit();const origin=shell.getBoundingClientRect(),x=number.left+number.width/2-origin.left,y=number.top+number.height/2-origin.top;
    burst(x,y,perfect?110:60,perfect?15:12);
    if(perfect){later(220,()=>burst(x,y,70,18));later(350,()=>rain(90))}
  }

  // ---------- Guion
  let timers=[];
  const later=(ms,fn)=>timers.push(setTimeout(fn,ms));
  function reset(){timers.forEach(clearTimeout);timers=[];card()?.classList.remove(...FLAGS)}
  function reveal(tier,streak){
    if(tier.id==='ko'){
      // El desmayo dura 3,4 s: el silbido acompaña a la vuelta y el golpe llega cuando toca el suelo.
      act({mood:'',clip:'desmayo',then:'ko'});
      if(reduced()){sfx.thud();return}
      sfx.swoon();later(2580,()=>{sfx.thud();buzz(70);card()?.classList.add('is-thud')});later(3150,sfx.birds);
      return;
    }
    act(isHit(tier)?{mood:tier.rest,clip:tier.clip}:{mood:'',clip:tier.clip,then:tier.rest});
    if(isHit(tier))celebrate(tier,streak);else FAIL_SOUND[tier.id]?.();
  }
  document.addEventListener('faraday:view',({detail})=>{
    reset();
    if(detail.view==='closed'){clearFx();return}
    if(detail.view==='question'){act({mood:'nervous'});return}
    if(detail.view==='summary'){act({mood:tierOf(detail.average).rest});return}
    const tier=tierOf(detail.factor);
    if(!detail.fresh){act({mood:tier.rest});if(isHit(tier))crown(tier,false);return}
    Sound.context();Sound.resume();
    act({mood:'wait'});
    if(detail.settle)sfx.count(detail.settle);
    later(detail.settle||260,()=>reveal(tier,detail.streak||0));
  });

  // Botón de sonido de la barra del juego: el ajuste es el mismo que en los duelos y los cofres.
  if(mute){
    const paint=()=>mute.setAttribute('aria-pressed',String(Sound.on));paint();
    mute.addEventListener('click',()=>{if(Sound.toggle())sfx.near()});
    document.addEventListener('faraday:sonido',paint);
  }
})();

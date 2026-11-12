// Apertura de un cofre (decisiones 0027 y 0034): la pantalla que se ve desde que cae el cofre hasta el resumen de premios.
// Los premios ya están sorteados y guardados cuando esto empieza (progress.js): aquí solo se enseñan. Cerrar, saltar o
// recargar no cambia nada, y lo que se ve en cada carta es exactamente lo que ha tocado.
//
// Fases: entra el cofre → tres toques lo cargan → sube la tensión → la luz toma el color de la mejor rareza →
// un instante de silencio → estalla → salen las cartas boca abajo → se giran de una en una → resumen.
// Con «reducir movimiento» activado se va directamente al resumen.
(()=>{
  const COLOR={comun:'#efe7d4',especial:'#3fa9f5',rara:'#9a7df0',epica:'#ff6548',legendaria:'#ffc93c'};
  // Duraciones en milisegundos. Hasta el estallido pasan unos dos segundos desde el último toque.
  const T={drop:800,riser:1100,hint:400,hush:230,burst:750,deal:160,flip:520,walkSlot:700,walkRarity:850};
  const TAPS=3,PARTICLES=[60,90,120,160,200];
  const PLURAL={comun:'comunes',especial:'especiales',rara:'raras',epica:'épicas',legendaria:'legendarias'};
  const int=n=>new Intl.NumberFormat('es-ES',{maximumFractionDigits:0,useGrouping:'always'}).format(n);
  const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
  // Vibración (solo en móviles que la tienen). El navegador la bloquea si todavía no ha habido un toque real.
  const buzz=pattern=>{try{if(navigator.userActivation?.hasBeenActive!==false)navigator.vibrate?.(pattern)}catch{}};
  // Color con el que brilla un premio: el de su rareza. Los faradios brillan como lo común, salvo que sustituyan a una pieza.
  const glowOf=reward=>reward.kind==='item'?reward.rarity:reward.instead||'comun';
  const rank=rarity=>Math.max(0,Chests.rank(rarity));

  // Dibujo del cofre. La tapa va en su propio grupo para poder abrirla; los colores salen de data-type (chest.css).
  const art=type=>`<svg class="chest-art" data-type="${type}" viewBox="0 0 200 190" aria-hidden="true" focusable="false"><ellipse class="ca-shadow" cx="100" cy="177" rx="74" ry="9"/><ellipse class="ca-glow" cx="100" cy="92" rx="72" ry="28"/><g class="ca-body" stroke="#1b1f27" stroke-width="5" stroke-linejoin="round"><rect x="26" y="88" width="148" height="80" rx="12" fill="var(--c1)"/><path d="M26 88H174V108H26Z" fill="var(--c2)"/><path d="M46 88H62V168H46ZM138 88H154V168H138Z" fill="var(--c2)"/></g><g class="ca-lid" stroke="#1b1f27" stroke-width="5" stroke-linejoin="round"><path d="M26 92V66Q26 28 100 28Q174 28 174 66V92Z" fill="var(--c1)"/><path d="M46 92V45Q54 39 62 36V92ZM154 92V45Q146 39 138 36V92Z" fill="var(--c2)"/><path d="M36 62Q58 40 98 37" fill="none" stroke="#fff" stroke-linecap="round" opacity=".5"/><circle cx="100" cy="92" r="17" fill="var(--c3)"/><path d="M104 79L91 95H100L96 106L110 89H101Z" fill="var(--c4)" stroke="none"/></g></svg>`;

  // Sonidos de la apertura, hechos con los tonos y el ruido de sound.js.
  const tone=(...args)=>Sound.tone(...args),noise=(...args)=>Sound.noise(...args);
  const sfx={
    land:()=>{tone(110,0,.24,{to:48,gain:.16});noise(0,.12,{from:320,gain:.05,filter:'lowpass'})},
    // Cada toque suena más agudo que el anterior.
    charge:n=>{tone(170+n*95,0,.24,{type:'triangle',gain:.07,to:250+n*140});noise(0,.2,{from:800+n*600,to:2200+n*1000,gain:.035})},
    // Tensión: un barrido que sube mientras el ruido se abre.
    riser:()=>{const s=T.riser/1000;tone(200,0,s,{type:'sawtooth',gain:.026,to:800});tone(100,0,s,{gain:.05,to:400});noise(0,s,{from:400,to:6000,gain:.05,q:2,attack:s*.7})},
    // Pista de rareza: un destello agudo, más alto cuanto mejor es lo que viene.
    hint:level=>[0,1,2].forEach(i=>tone(1175*2**(level*2/12)*(1+i*.5),i*.05,.36,{gain:.022})),
    burst:()=>{tone(120,0,.5,{to:45,gain:.22});noise(0,.45,{from:5000,to:300,gain:.12,filter:'lowpass'});noise(.02,.7,{from:6000,to:9000,gain:.03,filter:'highpass'})},
    deal:at=>noise(at,.14,{from:1800,to:500,gain:.04}),
    flip:()=>{noise(0,.1,{from:2600,to:900,gain:.04});tone(420,0,.08,{gain:.03})},
    coin:i=>tone(1568+(i%3)*196,0,.07,{type:'triangle',gain:.028}),
    drum:()=>{tone(90,0,.3,{to:50,gain:.16});tone(90,.34,.3,{to:50,gain:.12})},
    // Fanfarria: arpegio mayor (1 – 1,26 – 1,5 – 2…) con una nota más por nivel de rareza, para que la celebración
    // sea proporcional al premio. Las épicas y legendarias terminan en un acorde sostenido.
    fanfare(level){
      const ratios=[1,1.26,1.5,2,2.52,3],notes=2+level,gain=.045+level*.008;
      for(let i=0;i<notes;i++)tone(523.25*ratios[i],i*.085,.34,{type:'triangle',gain});
      if(level>=3){const at=notes*.085;[1,1.26,1.5,2].forEach(ratio=>tone(523.25*ratio*(level>3?2:1),at,1.1,{type:'triangle',gain:.04}));tone(65.4,at,1,{gain:.14});noise(at,1,{from:7000,to:9500,gain:.025,filter:'highpass'})}
    },
    coins:()=>{tone(784,0,.12,{type:'triangle',gain:.04});tone(1047,.08,.2,{type:'triangle',gain:.04})}
  };

  // Partículas sobre un lienzo propio: chispas, puntos y confeti que caen con gravedad y se apagan.
  function particles(canvas){
    const pen=canvas.getContext('2d');let list=[],frameId=0,width=0,height=0;
    function size(){const ratio=Math.min(2,window.devicePixelRatio||1);width=canvas.clientWidth;height=canvas.clientHeight;canvas.width=width*ratio;canvas.height=height*ratio;pen.setTransform(ratio,0,0,ratio,0,0)}
    function frame(){
      pen.clearRect(0,0,width,height);list=list.filter(p=>p.life<p.max&&p.y<height+40);
      for(const p of list){
        p.life++;p.vy+=p.gravity;p.vx*=.985;p.vy*=.985;p.x+=p.vx;p.y+=p.vy;p.turn+=p.spin;
        pen.globalAlpha=Math.min(1,(1-p.life/p.max)*1.8);pen.fillStyle=p.color;pen.save();pen.translate(p.x,p.y);pen.rotate(p.turn);
        if(p.shape===0)pen.fillRect(-p.size*2,-p.size/3,p.size*4,p.size/1.5);else if(p.shape===1){pen.beginPath();pen.arc(0,0,p.size,0,7);pen.fill()}else pen.fillRect(-p.size,-p.size*.6,p.size*2,p.size*1.2);
        pen.restore();
      }
      pen.globalAlpha=1;frameId=list.length?requestAnimationFrame(frame):0;
    }
    const add=p=>{list.push({life:0,turn:Math.random()*6,spin:(Math.random()-.5)*.4,size:2+Math.random()*4,shape:list.length%3,...p});if(!frameId)frameId=requestAnimationFrame(frame)};
    // Estallido desde un punto, en todas direcciones.
    function burst(x,y,count,colors,{power=10,gravity=.2,lift=2,life=75}={}){
      for(let i=0;i<count;i++){const angle=Math.random()*Math.PI*2,speed=power*(.25+Math.random());add({x,y,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed-lift,gravity,color:colors[i%colors.length],max:life*(.6+Math.random()*.8)})}
    }
    // Lluvia de confeti desde arriba.
    function rain(count,colors){for(let i=0;i<count;i++)add({x:Math.random()*width,y:-20-Math.random()*height*.5,vx:(Math.random()-.5)*2,vy:2+Math.random()*3,gravity:.04,color:colors[i%colors.length],max:220,shape:2})}
    return {size,burst,rain,stop(){cancelAnimationFrame(frameId);frameId=0;list=[]}};
  }

  let stage=null;
  // rewards: premios ya preparados por progress.js ({kind:'coins', amount, instead?} o {kind:'item', rarity, name,
  // slot, art, figure, key}). more: cofres que quedan por abrir. onEquip(key) pone la pieza; onMore abre el siguiente.
  function play(type,rewards,{more=0,onMore,onClose,onEquip}={}){
    if(stage)return;
    const chest=Chests.CHESTS[type],opener=document.activeElement,timers=[],calm=reduced();
    const best=rewards.reduce((top,reward)=>rank(glowOf(reward))>rank(top)?glowOf(reward):top,'comun');
    let phase='enter',charge=0,flipped=0;
    const later=(fn,ms)=>timers.push(setTimeout(fn,ms));
    stage=document.createElement('div');stage.className='chest-stage';stage.dataset.type=type;stage.dataset.phase=phase;stage.dataset.charge='0';
    stage.setAttribute('role','dialog');stage.setAttribute('aria-modal','true');stage.setAttribute('aria-label',`Abrir cofre ${chest.name}`);
    stage.innerHTML=`<canvas class="chest-fx" aria-hidden="true"></canvas><div class="chest-rays" aria-hidden="true"></div><div class="chest-flash" aria-hidden="true"></div>
<div class="chest-bar"><button type="button" class="chest-mute" aria-pressed="${Sound.on}" aria-label="Sonido"><span aria-hidden="true">♪</span></button><button type="button" class="chest-skip">Saltar</button></div>
<div class="chest-scene"><p class="chest-kicker">Cofre ${chest.name}</p><button type="button" class="chest-box" aria-label="Tocar para abrir el cofre ${chest.name}">${art(type)}</button><p class="chest-hint">Toca para abrir · ${rewards.length} premios</p><p class="chest-pips" aria-hidden="true">${'<i></i>'.repeat(TAPS)}</p></div>
<div class="chest-cards" hidden></div><div class="chest-walk" hidden></div><div class="chest-summary" hidden></div><p class="sr-only" aria-live="polite"></p>`;
    document.body.append(stage);document.body.classList.add('chest-on');
    const find=selector=>stage.querySelector(selector),box=find('.chest-box'),cards=find('.chest-cards'),walk=find('.chest-walk'),summary=find('.chest-summary'),live=find('[aria-live]');
    const fx=particles(find('.chest-fx'));fx.size();
    const palette=rarity=>[COLOR[rarity],'#ffffff',COLOR[rarity],'#ffdb70'];
    const center=element=>{const rect=element.getBoundingClientRect();return [rect.left+rect.width/2,rect.top+rect.height/2]};
    const set=name=>{phase=name;stage.dataset.phase=name};
    const describe=reward=>reward.kind==='coins'?`${int(reward.amount)} faradios`:`${reward.name}, ${reward.slot}, ${Chests.LABEL[reward.rarity]}`;

    // 1. El cofre cae y se queda esperando.
    function enter(){later(()=>sfx.land(),T.drop*.5);later(()=>{set('ready');box.focus()},T.drop)}
    // 2. Tres toques lo cargan. Solo abren: el premio ya está decidido.
    function tap(){
      if(phase!=='ready')return;
      charge++;stage.dataset.charge=charge;box.classList.remove('hit');void box.offsetWidth;box.classList.add('hit');
      sfx.charge(charge);buzz(15);fx.burst(...center(box),8*charge,['#ffffff','#ffdb70'],{power:5+charge*2,life:40});
      if(charge>=TAPS)rumble();
    }
    // 3. Tensión, 4. pista de rareza y silencio, 5. estallido.
    function rumble(){set('rumble');sfx.riser();later(hint,T.riser)}
    function hint(){stage.dataset.rarity=best;set('hint');sfx.hint(rank(best));later(()=>{set('hush');later(burst,T.hush)},T.hint)}
    function burst(){
      set('burst');sfx.burst();buzz([30,30,80]);
      const [x,y]=center(box);fx.burst(x,y-20,PARTICLES[rank(best)],palette(best),{power:9+rank(best)*2.5,lift:5});
      later(deal,T.burst);
    }
    // 6. Las cartas salen boca abajo, con el brillo de su rareza.
    const front=reward=>reward.kind==='coins'
      ?`<span class="card-coin" aria-hidden="true">≈</span><b class="card-amount" data-to="${reward.amount}">${calm?int(reward.amount):0}</b><small>faradios</small>${reward.instead?`<em>Ya tienes todas las ${PLURAL[reward.instead]}</em>`:''}`
      :`<span class="card-art">${reward.art}</span><b class="card-name">${reward.name}</b><small class="card-rarity">${Chests.LABEL[reward.rarity]}</small><em>${reward.slot}</em>`;
    function deal(){
      set('cards');cards.hidden=false;
      cards.innerHTML=`<p class="chest-kicker">Toca cada carta</p><div class="chest-hand" data-count="${rewards.length}">${rewards.map((reward,i)=>`<button type="button" class="chest-card" data-index="${i}" data-glow="${glowOf(reward)}" data-state="down" style="--i:${i}" aria-label="Carta ${i+1} de ${rewards.length}: tocar para girar"><span class="card-inner"><span class="card-back"><span aria-hidden="true">≈</span></span><span class="card-front">${front(reward)}</span></span></button>`).join('')}</div><button type="button" class="game-primary chest-next" hidden>Ver premios <span aria-hidden="true">→</span></button>`;
      rewards.forEach((_,i)=>sfx.deal(i*T.deal/1000));
      later(()=>cards.querySelector('.chest-card')?.focus(),rewards.length*T.deal);
    }
    function turned(card,reward){
      card.dataset.state='up';card.setAttribute('aria-label',describe(reward));live.textContent=describe(reward);
      if(++flipped>=rewards.length)later(()=>{const next=find('.chest-next');next.hidden=false;next.focus()},600);
    }
    // 7. Girar una carta. Las piezas épicas y legendarias se presentan antes por pasos.
    function flip(card){
      if(phase!=='cards'||card.dataset.state!=='down')return;
      const reward=rewards[Number(card.dataset.index)],level=rank(glowOf(reward));
      if(reward.kind==='item'&&Chests.high(reward.rarity)){card.dataset.state='walking';present(card,reward);return}
      sfx.flip();turned(card,reward);
      later(()=>{
        fx.burst(...center(card),14+level*14,palette(glowOf(reward)),{power:5+level*1.5,life:50});
        if(reward.kind==='coins'){sfx.coins();count(card.querySelector('.card-amount'),reward.amount)}else sfx.fanfare(level);
      },T.flip*.55);
    }
    function count(element,to){
      const start=performance.now(),ms=Math.min(900,400+to*4);let last=-1;
      const step=now=>{if(!element.isConnected)return;const t=Math.min(1,(now-start)/ms),value=Math.round(to*(1-(1-t)**3));if(value!==last&&value%5===0)sfx.coin(value/5);last=value;element.textContent=int(value);if(t<1)requestAnimationFrame(step)};
      requestAnimationFrame(step);
    }
    // Presentación por pasos de una pieza épica o legendaria: tipo de pieza → rareza → el avatar con ella puesta.
    function present(card,reward){
      const level=rank(reward.rarity);
      set('walk');stage.dataset.rarity=reward.rarity;walk.hidden=false;walk.dataset.glow=reward.rarity;walk.dataset.step='1';
      walk.innerHTML=`<p class="walk-slot">${reward.slot}</p><p class="walk-rarity">${Chests.LABEL[reward.rarity]}</p><div class="walk-figure">${reward.figure}</div><p class="walk-name">${reward.name}</p><button type="button" class="game-primary walk-go" hidden>Continuar <span aria-hidden="true">→</span></button>`;
      sfx.drum();buzz(20);
      later(()=>{walk.dataset.step='2';sfx.hint(level);buzz(30)},T.walkSlot);
      later(()=>{
        walk.dataset.step='3';sfx.fanfare(level);buzz([40,40,120]);
        fx.burst(innerWidth/2,innerHeight*.45,PARTICLES[level],palette(reward.rarity),{power:13,lift:6,life:90});fx.rain(level>3?140:70,palette(reward.rarity));
        live.textContent=describe(reward);
        later(()=>{const go=find('.walk-go');go.hidden=false;go.focus()},900);
      },T.walkSlot+T.walkRarity);
      walk.onclick=event=>{
        if(!event.target.closest('.walk-go'))return;
        walk.hidden=true;walk.innerHTML='';set('cards');stage.dataset.rarity=best;turned(card,reward);
        (cards.querySelector('.chest-card[data-state=down]')||card).focus();
      };
    }
    // 8. Resumen: todo lo que ha tocado, con la opción de ponerse cada pieza.
    function finish(){
      timers.forEach(clearTimeout);timers.length=0;set('summary');stage.dataset.rarity=best;cards.hidden=true;walk.hidden=true;summary.hidden=false;
      summary.innerHTML=`<p class="chest-kicker">Cofre ${chest.name}</p><h2>¡Tus premios!</h2><ul class="chest-loot">${rewards.map((reward,i)=>`<li data-glow="${glowOf(reward)}">${reward.kind==='coins'?`<span class="card-coin" aria-hidden="true">≈</span><b>+${int(reward.amount)} faradios</b>${reward.instead?`<small>Ya tienes todas las ${PLURAL[reward.instead]}</small>`:''}`:`<span class="card-art">${reward.art}</span><b>${reward.name}</b><small class="card-rarity">${Chests.LABEL[reward.rarity]}</small><small>${reward.slot}</small><button type="button" class="chest-wear" data-wear="${i}">Ponérmelo</button>`}</li>`).join('')}</ul>
<div class="chest-actions">${more?`<button type="button" class="game-primary" data-more>Abrir otro (${more}) <span aria-hidden="true">→</span></button>`:''}<button type="button" class="${more?'game-secondary':'game-primary'}" data-done>Listo</button></div>`;
      live.textContent='Premios: '+rewards.map(describe).join('; ');
      find(more?'[data-more]':'[data-done]').focus();
    }
    function close(next){
      timers.forEach(clearTimeout);fx.stop();removeEventListener('resize',fx.size);removeEventListener('keydown',keys,true);
      const node=stage;stage=null;node.classList.add('closing');document.body.classList.remove('chest-on');
      setTimeout(()=>node.remove(),calm?0:220);
      if(opener?.isConnected)opener.focus();
      onClose?.();if(next)onMore?.();
    }
    function keys(event){if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();close()}}
    stage.addEventListener('click',event=>{
      Sound.resume();
      const target=event.target.closest('button');if(!target)return;
      if(target===box){tap();return}
      if(target.classList.contains('chest-card')){flip(target);return}
      if(target.classList.contains('chest-skip')||target.classList.contains('chest-next')){finish();return}
      if(target.classList.contains('chest-mute')){target.setAttribute('aria-pressed',String(Sound.toggle()));return}
      if(target.dataset.wear!==undefined){onEquip?.(rewards[Number(target.dataset.wear)].key);summary.querySelectorAll('.chest-wear').forEach(button=>{if(rewards[Number(button.dataset.wear)].slot===rewards[Number(target.dataset.wear)].slot){button.disabled=false;button.textContent='Ponérmelo'}});target.disabled=true;target.textContent='Puesto ✓';return}
      if(target.hasAttribute('data-more')){close(true);return}
      if(target.hasAttribute('data-done'))close();
    });
    // En window y en captura: Escape cierra el cofre antes de que lo vean el perfil o el duelo que hay debajo.
    addEventListener('keydown',keys,true);addEventListener('resize',fx.size);
    if(calm){finish();sfx.fanfare(rank(best))}else enter();
  }
  window.ChestOpen={play,art,get open(){return !!stage}};
})();

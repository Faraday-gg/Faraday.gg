// El fondo y el propulsor comparten la altura de la partida. La tarjeta vive fuera del lienzo.
(()=>{
  const mounted=new WeakMap(),spaceHeight=6000;
  const zones=[
    {height:0,name:'Plataforma'},
    {height:650,name:'Mar de nubes'},
    {height:2000,name:'Cielo abierto'},
    {height:3900,name:'Borde azul'},
    {height:spaceHeight,name:'Espacio'}
  ];
  const skies=[
    {at:0,zenith:[36,66,107],air:[69,124,155],horizon:[240,181,131]},
    {at:.25,zenith:[22,52,96],air:[51,106,151],horizon:[177,204,207]},
    {at:.55,zenith:[13,31,65],air:[24,65,114],horizon:[94,159,200]},
    {at:.78,zenith:[9,19,44],air:[17,39,78],horizon:[62,109,158]},
    {at:1,zenith:[6,13,33],air:[11,26,57],horizon:[31,57,107]}
  ];
  const clamp=(n,min=0,max=1)=>Math.min(max,Math.max(min,n));
  const mix=(a,b,t)=>a+(b-a)*t;
  const ease=t=>t*t*(3-2*t);
  const between=(value,from,to)=>ease(clamp((value-from)/(to-from)));
  const meters=value=>Math.max(0,Number.isFinite(Number(value))?Number(value):0);
  const zoneFor=height=>zones.findLast(zone=>height>=zone.height).name;
  const quiet=reaction=>({mood:reaction?.then??reaction?.mood??'',quiet:true,repeat:''});
  const random=seed=>{
    const value=Math.sin(seed*108.7+14.6)*19061.34;
    return value-Math.floor(value);
  };
  const stars=Array.from({length:43},(_,i)=>({
    x:.025+random(i*3)*.95,y:.045+random(i*3+1)*.74,
    radius:i%12===0?1.45:.55+random(i*3+2)*.6,gate:.21+random(i+90)*.46
  }));
  const skyColor=(a,b,t)=>{
    return 'rgb('+a.map((component,i)=>Math.round(mix(component,b[i],t))).join(',')+')';
  };

  // El incremento grande aporta recorrido y también lee como un impulso más enérgico.
  function profile(points,bonus=false){
    const strength=bonus?1:mix(.42,.86,clamp((points-10)/90));
    return {strength,duration:Math.round(mix(1560,1150,(strength-.42)/.58))};
  }

  function drawSky(ctx,w,h,p,zoom,pilot){
    const index=skies.findLastIndex(waypoint=>waypoint.at<=p);
    const a=skies[index],b=skies[index+1]??a,t=a===b?0:between(p,a.at,b.at);
    const x=pilot.x,y=pilot.y;
    const sky=ctx.createLinearGradient(w*.16,0,w*.42,h);
    sky.addColorStop(0,skyColor(a.zenith,b.zenith,t));
    sky.addColorStop(.57,skyColor(a.air,b.air,t));
    sky.addColorStop(1,skyColor(a.horizon,b.horizon,t));
    ctx.fillStyle=sky;
    ctx.fillRect(0,0,w,h);

    const light=.20*(1-between(p,.12,.79));
    if(light>.015){
      const sourceY=h*(.66+p*.22),radius=Math.max(h*.65,w*.45);
      const glow=ctx.createRadialGradient(x-w*.10,sourceY,0,x-w*.10,sourceY,radius);
      glow.addColorStop(0,'rgba(255,225,162,'+light+')');
      glow.addColorStop(1,'rgba(255,225,162,0)');
      ctx.fillStyle=glow;
      ctx.fillRect(0,0,w,h);
    }

    const mobile=w<=760;
    for(let i=0;i<stars.length;i+=(mobile?2:1)){
      const star=stars[i],fade=between(p,star.gate,star.gate+.19);
      if(fade===0)continue;
      ctx.globalAlpha=fade*(star.radius>.9?.78:.50);
      ctx.fillStyle=i%5===0?'#ffe2aa':'#d5edfd';
      ctx.beginPath();
      ctx.arc(star.x*w,star.y*h+p*h*.032,star.radius,0,Math.PI*2);
      ctx.fill();
    }
    ctx.globalAlpha=1;

    const land=(1-between(p,0,.145))*(1-zoom*.74);
    if(land>.015){
      const horizon=h*(.67+p*2.2+zoom*.22),rolling=Math.min(h,w)*.054;
      ctx.globalAlpha=land*.72;
      ctx.fillStyle='#2d536a';
      ctx.beginPath();
      ctx.moveTo(0,horizon+rolling*.41);
      ctx.bezierCurveTo(w*.11,horizon-rolling*.68,w*.24,horizon-rolling*.64,w*.36,horizon);
      ctx.bezierCurveTo(w*.49,horizon+rolling*.66,w*.72,horizon+rolling*.29,w,horizon-rolling*.12);
      ctx.lineTo(w,h);ctx.lineTo(0,h);ctx.closePath();ctx.fill();
      ctx.globalAlpha=land*.72;
      ctx.fillStyle='#193a53';
      ctx.beginPath();
      ctx.moveTo(0,horizon+rolling*.99);
      ctx.bezierCurveTo(w*.15,horizon+rolling*.95,w*.32,horizon+rolling*.38,w*.43,horizon+rolling*.81);
      ctx.bezierCurveTo(w*.61,horizon+rolling*1.8,w*.83,horizon+rolling*.84,w,horizon+rolling*1.37);
      ctx.lineTo(w,h);ctx.lineTo(0,h);ctx.closePath();ctx.fill();
      ctx.globalAlpha=1;

      const base=y+pilot.size*.365,pad=pilot.size*.38;
      ctx.globalAlpha=land*(1-zoom);
      ctx.fillStyle='#203348';
      ctx.beginPath();
      ctx.roundRect(x-pad/2,base,pad,Math.max(4,pilot.size*.022),3);
      ctx.fill();
      ctx.fillStyle='#e7b983';
      ctx.fillRect(x-pad*.37,base,pad*.74,1.6);
      ctx.globalAlpha=1;
    }

    const vapor=between(p,.035,.24)*(1-between(p,.35,.7))+.12*(1-between(p,0,.17));
    if(vapor>.018){
      const haze=ctx.createLinearGradient(0,h*.55,0,h);
      haze.addColorStop(0,'rgba(211,231,231,0)');
      haze.addColorStop(1,'rgba(220,237,233,'+vapor*.55+')');
      ctx.fillStyle=haze;
      ctx.fillRect(0,h*.55,w,h*.45);
      for(let i=0;i<3;i++){
        const wave=h*(.64+i*.105+p*.28),depth=h*(.023+i*.011),start=i%2?w*.08:-w*.2;
        ctx.globalAlpha=vapor*(.49-i*.095);
        ctx.fillStyle=i===1?'#b5d5e1':'#e9ece0';
        ctx.beginPath();ctx.moveTo(start,wave+depth);
        ctx.bezierCurveTo(w*.14,wave-depth*.82,w*.31,wave-depth*.7,w*.45,wave-depth*.12);
        ctx.bezierCurveTo(w*.60,wave+depth*.48,w*.81,wave-depth*.45,w*1.03,wave+depth*.09);
        ctx.bezierCurveTo(w*.82,wave+depth*.55,w*.57,wave+depth*1.30,w*.39,wave+depth*.8);
        ctx.bezierCurveTo(w*.18,wave+depth*1.10,w*.07,wave+depth*.67,start,wave+depth);
        ctx.fill();
      }
      ctx.globalAlpha=1;
    }

    const orbit=between(p,.49,.93);
    if(orbit>.015){
      const edge=h*mix(1.21,.95,orbit),arc=h*mix(.235,.41,orbit);
      const curve=()=>{
        ctx.beginPath();
        ctx.moveTo(-w*.12,edge);
        ctx.bezierCurveTo(w*.22,edge-arc,w*.7,edge-arc*.9,w*1.1,edge+h*.04);
      };
      const earth=ctx.createLinearGradient(0,edge-arc,0,h);
      earth.addColorStop(0,'#2b6395');
      earth.addColorStop(.55,'#193f70');
      earth.addColorStop(1,'#11294b');
      ctx.globalAlpha=orbit*.92;
      curve();
      ctx.lineTo(w*1.1,h+40);ctx.lineTo(-w*.12,h+40);ctx.closePath();
      ctx.fillStyle=earth;ctx.fill();
      ctx.globalAlpha=orbit*.20;
      curve();ctx.strokeStyle='#76cce9';ctx.lineWidth=13;ctx.stroke();
      ctx.globalAlpha=orbit*.35;
      curve();ctx.strokeStyle='#82c9ef';ctx.lineWidth=3.5;ctx.stroke();
      ctx.globalAlpha=orbit*.83;
      curve();ctx.strokeStyle='#bbe5f5';ctx.lineWidth=1;ctx.stroke();
      ctx.globalAlpha=1;
    }
  }

  function mount(container,look,{onProgress}={}){
    if(!container||!window.Avatar)return null;
    mounted.get(container)?.destroy();
    container.innerHTML=`<div class="ascension-flight" data-state="idle" aria-hidden="true">
      <canvas class="ascension-flight__sky"></canvas>
      <div class="ascension-flight__pilot">
        <span class="ascension-flight__pack"></span><span class="ascension-flight__avatar"></span>
      </div>
    </div>`;
    const root=container.firstElementChild,canvas=root.querySelector('canvas'),ctx=canvas.getContext('2d');
    const pilot=root.querySelector('.ascension-flight__pilot'),avatar=root.querySelector('.ascension-flight__avatar');
    const motion=matchMedia('(prefers-reduced-motion: reduce)');
    let state='idle',height=0,shown=-1,width=0,viewHeight=0,dpr=1,anchorX=.28,anchorY=.46;
    let viewportSize=1,prepared=false,zoom=0,transition=null,flight=null,lastFlight=null,frame=0,disposed=false;
    let lookKey='',restReaction=quiet();

    function react(reaction=quiet()){
      restReaction=reaction;
      const node=avatar.firstElementChild;
      if(!node)return;
      node._react=reaction;
      window.Avatar3D?.react?.(node);
    }

    function refreshLook(value){
      if(disposed)return;
      const key=JSON.stringify(value||{});
      if(key===lookKey&&avatar.firstElementChild)return;
      lookKey=key;
      avatar.innerHTML=window.Avatar.render(value,{zoom:'flight',live:true,turn:-.43,reaction:restReaction});
    }

    function position(value,boost,lift){
      const p=clamp(value/spaceHeight),mobile=width<=760;
      const zoomScale=mix(1,.67,zoom)*(1-.18*p);
      const size=viewportSize*zoomScale*(state==='overview'?.90:1);
      const rise=Math.min(viewHeight*(mobile?.043:.105),mobile?27:72);
      const drift=Math.min(width*.023,30);
      return {x:width*anchorX+drift*boost,y:viewHeight*anchorY-rise*(zoom*.32+p*.55+lift),size,scale:zoomScale*(state==='overview'?.90:1)};
    }

    function paint(value=height,boost=0,lift=0){
      const whole=Math.floor(value);
      if(whole!==shown){
        shown=whole;
        onProgress?.({height:whole,zone:zoneFor(whole)});
      }
      if(!width||!viewHeight)return;
      const point=position(value,boost,lift);
      pilot.style.transform=`translate3d(${point.x-viewportSize*.5}px,${point.y-viewportSize*.60}px,0) scale(${point.scale}) rotate(${boost*8}deg)`;
      pilot.style.setProperty('--flight-thrust',String(boost));
      if(!ctx)return;
      ctx.setTransform(dpr,0,0,dpr,0,0);
      drawSky(ctx,width,viewHeight,clamp(value/spaceHeight),zoom,point);
    }

    function layout(){
      width=root.clientWidth;viewHeight=root.clientHeight;
      if(!width||!viewHeight)return;
      const mobile=width<=760,css=getComputedStyle(container);
      const read=(name,fallback)=>{
        const value=parseFloat(css.getPropertyValue(name));
        return Number.isFinite(value)?clamp(value/100):fallback;
      };
      anchorX=read('--ascension-pilot-x',mobile?.54:.28);
      anchorY=read('--ascension-pilot-y',mobile?Math.min(.29,clamp(viewHeight*.20,132,167)/viewHeight):.46);
      viewportSize=mobile?clamp(Math.min(width*.56,viewHeight*.32),138,230):clamp(Math.min(width*.32,viewHeight*.48),215,396);
      pilot.style.width=viewportSize+'px';
      dpr=Math.min(window.devicePixelRatio||1,1.5);
      canvas.width=Math.round(width*dpr);canvas.height=Math.round(viewHeight*dpr);
      paint(flight?.sample.height,flight?.sample.boost,flight?.sample.lift);
    }

    function setPhase(value){
      state=value;
      root.dataset.state=value;
    }

    function cancelJob(){
      if(!flight)return;
      const job=flight;
      flight=null;
      job.resolve(false);
    }

    function finishJob(celebrate,land){
      if(!flight)return false;
      const job=flight;
      flight=null;
      height=job.to;
      setPhase('result');
      delete root.dataset.bonus;
      paint();
      react(celebrate?job.reaction:quiet(job.reaction));
      if(land)job.onCue?.('land');
      job.resolve(true);
      return true;
    }

    function requestFrame(){
      if(!frame&&!disposed)frame=requestAnimationFrame(advance);
    }

    function openCamera(next,immediate=false){
      if(motion.matches||immediate){
        zoom=next;transition=null;
      }else if((transition?.to??zoom)!==next){
        transition={from:zoom,to:next,start:null};
        requestFrame();
      }
    }

    function advance(now){
      frame=0;
      if(transition){
        transition.start??=now;
        const progress=clamp((now-transition.start)/640);
        zoom=mix(transition.from,transition.to,ease(progress));
        if(progress===1)transition=null;
      }
      if(flight){
        const job=flight;
        if(job.start===null){
          job.start=now;
          job.onCue?.('launch');
        }
        const progress=clamp((now-job.start)/job.duration);
        if(progress===1)finishJob(true,true);
        else{
          const pulse=Math.sin(Math.PI*progress)**.82;
          const boost=job.strength*pulse;
          const lift=pulse*(job.bonus?.75:.54);
          const shownHeight=mix(job.from,job.to,ease(progress));
          job.sample={height:shownHeight,boost,lift};
          paint(shownHeight,boost,lift);
        }
      }else paint();
      if(flight||transition)requestFrame();
    }

    function settled(to,reaction,animate,onCue){
      height=to;
      setPhase('result');
      delete root.dataset.bonus;
      paint();
      react(animate&&!motion.matches?reaction:quiet(reaction));
      if(animate)onCue?.('land');
      return Promise.resolve(true);
    }

    function play(data,onCue){
      if(motion.matches)return settled(data.to,data.reaction,true,onCue);
      cancelJob();
      const {points,bonus}=data;
      return new Promise(resolve=>{
        flight={...data,...profile(points,bonus),resolve,onCue,start:null,sample:{height:data.from,boost:0,lift:0}};
        setPhase('flight');
        root.dataset.bonus=String(bonus);
        paint(data.from);
        react(quiet());
        requestFrame();
      });
    }

    function setState(value,{height:to=height,round=0,reaction}={}){
      if(disposed)return;
      cancelJob();
      delete root.dataset.bonus;
      to=meters(to);
      if(to!==height||value==='idle'||value==='overview')lastFlight=null;
      height=to;
      const playing=value!=='idle'||height>0||round>0;
      openCamera(playing?1:0,!playing||!prepared&&height>0);
      prepared=playing;
      setPhase(value);
      paint();
      react(quiet(reaction));
    }

    function setHeight(value,{animate=true,points=0,bonus=false,reaction,onCue}={}){
      if(disposed)return Promise.resolve(false);
      const to=meters(value);
      cancelJob();
      openCamera(1,!animate&&!prepared);
      prepared=true;
      if(animate&&to>height){
        lastFlight={from:height,to,points,bonus,reaction};
        return play(lastFlight,onCue);
      }
      if(to!==height||!animate)lastFlight=null;
      return settled(to,reaction,animate,onCue);
    }

    function motionChanged(){
      if(!motion.matches)return;
      if(frame)cancelAnimationFrame(frame);
      frame=0;
      if(transition){zoom=transition.to;transition=null}
      if(!finishJob(false,false)){paint();react(quiet(restReaction))}
    }

    function destroy(){
      if(disposed)return;
      cancelJob();
      disposed=true;cancelAnimationFrame(frame);resize.disconnect();
      motion.removeEventListener?.('change',motionChanged);
      container.replaceChildren();mounted.delete(container);
    }

    const resize=new ResizeObserver(layout);
    resize.observe(root);
    motion.addEventListener?.('change',motionChanged);
    const canReplay=()=>!!lastFlight&&!motion.matches;
    const api={setState,setHeight,refreshLook,destroy,canReplay,finish:({cue=true}={})=>finishJob(!motion.matches,cue),
      replay:({onCue}={})=>canReplay()?play(lastFlight,onCue):Promise.resolve(false)};
    mounted.set(container,api);
    refreshLook(look);layout();paint();
    return api;
  }

  window.AscensionFlight={mount,profile,zoneFor};
})();

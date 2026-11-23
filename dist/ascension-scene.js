// Cámara y apoyos proyectan las mismas coordenadas de la montaña en todos los planos.
(()=>{
  const mounted=new WeakMap();
  const MILESTONES=[
    {height:0,name:'Campo base'},
    {height:1000,name:'El bosque'},
    {height:2500,name:'Mar de nubes'},
    {height:4000,name:'La arista'},
    {height:5500,name:'Nieves eternas'},
    {height:7000,name:'La cima'}
  ];
  const format=new Intl.NumberFormat('es-ES',{maximumFractionDigits:0,useGrouping:'always'});
  const clamp=(value,min=0,max=1)=>Math.max(min,Math.min(max,value));
  const mix=(a,b,t)=>a+(b-a)*t;
  const ease=t=>t*t*(3-2*t);
  const feetY=.94;

  function mount(container,look){
    if(!container||!window.Avatar||!window.AscensionRoute||!window.AscensionTerrain)return null;
    mounted.get(container)?.destroy();
    const {plan,elevation,maxHeight}=window.AscensionRoute;
    const {draw:drawTerrain,routeX}=window.AscensionTerrain;
    const position=meters=>{
      const y=elevation(meters);
      return [routeX(y),y];
    };
    container.innerHTML=`<div class="ascension-scene" data-state="idle" role="img" aria-label="Tu avatar en el campo base, a 0 metros">
      <canvas class="ascene-terrain" aria-hidden="true"></canvas>
      <div class="ascene-actor" aria-hidden="true"></div>
      <div class="ascene-caption" aria-hidden="true"><strong class="ascene-meters">0 <small>m</small></strong><span class="ascene-zone">Campo base</span></div>
      <div class="ascene-altimeter" aria-hidden="true"><span>7.000 m</span><div><i></i><b></b></div><span>0 m</span></div>
      <div class="ascene-next" aria-hidden="true"><span>Próximo hito</span><b>El bosque · 1.000 m</b></div>
    </div><div class="ascene-routes" role="group" aria-label="Vía para el próximo ascenso">
      <span>Vía de escalada</span>
      <button type="button" data-route="directa" aria-pressed="true"><i aria-hidden="true"></i>Directa</button>
      <button type="button" data-route="travesia" aria-pressed="false"><i aria-hidden="true"></i>Travesía</button>
    </div>`;
    const root=container.querySelector('.ascension-scene'),actor=root.querySelector('.ascene-actor');
    const canvas=root.querySelector('canvas'),ctx=canvas.getContext('2d'),controls=container.querySelector('.ascene-routes');
    const meters=root.querySelector('.ascene-meters'),zoneName=root.querySelector('.ascene-zone'),next=root.querySelector('.ascene-next');
    const motion=matchMedia('(prefers-reduced-motion: reduce)');
    let via='directa',state='idle',height=0,displayHeight=0,reported=-1,reportedZone='',lookKey='',disposed=false;
    let frame=0,flight=null,lastClimb=null,restReaction=null,restPoseMix=1,restPoseStart=0;
    let width=0,viewHeight=0,dpr=1,detail=1;
    const camera={open:0,overview:0,round:0},target={...camera};
    const transitions={};
    try{if(localStorage.getItem('faraday:ascension:via')==='travesia')via='travesia'}catch{}
    let preview=plan(60,via);
    const quiet=reaction=>({mood:reaction?.then??reaction?.mood??'',quiet:true,repeat:''});

    function act(reaction){
      restReaction=reaction||quiet();
      const el=actor.firstElementChild;
      if(!el)return;
      el._react=restReaction;
      window.Avatar3D?.react?.(el);
    }

    function refreshLook(value){
      if(disposed)return;
      const key=JSON.stringify(value||{});
      if(key===lookKey&&actor.firstElementChild)return;
      lookKey=key;
      actor.innerHTML=Avatar.render(value,{zoom:'stage',live:true,turn:.2,reaction:restReaction||quiet()});
      draw();
    }

    function path(points,color,strokeWidth,fill){
      if(!points.length)return;
      ctx.beginPath();
      ctx.moveTo(...points[0]);
      for(let i=1;i<points.length;i++)ctx.lineTo(...points[i]);
      if(fill){ctx.closePath();ctx.fillStyle=fill;ctx.fill()}
      if(color){ctx.strokeStyle=color;ctx.lineWidth=strokeWidth;ctx.stroke()}
    }

    function ledge(project,feet,unit){
      const [x,y]=feet,halfWidth=mix(.245,.15,clamp((-y-3.58)/.62));
      const ledgePoints=[
        [x-halfWidth-.033,y+.009],[x-halfWidth+.012,y-.015],[x+halfWidth-.031,y-.012],
        [x+halfWidth+.022,y+.014],[x+halfWidth-.009,y+.048],[x-halfWidth+.045,y+.054]
      ].map(project);
      path(ledgePoints,'#302d337f',Math.max(.65,unit*.003),'#4b4144');
      path(ledgePoints.slice(0,4),null,0,'#cbb19a');
      path(ledgePoints.slice(1,3),'#f6d8bcbf',Math.max(.7,unit*.006));
    }

    function trail(project,unit){
      const trailPoints=(to)=>{
        const segments=Math.max(1,Math.ceil(to/140));
        return Array.from({length:segments+1},(_,i)=>project(position(to*i/segments)));
      };
      // El sendero guía la vista desde el campo base hasta la cumbre.
      ctx.globalAlpha=camera.open*.66;
      ctx.setLineDash([3,5]);
      path(trailPoints(maxHeight),'#fff4cc',1.35);
      ctx.setLineDash([]);
      if(displayHeight>0)path(trailPoints(displayHeight),'#ffd487',Math.max(1.3,unit*.009));
      for(const stop of MILESTONES){
        const point=project(position(stop.height));
        ctx.beginPath();ctx.arc(...point,stop.height===maxHeight?3.2:2.25,0,Math.PI*2);
        ctx.fillStyle=displayHeight>=stop.height?'#ffd487':'#fff4c9';
        ctx.fill();
      }
      ctx.globalAlpha=1;
    }

    function paintRoute(routePlan,project,unit,sample,key,destination,prepared){
      const accent=key==='travesia'?'#b3eee0':'#fae2a2';
      const holds=prepared?routePlan.holds.slice(0,5):routePlan.holds;
      const boltOffset=mix(.28,.60,clamp((destination-6250)/750));
      const ropeTop=project([routePlan.finish[0]+.52,routePlan.finish[1]+boltOffset]);
      const [cx,cy]=sample?.center||routePlan.start,ropeEnd=project([cx+.52,cy+.77]);
      ctx.beginPath();ctx.moveTo(...ropeTop);
      ctx.quadraticCurveTo(ropeEnd[0]+unit*.12,ropeEnd[1]-unit*.12,...ropeEnd);
      ctx.strokeStyle='#2b2531b8';ctx.lineWidth=Math.max(1.1,unit*.013);ctx.stroke();
      ctx.strokeStyle='#db9876';ctx.lineWidth=Math.max(.75,unit*.0055);ctx.stroke();
      for(const hold of holds){
        const point=project(hold.point),[x,y]=point,hand=hold.kind==='hand',r=Math.max(1.3,unit*(hand?.025:.018));
        const active=sample?.active===hold.point;
        if(active){
          ctx.beginPath();ctx.arc(x,y,r+4.5,0,Math.PI*2);
          ctx.strokeStyle=accent;ctx.lineWidth=1.7;ctx.stroke();
          if(sample.contact>0){
            ctx.globalAlpha=sample.contact*.75;ctx.fillStyle='#fff0c3';
            for(let i=0;i<5;i++){
              const angle=i*2.4,spread=r+3+(1-sample.contact)*12;
              ctx.fillRect(x+Math.cos(angle)*spread,y+Math.sin(angle)*spread,2,2);
            }
            ctx.globalAlpha=1;
          }
        }
        const rock=[[x-r*1.1,y+r*.29],[x-r*.72,y-r*.47],[x+r*.48,y-r*.57],[x+r,y+r*.1],
          [x+r*.54,y+r*.48],[x-r*.75,y+r*.58]];
        path(rock,'#4439399c',.8,hand?'#c49e7e':'#9c8f7e');
        path(rock.slice(1,4),active?accent:'#f4dec1ac',1);
      }
      ctx.beginPath();ctx.arc(...ropeTop,Math.max(1.4,unit*.011),0,Math.PI*2);ctx.fillStyle=accent;ctx.fill();
    }

    function draw(){
      if(!width||!viewHeight)return;
      const job=flight,sample=job?.sample;
      const [startX,startY]=position(job?.from??height);
      const [bodyX,bodyY]=sample?.center||[0,0];
      const aimHeight=job?mix(job.from,job.to,sample?.travel??0):height;
      const [aimX,aimY]=position(aimHeight);
      const distance=clamp(.38*camera.round/7+.62*aimHeight/maxHeight);
      const overviewUnit=Math.min(width/4.42,viewHeight/5.77);
      const playUnit=detail*mix(.57,.36,distance);
      const unit=mix(mix(detail,Math.max(playUnit,overviewUnit),camera.open),overviewUnit,camera.overview);
      const screenX=width*mix(mix(.55,.61,camera.open),.50,camera.overview);
      const screenY=viewHeight*mix(mix(.83,.76,camera.open),.50,camera.overview);
      const focusX=mix(aimX,0,camera.overview),focusY=mix(aimY,-2.2,camera.overview);
      const project=([x,y])=>[screenX+(x-focusX)*unit,screenY+(y-focusY)*unit];
      const routeProject=([x,y])=>project([startX-.5+x,startY-feetY+y]);
      const [actorX,actorY]=routeProject([bodyX,bodyY]);
      actor.style.transform=`translate3d(${actorX}px,${actorY}px,0) scale(${unit/detail})`;
      const el=actor.firstElementChild;
      const preparing=state==='idle'||state==='thinking';
      if(el){
        const pose=sample?.pose||(preparing?{...preview.ready,mix:restPoseMix}:null);
        window.Avatar3D?.climb?.(el,pose);
      }
      if(!ctx)return;
      ctx.setTransform(dpr,0,0,dpr,0,0);
      drawTerrain(ctx,{width,height:viewHeight,project,unit,altitude:aimHeight});
      if(camera.open>.03)trail(project,unit);
      ledge(project,[startX,startY],unit);
      if(job){
        ledge(project,position(job.to),unit);
        paintRoute(job.plan,routeProject,unit,sample,job.via,job.to,false);
      }else if(preparing){
        paintRoute(preview,routeProject,unit,null,via,height+600,true);
      }
    }

    function layout(){
      width=root.clientWidth;viewHeight=root.clientHeight;
      if(!width||!viewHeight)return;
      dpr=Math.min(2,window.devicePixelRatio||1);
      canvas.width=Math.round(width*dpr);canvas.height=Math.round(viewHeight*dpr);
      detail=Math.min(width*1.055,viewHeight*1.21,500);
      actor.style.width=detail+'px';
      draw();
    }
    const resize=new ResizeObserver(layout);
    resize.observe(root);

    function paintHeight(value){
      displayHeight=value;
      const rounded=Math.floor(value);
      root.style.setProperty('--ascene-progress',String(value/maxHeight));
      if(reported!==rounded){meters.firstChild.nodeValue=format.format(rounded)+' ';reported=rounded}
      const reached=MILESTONES.findLast(zone=>value>=zone.height);
      if(reportedZone===reached.name)return;
      reportedZone=reached.name;zoneName.textContent=reached.name;
      const following=MILESTONES.find(zone=>value<zone.height);
      next.querySelector('span').textContent=following?'Próximo hito':'Has llegado';
      next.querySelector('b').textContent=following?following.name+' · '+format.format(following.height)+'\u00a0m':'La cima';
    }

    function paintState(value){
      state=value;root.dataset.state=value;
      root.setAttribute('aria-label','Tu avatar en '+zoneName.textContent.toLowerCase()+', a '+format.format(displayHeight)+' metros');
      for(const button of controls.querySelectorAll('button')){
        button.setAttribute('aria-pressed',String(button.dataset.route===via));button.disabled=!!flight;
      }
    }

    function requestDraw(){
      if(!frame&&!disposed)frame=requestAnimationFrame(advance);
    }
    function steer(key,value,duration,immediate){
      if(immediate||motion.matches){
        camera[key]=value;target[key]=value;delete transitions[key];
      }else if(target[key]!==value){
        target[key]=value;
        transitions[key]={from:camera[key],start:performance.now(),duration};
        requestDraw();
      }
    }

    function advance(now){
      frame=0;
      for(const [key,{from,start,duration}] of Object.entries(transitions)){
        const t=clamp((now-start)/duration);
        camera[key]=mix(from,target[key],ease(t));
        if(t===1)delete transitions[key];
      }
      if(flight){
        const job=flight;
        job.start??=now;
        const elapsed=now-job.start;
        job.sample=job.plan.sample(elapsed);
        const {center,cue}=job.sample;
        paintHeight(mix(job.from,job.to,clamp(center[1]/job.plan.finish[1])));
        if(cue!==job.cue){
          job.cue=cue;
          if(cue.startsWith('grip-'))job.onCue?.('grip');
          else if(cue==='land')job.onCue?.('land');
        }
        if(elapsed>=job.plan.duration){
          draw();end(true,true);
          if(Object.keys(transitions).length)requestDraw();
          return;
        }
      }
      if(restPoseMix<1){
        restPoseMix=clamp((now-restPoseStart)/220);
      }
      draw();
      if(flight||Object.keys(transitions).length||restPoseMix<1)requestDraw();
    }
    function refreshPreview(){
      const [x]=position(height),[nextX]=position(Math.min(maxHeight,height+600));
      preview=plan(60,via,nextX-x);
    }
    controls.addEventListener('click',event=>{
      const key=event.target.closest('[data-route]')?.dataset.route;
      if(flight||!key||via===key)return;
      via=key;refreshPreview();
      try{localStorage.setItem('faraday:ascension:via',via)}catch{}
      paintState(state);draw();
    });

    function end(reached,celebrate=false){
      if(!flight)return false;
      const job=flight;
      flight=null;
      if(reached){
        height=job.to;paintHeight(height);paintState('result');draw();
        act(celebrate?job.reaction:quiet(job.reaction));
      }
      job.resolve(reached);
      return true;
    }

    function canClimb(){
      return !!ctx&&!motion.matches&&typeof window.Avatar3D?.climb==='function'&&!!actor.querySelector('canvas');
    }

    function climb(data,onCue){
      const {from,to,points,reaction}=data;
      if(!canClimb())return settle(to,reaction,true,onCue);
      const [x]=position(from),[nextX]=position(to),routePlan=plan(points,data.via,nextX-x);
      paintHeight(from);
      restPoseMix=1;
      return new Promise(resolve=>{
        flight={from,to,reaction,plan:routePlan,via:data.via,resolve,onCue,start:null,sample:routePlan.sample(0)};
        paintState('climb');act(quiet());draw();requestDraw();
      });
    }

    function settle(to,reaction,animate,onCue){
      height=to;paintHeight(height);paintState('result');
      draw();act(!animate||motion.matches?quiet(reaction):reaction);
      if(animate)onCue?.('land');
      return Promise.resolve(true);
    }

    function setHeight(value,{animate=true,points=0,reaction,onCue,round}={}){
      if(disposed)return Promise.resolve(false);
      end(false);
      const to=clamp(Number(value)||0,0,maxHeight);
      steer('open',1,790,false);
      steer('overview',0,850,false);
      if(round!==undefined)steer('round',round,480,false);
      if(animate&&points>0&&to>height){
        lastClimb={from:height,to,points,reaction,via};
        return climb(lastClimb,onCue);
      }
      if(to!==height)lastClimb=null;
      return settle(to,reaction,animate,onCue);
    }

    function setState(value,{height:nextHeight=height,round=target.round,reaction}={}){
      if(disposed)return;
      end(false);
      const wasResting=state==='result'||state==='overview';
      const closeUp=value==='idle'&&round===0&&nextHeight===0;
      if(closeUp||nextHeight!==height)lastClimb=null;
      height=clamp(Number(nextHeight)||0,0,maxHeight);
      steer('open',closeUp?0:1,900,closeUp);
      steer('overview',value==='overview'?1:0,920,closeUp);
      steer('round',round,530,closeUp);
      if(value==='thinking'&&wasResting&&!motion.matches){
        restPoseStart=performance.now();restPoseMix=0;requestDraw();
      }else restPoseMix=1;
      refreshPreview();paintHeight(height);paintState(value);draw();act(quiet(reaction));
    }

    function motionChanged(){
      if(!motion.matches)return;
      if(flight)end(true,false);
      if(frame)cancelAnimationFrame(frame);
      frame=0;
      for(const key of Object.keys(transitions)){camera[key]=target[key];delete transitions[key]}
      restPoseMix=1;
      draw();
    }
    motion.addEventListener?.('change',motionChanged);

    function destroy(){
      if(disposed)return;
      end(false);disposed=true;
      cancelAnimationFrame(frame);
      resize.disconnect();motion.removeEventListener?.('change',motionChanged);
      container.replaceChildren();mounted.delete(container);
    }
    const canReplay=()=>!!lastClimb&&canClimb();
    const api={setHeight,setState,refreshLook,destroy,canReplay,finish:()=>end(true,!motion.matches),
      replay:({onCue}={})=>canReplay()?climb(lastClimb,onCue):Promise.resolve(false)};
    mounted.set(container,api);
    refreshLook(look);paintHeight(0);paintState('idle');layout();
    return api;
  }
  window.AscensionScene={mount};
})();

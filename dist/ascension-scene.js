// La cuerda, las presas, el avatar y las repisas comparten coordenadas de montaje.
(()=>{
  const mounted=new WeakMap(),MAX=7000;
  const MILESTONES=[
    {height:0,name:'Campo base',zone:'base',sky:'#b7d7d3',light:'#f4e1b8',rock:'#655241',face:'#987158'},
    {height:1000,name:'El bosque',zone:'forest',sky:'#a2c9bc',light:'#dfdfb2',rock:'#464f42',face:'#7c7352'},
    {height:2500,name:'Mar de nubes',zone:'clouds',sky:'#94bbc9',light:'#e2e8da',rock:'#475665',face:'#7f8a8c'},
    {height:4000,name:'La arista',zone:'ridge',sky:'#77a6bf',light:'#dae2dc',rock:'#494e62',face:'#74869b'},
    {height:5500,name:'Nieves eternas',zone:'snow',sky:'#576e9a',light:'#c5dce5',rock:'#455469',face:'#8c9da9'},
    {height:7000,name:'La cima',zone:'summit',sky:'#546292',light:'#f5d7ad',rock:'#354557',face:'#8b9ba8'}
  ];
  const format=new Intl.NumberFormat('es-ES',{maximumFractionDigits:0,useGrouping:'always'});
  const clamp=value=>Math.max(0,Math.min(MAX,Number(value)||0));
  const mix=(a,b,t)=>a+(b-a)*t;
  const fog=(a,b,t)=>{
    const c=[1,3,5].map(i=>Math.round(mix(parseInt(a.slice(i,i+2),16),parseInt(b.slice(i,i+2),16),t)));
    return 'rgb('+c.join(',')+')';
  };
  const noise=n=>{const x=Math.sin(n*127.1+311.7)*43758.5453;return x-Math.floor(x)};

  function mount(container,look){
    if(!container||!window.Avatar||!window.AscensionRoute)return null;
    mounted.get(container)?.destroy();
    container.innerHTML=`<div class="ascension-scene" data-state="idle" role="img" aria-label="Tu avatar en el campo base, a 0 metros">
      <canvas class="ascene-terrain" aria-hidden="true"></canvas>
      <div class="ascene-actor" aria-hidden="true"></div>
      <div class="ascene-caption" aria-hidden="true"><strong class="ascene-meters">0 <small>m</small></strong><span class="ascene-zone">Campo base</span></div>
      <div class="ascene-altimeter" aria-hidden="true"><span>7.000 m</span><div><i></i><b></b></div><span>0 m</span></div>
      <div class="ascene-next" aria-hidden="true"><span>Próximo hito</span><b>El bosque · 1.000 m</b></div>
      <div class="ascene-movement" aria-hidden="true"></div>
    </div><div class="ascene-routes" role="group" aria-label="Vía para el próximo ascenso">
      <span>Vía de escalada</span>
      <button type="button" data-route="directa" aria-pressed="true"><i aria-hidden="true"></i>Directa</button>
      <button type="button" data-route="travesia" aria-pressed="false"><i aria-hidden="true"></i>Travesía</button>
    </div>`;
    const root=container.querySelector('.ascension-scene'),actor=root.querySelector('.ascene-actor'),
      canvas=root.querySelector('canvas'),ctx=canvas.getContext('2d'),controls=container.querySelector('.ascene-routes'),
      meters=root.querySelector('.ascene-meters'),zoneName=root.querySelector('.ascene-zone'),
      next=root.querySelector('.ascene-next'),movement=root.querySelector('.ascene-movement');
    const motion=matchMedia('(prefers-reduced-motion: reduce)');
    let route='directa',state='idle',height=0,reported=-1,reportedZone='',lookKey='',disposed=false;
    let frame=0,flight=null,lastClimb=null,restReaction=null,currentSample=null,wallOffset=0;
    let width=0,viewHeight=0,size=1,originX=0,originY=0,scale=1;
    try{if(localStorage.getItem('faraday:ascension:via')==='travesia')route='travesia'}catch{}
    const quiet=reaction=>({mood:reaction?.then??reaction?.mood??'',quiet:true,repeat:''});
    let preview=AscensionRoute.plan(60,route);

    function act(reaction){
      restReaction=reaction||quiet();
      const el=actor.firstElementChild;if(!el)return;
      el._react=restReaction;window.Avatar3D?.react?.(el);
    }

    function refreshLook(value){
      if(disposed)return;
      const key=JSON.stringify(value||{});if(key===lookKey&&actor.firstElementChild)return;
      lookKey=key;actor.innerHTML=Avatar.render(value,{zoom:'stage',live:true,turn:.2,reaction:restReaction||quiet()});
      draw(currentSample);
    }

    function polygon(points,fill,stroke){
      ctx.beginPath();ctx.moveTo(points[0][0],points[0][1]);
      for(const point of points.slice(1))ctx.lineTo(point[0],point[1]);
      ctx.closePath();ctx.fillStyle=fill;ctx.fill();
      if(stroke){ctx.strokeStyle=stroke;ctx.stroke()}
    }

    function line(points,color,width=1){
      ctx.beginPath();ctx.moveTo(points[0][0],points[0][1]);
      for(const point of points.slice(1))ctx.lineTo(point[0],point[1]);
      ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke();
    }

    function landscape(a,b,t,progress){
      const w=width,h=viewHeight,sky=ctx.createLinearGradient(0,0,w*.3,h);
      sky.addColorStop(0,fog(a.sky,b.sky,t));sky.addColorStop(1,fog(a.light,b.light,t));
      ctx.fillStyle=sky;ctx.fillRect(0,0,w,h);
      const sun=[w*.22,h*(.38+.26*progress)],radius=Math.min(w,h)*.12;
      const halo=ctx.createRadialGradient(sun[0],sun[1],radius*.2,sun[0],sun[1],radius*1.55);
      halo.addColorStop(0,'rgba(255,230,161,.6)');halo.addColorStop(1,'rgba(255,236,183,0)');
      ctx.fillStyle=halo;ctx.fillRect(0,0,w,h);
      ctx.beginPath();ctx.arc(sun[0],sun[1],radius*.55,0,Math.PI*2);ctx.fillStyle='#ffebae';ctx.fill();
      const ranges=[
        [[0,.66],[.1,.55],[.18,.58],[.27,.45],[.39,.57],[.51,.49],[.63,.65],[1,.61]],
        [[0,.74],[.08,.62],[.2,.68],[.31,.56],[.43,.68],[.61,.54],[.7,.70],[1,.68]],
        [[0,.85],[.1,.74],[.17,.78],[.25,.69],[.36,.76],[.44,.66],[.57,.78],[1,.8]]
      ];
      for(let i=0;i<ranges.length;i++){
        const shift=progress*h*(i+1)*.07;
        const ridge=ranges[i].map(([x,y])=>[x*w,y*h+shift]);
        polygon([...ridge,[w,h],[0,h]],['#8ca8a0','#73938c','#54776e'][i]);
        if(i===1)polygon([ridge[2],ridge[3],ridge[4],[w*.34,h*.65+shift],[w*.29,h*.63+shift]],'#cddbd1');
      }
      for(let row=0;row<3;row++){
        const y=h*(.50+row*.14)+progress*h*.11;
        ctx.fillStyle=row===0?'#fff9e27d':'#f5f3df53';
        ctx.beginPath();ctx.ellipse(w*(.15+row*.06),y,w*(.29-row*.025),h*.017,0,0,Math.PI*2);ctx.fill();
      }
    }

    function rockface(a,b,t,camera,base){
      const contour=y=>.02+.095*Math.sin(y*2.4)+.041*Math.cos(y*7);
      const top=Math.floor((-originY/size-camera-base)*4)/4;
      const bottom=top+viewHeight/size+.5;
      const edge=[],right=[],rock=fog(a.rock,b.rock,t),face=fog(a.face,b.face,t);
      const xAt=(y,offset=0)=>originX+size*(contour(y)+offset);
      const yAt=y=>originY+size*(y+base+camera);
      for(let y=top;y<=bottom;y+=.125)edge.push([xAt(y),yAt(y)]);
      polygon([...edge,[width,edge.at(-1)[1]],[width,edge[0][1]]],rock);
      for(let y=top;y<bottom;y+=.25){
        const n=Math.round(y*4),p0=[xAt(y),yAt(y)],p1=[xAt(y+.25),yAt(y+.25)],
          ridge=[xAt(y+.11,.47+noise(n)*.37),yAt(y+.11)],far=[width,yAt(y+.14)];
        polygon([p0,[width,yAt(y-.018)],far,ridge,p1],noise(n+3)>.45?face:rock);
        polygon([p1,ridge,far,[width,yAt(y+.26)]],noise(n+21)>.49?'#fff1d018':'#18233922');
        line([p0,ridge,far], '#f4dfb72d',1);
        right.push(ridge);
        const crackY=y+.12+noise(n+98)*.08,crack=xAt(crackY,.19+noise(n+7)*.74);
        line([[crack-size*.05,yAt(crackY-.09)],[crack,yAt(crackY)],[crack+size*.025,yAt(crackY+.07)]],'#30292242',1);
        for(let i=0;i<7;i++){
          const yy=y+noise(n*11+i)*.24,x=xAt(yy,.09+noise(n*17+i)*.92);
          line([[x,yAt(yy)],[x+size*(.03+noise(n+i)*.065),yAt(yy)-size*.025]],'#fff0c81d',1);
        }
      }
      line(edge,'#ead8ad6e',1.3);line(right,'#24333c43',1.25);
    }

    function ledge(project,y,opacity=1){
      const left=project([.20,y]),right=project([1.04,y]),depth=size*.055;
      ctx.globalAlpha=opacity;
      polygon([[left[0]-depth,left[1]+depth*.55],[left[0],left[1]],[right[0],right[1]],
        [right[0]+depth,right[1]+depth*.44],[right[0]+depth*.5,right[1]+depth],[left[0]-depth,left[1]+depth]],'#c3a87a');
      polygon([[left[0]-depth,left[1]+depth],[right[0]+depth*.5,right[1]+depth],
        [right[0]-depth,right[1]+depth*2.25],[left[0]+depth*.7,left[1]+depth*1.9]],'#655641');
      line([left,right],'#f1dcaa',2);
      ctx.globalAlpha=1;
    }

    function paintRoute(plan,project,sample){
      const accent=route==='travesia'?'#a3efe0':'#ffe193';
      const handPath=plan.holds.filter(hold=>hold.kind==='hand').map(hold=>project(hold.point));
      const ropeTop=project([plan.finish[0]+.55,plan.finish[1]+.32]);
      const center=sample?.center||plan.start,ropeEnd=project([center[0]+.51,center[1]+.775]);
      ctx.setLineDash([4,6]);line(handPath,'#fff2c86e',1.5);ctx.setLineDash([]);
      ctx.beginPath();ctx.moveTo(...ropeTop);
      ctx.quadraticCurveTo(ropeEnd[0]+size*.16,ropeEnd[1]-size*.17,...ropeEnd);
      ctx.strokeStyle='#283331b8';ctx.lineWidth=3.75;ctx.stroke();
      ctx.strokeStyle='#dc8962';ctx.lineWidth=1.65;ctx.stroke();
      for(const hold of plan.holds){
        const [x,y]=project(hold.point),hand=hold.kind==='hand',r=size*(hand?.026:.022);
        const active=sample?.active===hold.point;
        if(active){
          const dust=sample.contact;
          ctx.globalAlpha=.32;
          ctx.beginPath();ctx.arc(x,y,r+10,0,Math.PI*2);ctx.fillStyle=accent;ctx.fill();
          ctx.globalAlpha=1;
          ctx.beginPath();ctx.arc(x,y,r+5,0,Math.PI*2);ctx.strokeStyle=accent;ctx.lineWidth=2;ctx.stroke();
          if(dust>0){
            ctx.globalAlpha=dust*.72;ctx.fillStyle='#fff0c3';
            for(let i=0;i<5;i++){
              const angle=i*2.4,spread=r+4+(1-dust)*13;
              ctx.fillRect(x+Math.cos(angle)*spread,y+Math.sin(angle)*spread,2,2);
            }
            ctx.globalAlpha=1;
          }
        }
        polygon([[x-r*1.1,y+r*.28],[x-r*.7,y-r*.51],[x+r*.6,y-r*.66],
          [x+r*1.15,y+r*.04],[x+r*.61,y+r*.48],[x-r*.75,y+r*.61]],hand?'#d5bc89':'#a99c7e');
        line([[x-r*.7,y-r*.51],[x+r*.6,y-r*.66],[x+r*1.15,y+r*.04]],active?accent:'#f4e1a7a6',1.15);
      }
      ctx.beginPath();ctx.arc(...ropeTop,3.5,0,Math.PI*2);ctx.fillStyle='#ead6a2';ctx.fill();
    }

    function draw(sample=currentSample){
      if(!width||!viewHeight)return;
      const active=flight?.plan,plan=active||preview;
      const center=sample?.center||[0,0];
      const camera=active?-center[1]*(sample?.follow??.87):0;
      const project=([x,y])=>[originX+x*size,originY+(y+camera)*size];
      const ground=project(center);
      actor.style.width=size+'px';
      actor.style.transform='translate3d('+ground[0]+'px,'+ground[1]+'px,0)';
      const el=actor.firstElementChild;
      if(el)window.Avatar3D?.climb?.(el,sample?.pose||null);
      if(!ctx)return;
      const reached=MILESTONES.findLastIndex(zone=>height>=zone.height),a=MILESTONES[reached],b=MILESTONES[reached+1]||a;
      const t=a===b?0:(height-a.height)/(b.height-a.height);
      ctx.setTransform(scale,0,0,scale,0,0);
      landscape(a,b,t,height/MAX);
      rockface(a,b,t,camera,flight?.wallStart??wallOffset);
      ledge(project,.94,sample?.oldLedge??1);
      if(active)ledge(project,plan.finish[1]+.94);
      if(state!=='result'||flight)paintRoute(plan,project,sample);
    }

    function layout(){
      width=root.clientWidth;viewHeight=root.clientHeight;if(!width||!viewHeight)return;
      scale=Math.min(2,window.devicePixelRatio||1);
      canvas.width=Math.round(width*scale);canvas.height=Math.round(viewHeight*scale);
      size=Math.min(width*.84,viewHeight*.98,354);
      originX=width*.62-size*.5;originY=viewHeight*.86-size*.94;
      draw();
    }
    const resize=new ResizeObserver(layout);resize.observe(root);

    function paintHeight(value){
      height=clamp(value);const rounded=Math.floor(height);
      root.style.setProperty('--ascene-progress',String(height/MAX));
      if(reported!==rounded){meters.innerHTML=format.format(rounded)+' <small>m</small>';reported=rounded}
      const reached=MILESTONES.findLast(zone=>height>=zone.height);
      if(reportedZone===reached.zone)return;
      reportedZone=reached.zone;zoneName.textContent=reached.name;
      const following=MILESTONES.find(zone=>height<zone.height);
      next.querySelector('span').textContent=following?'Próximo hito':'Has llegado';
      next.querySelector('b').textContent=following?following.name+' · '+format.format(following.height)+' m':'La cima';
    }

    function paintState(value){
      state=value;root.dataset.state=value;
      root.setAttribute('aria-label','Tu avatar en '+zoneName.textContent.toLowerCase()+', a '+format.format(height)+' metros');
      for(const button of controls.querySelectorAll('button')){
        button.setAttribute('aria-pressed',String(button.dataset.route===route));button.disabled=!!flight;
      }
    }
    controls.addEventListener('click',event=>{
      const key=event.target.closest('[data-route]')?.dataset.route;
      if(flight||!key||route===key)return;
      route=key;preview=AscensionRoute.plan(60,route);
      try{localStorage.setItem('faraday:ascension:via',route)}catch{}
      paintState(state);draw();
    });

    function end(reached,celebrate=false){
      if(!flight)return false;
      const job=flight;flight=null;
      cancelAnimationFrame(frame);frame=0;currentSample=null;
      actor.classList.remove('is-climbing');
      movement.textContent='';
      if(reached){
        wallOffset=job.wallStart-job.plan.finish[1];
        paintHeight(job.to);paintState('result');draw();act(celebrate?job.reaction:quiet(job.reaction));
      }
      job.resolve(reached);return true;
    }

    function climb(climbData,onCue){
      end(false);
      const {from,to,points,reaction,via,wallStart}=climbData;
      if(!canClimb()){
        wallOffset=to/MAX*1.8;
        paintHeight(to);paintState('result');draw();act(motion.matches?quiet(reaction):reaction);
        onCue?.('land');return Promise.resolve(true);
      }
      const plan=AscensionRoute.plan(points,via);
      paintHeight(from);
      return new Promise(resolve=>{
        const job=flight={from,to,reaction,plan,resolve,wallStart};
        const start=performance.now();let lastCue='',lastCaption='';
        paintState('climb');actor.classList.add('is-climbing');
        function advance(now){
          if(disposed||flight!==job)return;
          const elapsed=now-start,sample=plan.sample(elapsed);
          currentSample=sample;
          paintHeight(mix(from,to,Math.max(0,Math.min(1,sample.center[1]/plan.finish[1]))));
          draw(sample);
          const caption=sample.transfer?'Agarre '+sample.transfer+' de '+plan.steps.length:
            sample.cue==='start'?'Preparando agarres':'A la repisa';
          if(caption!==lastCaption){movement.textContent=caption;lastCaption=caption}
          if(sample.cue!==lastCue){
            lastCue=sample.cue;
            if(sample.cue.startsWith('grip-'))onCue?.('grip');
            else if(sample.cue==='land')onCue?.('land');
          }
          if(elapsed<plan.duration)frame=requestAnimationFrame(advance);
          else end(true,true);
        }
        frame=requestAnimationFrame(advance);
      });
    }

    function setHeight(value,{animate=true,points=0,reaction,onCue}={}){
      if(disposed)return Promise.resolve(false);
      end(false);const to=clamp(value);
      if(animate&&to>height){
        lastClimb={from:height,to,points,reaction,via:route,wallStart:wallOffset};
        return climb(lastClimb,onCue);
      }
      if(to!==height){lastClimb=null;wallOffset=to/MAX*1.8}
      paintHeight(to);paintState('result');draw();
      act(!animate||motion.matches?quiet(reaction):reaction);
      if(animate)onCue?.('land');
      return Promise.resolve(true);
    }
    function setState(value){
      if(disposed)return;
      end(false);paintState(value);draw();
      act(value==='thinking'?{mood:'wait',quiet:true}:quiet());
    }
    function motionChanged(){if(flight)end(true,false)}
    motion.addEventListener?.('change',motionChanged);
    function destroy(){
      if(disposed)return;end(false);disposed=true;
      resize.disconnect();motion.removeEventListener?.('change',motionChanged);
      container.replaceChildren();mounted.delete(container);
    }
    const canClimb=()=>!!ctx&&!motion.matches&&typeof window.Avatar3D?.climb==='function'&&!!actor.querySelector('canvas');
    const canReplay=()=>!!lastClimb&&canClimb();
    const api={setHeight,setState,refreshLook,destroy,canReplay,finish:()=>end(true,!motion.matches),
      replay:({onCue}={})=>canReplay()?climb(lastClimb,onCue):Promise.resolve(false)};
    mounted.set(container,api);
    refreshLook(look);paintHeight(0);paintState('idle');layout();
    return api;
  }
  window.AscensionScene={mount,milestones:MILESTONES.map(item=>({...item})),maxHeight:MAX};
})();

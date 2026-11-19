// Escena de Ascensión: el avatar vestido escala, llega a una repisa y muestra el gesto elegido por el jugador.
// Se mantiene separada de las reglas y del reloj. No modifica ni conserva puntuaciones.
(()=>{
  const mounted=new WeakMap(),MAX=7000;
  const MILESTONES=[{height:0,name:'Campo base',zone:'base'},{height:1000,name:'El bosque',zone:'forest'},
    {height:2500,name:'Mar de nubes',zone:'clouds'},{height:4000,name:'La arista',zone:'ridge'},
    {height:5500,name:'Nieves eternas',zone:'snow'},{height:7000,name:'La cima',zone:'summit'}];
  const format=new Intl.NumberFormat('es-ES',{maximumFractionDigits:0,useGrouping:'always'});
  const clamp=value=>Math.max(0,Math.min(MAX,Number.isFinite(Number(value))?Number(value):0));
  const rock=`<svg class="ascene-cliff" viewBox="0 0 420 1400" preserveAspectRatio="none" aria-hidden="true">
    <path class="ascene-rock-back" d="M420 0H288L244 67 275 143 240 225 270 302 233 386 267 467 226 551 258 625 223 704 251 786 213 864 250 947 209 1022 241 1111 200 1181 228 1262 195 1343 211 1400H420Z"/>
    <path class="ascene-rock-front" d="M420 0H345L309 90 339 178 300 265 329 351 293 437 320 526 281 612 310 700 273 787 300 875 264 963 292 1050 255 1138 282 1225 248 1310 266 1400H420Z"/>
    <g class="ascene-rock-lines" fill="none" stroke-linecap="round"><path d="m294 96 56 28 70-7M274 248l63 20 83-18M266 405l51 29 103-19M252 569l56 21 112-22M242 729l61 26 117-19M228 890l65 25 127-21M225 1050l66 24 129-17M214 1216l64 22 142-28"/>
    <path d="m368 18-24 130 23 76-31 101 18 88-27 103 18 86-30 105 17 81-27 107 14 86-23 108 13 80-25 108"/></g>
    <g class="ascene-holds"><path d="m269 151 15-3 7 8-19 4zM252 311l20-4 4 10-19 2zM247 476l15-5 7 8-18 5zM232 635l21-3 4 9-18 4zM225 796l19-4 6 8-20 5zM214 956l19-3 5 9-18 5zM205 1115l19-3 5 9-20 5zM195 1279l21-3 4 10-19 3z"/></g>
  </svg>`;
  const landscape=`<svg class="ascene-peaks ascene-peaks-far" viewBox="0 0 420 560" preserveAspectRatio="none" aria-hidden="true"><path d="M0 390 57 266 115 352 168 226 240 367 295 277 365 388 420 300V560H0Z"/><path class="ascene-snowcap" d="m143 284 25-58 38 75-33-18-12 14zM42 298l15-32 30 45-25-11-9 8z"/></svg>
  <svg class="ascene-peaks ascene-peaks-near" viewBox="0 0 420 560" preserveAspectRatio="none" aria-hidden="true"><path d="m0 435 55-95 45 64 57-96 60 116 49-66 62 94 49-49 43 55V560H0Z"/></svg>`;
  function mount(container,look){
    if(!container||!window.Avatar)return null;
    mounted.get(container)?.destroy();
    container.innerHTML=`<div class="ascension-scene" data-zone="base" data-state="idle" role="img" aria-label="Tu avatar en el campo base, a 0 metros">
      <div class="ascene-sky" aria-hidden="true"><span class="ascene-sun"></span><span class="ascene-night"></span>
        <span class="ascene-star s1">✦</span><span class="ascene-star s2">✧</span><span class="ascene-star s3">✦</span>
        <span class="ascene-cloud cloud-one"></span><span class="ascene-cloud cloud-two"></span></div>
      ${landscape}<div class="ascene-rockworld" aria-hidden="true">${rock}</div>
      <div class="ascene-slope" aria-hidden="true"></div>
      <div class="ascene-trail" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div>
      <div class="ascene-ledge" aria-hidden="true"><i></i></div>
      <div class="ascene-actor" aria-hidden="true"></div>
      <div class="ascene-sparks" aria-hidden="true"><i>✦</i><i>✧</i><i>✦</i><i>✧</i><i>✦</i></div>
      <div class="ascene-caption" aria-hidden="true"><span class="ascene-kicker">Tu ascensión</span><strong class="ascene-meters">0 <small>m</small></strong><span class="ascene-zone">Campo base</span></div>
      <div class="ascene-altimeter" aria-hidden="true"><span>7.000</span><div><i></i><b></b></div><span>0 m</span></div>
      <div class="ascene-next" aria-hidden="true"><span>Próxima repisa</span><b>El bosque · 1.000 m</b></div>
    </div>`;
    const root=container.firstElementChild,actor=root.querySelector('.ascene-actor'),world=root.querySelector('.ascene-rockworld'),
      meters=root.querySelector('.ascene-meters'),zoneName=root.querySelector('.ascene-zone'),next=root.querySelector('.ascene-next');
    const media=matchMedia('(prefers-reduced-motion: reduce)');
    let disposed=false,height=0,target=0,lookKey='',frame=0,timers=[],version=0,pending=null,currentReaction={mood:'',quiet:true};
    const quiet=reaction=>({mood:reaction?.then??reaction?.mood??'',quiet:true,repeat:''});
    function act(reaction){
      currentReaction=reaction||{mood:'',quiet:true};
      const el=actor.firstElementChild;if(!el)return;
      el._react=currentReaction;window.Avatar3D?.react?.(el);
    }
    function refreshLook(value){
      if(disposed)return;
      const key=JSON.stringify(value||{});if(key===lookKey&&actor.firstElementChild)return;
      lookKey=key;actor.innerHTML=Avatar.render(value,{zoom:'stage',live:true,turn:.2,reaction:currentReaction});
      act(currentReaction);
    }
    function paint(value){
      height=clamp(value);const ratio=height/MAX;
      root.style.setProperty('--ascene-progress',String(ratio));
      world.style.transform=`translate3d(0,${ratio*720}px,0)`;
      meters.innerHTML=`${format.format(height)} <small>m</small>`;
      const reached=MILESTONES.filter(item=>height>=item.height).at(-1),following=MILESTONES.find(item=>height<item.height);
      root.dataset.zone=reached.zone;zoneName.textContent=reached.name;
      next.innerHTML=following?`<span>Próxima repisa</span><b>${following.name} · ${format.format(following.height)} m</b>`:'<span>Has llegado</span><b>La cima es tuya</b>';
      root.setAttribute('aria-label',`Tu avatar en ${reached.name.toLocaleLowerCase('es')}, a ${format.format(height)} metros`);
    }
    function cancel(){
      version++;cancelAnimationFrame(frame);frame=0;timers.forEach(clearTimeout);timers=[];
      root.classList.remove('is-climbing','is-arriving','is-celebrating');
      if(pending){const resolve=pending;pending=null;resolve(false)}
    }
    const later=(time,fn)=>timers.push(setTimeout(fn,time));
    function setHeight(value,{animate=true,points=0,reaction}={}){
      if(disposed)return Promise.resolve(false);
      const from=height;cancel();target=clamp(value);
      const token=version;root.dataset.points=String(Number(points)||0);root.dataset.state='result';
      if(!animate||media.matches||target<=from){
        paint(target);act(!animate||media.matches?quiet(reaction):reaction||{mood:'',quiet:true});
        return Promise.resolve(true);
      }
      root.classList.add('is-climbing');root.dataset.state='climb';
      act({mood:'',clip:'escalar',repeat:'escalar'});
      const duration=1250+Math.min(1000,(target-from)*.8),start=performance.now();
      return new Promise(resolve=>{
        pending=resolve;
        const complete=()=>{
          if(disposed||token!==version)return;
          frame=0;paint(target);root.classList.remove('is-climbing');root.classList.add('is-arriving');
          act({mood:'',clip:'coronar',quiet:true});
          later(700,()=>{
            if(disposed||token!==version)return;
            root.classList.remove('is-arriving');root.classList.add('is-celebrating');root.dataset.state='result';
            act(reaction||{mood:'cheer',clip:'puno'});
            later(2400,()=>root.classList.remove('is-celebrating'));
            pending=null;resolve(true);
          });
        };
        const step=now=>{
          if(disposed||token!==version)return;
          if(!root.isConnected){cancel();return}
          const p=Math.min(1,(now-start)/duration),smooth=p*p*(3-2*p);paint(from+(target-from)*smooth);
          if(p<1)frame=requestAnimationFrame(step);else complete();
        };
        frame=requestAnimationFrame(step);
      });
    }
    function setState(state){
      if(disposed)return;
      if(state==='result'){root.dataset.state='result';return}
      cancel();root.dataset.state=state;
      if(state==='thinking')act({mood:'nervous'});
      else if(state==='climb'){root.classList.add('is-climbing');act({clip:'escalar',repeat:'escalar',mood:''})}
      else act({mood:'',quiet:true});
    }
    function motionChanged(){if(disposed)return;const desired=target,reaction=currentReaction;cancel();paint(desired);act(quiet(reaction))}
    function destroy(){
      if(disposed)return;cancel();disposed=true;media.removeEventListener?.('change',motionChanged);
      if(root.parentElement===container)root.remove();mounted.delete(container);
    }
    const api={setHeight,setState,refreshLook,destroy};mounted.set(container,api);
    refreshLook(look);paint(0);media.addEventListener?.('change',motionChanged);return api;
  }
  window.AscensionScene={mount,milestones:MILESTONES.map(item=>({...item})),maxHeight:MAX};
})();

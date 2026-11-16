// Sonido compartido: tonos y ruido generados en el navegador con Web Audio (sin archivos). Lo usan los duelos (duel.js),
// la apertura de cofres (chest-open.js, que añade campanillas con reverberación y una cama de fondo, decisión 0037) y el momento «¡Casi casi!» (casi.js). El silencio y el volumen son los mismos para todo el juego y se guardan en este navegador.
(()=>{
  const KEY='casi-casi:duelo:sonido',VOLUME_KEY='casi-casi:sonido:volumen';
  let audio=null,master=null,on=true,volume=1,hiss=null,hall=null;
  try{on=JSON.parse(localStorage.getItem(KEY))??true}catch{}
  try{const saved=Number(JSON.parse(localStorage.getItem(VOLUME_KEY)));if(localStorage.getItem(VOLUME_KEY)!==null&&saved>=0&&saved<=1)volume=saved}catch{}
  // El oído percibe el volumen de forma logarítmica: con la curva al cuadrado la barra baja de forma pareja.
  const level=()=>volume*volume;
  // El contexto se crea la primera vez que hace falta: los navegadores solo lo dejan sonar tras un gesto del usuario.
  // Todo sale por `master`, la ganancia general que mueve la barra de volumen (también lo que ya está sonando).
  function context(){
    try{
      if(!audio){audio=new (window.AudioContext||window.webkitAudioContext)();master=audio.createGain();master.gain.value=level();master.connect(audio.destination)}
    }catch{}
    return audio;
  }
  // Desbloqueo para el móvil. iOS Safari y Chrome en Android crean el contexto «suspendido» y solo lo dejan arrancar si
  // resume() se llama dentro de un gesto (los sonidos se disparan a menudo tras una respuesta del servidor, fuera del
  // gesto, y se quedaban mudos). Por eso, en cada toque o tecla mientras el contexto no esté sonando, se crea si falta,
  // se reanuda y se reproduce un instante de silencio, que es lo que iOS necesita para abrir la salida. Así también se
  // recupera cuando la pestaña vuelve de segundo plano o una llamada lo deja «interrupted». Las notas programadas con
  // el contexto parado no se pierden: su reloj está quieto y suenan al reanudarse.
  function resume(){
    if(!context())return Promise.resolve();
    try{if(audio.state!=='running')return Promise.resolve(audio.resume?.()).catch(()=>{})}catch{}
    return Promise.resolve();
  }
  function unlock(){
    if(!on||!context()||audio.state==='running')return;
    // En iOS 16.4+ el interruptor de silencio corta Web Audio salvo que la sesión sea de reproducción.
    try{if(navigator.audioSession&&navigator.audioSession.type!=='playback')navigator.audioSession.type='playback'}catch{}
    resume();
    try{const source=audio.createBufferSource();source.buffer=audio.createBuffer(1,1,audio.sampleRate);source.connect(audio.destination);source.start(0)}catch{}
  }
  // pointerup/touchend/click/keydown son los que cuentan como gesto en Chrome y Safari (un pointerdown táctil no).
  for(const type of ['pointerdown','pointerup','touchend','click','keydown'])window.addEventListener(type,unlock,{capture:true,passive:true});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&audio&&audio.state!=='running')resume()});
  // Reverberación hecha con ruido que se apaga: da espacio a los sonidos para que no suenen a pitido seco.
  function room(){
    if(hall||!context())return hall;
    try{
      const length=Math.floor(audio.sampleRate*2.4),impulse=audio.createBuffer(2,length,audio.sampleRate);
      for(let channel=0;channel<2;channel++){const data=impulse.getChannelData(channel);for(let i=0;i<length;i++)data[i]=(Math.random()*2-1)*(1-i/length)**3}
      const convolver=audio.createConvolver(),back=audio.createGain();convolver.buffer=impulse;back.gain.value=.6;
      convolver.connect(back).connect(master);hall=convolver;
    }catch{}
    return hall;
  }
  // Lleva un sonido a la salida y, si `wet` es mayor que 0, manda esa parte a la reverberación.
  function output(node,wet=0){
    node.connect(master);
    if(wet>0&&room()){const send=audio.createGain();send.gain.value=wet;node.connect(send).connect(hall)}
  }
  // Una nota: oscilador con ataque corto y caída exponencial. `to` desliza la frecuencia hasta ese valor.
  function tone(frequency,at,duration,{type='sine',gain=.06,to,wet=0}={}){
    if(!on||!context())return;
    try{
      const oscillator=audio.createOscillator(),volume=audio.createGain(),start=audio.currentTime+at;
      oscillator.type=type;oscillator.frequency.setValueAtTime(frequency,start);if(to)oscillator.frequency.exponentialRampToValueAtTime(to,start+duration);
      volume.gain.setValueAtTime(.0001,start);volume.gain.exponentialRampToValueAtTime(gain,start+.015);volume.gain.exponentialRampToValueAtTime(.0001,start+duration);
      oscillator.connect(volume);output(volume,wet);oscillator.start(start);oscillator.stop(start+duration+.03);
    }catch{}
  }
  // Ruido filtrado, para soplidos, estallidos y brillos: `from` → `to` mueve el filtro durante el sonido.
  function noise(at,duration,{gain=.08,from=1200,to=from,q=1,filter='bandpass',attack=.01,wet=0}={}){
    if(!on||!context())return;
    try{
      if(!hiss){hiss=audio.createBuffer(1,audio.sampleRate*2,audio.sampleRate);const data=hiss.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=Math.random()*2-1}
      const source=audio.createBufferSource(),band=audio.createBiquadFilter(),volume=audio.createGain(),start=audio.currentTime+at;
      source.buffer=hiss;source.loop=true;band.type=filter;band.Q.value=q;
      band.frequency.setValueAtTime(from,start);if(to!==from)band.frequency.exponentialRampToValueAtTime(to,start+duration);
      volume.gain.setValueAtTime(.0001,start);volume.gain.exponentialRampToValueAtTime(gain,start+attack);volume.gain.exponentialRampToValueAtTime(.0001,start+duration);
      source.connect(band).connect(volume);output(volume,wet);source.start(start,Math.random());source.stop(start+duration+.03);
    }catch{}
  }
  // Campanilla: una nota cuyos armónicos se apagan antes que la fundamental, como una lámina golpeada, con una segunda
  // voz apenas desafinada que le da cuerpo. Suena menos «digital» que un tono solo.
  const PARTIALS=[[1,1,1],[2,.32,.55],[3,.12,.35],[4.07,.07,.22]];
  function bell(frequency,at,duration,{gain=.05,wet=.25}={}){
    for(const [ratio,level,length] of PARTIALS)tone(frequency*ratio,at,duration*length,{gain:gain*level,wet});
    tone(frequency*1.003,at,duration,{gain:gain*.5,wet});
  }
  // Cama de fondo: un acorde grave y suave que respira por debajo de los demás sonidos mientras dura una escena (la
  // apertura de un cofre). No es una melodía ni lleva ritmo: solo da ambiente. Devuelve los mandos para moverla:
  // lift(paso) la abre un poco, swell(segundos) la hace crecer, hush() la calla, resolve(nivel) la deja en un acorde
  // más lleno y brillante cuanto mayor es el nivel (0–4) y stop() la apaga.
  function bed(root=130.81){
    const idle={lift(){},swell(){},hush(){},resolve(){},stop(){}};
    if(!on||!context())return idle;
    try{
      const filter=audio.createBiquadFilter(),breath=audio.createGain(),volume=audio.createGain(),now=audio.currentTime,voices=[];
      filter.type='lowpass';filter.frequency.value=420;filter.Q.value=.6;
      volume.gain.setValueAtTime(.0001,now);volume.gain.exponentialRampToValueAtTime(.035,now+1.6);
      // Fundamental doblada y algo desafinada, quinta, octava y un brillo dos octavas arriba que empieza callado.
      for(const [ratio,cents,type,level] of [[1,-5,'triangle',.5],[1,5,'triangle',.5],[1.5,-4,'triangle',.35],[2,4,'sine',.3],[4,0,'sine',.0001]]){
        const oscillator=audio.createOscillator(),gain=audio.createGain();
        oscillator.type=type;oscillator.frequency.value=root*ratio;oscillator.detune.value=cents;gain.gain.value=level;
        oscillator.connect(gain).connect(filter);oscillator.start(now);voices.push({oscillator,gain});
      }
      // Respiración: el volumen sube y baja muy despacio.
      const lfo=audio.createOscillator(),depth=audio.createGain();
      lfo.frequency.value=.18;depth.gain.value=.16;breath.gain.value=.84;lfo.connect(depth).connect(breath.gain);lfo.start(now);
      filter.connect(breath).connect(volume);output(volume,.35);
      const ramp=(param,value,seconds)=>{
        const t=audio.currentTime;
        if(param.cancelAndHoldAtTime)param.cancelAndHoldAtTime(t);else{param.cancelScheduledValues(t);param.setValueAtTime(Math.max(.0001,param.value),t)}
        param.exponentialRampToValueAtTime(Math.max(.0001,value),t+seconds);
      };
      let dead=false;
      return {
        lift(step){if(!dead){ramp(filter.frequency,420+step*330,.3);ramp(volume.gain,.035+step*.006,.3)}},
        swell(seconds){if(!dead){ramp(filter.frequency,3200,seconds);ramp(volume.gain,.07,seconds)}},
        hush(){if(!dead)ramp(volume.gain,.0001,.12)},
        resolve(level){
          if(dead)return;
          ramp(volume.gain,.03+level*.007,.5);ramp(filter.frequency,650+level*500,.6);
          // Desde rara, la octava sube a la tercera mayor (acorde completo); desde épica entra el brillo agudo.
          ramp(voices[3].oscillator.frequency,root*(level>=2?2.52:2),.4);
          ramp(voices[4].oscillator.frequency,root*(level>=4?5.04:4),.4);ramp(voices[4].gain.gain,level>=3?.1+(level-3)*.06:.0001,.6);
        },
        stop(){
          if(dead)return;dead=true;ramp(volume.gain,.0001,.5);
          const end=audio.currentTime+.6;for(const {oscillator} of voices)oscillator.stop(end);lfo.stop(end);
        }
      };
    }catch{return idle}
  }
  // «¡Casi casi!» (decisión 0030): dos notas cortas que suben («ca-si»), un acorde brillante y un destello de ruido agudo.
  function casi(at=0){
    tone(784,at,.11,{type:'triangle',gain:.07});tone(1047,at+.1,.11,{type:'triangle',gain:.07});
    for(const [f,d] of [[1319,.55],[1568,.6],[2093,.7]])tone(f,at+.22,d,{type:'triangle',gain:.045});
    noise(at+.22,.5,{gain:.025,from:6000,to:11000,q:.8,filter:'highpass',attack:.02});
  }
  // Voz del avatar: aguda, de niño pequeño. Se sintetiza por formantes: una onda con el tono de la voz (muy alto, unos
  // 600 Hz, que sube y cae como una exclamación) pasa por tres filtros que imitan la boca diciendo cada vocal. Las
  // resonancias de un niño son más altas que las de un adulto; deslizarlas de una vocal a otra es lo que forma la palabra.
  // `vowels` = vocales por las que pasa ([F1, F2, F3] en Hz), `pitch` = curva del tono [inicio, pico, final].
  const VOWEL={a:[1050,1750,3500],e:[620,2650,3700],i:[430,3150,3950],o:[640,1150,3300],u:[430,980,3250]};
  function voice(vowels,{at=0,duration=.42,pitch=[560,720,430],gain=.12}={}){
    if(!on||!context())return;
    try{
      const start=audio.currentTime+at,end=start+duration,lift=.92+Math.random()*.16,mouth=audio.createGain(),source=audio.createOscillator(),tremble=audio.createOscillator(),depth=audio.createGain();
      source.type='sawtooth';
      source.frequency.setValueAtTime(pitch[0]*lift,start);source.frequency.exponentialRampToValueAtTime(pitch[1]*lift,start+duration*.22);source.frequency.exponentialRampToValueAtTime(pitch[2]*lift,end);
      // Un temblor rápido en el tono: lo aleja del pitido de máquina.
      tremble.frequency.value=7.5;depth.gain.value=pitch[1]*lift*.025;tremble.connect(depth).connect(source.frequency);
      mouth.gain.setValueAtTime(.0001,start);mouth.gain.exponentialRampToValueAtTime(gain,start+.025);mouth.gain.setValueAtTime(gain,start+duration*.55);mouth.gain.exponentialRampToValueAtTime(.0001,end);
      const soft=audio.createBiquadFilter();soft.type='lowpass';soft.frequency.value=5200;mouth.connect(soft);output(soft,.12);
      [1,.55,.22].forEach((level,n)=>{
        const band=audio.createBiquadFilter(),amount=audio.createGain();band.type='bandpass';band.Q.value=n?9:5;amount.gain.value=level*(n?3:2);
        vowels.forEach((vowel,i)=>{const f=VOWEL[vowel][n],when=start+duration*(i?.15+.55*i/(vowels.length-1):0);if(i)band.frequency.exponentialRampToValueAtTime(f,when);else band.frequency.setValueAtTime(f,when)});
        source.connect(band).connect(amount).connect(mouth);
      });
      // Un soplo de aire al arrancar, como el golpe de voz de una exclamación.
      noise(at,.06,{gain:gain*.25,from:2500,to:1800,q:1.2});
      source.start(start);tremble.start(start);source.stop(end+.05);tremble.stop(end+.05);
    }catch{}
  }
  // «¡Ay!» cuando tocan al avatar; a veces «¡Auu!» o un «¡ay, ay!» doble.
  function ay(){
    const pick=Math.random();
    if(pick<.55)voice(['a','a','i'],{gain:.19});
    else if(pick<.8)voice(['a','o','u'],{duration:.5,pitch:[600,760,420],gain:.11});
    else{voice(['a','i'],{duration:.22,pitch:[620,700,560],gain:.14});voice(['a','a','i'],{at:.24,duration:.34,pitch:[660,780,440],gain:.14})}
  }
  const save=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value))}catch{}};
  const announce=()=>document.dispatchEvent(new CustomEvent('faraday:sonido',{detail:{on,volume}}));
  // Al activar el sonido (siempre desde un botón, dentro del gesto) se desbloquea en ese mismo momento. Si el volumen
  // se había quedado a cero, vuelve a la mitad para que activar se oiga.
  function set(value){on=!!value;if(on){if(volume<.05)setVolume(.5,true);unlock()}save(KEY,on);announce()}
  // Volumen general de 0 a 1. Se aplica con una rampa corta para que no chasquee lo que esté sonando.
  function setVolume(value,quiet){
    volume=Math.min(1,Math.max(0,Number(value)||0));
    if(master)try{master.gain.setTargetAtTime(level(),audio.currentTime,.03)}catch{master.gain.value=level()}
    save(VOLUME_KEY,volume);if(!quiet)announce();
  }

  // Control de volumen: el botón del altavoz con una barra vertical que se despliega debajo. Con ratón la barra aparece
  // al pasar por encima y el clic silencia, como en los reproductores de vídeo; en pantallas táctiles el toque abre la
  // barra, que lleva su propio botón de silencio; con teclado se abre al llegar con el tabulador y se mueve con las
  // flechas. Todos los controles del juego (partida, duelo y cofres) comparten el mismo ajuste.
  const ICON='<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9.5h3.5L12 6v12l-4.5-3.5H4z"/><path class="sound-on" d="M15.5 9a4.5 4.5 0 0 1 0 6M18 6.5a8 8 0 0 1 0 11"/><path class="sound-off" d="m16 9.5 5 5m0-5-5 5"/></svg>';
  const controls=new Set();
  const blip=()=>{if(on)tone(660,0,.12,{gain:.08})};
  function control(button){
    if(!button||button.closest('.sound-control'))return;
    const wrap=document.createElement('span'),pop=document.createElement('div'),id='sound-pop-'+Math.random().toString(36).slice(2,8);
    wrap.className='sound-control';button.replaceWith(wrap);wrap.append(button,pop);
    pop.className='sound-pop';pop.id=id;pop.hidden=true;
    pop.innerHTML=`<output class="sound-value" aria-hidden="true"></output><div class="sound-slider" role="slider" tabindex="0" aria-label="Volumen" aria-orientation="vertical" aria-valuemin="0" aria-valuemax="100"><span class="sound-track"><span class="sound-fill"></span></span><span class="sound-thumb"></span></div><button type="button" class="sound-mute">${ICON}</button>`;
    button.setAttribute('aria-controls',id);button.setAttribute('aria-expanded','false');
    const slider=pop.querySelector('.sound-slider'),track=pop.querySelector('.sound-track'),value=pop.querySelector('.sound-value'),mute=pop.querySelector('.sound-mute');
    let pointer='mouse',timer=0,dragging=false,returning=false;
    const shown=()=>!pop.hidden;
    function show(){clearTimeout(timer);if(!shown()){pop.hidden=false;button.setAttribute('aria-expanded','true')}}
    function hide(){clearTimeout(timer);if(shown()&&!dragging){pop.hidden=true;button.setAttribute('aria-expanded','false')}}
    const later=()=>{clearTimeout(timer);timer=setTimeout(hide,350)};
    function paint(){
      const percent=on?Math.round(volume*100):0;
      button.setAttribute('aria-pressed',String(on));mute.setAttribute('aria-pressed',String(on));mute.setAttribute('aria-label',on?'Silenciar':'Activar sonido');
      slider.setAttribute('aria-valuenow',String(percent));slider.setAttribute('aria-valuetext',on?percent+' %':'Silenciado');
      slider.style.setProperty('--level',String(percent/100));value.textContent=String(percent);
    }
    // Llevar la barra a cero silencia; subirla desde el silencio vuelve a activar el sonido.
    function choose(percent){
      percent=Math.round(Math.min(100,Math.max(0,percent)));
      if(percent===0){if(on)set(false);else paint();return}
      setVolume(percent/100,true);if(on)announce();else set(true);
    }
    const fromPointer=event=>{const rect=track.getBoundingClientRect();choose((rect.bottom-event.clientY)/rect.height*100)};
    slider.addEventListener('pointerdown',event=>{event.preventDefault();dragging=true;pointer=event.pointerType;try{slider.setPointerCapture(event.pointerId)}catch{}slider.focus({preventScroll:true});fromPointer(event)});
    slider.addEventListener('pointermove',event=>{if(dragging)fromPointer(event)});
    const release=()=>{if(!dragging)return;dragging=false;blip();if(pointer==='mouse'&&!wrap.matches(':hover'))later()};
    slider.addEventListener('pointerup',release);slider.addEventListener('pointercancel',release);
    slider.addEventListener('keydown',event=>{
      const now=on?Math.round(volume*100):0,step={ArrowUp:5,ArrowRight:5,ArrowDown:-5,ArrowLeft:-5,PageUp:20,PageDown:-20}[event.key];
      const next=step!==undefined?now+step:event.key==='Home'?0:event.key==='End'?100:null;
      if(next===null)return;event.preventDefault();choose(next);blip();
    });
    wrap.addEventListener('pointerenter',event=>{if(event.pointerType==='mouse')show()});
    wrap.addEventListener('pointerleave',event=>{if(event.pointerType==='mouse'&&!dragging)later()});
    button.addEventListener('pointerdown',event=>{pointer=event.pointerType});
    // En táctil el toque abre o cierra la barra; con ratón o teclado (detail 0) silencia o activa.
    button.addEventListener('click',event=>{
      if(event.detail&&pointer!=='mouse'){shown()?hide():show();return}
      set(!on);blip();
    });
    mute.addEventListener('click',()=>{set(!on);blip()});
    wrap.addEventListener('focusin',event=>{if(!returning&&(event.target!==button||button.matches(':focus-visible')))show()});
    // Al cerrar con Escape el foco vuelve al botón sin reabrir la barra.
    const dismiss=()=>{hide();returning=true;button.focus();returning=false};
    wrap.addEventListener('focusout',event=>{if(!wrap.contains(event.relatedTarget)&&!wrap.matches(':hover'))hide()});
    controls.add({wrap,shown,hide,dismiss,paint});paint();
  }
  const live=()=>{for(const item of controls)if(!item.wrap.isConnected)controls.delete(item);return controls};
  document.addEventListener('faraday:sonido',()=>live().forEach(item=>item.paint()));
  // Tocar fuera cierra la barra. Escape la cierra antes que el diálogo que la contiene (va en captura, en window).
  document.addEventListener('pointerdown',event=>live().forEach(item=>{if(item.shown()&&!item.wrap.contains(event.target))item.hide()}),true);
  window.addEventListener('keydown',event=>{
    if(event.key!=='Escape')return;
    for(const item of live())if(item.shown()){event.stopImmediatePropagation();event.preventDefault();item.dismiss();return}
  },true);
  // Los botones de sonido de la partida y del duelo ya están en la página; el del cofre lo añade chest-open.js.
  document.querySelectorAll('.duel-sound').forEach(control);
  window.Sound={tone,noise,bell,bed,casi,voice,ay,context,set,setVolume,control,toggle:()=>{set(!on);return on},resume,get on(){return on},get volume(){return volume}};
})();

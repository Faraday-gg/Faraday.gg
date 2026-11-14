// Sonido compartido: tonos y ruido generados en el navegador con Web Audio (sin archivos). Lo usan los duelos (duel.js),
// la apertura de cofres (chest-open.js, que añade campanillas con reverberación y una cama de fondo, decisión 0037) y el momento «¡Casi casi!» (casi.js). El ajuste de silencio es el mismo para todo el juego y se guarda en este navegador.
(()=>{
  const KEY='casi-casi:duelo:sonido';
  let audio=null,on=true,hiss=null,hall=null;
  try{on=JSON.parse(localStorage.getItem(KEY))??true}catch{}
  // El contexto se crea la primera vez que hace falta: los navegadores solo lo dejan sonar tras un gesto del usuario.
  function context(){try{audio??=new (window.AudioContext||window.webkitAudioContext)()}catch{}return audio}
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
      convolver.connect(back).connect(audio.destination);hall=convolver;
    }catch{}
    return hall;
  }
  // Lleva un sonido a la salida y, si `wet` es mayor que 0, manda esa parte a la reverberación.
  function output(node,wet=0){
    node.connect(audio.destination);
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
  // Al activar el sonido (siempre desde un botón, dentro del gesto) se desbloquea en ese mismo momento.
  function set(value){on=!!value;if(on)unlock();try{localStorage.setItem(KEY,JSON.stringify(on))}catch{}document.dispatchEvent(new CustomEvent('faraday:sonido',{detail:{on}}))}
  window.Sound={tone,noise,bell,bed,casi,context,set,toggle:()=>{set(!on);return on},resume,get on(){return on}};
})();

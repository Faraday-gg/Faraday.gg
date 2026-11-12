// Sonido compartido: tonos y ruido generados en el navegador con Web Audio (sin archivos). Lo usan los duelos (duel.js),
// la apertura de cofres (chest-open.js) y el momento «¡Casi casi!» (casi.js). El ajuste de silencio es el mismo para todo el juego y se guarda en este navegador.
(()=>{
  const KEY='casi-casi:duelo:sonido';
  let audio=null,on=true,hiss=null;
  try{on=JSON.parse(localStorage.getItem(KEY))??true}catch{}
  // El contexto se crea la primera vez que hace falta: los navegadores solo lo dejan sonar tras un gesto del usuario.
  function context(){try{audio??=new (window.AudioContext||window.webkitAudioContext)()}catch{}return audio}
  // Una nota: oscilador con ataque corto y caída exponencial. `to` desliza la frecuencia hasta ese valor.
  function tone(frequency,at,duration,{type='sine',gain=.06,to}={}){
    if(!on||!context())return;
    try{
      const oscillator=audio.createOscillator(),volume=audio.createGain(),start=audio.currentTime+at;
      oscillator.type=type;oscillator.frequency.setValueAtTime(frequency,start);if(to)oscillator.frequency.exponentialRampToValueAtTime(to,start+duration);
      volume.gain.setValueAtTime(.0001,start);volume.gain.exponentialRampToValueAtTime(gain,start+.015);volume.gain.exponentialRampToValueAtTime(.0001,start+duration);
      oscillator.connect(volume).connect(audio.destination);oscillator.start(start);oscillator.stop(start+duration+.03);
    }catch{}
  }
  // Ruido filtrado, para soplidos, estallidos y brillos: `from` → `to` mueve el filtro durante el sonido.
  function noise(at,duration,{gain=.08,from=1200,to=from,q=1,filter='bandpass',attack=.01}={}){
    if(!on||!context())return;
    try{
      if(!hiss){hiss=audio.createBuffer(1,audio.sampleRate*2,audio.sampleRate);const data=hiss.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=Math.random()*2-1}
      const source=audio.createBufferSource(),band=audio.createBiquadFilter(),volume=audio.createGain(),start=audio.currentTime+at;
      source.buffer=hiss;source.loop=true;band.type=filter;band.Q.value=q;
      band.frequency.setValueAtTime(from,start);if(to!==from)band.frequency.exponentialRampToValueAtTime(to,start+duration);
      volume.gain.setValueAtTime(.0001,start);volume.gain.exponentialRampToValueAtTime(gain,start+attack);volume.gain.exponentialRampToValueAtTime(.0001,start+duration);
      source.connect(band).connect(volume).connect(audio.destination);source.start(start,Math.random());source.stop(start+duration+.03);
    }catch{}
  }
  // «¡Casi casi!» (decisión 0030): dos notas cortas que suben («ca-si»), un acorde brillante y un destello de ruido agudo.
  function casi(at=0){
    tone(784,at,.11,{type:'triangle',gain:.07});tone(1047,at+.1,.11,{type:'triangle',gain:.07});
    for(const [f,d] of [[1319,.55],[1568,.6],[2093,.7]])tone(f,at+.22,d,{type:'triangle',gain:.045});
    noise(at+.22,.5,{gain:.025,from:6000,to:11000,q:.8,filter:'highpass',attack:.02});
  }
  function set(value){on=!!value;try{localStorage.setItem(KEY,JSON.stringify(on))}catch{}document.dispatchEvent(new CustomEvent('faraday:sonido',{detail:{on}}))}
  window.Sound={tone,noise,casi,context,set,toggle:()=>{set(!on);return on},resume:()=>audio?.resume?.(),get on(){return on}};
})();

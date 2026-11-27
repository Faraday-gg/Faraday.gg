// Voz en los duelos (Contrato 4 del equipo social; servidor en lib/voz.mjs, estilos en voice.css).
// Al acabar cada pregunta de un duelo de dos personas, los jugadores pueden hablar unos segundos si AMBOS han activado
// la voz en ese duelo. El audio va directo de un navegador a otro (WebRTC, sin servidor de medios y sin grabarse).
// Como el juego no tiene conexiones abiertas, la oferta y la respuesta de la conexión viajan por la consulta de cada
// segundo del duelo: se mandan con send({op:'signal',…}) y la del rival llega en view.voice.signal. Por eso no se
// usa «trickle ICE»: se espera a tener los candidatos y se manda una sola oferta y una sola respuesta.
//
// Reglas que este archivo garantiza:
//  · El micrófono solo se pide cuando el jugador pulsa «Activar voz» en este duelo (o si marcó «Activar siempre»).
//  · Aunque la conexión esté hecha, el micrófono está cerrado (track.enabled=false) y el rival silenciado mientras
//    la pregunta está en juego; se abren solos en la fase «reveal» y en la pantalla final, hasta la hora que marca
//    el servidor (view.voice.until), y se cierran solos al acabar esa ventana o al ocultar la pestaña.
//  · Ningún fallo de voz puede romper el duelo: todo va en try/catch y las promesas tienen su catch.
//
// API pública (la usa dist/duel.js):
//   Voice.connect({send})   send(data) → Promise<{ok,status?,data}>: POST /api/duelo {action:'voz', id, player, ...data}
//   Voice.update(view)      en cada vista del duelo que llega del servidor
//   Voice.reset()           al salir del duelo: cuelga, libera el micrófono y quita la interfaz
//   Voice.active()          true si el jugador está en la llamada (para sondear más deprisa en la pantalla final)
(()=>{
  'use strict';
  // Servidores STUN: solo sirven para que cada navegador descubra su dirección pública. Son servicios externos
  // gratuitos (Google y Cloudflare); para cambiarlos o añadir un TURN propio basta con tocar esta constante.
  const ICE_SERVERS=[{urls:['stun:stun.l.google.com:19302','stun:stun.cloudflare.com:3478']}];
  const MAX_SDP=12000;          // igual que VOICE.maxSdp en lib/voz.mjs
  const GATHER_MS=2500;         // tope de espera a los candidatos antes de mandar la oferta o la respuesta
  const CONNECT_MS=20000;       // sin conexión en este tiempo, el intento se da por fallido…
  const CONNECT_SLOW_MS=30000;  // …o en este, en la pantalla final (allí el duelo consulta cada 3 s)
  const LOST_MS=12000;          // margen para que una conexión cortada se recupere sola
  const REVEAL_MS=10000,FINAL_MS=60000; // duración de las ventanas si el servidor no dice hasta cuándo
  const TICK_MS=200,SPEAK=.045,SPEAK_HOLD_MS=450;
  const ALWAYS='casi-casi:voz:siempre',SEEN='casi-casi:voz:aviso',SESSION='casi-casi:voz:';
  const supported=(()=>{try{return !!(navigator.mediaDevices&&typeof navigator.mediaDevices.getUserMedia==='function'&&typeof window.RTCPeerConnection==='function')}catch{return false}})();

  let send=null;
  // Duelo en curso y lo último que ha dicho el servidor.
  let duelId='',seat=-1,phase='',rivalName='',voice=null,offset=0,maxGen=-1,openKey='',openSince=0,finalSince=0;
  // Mi lado de la llamada.
  let joined=false,joining=false,joinToken=0,autoTried=false,optPending=0,mismatch=0;
  let stream=null,track=null,micMuted=false,spkMuted=false;
  // Conexión con el rival: `stage` es 'new' → 'working' → 'offered' → 'answered'.
  let pc=null,pcGen=-1,stage='',connected=false,lost=false,watch=0,retries=0,deadGen=-1,retryTimer=0;
  // Interfaz.
  let bar=null,els=null,audioEl=null,ticker=0,note='',noteTimer=0,meter=null,spokeMe=0,spokeRival=0;
  // La primera vez que alguien pulsa «Activar voz» se le enseña el aviso (qué se oye, cuándo y que el rival puede ver
  // su dirección IP) y tiene que pulsar otra vez. `armed` = el aviso está a la vista esperando esa segunda pulsación.
  let armed=false;
  // La página se está cerrando (o guardando en la caché de ida y vuelta): hasta que vuelva, no se atiende nada.
  let frozen=false;

  const store={
    get(area,key){try{return window[area].getItem(key)}catch{return null}},
    set(area,key,value){try{window[area].setItem(key,value)}catch{}}
  };
  const always=()=>store.get('localStorage',ALWAYS)==='1';
  const serverNow=()=>Date.now()+offset;
  const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  const stopStream=media=>{try{media?.getTracks?.().forEach(one=>{try{one.stop()}catch{}})}catch{}};

  // ── Servidor ────────────────────────────────────────────────────────────────────────────────────────────────
  // Manda una operación de voz del duelo `id` y aprovecha la vista que devuelve.
  async function post(data,id=duelId){
    if(!send||!id)return {ok:false,data:{}};
    try{
      const response=await send({...data,id});
      if(!response||typeof response!=='object')return {ok:false,data:{}};
      if(response.ok&&response.data&&response.data.id===id&&duelId===id)ingest(response.data);
      return response;
    }catch{return {ok:false,data:{}}}
  }
  // Manda la oferta o la respuesta; si falla la red lo reintenta, y si el servidor la rechaza (intento viejo) lo deja.
  async function deliver(data,peer){
    for(let attempt=0;attempt<3;attempt++){
      if(pc!==peer)return false;
      const response=await post(data);
      if(pc!==peer)return false;
      if(response.ok)return true;
      if(response.status>=400&&response.status<500&&response.status!==429)return false;
      await wait(1200);
    }
    if(pc===peer)failed();
    return false;
  }
  // Al cerrar la pestaña no da tiempo a una petición normal: se avisa con una que el navegador termina por su cuenta.
  function byeNow(){
    try{
      const id=duelId;if(!id)return;
      if(typeof window.playerId==='function'){
        fetch('/api/duelo',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'voz',player:window.playerId(),id,op:'bye'}),keepalive:true}).catch(()=>{});
      }else if(send){const sent=send({op:'bye',id});if(sent?.catch)sent.catch(()=>{})}
    }catch{}
  }

  // ── Micrófono ───────────────────────────────────────────────────────────────────────────────────────────────
  function micError(error){
    const name=error?.name||'';
    if(name==='NotAllowedError'||name==='SecurityError'||name==='PermissionDeniedError')return 'Permiso del micrófono denegado. Actívalo en el navegador para usar la voz.';
    if(name==='NotFoundError'||name==='DevicesNotFoundError'||name==='OverconstrainedError')return 'No se ha encontrado ningún micrófono.';
    if(name==='NotReadableError'||name==='TrackStartError'||name==='AbortError')return 'El micrófono está ocupado en otra aplicación.';
    return 'No se ha podido usar el micrófono.';
  }
  // Activa la voz en este duelo: pide el micrófono y, si lo hay, apunta la adhesión en el servidor.
  async function join(){
    if(joined||joining||!supported||!voice||!duelId)return;
    const id=duelId,token=++joinToken;
    joining=true;say('');render();
    let media=null;
    try{media=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true},video:false})}
    catch(error){if(token===joinToken){joining=false;say(micError(error));render()}return}
    const own=(()=>{try{return media.getAudioTracks()[0]||null}catch{return null}})();
    if(token!==joinToken||duelId!==id||!own){
      stopStream(media);
      if(token===joinToken){joining=false;say(own?'':'No se ha encontrado ningún micrófono.');render()}
      return;
    }
    own.enabled=false; // cerrado hasta que se abra la ventana de habla
    stream=media;track=own;joined=true;joining=false;mismatch=0;retries=0;deadGen=-1;
    try{own.addEventListener('ended',()=>{if(track===own)leave('Se ha perdido el micrófono.')})}catch{}
    store.set('sessionStorage',SESSION+id,'1');
    startMeter();startTicker();render();
    optPending++;
    const response=await post({op:'opt',on:true},id);
    optPending--;
    if(!response.ok&&token===joinToken&&joined)leave(typeof response.data?.error==='string'?response.data.error:'No se ha podido activar la voz.',{bye:false});
  }
  function stopLocal(){
    stopStream(stream);stream=null;track=null;
    if(meter){try{meter.ctx.close().catch(()=>{})}catch{}meter=null}
    spokeMe=spokeRival=0;
  }
  // Cuelga sin avisar al servidor ni tocar lo que el jugador eligió (cambio de duelo, cierre de la página).
  function dropLocal(){
    joinToken++;closePc();stopLocal();clearTimeout(retryTimer);retryTimer=0;
    joined=false;joining=false;retries=0;mismatch=0;autoTried=false;
  }
  // Sale de la llamada: cierra la conexión, libera el micrófono y avisa al rival. Se puede volver a entrar.
  function leave(message='',{bye=true}={}){
    const was=joined||joining,id=duelId;
    dropLocal();autoTried=true;
    if(id)store.set('sessionStorage',SESSION+id,'0');
    if(was&&bye)post({op:'bye'},id);
    say(message);render();
  }

  // ── Conexión (RTCPeerConnection) ────────────────────────────────────────────────────────────────────────────
  function gathered(peer){
    return new Promise(resolve=>{
      let timer=0;
      const done=()=>{clearTimeout(timer);try{peer.removeEventListener('icegatheringstatechange',check);peer.removeEventListener('icecandidate',last)}catch{}resolve()};
      const check=()=>{if(peer.iceGatheringState==='complete')done()};
      const last=event=>{if(!event.candidate)done()};
      if(peer.iceGatheringState==='complete'){resolve();return}
      timer=setTimeout(done,GATHER_MS);
      try{peer.addEventListener('icegatheringstatechange',check);peer.addEventListener('icecandidate',last)}catch{done()}
    });
  }
  function closePc(){
    clearTimeout(watch);watch=0;
    const peer=pc;pc=null;pcGen=-1;stage='';connected=false;lost=false;
    if(peer){try{peer.ontrack=peer.onconnectionstatechange=peer.oniceconnectionstatechange=null;peer.close()}catch{}}
    try{if(audioEl)audioEl.srcObject=null}catch{}
    if(meter)meter.remote=null;
  }
  function startPc(gen){
    try{
      const peer=new RTCPeerConnection({iceServers:ICE_SERVERS,bundlePolicy:'max-bundle'});
      pc=peer;pcGen=gen;stage='new';connected=false;lost=false;
      clearTimeout(retryTimer);retryTimer=0;
      if(track&&stream)peer.addTrack(track,stream);
      peer.ontrack=event=>{
        try{
          if(pc!==peer)return;
          const remote=event.streams?.[0]||new MediaStream([event.track]);
          if(audioEl){audioEl.srcObject=remote;audioEl.muted=true;const playing=audioEl.play();if(playing?.catch)playing.catch(()=>{})}
          if(meter)meter.remote=tap(remote);
        }catch{}
      };
      const changed=()=>{
        try{
          if(pc!==peer)return;
          const state=peer.connectionState||peer.iceConnectionState;
          if(state==='connected'||state==='completed'){connected=true;lost=false;retries=0;clearTimeout(watch);watch=0}
          else if(state==='failed'){failed();return}
          else if(state==='disconnected'&&connected){connected=false;lost=true;clearTimeout(watch);watch=setTimeout(()=>{if(pc===peer&&!connected)failed()},LOST_MS)}
          tick();
        }catch{}
      };
      peer.onconnectionstatechange=changed;peer.oniceconnectionstatechange=changed;
      clearTimeout(watch);watch=setTimeout(()=>{if(pc===peer&&!connected)failed()},phase==='finished'?CONNECT_SLOW_MS:CONNECT_MS);
      return true;
    }catch{pc=null;stage='';giveUp();return false}
  }
  // El asiento 0 ofrece…
  async function offer(peer,gen){
    stage='working';
    try{
      await peer.setLocalDescription(await peer.createOffer());
      await gathered(peer);
      if(pc!==peer)return;
      const sdp=peer.localDescription?.sdp||'';
      if(!sdp||sdp.length>MAX_SDP)throw new Error('sdp');
      if(!await deliver({op:'signal',kind:'offer',sdp,gen},peer))return;
      if(pc!==peer)return;
      stage='offered';sync();
    }catch{if(pc===peer)failed()}
  }
  // …el asiento 1 responde…
  async function answer(peer,gen,sdp){
    stage='working';
    try{
      await peer.setRemoteDescription({type:'offer',sdp});
      await peer.setLocalDescription(await peer.createAnswer());
      await gathered(peer);
      if(pc!==peer)return;
      const local=peer.localDescription?.sdp||'';
      if(!local||local.length>MAX_SDP)throw new Error('sdp');
      if(await deliver({op:'signal',kind:'answer',sdp:local,gen},peer)&&pc===peer)stage='answered';
    }catch{if(pc===peer)failed()}
  }
  // …y el asiento 0 recoge la respuesta (y avisa para que se borre del estado del duelo).
  async function accept(peer,gen,sdp){
    stage='working';
    try{
      await peer.setRemoteDescription({type:'answer',sdp});
      if(pc!==peer)return;
      stage='answered';post({op:'ack',gen});
    }catch{if(pc===peer)failed()}
  }
  // Un intento no ha conectado (o se ha cortado). Se reintenta una vez: el asiento 0 pide un intento nuevo
  // (volver a activar la voz sube `gen`) y el 1 espera a que llegue. Si tampoco, se cuelga con un mensaje claro.
  function failed(){
    const gen=pcGen;closePc();deadGen=gen;
    if(!joined)return;
    if(retries<1){
      retries++;
      if(seat===0){optPending++;post({op:'opt',on:true}).then(response=>{optPending--;if(!response.ok&&joined)giveUp()}).catch(()=>{optPending--})}
      else{clearTimeout(retryTimer);retryTimer=setTimeout(()=>{if(joined&&!pc&&voice?.opt.rival)giveUp()},LOST_MS)}
      render();return;
    }
    giveUp();
  }
  function giveUp(){leave('No se ha podido conectar la voz.')}
  // Pone la conexión al día con lo que dice el servidor: quién está, qué intento toca y qué señal ha llegado.
  function sync(){
    try{
      if(!joined||!voice)return;
      if(!voice.opt.rival&&voice.left&&retries>0){giveUp();return} // el rival ha colgado porque tampoco conectaba
      if(!voice.opt.me||!voice.opt.rival){closePc();return}
      const gen=voice.gen;
      if(pc&&pcGen!==gen)closePc();
      if(!pc){if(gen===deadGen||!startPc(gen))return}
      const signal=voice.signal&&voice.signal.gen===gen&&typeof voice.signal.sdp==='string'&&voice.signal.sdp.length<=MAX_SDP?voice.signal:null;
      if(seat===0){
        if(stage==='new')offer(pc,gen);
        else if(stage==='offered'&&signal?.kind==='answer')accept(pc,gen,signal.sdp);
      }else if(stage==='new'&&signal?.kind==='offer')answer(pc,gen,signal.sdp);
    }catch{}
  }

  // ── Ventana de habla ────────────────────────────────────────────────────────────────────────────────────────
  // Hasta cuándo dura la ventana de esta fase, en hora del servidor.
  function windowEnd(){
    if(Number.isFinite(voice?.until))return voice.until;
    return phase==='finished'?finalSince+FINAL_MS:openSince+REVEAL_MS;
  }
  const windowOpen=()=>!!voice?.open&&!document.hidden&&serverNow()<windowEnd();
  const finalOver=()=>phase==='finished'&&!!voice&&(voice.ended||(finalSince>0&&serverNow()>=windowEnd()));

  // Nivel de audio de cada lado, para señalar quién habla. Es opcional: si el navegador no lo permite, no se muestra.
  function tap(media){
    try{
      if(!meter)return null;
      const source=meter.ctx.createMediaStreamSource(media),analyser=meter.ctx.createAnalyser();
      analyser.fftSize=512;source.connect(analyser);
      return {analyser,data:new Uint8Array(analyser.fftSize)};
    }catch{return null}
  }
  function startMeter(){
    try{
      const Context=window.AudioContext||window.webkitAudioContext;
      if(!Context||meter||!stream)return;
      meter={ctx:new Context(),local:null,remote:null};
      meter.local=tap(stream);
      const resumed=meter.ctx.resume?.();if(resumed?.catch)resumed.catch(()=>{});
    }catch{meter=null}
  }
  function level(node){
    try{
      if(!node)return 0;
      node.analyser.getByteTimeDomainData(node.data);
      let sum=0;for(const value of node.data){const x=(value-128)/128;sum+=x*x}
      return Math.sqrt(sum/node.data.length);
    }catch{return 0}
  }
  // Cada 200 ms: abre o cierra micrófono y altavoz según la ventana, mide quién habla y repinta la cuenta atrás.
  function tick(){
    try{
      const live=joined&&connected&&windowOpen();
      if(track)track.enabled=live&&!micMuted;
      if(audioEl)audioEl.muted=!live||spkMuted;
      if(live&&meter){
        const now=Date.now();
        if(!micMuted&&level(meter.local)>SPEAK)spokeMe=now;
        if(level(meter.remote)>SPEAK)spokeRival=now;
      }else spokeMe=spokeRival=0;
      if((joined||joining)&&finalOver()){leave('La llamada ha terminado.');return}
      render();
    }catch{}
  }
  // Red de seguridad: si la pantalla del duelo se ha cerrado o ha vuelto a su portada sin pasar por Voice.reset(),
  // se cuelga igual. Así el micrófono nunca se queda abierto fuera de un duelo.
  function beat(){
    try{
      const shell=document.getElementById('duel-shell');
      if(!shell||shell.hidden||shell.dataset.screen==='lobby'){window.Voice.reset();return}
    }catch{}
    tick();
  }
  function startTicker(){if(!ticker)ticker=setInterval(beat,TICK_MS)}
  function stopTicker(){clearInterval(ticker);ticker=0}

  // ── Lo que llega del servidor ───────────────────────────────────────────────────────────────────────────────
  function forget(){
    maxGen=-1;autoTried=false;retries=0;deadGen=-1;mismatch=0;openKey='';openSince=0;finalSince=0;voice=null;phase='';seat=-1;rivalName='';
    clearTimeout(noteTimer);note='';armed=false;
  }
  function ingest(view){
    if(frozen||!view||typeof view!=='object'||typeof view.id!=='string'||!view.id)return;
    if(view.id!==duelId){
      // Duelo nuevo (revancha, otro código): se cuelga el anterior y se empieza de cero. La voz hay que activarla otra vez.
      const old=duelId,was=joined||joining;
      dropLocal();if(was&&old)post({op:'bye'},old);
      forget();duelId=view.id;
    }
    const next=view.voice,place=view.you;
    if(!supported||!next||typeof next!=='object'||!next.available||(place!==0&&place!==1)){
      voice=null;phase=typeof view.phase==='string'?view.phase:'';
      if(joined||joining)dropLocal();
      render();return;
    }
    const gen=Number.isInteger(next.gen)?next.gen:0;
    if(gen<maxGen)return; // vista atrasada (las respuestas pueden llegar desordenadas): se ignora
    maxGen=gen;
    if(Number.isFinite(view.now))offset=view.now-Date.now();
    seat=place;phase=typeof view.phase==='string'?view.phase:'';
    rivalName=typeof view.players?.[1-seat]?.name==='string'?view.players[1-seat].name:'';
    voice={opt:{me:!!next.opt?.me,rival:!!next.opt?.rival},gen,signal:next.signal&&typeof next.signal==='object'?next.signal:null,
      open:!!next.open,until:Number.isFinite(next.until)?next.until:null,left:!!next.left,ended:!!next.ended};
    const key=`${phase}:${view.round?.number||0}`;
    if(voice.open){if(openKey!==key){openKey=key;openSince=serverNow()}}else openKey='';
    if(phase==='finished'){if(!finalSince)finalSince=serverNow()}else finalSince=0;
    // Si el servidor insiste en que no tengo la voz activada (la quité en otra pestaña), se cuelga aquí también.
    if(joined&&!optPending){
      if(voice.opt.me)mismatch=0;
      else if(++mismatch>=3){dropLocal();autoTried=true;say('La voz se ha desactivado.')}
    }
    // Se vuelve a entrar sola únicamente si el jugador ya la activó en ESTE duelo (recarga de la página)
    // o si marcó «Activar siempre la voz en mis duelos».
    if(!joined&&!joining&&!autoTried&&!finalOver()){
      autoTried=true;
      const flag=store.get('sessionStorage',SESSION+duelId);
      if(flag==='1'||(flag===null&&always()))join().catch(()=>{});
    }
    sync();tick();
  }

  // ── Interfaz ────────────────────────────────────────────────────────────────────────────────────────────────
  const svg=(body,extra='')=>`<svg ${extra} viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
  const MIC='<path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3z"/><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3"/>';
  const SPEAKER='<path d="M4 9.5h3.5L12 6v12l-4.5-3.5H4z"/>';
  const TEMPLATE=`
    <div class="voice-row">
      <span class="voice-dot" aria-hidden="true"></span>
      <div class="voice-text">
        <p class="voice-status"><span class="voice-label" role="status" aria-live="polite"></span><span class="voice-count" aria-hidden="true"></span></p>
        <p class="voice-who" hidden><span class="voice-chip" data-who="me">Tú</span><span class="voice-chip" data-who="rival"></span></p>
      </div>
      <div class="voice-actions">
        <button type="button" class="voice-btn voice-join" data-voice="join">${svg(MIC)}<span class="voice-join-text">Activar voz</span></button>
        <button type="button" class="voice-btn voice-mic" data-voice="mic" hidden>${svg(MIC,'class="voice-on"')}${svg(MIC+'<path d="m4 4 16 16"/>','class="voice-off"')}<span class="voice-mic-text"></span></button>
        <button type="button" class="voice-icon voice-spk" data-voice="spk" hidden>${svg(SPEAKER+'<path d="M15.5 9a4.5 4.5 0 0 1 0 6M18 6.5a8 8 0 0 1 0 11"/>','class="voice-on"')}${svg(SPEAKER+'<path d="m16 9.5 5 5m0-5-5 5"/>','class="voice-off"')}</button>
        <button type="button" class="voice-icon voice-leave" data-voice="leave" hidden>${svg('<path d="M3.5 14.6c5-4.6 12-4.6 17 0l-2.2 2.6-3.3-1.6v-2.4a9 9 0 0 0-6 0v2.4l-3.3 1.6z"/>')}</button>
        <button type="button" class="voice-icon voice-more" data-voice="more" aria-expanded="false" aria-controls="voice-extra" aria-label="Opciones de voz" title="Opciones de voz"><svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><circle cx="5.5" cy="12" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="18.5" cy="12" r="1.7"/></svg></button>
      </div>
    </div>
    <div class="voice-extra" id="voice-extra" hidden>
      <label class="voice-always"><input type="checkbox" data-voice="always"><span>Activar siempre la voz en mis duelos</span></label>
      <p class="voice-note">Solo se oye si los dos la activáis, y solo al acabar cada pregunta. El audio va directo de un navegador a otro y no se graba; al conectar, tu rival puede ver tu dirección IP. Mientras estés en la llamada, el navegador mantendrá encendido el indicador del micrófono durante todo el duelo, aunque solo se transmita en la pausa entre preguntas; «Salir de la llamada» lo apaga.</p>
    </div>
    <audio class="voice-audio" autoplay playsinline hidden></audio>`;
  function say(message){
    clearTimeout(noteTimer);note=message||'';
    if(note)noteTimer=setTimeout(()=>{note='';render()},9000);
  }
  function toggleMic(){micMuted=!micMuted;tick()}
  function showExtra(open){
    if(!els)return;
    els.extra.hidden=!open;els.more.setAttribute('aria-expanded',String(open));els.always.checked=always();
  }
  function pressJoin(){
    if(store.get('localStorage',SEEN)!=='1'&&!armed){armed=true;showExtra(true);render();return}
    armed=false;store.set('localStorage',SEEN,'1');
    // Leído el aviso, se pliega: abierto todo el duelo solo quita sitio (sigue estando en «Opciones de voz»).
    showExtra(false);
    join().catch(()=>{});
  }
  function mount(){
    const shell=document.getElementById('duel-shell');if(!shell)return false;
    if(!bar){
      bar=document.createElement('section');bar.className='voice-bar';bar.id='voice-bar';bar.hidden=true;
      bar.setAttribute('role','group');bar.setAttribute('aria-label','Voz con tu rival');
      bar.innerHTML=TEMPLATE;
      const find=selector=>bar.querySelector(selector);
      els={label:find('.voice-label'),count:find('.voice-count'),who:find('.voice-who'),me:find('[data-who=me]'),rival:find('[data-who=rival]'),
        join:find('.voice-join'),joinText:find('.voice-join-text'),mic:find('.voice-mic'),micText:find('.voice-mic-text'),spk:find('.voice-spk'),leave:find('.voice-leave'),
        more:find('.voice-more'),extra:find('.voice-extra'),always:find('[data-voice=always]')};
      audioEl=find('.voice-audio');audioEl.muted=true;
      bar.addEventListener('click',event=>{
        try{
          const action=event.target.closest?.('button[data-voice]')?.dataset.voice;if(!action)return;
          if(action==='join')pressJoin();
          else if(action==='mic')toggleMic();
          else if(action==='spk'){spkMuted=!spkMuted;tick()}
          else if(action==='leave')leave('');
          else if(action==='more'){armed=false;showExtra(els.extra.hidden);render()}
        }catch{}
      });
      els.always.addEventListener('change',()=>{store.set('localStorage',ALWAYS,els.always.checked?'1':'0')});
    }
    if(!bar.isConnected||!shell.contains(bar)){
      // Debajo del marcador y encima de la tarjeta de la pregunta: en el flujo de la página, así no tapa nada.
      const hud=document.getElementById('duel-hud'),header=shell.querySelector('.game-bar');
      if(hud&&shell.contains(hud))hud.after(bar);else if(header)header.after(bar);else shell.append(bar);
    }
    return true;
  }
  const put=(element,text)=>{if(element.textContent!==text)element.textContent=text};
  const attr=(element,name,value)=>{if(element.getAttribute(name)!==value)element.setAttribute(name,value)};
  const hide=(element,hidden)=>{if(element.hidden!==hidden)element.hidden=hidden};
  function render(){
    try{
      const over=finalOver();
      const show=supported&&!!voice&&['intro','question','reveal','finished'].includes(phase)&&(!over||!!note);
      if(!show){if(bar)bar.hidden=true;if(!joined&&!joining)stopTicker();return}
      if(!mount())return;
      startTicker();
      const open=joined&&windowOpen(),live=open&&connected,now=Date.now();
      let state='off',label='',count='';
      if(joining){state='asking';label='Pidiendo permiso del micrófono…'}
      else if(!joined){state=note?'notice':'off';label=note||(over?'La llamada ha terminado.':armed?'Lee el aviso y pulsa otra vez':voice.opt.rival?'Tu rival ha activado la voz':'Voz desactivada')}
      else if(!voice.opt.rival){state='waiting';label=voice.left?'Tu rival ha salido de la llamada':'Esperando a que tu rival active la voz'}
      else if(!connected){state='connecting';label=lost||retries?'Reconectando…':'Conectando…'}
      else if(live){state='live';label=micMuted?'En directo (tu micro está silenciado)':'En directo';count=` · ${Math.max(0,Math.ceil((windowEnd()-serverNow())/1000))} s`}
      else{state='closed';label=document.hidden?'Voz en pausa':phase==='reveal'||phase==='finished'?'Micros cerrados':'Micros cerrados hasta el final de la pregunta'}
      attr(bar,'data-state',state);
      put(els.label,label);put(els.count,count);
      hide(els.join,joined||joining||over);put(els.joinText,armed?'Entendido, activar':'Activar voz');
      hide(els.mic,!joined);hide(els.spk,!joined);hide(els.leave,!joined&&!joining);
      attr(els.mic,'data-muted',micMuted?'1':'0');
      put(els.micText,micMuted?'Activar micro':'Silenciar');
      attr(els.mic,'aria-label',micMuted?'Activar mi micrófono (tecla M)':'Silenciar mi micrófono (tecla M)');attr(els.mic,'title',micMuted?'Activar mi micrófono (M)':'Silenciar mi micrófono (M)');
      attr(els.spk,'data-muted',spkMuted?'1':'0');
      attr(els.spk,'aria-label',spkMuted?'Volver a oír a tu rival':'Silenciar a tu rival');attr(els.spk,'title',spkMuted?'Volver a oír a tu rival':'Silenciar a tu rival');
      attr(els.leave,'aria-label',joining?'Cancelar':'Salir de la llamada');attr(els.leave,'title',joining?'Cancelar':'Salir de la llamada');
      hide(els.who,!live||!meter);
      put(els.rival,rivalName||'Rival'); // nombre de otro jugador: siempre como texto
      els.me.classList.toggle('is-speaking',live&&now-spokeMe<SPEAK_HOLD_MS);
      els.rival.classList.toggle('is-speaking',live&&!spkMuted&&now-spokeRival<SPEAK_HOLD_MS);
      els.mic.classList.toggle('is-speaking',live&&now-spokeMe<SPEAK_HOLD_MS);
      bar.hidden=false;
    }catch{}
  }

  // Tecla M: silencia o activa mi micrófono mientras estoy en la llamada, salvo si estoy escribiendo.
  document.addEventListener('keydown',event=>{
    try{
      if(!joined||!bar||bar.hidden||event.defaultPrevented||event.repeat||event.ctrlKey||event.metaKey||event.altKey)return;
      if(event.key!=='m'&&event.key!=='M')return;
      const shell=document.getElementById('duel-shell'),target=event.target;
      if(!shell||shell.hidden||document.querySelector('dialog[open]'))return;
      if(target&&(target.isContentEditable||/^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName||'')))return;
      event.preventDefault();toggleMic();
    }catch{}
  });
  // Pestaña oculta: el micrófono se cierra al momento (los temporizadores van más lentos en segundo plano).
  document.addEventListener('visibilitychange',()=>tick());
  // Al cerrar o recargar la página: se cuelga y se libera el micrófono. Si se vuelve al mismo duelo, se reconecta.
  window.addEventListener('pagehide',()=>{try{frozen=true;if(joined||joining){byeNow();dropLocal()}}catch{}});
  window.addEventListener('pageshow',()=>{frozen=false});

  window.Voice={
    connect(options){try{send=typeof options?.send==='function'?options.send:null}catch{send=null}},
    update(view){try{ingest(view)}catch{}},
    reset(){
      try{
        const was=joined||joining,id=duelId;
        dropLocal();
        if(was&&id){store.set('sessionStorage',SESSION+id,'0');post({op:'bye'},id)}
        forget();duelId='';stopTicker();
        if(bar){bar.remove();bar=null;els=null;audioEl=null}
      }catch{}
    },
    active(){return joined||joining},
    ICE_SERVERS
  };
})();

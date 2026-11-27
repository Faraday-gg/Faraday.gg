// Voz en los duelos (Contrato 4 del equipo social). Al acabar cada pregunta, los dos jugadores de un duelo pueden
// hablar unos segundos si AMBOS han activado la voz. El audio va de navegador a navegador (WebRTC, dist/voice.js);
// el servidor solo hace de buzón: guarda quién ha activado la voz y la oferta/respuesta de la conexión, que viajan
// por la consulta de cada segundo del duelo (no hay conexiones abiertas ni WebSocket).
//
// Son funciones puras sobre `state.voice`, sin dependencias (lib/duelos.mjs las importa; aquí no se importa nada
// de allí para que no haya importación circular):
//   state.voice = { opt:[bool,bool],      quién ha activado la voz en este duelo
//                   gen:n,                intento de conexión: sube cada vez que alguien entra o sale de la llamada
//                   step:0|1|2|3,         dentro del intento: nada, hay oferta, hay respuesta, respuesta recogida
//                   sig:[oferta|null, respuesta|null],   lo que ha mandado cada asiento ({kind,sdp,gen})
//                   bye:[ms,ms],          cuándo salió cada uno de la llamada (0 = no ha salido)
//                   ops:[[ms,n],[ms,n]],  freno: operaciones de cada asiento en la ventana en curso
//                   fin:true }            el duelo ya ha terminado y se ha hecho la limpieza del final (voiceSweep)
// Se guarda como mucho una oferta o una respuesta a la vez (la oferta se borra al llegar la respuesta y la respuesta
// al recogerla), así que el estado del duelo no crece. Acabada la llamada (pasada la ventana de la pantalla final, o
// cancelado el duelo) no se aceptan más señales y la que quedara guardada se borra (voiceSweep).
// El freno cuenta todas las operaciones, también las rechazadas: lib/duelos.mjs guarda el duelo aunque la operación
// no valga, salvo cuando el freno ya está agotado (ahí no se toca nada, para que una ráfaga no reescriba el duelo).

export const VOICE={
  maxSdp:12000,        // caracteres como mucho de una oferta o respuesta (un SDP de solo audio ronda los 2 000-4 000)
  revealMs:10000,      // ventana de habla tras cada pregunta si quien llama no dice otra cosa (= RULES.revealMs)
  finalMs:60000,       // ventana de habla en la pantalla final
  burst:30,            // como mucho 30 operaciones de voz de cada jugador…
  burstMs:10000        // …cada 10 segundos
};
const fail=(status,error)=>({status,body:{error}});
const DONE={status:200};
const blank=()=>({opt:[false,false],gen:0,step:0,sig:[null,null],bye:[0,0],ops:[[0,0],[0,0]]});
// Un SDP es texto ASCII que empieza por «v=0»; no se interpreta aquí, solo se acota.
const SDP=/^v=0\r?\n[\x20-\x7e\r\n\t]*$/;

// ¿Puede haber voz en este duelo? Solo entre dos personas: ni contra el bot ni en el duelo de tres, y con el duelo empezado.
function eligible(state){
  const players=state?.players;
  return !!state&&state.size!==3&&Array.isArray(players)&&players.length===2&&players.every(player=>player&&!player.bot)
    &&state.status!=='waiting'&&state.reason!=='cancelado';
}
// Fase del duelo vista desde el estado, por si quien llama no la pasa.
function phaseOf(state){
  if(state.status==='finished')return 'finished';
  const round=state.rounds?.at?.(-1);
  return round?.resolvedAt!=null?'reveal':'question';
}
// Hasta cuándo dura la ventana de habla de esta fase (ms de servidor), o null si la fase no tiene o no se puede saber.
function windowEnd(state,phase,info){
  const round=state.rounds?.at?.(-1);
  if(phase==='reveal'){
    if(Number.isFinite(info?.until))return info.until;
    return Number.isFinite(round?.resolvedAt)?round.resolvedAt+VOICE.revealMs:null;
  }
  if(phase==='finished'){
    // El duelo acaba al resolverse la última ronda o cuando alguien lo abandona (ahí lib/duelos.mjs apunta seenAt).
    const at=Math.max(Number.isFinite(round?.resolvedAt)?round.resolvedAt:0,state.reason==='abandono'&&Number.isFinite(state.seenAt)?state.seenAt:0);
    return at?at+VOICE.finalMs:null;
  }
  return null;
}
// Deja state.voice con la forma esperada aunque venga de un duelo antiguo o a medias.
function ensure(state){
  const voice=state.voice&&typeof state.voice==='object'?state.voice:(state.voice=blank());
  const base=blank();
  for(const key of ['opt','sig','bye','ops'])if(!Array.isArray(voice[key])||voice[key].length!==2)voice[key]=base[key];
  if(!Number.isInteger(voice.gen)||voice.gen<0)voice.gen=0;
  if(![0,1,2,3].includes(voice.step))voice.step=0;
  return voice;
}
// Empieza un intento nuevo: las señales del anterior ya no valen.
function restart(voice){voice.gen=(voice.gen||0)+1;voice.step=0;voice.sig=[null,null]}
// ¿Ha pasado ya la ventana de habla de la pantalla final? Desde ahí la llamada de este duelo se ha acabado.
function over(state,now){
  if(state.status!=='finished')return false;
  const end=windowEnd(state,'finished');
  return end!=null&&now>=end;
}
// Limpieza: que un duelo terminado no se quede guardando la oferta o la respuesta de una conexión (hasta 12 000
// caracteres cada una). Devuelve true si ha cambiado el estado, para que quien llama lo guarde; lib/duelos.mjs la
// llama cada vez que pone un duelo al día y después de cada cambio.
//   · Al terminar el duelo (una sola vez, `fin`): si había una conexión a medias, se borra su señal y se pide un
//     intento nuevo, que los dos navegadores empiezan solos si siguen en la pantalla final.
//   · Pasada la ventana de la pantalla final, o si el duelo ya no admite voz (cancelado): se borra lo que quede.
export function voiceSweep(state,now){
  const voice=state?.voice;
  if(!voice||typeof voice!=='object'||!Array.isArray(voice.sig))return false;
  const pending=voice.sig.some(Boolean);
  if(!eligible(state)||over(state,Number.isFinite(now)?now:Date.now())){
    if(!pending)return false;
    voice.sig=[null,null];voice.step=0;
    return true;
  }
  if(state.status!=='finished'||voice.fin)return false;
  voice.fin=true;
  if(pending)restart(voice);
  return true;
}

// Aplica una operación de voz del asiento `seat` (0 o 1) sobre `state`. Devuelve {status:200} si vale
// o {status:4xx, body:{error}} si no (y entonces no hay nada que guardar).
//   {op:'opt', on:true|false}                  activa o desactiva la voz de este jugador en este duelo
//   {op:'signal', kind:'offer'|'answer', sdp, gen}   la oferta (solo el asiento 0) o la respuesta (solo el 1) del intento `gen`
//   {op:'ack', gen}                            el asiento 0 ya ha recogido la respuesta: se borra del estado
//   {op:'bye'}                                 sale de la llamada (igual que opt con on:false)
export function voiceAction(state,seat,data,now){
  if(seat!==0&&seat!==1)return fail(403,'No participas en este duelo');
  if(!state||typeof state!=='object')return fail(404,'Duelo no encontrado');
  if(!eligible(state))return fail(409,state.status==='waiting'&&state.size!==3?'La voz se activa cuando empieza el duelo':'La voz solo está disponible en los duelos de dos personas');
  if(!data||typeof data!=='object'||typeof data.op!=='string')return fail(400,'Operación de voz no válida');
  const t=Number.isFinite(now)?now:Date.now(),voice=ensure(state),ops=voice.ops[seat];
  // Freno: con el cupo agotado se rechaza sin tocar el estado; si no, la operación cuenta, valga o no.
  if(!Array.isArray(ops)||!(t-ops[0]<VOICE.burstMs)||t<ops[0])voice.ops[seat]=[t,1];
  else if(!(ops[1]<VOICE.burst))return fail(429,'Vas muy rápido. Espera un momento.');
  else ops[1]++;
  const ended=over(state,t);
  if(ended)voiceSweep(state,t);
  const leave=()=>{if(voice.opt[seat]){voice.opt[seat]=false;voice.bye[seat]=t;restart(voice)}return DONE};
  switch(data.op){
    case 'opt':{
      if(typeof data.on!=='boolean')return fail(400,'Falta indicar si activas o desactivas la voz');
      if(!data.on)return leave();
      if(ended)return fail(409,'La llamada de este duelo ya ha terminado');
      // Activarla otra vez (por ejemplo, tras recargar la página) empieza un intento nuevo de conexión.
      voice.opt[seat]=true;voice.bye[seat]=0;restart(voice);return DONE;
    }
    case 'bye':return leave();
    case 'signal':{
      if(data.kind!=='offer'&&data.kind!=='answer')return fail(400,'Señal de voz no válida');
      if(typeof data.sdp!=='string'||!data.sdp)return fail(400,'Señal de voz no válida');
      if(data.sdp.length>VOICE.maxSdp)return fail(413,'La señal de voz es demasiado grande');
      if(!SDP.test(data.sdp))return fail(400,'Señal de voz no válida');
      if(!Number.isInteger(data.gen))return fail(400,'Señal de voz no válida');
      if(ended)return fail(409,'La llamada de este duelo ya ha terminado');
      if(!voice.opt[0]||!voice.opt[1])return fail(409,'Los dos jugadores tienen que activar la voz');
      if(data.gen!==voice.gen)return fail(409,'Esa señal es de un intento anterior');
      // Para que nunca ofrezcan los dos a la vez: ofrece el asiento 0 y responde el 1.
      if((data.kind==='offer')!==(seat===0))return fail(400,seat===0?'A ti te toca ofrecer la conexión':'A ti te toca responder a la conexión');
      if(data.kind==='offer'){
        if(voice.step===0){voice.sig=[{kind:'offer',sdp:data.sdp,gen:voice.gen},null];voice.step=1}
        return DONE; // repetida: ya está apuntada
      }
      if(voice.step===0)return fail(409,'Todavía no hay una oferta a la que responder');
      if(voice.step===1){voice.sig=[null,{kind:'answer',sdp:data.sdp,gen:voice.gen}];voice.step=2}
      return DONE;
    }
    case 'ack':{
      if(!Number.isInteger(data.gen))return fail(400,'Señal de voz no válida');
      if(seat===0&&data.gen===voice.gen&&voice.step===2){voice.sig=[null,null];voice.step=3}
      return DONE;
    }
    default:return fail(400,'Operación de voz no válida');
  }
}

// Lo que ve de la voz el asiento `seat`. `phase` es la fase del duelo ('intro', 'question', 'reveal', 'finished'…).
// `info` (opcional) es el reloj del servidor en ms, o {now, until}: `until` cambia el final de la ventana de `reveal`
// si el juego no usa los 10 s de siempre. No modifica el estado.
//   null                 no hay duelo
//   {available:false}    este duelo no tiene voz (de tres, contra el bot o aún esperando rival)
//   {available:true, opt:{me,rival}, signal:{kind,sdp,gen}|null, gen, role:'offer'|'answer',
//    open, until, left, ended}
//     signal  la última señal del rival para mí en el intento en curso (solo si ambos tienen la voz activada)
//     open    los micrófonos pueden estar abiertos ahora: ambos la han activado y la fase es reveal o finished
//     until   cuándo se cierra esa ventana (ms de servidor) o null
//     left    el rival ha salido de la llamada y no ha vuelto
//     ended   la ventana de la pantalla final ya pasó: se acabó la llamada de este duelo
export function voiceView(state,seat,phase,info){
  if(!state||typeof state!=='object')return null;
  if((seat!==0&&seat!==1)||!eligible(state))return {available:false};
  const source=state.voice&&typeof state.voice==='object'?state.voice:blank(),rival=1-seat;
  const opt=Array.isArray(source.opt)?source.opt:[false,false],bye=Array.isArray(source.bye)?source.bye:[0,0],gen=Number.isInteger(source.gen)&&source.gen>=0?source.gen:0;
  const stage=typeof phase==='string'?phase:phaseOf(state),now=typeof info==='number'?info:info?.now;
  const talk=stage==='reveal'||stage==='finished',until=talk?windowEnd(state,stage,typeof info==='object'?info:null):null;
  const past=until!=null&&Number.isFinite(now)&&now>=until,both=!!opt[0]&&!!opt[1],sent=Array.isArray(source.sig)?source.sig[rival]:null;
  return {available:true,opt:{me:!!opt[seat],rival:!!opt[rival]},
    signal:both&&sent&&sent.gen===gen?{kind:sent.kind,sdp:sent.sdp,gen:sent.gen}:null,
    gen,role:seat===0?'offer':'answer',open:both&&talk&&!past,until,left:!opt[rival]&&!!bye[rival],ended:stage==='finished'&&past};
}

// Prueba la voz de los duelos (lib/voz.mjs): funciones puras sobre el estado de un duelo, sin red ni reloj real.
import assert from 'node:assert/strict';
import {VOICE,voiceAction,voiceView,voiceSweep} from '../lib/voz.mjs';

const T=Date.parse('2026-11-26T10:00:00Z');
const sdp=(tag='a')=>`v=0\r\no=- 46117 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\na=mid:${tag}\r\n`;
// Un duelo de dos personas en plena pregunta, con la forma que le da lib/duelos.mjs.
function duel(extra={}){
  return {id:'d1',code:'ABC234',status:'playing',players:[{hash:'a',name:'Ana',hp:6000},{hash:'b',name:'Luis',hp:6000}],
    questions:['q1'],rounds:[{startsAt:T,deadline:T+60000,guesses:[null,null],ats:[null,null]}],winner:null,reason:null,next:null,...extra};
}
const ok=(state,seat,data,now=T)=>{const result=voiceAction(state,seat,data,now);assert.equal(result.status,200,JSON.stringify(result.body));return result};
const no=(state,seat,data,status,now=T)=>{const result=voiceAction(state,seat,data,now);assert.equal(result.status,status,`esperaba ${status}: ${JSON.stringify(data).slice(0,90)}`);assert.equal(typeof result.body.error,'string');return result};
const both=state=>{ok(state,0,{op:'opt',on:true});ok(state,1,{op:'opt',on:true});return state.voice.gen};

// Sin que nadie haga nada: la voz existe pero está apagada, y la vista no toca el estado.
{
  const state=duel(),before=JSON.stringify(state);
  assert.deepEqual(voiceView(state,0,'question',T),{available:true,opt:{me:false,rival:false},signal:null,gen:0,role:'offer',open:false,until:null,left:false,ended:false});
  assert.equal(voiceView(state,1,'question',T).role,'answer');
  assert.equal(JSON.stringify(state),before,'voiceView no modifica el estado');
  assert.equal(voiceView(null,0,'question'),null);
  assert.deepEqual(voiceView(state,2,'question'),{available:false},'un asiento que no existe no ve nada');
}

// Adhesión de uno y de ambos: cada uno ve la suya y la del rival; con uno solo no hay ventana ni señales.
{
  const state=duel();
  ok(state,0,{op:'opt',on:true});
  assert.deepEqual(voiceView(state,0,'reveal',T).opt,{me:true,rival:false});
  assert.deepEqual(voiceView(state,1,'reveal',T).opt,{me:false,rival:true});
  assert.equal(voiceView(state,0,'reveal',T).open,false,'con uno solo no se abre');
  no(state,0,{op:'signal',kind:'offer',sdp:sdp(),gen:state.voice.gen},409);
  ok(state,1,{op:'opt',on:true});
  assert.deepEqual(voiceView(state,1,'question',T).opt,{me:true,rival:true});
  // Desactivarla vuelve a dejarlo como estaba.
  ok(state,1,{op:'opt',on:false});
  assert.deepEqual(voiceView(state,0,'reveal',T).opt,{me:true,rival:false});
  assert.equal(voiceView(state,0,'reveal',T).open,false);
}

// Ventana de habla: solo en reveal y finished, solo con ambos adheridos, y hasta una hora que marca el servidor.
{
  const state=duel();both(state);
  for(const phase of ['intro','question','waiting'])for(const seat of [0,1]){
    const view=voiceView(state,seat,phase,T+1000);
    assert.equal(view.open,false,`cerrada en ${phase}`);assert.equal(view.until,null);
  }
  state.rounds[0].resolvedAt=T+20000;
  for(const seat of [0,1]){
    const view=voiceView(state,seat,'reveal',T+21000);
    assert.equal(view.open,true);assert.equal(view.until,T+20000+VOICE.revealMs,'los dos ven el mismo final');
  }
  assert.equal(voiceView(state,0,'reveal').open,true,'sin reloj se fía de la fase');
  assert.equal(voiceView(state,0).open,true,'sin fase la deduce del estado');
  assert.equal(voiceView(state,0,'reveal',T+20000+VOICE.revealMs).open,false,'pasada la hora se cierra aunque la fase no haya cambiado');
  assert.equal(voiceView(state,0,'reveal',{now:T+21000,until:T+26000}).until,T+26000,'quien llama puede fijar otra duración de reveal');
  assert.equal(voiceView(state,0,'reveal',{now:T+26000,until:T+26000}).open,false);
  // Siguiente pregunta: se cierra sola.
  state.rounds.push({startsAt:T+30000,deadline:T+90000,guesses:[null,null],ats:[null,null]});
  assert.equal(voiceView(state,0,'question',T+31000).open,false);assert.equal(voiceView(state,0,undefined,T+31000).open,false);
  // Pantalla final: hasta 60 s después de la última ronda.
  state.rounds[1].resolvedAt=T+50000;state.status='finished';state.winner=0;state.reason='ko';
  const end=voiceView(state,1,'finished',T+51000);
  assert.equal(end.open,true);assert.equal(end.until,T+50000+VOICE.finalMs);assert.equal(end.ended,false);
  const late=voiceView(state,1,'finished',T+50000+VOICE.finalMs);
  assert.equal(late.open,false);assert.equal(late.ended,true);
  no(state,0,{op:'opt',on:true},409,T+50000+VOICE.finalMs+1);
  ok(state,0,{op:'bye'},T+50000+VOICE.finalMs+1);
  // Si solo uno la tiene activada, tampoco se abre en la pantalla final.
  assert.equal(voiceView(state,1,'finished',T+51000).open,false);
  // Abandono: la ventana final cuenta desde que el rival se fue.
  const quit=duel({status:'finished',winner:0,reason:'abandono',seenAt:T+7000});both(quit);
  assert.equal(voiceView(quit,0,'finished',T+8000).until,T+7000+VOICE.finalMs);
}

// Señalización: ofrece el asiento 0, responde el 1, y cada señal solo la ve su destinatario.
{
  const state=duel(),gen=both(state);
  assert.equal(voiceView(state,0,'question',T).gen,gen);assert.equal(voiceView(state,1,'question',T).gen,gen);
  no(state,1,{op:'signal',kind:'offer',sdp:sdp(),gen},400);     // el 1 no ofrece
  no(state,0,{op:'signal',kind:'answer',sdp:sdp(),gen},400);    // el 0 no responde
  no(state,1,{op:'signal',kind:'answer',sdp:sdp(),gen},409);    // aún no hay oferta
  ok(state,0,{op:'signal',kind:'offer',sdp:sdp('oferta'),gen});
  assert.equal(voiceView(state,0,'question',T).signal,null,'quien ofrece no recibe su propia oferta');
  assert.deepEqual(voiceView(state,1,'question',T).signal,{kind:'offer',sdp:sdp('oferta'),gen});
  ok(state,0,{op:'signal',kind:'offer',sdp:sdp('otra'),gen});   // repetida: no cambia nada
  assert.equal(voiceView(state,1,'question',T).signal.sdp,sdp('oferta'));
  ok(state,1,{op:'signal',kind:'answer',sdp:sdp('respuesta'),gen});
  assert.equal(voiceView(state,1,'question',T).signal,null,'la oferta se borra al responder');
  assert.deepEqual(voiceView(state,0,'question',T).signal,{kind:'answer',sdp:sdp('respuesta'),gen});
  assert.deepEqual(state.voice.sig[0],null,'solo se guarda una señal a la vez');
  ok(state,1,{op:'signal',kind:'answer',sdp:sdp('otra'),gen});  // repetida
  assert.equal(voiceView(state,0,'question',T).signal.sdp,sdp('respuesta'));
  // El 1 no puede borrar la respuesta; el 0 la recoge y desaparece del estado.
  ok(state,1,{op:'ack',gen});assert.notEqual(voiceView(state,0,'question',T).signal,null);
  ok(state,0,{op:'ack',gen:gen-1});assert.notEqual(voiceView(state,0,'question',T).signal,null);
  ok(state,0,{op:'ack',gen});
  assert.equal(voiceView(state,0,'question',T).signal,null);assert.deepEqual(state.voice.sig,[null,null]);
  assert(JSON.stringify(state.voice).length<200,'tras conectar no queda nada grande en el estado');
}

// Intentos (gen): una señal de un intento anterior se descarta y la vista no enseña señales viejas.
{
  const state=duel(),gen=both(state);
  ok(state,0,{op:'signal',kind:'offer',sdp:sdp(),gen});
  // El asiento 1 recarga la página y vuelve a activar la voz: intento nuevo.
  ok(state,1,{op:'opt',on:true});
  const next=state.voice.gen;assert(next>gen,'reactivar la voz empieza un intento nuevo');
  assert.equal(voiceView(state,1,'question',T).signal,null,'la oferta vieja ya no se entrega');
  no(state,1,{op:'signal',kind:'answer',sdp:sdp(),gen},409);    // respuesta a la oferta vieja
  no(state,0,{op:'signal',kind:'offer',sdp:sdp(),gen},409);
  no(state,0,{op:'signal',kind:'offer',sdp:sdp(),gen:next+1},409);
  ok(state,0,{op:'signal',kind:'offer',sdp:sdp('nueva'),gen:next});
  assert.equal(voiceView(state,1,'question',T).signal.sdp,sdp('nueva'));
  // Aunque quedara una señal vieja guardada, la vista la ignora.
  state.voice.sig[0].gen=next-1;
  assert.equal(voiceView(state,1,'question',T).signal,null);
}

// Tamaños y tipos inválidos.
{
  const state=duel(),gen=both(state),big='v=0\r\n'+'a=x\r\n'.repeat(VOICE.maxSdp/5);
  no(state,0,null,400);no(state,0,'opt',400);no(state,0,{},400);no(state,0,{op:7},400);no(state,0,{op:'grabar'},400);
  no(state,0,{op:'opt'},400);no(state,0,{op:'opt',on:'true'},400);no(state,0,{op:'opt',on:1},400);
  no(state,0,{op:'signal',kind:'candidate',sdp:sdp(),gen},400);
  no(state,0,{op:'signal',kind:'offer',gen},400);
  no(state,0,{op:'signal',kind:'offer',sdp:'',gen},400);
  no(state,0,{op:'signal',kind:'offer',sdp:{type:'offer'},gen},400);
  no(state,0,{op:'signal',kind:'offer',sdp:['v=0'],gen},400);
  no(state,0,{op:'signal',kind:'offer',sdp:'<script>alert(1)</script>',gen},400);
  no(state,0,{op:'signal',kind:'offer',sdp:'v=0\r\ns=\u0000‮\r\n',gen},400);
  no(state,0,{op:'signal',kind:'offer',sdp:sdp(),gen:String(gen)},400);
  no(state,0,{op:'signal',kind:'offer',sdp:sdp()},400);
  no(state,0,{op:'ack'},400);
  assert(big.length>VOICE.maxSdp);no(state,0,{op:'signal',kind:'offer',sdp:big,gen},413);
  const fits='v=0\r\n'+'a'.repeat(VOICE.maxSdp-5);assert.equal(fits.length,VOICE.maxSdp);
  assert.deepEqual(state.voice.sig,[null,null],'nada de lo rechazado se guarda');
  ok(state,0,{op:'signal',kind:'offer',sdp:fits,gen});
  no(state,-1,{op:'opt',on:true},403);no(state,2,{op:'opt',on:true},403);no(state,'0',{op:'opt',on:true},403);
  assert.equal(voiceAction(null,0,{op:'opt',on:true},T).status,404);
}

// Salir de la llamada: el rival lo ve, las señales se borran y se puede volver a entrar.
{
  const state=duel(),gen=both(state);
  ok(state,0,{op:'signal',kind:'offer',sdp:sdp(),gen});
  ok(state,1,{op:'bye'},T+500);
  assert.deepEqual(voiceView(state,0,'reveal',T).opt,{me:true,rival:false});
  assert.equal(voiceView(state,0,'reveal',T).left,true,'«Tu rival ha salido de la llamada»');
  assert.equal(voiceView(state,1,'reveal',T).left,false);
  assert.equal(voiceView(state,0,'reveal',T).open,false);
  assert.deepEqual(state.voice.sig,[null,null]);assert(state.voice.gen>gen);
  assert.equal(voiceView(state,1,'reveal',T).signal,null);
  ok(state,1,{op:'bye'},T+600);                                 // salir dos veces no rompe nada
  const after=state.voice.gen;
  ok(state,1,{op:'opt',on:true},T+700);
  assert.equal(voiceView(state,0,'reveal',T).left,false,'ha vuelto');
  assert.deepEqual(voiceView(state,0,'reveal',T).opt,{me:true,rival:true});
  assert(state.voice.gen>after);
  // Quien nunca la activó no «sale»: no hay aviso.
  const fresh=duel();ok(fresh,0,{op:'opt',on:true});ok(fresh,1,{op:'bye'});
  assert.equal(voiceView(fresh,0,'reveal',T).left,false);
}

// Duelo de tres, contra el bot o todavía esperando rival: sin voz.
{
  const three=duel({size:3,players:[{hash:'a'},{hash:'b'},{hash:'c'}]});
  const three2=duel({size:3});                                  // de tres aunque solo queden dos
  const bot=duel({players:[{hash:'a',name:'Ana'},{hash:'bot',name:'Faraday-bot',bot:true}]});
  const waiting=duel({status:'waiting',players:[{hash:'a'}],rounds:[]});
  const cancelled=duel({status:'finished',reason:'cancelado',players:[{hash:'a'}],rounds:[]});
  for(const state of [three,three2,bot,waiting,cancelled]){
    for(const seat of [0,1])assert.deepEqual(voiceView(state,seat,'reveal',T),{available:false});
    no(state,0,{op:'opt',on:true},409);no(state,0,{op:'signal',kind:'offer',sdp:sdp(),gen:0},409);no(state,0,{op:'bye'},409);
    assert.equal(state.voice,undefined,'ni siquiera se crea state.voice');
  }
  // Aunque el estado traiga una adhesión colada, la vista no la enseña.
  bot.voice={opt:[true,true],gen:1,step:1,sig:[{kind:'offer',sdp:sdp(),gen:1},null],bye:[0,0],ops:[[0,0],[0,0]]};
  assert.deepEqual(voiceView(bot,1,'reveal',T),{available:false});
}

// Freno: como mucho VOICE.burst operaciones por jugador cada VOICE.burstMs; el otro jugador no se ve afectado.
{
  const state=duel();
  for(let i=0;i<VOICE.burst;i++)ok(state,0,{op:'opt',on:i%2===0},T+i);
  no(state,0,{op:'opt',on:true},429,T+VOICE.burst);
  ok(state,1,{op:'opt',on:true},T+VOICE.burst);
  ok(state,0,{op:'opt',on:true},T+VOICE.burstMs);
}

// El freno cuenta también las operaciones rechazadas, y con el cupo agotado no toca el estado (no hay nada que guardar).
{
  const state=duel();both(state);
  for(let i=1;i<VOICE.burst;i++)no(state,1,{op:'signal',kind:'answer',sdp:sdp(),gen:999},409,T+i);
  const before=JSON.stringify(state);
  for(let i=0;i<5;i++)no(state,1,{op:'signal',kind:'answer',sdp:sdp(),gen:999},429,T+VOICE.burst+i);
  assert.equal(JSON.stringify(state),before,'un 429 no cambia el duelo');
  no(state,1,{op:'signal',kind:'answer',sdp:sdp(),gen:999},409,T+VOICE.burstMs);
}

// Tras el final: pasada la ventana de la pantalla final no se aceptan señales y la que quedara guardada se borra.
{
  const state=duel();const gen=both(state);
  ok(state,0,{op:'signal',kind:'offer',sdp:sdp('pendiente'),gen});
  assert.equal(voiceSweep(state,T+1000),false,'en plena partida no se toca nada');
  assert.equal(state.voice.sig[0].sdp,sdp('pendiente'));
  // Termina el duelo con la conexión a medias: se borra la señal y se pide un intento nuevo, una sola vez.
  state.rounds[0].resolvedAt=T+20000;Object.assign(state,{status:'finished',winner:0,reason:'ko'});
  assert.equal(voiceSweep(state,T+20000),true);
  assert.deepEqual([state.voice.sig,state.voice.step,state.voice.gen,state.voice.fin],[[null,null],0,gen+1,true]);
  assert.equal(voiceSweep(state,T+20001),false,'la limpieza del final se hace una vez');
  assert.deepEqual(voiceView(state,1,'finished',T+21000).opt,{me:true,rival:true},'los dos siguen en la llamada');
  // En la pantalla final se puede volver a conectar: esa señal se respeta mientras dure la ventana…
  ok(state,0,{op:'signal',kind:'offer',sdp:sdp('final'),gen:gen+1},T+22000);
  assert.equal(voiceSweep(state,T+20000+VOICE.finalMs-1),false);
  assert.equal(voiceView(state,1,'finished',T+23000).signal.sdp,sdp('final'));
  // …y al acabar la ventana se borra y ya no se acepta ninguna más.
  const late=T+20000+VOICE.finalMs;
  assert.equal(voiceSweep(state,late),true);
  assert.deepEqual([state.voice.sig,state.voice.step],[[null,null],0]);
  assert.equal(voiceSweep(state,late+1),false);
  ok(state,0,{op:'signal',kind:'offer',sdp:sdp('viva'),gen:gen+1},T+30000);
  assert.equal(no(state,1,{op:'signal',kind:'answer',sdp:sdp('tarde'),gen:gen+1},409,late+3600000).body.error,'La llamada de este duelo ya ha terminado');
  assert.deepEqual(state.voice.sig,[null,null],'la operación rechazada también recoge la señal caducada');
  no(state,0,{op:'signal',kind:'offer',sdp:sdp('tarde'),gen:gen+1},409,late+3600000);
  ok(state,0,{op:'ack',gen:gen+1},late+3600000);ok(state,1,{op:'bye'},late+3600000);
  // Un duelo terminado sin nada pendiente solo apunta que ya pasó por la limpieza.
  const clean=duel({status:'finished',winner:1,reason:'ko'});clean.rounds[0].resolvedAt=T+5000;both(clean);
  assert.equal(voiceSweep(clean,T+6000),true);assert.equal(clean.voice.gen,2,'sin conexión a medias no se pide otro intento');
  assert.equal(voiceSweep(clean,T+6001),false);
  // Cancelado (ya no admite voz) o sin estado de voz.
  const gone=duel();const g=both(gone);ok(gone,0,{op:'signal',kind:'offer',sdp:sdp(),gen:g});
  Object.assign(gone,{status:'finished',winner:null,reason:'cancelado'});
  assert.equal(voiceSweep(gone,T),true);assert.deepEqual(gone.voice.sig,[null,null]);
  assert.equal(voiceSweep(duel(),T),false);assert.equal(voiceSweep(null,T),false);assert.equal(voiceSweep({voice:7},T),false);
}

// Estado a medias (de una versión anterior o corrupto): se recompone sin romper el duelo.
{
  const state=duel({voice:{opt:'si',gen:-3,sig:null}});
  assert.equal(voiceView(state,0,'reveal',T).available,true);assert.equal(voiceView(state,0,'reveal',T).gen,0);
  ok(state,0,{op:'opt',on:true});
  assert.deepEqual(state.voice.opt,[true,false]);assert.equal(state.voice.gen,1);
  // El estado sigue siendo JSON puro.
  assert.deepEqual(JSON.parse(JSON.stringify(state.voice)),state.voice);
}

// De punta a punta por la API (acción `voz` de /api/duelo, enganchada en lib/duelos.mjs): quién puede usarla,
// que la señal cabe en la petición y que la ventana sigue a las fases del duelo de verdad.
{
  const fs=await import('node:fs'),os=await import('node:os'),path=await import('node:path'),{randomUUID}=await import('node:crypto');
  const {createApi}=await import('../lib/api.mjs'),{fileStore}=await import('../lib/stores.mjs'),{RULES}=await import('../lib/duelos.mjs');
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'casi-voz-'));
  let clock=T;
  try{
    const api=createApi({store:fileStore(path.join(directory,'answers.json')),persistDays:false,now:()=>clock,duelLimit:null,log:()=>{}});
    const duel=async(action,player,extra={})=>{
      const response=await api.handle(new Request('http://casi.test/api/duelo',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,player,...extra})}));
      return {status:response.status,data:await response.json()};
    };
    const ana=randomUUID(),luis=randomUUID(),otra=randomUUID();
    const made=await duel('crear',ana,{name:'Ana'});assert.equal(made.status,200);
    const id=made.data.id;
    assert.equal(made.data.voice?.available,false,'esperando rival aún no hay voz');
    assert.equal((await duel('voz',ana,{id,op:'opt',on:true})).status,409);
    assert.equal((await duel('unirse',luis,{code:made.data.code,name:'Luis'})).status,200);
    // Solo los dos jugadores del duelo.
    assert.equal((await duel('voz',otra,{id,op:'opt',on:true})).status,403);
    let a=await duel('voz',ana,{id,op:'opt',on:true});
    assert.equal(a.status,200);assert.equal(a.data.id,id,'responde con la vista del duelo');
    assert.deepEqual(a.data.voice.opt,{me:true,rival:false});
    let l=await duel('estado',luis,{id});
    assert.deepEqual(l.data.voice.opt,{me:false,rival:true});assert.equal(l.data.voice.role,'answer');
    l=await duel('voz',luis,{id,op:'opt',on:true});
    const gen=l.data.voice.gen;
    // Una oferta casi del tamaño máximo cabe en la petición; una mayor la rechaza la voz, no el límite del cuerpo.
    const large='v=0\r\n'+'a=candidate:1 1 udp 2122260223 192.0.2.1 54321 typ host\r\n'.repeat(200);
    assert(large.length>11000&&large.length<=VOICE.maxSdp);
    assert.equal((await duel('voz',ana,{id,op:'signal',kind:'offer',sdp:large+'a=x\r\n'.repeat(200),gen})).status,413);
    a=await duel('voz',ana,{id,op:'signal',kind:'offer',sdp:large,gen});
    assert.equal(a.status,200);assert.equal(a.data.voice.signal,null);
    l=await duel('estado',luis,{id});
    assert.deepEqual(l.data.voice.signal,{kind:'offer',sdp:large,gen});
    assert.equal((await duel('voz',luis,{id,op:'signal',kind:'answer',sdp:sdp('r'),gen})).status,200);
    a=await duel('estado',ana,{id});assert.equal(a.data.voice.signal.kind,'answer');
    a=await duel('voz',ana,{id,op:'ack',gen});assert.equal(a.data.voice.signal,null);
    // Presentación y pregunta: cerrada. Resultado de la ronda: abierta para los dos hasta la misma hora. Siguiente pregunta: cerrada.
    assert.equal(a.data.phase,'intro');assert.equal(a.data.voice.open,false);
    clock+=RULES.introMs+500;
    a=await duel('estado',ana,{id});assert.equal(a.data.phase,'question');assert.equal(a.data.voice.open,false);assert.equal(a.data.voice.until,null);
    await duel('responder',ana,{id,guess:100});clock+=1000;
    l=await duel('responder',luis,{id,guess:200});
    a=await duel('estado',ana,{id});
    assert.equal(a.data.phase,'reveal');assert.equal(l.data.phase,'reveal');
    assert.equal(a.data.voice.open,true);assert.equal(l.data.voice.open,true);
    assert.equal(a.data.voice.until,a.data.round.nextAt);assert.equal(l.data.voice.until,a.data.voice.until);
    clock=a.data.round.nextAt+200;
    a=await duel('estado',ana,{id});assert.equal(a.data.phase,'question');assert.equal(a.data.voice.open,false);
    // Abandono: pantalla final, con la ventana abierta 60 s para quien se queda… hasta que el otro cuelga.
    l=await duel('salir',luis,{id});assert.equal(l.data.phase,'finished');
    a=await duel('estado',ana,{id});assert.equal(a.data.voice.open,true);assert.equal(a.data.voice.until,clock+VOICE.finalMs);
    l=await duel('voz',luis,{id,op:'bye'});assert.equal(l.status,200);
    a=await duel('estado',ana,{id});assert.equal(a.data.voice.open,false);assert.equal(a.data.voice.left,true);
    clock+=VOICE.finalMs+1;
    a=await duel('estado',ana,{id});assert.equal(a.data.voice.ended,true);
    // Contra el bot y en el duelo de tres no hay voz.
    const solo=await duel('crear',ana,{name:'Ana'}),bot=await duel('bot',ana,{id:solo.data.id});
    assert.deepEqual(bot.data.voice,{available:false});
    assert.equal((await duel('voz',ana,{id:solo.data.id,op:'opt',on:true})).status,409);
    await duel('salir',ana,{id:solo.data.id});
    const three=await duel('crear',ana,{name:'Ana',size:3});
    assert.equal((await duel('unirse',luis,{code:three.data.code,name:'Luis'})).status,200);
    assert.deepEqual((await duel('estado',ana,{id:three.data.id})).data.voice,{available:false});
    assert.equal((await duel('voz',ana,{id:three.data.id,op:'opt',on:true})).status,409);
  }finally{fs.rmSync(directory,{recursive:true,force:true})}
}

console.log('voz: todo correcto');

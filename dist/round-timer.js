// Reloj de ronda compartido (Contrato 6): la cuenta atrás del reto diario y el archivo (90 s por pregunta), de Traza la
// tendencia (45 s por gráfica) y de Archivo Vivo (45 s por foto). Es de la familia del reloj de los duelos (píldora con
// la cifra) y del de Ascensión (barra fina que se vacía).
//
// El plazo es una FECHA DE FIN, no una resta de ticks: cambiar de pestaña, abrir el menú o volver a la portada no lo
// paran. La fecha se guarda por `key` en este navegador (localStorage, o en memoria si no se puede escribir), así que
// recargar la página no reinicia el tiempo; si al volver ya ha vencido, onExpire salta al momento.
//
// Nunca queda más que el total de la ronda: si la fecha guardada cae más lejos (reloj del sistema atrasado, dato
// retocado), se recorta a «ahora + total». Borrar la clave sí devuelve el tiempo entero: el reloj es de este navegador.
//
//   RoundTimer.start({key, seconds, mount?, onExpire?, deadline?, pauseWhen?, quietWhen?, maxPause?, label?, sound?}) -> reloj
//     key        identificador de la ronda («reto:2026-11-26:0»). Con la misma clave se retoma la fecha ya guardada.
//     seconds    duración de la ronda; solo se usa la primera vez que se ve esa clave.
//     mount      elemento, o lista de elementos, donde se pinta el reloj (sin él funciona igual, pero no se ve).
//     onExpire   se llama UNA vez al agotarse, siempre de forma asíncrona (también si ya había vencido al arrancar).
//     deadline   fecha de fin (ms) impuesta desde fuera, por ejemplo por el servidor: sustituye a la guardada.
//     pauseWhen  función que se consulta en cada tick: mientras devuelva true el reloj está en pausa.
//     quietWhen  función que se consulta en cada aviso: mientras devuelva true no hay tics ni anuncios hablados (la
//                pantalla del reloj está tapada por otra). El reloj sigue contando y onExpire salta igual.
//     maxPause   segundos de pausa que se conceden EN TOTAL a esa clave (60 por defecto; Infinity para no limitar).
//                Agotados, el reloj sigue aunque pauseWhen diga que no. Una pausa que se queda abierta al recargar
//                o cerrar la pestaña cuenta, como mucho, por lo que quedara de ese margen.
//     label      nombre accesible del reloj («Tiempo restante»).  sound: false quita los avisos sonoros.
//   reloj = {key, stop(), done(), pause(), resume(), remaining(), paused(), expired()}
//     stop()     deja de contar y quita el reloj de la pantalla. La fecha guardada SIGUE corriendo (la ronda sigue abierta).
//     done()     stop() y además olvida la fecha: la ronda ya está respondida.
//     pause() / resume()   pausa manual, con el mismo margen de maxPause.
//     remaining()          milisegundos que quedan (0 si ha vencido).
//   RoundTimer.peek(key, maxPause?) -> {remaining, total, paused, expired} o null, sin arrancar nada.
//   RoundTimer.clear(key) -> olvida la fecha guardada de esa clave.
//   RoundTimer.SECONDS    -> {reto:90, traza:45, archivo:45}: los tiempos del Contrato 5.
//
// Avisos: visual en los últimos 10 s, un tic por segundo en los últimos 5 (sound.js, con su mismo interruptor) y una
// región aria-live educada que solo habla a los 30, 10 y 5 s y al agotarse.
(()=>{
  const STORE='faraday:relojes',KEEP=60*86400000,TICK=200,MARKS=[30,10,5];
  const SECONDS={reto:90,traza:45,archivo:45};
  const ICON='<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2M9.5 2.5h5"/></svg>';
  const valid=entry=>!!entry&&Number.isFinite(entry.end)&&Number.isFinite(entry.total)&&entry.total>0;
  // Si el navegador no deja leer o escribir (modo privado, cuota llena), los plazos viven en memoria hasta cerrar la pestaña.
  let memory={},offline=false;
  function readAll(){
    if(!offline)try{const data=JSON.parse(localStorage.getItem(STORE)||'{}');return data&&typeof data==='object'&&!Array.isArray(data)?data:{}}catch{offline=true}
    return memory;
  }
  function writeAll(all){
    // Los plazos vencidos hace mucho se tiran: la clave es por ronda y esa ronda ya no se va a reabrir.
    const limit=Date.now()-KEEP;
    for(const [key,entry] of Object.entries(all))if(!valid(entry)||(entry.since??entry.end)<limit)delete all[key];
    memory=all;
    if(!offline)try{localStorage.setItem(STORE,JSON.stringify(all))}catch{offline=true}
  }
  const read=key=>{const entry=readAll()[key];return valid(entry)?entry:null};
  function save(key,entry){const all=readAll();if(entry)all[key]=entry;else delete all[key];writeAll(all)}
  // Pausa abierta: `since` (cuándo empezó) y `left` (lo que quedaba). `held` son los milisegundos de pausa ya gastados.
  const budget=(entry,cap)=>Math.max(0,cap-(entry.held||0));
  function settle(entry,cap,at){
    if(entry.since==null)return entry;
    const spent=Math.max(0,Math.min(at-entry.since,budget(entry,cap)));
    entry.held=(entry.held||0)+spent;entry.end=entry.since+spent+entry.left;delete entry.since;delete entry.left;
    return entry;
  }
  const leftOf=(entry,cap,at)=>Math.min(entry.total,entry.since==null?entry.end-at:at-entry.since>=budget(entry,cap)?entry.since+budget(entry,cap)+entry.left-at:entry.left);
  // Recorta al total de la ronda lo que quede por delante. Devuelve true si ha tenido que tocar algo.
  function trim(entry,at){
    if(entry.since!=null){if(entry.left>entry.total){entry.left=entry.total;return true}return false}
    if(entry.end-at>entry.total){entry.end=at+entry.total;return true}
    return false;
  }
  const capOf=maxPause=>(maxPause===undefined?60:Math.max(0,Number(maxPause)||0))*1000;

  function build(target,label,first){
    const make=(tag,name)=>{const node=document.createElement(tag);node.className=name;return node};
    const root=make('div','round-timer'),pill=make('span','round-timer-pill'),icon=make('span','round-timer-icon'),time=make('b','round-timer-time'),
      note=make('small','round-timer-note'),bar=make('span','round-timer-bar'),fill=make('i','round-timer-fill');
    root.setAttribute('role','timer');root.setAttribute('aria-label',label);
    icon.setAttribute('aria-hidden','true');icon.innerHTML=ICON;note.textContent='en pausa';note.hidden=true;
    bar.setAttribute('aria-hidden','true');bar.append(fill);pill.append(icon,time,note);root.append(pill,bar);
    // Una sola región hablada aunque el reloj se pinte en dos sitios.
    let live=null;
    if(first){live=make('span','round-timer-live');live.setAttribute('role','status');live.setAttribute('aria-live','polite');root.append(live)}
    target.replaceChildren(root);
    return {target,root,time,note,live};
  }

  function start(options={}){
    const {key,seconds,mount,onExpire,deadline,pauseWhen,quietWhen,label='Tiempo restante',sound=true}=options,cap=capOf(options.maxPause);
    if(typeof key!=='string'||!key)throw new TypeError('RoundTimer.start necesita una clave');
    let entry=read(key);
    if(Number.isFinite(deadline))entry={end:deadline,total:entry?.total||seconds*1000,held:entry?.held||0};
    else if(entry)settle(entry,cap,Date.now()); // Una pausa que quedó abierta al recargar: cuenta hasta su margen.
    else entry={end:Date.now()+seconds*1000,total:seconds*1000};
    if(!valid(entry))throw new TypeError('RoundTimer.start necesita los segundos de la ronda');
    trim(entry,Date.now());save(key,entry);

    const views=typeof document==='undefined'?[]:[].concat(mount||[]).filter(Boolean).map((target,index)=>build(target,label,index===0));
    let stopped=false,fired=false,auto=false,shown=null,ticker=null;
    const said=new Set(MARKS.filter(mark=>mark>=Math.ceil(leftOf(entry,cap,Date.now())/1000)));
    const paused=()=>entry.since!=null;
    const remaining=()=>Math.max(0,leftOf(entry,cap,Date.now()));
    const quiet=()=>{if(!quietWhen)return false;try{return !!quietWhen()}catch{return false}};
    const say=text=>{const live=views[0]?.live;if(live&&!quiet())live.textContent=text};
    function paint(){
      const left=remaining(),secs=Math.ceil(left/1000),idle=paused();
      for(const view of views){
        view.root.style.setProperty('--rt',String(Math.max(0,Math.min(1,left/entry.total))));
        view.root.classList.toggle('is-warning',secs<=10);view.root.classList.toggle('is-last',secs<=5);
        view.root.classList.toggle('is-paused',idle);view.root.classList.toggle('is-over',secs===0);view.note.hidden=!idle;
        if(secs!==shown)view.time.textContent=`${secs} s`;
      }
      if(secs===shown)return;
      const before=shown;shown=secs;
      if(before===null||idle||secs===0)return;
      const mark=MARKS.find(value=>secs<=value&&!said.has(value)&&entry.total>value*1000);
      if(mark){MARKS.filter(value=>value>=secs).forEach(value=>said.add(value));say(`Quedan ${secs} segundos`)}
      if(sound&&secs<=5&&!quiet())try{window.Sound?.tone(880,0,.05,{gain:.022})}catch{}
    }
    function halt(){
      stopped=true;clearInterval(ticker);ticker=null;
      if(typeof document!=='undefined')document.removeEventListener('visibilitychange',tick);
    }
    function expire(){
      if(fired||stopped)return;
      fired=true;halt();paint();say('Se acabó el tiempo');
      try{onExpire?.(clock)}catch(error){console.error('RoundTimer:',error)}
    }
    function pause(manual=true){
      if(stopped||fired||paused()||budget(entry,cap)<=0)return;
      const at=Date.now();if(entry.end-at<=0)return;
      entry.left=entry.end-at;entry.since=at;auto=!manual;save(key,entry);paint();
    }
    function resume(){
      if(stopped||!paused())return;
      settle(entry,cap,Date.now());auto=false;save(key,entry);paint();
    }
    function tick(){
      if(stopped)return;
      if(pauseWhen){
        let wanted=false;try{wanted=!!pauseWhen()}catch{}
        if(wanted&&!paused())pause(false);else if(!wanted&&paused()&&auto)resume();
      }
      if(paused()&&Date.now()-entry.since>=budget(entry,cap))resume(); // Se acabó el margen de pausa.
      if(trim(entry,Date.now()))save(key,entry); // El reloj del sistema ha ido hacia atrás con la ronda abierta.
      paint();
      if(!paused()&&entry.end-Date.now()<=0)expire();
    }
    const clock={key,pause:()=>pause(true),resume,remaining,paused,expired:()=>fired||(!paused()&&entry.end-Date.now()<=0),
      // La fecha guardada sigue corriendo: la ronda sigue abierta aunque ya no se vea el reloj.
      stop(){halt();for(const view of views)if(view.root.parentNode===view.target)view.root.remove()},
      done(){clock.stop();save(key,null)}};

    paint();
    if(leftOf(entry,cap,Date.now())<=0){
      // Ya había vencido (recarga, vuelta desde la portada…): se avisa enseguida, pero cuando quien llama ya tiene el reloj.
      Promise.resolve().then(expire);
    }else{
      ticker=setInterval(tick,TICK);
      if(typeof document!=='undefined')document.addEventListener('visibilitychange',tick);
    }
    return clock;
  }

  function peek(key,maxPause){
    const entry=read(key);if(!entry)return null;
    const left=leftOf(entry,capOf(maxPause),Date.now());
    return {remaining:Math.max(0,left),total:entry.total,paused:entry.since!=null,expired:left<=0};
  }

  window.RoundTimer={start,peek,clear:key=>save(key,null),SECONDS};
})();

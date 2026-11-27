// Los juegos de los duelos en el navegador (en el servidor, lib/duelos-juegos.mjs). Un duelo puede ser de estimación
// (lo pinta duel.js, como siempre) o de Ascensión, Traza la tendencia o Archivo Vivo. Este archivo pinta, para esos
// tres, la pregunta, la caja de respuesta, el resultado de la ronda y el repaso final, y le da a duel.js la lista de
// juegos para el selector del portal. No guarda el duelo ni habla con el servidor: duel.js le pasa la vista que llega
// del servidor y recoge de aquí la respuesta ya lista para enviar. Los tiempos tampoco están aquí: vienen en la vista.
(()=>{
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const link=url=>/^https?:\/\//.test(url||'')?esc(url):'#';
  const number=new Intl.NumberFormat('es-ES',{maximumFractionDigits:4,useGrouping:'always'}),fmt=value=>number.format(value);
  // Para el error medio de un trazo bastan tres cifras.
  const rough=new Intl.NumberFormat('es-ES',{maximumSignificantDigits:3,useGrouping:'always'}),brief=value=>rough.format(value);
  const icon=body=>`<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
  // name = el nombre completo; short = el que cabe en el selector; unit = a qué se refiere el tiempo de cada ronda;
  // pitch = la frase del botón de partida rápida; how = los dos primeros pasos de «¿Cómo se juega?».
  const GAMES=[
    {id:'estimacion',name:'Estimación',short:'Estimación',tone:'coral',unit:'por pregunta',icon:icon('<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="3.5"/><path d="M12 1.5v3M12 19.5v3M1.5 12h3M19.5 12h3"/>'),
      pitch:'Misma pregunta para los dos. Quien más se aleja, pierde vida.',
      how:['Los dos recibís la misma pregunta con una cifra por respuesta.','Quien más se aleja de la cifra real pierde vida.']},
    {id:'ascension',name:'Ascensión',short:'Ascensión',tone:'mostaza',unit:'por categoría',icon:icon('<path d="m2 20 7-12 4 6 3-10 6 16z"/>'),
      pitch:'Misma categoría para los dos. La respuesta más rara quita vida.',
      how:['Los dos recibís la misma categoría y escribís una respuesta que encaje.','Cuanto más rara es la respuesta, más puntos. Si no está en la lista, puedes probar otra mientras quede tiempo.']},
    {id:'traza',name:'Traza la tendencia',short:'Traza',tone:'cian',unit:'por gráfica',icon:icon('<path d="M3 20h18M4 15l4-5 4 3 3-5"/><path d="m15 8 5-4" stroke-dasharray="2 2.6"/>'),
      pitch:'Misma gráfica para los dos. Quien peor la continúa, pierde vida.',
      how:['Los dos veis el principio de la misma gráfica y dibujáis cómo siguió.','Quien más se separa de los datos reales pierde vida.']},
    {id:'archivo',name:'Archivo Vivo',short:'Archivo',tone:'violeta',unit:'por foto',icon:icon('<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="15.5" cy="9.5" r="1.5"/><path d="m3 17 6-6 7 8"/>'),
      pitch:'Misma foto para los dos. Quien más se aleja del año, pierde vida.',
      how:['Los dos veis la misma fotografía histórica y decís de qué año es.','Quien más se aleja del año real pierde vida.']}
  ];
  const get=id=>GAMES.find(game=>game.id===id)||GAMES[0],valid=id=>GAMES.some(game=>game.id===id);
  // Selector de juego del portal: cuatro botones; el elegido lleva aria-pressed.
  const picker=selected=>`<div class="duel-games" role="group" aria-label="Juego del duelo">${GAMES.map(game=>`<button type="button" class="duel-game" data-duel-game="${game.id}" data-tone="${game.tone}" aria-pressed="${game.id===selected}" title="${esc(game.name)}"><span class="duel-game-art" aria-hidden="true">${game.icon}</span><b>${esc(game.short)}</b><span class="sr-only"> · duelo de ${esc(game.name)}</span></button>`).join('')}</div>`;
  // Puntos (0–5000) → gesto del avatar, con los mismos tramos de nombre que la estimación (celebrations.js).
  const cue=(points,answered=true)=>!answered?'ko':points>=4750?'clavada':points>=4000?'acierto':points>=2750?'cerca':points>=1500?'lejos':points>=500?'fallo':points>0?'desastre':'ko';

  // ── Traza la tendencia: la gráfica ────────────────────────────────────────────────────────────────────────
  const BOX={width:360,height:236,left:42,right:350,top:12,bottom:204,split:.36};
  const SEAT_COLORS=['#ffdb70','#ff7aa8','#3fc5f0'];
  const shortDate=new Intl.DateTimeFormat('es',{month:'short',year:'2-digit',timeZone:'UTC'}),longDate=new Intl.DateTimeFormat('es',{month:'long',year:'numeric',timeZone:'UTC'});
  function dateLabel(q,period,short=false){
    if(q.labels){
      const label=q.labels[period-q.start];
      if(q.period==='season'&&short)return String(label).slice(0,3)+'.';
      if(q.period==='biennium'&&!short)return `${label-1}–${label}`;
      return String(label);
    }
    if(q.period!=='month')return String(period);
    return (short?shortDate:longDate).format(new Date(Date.UTC(Math.floor(period/12),period%12,1)));
  }
  function scale(q){
    const cutX=BOX.left+(BOX.right-BOX.left)*BOX.split,hidden=q.end-q.start-q.cut;
    return {hidden,cutX,
      x:index=>index<=q.cut?BOX.left+(cutX-BOX.left)*(q.cut?index/q.cut:1):cutX+(BOX.right-cutX)*(index-q.cut)/hidden,
      y:value=>BOX.bottom-(value-q.min)/(q.max-q.min)*(BOX.bottom-BOX.top)};
  }
  // Trazo de un jugador: sale del último dato conocido y une los puntos que haya (con huecos si faltan).
  function tracePath(q,s,values){
    let path=`M${s.x(q.cut)} ${s.y(q.history.at(-1))}`,pen=true;
    values.forEach((value,index)=>{if(value==null){pen=false;return}path+=`${pen?'L':'M'}${s.x(q.cut+index+1)} ${s.y(value)}`;pen=true});
    return path;
  }
  function plot(q,inner,{drawing=false,label=''}={}){
    const s=scale(q),first=Math.ceil(q.min/q.tick-1e-9),last=Math.floor(q.max/q.tick+1e-9),step=Math.max(1,Math.ceil((last-first+1)/6));
    let ticks='';
    for(let k=first;k<=last;k+=step){const value=Number((k*q.tick).toFixed(q.precision)),at=s.y(value);ticks+=`<line class="dg-grid" x1="${BOX.left}" x2="${BOX.right}" y1="${at}" y2="${at}"/><text class="dg-tick" x="${BOX.left-6}" y="${at+4}" text-anchor="end">${esc(fmt(value))}</text>`}
    const dates=[[q.start,'start'],[q.start+q.cut,'middle'],[q.end,'end']].map(([period,anchor])=>`<text class="dg-tick" x="${s.x(period-q.start)}" y="${BOX.bottom+18}" text-anchor="${anchor}">${esc(dateLabel(q,period,true))}</text>`).join('');
    return `<svg class="dg-plot${drawing?' is-drawing':''}" viewBox="0 0 ${BOX.width} ${BOX.height}" role="img" aria-label="${esc(label)}">
<rect class="dg-zone" x="${s.cutX}" y="${BOX.top}" width="${BOX.right-s.cutX}" height="${BOX.bottom-BOX.top}"/>${ticks}
<line class="dg-cut" x1="${s.cutX}" x2="${s.cutX}" y1="${BOX.top}" y2="${BOX.bottom}"/>${dates}
<polyline class="dg-history" points="${q.history.map((value,index)=>`${s.x(index)},${s.y(value)}`).join(' ')}"/>${inner}
<circle class="dg-pin" cx="${s.cutX}" cy="${s.y(q.history.at(-1))}" r="4.5"/></svg>`;
  }
  // El dibujo en curso: pad = {key, q, s, values, locked}. Solo hay una gráfica a la vez.
  let pad=null;
  const padKey=view=>`${view.id}:${view.round.number}`;
  function paintPad(root){
    if(!pad)return;
    const path=root.querySelector('.dg-drawn'),dots=root.querySelector('.dg-dots'),done=pad.values.filter(value=>value!=null).length;
    if(path)path.setAttribute('d',tracePath(pad.q,pad.s,pad.values));
    if(dots)dots.innerHTML=pad.values.map((value,index)=>value==null?'':`<circle cx="${pad.s.x(pad.q.cut+index+1)}" cy="${pad.s.y(value)}" r="2.6"/>`).join('');
    root.querySelector('.dg-hint')?.setAttribute('visibility',done?'hidden':'visible');
    const count=root.querySelector('#dg-count'),send=root.querySelector('#dg-send'),clear=root.querySelector('[data-dg=clear]');
    if(count){const text=done===pad.values.length?'Trazo completo: ya puedes enviarlo.':`${done} de ${pad.values.length} puntos trazados`;if(count.textContent!==text)count.textContent=text}
    if(send)send.disabled=done!==pad.values.length;
    if(clear)clear.disabled=!done;
  }
  function mountPad(view,root){
    const svg=root.querySelector('.dg-plot.is-drawing');if(!svg)return;
    const q=view.round.question,s=scale(q);
    if(pad?.key!==padKey(view))pad={key:padKey(view),q,s,values:Array(s.hidden).fill(null),locked:false};
    const fix=value=>Number(Math.min(q.max,Math.max(q.min,value)).toFixed(q.precision));
    let pointer=null,last=null;
    function at(event){
      const matrix=svg.getScreenCTM();if(!matrix)return null;
      const point=new DOMPoint(event.clientX,event.clientY).matrixTransform(matrix.inverse());
      return {f:(point.x-s.cutX)/(BOX.right-s.cutX)*s.hidden,value:q.max-(point.y-BOX.top)*(q.max-q.min)/(BOX.bottom-BOX.top)};
    }
    // Cada punto del trazo es un periodo de la gráfica: al arrastrar se rellenan todos los que quedan entre
    // la posición anterior y la nueva, para que un trazo rápido no deje huecos.
    function stroke(sample){
      if(!sample)return;
      const index=Math.max(0,Math.min(s.hidden,Math.round(sample.f)));
      if(last){
        for(let k=Math.max(1,Math.min(last.index,index));k<=Math.max(last.index,index);k++)
          pad.values[k-1]=fix(index===last.index?sample.value:last.value+(sample.value-last.value)*(k-last.index)/(index-last.index));
      }else if(index>=1)pad.values[index-1]=fix(sample.value);
      last={index,value:sample.value};
    }
    svg.addEventListener('pointerdown',event=>{
      if(pad.locked||!event.isPrimary||event.button>0)return;
      pointer=event.pointerId;last=null;try{svg.setPointerCapture(pointer)}catch{}
      stroke(at(event));paintPad(root);event.preventDefault();
    });
    svg.addEventListener('pointermove',event=>{
      if(pointer!==event.pointerId||pad.locked)return;
      const samples=event.getCoalescedEvents?.()||[];
      for(const sample of samples.length?samples:[event])stroke(at(sample));
      paintPad(root);
    });
    const end=event=>{if(pointer===event.pointerId){pointer=null;last=null}};
    for(const name of ['pointerup','pointercancel','lostpointercapture'])svg.addEventListener(name,end);
    paintPad(root);
  }
  // Botones de las cajas de respuesta. Se escuchan una vez en el documento: el contenido del duelo se repinta entero.
  document.addEventListener('click',event=>{
    const button=event.target.closest?.('[data-dg]');if(!button)return;
    const root=button.closest('#duel-content');if(!root)return;
    const action=button.dataset.dg;
    if(action==='clear'&&pad&&!pad.locked){pad.values.fill(null);paintPad(root)}
    if(action==='line'&&pad&&!pad.locked){
      // Alternativa sin arrastrar: una línea recta desde el último dato conocido hasta el valor escrito.
      const input=root.querySelector('#dg-end'),help=root.querySelector('#duel-help'),end=input?.valueAsNumber,{q}=pad;
      if(!Number.isFinite(end)||end<q.min||end>q.max){if(help)help.textContent=`Escribe un valor entre ${fmt(q.min)} y ${fmt(q.max)}.`;return}
      if(help)help.textContent='';
      const from=q.history.at(-1),count=pad.values.length;
      pad.values=pad.values.map((_,index)=>Number((from+(end-from)*(index+1)/count).toFixed(q.precision)));paintPad(root);
    }
    if(action==='year-down'||action==='year-up'){
      const input=root.querySelector('#dg-year');if(!input)return;
      const min=Number(input.min),max=Number(input.max),current=input.valueAsNumber;
      input.value=Math.max(min,Math.min(max,Number.isFinite(current)?Math.round(current)+(action==='year-up'?1:-1):Math.round((min+max)/2)));
      syncYear(root,input);
    }
    if(action==='zoom'){const large=button.classList.toggle('is-large');button.setAttribute('aria-pressed',String(large))}
  });
  // El año se puede escribir o mover con el deslizador: los dos enseñan lo mismo.
  function syncYear(root,from){
    const year=root.querySelector('#dg-year'),range=root.querySelector('#dg-range'),help=root.querySelector('#duel-help');
    if(!year||!range)return;
    if(from===range)year.value=range.value;
    else if(Number.isInteger(year.valueAsNumber)&&year.valueAsNumber>=Number(year.min)&&year.valueAsNumber<=Number(year.max))range.value=year.value;
    if(help)help.textContent='';
  }
  document.addEventListener('input',event=>{
    const target=event.target;if(target?.id!=='dg-year'&&target?.id!=='dg-range')return;
    const root=target.closest('#duel-content');if(root)syncYear(root,target);
  });

  // ── Pregunta, caja de respuesta y respuesta enviada ───────────────────────────────────────────────────────
  const rivalSlot='<p class="duel-rival-state" id="duel-rival-state"></p>';
  // Lo que va entre el reloj y la caja de respuesta: el enunciado y, si lo hay, la gráfica o la foto.
  function question(view){
    const q=view.round.question;
    if(view.game==='ascension')return `<h2 id="duel-title" class="dg-title">${esc(q.title)}</h2>${q.description?`<p class="dg-desc">${esc(q.description)}</p>`:''}<p class="dg-meta">${fmt(q.count)} respuestas válidas · cuanto más rara, más puntos</p>`;
    if(view.game==='traza'){
      const s=scale(q),mine=view.round.yourGuess,drawing=mine==null&&!(view.size===3&&!view.round.alive.includes(view.you));
      if(mine!=null)pad=null;
      const inner=drawing?`<path class="dg-drawn" d=""/><g class="dg-dots"></g><text class="dg-hint" x="${(s.cutX+BOX.right)/2}" y="${(BOX.top+BOX.bottom)/2}" text-anchor="middle">Dibuja aquí</text>`
        :mine!=null?`<path class="dg-drawn" d="${tracePath(q,s,mine)}"/>`:'';
      return `<h2 id="duel-title" class="dg-title">${esc(q.title)}</h2><p class="dg-desc">${esc(q.detail)} <b>${esc(q.unit)}</b></p>
<div class="dg-chart">${plot(q,inner,{drawing,label:`Gráfica hasta ${dateLabel(q,q.start+q.cut)}. La zona sombreada, hasta ${dateLabel(q,q.end)}, es la que hay que dibujar.`})}</div>`;
    }
    return `<h2 id="duel-title" class="dg-title">¿De qué año es esta foto?</h2>
<button type="button" class="dg-photo" data-dg="zoom" aria-pressed="false" title="Ampliar o reducir la foto"><img src="${esc(q.photo)}" alt="${esc(q.alt)}"><span class="sr-only"> Ampliar o reducir la foto</span></button>
${q.detail?`<details class="dg-clue"><summary>Pista de la foto</summary><p>${esc(q.detail)}</p></details>`:''}`;
  }
  function form(view){
    const q=view.round.question;
    if(view.game==='ascension')return `<form id="duel-form" class="dg-form"><label class="sr-only" for="dg-text">Tu respuesta</label>
<div class="guess-row"><input id="dg-text" data-dg-focus type="text" autocomplete="off" autocapitalize="sentences" enterkeyhint="go" spellcheck="false" maxlength="120" placeholder="Tu respuesta" aria-describedby="duel-help" required></div>
<div class="form-error" id="duel-help" role="alert"></div>
<div class="dg-actions">${rivalSlot}<button class="game-primary" type="submit">Confirmar <span aria-hidden="true">→</span></button></div></form>`;
    if(view.game==='traza')return `<form id="duel-form" class="dg-form"><p class="dg-caption">Arrastra por la zona sombreada, desde el punto amarillo hasta ${esc(dateLabel(q,q.end))}. Puedes repasar cualquier tramo.</p>
<p class="dg-count" id="dg-count" aria-live="polite"></p>
<details class="dg-line"><summary>Sin arrastrar: línea recta hasta un valor</summary><div><label for="dg-end">Valor en ${esc(dateLabel(q,q.end))} (${esc(q.unit)})</label><input id="dg-end" type="number" inputmode="decimal" step="any" min="${q.min}" max="${q.max}"><button type="button" class="game-secondary" data-dg="line">Trazar</button></div></details>
<div class="form-error" id="duel-help" role="alert"></div>
<div class="dg-actions"><button class="game-secondary" type="button" data-dg="clear" disabled>Borrar</button>${rivalSlot}<button class="game-primary" type="submit" id="dg-send" disabled>Enviar <span aria-hidden="true">→</span></button></div></form>`;
    const middle=Math.round((q.minYear+q.maxYear)/2);
    return `<form id="duel-form" class="dg-form" novalidate><label class="sr-only" for="dg-year">Año de la foto, entre ${q.minYear} y ${q.maxYear}</label>
<div class="dg-year"><button type="button" data-dg="year-down" aria-label="Restar un año">−</button><input id="dg-year" type="number" inputmode="numeric" step="1" min="${q.minYear}" max="${q.maxYear}" placeholder="${q.minYear}–${q.maxYear}" aria-describedby="duel-help" required><button type="button" data-dg="year-up" aria-label="Sumar un año">+</button></div>
<input class="dg-range" id="dg-range" type="range" min="${q.minYear}" max="${q.maxYear}" step="1" value="${middle}" aria-label="Año de la foto, con deslizador">
<div class="dg-range-ends" aria-hidden="true"><span>${q.minYear}</span><span>${q.maxYear}</span></div>
<div class="form-error" id="duel-help" role="alert"></div>
<div class="dg-actions">${rivalSlot}<button class="game-primary" type="submit">Confirmar año <span aria-hidden="true">→</span></button></div></form>`;
  }
  // Tras pintar la caja: engancha el dibujo de la gráfica.
  function mount(view,root){if(view.game==='traza')mountPad(view,root)}
  // La respuesta lista para enviar, o el aviso de por qué aún no se puede.
  function read(view,root){
    if(view.game==='ascension'){const text=(root.querySelector('#dg-text')?.value||'').replace(/\s+/g,' ').trim();return text?{guess:text}:{error:'Escribe una respuesta.'}}
    if(view.game==='traza')return pad&&pad.key===padKey(view)&&pad.values.every(value=>value!=null)?{guess:[...pad.values]}:{error:'Completa el trazo hasta el final de la gráfica.'};
    const q=view.round.question,year=root.querySelector('#dg-year')?.valueAsNumber;
    return Number.isInteger(year)&&year>=q.minYear&&year<=q.maxYear?{guess:year}:{error:`Escribe un año entre ${q.minYear} y ${q.maxYear}.`};
  }
  // El servidor no ha aceptado la respuesta (Ascensión: no está en la lista): se deja el texto seleccionado para probar otra.
  function retry(view,root){const input=root.querySelector('#dg-text');if(input){input.focus();input.select()}}
  function sent(view,root){
    const mine=view.round.yourGuess;
    if(view.game==='traza'){
      if(pad)pad.locked=true;
      root?.querySelector('.dg-plot')?.classList.remove('is-drawing');
      return '<div class="duel-sent"><small>Tu trazo</small><strong class="dg-sent">Enviado</strong><span>Se compara con los datos reales al acabar la ronda</span></div>'+rivalSlot;
    }
    return `<div class="duel-sent"><small>Tu respuesta</small><strong class="dg-sent">${esc(mine)}</strong></div>`+rivalSlot;
  }

  // ── Resultado de la ronda ─────────────────────────────────────────────────────────────────────────────────
  // ui (lo pasa duel.js): seats (primero el tuyo), label(seat), figure(seat), best(seat), out(seat), hit(seat).
  function column(view,ui,seat,guess,note){
    const out=ui.out(seat);
    return `<div class="duel-col${ui.best(seat)?' is-best':''}${out?' is-out':''}">${ui.figure(seat)}<span class="duel-col-name">${ui.label(seat)}</span><strong class="duel-col-guess dg-col-guess">${out?'Fuera':guess}</strong><span class="duel-col-x">${out?'—':note}</span><b class="duel-col-points" data-points="${view.round.points[seat]}">0</b><small>puntos</small>${ui.hit(seat)}</div>`;
  }
  const columns=(ui,inner)=>`<div class="duel-cols${ui.seats.length>2?' is-three':''}">${inner}</div>`;
  const years=count=>count===1?'1 año':`${count} años`;
  const sourceLine=source=>source?`<a href="${link(source.url)}" target="_blank" rel="noopener">${esc(source.title)} ↗</a>${source.license?` · ${source.licenseUrl?`<a href="${link(source.licenseUrl)}" target="_blank" rel="noopener">${esc(source.license)}</a>`:esc(source.license)}`:''}${source.attribution?` · ${esc(source.attribution)}`:''}`:'';
  const creditLine=reveal=>`${esc(reveal.credit)} · ${esc(reveal.rights)}. <a href="${link(reveal.source)}" target="_blank" rel="noopener">Ver ficha de archivo ↗</a>${reveal.reference?` · <a href="${link(reveal.reference)}" target="_blank" rel="noopener">Referencia de la recreación ↗</a>`:''}`;
  // Devuelve {head, extra}: lo que va antes de la frase de quién pierde vida y lo que va después.
  function reveal(view,ui){
    const round=view.round,q=round.question,info=round.reveal||{},marks=round.marks||[];
    if(view.game==='ascension'){
      const top=Math.max(0,...ui.seats.map(seat=>ui.out(seat)?0:round.points[seat])),winner=ui.seats.find(seat=>!ui.out(seat)&&round.guesses[seat]!=null&&round.points[seat]===top);
      const head=`<h2 id="duel-title" class="duel-q-small">${esc(q.title)}</h2>
<div class="duel-real"><small>La más rara de la ronda</small>${winner===undefined?'<strong>Nadie ha respondido</strong>':`<strong class="dg-real-text">${esc(round.guesses[winner])}</strong><span>${esc(marks[winner]?.label||'')}</span>`}</div>
${columns(ui,ui.seats.map(seat=>column(view,ui,seat,round.guesses[seat]==null?'Sin respuesta':esc(round.guesses[seat]),marks[seat]?esc(marks[seat].label):'—')).join(''))}`;
      const extra=`<details class="duel-explain"><summary>Otras respuestas que valían <small>· ${fmt(info.count||0)} en total</small></summary><div class="explain-inner"><ul class="dg-examples">${(info.examples||[]).map(one=>`<li><b>${esc(one.name)}</b><span>${esc(one.label)}</span></li>`).join('')}</ul><p class="dg-credit">Fuentes: ${(info.sources||[]).map(sourceLine).join(' · ')}</p></div></details>`;
      return {head,extra};
    }
    if(view.game==='traza'){
      const s=scale(q),actual=info.actual||[],dot=seat=>`<i class="dg-swatch" style="--c:${SEAT_COLORS[ui.seats.indexOf(seat)%SEAT_COLORS.length]}"></i>`;
      const lines=ui.seats.map((seat,order)=>ui.out(seat)||round.guesses[seat]==null?'':`<path class="dg-guess" style="--c:${SEAT_COLORS[order%SEAT_COLORS.length]}" d="${tracePath(q,s,round.guesses[seat])}"/>`).join('');
      const head=`<h2 id="duel-title" class="duel-q-small">${esc(q.title)} <small class="dg-unit">${esc(q.unit)}</small></h2>
<div class="dg-chart is-result">${plot(q,`${lines}<path class="dg-actual" d="${tracePath(q,s,actual)}"/>`,{label:'Comparación de los trazos con los datos reales'})}
<p class="dg-legend"><span><i class="dg-swatch is-real"></i>Dato real</span>${ui.seats.map(seat=>`<span>${dot(seat)}${ui.label(seat)}</span>`).join('')}</p></div>
<p class="dg-credit">Fuente: ${sourceLine(info.source)}</p>
${columns(ui,ui.seats.map(seat=>column(view,ui,seat,marks[seat]?`${dot(seat)}±${esc(brief(marks[seat].error))}`:'Sin trazo',marks[seat]?'de error medio':'—')).join(''))}`;
      const story=info.context?.story,extra=story||info.source?.provider?`<details class="duel-explain"><summary>Qué pasó</summary><div class="explain-inner">${story?`<p>${esc(story)}${info.context.url?` <a href="${link(info.context.url)}" target="_blank" rel="noopener">Ver fuente del contexto ↗</a>`:''}</p>`:''}<p>${esc(q.detail)}</p>${info.source?.provider?`<p class="dg-credit">${esc(info.source.provider)}</p>`:''}</div></details>`:'';
      return {head,extra};
    }
    const head=`<h2 id="duel-title" class="duel-q-small">¿De qué año es esta foto?</h2>
<div class="dg-solved"><img src="${esc(q.photo)}" alt="${esc(q.alt)}"><div class="duel-real"><small>Real</small><strong>${esc(info.year)}</strong><span>${esc(info.place)}</span></div></div>
<p class="dg-credit">Foto: ${creditLine(info)}</p>
${columns(ui,ui.seats.map(seat=>column(view,ui,seat,round.guesses[seat]==null?'Sin respuesta':esc(round.guesses[seat]),marks[seat]?(marks[seat].off?`a ${years(marks[seat].off)}`:'¡Año exacto!'):'—')).join(''))}`;
    return {head,extra:`<details class="duel-explain"><summary>La historia de la foto</summary><div class="explain-inner"><p><strong>${esc(info.title)}</strong></p><p>${esc(info.story)}</p></div></details>`};
  }
  // Repaso del final del duelo: cada ronda con lo que respondió cada uno y su fuente o atribución.
  function review(view,ui){
    const rounds=(view.rounds||[]).filter(round=>round.question);if(!rounds.length)return '';
    const rows=(round,text)=>`<dl class="duel-review-guesses">${ui.seats.map(seat=>`<div><dt>${ui.label(seat)}</dt><dd>${text(seat)}<small>${esc(fmt(round.points?.[seat]||0))} pts</small></dd></div>`).join('')}</dl>`;
    return `<section class="duel-review" aria-labelledby="duel-review-title"><h3 id="duel-review-title">Repasa las rondas</h3>${rounds.map((round,index)=>{
      const marks=round.marks||[],info=round.reveal||{},q=round.question;let title,body;
      if(view.game==='ascension'){title=esc(q.title);body=rows(round,seat=>round.guesses?.[seat]==null?'Sin respuesta':`${esc(round.guesses[seat])} · ${esc(marks[seat]?.label||'')}`)+`<p class="dg-credit">Fuentes: ${(info.sources||[]).map(sourceLine).join(' · ')}</p>`}
      else if(view.game==='traza'){title=esc(q.title);body=rows(round,seat=>marks[seat]?`±${esc(brief(marks[seat].error))} ${esc(q.unit)} de error medio`:'Sin trazo')+`<p class="dg-credit">Fuente: ${sourceLine(info.source)}</p>`}
      else{title=`${esc(info.title)} · ${esc(info.year)}`;body=`<div class="dg-review-photo"><img src="${esc(q.photo)}" alt="${esc(q.alt)}" loading="lazy"><p>${esc(info.place)}. ${esc(info.story)}</p></div>`+rows(round,seat=>round.guesses?.[seat]==null?'Sin respuesta':`${esc(round.guesses[seat])}${marks[seat]?.off?` · a ${years(marks[seat].off)}`:' · exacto'}`)+`<p class="dg-credit">Foto: ${creditLine(info)}</p>`}
      return `<details class="duel-review-item"><summary><span>R${index+1}</span>${title}</summary><div class="dg-review">${body}</div></details>`}).join('')}</section>`;
  }

  window.DuelGames={GAMES,get,valid,picker,cue,question,form,mount,read,retry,sent,reveal,review};
})();

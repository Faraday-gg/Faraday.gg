(()=>{
  const dialog=document.getElementById('trends-dialog');
  const content=document.getElementById('trends-content');
  const progress=document.getElementById('trends-progress');
  const stage=document.getElementById('trends-avatar');
  const alert=document.getElementById('trends-error');
  const home=document.querySelector('.home-trends');
  const subtitle=document.getElementById('trends-avatar-line');
  const samplesPerPeriod=16;
  let box;
  const number=new Intl.NumberFormat('es-ES',{maximumFractionDigits:4,useGrouping:'always'});
  const fmt=value=>number.format(value);
  const text=value=>escapeHtml(String(value));
  const clamp=(value,min,max)=>Math.min(max,Math.max(min,value));
  let edition,chart,draft,trace,stroke,opener,view=0,lookKey='',pending=false;
  const element=selector=>content.querySelector(selector);

  function avatar(state){
    const look=window.Progress?.look?.()||window.Avatar?.defaults?.();
    if(!look)return;
    const key=JSON.stringify(look);
    if(key!==lookKey||!stage.firstElementChild){
      lookKey=key;
      stage.innerHTML=Avatar.render(look,{zoom:'stage',live:true,turn:.3});
    }
    const actor=stage.firstElementChild;
    actor._react=state;
    window.Avatar3D?.react?.(actor);
  }

  const tiers=[
    {min:950,label:'¡Casi casi!',clip:'clavada',rest:'cheer'},
    {min:800,label:'Muy cerca',clip:'salto',rest:'cheer'},
    {min:600,label:'Cerca',clip:'puno',rest:''},
    {min:350,label:'Lejos',clip:'encoger',rest:'meh'},
    {min:0,label:'Muy lejos',clip:'facepalm',rest:'sad'},
  ];
  function mood(score,animate){
    const tier=tiers.find(item=>score>=item.min);
    subtitle.textContent=tier.label;
    avatar(animate?{clip:tier.clip,mood:'',then:tier.rest}:{mood:tier.rest});
    return tier.label;
  }

  async function request(action,extra={}){
    await playerReady;
    const response=await fetch('/api/tendencias',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({action,...extra}),signal:AbortSignal.timeout(12000)});
    const data=await response.json();
    if(!response.ok)throw Object.assign(new Error(data.error),{status:response.status});
    return data;
  }

  function notice(message=''){
    alert.textContent=message;
    alert.hidden=!message;
  }

  function screen(markup,{focus=true}={}){
    notice();
    content.innerHTML=markup;
    dialog.scrollTop=0;
    if(focus)element('h3')?.focus({preventScroll:true});
  }

  const shortDate=new Intl.DateTimeFormat('es',{month:'short',year:'2-digit',timeZone:'UTC'});
  const longDate=new Intl.DateTimeFormat('es',{month:'long',year:'numeric',timeZone:'UTC'});
  function dateLabel(q,period,short=false){
    if(q.labels)return String(q.labels[period-q.start]);
    if(q.period!=='month')return String(period);
    const date=new Date(Date.UTC(Math.floor(period/12),period%12,1));
    return (short?shortDate:longDate).format(date);
  }
  const unitOfTime=q=>({month:'mes',edition:'edición'})[q.period]||'año';
  const timeLabel=q=>({month:'Mes',edition:'Edición'})[q.period]||'Año';
  const times=q=>({month:'meses trazados',edition:'ediciones trazadas'})[q.period]||'años trazados';
  const roundLabel=index=>`${index>=edition.rounds?'Partida extra · ':''}Gráfica ${index%edition.rounds+1} de ${edition.rounds}`;

  function x(q,index){
    const cut=box.left+(box.right-box.left)*.37;
    if(index<=q.cut)return box.left+(cut-box.left)*index/q.cut;
    return cut+(box.right-cut)*(index-q.cut)/(q.end-q.start-q.cut);
  }
  const y=(q,value)=>box.bottom-(value-q.min)/(q.max-q.min)*(box.bottom-box.top);
  const points=(q,values,offset=0)=>values.map((value,index)=>`${x(q,index+offset)},${y(q,value)}`).join(' ');
  const line=(q,values)=>points(q,[q.history.at(-1),...values],q.cut);
  function plot(q,result){
    box=matchMedia('(max-width: 560px)').matches
      ?{width:360,height:334,left:52,right:350,top:34,bottom:300}
      :{width:880,height:442,left:77,right:854,top:36,bottom:398};
    const marker=x(q,q.cut),cutYear=q.start+q.cut;
    const years=[q.start,cutYear,cutYear+Math.round((q.end-cutYear)/2),q.end];
    const tick=q.tick;
    const first=Math.ceil(q.min/tick-1e-9),last=Math.floor(q.max/tick+1e-9);
    const minorTicks=Array.from({length:Math.max(0,last-first)},(_,i)=>{
      const at=y(q,(first+i+.5)*tick);
      return `<line class="trends-guide" x1="${box.left}" x2="${box.right}" y1="${at}" y2="${at}"/>`;
    }).join('');
    const ticks=Array.from({length:last-first+1},(_,i)=>{
      const value=Number(((first+i)*tick).toFixed(q.precision));
      const at=y(q,value);
      return `<line class="trends-grid" x1="${box.left}" x2="${box.right}" y1="${at}" y2="${at}"/><text x="${box.left-8}" y="${at+5}" text-anchor="end">${fmt(value)}</text>`;
    }).join('');
    const dates=years.map((year,i)=>`<text x="${x(q,year-q.start)}" y="${box.bottom+22}" text-anchor="${['start','middle','middle','end'][i]}">${text(dateLabel(q,year,true))}</text>`).join('');
    const guides=Array.from({length:q.end-cutYear},(_,i)=>{
      const at=x(q,q.cut+i+1);
      return `<line class="trends-guide" x1="${at}" x2="${at}" y1="${box.top}" y2="${box.bottom}"/>`;
    }).join('');
    const community=result?.community?.values;
    return `<svg class="trends-plot${result?'':' is-drawing'}" viewBox="0 0 ${box.width} ${box.height}" role="img" aria-label="${result?'Comparación de las curvas':'Gráfica hasta '+dateLabel(q,q.start+q.cut)+'. El tramo sombreado es el que debes completar.'}">
      <rect class="trends-zone" x="${marker}" y="${box.top}" width="${box.right-marker}" height="${box.bottom-box.top}"/>
      <text class="trends-axis-title" x="${box.left}" y="${box.top-11}">Historial</text>
      <text class="trends-axis-title" x="${marker+10}" y="${box.top-11}">${result?'Tramo revelado':'Tramo ampliado'}</text>
      ${minorTicks}${ticks}${guides}<line class="trends-cut" x1="${marker}" x2="${marker}" y1="${box.top}" y2="${box.bottom}"/>${dates}
      <polyline class="trends-history" points="${points(q,q.history)}"/>
      ${result?`<polygon class="trends-gap" points="${line(q,result.actual)} ${points(q,result.guess,q.cut+1).split(' ').reverse().join(' ')}"/><polyline class="trends-actual" points="${line(q,result.actual)}"/><polyline class="trends-guess" points="${line(q,result.guess)}"/>
        ${community?`<polyline class="trends-community" points="${line(q,community)}"/>`:''}`:
        '<path class="trends-drawn"/><circle class="trends-cursor" r="4" visibility="hidden"/>'}
      <circle class="trends-pin" cx="${marker}" cy="${y(q,q.history.at(-1))}" r="5"/>
    </svg>`;
  }

  function renderQuestion(){
    chart=edition.current;
    draft=Array(chart.end-chart.start-chart.cut).fill(null);
    trace=Array(draft.length*samplesPerPeriod+1).fill(null);
    trace[0]=chart.history.at(-1);
    stroke=null;
    subtitle.textContent='';
    progress.textContent=roundLabel(edition.results.length);
    avatar({mood:'nervous'});
    const q=chart,cut=q.start+q.cut;
    const options=draft.map((_,i)=>`<option value="${i}">${text(dateLabel(q,cut+i+1))}</option>`).join('');
    screen(`<section class="trends-card">
      <h3 tabindex="-1">${text(q.title)}</h3>
      <p class="trends-detail">${text(q.detail)}</p>
      <p class="trends-unit">${text(q.unit)}</p>
      ${plot(q)}
      <output class="trends-coordinate" data-trends-coordinate></output>
      <p class="trends-caption">Arrastra hasta ${text(dateLabel(q,q.end))}. Para ajustar la curva, agarra la línea y muévela antes de revelar.</p>
      <details class="trends-editor"><summary>Editar valores por ${unitOfTime(q)}</summary>
        <div class="trends-controls">
          <label>${timeLabel(q)}<select data-trends-year>${options}</select></label>
          <label>Tu estimación<input data-trends-value type="number" min="${q.min}" max="${q.max}" step="any"></label>
          <button class="game-secondary" type="button" data-trends-set>Guardar punto</button>
        </div>
        <p class="trends-caption">Último dato conocido: ${text(dateLabel(q,cut))} · ${fmt(q.history.at(-1))} ${text(q.unit)}.</p>
      </details>
      <div class="trends-actions">
        <button class="game-secondary" type="button" data-trends-clear disabled>Borrar trazo</button>
        <button class="game-primary" type="button" data-trends-reveal disabled>Revelar</button>
      </div>
      <p class="trends-caption" data-trends-count aria-live="polite"></p>
    </section>`);
    bindPlot();
    updateDraft();
  }

  function updateDraft(index){
    const path=trace.map((value,i)=>value===null?'':`${i===0||trace[i-1]===null?'M':'L'}${x(chart,chart.cut+i/samplesPerPeriod)} ${y(chart,value)}`).join(' ');
    element('.trends-drawn').setAttribute('d',path);
    if(index!==undefined){
      const cursor=element('.trends-cursor');
      cursor.setAttribute('cx',x(chart,chart.cut+index/samplesPerPeriod));
      cursor.setAttribute('cy',y(chart,trace[index]));
      cursor.setAttribute('visibility','visible');
      const label=dateLabel(chart,chart.start+chart.cut+Math.round(index/samplesPerPeriod));
      element('[data-trends-coordinate]').textContent=`${label} · ${fmt(trace[index])}`;
    }
    const count=draft.filter(value=>value!==null).length;
    const caption=`${count} de ${draft.length} ${times(chart)}`;
    const counter=element('[data-trends-count]');
    if(counter.textContent!==caption)counter.textContent=caption;
    element('[data-trends-reveal]').disabled=pending||count!==draft.length;
    element('[data-trends-clear]').disabled=pending||trace.slice(1).every(value=>value===null);
  }

  const quantize=value=>Number(clamp(value,chart.min,chart.max).toFixed(chart.precision));
  function bindPlot(){
    const svg=element('.trends-plot');
    function position(event){
      const transform=svg.getScreenCTM();
      const p=new DOMPoint(event.clientX,event.clientY).matrixTransform(transform.inverse());
      const marker=x(chart,chart.cut), max=trace.length-1;
      const index=Math.round((p.x-marker)*max/(box.right-marker));
      const value=chart.max-(p.y-box.top)*(chart.max-chart.min)/(box.bottom-box.top);
      return {x:p.x,y:p.y,scaleX:Math.abs(transform.a),scaleY:Math.abs(transform.d),index:clamp(index,1,max),value:quantize(value)};
    }
    function draw(point){
      const start=stroke.point;
      const delta=point.index-start.index;
      for(let i=Math.max(1,Math.min(start.index,point.index));i<=Math.max(start.index,point.index);i++){
        const value=delta?start.value+(point.value-start.value)*(i-start.index)/delta:point.value;
        trace[i]=quantize(value);
        if(i%samplesPerPeriod===0)draft[i/samplesPerPeriod-1]=trace[i];
      }
      stroke.point=point;
    }
    function hit(point,type){
      let nearest=0,distance=type==='touch'?25:15;
      for(let i=1;i<trace.length;i++){
        if(trace[i]===null)continue;
        const dx=(point.x-x(chart,chart.cut+i/samplesPerPeriod))*point.scaleX;
        const dy=(point.y-y(chart,trace[i]))*point.scaleY;
        const gap=Math.hypot(dx,dy);
        if(gap<distance){nearest=i;distance=gap}
      }
      return nearest;
    }

    function grab(anchor,point){
      let left=anchor,right=anchor;
      while(left>0&&trace[left-1]!==null)left--;
      while(right<trace.length-1&&trace[right+1]!==null)right++;
      return {anchor,left,right,original:trace.slice(),point};
    }

    function adjust(point){
      const {anchor,left,right,original,point:start}=stroke.edit;
      const target=clamp(anchor+point.index-start.index,Math.min(left+1,anchor),Math.max(right-1,anchor));
      const delta=(start.y-point.y)*(chart.max-chart.min)/(box.bottom-box.top);
      const radius=2*samplesPerPeriod;
      const from=Math.max(left,Math.min(target,anchor)-radius);
      const to=Math.min(right,Math.max(target,anchor)+radius);
      // Relee el trazo de inicio en cada movimiento para que volver al origen reproduzca la misma curva.
      trace=original.slice();
      for(let i=Math.max(from,1);i<=to;i++){
        const edge=i<target?from:to;
        const influence=i===target?1:1-(i-target)/(edge-target);
        const sample=edge+(anchor-edge)*influence;
        const low=Math.floor(sample),high=Math.ceil(sample);
        const value=original[low]+(original[high]-original[low])*(sample-low);
        const weight=influence*influence*(3-2*influence);
        trace[i]=quantize(value+delta*weight);
      }
      draft=draft.map((_,i)=>trace[(i+1)*samplesPerPeriod]);
      return target;
    }

    function update(event){
      let index;
      if(stroke.edit)index=adjust(position(event));
      else{
        const events=event.getCoalescedEvents?.();
        for(const sample of events?.length?events:[event])draw(position(sample));
        index=stroke.point.index;
      }
      window.Avatar3D?.lookAt?.(stage.firstElementChild,event.clientX,event.clientY);
      updateDraft(index);
    }
    svg.addEventListener('pointerdown',event=>{
      if(pending||!event.isPrimary||event.button!==0)return;
      const point=position(event);
      if(point.x<x(chart,chart.cut)-10||point.x>box.right+10||point.y<box.top-10||point.y>box.bottom+10)return;
      const last=trace.findLastIndex(value=>value!==null);
      const extending=point.index>last+samplesPerPeriod/3;
      const anchor=extending?0:hit(point,event.pointerType);
      const start=extending||last===0?{index:last,value:trace[last]}:point;
      stroke={id:event.pointerId,point:start,edit:anchor?grab(anchor,point):null};
      svg.classList.toggle('is-editing',Boolean(anchor));
      svg.setPointerCapture(event.pointerId);
      update(event);
    });
    svg.addEventListener('pointermove',event=>{
      if(stroke?.id===event.pointerId)update(event);
      else if(event.pointerType!=='touch')svg.classList.toggle('is-editable',Boolean(hit(position(event),event.pointerType)));
    });
    svg.addEventListener('pointerup',event=>{
      if(stroke?.id!==event.pointerId)return;
      update(event);
      syncEditor();
    });
    svg.addEventListener('lostpointercapture',()=>{
      stroke=null;
      svg.classList.remove('is-editing');
    });
  }

  function syncEditor(){
    const year=element('[data-trends-year]');
    element('[data-trends-value]').value=draft[Number(year.value)]??'';
  }

  function storePoint(){
    if(pending)return;
    const input=element('[data-trends-value]');
    if(!Number.isFinite(input.valueAsNumber)||!input.validity.valid){
      input.setCustomValidity(Number.isFinite(input.valueAsNumber)?'Usa un valor dentro de la escala.':'Escribe un valor.');
      input.reportValidity();
      input.setCustomValidity('');
      return;
    }
    const year=element('[data-trends-year]');
    const index=Number(year.value);
    draft[index]=quantize(input.valueAsNumber);
    const position=(index+1)*samplesPerPeriod;
    trace[position]=draft[index];
    for(const adjacent of [index-1,index+1]){
      const near=adjacent<0?trace[0]:draft[adjacent];
      if(near==null)continue;
      const endpoint=(adjacent+1)*samplesPerPeriod;
      for(let i=Math.min(position,endpoint)+1;i<Math.max(position,endpoint);i++){
        trace[i]=near+(draft[index]-near)*(i-endpoint)/(position-endpoint);
      }
    }
    updateDraft(position);
    if(index<draft.length-1){year.selectedIndex=index+1;syncEditor();input.focus()}
  }

  async function reveal(){
    if(pending)return;
    pending=true;
    notice();
    updateDraft();
    const token=view;
    avatar({mood:'wait'});
    try{
      const result=await request('revelar',{date:edition.date,chart:chart.id,guess:draft});
      if(token!==view)return;
      edition=result;
      const index=result.results.findIndex(item=>item.id===chart.id);
      renderResult(index,{animate:true});
    }catch(error){
      if(token!==view)return;
      avatar({mood:'nervous'});
      if(error.status===409){
        await load();
        return;
      }
      notice(error.status?error.message:'No se pudo mostrar el resultado. Vuelve a pulsar Revelar.');
    }finally{
      if(token===view){pending=false;if(element('[data-trends-reveal]'))updateDraft()}
    }
  }

  function renderResult(index,{animate=false,review=false}={}){
    const q=edition.results[index],cut=q.start+q.cut,observations=q.actual;
    const from=q.history.at(-1),last=observations.at(-1);
    const low=Math.min(...observations),high=Math.max(...observations);
    const extreme=low===high?'El dato se mantuvo constante en el tramo oculto.':
      `En el tramo oculto, el mínimo fue ${fmt(low)} en ${text(dateLabel(q,cut+observations.indexOf(low)+1))} y el máximo fue ${fmt(high)} en ${text(dateLabel(q,cut+observations.indexOf(high)+1))}.`;
    const changeUnit=q.unit.startsWith('%')?'puntos porcentuales':q.unit;
    const facts=from===last?`Acabó en el mismo nivel que en ${text(dateLabel(q,cut))} (${fmt(from)}).`:
      `De ${fmt(from)} en ${text(dateLabel(q,cut))} a ${fmt(last)} en ${text(dateLabel(q,q.end))}, un cambio de ${fmt(Math.abs(last-from))} ${text(changeUnit)}.`;
    const rows=observations.map((value,i)=>`<tr><th scope="row">${text(dateLabel(q,cut+i+1))}</th><td>${fmt(q.guess[i])}</td><td>${fmt(value)}</td>${q.community.values?`<td>${fmt(q.community.values[i])}</td>`:''}</tr>`).join('');
    const count=q.community.count;
    const community=q.community.values?`Media de ${count} trazos de otros jugadores de hoy.`:
      'La curva de la comunidad aparecerá cuando haya al menos tres trazos de otros jugadores.';
    progress.textContent=roundLabel(index);
    const verdict=mood(q.score,animate);
    screen(`<section class="trends-card">
      <h3 tabindex="-1">${text(q.title)}</h3>
      <p class="trends-unit">${text(q.unit)}</p>
      ${plot(q,q)}
      <div class="trends-legend"><span>Datos reales</span><span class="trends-key-guess">Tu trazo</span>${q.community.values?'<span class="trends-key-community">Comunidad</span>':''}</div>
      <p class="trends-caption">${community}</p>
      <div class="trends-points"><strong>${fmt(q.score)} pts</strong><b>${verdict}</b><span>Error medio: ${fmt(q.error)} ${text(changeUnit)}</span></div>
      <details class="trends-source" open><summary>Qué pasó</summary>
        ${q.context?`<p>${text(q.context.story)}${q.context.url?` <a href="${text(q.context.url)}" target="_blank" rel="noopener">Ver fuente del contexto ↗</a>`:''}</p>`:''}
        <p>${facts} ${extreme}</p>
        <p>${text(q.detail)}</p>
        <p><a href="${text(q.source.url)}" target="_blank" rel="noopener">${text(q.source.title)} ↗</a> · <a href="${text(q.source.licenseUrl||'https://creativecommons.org/licenses/by/4.0/')}" target="_blank" rel="noopener">${text(q.source.license)}</a></p>
        <details><summary>Proveedor y datos por ${unitOfTime(q)}</summary>
          <p>${text(q.source.provider)}</p>
          <table class="trends-data"><thead><tr><th scope="col">${timeLabel(q)}</th><th scope="col">Tu trazo</th><th scope="col">Real</th>${q.community.values?'<th scope="col">Comunidad</th>':''}</tr></thead><tbody>${rows}</tbody></table>
        </details>
      </details>
      <div class="trends-actions"><button class="game-primary" type="button" ${review?'data-trends-summary':'data-trends-next'}>${review?'Volver al resultado':edition.current?'Siguiente gráfica →':'Ver resultado →'}</button></div>
    </section>`);
  }

  function summary(){
    const daily=edition.results.slice(0,edition.rounds),extra=edition.results.slice(edition.rounds);
    const pointsOf=results=>results.reduce((sum,result)=>sum+result.score,0);
    const total=pointsOf(daily),extraTotal=pointsOf(extra);
    const heading=extra.length?'Tus partidas de hoy':'Tu resultado de hoy';
    progress.textContent=extra.length?'Partida extra completada':'Partida diaria completada';
    mood((extra.length?extraTotal:total)/edition.rounds,false);
    const review=(results,offset)=>results.map((result,i)=>`<button class="game-secondary" type="button" data-trends-review="${i+offset}"><span>${text(result.title)}</span><b>${fmt(result.score)} pts</b></button>`).join('');
    const score=total=>`<div class="trends-points"><strong>${fmt(total)} pts</strong><span>de ${fmt(1000*edition.rounds)}</span></div>`;
    const offer=edition.extra==='available'?`<section class="trends-replay"><h4>Juega otras tres gráficas</h4>
      <button class="game-primary" type="button" data-trends-extra>${edition.plus?'Jugar partida extra':'Ver anuncio de prueba'}</button>
      ${edition.plus?'':'<button class="game-secondary" type="button" data-trends-plan>Ver suscripción</button>'}
    </section>`:'';
    screen(`<section class="trends-card">
      <h3 tabindex="-1">${heading}</h3>
      ${extra.length?'<h4>Partida diaria</h4>':''}${score(total)}
      <div class="trends-review">${review(daily,0)}</div>
      ${extra.length?`<h4>Partida extra</h4>${score(extraTotal)}<div class="trends-review">${review(extra,edition.rounds)}</div>`:offer}
      <p class="trends-detail">Mañana tendrás tres gráficas nuevas.</p>
      <div class="trends-actions"><button class="game-secondary" data-close-trends type="button">Cerrar partida</button></div>
    </section>`);
  }

  async function startExtra(button){
    if(pending)return;
    pending=true;
    button.disabled=true;
    notice();
    const token=view,date=edition.date;
    try{
      let next=await request('preparar-extra',{date});
      if(token!==view)return;
      if(next.watch){
        const complete=await window.Ads.rewarded({kind:'tendencias'});
        if(!complete||token!==view)return;
        next=await request('activar-extra',{date});
      }
      if(token!==view)return;
      edition=next;
      if(next.current)renderQuestion();
      else summary();
    }catch(error){
      if(token===view)notice(error.status?error.message:'No se pudo abrir la partida extra. Inténtalo de nuevo.');
    }finally{
      if(token===view){pending=false;button.disabled=false}
    }
  }

  function openPlan(){
    dialog.close();
    setTimeout(()=>{
      window.Progress.open();
      const plan=document.querySelector('.profile-plan');
      plan?.scrollIntoView({block:'center'});
      if(plan){plan.tabIndex=-1;plan.focus({preventScroll:true})}
    },0);
  }

  async function load(){
    const token=++view;
    pending=false;
    progress.textContent='Tres gráficas al día';
    subtitle.textContent='';
    avatar({mood:''});
    screen('<p class="trends-caption" role="status">Cargando las gráficas de hoy…</p>',{focus:false});
    try{
      const result=await request('estado');
      if(token!==view)return;
      edition=result;
      if(result.current)renderQuestion();
      else summary();
    }catch(error){
      if(token!==view)return;
      screen('<section class="trends-card"><h3 tabindex="-1">No se pudo cargar la partida</h3><button class="game-secondary" type="button" data-trends-retry>Reintentar</button></section>');
      notice(error.status?error.message:'Comprueba tu conexión e inténtalo de nuevo.');
    }
  }

  document.querySelectorAll('[data-open-trends]').forEach(button=>button.addEventListener('click',()=>{
    opener=button;
    if(menuOpen()){
      opener=document.querySelector(document.getElementById('game-shell').hidden?'#home-menu-toggle':'#menu-toggle');
      toggleMenu(false);
    }
    dialog.showModal();
    load();
  }));
  dialog.addEventListener('click',event=>{
    const button=event.target.closest('button');
    if(!button)return;
    if(button.hasAttribute('data-close-trends'))dialog.close();
    else if(button.hasAttribute('data-trends-reveal'))reveal();
    else if(button.hasAttribute('data-trends-retry'))load();
    else if(button.hasAttribute('data-trends-set'))storePoint();
    else if(button.hasAttribute('data-trends-extra'))startExtra(button);
    else if(button.hasAttribute('data-trends-plan'))openPlan();
    else if(button.hasAttribute('data-trends-clear')){
      draft.fill(null);
      trace.fill(null,1);
      element('.trends-cursor').setAttribute('visibility','hidden');
      element('[data-trends-coordinate]').textContent='';
      syncEditor();
      updateDraft();
    }
    else if(button.hasAttribute('data-trends-next'))edition.current?renderQuestion():summary();
    else if(button.hasAttribute('data-trends-summary'))summary();
    else if(button.hasAttribute('data-trends-review'))renderResult(Number(button.dataset.trendsReview),{review:true});
  });
  content.addEventListener('change',event=>{if(event.target.matches('[data-trends-year]'))syncEditor()});
  dialog.addEventListener('keydown',event=>{
    if(event.key==='Enter'&&event.target.matches('[data-trends-value]')){event.preventDefault();storePoint()}
    if(event.key==='Escape'){event.stopPropagation();event.preventDefault();dialog.close()}
  });
  dialog.addEventListener('close',()=>{
    view++;
    stage.replaceChildren();
    (opener||home)?.focus({preventScroll:true});
  });
})();

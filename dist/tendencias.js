(()=>{
  const dialog=document.getElementById('trends-dialog');
  const content=document.getElementById('trends-content');
  const progress=document.getElementById('trends-progress');
  const stage=document.getElementById('trends-avatar');
  const alert=document.getElementById('trends-error');
  const home=document.querySelector('.home-trends');
  const samplesPerPeriod=16;
  let box;
  const prizes=new Map();
  const number=new Intl.NumberFormat('es-ES',{maximumFractionDigits:4,useGrouping:'always'});
  const axisNumber=new Intl.NumberFormat('es-ES',{notation:'compact',maximumFractionDigits:2});
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

  function mood(score,animate){
    avatar(Progress.reaction('trends',Celebrations.trendTier(score).id,{animate}));
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
    if(q.labels){
      const label=q.labels[period-q.start];
      if(q.period==='season'&&short)return label.slice(0,3)+'.';
      if(q.period==='biennium'&&!short)return `${label-1}–${label}`;
      return String(label);
    }
    if(q.period!=='month')return String(period);
    const date=new Date(Date.UTC(Math.floor(period/12),period%12,1));
    return (short?shortDate:longDate).format(date);
  }
  const unitOfTime=q=>({month:'mes',season:'mes',edition:'edición',biennium:'bienio'})[q.period]||'año';
  const timeLabel=q=>({month:'Mes',season:'Mes',edition:'Edición',biennium:'Bienio'})[q.period]||'Año';
  const times=q=>({month:'meses trazados',season:'meses trazados',edition:'ediciones trazadas',biennium:'bienios trazados'})[q.period]||'años trazados';
  const roundLabel=index=>`${index>=edition.rounds?`Partida extra ${edition.game} · `:''}Gráfica ${index%edition.rounds+1} de ${edition.rounds}`;

  function x(q,index){
    const cut=box.left+(box.right-box.left)*box.split;
    if(index<=q.cut)return box.left+(cut-box.left)*index/q.cut;
    return cut+(box.right-cut)*(index-q.cut)/(q.end-q.start-q.cut);
  }
  const y=(q,value)=>box.bottom-(value-q.min)/(q.max-q.min)*(box.bottom-box.top);
  const points=(q,values,offset=0)=>values.map((value,index)=>`${x(q,index+offset)},${y(q,value)}`).join(' ');
  const line=(q,values)=>points(q,[q.history.at(-1),...values],q.cut);
  const tracePath=(q,samples)=>samples.map((value,i)=>value===null?'':`${i===0||samples[i-1]===null?'M':'L'}${x(q,q.cut+i/samplesPerPeriod)} ${y(q,value)}`).join(' ');
  function resultLines(q,result,ownTrace){
    const actual=line(q,result.actual);
    const own=ownTrace?tracePath(q,ownTrace):line(q,result.guess);
    const guess=classes=>ownTrace?`<path class="${classes}" d="${own}"/>`:
      `<polyline class="${classes}" points="${own}"/>`;
    return `<g clip-path="url(#trends-clip-real)">
      <polyline class="trends-result-halo" points="${actual}"/>
      <polyline class="trends-actual" points="${actual}"/>
    </g>
    ${guess('trends-result-halo')}${guess(ownTrace?'trends-guess trends-drawn':'trends-guess')}`;
  }

  function labelEnds(graph,result,showActual,community){
    const compact=box.width===360;
    const labels=[{kind:'own',name:'Tu trazo',value:result.guess.at(-1)}];
    if(showActual)labels.push({kind:'actual',name:'Dato real',value:result.actual.at(-1)});
    if(community?.traces.length){
      // Ancla la etiqueta del grupo a un trazo existente en el centro de sus extremos.
      const ends=community.traces.map(trace=>trace.at(-1)).sort((a,b)=>a-b);
      const name=community.simulated?(compact?'Simulados':'Trazos simulados'):(compact?'Otros':'Otros jugadores');
      labels.push({kind:'peers',name,value:ends[Math.floor(ends.length/2)]});
    }
    const endpoints=labels.map(label=>({...label,end:y(result,label.value)})).sort((a,b)=>a.end-b.end);
    const gap=compact?17:25;
    let nextY=box.top;
    endpoints.forEach((label,i)=>{
      const maxY=box.bottom-gap*(endpoints.length-i-1);
      label.at=clamp(label.end,nextY,maxY);
      nextY=label.at+gap;
    });
    graph.querySelector('.trends-end-labels').innerHTML=endpoints.map(({kind,name,end,at})=>
      `<g class="trends-end-label trends-end-${kind}">
        <path d="M${box.right} ${end}L${box.right+8} ${at}"/>
        <text x="${box.right+11}" y="${at}" dominant-baseline="central">${name}</text>
      </g>`).join('');
  }

  function drawingGuides(q,marker){
    const middle=(marker+box.right)/2;
    const compact=box.width===360;
    const width=compact?154:232;
    const height=compact?34:46;
    const badge=axis=>`<g class="trends-axis-value" data-trends-axis="${axis}">
      <rect x="${-box.badge/2}" y="-11" width="${box.badge}" height="22" rx="5"/>
      <text text-anchor="middle" dominant-baseline="central"></text>
    </g>`;
    return `<path class="trends-drawn"/>
      <g class="trends-draw-hint" aria-hidden="true">
        <circle class="trends-start-ring" cx="${marker}" cy="${y(q,q.history.at(-1))}" r="13"/>
        <g transform="translate(${middle} ${(box.top+box.bottom)/2})">
          <rect class="trends-hint-panel" x="${-width/2}" y="${-height/2}" width="${width}" height="${height}" rx="${height/2}"/>
          <text class="trends-hint-text" x="${compact?-14:-8}" text-anchor="middle" dominant-baseline="central">Dibuja el resto</text>
          <path class="trends-hint-arrow" d="M${width/2-(compact?27:35)} 0h12m-5-5 5 5-5 5"/>
        </g>
      </g>
      <g class="trends-crosshair" visibility="hidden" aria-hidden="true">
        <path class="trends-projection"/>
        <circle class="trends-cursor" r="4"/>
        ${badge('x')}${badge('y')}
      </g>`;
  }

  function plot(q,result,ownTrace){
    const compact=matchMedia('(max-width: 560px)').matches;
    box=compact
      ?{width:360,height:334,left:52,right:290,top:34,bottom:300,badge:56,split:.32}
      :{width:880,height:442,left:77,right:746,top:36,bottom:398,badge:70,split:.37};
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
    const dates=years.map((year,i)=>`<text class="trends-date-tick" x="${x(q,year-q.start)}" y="${box.bottom+22}" text-anchor="${['start','middle','middle','end'][i]}">${text(dateLabel(q,year,true))}</text>`).join('');
    const guides=Array.from({length:q.end-cutYear},(_,i)=>{
      const at=x(q,q.cut+i+1);
      return `<line class="trends-guide" x1="${at}" x2="${at}" y1="${box.top}" y2="${box.bottom}"/>`;
    }).join('');
    const clip=kind=>`<clipPath id="trends-clip-${kind}"><rect x="${marker-4}" y="${box.top-4}" width="${box.right-marker+8}" height="${box.bottom-box.top+8}"/></clipPath>`;
    const historyLabel=q.period==='season'?(compact?'Meses':'Meses visibles'):'Historial';
    return `<svg class="trends-plot${result?'':' is-drawing'}" viewBox="0 0 ${box.width} ${box.height}" role="img" aria-label="${result?'Comparación de tu trazo con el dato real y los demás trazos':'Gráfica hasta '+dateLabel(q,q.start+q.cut)+'. El tramo sombreado es el que debes completar.'}">
      <rect class="trends-zone" x="${marker}" y="${box.top}" width="${box.right-marker}" height="${box.bottom-box.top}"/>
      <text class="trends-axis-title" x="${box.left}" y="${box.top-11}">${historyLabel}</text>
      ${result?`<text class="trends-axis-title" x="${marker+10}" y="${box.top-11}">Tramo revelado</text>`:''}
      ${minorTicks}${ticks}${guides}<line class="trends-cut" x1="${marker}" x2="${marker}" y1="${box.top}" y2="${box.bottom}"/>${dates}
      <polyline class="trends-history" points="${points(q,q.history)}"/>
      ${result?`<defs>${clip('real')}${clip('others')}</defs>
        <g class="trends-peer-traces" clip-path="url(#trends-clip-others)" aria-hidden="true"></g>
        ${resultLines(q,result,ownTrace)}
        <g class="trends-end-labels"></g>`:
        drawingGuides(q,marker)}
      <circle class="trends-pin" cx="${marker}" cy="${y(q,q.history.at(-1))}" r="5"/>
      ${result?'':'<circle class="trends-resume" r="7" visibility="hidden"/>'}
    </svg>`;
  }

  function renderQuestion(){
    chart=edition.current;
    draft=Array(chart.end-chart.start-chart.cut).fill(null);
    trace=Array(draft.length*samplesPerPeriod+1).fill(null);
    trace[0]=chart.history.at(-1);
    stroke=null;
    progress.textContent=roundLabel(edition.results.length);
    avatar({mood:'nervous'});
    const q=chart,cut=q.start+q.cut;
    const options=draft.map((_,i)=>`<option value="${i}">${text(dateLabel(q,cut+i+1))}</option>`).join('');
    screen(`<section class="trends-card">
      <h3 tabindex="-1">${text(q.title)}</h3>
      <p class="trends-detail">${text(q.detail)}</p>
      <p class="trends-unit">${text(q.unit)}</p>
      ${plot(q)}
      <div class="trends-question-controls">
      <output class="trends-coordinate" data-trends-coordinate aria-live="off"></output>
      <p class="trends-caption">Arrastra desde el punto amarillo hasta ${text(dateLabel(q,q.end))}. Agarra la línea para ajustarla.</p>
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
      <p class="trends-caption">${edition.game?'Partida extra de práctica · el premio se gana en la diaria.':'Hasta 35 ≈ al día. Cofre Chispa desde 2.700 puntos, una vez por semana.'}</p>
      </div>
    </section>`);
    bindPlot();
    updateDraft();
  }

  function endOfTrace(){
    const gap=trace.indexOf(null);
    return gap<0?trace.length-1:gap-1;
  }

  function updateCoordinates(index){
    const crosshair=element('.trends-crosshair');
    const output=element('[data-trends-coordinate]');
    const dateTicks=element('.trends-plot').querySelectorAll('.trends-date-tick');
    if(index===undefined){
      crosshair.setAttribute('visibility','hidden');
      for(const tick of dateTicks)tick.removeAttribute('visibility');
      output.textContent='';
      return;
    }
    const value=trace[index];
    const date=chart.start+chart.cut+Math.round(index/samplesPerPeriod);
    const px=x(chart,chart.cut+index/samplesPerPeriod),py=y(chart,value);
    crosshair.setAttribute('visibility','visible');
    crosshair.querySelector('.trends-projection').setAttribute('d',`M${box.left} ${py}H${px}V${box.bottom}`);
    const cursor=crosshair.querySelector('.trends-cursor');
    cursor.setAttribute('cx',px);
    cursor.setAttribute('cy',py);
    const half=box.badge/2;
    const xCenter=clamp(px,half+2,box.width-half-2);
    for(const tick of dateTicks){
      const distance=Math.abs(xCenter-Number(tick.getAttribute('x')));
      tick.setAttribute('visibility',distance<half+20?'hidden':'visible');
    }
    const badges=[
      ['x',dateLabel(chart,date,true),xCenter,box.bottom+18],
      ['y',axisNumber.format(value),Math.max(half+2,box.left-half-6),py],
    ];
    for(const [axis,label,cx,cy] of badges){
      const badge=crosshair.querySelector(`[data-trends-axis="${axis}"]`);
      badge.setAttribute('transform',`translate(${cx} ${cy})`);
      badge.querySelector('text').textContent=label;
    }
    output.textContent=`${dateLabel(chart,date)} · ${fmt(value)} ${chart.unit}`;
  }

  function updateDraft(index){
    element('.trends-drawn').setAttribute('d',tracePath(chart,trace));
    const hasTrace=trace.some((value,i)=>i>0&&value!==null);
    element('.trends-draw-hint').setAttribute('visibility',hasTrace?'hidden':'visible');
    if(!hasTrace)updateCoordinates();
    else if(index>0)updateCoordinates(index);
    const count=draft.filter(value=>value!==null).length;
    const end=endOfTrace(), handle=element('.trends-resume');
    handle.setAttribute('cx',x(chart,chart.cut+end/samplesPerPeriod));
    handle.setAttribute('cy',y(chart,trace[end]));
    handle.setAttribute('visibility',pending||end===trace.length-1?'hidden':'visible');
    const caption=`${count} de ${draft.length} ${times(chart)}`;
    const counter=element('[data-trends-count]');
    if(counter.textContent!==caption)counter.textContent=caption;
    element('[data-trends-reveal]').disabled=pending||count!==draft.length;
    element('[data-trends-clear]').disabled=pending||!hasTrace;
  }

  const quantize=value=>Number(clamp(value,chart.min,chart.max).toFixed(chart.precision));
  function bindPlot(){
    const svg=element('.trends-plot');
    function position(event){
      const transform=svg.getScreenCTM();
      const p=new DOMPoint(event.clientX,event.clientY).matrixTransform(transform.inverse());
      const marker=x(chart,chart.cut), max=trace.length-1;
      const index=Math.round((p.x-marker)*max/(box.right-marker));
      return {x:p.x,y:p.y,scaleX:Math.abs(transform.a),scaleY:Math.abs(transform.d),index:clamp(index,0,max)};
    }
    function draw(point){
      const start=stroke.point;
      const max=trace.length-1;
      const progress=(point.x-stroke.startX)/(stroke.finishX-stroke.startX);
      const index=clamp(Math.round(stroke.origin+progress*(max-stroke.origin)),stroke.origin,max);
      if(index<=stroke.origin)return;
      const value=chart.max-(point.y-stroke.offsetY-box.top)*(chart.max-chart.min)/(box.bottom-box.top);
      point={index,value:quantize(value)};
      const delta=point.index-start.index;
      for(let i=Math.max(stroke.origin+1,Math.min(start.index,point.index));i<=Math.max(start.index,point.index);i++){
        const value=delta?start.value+(point.value-start.value)*(i-start.index)/delta:point.value;
        trace[i]=quantize(value);
        if(i%samplesPerPeriod===0)draft[i/samplesPerPeriod-1]=trace[i];
      }
      stroke.point=point;
    }
    function distanceTo(point,i){
      const dx=(point.x-x(chart,chart.cut+i/samplesPerPeriod))*point.scaleX;
      const dy=(point.y-y(chart,trace[i]))*point.scaleY;
      return Math.hypot(dx,dy);
    }
    function hit(point,type){
      const end=endOfTrace();
      const unfinished=end<trace.length-1;
      const radius=type==='touch'?20:end===0?17:12;
      if(unfinished&&distanceTo(point,end)<=radius)return {origin:end};
      let nearest=0,distance=type==='touch'?25:15;
      for(let i=1;i<trace.length;i++){
        if(trace[i]===null)continue;
        const gap=distanceTo(point,i);
        if(gap<distance){nearest=i;distance=gap}
      }
      return nearest?{anchor:nearest}:null;
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
      if(pending||stroke||!event.isPrimary||event.button!==0)return;
      const point=position(event);
      const target=hit(point,event.pointerType);
      if(!target)return;
      const {anchor,origin}=target;
      stroke=anchor?{id:event.pointerId,edit:grab(anchor,point)}:{
        id:event.pointerId,origin,point:{index:origin,value:trace[origin]},
        startX:point.x,finishX:Math.max(box.right,point.x+1),
        offsetY:point.y-y(chart,trace[origin])
      };
      svg.classList.toggle('is-editing',Boolean(anchor));
      svg.setPointerCapture(event.pointerId);
    });
    function hover(event){
      const target=hit(position(event),event.pointerType);
      svg.classList.toggle('is-editable',Boolean(target?.anchor));
      svg.classList.toggle('is-resumable',target?.origin!==undefined);
    }
    svg.addEventListener('pointermove',event=>{
      if(stroke?.id===event.pointerId)update(event);
      else if(event.pointerType!=='touch')hover(event);
    });
    svg.addEventListener('pointerup',event=>{
      if(stroke?.id!==event.pointerId)return;
      update(event);
      syncEditor();
    });
    svg.addEventListener('lostpointercapture',event=>{
      if(stroke?.id!==event.pointerId)return;
      stroke=null;
      svg.classList.remove('is-editing');
      if(event.pointerType!=='touch')hover(event);
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
      const result=await request('revelar',{date:edition.date,game:edition.game,chart:chart.id,guess:draft});
      if(token!==view)return;
      edition=result;
      const index=result.results.findLastIndex(item=>item.id===chart.id);
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

  function sweep(graph,kind,duration){
    const mask=graph.querySelector(`#trends-clip-${kind} rect`);
    return mask.animate([{transform:'scaleX(0)'},{transform:'scaleX(1)'}],
      {duration,easing:'ease-in-out',fill:'backwards'}).finished.catch(()=>{});
  }

  async function loadPeerTraces(result,animate=false){
    const graph=element('.trends-plot'), details=element('.trends-result');
    const date=edition.date;
    const layer=graph.querySelector('.trends-peer-traces');
    const status=details.querySelector('[data-trends-trace-status]');
    const retry=details.querySelector('[data-trends-retry-traces]');
    const next=details.querySelector('[data-trends-next]');
    retry.hidden=true;
    status.textContent='Cargando los trazos…';
    const motion=animate&&!matchMedia('(prefers-reduced-motion: reduce)').matches;
    labelEnds(graph,result,!motion);
    if(motion){
      const bounds=graph.getBoundingClientRect();
      const header=dialog.querySelector('.trends-header').getBoundingClientRect();
      if(bounds.top<header.bottom||bounds.bottom>dialog.getBoundingClientRect().bottom){
        graph.scrollIntoView({block:'center',behavior:'smooth'});
      }
    }
    if(next&&motion)next.disabled=true;
    const drawn=motion?sweep(graph,'real',1050).then(()=>{
      if(!graph.isConnected)return;
      labelEnds(graph,result,true);
      if(next)next.disabled=false;
    }):Promise.resolve();
    async function collect(){
      const traces=[];
      let nextPage=0,simulated=false;
      do{
        const page=await request('trazos',{date,chart:result.id,after:nextPage});
        if(!layer.isConnected)return null;
        traces.push(...page.traces);
        nextPage=page.next;
        simulated=page.simulated;
      }while(nextPage!==null);
      return {traces,simulated};
    }
    try{
      const [data]=await Promise.all([collect(),drawn]);
      if(!data||!layer.isConnected)return;
      layer.innerHTML=data.traces.map(values=>`<polyline points="${line(result,values)}"/>`).join('');
      status.textContent=data.simulated?`${fmt(data.traces.length)} trazos simulados de ejemplo.`:
        `${fmt(data.traces.length)} ${data.traces.length===1?'trazo de otro jugador':'trazos de otros jugadores'} de hoy.`;
      if(motion)await sweep(graph,'others',950);
      if(layer.isConnected)labelEnds(graph,result,true,data);
    }catch{
      if(!layer.isConnected)return;
      status.textContent='No se pudieron cargar los trazos.';
      retry.hidden=false;
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
    const rows=observations.map((value,i)=>`<tr><th scope="row">${text(dateLabel(q,cut+i+1))}</th><td>${fmt(q.guess[i])}</td><td>${fmt(value)}</td></tr>`).join('');
    progress.textContent=roundLabel(index);
    mood(q.score,animate);
    const result=`<section class="trends-result" data-trends-result="${index}" tabindex="-1" aria-label="Resultado del trazo">
      <p class="trends-caption" data-trends-trace-status role="status"></p>
      <button class="game-secondary" data-trends-retry-traces type="button" hidden>Reintentar la carga de trazos</button>
      <div class="trends-points"><strong>${fmt(q.score)} pts</strong><span>Error medio: ${fmt(q.error)} ${text(changeUnit)}</span></div>
      <details class="trends-source" open><summary>Qué pasó</summary>
        ${q.context?`<p>${text(q.context.story)}${q.context.url?` <a href="${text(q.context.url)}" target="_blank" rel="noopener">Ver fuente del contexto ↗</a>`:''}</p>`:''}
        <p>${facts} ${extreme}</p>
        <p>${text(q.detail)}</p>
        <p><a href="${text(q.source.url)}" target="_blank" rel="noopener">${text(q.source.title)} ↗</a> · <a href="${text(q.source.licenseUrl||'https://creativecommons.org/licenses/by/4.0/')}" target="_blank" rel="noopener">${text(q.source.license)}</a></p>
        <details><summary>Proveedor y datos por ${unitOfTime(q)}</summary>
          <p>${text(q.source.provider)}</p>
          <table class="trends-data"><thead><tr><th scope="col">${timeLabel(q)}</th><th scope="col">Tu trazo</th><th scope="col">Real</th></tr></thead><tbody>${rows}</tbody></table>
        </details>
      </details>
      <div class="trends-actions"><button class="game-primary" type="button" ${review?'data-trends-summary':'data-trends-next'}>${review?'Volver al resultado':edition.current?'Siguiente gráfica →':'Ver resultado →'}</button></div>
    </section>`;
    if(animate){
      element('.trends-plot').outerHTML=plot(q,q,trace);
      element('.trends-question-controls').outerHTML=result;
      element('.trends-result').focus({preventScroll:true});
    }else{
      screen(`<section class="trends-card">
        <h3 tabindex="-1">${text(q.title)}</h3>
        <p class="trends-detail">${text(q.detail)}</p>
        <p class="trends-unit">${text(q.unit)}</p>
        ${plot(q,q)}${result}
      </section>`);
    }
    loadPeerTraces(q,animate);
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
    const offer=edition.plus?`<section class="trends-replay"><h4>Tu próxima curva te espera</h4><p>Plus activo · partidas sin anuncios.</p>
      <button class="game-primary" type="button" data-trends-extra>Jugar otras tres gráficas →</button></section>`:
      `${window.PlusOffers?.render('trends')||''}<section class="trends-replay trends-free"><h4>También puedes seguir gratis</h4>
        <button class="game-secondary" type="button" data-trends-extra>Ver anuncio de prueba y jugar</button><small>15 segundos · otras tres gráficas · sin límite de anuncios</small></section>`;
    const reward=edition.reward;
    const prize=reward?`<section class="trends-prize" aria-label="Tu recompensa diaria"><div><span class="section-kicker">TU PREMIO DE HOY</span>
      <h4 data-trends-prize-value>${fmt(reward.amount)} ≈${reward.chest?' · nivel Chispa':''}</h4></div>
      <p data-trends-prize-status role="status">${window.Progress?.linked?.()?'Guardando tu recompensa…':'Entra con tu cuenta para recogerlo y guardarlo en tu perfil.'}</p>
      <button class="game-secondary" type="button" data-trends-claim ${window.Progress?.linked?.()?'hidden':''}>Entrar y recoger mi premio</button>
      <details><summary>Cómo se gana</summary><p>0–1.799 puntos: 10 ≈ · 1.800–2.399: 15 ≈ · 2.400–2.699: 25 ≈ · 2.700–3.000: 35 ≈ y opción a cofre Chispa.</p>
        <p>El cofre se gana como máximo una vez por semana (de lunes a domingo), en la partida diaria. Los faradios cuentan para el tope común de 400 ≈ al día. Las partidas extra son para practicar, con los mismos premios tengas Plus o no.</p></details></section>`:'';
    screen(`<section class="trends-card">
      <h3 tabindex="-1">${heading}</h3>
      ${extra.length?'<h4>Partida diaria</h4>':''}${score(total)}
      <div class="trends-review">${review(daily,0)}</div>
      ${extra.length?`<h4>Partida extra ${edition.game}</h4>${score(extraTotal)}<div class="trends-review">${review(extra,edition.rounds)}</div>`:''}
      ${prize}${offer}
      <p class="trends-detail">Mañana tendrás tres gráficas nuevas.</p>
      <div class="trends-actions"><button class="game-secondary" data-close-trends type="button">Cerrar partida</button></div>
    </section>`);
    if(reward&&window.Progress?.linked?.())collectPrize();
  }

  async function collectPrize(){
    const status=element('[data-trends-prize-status]'),button=element('[data-trends-claim]');
    if(!status)return;
    const day=edition.date;
    button.hidden=true;
    let result=prizes.get(day);
    if(!result){
      status.textContent='Guardando tu recompensa…';
      result=await window.Progress.collectTrendPrize(day);
      if(result)prizes.set(day,result);
    }
    if(!status.isConnected)return;
    if(!result){status.textContent='Tu resultado está guardado. Reintenta recoger el premio.';button.textContent='Recoger mi premio';button.hidden=false;return}
    element('[data-trends-prize-value]').textContent=`${fmt(result.awarded)} ≈${result.chest?' + cofre Chispa':''}`;
    status.textContent=result.capped?`${result.awarded?`${fmt(result.awarded)} ≈ guardados. `:''}Has alcanzado el tope diario de faradios.${result.chest?' Tu cofre Chispa está en el perfil.':''}`:
      result.repeated?'Tu recompensa de hoy ya está guardada en tu perfil.':`+${fmt(result.amount)} ≈ guardados en tu perfil.${result.chest?' ¡Y un cofre Chispa para abrir!':''}`;
    if(result.weeklyChestClaimed)status.textContent+=' El cofre de precisión de esta semana ya está recogido.';
  }

  async function startExtra(button){
    if(pending)return;
    pending=true;
    button.disabled=true;
    notice();
    const token=view,{date,game}=edition;
    const nextGame=game+1;
    try{
      let next=await request('preparar-extra',{date,game:nextGame});
      if(token!==view)return;
      if(next.watch){
        const complete=await window.Ads.rewarded({kind:'tendencias'});
        if(!complete||token!==view)return;
        next=await request('activar-extra',{date,game:nextGame});
      }
      if(token!==view)return;
      edition=next;
      if(next.current)renderQuestion();
      else summary();
    }catch(error){
      if(token===view){
        if(error.status===409)await load();
        else notice(error.status?error.message:'No se pudo abrir la partida extra. Inténtalo de nuevo.');
      }
    }finally{
      if(token===view){pending=false;button.disabled=false}
    }
  }

  document.addEventListener('faraday:before-plan',()=>{if(dialog.open)dialog.close()});

  async function load(){
    const token=++view;
    pending=false;
    progress.textContent='Tres gráficas al día';
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

  document.addEventListener('faraday:cuenta',()=>prizes.clear());
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
    else if(button.hasAttribute('data-trends-claim')){
      if(window.Progress?.linked?.())collectPrize();
      else{dialog.close();document.getElementById('home-account')?.click()}
    }
    else if(button.hasAttribute('data-trends-retry-traces')){
      loadPeerTraces(edition.results[Number(button.closest('[data-trends-result]').dataset.trendsResult)]);
    }
    else if(button.hasAttribute('data-trends-clear')){
      draft.fill(null);
      trace.fill(null,1);
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

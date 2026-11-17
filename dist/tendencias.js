(()=>{
  const dialog=document.getElementById('trends-dialog');
  const content=document.getElementById('trends-content');
  const progress=document.getElementById('trends-progress');
  const stage=document.getElementById('trends-avatar');
  const alert=document.getElementById('trends-error');
  const home=document.querySelector('.home-trends');
  const box={width:640,height:280,left:80,right:618,top:20,bottom:238};
  const number=new Intl.NumberFormat('es-ES',{maximumFractionDigits:4,useGrouping:'always'});
  const fmt=value=>number.format(value);
  const text=value=>escapeHtml(String(value));
  const clamp=(value,min,max)=>Math.min(max,Math.max(min,value));
  let edition,chart,draft,stroke,opener,view=0,lookKey='',pending=false;
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
    const rest=score>=800?'cheer':score>=500?'meh':'sad';
    if(!animate)return avatar({mood:rest});
    const clip=score>=950?'clavada':score>=800?'salto':score>=500?'casi':'facepalm';
    avatar({clip,mood:'',then:rest});
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

  const x=(q,index)=>box.left+index/(q.end-q.start)*(box.right-box.left);
  const y=(q,value)=>box.bottom-(value-q.min)/(q.max-q.min)*(box.bottom-box.top);
  const points=(q,values,offset=0)=>values.map((value,index)=>`${x(q,index+offset)},${y(q,value)}`).join(' ');
  const line=(q,values)=>points(q,[q.history.at(-1),...values],q.cut);
  function plot(q,result){
    const marker=x(q,q.cut), years=[q.start,q.start+q.cut,q.end];
    const tick=q.tick;
    const first=Math.ceil(q.min/tick-1e-9),last=Math.floor(q.max/tick+1e-9);
    const ticks=Array.from({length:last-first+1},(_,i)=>{
      const value=Number(((first+i)*tick).toFixed(q.precision));
      const at=y(q,value);
      return `<line class="trends-grid" x1="${box.left}" x2="${box.right}" y1="${at}" y2="${at}"/><text x="${box.left-8}" y="${at+5}" text-anchor="end">${fmt(value)}</text>`;
    }).join('');
    const dates=years.map((year,i)=>`<text x="${x(q,year-q.start)}" y="${box.bottom+28}" text-anchor="${['start','middle','end'][i]}">${year}</text>`).join('');
    const community=result?.community?.values;
    return `<svg class="trends-plot${result?'':' is-drawing'}" viewBox="0 0 ${box.width} ${box.height}" role="img" aria-label="${result?'Comparación de las curvas':'Gráfica hasta '+(q.start+q.cut)+'. El tramo sombreado es el que debes completar.'}">
      <rect class="trends-zone" x="${marker}" y="${box.top}" width="${box.right-marker}" height="${box.bottom-box.top}"/>
      ${ticks}<line class="trends-cut" x1="${marker}" x2="${marker}" y1="${box.top}" y2="${box.bottom}"/>${dates}
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
    stroke=null;
    progress.textContent=`Gráfica ${edition.results.length+1} de ${edition.rounds}`;
    avatar({mood:'nervous'});
    const q=chart,cut=q.start+q.cut;
    const options=draft.map((_,i)=>`<option value="${i}">${cut+i+1}</option>`).join('');
    screen(`<section class="trends-card">
      <h3 tabindex="-1">${text(q.title)}</h3>
      <p class="trends-detail">${text(q.detail)}</p>
      <p class="trends-unit">${text(q.unit)}</p>
      ${plot(q)}
      <p class="trends-caption">Arrastra desde el último punto hasta ${q.end}. Puedes repasar cualquier parte del trazo antes de revelar.</p>
      <details class="trends-editor"><summary>Editar valores por año</summary>
        <div class="trends-controls">
          <label>Año<select data-trends-year>${options}</select></label>
          <label>Tu estimación<input data-trends-value type="number" min="${q.min}" max="${q.max}" step="any"></label>
          <button class="game-secondary" type="button" data-trends-set>Guardar punto</button>
        </div>
        <p class="trends-caption">Último dato conocido: ${cut} · ${fmt(q.history.at(-1))} ${text(q.unit)}.</p>
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
    const coordinates=[chart.history.at(-1),...draft];
    const path=coordinates.map((value,i)=>value===null?'':`${i===0||coordinates[i-1]===null?'M':'L'}${x(chart,chart.cut+i)} ${y(chart,value)}`).join(' ');
    element('.trends-drawn').setAttribute('d',path);
    if(index!==undefined){
      const cursor=element('.trends-cursor');
      cursor.setAttribute('cx',x(chart,chart.cut+index+1));
      cursor.setAttribute('cy',y(chart,draft[index]));
      cursor.setAttribute('visibility','visible');
    }
    const count=draft.filter(value=>value!==null).length;
    const caption=`${count} de ${draft.length} años trazados`;
    const counter=element('[data-trends-count]');
    if(counter.textContent!==caption)counter.textContent=caption;
    element('[data-trends-reveal]').disabled=pending||count!==draft.length;
    element('[data-trends-clear]').disabled=pending||!count;
  }

  const quantize=value=>Number(clamp(value,chart.min,chart.max).toFixed(chart.precision));
  function bindPlot(){
    const svg=element('.trends-plot');
    function position(event){
      const bounds=svg.getBoundingClientRect();
      const px=(event.clientX-bounds.left)*box.width/bounds.width;
      const py=(event.clientY-bounds.top)*box.height/bounds.height;
      const index=Math.round((px-box.left)*(chart.end-chart.start)/(box.right-box.left))-chart.cut-1;
      const value=chart.max-(py-box.top)*(chart.max-chart.min)/(box.bottom-box.top);
      return {px,py,index:clamp(index,0,draft.length-1),value:quantize(value)};
    }
    function draw(point){
      const previous=stroke.point;
      if(previous.index===point.index)draft[point.index]=point.value;
      else{
        const first=Math.max(0,Math.min(previous.index,point.index));
        const last=Math.max(previous.index,point.index);
        for(let i=first;i<=last;i++){
          const fraction=(i-previous.index)/(point.index-previous.index);
          draft[i]=quantize(previous.value+(point.value-previous.value)*fraction);
        }
      }
      stroke.point=point;
      updateDraft(point.index);
    }
    svg.addEventListener('pointerdown',event=>{
      if(pending||!event.isPrimary||event.button!==0)return;
      const point=position(event);
      if(point.px<x(chart,chart.cut)-10||point.px>box.right+10||point.py<box.top-10||point.py>box.bottom+10)return;
      const previous=draft[point.index]===null&&draft.every(value=>value===null)
        ?{index:-1,value:chart.history.at(-1)}:point;
      stroke={id:event.pointerId,point:previous};
      svg.setPointerCapture(event.pointerId);
      draw(point);
    });
    svg.addEventListener('pointermove',event=>{if(stroke?.id===event.pointerId)draw(position(event))});
    svg.addEventListener('pointerup',event=>{
      if(stroke?.id!==event.pointerId)return;
      draw(position(event));
      stroke=null;
      syncEditor();
    });
    svg.addEventListener('lostpointercapture',()=>{stroke=null});
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
    updateDraft(index);
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
      `En el tramo oculto, el mínimo fue ${fmt(low)} en ${cut+observations.indexOf(low)+1} y el máximo fue ${fmt(high)} en ${cut+observations.indexOf(high)+1}.`;
    const changeUnit=q.unit.startsWith('%')?'puntos porcentuales':q.unit;
    const facts=from===last?`Acabó en el mismo nivel que en ${cut} (${fmt(from)}).`:
      `De ${fmt(from)} en ${cut} a ${fmt(last)} en ${q.end}, un cambio de ${fmt(Math.abs(last-from))} ${text(changeUnit)}.`;
    const rows=observations.map((value,i)=>`<tr><th scope="row">${cut+i+1}</th><td>${fmt(q.guess[i])}</td><td>${fmt(value)}</td>${q.community.values?`<td>${fmt(q.community.values[i])}</td>`:''}</tr>`).join('');
    const count=q.community.count;
    const community=q.community.values?`Media de ${count} trazos de otros jugadores de hoy.`:
      'La curva de la comunidad aparecerá cuando haya al menos tres trazos de otros jugadores.';
    progress.textContent=`Gráfica ${index+1} de ${edition.rounds}`;
    mood(q.score,animate);
    screen(`<section class="trends-card">
      <h3 tabindex="-1">${text(q.title)}</h3>
      <p class="trends-unit">${text(q.unit)}</p>
      ${plot(q,q)}
      <div class="trends-legend"><span>Datos reales</span><span class="trends-key-guess">Tu trazo</span>${q.community.values?'<span class="trends-key-community">Comunidad</span>':''}</div>
      <p class="trends-caption">${community}</p>
      <div class="trends-points"><strong>${fmt(q.score)} pts</strong><span>Error medio: ${fmt(q.error)} ${text(changeUnit)}</span></div>
      <details class="trends-source" open><summary>Qué pasó</summary>
        <p>${facts} ${extreme}</p><p>${text(q.detail)}</p>
        <p><a href="${text(q.source.url)}" target="_blank" rel="noopener">${text(q.source.title)} ↗</a> · <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener">${text(q.source.license)}</a></p>
        <details><summary>Proveedor y datos por año</summary>
          <p>${text(q.source.provider)}</p>
          <table class="trends-data"><thead><tr><th scope="col">Año</th><th scope="col">Tu trazo</th><th scope="col">Real</th>${q.community.values?'<th scope="col">Comunidad</th>':''}</tr></thead><tbody>${rows}</tbody></table>
        </details>
      </details>
      <div class="trends-actions"><button class="game-primary" type="button" ${review?'data-trends-summary':'data-trends-next'}>${review?'Volver al resultado':edition.current?'Siguiente gráfica →':'Ver resultado →'}</button></div>
    </section>`);
  }

  function summary(){
    const total=edition.results.reduce((sum,result)=>sum+result.score,0);
    progress.textContent='Partida de hoy completada';
    mood(total/edition.rounds,false);
    const review=edition.results.map((result,i)=>`<button class="game-secondary" type="button" data-trends-review="${i}"><span>${text(result.title)}</span><b>${fmt(result.score)} pts</b></button>`).join('');
    screen(`<section class="trends-card">
      <h3 tabindex="-1">Tu resultado de hoy</h3>
      <div class="trends-points"><strong>${fmt(total)} pts</strong><span>de ${fmt(1000*edition.rounds)}</span></div>
      <p class="trends-detail">Mañana tendrás tres gráficas nuevas.</p>
      <div class="trends-review">${review}</div>
      <div class="trends-actions"><button class="game-primary" data-close-trends type="button">Cerrar partida</button></div>
    </section>`);
  }

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
    else if(button.hasAttribute('data-trends-clear')){
      draft.fill(null);
      element('.trends-cursor').setAttribute('visibility','hidden');
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

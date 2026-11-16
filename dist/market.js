// Mercado de artículos de colección (decisiones 0073 y 0074): una pantalla propia para explorar, comprar, pujar y vender.
// Todo lo decide el servidor (lib/mercado.mjs): aquí se pinta el tablón que devuelve la acción «mercado» de
// /api/progreso y se le piden las operaciones a través de progress.js (Progress.cloud y Progress.ask).
//   Explorar: los artículos con sus indicadores y todos los anuncios, con buscador, filtro y orden.
//   Ficha de un artículo: indicadores, gráfica de ventas, anuncios, últimas ventas y el formulario para vender.
//   Mis anuncios, Mis pujas y Actividad.
(()=>{
  const shell=document.getElementById('market-shell'),main=document.getElementById('market-main'),pill=document.getElementById('market-coins');
  if(!shell||!main)return;
  const int=n=>new Intl.NumberFormat('es-ES',{maximumFractionDigits:0,useGrouping:'always'}).format(Number(n)||0),COIN='<span class="coin" aria-hidden="true">≈</span>',coins=n=>`${int(n)} ${COIN}<span class="sr-only"> faradios</span>`;
  const toast=message=>{if(typeof showToast==='function')showToast(message)};
  // view = pestaña; item = la edición abierta en su ficha; board = el tablón; skew = diferencia con el reloj del servidor;
  // inbox = avisos sin cerrar; form = lo escrito para vender; dialog = la puja o la compra que se está confirmando.
  let view='explorar',item='',board=null,failed=false,skew=0,inbox=[],filter={q:'',kind:'todo',sort:'precio'},form={unit:'',buyNow:'',startBid:'',hours:24},dialog=null,busy=false,ticker=0,refresher=0;
  const now=()=>Date.now()+skew,linked=()=>!!window.Progress?.linked();
  const body=()=>window.Progress?.look().body||'hombre';
  const piece=id=>Avatar.CATALOG.find(entry=>entry.edition&&entry.edition.id===id&&entry.for===body())||Avatar.CATALOG.find(entry=>entry.edition&&entry.edition.id===id);
  const nameOf=id=>piece(id)?.name||'Edición',statOf=id=>board.stats.editions.find(one=>one.id===id);
  const art=(id,zoom='torso')=>{const entry=piece(id);return entry?Avatar.render(Avatar.preview(entry,body()),{zoom}):''};
  const feeOf=price=>Math.min(price,Math.ceil(price*board.rules.fee/100));
  // Cuánto falta para una fecha y cuánto hace de otra, en palabras.
  function left(ends){
    const ms=ends-now();if(ms<=0)return 'Terminada';
    const s=Math.floor(ms/1000),d=Math.floor(s/86400),h=Math.floor(s%86400/3600),m=Math.floor(s%3600/60);
    return d?`${d} d ${h} h`:h?`${h} h ${m} min`:m?`${m} min ${s%60} s`:`${s} s`;
  }
  function ago(at){
    const m=Math.max(0,Math.floor((now()-at)/60000));
    return m<1?'ahora mismo':m<60?`hace ${m} min`:m<1440?`hace ${Math.floor(m/60)} h`:`hace ${Math.floor(m/1440)} d`;
  }
  const dateOf=at=>new Intl.DateTimeFormat('es-ES',{day:'numeric',month:'short',timeZone:'Europe/Madrid'}).format(new Date(at));
  const change=value=>value==null?'':`<span class="mk-change ${value>0?'up':value<0?'down':''}">${value>0?'▲':value<0?'▼':'='} ${Math.abs(value).toLocaleString('es-ES')} %</span>`;
  // Precio por el que se ordena un anuncio: el de compra ya o, si solo es subasta, la puja que hay que hacer.
  const ask=listing=>listing.buyNow??listing.minBid;

  // Gráfica de ventas: línea con área, mínimo y máximo en el eje y la primera y la última fecha.
  function chart(history){
    if(!history.length)return '<p class="mk-empty">Todavía no se ha vendido ninguna. La primera venta estrenará la gráfica.</p>';
    const prices=history.map(point=>point.price),low=Math.min(...prices),high=Math.max(...prices),span=high-low||1,W=600,H=180,pad=8;
    const x=i=>history.length===1?W/2:pad+i*(W-2*pad)/(history.length-1),y=value=>H-pad-(value-low)/span*(H-2*pad)*(high===low?0:1)-(high===low?(H-2*pad)/2:0);
    const points=history.map((point,i)=>`${x(i).toFixed(1)},${y(point.price).toFixed(1)}`);
    return `<figure class="mk-chart"><div class="mk-chart-y"><span>${int(high)} ≈</span><span>${int(low)} ≈</span></div>
<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Precio de las últimas ${history.length} ventas: de ${int(low)} a ${int(high)} faradios">
<path class="mk-chart-area" d="M${points[0]} L${points.join(' L')} L${x(history.length-1).toFixed(1)},${H} L${x(0).toFixed(1)},${H} Z"/><polyline class="mk-chart-line" points="${points.join(' ')}"/>
${history.map((point,i)=>`<circle cx="${x(i).toFixed(1)}" cy="${y(point.price).toFixed(1)}" r="3.5"><title>${int(point.price)} ≈ · ${dateOf(point.at)}</title></circle>`).join('')}</svg>
<figcaption><span>${dateOf(history[0].at)}</span><span>Últimas ${history.length} ${history.length===1?'venta':'ventas'}</span><span>${dateOf(history.at(-1).at)}</span></figcaption></figure>`;
  }
  function spark(history){
    if(history.length<2)return '';
    const prices=history.map(point=>point.price),low=Math.min(...prices),span=Math.max(...prices)-low||1,step=100/(prices.length-1);
    return `<svg class="mk-spark" viewBox="-2 -2 104 34" preserveAspectRatio="none" aria-hidden="true"><polyline points="${prices.map((value,i)=>`${(i*step).toFixed(1)},${(30-(value-low)/span*30).toFixed(1)}`).join(' ')}"/></svg>`;
  }
  const kpi=(label,value,note='')=>`<div class="mk-kpi"><small>${label}</small><b>${value}</b>${note?`<span>${note}</span>`:''}</div>`;

  // Una fila de anuncio: número de serie, puja, compra ya, tiempo y lo que se puede hacer con él.
  function row(listing,{named=true}={}){
    const stat=statOf(listing.edition),auction=listing.startBid!=null;
    const state=listing.mine?'<span class="mk-chip">Tu anuncio</span>':listing.winning?'<span class="mk-chip win">Vas ganando</span>':'';
    const actions=listing.mine?(listing.bids?'<small class="mk-muted">Con pujas no se retira</small>':`<button type="button" class="game-secondary" data-unlist="${listing.id}">Retirar</button>`)
      :`${auction&&!listing.winning?`<button type="button" class="game-secondary" data-bid="${listing.id}">Pujar</button>`:''}${listing.buyNow!=null?`<button type="button" class="game-primary" data-buy="${listing.id}">Comprar ya</button>`:''}`;
    return `<li class="mk-row"><button type="button" class="mk-row-item" data-item="${listing.edition}"><span class="mk-thumb">${art(listing.edition)}</span><span><b>${named?nameOf(listing.edition):'N.º '+listing.serial}</b><small>${named?`N.º ${listing.serial} de ${int(stat?.total||0)}`:`de ${int(stat?.total||0)}`}</small></span></button>
<div class="mk-cell"><small>${auction?(listing.topBid?`Puja actual · ${listing.bids} ${listing.bids===1?'puja':'pujas'}`:'Puja de salida'):'Puja'}</small><b>${auction?coins(listing.topBid||listing.startBid):'—'}</b></div>
<div class="mk-cell"><small>Compra ya</small><b>${listing.buyNow!=null?coins(listing.buyNow):'—'}</b></div>
<div class="mk-cell"><small>Termina en</small><b${auction?` data-ends="${listing.endsAt}"`:''}>${auction?left(listing.endsAt):'Sin límite'}</b></div>
<div class="mk-actions">${state}${actions}</div></li>`;
  }
  const rows=(list,options)=>list.length?`<ul class="mk-rows">${list.map(listing=>row(listing,options)).join('')}</ul>`:'';
  function sorted(list){
    const by={precio:(a,b)=>ask(a)-ask(b),caro:(a,b)=>ask(b)-ask(a),tiempo:(a,b)=>(a.endsAt??Infinity)-(b.endsAt??Infinity),pujas:(a,b)=>b.bids-a.bids,nuevo:(a,b)=>b.id-a.id}[filter.sort]||(()=>0);
    return [...list].sort((a,b)=>by(a,b)||a.id-b.id);
  }
  const plain=text=>String(text).normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();
  const visible=()=>sorted(board.listings.filter(listing=>(filter.kind==='todo'||(filter.kind==='compra'?listing.buyNow!=null:listing.startBid!=null))&&plain(`${nameOf(listing.edition)} ${listing.serial}`).includes(plain(filter.q.trim()))));

  // ---------- Pestañas
  function results(){
    const words=plain(filter.q.trim()),items=board.stats.editions.filter(one=>plain(nameOf(one.id)).includes(words)),list=visible();
    const card=one=>`<button type="button" class="mk-card" data-item="${one.id}"><span class="mk-card-art">${art(one.id)}<span class="mk-tag">Comerciable</span></span><span class="mk-card-body"><b>${nameOf(one.id)}</b><small>Edición n.º ${one.n} · ${int(one.total)} unidades</small>
<span class="mk-card-price">${one.floor!=null?`<small>Desde</small> ${coins(one.floor)}`:one.topBid!=null?`<small>Puja</small> ${coins(one.topBid)}`:'<small>Sin anuncios</small>'}</span>
<span class="mk-card-meta">${one.onSale} en venta${one.auctions?` · ${one.auctions} ${one.auctions===1?'subasta':'subastas'}`:''}</span>
<span class="mk-card-last">${one.last!=null?`Última venta ${int(one.last)} ≈ ${change(one.change)}`:'Sin ventas todavía'}</span>${spark(one.history)}</span></button>`;
    return `<h3 class="mk-title">Artículos <small>${items.length}</small></h3>
${items.length?`<div class="mk-grid">${items.map(card).join('')}</div>`:'<p class="mk-empty">Ningún artículo con ese nombre.</p>'}
<h3 class="mk-title">Anuncios <small>${list.length}</small></h3>
${rows(list)||`<p class="mk-empty">${board.listings.length?'Ningún anuncio con ese filtro.':'Ahora mismo nadie vende nada. Si tienes una edición de colección, puedes ser el primero.'}</p>`}`;
  }
  function explore(){
    return `<p class="mk-note"><b>¿Qué se puede comerciar?</b> Solo los artículos de colección: ediciones numeradas de tirada cerrada, que en el armario llevan la etiqueta «Comerciable». La ropa normal de la tienda y de los cofres no se vende entre jugadores.</p>
<div class="mk-tools"><label class="mk-search"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10.5 4a6.5 6.5 0 1 0 0 13 6.5 6.5 0 1 0 0-13zM15.5 15.5 20 20"/></svg><input type="search" data-q value="${filter.q.replace(/&/g,'&amp;').replace(/"/g,'&quot;')}" placeholder="Buscar artículo o número de serie" aria-label="Buscar en el mercado" autocomplete="off"></label>
<div class="mk-seg" role="group" aria-label="Tipo de anuncio">${[['todo','Todo'],['compra','Compra ya'],['subasta','Subastas']].map(([id,label])=>`<button type="button" aria-pressed="${filter.kind===id}" data-kind="${id}">${label}</button>`).join('')}</div>
<select data-sort aria-label="Ordenar anuncios">${[['precio','Más baratos'],['caro','Más caros'],['tiempo','Terminan antes'],['pujas','Con más pujas'],['nuevo','Más recientes']].map(([id,label])=>`<option value="${id}"${filter.sort===id?' selected':''}>${label}</option>`).join('')}</select></div>
<div id="mk-results">${results()}</div>`;
  }
  // El formulario para vender una unidad de esta edición, o por qué no se puede.
  function sellPanel(edition){
    const rules=board.rules,mine=board.units.filter(unit=>unit.edition===edition),free=mine.filter(unit=>!unit.listing),active=board.units.filter(unit=>unit.listing).length;
    if(!mine.length)return `<section class="mk-panel"><h3 class="mk-title">Vender</h3><p class="mk-muted">No tienes ninguna unidad de este artículo. Cuando tengas una, podrás venderla aquí.</p></section>`;
    const gate=!board.verified?'Para vender hace falta una cuenta con el correo comprobado.':board.level<rules.level?`Se puede vender desde el nivel ${rules.level}. Tienes el ${board.level}.`:!free.length?'Todas tus unidades de este artículo ya están anunciadas.':rules.max!=null&&active>=rules.max?`Ya tienes ${rules.max} anuncios activos: retira uno para poner otro.`:'';
    if(gate)return `<section class="mk-panel"><h3 class="mk-title">Vender <small>${mine.length} ${mine.length===1?'unidad tuya':'unidades tuyas'}</small></h3><p class="mk-muted">${gate}</p></section>`;
    if(!free.some(unit=>edition+':'+unit.serial===form.unit))form.unit=edition+':'+free[0].serial;
    const buyNow=Number(form.buyNow),startBid=Number(form.startBid),okBuy=form.buyNow!==''&&Number.isInteger(buyNow)&&buyNow>=1&&buyNow<=rules.maxPrice,okBid=form.startBid!==''&&Number.isInteger(startBid)&&startBid>=1&&startBid<=rules.maxPrice;
    const summary=[okBuy?`Con compra ya recibes ${int(buyNow-feeOf(buyNow))} ≈.`:'',okBid?`En subasta, como mínimo ${int(startBid-feeOf(startBid))} ≈.`:''].filter(Boolean).join(' ')||'Pon un precio de compra ya, una puja de salida o las dos cosas.';
    return `<section class="mk-panel mk-sell"><h3 class="mk-title">Vender <small>${rules.max!=null?`${active} de ${rules.max} anuncios activos`:`${active} anuncios activos · sin tope`}</small></h3>
<div class="mk-form"><label><span>Unidad</span><select data-f="unit">${free.map(unit=>`<option value="${edition}:${unit.serial}"${form.unit===edition+':'+unit.serial?' selected':''}>N.º ${unit.serial}</option>`).join('')}</select></label>
<label><span>Compra ya (≈)</span><input type="number" inputmode="numeric" min="1" max="${rules.maxPrice}" step="1" placeholder="Opcional" value="${form.buyNow}" data-f="buyNow"></label>
<label><span>Puja de salida (≈)</span><input type="number" inputmode="numeric" min="1" max="${rules.maxPrice}" step="1" placeholder="Opcional" value="${form.startBid}" data-f="startBid"></label>
<label><span>Duración de la subasta</span><select data-f="hours">${rules.hours.map(hours=>`<option value="${hours}"${Number(form.hours)===hours?' selected':''}>${hours<24?hours+' h':hours/24+(hours===24?' día':' días')}</option>`).join('')}</select></label></div>
<p class="mk-muted" data-summary>${summary}</p><p class="mk-muted">Comisión del ${rules.fee} %, que se destruye. Mientras está anunciada no puedes llevarla puesta; con pujas ya no se puede retirar.</p>
<button type="button" class="game-primary" data-sell>Poner a la venta</button></section>`;
  }
  function itemPage(){
    const one=statOf(item);if(!one){item='';return explore()}
    const offers=[...board.listings.filter(listing=>listing.edition===item)].sort((a,b)=>ask(a)-ask(b)||a.id-b.id),sold=board.sales.filter(sale=>sale.edition===item);
    return `<button type="button" class="mk-back" data-back>← Todos los artículos</button>
<section class="mk-item"><div class="mk-item-art">${art(item,'stage')}</div>
<div class="mk-item-info"><p class="mk-tags"><span class="mk-tag">Comerciable</span><span class="mk-chip">Edición n.º ${one.n}</span></p><h3>${nameOf(item)}</h3>
<p class="mk-muted">Artículo de colección: ${int(one.total)} unidades numeradas y no habrá más. ${int(one.minted)} emitidas, en manos de ${int(one.owners)} ${one.owners===1?'jugador':'jugadores'}.</p>
<div class="mk-kpis">${kpi('Precio más bajo',one.floor!=null?coins(one.floor):'—','compra ya')}${kpi('Puja más alta',one.topBid!=null?coins(one.topBid):'—',`${one.auctions} ${one.auctions===1?'subasta':'subastas'}`)}${kpi('Última venta',one.last!=null?coins(one.last):'—',change(one.change))}
${kpi('Precio medio',one.avg7!=null?coins(one.avg7):'—','7 días')}${kpi('Ventas',int(one.sales7),`7 días · ${int(one.volume7)} ≈`)}${kpi('En venta',int(one.onSale),`de ${int(one.minted)} emitidas`)}
${kpi('Máximo',one.high!=null?coins(one.high):'—','histórico')}${kpi('Mínimo',one.low!=null?coins(one.low):'—','histórico')}${kpi('Dueños',int(one.owners),`${int(one.total-one.minted)} sin emitir`)}</div></div></section>
<section class="mk-panel"><h3 class="mk-title">Historial de precios</h3>${chart(one.history)}</section>
<section class="mk-panel"><h3 class="mk-title">En venta <small>${offers.length}</small></h3>${rows(offers,{named:false})||'<p class="mk-empty">Nadie la vende ahora.</p>'}</section>
${sellPanel(item)}
<section class="mk-panel"><h3 class="mk-title">Últimas ventas <small>${sold.length}</small></h3>${sold.length?`<table class="mk-table"><thead><tr><th scope="col">N.º</th><th scope="col">Precio</th><th scope="col">Cómo</th><th scope="col">Cuándo</th></tr></thead><tbody>${sold.map(sale=>`<tr><td>${sale.serial}</td><td>${coins(sale.price)}</td><td>${sale.by==='puja'?'Subasta':'Compra ya'}</td><td>${ago(sale.at)}</td></tr>`).join('')}</tbody></table>`:'<p class="mk-empty">Todavía no hay ventas.</p>'}</section>`;
  }
  function mine(){
    const active=board.mine.filter(one=>one.status==='activo'),closed=board.mine.filter(one=>one.status!=='activo'),free=board.units.filter(unit=>!unit.listing);
    const past=one=>`<li class="mk-line"><span><b>${nameOf(one.edition)}</b> <small>n.º ${one.serial}</small></span><span>${one.status==='vendido'?`Vendida por ${coins(one.soldPrice)} · recibiste ${int(one.soldPrice-one.fee)} ≈ <small>(${one.soldBy==='puja'?'subasta':'compra ya'})</small>`:one.status==='caducado'?'Caducó sin pujas':'Retirada'}</span><small>${one.closedAt?ago(one.closedAt):''}</small></li>`;
    return `<h3 class="mk-title">Anuncios activos <small>${board.rules.max!=null?`${active.length} de ${board.rules.max}`:`${active.length} · sin tope`}</small></h3>
${rows(active)||'<p class="mk-empty">No tienes nada anunciado.</p>'}
<h3 class="mk-title">Tus artículos comerciables <small>${free.length}</small></h3>
${free.length?`<ul class="mk-lines">${free.map(unit=>`<li class="mk-line"><span><b>${nameOf(unit.edition)}</b> <small>n.º ${unit.serial}</small></span><button type="button" class="game-secondary" data-item="${unit.edition}" data-unit="${unit.edition}:${unit.serial}">Vender</button></li>`).join('')}</ul>`:'<p class="mk-empty">No tienes artículos de colección sin anunciar. Las ediciones nuevas se compran en el armario cuando salen, o aquí a otros jugadores.</p>'}
<h3 class="mk-title">Historial <small>${closed.length}</small></h3>
${closed.length?`<ul class="mk-lines">${closed.map(past).join('')}</ul>`:'<p class="mk-empty">Aquí verás lo que vendas, retires o caduque.</p>'}`;
  }
  function bids(){
    const line=one=>`<li class="mk-row"><button type="button" class="mk-row-item" data-item="${one.edition}"><span class="mk-thumb">${art(one.edition)}</span><span><b>${nameOf(one.edition)}</b><small>N.º ${one.serial}</small></span></button>
<div class="mk-cell"><small>Tu puja</small><b>${coins(one.amount)}</b></div><div class="mk-cell"><small>Puja actual</small><b>${coins(one.topBid)}</b></div><div class="mk-cell"><small>Termina en</small><b data-ends="${one.endsAt}">${left(one.endsAt)}</b></div>
<div class="mk-actions">${one.winning?'<span class="mk-chip win">Vas ganando</span>':`<span class="mk-chip lose">Te han superado</span><button type="button" class="game-secondary" data-bid="${one.id}">Pujar más</button>`}</div></li>`;
    return `<h3 class="mk-title">Tus pujas <small>${board.bids.length}</small></h3>
${board.bids.length?`<ul class="mk-rows">${board.bids.map(line).join('')}</ul>`:'<p class="mk-empty">No tienes pujas en marcha. En las subastas, tus faradios quedan retenidos mientras vas ganando; si te superan, vuelven a tu saldo.</p>'}`;
  }
  function activity(){
    return `<h3 class="mk-title">Últimas ventas del mercado <small>${board.sales.length}</small></h3>
${board.sales.length?`<ul class="mk-lines">${board.sales.map(sale=>`<li class="mk-line"><button type="button" class="mk-link" data-item="${sale.edition}"><b>${nameOf(sale.edition)}</b> <small>n.º ${sale.serial}</small></button><span>${coins(sale.price)} <small>${sale.by==='puja'?'Subasta':'Compra ya'}</small></span><small>${ago(sale.at)}</small></li>`).join('')}</ul>`:'<p class="mk-empty">Todavía no se ha vendido nada.</p>'}`;
  }
  // Confirmar una puja o una compra: lo que cuesta, lo que queda de saldo y qué pasa después.
  function dialogBox(){
    if(!dialog)return '';
    const listing=board.listings.find(one=>one.id===dialog.id);if(!listing){dialog=null;return ''}
    const have=window.Progress.coins()+(dialog.type==='buy'&&listing.winning?listing.topBid:0),title=`${nameOf(listing.edition)} · n.º ${listing.serial}`;
    if(dialog.type==='buy'){const short=listing.buyNow-have;
      return `<div class="mk-dialog" role="dialog" aria-modal="true" aria-label="Comprar ya"><div class="mk-dialog-box"><h3>Comprar ya</h3><p class="mk-muted">${title}</p>
<p class="mk-dialog-price">${coins(listing.buyNow)}</p><p class="mk-muted">${short>0?`Te faltan ${int(short)} ≈.`:`Te quedarán ${int(have-listing.buyNow)} ≈.`} La compra es inmediata y no se puede deshacer.</p>
<div class="mk-dialog-actions"><button type="button" class="game-secondary" data-close>Cancelar</button><button type="button" class="game-primary" data-confirm${short>0||busy?' disabled':''}>Comprar por ${int(listing.buyNow)} ≈</button></div></div></div>`}
    const amount=Number(dialog.amount),valid=Number.isInteger(amount)&&amount>=listing.minBid,short=amount-have,buys=listing.buyNow!=null&&amount>=listing.buyNow;
    return `<div class="mk-dialog" role="dialog" aria-modal="true" aria-label="Pujar"><div class="mk-dialog-box"><h3>Pujar</h3><p class="mk-muted">${title} · termina en <b data-ends="${listing.endsAt}">${left(listing.endsAt)}</b></p>
<p class="mk-muted">${listing.topBid?`Puja actual: ${int(listing.topBid)} ≈ (${listing.bids} ${listing.bids===1?'puja':'pujas'}).`:'Todavía no hay pujas.'} Mínimo: <b>${int(listing.minBid)} ≈</b>.</p>
<label class="mk-dialog-input"><span class="sr-only">Tu puja en faradios</span><input type="number" inputmode="numeric" min="${listing.minBid}" step="1" value="${dialog.amount}" data-amount></label>
<div class="mk-quick">${[['Mínimo',listing.minBid],['+5 %',Math.ceil(listing.minBid*1.05)],['+10 %',Math.ceil(listing.minBid*1.1)]].map(([label,value])=>`<button type="button" data-quick="${value}">${label}</button>`).join('')}</div>
<p class="mk-muted" data-bidnote>${!valid?`La puja mínima es de ${int(listing.minBid)} ≈.`:short>0?`Te faltan ${int(short)} ≈.`:buys?`Llega al precio de compra ya: la compras al momento por ${int(listing.buyNow)} ≈.`:`Se retienen ${int(amount)} ≈ de tu saldo. Si alguien puja más, se te devuelven.`}</p>
<div class="mk-dialog-actions"><button type="button" class="game-secondary" data-close>Cancelar</button><button type="button" class="game-primary" data-confirm${!valid||short>0||busy?' disabled':''}>Pujar</button></div></div></div>`;
  }
  function notices(){
    if(!inbox.length)return '';
    return `<ul class="mk-inbox" aria-label="Novedades">${inbox.map(text=>`<li>${text}</li>`).join('')}<li><button type="button" class="mk-link" data-clear>Entendido</button></li></ul>`;
  }
  function draw(){
    if(pill)pill.innerHTML=coins(window.Progress?.coins()||0);
    const head='<div class="mk-top"><h2 id="market-title">Mercado</h2><p>Compra, vende y puja por artículos de colección con otros jugadores.</p></div>';
    if(!linked()){main.innerHTML=`${head}<section class="mk-panel mk-gate"><h3>Entra para usar el mercado</h3><p class="mk-muted">En el mercado se compran, se venden y se subastan los artículos de colección: ediciones numeradas de tirada cerrada. Hace falta una cuenta para que el servidor guarde tus faradios y tus artículos.</p><button type="button" class="game-primary" data-auth-open>Entrar</button></section>`;return}
    if(!board){main.innerHTML=`${head}<p class="mk-empty">${failed?'El mercado no está disponible ahora mismo. Inténtalo dentro de un rato.':'Cargando el mercado…'}</p>`;return}
    const g=board.stats.global,tabs=[['explorar','Explorar',0],['mios','Mis anuncios',board.mine.filter(one=>one.status==='activo').length],['pujas','Mis pujas',board.bids.length],['intercambios','Intercambios',(swaps?.trades||[]).filter(one=>one.status==='abierto').length],['actividad','Actividad',0]];
    main.innerHTML=`${head}${notices()}
<div class="mk-kpis mk-global">${kpi('Anuncios activos',int(g.listings),`${g.auctions} ${g.auctions===1?'subasta':'subastas'}`)}${kpi('Ventas',int(g.sales24),'últimas 24 h')}${kpi('Volumen',coins(g.volume7),`7 días · ${int(g.sales7)} ventas`)}${kpi('Comisión destruida',coins(g.burned7),`7 días · ${board.rules.fee} % de cada venta`)}</div>
<nav class="mk-tabs" role="tablist" aria-label="Secciones del mercado">${tabs.map(([id,label,count])=>`<button type="button" role="tab" aria-selected="${view===id&&!item}" data-view="${id}">${label}${count?`<i>${count}</i>`:''}</button>`).join('')}</nav>
<div class="mk-view">${item?itemPage():view==='mios'?mine():view==='pujas'?bids():view==='actividad'?activity():view==='intercambios'?swapsTab():explore()}</div>${dialogBox()}`;
  }

  // ---------- Intercambios privados (decisión 0075): dos jugadores se pasan artículos de colección, sin faradios.
  // swaps = la lista del jugador ({trades, units, rules}); room = el intercambio abierto; poll = el sondeo de la sala.
  let swaps=null,room=null,roomUnits=[],joinCode='',poll=0;
  const identity=()=>{let name='';try{name=JSON.parse(localStorage.getItem('casi-casi:duelo:perfil'))?.name||''}catch{}return {name:name||'Jugador',avatar:window.Progress.look()}};
  const unitKey=unit=>unit.edition+':'+unit.serial,unitName=unit=>`${nameOf(unit.edition)} <small>n.º ${unit.serial}</small>`;
  const STATUS={abierto:'Abierto',hecho:'Hecho',cancelado:'Cancelado',caducado:'Caducado'};
  async function loadSwaps(){
    if(!linked())return;
    try{swaps=await window.Progress.cloud('intercambios');if(room){const fresh=swaps.trades.find(one=>one.id===room.id);if(fresh)room=fresh;roomUnits=swaps.units}if(!shell.hidden&&view==='intercambios'&&!main.contains(document.activeElement?.matches?.('input')?document.activeElement:null))draw()}catch{}
  }
  // Pide algo de un intercambio. Devuelve la respuesta, o null si falla (y avisa con el texto que toque).
  async function swap(action,extra,conflict){
    if(busy)return null;busy=true;
    try{const data=await window.Progress.cloud(action,extra);if(data.trade){const was=room?.status;room=data.trade;if(data.units)roomUnits=data.units;if(room.status==='hecho'&&was!=='hecho')done()}return data}
    catch(error){toast(error.status===409?conflict:error.status===400?'Ese código no es válido: son 6 letras y números.':'No se pudo hacer. Inténtalo otra vez.');return null}
    finally{busy=false;draw()}
  }
  function done(){window.Progress.syncItems();toast('¡Intercambio hecho! Los artículos ya están en vuestros armarios.');load()}
  // Mientras la sala está abierta se mira cada pocos segundos si el otro ha entrado, ha cambiado su oferta o ha confirmado.
  function watch(){
    clearInterval(poll);
    poll=setInterval(async()=>{
      if(shell.hidden||view!=='intercambios'||!room||room.status!=='abierto'||busy)return;
      try{const data=await window.Progress.cloud('intercambio',{id:room.id}),was=JSON.stringify(room);
        if(!room||data.trade.id!==room.id)return;
        room=data.trade;roomUnits=data.units;if(JSON.stringify(room)!==was){if(room.status==='hecho')done();draw()}}catch{}
    },2500);
  }
  const face=(avatar,name)=>`<span class="mk-face">${Avatar.render(avatar||{},{bust:true})}</span><b>${name||'Jugador'}</b>`;
  function swapRoom(){
    const me=room.me,other=room.other,openNow=room.status==='abierto',link=`${location.origin}/?intercambio=${room.code}`;
    const offered=list=>list.length?`<ul class="mk-lines">${list.map(unit=>`<li class="mk-line"><span class="mk-thumb">${art(unit.edition)}</span><span>${unitName(unit)}</span></li>`).join('')}</ul>`:'<p class="mk-empty">Nada todavía.</p>';
    const mine=roomUnits.length?`<div class="mk-picks">${roomUnits.map(unit=>{const on=me.offer.some(one=>unitKey(one)===unitKey(unit));return `<button type="button" aria-pressed="${on}" data-trade-unit="${unitKey(unit)}"><span class="mk-thumb">${art(unit.edition)}</span><span>${unitName(unit)}</span><i>${on?'Quitar':'Ofrecer'}</i></button>`}).join('')}</div>`:'<p class="mk-muted">No tienes artículos de colección para ofrecer. Puedes recibir sin dar nada a cambio.</p>';
    const empty=!me.offer.length&&!(other?.offer.length);
    const state=!openNow?(room.status==='hecho'?'¡Intercambio hecho! Cada uno tiene ya lo del otro en su armario.':room.status==='cancelado'?'Este intercambio se canceló.':'Este intercambio caducó: nadie lo tocó en media hora.')
      :!other?'Esperando a que entre la otra persona.':empty?'Poned al menos un artículo.':me.ok&&other.ok?'Haciendo el cambio…':me.ok?`Has confirmado. Falta ${other.name}.`:other.ok?`${other.name} ha confirmado. Revisa lo que recibes y confirma.`:'Cuando estéis de acuerdo, confirmad los dos.';
    return `<button type="button" class="mk-back" data-trade-leave>← Todos los intercambios</button>
${openNow&&!other?`<section class="mk-panel mk-code"><p class="mk-muted">Pásale este código a la otra persona, o el enlace:</p><p class="mk-code-big">${room.code}</p><div class="mk-dialog-actions"><button type="button" class="game-secondary" data-copy="${room.code}">Copiar código</button><button type="button" class="game-secondary" data-copy="${link}">Copiar enlace</button></div></section>`:''}
<div class="mk-trade"><section class="mk-panel"><h3 class="mk-title"><span class="mk-who">${face(me.avatar,'Tú ofreces')}</span>${me.ok?'<span class="mk-chip win">Confirmado</span>':''}</h3>${offered(me.offer)}
${openNow?`<h4 class="mk-sub">Tus artículos comerciables</h4>${mine}`:''}</section>
<section class="mk-panel"><h3 class="mk-title"><span class="mk-who">${other?face(other.avatar,`${other.name} te ofrece`):'<b>La otra persona</b>'}</span>${other?.ok?'<span class="mk-chip win">Confirmado</span>':''}</h3>${other?offered(other.offer):'<p class="mk-empty">Aún no ha entrado nadie.</p>'}</section></div>
<section class="mk-panel mk-trade-foot"><p class="mk-state">${state}</p>${openNow?`<p class="mk-muted">Solo se mueven artículos, nunca faradios. Al confirmar los dos, el cambio se hace al momento y no se puede deshacer. Si alguien cambia su oferta, hay que volver a confirmar.</p>
<div class="mk-dialog-actions"><button type="button" class="game-secondary" data-trade-cancel>Cancelar intercambio</button>${me.ok?'<button type="button" class="game-secondary" data-trade-ok="no">Quitar mi confirmación</button>':`<button type="button" class="game-primary" data-trade-ok="si"${!other||empty?' disabled':''}>Confirmar</button>`}</div>`:''}</section>`;
  }
  function swapsTab(){
    if(room)return swapRoom();
    const list=swaps?.trades||[],rules=swaps?.rules;
    const line=one=>`<li class="mk-line"><span>${one.other?`Con <b>${one.other.name}</b>`:'<b>Esperando a alguien</b>'} <small>código ${one.code} · ${ago(one.updatedAt)}</small></span><span class="mk-actions"><span class="mk-chip${one.status==='hecho'?' win':one.status==='abierto'?'':' lose'}">${STATUS[one.status]}</span>${one.status==='abierto'?`<button type="button" class="game-secondary" data-trade-open="${one.id}">Abrir</button>`:''}</span></li>`;
    return `<p class="mk-note"><b>Intercambios privados.</b> Cambia artículos de colección con otro jugador, o pásalos entre tus cuentas. Solo se mueven artículos, nunca faradios: cada uno pone lo que ofrece, los dos veis lo que recibís y el cambio se hace cuando confirmáis los dos. Quien quiera cobrar en faradios, vende en el mercado.</p>
<div class="mk-trade"><section class="mk-panel"><h3 class="mk-title">Empezar uno</h3><p class="mk-muted">Te damos un código para que se lo pases a la otra persona.</p><button type="button" class="game-primary" data-trade-new>Crear intercambio</button></section>
<section class="mk-panel"><h3 class="mk-title">Tengo un código</h3><p class="mk-muted">Escribe el código de 6 letras y números que te han pasado.</p><div class="mk-join"><input type="text" data-code maxlength="6" autocapitalize="characters" autocomplete="off" placeholder="ABC123" value="${joinCode}" aria-label="Código del intercambio"><button type="button" class="game-secondary" data-trade-join>Entrar</button></div></section></div>
<h3 class="mk-title">Tus intercambios <small>${list.length}</small></h3>
${!swaps?'<p class="mk-empty">Cargando…</p>':list.length?`<ul class="mk-lines">${list.map(line).join('')}</ul>`:`<p class="mk-empty">Todavía no has hecho ninguno.${rules?` Un intercambio caduca si nadie lo toca en ${rules.minutes} minutos.`:''}</p>`}`;
  }
  // Entra en un intercambio con su código (también desde un enlace «?intercambio=CÓDIGO»).
  async function joinSwap(code){
    const data=await swap('intercambio-unirse',{code,...identity()},'Ese código no vale: el intercambio está cerrado o ya tiene dos jugadores.');
    if(data){joinCode='';watch()}
  }

  // ---------- Datos
  function collect(found){
    const line=(text,one)=>`${text} <b>${nameOf(one.edition)} n.º ${one.serial}</b>`;
    const fresh=[...found.sold.map(one=>`${line('Has vendido',one)} por ${int(one.price)} ≈: recibes ${int(one.price-one.fee)} ≈.`),...found.won.map(one=>`${line('¡Has ganado la subasta de',one)} por ${int(one.price)} ≈! Ya está en tu armario.`),
      ...found.outbid.map(one=>`${line('Te han superado la puja en',one)}: se te han devuelto ${int(one.amount)} ≈.`),...found.expired.map(one=>`${line('Tu subasta de',one)} terminó sin pujas: vuelve a tu armario.`)];
    inbox=[...fresh,...inbox].slice(0,8);return fresh.length;
  }
  async function load(){
    if(!linked()){board=null;if(!shell.hidden)draw();return 0}
    try{
      const data=await window.Progress.cloud('mercado');board=data;failed=false;skew=data.now-Date.now();window.Progress.serverCoins(data.coins);
      const fresh=collect(data.notices);if(fresh)window.Progress.syncItems();
      // No se repinta mientras se escribe en un campo: se perdería lo escrito y el foco.
      if(!shell.hidden&&!main.contains(document.activeElement?.matches?.('input,select')?document.activeElement:null))draw();
      return fresh;
    }catch{failed=!board;if(!shell.hidden&&!board)draw();return 0}
  }
  // Pide una operación al servidor y vuelve a traer el tablón. Devuelve lo que responde, o null si falla (y avisa).
  async function act(action,extra,failedText,conflict){
    if(busy)return null;busy=true;
    const data=await window.Progress.ask(action,extra,failedText,conflict);busy=false;
    if(data&&Number.isInteger(data.coins))window.Progress.serverCoins(data.coins);
    if(data)window.Progress.syncItems();
    dialog=null;await load();draw();return data;
  }
  function open(edition){
    if(typeof toggleMenu==='function')toggleMenu(false);
    const profile=document.getElementById('profile-shell');if(profile&&!profile.hidden)document.getElementById('profile-close')?.click();
    item=typeof edition==='string'?edition:'';if(!item)view='explorar';dialog=null;shell.hidden=false;document.body.classList.add('modal-open');draw();load();
    document.getElementById('market-close')?.focus();
    clearInterval(ticker);clearInterval(refresher);
    // Los relojes de las subastas se actualizan cada segundo sin repintar; al terminar alguna, se vuelve a traer el tablón.
    ticker=setInterval(()=>{let ended=false;for(const el of main.querySelectorAll('[data-ends]')){const text=left(Number(el.dataset.ends));if(text==='Terminada'&&el.textContent!==text)ended=true;el.textContent=text}if(ended)load()},1000);
    refresher=setInterval(()=>{if(!dialog)load();if(view==='intercambios'&&!room)loadSwaps()},20000);
    loadSwaps();if(room)watch();
  }
  function close(){
    shell.hidden=true;clearInterval(ticker);clearInterval(refresher);clearInterval(poll);dialog=null;
    if(['game-shell','duel-shell','profile-shell'].every(id=>document.getElementById(id)?.hidden!==false))document.body.classList.remove('modal-open');
  }

  // ---------- Lo que se toca
  document.addEventListener('click',event=>{const button=event.target.closest('[data-open-market]');if(button){event.preventDefault();open(button.dataset.openMarket||'')}});
  document.getElementById('market-close')?.addEventListener('click',close);
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!shell.hidden){if(dialog){dialog=null;draw()}else close()}});
  main.addEventListener('click',event=>{
    if(event.target.classList.contains('mk-dialog')){dialog=null;draw();return}
    const target=event.target.closest('button');if(!target||!board)return;
    const data=target.dataset;
    if(data.view){view=data.view;item='';if(view==='intercambios'){room=null;loadSwaps()}draw();main.scrollIntoView({block:'start'});return}
    // Intercambios privados: crear, entrar, abrir, ofrecer o quitar un artículo, confirmar y cancelar.
    if('tradeNew' in data){swap('intercambio-crear',identity(),'Ya tienes demasiados intercambios abiertos: cancela alguno.').then(done=>{if(done)watch()});return}
    if('tradeJoin' in data){joinSwap(joinCode.trim().toUpperCase());return}
    if(data.tradeOpen){swap('intercambio',{id:Number(data.tradeOpen)},'Ese intercambio ya no está abierto.').then(done=>{if(done)watch()});return}
    if('tradeLeave' in data){room=null;clearInterval(poll);loadSwaps();draw();return}
    if(data.tradeUnit&&room){
      const [edition,serial]=data.tradeUnit.split(':'),unit={edition,serial:Number(serial)},on=room.me.offer.some(one=>unitKey(one)===data.tradeUnit);
      swap('intercambio-ofrecer',{id:room.id,units:on?room.me.offer.filter(one=>unitKey(one)!==data.tradeUnit):[...room.me.offer,unit]},'Ese artículo no se puede ofrecer ahora: no es tuyo o está anunciado en el mercado.');return;
    }
    if(data.tradeOk&&room){swap('intercambio-confirmar',{id:room.id,version:room.version,ok:data.tradeOk==='si'},'No se ha podido confirmar: la oferta ha cambiado o algún artículo ya no está disponible. Revísala.').then(done=>{if(!done)swap('intercambio',{id:room.id},'')});return}
    if('tradeCancel' in data&&room){swap('intercambio-cancelar',{id:room.id},'Ese intercambio ya no está abierto.').then(done=>{if(done)toast('Intercambio cancelado.')});return}
    if(data.copy){navigator.clipboard?.writeText(data.copy).then(()=>toast('Copiado.'),()=>toast(data.copy));return}
    if('back' in data){item='';draw();return}
    if('clear' in data){inbox=[];draw();return}
    if('close' in data){dialog=null;draw();return}
    if(data.kind){filter.kind=data.kind;draw();return}
    if(data.bid){const listing=board.listings.find(one=>one.id===Number(data.bid));if(listing){dialog={type:'bid',id:listing.id,amount:String(listing.minBid)};draw();main.querySelector('[data-amount]')?.select()}return}
    if(data.buy){dialog={type:'buy',id:Number(data.buy)};draw();return}
    if(data.quick){dialog.amount=data.quick;draw();return}
    if('confirm' in data&&dialog){
      const listing=board.listings.find(one=>one.id===dialog.id);if(!listing||target.disabled)return;
      const won=bought=>toast(`¡Tuya! ${nameOf(bought.edition)} n.º ${bought.serial}${bought.total?` de ${int(bought.total)}`:''}`);
      if(dialog.type==='buy')act('comprar-anuncio',{listing:listing.id},'No se pudo comprar. Inténtalo otra vez.','Ese anuncio ya no está en venta.').then(done=>{if(done)won(done)});
      else act('pujar',{listing:listing.id,amount:Number(dialog.amount)},'No se pudo pujar. Inténtalo otra vez.','Alguien ha pujado antes o la subasta ha terminado. Mira la puja mínima.').then(done=>{if(done)done.bought?won(done):toast(`Puja de ${int(done.topBid)} ≈ hecha: vas ganando.`)});
      target.disabled=true;return;
    }
    if(data.unlist){if(target.disabled)return;target.disabled=true;act('retirar',{listing:Number(data.unlist)},'No se pudo retirar el anuncio. Inténtalo otra vez.','Ese anuncio ya no se puede retirar.').then(done=>{if(done)toast('Anuncio retirado: vuelve a tu armario.')});return}
    if('sell' in data){
      const [edition,serial]=form.unit.split(':'),number=text=>text===''?null:Number(text),buyNow=number(form.buyNow),startBid=number(form.startBid),max=board.rules.maxPrice,ok=value=>value==null||(Number.isInteger(value)&&value>=1&&value<=max);
      if(buyNow==null&&startBid==null){toast('Pon un precio de compra ya, una puja de salida o las dos cosas.');return}
      if(!ok(buyNow)||!ok(startBid)){toast('Los precios van en faradios, sin decimales.');return}
      if(buyNow!=null&&startBid!=null&&buyNow<=startBid){toast('El precio de compra ya tiene que ser mayor que la puja de salida.');return}
      if(target.disabled)return;target.disabled=true;
      act('vender',{edition,serial:Number(serial),buyNow,startBid,hours:startBid!=null?Number(form.hours):null},'No se pudo anunciar. Inténtalo otra vez.','No se puede anunciar ese artículo ahora.').then(done=>{if(done){form={...form,buyNow:'',startBid:''};toast('Anuncio publicado.');draw()}});
      return;
    }
    if(data.item){item=data.item;if(data.unit)form.unit=data.unit;dialog=null;draw();main.scrollIntoView({block:'start'})}
  });
  main.addEventListener('input',event=>{
    const el=event.target;
    if(el.matches('[data-code]')){joinCode=el.value;return}
    if(el.matches('[data-q]')){filter.q=el.value;const box=main.querySelector('#mk-results');if(box)box.innerHTML=results();return}
    if(el.matches('[data-amount]')&&dialog){dialog.amount=el.value;const listing=board.listings.find(one=>one.id===dialog.id),amount=Number(el.value),have=window.Progress.coins(),valid=Number.isInteger(amount)&&listing&&amount>=listing.minBid;
      const note=main.querySelector('[data-bidnote]'),go=main.querySelector('[data-confirm]');
      if(note&&listing)note.textContent=!valid?`La puja mínima es de ${int(listing.minBid)} ≈.`:amount>have?`Te faltan ${int(amount-have)} ≈.`:listing.buyNow!=null&&amount>=listing.buyNow?`Llega al precio de compra ya: la compras al momento por ${int(listing.buyNow)} ≈.`:`Se retienen ${int(amount)} ≈ de tu saldo. Si alguien puja más, se te devuelven.`;
      if(go)go.disabled=!valid||amount>have;return}
    if(el.dataset.f){form[el.dataset.f]=el.value;
      const note=main.querySelector('[data-summary]'),buyNow=Number(form.buyNow),startBid=Number(form.startBid),max=board.rules.maxPrice,ok=(text,value)=>text!==''&&Number.isInteger(value)&&value>=1&&value<=max;
      if(note)note.textContent=[ok(form.buyNow,buyNow)?`Con compra ya recibes ${int(buyNow-feeOf(buyNow))} ≈.`:'',ok(form.startBid,startBid)?`En subasta, como mínimo ${int(startBid-feeOf(startBid))} ≈.`:''].filter(Boolean).join(' ')||'Pon un precio de compra ya, una puja de salida o las dos cosas.'}
  });
  main.addEventListener('change',event=>{if(event.target.matches('[data-sort]')){filter.sort=event.target.value;const box=main.querySelector('#mk-results');if(box)box.innerHTML=results()}});
  // Al entrar con la cuenta se miran las novedades (ventas, subastas ganadas, pujas superadas) y se avisa una vez.
  // Un enlace «?intercambio=CÓDIGO» abre el mercado y entra en ese intercambio (una vez, ya con la cuenta).
  let invited=new URLSearchParams(location.search).get('intercambio')||'';
  document.addEventListener('faraday:progreso',()=>{
    if(invited&&linked()){const code=invited.trim().toUpperCase();invited='';history.replaceState(null,'',location.pathname);open();view='intercambios';draw();joinSwap(code)}
  });
  document.addEventListener('faraday:progreso',()=>{load().then(fresh=>{if(fresh&&shell.hidden)toast(fresh===1?'Tienes una novedad en el mercado.':`Tienes ${fresh} novedades en el mercado.`)})});
  document.addEventListener('faraday:cuenta',({detail})=>{if(detail&&'account' in detail&&!detail.account){board=null;inbox=[];swaps=null;room=null;clearInterval(poll);if(!shell.hidden)draw()}});
  window.Market={open,close};
})();

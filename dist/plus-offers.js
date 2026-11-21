// Oferta común de Plus: las cuotas y el acceso siguen decidiéndose en el servidor.
(()=>{
  const modes=new Map([
    ['home',{title:'Una ronda más.',description:'Partidas extra sin anuncios.'}],
    ['daily',{title:'¿Te has quedado con ganas de más?',description:'El reto de hoy ya está completo. Mañana tendrás tres preguntas nuevas; mientras, sigue explorando Faraday.'}],
    ['trends',{title:'¿Y si la siguiente fuera tu mejor curva?',description:'Quédate con las ganas de jugar, sin las pausas. Descubre las opciones de Plus para Traza.'}],
    ['duel',{title:'Que la revancha no se quede para mañana.',description:'Descubre Plus y sigue buscando tu mejor duelo.'}],
    ['duel3',{title:'La próxima ronda os espera a los tres.',description:'Más preguntas, más rivales y otra oportunidad de remontar. Descubre las opciones de Plus.'}],
    ['ranked',{title:'Tu próxima victoria aún está por jugar.',description:'Sigue poniendo a prueba tu intuición. Descubre las opciones de Plus para los duelos.'}],
    ['practice',{title:'La práctica no tiene por qué acabar aquí.',description:'Otra oportunidad de afinar tu intuición con Faraday-bot. Descubre las opciones de Plus.'}]
  ]);
  const generic={title:'¿Te apetece seguir jugando?',description:'Descubre Faraday Plus y consulta las ventajas disponibles para esta modalidad.'};
  const duelModes=new Set(['duel','duel3','ranked','practice']);
  const escape=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const integer=value=>Number.isSafeInteger(value)&&value>=0?value:null;
  const truth=value=>value==='true'||value==='1';
  const validMode=id=>typeof id==='string'&&/^[a-z][a-z0-9-]{0,47}$/.test(id);
  const fingerprint=value=>{let hash=2166136261;for(const char of JSON.stringify(value)){hash^=char.charCodeAt(0);hash=Math.imul(hash,16777619)}return (hash>>>0).toString(36)};
  function plan(){try{return window.Progress?.planOffer?.()||{}}catch{return {}}}
  function model(mode,options={}){
    options=options&&typeof options==='object'?options:{};
    const offer=plan(),copy=modes.get(mode)||generic;
    const limit=integer(options.limit),remaining=integer(options.remaining);
    const exhausted=options.exhausted===true||(limit!==null&&remaining===0);
    // Con cuenta guardada, hasta que el servidor diga si es Plus no se pinta la oferta (evita que aparezca y se esconda).
    const plus=typeof options.plus==='boolean'?options.plus:!!offer.plus||!!offer.pending;
    const quota=limit!==null&&remaining!==null
      ?exhausted?`Has usado los ${limit} duelos gratuitos de hoy.`:`Hoy te quedan ${Math.min(limit,remaining)} de ${limit} duelos gratuitos.`
      :exhausted?'Has llegado al límite gratuito de hoy.':'';
    const quotaText=duelModes.has(mode)&&quota?`${quota} El cupo se comparte entre duelos, clasificatorias y práctica.`:
      !duelModes.has(mode)&&limit!==null&&remaining!==null?`Hoy te quedan ${Math.min(limit,remaining)} de ${limit} partidas gratuitas.`:'';
    const note=offer.enabled?(offer.price?`${offer.price} · renovación automática · cancela cuando quieras`:'Consulta el precio y las condiciones en tu perfil.'):
      offer.linked?'La contratación todavía no está disponible. Consulta las ventajas en tu perfil.':'Entra con tu cuenta para consultar las ventajas y la disponibilidad.';
    const value={mode,plus,title:copy.title,description:copy.description,benefits:copy.benefits??(mode==='home'?'':'Partidas extra sin anuncios con Plus. Consulta las ventajas actuales en tu perfil.'),cta:offer.enabled?(copy.cta||'Ver opciones de Plus'):'Descubrir Plus',note,quota:quotaText,
      compact:options.compact===true,limit,remaining,exhausted,snapshot:typeof options.plus==='boolean'?options.plus:null};
    value.key=fingerprint(value);return value;
  }
  function render(mode,options={}){
    mode=validMode(mode)?mode:'general';
    const value=model(mode,options);if(value.plus)return '';
    const attr=(name,item)=>item===null?'':` data-plus-${name}="${escape(item)}"`;
    return `<section class="plus-offer${value.compact?' is-compact':''}" data-plus-mode="${escape(mode)}" data-plus-key="${value.key}"${attr('limit',value.limit)}${attr('remaining',value.remaining)}${attr('snapshot-plus',value.snapshot)} data-plus-exhausted="${value.exhausted}" data-plus-compact="${value.compact}" aria-label="Faraday Plus">
      <span class="plus-offer-badge">FARADAY PLUS</span><h4>${escape(value.title)}</h4>
      <p class="plus-offer-description">${escape(value.description)}</p>
      ${value.quota?`<p class="plus-offer-quota">${escape(value.quota)}</p>`:''}
      ${value.benefits?`<p class="plus-offer-benefits">${escape(value.benefits)}</p>`:''}
      <button class="game-primary plus-offer-action" type="button" data-open-plus="${escape(mode)}"><span>${escape(value.cta)}</span><span aria-hidden="true">→</span></button>
      <small class="plus-offer-note">${escape(value.note)}</small>
    </section>`;
  }
  function register(id,config){
    if(!validMode(id)||!config||typeof config.title!=='string'||typeof config.description!=='string')throw new TypeError('Modalidad de Plus no válida');
    modes.set(id,{title:config.title.slice(0,160),description:config.description.slice(0,600),...(typeof config.benefits==='string'?{benefits:config.benefits.slice(0,600)}:{}),...(typeof config.cta==='string'?{cta:config.cta.slice(0,100)}:{})});
    if(typeof document!=='undefined')refresh();
  }
  const find=(root,selector)=>[...(root.matches?.(selector)?[root]:[]),...root.querySelectorAll(selector)];
  function optionsOf(element,slot=false){
    const data=element.dataset,prefix=slot?'':'plus';
    const read=name=>data[prefix?prefix+name[0].toUpperCase()+name.slice(1):name];
    const number=name=>{const value=read(name);return value!==undefined&&/^\d+$/.test(value)?Number(value):undefined};
    const snapshot=slot?data.plus:data.plusSnapshotPlus;
    return {limit:number('limit'),remaining:number('remaining'),exhausted:truth(read('exhausted')),compact:truth(read('compact')),
      ...(snapshot==='true'||snapshot==='false'?{plus:snapshot==='true'}:{})};
  }
  function refresh(root=document){
    for(const slot of find(root,'[data-plus-slot]')){
      const mode=validMode(slot.dataset.plusSlot)?slot.dataset.plusSlot:'general';
      const options=optionsOf(slot,true),value=model(mode,options);
      // Compara el estado, no innerHTML: el navegador normaliza entidades y espacios del precio.
      if(value.plus){if(slot.innerHTML)slot.innerHTML=''}
      else if(slot.querySelector('.plus-offer')?.dataset.plusKey!==value.key)slot.innerHTML=render(mode,options);
    }
    for(const card of find(root,'.plus-offer')){
      if(card.closest('[data-plus-slot]'))continue;
      const options=optionsOf(card),value=model(card.dataset.plusMode,options);
      if(value.plus){card.hidden=true;continue}
      card.hidden=false;
      if(card.dataset.plusKey!==value.key)card.outerHTML=render(card.dataset.plusMode,options);
    }
  }
  window.PlusOffers={register,render,refresh};
  if(typeof document==='undefined')return;
  document.addEventListener('click',event=>{
    const button=event.target.closest?.('[data-open-plus]');if(!button)return;
    window.Progress?.openPlan?.({mode:button.dataset.openPlus});
  });
  function changed(){
    // Una cuota es una instantánea; al cambiar de cuenta o plan manda el estado nuevo.
    for(const node of document.querySelectorAll('[data-plus-snapshot-plus]'))node.removeAttribute('data-plus-snapshot-plus');
    for(const slot of document.querySelectorAll('[data-plus-slot][data-plus]'))slot.removeAttribute('data-plus');
    refresh();
  }
  document.addEventListener('faraday:plan',changed);
  document.addEventListener('faraday:cuenta',changed);
  let scheduled=false;
  const schedule=()=>{if(scheduled)return;scheduled=true;Promise.resolve().then(()=>{scheduled=false;refresh()})};
  if(typeof MutationObserver!=='undefined')new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true,attributes:true,
    attributeFilter:['data-plus-slot','data-limit','data-remaining','data-exhausted','data-compact','data-plus']});
  refresh();
})();

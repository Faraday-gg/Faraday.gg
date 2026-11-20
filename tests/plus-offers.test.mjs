import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../dist/plus-offers.js',import.meta.url),'utf8');
let offer={plus:false,linked:false,enabled:false,price:''},opened;
const listeners=new Map(),slots=[];
let observer;
const document={documentElement:{},querySelectorAll(selector){
  if(selector==='[data-plus-slot]')return slots;
  if(selector==='[data-plus-slot][data-plus]')return slots.filter(slot=>slot.dataset.plus!==undefined);
  return [];
},addEventListener(event,callback){listeners.set(event,callback)}};
const context={window:{Progress:{planOffer:()=>offer,openPlan:value=>opened=value}},document,
  MutationObserver:class{constructor(callback){observer=callback}observe(){}}};
vm.createContext(context);vm.runInContext(source,context);
const P=context.window.PlusOffers;

assert.match(P.render('trends'),/Descubrir Plus/);
assert.match(P.render('daily'),/Mañana tendrás tres preguntas nuevas/);
assert.doesNotMatch(P.render('daily'),/repetir el reto|reto ilimitado/);
for(const mode of ['duel','duel3','ranked','practice']){
  const html=P.render(mode,{limit:7,remaining:2});assert.match(html,/2 de 7 duelos gratuitos/);assert.match(html,/cupo se comparte/);
}
assert.match(P.render('duel',{limit:7,remaining:0}),/Has usado los 7 duelos/);
assert.doesNotMatch(P.render('duel'),/de 5|undefined|NaN/);
offer={plus:false,linked:true,enabled:true,price:'6,50 € al mes'};
assert.match(P.render('trends'),/6,50 € al mes/);assert.match(P.render('trends'),/renovación automática/);
assert.match(P.render('trends'),/Ver opciones de Plus/);
offer={plus:true};assert.equal(P.render('duel'),'');assert.notEqual(P.render('duel',{plus:false}), '','Una cuota actual puede indicar que el plan ya caducó');
offer={plus:false};assert.equal(P.render('duel',{plus:true}),'','El servidor puede confirmar Plus antes de hidratar el perfil');
P.register('futuro',{title:'Otra <curva>',description:'Una modalidad & algo más',cta:'Ver "Plus"'});
assert.match(P.render('futuro'),/Otra &lt;curva&gt;/);assert.match(P.render('futuro'),/modalidad &amp; algo/);
assert.match(P.render('sin-registrar'),/ventajas disponibles para esta modalidad/);
offer={enabled:true,price:'<img src=x onerror=alert(1)>'};assert.doesNotMatch(P.render('trends'),/<img/);
assert.match(P.render('trends'),/&lt;img/);
assert.throws(()=>P.register('<x>',{title:'a',description:'b'}),/válida/);

// Un hueco previo o insertado después se monta una vez; los cambios de plan lo retiran y recuperan.
const slot={dataset:{plusSlot:'daily'},writes:0,value:'',get innerHTML(){return this.value},set innerHTML(value){this.value=value;this.writes++},
  querySelector(){const key=/data-plus-key="([^"]+)"/.exec(this.value)?.[1];return key?{dataset:{plusKey:key}}:null},
  removeAttribute(name){if(name==='data-plus')delete this.dataset.plus}};
offer={plus:false,enabled:false};slots.push(slot);observer([]);await Promise.resolve();
assert.match(slot.innerHTML,/FARADAY PLUS/);assert.equal(slot.writes,1);
P.refresh();observer([]);await Promise.resolve();assert.equal(slot.writes,1,'Las propias mutaciones no crean un bucle');
offer={plus:false,enabled:true,price:'6,50\u00a0€ al mes'};P.refresh();
slot.value=slot.value.replace('\u00a0','&nbsp;');const writes=slot.writes;
P.refresh();observer([]);await Promise.resolve();assert.equal(slot.writes,writes,'La serialización HTML del precio no vuelve a montar el módulo');
slot.dataset.plus='false';offer={plus:true};listeners.get('faraday:plan')();assert.equal(slot.innerHTML,'');assert.equal(slot.dataset.plus,undefined,'La activación descarta la instantánea anterior');
offer={plus:false};listeners.get('faraday:cuenta')();assert.match(slot.innerHTML,/FARADAY PLUS/);
listeners.get('click')({target:{closest:()=>({dataset:{openPlus:'daily'}})}});assert.equal(opened.mode,'daily');

// La modalidad real registra su contexto y monta la invitación general en ambos resúmenes.
// No se confunde la práctica ilimitada de Ascensión con el cupo compartido de los duelos.
{
  const handlers=new Map(),requests=[];
  let activeSlot=null,openClick,openedMode=null,subscriber=false,html='',continuation=null;
  const replies={};
  const event=(type,detail)=>({type,detail,defaultPrevented:false,preventDefault(){this.defaultPrevented=true}});
  const dispatch=value=>{for(const listener of handlers.get(value.type)||[])listener(value);return !value.defaultPrevented};
  const add=(name,fn)=>handlers.set(name,[...(handlers.get(name)||[]),fn]);
  const slotOf=()=>({dataset:{plusSlot:'ascension'},value:'',get innerHTML(){return this.value},set innerHTML(value){this.value=value},
    querySelector(){const key=/data-plus-key="([^"]+)"/.exec(this.value)?.[1];return key?{dataset:{plusKey:key}}:null}});
  const slotsFor=selector=>selector==='[data-plus-slot]'&&activeSlot?[activeSlot]:[];
  const focus={focus(){page.document.activeElement=this}},input={...focus,value:'',blur(){page.document.activeElement=null}},submit={},seconds={};
  const next={...focus},controls={},status={},skip={...focus},replay={...focus};
  const clock={classList:{toggle(){}},style:{setProperty(){}}};
  const content={matches:()=>false,querySelectorAll:slotsFor,
    get innerHTML(){return html},set innerHTML(value){html=value;activeSlot=value.includes('data-plus-slot="ascension"')?slotOf():null},
    querySelector(selector){
      if(html.includes('id="ascension-answer"')){
        const question={input,'#ascension-answer':input,'#ascension-submit':submit,'.ascension-clock':clock,'#ascension-seconds':seconds};
        if(question[selector])return question[selector];
      }
      if(html.includes('id="ascension-climb-status"')){
        const result={'#ascension-next':next,'.ascension-climb-controls':controls,'#ascension-climb-status':status,
          '[data-ascension="skip-climb"]':skip,'[data-ascension="replay-climb"]':replay};
        if(selector==='[data-ascension="skip-climb"]:not([hidden])')return skip.hidden?null:skip;
        if(result[selector])return result[selector];
      }
      return selector==='h3'?focus:null;
    }};
  const button={focus(){},addEventListener(name,fn){if(name==='click')openClick=fn}};
  const dialogHandlers=new Map();
  const dialog={open:false,dataset:{},querySelector:()=>({setAttribute(){}}),
    addEventListener(name,fn){dialogHandlers.set(name,fn)},showModal(){this.open=true},
    close(){if(!this.open)return;this.open=false;dialogHandlers.get('close')?.()}};
  const elements={'ascension-dialog':dialog,'ascension-content':content,'ascension-scene':{},'ascension-alert':{},'ascension-steps':{},'ascension-mode':{}};
  let endClimb,reducedMotion=true;
  const climbs=[];
  const animate=options=>{climbs.push(options);return new Promise(resolve=>{endClimb=resolve})};
  const scene={setHeight:(_height,options)=>options.animate?animate(options):Promise.resolve(),
    replay:animate,finish(){endClimb?.(true)},setState(){},refreshLook(){},destroy(){endClimb?.(false)}};
  const fixture={date:'2026-11-19',game:0,phase:'finished',round:6,rounds:7,score:70,height:700,now:Date.now(),ranking:null,
    results:Array.from({length:7},(_,round)=>({round,answer:'Respuesta',title:'Categoría',points:10,height:100,tier:{name:'Conocida'},sources:[]}))};
  let response=fixture;
  const page={document:{documentElement:{},getElementById:id=>elements[id],querySelector:()=>button,
    querySelectorAll:selector=>selector==='[data-open-ascension]'?[button]:slotsFor(selector),addEventListener:add,dispatchEvent:dispatch},
    MutationObserver:class{observe(){}},Progress:{look:()=>({}),reaction:()=>({mood:'still'}),
      planOffer:()=>({plus:subscriber,linked:true,enabled:false}),
      openPlan({mode}){if(dispatch(event('faraday:before-plan',{mode})))openedMode=mode}},
    AscensionScene:{mount:()=>scene},Sound:{on:false},escapeHtml:value=>String(value),
    Continuations:{register(mode,play,prepare){assert.equal(mode,'ascension');continuation={play,prepare}},refresh(){}},
    playerReady:Promise.resolve(),fetch:async(_url,options)=>{const data=JSON.parse(options.body);requests.push(data);return {ok:true,json:async()=>structuredClone(replies[data.action]||response)}},
    AbortController,Event,Date,URL,URLSearchParams,location:{search:'',pathname:'/',origin:'https://faraday.test'},navigator:{},
    setTimeout,clearTimeout,setInterval,clearInterval,addEventListener(){},matchMedia:()=>({get matches(){return reducedMotion}})};
  page.window=page;vm.createContext(page);vm.runInContext(source,page);
  vm.runInContext(fs.readFileSync(new URL('../dist/ascension.js',import.meta.url),'utf8'),page);
  const flush=()=>new Promise(resolve=>setImmediate(resolve));
  try{
    openClick();await flush();
    assert.equal(dialog.open,true);assert(activeSlot);
    assert.match(activeSlot.innerHTML,/data-plus-mode="ascension"/);assert.match(activeSlot.innerHTML,/Tu próxima aventura empieza en Faraday/);
    assert.doesNotMatch(activeSlot.innerHTML,/plus-offer-quota|partidas gratuitas|más ascensiones|ascensiones ilimitadas/);
    assert.match(content.innerHTML,/data-continue-slot="ascension"/,'Conserva la continuación gratuita común');
    subscriber=true;dispatch(event('faraday:plan'));assert.equal(activeSlot.innerHTML,'','La oferta desaparece al activar Plus');
    subscriber=false;dispatch(event('faraday:plan'));assert.match(activeSlot.innerHTML,/FARADAY PLUS/);
    dispatch({type:'click',target:{closest:()=>({dataset:{openPlus:'ascension'}})}});
    assert.equal(openedMode,'ascension');assert.equal(dialog.open,false,'Cierra el resumen antes de abrir el perfil');
    assert.deepEqual(requests.map(request=>request.action),['estado'],'Consultar Plus no abandona ni muta una partida');
    response={...fixture,game:1,continuation:{plus:false,resume:false,fromGame:3,adSeconds:15}};openClick();await flush();
    assert(activeSlot);assert.match(activeSlot.innerHTML,/data-plus-mode="ascension"/,'La práctica utiliza el mismo contexto general');
    assert.match(content.innerHTML,/Práctica completada/);assert.match(content.innerHTML,/data-continue-slot="ascension"/);
    replies['preparar-practica']={...response,game:3,watch:true,activate:true,ticket:'recibo-de-prueba'};
    const prepared=await continuation.prepare();
    assert.equal(prepared.watch,true);assert.equal(requests.at(-1).action,'preparar-practica');
    assert.equal(requests.at(-1).game,3,'La continuación parte de la última práctica confirmada por el servidor');
    assert(!requests.some(request=>request.action==='practica'),'Preparar sin completar el anuncio no consume el recibo');
    replies.practica={...response,game:4,phase:'ready',round:0,results:[],score:0,height:0};
    await continuation.play(prepared);await flush();
    assert.equal(requests.at(-1).action,'practica');assert.equal(requests.at(-1).game,3);assert.equal(requests.at(-1).ticket,'recibo-de-prueba');assert.match(content.innerHTML,/Empezar ascensión/);
    delete replies['preparar-practica'];delete replies.practica;
    dialog.close();
    response={...fixture,phase:'question',round:0,results:[],score:0,height:0,now:Date.now(),deadline:Date.now()+25000,
      current:{title:'Categoría activa',description:'Responde mientras corre el reloj',count:2}};
    openClick();await flush();assert.equal(activeSlot,null,'La oferta no interrumpe las preguntas');
    openedMode=null;dispatch({type:'click',target:{closest:()=>({dataset:{openPlus:'ascension'}})}});
    assert.equal(openedMode,null);assert.equal(dialog.open,true,'La navegación al plan queda bloqueada con ronda activa');

    const question=response;
    reducedMotion=false;
    replies.responder={...question,phase:'result',results:[fixture.results[0]],score:10,height:100};
    dialog.scrollTop=200;input.value='Respuesta';
    dialogHandlers.get('submit')({...event('submit'),target:{id:'ascension-form'}});
    await flush();
    assert.equal(dialog.scrollTop,0,'La revelación devuelve la vista a la escena');
    assert.equal(climbs.length,1);assert.equal(climbs[0].points,10);assert.equal(typeof climbs[0].onCue,'function');
    assert.equal(status.textContent,'Escalando…');assert.equal(skip.hidden,false);assert.equal(replay.hidden,true);assert.equal(next.disabled,true);
    const activity=requests.length;
    response=replies.responder;
    dispatch(event('visibilitychange'));await flush();
    assert.equal(requests.length,activity,'Recuperar la visibilidad no corta la escalada');
    const click=action=>dialogHandlers.get('click')({target:{closest:()=>({dataset:{ascension:action},hasAttribute:()=>false})}});
    skip.focus();click('skip-climb');await flush();
    assert.equal(requests.at(-1).action,'estado');assert.equal(status.textContent,'Repisa alcanzada');
    assert.equal(next.disabled,false);assert.equal(replay.hidden,false);assert.equal(page.document.activeElement,next);
    replay.focus();click('replay-climb');await flush();
    assert.equal(climbs.length,2);assert.equal(requests.length,activity+1,'La repetición solo afecta a la escena');
    assert.equal(next.disabled,true);assert.equal(page.document.activeElement,skip);
    scene.finish();await flush();
    replies.siguiente={...question,round:1};
    dialogHandlers.get('keydown')({...event('keydown'),key:'Enter',target:focus});await flush();
    assert.equal(requests.at(-1).action,'siguiente');assert.equal(dialog.dataset.phase,'question');
  }finally{dialog.close()}
}
console.log('plus-offers: oferta contextual, cuotas, precio dinámico, Plus y flujo de escalada correctos');

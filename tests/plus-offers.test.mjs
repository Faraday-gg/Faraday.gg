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
console.log('plus-offers: oferta contextual, cuotas, precio dinámico, Plus, escape y ciclo declarativo correctos');

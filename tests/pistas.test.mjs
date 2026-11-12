// Prueba las pistas (dist/pistas.js, decisión 0039): el rango de potencias de 10 contiene la respuesta de todas las
// preguntas, la pista no se pinta hasta desbloquearla, pagar descuenta faradios solo si llegan, el anuncio solo da pista
// si se ve entero y lo desbloqueado se recuerda.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../dist/pistas.js',import.meta.url),'utf8');
const days=JSON.parse(fs.readFileSync(new URL('../dist/questions.json',import.meta.url),'utf8'));
const questions=days.flatMap(day=>day.questions);
const number=text=>{const [n,word]=text.split(' ');const base=Number(n.replace(/\./g,'').replace(',','.'));return base*(word?.startsWith('bill')?1e12:word?.startsWith('mill')?1e6:1)};

// Una página mínima: localStorage en memoria, un <dialog> que guarda sus oyentes y eventos apuntados.
function page({coins=0,storage={},ad=true}={}){
  const events=[],handlers={};let spent=0;
  const dialog={open:false,innerHTML:'',className:'',setAttribute(){},addEventListener:(type,fn)=>{handlers[type]=fn},
    showModal(){this.open=true},close(){this.open=false;handlers.close?.()}};
  const ctx={
    localStorage:{getItem:key=>storage[key]??null,setItem:(key,value)=>{storage[key]=value}},
    document:{createElement:()=>dialog,body:{append(){}},getElementById:()=>null,dispatchEvent:e=>events.push(e)},
    CustomEvent:class{constructor(type,init){this.type=type;this.detail=init?.detail}},
    Progress:{coins:()=>coins,spend:amount=>{if(coins<amount)return false;coins-=amount;spent+=amount;return true}},
    showToast(){},
  };
  if(ad)ctx.Ads={simulated:true,next:true,rewarded(){return Promise.resolve(this.next)}};
  ctx.window=ctx;vm.createContext(ctx);vm.runInContext(source,ctx,{filename:'dist/pistas.js'});
  const click=attr=>handlers.click({target:{closest:selector=>selector===attr?{}:null}});
  return {Pistas:ctx.Pistas,dialog,events,storage,click,coins:()=>coins,spent:()=>spent,ads:ctx.Ads};
}

// El rango contiene la respuesta de todas las preguntas del piloto y mide un factor 10.
{
  const {Pistas}=page();
  assert.ok(questions.length>=20);
  for(const q of questions){
    const [low,high]=Pistas.range(q.answer).map(number);
    assert.ok(low<=q.answer&&q.answer<high,`${q.id}: ${q.answer} entre ${low} y ${high}`);
    assert.equal(Math.round(high/low),10);
  }
  assert.deepEqual([...Pistas.range(1000)],['1.000','10.000'],'Una potencia exacta cae en su propio tramo');
  assert.deepEqual([...Pistas.range(7.3e9)],['1.000 millones','10.000 millones']);
  assert.deepEqual([...Pistas.range(0.35)],['0,1','1']);
  assert.deepEqual([...Pistas.range(2e12)],['1 billón','10 billones']);
}

const q={...questions[0],unit:'toallas <b>'};

// Sin desbloquear: botón sí, pista no.
{
  const {Pistas}=page();
  assert.equal(Pistas.used(q.id),null);assert.equal(Pistas.markup(q),'');
  assert.match(Pistas.button(q),/id="hint-toggle"/);
}

// Pagar sin faradios suficientes no descuenta ni desbloquea.
{
  const p=page({coins:99});let got=null;
  p.Pistas.open(q,html=>{got=html});assert.ok(p.dialog.open);
  assert.match(p.dialog.innerHTML,/disabled/);assert.match(p.dialog.innerHTML,/te faltan 1/);
  p.click('[data-hint-pay]');
  assert.equal(got,null);assert.equal(p.spent(),0);assert.equal(p.Pistas.used(q.id),null);
}

// Pagar con faradios: descuenta el precio, desbloquea, avisa y se recuerda al volver a cargar.
{
  const p=page({coins:250});let got=null,via=null;
  p.Pistas.open(q,(html,how)=>{got=html;via=how});p.click('[data-hint-pay]');
  assert.equal(p.spent(),p.Pistas.COST);assert.equal(p.coins(),250-p.Pistas.COST);assert.equal(via,'coins');
  assert.ok(!p.dialog.open,'La ventana se cierra');
  assert.match(got,/entre 10\.000 y 100\.000/);assert.match(got,/toallas &lt;b&gt;/,'La unidad se escapa');
  assert.match(got,new RegExp(q.reasoning.heading));
  assert.equal(p.events.at(-1).type,'faraday:hint');assert.equal(p.events.at(-1).detail.via,'coins');
  assert.equal(p.Pistas.button(q),'');
  p.click('[data-hint-pay]');assert.equal(p.spent(),p.Pistas.COST,'No se cobra dos veces');
  const again=page({storage:p.storage});
  assert.equal(again.Pistas.used(q.id),'coins');assert.equal(again.Pistas.markup(q),got);
}

// Anuncio: cerrado antes de tiempo no da pista; visto entero, sí, y sin gastar faradios.
{
  const p=page({coins:0});let got=null;
  p.ads.next=false;p.Pistas.open(q,html=>{got=html});p.click('[data-hint-ad]');await new Promise(r=>setTimeout(r));
  assert.equal(got,null);assert.equal(p.Pistas.used(q.id),null);
  p.ads.next=true;p.Pistas.open(q,(html,how)=>{got=how});p.click('[data-hint-ad]');await new Promise(r=>setTimeout(r));
  assert.equal(got,'ad');assert.equal(p.Pistas.used(q.id),'ad');assert.equal(p.spent(),0);
}

// Sin anuncios disponibles solo se ofrece pagar.
{
  const p=page({ad:false,coins:500});p.Pistas.open(q,()=>{});
  assert.doesNotMatch(p.dialog.innerHTML,/data-hint-ad/);assert.match(p.dialog.innerHTML,/data-hint-pay/);
}

console.log('pistas: OK');

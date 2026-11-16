// Prueba el cobro de la suscripción con Stripe (decisión 0077), con un Stripe simulado: la página de pago, el portal,
// la firma de los avisos y lo que cada aviso apunta en el almacén. A través de la API, con una cuenta falsa; sin red.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {randomUUID,createHash,createHmac} from 'node:crypto';
import {createApi} from '../lib/api.mjs';
import {fileStore} from '../lib/stores.mjs';
import {createStripe,BILLING} from '../lib/stripe.mjs';

const SECRET='sk_test_prueba',WHSEC='whsec_prueba',PRICE='price_prueba',DAY=86400000;
let clock=Date.parse('2026-11-20T09:00:00Z');
const hashOf=player=>createHash('sha256').update(player).digest('hex');
// La firma que pondría Stripe en un aviso.
const sign=(raw,secret=WHSEC,at=clock)=>{const t=Math.floor(at/1000);return `t=${t},v1=${createHmac('sha256',secret).update(`${t}.${raw}`).digest('hex')}`};

// Un Stripe simulado: guarda las llamadas y responde con lo que haya en `subs` y en el precio.
const calls=[],subs=new Map();let down=false;
async function fake(url,init={}){
  const target=new URL(url),form=init.body?Object.fromEntries(new URLSearchParams(init.body)):null;
  calls.push({method:init.method,path:target.pathname,auth:init.headers?.Authorization,type:init.headers?.['Content-Type'],form});
  if(down)return Response.json({error:{message:'caído'}},{status:500});
  if(target.pathname==='/v1/checkout/sessions')return Response.json({id:'cs_1',url:'https://checkout.stripe.test/pagar'});
  if(target.pathname==='/v1/billing_portal/sessions')return Response.json({url:'https://billing.stripe.test/portal'});
  if(target.pathname==='/v1/prices/'+PRICE)return Response.json({unit_amount:499,currency:'eur',recurring:{interval:'month'}});
  const sub=subs.get(target.pathname.split('/').pop());
  return sub?Response.json(sub):Response.json({error:{message:'No such subscription'}},{status:404});
}
const sent=()=>calls.at(-1);

// Sin claves, la suscripción no se puede contratar.
assert.equal(createStripe().enabled,false);assert.equal(createStripe({secret:SECRET}).enabled,false);assert.equal(await createStripe().priceInfo(),null);
const stripe=createStripe({secret:SECRET,webhookSecret:WHSEC,price:PRICE,fetch:fake,now:()=>clock});assert.equal(stripe.enabled,true);

// La firma de los avisos: HMAC-SHA256 de «hora.cuerpo» con el secreto, en la cabecera Stripe-Signature.
{
  const raw=JSON.stringify({type:'x',data:{object:{}}});
  assert.deepEqual(stripe.verify(raw,sign(raw)),JSON.parse(raw));
  assert.deepEqual(stripe.verify(raw,`${sign(raw,'whsec_viejo')},${sign(raw).split(',')[1]},v0=ignorada`),JSON.parse(raw),'Vale con que una de las firmas v1 sea buena');
  assert.equal(stripe.verify(raw,sign(raw,'whsec_otro')),null,'Otro secreto');
  assert.equal(stripe.verify(raw+' ',sign(raw)),null,'Cuerpo cambiado');
  assert.equal(stripe.verify(raw,sign(raw,WHSEC,clock-6*60000)),null,'Aviso viejo (más de 5 minutos)');
  for(const bad of [null,'','t=abc,v1=x','v1=abc',`t=${Math.floor(clock/1000)}`,sign(raw).replace('v1=','v0=')])assert.equal(stripe.verify(raw,bad),null,String(bad));
  assert.equal(stripe.verify('no es json',sign('no es json')),null);
  assert.equal(createStripe({secret:SECRET,price:PRICE}).verify(raw,sign(raw)),null,'Sin secreto del aviso no se acepta ninguno');
}

// Las llamadas a Stripe: con la clave en la cabecera y el cuerpo como formulario.
{
  const player='a'.repeat(64);
  assert.equal(await stripe.checkout({player,email:'luis@example.test',customer:null,origin:'https://faraday.test'}),'https://checkout.stripe.test/pagar');
  assert.deepEqual([sent().method,sent().path,sent().auth,sent().type],['POST','/v1/checkout/sessions','Bearer '+SECRET,'application/x-www-form-urlencoded']);
  assert.deepEqual(sent().form,{mode:'subscription','line_items[0][price]':PRICE,'line_items[0][quantity]':'1',success_url:'https://faraday.test/?suscripcion=ok',cancel_url:'https://faraday.test/?suscripcion=cancelada',
    client_reference_id:player,customer_email:'luis@example.test','metadata[player]':player,'subscription_data[metadata][player]':player});
  await stripe.checkout({player,email:'luis@example.test',customer:'cus_9',origin:'https://faraday.test'});
  assert.equal(sent().form.customer,'cus_9');assert.equal(sent().form.customer_email,undefined,'Quien ya es cliente no crea otro');
  assert.equal(await stripe.portal({customer:'cus_9',origin:'https://faraday.test'}),'https://billing.stripe.test/portal');
  assert.deepEqual([sent().path,sent().form],['/v1/billing_portal/sessions',{customer:'cus_9',return_url:'https://faraday.test/'}]);
  assert.deepEqual(await stripe.priceInfo(),{amount:499,currency:'eur',interval:'month'});
  // El final del periodo va en los artículos de la suscripción; en versiones antiguas de la API, en la suscripción.
  subs.set('sub_nueva',{id:'sub_nueva',status:'active',customer:'cus_1',metadata:{player},items:{data:[{current_period_end:1800000000},{current_period_end:1800000500}]}});
  subs.set('sub_vieja',{id:'sub_vieja',status:'trialing',customer:{id:'cus_2'},metadata:{},current_period_end:1790000000});
  assert.deepEqual(await stripe.subscription('sub_nueva'),{id:'sub_nueva',player,customer:'cus_1',status:'active',periodEnd:1800000500000});
  assert.deepEqual(await stripe.subscription('sub_vieja'),{id:'sub_vieja',player:null,customer:'cus_2',status:'trialing',periodEnd:1790000000000});
  await assert.rejects(stripe.subscription('sub_no_existe'),/Stripe respondió 404/);
}

const directory=fs.mkdtempSync(path.join(os.tmpdir(),'casi-stripe-'));
const auth={async current(request,read){const value=read(request,'faraday_sesion');if(!value)return null;const [flag,id]=value.includes(':')?value.split(':'):['',value];return {account:{id:'u-'+id,email:flag?'':id.slice(0,8)+'@example.test',player:id},cookies:[]}}};
const store=fileStore(path.join(directory,'answers.json'));
const api=createApi({playedDays:async()=>200,store,persistDays:false,now:()=>clock,auth,stripe,log:()=>{}});
const plain=createApi({playedDays:async()=>200,store:fileStore(path.join(directory,'otro','answers.json')),persistDays:false,now:()=>clock,auth,log:()=>{}});
async function post(body,session,on=api,host='juego.faraday.test'){
  const headers={'Content-Type':'application/json',host};if(session)headers.cookie='faraday_sesion='+session;
  const response=await on.handle(new Request('http://interno/api/progreso',{method:'POST',headers,body:JSON.stringify(body)}));
  return {status:response.status,data:await response.json()};
}
// Un aviso de Stripe, firmado, a /api/stripe. Llega desde fuera: con otro origen y sin cookies.
async function hook(event,{signature,on=api}={}){
  const raw=JSON.stringify(event);
  const response=await on.handle(new Request('http://interno/api/stripe',{method:'POST',headers:{'Content-Type':'application/json',origin:'https://stripe.com','stripe-signature':signature??sign(raw)},body:raw}));
  return {status:response.status,data:await response.json()};
}
const state=async player=>(await post({action:'estado'},player)).data;
try{
  const luis=randomUUID(),ana=randomUUID(),hash=hashOf(luis),end=clock+30*DAY,seconds=ms=>Math.floor(ms/1000);
  for(const player of [luis,ana])await post({action:'guardar',state:{v:1,xp:0},delta:0},player);

  // Sin Stripe configurado: el estado lo dice y no se puede contratar.
  await post({action:'guardar',state:{v:1,xp:0},delta:0},luis,plain);
  assert.deepEqual((await post({action:'estado'},luis,plain)).data.billing,{enabled:false,price:null,managed:false});
  assert.deepEqual((await post({action:'suscribirse'},luis,plain)).data.code,'cobro');assert.equal((await hook({type:'x'},{on:plain})).status,503);

  // Con Stripe: el estado trae el precio. Suscribirse pide cuenta con correo y devuelve la página de pago, que vuelve a esta dirección.
  let s=await state(luis);assert.deepEqual([s.plus,s.billing],[false,{enabled:true,price:{amount:499,currency:'eur',interval:'month'},managed:false}]);
  assert.equal((await post({action:'suscribirse'},null)).status,401);assert.equal((await post({action:'suscribirse'},'sin-correo:'+luis)).data.code,'cuenta');
  let r=await post({action:'suscribirse'},luis);assert.deepEqual(r.data,{url:'https://checkout.stripe.test/pagar'});
  assert.deepEqual([sent().form.client_reference_id,sent().form.customer_email,sent().form.success_url],[hash,luis.slice(0,8)+'@example.test','http://juego.faraday.test/?suscripcion=ok']);
  assert.equal((await post({action:'gestionar-suscripcion'},luis)).data.code,'sin-suscripcion');
  assert.equal((await state(luis)).plus,false,'Abrir la página de pago no da la suscripción');

  // El aviso de pago: solo vale con la firma de Stripe.
  subs.set('sub_luis',{id:'sub_luis',status:'active',customer:'cus_luis',metadata:{player:hash},items:{data:[{current_period_end:seconds(end)}]}});
  const paid={type:'checkout.session.completed',data:{object:{id:'cs_1',subscription:'sub_luis',customer:'cus_luis',client_reference_id:hash}}};
  assert.equal((await hook(paid,{signature:sign(JSON.stringify(paid),'whsec_falso')})).status,400);assert.equal((await hook(paid,{signature:''})).status,400);
  assert.equal((await state(luis)).plus,false);
  const getOnly=await api.handle(new Request('http://interno/api/stripe'));assert.equal(getOnly.status,405);
  // Con la firma buena, se lee la suscripción en Stripe y queda apuntada hasta el final del periodo, con un día de margen.
  r=await hook(paid);assert.deepEqual([r.status,r.data],[200,{received:true}]);assert.equal(sent().path,'/v1/subscriptions/sub_luis');
  s=await state(luis);assert.deepEqual([s.plus,s.plusUntil,s.billing.managed],[true,seconds(end)*1000+BILLING.grace,true]);
  assert.deepEqual(await store.community.subscriptionOf(hash),{until:seconds(end)*1000+BILLING.grace,source:'stripe',customer:'cus_luis'});
  assert.equal((await state(ana)).plus,false,'Solo a quien pagó');
  // Repetir el aviso no cambia nada. Con la suscripción activa no se abre otra página de pago, pero sí el portal.
  await hook(paid);assert.equal((await state(luis)).plusUntil,seconds(end)*1000+BILLING.grace);
  assert.equal((await post({action:'suscribirse'},luis)).data.code,'activa');
  r=await post({action:'gestionar-suscripcion'},luis);assert.deepEqual(r.data,{url:'https://billing.stripe.test/portal'});assert.deepEqual(sent().form,{customer:'cus_luis',return_url:'http://juego.faraday.test/'});

  // La renovación llega como factura pagada (la suscripción va dentro de `parent`): se alarga un mes.
  const next=end+30*DAY;subs.get('sub_luis').items.data[0].current_period_end=seconds(next);
  await hook({type:'invoice.paid',data:{object:{id:'in_2',parent:{type:'subscription_details',subscription_details:{subscription:'sub_luis'}}}}});
  assert.equal((await state(luis)).plusUntil,seconds(next)*1000+BILLING.grace);
  // En versiones antiguas de la API la factura lleva la suscripción arriba.
  assert.equal((await hook({type:'invoice.paid',data:{object:{id:'in_3',subscription:'sub_luis'}}})).data.ignored,undefined);

  // Un cobro fallido: Stripe lo reintenta; mientras, quedan tres días.
  subs.get('sub_luis').status='past_due';await hook({type:'invoice.payment_failed',data:{object:{parent:{subscription_details:{subscription:'sub_luis'}}}}});
  assert.equal((await state(luis)).plusUntil,clock+BILLING.overdue);
  // Si paga, vuelve a estar al día.
  subs.get('sub_luis').status='active';await hook({type:'customer.subscription.updated',data:{object:{id:'sub_luis'}}});
  assert.equal((await state(luis)).plusUntil,seconds(next)*1000+BILLING.grace);

  // La baja: deja de valer en el momento. Puede volver a suscribirse, ya como cliente.
  subs.get('sub_luis').status='canceled';r=await hook({type:'customer.subscription.deleted',data:{object:{id:'sub_luis'}}});assert.equal(r.status,200);
  s=await state(luis);assert.deepEqual([s.plus,s.plusUntil,s.billing.managed],[false,null,true]);
  r=await post({action:'suscribirse'},luis);assert.equal(r.status,200);assert.deepEqual([sent().form.customer,sent().form.customer_email],['cus_luis',undefined]);

  // Lo que no interesa se da por recibido sin tocar nada: otros avisos, pagos sueltos y suscripciones sin jugador.
  subs.set('sub_ajena',{id:'sub_ajena',status:'active',customer:'cus_x',metadata:{player:'no-es-un-jugador'},items:{data:[{current_period_end:seconds(end)}]}});
  for(const event of [{type:'charge.succeeded',data:{object:{id:'ch_1'}}},{type:'checkout.session.completed',data:{object:{id:'cs_2',subscription:null}}},{type:'customer.subscription.updated',data:{object:{id:'sub_ajena'}}},{type:'invoice.paid',data:{object:{id:'in_9'}}}])
    assert.deepEqual((await hook(event)).data,{received:true,ignored:true},event.type);
  // Si Stripe no responde, el aviso falla para que lo reintente; la página de pago dice que no está disponible.
  down=true;assert.equal((await hook(paid)).status,500);assert.equal((await post({action:'suscribirse'},ana)).data.code,'cobro');down=false;
  subs.get('sub_luis').status='active';assert.equal((await hook(paid)).status,200);assert.equal((await state(luis)).plus,true);

  console.log('stripe: OK');
}finally{fs.rmSync(directory,{recursive:true,force:true})}

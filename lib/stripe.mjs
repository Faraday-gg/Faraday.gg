// El cobro de la suscripción con Stripe (decisión 0077, fase 5 de la decisión 0055). Sin dependencias: habla con la API
// de Stripe por HTTPS y comprueba a mano la firma de sus avisos. Aquí no se guarda nada: quién tiene la suscripción
// sigue en el almacén (lib/suscripcion.mjs, tabla `subscriptions`), que es lo único que mira el juego.
//   createStripe: las llamadas a Stripe (página de pago, portal del cliente, leer una suscripción, comprobar un aviso).
//   createBilling: las acciones del jugador («suscribirse», «gestionar-suscripcion») y el aviso de pago (/api/stripe).
// Variables de entorno (ARQUITECTURA.md): STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET y STRIPE_PRICE_ID. Sin las dos
// de la clave y el precio, la suscripción no se puede contratar y todo lo demás funciona.
import {createHmac,timingSafeEqual} from 'node:crypto';

const API='https://api.stripe.com/v1',TOLERANCE=300,HASH=/^[0-9a-f]{64}$/;
// grace = margen tras el final del periodo pagado, para que una renovación que tarda no corte el acceso.
// overdue = acceso que se da mientras Stripe reintenta un cobro fallido.
export const BILLING={grace:86400000,overdue:3*86400000};

export function createStripe({secret='',webhookSecret='',price='',fetch:request=globalThis.fetch,now=Date.now}={}){
  const enabled=!!(secret&&price);
  async function call(method,path,params=null){
    const query=params?new URLSearchParams(Object.entries(params).filter(([,value])=>value!=null).map(([key,value])=>[key,String(value)])).toString():'';
    const response=await request(API+path+(method==='GET'&&query?'?'+query:''),{method,headers:{Authorization:'Bearer '+secret,...(method==='POST'?{'Content-Type':'application/x-www-form-urlencoded'}:{})},body:method==='POST'?query:undefined,signal:AbortSignal.timeout(10000)});
    const data=await response.json().catch(()=>null);
    if(!response.ok)throw Error(`Stripe respondió ${response.status}: ${String(data?.error?.message||'').slice(0,160)}`);
    return data;
  }
  let cached;
  return {
    enabled,
    // La página de pago de Stripe para suscribirse. player = el jugador de la cuenta: vuelve en el aviso de pago.
    // customer = su cliente de Stripe si ya tuvo suscripción (así no se crea otro); si no, se le propone su correo.
    async checkout({player,email,customer,origin}){
      const session=await call('POST','/checkout/sessions',{mode:'subscription','line_items[0][price]':price,'line_items[0][quantity]':1,
        success_url:`${origin}/?suscripcion=ok`,cancel_url:`${origin}/?suscripcion=cancelada`,client_reference_id:player,
        ...(customer?{customer}:{customer_email:email}),'metadata[player]':player,'subscription_data[metadata][player]':player});
      return session.url;
    },
    // El portal de Stripe, donde el cliente cambia la tarjeta o cancela.
    async portal({customer,origin}){return (await call('POST','/billing_portal/sessions',{customer,return_url:`${origin}/`})).url},
    // Una suscripción de Stripe, con lo que hace falta: {id, player, customer, status, periodEnd} (periodEnd en milisegundos).
    // El final del periodo va en cada artículo de la suscripción (en versiones antiguas de la API, en la suscripción misma).
    async subscription(id){
      const sub=await call('GET','/subscriptions/'+encodeURIComponent(id)),ends=[sub.current_period_end,...(sub.items?.data||[]).map(item=>item.current_period_end)].filter(Number.isFinite);
      return {id:sub.id,player:sub.metadata?.player||null,customer:typeof sub.customer==='string'?sub.customer:sub.customer?.id||null,status:sub.status,periodEnd:ends.length?Math.max(...ends)*1000:0};
    },
    // El precio, para enseñarlo: {amount (en céntimos), currency, interval} o null si no se puede leer.
    async priceInfo(){
      if(!enabled)return null;
      if(cached===undefined){try{const data=await call('GET','/prices/'+encodeURIComponent(price));cached={amount:data.unit_amount,currency:data.currency,interval:data.recurring?.interval||null}}catch{return null}}
      return cached;
    },
    // Comprueba que un aviso viene de Stripe: la cabecera Stripe-Signature lleva la hora (t) y una o varias firmas (v1),
    // que son el HMAC-SHA256 de «hora.cuerpo» con el secreto del aviso. Devuelve el aviso, o null si no vale.
    verify(raw,header){
      if(!webhookSecret||typeof header!=='string'||typeof raw!=='string')return null;
      const parts=header.split(',').map(part=>part.trim().split('=')),stamp=parts.find(([key])=>key==='t')?.[1],signatures=parts.filter(([key])=>key==='v1').map(([,value])=>value);
      if(!/^\d+$/.test(stamp||'')||Math.abs(now()/1000-Number(stamp))>TOLERANCE)return null;
      const expected=Buffer.from(createHmac('sha256',webhookSecret).update(`${stamp}.${raw}`).digest('hex'));
      if(!signatures.some(value=>{const given=Buffer.from(String(value));return given.length===expected.length&&timingSafeEqual(given,expected)}))return null;
      try{return JSON.parse(raw)}catch{return null}
    }
  };
}

// De qué suscripción habla un aviso de Stripe, o null si no interesa.
function subscriptionId(event){
  const object=event?.data?.object;if(!object||typeof event.type!=='string')return null;
  if(event.type==='checkout.session.completed')return typeof object.subscription==='string'?object.subscription:null;
  if(event.type.startsWith('customer.subscription.'))return typeof object.id==='string'?object.id:null;
  if(event.type==='invoice.paid'||event.type==='invoice.payment_failed'){const id=object.parent?.subscription_details?.subscription??object.subscription;return typeof id==='string'?id:null}
  return null;
}

export function createBilling({stripe,community,now=Date.now,log=console.error}){
  const off={status:503,body:{error:'La suscripción todavía no se puede contratar.',code:'cobro'}};
  return {
    // Lo que el navegador necesita para enseñar el plan: si se puede contratar, el precio y si el jugador ya es cliente.
    async info(player){
      if(!stripe?.enabled)return {enabled:false,price:null,managed:false};
      const row=await community.subscriptionOf(player).catch(()=>null);
      return {enabled:true,price:await stripe.priceInfo(),managed:!!row?.customer};
    },
    // «suscribirse» devuelve la dirección de la página de pago; «gestionar-suscripcion», la del portal de Stripe.
    async action(data,{player,account,origin}){
      if(!stripe?.enabled)return off;
      try{
        const row=await community.subscriptionOf(player);
        if(data.action==='gestionar-suscripcion'){
          if(!row?.customer)return {status:409,body:{error:'No tienes una suscripción que gestionar.',code:'sin-suscripcion'}};
          return {status:200,body:{url:await stripe.portal({customer:row.customer,origin})}};
        }
        if(!account?.email)return {status:403,body:{error:'Para suscribirte hace falta una cuenta con el correo comprobado.',code:'cuenta'}};
        if(row&&row.source==='stripe'&&row.until>now())return {status:409,body:{error:'Ya tienes la suscripción activa.',code:'activa'}};
        return {status:200,body:{url:await stripe.checkout({player,email:account.email,customer:row?.customer||null,origin})}};
      }catch(error){log('Suscripción (Stripe):',error?.message||error);return off}
    },
    // El aviso de pago de Stripe (POST /api/stripe). raw = el cuerpo tal cual llegó; signature = la cabecera
    // Stripe-Signature. Sea cual sea el aviso, se lee la suscripción en Stripe y se apunta hasta cuándo vale: así da
    // igual el orden en que lleguen los avisos y que alguno se repita.
    async webhook(raw,signature){
      if(!stripe?.enabled)return off;
      const event=stripe.verify(raw,signature);
      if(!event)return {status:400,body:{error:'Firma no válida'}};
      const id=subscriptionId(event);
      if(!id)return {status:200,body:{received:true,ignored:true}};
      try{
        const sub=await stripe.subscription(id);
        if(!HASH.test(sub.player||''))return {status:200,body:{received:true,ignored:true}};
        const at=now(),until=sub.status==='active'||sub.status==='trialing'?sub.periodEnd+BILLING.grace:sub.status==='past_due'?Math.min(sub.periodEnd,at+BILLING.overdue):Math.min(sub.periodEnd||at,at);
        await community.setSubscription(sub.player,until,'stripe',sub.id,sub.customer);
        return {status:200,body:{received:true}};
      }catch(error){
        // Con un 500, Stripe lo vuelve a intentar más tarde.
        log('Suscripción (aviso de Stripe):',error?.message||error);return {status:500,body:{error:'No se pudo apuntar la suscripción'}};
      }
    }
  };
}

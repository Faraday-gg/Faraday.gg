// La suscripción (decisión 0076, fase 5 de la decisión 0055), sin el cobro: qué da el plan de pago, quién lo tiene y
// hasta cuándo. Todavía no hay proveedor de pagos: una suscripción solo existe si alguien la apunta en el almacén
// (tabla `subscriptions` en Supabase). Cuando haya proveedor, su aviso de pago escribirá esa misma fila.
//   duels = duelos al día en el plan gratuito (con suscripción no hay tope).
//   Lo demás que da la suscripción está donde se usa: sin tope de anuncios en el mercado (lib/mercado.mjs), sin
//   publicidad (dist/ads.js) y las piezas de suscriptor del armario (dist/avatar.js, `plus`).
export const PLAN={duels:5};

// Las suscripciones del almacén en memoria (servidor local y pruebas): {jugador: {until, source, ref}}.
export function memorySubscriptions(data,{save}){
  data.subscriptions??={};
  return {
    // La suscripción de un jugador ({until, source}) o null. until = hasta cuándo vale, en milisegundos.
    async subscriptionOf(player){const row=data.subscriptions[player];return row?{until:row.until,source:row.source}:null},
    // Apunta o cambia la suscripción de un jugador. source = de dónde viene (el proveedor de pagos, o «manual»).
    async setSubscription(player,until,source='manual',ref=null){data.subscriptions[player]={until,source,ref};save()}
  };
}

// Devuelve planOf(player) → {plus, until}: si el jugador tiene la suscripción en vigor y hasta cuándo. Si el almacén
// falla (por ejemplo, sin la migración aplicada), nadie tiene suscripción y el juego sigue funcionando.
export function createPlan({community,now,log=console.error}){
  return async function planOf(player){
    try{
      const row=community.subscriptionOf?await community.subscriptionOf(player):null;
      return row&&row.until>now()?{plus:true,until:row.until}:{plus:false,until:null};
    }catch(error){log('Suscripción:',error?.message||error);return {plus:false,until:null}}
  };
}

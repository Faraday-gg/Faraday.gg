// Reglas del mercado de artículos de colección (decisión 0073, fase 4 de la decisión 0055). Aquí solo hay cifras y
// cuentas; los anuncios los guarda el almacén (lib/comunidad.mjs en memoria, lib/stores.mjs en Supabase) y las acciones
// están en lib/comunidad.mjs. El navegador no las repite: las recibe con el tablón (acción «mercado»).
//   fee = comisión de cada venta, en tanto por ciento: se destruye. max = anuncios activos por cuenta (los suscriptores no
//   tendrán tope cuando exista la suscripción). level = nivel para vender. maxPrice = precio más alto que se acepta.
export const MARKET={fee:10,max:3,level:10,maxPrice:1000000,sales:30};
// Comisión de una venta a ese precio, redondeada hacia arriba (como market_buy en Supabase).
export const feeOf=(price,percent=MARKET.fee)=>Math.min(price,Math.ceil(price*percent/100));

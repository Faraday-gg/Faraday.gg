// Mercado de artículos de colección (decisiones 0073 y 0074, fase 4 de la decisión 0055): anuncios con «compra ya»,
// subastas con pujas, y los indicadores del tablón. Aquí están las reglas, las cuentas, el mercado del almacén en
// memoria (memoryMarket) y las acciones de POST /api/progreso (createMarket). El almacén de Supabase está en
// lib/stores.mjs, con las mismas operaciones como funciones de la base de datos (supabase/migrations/…_mercado.sql).
//
// Un anuncio: {id, edition, serial, seller, buyNow, startBid, topBid, topBidder, bids, endsAt, status, soldPrice, soldBy,
// fee, buyer, at, closedAt}. buyNow = precio de «compra ya» (o null); startBid = puja mínima de salida (o null: sin
// subasta); endsAt = cuándo acaba la subasta, en milisegundos (null si no hay). status: activo, vendido, retirado o caducado.
import {EDITIONS} from './catalogo.mjs';

//   fee = comisión de cada venta, en tanto por ciento: se destruye. max = anuncios activos por cuenta (los suscriptores no
//   tendrán tope cuando exista la suscripción). level = nivel para vender. step = cuánto hay que subir una puja, en tanto
//   por ciento. hours = duraciones de subasta que se pueden elegir. snipe = si se puja con menos de esto por delante, la
//   subasta se alarga hasta que quede eso (milisegundos). sales = ventas que se leen para los indicadores.
export const MARKET={fee:10,max:3,level:10,maxPrice:1000000,step:5,hours:[1,6,12,24,72],snipe:60000,sales:300,feed:40,mine:30};
// Comisión de una venta a ese precio, redondeada hacia arriba (como en Supabase).
export const feeOf=(price,percent=MARKET.fee)=>Math.min(price,Math.ceil(price*percent/100));
// La puja más baja que se acepta ahora en un anuncio (null si no admite pujas).
export const nextBid=(listing,step=MARKET.step)=>listing.startBid==null?null:listing.topBid?listing.topBid+Math.max(1,Math.ceil(listing.topBid*step/100)):listing.startBid;
const DAY=86400000,live=(listing,now)=>listing.status==='activo'&&(listing.endsAt==null||listing.endsAt>now);

// Indicadores del tablón. open = anuncios activos; sales = ventas [{edition, serial, price, fee, by, at}], de la más
// reciente a la más antigua; owners = {edición: {owners, units}}; counts = {edición: unidades emitidas}.
export function marketStats({editions,open,sales,owners={},counts={},now}){
  const within=(list,span)=>list.filter(sale=>now-sale.at<=span),sum=(list,key='price')=>list.reduce((total,sale)=>total+sale[key],0);
  const per=editions.map(edition=>{
    const offers=open.filter(one=>one.edition===edition.id),sold=sales.filter(sale=>sale.edition===edition.id),week=within(sold,7*DAY);
    const fixed=offers.filter(one=>one.buyNow!=null).map(one=>one.buyNow),bids=offers.filter(one=>one.topBid).map(one=>one.topBid);
    const [last,previous]=sold,prices=sold.map(sale=>sale.price);
    return {id:edition.id,n:edition.n,name:edition.name,total:edition.total,minted:Math.min(edition.total,counts[edition.id]||0),owners:owners[edition.id]?.owners||0,
      onSale:offers.length,auctions:offers.filter(one=>one.startBid!=null).length,floor:fixed.length?Math.min(...fixed):null,topBid:bids.length?Math.max(...bids):null,
      last:last?.price??null,change:last&&previous?Math.round((last.price-previous.price)/previous.price*1000)/10:null,
      avg7:week.length?Math.round(sum(week)/week.length):null,sales7:week.length,volume7:sum(week),sales24:within(sold,DAY).length,
      high:prices.length?Math.max(...prices):null,low:prices.length?Math.min(...prices):null,sales:sold.length,
      // La gráfica: las últimas ventas, de la más antigua a la más reciente.
      history:sold.slice(0,60).reverse().map(({price,at})=>({price,at}))};
  });
  const day=within(sales,DAY),week=within(sales,7*DAY);
  return {global:{listings:open.length,auctions:open.filter(one=>one.startBid!=null).length,sales24:day.length,volume24:sum(day),sales7:week.length,volume7:sum(week),burned7:sum(week,'fee'),items:editions.length},editions:per};
}

// El mercado del almacén en memoria (servidor local y pruebas). data = los datos de lib/comunidad.mjs; note apunta en el
// libro; save guarda. Hace lo mismo que las funciones de la base de datos.
export function memoryMarket(data,{note,save,clone}){
  data.listings??=[];data.bids??=[];
  const wallet=player=>data.progress[player]??={state:{},coins:0,gainDay:null,gained:0};
  const pay=(player,amount,reason,ref,day)=>{if(!amount)return;const row=wallet(player);note(player,row.coins,[[reason,amount,String(ref)]],'servidor',day);row.coins+=amount};
  const unitOf=listing=>data.collectibles.find(one=>one.edition===listing.edition&&one.serial===listing.serial);
  const shape=one=>clone(one);
  // Devuelve la puja al que iba ganando y la marca (superada: le han pujado más; devuelta: el anuncio se cerró de otra forma).
  const refund=(listing,status,day)=>{
    const bid=data.bids.find(one=>one.listing===listing.id&&one.status==='activa');if(!bid)return;
    bid.status=status;bid.seen=false;pay(bid.bidder,bid.amount,'mercado-puja-devuelta',bid.id,day);
  };
  function buy(listing,buyer,percent,day,now){
    if(!live(listing,now))return {error:'cerrado'};
    if(listing.buyNow==null)return {error:'sin-compra'};
    if(listing.seller===buyer)return {error:'propio'};
    const own=listing.topBidder===buyer?listing.topBid:0;
    if(wallet(buyer).coins+own<listing.buyNow)return {error:'saldo',coins:wallet(buyer).coins};
    const unit=unitOf(listing);
    if(!unit||unit.owner!==listing.seller){refund(listing,'devuelta',day);Object.assign(listing,{status:'retirado',closedAt:now});save();return {error:'cerrado'}}
    refund(listing,'devuelta',day);
    const fee=feeOf(listing.buyNow,percent);
    pay(buyer,-listing.buyNow,'mercado-compra',listing.id,day);pay(listing.seller,listing.buyNow-fee,'mercado-venta',listing.id,day);
    unit.owner=buyer;Object.assign(listing,{status:'vendido',buyer,soldPrice:listing.buyNow,soldBy:'compra',fee,closedAt:now,buyerSeen:true});save();
    return {coins:wallet(buyer).coins,edition:listing.edition,serial:listing.serial,price:listing.buyNow,fee};
  }
  return {
    // Publica un anuncio: {id} o {error: 'no-tuya' | 'anunciada' | 'tope'} (max null = sin tope).
    async marketList(seller,edition,serial,{buyNow=null,startBid=null,hours=null},max,now=Date.now()){
      const unit=data.collectibles.find(one=>one.edition===edition&&one.serial===serial);
      if(!unit||unit.owner!==seller)return {error:'no-tuya'};
      if(data.listings.some(one=>one.status==='activo'&&one.edition===edition&&one.serial===serial))return {error:'anunciada'};
      if(max!=null&&data.listings.filter(one=>one.status==='activo'&&one.seller===seller).length>=max)return {error:'tope'};
      const listing={id:data.listings.length+1,edition,serial,seller,buyNow,startBid,topBid:null,topBidder:null,bids:0,endsAt:startBid!=null?now+hours*3600000:null,
        status:'activo',soldPrice:null,soldBy:null,fee:0,buyer:null,sellerSeen:false,buyerSeen:false,at:now,closedAt:null};
      data.listings.push(listing);save();return {id:listing.id};
    },
    // Retira un anuncio del vendedor: {ok} o {error: 'cerrado' | 'pujas'} (con pujas ya no se puede retirar).
    async marketCancel(id,seller,now=Date.now()){
      const listing=data.listings.find(one=>one.id===id&&one.seller===seller&&one.status==='activo');
      if(!listing)return {error:'cerrado'};if(listing.bids>0)return {error:'pujas'};
      Object.assign(listing,{status:'retirado',closedAt:now,sellerSeen:true});save();return {ok:true};
    },
    // «Compra ya»: cobra al comprador, paga al vendedor el precio menos la comisión (que se destruye), devuelve la puja
    // que hubiera, cambia el dueño y cierra el anuncio. {coins, edition, serial, price, fee} o {error}.
    async marketBuy(id,buyer,percent,day=null,now=Date.now()){const listing=data.listings.find(one=>one.id===id);return listing?buy(listing,buyer,percent,day,now):{error:'cerrado'}},
    // Puja: retiene los faradios del que puja y devuelve los suyos al que iba ganando. Si llega al precio de «compra ya»,
    // compra. {coins, topBid, bids, endsAt} o {error: 'cerrado' | 'sin-pujas' | 'propio' | 'ganando' | 'baja' (con min) | 'saldo'}.
    async marketBid(id,bidder,amount,{percent,step,snipe},day=null,now=Date.now()){
      const listing=data.listings.find(one=>one.id===id);
      if(!listing||!live(listing,now))return {error:'cerrado'};
      if(listing.startBid==null)return {error:'sin-pujas'};
      if(listing.seller===bidder)return {error:'propio'};
      if(listing.topBidder===bidder)return {error:'ganando'};
      const min=nextBid(listing,step);if(amount<min)return {error:'baja',min};
      if(listing.buyNow!=null&&amount>=listing.buyNow)return {...buy(listing,bidder,percent,day,now),bought:true};
      if(wallet(bidder).coins<amount)return {error:'saldo',coins:wallet(bidder).coins};
      const bid={id:data.bids.length+1,listing:id,bidder,amount,status:'activa',seen:true,at:now};
      refund(listing,'superada',day);data.bids.push(bid);pay(bidder,-amount,'mercado-puja',bid.id,day);
      Object.assign(listing,{topBid:amount,topBidder:bidder,bids:listing.bids+1,endsAt:Math.max(listing.endsAt,now+snipe)});save();
      return {coins:wallet(bidder).coins,topBid:amount,bids:listing.bids,endsAt:listing.endsAt};
    },
    // Cierra las subastas que han terminado: con pujas, se la lleva quien más pujó; sin pujas, caduca. Devuelve cuántas.
    async marketSettle(percent,day=null,now=Date.now()){
      const due=data.listings.filter(one=>one.status==='activo'&&one.endsAt!=null&&one.endsAt<=now);
      for(const listing of due){
        const unit=unitOf(listing);
        if(!listing.topBidder){Object.assign(listing,{status:'caducado',closedAt:now});continue}
        if(!unit||unit.owner!==listing.seller){refund(listing,'devuelta',day);Object.assign(listing,{status:'retirado',closedAt:now});continue}
        const fee=feeOf(listing.topBid,percent),bid=data.bids.find(one=>one.listing===listing.id&&one.status==='activa');if(bid)bid.status='ganadora';
        pay(listing.seller,listing.topBid-fee,'mercado-venta',listing.id,day);unit.owner=listing.topBidder;
        Object.assign(listing,{status:'vendido',buyer:listing.topBidder,soldPrice:listing.topBid,soldBy:'puja',fee,closedAt:now});
      }
      if(due.length)save();return due.length;
    },
    // Anuncios activos (también las subastas terminadas que aún no se han cerrado).
    async marketOpen(){return data.listings.filter(one=>one.status==='activo').sort((a,b)=>a.id-b.id).map(shape)},
    // Últimas ventas, de la más reciente a la más antigua.
    async marketSales(limit){return data.listings.filter(one=>one.status==='vendido').sort((a,b)=>b.closedAt-a.closedAt||b.id-a.id).slice(0,limit).map(({edition,serial,soldPrice,fee,soldBy,closedAt})=>({edition,serial,price:soldPrice,fee,by:soldBy,at:closedAt}))},
    // Los anuncios de un jugador, del más reciente al más antiguo.
    async marketMine(player,limit){return data.listings.filter(one=>one.seller===player).sort((a,b)=>b.id-a.id).slice(0,limit).map(shape)},
    // Las pujas de un jugador en anuncios activos (la última de cada anuncio).
    async marketBids(player){
      const out=[];
      for(const bid of [...data.bids].reverse()){const listing=data.listings.find(one=>one.id===bid.listing);if(bid.bidder===player&&listing?.status==='activo'&&!out.some(one=>one.listing===bid.listing))out.push({listing:bid.listing,amount:bid.amount,status:bid.status})}
      return out;
    },
    // Lo que el jugador aún no ha visto: sus ventas, sus anuncios caducados, las subastas que ha ganado y las pujas que le
    // han superado (ya devueltas). Todo queda marcado como visto.
    async marketNotices(player){
      const mine=data.listings.filter(one=>one.seller===player&&!one.sellerSeen),sold=mine.filter(one=>one.status==='vendido'),expired=mine.filter(one=>one.status==='caducado');
      const won=data.listings.filter(one=>one.status==='vendido'&&one.buyer===player&&one.soldBy==='puja'&&!one.buyerSeen);
      const outbid=data.bids.filter(one=>one.bidder===player&&!one.seen&&(one.status==='superada'||one.status==='devuelta'));
      for(const one of [...sold,...expired])one.sellerSeen=true;for(const one of won)one.buyerSeen=true;for(const one of outbid)one.seen=true;
      if(sold.length||expired.length||won.length||outbid.length)save();
      const brief=({id,edition,serial,soldPrice,fee})=>({id,edition,serial,price:soldPrice,fee});
      return {sold:sold.map(brief),expired:expired.map(({id,edition,serial})=>({id,edition,serial})),won:won.map(brief),
        outbid:outbid.map(bid=>{const listing=data.listings.find(one=>one.id===bid.listing);return {listing:bid.listing,edition:listing?.edition,serial:listing?.serial,amount:bid.amount}})};
    },
    // Cuántos dueños distintos y cuántas unidades hay de cada edición.
    async marketOwners(){
      const out={};
      for(const unit of data.collectibles){const one=out[unit.edition]??={owners:new Set,units:0};one.owners.add(unit.owner);one.units++}
      return Object.fromEntries(Object.entries(out).map(([edition,{owners,units}])=>[edition,{owners:owners.size,units}]));
    }
  };
}

// Las acciones del mercado de POST /api/progreso. Devuelve una función (data, {player, account}) → respuesta, o null si
// la acción no es del mercado. community = el almacén; levelOf(player) → nivel del jugador (o null si no hay progreso).
export function createMarket({community,now,today,levelOf,plus=async()=>false,log=console.error}){
  // Con la suscripción no hay tope de anuncios activos (decisión 0076).
  const maxOf=async player=>await plus(player)?null:MARKET.max;
  // Las unidades de colección de un jugador: free = las que tiene en el armario; listed = las que tiene anunciadas, en
  // depósito, con su anuncio. Si el mercado no responde (sin su migración), el armario sigue funcionando sin anuncios.
  async function ownedUnits(player){
    const [all,open]=await Promise.all([community.collectiblesOf(player),community.marketOpen?community.marketOpen().catch(error=>{log('Mercado (anuncios):',error?.message||error);return []}):[]]);
    const mine=open.filter(one=>one.seller===player),isListed=unit=>mine.some(one=>one.edition===unit.edition&&one.serial===unit.serial);
    return {free:all.filter(unit=>!isListed(unit)),listed:mine.filter(one=>all.some(unit=>unit.edition===one.edition&&unit.serial===one.serial))};
  }
  const out=(listing,player)=>({id:listing.id,edition:listing.edition,serial:listing.serial,buyNow:listing.buyNow,startBid:listing.startBid,topBid:listing.topBid,bids:listing.bids,endsAt:listing.endsAt,
    minBid:nextBid(listing),mine:listing.seller===player,winning:listing.topBidder===player});
  const failed={status:503,body:{error:'El mercado no está disponible ahora mismo.',code:'mercado'}};
  async function market(data,{player,account}){
    if(!['mercado','vender','retirar','comprar-anuncio','pujar'].includes(data.action))return null;
    try{
      const at=now();
      if(data.action==='mercado'){
        // Antes de enseñar nada se cierran las subastas terminadas.
        await community.marketSettle(MARKET.fee,today(),at);
        const [counts,open,sales,units,level,notices,mine,bids,owners,progress]=await Promise.all([community.editionCounts(),community.marketOpen(),community.marketSales(MARKET.sales),ownedUnits(player),
          levelOf(player),community.marketNotices(player),community.marketMine(player,MARKET.mine),community.marketBids(player),community.marketOwners(),community.progress(player)]);
        const active=open.filter(one=>one.endsAt==null||one.endsAt>at),editions=[...EDITIONS.values()].filter(edition=>edition.from<=today());
        const max=await maxOf(player);
        return {status:200,body:{now:at,rules:{fee:MARKET.fee,max,level:MARKET.level,maxPrice:MARKET.maxPrice,step:MARKET.step,hours:MARKET.hours},level:level??1,verified:!!account?.email,coins:progress?.coins??0,
          stats:marketStats({editions,open:active,sales,owners,counts,now:at}),
          listings:active.map(one=>out(one,player)),
          units:[...units.free.map(unit=>({...unit,listing:null})),...units.listed.map(({edition,serial,id})=>({edition,serial,listing:id}))],
          mine:mine.map(one=>({...out(one,player),status:one.status,soldPrice:one.soldPrice,soldBy:one.soldBy,fee:one.fee,closedAt:one.closedAt})),
          bids:bids.map(bid=>{const listing=open.find(one=>one.id===bid.listing);return listing?{...out(listing,player),amount:bid.amount}:null}).filter(Boolean),
          sales:sales.slice(0,MARKET.feed).map(({edition,serial,price,by,at:when})=>({edition,serial,price,by,at:when})),notices}};
      }
      if(data.action==='vender'){
        const edition=typeof data.edition==='string'?EDITIONS.get(data.edition):null;
        if(!edition||!Number.isInteger(data.serial)||data.serial<1||data.serial>edition.total)return {status:400,body:{error:'Ese artículo no existe.'}};
        const price=value=>value==null?null:Number.isInteger(value)&&value>=1&&value<=MARKET.maxPrice?value:NaN,buyNow=price(data.buyNow),startBid=price(data.startBid);
        const bad=message=>({status:400,body:{error:message,code:'precio'}});
        if(Number.isNaN(buyNow)||Number.isNaN(startBid))return bad(`Los precios tienen que estar entre 1 y ${MARKET.maxPrice} faradios, sin decimales.`);
        if(buyNow==null&&startBid==null)return bad('Pon un precio de compra ya, una puja de salida o las dos cosas.');
        if(buyNow!=null&&startBid!=null&&buyNow<=startBid)return bad('El precio de compra ya tiene que ser mayor que la puja de salida.');
        if(startBid!=null&&!MARKET.hours.includes(data.hours))return {status:400,body:{error:'Elige cuánto dura la subasta.',code:'duracion'}};
        if(!account?.email)return {status:403,body:{error:'Para vender hace falta una cuenta con el correo comprobado.',code:'cuenta'}};
        const level=await levelOf(player);if(level==null)return failed;
        if(level<MARKET.level)return {status:403,body:{error:`Se puede vender desde el nivel ${MARKET.level}.`,code:'nivel'}};
        const listed=await community.marketList(player,edition.id,data.serial,{buyNow,startBid,hours:startBid!=null?data.hours:null},await maxOf(player),at);
        if(listed.error)return {status:409,body:{error:{'no-tuya':'Ese artículo no es tuyo.',anunciada:'Ese artículo ya está anunciado.',tope:`Ya tienes ${MARKET.max} anuncios activos.`}[listed.error]||'No se pudo anunciar.',code:listed.error}};
        return {status:200,body:{listing:listed.id,edition:edition.id,serial:data.serial,buyNow,startBid,hours:startBid!=null?data.hours:null}};
      }
      if(!Number.isInteger(data.listing)||data.listing<1)return {status:400,body:{error:'Anuncio no válido'}};
      const closed={status:409,body:{error:'Ese anuncio ya no está en venta.',code:'cerrado'}};
      if(data.action==='retirar'){
        const done=await community.marketCancel(data.listing,player,at);
        return done.error==='pujas'?{status:409,body:{error:'Ya tiene pujas: no se puede retirar.',code:'pujas'}}:done.error?closed:{status:200,body:{listing:data.listing}};
      }
      const answer=result=>{
        if(result.error==='saldo')return {status:402,body:{error:'No te llegan los faradios.',code:'saldo'}};
        if(result.error==='baja')return {status:409,body:{error:`La puja mínima es de ${result.min} faradios.`,code:'baja',min:result.min}};
        if(result.error)return {status:409,body:{error:{propio:'Ese anuncio es tuyo.',ganando:'Ya vas ganando esa subasta.','sin-pujas':'Ese anuncio no admite pujas.','sin-compra':'Ese anuncio solo admite pujas.'}[result.error]||closed.body.error,code:result.error}};
        return null;
      };
      if(data.action==='comprar-anuncio'){
        const bought=await community.marketBuy(data.listing,player,MARKET.fee,today(),at);
        return answer(bought)||{status:200,body:{coins:bought.coins,edition:bought.edition,serial:bought.serial,price:bought.price,total:EDITIONS.get(bought.edition)?.total??null}};
      }
      if(!Number.isInteger(data.amount)||data.amount<1||data.amount>MARKET.maxPrice)return {status:400,body:{error:'Puja no válida',code:'precio'}};
      const bid=await community.marketBid(data.listing,player,data.amount,{percent:MARKET.fee,step:MARKET.step,snipe:MARKET.snipe},today(),at);
      return answer(bid)||{status:200,body:bid.bought?{coins:bid.coins,bought:true,edition:bid.edition,serial:bid.serial,price:bid.price,total:EDITIONS.get(bid.edition)?.total??null}:{coins:bid.coins,topBid:bid.topBid,bids:bid.bids,endsAt:bid.endsAt}};
    }catch(error){log('Mercado:',error?.message||error);return failed}
  }
  return {market,ownedUnits};
}

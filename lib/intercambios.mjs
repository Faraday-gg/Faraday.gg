// Intercambios privados de artículos de colección (decisión 0075, fase 4 de la decisión 0055). Dos cuentas se pasan
// unidades numeradas entre sí, sin faradios: cada una pone lo que ofrece, las dos ven lo que reciben y las dos
// confirman. El cambio se hace entero o no se hace. Aquí están las reglas, los intercambios del almacén en memoria
// (memoryTrades) y las acciones de POST /api/progreso (createTrades). El almacén de Supabase está en lib/stores.mjs, con
// las mismas operaciones como funciones de la base de datos (supabase/migrations/…_intercambios.sql).
//
// Un intercambio: {id, code, a, b, aName, bName, aAvatar, bAvatar, offerA, offerB, okA, okB, status, version, at,
// updatedAt}. a = quien lo crea; b = quien entra con el código (null hasta entonces). offerA y offerB = lo que ofrece
// cada uno: [{edition, serial}]. version sube cada vez que cambia una oferta; confirmar exige la versión que se ha visto.
// status: abierto, hecho, cancelado o caducado.
import {EDITIONS} from './catalogo.mjs';

//   units = unidades que puede ofrecer cada lado. open = intercambios abiertos por cuenta. idle = si nadie lo toca en
//   ese tiempo, caduca (milisegundos). recent = cuántos se enseñan en la lista.
export const TRADES={units:10,open:5,idle:30*60000,recent:12};
const ALPHABET='ABCDEFGHJKMNPQRSTUVWXYZ23456789',CODE=/^[A-Z2-9]{6}$/;
export const tradeCode=random=>{let code='';for(let i=0;i<6;i++)code+=ALPHABET[Math.floor(random()*ALPHABET.length)];return code};
const same=(one,other)=>one.edition===other.edition&&one.serial===other.serial;

// Los intercambios del almacén en memoria (servidor local y pruebas). Hace lo mismo que las funciones de la base de datos.
export function memoryTrades(data,{save,clone}){
  data.trades??=[];
  const side=(trade,player)=>trade.a===player?'A':trade.b===player?'B':null;
  // La unidad es de ese jugador y no está anunciada en el mercado.
  const free=(unit,player)=>data.collectibles.some(one=>same(one,unit)&&one.owner===player)&&!(data.listings||[]).some(one=>one.status==='activo'&&same(one,unit));
  const open=(id,player)=>{const trade=data.trades.find(one=>one.id===id);return trade&&trade.status==='abierto'&&side(trade,player)?trade:null};
  return {
    // Crea un intercambio: el intercambio, o {error: 'codigo'} si ese código ya existe.
    async tradeCreate(player,name,avatar,code,now=Date.now()){
      if(data.trades.some(one=>one.code===code))return {error:'codigo'};
      const trade={id:data.trades.length+1,code,a:player,b:null,aName:name,bName:'',aAvatar:avatar,bAvatar:{},offerA:[],offerB:[],okA:false,okB:false,status:'abierto',version:0,at:now,updatedAt:now};
      data.trades.push(trade);save();return clone(trade);
    },
    // Entra con el código: el intercambio, o {error: 'cerrado' | 'lleno'}.
    async tradeJoin(code,player,name,avatar,now=Date.now()){
      const trade=data.trades.find(one=>one.code===code);
      if(!trade||trade.status!=='abierto')return {error:'cerrado'};
      if(side(trade,player))return clone(trade);
      if(trade.b)return {error:'lleno'};
      Object.assign(trade,{b:player,bName:name,bAvatar:avatar,updatedAt:now});save();return clone(trade);
    },
    // Cambia lo que ofrece un jugador. Quita las dos confirmaciones. El intercambio, o {error: 'cerrado' | 'no-disponible'}.
    async tradeOffer(id,player,units,now=Date.now()){
      const trade=open(id,player);if(!trade)return {error:'cerrado'};
      if(!units.every(unit=>free(unit,player)))return {error:'no-disponible'};
      Object.assign(trade,{['offer'+side(trade,player)]:clone(units),okA:false,okB:false,version:trade.version+1,updatedAt:now});save();return clone(trade);
    },
    // Confirma o quita la confirmación. Con las dos, hace el cambio. El intercambio, o {error: 'cerrado' | 'solo' (aún no
    // ha entrado nadie) | 'cambio' (la oferta ha cambiado) | 'vacio' | 'no-disponible' (alguna unidad ya no se puede dar)}.
    async tradeConfirm(id,player,ok,version,now=Date.now()){
      const trade=open(id,player);if(!trade)return {error:'cerrado'};
      if(!trade.b)return {error:'solo'};
      if(trade.version!==version)return {error:'cambio'};
      if(ok&&!trade.offerA.length&&!trade.offerB.length)return {error:'vacio'};
      trade['ok'+side(trade,player)]=!!ok;trade.updatedAt=now;
      if(trade.okA&&trade.okB){
        if(!trade.offerA.every(unit=>free(unit,trade.a))||!trade.offerB.every(unit=>free(unit,trade.b))){Object.assign(trade,{okA:false,okB:false});save();return {error:'no-disponible'}}
        for(const [units,owner] of [[trade.offerA,trade.b],[trade.offerB,trade.a]])for(const unit of units)data.collectibles.find(one=>same(one,unit)).owner=owner;
        trade.status='hecho';
      }
      save();return clone(trade);
    },
    async tradeCancel(id,player,now=Date.now()){const trade=open(id,player);if(!trade)return {error:'cerrado'};Object.assign(trade,{status:'cancelado',updatedAt:now});save();return clone(trade)},
    async tradeGet(id){const trade=data.trades.find(one=>one.id===id);return trade?clone(trade):null},
    // Los intercambios de un jugador, del más reciente al más antiguo.
    async tradesOf(player,limit){return data.trades.filter(one=>side(one,player)).sort((x,y)=>y.id-x.id).slice(0,limit).map(clone)},
    // Caducan los intercambios abiertos del jugador que nadie ha tocado desde `before`.
    async tradeExpire(player,before){let changed=false;for(const trade of data.trades)if(trade.status==='abierto'&&side(trade,player)&&trade.updatedAt<before){trade.status='caducado';changed=true}if(changed)save()}
  };
}

// Las acciones de los intercambios de POST /api/progreso. Devuelve una función (data, {player}) → respuesta, o null si
// la acción no es de intercambios. community = el almacén; ownedUnits(player) → {free, listed} (lib/mercado.mjs);
// cleanName y cleanAvatar limpian lo que manda el navegador.
export function createTrades({community,now,random=Math.random,ownedUnits,cleanName,cleanAvatar,log=console.error}){
  const ACTIONS=['intercambios','intercambio','intercambio-crear','intercambio-unirse','intercambio-ofrecer','intercambio-confirmar','intercambio-cancelar'];
  // Lo que ve un jugador de un intercambio: su lado y el del otro, sin identificadores de cuenta.
  const view=(trade,player)=>{
    const mine=trade.a===player,part=A=>({name:trade[A?'aName':'bName'],avatar:trade[A?'aAvatar':'bAvatar'],offer:trade[A?'offerA':'offerB'],ok:trade[A?'okA':'okB']});
    return {id:trade.id,code:trade.code,status:trade.status,version:trade.version,updatedAt:trade.updatedAt,host:mine,me:part(mine),other:mine&&!trade.b?null:part(!mine)};
  };
  const failed={status:503,body:{error:'Los intercambios no están disponibles ahora mismo.',code:'intercambios'}};
  const ERRORS={cerrado:'Ese intercambio ya no está abierto.',lleno:'En ese intercambio ya hay dos jugadores.','no-disponible':'Alguno de esos artículos ya no se puede intercambiar: no es tuyo o está anunciado en el mercado.',
    solo:'Todavía no ha entrado nadie con tu código.',cambio:'La oferta ha cambiado: revísala antes de confirmar.',vacio:'Poned al menos un artículo.'};
  const answer=(result,player,extra={})=>result.error?{status:409,body:{error:ERRORS[result.error]||'No se pudo hacer.',code:result.error}}:{status:200,body:{trade:view(result,player),...extra}};
  async function trades(data,{player}){
    if(!ACTIONS.includes(data.action))return null;
    try{
      const at=now();
      await community.tradeExpire(player,at-TRADES.idle);
      const units=async()=>(await ownedUnits(player)).free;
      if(data.action==='intercambios'){
        const [list,mine]=await Promise.all([community.tradesOf(player,TRADES.recent),units()]);
        return {status:200,body:{now:at,rules:{units:TRADES.units,open:TRADES.open,minutes:TRADES.idle/60000},trades:list.map(trade=>view(trade,player)),units:mine}};
      }
      if(data.action==='intercambio-crear'){
        if((await community.tradesOf(player,50)).filter(trade=>trade.status==='abierto').length>=TRADES.open)return {status:409,body:{error:`Ya tienes ${TRADES.open} intercambios abiertos: cancela alguno.`,code:'tope'}};
        // El código se sortea; si ya existe, se prueba otro.
        for(let attempt=0;attempt<5;attempt++){
          const made=await community.tradeCreate(player,cleanName(data.name),cleanAvatar(data.avatar),tradeCode(random),at);
          if(!made.error)return {status:200,body:{trade:view(made,player),units:await units()}};
        }
        return failed;
      }
      if(data.action==='intercambio-unirse'){
        const code=typeof data.code==='string'?data.code.trim().toUpperCase():'';
        if(!CODE.test(code))return {status:400,body:{error:'Ese código no es válido: son 6 letras y números.',code:'codigo'}};
        return answer(await community.tradeJoin(code,player,cleanName(data.name),cleanAvatar(data.avatar),at),player,{units:await units()});
      }
      if(!Number.isInteger(data.id)||data.id<1)return {status:400,body:{error:'Intercambio no válido'}};
      if(data.action==='intercambio'){
        const trade=await community.tradeGet(data.id);
        if(!trade||(trade.a!==player&&trade.b!==player))return {status:404,body:{error:'Ese intercambio no existe.'}};
        return {status:200,body:{trade:view(trade,player),units:await units()}};
      }
      if(data.action==='intercambio-ofrecer'){
        const list=Array.isArray(data.units)?data.units:null;
        const valid=list&&list.length<=TRADES.units&&list.every(unit=>unit&&typeof unit.edition==='string'&&EDITIONS.has(unit.edition)&&Number.isInteger(unit.serial)&&unit.serial>=1&&unit.serial<=EDITIONS.get(unit.edition).total);
        if(!valid||list.some((unit,i)=>list.findIndex(other=>same(other,unit))!==i))return {status:400,body:{error:`Se pueden ofrecer hasta ${TRADES.units} artículos de colección, sin repetir.`,code:'oferta'}};
        return answer(await community.tradeOffer(data.id,player,list.map(({edition,serial})=>({edition,serial})),at),player,{units:await units()});
      }
      if(data.action==='intercambio-confirmar'){
        if(!Number.isInteger(data.version)||typeof data.ok!=='boolean')return {status:400,body:{error:'Confirmación no válida'}};
        return answer(await community.tradeConfirm(data.id,player,data.ok,data.version,at),player);
      }
      return answer(await community.tradeCancel(data.id,player,at),player);
    }catch(error){log('Intercambios:',error?.message||error);return failed}
  }
  return {trades};
}

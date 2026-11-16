// Vitrina de colecciones (decisión 0079, fase 6 de la decisión 0055): lo que tiene cada jugador de artículos de
// colección y de piezas con acabado, a la vista de los demás si él quiere. Aquí están las vitrinas del almacén en memoria
// (memoryShowcases) y las acciones de POST /api/progreso (createShowcases). El almacén de Supabase está en lib/stores.mjs.
//
// Una vitrina: {player, code, public, name, avatar}. code = lo que va en el enlace para enseñarla (no es la cuenta).
// Lo que contiene no se guarda: se lee cada vez del inventario (collectibles e items).
import {EDITIONS} from './catalogo.mjs';
import {tradeCode} from './intercambios.mjs';

//   top = coleccionistas que se enseñan en la lista. finishes = piezas con acabado que caben en una vitrina.
export const SHOWCASE={top:20,finishes:60};
const CODE=/^[A-Z2-9]{8}$/,newCode=random=>tradeCode(random)+tradeCode(random).slice(0,2);

// Las vitrinas del almacén en memoria (servidor local y pruebas).
export function memoryShowcases(data,{save,clone}){
  data.showcases??={};
  return {
    async showcaseOf(player){const row=data.showcases[player];return row?clone({player,...row}):null},
    async showcaseByCode(code){const found=Object.entries(data.showcases).find(([,row])=>row.code===code);return found?clone({player:found[0],...found[1]}):null},
    // Guarda la vitrina de un jugador. Si el código ya es de otro, devuelve false.
    async showcaseSave(player,{code,public:open,name,avatar}){
      if(Object.entries(data.showcases).some(([other,row])=>other!==player&&row.code===code))return false;
      data.showcases[player]={code,public:!!open,name,avatar};save();return true;
    },
    // Los coleccionistas con la vitrina a la vista, de más a menos unidades: [{code, name, avatar, units, editions}].
    async showcaseRanking(limit){
      return Object.entries(data.showcases).filter(([,row])=>row.public).map(([player,row])=>{
        const mine=data.collectibles.filter(unit=>unit.owner===player);
        return {code:row.code,name:row.name,avatar:clone(row.avatar),units:mine.length,editions:new Set(mine.map(unit=>unit.edition)).size};
      }).filter(row=>row.units>0).sort((x,y)=>y.units-x.units||y.editions-x.editions||(x.code<y.code?-1:1)).slice(0,limit);
    }
  };
}

// Las acciones de la vitrina de POST /api/progreso. Devuelve una función (data, {player}) → respuesta, o null si la
// acción no es de la vitrina. ownedUnits(player) → {free, listed} (lib/mercado.mjs).
export function createShowcases({community,today,random=Math.random,ownedUnits,cleanName,cleanAvatar,log=console.error}){
  const failed={status:503,body:{error:'Las vitrinas no están disponibles ahora mismo.',code:'vitrinas'}};
  // Lo que hay en la vitrina de un jugador: sus unidades de colección (también las anunciadas, que siguen siendo suyas) y
  // sus piezas con acabado. Con cuántas ediciones de las que han salido tiene alguna unidad.
  async function contents(player){
    const [units,items]=await Promise.all([ownedUnits(player),community.items(player)]),released=[...EDITIONS.values()].filter(edition=>edition.from<=today());
    const all=[...units.free.map(({edition,serial})=>({edition,serial,listed:false})),...units.listed.map(({edition,serial})=>({edition,serial,listed:true}))].sort((x,y)=>x.edition<y.edition?-1:x.edition>y.edition?1:x.serial-y.serial);
    return {units:all,finishes:items.map(one=>one.item).filter(key=>typeof key==='string'&&key.includes('--')).slice(0,SHOWCASE.finishes),
      editions:new Set(all.map(unit=>unit.edition)).size,released:released.length};
  }
  async function showcases(data,{player}){
    if(!['vitrina','vitrina-publicar','coleccionistas'].includes(data.action))return null;
    try{
      if(data.action==='coleccionistas')return {status:200,body:{collectors:await community.showcaseRanking(SHOWCASE.top)}};
      const own=await community.showcaseOf(player);
      if(data.action==='vitrina-publicar'){
        if(typeof data.public!=='boolean')return {status:400,body:{error:'Di si quieres enseñar tu vitrina o no.'}};
        // El código del enlace se sortea la primera vez; si ya existe, se prueba otro.
        for(let attempt=0;attempt<5;attempt++){
          const row={code:own?.code||newCode(random),public:data.public,name:cleanName(data.name),avatar:cleanAvatar(data.avatar)};
          if(await community.showcaseSave(player,row))return {status:200,body:{showcase:{mine:true,code:row.code,public:row.public,name:row.name,avatar:row.avatar,...await contents(player)}}};
        }
        return failed;
      }
      // «vitrina»: sin código, la propia (exista o no); con código, la de otro jugador si la tiene a la vista.
      if(data.code==null)return {status:200,body:{showcase:{mine:true,code:own?.code||null,public:!!own?.public,name:own?.name||'',avatar:own?.avatar||{},...await contents(player)}}};
      const code=typeof data.code==='string'?data.code.trim().toUpperCase():'';
      if(!CODE.test(code))return {status:400,body:{error:'Ese enlace de vitrina no es válido.',code:'codigo'}};
      const other=await community.showcaseByCode(code);
      if(!other||(!other.public&&other.player!==player))return {status:404,body:{error:'Esa vitrina no existe o su dueño no la enseña.',code:'oculta'}};
      return {status:200,body:{showcase:{mine:other.player===player,code:other.code,public:other.public,name:other.name,avatar:other.avatar,...await contents(other.player)}}};
    }catch(error){log('Vitrinas:',error?.message||error);return failed}
  }
  return {showcases};
}

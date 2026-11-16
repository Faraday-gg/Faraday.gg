// Catálogo de la tienda visto desde el servidor (decisión 0062, entrega 4a de la fase 1 de la decisión 0055).
// Las piezas y sus precios están en dist/avatar.js, que es código del navegador: aquí se carga tal cual, sin copiar nada,
// para que el servidor cobre siempre el precio que enseña la tienda. En Vercel ese archivo viaja con la función
// (vercel.json, includeFiles). Si no se puede leer, el catálogo queda vacío y comprar responde que no está disponible.
import fs from 'node:fs';
import vm from 'node:vm';

// Fundición (decisión 0071): reciclar una pieza devuelve `back` de su precio; fundir `need` piezas de la misma rareza
// da una de la siguiente. max = piezas que se pueden reciclar de una vez. Las mismas cifras que dist/progress.js
// (REWARD.foundry); tests/fundicion.test.mjs comprueba que coinciden.
export const FOUNDRY={need:5,back:.2,max:30};
export const RARITY_ORDER=['comun','especial','rara','epica','legendaria'];
export const recycleValue=price=>Math.round(price*FOUNDRY.back);
// Lo que cuesta una pista (dist/pistas.js, COST; tests/tienda.test.mjs comprueba que coinciden).
export const HINT_COST=100;

function load(){
  const page={};page.window=page;vm.createContext(page);
  vm.runInContext(fs.readFileSync(new URL('../dist/avatar.js',import.meta.url),'utf8'),page,{filename:'dist/avatar.js'});
  const {Avatar}=page,pieces=new Map(),editions=new Map();
  // Solo lo que se compra: las piezas de nivel, de «Casi casi», del Circuito, de rango y de medalla se ganan, no se venden.
  for(const item of Avatar.CATALOG)if(item.price>0&&!Avatar.earned(item))pieces.set(item.slot+':'+item.id,{price:item.price,rarity:Avatar.rarity(item),name:item.name,body:item.for||null});
  // Ediciones de colección (decisión 0067): los datos de cada una y las piezas del catálogo que la llevan (una por cuerpo).
  for(const item of Avatar.CATALOG)if(item.edition){
    const edition=editions.get(item.edition.id)||{...item.edition,name:item.name,keys:[]};
    edition.keys.push(item.slot+':'+item.id);editions.set(edition.id,edition);
  }
  return {pieces,editions};
}
let pieces=new Map(),editions=new Map(),problem=null;
try{({pieces,editions}=load())}catch(error){problem=error}
// {clave «hueco:id»: {price, rarity, name, body}} de las piezas que se pueden comprar.
export const PIECES=pieces;
// {id: {id, n, name, total, price, level, from, keys}} de las ediciones de colección.
export const EDITIONS=editions;
export const catalogProblem=problem;

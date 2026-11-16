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
  // Solo lo que se compra: las piezas de nivel, de «Casi casi» y del Circuito se ganan, no se venden.
  for(const item of Avatar.CATALOG)if(item.price>0&&!item.level&&!item.casi&&!item.circuito)pieces.set(item.slot+':'+item.id,{price:item.price,rarity:Avatar.rarity(item),name:item.name,body:item.for||null});
  // Ediciones de colección (decisión 0067): los datos de cada una y las piezas del catálogo que la llevan (una por cuerpo).
  for(const item of Avatar.CATALOG)if(item.edition){
    const edition=editions.get(item.edition.id)||{...item.edition,name:item.name,keys:[]};
    edition.keys.push(item.slot+':'+item.id);editions.set(edition.id,edition);
  }
  // Sets (decisión 0079): se copian a objetos de aquí (los de Avatar son de otro contexto).
  const sets=JSON.parse(JSON.stringify(Avatar.SETS||[])),bonus={each:0,max:0,...Avatar.SET_BONUS};
  return {pieces,editions,sets,bonus};
}
let pieces=new Map(),editions=new Map(),sets=[],bonus={each:0,max:0},problem=null;
try{({pieces,editions,sets,bonus}=load())}catch(error){problem=error}
// {clave «hueco:id»: {price, rarity, name, body}} de las piezas que se pueden comprar.
export const PIECES=pieces;
// {id: {id, n, name, total, price, level, from, keys}} de las ediciones de colección. Las partes de un set (decisión
// 0079) son ediciones que no se compran: llevan además set (su set) y rarity, y su precio y su nivel son 0.
export const EDITIONS=editions;
// Sets: [{id, name, parts: [{key, edition, slot, rarity}]}]. SET_BONUS = {each, max}: extra de faradios por set completo.
export const SETS=sets;
export const SET_BONUS=bonus;
// Los sets que completan esas unidades ([{edition, serial}]) y el extra de faradios que dan: {sets: [id], rate}.
export function setBonus(units){
  const own=new Set(units.map(unit=>unit.edition)),complete=SETS.filter(set=>set.parts.every(part=>own.has(part.edition)));
  return {sets:complete.map(set=>set.id),rate:Math.min(SET_BONUS.max,Math.round(complete.length*SET_BONUS.each*100)/100)};
}
export const catalogProblem=problem;

// Catálogo de la tienda visto desde el servidor (decisión 0062, entrega 4a de la fase 1 de la decisión 0055).
// Las piezas y sus precios están en dist/avatar.js, que es código del navegador: aquí se carga tal cual, sin copiar nada,
// para que el servidor cobre siempre el precio que enseña la tienda. En Vercel ese archivo viaja con la función
// (vercel.json, includeFiles). Si no se puede leer, el catálogo queda vacío y comprar responde que no está disponible.
import fs from 'node:fs';
import vm from 'node:vm';

// Lo que cuesta una pista (dist/pistas.js, COST; tests/tienda.test.mjs comprueba que coinciden).
export const HINT_COST=100;

function load(){
  const page={};page.window=page;vm.createContext(page);
  vm.runInContext(fs.readFileSync(new URL('../dist/avatar.js',import.meta.url),'utf8'),page,{filename:'dist/avatar.js'});
  const {Avatar}=page,pieces=new Map();
  // Solo lo que se compra: las piezas de nivel, de «Casi casi» y del Circuito se ganan, no se venden.
  for(const item of Avatar.CATALOG)if(item.price>0&&!item.level&&!item.casi&&!item.circuito)pieces.set(item.slot+':'+item.id,{price:item.price,rarity:Avatar.rarity(item),name:item.name,body:item.for||null});
  return pieces;
}
let pieces=new Map(),problem=null;
try{pieces=load()}catch(error){problem=error}
// {clave «hueco:id»: {price, rarity, name, body}} de las piezas que se pueden comprar.
export const PIECES=pieces;
export const catalogProblem=problem;

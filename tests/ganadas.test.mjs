// Prueba las piezas del avatar que solo se ganan (decisión 0078): las de rango y las de medalla. Comprueba que el
// catálogo (dist/avatar.js) las marca bien, que cada una apunta a un rango o a una medalla que existe, que los dos cuerpos
// tienen las mismas, que no pasan por la tienda, los acabados ni la fundición, y que el servidor dice el rango más alto.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {RANKS,RULES,TOP,publicRank,applyResult,fresh} from '../lib/rangos.mjs';
import {PIECES} from '../lib/catalogo.mjs';

const page={};page.window=page;vm.createContext(page);
for(const file of ['avatar.js','medals.js'])vm.runInContext(fs.readFileSync(new URL('../dist/'+file,import.meta.url),'utf8'),page,{filename:'dist/'+file});
const {Avatar,Medals}=page,plain=value=>JSON.parse(JSON.stringify(value));

// Los rangos del catálogo son los del servidor, en el mismo orden.
assert.deepEqual(plain(Avatar.RANKS),RANKS.map(rank=>[rank.id,rank.name]));

const byRank=Avatar.CATALOG.filter(item=>item.rango),byMedal=Avatar.CATALOG.filter(item=>item.medalla);
assert.ok(byRank.length>0&&byMedal.length>0);
for(const item of [...byRank,...byMedal]){
  const key=item.slot+':'+item.id;
  assert.equal(item.price,0,`${key}: no tiene precio`);
  assert.ok(Avatar.earned(item),`${key}: es una pieza ganada`);
  assert.equal(Avatar.rarity(item),'nivel',`${key}: no entra en las rarezas de la tienda ni de los cofres`);
  assert.equal(Avatar.finishable(item),false,`${key}: sin acabados`);
  assert.equal(PIECES.has(key),false,`${key}: el servidor no la vende`);
  assert.ok(item.for==='hombre'||item.for==='mujer',`${key}: es de un cuerpo`);
  assert.equal(Avatar.find(item.slot,item.id+'--or'),undefined,`${key}: no tiene versión dorada`);
  // Se puede llevar: un look con ella puesta sigue siendo válido.
  assert.equal(Avatar.normalize({body:item.for,[item.slot]:item.id})[item.slot],item.id);
}
// Cada pieza de rango apunta a un rango que existe; cada pieza de medalla, a una medalla o insignia que existe.
for(const item of byRank)assert.ok(RANKS.some(rank=>rank.id===item.rango),`${item.id}: rango ${item.rango}`);
for(const item of byMedal)assert.ok(Medals.parse(item.medalla),`${item.id}: medalla ${item.medalla}`);
// Bronce y Plata no dan pieza (ahí empieza todo el mundo); de Oro a Científico, sí.
assert.deepEqual([...new Set(byRank.map(item=>item.rango))].sort(),RANKS.slice(2).map(rank=>rank.id).sort());
// Los dos cuerpos tienen las mismas piezas ganadas, con la misma condición.
const gates=body=>[...byRank,...byMedal].filter(item=>item.for===body).map(item=>`${item.slot}:${item.id.replace(/^mj-/,'')}:${item.rango||item.medalla}`).sort();
assert.deepEqual(gates('hombre'),gates('mujer'));
// Las que ya había siguen siendo ganadas, y las de pago no lo son.
assert.ok(Avatar.earned(Avatar.find('top','sud-casi'))&&Avatar.earned(Avatar.find('hat','aureola'))&&Avatar.earned(Avatar.find('hat','enchufe')));
assert.equal(Avatar.earned(Avatar.find('top','sud-gris')),false);assert.equal(Avatar.earned(undefined),false);
assert.ok(PIECES.has('top:sud-gris'));

// El servidor dice el rango más alto alcanzado (best): sale del pico de valoración y no baja al perder.
assert.equal(publicRank(null).best,null,'En posicionamiento no hay rango');
const placed=rating=>({...fresh(),rating,peak:rating,games:RULES.placement});
assert.equal(publicRank(placed(650)).best,'oro');assert.equal(publicRank(placed(TOP)).best,'cientifico');
assert.equal(publicRank({...placed(650),rating:400}).best,'oro','Bajar de rango no quita lo alcanzado');
assert.equal(publicRank({...placed(650),rating:400}).id,'plata');
assert.equal(publicRank({rating:920,games:9}).best,'calculista','Una ficha antigua sin pico usa la valoración');
let record=placed(590);record=applyResult(record,{score:1,mine:590,rival:590}).record;
assert.equal(publicRank(record).best,'oro','Al subir, el rango alcanzado sube con él');

console.log('ganadas: ok');

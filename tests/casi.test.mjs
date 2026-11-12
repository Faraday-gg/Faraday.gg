// Prueba la regla del momento «¡Casi casi!» (dist/casi.js, decisión 0030): qué cuenta, el contador sin repeticiones y
// compatible con el progreso guardado antes de existir, el dato social (sin porcentajes con la muestra simulada) y la
// pieza exclusiva del catálogo (dist/avatar.js): gratis, solo por «Casi casi», nunca en la tienda ni en los cofres.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const page={};page.window=page;vm.createContext(page);
for(const file of ['dist/avatar.js','dist/chests.js','dist/casi.js'])vm.runInContext(fs.readFileSync(new URL('../'+file,import.meta.url),'utf8'),page,{filename:file});
const {Avatar,CasiCasi}=page,{is,normalize,record,social,GOAL,LIMIT}=CasiCasi;

// Qué cuenta: por debajo de 1,1× (exacto incluido); 1,1× justo ya no.
assert.equal(LIMIT,1.1);
for(const factor of [1,1.0001,1.05,1.0999])assert.ok(is(factor),`${factor} es «Casi casi»`);
for(const factor of [1.1,1.25,2,1000,NaN,Infinity,undefined,0.5])assert.ok(!is(factor),`${factor} no es «Casi casi»`);

// Progreso guardado antes de esta versión (sin campo casi) o estropeado: empieza en cero sin romper nada.
for(const saved of [undefined,null,{},'texto',{n:-3,ids:'x'},{n:2.5,ids:[1,null,'']}])assert.deepEqual(JSON.parse(JSON.stringify(normalize(saved))),{n:0,ids:[]});
assert.deepEqual(JSON.parse(JSON.stringify(normalize({n:1,ids:['a','b','a']}))),{n:2,ids:['a','b']},'n nunca es menor que las preguntas contadas');
assert.equal(normalize({n:50,ids:['a']}).n,50,'Se conserva el total aunque la lista esté recortada');

// Cuenta una vez por pregunta: reabrir o repetir la misma no infla el contador.
let state={n:0,ids:[]},result;
result=record(state,{question:'q1',factor:1.04});assert.ok(result.counted);state=result.record;assert.equal(state.n,1);
result=record(state,{question:'q1',factor:1.04});assert.ok(!result.counted,'La misma pregunta no cuenta dos veces');assert.equal(result.record.n,1);
result=record(state,{question:'q2',factor:1.3});assert.ok(!result.counted,'Fuera de 1,1× no cuenta');
result=record(state,{factor:1.01});assert.ok(!result.counted,'Sin pregunta (duelo o evento antiguo) no cuenta');
for(let i=2;i<=GOAL;i++){result=record(state,{question:'q'+i,factor:1});assert.ok(result.counted);state=result.record}
assert.equal(state.n,GOAL);
// La lista de preguntas contadas tiene un tope, pero el total sigue creciendo.
for(let i=0;i<400;i++)state=record(state,{question:'z'+i,factor:1.01}).record;
assert.equal(state.n,GOAL+400);assert.ok(state.ids.length<=300);
// Se guarda como JSON y se recupera igual.
assert.deepEqual(normalize(JSON.parse(JSON.stringify(state))),state);

// Dato social: con la distribución real, el porcentaje de los demás que lo clavaron; con la simulada, ninguno.
assert.equal(social({count:200,near:8}).text,'Solo el 4 % lo ha clavado hoy.');
assert.equal(social({count:200,near:8},{today:false}).text,'Solo el 4 % lo ha clavado.');
assert.equal(social({count:40,near:0}).text,'Nadie más lo ha clavado hoy.');
assert.equal(social({count:1000,near:3}).text,'Menos del 1 % lo ha clavado hoy.');
assert.equal(social({count:10,near:7}).text,'El 70 % lo ha clavado hoy.');
assert.ok(social({count:200,near:8}).real);
for(const data of [null,undefined,{count:0,near:0},{count:50},{count:50,near:'3'}]){const r=social(data);assert.ok(!r.real);assert.doesNotMatch(r.text,/%/,'Sin datos reales no hay porcentaje')}

// La pieza exclusiva: una por cuerpo, gratis, se desbloquea a los GOAL «Casi casi» y nunca entra en cofres ni tienda.
const exclusive=Avatar.CATALOG.filter(item=>item.casi);
assert.equal(exclusive.map(item=>item.for).sort().join(),'hombre,mujer');
for(const item of exclusive){
  assert.equal(item.casi,GOAL);assert.equal(item.price,0);assert.ok(!item.level);
  assert.equal(Avatar.rarity(item),'nivel','Se trata como pieza de desbloqueo, no de tienda');
  assert.equal(Avatar.resolve({body:item.for,top:item.id}).print,'casi','Lleva su estampado propio');
}
// Así filtran progress.js y cofres.test.mjs lo que puede salir en un cofre.
assert.ok(!Avatar.CATALOG.filter(item=>item.price>0&&!item.level).some(item=>item.casi),'No sale en cofres');

console.log('OK: regla de 1,1×, contador sin repeticiones y compatible, dato social sin inventar y pieza exclusiva.');

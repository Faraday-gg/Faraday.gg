// Prueba las medallas e insignias (dist/medals.js, decisión 0035): el catálogo (identificadores únicos y válidos para el
// servidor, niveles crecientes, dibujo y texto de cada una), la regla (qué se consigue con unas cifras), el avance hacia
// el siguiente nivel y que un identificador desconocido no pinta nada.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {AVATAR_SLOTS} from '../lib/duelos.mjs';

const page={};page.window=page;vm.createContext(page);
vm.runInContext(fs.readFileSync(new URL('../dist/medals.js',import.meta.url),'utf8'),page,{filename:'dist/medals.js'});
const {Medals}=page,{MEDALS,BADGES,ALL,TOTAL,TIERS,earned,parse,progress,level,idOf,label,rank,art,chip}=Medals;
const plain=value=>JSON.parse(JSON.stringify(value));

// Catálogo: 12 medallas de cuatro niveles y 11 insignias.
assert.equal(TIERS.length,4);assert.equal(MEDALS.length,12);assert.equal(BADGES.length,11);assert.equal(TOTAL,12*4+11);
assert.equal(new Set(ALL.map(def=>def.id)).size,ALL.length,'Identificadores sin repetir');
assert.equal(new Set(ALL.map(def=>def.name)).size,ALL.length,'Nombres sin repetir');
for(const def of ALL){
  assert.ok(def.goals.every((goal,i)=>Number.isInteger(goal)&&goal>0&&(i===0||goal>def.goals[i-1])),`${def.id}: niveles crecientes`);
  assert.equal(def.goals.length,def.kind==='medalla'?4:1);
  def.goals.forEach((goal,i)=>{
    const id=idOf(def,i+1);
    // El servidor de duelos y ligas solo deja pasar identificadores así (lib/duelos.mjs y lib/ligas.mjs).
    assert.match(id,/^[a-z0-9-]{1,24}$/,`${id}: válido para el servidor`);
    assert.equal(parse(id).def,def);assert.equal(parse(id).tier,i+1);
    assert.match(art(id),/<svg[^>]*>.+<\/svg>/,`${id}: tiene dibujo`);
    assert.ok(def.text(goal).length>10&&def.text(goal).endsWith('.'),`${id}: explica cómo se consigue`);
    assert.ok(label(id).startsWith(def.name));
  });
}
assert.ok(AVATAR_SLOTS.includes('badge'),'El servidor acepta la medalla destacada junto al avatar');
// Las insignias no terminan como un nivel de medalla: no se pueden confundir.
for(const def of BADGES)assert.doesNotMatch(def.id,/-[1-4]$/);

// Sin cifras (jugador nuevo, progreso antiguo o estropeado) no hay nada conseguido y nada se rompe.
for(const stats of [undefined,null,{},{streak:'x',days:-4,casi:NaN,near:Infinity}])assert.deepEqual(plain(earned(stats)),[]);

// Regla: cada nivel alcanzado es un logro; el umbral cuenta, uno menos no.
assert.deepEqual(plain(earned({streak:2})),[]);
assert.deepEqual(plain(earned({streak:3})),['racha-1']);
assert.deepEqual(plain(earned({streak:7.9})),['racha-1','racha-2']);
assert.deepEqual(plain(earned({streak:1000})),['racha-1','racha-2','racha-3','racha-4']);
assert.deepEqual(plain(earned({first:1,pioneer:1,archive:9})),['primera-chispa','pionero'],'El arqueólogo pide 10 retos del archivo');
assert.ok(earned({archive:10}).includes('arqueologo'));
// Un primer reto redondo: primera chispa, día redondo, triplete y pionero de golpe.
assert.deepEqual(plain(earned({days:1,first:1,round:1,trio:1,pioneer:1,near:3})).sort(),['pionero','primera-chispa','redondo-1','triplete']);
// Con todo al máximo se consigue el catálogo entero.
const everything=Object.fromEntries(ALL.map(def=>[def.stat,def.goals.at(-1)]));
assert.equal(earned(everything).length,TOTAL);assert.equal(new Set(earned(everything)).size,TOTAL);

// Avance hacia el siguiente nivel.
const streak=MEDALS.find(def=>def.id==='racha');
assert.deepEqual(plain(progress(streak,{streak:0})),{level:0,complete:false,value:0,goal:3,ratio:0});
assert.deepEqual(plain(progress(streak,{streak:5})),{level:1,complete:false,value:5,goal:7,ratio:5/7});
assert.deepEqual(plain(progress(streak,{streak:250})),{level:4,complete:true,value:250,goal:100,ratio:1});
assert.equal(level(BADGES[0],{first:1}),1);

// Identificadores: lo que no existe no se pinta (llega del servidor, escrito por otro jugador).
for(const id of [undefined,null,'',42,'racha','racha-0','racha-5','racha-3x','<script>','otra-2','triplete-1'])assert.equal(parse(id),null,`${id} no existe`);
for(const id of ['<img onerror=x>','racha-9',undefined])assert.equal(chip(id),'');
assert.match(chip('racha-3'),/class="medal mini"[^>]*data-tier="oro"/);assert.match(chip('racha-3'),/Corriente continua · Oro/);
assert.match(chip('triplete'),/data-kind="insignia"/);assert.doesNotMatch(chip('triplete'),/medal-ribbon/,'La insignia no lleva cinta');
assert.match(art('casi-1',{locked:true}),/data-locked/);
// La vitrina ordena por dificultad: diamante, oro e insignia, plata, bronce.
assert.deepEqual(['racha-1','triplete','casi-4','retos-2','cerca-3'].sort((a,b)=>rank(b)-rank(a)),['casi-4','triplete','cerca-3','retos-2','racha-1']);

console.log(`OK: ${TOTAL} logros (${MEDALS.length} medallas de 4 niveles y ${BADGES.length} insignias), regla, avance e identificadores.`);

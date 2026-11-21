// Prueba las estadísticas del perfil (dist/stats.js, decisión 0113): que las cifras guardadas siempre quedan válidas,
// que una partida no se apunta dos veces aunque se vuelva a abrir, que los duelos con el bot no cuentan, y que la
// comparación de los metros de Ascensión elige el lugar correcto y dice lo que falta para el siguiente.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const page={};page.window=page;vm.createContext(page);
vm.runInContext(fs.readFileSync(new URL('../dist/stats.js',import.meta.url),'utf8'),page,{filename:'dist/stats.js'});
const {Stats}=page,{normalize,tally,duel,compare,distance,render,PLACES}=Stats;
const plain=value=>JSON.parse(JSON.stringify(value));

// Jugador nuevo: todo a cero. Progreso estropeado: tampoco se rompe.
const empty=normalize(null);
assert.deepEqual(plain(empty.ascension),{played:0,total:0,best:0,top:0,seen:{}});
assert.deepEqual(plain(empty.duel),{played:0,won:0,draw:0,lost:0});
assert.equal(empty.answers,0);
for(const broken of ['x',7,{ascension:'no',duel:{played:-3,won:NaN},answers:Infinity},{traza:{seen:[1,2]}}]){
  const fixed=normalize(broken);
  assert.equal(fixed.answers,0);assert.equal(fixed.duel.played,0);assert.equal(fixed.ascension.total,0);
}
// Quien ya jugaba conserva lo que se sabe: tres respuestas por reto y los duelos de su navegador.
const veteran=normalize(undefined,{days:4,wins:5,draws:1,losses:2});
assert.equal(veteran.answers,12);assert.deepEqual(plain(veteran.duel),{played:8,won:5,draw:1,lost:2});
// Lo ya guardado no se vuelve a calcular.
assert.equal(normalize({answers:2},{days:9}).answers,2);

// Ascensión: los metros se apuntan respuesta a respuesta y la partida, al completar las siete repisas.
const plays=normalize(null),heights=[1000,600,0,300,1000,850,100],tops=heights.map(height=>height===1000);
assert.equal(tally(plays,'ascension','2026-11-21:0',heights.slice(0,3),7,tops),true);
assert.deepEqual([plays.ascension.played,plays.ascension.total,plays.ascension.top],[0,1600,1]);
// Volver a abrir la misma partida no suma nada.
assert.equal(tally(plays,'ascension','2026-11-21:0',heights.slice(0,3),7,tops),false);
assert.equal(tally(plays,'ascension','2026-11-21:0',heights,7,tops),true);
assert.deepEqual([plays.ascension.played,plays.ascension.total,plays.ascension.best,plays.ascension.top],[1,3850,3850,2]);
assert.equal(tally(plays,'ascension','2026-11-21:0',heights,7,tops),false);
// Una práctica peor suma metros y partida, pero no cambia la mejor.
assert.equal(tally(plays,'ascension','2026-11-21:1',[100,100,100,100,100,100,100],7),true);
assert.deepEqual([plays.ascension.played,plays.ascension.total,plays.ascension.best],[2,4550,3850]);
// Sobrevive a guardarse y leerse (la cuenta lo devuelve en otro dispositivo).
const back=normalize(plain(plays));
assert.equal(tally(back,'ascension','2026-11-21:1',[100,100,100,100,100,100,100],7),false);
assert.equal(back.ascension.total,4550);

// Traza: las partidas de un día comparten lista; cada tres gráficas es una partida.
assert.equal(tally(plays,'traza','2026-11-21',[900,800,700],3),true);
assert.equal(tally(plays,'traza','2026-11-21',[900,800,700,1000,1000],3),true);
assert.deepEqual([plays.traza.played,plays.traza.total,plays.traza.best],[1,4400,2400]);
assert.equal(tally(plays,'traza','2026-11-21',[900,800,700,1000,1000,1000],3),true);
assert.deepEqual([plays.traza.played,plays.traza.best],[2,3000]);
// Datos raros no rompen ni suman.
assert.equal(tally(plays,'nada','x',[1],1),false);assert.equal(tally(plays,'traza','',[1],1),false);assert.equal(tally(plays,'traza','x',null,3),false);
// Solo se recuerdan las últimas partidas.
for(let i=0;i<30;i++)tally(plays,'archivo','dia:'+i,[10,20,30],3);
assert.equal(plays.archivo.played,30);assert.equal(Object.keys(plays.archivo.seen).length,12);assert.ok('dia:29' in plays.archivo.seen);

// Duelos: por modalidad; ni el bot ni los abandonados cuentan.
assert.equal(duel(plays,{mode:'ranked',result:'win'}),true);
assert.equal(duel(plays,{mode:'duel3',result:'loss'}),true);
assert.equal(duel(plays,{result:'draw'}),true);
assert.equal(duel(plays,{mode:'duel',result:'win',bot:true}),false);
assert.equal(duel(plays,{mode:'duel',result:'loss',abandoned:true}),false);
assert.deepEqual(plain(plays.ranked),{played:1,won:1,draw:0,lost:0});
assert.deepEqual(plain(plays.duel3),{played:1,won:0,draw:0,lost:1});
assert.deepEqual(plain(plays.duel),{played:1,won:0,draw:1,lost:0});

// Comparaciones: lugares en orden creciente y frases con sentido en cada tramo.
assert.ok(PLACES.every((place,i)=>place.m>0&&(i===0||place.m>PLACES[i-1].m)),'Lugares de menor a mayor');
assert.match(compare(0).text,/Juega una Ascensión/);assert.match(compare(0).goal,/la Giralda/);
assert.match(compare(50).goal,/Te faltan 54 m para llegar a la Giralda/);
assert.match(compare(400).text,/más que la Torre Eiffel/);
assert.match(compare(20000).text,/subir 2,2 veces el Everest/);
assert.match(compare(20000).goal,/Te faltan 19 km/);
assert.match(compare(600000).text,/como ir de Madrid a Barcelona, pero hacia arriba/);
assert.match(compare(600000).goal,/para ir de Madrid a París \(1\.053 km\)/);
assert.match(compare(5000000).text,/ir 4,7 veces de Madrid a París/);assert.match(compare(10000000).text,/ir 1,7 veces de Madrid a Nueva York/);
assert.match(compare(10000000).goal,/para ir de Madrid a Tokio/);
assert.match(compare(100000000).text,/dar 2,4 veces la vuelta al mundo/);
assert.equal(compare(500000000).goal,'');
assert.equal(distance(640),'640 m');assert.equal(distance(12400),'12,4 km');assert.equal(distance(1250000),'1.250 km');

// La pestaña: una ficha por juego, con las cifras del resto del progreso.
const html=render(plays,{days:4,casi:3,near:7,round:1,streak:5,duelStreak:2});
for(const id of ['reto','duelos','ascension','traza','archivo'])assert.ok(html.includes(`data-stats="${id}"`),`Ficha de ${id}`);
assert.match(html,/<b>3<\/b><span>«Casi casi»<\/span>/);
assert.match(html,/Has ascendido 4,6 km\./);
assert.match(html,/Clasificatorias<\/span><b>1 de 1 ganados/);
// Un jugador nuevo ve ceros, no errores ni «NaN».
const blank=render(normalize(null));
assert.doesNotMatch(blank,/NaN|undefined|null/);assert.match(blank,/Aún no has subido nada/);

console.log('estadisticas: ok');

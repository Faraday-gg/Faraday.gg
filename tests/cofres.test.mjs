// Prueba las reglas de los cofres (dist/chests.js, decisiones 0027 y 0036) con el catálogo real del avatar (dist/avatar.js):
// probabilidades, garantías, que no se repiten piezas, la garantía por mala suerte y el valor frente al precio.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const page={};page.window=page;vm.createContext(page);
for(const file of ['dist/avatar.js','dist/chests.js'])vm.runInContext(fs.readFileSync(new URL('../'+file,import.meta.url),'utf8'),page,{filename:file});
const {Avatar,Chests}=page,{CHESTS,TYPES,RARITIES,FALLBACK,PITY}=Chests;

// Generador con semilla: las pruebas dan siempre el mismo resultado.
function seeded(seed){return()=>{seed=(seed*16807)%2147483647;return (seed-1)/2147483646}}
const catalog=()=>Avatar.CATALOG.filter(item=>item.price>0&&!item.level).map(item=>({key:item.slot+':'+item.id,rarity:Avatar.rarity(item),price:item.price}));
const near=(value,expected,margin,message)=>assert.ok(Math.abs(value-expected)<=margin,`${message}: ${value} frente a ${expected}`);

// Las tablas suman 1 y solo nombran rarezas que existen.
for(const type of TYPES){
  const chest=CHESTS[type];
  for(const [name,table] of [['odds',chest.odds],['sure',chest.sure]]){
    if(!table)continue;
    near(Object.values(table).reduce((sum,chance)=>sum+chance,0),1,1e-9,`${type}.${name} suma 1`);
    for(const kind of Object.keys(table))assert.ok(kind==='faradios'||RARITIES.includes(kind),`${type}.${name}: ${kind}`);
  }
  assert.equal(chest.coins[0]%5,0);assert.equal((chest.coins[1]-chest.coins[0])%5,0);
}
// Seis cofres, ordenados de más barato a más caro, cada uno con su número de premios.
assert.deepEqual([...TYPES],['chispa','iman','rayo','dinamo','tormenta','faraday']);
// (Array.from: las listas que salen de dist/ son de otro contexto y deepEqual las vería distintas.)
const PRICES=Array.from(TYPES,type=>CHESTS[type].price);
assert.deepEqual(PRICES,[...PRICES].sort((a,b)=>a-b));
assert.equal(new Set(PRICES).size,TYPES.length,'Cada cofre tiene su precio');
assert.deepEqual(Array.from(TYPES,type=>Chests.count(type)),[2,3,3,6,4,5]);
// Lo que distingue a cada uno: Imán solo trae piezas, Dinamo es el que más premios trae y Faraday asegura una legendaria.
assert.equal(CHESTS.iman.odds.faradios,0);
assert.equal(Math.max(...TYPES.map(type=>Chests.count(type))),Chests.count('dinamo'));
assert.deepEqual({...CHESTS.faraday.sure},{legendaria:1});

// El catálogo tiene piezas de todas las rarezas que pueden salir.
const pieces=catalog();
for(const rarity of RARITIES)assert.ok(pieces.some(item=>item.rarity===rarity),`Hay piezas de rareza ${rarity}`);

// Muchas aperturas con el catálogo entero: número de premios, lotes dentro de su rango, garantías y sin repetir pieza.
const random=seeded(20261112),seen=Object.fromEntries(TYPES.map(type=>[type,{}])),ROUNDS=40000;
for(const type of TYPES){
  const chest=CHESTS[type];
  for(let i=0;i<ROUNDS;i++){
    const {rewards}=Chests.roll(type,{items:pieces,pity:0,random});
    assert.equal(rewards.length,Chests.count(type));
    const keys=rewards.filter(reward=>reward.kind==='item').map(reward=>reward.key);
    assert.equal(new Set(keys).size,keys.length,'No se repite pieza en un cofre');
    for(const reward of rewards){
      if(reward.kind==='coins'){assert.ok(reward.amount>=chest.coins[0]&&reward.amount<=chest.coins[1]&&reward.amount%5===0,`Lote de ${reward.amount}`);continue}
      assert.equal(pieces.find(item=>item.key===reward.key).rarity,reward.rarity);
    }
    if(chest.sure){
      const last=rewards.at(-1);assert.equal(last.kind,'item');
      assert.ok(Object.keys(chest.sure).includes(last.rarity),`Premio garantizado de ${type}: ${last.rarity}`);
    }
    for(const reward of rewards.slice(0,chest.slots)){const kind=reward.kind==='coins'?'faradios':reward.rarity;seen[type][kind]=(seen[type][kind]||0)+1}
  }
  // La frecuencia observada se parece a la probabilidad publicada.
  for(const [kind,chance] of Object.entries(chest.odds))near((seen[type][kind]||0)/(ROUNDS*chest.slots),chance,.006,`${type}: frecuencia de ${kind}`);
}

// Garantía por mala suerte: la cuenta sube sin épica ni legendaria, y al llegar al tope el siguiente cofre la trae.
const never=()=>0;
let pity=0;
for(let i=0;i<PITY;i++){
  const result=Chests.roll('chispa',{items:pieces,pity,random:never});
  assert.ok(result.rewards.every(reward=>reward.kind==='coins'));pity=result.pity;
}
assert.equal(pity,PITY);
const saved=Chests.roll('chispa',{items:pieces,pity,random:never});
assert.ok(Chests.high(saved.rewards[0].rarity),'El cofre de la garantía trae épica o legendaria');assert.equal(saved.pity,0);
assert.equal(Chests.roll('tormenta',{items:pieces,pity:3,random}).pity,0,'Tormenta siempre reinicia la cuenta');
assert.equal(Chests.roll('faraday',{items:pieces,pity:3,random}).pity,0,'Faraday siempre reinicia la cuenta');
// Imán: con el catálogo entero, todos sus premios son piezas.
for(let i=0;i<2000;i++)assert.ok(Chests.roll('iman',{items:pieces,random}).rewards.every(reward=>reward.kind==='item'),'Imán solo trae piezas');

// Sin duplicados: nunca sale una pieza que no esté en la lista de las que faltan.
const few=pieces.filter(item=>item.rarity==='rara').slice(0,2);
for(let i=0;i<2000;i++)for(const reward of Chests.roll('rayo',{items:few,random}).rewards)if(reward.kind==='item')assert.ok(few.some(item=>item.key===reward.key));
// Catálogo agotado: todo son faradios, con el lote que corresponde a la rareza que habría tocado.
for(let i=0;i<2000;i++){
  const {rewards}=Chests.roll('tormenta',{items:[],random});
  assert.ok(rewards.every(reward=>reward.kind==='coins'));
  assert.ok(Chests.high(rewards.at(-1).instead)&&rewards.at(-1).amount===FALLBACK[rewards.at(-1).instead]);
}

// Valor: comprar un cofre rinde de media más que su precio en piezas, pero no más del doble.
const prices={};
for(const rarity of RARITIES){const list=pieces.filter(item=>item.rarity===rarity);prices[rarity]=list.reduce((sum,item)=>sum+item.price,0)/list.length}
for(const type of TYPES){
  const ratio=Chests.value(type,prices)/CHESTS[type].price;
  assert.ok(ratio>1.15&&ratio<2,`${type}: valor medio ${Math.round(Chests.value(type,prices))} ≈ por ${CHESTS[type].price} ≈ (×${ratio.toFixed(2)})`);
}

// Hitos de racha y cofre de cada nivel.
assert.deepEqual([2,3,4,6,7,8,14,30,50,99,100,125,150,200,250,300].map(days=>Chests.streakChest(days)),
  [null,'iman',null,null,'tormenta',null,'tormenta','tormenta','tormenta',null,'faraday',null,'tormenta','faraday','tormenta','faraday']);
assert.deepEqual([2,4,5,9,10,15,20,25,30].map(level=>Chests.levelChest(level)),['chispa','chispa','rayo','chispa','dinamo','rayo','dinamo','rayo','dinamo']);

console.log('Cofres: reglas, garantías y valor comprobados.');

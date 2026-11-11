// Cofres (decisión 0027): qué lleva cada uno y cómo se sortea. Aquí solo hay reglas y números, sin pantalla ni
// almacenamiento, para poder probarlas con Node (tests/cofres.test.mjs). progress.js guarda los cofres y reparte los
// premios; chest-open.js pone la apertura.
//
// Cada cofre trae varios premios. Un premio es un lote de faradios o una pieza de la tienda que todavía no se tiene.
// Las probabilidades de cada premio están en `odds` y se enseñan tal cual en la pestaña Cofres.
(root=>{
  const RARITIES=['comun','especial','rara','epica','legendaria'];
  const LABEL={faradios:'Faradios',comun:'Común',especial:'Especial',rara:'Rara',epica:'Épica',legendaria:'Legendaria'};
  // Si ya se tienen todas las piezas de una rareza, el premio pasa a ser este lote de faradios.
  const FALLBACK={comun:40,especial:90,rara:180,epica:380,legendaria:800};
  // Al décimo cofre seguido sin una pieza épica o legendaria, el siguiente la trae seguro.
  const PITY=10;
  // Como mucho, tres cofres comprados al día. Los que se ganan jugando no cuentan.
  const BUY_CAP=3;
  // slots = premios normales; sure = el premio garantizado, si lo hay; coins = lote de faradios [mínimo, máximo].
  const CHESTS={
    chispa:{name:'Chispa',price:120,slots:2,coins:[20,50],
      odds:{faradios:.55,comun:.22,especial:.17,rara:.055,epica:.005,legendaria:0}},
    rayo:{name:'Rayo',price:450,slots:2,coins:[30,70],sure:{rara:.85,epica:.13,legendaria:.02},
      odds:{faradios:.5,comun:.15,especial:.25,rara:.08,epica:.018,legendaria:.002}},
    tormenta:{name:'Tormenta',price:1100,slots:3,coins:[60,120],sure:{epica:.88,legendaria:.12},
      odds:{faradios:.4,comun:0,especial:.25,rara:.25,epica:.085,legendaria:.015}}
  };
  const TYPES=Object.keys(CHESTS);
  const count=type=>CHESTS[type].slots+(CHESTS[type].sure?1:0);
  const rank=rarity=>RARITIES.indexOf(rarity);
  const high=rarity=>rank(rarity)>=rank('epica');

  // Elige una clave de una tabla {clave: probabilidad}. `random` devuelve un número en [0, 1).
  function draw(table,random){
    let left=random();const keys=Object.keys(table);
    for(const key of keys){left-=table[key];if(left<0)return key}
    return keys.findLast(key=>table[key]>0);
  }
  // Abre un cofre. `items` son las piezas que el jugador todavía no tiene ({key, rarity}); `pity`, los cofres que lleva
  // seguidos sin épica o legendaria. Devuelve los premios y la nueva cuenta. No repite pieza dentro del mismo cofre.
  function roll(type,{items=[],pity=0,random=Math.random}={}){
    const chest=CHESTS[type],left={};
    for(const rarity of RARITIES)left[rarity]=items.filter(item=>item.rarity===rarity);
    const coins=()=>{const [min,max]=chest.coins;return {kind:'coins',amount:min+5*Math.floor(random()*((max-min)/5+1))}};
    const piece=rarity=>{
      const pool=left[rarity];if(!pool.length)return {kind:'coins',amount:FALLBACK[rarity],instead:rarity};
      const [item]=pool.splice(Math.floor(random()*pool.length),1);return {kind:'item',key:item.key,rarity};
    };
    const forced=pity>=PITY&&!chest.sure?{epica:.88,legendaria:.12}:null,rewards=[];
    for(let slot=0;slot<chest.slots;slot++){
      const kind=slot===0&&forced?draw(forced,random):draw(chest.odds,random);
      rewards.push(kind==='faradios'?coins():piece(kind));
    }
    // El premio garantizado va el último: es el que se revela al final.
    if(chest.sure)rewards.push(piece(draw(chest.sure,random)));
    const lucky=rewards.some(reward=>high(reward.rarity||reward.instead));
    return {rewards,pity:lucky?0:pity+1};
  }
  // Valor medio de un cofre en faradios, con el precio medio de las piezas de cada rareza (`prices`).
  function value(type,prices){
    const chest=CHESTS[type],lot=(chest.coins[0]+chest.coins[1])/2;
    const of=table=>Object.entries(table).reduce((sum,[kind,chance])=>sum+chance*(kind==='faradios'?lot:prices[kind]||0),0);
    return chest.slots*of(chest.odds)+(chest.sure?of(chest.sure):0);
  }
  // Hitos de racha que dan un cofre Tormenta: 7, 14, 30, 50, 100 y después cada 50 días.
  const streakMilestone=days=>[7,14,30,50,100].includes(days)||(days>100&&days%50===0);
  root.Chests={CHESTS,TYPES,RARITIES,LABEL,FALLBACK,PITY,BUY_CAP,count,rank,high,roll,value,streakMilestone};
})(typeof window!=='undefined'?window:globalThis);

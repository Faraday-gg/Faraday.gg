// Salón (prototipo): reglas y cuentas de la ruleta, la tragaperras y el póker, sin pantalla ni almacenamiento, para
// poder probarlas con Node (tests/casino.test.mjs). casino.js pone el mundo en 3D, los paneles y el monedero.
//
// Todo se juega con faradios de prueba que viven solo en este navegador: no tocan el saldo real ni el servidor.
// Cada juego devuelve un multiplicador «por 1»: lo que vuelve por cada faradio apostado, apuesta incluida (0 = se pierde).
// La parte de la casa no es una comisión aparte: sale de la tabla de pagos de cada juego (ver EDGE).
(root=>{
  // Límites: apuesta mínima y máxima por jugada, y lo más que se puede perder en un día (hora de Madrid).
  const MIN_BET=5,MAX_BET=100,DAILY_LOSS=500,START=1000,FLOOR=100;
  const CHIPS=[5,10,25,50,100];

  // Ruleta europea: un solo cero. La ventaja de la casa es 1/37 (2,7 %) en todas las apuestas.
  const RED=new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
  const WHEEL=[0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26];
  const color=n=>n===0?'green':RED.has(n)?'red':'black';
  const ROULETTE={
    red:{name:'Rojo',pays:2,wins:n=>color(n)==='red'},
    black:{name:'Negro',pays:2,wins:n=>color(n)==='black'},
    even:{name:'Par',pays:2,wins:n=>n>0&&n%2===0},
    odd:{name:'Impar',pays:2,wins:n=>n%2===1},
    low:{name:'1–18',pays:2,wins:n=>n>=1&&n<=18},
    high:{name:'19–36',pays:2,wins:n=>n>=19},
    dozen1:{name:'1.ª docena',pays:3,wins:n=>n>=1&&n<=12},
    dozen2:{name:'2.ª docena',pays:3,wins:n=>n>=13&&n<=24},
    dozen3:{name:'3.ª docena',pays:3,wins:n=>n>=25}
  };
  const spin=(rand=Math.random)=>Math.floor(rand()*37);
  // bet = {type:'number',n} o {type:<clave de ROULETTE>}.
  function roulette(bet,n){
    if(bet?.type==='number')return Number.isInteger(bet.n)&&bet.n>=0&&bet.n<=36&&bet.n===n?36:0;
    const kind=Object.hasOwn(ROULETTE,bet?.type)?ROULETTE[bet.type]:null;return kind&&kind.wins(n)?kind.pays:0;
  }

  // Tragaperras de tres rodillos. Cada rodillo saca un símbolo según su peso. Paga el trío, o la pareja en los dos
  // primeros rodillos. Con estos pesos y pagos devuelve el 92,4 % (slotsReturn lo calcula exacto).
  const SYMBOLS=[
    {id:'faradio',glyph:'≈',weight:1,pays:150},
    {id:'siete',glyph:'7',weight:2,pays:60},
    {id:'estrella',glyph:'★',weight:3,pays:25},
    {id:'rombo',glyph:'♦',weight:4,pays:12},
    {id:'trebol',glyph:'♣',weight:5,pays:8},
    {id:'punto',glyph:'●',weight:6,pays:5}
  ];
  const PAIR=3,TOTAL=SYMBOLS.reduce((sum,s)=>sum+s.weight,0);
  function reel(rand=Math.random){let at=rand()*TOTAL;for(let i=0;i<SYMBOLS.length;i++){at-=SYMBOLS[i].weight;if(at<0)return i}return SYMBOLS.length-1}
  const pull=(rand=Math.random)=>[reel(rand),reel(rand),reel(rand)];
  const slots=([a,b,c])=>a===b&&b===c?SYMBOLS[a].pays:a===b?PAIR:0;
  function slotsReturn(){
    let back=0;
    SYMBOLS.forEach((a,i)=>SYMBOLS.forEach((b,j)=>SYMBOLS.forEach((c,k)=>{back+=a.weight*b.weight*c.weight*slots([i,j,k])})));
    return back/TOTAL**3;
  }

  // Vídeo póker «jotas o mejor»: cinco cartas, se guardan las que se quiera y se cambian las demás una vez.
  // La tabla es la 8/5 (color 5, full 8): jugando bien devuelve en torno al 97 %.
  const SUITS=['♠','♥','♦','♣'],RANKS={11:'J',12:'Q',13:'K',14:'A'};
  const HANDS={
    royal:{name:'Escalera real',pays:250},
    straightFlush:{name:'Escalera de color',pays:50},
    four:{name:'Póker',pays:25},
    full:{name:'Full',pays:8},
    flush:{name:'Color',pays:5},
    straight:{name:'Escalera',pays:4},
    three:{name:'Trío',pays:3},
    twoPair:{name:'Doble pareja',pays:2},
    jacks:{name:'Pareja de jotas o mejor',pays:1},
    nothing:{name:'Nada',pays:0}
  };
  function deck(rand=Math.random){
    const cards=[];for(let s=0;s<4;s++)for(let r=2;r<=14;r++)cards.push({r,s});
    for(let i=cards.length-1;i>0;i--){const j=Math.floor(rand()*(i+1));[cards[i],cards[j]]=[cards[j],cards[i]]}
    return cards;
  }
  const label=card=>`${RANKS[card.r]||card.r}${SUITS[card.s]}`;
  function hand(cards){
    const ranks=cards.map(c=>c.r).sort((a,b)=>a-b),counts={};for(const r of ranks)counts[r]=(counts[r]||0)+1;
    const groups=Object.values(counts).sort((a,b)=>b-a),flush=cards.every(c=>c.s===cards[0].s);
    const wheel=ranks.join()==='2,3,4,5,14',straight=groups.length===5&&(ranks[4]-ranks[0]===4||wheel);
    if(straight&&flush)return ranks[0]===10?'royal':'straightFlush';
    if(groups[0]===4)return 'four';
    if(groups[0]===3&&groups[1]===2)return 'full';
    if(flush)return 'flush';
    if(straight)return 'straight';
    if(groups[0]===3)return 'three';
    if(groups[0]===2&&groups[1]===2)return 'twoPair';
    if(groups[0]===2&&Object.entries(counts).some(([r,n])=>n===2&&Number(r)>=11))return 'jacks';
    return 'nothing';
  }
  // Cambia las cartas que no se guardan por las siguientes del mazo (rest). held = cinco booleanos.
  const draw=(cards,held,rest)=>{let next=0;return cards.map((card,i)=>held[i]?card:rest[next++])};
  const poker=cards=>HANDS[hand(cards)].pays;

  // Monedero de prueba: {coins, day, net}. net = lo perdido hoy (negativo si se va ganando).
  const whole=n=>Number.isFinite(n)?Math.max(0,Math.floor(n)):0;
  function wallet(saved,day,seed=START){
    const first=!saved||typeof saved!=='object',w={coins:first?Math.max(START,whole(seed)):whole(saved.coins),day:first?day:String(saved.day||''),net:first?0:Math.floor(Number(saved.net)||0)};
    // Día nuevo: se pone a cero lo perdido y nadie se queda sin poder jugar.
    if(w.day!==day){w.day=day;w.net=0;if(w.coins<FLOOR)w.coins=FLOOR}
    return w;
  }
  function check(w,amount){
    if(!Number.isInteger(amount)||amount<MIN_BET||amount>MAX_BET)return {ok:false,reason:'bet'};
    if(Math.max(0,w.net)+amount>DAILY_LOSS)return {ok:false,reason:'limit'};
    if(w.coins<amount)return {ok:false,reason:'coins'};
    return {ok:true};
  }
  // Cobra la apuesta y paga el premio de una vez. Devuelve el monedero nuevo y lo ganado o perdido.
  function settle(w,amount,multiplier){
    const delta=Math.round(amount*multiplier)-amount;
    return {wallet:{...w,coins:Math.max(0,w.coins+delta),net:w.net-delta},delta};
  }
  const EDGE={roulette:1/37,slots:1-slotsReturn()};

  root.CasinoRules={MIN_BET,MAX_BET,DAILY_LOSS,START,FLOOR,CHIPS,RED,WHEEL,color,ROULETTE,spin,roulette,SYMBOLS,PAIR,pull,slots,slotsReturn,SUITS,HANDS,deck,label,hand,draw,poker,wallet,check,settle,EDGE};
})(typeof window!=='undefined'?window:globalThis);

// Salón (prototipo): reglas y cuentas de la ruleta, la tragaperras y el póker, sin pantalla ni almacenamiento, para
// poder probarlas con Node (tests/casino.test.mjs). casino.js pone el mundo en 3D, las mesas y el monedero.
//
// Todo se juega con faradios de prueba: no tocan el saldo real. Cada juego de la casa devuelve un multiplicador
// «por 1»: lo que vuelve por cada faradio apostado, apuesta incluida (0 = se pierde).
// La parte de la casa no es una comisión aparte: sale de la tabla de pagos de cada juego (ver EDGE).
(root=>{
  // Límites: apuesta mínima y máxima por jugada, y lo más que se puede perder en un día (hora de Madrid).
  const MIN_BET=5,MAX_BET=100,DAILY_LOSS=500,START=1000,FLOOR=100;
  const CHIPS=[5,10,25,50,100];
  // En la mesa de ruleta las fichas se reparten por el tapete: hay ficha de 1 y el límite se aplica al total del giro.
  const TABLE_CHIPS=[1,5,10,25,50];

  // Ruleta europea: un solo cero. Toda apuesta paga 36 entre los números que cubre, así que la ventaja de la casa
  // es 1/37 (2,7 %) en todas.
  const RED=new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
  const WHEEL=[0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26];
  const color=n=>n===0?'green':RED.has(n)?'red':'black';
  // El tapete, en casillas: el cero ocupa la columna 0, los números las columnas 1–12 (el 3 arriba, el 1 abajo),
  // la columna 13 son las apuestas «2 a 1», y debajo van las docenas y las suertes sencillas.
  // SPOTS[id] = {name, numbers, pays, at}. «at» con w y h es una casilla; sin ellos, un punto entre casillas
  // (caballo, transversal, cuadro, seisena) donde se deja la ficha.
  const column=n=>Math.ceil(n/3),row=n=>2-(n-1)%3;
  const range=(from,to)=>Array.from({length:to-from+1},(_,i)=>from+i);
  const SPOTS={};
  const spot=(id,name,numbers,at)=>{SPOTS[id]={name,numbers,pays:36/numbers.length,at}};
  spot('n0','0',[0],{x:0,y:0,w:1,h:3});
  for(let n=1;n<=36;n++){
    spot('n'+n,String(n),[n],{x:column(n),y:row(n),w:1,h:1});
    if(n<=33)spot(`s${n}-${n+3}`,`Caballo ${n}-${n+3}`,[n,n+3],{x:column(n)+1,y:row(n)+.5});
    if(n%3){
      spot(`s${n}-${n+1}`,`Caballo ${n}-${n+1}`,[n,n+1],{x:column(n)+.5,y:row(n)});
      if(n<=32)spot('c'+n,`Cuadro ${n}-${n+4}`,[n,n+1,n+3,n+4],{x:column(n)+1,y:row(n)});
    }
    if(n%3===1){
      spot('t'+n,`Transversal ${n}-${n+2}`,range(n,n+2),{x:column(n)+.5,y:3});
      if(n<=31)spot('l'+n,`Seisena ${n}-${n+5}`,range(n,n+5),{x:column(n)+1,y:3});
    }
  }
  for(const n of [1,2,3])spot('s0-'+n,`Caballo 0-${n}`,[0,n],{x:1,y:row(n)+.5});
  spot('t0-1-2','Transversal 0-1-2',[0,1,2],{x:1,y:2});
  spot('t0-2-3','Transversal 0-2-3',[0,2,3],{x:1,y:1});
  spot('c0','Cuadro 0-1-2-3',[0,1,2,3],{x:1,y:3});
  for(const k of [1,2,3]){
    spot('col'+k,'2 a 1',range(1,36).filter(n=>row(n)===3-k),{x:13,y:3-k,w:1,h:1});
    spot('dozen'+k,`${k}.ª docena`,range(k*12-11,k*12),{x:k*4-3,y:3,w:4,h:.8});
  }
  [['low','1–18',n=>n<=18],['even','Par',n=>n%2===0],['red','Rojo',n=>RED.has(n)],['black','Negro',n=>!RED.has(n)],
    ['odd','Impar',n=>n%2===1],['high','19–36',n=>n>=19]].forEach(([id,name,wins],i)=>
    spot(id,name,range(1,36).filter(wins),{x:1+i*2,y:3.8,w:2,h:.8}));
  // Apuestas anunciadas: sectores de la rueda que se cubren con varias fichas a la vez. [casilla, fichas].
  const CALLS={
    zero:{name:'Zona cero',chips:[['s0-3',1],['s12-15',1],['n26',1],['s32-35',1]]},
    voisins:{name:'Vecinos del cero',chips:[['t0-2-3',2],['s4-7',1],['s12-15',1],['s18-21',1],['s19-22',1],['c25',2],['s32-35',1]]},
    tiers:{name:'Tercio',chips:[['s5-8',1],['s10-11',1],['s13-16',1],['s23-24',1],['s27-30',1],['s33-36',1]]},
    orphans:{name:'Huérfanos',chips:[['n1',1],['s6-9',1],['s14-17',1],['s17-20',1],['s31-34',1]]}
  };
  const spin=(rand=Math.random)=>Math.floor(rand()*37);
  // Lo que devuelve por 1 la casilla «id» si sale n.
  function roulette(id,n){
    const place=typeof id==='string'&&Object.hasOwn(SPOTS,id)?SPOTS[id]:null;
    return place&&place.numbers.includes(n)?place.pays:0;
  }
  // bets = {casilla: fichas}. Total apostado (NaN si alguna apuesta no vale) y lo que vuelve si sale n.
  function rouletteStake(bets){
    let total=0;
    for(const [id,amount] of Object.entries(bets||{})){
      if(!Object.hasOwn(SPOTS,id)||!Number.isInteger(amount)||amount<1)return NaN;
      total+=amount;
    }
    return total;
  }
  const rouletteReturn=(bets,n)=>Object.entries(bets).reduce((sum,[id,amount])=>sum+amount*roulette(id,n),0);

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

  // Baraja francesa. Carta = {r: 2–14, s: 0–3}.
  const SUITS=['♠','♥','♦','♣'],RANKS={11:'J',12:'Q',13:'K',14:'A'};
  function deck(rand=Math.random){
    const cards=[];for(let s=0;s<4;s++)for(let r=2;r<=14;r++)cards.push({r,s});
    for(let i=cards.length-1;i>0;i--){const j=Math.floor(rand()*(i+1));[cards[i],cards[j]]=[cards[j],cards[i]]}
    return cards;
  }
  const label=card=>`${RANKS[card.r]||card.r}${SUITS[card.s]}`;

  // Texas Hold'em sin límite: dos cartas por jugador y cinco comunes. Aquí no hay casa: los jugadores se juegan
  // el bote entre ellos. El estado es un objeto plano (se guarda tal cual en el servidor) y solo lo cambian
  // start, act y leave.
  const HAND_NAMES=['Carta alta','Pareja','Doble pareja','Trío','Escalera','Color','Full','Póker','Escalera de color'];
  const compare=(a,b)=>{for(let i=0;i<Math.max(a.length,b.length);i++)if((a[i]||0)!==(b[i]||0))return (a[i]||0)-(b[i]||0);return 0};
  function straightHigh(ranks){
    const have=new Set(ranks);if(have.has(14))have.add(1);
    for(let high=14;high>=5;high--){let run=0;while(run<5&&have.has(high-run))run++;if(run===5)return high}
    return 0;
  }
  // La mejor jugada de cinco cartas entre las que se den (de dos a siete). score se compara con compare().
  function best(cards){
    const down=(a,b)=>b-a,count=new Map(),suits=[[],[],[],[]];
    for(const {r,s} of cards){count.set(r,(count.get(r)||0)+1);suits[s].push(r)}
    const ranks=[...count.keys()].sort(down),of=n=>ranks.filter(r=>count.get(r)===n),rest=(skip,n)=>ranks.filter(r=>!skip.includes(r)).slice(0,n);
    const flush=suits.find(list=>list.length>=5)?.sort(down),run=flush&&straightHigh(flush),straight=straightHigh(ranks);
    const [four]=of(4),threes=of(3),pairs=of(2);
    let score;
    if(run)score=[8,run];
    else if(four)score=[7,four,...rest([four],1)];
    else if(threes.length&&(threes.length>1||pairs.length))score=[6,threes[0],Math.max(threes[1]||0,pairs[0]||0)];
    else if(flush)score=[5,...flush.slice(0,5)];
    else if(straight)score=[4,straight];
    else if(threes.length)score=[3,threes[0],...rest(threes,2)];
    else if(pairs.length>1)score=[2,pairs[0],pairs[1],...rest(pairs.slice(0,2),1)];
    else if(pairs.length)score=[1,pairs[0],...rest(pairs,3)];
    else score=[0,...ranks.slice(0,5)];
    return {score,name:score[0]===8&&score[1]===14?'Escalera real':HAND_NAMES[score[0]]};
  }
  function put(player,amount){
    const paid=Math.min(amount,player.stack);
    player.stack-=paid;player.bet+=paid;player.total+=paid;if(!player.stack)player.allin=true;
  }
  // Reparte el bote. Con varios «all-in» hay botes laterales: cada tramo de apuesta se lo juegan solo quienes lo
  // cubrieron. Una apuesta que nadie igualó vuelve así a quien la hizo.
  function finish(s,showdown){
    const n=s.seats.length,won=Array(n).fill(0),live=s.seats.flatMap((p,i)=>p.folded?[]:[i]);
    const hands=s.seats.map(p=>showdown&&!p.folded?best([...p.cards,...s.board]):null);
    const levels=[...new Set(s.seats.map(p=>p.total).filter(Boolean))].sort((a,b)=>a-b),pots=[];
    let previous=0,loose=0;
    for(const level of levels){
      const amount=s.seats.reduce((sum,p)=>sum+Math.max(0,Math.min(p.total,level)-previous),0);
      const eligible=live.filter(i=>s.seats[i].total>=level);previous=level;
      if(eligible.length){pots.push({amount:amount+loose,eligible});loose=0}
      else if(pots.length)pots.at(-1).amount+=amount;
      else loose+=amount;
    }
    if(loose)pots.push({amount:loose,eligible:live});
    const order=i=>(i-s.button-1+n)%n;
    for(const pot of pots){
      let winners=pot.eligible;
      if(showdown){
        const top=pot.eligible.reduce((a,i)=>compare(hands[i].score,hands[a].score)>0?i:a);
        winners=pot.eligible.filter(i=>compare(hands[i].score,hands[top].score)===0);
      }
      winners=[...winners].sort((a,b)=>order(a)-order(b));
      winners.forEach((i,k)=>{won[i]+=Math.floor(pot.amount/winners.length)+(k<pot.amount%winners.length?1:0)});
    }
    s.seats.forEach((p,i)=>{p.stack+=won[i]});
    s.turn=null;s.stage='done';
    s.result={showdown,won,hands:hands.map(hand=>hand&&hand.name),winners:won.flatMap((prize,i)=>prize>s.seats[i].total?[i]:[])};
  }
  // Busca a quién le toca. Si la ronda de apuestas ha terminado, saca las cartas comunes que falten y sigue.
  function advance(s){
    const n=s.seats.length;
    for(;;){
      const live=s.seats.filter(p=>!p.folded);
      if(live.length===1)return finish(s,false);
      const able=live.filter(p=>!p.allin).length;
      for(let k=1;k<=n;k++){
        const i=(s.last+k)%n,p=s.seats[i];
        if(!p.folded&&!p.allin&&(p.bet<s.current||(!p.acted&&able>1))){s.turn=i;return}
      }
      if(s.stage==='river')return finish(s,true);
      s.stage={preflop:'flop',flop:'turn',turn:'river'}[s.stage];
      for(let k=s.stage==='flop'?3:1;k--;)s.board.push(s.deck.pop());
      for(const p of s.seats){p.bet=0;p.acted=false}
      s.current=0;s.minRaise=s.big;s.last=s.button;
    }
  }
  const HOLDEM={
    best,compare,
    // stacks: fichas de cada asiento (0 = no juega esta mano). deck: baraja ya mezclada; se reparte desde el final.
    start({stacks,button,deck:pack,small,big}){
      const seats=stacks.map(stack=>stack>0
        ?{stack,bet:0,total:0,cards:[pack.pop(),pack.pop()],folded:false,allin:false,acted:false}
        :{stack:0,bet:0,total:0,cards:null,folded:true,allin:false,acted:false});
      const n=seats.length,playing=seats.filter(p=>p.cards).length;
      if(playing<2)return null;
      const next=i=>{do i=(i+1)%n;while(!seats[i].cards);return i};
      if(!seats[button]?.cards)button=next(button%n||0);
      // Mano a mano, el botón pone la ciega pequeña y habla primero antes del flop.
      const sb=playing===2?button:next(button),bb=next(sb);
      const s={small,big,button,deck:pack,board:[],stage:'preflop',seats,turn:null,current:big,minRaise:big,last:bb,result:null};
      put(seats[sb],small);put(seats[bb],big);
      advance(s);
      return s;
    },
    // Lo que puede hacer quien tiene el turno: cuánto le cuesta igualar y entre qué cantidades puede subir («hasta»).
    legal(s){
      if(s.turn===null)return null;
      const p=s.seats[s.turn],toCall=Math.min(s.current-p.bet,p.stack),maxTo=p.bet+p.stack;
      const rivals=s.seats.some((other,i)=>i!==s.turn&&!other.folded&&!other.allin);
      return {seat:s.turn,toCall,canCheck:toCall===0,canRaise:rivals&&maxTo>s.current,minTo:Math.min(s.current+s.minRaise,maxTo),maxTo};
    },
    // move = {type:'fold'|'check'|'call'|'raise', to}. Devuelve false si no le toca o la jugada no vale.
    act(s,seat,move){
      const rules=HOLDEM.legal(s);
      if(!rules||rules.seat!==seat||!move)return false;
      const p=s.seats[seat];
      if(move.type==='fold')p.folded=true;
      else if(move.type==='check'){if(!rules.canCheck)return false}
      else if(move.type==='call'){if(rules.canCheck)return false;put(p,rules.toCall)}
      else if(move.type==='raise'){
        const to=move.to;
        if(!rules.canRaise||!Number.isInteger(to)||to<rules.minTo||to>rules.maxTo)return false;
        const more=to-s.current;
        // Una subida completa reabre las apuestas; un «all-in» que no llega a la subida mínima solo obliga a igualar.
        if(more>=s.minRaise){s.minRaise=more;for(const other of s.seats)other.acted=false}
        put(p,to-p.bet);s.current=to;
      }else return false;
      p.acted=true;s.last=seat;
      advance(s);
      return true;
    },
    // Quien se levanta en mitad de una mano se retira, le toque o no.
    leave(s,seat){
      const p=s.seats[seat];
      if(s.stage==='done'||!p||p.folded)return;
      p.folded=true;
      if(s.turn===seat)s.last=seat;
      advance(s);
    },
    pot:s=>s.seats.reduce((sum,p)=>sum+p.total,0)
  };

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

  root.CasinoRules={MIN_BET,MAX_BET,DAILY_LOSS,START,FLOOR,CHIPS,TABLE_CHIPS,RED,WHEEL,color,SPOTS,CALLS,spin,roulette,rouletteStake,rouletteReturn,SYMBOLS,PAIR,pull,slots,slotsReturn,SUITS,deck,label,HOLDEM,wallet,check,settle,EDGE};
})(typeof window!=='undefined'?window:globalThis);

// Progreso del jugador (decisión 0024): nivel y experiencia, faradios (la moneda del juego), racha diaria,
// misiones diarias y semanales, y el armario del avatar (3D, decisión 0025; hombre o mujer, decisión 0028) con su tienda. Todo se guarda en este navegador:
// no hay cuentas ni pagos. Los faradios solo se ganan jugando y solo compran piezas de aspecto y cofres.
// Los cofres (decisiones 0027 y 0036) se ganan jugando o se compran con faradios; sus reglas están en chests.js y su apertura
// en chest-open.js. Aquí se guardan, se conceden y se reparten sus premios.
// El juego avisa con eventos (faraday:answer, faraday:day, faraday:duel) y este archivo reparte las recompensas.
// También lleva el contador de «Casi casi» (respuestas a menos de 1,1×, decisión 0030; la regla está en casi.js), que
// desbloquea gratis una pieza exclusiva del avatar como los niveles desbloquean las suyas.
// Y las medallas e insignias (decisión 0035): aquí se llevan las cifras que las miden, se guarda lo conseguido y se pinta
// la pestaña «Medallas» y la vitrina del perfil. El catálogo, la regla y el dibujo están en medals.js.
(()=>{
  const KEY='casi-casi:progreso',shell=$('#profile-shell'),main=$('#profile-main'),chip=$('#home-profile'),stage=$('#home-avatar');
  const homeProgress=$('#home-progress'),homeProgressLevel=$('#home-progress-level'),homeProgressNote=$('#home-progress-note'),homeProgressFill=$('#home-progress-fill');
  const int=n=>new Intl.NumberFormat('es-ES',{maximumFractionDigits:0,useGrouping:'always'}).format(n);
  const COIN='<span class="coin" aria-hidden="true">≈</span>',coins=n=>`${int(n)} ${COIN}<span class="sr-only"> faradios</span>`;
  const madrid=(date=new Date())=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Madrid'}).format(date);
  const shift=(day,days)=>new Date(Date.parse(day+'T12:00:00Z')+days*86400000).toISOString().slice(0,10);
  const monday=day=>shift(day,-((new Date(day+'T12:00:00Z').getUTCDay()+6)%7));

  // Recompensas: un reto del día da para una pieza sencilla cada dos días; una pieza especial pide una o dos semanas.
  // Subir de nivel da 30 ≈ y un cofre (Dinamo en los niveles múltiplos de 10, Rayo en los demás múltiplos de 5 y Chispa en el resto). charge = lo que carga
  // la batería de cofres cada reto; la de los duelos la calcula duel.js, con su tope diario.
  const REWARD={welcome:100,answerXp:5,todayXp:30,todayCoins:20,archiveXp:10,archiveCoins:5,streakCoins:2,streakCap:7,missionXp:10,
    duel:{win:15,draw:8,loss:5},levelCoins:30,levelChest:Chests.levelChest,charge:{today:40,archive:10,full:100},
    // Economía nueva (decisiones 0056 y 0066): daySet = faradios por recoger las tres misiones del día (antes, un cofre
    // Chispa); dayCap = faradios que se pueden ganar jugando en un día (cuentan los motivos de CAPPED).
    // Sumideros (decisión 0069): swap = cambiar una misión por otra; shield = proteger la racha (desde `from` días).
    swap:30,shield:{price:150,from:3},
    // Duelos al día en el plan gratuito (decisión 0076; lib/suscripcion.mjs, PLAN.duels).
    freeDuels:5,
    // Fundición (decisión 0071): reciclar devuelve `back` del precio; fundir `need` piezas de una rareza da una de la siguiente.
    foundry:{need:5,back:.2,max:30},
    daySet:40,dayCap:400};
  const CAPPED=['reto','archivo','duelos','misiones','traza'];
  // Lo que cabe hoy bajo el tope diario. Con cuenta lo lleva el servidor.
  function underCap(amount,reason){
    if(!(amount>0)||!CAPPED.includes(reason))return amount;
    const today=madrid();if(state.earned?.day!==today)state.earned={day:today,n:0};
    const allowed=Math.max(0,Math.min(amount,REWARD.dayCap-state.earned.n));state.earned.n+=allowed;return allowed;
  }
  const MISSIONS={
    'reto-hoy':{text:'Completa el reto de hoy',goal:1,coins:20,on:'day',when:d=>d.today},
    'cerca-2':{text:'Queda a menos de 2× en una pregunta',goal:1,coins:15,on:'answer',when:d=>d.factor<2},
    'cerca-125':{text:'Clava una: a menos de 1,25×',goal:1,coins:25,on:'answer',when:d=>d.factor<1.25},
    'seis':{text:'Responde 6 preguntas',goal:6,coins:20,on:'answer'},
    'archivo':{text:'Completa un reto del archivo',goal:1,coins:15,on:'day',when:d=>!d.today},
    'duelo':{text:'Juega un duelo',goal:1,coins:15,on:'duel',when:d=>!d.abandoned},
    'duelo-gana':{text:'Gana un duelo',goal:1,coins:25,on:'duel',when:d=>d.result==='win'},
    'sem-retos':{text:'Completa 5 retos del día',goal:5,coins:80,on:'day',when:d=>d.today},
    'sem-cerca':{text:'Queda a menos de 2× en 10 preguntas',goal:10,coins:60,on:'answer',when:d=>d.factor<2},
    'sem-duelos':{text:'Gana 3 duelos',goal:3,coins:80,on:'duel',when:d=>d.result==='win'},
    'sem-jugar':{text:'Juega 5 duelos',goal:5,coins:60,on:'duel',when:d=>!d.abandoned}
  };
  const DAILY=['cerca-2','cerca-125','seis','archivo','duelo','duelo-gana'],WEEKLY=['sem-retos','sem-cerca','sem-duelos','sem-jugar'];
  // Las misiones de cada día y cada semana salen de la fecha: son las mismas para todo el mundo.
  function pick(pool,count,seed){let h=2166136261;for(const c of seed)h=Math.imul(h^c.charCodeAt(0),16777619);const list=[...pool];for(let i=list.length-1;i>0;i--){h=Math.imul(h^h>>>13,1274126177);const j=(h>>>0)%(i+1);[list[i],list[j]]=[list[j],list[i]]}return list.slice(0,count)}

  // chests = cofres sin abrir; charge = batería (0–99); pity = cofres seguidos sin épica ni legendaria; bought = compras de hoy.
  // look = lo que lleva puesto (incluye el cuerpo, hombre o mujer); closet = el último look de cada cuerpo, para recuperarlo al cambiar.
  const fresh=()=>({v:1,xp:0,coins:0,owned:[],look:{...Avatar.DEFAULT},closet:{},days:[],streak:{count:0,last:''},missions:{},chests:{},charge:0,pity:0,bought:{day:'',count:0},casi:{n:0,ids:[]},
    // stats = cifras de las medallas que no salen del resto del progreso; medals = got {id: fecha}, fresh = sin ver, pin = la destacada.
    stats:null,medals:{got:{},fresh:[],pin:''}});
  const STATS=['streak','near','round','exact','trio','early','archive','wins','run','duelStreak','flawless','chests','missions','weekSet','leagueWins','league','pioneer'];
  const stored=key=>{try{return JSON.parse(localStorage.getItem(key))}catch{return null}};
  // Prepara el progreso: el de este navegador al cargar o el de la cuenta (decisión 0052) al entrar en otro dispositivo.
  let state;
  function hydrate(saved){
    state=fresh();
    try{
      if(saved&&typeof saved==='object')state={...state,...saved,look:Avatar.normalize(saved.look),streak:{...state.streak,...saved.streak}};
      // Quien ya jugó duelos antes de existir el perfil conserva su experiencia.
      else{const old=JSON.parse(localStorage.getItem('casi-casi:duelo:progreso'));if(old?.xp>0)state.xp=old.xp}
    }catch{}
    if(!Number.isFinite(state.xp)||state.xp<0)state.xp=0;if(!Number.isFinite(state.coins)||state.coins<0)state.coins=0;
    if(!Array.isArray(state.owned))state.owned=[];if(!Array.isArray(state.days))state.days=[];if(!state.closet||typeof state.closet!=='object')state.closet={};
    if(!state.chests||typeof state.chests!=='object')state.chests={};if(!state.editions||typeof state.editions!=='object')state.editions={};
    for(const type of Chests.TYPES)if(!Number.isInteger(state.chests[type])||state.chests[type]<0)state.chests[type]=0;
    if(!Number.isFinite(state.charge)||state.charge<0)state.charge=0;if(!Number.isInteger(state.pity)||state.pity<0)state.pity=0;
    if(!state.bought||typeof state.bought!=='object')state.bought={day:'',count:0};
    state.casi=CasiCasi.normalize(state.casi);
    state.celebrations=Celebrations.normalize(state.celebrations);
    // Cifras de las medallas. Quien ya jugaba conserva lo que se puede saber: su racha y sus duelos ganados.
    if(!state.stats||typeof state.stats!=='object'){const duels=stored('casi-casi:duelo:progreso')||{};state.stats={streak:state.streak.count,wins:duels.wins,run:duels.streak,duelStreak:duels.best,pioneer:state.days.length&&madrid()<'2027-01-01'?1:0}}
    for(const key of STATS)if(!Number.isInteger(state.stats[key])||state.stats[key]<0)state.stats[key]=0;
    if(!state.medals||typeof state.medals!=='object')state.medals={};
    if(!state.medals.got||typeof state.medals.got!=='object')state.medals.got={};
    state.medals.fresh=Array.isArray(state.medals.fresh)?state.medals.fresh.filter(id=>Medals.parse(id)):[];
    if(typeof state.medals.pin!=='string')state.medals.pin='';
    if(!state.trio||typeof state.trio!=='object')state.trio={day:'',n:0,ok:0};
    // Circuito de amigos (decisión 0038, circuito.js): welcome = entró invitado y cobró la bienvenida; n = amigos conectados
    // (lo dice el servidor); storm = ya recibió el cofre Tormenta de las 3 conexiones; current = días de corriente ya cargados.
    {const c=state.circuito&&typeof state.circuito==='object'?state.circuito:{};state.circuito={welcome:c.welcome===true,n:Number.isInteger(c.n)&&c.n>0?c.n:0,storm:c.storm===true,current:c.current&&typeof c.current==='object'?c.current:{}}}
  }
  hydrate(stored(KEY));
  function store(){try{localStorage.setItem(KEY,JSON.stringify(state))}catch{}}
  function save(){state.savedAt=Date.now();store();schedule()}

  // Nivel: cada uno pide 100 XP más que el anterior (nivel 2 a los 100 XP, nivel 3 a los 300, nivel 4 a los 600…).
  const levelOf=xp=>Math.floor((1+Math.sqrt(1+xp/12.5))/2),levelStart=level=>50*level*(level-1);
  const info=(xp=state.xp)=>{const level=levelOf(xp),from=levelStart(level),to=levelStart(level+1);return {level,done:xp-from,need:to-from,ratio:(xp-from)/(to-from)}};
  // casi = pieza exclusiva que se desbloquea con ese número de «Casi casi»: ni se compra ni sale en cofres (decisión 0030).
  const circuit=item=>item.circuito==='bienvenida'?state.circuito.welcome:state.circuito.n>=item.circuito;
  // Ediciones de colección (decisión 0067): se tiene la pieza si se tiene una unidad de su edición (state.editions = {edición: n.º de serie}).
  const serialOf=item=>item.edition&&state.editions?state.editions[item.edition.id]||0:0;
  // plus = la cuenta tiene la suscripción activa (decisión 0076); lo dice el servidor. Las piezas de suscriptor solo se tienen con ella.
  // billing = si la suscripción se puede contratar, su precio y si el jugador ya es cliente de Stripe (decisión 0077).
  let plus=false,plusUntil=null,billing=null,planKnown=false;
  // Piezas de rango y de medalla (decisión 0080). El rango más alto alcanzado lo dice el servidor (ranked.js lo recuerda
  // en este navegador, y de ahí se lee mientras ranked.js no ha cargado); las medallas están en state.medals.got.
  const RANK_IDS=Avatar.RANKS.map(([id])=>id),rankName=id=>(Avatar.RANKS.find(([rank])=>rank===id)||[])[1]||id;
  const bestRank=()=>RANK_IDS.indexOf(window.Ranked?window.Ranked.best():stored('casi-casi:rango:mio')?.best);
  const reached=item=>bestRank()>=RANK_IDS.indexOf(item.rango),medalled=item=>!!state.medals?.got?.[item.medalla];
  const owns=item=>item.plus?plus:(!item.price&&!Avatar.earned(item)&&!item.edition)||(item.rango&&reached(item))||(item.medalla&&medalled(item))||serialOf(item)>0||(item.circuito&&circuit(item))||(item.level&&levelOf(state.xp)>=item.level)||(item.casi&&state.casi.n>=item.casi)||state.owned.includes(item.slot+':'+item.id);
  // Lo que se lleva puesto siempre es algo que se tiene: si no, vuelve la pieza por defecto.
  function look(){const result=Avatar.normalize(state.look),base=Avatar.defaults(result.body);for(const [slot] of Avatar.SLOTS)if(!owns(Avatar.find(slot,result[slot])))result[slot]=base[slot];return result}
  const reaction=(mode,cue,options)=>Celebrations.reaction(state.celebrations,mode,cue,options);

  function periods(){
    const today=madrid(),week=monday(today),m=state.missions;
    if(m.day?.key!==today)m.day={key:today,ids:['reto-hoy',...pick(DAILY,2,today)],progress:{},claimed:[],chest:false};
    if(m.week?.key!==week)m.week={key:week,ids:pick(WEEKLY,3,week),progress:{},claimed:[],chest:false};
    return [m.day,m.week];
  }
  const pending=()=>periods().reduce((sum,period)=>sum+period.ids.filter(id=>(period.progress[id]||0)>=MISSIONS[id].goal&&!period.claimed.includes(id)).length,0);
  function bump(type,detail){
    let completed=0;
    for(const period of periods())for(const id of period.ids){
      const mission=MISSIONS[id],before=period.progress[id]||0;
      if(mission.on!==type||before>=mission.goal||(mission.when&&!mission.when(detail)))continue;
      period.progress[id]=before+1;if(before+1>=mission.goal)completed++;
    }
    return completed;
  }
  // Cofres: se guardan sin abrir hasta que el jugador los abre.
  const chestTotal=()=>Chests.TYPES.reduce((sum,type)=>sum+state.chests[type],0);
  // Con cuenta, los cofres los lleva el servidor (decisión 0063): aquí no se apuntan, llegan al sincronizar (syncServer).
  const grant=(type,count=1)=>{if(linked)return;state.chests[type]+=count};
  // Cofre de regalo del Circuito de amigos. Con cuenta lo apunta el servidor al cobrar el premio (decisión 0064).
  const gift=type=>grant(type);
  // La batería se carga jugando y, al llenarse, da un cofre Chispa. Lo que sobra se conserva.
  function charge(amount){if(linked)return 0;state.charge+=amount;let full=0;while(state.charge>=REWARD.charge.full){state.charge-=REWARD.charge.full;full++}if(full)grant('chispa',full);return full}
  const chargeNote=full=>full?' · ¡Batería llena: cofre Chispa!':'';
  const bought=()=>state.bought.day===madrid()?state.bought.count:0;
  // Suma experiencia y faradios. Al subir de nivel hay premio (faradios y un cofre) y se desbloquean las piezas de ese nivel.
  // reason = de dónde salen los faradios, para el libro contable del servidor (decisión 0057).
  function reward({xp=0,coins:gained=0,reason='otros'}={}){
    const before=levelOf(state.xp);state.xp+=xp;const after=levelOf(state.xp),chests=[];
    for(let level=before+1;level<=after;level++){const type=REWARD.levelChest(level);grant(type);chests.push(Chests.CHESTS[type].name)}
    const levelCoins=(after-before)*REWARD.levelCoins;
    // Con cuenta, el premio por nivel lo paga el servidor (decisión 0061).
    move(underCap(gained,reason),reason);move(linked?0:levelCoins,'nivel');save();refresh();
    const body=look().body,unlocked=after>before?Avatar.CATALOG.filter(item=>item.level>before&&item.level<=after&&(!item.for||item.for===body)):[];
    return {levelUp:after>before,level:after,levelCoins,unlocked,chests};
  }
  const levelNote=result=>result.levelUp?` · ¡Nivel ${result.level}! +${result.levelCoins} ≈ y cofre ${result.chests.join(' y ')}${result.unlocked.length?` · Nuevo: ${result.unlocked.map(item=>item.name).join(', ')}`:''}`:'';
  const missionNote=count=>count?` · ${count===1?'Misión lista':count+' misiones listas'} para recoger`:'';

  // Medallas (decisión 0035). Las cifras salen del progreso (racha, retos, nivel, piezas…) y de los contadores de state.stats.
  const DRESSED=['hat','glasses','neck','extra'];
  function medalStats(){
    const s=state.stats,current=look();
    return {...s,streak:Math.max(s.streak,state.streak.count),days:state.days.length,casi:state.casi.n,level:levelOf(state.xp),pieces:state.owned.length,
      first:state.days.length?1:0,league:s.league||(stored('casi-casi:ligas:mias')||[]).length?1:0,
      legendary:state.owned.some(key=>{const [itemSlot,id]=key.split(':'),item=Avatar.find(itemSlot,id);return item&&Avatar.rarity(item)==='legendaria'})?1:0,
      dressed:DRESSED.every(part=>current[part])?1:0};
  }
  // Cómo se consigue una medalla o insignia, y las piezas del avatar que da (las del cuerpo que se lleva).
  const medalText=id=>{const found=Medals.parse(id);return found?found.def.text(found.def.goals[found.tier-1]):''};
  const medalPieces=ids=>{const body=look().body;return Avatar.CATALOG.filter(item=>item.medalla&&ids.includes(item.medalla)&&(!item.for||item.for===body))};
  const gotMedals=()=>Object.keys(state.medals.got).filter(id=>Medals.parse(id));
  // Lo que se enseña: la destacada a mano y, después, lo más difícil y lo más reciente. Solo el nivel más alto de cada medalla.
  function featured(){
    const top={};for(const id of gotMedals()){const {def,tier}=Medals.parse(id);if(!top[def.id]||tier>top[def.id].tier)top[def.id]={id,tier,date:state.medals.got[id]}}
    return Object.entries(top).sort(([a,x],[b,y])=>(b===state.medals.pin)-(a===state.medals.pin)||Medals.rank(y.id)-Medals.rank(x.id)||(y.date>x.date?1:y.date<x.date?-1:0)).map(([,entry])=>entry.id);
  }
  // Mira si hay logros nuevos. Se llama tras cada cambio del progreso (refresh); al cargar la página no se anuncia.
  let booted=false;
  function checkMedals(){
    const fresh=Medals.earned(medalStats()).filter(id=>!state.medals.got[id]);if(!fresh.length)return;
    const today=madrid();for(const id of fresh)state.medals.got[id]=today;
    state.medals.fresh=[...new Set([...state.medals.fresh,...fresh])];save();
    if(booted){
      Medals.announce(fresh,()=>open('medallas'));document.dispatchEvent(new CustomEvent('faraday:look'));
      const won=medalPieces(fresh);if(won.length&&typeof showToast==='function')setTimeout(()=>showToast(`Pieza nueva en tu armario: ${won.map(item=>item.name).join(', ')}`),1500);
    }
  }
  // La ceremonia enseña las que aún no se han visto y las da por vistas.
  function celebrateFresh(){
    const fresh=state.medals.fresh;if(!fresh.length)return;
    state.medals.fresh=[];save();Medals.celebrate(fresh,{onClose:()=>{refresh();$('#profile-close').focus()}});
  }

  // Al llegar a un rango nuevo en las clasificatorias (ranked.js), se avisa de las piezas que da y se repinta.
  document.addEventListener('faraday:rango',({detail})=>{
    const from=RANK_IDS.indexOf(detail.before),to=RANK_IDS.indexOf(detail.best),body=look().body;
    const won=Avatar.CATALOG.filter(item=>item.rango&&RANK_IDS.indexOf(item.rango)>from&&RANK_IDS.indexOf(item.rango)<=to&&(!item.for||item.for===body));
    if(booted&&won.length&&typeof showToast==='function')setTimeout(()=>showToast(`¡Rango ${rankName(detail.best)}! Pieza nueva en tu armario: ${won.map(item=>item.name).join(', ')}`),1500);
    if(booted)refresh();
  });

  // «Casi casi»: una vez por pregunta. Al llegar a la cifra de una pieza exclusiva, se avisa de que ya es tuya.
  function countCasi(detail){
    const result=CasiCasi.record(state.casi,detail);if(!result.counted)return '';
    state.casi=result.record;const n=state.casi.n,body=look().body,unlocked=Avatar.CATALOG.filter(item=>item.casi===n&&(!item.for||item.for===body));
    return unlocked.length?` · ¡${n} «Casi casi»! Nuevo: ${unlocked.map(item=>item.name).join(', ')}`:'';
  }
  document.addEventListener('faraday:answer',({detail})=>{
    const s=state.stats,factor=detail.factor;
    if(factor<2)s.near++;if(factor>=1&&factor<1.01)s.exact=1;
    // Triplete: las tres respuestas de un mismo reto a menos de 2×.
    if(state.trio.day!==detail.day)state.trio={day:detail.day,n:0,ok:0};
    state.trio.n++;if(factor<2)state.trio.ok++;if(state.trio.n===3&&state.trio.ok===3)s.trio=1;
    const prize=countCasi(detail),done=bump('answer',detail),result=reward({xp:REWARD.answerXp});
    if(done||result.levelUp||prize)showToast((`+${REWARD.answerXp} XP`+prize+levelNote(result)+missionNote(done)));
  });
  document.addEventListener('faraday:day',({detail})=>{
    const done=bump('day',detail);
    if(state.days.includes(detail.day)){save();refresh();if(done)showToast(missionNote(done).slice(3));return}
    state.days.push(detail.day);const s=state.stats;
    if(detail.average<1.5)s.round++;if(!detail.today)s.archive++;if(madrid()<'2027-01-01')s.pioneer=1;
    let gained=REWARD.archiveCoins,xp=REWARD.archiveXp,extra='',storm='';
    const full=charge(detail.today?REWARD.charge.today:REWARD.charge.archive);
    if(detail.today){
      const today=madrid();
      if(state.streak.last!==today){
        state.streak.count=state.streak.last===shift(today,-1)?state.streak.count+1:1;state.streak.last=today;s.streak=Math.max(s.streak,state.streak.count);
        // Madrugador: el reto de hoy, entre las 5:00 y las 8:00 (hora de Madrid).
        const hour=Number(new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Madrid',hour:'2-digit',hourCycle:'h23'}).format(new Date()));if(hour>=5&&hour<8)s.early=1;
        // Hitos de racha (3, 7, 14, 30, 50, 100…): un cofre Imán, Tormenta o Faraday según el hito.
        const prize=Chests.streakChest(state.streak.count);
        if(prize){grant(prize);storm=` · ¡${state.streak.count} días: cofre ${Chests.CHESTS[prize].name}!`}
      }
      const accuracy=detail.average<1.5?15:detail.average<2?10:detail.average<3?5:0,streak=Math.min(state.streak.count,REWARD.streakCap)*REWARD.streakCoins;
      gained=REWARD.todayCoins+accuracy+streak;xp=REWARD.todayXp;extra=state.streak.count>1?` · 🔥 ${state.streak.count} días seguidos`:'';
    }
    // Con cuenta, los faradios del reto los calcula y los paga el servidor (decisión 0058): aquí solo se piden.
    const result=reward({xp,coins:linked?0:gained,reason:detail.today?'reto':'archivo'});if(linked)claim(detail.day);
    showToast(`Reto completado: +${gained} ≈ · +${xp} XP${extra}${storm}${chargeNote(full)}${levelNote(result)}${missionNote(done)}`);
  });
  document.addEventListener('faraday:duel',({detail})=>{
    const s=state.stats;
    if(!detail.bot&&!detail.abandoned){
      if(detail.result==='win'){s.wins++;s.run++;s.duelStreak=Math.max(s.duelStreak,s.run);if(detail.flawless)s.flawless=1}
      else if(detail.result==='loss')s.run=0;
    }
    const done=bump('duel',detail),full=charge(detail.charge||0);save();refresh();
    if(done||full)setTimeout(()=>showToast((chargeNote(full)+missionNote(done)).slice(3)),2500);
  });

  // Ligas (ligas.js): entrar en una liga y ganar una semana (lo avisa el resumen del lunes, una vez por semana).
  document.addEventListener('faraday:liga',({detail})=>{
    if(detail?.joined)state.stats.league=1;
    if(Number.isInteger(detail?.won)&&detail.won>0)state.stats.leagueWins+=detail.won;
    save();refresh();
  });

  // Chapa de la portada: avatar, nivel, faradios y un punto si hay misiones por recoger o cofres por abrir.
  function refresh(){
    checkMedals();
    const boxes=chestTotal(),missions=pending(),level=info();
    if(chip){chip.setAttribute('aria-label',`Tu perfil, nivel ${level.level}, ${state.coins} faradios`);const waiting=missions+boxes+state.medals.fresh.length;chip.innerHTML=`<span class="duel-avatar small">${Avatar.render(look(),{bust:true})}</span><span class="home-profile-text"><b>Nv. ${level.level}</b><span>${coins(state.coins)}</span></span>${waiting?`<i class="profile-dot" aria-label="${waiting} avisos: misiones por recoger, cofres por abrir o medallas nuevas">${waiting}</i>`:''}`}
    if(homeProgress){
      const remaining=int(level.need-level.done),next=int(level.level+1);
      const ready=missions===1?'1 misión lista':`${int(missions)} misiones listas`;
      homeProgressLevel.textContent=`Nivel ${int(level.level)}`;
      homeProgressNote.textContent=missions?`${ready} · ${remaining} XP`:`${remaining} XP para subir`;
      homeProgressFill.style.width=`${level.ratio*100}%`;
      homeProgress.classList.toggle('has-missions',missions>0);
      homeProgress.setAttribute('aria-label',`Ver misiones. Nivel ${int(level.level)}. Para subir al nivel ${next} necesitas ${remaining} XP.${missions?` ${ready} para recoger.`:''}`);
    }
    if(stage){
      const avatar=Avatar.render(look(),{zoom:'home',live:true,emote:'wave',turn:0,reaction:reaction('all','welcome')});
      if(stage.avatar!==avatar){stage.avatar=avatar;stage.innerHTML=avatar}
      const chest=stage.closest('.portal-avatar').querySelector('.portal-chests');
      chest.hidden=!boxes;
      chest.textContent=boxes===1?'Abrir 1 cofre':`Abrir ${boxes} cofres`;
    }
    if(!shell.hidden)draw();
  }

  // Perfil: el avatar a la izquierda y, a la derecha, el armario (con tienda), las misiones o los cofres.
  let tab='armario',slot='top',trying=null,show='todo',query='',grade='';
  let celebrationMode='all',previewCue='clavada';
  const ascensionNames={clavada:'De cumbre',acierto:'Extraordinaria',cerca:'Rara',lejos:'Ingeniosa',fallo:'Conocida',ko:'Sin respuesta'};
  function celebrationTab(){
    const {MODES,CUES,CLIPS}=Celebrations;
    const isDuel=['duel','duel3','ranked'].includes(celebrationMode);
    const rows=CUES.filter(({id})=>celebrationMode==='ascension'?['clavada','acierto','cerca','lejos','fallo','ko'].includes(id):celebrationMode==='all'||(isDuel?!['welcome','reward'].includes(id):celebrationMode==='trends'?['clavada','acierto','cerca','lejos','fallo'].includes(id):!['victory','draw','defeat','welcome','reward'].includes(id)));
    const ascensionPoints={clavada:'100 puntos · +1.000 m',acierto:'85 puntos · +850 m',cerca:'60 puntos · +600 m',lejos:'30 puntos · +300 m',fallo:'10 puntos · +100 m',ko:'0 puntos'};
    const ranges=['950–1.000 puntos','800–949 puntos','600–799 puntos','350–599 puntos','0–349 puntos'];
    return `<div class="celebrations-head"><button type="button" class="duel-link" data-tab="armario">← Volver al armario</button><h3>Tu forma de celebrar</h3><p>Elige un gesto para cada resultado. Se guarda automáticamente. Los gestos actuales están incluidos para todos.</p></div>
<label class="celebrations-mode">Dónde se aplica<select data-celebration-mode>${MODES.map(([id,name])=>`<option value="${id}"${id===celebrationMode?' selected':''}>${name}</option>`).join('')}</select></label>
<div class="celebration-list">${rows.map((cue,i)=>{
      const selected=state.celebrations[celebrationMode]?.[cue.id]||'';
      const inherited=Celebrations.choice(state.celebrations,'all',cue.id),inheritedName=CLIPS.find(item=>item.id===inherited)?.name||(inherited==='none'?'Sin gesto':'Original del juego');
      return `<div class="celebration-row"><label for="gesture-${cue.id}">${celebrationMode==='ascension'?ascensionNames[cue.id]:cue.name}<small>${celebrationMode==='ascension'?ascensionPoints[cue.id]:celebrationMode==='trends'?ranges[i]:cue.range}</small></label><select id="gesture-${cue.id}" data-celebration-cue="${cue.id}"><option value="">${celebrationMode==='all'?'Original del juego':`General · ${inheritedName}`}</option>${celebrationMode==='all'?'':`<option value="default"${selected==='default'?' selected':''}>Original de este modo</option>`}<option value="none"${selected==='none'?' selected':''}>Sin gesto</option>${CLIPS.map(item=>`<option value="${item.id}"${selected===item.id?' selected':''}>${item.name}</option>`).join('')}</select><button type="button" data-preview-cue="${cue.id}" aria-label="Ver gesto de ${celebrationMode==='ascension'?ascensionNames[cue.id]:cue.name}">Ver</button></div>`;
    }).join('')}</div><p class="celebration-status" role="status" aria-live="polite"></p><button type="button" class="duel-link celebrations-reset" data-reset-celebrations>Restablecer ${celebrationMode==='all'?'la selección general':'este modo'}</button>`;
  }
  function previewCelebration(cue){
    previewCue=cue;
    const actor=main.querySelector('.profile-figure .avatar-view');if(!actor)return;
    actor._react=reaction(celebrationMode,cue);window.Avatar3D?.react?.(actor);
    const note=main.querySelector('.celebration-status');if(note)note.textContent='Vista previa · '+(celebrationMode==='ascension'?ascensionNames[cue]:Celebrations.CUES.find(item=>item.id===cue).name);
  }
  // swapping = la misión que se está a punto de cambiar (pide confirmar); shield = la oferta de proteger la racha que
  // da el servidor a quien tiene cuenta ({days}); shieldTold = ya se avisó en esta visita.
  let swapping=null,shield=null,shieldTold=false;
  // Una misión se puede cambiar si no es la del reto de hoy, no está completada ni recogida y no salió ya de un cambio.
  const canSwap=(period,id)=>id!=='reto-hoy'&&!(period.swapped||[]).includes(id)&&!period.claimed.includes(id)&&(period.progress[id]||0)<MISSIONS[id].goal;
  // Si la racha se puede proteger: {days}. Ayer no se jugó, hoy todavía tampoco y la racha era de 3 días o más.
  // Con cuenta lo dice el servidor; sin cuenta, la racha de este navegador.
  function shieldOffer(){
    if(linked)return shield;
    return state.streak.count>=REWARD.shield.from&&state.streak.last===shift(madrid(),-2)?{days:state.streak.count}:null;
  }
  const shieldNote=days=>`Ayer no jugaste: tu racha de ${days} días está a punto de perderse. Puedes protegerla en tu perfil.`;
  // Cada pieza se enseña sobre el muñeco por defecto, con el encuadre que mejor la muestra.
  const ZOOM={costume:'stage',top:'torso',neck:'torso',bottom:'legs',shoes:'shoes'},RARITY={especial:'Especial',rara:'Rara',epica:'Épica',legendaria:'Legendaria',nivel:'Exclusiva'},SLOT_NAME=Object.fromEntries(Avatar.SLOTS);
  // Iconos de línea de cada parte del avatar, para las pestañas del probador.
  const SLOT_ICON={
    costume:'M12 3.5 14 8l4.5.6-3.3 3.2.8 4.7-4-2.2-4 2.2.8-4.7L5.5 8.6 10 8zM6 19.5h12',
    top:'M8.5 4 4 6.5l1.8 4 2.2-1V20h8V9.5l2.2 1 1.8-4L15.5 4c-.5 1.6-1.9 2.6-3.5 2.6S9 5.6 8.5 4z',
    bottom:'M7 3.5h10l1 17h-4.2L12 10l-1.8 10.5H6zM7 7h10',
    shoes:'M3 17.5V12c0-2 .8-4 2.3-4l3 3.2c1.8 1.2 5 2 8.7 2.3 2.3.2 4 1.3 4 3.2v.8zM3 17.5h18',
    hat:'M4.5 15a7.5 7.5 0 0 1 15 0zM3 15h19M12 7.5V6',
    hair:'M5 15c-.5-6 2.5-10 7-10s7.5 4 7 10c-1-2.5-3-4.5-7-5-4 .5-6 2.5-7 5zM5 15v3M19 15v3',
    hairColor:'M12 3.5s6 6.4 6 10.8a6 6 0 0 1-12 0C6 9.9 12 3.5 12 3.5zM9.5 15a2.5 2.5 0 0 0 2.5 2.5',
    glasses:'M3 12.5a3.5 3.5 0 1 0 7 0 3.5 3.5 0 1 0-7 0zM14 12.5a3.5 3.5 0 1 0 7 0 3.5 3.5 0 1 0-7 0zM10 12.5c1.2-1 2.8-1 4 0',
    neck:'M6 4c0 5 2.8 8 6 8s6-3 6-8M12 12v2.5M9.5 14.5h5L12 20z',
    extra:'M12 3.5l2.1 5.4 5.4 2.1-5.4 2.1L12 18.5l-2.1-5.4L4.5 11l5.4-2.1zM18.5 17l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z',
    face:'M3.5 12a8.5 8.5 0 1 0 17 0 8.5 8.5 0 1 0-17 0zM8.5 14.5c2 2 5 2 7 0M9 9.5v.5M15 9.5v.5',
    skin:'M12 20.5a8.5 8.5 0 1 1 8.5-8.5c0 1.9-1.4 3-3 3h-2.2a1.8 1.8 0 0 0-1.2 3.1c.8.8.3 2.4-2.1 2.4zM7.5 11.5h.01M10 7.5h.01M14.5 7.5h.01'
  };
  // Orden de las cartas: de menos a más rara; las exclusivas (nivel, «Casi casi», circuito, ediciones), al final.
  const GRADES=['comun','especial','rara','epica','legendaria','nivel'],GRADE_NAME={comun:'Común',...RARITY};
  const gradeOf=item=>GRADES.indexOf(Avatar.rarity(item));
  const byGrade=list=>list.map((item,i)=>[item,i]).sort(([a,i],[b,j])=>gradeOf(a)-gradeOf(b)||(a.edition?.price??a.price??0)-(b.edition?.price??b.price??0)||i-j).map(([item])=>item);
  // Buscador: sin mayúsculas ni tildes; busca en el nombre, la parte del avatar y la rareza.
  const plain=text=>String(text||'').normalize('NFD').replace(/\p{M}/gu,'').toLowerCase().trim();
  const matches=(item,words)=>{const text=plain(`${item.name} ${SLOT_NAME[item.slot]||''} ${GRADE_NAME[Avatar.rarity(item)]||''}`);return words.every(word=>text.includes(word))};
  SLOT_ICON.todo='M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z';
  const slotIcon=id=>`<svg class="slot-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="${SLOT_ICON[id]||SLOT_ICON.extra}"/></svg>`;
  const LOCK='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 11V8a5 5 0 0 1 10 0v3M5.5 11h13v9.5h-13z"/></svg>';
  // Carta de la tienda: el color dice la rareza; abajo, lo que cuesta, si ya es tuya o qué hace falta para desbloquearla.
  // Las piezas de un hueco: las del catálogo y, detrás, las versiones con acabado que se tengan (decisión 0072).
  function piecesOf(part,body){
    const extra=state.owned.map(key=>{const [itemSlot,id]=String(key).split(':');return itemSlot===part&&id&&id.includes('--')?Avatar.find(itemSlot,id):null}).filter(item=>item&&(!item.for||item.for===body));
    return [...Avatar.pieces(part,body),...extra];
  }
  // Ponerse una pieza. Una skin completa (decisión 0112) tapa todo lo demás, así que ponerse cualquier otra cosa la quita.
  const wear=(base,part,id)=>({...base,...(part==='costume'?{}:{costume:''}),[part]:id});
  function tile(item,current){
    const own=owns(item),worn=current[item.slot]===item.id,zoom=ZOOM[item.slot]||'',rarity=Avatar.rarity(item);
    const gate=own||item.edition?'':item.plus?'Suscripción':item.level?`Nivel ${item.level}`:item.casi?`${item.casi} «Casi casi»`:item.rango?`Rango ${rankName(item.rango)}`:item.medalla?Medals.label(item.medalla):item.circuito?(item.circuito==='bienvenida'?'Invitados':item.circuito===1?'1 amigo':item.circuito+' amigos'):'';
    const status=worn?'<span class="tile-state on">Puesto</span>':own?`<span class="tile-state">${item.edition?`N.º ${serialOf(item)} de ${item.edition.total}`:'Tuya'}</span>`:item.edition?`<span class="tile-state price">Edición · ${coins(item.edition.price)}</span>`:gate?`<span class="tile-state lock">${LOCK}${gate}</span>`:`<span class="tile-state price">${coins(item.price)}</span>`;
    return `<button type="button" class="profile-tile${worn?' is-on':''}${trying===item?' is-trying':''}${own?'':' is-locked'}${gate?' is-gated':''}" data-item="${item.slot}:${item.id}" data-rarity="${rarity}"${item.finish?` data-finish="${item.finish}"`:''} aria-pressed="${worn}"><span class="tile-art">${Avatar.render(Avatar.preview(item,current.body),{bust:!zoom,zoom})}</span>${item.finish?`<span class="tile-rarity">${Avatar.FINISHES[item.finish].label}</span>`:RARITY[rarity]?`<span class="tile-rarity">${RARITY[rarity]}</span>`:''}${item.edition?'<span class="tile-trade">Comerciable</span>':''}${worn?'<span class="tile-badge" aria-hidden="true">✓</span>':''}<span class="tile-name">${item.name}</span>${status}</button>`;
  }
  // Lo que se dice de una edición de colección al probarla, y el botón de compra si se puede (decisión 0067).
  // editionInfo = {edición: {left}} que da el servidor al abrir el perfil.
  let editionInfo={};
  function editionTry(item,missing){
    const edition=item.edition,left=editionInfo[edition.id]?.left;
    const note=`<p class="profile-try-note">Edición de colección n.º ${edition.n}: ${int(edition.total)} unidades numeradas, una por cuenta.${Number.isInteger(left)?(left>0?` Quedan ${int(left)}.`:' Está agotada.'):''} Se puede comprar y vender en el mercado.</p><button type="button" class="game-secondary" data-open-market="${edition.id}">Ver en el mercado</button>`;
    if(!linked)return note+'<p class="profile-try-note">Las ediciones se compran con cuenta: entra para conseguir la tuya.</p>';
    if(left===0)return note;
    if(levelOf(state.xp)<edition.level)return note+`<p class="profile-try-note">Se compra desde el nivel ${edition.level}.</p>`;
    return note+`<button type="button" class="game-primary" data-buy-edition${missing>0?' disabled':''}>${missing>0?`Te faltan ${coins(missing)}`:`Comprar · ${coins(edition.price)}`}</button>`;
  }
  async function syncEditions(){
    if(!linked)return;
    try{const {editions}=await cloud('ediciones');editionInfo=Object.fromEntries(editions.map(one=>[one.id,one]));if(!shell.hidden)refresh()}catch{}
  }
  // Pestaña Armario: colección, cuerpo, partes del avatar (con lo que tienes de cada una), filtro y cartas.
  function wardrobe(current){
    const all=Avatar.SLOTS.flatMap(([id])=>piecesOf(id,current.body)),have=all.filter(owns).length;
    const tabs=[['todo','Todo',all],...Avatar.SLOTS.map(([id,label])=>[id,label,piecesOf(id,current.body)])];
    return `<div class="wardrobe-head"><div class="wardrobe-collection"><p><b>Colección</b><span>${have} / ${all.length}</span></p><div class="mission-bar" role="img" aria-label="Tienes ${have} de ${all.length} piezas"><i style="--m:${have/all.length}"></i></div></div><div class="profile-body" role="group" aria-label="Cuerpo del avatar">${Avatar.BODIES.map(([id,label])=>`<button type="button" aria-pressed="${id===current.body}" data-body="${id}">${label}</button>`).join('')}</div></div>
<div class="profile-slots wardrobe-slots" role="tablist" aria-label="Partes del avatar">${tabs.map(([id,label,list])=>`<button type="button" role="tab" aria-selected="${id===slot}" data-slot="${id}">${slotIcon(id)}<span>${label}</span><small>${list.filter(owns).length}/${list.length}</small></button>`).join('')}</div>
<div class="wardrobe-tools"><label class="wardrobe-search"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10.5 4a6.5 6.5 0 1 0 0 13 6.5 6.5 0 1 0 0-13zM15.5 15.5 20 20"/></svg><input type="search" data-search value="${query.replace(/&/g,'&amp;').replace(/"/g,'&quot;')}" placeholder="Buscar ${slot==='todo'?'en todo el armario':'en '+(SLOT_NAME[slot]||'').toLowerCase()}" aria-label="Buscar piezas" autocomplete="off" enterkeyhint="search"></label><select class="wardrobe-grade" data-grade aria-label="Rareza"><option value="">Rareza: todas</option>${GRADES.map(id=>`<option value="${id}"${id===grade?' selected':''}>${GRADE_NAME[id]}</option>`).join('')}</select></div>
<div class="wardrobe-results">${wardrobeResults(current,all)}</div>`;
  }
  // Filtro (todas, tuyas, por conseguir) y cartas: se rehace solo esta parte al escribir en el buscador, para no perder el foco.
  function wardrobeResults(current,all){
    const words=plain(query).split(/\s+/).filter(Boolean);
    const pieces=byGrade((slot==='todo'?all:piecesOf(slot,current.body)).filter(item=>(!grade||Avatar.rarity(item)===grade)&&matches(item,words)));
    const filters=[['todo','Todo',pieces],['tuyo','Tuyas',pieces.filter(owns)],['tienda','Por conseguir',pieces.filter(item=>!owns(item))]],shown=filters.find(([id])=>id===show)[2];
    const narrowed=words.length||grade,wider=slot!=='todo'&&narrowed?'<button type="button" class="duel-link" data-slot="todo">Buscar en todo el armario</button>':'';
    const empty=narrowed&&!pieces.length?`No hay piezas${grade?` de rareza ${GRADE_NAME[grade].toLowerCase()}`:''}${words.length?` con «${query.trim().replace(/[<>&"]/g,'')}»`:''} ${slot==='todo'?'en el armario':`en ${(SLOT_NAME[slot]||'').toLowerCase()}`}.${wider?'<br>'+wider:''}`:show==='tuyo'?'Aún no tienes piezas de este tipo: pruébate las de la tienda.':'¡Ya las tienes todas!';
    return `<div class="wardrobe-filter" role="group" aria-label="Qué piezas ver">${filters.map(([id,label,list])=>`<button type="button" aria-pressed="${id===show}" data-show="${id}">${label} <small>${list.length}</small></button>`).join('')}</div>
<div class="profile-items">${shown.length?shown.map(item=>tile(item,current)).join(''):`<p class="wardrobe-empty">${empty}</p>`}</div>`;
  }
  function redrawResults(){
    const box=main.querySelector('.wardrobe-results');if(!box){draw();return}
    const current=look();box.innerHTML=wardrobeResults(current,Avatar.SLOTS.flatMap(([id])=>piecesOf(id,current.body)));
  }
  function missionRow(period,id){
    const mission=MISSIONS[id],progress=Math.min(mission.goal,period.progress[id]||0),done=progress>=mission.goal,claimed=period.claimed.includes(id);
    return `<li class="mission${claimed?' is-claimed':done?' is-done':''}"><div><p>${mission.text}</p><div class="mission-bar"><i style="--m:${progress/mission.goal}"></i></div><small>${progress} / ${mission.goal}</small></div>${claimed?'<span class="mission-check" aria-label="Recogida">✓</span>':done?`<button type="button" class="game-primary" data-claim="${id}">Recoger +${mission.coins} ${COIN}</button>`:`<span class="mission-side"><span class="mission-prize">+${coins(mission.coins)}</span>${canSwap(period,id)?`<button type="button" class="mission-swap" data-swap="${id}">${swapping===id?`Confirmar · ${REWARD.swap} ≈`:'Cambiar'}</button>`:''}</span>`}</li>`;
  }
  // Abre un cofre. El sorteo se hace y se guarda aquí, antes de la animación: cerrar o recargar no cambia lo que ha tocado.
  const dice=()=>{try{return crypto.getRandomValues(new Uint32Array(1))[0]/2**32}catch{return Math.random()}};
  function openChest(type){
    if(!state.chests[type]||ChestOpen.open)return;
    // Con cuenta, el cofre se abre en el servidor: allí se sortea y se reparten los premios (decisión 0063).
    if(linked){
      if(opening)return;opening=true;
      serverAsk('abrir-cofre',{type},'No se pudo abrir el cofre. Inténtalo otra vez.','Ese cofre ya no está.').then(data=>{
        opening=false;if(!data){syncServer();return}
        applyServer(data,true);state.stats.chests++;showChest(type,data.rewards,false);serverCoins(data.coins);
      });
      return;
    }
    // Solo tocan piezas del cuerpo que se lleva puesto (y las comunes): así el premio siempre se puede estrenar (decisión 0028).
    const current=look(),missing=Avatar.CATALOG.filter(item=>item.price>0&&!item.level&&!owns(item)&&(!item.for||item.for===current.body)).map(item=>({key:item.slot+':'+item.id,rarity:Avatar.rarity(item)}));
    const result=Chests.roll(type,{items:missing,pity:state.pity,random:dice});
    state.chests[type]--;state.pity=result.pity;state.stats.chests++;
    showChest(type,result.rewards,true);
  }
  // Enseña la apertura de un cofre con sus premios. local = sorteado aquí (sin cuenta): se suman los faradios y las
  // piezas; si lo sorteó el servidor, ya los ha repartido él y aquí solo se apuntan las piezas en el armario.
  function showChest(type,list,local){
    const current=look();
    const rewards=Array.from(list).map(reward=>{
      if(reward.kind==='coins'){if(local)move(reward.amount,'cofres');return reward}
      if(!state.owned.includes(reward.key))state.owned.push(reward.key);
      // Con acabado (decisión 0072) se tienen las dos, la normal y la del acabado, y la que se enseña es la del acabado.
      const key=reward.finish&&Avatar.find(...(reward.key+'--'+reward.finish).split(':'))?reward.key+'--'+reward.finish:reward.key;
      if(!state.owned.includes(key))state.owned.push(key);
      const [itemSlot,id]=key.split(':'),item=Avatar.find(itemSlot,id),zoom=ZOOM[itemSlot]||'';
      return {...reward,key,name:item.name,slot:SLOT_NAME[itemSlot],art:Avatar.render(Avatar.preview(item,current.body),{bust:!zoom,zoom}),figure:Avatar.render(wear(current,itemSlot,id),{live:true,reaction:reaction('all','reward')})};
    });
    save();refresh();
    ChestOpen.play(type,rewards,{more:chestTotal(),onClose:refresh,
      onEquip:key=>{const [itemSlot,id]=key.split(':');state.look={...look(),[itemSlot]:id};save()},
      onMore:()=>openChest(state.chests[type]?type:Chests.TYPES.find(other=>state.chests[other]))});
  }
  // Comprar un cofre con faradios: como mucho Chests.BUY_CAP al día. Se abre en el momento.
  function buyChest(type){
    const chest=Chests.CHESTS[type];if(!chest||state.coins<chest.price||bought()>=Chests.BUY_CAP)return;
    // Con cuenta, la compra la cobra el servidor y después se abre allí.
    if(linked){
      if(opening)return;opening=true;
      serverAsk('comprar-cofre',{type},'No se pudo comprar el cofre. Inténtalo otra vez.','Hoy ya has comprado todos los cofres que se puede.').then(data=>{
        opening=false;if(!data)return;
        state.bought={day:madrid(),count:bought()+1};applyServer(data,true);serverCoins(data.coins);openChest(type);
      });
      return;
    }
    move(-chest.price,'cofres-compra');state.bought={day:madrid(),count:bought()+1};grant(type);save();refresh();openChest(type);
  }
  // Pestaña Cofres: la batería, los cofres (abrir o comprar) y las probabilidades, siempre a la vista.
  function chestTab(){
    // Un cofre con premio seguro no se vende si ya se tienen todas las piezas de las rarezas que garantiza: daría faradios en su lugar.
    const body=look().body,lacks=rarity=>Avatar.CATALOG.some(item=>item.price>0&&!item.level&&!owns(item)&&(!item.for||item.for===body)&&Avatar.rarity(item)===rarity);
    const left=Math.max(0,Chests.BUY_CAP-bought()),percent=chance=>(chance*100).toLocaleString('es-ES',{maximumFractionDigits:1})+' %',lower=kind=>Chests.LABEL[kind].toLowerCase();
    const card=type=>{
      const chest=Chests.CHESTS[type],have=state.chests[type],sureKinds=Object.keys(chest.sure||{}),complete=sureKinds.length>0&&!sureKinds.some(lacks);
      return `<li class="chest-item${have?' has':''}">${have?`<i class="profile-dot chest-count" aria-label="Tienes ${have}">${have}</i>`:''}${ChestOpen.art(type)}<h4>${chest.name}</h4><p>${Chests.count(type)} premios${chest.sure?`<br>1 ${lower(sureKinds[0])}${sureKinds.length>1?' o mejor':' segura'}`:chest.perk?`<br>${chest.perk}`:''}</p>${have?`<button type="button" class="game-primary" data-open-chest="${type}">Abrir</button>`:''}<button type="button" class="chest-buy" data-buy-chest="${type}"${state.coins<chest.price||!left||complete?' disabled':''} aria-label="${complete?`Cofre ${chest.name}: ya tienes todas las piezas que garantiza`:`Comprar cofre ${chest.name} por ${chest.price} faradios`}">${complete?'Ya lo tienes todo':`${int(chest.price)} ${COIN}`}</button></li>`;
    };
    // Las probabilidades van en dos tablas de tres cofres, como las filas de arriba: así caben también en el móvil.
    const odds=types=>`<table><thead><tr><th scope="col">Cada premio</th>${types.map(type=>`<th scope="col">${Chests.CHESTS[type].name}</th>`).join('')}</tr></thead><tbody>${['faradios',...Chests.RARITIES].map(kind=>`<tr data-glow="${kind}"><td><i class="odds-dot" aria-hidden="true"></i>${Chests.LABEL[kind]}</td>${types.map(type=>`<td>${percent(Chests.CHESTS[type].odds[kind])}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
    const sure=Chests.TYPES.filter(type=>Chests.CHESTS[type].sure).map(type=>`${Chests.CHESTS[type].name} trae además un premio seguro: ${Object.entries(Chests.CHESTS[type].sure).map(([kind,chance])=>`${lower(kind)} ${percent(chance)}`).join(', ')}.`).join(' ');
    return `<div class="battery"><p><b>Batería</b><span>${Math.floor(state.charge)} / ${REWARD.charge.full}</span></p><div class="battery-bar" role="img" aria-label="Batería al ${Math.floor(state.charge)} por ciento"><i style="--m:${state.charge/REWARD.charge.full}"></i></div><small>Se carga jugando: reto de hoy +${REWARD.charge.today}, reto del archivo +${REWARD.charge.archive}, duelo +20. Llena, da un cofre Chispa.</small></div>
<ul class="chest-shelf">${Chests.TYPES.map(card).join('')}</ul>
<p class="chest-note">Los cofres se ganan jugando: Chispa al llenar la batería y al subir de nivel; Imán a los 3 días de racha; Rayo con las tres misiones de la semana y cada 5 niveles; Dinamo cada 10 niveles; Tormenta con las rachas de 7, 14, 30 y 50 días; Faraday a los 100 días de racha y cada 100 después. También se compran con faradios: ${left?`hoy puedes comprar ${left} más`:'hoy ya has comprado todos los que se puede'} (máximo ${Chests.BUY_CAP} al día).</p>
<details class="chest-odds"><summary>Probabilidades</summary>${[Chests.TYPES.slice(0,3),Chests.TYPES.slice(3)].map(odds).join('')}
<p>${sure} Imán nunca trae lotes de faradios. Cada pieza de ropa, pantalón, zapatillas o cabeza que sale puede traer además su versión con acabado: ${Object.entries(Chests.FINISH_ODDS).map(([finish,chance])=>`${Avatar.FINISHES[finish].label.toLowerCase()} ${percent(chance)}`).join(', ')}. Nunca sale una pieza que ya tengas: si no quedan de esa rareza, recibes faradios. Si abres ${Chests.PITY} cofres seguidos sin una épica o legendaria, el siguiente la trae seguro (llevas ${Math.min(state.pity,Chests.PITY)}).</p></details>`;
  }
  // Fundición (decisión 0071), dentro de la pestaña Cofres. foundry = está abierta; melt = las piezas elegidas;
  // melting = lo que se está a punto de hacer con ellas ('reciclar' o 'fundir'), que pide confirmar.
  let foundry=false,melt=[],melting='';
  const keyOf=item=>item.slot+':'+item.id,sold=item=>item.price>0&&!item.level&&!item.casi&&!item.circuito&&!item.edition;
  const recycleValue=item=>Math.round(item.price*REWARD.foundry.back);
  // Lo que se puede fundir: piezas compradas o de cofre que se tienen y no se llevan puestas (ni en el otro cuerpo).
  function meltable(){
    const worn=new Set();
    for(const one of [look(),...Object.values(state.closet||{})])for(const [part,id] of Object.entries(one||{}))if(id)worn.add(part+':'+id);
    return byGrade(Avatar.CATALOG.filter(item=>sold(item)&&state.owned.includes(keyOf(item))&&!worn.has(keyOf(item))));
  }
  // La rareza que saldría de fundir las elegidas, si son las justas, de la misma rareza y queda alguna pieza por conseguir.
  function smeltInto(chosen){
    const grades=[...new Set(chosen.map(item=>Avatar.rarity(item)))],next=grades.length===1?Chests.RARITIES[Chests.rank(grades[0])+1]:null,body=look().body;
    if(chosen.length!==REWARD.foundry.need||!next)return null;
    const pool=Avatar.CATALOG.filter(item=>sold(item)&&!owns(item)&&(!item.for||item.for===body)&&Avatar.rarity(item)===next);
    return {next,pool};
  }
  const foundryDoor=()=>`<div class="foundry-door"><p><b>Fundición</b><small>Recicla las piezas que no uses por faradios, o funde ${REWARD.foundry.need} de la misma rareza para conseguir una de la siguiente.</small></p><button type="button" class="game-secondary" data-foundry>Abrir</button></div>`;
  function foundryTab(){
    const list=meltable(),body=look().body;melt=melt.filter(key=>list.some(item=>keyOf(item)===key));
    const chosen=list.filter(item=>melt.includes(keyOf(item))),back=chosen.reduce((sum,item)=>sum+recycleValue(item),0),into=smeltInto(chosen);
    const card=item=>{const on=melt.includes(keyOf(item)),zoom=ZOOM[item.slot]||'',rarity=Avatar.rarity(item);
      return `<button type="button" class="profile-tile${on?' is-trying':''}" data-melt="${keyOf(item)}" data-rarity="${rarity}" aria-pressed="${on}"><span class="tile-art">${Avatar.render(Avatar.preview(item,item.for||body),{bust:!zoom,zoom})}</span>${RARITY[rarity]?`<span class="tile-rarity">${RARITY[rarity]}</span>`:''}${on?'<span class="tile-badge" aria-hidden="true">✓</span>':''}<span class="tile-name">${item.name}</span><span class="tile-state price">+${coins(recycleValue(item))}</span></button>`};
    const smeltLabel=melting==='fundir'?`Confirmar: fundir ${REWARD.foundry.need}`:into?(into.pool.length?`Fundir ${REWARD.foundry.need} → 1 ${GRADE_NAME[into.next].toLowerCase()}`:`Ya tienes todas las de rareza ${GRADE_NAME[into.next].toLowerCase()}`):`Fundir: elige ${REWARD.foundry.need} de la misma rareza`;
    return `<div class="foundry-head"><button type="button" class="duel-link" data-foundry>← Volver a los cofres</button><h3 class="mission-title">Fundición <small>${chosen.length} ${chosen.length===1?'elegida':'elegidas'}</small></h3>
<p class="foundry-note">Elige piezas que no lleves puestas. <b>Reciclar</b> devuelve el ${Math.round(REWARD.foundry.back*100)} % de su precio. <b>Fundir</b> ${REWARD.foundry.need} de la misma rareza da una pieza al azar de la rareza siguiente que no tengas. Las piezas elegidas se pierden; pueden volver a salir en cofres.</p></div>
<div class="profile-items">${list.length?list.map(card).join(''):'<p class="wardrobe-empty">No tienes piezas para fundir: valen las compradas o de cofre que no lleves puestas.</p>'}</div>
<div class="foundry-bar"><button type="button" class="game-secondary" data-recycle${chosen.length?'':' disabled'}>${melting==='reciclar'?`Confirmar: reciclar ${chosen.length}`:chosen.length?`Reciclar · +${int(back)} ${COIN}`:'Reciclar'}</button><button type="button" class="game-primary" data-smelt${into&&into.pool.length?'':' disabled'}>${smeltLabel}</button></div>`;
  }
  // Quita del armario las piezas fundidas.
  function lose(keys){state.owned=state.owned.filter(key=>!keys.includes(key));melt=[]}
  // La entrada al mercado desde el armario (decisiones 0073 y 0074; la pantalla está en dist/market.js).
  const marketDoor=()=>'<div class="foundry-door market-door"><p><b>Mercado</b><small>Compra, vende y puja por artículos de colección con otros jugadores. Son las piezas con la etiqueta «Comerciable».</small></p><button type="button" class="game-secondary" data-open-market>Abrir</button></div>';
  // Pestaña Medallas: resumen, la ficha de la elegida, las medallas con su nivel y avance, y las insignias.
  let picked='';
  const dateText=day=>new Intl.DateTimeFormat('es-ES',{day:'numeric',month:'long',year:'numeric',timeZone:'Europe/Madrid'}).format(new Date(day+'T12:00:00Z'));
  function medalTile(def,stats){
    const p=Medals.progress(def,stats),id=Medals.idOf(def,Math.max(1,p.level)),isMedal=def.kind==='medalla',isNew=state.medals.fresh.some(fresh=>Medals.parse(fresh).def===def);
    const status=p.complete?`<small>${isMedal?'Completada':'Conseguida'}</small>`:`<div class="mission-bar"><i style="--m:${p.ratio}"></i></div><small>${int(Math.min(p.value,p.goal))} / ${int(p.goal)}${def.unit?' '+def.unit:''}</small>`;
    return `<button type="button" class="medal-tile${p.level?' is-got':''}${picked===def.id?' is-picked':''}" data-medal="${def.id}" aria-pressed="${picked===def.id}">${isNew?'<span class="medal-new">Nueva</span>':''}${Medals.art(id,{locked:!p.level,extra:isNew?'is-new':''})}<b>${def.name}</b>${isMedal?`<span class="medal-tier">${p.level?Medals.tierName(p.level):'Sin conseguir'}</span><span class="medal-pips" aria-hidden="true">${def.goals.map((_,i)=>`<i class="${i<p.level?'on':''}"></i>`).join('')}</span>`:''}${isMedal||def.goals[0]>1||p.complete?status:''}</button>`;
  }
  function medalDetail(def,stats){
    const p=Medals.progress(def,stats),isMedal=def.kind==='medalla',id=Medals.idOf(def,Math.max(1,p.level)),got=state.medals.got[Medals.idOf(def,p.level)],shown=featured()[0]===id;
    const steps=isMedal?`<ol class="medal-steps">${def.goals.map((goal,i)=>`<li class="${i<p.level?'on':''}"><span aria-hidden="true">${i<p.level?'✓':'·'}</span><b>${Medals.tierName(i+1)}</b><span>${def.text(goal)}</span></li>`).join('')}</ol>`:'';
    return `<section class="medal-detail" aria-live="polite">${Medals.art(id,{locked:!p.level})}<h3>${def.name}${isMedal&&p.level?` · ${Medals.tierName(p.level)}`:''}</h3>
<p>${isMedal?p.complete?'Tienes los cuatro niveles.':`Siguiente nivel: ${Medals.tierName(p.level+1).toLowerCase()}. Llevas ${int(p.value)} de ${int(p.goal)}.`:def.text()}</p>
${medalPieces(def.goals.map((goal,i)=>Medals.idOf(def,i+1))).map(item=>`<p class="medal-detail-prize">${owns(item)?'Tienes':'Da'} una pieza para el avatar: <b>${item.name}</b>${isMedal?` (nivel ${Medals.tierName(Medals.parse(item.medalla).tier).toLowerCase()})`:''}.</p>`).join('')}
<p class="medal-detail-date">${p.level&&got?`Conseguida el ${dateText(got)}`:!isMedal&&def.goals[0]>1?`Llevas ${int(p.value)} de ${int(def.goals[0])}`:'Aún sin conseguir'}</p>${steps}
<div class="medal-detail-actions">${p.level?shown?'<span>★ Es tu medalla destacada: la ven tus rivales y tu liga</span>':`<button type="button" class="game-primary" data-pin="${def.id}">Destacar junto a mi nombre</button>`:''}<button type="button" class="duel-link" data-medal="${def.id}">Cerrar</button></div></section>`;
  }
  function medalTab(){
    const stats=medalStats(),count=gotMedals().length,chosen=Medals.ALL.find(def=>def.id===picked);
    return `<div class="medal-summary"><p><b>${count} de ${Medals.TOTAL}</b><small>medallas e insignias</small></p><div class="mission-bar" role="img" aria-label="${count} de ${Medals.TOTAL} conseguidas"><i style="--m:${count/Medals.TOTAL}"></i></div></div>
${chosen?medalDetail(chosen,stats):''}
<h3 class="mission-title">Medallas <small>bronce, plata, oro y diamante</small></h3><div class="medal-grid">${Medals.MEDALS.map(def=>medalTile(def,stats)).join('')}</div>
<h3 class="mission-title">Insignias <small>se consiguen una vez</small></h3><div class="medal-grid">${Medals.BADGES.map(def=>medalTile(def,stats)).join('')}</div>`;
  }
  const planPrice=()=>billing?.price&&Number.isFinite(billing.price.amount)
    ?`${new Intl.NumberFormat('es-ES',{style:'currency',currency:(billing.price.currency||'eur').toUpperCase()}).format(billing.price.amount/100)}${{month:' al mes',year:' al año',week:' a la semana',day:' al día'}[billing.price.interval]||''}`:'';
  const planOffer=()=>({plus,pending:!planKnown&&!!link.owner,linked,enabled:!!billing?.enabled,price:planPrice()});
  function planCard(){
    const price=planPrice();
    const until=plus&&plusUntil?`<small>Activo hasta el ${dateText(madrid(new Date(plusUntil)))}</small>`:'';
    const action=!linked?'<button type="button" class="game-primary" data-plan-login>Entrar y descubrir Plus →</button>':billing?.managed?'<button type="button" class="game-primary" data-manage-plan>Gestionar mi suscripción</button>':!plus&&billing?.enabled?`<button type="button" class="game-primary" data-subscribe>Activar Plus${price?` · ${escapeHtml(price)}`:''} →</button>`:'';
    const note=plus?'Tus ventajas ya están activas.':!linked?'Entra con tu cuenta para consultar el precio y la disponibilidad.':billing?.enabled?'Suscripción con renovación automática. Cancela cuando quieras desde tu perfil.':'Todavía no se puede contratar. Aquí verás el precio y podrás activarlo cuando esté disponible.';
    return `<section class="profile-plan${plus?' is-plus':''}" aria-label="Faraday Plus">
      <p><b>FARADAY PLUS</b><span>${plus?'Activo':'Tu siguiente nivel'}</span></p>
      <h3>${plus?'Todo listo. Sigue jugando.':'Más juego. Menos pausas.'}</h3>
      <ul><li><b>Traza y Ascensión sin anuncios</b><span>Una partida tras otra, sin anuncios de continuación.</span></li>
      <li><b>Retos extra sin anuncios</b><span>Sigue practicando después de la edición diaria.</span></li>
      <li><b>Duelos ilimitados</b><span>Que las ganas de revancha pongan el límite.</span></li>
      <li><b>Hazlo más tuyo</b><span>Piezas de suscriptor y anuncios sin tope en el mercado.</span></li></ul>
      ${action}<p class="profile-plan-note">${note}</p>${until}
      <p class="profile-plan-fair">Los premios se ganan jugando. El mismo mérito y las mismas recompensas para todos.</p>
    </section>`;
  }
  // Entrada común para las ofertas de todas las modalidades. Cada juego puede suspender su pantalla.
  function openPlan({mode='general'}={}){
    if(!document.dispatchEvent(new CustomEvent('faraday:before-plan',{detail:{mode},cancelable:true})))return;
    setTimeout(()=>{
      open();
      const plan=main.querySelector('.profile-plan');
      if(plan){plan.tabIndex=-1;plan.scrollIntoView({block:'center'});plan.focus({preventScroll:true})}
    },0);
  }
  // Vitrina: las tres mejores, siempre a la vista bajo el nivel.
  function showcase(){
    const best=featured().slice(0,3),count=gotMedals().length;
    const slot=id=>{if(!id)return '<span class="profile-medal is-empty" aria-hidden="true"><i class="medal-slot"></i></span>';const {def,tier}=Medals.parse(id);return `<button type="button" class="profile-medal" data-tab="medallas" data-show-medal="${def.id}" aria-label="${Medals.label(id)}">${Medals.art(id)}<b>${def.name}</b><small>${def.kind==='medalla'?Medals.tierName(tier):'Insignia'}</small></button>`};
    return `<div class="profile-medals"><p class="profile-medals-head" style="margin:0"><span>Vitrina</span><small>${count} / ${Medals.TOTAL}</small></p><div class="profile-medals-row">${[0,1,2].map(i=>slot(best[i])).join('')}</div>${count?'':'<p class="profile-medals-note">Completa tu primer reto y estrena la vitrina.</p>'}</div>`;
  }
  // Mientras los faradios vuelan hasta el contador (coin-fly.js, decisión 0068), el contador enseña lo que van sumando
  // las monedas que llegan, no el saldo final, aunque el perfil se redibuje entre medias.
  let coinShow=null;
  function flyCoins(origin,before){
    const pill=$('#profile-coins'),paint=n=>{coinShow=n;pill.innerHTML=coins(n)};
    if(!window.CoinFly||shell.hidden||!(state.coins>before))return;
    CoinFly.fly({from:origin,pill,start:before,end:state.coins,paint,done:()=>{coinShow=null}});
  }
  // Perfil y cuenta (antes, el botón con la inicial de la portada): el apodo de duelos, ligas y comunidad, y entrar o salir.
  const NICK='casi-casi:duelo:perfil';
  const nickname=()=>{try{const value=JSON.parse(localStorage.getItem(NICK));if(typeof value?.name==='string')return value.name}catch{}return ''};
  function profileTab(){
    const account=typeof currentAccount!=='undefined'?currentAccount:null;
    return `<div class="profile-account"><h3 class="mission-title">Tu perfil</h3>
<label class="duel-name-field profile-name-field"><span>Tu apodo</span><input id="profile-name" type="text" maxlength="16" autocomplete="nickname" placeholder="Cómo te verán los demás" value="${escapeHtml(nickname())}"></label>
<p class="profile-account-note">Es el nombre con el que sales en los duelos, las ligas y las preguntas de la comunidad.</p>
<h3 class="mission-title">Tu cuenta</h3>
${account?`<p class="profile-account-note">Sesión iniciada con <b>${escapeHtml(account.email||account.name||'tu cuenta')}</b>. Tu progreso se guarda en tu cuenta.</p><button type="button" class="game-secondary profile-logout" data-auth-logout>Cerrar sesión</button>`
:`<p class="profile-account-note">Juegas sin cuenta: tu progreso solo está en este navegador.</p><button type="button" class="game-primary" data-plan-login>Entrar o crear cuenta</button>`}</div>`;
  }
  function saveNickname(value){
    const name=value.replace(/\s+/g,' ').trim().slice(0,16);if(!name)return;
    let profile={};try{profile=JSON.parse(localStorage.getItem(NICK))||{}}catch{}
    if(profile.name===name)return;
    try{localStorage.setItem(NICK,JSON.stringify({...profile,name}))}catch{}
    document.dispatchEvent(new CustomEvent('faraday:apodo',{detail:{name}}));showToast('Apodo guardado.');
  }
  function draw(){
    if(trying&&owns(trying))trying=null; // Recién desbloqueada (nivel o «Casi casi»): ya no se está probando.
    const current=look(),preview=trying?wear(current,trying.slot,trying.id):current,level=info(),[day,week]=periods(),waiting=pending();
    $('#profile-coins').innerHTML=coins(coinShow??state.coins);
    const missing=trying?(trying.edition?trying.edition.price:trying.price)-state.coins:0;
    const side=tab==='perfil'?profileTab():tab==='celebraciones'?celebrationTab():tab==='medallas'?medalTab():tab==='cofres'?(foundry?foundryTab():chestTab()+foundryDoor()):tab==='armario'?`<button class="celebrations-door" type="button" data-tab="celebraciones"><span><b>Celebraciones y emotes</b><small>Tu gesto para cada resultado, en todos los modos</small></span><span aria-hidden="true">→</span></button>`+marketDoor()+wardrobe(current)
      :`<h3 class="mission-title">Hoy <small>cambian a medianoche</small></h3><ul class="mission-list">${day.ids.map(id=>missionRow(day,id)).join('')}</ul><p class="mission-chest${day.chest?' is-open':''}">${day.chest?`Las tres de hoy, recogidas: +${REWARD.daySet} ≈ ✓`:`Recoge las tres de hoy y llévate ${REWARD.daySet} ≈ más`}</p><h3 class="mission-title">Esta semana <small>cambian el lunes</small></h3><ul class="mission-list">${week.ids.map(id=>missionRow(week,id)).join('')}</ul><p class="mission-chest${week.chest?' is-open':''}">${week.chest?'Cofre Rayo de la semana conseguido ✓':'Recoge las tres de la semana y llévate un cofre Rayo'}</p>`;
    // En el armario, el avatar se queda a la vista mientras se mira el catálogo (en el móvil, fijo arriba como un probador).
    const slotsScroll=main.querySelector('.wardrobe-slots')?.scrollLeft||0;
    main.classList.toggle('is-wardrobe',tab==='armario'||tab==='celebraciones');
    main.classList.toggle('is-celebrations',tab==='celebraciones');
    main.innerHTML=`<section class="profile-card" style="background:${Avatar.background(preview)}"><h2 id="profile-title" class="sr-only">Tu avatar</h2><button type="button" class="profile-edit" data-tab="perfil" aria-pressed="${tab==='perfil'}" aria-label="Editar perfil y cuenta" title="Editar perfil y cuenta"><svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg><span>Perfil</span></button><div class="profile-figure">${Avatar.render(preview,{label:'Tu avatar',live:true,drag:true,zoom:tab==='celebraciones'?'stage':''})}</div><p class="profile-hint">Arrastra para girarlo</p>
${trying?`<div class="profile-try"><p>Probando <b>${trying.name}</b></p>${trying.plus?'<p class="profile-try-note">Pieza de suscriptor: se puede llevar mientras la suscripción esté activa. Todavía no se puede contratar.</p>':trying.level?`<p class="profile-try-note">Se desbloquea gratis al llegar al nivel ${trying.level}.</p>`:trying.casi?`<p class="profile-try-note">Exclusiva: se desbloquea gratis al conseguir ${trying.casi} «Casi casi» (respuestas a menos de 1,1×). Llevas ${int(state.casi.n)}.</p>`:trying.rango?`<p class="profile-try-note">Exclusiva de las clasificatorias: se desbloquea al llegar al rango ${rankName(trying.rango)}. Ni se compra ni sale en cofres, y no se pierde si luego bajas de rango.</p>`:trying.medalla?`<p class="profile-try-note">Exclusiva: se desbloquea con «${Medals.label(trying.medalla)}». ${medalText(trying.medalla)} Ni se compra ni sale en cofres.</p>`:trying.circuito?`<p class="profile-try-note">Exclusiva del Circuito de amigos: ${trying.circuito==='bienvenida'?'para quien entra invitado por un amigo y juega su primer reto.':`se desbloquea cuando ${trying.circuito===1?'un amigo que invites juegue':trying.circuito+' amigos que invites jueguen'} 3 retos del día. Llevas ${int(state.circuito.n)}.`}</p><button type="button" class="game-secondary" data-open-circuit>Invitar amigos</button>`:trying.edition?editionTry(trying,missing):`<button type="button" class="game-primary" data-buy${missing>0?' disabled':''}>${missing>0?`Te faltan ${int(missing)} ${COIN}`:`Comprar · ${int(trying.price)} ${COIN}`}</button>`}<button type="button" class="duel-link" data-cancel>Quitar</button></div>`:''}
<div class="profile-level"><span><b>Nivel ${level.level}</b><small>${int(level.done)} / ${int(level.need)} XP</small></span><div class="duel-xpbar"><i style="--xp:${level.ratio}"></i></div>${state.streak.count>1&&state.streak.last>=shift(madrid(),-1)?`<p>🔥 ${state.streak.count} días seguidos</p>`:''}${shieldOffer()?`<div class="profile-shield"><p>🔥 Ayer no jugaste: tu racha de ${shieldOffer().days} días está a punto de perderse.</p><button type="button" class="game-secondary" data-shield${state.coins<REWARD.shield.price?' disabled':''}>${state.coins<REWARD.shield.price?`Te faltan ${int(REWARD.shield.price-state.coins)} ${COIN}`:`Proteger la racha · ${REWARD.shield.price} ${COIN}`}</button></div>`:''}<p class="profile-casi" title="Respuestas a menos de 1,1× de la cifra real"><span aria-hidden="true">🎯</span> ${int(state.casi.n)} «Casi casi»${state.casi.n<CasiCasi.GOAL?` <small>· ${CasiCasi.GOAL-state.casi.n} más para la sudadera exclusiva</small>`:''}</p></div>${showcase()}${planCard()}</section>
<section class="profile-side"><div class="profile-tabs" role="tablist"><button type="button" role="tab" aria-selected="${tab==='armario'||tab==='celebraciones'}" data-tab="armario">Armario</button><button type="button" role="tab" aria-selected="${tab==='misiones'}" data-tab="misiones">Misiones${waiting?`<i class="profile-dot">${waiting}</i>`:''}</button><button type="button" role="tab" aria-selected="${tab==='cofres'}" data-tab="cofres">Cofres${chestTotal()?`<i class="profile-dot">${chestTotal()}</i>`:''}</button><button type="button" role="tab" aria-selected="${tab==='medallas'}" data-tab="medallas">Medallas${state.medals.fresh.length?`<i class="profile-dot">${state.medals.fresh.length}</i>`:''}</button></div>${side}</section>`;
    const slots=main.querySelector('.wardrobe-slots');if(slots)slots.scrollLeft=slotsScroll;
    if(tab==='celebraciones')previewCelebration(previewCue);
  }
  function open(which){
    syncEditions();
    const fresh=state.medals.fresh.length>0;
    if(which)tab=which;else if(fresh)tab='medallas';else if(chestTotal())tab='cofres';trying=null;picked='';shell.hidden=false;document.body.classList.add('modal-open');
    if(typeof toggleMenu==='function')toggleMenu(false);draw();$('#profile-close').focus();
    if(fresh&&tab==='medallas')celebrateFresh();
  }
  function close(){
    shell.hidden=true;trying=null;
    if($('#game-shell').hidden&&$('#duel-shell').hidden)document.body.classList.remove('modal-open');
    document.dispatchEvent(new CustomEvent('faraday:look'));
  }
  // Buscador y rareza del armario: al escribir solo se rehacen las cartas, así el campo no pierde el foco.
  shell.addEventListener('input',event=>{
    if(event.target.matches('[data-search]')){query=event.target.value;redrawResults()}
  });
  shell.addEventListener('change',event=>{
    const target=event.target;
    if(target.matches('[data-grade]')){grade=target.value;redrawResults()}
    if(target.matches('[data-celebration-mode]')){celebrationMode=target.value;previewCue='clavada';draw();main.querySelector('[data-celebration-mode]').focus()}
    if(target.dataset.celebrationCue){
      const cue=target.dataset.celebrationCue;
      if(target.value)state.celebrations[celebrationMode][cue]=target.value;else delete state.celebrations[celebrationMode][cue];
      state.celebrations=Celebrations.normalize(state.celebrations);save();previewCelebration(cue);
      main.querySelector('.celebration-status').textContent='Guardado · '+Celebrations.CUES.find(item=>item.id===cue).name;
    }
  });
  shell.addEventListener('click',event=>{
    const target=event.target.closest('button');if(!target)return;
    if(target.dataset.previewCue){previewCelebration(target.dataset.previewCue);return}
    if(target.hasAttribute('data-reset-celebrations')){state.celebrations[celebrationMode]={};save();draw();main.querySelector('[data-reset-celebrations]').focus();main.querySelector('.celebration-status').textContent='Selección restablecida.';return}
    if(target.dataset.tab){tab=target.dataset.tab;trying=null;swapping=null;foundry=false;melt=[];melting='';picked=target.dataset.showMedal||'';draw();if(tab==='medallas')celebrateFresh();if(tab==='perfil')main.querySelector('.profile-account')?.scrollIntoView({block:'start',behavior:'smooth'});return}
    if(target.dataset.medal){picked=picked===target.dataset.medal?'':target.dataset.medal;draw();if(picked)main.querySelector('.medal-detail')?.scrollIntoView({block:'nearest',behavior:'smooth'});return}
    if(target.dataset.pin){state.medals.pin=target.dataset.pin;save();draw();document.dispatchEvent(new CustomEvent('faraday:look'));showToast('Destacada: la verán tus rivales en los duelos y tu grupo en las ligas.');return}
    if(target.dataset.slot){slot=target.dataset.slot;trying=null;draw();main.querySelector('.wardrobe-slots [aria-selected=true]')?.scrollIntoView({block:'nearest',inline:'nearest'});return}
    if(target.dataset.show){show=target.dataset.show;draw();return}
    // Cambiar de cuerpo: cada uno guarda su ropa y su peinado; la piel y el color de pelo se conservan.
    if(target.dataset.body){
      const now=look(),next=target.dataset.body;
      if(next!==now.body&&Avatar.BODIES.some(([id])=>id===next)){state.closet={...state.closet,[now.body]:now};state.look={...(state.closet[next]||Avatar.defaults(next)),body:next,skin:now.skin,hairColor:now.hairColor};trying=null;save();refresh()}
      return;
    }
    if(target.dataset.item!==undefined){
      const [itemSlot,id]=target.dataset.item.split(':'),item=Avatar.find(itemSlot,id);
      if(owns(item)){state.look=wear(look(),itemSlot,id);trying=null;save();refresh()}else{trying=trying===item?null:item;draw()}
      return;
    }
    if(target.hasAttribute('data-cancel')){trying=null;draw();return}
    if(target.hasAttribute('data-buy-edition')&&trying?.edition&&linked){
      const item=trying,edition=item.edition;if(target.disabled)return;target.disabled=true;
      serverAsk('comprar-edicion',{edition:edition.id},'No se pudo comprar la edición. Inténtalo otra vez.','No se puede comprar esta edición ahora mismo.').then(data=>{
        target.disabled=false;if(!data){syncEditions();return}
        state.editions={...state.editions,[edition.id]:data.serial};state.look=wear(look(),item.slot,item.id);if(trying===item)trying=null;
        showToast(`${item.name}: ¡tuya! N.º ${data.serial} de ${data.total}`);save();refresh();serverCoins(data.coins);syncEditions();
      });
      return;
    }
    if(target.hasAttribute('data-buy')&&trying&&state.coins>=trying.price){
      const item=trying,own=()=>{state.owned.push(item.slot+':'+item.id);state.look=wear(look(),item.slot,item.id);showToast(`${item.name}: ¡ya es tuyo!`);if(trying===item)trying=null;save();refresh()};
      if(!linked){move(-item.price,'tienda');own();return}
      // Con cuenta, la compra la cobra el servidor al precio de su catálogo y apunta la pieza (decisión 0062).
      if(target.disabled)return;target.disabled=true;
      serverAsk('comprar',{item:item.slot+':'+item.id},'No se pudo comprar. Inténtalo otra vez.').then(data=>{target.disabled=false;if(data){own();serverCoins(data.coins)}});return;
    }
    if(target.dataset.openChest){openChest(target.dataset.openChest);return}
    if(target.dataset.buyChest){buyChest(target.dataset.buyChest);return}
    // Fundición (decisión 0071): abrir y cerrar, elegir piezas, y reciclar o fundir (el primer toque pide confirmar).
    if('foundry' in target.dataset){foundry=!foundry;melt=[];melting='';draw();return}
    if(target.dataset.melt){
      const key=target.dataset.melt;melting='';
      if(melt.includes(key))melt=melt.filter(one=>one!==key);else if(melt.length<REWARD.foundry.max)melt.push(key);
      draw();return;
    }
    if('recycle' in target.dataset||'smelt' in target.dataset){
      const mode='recycle' in target.dataset?'reciclar':'fundir';
      if(melting!==mode){melting=mode;draw();return}
      melting='';if(target.disabled)return;
      const keys=[...melt],chosen=meltable().filter(item=>keys.includes(keyOf(item)));if(!chosen.length||chosen.length!==keys.length){draw();return}
      const recycled=(amount,count)=>showToast(`${count===1?'Pieza reciclada':count+' piezas recicladas'}: +${int(amount)} ≈`);
      const smelted=key=>{const [part,id]=key.split(':'),item=Avatar.find(part,id);if(!state.owned.includes(key))state.owned.push(key);save();draw();showToast(`¡Fundición! ${item?`${item.name} (${GRADE_NAME[Avatar.rarity(item)].toLowerCase()})`:'Tienes una pieza nueva'}`)};
      if(mode==='reciclar'){
        if(!linked){const amount=chosen.reduce((sum,item)=>sum+recycleValue(item),0);lose(keys);move(amount,'reciclaje');save();refresh();recycled(amount,keys.length)}
        else{target.disabled=true;serverAsk('reciclar',{items:keys},'No se pudo reciclar. Inténtalo otra vez.','Alguna de esas piezas ya no es tuya.').then(data=>{
          if(!data){syncItems();return draw()}
          lose(data.items);serverCoins(data.coins);save();draw();recycled(data.amount,data.items.length);
        })}
        return;
      }
      const into=smeltInto(chosen);if(!into||!into.pool.length){draw();return}
      if(!linked){lose(keys);smelted(keyOf(into.pool[Math.floor(dice()*into.pool.length)]))}
      else{target.disabled=true;serverAsk('fundir',{items:keys},'No se pudo fundir. Inténtalo otra vez.','No se pueden fundir esas piezas.').then(data=>{
        if(!data){syncItems();return draw()}
        lose(data.items);smelted(data.item);
      })}
      return;
    }
    // Cambiar una misión por otra (decisión 0069): el primer toque pide confirmar; el segundo cobra y la cambia.
    if(target.dataset.swap){
      const id=target.dataset.swap;
      if(swapping!==id){swapping=id;draw();return}
      swapping=null;
      const period=periods().find(p=>p.ids.includes(id));if(!period||!canSwap(period,id)){draw();return}
      const apply=(to,progress=0)=>{
        if(!MISSIONS[to]||!period.ids.includes(id))return draw();
        period.ids[period.ids.indexOf(id)]=to;period.swapped=[...(period.swapped||[]),to];period.out=[...(period.out||[]),id];
        delete period.progress[id];period.progress[to]=progress;save();draw();showToast(`Misión nueva: ${MISSIONS[to].text}`);
      };
      if(!linked){
        const pool=(period===state.missions.day?DAILY:WEEKLY).filter(other=>!period.ids.includes(other)&&!(period.out||[]).includes(other));
        if(!pool.length){showToast('No hay otra misión por la que cambiarla.');draw();return}
        if(!spend(REWARD.swap,'cambio-mision')){showToast('No te llegan los faradios.');draw();return}
        apply(pool[Math.floor(Math.random()*pool.length)]);
      }else if(!target.disabled){target.disabled=true;serverAsk('cambiar-mision',{id},'No se pudo cambiar la misión. Inténtalo otra vez.','No hay otra misión por la que cambiarla.').then(data=>{
        if(!data)return draw();
        serverCoins(data.coins);apply(data.to,data.progress);
      })}
      return;
    }
    // Proteger la racha (decisión 0069): ayer cuenta como jugado y la racha sigue. Con cuenta lo cobra el servidor.
    // Suscripción (decisión 0077): el servidor da la dirección de la página de pago de Stripe, o la de su portal, y se va a ella.
    if('planLogin' in target.dataset){window.Auth?.open();return}
    if('authLogout' in target.dataset){if(!target.disabled){target.disabled=true;window.Auth?.logout().finally(()=>{target.disabled=false})}return}
    if('subscribe' in target.dataset||'managePlan' in target.dataset){
      if(target.disabled)return;target.disabled=true;
      serverAsk('subscribe' in target.dataset?'suscribirse':'gestionar-suscripcion',{},'No se pudo abrir la página de pago. Inténtalo otra vez.','Ya tienes la suscripción activa.').then(data=>{if(data?.url)location.href=data.url;else target.disabled=false});
      return;
    }
    if('shield' in target.dataset){
      const offer=shieldOffer();if(!offer||target.disabled)return;
      const done=days=>{state.streak={count:days,last:shift(madrid(),-1)};shield=null;save();draw();showToast(`Racha protegida: sigues con ${days} días. Juega hoy para sumar otro.`)};
      if(!linked){if(spend(REWARD.shield.price,'protector'))done(offer.days)}
      else{target.disabled=true;serverAsk('proteger-racha',{},'No se pudo proteger la racha. Inténtalo otra vez.','Tu racha ya no se puede proteger.').then(data=>{if(!data)return draw();serverCoins(data.coins);done(Number.isInteger(data.streak)?data.streak:offer.days)})}
      return;
    }
    if(target.dataset.claim){
      const id=target.dataset.claim;
      // De dónde salen las monedas: el botón, tal como está ahora (al recoger se redibuja y desaparece).
      const origin=target.getBoundingClientRect(),before=state.coins;
      const take=()=>{
      const period=periods().find(p=>p.ids.includes(id));
      if(!period||period.claimed.includes(id)||(period.progress[id]||0)<MISSIONS[id].goal)return;
      period.claimed.push(id);state.stats.missions++;let gained=MISSIONS[id].coins,won='';
      // Las tres del día dan faradios (decisión 0066); las tres de la semana, un cofre Rayo, que se abre en el momento.
      if(!period.chest&&period.ids.every(mission=>period.claimed.includes(mission))){period.chest=true;if(period===state.missions.day)gained+=REWARD.daySet;else{won='rayo';state.stats.weekSet=1;grant(won)}}
      const result=reward({xp:REWARD.missionXp,coins:linked?0:gained,reason:'misiones'});showToast(`+${gained} ≈ · +${REWARD.missionXp} XP${won?` · ¡Cofre ${Chests.CHESTS[won].name}!`:''}${levelNote(result)}`);
      if(!linked)flyCoins(origin,before);
      if(won&&!linked){tab='cofres';draw();openChest(won)}
      };
      // Con cuenta, la misión la comprueba y la paga el servidor (decisión 0061); aquí se marca y se da el cofre.
      if(!linked)take();
      else if(!target.disabled){target.disabled=true;serverAsk('mision',{id},'No se pudo recoger la misión. Inténtalo otra vez.','El servidor todavía no da esa misión por completada. Prueba en unos segundos.').then(data=>{
        target.disabled=false;if(!data)return;
        take();serverCoins(data.coins);flyCoins(origin,before);
        // Si con esta se completan las tres, el servidor da el cofre: se trae y se abre.
        syncServer().then(()=>{if(data.chest){tab='cofres';draw();openChest(data.chest)}});
      })}
    }
  });
  $('#profile-close').addEventListener('click',close);
  document.querySelectorAll('[data-open-profile]').forEach(button=>button.addEventListener('click',()=>open()));
  document.addEventListener('click',event=>{const button=event.target.closest('[data-open-profile-inline]');if(button)open(button.dataset.openProfileInline||undefined)});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!shell.hidden&&!document.querySelector('.medal-stage')){event.stopImmediatePropagation();close()}},true);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh()});

  // Premios del Circuito (circuito.js): el servidor ya los ha marcado como cobrados; aquí solo se entregan.
  // Devuelve el texto del aviso y el cofre que conviene abrir. connections = amigos conectados según el servidor.
  // server = lo que ya ha repartido el servidor a quien tiene cuenta (saldo, cofres y batería): aquí solo se avisa.
  function circuitPrizes(prizes,connections,server=null){
    const notes=[];let open=null;
    for(const prize of prizes){
      if(prize.kind==='bienvenida'){state.circuito.welcome=true;gift(prize.chest);open=prize.chest;notes.push(`¡Bienvenida al Circuito! Cofre Rayo y ${look().body==='mujer'?'gorro':'gorra'} Enchufe`)}
      if(prize.kind==='conexion-invitado'){if(!server)move(prize.coins,'referidos');notes.push(`Ya estás conectado: +${prize.coins} ≈`)}
      if(prize.kind==='conexion'){if(prize.chest){gift(prize.chest);open??=prize.chest;notes.push('Amigo conectado: ¡cofre Rayo!')}else if(prize.coins){if(!server)move(prize.coins,'referidos');notes.push(`Amigo conectado: +${prize.coins} ≈`)}}
    }
    const before=state.circuito.n;if(Number.isInteger(connections)&&connections>before)state.circuito.n=connections;
    const body=look().body,unlocked=Avatar.CATALOG.filter(item=>Number.isInteger(item.circuito)&&item.circuito>before&&item.circuito<=state.circuito.n&&(!item.for||item.for===body));
    if(unlocked.length)notes.push(`Nuevo: ${unlocked.map(item=>item.name).join(', ')}`);
    // Escalón de 3 amigos: un cofre Tormenta, una sola vez.
    if(state.circuito.n>=3&&!state.circuito.storm){state.circuito.storm=true;gift('tormenta');notes.push('¡3 amigos conectados: cofre Tormenta!')}
    save();refresh();
    if(server){applyServer(server,true);serverCoins(server.coins)}
    return {text:notes.join(' · '),open};
  }
  // Corriente compartida: batería extra por cada día que jugasteis los dos (una vez por amigo y día).
  function circuitCurrent(list,amount){
    let full=0;const names=[];
    for(const link of list||[])for(const day of link.days||[]){
      const key=link.id+':'+day;
      if(state.circuito.current[key])continue;
      state.circuito.current[key]=true;full+=charge(amount);names.push(link.name);
    }
    // Solo se recuerdan los días que el servidor aún puede enseñar (los últimos 7): los anteriores ya no vuelven.
    const oldest=shift(madrid(),-8);for(const key of Object.keys(state.circuito.current))if(key.slice(-10)<oldest)delete state.circuito.current[key];
    save();refresh();
    return names.length?`⚡ Corriente con ${[...new Set(names)].join(' y ')}: +${amount*names.length} de batería${chargeNote(full)}`:'';
  }
  // Progreso en la cuenta (decisión 0052). Con sesión iniciada, el progreso también se guarda en el servidor
  // (/api/progreso) y se recupera en otro dispositivo. El saldo de faradios lo lleva el servidor: aquí solo se manda
  // cuánto ha cambiado desde la última vez (link.acked = último saldo que confirmó). Así puede cobrar los votos de
  // las preguntas de la comunidad y poner un tope diario a lo que se gana.
  const LINK='casi-casi:progreso:cuenta';
  let link=stored(LINK)||{},linked=false,timer=0,sending=false,again=false;
  const keepLink=()=>{try{localStorage.setItem(LINK,JSON.stringify(link))}catch{}};
  // Todo cambio de saldo pasa por aquí. Con cuenta, se apunta el motivo (link.moves) para que el servidor lo anote en su
  // libro contable (decisión 0057); el desglose viaja con el siguiente guardado.
  function move(amount,reason){
    if(!amount)return;state.coins+=amount;
    if(linked){link.moves??={};link.moves[reason]=(link.moves[reason]||0)+amount;if(!link.moves[reason])delete link.moves[reason];keepLink()}
  }
  async function cloud(action,extra={}){
    const response=await fetch('/api/progreso',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify({action,...extra}),signal:AbortSignal.timeout(10000)});
    if(!response.ok)throw Object.assign(Error('progreso '+response.status),{status:response.status});
    return await response.json();
  }
  function schedule(){if(!linked)return;clearTimeout(timer);timer=setTimeout(push,1500)}
  // Premios que paga el servidor (decisión 0058). link.claims = {fecha: intentos} de las jornadas completadas que aún no
  // se han cobrado: se piden al momento y, si falla la red o el servidor todavía no tiene la última respuesta, otra vez
  // en el siguiente guardado o al volver a entrar. El servidor paga cada jornada una sola vez.
  let collecting=false;
  // La clave es la fecha de la jornada o «duelo:<id>» (decisión 0059).
  function claim(key){if(!linked)return;link.claims??={};link.claims[key]??=0;keepLink();setTimeout(collect,1500)}
  async function collect(){
    // Nunca a la vez que un guardado: si el servidor paga mientras viaja un guardado, el navegador contaría el premio dos
    // veces. El guardado, al acabar, vuelve a llamar aquí.
    if(!linked||collecting||sending||!link.claims||!Object.keys(link.claims).length)return;collecting=true;
    try{
      for(const day of Object.keys(link.claims)){
        try{const {coins}=await cloud('premio',day.startsWith('duelo:')?{duel:day.slice(6)}:{day});if(link.claims)delete link.claims[day];serverCoins(coins)}
        catch(error){
          if(!link.claims)break;
          // 409: el servidor aún no ve el reto completo; se reintenta unas cuantas veces. Otros 4xx: no hay nada que cobrar.
          if(error.status===409){if(++link.claims[day]>=5)delete link.claims[day]}else if(error.status>=400&&error.status<500)delete link.claims[day];
        }
      }
      keepLink();
    }finally{collecting=false;if(again)schedule()}
    // Lo cobrado puede haber dado un cofre (batería, racha, nivel).
    syncServer();
  }
  async function push(){
    if(!linked)return;if(sending||collecting){again=true;return}
    sending=true;again=false;
    const sent=state.coins,moves={...link.moves},{coins:_,...rest}=state;
    try{
      const {coins}=await cloud('guardar',{state:rest,delta:sent-(link.acked??0),moves});
      // Lo apuntado mientras viajaba la petición se queda para el siguiente guardado.
      if(link.moves)for(const [reason,amount] of Object.entries(moves)){link.moves[reason]=(link.moves[reason]||0)-amount;if(!link.moves[reason])delete link.moves[reason]}
      // Lo ganado o gastado mientras viajaba la petición se conserva.
      state.coins=Math.max(0,coins+(state.coins-sent));link.acked=coins;keepLink();store();refresh();
    }catch{}finally{sending=false;if(again)schedule();else collect()}
  }
  // Pide al servidor que pague una misión completada. Devuelve el saldo, o null si no la da por completada o falla.
  // Espera a que no haya un guardado ni un cobro en marcha, para que no se cruce con ellos.
  // Cofres y batería según el servidor (decisión 0063). applyServer los copia aquí para pintarlos; quiet = sin avisar.
  let opening=false;
  function applyServer(data,quiet=false){
    // La oferta de proteger la racha (decisión 0069): se avisa una vez por visita.
    if(data&&typeof data==='object'){
      shield=data.shield&&Number.isInteger(data.shield.days)?{days:data.shield.days}:null;
      if(shield&&!shieldTold){shieldTold=true;showToast(shieldNote(shield.days))}
    }
    if(!data?.chests||typeof data.chests!=='object')return;
    const before=chestTotal();
    for(const type of Chests.TYPES)state.chests[type]=Number.isInteger(data.chests[type])&&data.chests[type]>0?data.chests[type]:0;
    if(Number.isFinite(data.charge))state.charge=data.charge;
    // Si la cuenta tiene la suscripción activa (decisión 0076).
    if(typeof data.plus==='boolean'){
      const before=JSON.stringify({plus,plusUntil,billing}),was=planKnown;planKnown=true;
      plus=data.plus;plusUntil=data.plusUntil||null;billing=data.billing||null;
      if(!was||before!==JSON.stringify({plus,plusUntil,billing}))document.dispatchEvent(new CustomEvent('faraday:plan'));
    }
    // La experiencia también es la del servidor (decisión 0065): así el nivel que se ve es el que cuenta.
    if(Number.isInteger(data.xp)&&data.xp>=0)state.xp=data.xp;
    store();refresh();
    if(!quiet&&chestTotal()>before)showToast(chestTotal()-before===1?'¡Tienes un cofre nuevo!':`¡Tienes ${chestTotal()-before} cofres nuevos!`);
  }
  async function syncServer(){if(!linked)return false;try{applyServer(await cloud('estado'));return true}catch{return false}}
  // El armario de quien tiene cuenta es el inventario del servidor (decisión 0065): se copia al entrar.
  async function syncItems(){
    if(!await syncServer())return;
    try{
      const {items,collectibles}=await cloud('inventario');
      if(Array.isArray(items))state.owned=items.map(one=>one.item).filter(key=>typeof key==='string');
      // Las unidades de colección: de cada edición se enseña el número de serie más bajo que se tenga.
      if(Array.isArray(collectibles)){state.editions={};for(const one of collectibles)if(!state.editions[one.edition]||one.serial<state.editions[one.edition])state.editions[one.edition]=one.serial}
      store();refresh();
    }catch{}
    syncEditions();
  }
  // Pide algo al servidor que cambia el saldo (recoger una misión, comprar, usar una pista). Devuelve su respuesta, o
  // null si falla (y avisa). Espera a que no haya un guardado ni un cobro en marcha, para no cruzarse con ellos.
  async function serverAsk(action,extra,failed,notYet=failed){
    while(sending||collecting)await new Promise(resolve=>setTimeout(resolve,150));
    collecting=true;
    try{return await cloud(action,extra)}
    catch(error){showToast(error.status===402?'No te llegan los faradios.':error.status===409?notYet:failed);return null}
    finally{collecting=false;if(again)schedule()}
  }
  // Pagar algo fuera de la tienda (las pistas). Sin cuenta, se resta aquí; con cuenta, lo cobra el servidor (decisión 0062).
  async function pay(amount,reason,ref){
    if(!linked)return spend(amount,reason);
    if(!(amount>0)||state.coins<amount)return false;
    const data=await serverAsk('pista',{question:ref},'No se pudo usar la pista. Inténtalo otra vez.');
    if(!data)return false;serverCoins(data.coins);return true;
  }
  async function collectTrendPrize(day){
    if(!linked)return null;
    const owner=link.owner;
    const data=await serverAsk('premio-traza',{day},'No se pudo guardar el premio de Traza. Puedes reintentarlo.');
    if(!linked||link.owner!==owner)return null;
    if(data){serverCoins(data.coins);applyServer(data,true)}
    return data;
  }
  // Saldo que devuelve el servidor tras cobrar algo (votos y propuestas de la comunidad).
  function serverCoins(coins){
    if(!Number.isInteger(coins))return;
    state.coins=Math.max(0,coins+(state.coins-(link.acked??state.coins)));link.acked=coins;keepLink();store();refresh();
  }
  async function attach(){
    await playerReady;const owner=playerId();let remote;
    try{remote=await cloud('leer')}catch{return}
    const has=remote.state&&typeof remote.state==='object'&&remote.state.v;
    if(has&&(link.owner!==owner||(remote.state.savedAt||0)>(state.savedAt||0))){
      // La cuenta manda: su progreso sustituye al de este navegador.
      const other=link.owner!==owner;hydrate({...remote.state,coins:remote.coins});
      if(other&&booted)showToast('Hemos recuperado el avatar y los faradios de tu cuenta.');
    }else if(has)state.coins=Math.max(0,remote.coins+(state.coins-(link.acked??remote.coins)));
    // Si es la misma cuenta de antes, se conserva lo que quedó pendiente de apuntar (moves) y de cobrar (claims).
    const kept=link.owner===owner?{moves:link.moves,claims:link.claims}:{};
    link={owner,acked:has?remote.coins:remote.coins??0,...kept};keepLink();linked=true;store();refresh();
    if(!has||state.savedAt>(remote.state.savedAt||0))await push();else collect();
    syncItems();
    document.dispatchEvent(new CustomEvent('faraday:progreso'));
  }
  // Al cerrar sesión, este navegador empieza de cero: el progreso queda en la cuenta (como las respuestas, decisión 0022).
  function detach(){
    const was=linked||link.owner;linked=false;plus=false;plusUntil=null;billing=null;planKnown=true;clearTimeout(timer);
    if(!was)return;
    link={};keepLink();hydrate(null);state.welcome=true;state.cofres=true;store();refresh();
  }
  // Al volver de la página de pago de Stripe (decisión 0077): el aviso de pago puede tardar unos segundos, así que se
  // pregunta al servidor varias veces hasta que la suscripción aparece.
  const paid=new URLSearchParams(location.search).get('suscripcion');
  if(paid){
    history.replaceState(null,'',location.pathname);
    if(paid==='ok'){
      let tries=0;const check=async()=>{if(linked)await syncServer();if(plus){showToast('¡Suscripción activa! Gracias.');if(!shell.hidden)draw();return}if(++tries<10)setTimeout(check,2000);else showToast('El pago está hecho; la suscripción aparecerá en unos minutos.')};
      setTimeout(()=>{showToast('Pago recibido: activando tu suscripción…');check()},1500);
    }else setTimeout(()=>showToast('No se ha hecho ningún cobro.'),1500);
  }
  // Si el servidor no contesta, la oferta de Plus no se queda oculta para siempre.
  setTimeout(()=>{if(!planKnown){planKnown=true;document.dispatchEvent(new CustomEvent('faraday:plan'))}},8000);
  document.addEventListener('faraday:cuenta',({detail})=>{if(detail?.account)attach();else if(detail&&'account' in detail)detach()});
  document.addEventListener('faraday:cuenta',()=>{if(!shell.hidden&&tab==='perfil')draw()});
  shell.addEventListener('change',event=>{if(event.target.id==='profile-name')saveNickname(event.target.value)});
  // Gastar faradios fuera de la tienda (las pistas, decisión 0039). Devuelve false si no llegan.
  function spend(amount,reason='otros'){if(!(amount>0)||state.coins<amount)return false;move(-amount,reason);save();refresh();return true}
  window.Progress={reaction,gestures:mode=>Celebrations.loadout(state.celebrations,mode),plus:()=>plus,planOffer,openPlan,collectTrendPrize,look,spend,pay,serverCoins,cloud,ask:serverAsk,syncItems,claim,linked:()=>linked,circuit:()=>({...state.circuito}),circuitPrizes,circuitCurrent,level:()=>levelOf(state.xp),casi:()=>state.casi.n,info,coins:()=>state.coins,streak:()=>state.streak.count,reward,open,REWARD,chests:()=>({...state.chests}),openChest,
    // badge = la medalla destacada, que viaja con el avatar a los duelos y a las ligas; medals = todo lo conseguido.
    badge:()=>featured()[0]||'',medals:()=>gotMedals()};
  // Regalo de bienvenida: lo justo para estrenar el armario con una primera pieza.
  if(!state.welcome){state.welcome=true;move(REWARD.welcome,'bienvenida')}
  // Un cofre Chispa de regalo para estrenar los cofres, también para quien ya jugaba antes de que existieran.
  if(!state.cofres){state.cofres=true;grant('chispa')}
  periods();save();refresh();booted=true;
  // Sin cuenta, el aviso de la racha en peligro sale de este navegador (con cuenta lo da el servidor, en applyServer).
  setTimeout(()=>{const offer=!linked&&!shieldTold&&shieldOffer();if(offer){shieldTold=true;showToast(shieldNote(offer.days))}},4000);
})();

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
  const int=n=>new Intl.NumberFormat('es-ES',{maximumFractionDigits:0,useGrouping:'always'}).format(n);
  const COIN='<span class="coin" aria-hidden="true">≈</span>',coins=n=>`${int(n)} ${COIN}<span class="sr-only"> faradios</span>`;
  const madrid=(date=new Date())=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Madrid'}).format(date);
  const shift=(day,days)=>new Date(Date.parse(day+'T12:00:00Z')+days*86400000).toISOString().slice(0,10);
  const monday=day=>shift(day,-((new Date(day+'T12:00:00Z').getUTCDay()+6)%7));

  // Recompensas: un reto del día da para una pieza sencilla cada dos días; una pieza especial pide una o dos semanas.
  // Subir de nivel da 30 ≈ y un cofre (Dinamo en los niveles múltiplos de 10, Rayo en los demás múltiplos de 5 y Chispa en el resto). charge = lo que carga
  // la batería de cofres cada reto; la de los duelos la calcula duel.js, con su tope diario.
  const REWARD={welcome:100,answerXp:5,todayXp:30,todayCoins:20,archiveXp:10,archiveCoins:5,streakCoins:2,streakCap:7,missionXp:10,
    duel:{win:15,draw:8,loss:5},levelCoins:30,levelChest:Chests.levelChest,charge:{today:40,archive:10,full:100}};
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
  let state={v:1,xp:0,coins:0,owned:[],look:{...Avatar.DEFAULT},closet:{},days:[],streak:{count:0,last:''},missions:{},chests:{},charge:0,pity:0,bought:{day:'',count:0},casi:{n:0,ids:[]},
    // stats = cifras de las medallas que no salen del resto del progreso; medals = got {id: fecha}, fresh = sin ver, pin = la destacada.
    stats:null,medals:{got:{},fresh:[],pin:''}};
  try{
    const saved=JSON.parse(localStorage.getItem(KEY));
    if(saved&&typeof saved==='object')state={...state,...saved,look:Avatar.normalize(saved.look),streak:{...state.streak,...saved.streak}};
    // Quien ya jugó duelos antes de existir el perfil conserva su experiencia.
    else{const old=JSON.parse(localStorage.getItem('casi-casi:duelo:progreso'));if(old?.xp>0)state.xp=old.xp}
  }catch{}
  if(!Number.isFinite(state.xp)||state.xp<0)state.xp=0;if(!Number.isFinite(state.coins)||state.coins<0)state.coins=0;
  if(!Array.isArray(state.owned))state.owned=[];if(!Array.isArray(state.days))state.days=[];if(!state.closet||typeof state.closet!=='object')state.closet={};
  if(!state.chests||typeof state.chests!=='object')state.chests={};
  for(const type of Chests.TYPES)if(!Number.isInteger(state.chests[type])||state.chests[type]<0)state.chests[type]=0;
  if(!Number.isFinite(state.charge)||state.charge<0)state.charge=0;if(!Number.isInteger(state.pity)||state.pity<0)state.pity=0;
  if(!state.bought||typeof state.bought!=='object')state.bought={day:'',count:0};
  state.casi=CasiCasi.normalize(state.casi);
  // Cifras de las medallas. Quien ya jugaba conserva lo que se puede saber: su racha y sus duelos ganados.
  const STATS=['streak','near','round','exact','trio','early','archive','wins','run','duelStreak','flawless','chests','missions','weekSet','leagueWins','league','pioneer'];
  const stored=key=>{try{return JSON.parse(localStorage.getItem(key))}catch{return null}};
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
  const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(state))}catch{}};

  // Nivel: cada uno pide 100 XP más que el anterior (nivel 2 a los 100 XP, nivel 3 a los 300, nivel 4 a los 600…).
  const levelOf=xp=>Math.floor((1+Math.sqrt(1+xp/12.5))/2),levelStart=level=>50*level*(level-1);
  const info=(xp=state.xp)=>{const level=levelOf(xp),from=levelStart(level),to=levelStart(level+1);return {level,done:xp-from,need:to-from,ratio:(xp-from)/(to-from)}};
  // casi = pieza exclusiva que se desbloquea con ese número de «Casi casi»: ni se compra ni sale en cofres (decisión 0030).
  const circuit=item=>item.circuito==='bienvenida'?state.circuito.welcome:state.circuito.n>=item.circuito;
  const owns=item=>(!item.price&&!item.level&&!item.casi&&!item.circuito)||(item.circuito&&circuit(item))||(item.level&&levelOf(state.xp)>=item.level)||(item.casi&&state.casi.n>=item.casi)||state.owned.includes(item.slot+':'+item.id);
  // Lo que se lleva puesto siempre es algo que se tiene: si no, vuelve la pieza por defecto.
  function look(){const result=Avatar.normalize(state.look),base=Avatar.defaults(result.body);for(const [slot] of Avatar.SLOTS)if(!owns(Avatar.find(slot,result[slot])))result[slot]=base[slot];return result}

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
  const grant=(type,count=1)=>{state.chests[type]+=count};
  // La batería se carga jugando y, al llenarse, da un cofre Chispa. Lo que sobra se conserva.
  function charge(amount){state.charge+=amount;let full=0;while(state.charge>=REWARD.charge.full){state.charge-=REWARD.charge.full;full++}if(full)grant('chispa',full);return full}
  const chargeNote=full=>full?' · ¡Batería llena: cofre Chispa!':'';
  const bought=()=>state.bought.day===madrid()?state.bought.count:0;
  // Suma experiencia y faradios. Al subir de nivel hay premio (faradios y un cofre) y se desbloquean las piezas de ese nivel.
  function reward({xp=0,coins:gained=0}={}){
    const before=levelOf(state.xp);state.xp+=xp;const after=levelOf(state.xp),chests=[];
    for(let level=before+1;level<=after;level++){const type=REWARD.levelChest(level);grant(type);chests.push(Chests.CHESTS[type].name)}
    const levelCoins=(after-before)*REWARD.levelCoins;
    state.coins+=gained+levelCoins;save();refresh();
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
    if(booted){Medals.announce(fresh,()=>open('medallas'));document.dispatchEvent(new CustomEvent('faraday:look'))}
  }
  // La ceremonia enseña las que aún no se han visto y las da por vistas.
  function celebrateFresh(){
    const fresh=state.medals.fresh;if(!fresh.length)return;
    state.medals.fresh=[];save();Medals.celebrate(fresh,{onClose:()=>{refresh();$('#profile-close').focus()}});
  }

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
    const result=reward({xp,coins:gained});
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
    const boxes=chestTotal();
    if(chip){const waiting=pending()+boxes+state.medals.fresh.length;chip.innerHTML=`<span class="duel-avatar small">${Avatar.render(look(),{bust:true})}</span><span class="home-profile-text"><b>Nv. ${levelOf(state.xp)}</b><span>${coins(state.coins)}</span></span>${waiting?`<i class="profile-dot" aria-label="${waiting} avisos: misiones por recoger, cofres por abrir o medallas nuevas">${waiting}</i>`:''}`}
    // Avatar de cuerpo entero en la portada: es la puerta al armario y a la tienda.
    if(stage)stage.innerHTML=`<span class="home-avatar-stage">${Avatar.render(look(),{live:true,emote:'wave'})}</span><span class="home-avatar-plate"><b>Nivel ${levelOf(state.xp)}</b><span>${coins(state.coins)}</span></span><span class="home-avatar-cta${boxes?' has-chest':''}">${boxes?`Abrir ${boxes===1?'cofre':boxes+' cofres'}`:'Personalizar'} <span aria-hidden="true">→</span></span>`;
    if(!shell.hidden)draw();
  }

  // Perfil: el avatar a la izquierda y, a la derecha, el armario (con tienda), las misiones o los cofres.
  let tab='armario',slot='top',trying=null;
  // Cada pieza se enseña sobre el muñeco por defecto, con el encuadre que mejor la muestra.
  const ZOOM={top:'torso',neck:'torso',bottom:'legs',shoes:'shoes'},RARITY={especial:'Especial',rara:'Rara',epica:'Épica',legendaria:'Legendaria'},SLOT_NAME=Object.fromEntries(Avatar.SLOTS);
  function tile(item,current){
    const own=owns(item),worn=current[item.slot]===item.id,zoom=ZOOM[item.slot]||'',rarity=Avatar.rarity(item);
    const status=worn?'<span class="tile-state on">Puesto</span>':own?'<span class="tile-state">Tuyo</span>':item.level?`<span class="tile-state lock">Nivel ${item.level}</span>`:item.casi?`<span class="tile-state lock">${item.casi} «Casi casi»</span>`:item.circuito?`<span class="tile-state lock">${item.circuito==='bienvenida'?'Invitados':item.circuito===1?'1 amigo':item.circuito+' amigos'}</span>`:`<span class="tile-state price">${coins(item.price)}</span>`;
    return `<button type="button" class="profile-tile${worn?' is-on':''}${trying===item?' is-trying':''}${own?'':' is-locked'}" data-item="${item.slot}:${item.id}" data-rarity="${rarity}" aria-pressed="${worn}"><span class="tile-art">${Avatar.render(Avatar.preview(item,current.body),{bust:!zoom,zoom})}</span><span class="tile-name">${item.name}</span>${RARITY[rarity]?`<span class="tile-rarity">${RARITY[rarity]}</span>`:''}${status}</button>`;
  }
  function missionRow(period,id){
    const mission=MISSIONS[id],progress=Math.min(mission.goal,period.progress[id]||0),done=progress>=mission.goal,claimed=period.claimed.includes(id);
    return `<li class="mission${claimed?' is-claimed':done?' is-done':''}"><div><p>${mission.text}</p><div class="mission-bar"><i style="--m:${progress/mission.goal}"></i></div><small>${progress} / ${mission.goal}</small></div>${claimed?'<span class="mission-check" aria-label="Recogida">✓</span>':done?`<button type="button" class="game-primary" data-claim="${id}">Recoger +${mission.coins} ${COIN}</button>`:`<span class="mission-prize">+${coins(mission.coins)}</span>`}</li>`;
  }
  // Abre un cofre. El sorteo se hace y se guarda aquí, antes de la animación: cerrar o recargar no cambia lo que ha tocado.
  const dice=()=>{try{return crypto.getRandomValues(new Uint32Array(1))[0]/2**32}catch{return Math.random()}};
  function openChest(type){
    if(!state.chests[type]||ChestOpen.open)return;
    // Solo tocan piezas del cuerpo que se lleva puesto (y las comunes): así el premio siempre se puede estrenar (decisión 0028).
    const current=look(),missing=Avatar.CATALOG.filter(item=>item.price>0&&!item.level&&!owns(item)&&(!item.for||item.for===current.body)).map(item=>({key:item.slot+':'+item.id,rarity:Avatar.rarity(item)}));
    const result=Chests.roll(type,{items:missing,pity:state.pity,random:dice});
    state.chests[type]--;state.pity=result.pity;state.stats.chests++;
    const rewards=result.rewards.map(reward=>{
      if(reward.kind==='coins'){state.coins+=reward.amount;return reward}
      state.owned.push(reward.key);const [itemSlot,id]=reward.key.split(':'),item=Avatar.find(itemSlot,id),zoom=ZOOM[itemSlot]||'';
      return {...reward,name:item.name,slot:SLOT_NAME[itemSlot],art:Avatar.render(Avatar.preview(item,current.body),{bust:!zoom,zoom}),figure:Avatar.render({...current,[itemSlot]:id},{live:true,emote:'cheer'})};
    });
    save();refresh();
    ChestOpen.play(type,rewards,{more:chestTotal(),onClose:refresh,
      onEquip:key=>{const [itemSlot,id]=key.split(':');state.look={...look(),[itemSlot]:id};save()},
      onMore:()=>openChest(state.chests[type]?type:Chests.TYPES.find(other=>state.chests[other]))});
  }
  // Comprar un cofre con faradios: como mucho Chests.BUY_CAP al día. Se abre en el momento.
  function buyChest(type){
    const chest=Chests.CHESTS[type];if(!chest||state.coins<chest.price||bought()>=Chests.BUY_CAP)return;
    state.coins-=chest.price;state.bought={day:madrid(),count:bought()+1};grant(type);save();refresh();openChest(type);
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
<p class="chest-note">Los cofres se ganan jugando: Chispa con las tres misiones del día, la batería y al subir de nivel; Imán a los 3 días de racha; Rayo con las tres misiones de la semana y cada 5 niveles; Dinamo cada 10 niveles; Tormenta con las rachas de 7, 14, 30 y 50 días; Faraday a los 100 días de racha y cada 100 después. También se compran con faradios: ${left?`hoy puedes comprar ${left} más`:'hoy ya has comprado todos los que se puede'} (máximo ${Chests.BUY_CAP} al día).</p>
<details class="chest-odds"><summary>Probabilidades</summary>${[Chests.TYPES.slice(0,3),Chests.TYPES.slice(3)].map(odds).join('')}
<p>${sure} Imán nunca trae lotes de faradios. Nunca sale una pieza que ya tengas: si no quedan de esa rareza, recibes faradios. Si abres ${Chests.PITY} cofres seguidos sin una épica o legendaria, el siguiente la trae seguro (llevas ${Math.min(state.pity,Chests.PITY)}).</p></details>`;
  }
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
  // Vitrina: las tres mejores, siempre a la vista bajo el nivel.
  function showcase(){
    const best=featured().slice(0,3),count=gotMedals().length;
    const slot=id=>{if(!id)return '<span class="profile-medal is-empty" aria-hidden="true"><i class="medal-slot"></i></span>';const {def,tier}=Medals.parse(id);return `<button type="button" class="profile-medal" data-tab="medallas" data-show-medal="${def.id}" aria-label="${Medals.label(id)}">${Medals.art(id)}<b>${def.name}</b><small>${def.kind==='medalla'?Medals.tierName(tier):'Insignia'}</small></button>`};
    return `<div class="profile-medals"><p class="profile-medals-head" style="margin:0"><span>Vitrina</span><small>${count} / ${Medals.TOTAL}</small></p><div class="profile-medals-row">${[0,1,2].map(i=>slot(best[i])).join('')}</div>${count?'':'<p class="profile-medals-note">Completa tu primer reto y estrena la vitrina.</p>'}</div>`;
  }
  function draw(){
    if(trying&&owns(trying))trying=null; // Recién desbloqueada (nivel o «Casi casi»): ya no se está probando.
    const current=look(),preview=trying?{...current,[trying.slot]:trying.id}:current,level=info(),[day,week]=periods(),waiting=pending();
    $('#profile-coins').innerHTML=coins(state.coins);
    const missing=trying?trying.price-state.coins:0,pieces=Avatar.pieces(slot,current.body);
    const side=tab==='medallas'?medalTab():tab==='cofres'?chestTab():tab==='armario'
      ?`<div class="profile-body" role="group" aria-label="Cuerpo del avatar">${Avatar.BODIES.map(([id,label])=>`<button type="button" aria-pressed="${id===current.body}" data-body="${id}">${label}</button>`).join('')}</div><div class="profile-slots" role="tablist" aria-label="Partes del avatar">${Avatar.SLOTS.map(([id,label])=>`<button type="button" role="tab" aria-selected="${id===slot}" data-slot="${id}">${label}</button>`).join('')}</div><p class="profile-count">Tienes ${pieces.filter(owns).length} de ${pieces.length}</p><div class="profile-items">${pieces.map(item=>tile(item,current)).join('')}</div>`
      :`<h3 class="mission-title">Hoy <small>cambian a medianoche</small></h3><ul class="mission-list">${day.ids.map(id=>missionRow(day,id)).join('')}</ul><p class="mission-chest${day.chest?' is-open':''}">${day.chest?'Cofre Chispa del día conseguido ✓':'Recoge las tres de hoy y llévate un cofre Chispa'}</p><h3 class="mission-title">Esta semana <small>cambian el lunes</small></h3><ul class="mission-list">${week.ids.map(id=>missionRow(week,id)).join('')}</ul><p class="mission-chest${week.chest?' is-open':''}">${week.chest?'Cofre Rayo de la semana conseguido ✓':'Recoge las tres de la semana y llévate un cofre Rayo'}</p>`;
    main.innerHTML=`<section class="profile-card" style="background:${Avatar.background(preview)}"><h2 id="profile-title" class="sr-only">Tu avatar</h2><div class="profile-figure">${Avatar.render(preview,{label:'Tu avatar',live:true,drag:true})}</div><p class="profile-hint">Arrastra para girarlo</p>
${trying?`<div class="profile-try"><p>Probando <b>${trying.name}</b></p>${trying.level?`<p class="profile-try-note">Se desbloquea gratis al llegar al nivel ${trying.level}.</p>`:trying.casi?`<p class="profile-try-note">Exclusiva: se desbloquea gratis al conseguir ${trying.casi} «Casi casi» (respuestas a menos de 1,1×). Llevas ${int(state.casi.n)}.</p>`:trying.circuito?`<p class="profile-try-note">Exclusiva del Circuito de amigos: ${trying.circuito==='bienvenida'?'para quien entra invitado por un amigo y juega su primer reto.':`se desbloquea cuando ${trying.circuito===1?'un amigo que invites juegue':trying.circuito+' amigos que invites jueguen'} 3 retos del día. Llevas ${int(state.circuito.n)}.`}</p><button type="button" class="game-secondary" data-open-circuit>Invitar amigos</button>`:`<button type="button" class="game-primary" data-buy${missing>0?' disabled':''}>${missing>0?`Te faltan ${int(missing)} ${COIN}`:`Comprar · ${int(trying.price)} ${COIN}`}</button>`}<button type="button" class="duel-link" data-cancel>Quitar</button></div>`:''}
<div class="profile-level"><span><b>Nivel ${level.level}</b><small>${int(level.done)} / ${int(level.need)} XP</small></span><div class="duel-xpbar"><i style="--xp:${level.ratio}"></i></div>${state.streak.count>1&&state.streak.last>=shift(madrid(),-1)?`<p>🔥 ${state.streak.count} días seguidos</p>`:''}<p class="profile-casi" title="Respuestas a menos de 1,1× de la cifra real"><span aria-hidden="true">🎯</span> ${int(state.casi.n)} «Casi casi»${state.casi.n<CasiCasi.GOAL?` <small>· ${CasiCasi.GOAL-state.casi.n} más para la sudadera exclusiva</small>`:''}</p></div>${showcase()}</section>
<section class="profile-side"><div class="profile-tabs" role="tablist"><button type="button" role="tab" aria-selected="${tab==='armario'}" data-tab="armario">Armario</button><button type="button" role="tab" aria-selected="${tab==='misiones'}" data-tab="misiones">Misiones${waiting?`<i class="profile-dot">${waiting}</i>`:''}</button><button type="button" role="tab" aria-selected="${tab==='cofres'}" data-tab="cofres">Cofres${chestTotal()?`<i class="profile-dot">${chestTotal()}</i>`:''}</button><button type="button" role="tab" aria-selected="${tab==='medallas'}" data-tab="medallas">Medallas${state.medals.fresh.length?`<i class="profile-dot">${state.medals.fresh.length}</i>`:''}</button></div>${side}</section>`;
  }
  function open(which){
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
  shell.addEventListener('click',event=>{
    const target=event.target.closest('button');if(!target)return;
    if(target.dataset.tab){tab=target.dataset.tab;trying=null;picked=target.dataset.showMedal||'';draw();if(tab==='medallas')celebrateFresh();return}
    if(target.dataset.medal){picked=picked===target.dataset.medal?'':target.dataset.medal;draw();if(picked)main.querySelector('.medal-detail')?.scrollIntoView({block:'nearest',behavior:'smooth'});return}
    if(target.dataset.pin){state.medals.pin=target.dataset.pin;save();draw();document.dispatchEvent(new CustomEvent('faraday:look'));showToast('Destacada: la verán tus rivales en los duelos y tu grupo en las ligas.');return}
    if(target.dataset.slot){slot=target.dataset.slot;trying=null;draw();return}
    // Cambiar de cuerpo: cada uno guarda su ropa y su peinado; la piel y el color de pelo se conservan.
    if(target.dataset.body){
      const now=look(),next=target.dataset.body;
      if(next!==now.body&&Avatar.BODIES.some(([id])=>id===next)){state.closet={...state.closet,[now.body]:now};state.look={...(state.closet[next]||Avatar.defaults(next)),body:next,skin:now.skin,hairColor:now.hairColor};trying=null;save();refresh()}
      return;
    }
    if(target.dataset.item!==undefined){
      const [itemSlot,id]=target.dataset.item.split(':'),item=Avatar.find(itemSlot,id);
      if(owns(item)){state.look={...look(),[itemSlot]:id};trying=null;save();refresh()}else{trying=trying===item?null:item;draw()}
      return;
    }
    if(target.hasAttribute('data-cancel')){trying=null;draw();return}
    if(target.hasAttribute('data-buy')&&trying&&state.coins>=trying.price){
      state.coins-=trying.price;state.owned.push(trying.slot+':'+trying.id);state.look={...look(),[trying.slot]:trying.id};
      showToast(`${trying.name}: ¡ya es tuyo!`);trying=null;save();refresh();return;
    }
    if(target.dataset.openChest){openChest(target.dataset.openChest);return}
    if(target.dataset.buyChest){buyChest(target.dataset.buyChest);return}
    if(target.dataset.claim){
      const id=target.dataset.claim,period=periods().find(p=>p.ids.includes(id));
      if(!period||period.claimed.includes(id)||(period.progress[id]||0)<MISSIONS[id].goal)return;
      period.claimed.push(id);state.stats.missions++;const gained=MISSIONS[id].coins;let won='';
      // Las tres del día dan un cofre Chispa; las tres de la semana, un cofre Rayo. Se abre en el momento.
      if(!period.chest&&period.ids.every(mission=>period.claimed.includes(mission))){period.chest=true;won=period===state.missions.day?'chispa':'rayo';if(won==='rayo')state.stats.weekSet=1;grant(won)}
      const result=reward({xp:REWARD.missionXp,coins:gained});showToast(`+${gained} ≈ · +${REWARD.missionXp} XP${won?` · ¡Cofre ${Chests.CHESTS[won].name}!`:''}${levelNote(result)}`);
      if(won){tab='cofres';draw();openChest(won)}
    }
  });
  $('#profile-close').addEventListener('click',close);
  document.querySelectorAll('[data-open-profile]').forEach(button=>button.addEventListener('click',()=>open()));
  document.addEventListener('click',event=>{const button=event.target.closest('[data-open-profile-inline]');if(button)open(button.dataset.openProfileInline||undefined)});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!shell.hidden&&!document.querySelector('.medal-stage')){event.stopImmediatePropagation();close()}},true);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh()});

  // Premios del Circuito (circuito.js): el servidor ya los ha marcado como cobrados; aquí solo se entregan.
  // Devuelve el texto del aviso y el cofre que conviene abrir. connections = amigos conectados según el servidor.
  function circuitPrizes(prizes,connections){
    const notes=[];let open=null;
    for(const prize of prizes){
      if(prize.kind==='bienvenida'){state.circuito.welcome=true;grant(prize.chest);open=prize.chest;notes.push(`¡Bienvenida al Circuito! Cofre Rayo y ${look().body==='mujer'?'gorro':'gorra'} Enchufe`)}
      if(prize.kind==='conexion-invitado'){state.coins+=prize.coins;notes.push(`Ya estás conectado: +${prize.coins} ≈`)}
      if(prize.kind==='conexion'){if(prize.chest){grant(prize.chest);open??=prize.chest;notes.push('Amigo conectado: ¡cofre Rayo!')}else if(prize.coins){state.coins+=prize.coins;notes.push(`Amigo conectado: +${prize.coins} ≈`)}}
    }
    const before=state.circuito.n;if(Number.isInteger(connections)&&connections>before)state.circuito.n=connections;
    const body=look().body,unlocked=Avatar.CATALOG.filter(item=>Number.isInteger(item.circuito)&&item.circuito>before&&item.circuito<=state.circuito.n&&(!item.for||item.for===body));
    if(unlocked.length)notes.push(`Nuevo: ${unlocked.map(item=>item.name).join(', ')}`);
    // Escalón de 3 amigos: un cofre Tormenta, una sola vez.
    if(state.circuito.n>=3&&!state.circuito.storm){state.circuito.storm=true;grant('tormenta');notes.push('¡3 amigos conectados: cofre Tormenta!')}
    save();refresh();return {text:notes.join(' · '),open};
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
  window.Progress={look,circuit:()=>({...state.circuito}),circuitPrizes,circuitCurrent,level:()=>levelOf(state.xp),casi:()=>state.casi.n,info,coins:()=>state.coins,streak:()=>state.streak.count,reward,open,REWARD,chests:()=>({...state.chests}),openChest,
    // badge = la medalla destacada, que viaja con el avatar a los duelos y a las ligas; medals = todo lo conseguido.
    badge:()=>featured()[0]||'',medals:()=>gotMedals()};
  // Regalo de bienvenida: lo justo para estrenar el armario con una primera pieza.
  if(!state.welcome){state.welcome=true;state.coins+=REWARD.welcome}
  // Un cofre Chispa de regalo para estrenar los cofres, también para quien ya jugaba antes de que existieran.
  if(!state.cofres){state.cofres=true;grant('chispa')}
  periods();save();refresh();booted=true;
})();

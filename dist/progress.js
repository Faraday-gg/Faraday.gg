// Progreso del jugador (decisión 0024): nivel y experiencia, faradios (la moneda del juego), racha diaria,
// misiones diarias y semanales, y el armario del avatar (3D, decisión 0025) con su tienda. Todo se guarda en este navegador:
// no hay cuentas ni pagos. Los faradios solo se ganan jugando y solo compran piezas de aspecto.
// El juego avisa con eventos (faraday:answer, faraday:day, faraday:duel) y este archivo reparte las recompensas.
(()=>{
  const KEY='casi-casi:progreso',shell=$('#profile-shell'),main=$('#profile-main'),chip=$('#home-profile'),stage=$('#home-avatar');
  const int=n=>new Intl.NumberFormat('es-ES',{maximumFractionDigits:0,useGrouping:'always'}).format(n);
  const COIN='<span class="coin" aria-hidden="true">≈</span>',coins=n=>`${int(n)} ${COIN}<span class="sr-only"> faradios</span>`;
  const madrid=(date=new Date())=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Madrid'}).format(date);
  const shift=(day,days)=>new Date(Date.parse(day+'T12:00:00Z')+days*86400000).toISOString().slice(0,10);
  const monday=day=>shift(day,-((new Date(day+'T12:00:00Z').getUTCDay()+6)%7));

  // Recompensas: un reto del día da para una pieza sencilla cada dos días; una pieza especial pide una o dos semanas.
  const REWARD={welcome:100,answerXp:5,todayXp:30,todayCoins:20,archiveXp:10,archiveCoins:5,streakCoins:2,streakCap:7,dailyChest:20,
    duel:{win:15,draw:8,loss:5},levelCoins:level=>40+10*level};
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

  // Nombre de usuario: hasta 16 caracteres. Es el que ven los rivales en los duelos.
  const cleanName=value=>String(value??'').replace(/[\u0000-\u001f<>]/g,'').replace(/\s+/g,' ').trim().slice(0,16).trim();
  let state={v:1,name:'',xp:0,coins:0,owned:[],look:{...Avatar.DEFAULT},days:[],streak:{count:0,last:''},missions:{}};
  try{
    const saved=JSON.parse(localStorage.getItem(KEY));
    if(saved&&typeof saved==='object')state={...state,...saved,look:Avatar.normalize(saved.look),streak:{...state.streak,...saved.streak}};
    // Quien ya jugó duelos antes de existir el perfil conserva su experiencia.
    else{const old=JSON.parse(localStorage.getItem('casi-casi:duelo:progreso'));if(old?.xp>0)state.xp=old.xp}
  }catch{}
  if(!Number.isFinite(state.xp)||state.xp<0)state.xp=0;if(!Number.isFinite(state.coins)||state.coins<0)state.coins=0;
  if(!Array.isArray(state.owned))state.owned=[];if(!Array.isArray(state.days))state.days=[];
  const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(state))}catch{}};
  // Quien ya tenía apodo en los duelos lo conserva; si no, se le da uno provisional.
  state.name=cleanName(state.name);
  if(!state.name){let old='';try{old=JSON.parse(localStorage.getItem('casi-casi:duelo:perfil'))?.name}catch{}state.name=cleanName(old)||'Jugador '+(100+Math.floor(Math.random()*900));save()}
  function setName(value){const name=cleanName(value);if(name&&name!==state.name){state.name=name;save();refresh();document.dispatchEvent(new CustomEvent('faraday:name'))}return state.name}

  // Nivel: cada uno pide 100 XP más que el anterior (nivel 2 a los 100 XP, nivel 3 a los 300, nivel 4 a los 600…).
  const levelOf=xp=>Math.floor((1+Math.sqrt(1+xp/12.5))/2),levelStart=level=>50*level*(level-1);
  const info=(xp=state.xp)=>{const level=levelOf(xp),from=levelStart(level),to=levelStart(level+1);return {level,done:xp-from,need:to-from,ratio:(xp-from)/(to-from)}};
  const owns=item=>(!item.price&&!item.level)||(item.level&&levelOf(state.xp)>=item.level)||state.owned.includes(item.slot+':'+item.id);
  // Lo que se lleva puesto siempre es algo que se tiene: si no, vuelve la pieza por defecto.
  function look(){const result=Avatar.normalize(state.look);for(const [slot] of Avatar.SLOTS)if(!owns(Avatar.find(slot,result[slot])))result[slot]=Avatar.DEFAULT[slot];return result}

  function periods(){
    const today=madrid(),week=monday(today),m=state.missions;
    if(m.day?.key!==today)m.day={key:today,ids:['reto-hoy',...pick(DAILY,2,today)],progress:{},claimed:[],chest:false};
    if(m.week?.key!==week)m.week={key:week,ids:pick(WEEKLY,3,week),progress:{},claimed:[]};
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
  // Suma experiencia y faradios. Al subir de nivel hay premio y se desbloquean las piezas de ese nivel.
  function reward({xp=0,coins:gained=0}={}){
    const before=levelOf(state.xp);state.xp+=xp;const after=levelOf(state.xp);let levelCoins=0;
    for(let level=before+1;level<=after;level++)levelCoins+=REWARD.levelCoins(level);
    state.coins+=gained+levelCoins;save();refresh();
    const unlocked=after>before?Avatar.CATALOG.filter(item=>item.level>before&&item.level<=after):[];
    return {levelUp:after>before,level:after,levelCoins,unlocked};
  }
  const levelNote=result=>result.levelUp?` · ¡Nivel ${result.level}! +${result.levelCoins} ≈${result.unlocked.length?` · Nuevo: ${result.unlocked.map(item=>item.name).join(', ')}`:''}`:'';
  const missionNote=count=>count?` · ${count===1?'Misión lista':count+' misiones listas'} para recoger`:'';

  document.addEventListener('faraday:answer',({detail})=>{
    const done=bump('answer',detail),result=reward({xp:REWARD.answerXp});
    if(done||result.levelUp)showToast((`+${REWARD.answerXp} XP`+levelNote(result)+missionNote(done)));
  });
  document.addEventListener('faraday:day',({detail})=>{
    const done=bump('day',detail);
    if(state.days.includes(detail.day)){save();refresh();if(done)showToast(missionNote(done).slice(3));return}
    state.days.push(detail.day);let gained=REWARD.archiveCoins,xp=REWARD.archiveXp,extra='';
    if(detail.today){
      const today=madrid();
      if(state.streak.last!==today){state.streak.count=state.streak.last===shift(today,-1)?state.streak.count+1:1;state.streak.last=today}
      const accuracy=detail.average<1.5?15:detail.average<2?10:detail.average<3?5:0,streak=Math.min(state.streak.count,REWARD.streakCap)*REWARD.streakCoins;
      gained=REWARD.todayCoins+accuracy+streak;xp=REWARD.todayXp;extra=state.streak.count>1?` · 🔥 ${state.streak.count} días seguidos`:'';
    }
    const result=reward({xp,coins:gained});
    showToast(`Reto completado: +${gained} ≈ · +${xp} XP${extra}${levelNote(result)}${missionNote(done)}`);
  });
  document.addEventListener('faraday:duel',({detail})=>{const done=bump('duel',detail);save();refresh();if(done)setTimeout(()=>showToast(missionNote(done).slice(3)),2500)});

  // Chapa de la portada: avatar, nivel, faradios y un punto si hay misiones por recoger.
  function refresh(){
    if(chip){const waiting=pending();chip.innerHTML=`<span class="duel-avatar small">${Avatar.render(look(),{bust:true})}</span><span class="home-profile-text"><b>Nv. ${levelOf(state.xp)}</b><span>${coins(state.coins)}</span></span>${waiting?`<i class="profile-dot" aria-label="${waiting} misiones por recoger">${waiting}</i>`:''}`}
    // Avatar de cuerpo entero en la portada: es la puerta al armario y a la tienda.
    if(stage)stage.innerHTML=`<span class="home-avatar-stage">${Avatar.render(look(),{live:true,emote:'wave'})}</span><span class="home-avatar-name">${escapeHtml(state.name)}</span><span class="home-avatar-plate"><b>Nivel ${levelOf(state.xp)}</b><span>${coins(state.coins)}</span></span><span class="home-avatar-cta">Personalizar <span aria-hidden="true">→</span></span>`;
    if(!shell.hidden)draw();
  }

  // Perfil: el avatar a la izquierda y, a la derecha, el armario (con tienda) o las misiones.
  let tab='armario',slot='top',trying=null;
  // Cada pieza se enseña sobre el muñeco por defecto, con el encuadre que mejor la muestra.
  const ZOOM={top:'torso',neck:'torso',bottom:'legs',shoes:'shoes'},RARITY={especial:'Especial',rara:'Rara',epica:'Épica',legendaria:'Legendaria'};
  function tile(item,current){
    const own=owns(item),worn=current[item.slot]===item.id,zoom=ZOOM[item.slot]||'',rarity=Avatar.rarity(item);
    const status=worn?'<span class="tile-state on">Puesto</span>':own?'<span class="tile-state">Tuyo</span>':item.level?`<span class="tile-state lock">Nivel ${item.level}</span>`:`<span class="tile-state price">${coins(item.price)}</span>`;
    return `<button type="button" class="profile-tile${worn?' is-on':''}${trying===item?' is-trying':''}${own?'':' is-locked'}" data-item="${item.slot}:${item.id}" data-rarity="${rarity}" aria-pressed="${worn}"><span class="tile-art">${Avatar.render(Avatar.preview(item),{bust:!zoom,zoom})}</span><span class="tile-name">${item.name}</span>${RARITY[rarity]?`<span class="tile-rarity">${RARITY[rarity]}</span>`:''}${status}</button>`;
  }
  function missionRow(period,id){
    const mission=MISSIONS[id],progress=Math.min(mission.goal,period.progress[id]||0),done=progress>=mission.goal,claimed=period.claimed.includes(id);
    return `<li class="mission${claimed?' is-claimed':done?' is-done':''}"><div><p>${mission.text}</p><div class="mission-bar"><i style="--m:${progress/mission.goal}"></i></div><small>${progress} / ${mission.goal}</small></div>${claimed?'<span class="mission-check" aria-label="Recogida">✓</span>':done?`<button type="button" class="game-primary" data-claim="${id}">Recoger +${mission.coins} ${COIN}</button>`:`<span class="mission-prize">+${coins(mission.coins)}</span>`}</li>`;
  }
  function draw(){
    const current=look(),preview=trying?{...current,[trying.slot]:trying.id}:current,level=info(),[day,week]=periods(),waiting=pending();
    $('#profile-coins').innerHTML=coins(state.coins);
    const missing=trying?trying.price-state.coins:0,pieces=Avatar.CATALOG.filter(item=>item.slot===slot);
    const side=tab==='armario'
      ?`<div class="profile-slots" role="tablist" aria-label="Partes del avatar">${Avatar.SLOTS.map(([id,label])=>`<button type="button" role="tab" aria-selected="${id===slot}" data-slot="${id}">${label}</button>`).join('')}</div><p class="profile-count">Tienes ${pieces.filter(owns).length} de ${pieces.length}</p><div class="profile-items">${pieces.map(item=>tile(item,current)).join('')}</div>`
      :`<h3 class="mission-title">Hoy <small>cambian a medianoche</small></h3><ul class="mission-list">${day.ids.map(id=>missionRow(day,id)).join('')}</ul><p class="mission-chest${day.chest?' is-open':''}">${day.chest?'Cofre diario recogido ✓':`Recoge las tres de hoy y llévate un cofre de +${REWARD.dailyChest} ${COIN}`}</p><h3 class="mission-title">Esta semana <small>cambian el lunes</small></h3><ul class="mission-list">${week.ids.map(id=>missionRow(week,id)).join('')}</ul>`;
    main.innerHTML=`<section class="profile-card" style="background:${Avatar.background(preview)}"><h2 id="profile-title" class="sr-only">Tu avatar</h2><div class="profile-figure">${Avatar.render(preview,{label:'Tu avatar',live:true,drag:true})}</div><p class="profile-hint">Arrastra para girarlo</p>
<label class="profile-name"><span>Nombre de usuario</span><input id="profile-name" type="text" maxlength="16" autocomplete="nickname" spellcheck="false" value="${escapeHtml(state.name)}"></label>
${trying?`<div class="profile-try"><p>Probando <b>${trying.name}</b></p>${trying.level?`<p class="profile-try-note">Se desbloquea gratis al llegar al nivel ${trying.level}.</p>`:`<button type="button" class="game-primary" data-buy${missing>0?' disabled':''}>${missing>0?`Te faltan ${int(missing)} ${COIN}`:`Comprar · ${int(trying.price)} ${COIN}`}</button>`}<button type="button" class="duel-link" data-cancel>Quitar</button></div>`:''}
<div class="profile-level"><span><b>Nivel ${level.level}</b><small>${int(level.done)} / ${int(level.need)} XP</small></span><div class="duel-xpbar"><i style="--xp:${level.ratio}"></i></div>${state.streak.count>1&&state.streak.last>=shift(madrid(),-1)?`<p>🔥 ${state.streak.count} días seguidos</p>`:''}</div></section>
<section class="profile-side"><div class="profile-tabs" role="tablist"><button type="button" role="tab" aria-selected="${tab==='armario'}" data-tab="armario">Armario</button><button type="button" role="tab" aria-selected="${tab==='misiones'}" data-tab="misiones">Misiones${waiting?`<i class="profile-dot">${waiting}</i>`:''}</button></div>${side}</section>`;
  }
  function open(which){
    if(which)tab=which;trying=null;shell.hidden=false;document.body.classList.add('modal-open');
    if(typeof toggleMenu==='function')toggleMenu(false);draw();$('#profile-close').focus();
  }
  function close(){
    shell.hidden=true;trying=null;
    if($('#game-shell').hidden&&$('#duel-shell').hidden)document.body.classList.remove('modal-open');
    document.dispatchEvent(new CustomEvent('faraday:look'));
  }
  shell.addEventListener('click',event=>{
    const target=event.target.closest('button');if(!target)return;
    if(target.dataset.tab){tab=target.dataset.tab;trying=null;draw();return}
    if(target.dataset.slot){slot=target.dataset.slot;trying=null;draw();return}
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
    if(target.dataset.claim){
      const id=target.dataset.claim,period=periods().find(p=>p.ids.includes(id));
      if(!period||period.claimed.includes(id)||(period.progress[id]||0)<MISSIONS[id].goal)return;
      period.claimed.push(id);let gained=MISSIONS[id].coins,note='';
      if(period===state.missions.day&&!period.chest&&period.ids.every(mission=>period.claimed.includes(mission))){period.chest=true;gained+=REWARD.dailyChest;note=' · ¡Cofre diario!'}
      const result=reward({xp:10,coins:gained});showToast(`+${gained} ≈ · +10 XP${note}${levelNote(result)}`);
    }
  });
  shell.addEventListener('change',event=>{if(event.target.id==='profile-name'){const name=setName(event.target.value);event.target.value=name;showToast(`Ahora te llamas ${name}`)}});
  $('#profile-close').addEventListener('click',close);
  document.querySelectorAll('[data-open-profile]').forEach(button=>button.addEventListener('click',()=>open()));
  document.addEventListener('click',event=>{const button=event.target.closest('[data-open-profile-inline]');if(button)open(button.dataset.openProfileInline||undefined)});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!shell.hidden){event.stopImmediatePropagation();close()}},true);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh()});

  window.Progress={name:()=>state.name,setName,look,level:()=>levelOf(state.xp),info,coins:()=>state.coins,streak:()=>state.streak.count,reward,open,REWARD};
  // Regalo de bienvenida: lo justo para estrenar el armario con una primera pieza.
  if(!state.welcome){state.welcome=true;state.coins+=REWARD.welcome}
  periods();save();refresh();
})();

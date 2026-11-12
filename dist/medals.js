// Medallas e insignias (decisión 0035): los logros del jugador, que se enseñan en su perfil y, la destacada, junto a su
// nombre en los duelos y en las ligas. Aquí viven el catálogo, la regla (qué se ha conseguido con unas cifras dadas) y el
// dibujo, sin almacenamiento, para poder probarlo con Node (tests/medallas.test.mjs). progress.js lleva las cifras,
// guarda lo conseguido y pinta la pestaña «Medallas».
//
// Una medalla tiene cuatro niveles (bronce, plata, oro y diamante): la misma hazaña, cada vez más grande. Una insignia se
// consigue una sola vez. Identificadores: «racha-3» = medalla «racha», nivel 3 (oro); «triplete» = insignia.
// Sin presión ni castigos (juegan menores): nada caduca, nada se pierde y ninguna pide jugar de noche.
(root=>{
  const TIERS=[['bronce','Bronce'],['plata','Plata'],['oro','Oro'],['diamante','Diamante']];
  const int=n=>new Intl.NumberFormat('es-ES',{maximumFractionDigits:0,useGrouping:'always'}).format(n);
  // Iconos: trazos sencillos en un lienzo de 24 × 24, grabados en el metal.
  const dot=(x,y,r=1.2)=>`<circle cx="${x}" cy="${y}" r="${r}" fill="currentColor" stroke="none"/>`,ring=(x,y,r)=>`<circle cx="${x}" cy="${y}" r="${r}"/>`,path=d=>`<path d="${d}"/>`;
  const ICONS={
    llama:path('M12 3c1 3.5 5 5.5 5 10a5 5 0 0 1-10 0c0-2 1-3.2 2-4 .2 1.6 1 2.4 1.8 2.6C11 9.5 10.5 6 12 3z'),
    circuito:path('M19 12a7 7 0 1 1-2.05-4.95M19 4v4h-4'),
    diana:ring(12,12,8)+ring(12,12,4)+dot(12,12),
    ojo:path('M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6z')+ring(12,12,2.5),
    estrella:path('M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z'),
    espadas:path('M5 4l9.5 9.5M5 4v3M5 4h3M19 4l-9.5 9.5M19 4v3M19 4h-3M8 14l-3.5 3.5 2 2L10 16M16 14l3.5 3.5-2 2L14 16'),
    subida:path('M6 12l6-6 6 6M6 19l6-6 6 6'),
    rayo:path('M13 2.5L5 13.5h6l-1 8 8-11h-6z'),
    percha:path('M12 8a2 2 0 1 1 2-2M12 8v2l8.5 6.2c.9.7.4 1.8-.6 1.8H4.1c-1 0-1.5-1.1-.6-1.8L12 10'),
    cofre:path('M4 10h16v9H4zM4 10a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4M10.5 13h3v3h-3z'),
    lista:path('M4 7l2 2 3.5-4M4 16l2 2 3.5-4M13 7h7M13 16h7'),
    trofeo:path('M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8.5 20h7M10 17h4'),
    chispa:path('M12 3v5M12 16v5M3 12h5M16 12h5M6 6l2.5 2.5M15.5 15.5L18 18M18 6l-2.5 2.5M8.5 15.5L6 18'),
    mira:ring(12,12,6)+path('M12 2v5M12 17v5M2 12h5M17 12h5')+dot(12,12),
    tres:ring(12,6.5,3)+ring(6,17,3)+ring(18,17,3),
    sol:ring(12,12,4)+path('M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M19.1 4.9l-1.8 1.8M6.7 17.3l-1.8 1.8'),
    columna:path('M4 20h16M6 20V9M10 20V9M14 20V9M18 20V9M3.5 9h17L12 3.5z'),
    escudo:path('M12 3l8 3v6c0 4.5-3.2 7.9-8 9-4.8-1.1-8-4.5-8-9V6zM8.5 12l2.5 2.5 4.5-5'),
    equipo:ring(9,8,3)+ring(17,9,2.5)+path('M3 20a6 6 0 0 1 12 0M15.5 14.2a5 5 0 0 1 6 4.8'),
    corona:path('M3.5 8l4.5 4 4-7 4 7 4.5-4-2 11h-13z'),
    calendario:path('M4 6h16v14H4zM4 10h16M8 3.5v4M16 3.5v4M9 15l2 2 4-4'),
    bandera:path('M6 21V4M6 5h11l-2.5 4 2.5 4H6'),
    pajarita:path('M4 7l8 5-8 5zM20 7l-8 5 8 5z')+dot(12,12,1.6)
  };
  // stat = la cifra del jugador que la mide (las reúne progress.js); goals = lo que pide cada nivel; text = cómo se consigue.
  const medal=(id,name,icon,stat,goals,text,unit)=>({kind:'medalla',id,name,icon,stat,goals,text,unit});
  const badge=(id,name,icon,stat,text,goal=1)=>({kind:'insignia',id,name,icon,stat,goals:[goal],text:()=>text,unit:''});
  const MEDALS=[
    medal('racha','Corriente continua','llama','streak',[3,7,30,100],n=>`Juega el reto del día ${int(n)} días seguidos.`,'días'),
    medal('retos','Circuito cerrado','circuito','days',[5,25,100,365],n=>`Completa ${int(n)} retos, de hoy o del archivo.`,'retos'),
    medal('casi','Pulso fino','diana','casi',[1,10,50,200],n=>n===1?'Consigue tu primer «Casi casi»: una respuesta a menos de 1,1×.':`Consigue ${int(n)} «Casi casi» (respuestas a menos de 1,1×).`,'«Casi casi»'),
    medal('cerca','Buen ojo','ojo','near',[10,50,250,1000],n=>`Queda a menos de 2× en ${int(n)} preguntas.`,'preguntas'),
    medal('redondo','Día redondo','estrella','round',[1,5,25,100],n=>n===1?'Termina un reto con una media por debajo de 1,5×.':`Termina ${int(n)} retos con una media por debajo de 1,5×.`,'retos'),
    medal('duelista','Duelista','espadas','wins',[1,10,50,200],n=>n===1?'Gana tu primer duelo contra otra persona.':`Gana ${int(n)} duelos contra otras personas.`,'victorias'),
    medal('imparable','Imparable','subida','duelStreak',[2,3,5,10],n=>`Gana ${int(n)} duelos seguidos contra otras personas.`,'seguidos'),
    medal('voltaje','Alto voltaje','rayo','level',[5,10,20,35],n=>`Llega al nivel ${int(n)}.`,'nivel'),
    medal('armario','Fondo de armario','percha','pieces',[3,15,50,120],n=>`Consigue ${int(n)} piezas para tu avatar, de la tienda o de los cofres.`,'piezas'),
    medal('cofres','Cazatormentas','cofre','chests',[1,10,50,150],n=>n===1?'Abre tu primer cofre.':`Abre ${int(n)} cofres.`,'cofres'),
    medal('misiones','Manos a la obra','lista','missions',[5,30,100,300],n=>`Recoge ${int(n)} misiones.`,'misiones'),
    medal('liga','Campeón de liga','trofeo','leagueWins',[1,3,10,25],n=>n===1?'Gana una semana en una liga con amigos.':`Gana ${int(n)} semanas en ligas con amigos.`,'semanas')
  ];
  const BADGES=[
    badge('primera-chispa','Primera chispa','chispa','first','Completa tu primer reto.'),
    badge('en-el-clavo','En el clavo','mira','exact','Responde a menos de 1,01× de la cifra real.'),
    badge('triplete','Triplete','tres','trio','Deja las tres respuestas de un mismo reto a menos de 2×.'),
    badge('madrugador','Madrugador','sol','early','Completa el reto de hoy entre las 5:00 y las 8:00 de la mañana.'),
    badge('arqueologo','Arqueólogo','columna','archive','Completa 10 retos del archivo.',10),
    badge('intacto','Intacto','escudo','flawless','Gana un duelo contra otra persona sin perder nada de vida.'),
    badge('en-equipo','En equipo','equipo','league','Crea una liga con amigos o únete a una.'),
    badge('legendario','Legendario','corona','legendary','Consigue una pieza legendaria para tu avatar.'),
    badge('punta-en-blanco','De punta en blanco','pajarita','dressed','Viste a tu avatar con algo en la cabeza, gafas, cuello y un extra a la vez.'),
    badge('semana-redonda','Semana redonda','calendario','weekSet','Recoge las tres misiones de una misma semana.'),
    badge('pionero','Pionero','bandera','pioneer','Completa un reto en 2026, el año en que nació Faraday.gg.')
  ];
  const ALL=[...MEDALS,...BADGES],TOTAL=ALL.reduce((sum,def)=>sum+def.goals.length,0);
  const value=(def,stats)=>{const n=Number(stats?.[def.stat]);return Number.isFinite(n)&&n>0?Math.floor(n):0};
  // Cuántos niveles de una medalla se han alcanzado (0 = ninguno). En una insignia, 0 o 1.
  const level=(def,stats)=>def.goals.filter(goal=>value(def,stats)>=goal).length;
  const idOf=(def,tier)=>def.kind==='medalla'?`${def.id}-${tier}`:def.id;
  // Todo lo conseguido con esas cifras: cada nivel alcanzado cuenta como un logro.
  const earned=stats=>ALL.flatMap(def=>Array.from({length:level(def,stats)},(_,i)=>idOf(def,i+1)));
  // «racha-3» → {def, tier: 3}; «triplete» → {def, tier: 1}. null si no existe.
  function parse(id){
    if(typeof id!=='string')return null;
    const own=BADGES.find(def=>def.id===id);if(own)return {def:own,tier:1};
    const match=/^([a-z-]+)-([1-4])$/.exec(id),def=match&&MEDALS.find(entry=>entry.id===match[1]);
    return def?{def,tier:Number(match[2])}:null;
  }
  // Avance hacia el siguiente nivel (o el último, si ya están todos).
  function progress(def,stats){
    const done=level(def,stats),goal=def.goals[Math.min(done,def.goals.length-1)],now=value(def,stats);
    return {level:done,complete:done===def.goals.length,value:now,goal,ratio:Math.min(1,now/goal)};
  }
  const tierName=tier=>TIERS[tier-1]?.[1]||'';
  const label=id=>{const found=parse(id);return found?found.def.kind==='medalla'?`${found.def.name} · ${tierName(found.tier)}`:found.def.name:''};
  // Para ordenar la vitrina: primero lo más difícil. Una insignia vale como un oro.
  const rank=id=>{const found=parse(id);return found?found.def.kind==='medalla'?found.tier:3:0};
  // Dibujo: disco de metal con cinta (medalla) o chapa hexagonal esmaltada (insignia). El tamaño lo da --s en el CSS.
  function art(id,{locked=false,extra='',title=''}={}){
    const found=parse(id);if(!found)return '';
    const {def,tier}=found,isMedal=def.kind==='medalla';
    return `<span class="medal ${extra}" data-kind="${def.kind}"${isMedal?` data-tier="${TIERS[tier-1][0]}"`:''}${locked?' data-locked':''} ${title?`role="img" aria-label="${title}" title="${title}"`:'aria-hidden="true"'}>${isMedal?'<i class="medal-ribbon"></i>':''}<span class="medal-disc"><svg viewBox="0 0 24 24" focusable="false">${ICONS[def.icon]}</svg></span></span>`;
  }
  // La destacada de otro jugador, en pequeño junto a su nombre. El identificador llega del servidor: si no existe, nada.
  const chip=id=>parse(id)?art(id,{extra:'mini',title:label(id)}):'';
  root.Medals={TIERS,MEDALS,BADGES,ALL,TOTAL,level,earned,parse,progress,idOf,label,tierName,rank,art,chip};
  if(typeof document==='undefined'||!document.body)return;

  // Aviso al conseguir una: una chapa arriba, que no tapa la partida. Al tocarla se abre la ceremonia en el perfil.
  const calm=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
  const best=ids=>[...ids].sort((a,b)=>rank(b)-rank(a))[0];
  let banner=null,bannerTimer=0,pending=[]; // pending = lo anunciado mientras el aviso sigue a la vista: se suma
  function announce(ids,onOpen){
    if(!ids.length)return;
    ids=pending=[...new Set([...(banner?pending:[]),...ids])];
    banner?.remove();const top=best(ids),found=parse(top);
    banner=document.createElement('button');banner.type='button';banner.className='medal-banner';
    banner.innerHTML=`${art(top)}<span><small>${ids.length>1?`${ids.length} logros nuevos`:found.def.kind==='medalla'?'Medalla conseguida':'Insignia conseguida'}</small><b>${label(top)}</b></span><span class="medal-banner-go" aria-hidden="true">→</span>`;
    banner.addEventListener('click',()=>{hide();onOpen?.()});document.body.append(banner);
    requestAnimationFrame(()=>banner?.classList.add('show'));clearTimeout(bannerTimer);bannerTimer=setTimeout(hide,6500);
    try{root.Sound?.resume?.();[784,988,1175,1568].forEach((f,i)=>root.Sound?.tone?.(f,.05+i*.09,.32,{type:'triangle',gain:calm()?.02:.05}))}catch{}
  }
  function hide(){const old=banner;banner=null;if(!old)return;old.classList.remove('show');setTimeout(()=>old.remove(),400)}

  // Ceremonia: la medalla a pantalla completa, de una en una, con cómo se consiguió.
  let stage=null;
  function celebrate(ids,{onClose}={}){
    if(stage||!ids.length)return;
    // De cada medalla solo se enseña el nivel más alto y, si llegan muchas a la vez, las cinco mejores: de menos a más.
    const top={};for(const id of ids){const found=parse(id);if(found&&!(top[found.def.id]?.tier>found.tier))top[found.def.id]={id,tier:found.tier}}
    const queue=Object.values(top).map(entry=>entry.id).sort((a,b)=>rank(b)-rank(a)).slice(0,5).reverse();let index=0;
    if(!queue.length)return;
    stage=document.createElement('div');stage.className='medal-stage';stage.setAttribute('role','dialog');stage.setAttribute('aria-modal','true');stage.setAttribute('aria-labelledby','medal-stage-title');
    const close=()=>{document.removeEventListener('keydown',onKey,true);stage.remove();stage=null;onClose?.()};
    const onKey=event=>{if(event.key==='Escape'){event.stopImmediatePropagation();close()}};
    function show(){
      const id=queue[index],{def,tier}=parse(id),last=index===queue.length-1;
      stage.dataset.tier=def.kind==='medalla'?TIERS[tier-1][0]:'insignia';
      stage.innerHTML=`<span class="medal-rays" aria-hidden="true"></span><div class="medal-stage-box"><p class="medal-stage-kicker">${def.kind==='medalla'?'Medalla conseguida':'Insignia conseguida'}${queue.length>1?` · ${index+1} de ${queue.length}`:''}</p>
<div class="medal-stage-art">${art(id,{extra:'is-new'})}</div>
<h2 id="medal-stage-title">${def.name}</h2>${def.kind==='medalla'?`<p class="medal-stage-tier">${tierName(tier)}</p>`:''}
<p class="medal-stage-text">${def.text(def.goals[tier-1])}</p>
<button type="button" class="game-primary" data-medal-next>${last?'Ver mis medallas':'Siguiente'} <span aria-hidden="true">→</span></button></div>`;
      stage.querySelector('button').focus();
      try{[523,659,784,1047,1319].forEach((f,i)=>root.Sound?.tone?.(f,i*.1,.4,{type:'triangle',gain:calm()?.02:.06}))}catch{}
    }
    stage.addEventListener('click',event=>{if(!event.target.closest('[data-medal-next]'))return;if(++index<queue.length)show();else close()});
    document.addEventListener('keydown',onKey,true);document.body.append(stage);show();
  }
  Object.assign(root.Medals,{announce,celebrate});
})(typeof window!=='undefined'?window:globalThis);

// Estadísticas del perfil (decisión 0113): cuánto ha jugado cada uno en cada juego, para presumir. Aquí viven las cuentas
// (qué se apunta de cada partida, sin contar dos veces la misma), la comparación de los metros de Ascensión con alturas
// y viajes conocidos, y el dibujo de la pestaña. progress.js guarda las cifras dentro del progreso (state.plays), así que
// viajan con la cuenta igual que las medallas. No hay nada que ganar ni que perder con ellas: solo se enseñan.
(()=>{
  const KEEP=12; // Partidas recientes que se recuerdan por juego para no apuntarlas dos veces.
  const whole=value=>Number.isFinite(value)&&value>0?Math.round(value):0;
  const DUELS=['duel','ranked','duel3'];
  const freshGame=()=>({played:0,total:0,best:0,top:0,seen:{}});
  const freshDuel=()=>({played:0,won:0,draw:0,lost:0});

  // Deja las cifras guardadas en un estado válido. La primera vez (`old` = lo que ya se sabía del jugador) parte de sus
  // retos completados y de los duelos que recuerda este navegador.
  function normalize(saved,old={}){
    const first=!saved||typeof saved!=='object',from=first?{}:saved,plays={answers:whole(from.answers)};
    for(const game of ['ascension','traza','archivo']){
      const one=from[game]&&typeof from[game]==='object'?from[game]:{},seen={};
      for(const [key,count] of Object.entries(one.seen&&typeof one.seen==='object'?one.seen:{}).slice(-KEEP))if(whole(count))seen[key]=whole(count);
      plays[game]={played:whole(one.played),total:whole(one.total),best:whole(one.best),top:whole(one.top),seen};
    }
    for(const mode of DUELS){const one=from[mode]&&typeof from[mode]==='object'?from[mode]:{};plays[mode]={played:whole(one.played),won:whole(one.won),draw:whole(one.draw),lost:whole(one.lost)}}
    if(first){
      plays.answers=whole(old.days)*3;
      const won=whole(old.wins),draw=whole(old.draws),lost=whole(old.losses);
      plays.duel={played:won+draw+lost,won,draw,lost};
    }
    return plays;
  }

  // Apunta lo nuevo de una partida por rondas. `values` = lo conseguido en cada ronda hasta ahora (puntos o metros), en
  // orden; `per` = rondas de una partida; `tops` = rondas que cuentan como pleno. `key` identifica la partida (o el día,
  // si las partidas de un día comparten lista): lo ya apuntado de esa clave no se repite. Devuelve true si cambió algo.
  function tally(plays,game,key,values,per,tops=[]){
    const one=plays?.[game];
    if(!one||!one.seen||typeof key!=='string'||!key||!Array.isArray(values)||!(per>0))return false;
    const list=values.map(whole),done=Math.min(whole(one.seen[key]),list.length);
    if(list.length<=done)return false;
    for(let i=done;i<list.length;i++){one.total+=list[i];if(tops[i])one.top++}
    one.played+=Math.floor(list.length/per)-Math.floor(done/per);
    for(let start=0;start+per<=list.length;start+=per)one.best=Math.max(one.best,list.slice(start,start+per).reduce((sum,value)=>sum+value,0));
    delete one.seen[key];one.seen[key]=list.length;
    for(const old of Object.keys(one.seen).slice(0,-KEEP))delete one.seen[old];
    return true;
  }
  // Apunta un duelo terminado contra personas (los del bot y los abandonados no cuentan, como en las medallas).
  function duel(plays,{mode,result,bot,abandoned}={}){
    const one=plays?.[DUELS.includes(mode)?mode:'duel'];if(!one||bot||abandoned)return false;
    one.played++;one[result==='win'?'won':result==='draw'?'draw':'lost']++;return true;
  }

  // Con qué comparar los metros subidos. `kind`: 'alto' = algo que se sube; 'viaje' = un trayecto en línea recta.
  const PLACES=[
    {m:104,kind:'alto',name:'la Giralda de Sevilla'},
    {m:330,kind:'alto',name:'la Torre Eiffel'},
    {m:828,kind:'alto',name:'el Burj Khalifa, el edificio más alto del mundo'},
    {m:3715,kind:'alto',name:'el Teide'},
    {m:8849,kind:'alto',name:'el Everest'},
    {m:39000,kind:'alto',name:'el salto de Felix Baumgartner desde la estratosfera'},
    {m:100000,kind:'alto',name:'la frontera del espacio'},
    {m:400000,kind:'alto',name:'la Estación Espacial Internacional'},
    {m:505000,kind:'viaje',name:'de Madrid a Barcelona'},
    {m:1053000,kind:'viaje',name:'de Madrid a París'},
    {m:5770000,kind:'viaje',name:'de Madrid a Nueva York'},
    {m:10770000,kind:'viaje',name:'de Madrid a Tokio'},
    {m:40075000,kind:'viaje',name:'la vuelta al mundo'},
    {m:384400000,kind:'viaje',name:'de la Tierra a la Luna'}
  ];
  const number=(value,digits=0)=>new Intl.NumberFormat('es-ES',{maximumFractionDigits:digits,useGrouping:'always'}).format(value);
  // Los metros, en la unidad que mejor se lee: «640 m», «12,4 km», «1.250 km».
  const distance=metres=>metres<1000?`${number(metres)} m`:`${number(metres/1000,metres<100000?1:0)} km`;
  // La frase de la comparación y lo que falta para la siguiente. Sin metros no se compara con nada.
  function compare(metres){
    const total=whole(metres),index=PLACES.findLastIndex(place=>place.m<=total),place=PLACES[index],next=PLACES[index+1];
    const goal=next?`Te faltan ${distance(next.m-total)} para ${next.kind==='viaje'?(next.name.startsWith('la ')?'dar ':'ir ')+next.name:('llegar a '+next.name).replace('a el ','al ')} (${distance(next.m)}).`:'';
    if(!place)return {text:total?'Cada respuesta válida añade metros al vuelo.':'Juega una Ascensión y empieza a sumar metros.',goal};
    const times=total/place.m,many=times>=1.5?number(Math.floor(times*10)/10,1):'';
    const text=place.kind==='viaje'
      ?(many?`Eso es como ${place.name.startsWith('la ')?'dar':'ir'} ${many} veces ${place.name}, pero hacia arriba.`:`Eso es como ${place.name.startsWith('la ')?'dar':'ir'} ${place.name}, pero hacia arriba.`)
      :(many?`Eso es como subir ${many} veces ${place.name}.`:`Ya has subido más que ${place.name} (${distance(place.m)}).`);
    return {text,goal};
  }

  // Lo que se pinta. `data` = las cifras del resto del progreso que también se enseñan (retos, racha, «Casi casi»…).
  const percent=(part,all)=>all?`${number(part/all*100)} %`:'—';
  const tile=(value,label,strong=false)=>`<li${strong?' class="is-strong"':''}><b>${value}</b><span>${label}</span></li>`;
  const card=(id,name,note,tiles,extra='')=>`<article class="stats-card" data-stats="${id}"><h4>${name}<small>${note}</small></h4><ul class="stats-grid">${tiles.join('')}</ul>${extra}</article>`;
  function render(plays,data={}){
    const n=key=>whole(data[key]),asc=plays.ascension,traza=plays.traza,archivo=plays.archivo,versus=compare(asc.total);
    const duels=DUELS.reduce((sum,mode)=>({played:sum.played+plays[mode].played,won:sum.won+plays[mode].won,draw:sum.draw+plays[mode].draw,lost:sum.lost+plays[mode].lost}),freshDuel());
    const line=(mode,name)=>plays[mode].played?`<li><span>${name}</span><b>${number(plays[mode].won)} de ${number(plays[mode].played)} ganados</b></li>`:'';
    const modes=line('duel','Partida rápida y amigos')+line('ranked','Clasificatorias')+line('duel3','Duelo a tres');
    const games=n('days')+duels.played+asc.played+traza.played+archivo.played;
    return `<div class="stats-tab"><h3 class="mission-title">Tus estadísticas <small>${number(games)} ${games===1?'partida':'partidas'} en total</small></h3>
${card('reto','Reto del día','Estimaciones diarias y archivo',[
  tile(number(n('days')),'retos completados',true),tile(number(Math.max(plays.answers,n('days')*3)),'respuestas'),
  tile(number(n('casi')),'«Casi casi»',true),tile(number(n('near')),'a menos de 2×'),
  tile(number(n('round')),'retos redondos'),tile(number(n('streak')),'mejor racha de días')],
  '<p class="stats-note">«Casi casi» es clavarla a menos de 1,1×. Un reto redondo queda por debajo de 1,5× de media.</p>')}
${card('duelos','Duelos','Contra otras personas',[
  tile(number(duels.played),'duelos jugados',true),tile(number(duels.won),'ganados',true),
  tile(percent(duels.won,duels.played),'de victorias'),tile(number(duels.draw),'empatados'),
  tile(number(duels.lost),'perdidos'),tile(number(n('duelStreak')),'mejor racha')],
  (modes?`<ul class="stats-lines">${modes}</ul>`:'')+'<p class="stats-note">No cuentan las prácticas con el bot ni los duelos abandonados.</p>')}
${card('ascension','Ascensión','Siete preguntas por partida',[
  tile(number(asc.played),asc.played===1?'ascensión':'ascensiones',true),tile(distance(asc.total),'ascendidos',true),
  tile(distance(asc.best),'mejor ascensión'),tile(number(asc.top),'respuestas de cumbre')],
  `<p class="stats-compare"><span aria-hidden="true">↑</span><span><b>${asc.total?`Has ascendido ${distance(asc.total)}.`:'Aún no has subido nada.'}</b> ${versus.text}${versus.goal?` <small>${versus.goal}</small>`:''}</span></p>`)}
${card('traza','Traza','Dibuja cómo siguió la gráfica',[
  tile(number(traza.played),traza.played===1?'partida':'partidas',true),tile(number(traza.total),'puntos'),tile(number(traza.best),'mejor partida')])}
${card('archivo','Archivo Vivo','¿De qué año es la foto?',[
  tile(number(archivo.played),archivo.played===1?'partida':'partidas',true),tile(number(archivo.total),'puntos'),tile(number(archivo.best),'mejor partida')])}
<p class="stats-note">Ascensión, Traza, Archivo Vivo y el desglose de duelos se cuentan desde que existe este apartado.</p></div>`;
  }
  window.Stats={normalize,tally,duel,compare,distance,render,PLACES};
})();

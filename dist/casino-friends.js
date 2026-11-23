// Presencia y mesa compartida de Texas Hold'em. El servidor reparte, guarda las cartas de cada uno, lleva los
// turnos y liquida el bote; aquí solo se enseña la mesa y se envían las jugadas. Por el mismo camino van el chat
// y los gestos: cada latido lleva el último gesto y trae los mensajes de los amigos.
import {pokerTable,pokerActions} from './casino-tables.js';

export function casinoFriends({panel,shell,onPresence,position,closeSalon,onChat,onNotice}){
  let enabled=false,active=false,working=false,state=null,error='',raise=0,turnKey='',signature='',epoch=0,timer,flight,receivedAt=0;
  // Chat y gestos: el último gesto propio, el número del último mensaje ya enseñado y si es la primera respuesta.
  let act=null,heard=0,first=true;
  const escape=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const money=n=>new Intl.NumberFormat('es-ES').format(n)+' ≈';
  const button=(action,label,disabled=false,kind='casino-option')=>`<button type="button" class="${kind}" data-casino-action="${action}" ${disabled?'disabled':''}>${label}</button>`;
  const actions=(...buttons)=>`<div class="stage-actions">${buttons.join('')}</div>`;
  async function request(action,extra={}){
    const response=await fetch('/api/casino',{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({action,...extra}),signal:AbortSignal.timeout(5500)
    });
    return {ok:response.ok,status:response.status,...await response.json()};
  }
  // Lo que se ve: la mesa (para pokerTable) y la barra de abajo.
  function view(){
    const alone={seats:[{name:'Tú',look:window.Progress?.look?.()}],say:'Mesa de amigos'};
    if(!enabled)return {...alone,center:'<p>Comparte tu avatar y tu posición con tus amigos mientras estés en el Salón y sentaos a jugar juntos.</p>',
      bar:actions(button('enable','Entrar con amigos',working,'casino-play'),button('profile','Abrir el panel de amigos'))};
    if(!state)return {...alone,center:'<p>Conectando con el Salón…</p>',bar:actions(button('exit','Cancelar'))};
    const {table,tables,players,coins,small,big,cap}=state;
    const balance=`<p class="casino-shared-balance">Monedero compartido <strong>${money(coins)}</strong></p>`;
    if(!table)return {...alone,
      center:`<p>${players.length?'En el Salón: '+players.map(peer=>escape(peer.name)).join(', ')+'.':'Tus amigos aparecerán aquí cuando entren en el Salón compartido.'}</p>
        <p>Texas Hold'em para 2 a 4 amigos. Ciegas ${small} y ${big}. Cada uno juega la mano con lo que tenga, hasta ${money(cap)}.</p>
        ${tables.length?`<ul class="casino-seats">${tables.map(room=>`<li><span>Mesa de ${escape(room.name)} · ${room.seats}/4</span><button class="casino-option" type="button" data-casino-action="join" data-room="${escape(room.id)}">Sentarme</button></li>`).join('')}</ul>`:''}`,
      bar:balance+actions(button('create','Abrir mi mesa',false,'casino-play'),button('exit','Dejar de compartir'))};
    const {round,seats,host}=table,me=seats.find(seat=>seat.mine),live=!!round&&round.stage!=='done';
    const mine=round?round.seats.findIndex(seat=>seat.mine):-1;
    const stand=button('stand','Levantarme');
    // La última mano se sigue viendo hasta que se reparte la siguiente; quien acaba de llegar ve los asientos.
    if(round&&(live||mine>=0)){
      const list=round.seats.map((seat,i)=>({...seat,button:i===round.button,turn:i===round.turn,allin:seat.allin&&live,
        cards:seat.cards||(seat.folded&&!live?undefined:null)}));
      const at=Math.max(0,mine),turn=round.seats[round.turn];
      return {seats:[...list.slice(at),...list.slice(0,at)],board:round.board,pot:live?round.pot:0,
        say:!live?'Mano terminada':round.turn===mine?'Tú hablas':`Habla ${turn?.name||''}`,
        mine:live?`Tiempo para jugar <strong data-casino-clock></strong>`:'',
        bar:round.legal?pokerActions(round.legal,raise,big)
          :live?`<div class="stage-actions"><p class="pk-wait">${mine>=0&&!round.seats[mine].folded?`Habla ${escape(turn?.name||'')}…`:'Esperando a la siguiente mano.'}</p>${stand}</div>`
          :balance+actions(button('ready',me?.ready?'Cancelar listo':'Listo para otra mano',!me?.ready&&coins<big,'casino-play'),
            host?button('deal','Repartir',seats.length<2||seats.some(seat=>!seat.ready)):'',stand)};
    }
    const at=Math.max(0,seats.indexOf(me)),list=seats.map(seat=>({...seat,note:seat.ready?'Listo':'Esperando'}));
    return {seats:[...list.slice(at),...list.slice(0,at)],say:'Hagan juego',
      center:`<p>${seats.length<2?'Esperando a que se siente algún amigo.':`Ciegas ${small} y ${big}. Cuando estéis todos listos, quien abrió la mesa reparte.`}</p>`,
      bar:balance+actions(button('ready',me?.ready?'Cancelar listo':'Listo para jugar',!me?.ready&&coins<big,'casino-play'),
        host?button('deal','Repartir',seats.length<2||seats.some(seat=>!seat.ready)):'',stand)};
  }
  function render(){
    if(!active)return;
    const {bar,...table}=view();
    const html=shell('Póker con amigos',"Salón compartido · Texas Hold'em",pokerTable(table),`<p class="casino-shared-error" role="status">${escape(error)}</p>${bar}`);
    if(html===signature)return;
    const focus=document.activeElement;
    const field=panel.contains(focus)?[...focus.attributes].find(attr=>attr.name==='data-poker'||attr.name==='data-casino-action'||attr.name==='data-casino-leave'):null;
    signature=html;
    panel.innerHTML=html;
    updateClock();
    if(field){
      const replacement=[...panel.querySelectorAll('button:not(:disabled)')].find(item=>
        item.getAttribute(field.name)===field.value&&item.dataset.room===focus.dataset.room);
      (replacement||panel.querySelector('[data-casino-leave]'))?.focus({preventScroll:true});
    }
  }
  function updateClock(){
    const clock=active&&panel.querySelector('[data-casino-clock]');
    if(clock)clock.textContent=Math.max(0,Math.ceil((state.table.round.ends-state.serverTime-(performance.now()-receivedAt))/1000))+' s';
  }
  function update(data){
    receivedAt=performance.now();
    state=data;
    // La cantidad elegida para subir solo vale para el turno en que se eligió.
    const round=data.table?.round,key=round?`${round.id}:${round.stage}:${round.turn}`:'';
    if(key!==turnKey){turnKey=key;raise=0}
    onPresence(data.players,data.table?.seat??null);
    // Mensajes nuevos de los amigos. Los que ya estaban al entrar, o los viejos, van al registro sin bocadillo.
    for(const message of data.chat||[]){
      if(message.n<=heard)continue;
      heard=message.n;
      if(!message.mine)onChat?.({...message,old:first||data.serverTime-message.at>8000});
    }
    first=false;
    render();
  }
  function send(action,extra={}){
    const generation=epoch;
    if(working){
      if(action!=='pulse')return flight.then(()=>{if(generation===epoch)return send(action,extra)});
      return;
    }
    flight=perform(action,extra,generation);
    return flight;
  }
  async function perform(action,extra,generation){
    working=true;
    try{
      const data=await request(action,extra);
      if(generation!==epoch)return;
      if(!data.ok){
        if(action==='chat'){onNotice?.(data.error);return}
        error=data.error;
        if(data.status===401||(action==='pulse'&&data.status===409&&data.error.startsWith('Activa'))){
          enabled=false;state=null;onPresence(null);clearInterval(timer);
        }
        return;
      }
      error='';
      update(data);
    }catch{
      if(generation===epoch)error='Se ha perdido la conexión. Inténtalo de nuevo.';
    }finally{
      if(generation===epoch){working=false;render()}
    }
  }
  const pulse=()=>{
    updateClock();
    return send('pulse',{...position(),look:window.Progress?.look?.(),...(act?{act}:{})});
  };
  function stop(){
    const wasEnabled=enabled;
    epoch++;working=false;enabled=false;state=null;error='';first=true;clearInterval(timer);onPresence(null);render();
    if(wasEnabled)Promise.resolve(flight).then(()=>{
      if(!enabled)fetch('/api/casino',{method:'POST',headers:{'Content-Type':'application/json'},body:'{"action":"exit"}',keepalive:true}).catch(()=>{});
    });
  }
  function click(event){
    const item=event.target.closest('button');
    if(!item||!active)return;
    const move=item.dataset.poker,round=state?.table?.round;
    if(move){
      if(!round?.legal)return;
      const {minTo,maxTo}=round.legal;
      return send('act',{id:round.id,move,...(move==='raise'?{to:Math.min(maxTo,Math.max(minTo,raise||minTo))}:{})});
    }
    const action=item.dataset.casinoAction;
    if(action==='enable'){
      if(enabled)return;
      enabled=true;error='';render();
      pulse();timer=setInterval(pulse,1200);
    }else if(action==='exit')stop();
    else if(action==='profile'){
      closeSalon();
      document.querySelector('.portal-social-open')?.click();
    }else if(action==='join')send(action,{id:item.dataset.room});
    else if(action==='ready')send(action,{ready:!state.table.seats.find(seat=>seat.mine).ready,previous:state.table.round?.id??null});
    else if(action==='deal')send(action,{id:state.table.id,previous:state.table.round?.id??null});
    else if(action==='stand'||action==='create')send(action);
  }
  return {
    open(){active=true;signature='';render()},hide(){active=false},stop,click,raise(to){raise=to},
    // Un gesto o un salto: sale con el siguiente latido, que se adelanta para que los amigos lo vean pronto.
    act(value){act=value;if(enabled)pulse()},
    // Un mensaje para los amigos. Devuelve false si el Salón compartido no está abierto.
    say(text){if(!enabled)return false;send('chat',{text});return true}
  };
}

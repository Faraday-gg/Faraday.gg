// Presencia y mesa compartida. El servidor decide de quién son las cartas y cuánto cobra cada mano.
export function casinoFriends({panel,onPresence,position,closeSalon}){
  let enabled=false,active=false,working=false,state=null,error='',held=[],roundId,signature='',epoch=0,timer,flight;
  const escape=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const money=n=>new Intl.NumberFormat('es-ES').format(n)+' ≈';
  const card=({r,s})=>escape(({11:'J',12:'Q',13:'K',14:'A'}[r]||r)+['♠','♥','♦','♣'][s]);
  const button=(action,label,disabled=false)=>`<button type="button" class="casino-option" data-casino-action="${action}" ${disabled?'disabled':''}>${label}</button>`;
  async function request(action,extra={}){
    const response=await fetch('/api/casino',{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({action,...extra}),signal:AbortSignal.timeout(5500)
    });
    return {ok:response.ok,status:response.status,...await response.json()};
  }
  function markup(){
    if(!enabled)return `<p>Comparte tu avatar y tu posición con tus amigos mientras estés en el Salón. Aquí podéis sentaros a jugar juntos.</p>
      ${button('enable','Entrar con amigos',working)} ${button('profile','Abrir el panel de amigos')}`;
    if(!state)return `<p>Conectando con el Salón…</p>${button('exit','Cancelar')}`;
    const {table,tables,players,coins,ante}=state;
    const balance=`<p class="casino-shared-balance">Monedero de póker compartido <strong>${money(coins)}</strong></p>`;
    if(!table)return `${balance}<p>${players.length?'En el Salón: '+players.map(peer=>escape(peer.name)).join(', ')+'.':'Tus amigos aparecerán aquí cuando entren en el Salón compartido.'}</p>
      <p>Póker de descarte para 2 a 4 amigos. Cada mano cuesta ${money(ante)} por persona. La mejor mano gana el bote.</p>
      <div class="casino-table-actions">${button('create','Abrir mi mesa')}${button('exit','Dejar de compartir')}</div>
      ${tables.length?`<ul class="casino-seats">${tables.map(room=>`<li><span>Mesa de ${escape(room.name)} · ${room.seats}/4</span><button class="casino-option" type="button" data-casino-action="join" data-room="${escape(room.id)}">Sentarme</button></li>`).join('')}</ul>`:''}`;
    const {round,seats,host}=table,me=seats.find(seat=>seat.mine);
    const cards=(round?.cards||[]).map((value,i)=>`<button type="button" class="casino-card${held[i]?' is-held':''}${value.s===1||value.s===2?' is-red':''}"
      data-casino-hold="${i}" aria-pressed="${!!held[i]}" ${round.waiting?'disabled':''}><b>${card(value)}</b><small>${held[i]?'Guardada':''}</small></button>`).join('');
    return `${balance}<ul class="casino-seats">${seats.map(seat=>`<li><span>${escape(seat.name)}${seat.mine?' (tú)':''}</span><small>${round?.cards?'Sentado':seat.ready?'Listo':'Esperando'}</small></li>`).join('')}</ul>
      ${round?.cards?`<div class="casino-cards">${cards}</div>
        <p>${round.waiting?'Esperando a los demás.':'Marca las cartas que quieres guardar. Puedes cambiar una vez. Si se acaba el tiempo, conservas tu mano.'}</p>
        <p class="casino-shared-clock">Tiempo restante <strong data-casino-clock></strong></p>
        ${round.waiting?'':button('draw',held.every(Boolean)?'Plantarse':'Cambiar cartas')}`:
        `${round?.results?`<div class="casino-showdown"><h4>Resultado</h4><ul class="casino-seats">${round.results.map(entry=>`<li><span><b>${escape(entry.name)}</b><br>${entry.cards.map(card).join(' ')} · ${escape(entry.label)}</span>${entry.prize?`<strong>+${money(entry.prize)}</strong>`:''}</li>`).join('')}</ul></div>`:''}
        <p>Entrada por mano: ${money(ante)}. El bote se reparte si hay empate.</p>
        <div class="casino-table-actions">${button('ready',me?.ready?'Cancelar listo':'Listo para apostar',!me?.ready&&coins<ante)}
        ${host?button('deal','Repartir',seats.length<2||seats.some(seat=>!seat.ready)):''}</div>`}
      <div class="casino-table-actions">${button('stand','Levantarme')}</div>`;
  }
  function render(){
    if(!active)return;
    const html=`<header class="casino-panel-head"><div><h3>Póker con amigos</h3><p>Salón compartido</p></div>
      <button class="game-back" type="button" data-casino-leave aria-label="Volver al salón">×</button></header>
      <p class="casino-shared-error" role="status">${escape(error)}</p>${markup()}`;
    if(html===signature)return;
    const focus=document.activeElement;
    const field=panel.contains(focus)?[...focus.attributes].find(attr=>attr.name==='data-casino-hold'||attr.name==='data-casino-action'||attr.name==='data-casino-leave'):null;
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
  let receivedAt=0;
  function update(data){
    receivedAt=performance.now();
    state=data;
    if(roundId!==data.table?.round?.id){
      roundId=data.table?.round?.id;
      held=Array(5).fill(false);
    }
    onPresence(data.players,data.table?.seat??null);
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
    return send('pulse',{...position(),look:window.Progress?.look?.()});
  };
  function stop(){
    const wasEnabled=enabled;
    epoch++;working=false;enabled=false;state=null;error='';clearInterval(timer);onPresence(null);render();
    if(wasEnabled)Promise.resolve(flight).then(()=>{
      if(!enabled)fetch('/api/casino',{method:'POST',headers:{'Content-Type':'application/json'},body:'{"action":"exit"}',keepalive:true}).catch(()=>{});
    });
  }
  function click(event){
    const item=event.target.closest('button');
    if(!item||!active)return;
    if(item.dataset.casinoHold!==undefined){
      const i=Number(item.dataset.casinoHold);
      held[i]=!held[i];
      render();
      return;
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
    else if(action==='draw')send(action,{id:roundId,held});
    else if(action==='stand'||action==='create')send(action);
  }
  return {open(){active=true;signature='';render()},hide(){active=false},stop,click};
}

// Apuestas en los duelos (decisión 0044): el selector de apuesta, la ficha junto al nombre, el resultado de la pantalla
// final y el registro de lo apostado. Las reglas y las cuentas están en bets-rules.js; los faradios, en progress.js.
// duel.js solo llama a Bets.picker(), Bets.choice(), Bets.chip(), Bets.track() y Bets.result().
//
// Sin cuenta, todo pasa en este navegador y la apuesta es contra la banca: se cobra al empezar el duelo (al ver al rival)
// y se liquida al terminar. Cada duelo tiene un apunte en el registro, así que no se cobra ni se paga dos veces.
// Con cuenta (decisión 0060), la apuesta es un bote entre los dos jugadores y la cobra y la paga el servidor: se juega
// la más baja de las dos apuestas y quien gana se lleva el bote menos un 10 %. Aquí solo se pide y se enseña.
(()=>{
  const KEY='casi-casi:apuestas',R=window.BetRules;
  const int=n=>new Intl.NumberFormat('es-ES',{maximumFractionDigits:0,useGrouping:'always'}).format(n);
  const COIN='<span class="coin" aria-hidden="true">≈</span>',coins=n=>`${int(n)} ${COIN}<span class="sr-only"> faradios</span>`;
  const madrid=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Madrid'}).format(new Date());
  const load=()=>{try{return R.normalize(JSON.parse(localStorage.getItem(KEY)))}catch{return R.empty()}};
  const store=ledger=>{try{localStorage.setItem(KEY,JSON.stringify(ledger))}catch{}};
  const level=()=>window.Progress?.level?.()??1,balance=()=>window.Progress?.coins?.()??0;
  const status=id=>R.check(id,{level:level(),coins:balance(),ledger:load(),day:madrid()});
  // Con cuenta, el bote lo lleva el servidor.
  const online=()=>!!window.Progress?.linked?.();
  async function server(action,duel){
    const response=await fetch('/api/progreso',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify({action,duel}),signal:AbortSignal.timeout(10000)});
    const data=await response.json().catch(()=>({}));return {ok:response.ok,status:response.status,data};
  }
  const busy=new Set();
  // Rayos que lleva cada nivel en su ficha: uno, dos o tres.
  const bolt='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13.5 2 4.5 13.5h6L9.5 22l9-11.5h-6z"/></svg>';
  const lock='<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="10" rx="2.5"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>';

  // La apuesta elegida, si hoy todavía se puede hacer. Es lo que viaja al servidor con el perfil.
  function choice(){const id=load().choice;return id&&status(id).ok?id:null}
  function choose(id){const ledger=load();ledger.choice=R.tier(id)?id:'';store(ledger)}

  // Selector: «Sin apuesta» y las tres fichas. Por debajo del nivel 10 se ven con candado.
  function picker({compact=false}={}){
    if(!R.DAILY_CAP)return '';
    const lvl=level(),chosen=choice(),left=Math.max(0,R.DAILY_CAP-R.usedToday(load(),madrid())),locked=lvl<R.UNLOCK;
    const card=id=>{
      const t=R.TIERS[id],s=status(id),on=chosen===id,index=R.IDS.indexOf(id)+1;
      const note=!R.unlocked(id,lvl)?`${lock}Nivel ${t.level}`:s.reason==='saldo'?'No te llega':s.reason==='tope'?'Tope de hoy':online()?`Hasta +${int(R.pot(t.amount).win)}`:`Ganas +${int(t.amount)}`;
      return `<button type="button" class="bet-card" data-bet="${id}" data-tier="${index}" aria-pressed="${on}"${s.ok?'':' disabled'} aria-label="${t.name}: apostar ${t.amount} faradios${s.ok?'':'. '+note.replace(/<[^>]+>/g,'')}"><span class="bet-bolts" aria-hidden="true">${bolt.repeat(index)}</span><b class="bet-name">${t.name}</b><span class="bet-amount">${coins(t.amount)}</span><small class="bet-note">${note}</small></button>`;
    };
    const head=locked?`<p class="bet-lock">${lock}<span>Se desbloquea en el nivel ${R.UNLOCK}</span></p>`
      :online()?`<p class="bet-help">Bote entre los dos: se juega la apuesta más baja de las dos. Quien gana se lleva el bote menos un 10 %; si empatáis, cada uno recupera lo suyo; abandonar es perder. ${left?`Hoy te ${left===1?'queda 1 apuesta':`quedan ${left} apuestas`}.`:'Hoy ya no quedan apuestas.'} Contra el bot no se apuesta.</p>`
      :`<p class="bet-help">Contra la banca: si ganas, doblas; si pierdes o abandonas, la pierdes; si empatáis, la recuperas. ${left?`Hoy te ${left===1?'queda 1 apuesta':`quedan ${left} apuestas`}.`:'Hoy ya no quedan apuestas.'} Contra el bot no se apuesta.</p>`;
    return `<section class="bet-picker${compact?' is-compact':''}${locked?' is-locked':''}" id="bet-picker" aria-labelledby="bet-title">
<div class="bet-top"><h3 id="bet-title">Apuesta${compact?' para la siguiente':''}</h3><span class="bet-balance">Tienes ${coins(balance())}</span></div>
<div class="bet-cards" role="group" aria-label="Nivel de apuesta"><button type="button" class="bet-card bet-none" data-bet="" aria-pressed="${!chosen}"${locked?' disabled':''}><span class="bet-bolts" aria-hidden="true">—</span><b class="bet-name">Sin apuesta</b><span class="bet-amount">0 ${COIN}</span><small class="bet-note">Solo por honor</small></button>${R.IDS.map(card).join('')}</div>
${head}</section>`;
  }
  function repaint(){const element=document.getElementById('bet-picker');if(element)element.outerHTML=picker({compact:element.classList.contains('is-compact')})}

  // Ficha junto al nombre en el marcador y en la presentación: la apuesta de cada uno se ve durante todo el duelo.
  function chip(player){
    const t=player&&R.tier(player.bet);if(!t)return '';
    // Con cuenta se enseña lo que de verdad hay en juego: la apuesta más baja de las dos, o nada si el rival no apuesta.
    const both=online()&&current?.players?.length>1,amount=both?R.shared(current.players[0].bet,current.players[1].bet):t.amount;
    if(!amount)return '';
    return `<span class="bet-chip" data-tier="${R.IDS.indexOf(player.bet)+1}" title="Apuesta ${t.name}: ${amount} faradios"><span aria-hidden="true">${bolt}</span>${int(amount)} ${COIN}<span class="sr-only"> apostados</span></span>`;
  }

  // Cobra y liquida según el estado que llega del servidor. Se llama en cada estado: lo que ya está hecho no se repite.
  // El último estado del duelo, para que la ficha sepa qué apuesta trae cada uno.
  let current=null;
  function track(view){
    current=view;
    if(!view?.id||!Array.isArray(view.players)||view.players.length<2)return;
    const mine=view.players[view.you],id=mine?.bet;if(!R.tier(id))return;
    let ledger=load();
    if(online()||ledger.duels[view.id]?.server){trackServer(view,id);return}
    // Cobro: al empezar (presentación o primera pregunta). Si el duelo ya terminó sin apunte, no se cobra nada.
    if(!ledger.duels[view.id]&&view.status==='playing'){
      const result=R.stake(ledger,view.id,id,{level:level(),coins:balance(),day:madrid(),now:Date.now()});
      if(result.charged&&window.Progress?.spend?.(result.charged,'apuestas')){
        store(result.ledger);ledger=result.ledger;
        window.showToast?.(`Apuesta ${R.TIERS[id].name}: −${int(result.charged)} ≈. Si ganas, te llevas ${int(result.charged*2)} ≈.`);
      }else if(result.reason!=='repetida')window.showToast?.(result.reason==='tope'?'Ya has hecho las apuestas de hoy: este duelo va sin apuesta.':'No te llegan los faradios: este duelo va sin apuesta.');
    }
    if(view.status==='finished')pay(view.id,R.outcome(view));
  }
  // Con cuenta: el servidor cobra la parte del bote al empezar y paga al terminar. Aquí se guarda un apunte para enseñarlo.
  function trackServer(view,id){
    const ledger=load(),entry=ledger.duels[view.id];
    if(!entry&&view.status==='playing'&&!busy.has(view.id)){
      const stake=R.shared(id,view.players[1-view.you]?.bet);if(!stake)return;
      busy.add(view.id);
      server('apostar',view.id).then(({ok,data})=>{
        const now=load(),day=madrid();
        if(ok){
          now.duels[view.id]={tier:id,amount:data.stake,status:'open',delta:-data.stake,at:Date.now(),server:true};now.count=R.usedToday(now,day)+1;now.day=day;store(now);
          window.Progress?.serverCoins?.(data.coins);
          window.showToast?.(`Al bote: −${int(data.stake)} ≈. Si ganas, te llevas ${int(data.stake+R.pot(data.stake).win)} ≈.`);
        }else if(data.code==='saldo'||data.code==='tope')window.showToast?.(data.code==='tope'?'Ya has hecho las apuestas de hoy: este duelo va sin apuesta.':'No te llegan los faradios: este duelo va sin apuesta.');
      }).catch(()=>{}).finally(()=>busy.delete(view.id));
    }
    if(entry?.server&&entry.status==='open'&&view.status==='finished')settleServer(view.id);
  }
  // Pide al servidor que liquide el bote de un duelo terminado y lo enseña en la pantalla final si sigue a la vista.
  async function settleServer(duelId){
    if(busy.has(duelId))return null;busy.add(duelId);
    try{
      const {ok,status:code,data}=await server('cobrar-apuesta',duelId);
      const ledger=load(),entry=ledger.duels[duelId];if(!entry)return null;
      // 409: el servidor aún no ve terminado el duelo; se reintenta al volver. Otros fallos de red, también.
      if(!ok){if(code===404||code===403)ledger.duels[duelId]={...entry,status:'lost'};else return null}
      else{
        const result=data.result==='none'?'void':data.result,stake=data.stake||entry.amount;
        ledger.duels[duelId]={...entry,amount:stake,status:['won','lost','draw','void'].includes(result)?result:'void',delta:data.result==='none'?0:data.amount-stake};
        window.Progress?.serverCoins?.(data.coins);
      }
      store(ledger);
      const slot=document.getElementById('bet-result-slot');if(slot?.dataset.duel===duelId)slot.outerHTML=result({id:duelId});
      return ledger.duels[duelId];
    }catch{return null}finally{busy.delete(duelId)}
  }
  function pay(duelId,result){
    const before=load(),done=R.settle(before,duelId,result);if(done.ledger===before)return {...done,paid:0};
    store(done.ledger);if(done.paid>0)window.Progress?.reward?.({coins:done.paid,reason:'apuestas'});
    return done;
  }

  // Pantalla final: lo ganado o perdido con la apuesta y el saldo que queda.
  function result(view){
    const entry=view&&load().duels[view.id];
    // El bote lo liquida el servidor: mientras llega la respuesta se deja el hueco, que settleServer rellena.
    if(entry?.server&&entry.status==='open')return `<div class="bet-result is-even" id="bet-result-slot" data-duel="${view.id}" role="status"><span class="bet-result-tag">${bolt}Apuesta</span><p>Repartiendo el bote…</p></div>`;
    if(!entry||entry.status==='open')return '';
    const t=R.TIERS[entry.tier],delta=entry.delta;
    const sign=delta>0?'+':delta<0?'−':'±',kind=delta>0?'up':delta<0?'down':'even';
    const text=entry.server?(entry.status==='won'?`Te llevas el bote de ${int(entry.amount*2)} ≈ menos el 10 %.`
      :entry.status==='draw'?'Empate: cada uno recupera lo suyo.'
      :entry.status==='void'?'Tu rival no llegó a poner su parte: recuperas lo tuyo.'
      :view.reason==='abandono'&&view.winner==='rival'?'Abandonar cuenta como perder: el bote es para tu rival.':'El bote es para tu rival.')
      :entry.status==='won'?`Recuperas tus ${int(t.amount)} ≈ y la banca te da otros ${int(t.amount)}.`
      :entry.status==='draw'?'Empate: recuperas lo apostado.'
      :entry.status==='void'?'Duelo anulado: recuperas lo apostado.'
      :view.reason==='abandono'&&view.winner==='rival'?'Abandonar cuenta como perder: la apuesta se queda en la banca.':'La apuesta se queda en la banca.';
    return `<div class="bet-result is-${kind}" role="status"><span class="bet-result-tag">${bolt.repeat(R.IDS.indexOf(entry.tier)+1)}Apuesta ${t.name}</span><strong class="bet-delta">${sign}${int(Math.abs(delta))} ${COIN}<span class="sr-only"> faradios</span></strong><p>${text}</p><small>Saldo: ${coins(balance())}</small></div>`;
  }

  // Si se cerró la página en mitad de un duelo con apuesta, al volver se pregunta cómo acabó y se liquida.
  // Si el servidor ya no lo encuentra, se da por perdido: la apuesta ya se había cobrado.
  async function recover(){
    const open=Object.entries(load().duels).filter(([,entry])=>entry.status==='open').map(([id])=>id);if(!open.length||typeof playerId!=='function')return;
    try{await playerReady}catch{}
    for(const id of open){
      if(load().duels[id].server){const done=await settleServer(id);if(done?.status==='won')window.showToast?.(`Ganaste un duelo con apuesta: +${int(done.delta)} ≈.`);continue}
      try{
        const response=await fetch('/api/duelo',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'estado',player:playerId(),id}),signal:AbortSignal.timeout(8000)});
        if(response.status===404||response.status===403){pay(id,'lost');continue}
        if(!response.ok)continue;
        const view=await response.json();if(view.status==='finished'){const done=pay(id,R.outcome(view));if(done.paid&&done.entry.status==='won')window.showToast?.(`Ganaste un duelo con apuesta: +${int(done.entry.delta)} ≈.`)}
      }catch{}
    }
  }

  document.addEventListener('click',event=>{
    const button=event.target.closest('[data-bet]');if(!button||button.disabled)return;
    choose(button.dataset.bet);repaint();
  });
  // El saldo y el nivel cambian al terminar un duelo o al comprar: se repinta si el selector está a la vista.
  document.addEventListener('faraday:duel',()=>setTimeout(repaint,0));
  setTimeout(recover,3000);
  window.Bets={picker,choice,chip,track,result};
})();

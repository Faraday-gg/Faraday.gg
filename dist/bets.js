// Apuestas en los duelos (decisión 0041): el selector de apuesta, la ficha junto al nombre, el resultado de la pantalla
// final y el registro de lo apostado. Las reglas y las cuentas están en bets-rules.js; los faradios, en progress.js.
// duel.js solo llama a Bets.picker(), Bets.choice(), Bets.chip(), Bets.track() y Bets.result().
//
// Todo pasa en este navegador, como el resto del progreso: la apuesta se cobra al empezar el duelo (al ver al rival) y
// se liquida al terminar. Cada duelo tiene un apunte en el registro, así que no se cobra ni se paga dos veces.
(()=>{
  const KEY='casi-casi:apuestas',R=window.BetRules;
  const int=n=>new Intl.NumberFormat('es-ES',{maximumFractionDigits:0,useGrouping:'always'}).format(n);
  const COIN='<span class="coin" aria-hidden="true">≈</span>',coins=n=>`${int(n)} ${COIN}<span class="sr-only"> faradios</span>`;
  const madrid=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Madrid'}).format(new Date());
  const load=()=>{try{return R.normalize(JSON.parse(localStorage.getItem(KEY)))}catch{return R.empty()}};
  const store=ledger=>{try{localStorage.setItem(KEY,JSON.stringify(ledger))}catch{}};
  const level=()=>window.Progress?.level?.()??1,balance=()=>window.Progress?.coins?.()??0;
  const status=id=>R.check(id,{level:level(),coins:balance(),ledger:load(),day:madrid()});
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
      const note=!R.unlocked(id,lvl)?`${lock}Nivel ${t.level}`:s.reason==='saldo'?'No te llega':s.reason==='tope'?'Tope de hoy':`Ganas +${int(t.amount)}`;
      return `<button type="button" class="bet-card" data-bet="${id}" data-tier="${index}" aria-pressed="${on}"${s.ok?'':' disabled'} aria-label="${t.name}: apostar ${t.amount} faradios${s.ok?'':'. '+note.replace(/<[^>]+>/g,'')}"><span class="bet-bolts" aria-hidden="true">${bolt.repeat(index)}</span><b class="bet-name">${t.name}</b><span class="bet-amount">${coins(t.amount)}</span><small class="bet-note">${note}</small></button>`;
    };
    const head=locked?`<p class="bet-lock">${lock}<span>Se desbloquea en el nivel ${R.UNLOCK}</span></p>`
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
    return `<span class="bet-chip" data-tier="${R.IDS.indexOf(player.bet)+1}" title="Apuesta ${t.name}: ${t.amount} faradios"><span aria-hidden="true">${bolt}</span>${int(t.amount)} ${COIN}<span class="sr-only"> apostados</span></span>`;
  }

  // Cobra y liquida según el estado que llega del servidor. Se llama en cada estado: lo que ya está hecho no se repite.
  function track(view){
    if(!view?.id||!Array.isArray(view.players)||view.players.length<2)return;
    const mine=view.players[view.you],id=mine?.bet;if(!R.tier(id))return;
    let ledger=load();
    // Cobro: al empezar (presentación o primera pregunta). Si el duelo ya terminó sin apunte, no se cobra nada.
    if(!ledger.duels[view.id]&&view.status==='playing'){
      const result=R.stake(ledger,view.id,id,{level:level(),coins:balance(),day:madrid(),now:Date.now()});
      if(result.charged&&window.Progress?.spend?.(result.charged)){
        store(result.ledger);ledger=result.ledger;
        window.showToast?.(`Apuesta ${R.TIERS[id].name}: −${int(result.charged)} ≈. Si ganas, te llevas ${int(result.charged*2)} ≈.`);
      }else if(result.reason!=='repetida')window.showToast?.(result.reason==='tope'?'Ya has hecho las apuestas de hoy: este duelo va sin apuesta.':'No te llegan los faradios: este duelo va sin apuesta.');
    }
    if(view.status==='finished')pay(view.id,R.outcome(view));
  }
  function pay(duelId,result){
    const before=load(),done=R.settle(before,duelId,result);if(done.ledger===before)return {...done,paid:0};
    store(done.ledger);if(done.paid>0)window.Progress?.reward?.({coins:done.paid});
    return done;
  }

  // Pantalla final: lo ganado o perdido con la apuesta y el saldo que queda.
  function result(view){
    const entry=view&&load().duels[view.id];if(!entry||entry.status==='open')return '';
    const t=R.TIERS[entry.tier],delta=entry.delta;
    const sign=delta>0?'+':delta<0?'−':'±',kind=delta>0?'up':delta<0?'down':'even';
    const text=entry.status==='won'?`Recuperas tus ${int(t.amount)} ≈ y la banca te da otros ${int(t.amount)}.`
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

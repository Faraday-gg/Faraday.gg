// Circuito de amigos (decisión 0034): referidos con premio para los dos. El servidor manda (lib/referidos.mjs): apunta
// quién invitó a quién, decide cuándo un amigo «se conecta» (3 retos del día en sus primeros 14 días) y marca cada
// premio como cobrado; aquí se pide, se entrega con progress.js y se pinta.
// - Todos los enlaces que se comparten (resultado, tarjeta, duelos y ligas) llevan ?de=TU-CÓDIGO: Circuito.link(url).
// - Quien abre un enlace con ?de= y es nuevo queda vinculado y ve quién le invita: «¿Te acercas más que él?».
// - Corriente compartida: durante 30 días, cada día que jugáis los dos el reto, batería extra para los dos.
(()=>{
  const KEY='casi-casi:circuito:',shell=$('#circuit-shell'),content=$('#circuit-content');
  const saved={get(key,fallback){try{return JSON.parse(localStorage.getItem(KEY+key))??fallback}catch{return fallback}},set(key,value){try{localStorage.setItem(KEY+key,JSON.stringify(value))}catch{}},del(key){try{localStorage.removeItem(KEY+key)}catch{}}};
  const PROFILE='casi-casi:duelo:perfil'; // apodo compartido con los duelos y las ligas
  const nickname=()=>{try{const value=JSON.parse(localStorage.getItem(PROFILE));if(typeof value?.name==='string'&&value.name.trim())return value.name}catch{}return ''};
  const identity=()=>({name:nickname()||'Jugador',avatar:window.Progress?Progress.look():{}});
  const avatar=(look,size='small')=>`<span class="duel-avatar ${size}" aria-hidden="true">${window.Avatar?Avatar.render(look||{},{bust:true}):''}</span>`;
  const shortDate=id=>new Intl.DateTimeFormat('es-ES',{day:'numeric',month:'long',timeZone:'Europe/Madrid'}).format(new Date(id+'T12:00:00Z'));
  const times=n=>format(n)+'×';
  // Quien no ha puesto apodo sale como «Jugador»: en las frases se dice «tu amigo».
  const named=name=>name&&name!=='Jugador'?name:null;
  // Escalones del Circuito: lo que se gana al llegar a cada número de amigos conectados (además del cofre por amigo).
  const TIERS=[[1,'Camiseta Cable pelado'],[3,'Cofre Tormenta'],[5,'Bobina de Tesla'],[10,'Jaula de Faraday']],SOCKETS=10;
  let state=null,busy=false,seq=0;

  // ?de=CÓDIGO: se guarda hasta que el servidor lo apunte y se quita de la dirección (sin tocar ?liga= ni ?duelo=).
  const params=new URLSearchParams(location.search),invited=(params.get('de')||'').toUpperCase();
  if(params.has('de')){
    if(/^[A-Z2-9]{6}$/.test(invited))saved.set('de',invited);
    params.delete('de');const rest=params.toString();history.replaceState(history.state,'',location.pathname+(rest?'?'+rest:'')+location.hash);
  }

  async function call(action,extra={}){
    try{
      await playerReady;
      const response=await fetch('/api/referido',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,player:playerId(),...extra}),signal:AbortSignal.timeout(8000)});
      return {ok:response.ok,status:response.status,data:await response.json()};
    }catch{return {ok:false,status:0,data:{error:'Sin conexión con el servidor'}}}
  }
  // Tu código, guardado junto al jugador al que pertenece (al iniciar sesión el jugador puede cambiar).
  const myCode=()=>{const own=saved.get('codigo',null);return own&&typeof playerId==='function'&&own.player===playerId()?own.code:null};
  async function loadCode(){
    const sent=JSON.stringify(identity());
    if(myCode()&&saved.get('perfil','')===sent)return myCode();
    const response=await call('codigo',identity());
    if(response.ok){saved.set('codigo',{player:playerId(),code:response.data.code});saved.set('perfil',sent)}
    return myCode();
  }
  // Añade ?de=TU-CÓDIGO a un enlace del juego. Sin código todavía, el enlace sale tal cual.
  function link(url){
    const code=myCode();if(!code)return url;
    try{const target=new URL(url,location.href);target.searchParams.set('de',code);return target.toString()}catch{return url}
  }

  // Pide el estado, cobra lo pendiente (el servidor lo marca antes) y carga la corriente compartida.
  async function sync(){
    const response=await call('estado');if(!response.ok)return null;
    state=response.data;const notes=[];
    if(state.pending>0){
      const claimed=await call('reclamar');
      if(claimed.ok&&window.Progress){const result=Progress.circuitPrizes(claimed.data.prizes,claimed.data.connections);if(result.text)notes.push(result.text)}
    }else if(window.Progress)Progress.circuitPrizes([],state.connections);
    if(window.Progress){const current=Progress.circuitCurrent(state.current,state.rules.currentCharge);if(current)notes.push(current)}
    if(notes.length)setTimeout(()=>showToast(notes.join(' · ')),400);
    if(!shell.hidden&&shell.dataset.screen==='main')render();
    return state;
  }

  // Quien llega por un enlace: si es nuevo, queda vinculado y se le enseña quién le invita.
  async function accept(){
    const code=saved.get('de',null);if(!code)return;
    const response=await call('abrir',{code,...identity()});
    if(!response.ok&&response.status!==404&&response.status!==400)return; // sin servidor: se intenta la próxima vez
    saved.del('de');
    if(response.ok&&response.data.linked){open();renderWelcome(response.data)}
  }
  function renderWelcome(data){
    shell.dataset.screen='welcome';const sponsor=data.sponsor,body=window.Progress?Progress.look().body:'hombre';
    content.innerHTML=`<p class="duel-kicker">Circuito de amigos</p>
<div class="circuit-welcome">${avatar(sponsor.avatar,'big')}<span class="circuit-spark" aria-hidden="true">⚡</span></div>
<h2 id="circuit-title">${named(sponsor.name)?`<b>${escapeHtml(sponsor.name)}</b> te ha invitado`:'Un amigo te ha invitado'}. <em>¿Te acercas más?</em></h2>
<p class="circuit-lead">Juega el reto de hoy: al terminar verás su resultado y te llevas un <b>cofre Rayo</b> y ${body==='mujer'?'el <b>gorro':'la <b>gorra'} Enchufe</b>, exclusiva para quien entra invitado.</p>
<p class="duel-note">Si juegas el reto ${data.days} días en tus primeras dos semanas, los dos ganáis más: tú, 150 ≈; ${named(sponsor.name)?escapeHtml(sponsor.name):'quien te invitó'}, otro cofre. Y cada día que juguéis los dos, batería extra.</p>
<button class="game-primary" type="button" data-circuit="play">Jugar el reto de hoy <span aria-hidden="true">→</span></button>`;
  }

  function friendRow(friend){
    const state=friend.connected?'<span class="circuit-state is-on">Conectado ⚡</span>':friend.expired?'<span class="circuit-state is-off">Se acabó el plazo</span>'
      :`<span class="circuit-state">${friend.days} de 3 retos · hasta el ${shortDate(friend.until)}</span>`;
    return `<li class="circuit-friend${friend.connected?' is-on':''}">${avatar(friend.avatar)}<span><b>${escapeHtml(friend.name)}</b>${state}</span></li>`;
  }
  function render(){
    shell.dataset.screen='main';
    if(!state){content.innerHTML='<p class="duel-note league-loading">Cargando tu Circuito…</p>';return}
    const n=state.connections,on=state.friends.filter(f=>f.connected),next=TIERS.find(([goal])=>goal>n);
    const sockets=Array.from({length:SOCKETS},(_,i)=>{const friend=on[i],tier=TIERS.find(([goal])=>goal===i+1);
      return `<li class="circuit-socket${friend?' is-on':''}${tier?' is-tier':''}" title="${friend?escapeHtml(friend.name):`Enchufe ${i+1}`}${tier?` · ${tier[1]}`:''}">${friend?avatar(friend.avatar,'tiny'):`<span aria-hidden="true">${i+1}</span>`}${tier?`<small>${tier[1]}</small>`:''}</li>`}).join('');
    const sponsor=state.sponsor?`<div class="circuit-sponsor">${avatar(state.sponsor.avatar)}<p>Te invitó <b>${escapeHtml(state.sponsor.name)}</b>. ${state.sponsor.connected?'Ya estáis conectados ⚡':state.sponsor.expired?'El plazo para conectaros terminó.':`Llevas ${state.sponsor.days} de 3 retos del día (hasta el ${shortDate(state.sponsor.until)}).`}${state.sponsor.today?` Hoy: tú ${times(state.sponsor.today.yours)}${state.sponsor.today.theirs!=null?`, ${escapeHtml(state.sponsor.name)} ${times(state.sponsor.today.theirs)}`:''}.`:''}</p></div>`:'';
    const current=state.current.length?`<h3 class="league-subtitle">Corriente compartida</h3><ul class="circuit-current">${state.current.map(link=>`<li>⚡ <b>${escapeHtml(link.name)}</b>: +${state.rules.currentCharge} de batería cada día que jugáis los dos, hasta el ${shortDate(link.until)}</li>`).join('')}</ul>`:'';
    const pending=state.friends.filter(f=>!f.connected);
    content.innerHTML=`<p class="duel-kicker">Circuito de amigos</p>
<h2 id="circuit-title">Invita a tus amigos. <em>Ganáis los dos.</em></h2>
${sponsor}
<div class="circuit-board"><p class="circuit-count"><b>${n}</b> ${n===1?'amigo conectado':'amigos conectados'}${next?` · ${next[0]-n} más para: ${next[1]}`:' · ¡Circuito completo!'}</p><ol class="circuit-sockets" aria-label="Tus amigos conectados">${sockets}</ol></div>
<div class="league-share"><span class="league-code" aria-label="Tu código">${myCode()||'······'}</span><button class="game-primary" type="button" data-circuit="share">Invitar amigos</button></div>
<ol class="circuit-steps">
<li><b>Comparte tu enlace.</b> También va dentro de tu tarjeta del reto, tus duelos y tus ligas.</li>
<li><b>Tu amigo juega su primer reto</b> y se lleva un cofre Rayo y una pieza exclusiva.</li>
<li><b>Cuando juegue 3 retos del día</b> en sus primeras dos semanas, se conecta: tú ganas un cofre Rayo y él, 150 ≈.</li></ol>
${pending.length||on.length?`<h3 class="league-subtitle">Tus invitados</h3><ul class="circuit-friends">${[...on,...pending].map(friendRow).join('')}</ul>`:''}
${current}
<details class="league-rules"><summary>Reglas</summary><ul>
<li>Solo cuentan amigos <b>nuevos</b>: quien ya jugaba no puede entrar por tu enlace.</li>
<li>Un amigo se conecta al jugar el reto del día, ese mismo día, en <b>3 días distintos</b> dentro de sus primeros 14. El archivo no cuenta.</li>
<li>Las ${state.rules.chests} primeras conexiones dan un <b>cofre Rayo</b> cada una; desde la 11.ª, 50 ≈ (hasta 20 al mes).</li>
<li>Escalones: camiseta exclusiva con 1 amigo, cofre Tormenta con 3, sudadera Bobina de Tesla con 5 y universitaria Jaula de Faraday con 10.</li>
<li>Durante ${state.rules.current} días, cada día que jugáis los dos el reto, <b>+${state.rules.currentCharge} de batería</b> para cada uno.</li></ul></details>`;
  }
  async function share(){
    const code=await loadCode();
    if(!code){showToast('No se ha podido preparar tu enlace. Inténtalo de nuevo.');return}
    const url=link(location.origin+location.pathname),text='Juega conmigo a Faraday.gg: tres estimaciones al día. Si entras con mi enlace, los dos ganamos un cofre.';
    try{if(navigator.share){await navigator.share({title:'Faraday.gg',text,url});return}await navigator.clipboard.writeText(`${text}\n${url}`);showToast('Enlace copiado. Pégalo en tu grupo de WhatsApp.')}
    catch(error){if(error?.name!=='AbortError')showToast('No se pudo compartir ahora mismo.')}
  }
  function open(){
    shell.hidden=false;document.body.classList.add('modal-open');
    if(typeof toggleMenu==='function')toggleMenu(false);
    $('#circuit-close').focus();
  }
  function close(){
    shell.hidden=true;seq++;
    if($('#game-shell').hidden&&$('#duel-shell').hidden&&$('#league-shell').hidden&&$('#profile-shell').hidden)document.body.classList.remove('modal-open');
  }
  async function show(){
    if(!$('#profile-shell').hidden)$('#profile-close').click();
    open();render();const token=++seq;
    await loadCode();const result=await sync();if(shell.hidden||token!==seq)return;
    if(!result){content.innerHTML=`<p class="duel-kicker">Circuito de amigos</p><h2 id="circuit-title">No se ha podido cargar tu Circuito.</h2><p class="duel-note">El reto diario sigue funcionando. Vuelve a intentarlo más tarde.</p><button class="game-secondary" type="button" data-circuit="retry">Reintentar</button>`;return}
    render();
  }

  shell.addEventListener('click',event=>{
    const action=event.target.closest('[data-circuit]')?.dataset.circuit;if(!action||busy)return;
    if(action==='share')share();
    if(action==='retry')show();
    if(action==='play'){close();if(typeof currentDay!=='undefined'&&currentDay)openDay(currentDay)}
  });
  $('#circuit-close').addEventListener('click',close);
  document.addEventListener('click',event=>{if(event.target.closest('[data-open-circuit]'))show()});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!shell.hidden){event.stopImmediatePropagation();close()}},true);
  document.addEventListener('faraday:look',()=>{if(myCode())loadCode()});
  // Al terminar el reto de hoy: tras guardar las respuestas, se cobra lo que haya y, si te invitaron, se enseña el
  // resultado de quien te invitó (solo ahora que ya has jugado).
  document.addEventListener('faraday:day',({detail})=>{
    if(!detail.today)return;
    setTimeout(async()=>{
      const result=await sync(),today=result?.sponsor?.today;if(!today||today.theirs==null)return;
      const verdict=today.yours<today.theirs?'¡Le ganas!':today.yours===today.theirs?'¡Empate!':'Mañana más.';
      setTimeout(()=>showToast(`${named(result.sponsor.name)||'Tu amigo'} hizo ${times(today.theirs)} hoy; tú, ${times(today.yours)}. ${verdict}`),3600);
    },2500);
  });

  window.Circuito={link,open:show};
  // Al cargar: tu código (para los enlaces), la invitación pendiente y los premios que hayan llegado mientras tanto.
  (async()=>{await loadCode();await accept();await sync()})();
})();

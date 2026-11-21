// Salón: lo que se ve al sentarse a una mesa. Aquí solo hay dibujo (la crupier, la rueda, el tapete, las cartas
// y la mesa de póker); las apuestas y el monedero los lleva casino.js y el póker entre amigos casino-friends.js.
const INK='#1b1f27',PAPER='#fffdf7',CORAL='#ff6548',YELLOW='#ffdb70';
const escape=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const int=n=>new Intl.NumberFormat('es-ES',{maximumFractionDigits:0,useGrouping:'always'}).format(n);

// La crupier, de cintura para arriba: la mesa le tapa el resto. «say» es lo que canta.
export function dealer(say=''){
  return `<figure class="dealer">
    <svg viewBox="0 0 200 262" role="img" aria-label="La crupier" xmlns="http://www.w3.org/2000/svg">
      <g stroke="${INK}" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round">
        <path fill="#6b2f2a" d="M100 14c-34 0-50 24-48 56 1 22-10 44-8 70 1 16 6 28 14 36 12-6 22-8 42-8s30 2 42 8c8-8 13-20 14-36 2-26-9-48-8-70 2-32-14-56-48-56Z"/>
        <path fill="#f3c7a4" d="M91 92h18v15c11 4 23 6 31 13 5 9 1 20-5 25H65c-6-5-10-16-5-25 8-7 20-9 31-13Z"/>
        <path class="dealer-dress" fill="#d83a3f" d="M66 143c-2-19 23-22 34-3 11-19 36-16 34 3 2 17-9 30-13 44 2 18 24 28 24 54 0 8-3 15-6 21H61c-3-6-6-13-6-21 0-26 22-36 24-54-4-14-15-27-13-44Z"/>
        <path fill="none" stroke="#f9b3a3" stroke-width="2" d="M66 143c-2-19 23-22 34-3 11-19 36-16 34 3"/>
        <path fill="none" stroke="#a82432" stroke-width="2" opacity=".75" d="M71 156c6 11 22 11 28 0M129 156c-6 11-22 11-28 0M79 188c13 5 29 5 42 0"/>
        <path fill="none" stroke="#d99a78" stroke-width="1.8" d="M100 127v13"/>
        <path fill="none" stroke-width="15" d="M62 126Q38 152 44 182Q50 204 66 214M138 126Q162 152 156 182Q150 204 134 214"/>
        <path fill="none" stroke="#f3c7a4" stroke-width="10.600" d="M62 126Q38 152 44 182Q50 204 66 214M138 126Q162 152 156 182Q150 204 134 214"/>
        <path fill="#f3c7a4" stroke="none" d="M58 121l12-2 3 14-9 6ZM142 121l-12-2-3 14 9 6Z"/>
        <path fill="#f3c7a4" d="M100 25c20 0 30 15 29 37-1 21-13 38-29 38S72 83 71 62c-1-22 9-37 29-37Z"/>
        <path fill="#6b2f2a" d="M70 66C60 30 90 12 114 20c16 5 22 22 17 46-4-16-13-27-31-31-8 14-18 24-30 31Z"/>
        <rect x="90" y="101" width="20" height="5" rx="2" fill="${INK}"/>
        <path fill="${YELLOW}" d="M100 101l5 5-5 6-5-6Z"/>
        <circle cx="71.500" cy="80" r="3.200" fill="${YELLOW}"/><circle cx="128.500" cy="80" r="3.200" fill="${YELLOW}"/>
      </g>
      <g class="dealer-eyes">
        <ellipse cx="88" cy="63" rx="6" ry="4" fill="${PAPER}"/><ellipse cx="112" cy="63" rx="6" ry="4" fill="${PAPER}"/>
        <circle cx="88.500" cy="63" r="3.300" fill="#3d7a63"/><circle cx="111.500" cy="63" r="3.300" fill="#3d7a63"/>
        <circle cx="88.500" cy="63" r="1.500" fill="${INK}"/><circle cx="111.500" cy="63" r="1.500" fill="${INK}"/>
        <circle cx="89.700" cy="61.800" r=".9" fill="${PAPER}"/><circle cx="112.700" cy="61.800" r=".9" fill="${PAPER}"/>
        <path fill="none" stroke="${INK}" stroke-width="2.300" stroke-linecap="round" d="M80 60.500l2.500 1.500q5.500-5 12 0M120 60.500l-2.500 1.500q-5.500-5-12 0"/>
      </g>
      <path fill="none" stroke="#4a201d" stroke-width="2" stroke-linecap="round" d="M80 54q7-4.500 15-2M120 54q-7-4.500-15-2"/>
      <path fill="none" stroke="#c98a69" stroke-width="1.600" stroke-linecap="round" d="M99 72q1 4 4 3.500"/>
      <ellipse cx="80" cy="74" rx="6" ry="3.500" fill="${CORAL}" opacity=".3"/><ellipse cx="120" cy="74" rx="6" ry="3.500" fill="${CORAL}" opacity=".3"/>
      <path fill="#cf2f3c" stroke="#8f1c2a" stroke-width="1" stroke-linejoin="round" d="M92 83q4-3.500 8-1.500 4-2 8 1.500-3 6.500-8 6.500t-8-6.500Z"/>
      <path fill="none" stroke="#8f1c2a" stroke-width="1" stroke-linecap="round" d="M92 83q8 2.500 16 0"/>
    </svg>
    <figcaption class="dealer-say" data-dealer-say aria-live="polite">${escape(say)}</figcaption>
  </figure>`;
}

// Cartas. card = {r, s}; null o sin carta = boca abajo.
const RANKS={11:'J',12:'Q',13:'K',14:'A'},SUITS=['♠','♥','♦','♣'];
export const cardName=card=>`${RANKS[card.r]||card.r}${SUITS[card.s]}`;
export const cardHtml=(card,extra='')=>card
  ?`<span class="pc${card.s===1||card.s===2?' is-red':''}${extra}" role="img" aria-label="${cardName(card)}"><b>${RANKS[card.r]||card.r}</b><i>${SUITS[card.s]}</i></span>`
  :`<span class="pc is-back${extra}" aria-hidden="true"></span>`;

// El tapete de la ruleta: una casilla por apuesta de R.SPOTS, colocada con sus coordenadas (casino.css las pone
// en horizontal o, en pantallas estrechas, en vertical).
export function rouletteLayout(R){
  return Object.entries(R.SPOTS).map(([id,{name,numbers,at}])=>{
    const cell=at.w!==undefined,tone=id[0]==='n'?` is-${R.color(numbers[0])}`:id==='red'||id==='black'?` is-${id}`:'';
    const place=cell?at:{x:at.x-.24,y:at.y-.24,w:.48,h:.48};
    return `<button type="button" class="rt-spot ${cell?'is-cell':'is-point'}${tone}" data-spot="${id}" style="--x:${place.x};--y:${place.y};--w:${place.w};--h:${place.h}" ${cell?'':`aria-label="${name}" title="${name}"`}>${cell?`<span>${name}</span>`:""}</button>`;
  }).join('');
}

// La rueda: gira siempre despacio y, al lanzar, la bola corre en sentido contrario por el borde, pierde velocidad
// y cae en la casilla del número que ha salido.
export function createWheel(canvas,R,reduced){
  const step=Math.PI*2/37,SIZE=640,M=SIZE/2,SPEED=.55;
  const face=document.createElement('canvas'),rim=document.createElement('canvas');
  face.width=face.height=rim.width=rim.height=SIZE;
  {
    const c=rim.getContext('2d');
    c.beginPath();c.arc(M,M,M-4,0,7);c.fillStyle='#5b3423';c.fill();c.lineWidth=6;c.strokeStyle=INK;c.stroke();
    c.beginPath();c.arc(M,M,M-22,0,7);c.fillStyle='#8a5a3c';c.fill();
    const track=c.createRadialGradient(M,M,M*.78,M,M,M-22);track.addColorStop(0,'#3a2418');track.addColorStop(1,'#7a4b33');
    c.beginPath();c.arc(M,M,M-34,0,7);c.fillStyle=track;c.fill();c.lineWidth=3;c.strokeStyle=INK;c.stroke();
  }
  {
    const c=face.getContext('2d'),outer=M*.8,inner=M*.6,floor=M*.44;
    R.WHEEL.forEach((n,i)=>{
      const from=i*step-step/2-Math.PI/2,fill={green:'#2f9d63',red:'#d8402f',black:INK}[R.color(n)];
      c.beginPath();c.arc(M,M,outer,from,from+step);c.arc(M,M,floor,from+step,from,true);c.closePath();c.fillStyle=fill;c.fill();
      c.lineWidth=2;c.strokeStyle='#e9c46a';c.stroke();
      c.save();c.translate(M,M);c.rotate(i*step);c.fillStyle=PAPER;c.font='700 25px "Space Grotesk",Arial,sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillText(n,0,-(outer+inner)/2);c.restore();
    });
    c.beginPath();c.arc(M,M,inner,0,7);c.lineWidth=3;c.strokeStyle='#e9c46a';c.stroke();
    c.beginPath();c.arc(M,M,outer,0,7);c.lineWidth=5;c.strokeStyle='#e9c46a';c.stroke();
    const cone=c.createRadialGradient(M-30,M-30,10,M,M,floor);cone.addColorStop(0,'#b98358');cone.addColorStop(1,'#6b4029');
    c.beginPath();c.arc(M,M,floor,0,7);c.fillStyle=cone;c.fill();c.lineWidth=4;c.strokeStyle=INK;c.stroke();
    c.strokeStyle='#e9c46a';c.lineWidth=9;c.lineCap='round';
    for(let k=0;k<4;k++){c.beginPath();c.moveTo(M,M);c.lineTo(M+Math.cos(k*Math.PI/2)*floor*.72,M+Math.sin(k*Math.PI/2)*floor*.72);c.stroke()}
    c.beginPath();c.arc(M,M,floor*.3,0,7);c.fillStyle=YELLOW;c.fill();c.lineWidth=4;c.strokeStyle=INK;c.stroke();
  }
  const context=canvas.getContext('2d'),TRACK=M-52,POCKET=M*.52;
  let angle=0,frame=0,last=0,running=false,ball=null,rest=null;
  function draw(){
    const side=Math.round(canvas.clientWidth*Math.min(window.devicePixelRatio||1,2));
    if(!side)return;
    if(canvas.width!==side)canvas.width=canvas.height=side;
    const k=side/SIZE;
    context.setTransform(k,0,0,k,0,0);context.clearRect(0,0,SIZE,SIZE);
    context.drawImage(rim,0,0);
    context.save();context.translate(M,M);context.rotate(angle);context.drawImage(face,-M,-M);context.restore();
    let at=null,radius=POCKET;
    if(ball){
      const u=Math.min(1,(performance.now()-ball.from)/ball.time),left=1-u;
      at=angle+ball.index*step-Math.PI/2-ball.turns*left*left*left;
      // La bola aguanta en el borde, baja hacia los números y da un par de botes antes de quedarse.
      const fall=Math.min(1,Math.max(0,(u-.55)/.33)),eased=fall*fall*(3-2*fall),settle=Math.max(0,(u-.88)/.12);
      radius=TRACK+(POCKET-TRACK)*eased+(u>.88&&u<1?Math.sin(settle*Math.PI*2)*9*(1-settle):0);
      if(u>=1){rest=ball.index;const done=ball.done;ball=null;done()}
    }else if(rest!==null)at=angle+rest*step-Math.PI/2;
    if(at!==null){
      const x=M+Math.cos(at)*radius,y=M+Math.sin(at)*radius;
      context.beginPath();context.arc(x+2,y+3,11,0,7);context.fillStyle='#0006';context.fill();
      context.beginPath();context.arc(x,y,10,0,7);context.fillStyle=PAPER;context.fill();context.lineWidth=2;context.strokeStyle=INK;context.stroke();
      context.beginPath();context.arc(x-3,y-3,3,0,7);context.fillStyle='#fff';context.fill();
    }
  }
  function tick(now){
    if(!running)return;
    frame=requestAnimationFrame(tick);
    angle=(angle+Math.min(.05,(now-last)/1000)*SPEED)%(Math.PI*2);last=now;
    draw();
  }
  return {
    start(){if(running)return;running=true;last=performance.now();if(reduced)draw();else frame=requestAnimationFrame(tick)},
    stop(){running=false;cancelAnimationFrame(frame);if(ball){const done=ball.done;ball=null;done()}},
    // Lanza la bola hacia el número n. La promesa se cumple cuando se queda quieta.
    spin(n){
      const index=R.WHEEL.indexOf(n);
      if(reduced||!running){rest=index;draw();return Promise.resolve()}
      rest=null;
      return new Promise(done=>{ball={index,from:performance.now(),time:6200,turns:Math.PI*2*5.5,done}});
    }
  };
}

const coin='<span class="casino-coin" aria-hidden="true">≈</span>';
// Mesa de póker. seats: los jugadores en el orden de la mesa empezando por quien mira (abajo, en el centro) y
// siguiendo hacia su izquierda. Cada uno: {name, look, stack, bet, cards, folded, allin, button, turn, note, won, hand}.
// cards: lista = boca arriba, null = boca abajo, undefined = sin cartas. center: aviso sobre el tapete (HTML).
export function pokerTable({seats,board=[],pot=0,say='',center='',mine=''}){
  const places=[[],['tr'],['l','r'],['l','tl','r'],['l','tl','tr','r']][Math.min(4,seats.length-1)]||[];
  const avatar=look=>`<span class="pk-avatar" aria-hidden="true">${window.Avatar?window.Avatar.render(look||{},{bust:true}):''}</span>`;
  const seat=(player,index)=>{
    const place=index?places[index-1]:'me';
    if(!place)return '';
    const cards=player.cards===undefined?'':`<span class="pk-cards">${(player.cards||[null,null]).map(card=>cardHtml(card)).join('')}</span>`;
    const state=player.won?`+${int(player.won)}`:player.folded&&player.cards!==undefined?'Se retira':player.allin?'Lo apuesta todo':player.note||'';
    return `<div class="pk-seat at-${place}${player.turn?' is-turn':''}${player.folded&&player.cards!==undefined?' is-folded':''}${player.won?' is-winner':''}${index?'':' is-me'}">
      ${cards}
      <div class="pk-plate">${avatar(player.look)}<div><b>${escape(player.name)}${player.button?' <abbr class="pk-button" title="Reparte">D</abbr>':''}</b>
        <span>${player.stack===undefined?'':`${int(player.stack)} ${coin}`}</span></div></div>
      ${state||player.hand?`<p class="pk-note">${escape(state)}${state&&player.hand?' · ':''}${escape(player.hand||'')}</p>`:''}
      ${player.bet?`<span class="pk-bet"><i class="rt-chip"></i>${int(player.bet)}</span>`:''}
    </div>`;
  };
  return `<div class="pk">
    <div class="pk-dealer">${dealer(say)}</div>
    <div class="pk-wrap">
      <div class="pk-felt">
        <div class="pk-board" aria-label="Cartas comunes">${[0,1,2,3,4].map(i=>board[i]?cardHtml(board[i]):'<span class="pc is-empty" aria-hidden="true"></span>').join('')}</div>
        ${pot?`<p class="pk-pot">Bote <b>${int(pot)} ${coin}</b></p>`:''}
        ${center?`<div class="pk-center">${center}</div>`:''}
      </div>
      ${seats.map(seat).join('')}
    </div>
    ${mine?`<p class="pk-mine" aria-live="polite">${mine}</p>`:''}
  </div>`;
}
// Las jugadas de quien tiene el turno. rules = HOLDEM.legal(); raise = cantidad elegida para subir.
export function pokerActions(rules,raise,big){
  const to=Math.min(rules.maxTo,Math.max(rules.minTo,raise||rules.minTo));
  return `<div class="stage-actions pk-actions">
    <button type="button" class="casino-option" data-poker="fold">Retirarse</button>
    <button type="button" class="casino-play" data-poker="${rules.canCheck?'check':'call'}">${rules.canCheck?'Pasar':`Igualar ${int(rules.toCall)}`}</button>
    ${rules.canRaise?`<label class="pk-raise"><span class="sr-only">Cantidad a la que subes</span>
      <input type="range" data-poker-raise min="${rules.minTo}" max="${rules.maxTo}" step="1" value="${to}"></label>
    <button type="button" class="casino-play is-raise" data-poker="raise">${rules.minTo===rules.maxTo?'Todo':'Subir a'} <b data-poker-to>${int(to)}</b></button>`:''}
  </div>`;
}

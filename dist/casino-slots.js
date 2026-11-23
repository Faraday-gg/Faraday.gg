// Salón: la tragaperras «Tormenta» en pantalla. Aquí están el dibujo de los símbolos, la rejilla que cae, los
// premios que estallan, las esferas, las tiradas gratis y el sonido. Qué sale y cuánto paga lo decide STORM en
// casino-rules.js: aquí solo se reproduce una jugada ya resuelta. El monedero lo lleva casino.js.
const INK='#1b1f27';
const int=n=>new Intl.NumberFormat('es-ES',{maximumFractionDigits:0,useGrouping:'always'}).format(n);
const times=n=>String(n).replace('.',',');

// ---------- Símbolos ----------
const TONES=[['#8fd0ff','#1f58c9'],['#9af2b8','#178a4e'],['#dcb4ff','#7435c9'],['#ffe09a','#e0851a'],['#ffa494','#c9242f'],
  ['#ff9a85','#c9242f'],['#fffbd0','#ffc93a'],['#f3ad68','#b5601f'],['#fff3a8','#e6a92a'],['#ffec8a','#f09a1a']];
const ring=(count,radius,cy=52,turn=0)=>Array.from({length:count},(_,i)=>{const a=turn+i/count*Math.PI*2;return [50+Math.cos(a)*radius,cy+Math.sin(a)*radius]});
const points=list=>list.map(([x,y])=>`${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
const shrink=(list,k,cx=50,cy=52)=>list.map(([x,y])=>[cx+(x-cx)*k,cy+(y-cy)*k]);
const line=`stroke="${INK}" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"`;
// Una gema: la forma, una faceta más clara dentro y un brillo.
const gem=(i,shape,cy=52)=>`<polygon points="${points(shape)}" fill="url(#st-g${i})" ${line}/>
  <polygon points="${points(shrink(shape,.56,50,cy))}" fill="#fff" opacity=".3"/>
  <polygon points="${points(shrink(shape,.56,50,cy))}" fill="none" stroke="#fff" stroke-width="1.5" opacity=".6"/>
  <path d="M${shape[0][0]*.5+25} ${cy-25}l14-7" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity=".85"/>`;
const ART=[
  gem(0,ring(8,41,52,Math.PI/8)),
  gem(1,[[24,22],[76,22],[90,36],[90,68],[76,82],[24,82],[10,68],[10,36]]),
  gem(2,[[10,22],[90,22],[50,90]],44),
  gem(3,ring(6,43,52,Math.PI/2)),
  gem(4,[[50,8],[90,42],[50,94],[10,42]],48),
  `<path d="M20 18h22v36a8 8 0 0 0 16 0V18h22v36a30 30 0 0 1-60 0Z" fill="url(#st-g5)" ${line}/>
   <path d="M20 18h22v15H20ZM58 18h22v15H58Z" fill="#eef1f6" ${line}/>
   <path d="M28 44v12a22 22 0 0 0 8 16" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity=".6"/>
   <path d="M10 8l5 8M90 8l-5 8M50 2v9" stroke="#ffdb70" stroke-width="4" stroke-linecap="round"/>`,
  `<path d="M50 8a29 29 0 0 0-18 52c4 3 6 7 6 12h24c0-5 2-9 6-12A29 29 0 0 0 50 8Z" fill="url(#st-g6)" ${line}/>
   <rect x="37" y="72" width="26" height="18" rx="5" fill="#9aa3b5" ${line}/><path d="M39 81h22" stroke="${INK}" stroke-width="3"/>
   <path d="M41 52l5-13 5 13 5-13 4 13" fill="none" stroke="#c9781a" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>
   <path d="M32 28q6-11 17-12" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity=".9"/>`,
  `<rect x="26" y="80" width="48" height="12" rx="4" fill="#3a2418" ${line}/>
   <rect x="39" y="40" width="22" height="42" fill="url(#st-g7)" ${line}/>
   <path d="M39 49h22M39 57h22M39 65h22M39 73h22" stroke="#7a3d14" stroke-width="3"/>
   <ellipse cx="50" cy="30" rx="27" ry="14" fill="#cfd6e4" ${line}/><ellipse cx="46" cy="26" rx="14" ry="5" fill="#fff" opacity=".75"/>
   <path d="M20 22l-11-7h7l-7-9M80 22l11-7h-7l7-9" fill="none" stroke="#8fd8ff" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>`,
  `<path d="M15 74 9 28l23 19 18-31 18 31 23-19-6 46Z" fill="url(#st-g8)" ${line}/>
   <rect x="13" y="72" width="74" height="16" rx="5" fill="#d9912a" ${line}/>
   <circle cx="50" cy="56" r="7.500" fill="#e2463a" stroke="${INK}" stroke-width="3"/><circle cx="29" cy="61" r="5" fill="#3b82e0" stroke="${INK}" stroke-width="3"/><circle cx="71" cy="61" r="5" fill="#2fae6a" stroke="${INK}" stroke-width="3"/>
   <path d="M20 40l8 7" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity=".8"/>`,
  `<polygon points="${points(ring(24,47,50).map(([x,y],i)=>i%2?[50+(x-50)*.72,50+(y-50)*.72]:[x,y]))}" fill="#fff6b8" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>
   <circle cx="50" cy="50" r="28" fill="url(#st-g9)" ${line}/><circle cx="50" cy="50" r="21" fill="none" stroke="#fff" stroke-width="2" opacity=".7"/>
   <path d="M57 28 39 54h11l-6 20 19-28H51Z" fill="#fff" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>`
];
const defs=`<svg class="st-defs" width="0" height="0" aria-hidden="true"><defs>
  ${TONES.map(([a,b],i)=>`<linearGradient id="st-g${i}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>`).join('')}
  ${ART.map((art,i)=>`<symbol id="st-s${i}" viewBox="0 0 100 100">${art}</symbol>`).join('')}
</defs></svg>`;
const icon=code=>`<svg viewBox="0 0 100 100" aria-hidden="true"><use href="#st-s${code}"/></svg>`;
const orbTone=value=>value>=50?'red':value>=10?'violet':value>=5?'blue':'green';

// Lo que va dentro de la pantalla del juego (casino.js lo mete en su marco, con la barra de fichas debajo).
export function slotBody(R){
  const S=R.STORM;
  return `<div class="st" id="st">${defs}
    <div class="st-top">
      <p class="st-logo"><span aria-hidden="true">≈</span> Tormenta <span aria-hidden="true">≈</span></p>
      <p class="st-meter" id="st-free" hidden>Gratis <b></b></p>
      <p class="st-meter is-mult" id="st-mult" hidden>Multiplicador <b></b></p>
    </div>
    <div class="st-frame" id="st-frame">
      <div class="st-grid" id="st-grid" role="img" aria-label="Rejilla de la tragaperras"></div>
      <div class="st-fx" id="st-fx" aria-hidden="true"></div>
      <div class="st-banner" id="st-banner" hidden></div>
    </div>
    <p class="st-win" id="st-win" aria-hidden="true">Buena suerte</p>
    <details class="st-pays"><summary>Premios y reglas</summary>
      <p>Paga cualquier símbolo que salga <b>${S.NEED} veces o más</b>, esté donde esté. Los premiados desaparecen, caen otros y puede volver a pagar. Las <b>esferas</b> multiplican el premio de la tirada. Con <b>4 chispas</b> ganas ${S.FREE} tiradas gratis, donde el multiplicador se acumula. Premio máximo: ${S.MAX} veces la apuesta.</p>
      <table><thead><tr><th>Símbolo</th><th>8–9</th><th>10–11</th><th>12 o más</th></tr></thead><tbody>
        ${S.SYMBOLS.map((symbol,i)=>`<tr><th>${icon(i)}<span>${symbol.name}</span></th>${symbol.pays.map(pay=>`<td>×${times(pay)}</td>`).join('')}</tr>`).reverse().join('')}
        <tr><th>${icon(S.SCATTER)}<span>Chispa</span></th><td colspan="3">4, 5 o 6: ×${Object.values(S.SCATTER_PAYS).join(', ×')} y ${S.FREE} tiradas gratis</td></tr>
      </tbody></table>
    </details>
  </div>`;
}

// ---------- Sonido (Sound, de sound.js: tonos y ruido generados en el navegador) ----------
const SCALE=[523.25,587.33,659.25,783.99,880,1046.5,1174.66,1318.51,1567.98,1760,2093];
function sounds(muted){
  const S=window.Sound,play=fn=>(...args)=>{if(S&&!muted())try{fn(...args)}catch{}};
  const note=i=>SCALE[Math.max(0,Math.min(SCALE.length-1,i))];
  return {
    spin:play(()=>{S.noise(0,.45,{gain:.05,from:500,to:2600,q:.7});S.tone(220,0,.3,{type:'triangle',gain:.03,to:440})}),
    land:play(x=>{S.tone(120-x*5,0,.13,{type:'triangle',gain:.1,to:55});S.noise(0,.06,{gain:.035,from:1400})}),
    scatter:play(n=>{S.bell(note(4+n*2),0,1.3,{gain:.08,wet:.45});S.noise(0,.5,{gain:.03,from:5000,to:9000,wet:.3})}),
    tense:play(()=>S.tone(180,0,.5,{type:'sawtooth',gain:.03,to:520})),
    win:play(step=>[0,2,4].forEach((k,j)=>S.bell(note(step+k),j*.075,.7,{gain:.055,wet:.25}))),
    pop:play(()=>{S.noise(0,.16,{gain:.08,from:3000,to:600});S.tone(360,0,.14,{type:'square',gain:.02,to:980})}),
    tick:play(i=>S.tone(1100+i*22,0,.04,{type:'square',gain:.016})),
    zap:play(value=>{S.tone(160,0,.32,{type:'sawtooth',gain:.05,to:1200+Math.min(1500,value*30)});S.noise(0,.28,{gain:.05,from:2500,to:7000})}),
    thunder:play(()=>{S.noise(0,1.8,{gain:.14,from:420,to:50,filter:'lowpass',attack:.03,wet:.5});S.noise(0,.12,{gain:.08,from:6000,to:2000})}),
    nice:play(()=>[0,2,4,7].forEach((k,j)=>S.bell(note(k),j*.09,.9,{gain:.06,wet:.3}))),
    bonus:play(()=>{[0,2,4,5,7,9].forEach((k,j)=>S.bell(note(k),j*.11,1.2,{gain:.07,wet:.4}));S.tone(130.8,0,1.4,{type:'triangle',gain:.06})}),
    big:play(tier=>{
      for(let bar=0;bar<2+tier;bar++)[0,2,4,7,4,7,9,10].forEach((k,j)=>S.bell(note(k),bar*.72+j*.09,.8,{gain:.06,wet:.35}));
      S.tone(130.8,0,1.6+tier*.7,{type:'triangle',gain:.07});S.tone(196,0,1.6+tier*.7,{type:'triangle',gain:.05});
    })
  };
}

// ---------- La máquina ----------
// root = el elemento .st ya puesto en la página. grid = rejilla que enseñar al abrir (la última que salió).
export function mountSlots(root,{R,reduced,grid:shown}){
  const S=R.STORM,$=id=>root.querySelector('#'+id);
  const grid=$('st-grid'),fx=$('st-fx'),frame=$('st-frame'),banner=$('st-banner'),meter=$('st-win'),freeEl=$('st-free'),multEl=$('st-mult');
  let cells=[],fast=false,skip=false,alive=true,meterValue=0;
  const still=()=>skip||reduced||!alive;
  const sfx=sounds(still);
  const pause=ms=>still()?Promise.resolve():new Promise(done=>setTimeout(done,fast?ms*.5:ms));
  if(reduced)root.classList.add('is-skip');

  function make(code,x,y){
    const el=document.createElement('i'),orb=code>=S.ORB;
    el.className=`st-cell${orb?' is-orb is-'+orbTone(code-S.ORB):code===S.SCATTER?' is-scatter':''}`;
    el.style.setProperty('--x',x);el.style.setProperty('--y',y);
    el.innerHTML=orb?`<b>×${code-S.ORB}</b>`:icon(code);
    el.code=code;
    return el;
  }
  const move=(el,y,wait=0,time=.42)=>{el.style.setProperty('--w',wait+'s');el.style.setProperty('--d',(fast?time*.6:time)+'s');el.style.setProperty('--y',y)};
  function show(data){
    grid.replaceChildren();
    cells=data.map((column,x)=>column.map((code,y)=>{const el=make(code,x,y);grid.append(el);return el}));
  }
  const random=()=>Array.from({length:S.COLS},()=>Array.from({length:S.ROWS},()=>Math.floor(Math.random()*S.SYMBOLS.length)));
  show(shown||random());

  // Centro de una casilla, en tantos por ciento de la rejilla.
  const centre=(x,y)=>[(x+.5)/S.COLS*100,(y+.5)/S.ROWS*100];
  function burst(x,y,tone,count=6){
    if(still())return;
    const [left,top]=centre(x,y);
    for(let i=0;i<count;i++){
      const bit=document.createElement('b'),a=Math.random()*Math.PI*2,far=30+Math.random()*60;
      bit.className='st-bit';bit.style.cssText=`left:${left}%;top:${top}%;--dx:${Math.cos(a)*far}px;--dy:${Math.sin(a)*far}px;background:${tone}`;
      fx.append(bit);setTimeout(()=>bit.remove(),650);
    }
  }
  function float(text,x,y){
    if(still())return;
    const [left,top]=centre(x,y),label=document.createElement('b');
    label.className='st-float';label.textContent=text;label.style.cssText=`left:${Math.max(8,Math.min(92,left))}%;top:${top}%`;
    fx.append(label);setTimeout(()=>label.remove(),1100);
  }
  function flash(kind='is-flash'){
    if(still())return;
    frame.classList.remove(kind);void frame.offsetWidth;frame.classList.add(kind);
  }
  // El marcador de premio sube contando, con un tic por paso.
  async function count(to,label='Premio'){
    const from=meterValue;meterValue=to;
    const write=value=>{meter.innerHTML=`${label} <b>${int(Math.round(value))} ≈</b>`};
    if(still()||Math.round(to)===Math.round(from)){write(to);return}
    const steps=Math.min(26,Math.max(6,Math.round(to-from)));
    meter.classList.add('is-up');
    for(let i=1;i<=steps;i++){write(from+(to-from)*i/steps);sfx.tick(i);await pause(34);if(still())break}
    write(to);meter.classList.remove('is-up');
  }
  async function announce(html,ms,kind=''){
    if(still())return;
    banner.className='st-banner '+kind;banner.innerHTML=html;banner.hidden=false;
    await pause(ms);
    banner.hidden=true;banner.innerHTML='';
  }

  // Caen los símbolos de una tirada nueva, columna a columna. Si ya hay chispas suficientes para que una más dé
  // las tiradas gratis, las columnas que faltan tardan más en caer.
  async function drop(data,need){
    sfx.spin();
    cells.forEach((column,x)=>column.forEach((el,y)=>{el.classList.add('is-out');move(el,y+S.ROWS+1,x*.035,.3)}));
    await pause(300);
    grid.replaceChildren();
    let wait=0,seen=0,tense=false;
    const waits=[];
    cells=data.map((column,x)=>{
      if(seen>=need-1&&x){wait+=.42;tense=true}
      waits.push(wait);
      const made=column.map((code,y)=>{const el=make(code,x,y-S.ROWS-1);grid.append(el);return el});
      seen+=column.filter(code=>code===S.SCATTER).length;
      wait+=.075;
      return made;
    });
    void grid.offsetWidth;
    let chimes=0;
    cells.forEach((column,x)=>{
      column.forEach((el,y)=>move(el,y,waits[x]+(S.ROWS-1-y)*.022,.4));
      if(still())return;
      const landed=(fast?.5:1)*(waits[x]*1000+330),sparks=data[x].filter(code=>code===S.SCATTER).length;
      setTimeout(()=>{sfx.land(x);if(sparks)sfx.scatter(chimes++);if(tense&&x<S.COLS-1&&waits[x+1]-waits[x]>.2)sfx.tense()},landed);
    });
    frame.classList.toggle('is-tense',tense);
    await pause(wait*1000+480);
    frame.classList.remove('is-tense');
  }
  // Un premio: brillan los símbolos, estallan, caen los de arriba y entran otros.
  async function tumble(step,index,bet,before){
    const gone=new Set(step.hit),first=new Map();
    for(const at of step.hit){
      const x=Math.floor(at/S.ROWS),y=at%S.ROWS,el=cells[x][y];
      el.classList.add('is-win');
      if(!first.has(el.code))first.set(el.code,[x,y]);
    }
    sfx.win(index);
    for(const won of step.wins){const [x,y]=first.get(won.symbol)||[2,2];float(`${won.count} × ${S.SYMBOLS[won.symbol].name}`,x,y)}
    const counting=count(before+step.pay*bet);
    await pause(680);
    sfx.pop();flash('is-shake');
    for(const at of step.hit){
      const x=Math.floor(at/S.ROWS),y=at%S.ROWS;
      cells[x][y].classList.add('is-pop');burst(x,y,TONES[cells[x][y].code][0]);
    }
    await pause(240);
    cells=cells.map((column,x)=>{
      const kept=column.filter((el,y)=>{if(!gone.has(x*S.ROWS+y))return true;el.remove();return false}),fresh=S.ROWS-kept.length;
      const made=step.grid[x].slice(0,fresh).map((code,i)=>{const el=make(code,x,i-fresh-1);grid.append(el);return el});
      return [...made,...kept];
    });
    void grid.offsetWidth;
    cells.forEach(column=>column.forEach((el,y)=>move(el,y,0,.4)));
    if(!still())setTimeout(()=>sfx.land(3),fast?150:300);
    await pause(470);
    await counting;
  }
  const setMult=value=>{multEl.querySelector('b').textContent='×'+int(value);multEl.classList.remove('is-bump');void multEl.offsetWidth;multEl.classList.add('is-bump')};
  // Una tirada entera. «before» son los faradios ya ganados en la jugada. Devuelve lo que suma esta tirada.
  async function run(spin,bet,before){
    await drop(spin.start,spin.free?3:4);
    let won=before;
    for(const [index,step] of spin.steps.entries()){await tumble(step,index,bet,won);won+=step.pay*bet}
    if(spin.base>0&&spin.orbs.length){
      // Las esferas descargan una a una en el multiplicador y el premio de la tirada se multiplica.
      let total=spin.free?spin.carry-spin.orbs.reduce((a,b)=>a+b,0):0;
      multEl.hidden=false;setMult(total);
      await pause(260);
      for(const [x,column] of cells.entries())for(const [y,el] of column.entries()){
        if(el.code<S.ORB)continue;
        total+=el.code-S.ORB;el.classList.add('is-zap');sfx.zap(el.code-S.ORB);burst(x,y,'#fff3a8',8);setMult(total);
        await pause(380);
      }
      flash();sfx.thunder();
      float(`×${int(spin.mult)}`,2.5,2);
      await count(before+spin.win*bet);
      await pause(420);
      if(!spin.free)multEl.hidden=true;
    }
    return spin.win*bet;
  }
  // Reproduce una jugada ya resuelta (STORM.play) con «bet» faradios apostados.
  async function play(round,bet){
    skip=false;if(!reduced)root.classList.remove('is-skip');
    meterValue=0;meter.textContent='';
    const [first,...free]=round.spins;
    let sum=await run(first,bet,0);
    if(first.award){
      for(const column of cells)for(const el of column)if(el.code===S.SCATTER)el.classList.add('is-win');
      sfx.bonus();flash();
      sum+=first.scatterPay*bet;
      await count(sum);
      await announce(`<small>¡${first.scatters} chispas!</small><b>${first.award} tiradas gratis</b><small>El multiplicador se acumula</small>`,2600,'is-bonus');
      root.classList.add('is-free');freeEl.hidden=multEl.hidden=false;setMult(0);
      let left=first.award;
      for(const spin of free){
        left--;freeEl.querySelector('b').textContent=left+1;
        sum+=await run(spin,bet,sum);
        if(spin.award){left+=spin.award;sfx.bonus();await announce(`<b>+${spin.award} tiradas</b>`,1300,'is-bonus')}
        await pause(260);
      }
      freeEl.querySelector('b').textContent=0;
      await announce(`<small>Tiradas gratis</small><b>${int(Math.round(sum))} ≈</b>`,2400,'is-bonus');
      root.classList.remove('is-free');freeEl.hidden=multEl.hidden=true;
    }
    // Lo que se cobra de verdad: el total de la jugada, ya con su tope.
    const paid=Math.round(bet*round.total),tier=round.total>=100?2:round.total>=25?1:round.total>=10?0:-1;
    if(tier>=0&&!still()){
      sfx.big(tier);flash();
      banner.className='st-banner is-big is-tier'+tier;
      banner.innerHTML=`<small>${['¡Buen premio!','¡Premio enorme!','¡Premio descomunal!'][tier]}</small><b id="st-big">0 ≈</b>${'<i class="st-coin"></i>'.repeat(26)}`;
      banner.querySelectorAll('.st-coin').forEach(coin=>{coin.style.cssText=`left:${Math.random()*100}%;animation-delay:${Math.random()*1.4}s;animation-duration:${1.2+Math.random()}s`});
      banner.hidden=false;
      const big=banner.querySelector('#st-big'),steps=40+tier*20;
      for(let i=1;i<=steps&&!still();i++){big.textContent=`${int(Math.round(paid*i/steps))} ≈`;if(i%2)sfx.tick(i);await pause(42)}
      big.textContent=`${int(paid)} ≈`;
      await pause(1500);
      banner.hidden=true;banner.innerHTML='';
    }else if(round.total>=1)sfx.nice();
    meterValue=paid;
    meter.innerHTML=paid?`Premio <b>${int(paid)} ≈</b>`:'Sin premio';
    banner.hidden=true;frame.classList.remove('is-tense');
    skip=false;
    return cells.map(column=>column.map(el=>el.code));
  }
  return {
    play,
    // Acaba ya la jugada en curso: se salta lo que queda de animación.
    hurry(){skip=true;root.classList.add('is-skip')},
    fast(on){fast=on},
    stop(){alive=false}
  };
}

// Faradios que vuelan hasta el saldo (decisión 0068). Al recoger un premio, salen monedas del botón, se abren en un
// pequeño estallido y viajan una a una, en curva y acelerando, hasta el contador de faradios. Cada moneda que llega
// suma su parte al número, hace saltar el contador y suena con un «tin» un poco más agudo que la anterior; al final,
// un acorde de caja registradora. Es lo que hacen los juegos de móvil al cobrar oro: el premio se ve llegar y se oye
// contar. Los sonidos son tonos y ruido de sound.js (sin archivos). Con «reducir movimiento», solo se actualiza el
// número con un salto y un tintineo.
(()=>{
  // Escala pentatónica (en semitonos): las notas suben sin chocar entre sí, por muchas monedas que lleguen seguidas.
  const STEPS=[0,2,4,7,9,12,14,16,19,21,24,26,28,31];
  const calm=()=>{try{return matchMedia('(prefers-reduced-motion: reduce)').matches}catch{return false}};
  let layer=null;
  function host(){
    if(layer?.isConnected)return layer;
    layer=document.createElement('div');layer.className='coin-fly-layer';layer.setAttribute('aria-hidden','true');
    document.body.append(layer);return layer;
  }
  const center=rect=>({x:rect.left+rect.width/2,y:rect.top+rect.height/2});
  // Sonidos. Salida: un «plop» y un brillo. Llegada: campanilla corta y un clic metálico. Final: acorde y destello.
  function popSound(){
    if(!window.Sound)return;
    Sound.noise(0,.16,{gain:.05,from:500,to:2600,q:1.4,attack:.005});
    Sound.tone(523,0,.12,{type:'triangle',gain:.05,to:1047});
  }
  function clinkSound(index){
    if(!window.Sound)return;
    const f=1047*2**(STEPS[index%STEPS.length]/12);
    Sound.bell(f,0,.32,{gain:.032,wet:.12});
    Sound.noise(0,.045,{gain:.03,from:7000,to:9500,q:2,filter:'bandpass',attack:.002});
  }
  function chimeSound(){
    if(!window.Sound)return;
    for(const [f,at] of [[1047,0],[1319,.05],[1568,.1],[2093,.15]])Sound.bell(f,at,.9,{gain:.035,wet:.3});
    Sound.noise(.05,.55,{gain:.022,from:6000,to:12000,q:.7,filter:'highpass',attack:.02,wet:.2});
  }
  function bump(pill,big=false){
    try{pill.animate([{transform:'scale(1)'},{transform:`scale(${big?1.2:1.1})`,boxShadow:'inset 0 0 0 1.5px var(--line),0 0 0 6px #ff5d3d33'},{transform:'scale(1)'}],{duration:big?320:140,easing:'ease-out'})}catch{}
  }
  // «+N» que sube junto al contador cuando termina el cobro.
  function plus(pill,amount){
    const rect=pill.getBoundingClientRect(),label=document.createElement('span');
    label.className='coin-fly-plus';label.textContent=`+${amount}`;
    label.style.left=`${rect.left+rect.width/2}px`;label.style.top=`${rect.bottom+4}px`;host().append(label);
    const done=()=>label.remove();
    try{label.animate([{opacity:0,transform:'translate(-50%,6px) scale(.8)'},{opacity:1,transform:'translate(-50%,0) scale(1.05)',offset:.25},{opacity:1,transform:'translate(-50%,-4px) scale(1)',offset:.7},{opacity:0,transform:'translate(-50%,-14px) scale(1)'}],{duration:1100,easing:'ease-out'}).onfinish=done}catch{done()}
  }
  // Puntos de una curva de Bézier cuadrática, para que la moneda no vaya en línea recta.
  function curve(a,c,b,steps=14){
    const points=[];
    for(let i=0;i<=steps;i++){const t=i/steps,u=1-t;points.push({x:u*u*a.x+2*u*t*c.x+t*t*b.x,y:u*u*a.y+2*u*t*c.y+t*t*b.y})}
    return points;
  }
  // from: rectángulo (o elemento) de donde salen. pill: el contador. start → end: saldo antes y después.
  // paint(n): pinta ese saldo en el contador. done(): se llama al terminar (para volver a pintar el saldo real).
  function fly({from,pill,start,end,paint,done=()=>{}}){
    const amount=end-start;
    if(!(amount>0)||!pill){done();return}
    const origin=from instanceof Element?from.getBoundingClientRect():from,target=pill.getBoundingClientRect();
    const visible=target.width>0&&origin&&origin.width>0;
    if(!visible||calm()){paint(end);bump(pill,true);clinkSound(4);setTimeout(chimeSound,90);done();return}
    const count=Math.min(14,Math.max(5,Math.round(Math.sqrt(amount)*2))),a=center(origin),coin=pill.querySelector('.coin');
    const b=center(coin?coin.getBoundingClientRect():target),layer=host();
    paint(start);popSound();
    let landed=0;
    for(let i=0;i<count;i++){
      const el=document.createElement('span');el.className='coin coin-fly';el.textContent='≈';layer.append(el);
      // Estallido: cada moneda sale en una dirección al azar, a 35–80 px del botón.
      const angle=Math.random()*Math.PI*2,reach=35+Math.random()*45,spread={x:a.x+Math.cos(angle)*reach,y:a.y+Math.sin(angle)*reach*.75};
      // Punto de control de la curva: por fuera de la recta, hacia el lado de donde salió, para que el abanico se cierre.
      const mid={x:(spread.x+b.x)/2+(spread.x-a.x)*1.6,y:Math.min(spread.y,b.y)-40-Math.random()*60};
      const path=curve(spread,mid,b),burst=280,wait=120+i*55,travel=520+Math.random()*120,total=burst+wait+travel;
      const at=t=>t/total;
      const frames=[
        {offset:0,transform:`translate(${a.x}px,${a.y}px) translate(-50%,-50%) scale(.2) rotate(0deg)`,opacity:0},
        {offset:at(burst*.6),transform:`translate(${spread.x}px,${spread.y}px) translate(-50%,-50%) scale(1.15) rotate(${(Math.random()-.5)*60}deg)`,opacity:1,easing:'ease-out'},
        {offset:at(burst+wait),transform:`translate(${spread.x}px,${spread.y+3}px) translate(-50%,-50%) scale(1) rotate(0deg)`,opacity:1,easing:'ease-in'}
      ];
      // El vuelo acelera hacia el contador (ease-in repartido a mano por los puntos de la curva).
      path.forEach((p,k)=>{if(!k)return;const t=k/(path.length-1),s=1-.45*t;frames.push({offset:at(burst+wait+travel*Math.sqrt(t)),transform:`translate(${p.x}px,${p.y}px) translate(-50%,-50%) scale(${s})`,opacity:1})});
      frames.sort((x,y)=>x.offset-y.offset);
      let gone=false;
      const arrive=()=>{
        if(gone)return;gone=true;el.remove();landed++;
        paint(landed>=count?end:start+Math.round(amount*landed/count));
        bump(pill);clinkSound(landed-1);
        if(landed>=count){setTimeout(()=>{bump(pill,true);chimeSound();plus(pill,amount)},60);done()}
      };
      // Respaldo: si la pestaña pasa a segundo plano, el navegador puede retrasar el fin de la animación; el temporizador
      // asegura que el contador acaba en el saldo real.
      try{el.animate(frames,{duration:total,fill:'forwards'}).onfinish=arrive;setTimeout(arrive,total+250)}catch{arrive()}
    }
  }
  window.CoinFly={fly};
})();

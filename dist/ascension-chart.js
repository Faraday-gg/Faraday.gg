// Histograma real y ajuste normal descriptivo: nunca genera una muestra de jugadores.
(()=>{
  function render(rank,score){
    if(!rank||!(rank.others>0)||!Array.isArray(rank.bins)||rank.bins.length!==14)return '';
    const bins=rank.bins.map(n=>Number.isSafeInteger(n)&&n>=0?n:0),width=520,baseline=160,amplitude=125;
    const model=rank.normal,normal=rank.others>=5&&Number.isFinite(model?.mean)&&model.mean>=0&&model.mean<=700&&Number.isFinite(model?.deviation)&&model.deviation>0;
    const density=x=>normal?rank.others*50/(model.deviation*Math.sqrt(2*Math.PI))*Math.exp(-.5*((x-model.mean)/model.deviation)**2):0;
    const peak=Math.max(1,...bins,normal?density(model.mean):0),y=n=>baseline-amplitude*n/peak;
    const bars=bins.map((n,i)=>`<rect class="ascension-chart-bar" x="${20+i/14*width+1.5}" y="${y(n)}" width="${width/14-3}" height="${baseline-y(n)}" rx="2"><title>${i*50}–${i===13?700:i*50+49} puntos: ${n} jugadores</title></rect>`).join('');
    // Incluye la media exacta para que una desviación pequeña no pierda el pico entre muestras.
    const xs=[...new Set([...Array.from({length:141},(_,i)=>i*5),...(normal?[model.mean]:[])])].sort((a,b)=>a-b);
    const path=normal?xs.map((x,i)=>`${i?'L':'M'}${20+x/700*width},${y(density(x))}`).join(' '):'';
    const ownX=20+Math.max(0,Math.min(700,Number(score)||0))/700*width;
    return `<figure class="ascension-distribution"><svg viewBox="0 0 560 210" class="ascension-distribution-svg" role="img" aria-label="Puntuaciones de otros jugadores${normal?', con curva normal ajustada':''} y tu resultado">
      <path class="ascension-chart-axis" d="M20 160H540"/>${bars}
      ${normal?`<path class="ascension-chart-area" d="M20 160 ${path.replace(/^M/,'L')} L540 160Z"/><path class="ascension-chart-normal" d="${path}"/>`:''}
      <path class="ascension-chart-you" d="M${ownX} 25V166"/><circle class="ascension-chart-dot" cx="${ownX}" cy="160" r="4"/>
      <text class="ascension-chart-own" x="${Math.max(33,Math.min(527,ownX))}" y="20" text-anchor="middle">Tú</text>
      <text class="ascension-chart-label" x="20" y="205">0</text><text class="ascension-chart-label" x="280" y="205" text-anchor="middle">350</text><text class="ascension-chart-label" x="540" y="205" text-anchor="end">700 puntos</text>
    </svg><figcaption><span>▥ Resultados reales</span>${normal?'<span class="ascension-chart-key">Curva normal ajustada</span>':''}</figcaption>
    <p class="ascension-chart-note">${normal?'La curva aproxima la media y la dispersión de otros jugadores; las barras muestran sus resultados reales.':rank.others<5?'La curva aparecerá a partir de cinco resultados de otros jugadores.':'Los resultados coinciden: no hay dispersión suficiente para ajustar una curva normal.'}</p></figure>`;
  }
  window.AscensionChart={render};
})();

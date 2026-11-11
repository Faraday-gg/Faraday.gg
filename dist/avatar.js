// Avatar por capas (decisión 0022): un muñeco propio, cabezón y de trazo grueso, dibujado en SVG sin dependencias.
// Cada pieza (piel, peinado, ropa, gorro, gafas, objeto, fondo) es un identificador del catálogo; un «look» es
// {hueco: identificador}. El precio se paga con faradios, la moneda que se gana jugando (progress.js).
// level = se desbloquea gratis al llegar a ese nivel.
(()=>{
  const INK='#202630',S=`stroke="${INK}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"`;
  const thin=`stroke="${INK}" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"`;
  const SLOTS=[['skin','Piel'],['hair','Peinado'],['hairColor','Color de pelo'],['top','Ropa'],['bottom','Pantalón'],['hat','Gorro'],['face','Gafas y más'],['item','En la mano'],['bg','Fondo']];
  // Peinados: back va detrás de la cabeza y front delante. H es el color del pelo.
  const fringe=H=>`<path d="M25 54C20 4 100 4 95 54C91 42 76 36 60 38C44 36 29 42 25 54Z" fill="${H}" ${S}/>`;
  const HAIR={
    corto:H=>({front:fringe(H)}),
    melena:H=>({back:`<path d="M21 50C21 2 99 2 99 50L99 86Q99 93 92 93L28 93Q21 93 21 86Z" fill="${H}" ${S}/>`,front:`<path d="M25 54C20 4 100 4 95 54L95 47C80 41 40 41 25 47Z" fill="${H}" ${S}/>`}),
    largo:H=>({back:`<path d="M21 50C21 2 99 2 99 50L103 108Q104 116 96 116L24 116Q16 116 17 108Z" fill="${H}" ${S}/>`,front:fringe(H)}),
    rizos:H=>({back:`<circle cx="24" cy="56" r="9" fill="${H}" ${S}/><circle cx="96" cy="56" r="9" fill="${H}" ${S}/>`,front:[[29,40,12],[38,24,12],[52,15,12],[68,15,12],[82,24,12],[91,40,12],[60,25,13]].map(([x,y,r])=>`<circle cx="${x}" cy="${y}" r="${r}" fill="${H}" ${S}/>`).join('')+`<path d="M34 36Q60 22 86 36Q60 30 34 36Z" fill="${H}"/>`}),
    pincho:H=>({front:`<path d="M25 54L22 30L33 37L35 15L48 28L56 6L66 26L79 11L83 31L96 22L95 54C91 42 76 37 60 39C44 37 29 42 25 54Z" fill="${H}" ${S}/>`}),
    mono:H=>({front:`<circle cx="60" cy="9" r="11" fill="${H}" ${S}/>`+fringe(H)}),
    coleta:H=>({back:`<path d="M88 34C116 38 114 84 100 98C103 78 98 62 86 54Z" fill="${H}" ${S}/>`,front:fringe(H)}),
    cresta:H=>({front:`<path d="M51 40L49 4Q60 -6 71 4L69 40Z" fill="${H}" ${S}/>`}),
    calvo:()=>({})
  };
  // Gorros. clip: oculta el pelo por encima de esa altura para que no asome.
  const dome=color=>`<path d="M25 44C21 0 99 0 95 44Z" fill="${color}" ${S}/>`;
  const HAT={
    gorra:()=>dome('#ff6548')+`<path d="M62 44L16 44Q5 44 7 50Q32 54 62 47Z" fill="#23395b" ${S}/><circle cx="62" cy="24" r="9" fill="#fffdf7" ${S}/><path d="M57 22.5q2.5-3 5 0t5 0M57 27q2.5-3 5 0t5 0" fill="none" ${thin}/>`,
    lana:()=>dome('#3fc5f0')+`<rect x="22" y="33" width="76" height="13" rx="6.5" fill="#fffdf7" ${S}/><circle cx="60" cy="4" r="8" fill="#fffdf7" ${S}/>`,
    cascos:()=>`<path d="M22 52C20 -2 100 -2 98 52" fill="none" stroke="${INK}" stroke-width="8" stroke-linecap="round"/><path d="M22 52C20 -2 100 -2 98 52" fill="none" stroke="#ffdb70" stroke-width="3.5" stroke-linecap="round"/><rect x="13" y="43" width="13" height="24" rx="6" fill="#ff6548" ${S}/><rect x="94" y="43" width="13" height="24" rx="6" fill="#ff6548" ${S}/>`,
    fiesta:()=>`<path d="M45 24L60 -10L75 24Z" fill="#ffdb70" ${S}/><path d="M51 12L68 8M48 19L72 15" fill="none" stroke="#ff6548" stroke-width="3.5" stroke-linecap="round"/><circle cx="60" cy="-11" r="4.5" fill="#ff6548" ${S}/>`,
    chef:()=>`<circle cx="44" cy="6" r="11" fill="#fffdf7" ${S}/><circle cx="76" cy="6" r="11" fill="#fffdf7" ${S}/><circle cx="60" cy="0" r="13" fill="#fffdf7" ${S}/><rect x="38" y="10" width="44" height="15" rx="3" fill="#fffdf7" ${S}/>`,
    birrete:()=>`<path d="M41 24L41 12L79 12L79 24Z" fill="${INK}" ${S}/><path d="M20 10L60 -3L100 10L60 23Z" fill="#2b313c" ${S}/><path d="M60 10L88 15L88 28" fill="none" stroke="#ffdb70" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><circle cx="88" cy="30" r="3.5" fill="#ffdb70" ${thin}/>`,
    chistera:()=>`<rect x="40" y="-10" width="40" height="32" rx="3" fill="#2b313c" ${S}/><rect x="40" y="10" width="40" height="8" fill="#ff6548" ${thin}/><rect x="28" y="19" width="64" height="8" rx="4" fill="#2b313c" ${S}/>`,
    mago:()=>`<path d="M33 25L64 -13L89 25Z" fill="#b49bff" ${S}/><ellipse cx="60" cy="26" rx="43" ry="7" fill="#b49bff" ${S}/><path d="M60 6l2 4.5 5 .5-3.7 3.3 1 4.9L60 16.8l-4.3 2.4 1-4.9L53 11l5-.5z" fill="#ffdb70" ${thin}/>`,
    corona:()=>`<path d="M35 27L31 3L46 14L60 -3L74 14L89 3L85 27Z" fill="#ffdb70" ${S}/><circle cx="60" cy="16" r="4" fill="#ff6548" ${thin}/><circle cx="43" cy="20" r="2.6" fill="#3fc5f0" ${thin}/><circle cx="77" cy="20" r="2.6" fill="#3fc5f0" ${thin}/>`,
    aureola:()=>`<ellipse cx="60" cy="4" rx="24" ry="6.5" fill="none" stroke="${INK}" stroke-width="7"/><ellipse cx="60" cy="4" rx="24" ry="6.5" fill="none" stroke="#ffdb70" stroke-width="3.5"/>`,
    astronauta:()=>`<circle cx="60" cy="50" r="43" fill="#b9d6e155" ${S}/><path d="M30 34Q38 18 54 14" fill="none" stroke="#fffdf7" stroke-width="4" stroke-linecap="round"/><rect x="34" y="84" width="52" height="10" rx="5" fill="#fffdf7" ${S}/>`
  };
  const HAT_CLIP={gorra:42,lana:42};
  // Ropa: color del torso y las mangas, más un detalle dibujado encima (o una capa por detrás).
  const TOP={
    blanca:{color:'#fffdf7'},coral:{color:'#ff6548'},azul:{color:'#3fc5f0'},
    marinera:{color:'#fffdf7',detail:`<path d="M43 94H77M42.5 102H77.5M42.5 110H77.5" fill="none" stroke="#23395b" stroke-width="3.2"/>`},
    faraday:{color:'#ffdb70',detail:`<path d="M52 99q4-5 8 0t8 0M52 107q4-5 8 0t8 0" fill="none" ${S}/>`},
    sudadera:{color:'#b49bff',detail:`<path d="M50 108H70L72 121H48Z" fill="#9a7df0" ${thin}/><path d="M55 86V97M65 86V97" fill="none" stroke="#fffdf7" stroke-width="2.4" stroke-linecap="round"/>`,back:`<path d="M30 80Q60 62 90 80Q90 94 60 96Q30 94 30 80Z" fill="#9a7df0" ${S}/>`},
    futbol:{color:'#2fd67b',detail:`<rect x="55" y="83" width="10" height="38" fill="#fffdf7"/><text x="60" y="110" text-anchor="middle" font-family="Arial,sans-serif" font-weight="800" font-size="12" fill="${INK}">10</text>`},
    bata:{color:'#fffdf7',detail:`<path d="M60 84L52 96L60 106L68 96Z" fill="#3fc5f0" ${thin}/><path d="M60 106V121" fill="none" ${thin}/><rect x="64" y="108" width="9" height="8" rx="1.5" fill="none" ${thin}/><path d="M67 108V103" fill="none" stroke="#ff6548" stroke-width="2.4" stroke-linecap="round"/>`},
    traje:{color:'#2b313c',detail:`<path d="M52 83L60 100L68 83Z" fill="#fffdf7" ${thin}/><path d="M60 88L56.5 97L60 111L63.5 97Z" fill="#ff6548" ${thin}/>`},
    heroe:{color:'#ff6548',detail:`<path d="M60 92l3 6.4 7 .8-5.2 4.7 1.4 6.9L60 107.3l-6.2 3.5 1.4-6.9L50 99.2l7-.8z" fill="#ffdb70" ${thin}/>`,back:`<path d="M44 86L20 136Q60 148 100 136L76 86Z" fill="#23395b" ${S}/>`},
    dorada:{color:'#ffc93c',detail:`<path d="M50 90l1.5 3.5 3.5 1.5-3.5 1.5L50 100l-1.5-3.5L45 95l3.5-1.5zM69 104l1.2 2.8 2.8 1.2-2.8 1.2L69 112l-1.2-2.8L65 108l2.800-1.2z" fill="#fffdf7"/><path d="M60 84V121" fill="none" ${thin}/>`}
  };
  const FACE={
    gafas:`<circle cx="48" cy="56" r="8.5" fill="#ffffff66" ${S}/><circle cx="72" cy="56" r="8.5" fill="#ffffff66" ${S}/><path d="M56.500 56H63.500M39.500 55L27 51M80.500 55L93 51" fill="none" ${S}/>`,
    sol:`<rect x="37" y="49" width="21" height="14" rx="6" fill="${INK}" ${S}/><rect x="62" y="49" width="21" height="14" rx="6" fill="${INK}" ${S}/><path d="M58 54H62M37 53L27 50M83 53L93 50" fill="none" ${S}/><path d="M42 53l5 0M67 53l5 0" stroke="#fffdf7" stroke-width="2" stroke-linecap="round" opacity=".6"/>`,
    monoculo:`<circle cx="72" cy="56" r="9.500" fill="#ffffff66" stroke="${INK}" stroke-width="5"/><circle cx="72" cy="56" r="9.500" fill="none" stroke="#ffdb70" stroke-width="2.2"/><path d="M79 63Q86 74 82 86" fill="none" stroke="#ffdb70" stroke-width="1.8"/>`,
    bigote:`<path d="M46 67Q53 59 60 65Q67 59 74 67Q67 71 60 67.500Q53 71 46 67Z" fill="${INK}" ${thin}/>`,
    parche:`<path d="M27 42L93 50" fill="none" ${thin}/><ellipse cx="48" cy="56" rx="8.500" ry="7.500" fill="${INK}" ${S}/>`
  };
  // Objetos en la mano derecha del muñeco (a la derecha de quien mira), cerca de (88,112).
  const ITEM={
    calculadora:`<g transform="rotate(12 92 104)"><rect x="84" y="91" width="18" height="25" rx="3.500" fill="#23395b" ${S}/><rect x="87" y="94.500" width="12" height="6" rx="1" fill="#b9d6e1"/><path d="M88.500 105h.1M93 105h.1M97.500 105h.1M88.500 110h.1M93 110h.1M97.500 110h.1" stroke="#fffdf7" stroke-width="2.6" stroke-linecap="round"/></g>`,
    lapiz:`<path d="M85 118L99 84" stroke="${INK}" stroke-width="9" stroke-linecap="round"/><path d="M85 118L99 84" stroke="#ffdb70" stroke-width="5" stroke-linecap="round"/><path d="M98 86.500L99.500 82.500" stroke="#ff6548" stroke-width="5" stroke-linecap="round"/>`,
    cafe:`<path d="M85 100H99L97.500 117H86.500Z" fill="#fffdf7" ${S}/><rect x="83.500" y="96" width="17" height="5" rx="2" fill="#ff6548" ${thin}/><path d="M89 91q-2-3 0-6M95 91q-2-3 0-6" fill="none" ${thin}/>`,
    lupa:`<path d="M90 108L94 100" fill="none" stroke="${INK}" stroke-width="5" stroke-linecap="round"/><circle cx="98" cy="91" r="10" fill="#b9d6e199" stroke="${INK}" stroke-width="3.500"/>`,
    globo:`<path d="M88 110Q98 84 101 62" fill="none" ${thin}/><ellipse cx="102" cy="46" rx="13" ry="16" fill="#ff6548" ${S}/><path d="M96 40Q98 34 103 33" fill="none" stroke="#fffdf7" stroke-width="2.4" stroke-linecap="round"/>`,
    varita:`<path d="M86 116L100 90" fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round"/><path d="M101 78l2.200 5 5.300.600-4 3.600 1.100 5.300L101 89.800l-4.600 2.700 1.100-5.300-4-3.600 5.300-.600z" fill="#ffdb70" ${thin}/>`,
    trofeo:`<path d="M84 90H102Q102 104 93 105Q84 104 84 90Z" fill="#ffdb70" ${S}/><path d="M84 93Q78 93 80 99Q82 102 86 101M102 93Q108 93 106 99Q104 102 100 101" fill="none" ${thin}/><path d="M93 105V111M87 113H99" fill="none" ${S}/>`
  };
  const BG={crema:'#efe7d4',amarillo:'#ffdb70',azul:'#b9d6e1',coral:'#ff8f78',verde:'#8fe6b5',violeta:'#cdbcff',rosa:'#ffb1cb',noche:'#23395b'};
  const BG_ART={
    atardecer:id=>`<defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b49bff"/><stop offset=".55" stop-color="#ff7aa8"/><stop offset="1" stop-color="#ffdb70"/></linearGradient></defs><rect x="-20" y="-40" width="160" height="220" fill="url(#${id})"/>`,
    estrellas:()=>`<rect x="-20" y="-40" width="160" height="220" fill="#1a2740"/>`+[[14,2,2],[104,-4,1.600],[96,40,2],[10,60,1.600],[30,-8,1.400],[110,78,1.600],[16,104,2],[102,120,1.400],[84,-10,1.200]].map(([x,y,r])=>`<circle cx="${x}" cy="${y}" r="${r}" fill="#ffdb70"/>`).join('')
  };
  const item=(slot,id,name,price=0,extra={})=>({slot,id,name,price,...extra});
  const CATALOG=[
    ...[['clara','Clara','#ffd9b8'],['miel','Miel','#f2bd8c'],['tostada','Tostada','#d99c6c'],['canela','Canela','#b5744a'],['cacao','Cacao','#8a5637'],['ebano','Ébano','#5e3a26']].map(([id,name,color])=>item('skin',id,name,0,{color})),
    item('hair','corto','Corto'),item('hair','melena','Melena'),item('hair','largo','Largo'),item('hair','rizos','Rizos'),item('hair','calvo','Sin pelo'),
    item('hair','mono','Moño',40),item('hair','coleta','Coleta',40),item('hair','pincho','De punta',60),item('hair','cresta','Cresta',150),
    ...[['castano','Castaño','#6b4a34'],['negro','Negro','#2b2b33'],['rubio','Rubio','#f0c75e'],['pelirrojo','Pelirrojo','#d9683c'],['gris','Gris','#b9b6ae']].map(([id,name,color])=>item('hairColor',id,name,0,{color})),
    ...[['azul','Azul','#3fa9f5',60],['rosa','Rosa','#ff7aa8',60],['verde','Verde','#2fd67b',60],['violeta','Violeta','#9a7df0',60]].map(([id,name,color,price])=>item('hairColor',id,name,price,{color})),
    item('top','blanca','Camiseta blanca'),item('top','coral','Camiseta coral'),item('top','azul','Camiseta azul'),
    item('top','marinera','Marinera',60),item('top','faraday','Camiseta ≈',80),item('top','futbol','El 10',150),item('top','sudadera','Sudadera',150),
    item('top','bata','Bata de laboratorio',0,{level:3}),item('top','traje','Traje',400),item('top','heroe','Superhéroe',600),item('top','dorada','Chaqueta dorada',900),
    ...[['beige','Beige','#e9dcc3',0],['vaquero','Vaquero','#5b7fb5',0],['negro','Negro','#2b313c',0],['verde','Verde','#4fae7c',40],['rosa','Rosa','#ff9dbd',40]].map(([id,name,color,price])=>item('bottom',id,name,price,{color})),
    item('hat','','Sin gorro'),item('hat','gorra','Gorra ≈',80),item('hat','lana','Gorro de lana',80),item('hat','fiesta','Gorrito de fiesta',120),item('hat','cascos','Cascos',200),
    item('hat','chef','Gorro de chef',250),item('hat','birrete','Birrete',0,{level:5}),item('hat','chistera','Chistera',400),item('hat','mago','Sombrero de mago',600),
    item('hat','aureola','Aureola',0,{level:10}),item('hat','astronauta','Casco espacial',1200),item('hat','corona','Corona',0,{level:15}),
    item('face','','Nada'),item('face','gafas','Gafas',60),item('face','sol','Gafas de sol',150),item('face','bigote','Bigote',100),item('face','parche','Parche pirata',200),item('face','monoculo','Monóculo',300),
    item('item','','Nada'),item('item','lapiz','Lápiz',40),item('item','calculadora','Calculadora',80),item('item','cafe','Café',80),item('item','lupa','Lupa',120),item('item','globo','Globo',200),
    item('item','varita','Varita',400),item('item','trofeo','Trofeo',0,{level:8}),
    item('bg','crema','Crema'),item('bg','amarillo','Amarillo'),item('bg','azul','Azul'),item('bg','coral','Coral',40),item('bg','verde','Verde',40),item('bg','violeta','Violeta',40),
    item('bg','rosa','Rosa',40),item('bg','noche','Noche',100),item('bg','atardecer','Atardecer',250),item('bg','estrellas','Estrellas',400)
  ];
  const DEFAULT={skin:'miel',hair:'corto',hairColor:'castano',top:'blanca',bottom:'beige',hat:'',face:'',item:'',bg:'amarillo'};
  const find=(slot,id)=>CATALOG.find(entry=>entry.slot===slot&&entry.id===id);
  // Un look siempre completo: las piezas desconocidas (por ejemplo, de una versión más nueva del rival) pasan a las de por defecto.
  function normalize(look){const result={};for(const [slot] of SLOTS){const id=look&&typeof look[slot]==='string'?look[slot]:null;result[slot]=id!==null&&find(slot,id)?id:DEFAULT[slot]}return result}
  let counter=0;
  // bust: solo cabeza y hombros sobre el fondo (marcador, avisos). Sin bust: cuerpo entero, sin fondo.
  function render(look,{bust=false,label=''}={}){
    const L=normalize(look),uid='avatar-'+(++counter),skin=find('skin',L.skin).color,H=find('hairColor',L.hairColor).color,top=TOP[L.top],legs=find('bottom',L.bottom).color;
    const hair=HAIR[L.hair](H),clip=HAT_CLIP[L.hat],shades=L.face==='sol';
    const clipped=markup=>markup&&clip?`<g clip-path="url(#${uid}-clip)">${markup}</g>`:markup||'';
    const parts=[
      clip?`<defs><clipPath id="${uid}-clip"><rect x="-20" y="${clip}" width="160" height="200"/></clipPath></defs>`:'',
      bust?(BG_ART[L.bg]?BG_ART[L.bg](uid+'-bg'):`<rect x="-20" y="-40" width="160" height="220" fill="${BG[L.bg]}"/>`):'',
      top.back||'',clipped(hair.back),
      `<rect x="46" y="116" width="12.500" height="28" rx="5" fill="${legs}" ${S}/><rect x="61.500" y="116" width="12.500" height="28" rx="5" fill="${legs}" ${S}/>`,
      `<path d="M43 146Q43 140 50 140H58V147H44Q43 147 43 146ZM77 146Q77 140 70 140H62V147H76Q77 147 77 146Z" fill="${INK}" ${thin}/>`,
      `<path d="M46 92L33 110M74 92L87 110" fill="none" stroke="${INK}" stroke-width="15" stroke-linecap="round"/><path d="M46 92L33 110M74 92L87 110" fill="none" stroke="${top.color}" stroke-width="10" stroke-linecap="round"/>`,
      `<rect x="42" y="82" width="36" height="40" rx="11" fill="${top.color}" ${S}/>`,top.detail||'',
      ITEM[L.item]||'',
      `<circle cx="32" cy="112" r="6" fill="${skin}" ${S}/><circle cx="88" cy="112" r="6" fill="${skin}" ${S}/>`,
      `<circle cx="27" cy="57" r="5.500" fill="${skin}" ${S}/><circle cx="93" cy="57" r="5.500" fill="${skin}" ${S}/><ellipse cx="60" cy="52" rx="34" ry="31" fill="${skin}" ${S}/>`,
      shades?'':`<ellipse cx="48" cy="56" rx="3.300" ry="4.800" fill="${INK}"/><ellipse cx="72" cy="56" rx="3.300" ry="4.800" fill="${INK}"/><circle cx="49.200" cy="54.200" r="1.200" fill="#fff"/><circle cx="73.200" cy="54.200" r="1.200" fill="#fff"/>`,
      `<ellipse cx="39" cy="66" rx="5" ry="3" fill="#ff6548" opacity=".28"/><ellipse cx="81" cy="66" rx="5" ry="3" fill="#ff6548" opacity=".28"/><path d="M54 69Q60 74.500 66 69" fill="none" ${S}/>`,
      clipped(hair.front),FACE[L.face]||'',HAT[L.hat]?HAT[L.hat]():''
    ];
    return `<svg class="avatar-svg" viewBox="${bust?'8 -16 104 104':'0 -20 120 170'}" xmlns="http://www.w3.org/2000/svg" ${label?`role="img" aria-label="${label}"`:'aria-hidden="true"'}>${parts.join('')}</svg>`;
  }
  // Fondo del look como color CSS, para la tarjeta del perfil.
  const background=look=>{const id=normalize(look).bg;return id==='atardecer'?'linear-gradient(#b49bff,#ff7aa8 55%,#ffdb70)':id==='estrellas'?'#1a2740':BG[id]};
  window.Avatar={SLOTS,CATALOG,DEFAULT,find,normalize,render,background};
})();

// Catálogo del avatar (decisiones 0024 y 0025). El avatar es un personaje 3D propio, de estética de calle, que dibuja
// avatar3d.js. Aquí vive lo que no necesita 3D: los huecos, las piezas con su precio y la traducción de un «look»
// ({hueco: identificador}) a lo que hay que dibujar. Un precio se paga con faradios (progress.js); level = la pieza se
// desbloquea gratis al llegar a ese nivel. Las marcas de la ropa son inventadas (≈, FRDY): no se copian logotipos reales.
(()=>{
  const PAPER='#fffdf7';
  const PALETTE={
    SKIN:{clara:'#ffd9b8',miel:'#f2bd8c',tostada:'#d99c6c',canela:'#b5744a',cacao:'#8a5637',ebano:'#5e3a26',robot:'#c9ccd3'},
    HAIR:{castano:'#6b4a34',negro:'#24242b',rubio:'#f0c75e',pelirrojo:'#d9683c',gris:'#b9b6ae',platino:'#f2efe6',azul:'#3fa9f5',rosa:'#ff7aa8',verde:'#2fd67b',violeta:'#9a7df0'},
    CLOTH:{negro:'#262b35',blanco:PAPER,crema:'#efe7d4',gris:'#9aa0ab',marino:'#23395b',burdeos:'#7d1f2e',rojo:'#e5383b',coral:'#ff6548',amarillo:'#ffc93c',verde:'#2f7d55',menta:'#b9ecd6',azul:'#3fa9f5',morado:'#5b3fa0',lila:'#cdbcff',rosa:'#ff9dbd',oliva:'#6b7a4c'},
    DENIM:{lavado:'#a9c3e3',vaquero:'#5b7fb5',indigo:'#2f4674',negro:'#262b35',gris:'#9aa0ab',crema:'#efe7d4',arena:'#d9b98a',oliva:'#6b7a4c',burdeos:'#7d1f2e',morado:'#5b3fa0'}
  };
  const SLOTS=[['top','Ropa'],['bottom','Pantalón'],['shoes','Zapatillas'],['hat','Cabeza'],['hair','Peinado'],['hairColor','Color de pelo'],['glasses','Gafas'],['neck','Cuello'],['extra','Extras'],['face','Gesto'],['skin','Piel']];
  // set = lo que la pieza cambia en el dibujo; extras = accesorios que se suman.
  const item=(slot,id,name,price=0,more={})=>({slot,id,name,price,...more});
  const top=(id,name,price,type,color,trim,print='',more={})=>item('top',id,name,price,{set:{top:type,topColor:color,trimColor:trim,print},...more});
  const bottom=(id,name,price,type,color)=>item('bottom',id,name,price,{set:{bottom:type,bottomColor:color}});
  const shoes=(id,name,price,type,color)=>item('shoes',id,name,price,{set:{shoes:type,shoesColor:color}});
  const hat=(id,name,price,type,color='negro',trim='blanco',more={})=>item('hat',id,name,price,{set:{hat:type,hatColor:color,hatTrim:trim},...more});
  const CATALOG=[
    top('cam-blanca','Camiseta blanca',0,'camiseta','blanco','negro'),top('cam-negra','Camiseta negra',0,'camiseta','negro','blanco'),
    top('cam-crema-logo','Oversize ≈ crema',60,'camiseta','crema','negro','logo'),top('cam-negra-logo','Oversize ≈ negra',80,'camiseta','negro','amarillo','logo'),
    top('cam-blanca-frdy','Oversize FRDY',100,'camiseta','blanco','rojo','frdy'),top('cam-negra-frdy','Oversize FRDY negra',120,'camiseta','negro','coral','frdy'),
    top('cam-azul-tag','Oversize 1,2× azul',140,'camiseta','azul','amarillo','tag'),top('cam-blanca-tag','Oversize 1,2×',140,'camiseta','blanco','coral','tag'),
    top('cam-crema-ajedrez','Oversize ajedrez',180,'camiseta','crema','negro','ajedrez'),top('cam-rosa-ajedrez','Oversize ajedrez rosa',180,'camiseta','rosa','negro','ajedrez'),
    top('cam-negra-llamas','Oversize en llamas',220,'camiseta','negro','coral','llamas'),top('cam-blanca-llamas','Oversize llamas blanca',220,'camiseta','blanco','coral','llamas'),
    top('sud-gris','Sudadera gris',150,'sudadera','gris','negro'),top('sud-negra','Sudadera negra',160,'sudadera','negro','blanco'),top('sud-crema','Sudadera crema',160,'sudadera','crema','negro'),
    top('sud-negra-logo','Sudadera ≈',220,'sudadera','negro','amarillo','logo'),top('sud-rosa-logo','Sudadera ≈ rosa',240,'sudadera','rosa','burdeos','logo'),top('sud-lila-frdy','Sudadera FRDY lila',240,'sudadera','lila','morado','frdy'),
    top('sud-verde-tag','Sudadera 1,2× verde',260,'sudadera','verde','crema','tag'),top('sud-negra-tag','Sudadera 1,2×',280,'sudadera','negro','coral','tag'),
    top('sud-marino-ajedrez','Sudadera ajedrez',320,'sudadera','marino','blanco','ajedrez'),top('sud-negra-llamas','Sudadera en llamas',400,'sudadera','negro','coral','llamas'),
    top('bal-morado','Baloncesto morada',280,'baloncesto','morado','amarillo'),top('bal-rojo','Baloncesto roja',280,'baloncesto','rojo','blanco'),top('bal-negro','Baloncesto negra',300,'baloncesto','negro','coral'),
    top('bal-azul','Baloncesto azul',300,'baloncesto','azul','blanco'),top('bal-verde','Baloncesto verde',320,'baloncesto','verde','amarillo'),
    top('cha-rojo','Chándal rojo',380,'chandal','rojo','negro'),top('cha-negro','Chándal negro',380,'chandal','negro','gris'),top('cha-azul','Chándal azul',420,'chandal','azul','morado'),
    top('cha-verde','Chándal verde',420,'chandal','verde','crema'),top('cha-marino','Chándal marino',460,'chandal','marino','coral'),top('cha-lila','Chándal lila',520,'chandal','lila','rosa'),
    top('plu-amarillo','Plumas amarillo',550,'plumas','amarillo','negro'),top('plu-negro','Plumas negro',600,'plumas','negro','negro'),top('plu-lila','Plumas lila',600,'plumas','lila','negro'),
    top('plu-menta','Plumas menta',600,'plumas','menta','negro'),top('plu-coral','Plumas coral',650,'plumas','coral','negro'),top('plu-blanco','Plumas blanco',700,'plumas','blanco','negro'),
    top('uni-marino','Universitaria marina',650,'universitaria','marino','amarillo'),top('uni-burdeos','Universitaria burdeos',650,'universitaria','burdeos','crema'),
    top('uni-morado','Universitaria morada',700,'universitaria','morado','lila'),top('uni-verde','Universitaria verde',700,'universitaria','verde','menta'),
    top('uni-negra','Universitaria negra',750,'universitaria','negro','blanco'),top('uni-roja','Universitaria roja',750,'universitaria','rojo','blanco'),
    top('uni-crema','Universitaria crema',800,'universitaria','crema','verde'),top('uni-rosa','Universitaria rosa',900,'universitaria','rosa','blanco'),
    top('uni-negra-coral','Universitaria fuego',1400,'universitaria','negro','coral'),top('uni-oro','Universitaria dorada',2000,'universitaria','negro','amarillo'),
    top('cam-faraday','Camiseta ≈ dorada',0,'camiseta','amarillo','negro','logo',{level:3}),

    bottom('ancho-lavado','Ancho lavado',0,'ancho','lavado'),bottom('ancho-vaquero','Ancho vaquero',0,'ancho','vaquero'),bottom('corto-negro','Corto negro',0,'corto','negro'),
    bottom('corto-vaquero','Corto vaquero',50,'corto','vaquero'),bottom('corto-crema','Corto crema',50,'corto','crema'),bottom('ancho-negro','Ancho negro',80,'ancho','negro'),bottom('ancho-crema','Ancho crema',80,'ancho','crema'),
    bottom('ancho-indigo','Ancho índigo',100,'ancho','indigo'),bottom('ancho-gris','Ancho gris',100,'ancho','gris'),bottom('cha-negro','Chándal negro',100,'chandal','negro'),bottom('cha-gris','Chándal gris',100,'chandal','gris'),
    bottom('corto-burdeos','Corto burdeos',120,'corto','burdeos'),bottom('corto-morado','Corto morado',120,'corto','morado'),bottom('cha-burdeos','Chándal burdeos',160,'chandal','burdeos'),bottom('cha-morado','Chándal morado',160,'chandal','morado'),
    bottom('cargo-oliva','Cargo oliva',200,'cargo','oliva'),bottom('cargo-arena','Cargo arena',200,'cargo','arena'),bottom('cargo-negro','Cargo negro',220,'cargo','negro'),bottom('cargo-gris','Cargo gris',220,'cargo','gris'),

    shoes('skate-blanco','Skate blancas',0,'skate','blanco'),shoes('skate-negro','Skate negras',0,'skate','negro'),shoes('skate-crema','Skate crema',100,'skate','crema'),
    shoes('skate-rojo','Skate rojas',120,'skate','rojo'),shoes('skate-azul','Skate azules',120,'skate','azul'),shoes('skate-verde','Skate verdes',120,'skate','verde'),
    shoes('altas-negro','Caña alta negras',180,'altas','negro'),shoes('altas-blanco','Caña alta blancas',180,'altas','blanco'),shoes('altas-rojo','Caña alta rojas',220,'altas','rojo'),
    shoes('altas-morado','Caña alta moradas',260,'altas','morado'),shoes('altas-amarillo','Caña alta amarillas',300,'altas','amarillo'),
    shoes('plat-blanco','Plataforma blancas',350,'plataforma','blanco'),shoes('plat-negro','Plataforma negras',400,'plataforma','negro'),shoes('plat-coral','Plataforma coral',500,'plataforma','coral'),
    shoes('plat-menta','Plataforma menta',500,'plataforma','menta'),shoes('plat-rosa','Plataforma rosas',550,'plataforma','rosa'),shoes('plat-lila','Plataforma lila',600,'plataforma','lila'),

    item('hat','','Nada'),hat('gorro-negro','Gorro negro',80,'gorro','negro'),hat('gorro-oliva','Gorro oliva',100,'gorro','oliva'),hat('gorro-burdeos','Gorro burdeos',100,'gorro','burdeos'),
    hat('gorro-crema','Gorro crema',100,'gorro','crema'),hat('gorro-coral','Gorro coral',120,'gorro','coral'),hat('capucha','Capucha puesta',150,'capucha'),
    hat('atras-negra','Gorra atrás negra',180,'atras','negro','negro'),hat('pesca-crema','Pescador crema',180,'pescador','crema','negro'),hat('atras-coral','Gorra atrás coral',200,'atras','coral','negro'),
    hat('atras-azul','Gorra atrás azul',200,'atras','azul','blanco'),hat('pesca-negro','Pescador negro',200,'pescador','negro','amarillo'),hat('pesca-verde','Pescador verde',200,'pescador','verde','crema'),
    hat('lado-roja','Gorra ladeada roja',220,'ladeada','rojo','negro'),hat('lado-negra','Gorra ladeada negra',220,'ladeada','negro','coral'),hat('plana-marino','Gorra plana marina',240,'plana','marino','amarillo'),
    hat('plana-negra','Gorra plana negra',240,'plana','negro','blanco'),hat('plana-roja','Gorra plana roja',260,'plana','rojo','negro'),hat('plana-burdeos','Gorra plana burdeos',260,'plana','burdeos','crema'),
    hat('lado-amarilla','Gorra ladeada amarilla',260,'ladeada','amarillo','negro'),hat('plana-morada','Gorra plana morada',280,'plana','morado','lila'),hat('plana-verde','Gorra plana verde',280,'plana','verde','menta'),
    hat('plana-crema','Gorra plana crema',300,'plana','crema','verde'),
    hat('gorra-oro','Gorra dorada',0,'plana','amarillo','negro',{level:5}),hat('aureola','Aureola',0,'aureola','amarillo','amarillo',{level:10}),hat('corona','Corona',0,'corona','amarillo','rojo',{level:15}),

    item('hair','puntas','Flequillo de puntas'),item('hair','cortina','Cortina'),item('hair','rizos','Rizos'),item('hair','rapado','Rapado'),item('hair','calvo','Sin pelo'),
    item('hair','degradado','Degradado',120),item('hair','mono','Moño alto',150),item('hair','trenzas','Trenzas',220),item('hair','mullet','Mullet',250),item('hair','rastas','Rastas',350),item('hair','afro','Afro',400),
    ...[['negro','Negro'],['castano','Castaño'],['rubio','Rubio'],['pelirrojo','Pelirrojo'],['gris','Gris'],['azul','Azul',60],['rosa','Rosa',60],['verde','Verde',60],['violeta','Violeta',60],['platino','Platino',80]].map(([id,name,price])=>item('hairColor',id,name,price,{color:PALETTE.HAIR[id]})),

    item('glasses','','Nada'),item('glasses','gafas','Gafas',60,{extras:['gafas']}),item('glasses','sol','Gafas de sol',150,{extras:['sol']}),
    item('neck','','Nada'),item('neck','cadena','Cadenón',200,{extras:['cadena']}),item('neck','panuelo','Pañuelo',220,{extras:['panuelo']}),
    item('extra','','Nada'),item('extra','aros','Aros',80,{extras:['aros']}),item('extra','cascos','Cascos',200,{extras:['cascos']}),item('extra','aros-cascos','Aros y cascos',320,{extras:['aros','cascos']}),
    item('extra','oro','Diente de oro',0,{extras:['oro'],level:8}),

    item('face','chulo','Chulo'),item('face','serio','Serio'),item('face','feliz','Feliz'),
    ...[['clara','Clara'],['miel','Miel'],['tostada','Tostada'],['canela','Canela'],['cacao','Cacao'],['ebano','Ébano']].map(([id,name])=>item('skin',id,name,0,{color:PALETTE.SKIN[id]}))
  ];
  const DEFAULT={top:'cam-blanca',bottom:'ancho-lavado',shoes:'skate-blanco',hat:'',hair:'puntas',hairColor:'negro',glasses:'',neck:'',extra:'',face:'chulo',skin:'miel'};
  const find=(slot,id)=>CATALOG.find(entry=>entry.slot===slot&&entry.id===id);
  // Un look siempre completo: las piezas desconocidas (de una versión anterior o más nueva) pasan a las de por defecto.
  function normalize(look){const result={};for(const [slot] of SLOTS){const id=look&&typeof look[slot]==='string'?look[slot]:null;result[slot]=id!==null&&find(slot,id)?id:DEFAULT[slot]}return result}
  // Look → lo que dibuja avatar3d.js. Un look con _raw ya viene traducido (el bot de los duelos).
  function resolve(look){
    if(look&&look._raw)return look._raw;
    const L=normalize(look),raw={skin:L.skin,face:L.face,hair:L.hair,hairColor:L.hairColor,extras:[]};
    for(const [slot] of SLOTS){const entry=find(slot,L[slot]);if(entry.set)Object.assign(raw,entry.set);if(entry.extras)raw.extras.push(...entry.extras)}
    return raw;
  }
  // Cómo se enseña una pieza en la tienda: el muñeco por defecto con esa pieza puesta.
  const preview=entry=>({...DEFAULT,[entry.slot]:entry.id});
  // Rareza según el precio: da color a la etiqueta de la tienda.
  const rarity=entry=>entry.level?'nivel':entry.price>=1400?'legendaria':entry.price>=600?'epica':entry.price>=250?'rara':entry.price>=100?'especial':'comun';
  // Silueta plana de reserva: es lo que se ve hasta que carga el 3D, o si el navegador no puede con él.
  function fallback(raw,mode){
    const skin=PALETTE.SKIN[raw.skin]||PALETTE.SKIN.miel,hair=PALETTE.HAIR[raw.hairColor]||PALETTE.HAIR.negro,body=PALETTE.CLOTH[raw.topColor]||PAPER,legs=PALETTE.DENIM[raw.bottomColor]||PALETTE.DENIM.lavado,feet=PALETTE.CLOTH[raw.shoesColor]||PAPER;
    const view={bust:'10 0 100 100',legs:'20 118 80 80',torso:'15 78 90 90'}[mode]||'0 0 120 180';
    return `<svg class="avatar-fallback" viewBox="${view}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><g stroke="#1b1f27" stroke-width="3" stroke-linejoin="round"><rect x="44" y="128" width="14" height="40" rx="6" fill="${legs}"/><rect x="62" y="128" width="14" height="40" rx="6" fill="${legs}"/><rect x="39" y="162" width="20" height="12" rx="5" fill="${feet}"/><rect x="61" y="162" width="20" height="12" rx="5" fill="${feet}"/><rect x="34" y="90" width="52" height="46" rx="14" fill="${body}"/><rect x="24" y="16" width="72" height="68" rx="26" fill="${skin}"/>${raw.hair==='calvo'?'':`<path d="M24 46Q24 14 60 14Q96 14 96 46Q78 30 60 34Q42 30 24 46Z" fill="${hair}"/>`}</g><ellipse cx="46" cy="54" rx="4" ry="7" fill="#1b1f27"/><ellipse cx="74" cy="54" rx="4" ry="7" fill="#1b1f27"/></svg>`;
  }
  // bust: cabeza y hombros (marcador, avisos). zoom: 'legs' o 'torso' para la tienda. live: animado, para las pantallas
  // grandes; drag: se puede girar arrastrando; emote: gesto ('cheer', 'sad' o 'hurt').
  function render(look,{bust=false,label='',zoom='',live=false,drag=false,emote=''}={}){
    const raw=resolve(look),mode=bust?'bust':zoom||'full',data=encodeURIComponent(JSON.stringify({look:raw,mode,live,drag,emote}));
    return `<span class="avatar-view" data-mode="${mode}" data-avatar="${data}" ${label?`role="img" aria-label="${label}"`:'aria-hidden="true"'}>${fallback(raw,mode)}</span>`;
  }
  // Ya no hay fondos: el avatar se enseña sobre un foco claro.
  const background=()=>'radial-gradient(circle at 50% 36%,#fffdf7 0,#efe7d4 62%,#e4d9bf 100%)';
  window.Avatar={SLOTS,CATALOG,DEFAULT,PALETTE,find,normalize,resolve,preview,render,background,rarity};
})();

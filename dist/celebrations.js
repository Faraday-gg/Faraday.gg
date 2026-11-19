// Catálogo y reglas compartidas de los gestos. Solo aspecto: no cambian puntos ni premios.
(()=>{
  const CLIPS=[
    ['clavada','¡Clavada!','cheer'],['salto','Salto','cheer'],['puno','Puño al cielo','cheer'],['giro','Giro','cheer'],
    ['bailar','Baile','cheer'],['robot','Robot','cheer'],['aspersor','Aspersor','cheer'],['disco','Disco','cheer'],
    ['twist','Twist','cheer'],['balanceo','Balanceo','cheer'],['dab','Dab','cheer'],['correr','Correr en el sitio','cheer'],
    ['casi','Por poco',''],['encoger','Encoger los hombros','meh'],['facepalm','Mano a la cara','sad'],
    ['horror','Manos a la cabeza','sad'],['desmayo','Desmayo','ko'],['suspiro','Suspiro','sad'],['negar','Negar','sad'],
    ['saludo','Saludo',''],['saludo2','Saludo corto',''],['pensar','Pensar','']
  ].map(([id,name,rest])=>({id,name,rest}));
  const MODES=[['all','Todos los modos'],['daily','Reto diario'],['archive','Archivo'],['duel','Duelo 1 vs 1'],['duel3','Duelo de tres'],['ranked','Clasificatorias'],['trends','Traza la tendencia']];
  const TIERS=[
    {id:'clavada',max:window.CasiCasi?.LIMIT||1.1,clip:'clavada',rest:'cheer',name:'¡Casi casi!',range:'Menos de 1,1×'},
    {id:'acierto',max:1.9,clip:'salto',rest:'cheer',name:'Muy cerca',range:'1,1× a menos de 1,9×',label:'¡Muy cerca!'},
    {id:'cerca',max:5,clip:'casi',rest:'',name:'Por poco',range:'1,9× a menos de 5×'},
    {id:'lejos',max:10,clip:'encoger',rest:'meh',name:'Lejos',range:'5× a menos de 10×'},
    {id:'fallo',max:20,clip:'facepalm',rest:'sad',name:'Fallo',range:'10× a menos de 20×'},
    {id:'desastre',max:100,clip:'horror',rest:'sad',name:'Desastre',range:'20× a menos de 100×'},
    {id:'ko',max:Infinity,clip:'desmayo',rest:'ko',name:'Desmayo',range:'100× o más / sin respuesta'}
  ];
  const EXTRA=[
    {id:'victory',name:'Victoria',range:'Al ganar un duelo',clip:'salto',rest:'cheer'},
    {id:'draw',name:'Empate',range:'Al empatar un duelo',clip:'encoger',rest:''},
    {id:'defeat',name:'Derrota',range:'Al perder un duelo',clip:'suspiro',rest:'sad'},
    {id:'welcome',name:'Saludo',range:'En la portada',clip:'saludo',rest:''},
    {id:'reward',name:'Premio',range:'Al estrenar un premio de cofre',clip:'salto',rest:'cheer'}
  ];
  const CUES=[...TIERS,...EXTRA],valid=value=>value==='default'||value==='none'||CLIPS.some(item=>item.id===value);
  function normalize(raw){
    const result={};
    for(const [mode] of MODES){
      result[mode]={};
      for(const {id} of CUES){const value=raw?.[mode]?.[id];if(typeof value==='string'&&valid(value))result[mode][id]=value}
    }
    return result;
  }
  const tierOf=factor=>TIERS.find(tier=>Number.isFinite(factor)&&factor>=1&&factor<tier.max)||TIERS.at(-1);
  const trendTier=score=>TIERS[score>=950?0:score>=800?1:score>=600?2:score>=350?3:4];
  // Un trazo de 600–799 puntos conserva su puño original, aunque comparte el nivel «Por poco».
  function base(cue,mode){const row=CUES.find(item=>item.id===cue)||TIERS.at(-1);return mode==='trends'&&cue==='cerca'?{...row,clip:'puno'}:row}
  function choice(settings,mode,cue){return settings?.[mode]?.[cue]||settings?.all?.[cue]||'default'}
  function reaction(settings,mode,cue,{animate=true}={}){
    const original=base(cue,mode),picked=choice(settings,mode,cue),custom=CLIPS.find(item=>item.id===picked);
    if(picked==='none')return {mood:'still'};
    const {clip,rest}=custom?{clip:custom.id,rest:custom.rest}:original;
    if(!animate)return {mood:rest,repeat:'',quiet:true};
    return {clip,mood:'',then:rest,repeat:custom&&clip!=='desmayo'?clip:''};
  }
  const loadout=(settings,mode)=>Object.fromEntries(CUES.map(({id})=>[id,choice(settings,mode,id)]));
  window.Celebrations={CLIPS,MODES,TIERS,CUES,normalize,tierOf,trendTier,choice,reaction,loadout};
})();

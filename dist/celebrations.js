// Catálogo y reglas compartidas de los gestos. Solo aspecto: no cambian puntos ni premios.
// También el catálogo de emotes y la rueda de emotes del jugador (sus favoritos), que se eligen en el armario.
(()=>{
  const CLIPS=[
    ['clavada','¡Clavada!','cheer'],['salto','Salto','cheer'],['puno','Puño al cielo','cheer'],['giro','Giro','cheer'],
    ['bailar','Baile','cheer'],['robot','Robot','cheer'],['aspersor','Aspersor','cheer'],['disco','Disco','cheer'],
    ['twist','Twist','cheer'],['balanceo','Balanceo','cheer'],['dab','Dab','cheer'],['correr','Correr en el sitio','cheer'],
    ['casi','Por poco',''],['encoger','Encoger los hombros','meh'],['facepalm','Mano a la cara','sad'],
    ['horror','Manos a la cabeza','sad'],['desmayo','Desmayo','ko'],['suspiro','Suspiro','sad'],['negar','Negar','sad'],
    ['saludo','Saludo',''],['saludo2','Saludo corto',''],['pensar','Pensar','']
  ].map(([id,name,rest])=>({id,name,rest}));
  const MODES=[['all','Todos los modos'],['daily','Reto diario'],['archive','Archivo'],['duel','Duelo 1 vs 1'],['duel3','Duelo de tres'],['ranked','Clasificatorias'],['trends','Traza la tendencia'],['ascension','Ascensión']];
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
  function base(cue,mode){
    if(mode==='ascension'){const preset={clavada:['clavada','cheer'],acierto:['giro','cheer'],cerca:['puno','cheer'],lejos:['salto','cheer'],fallo:['saludo',''],ko:['encoger','meh']}[cue];if(preset)return {clip:preset[0],rest:preset[1]}}
    const row=CUES.find(item=>item.id===cue)||TIERS.at(-1);return mode==='trends'&&cue==='cerca'?{...row,clip:'puno'}:row}
  function choice(settings,mode,cue){return settings?.[mode]?.[cue]||settings?.all?.[cue]||'default'}
  function reaction(settings,mode,cue,{animate=true}={}){
    const original=base(cue,mode),picked=choice(settings,mode,cue),custom=CLIPS.find(item=>item.id===picked);
    if(picked==='none')return {mood:'still'};
    const {clip,rest}=custom?{clip:custom.id,rest:custom.rest}:original;
    if(!animate)return {mood:rest,repeat:'',quiet:true};
    return {clip,mood:'',then:rest,repeat:custom&&clip!=='desmayo'?clip:''};
  }
  const loadout=(settings,mode)=>Object.fromEntries(CUES.map(({id})=>[id,choice(settings,mode,id)]));

  // ---- Categorías «Celebraciones» y «Emotes» del armario (progress.js).
  // Momentos que tiene cada modo y su tipo, para los filtros de «Celebraciones».
  const GROUPS=[['resultados','Resultados',TIERS.map(tier=>tier.id)],['duelo','Final de duelo',['victory','draw','defeat']],['otros','Otros',['welcome','reward']]];
  const groupOf=cue=>(GROUPS.find(([,,ids])=>ids.includes(cue))||GROUPS[0])[0];
  const ONLY={ascension:['clavada','acierto','cerca','lejos','fallo','ko'],trends:['clavada','acierto','cerca','lejos','fallo']},DUELS=['duel','duel3','ranked'];
  function cuesOf(mode){
    const allowed=ONLY[mode]||(mode==='all'?CUES.map(cue=>cue.id):[...GROUPS[0][2],...(DUELS.includes(mode)?GROUPS[1][2]:[])]);
    return CUES.filter(cue=>allowed.includes(cue.id));
  }
  // Emotes: los gestos de CLIPS más los de la rueda del Salón que no están en él (EMOTES de casino-chat.js). Todos están
  // incluidos para todos (decisión 0096): no tienen precio, rareza ni dueño. kind = tipo, para filtrar; icon y label = cómo
  // salen en la rueda (los del Salón conservan su icono y su nombre corto). Cada id es un gesto de avatar3d.js.
  const KINDS=[['celebracion','Celebración'],['baile','Baile'],['decepcion','Decepción'],['neutro','Neutro']];
  // Los bailes: DANCES de avatar3d.js y el baile de siempre.
  const DANCES=['bailar','robot','aspersor','disco','twist','balanceo','dab','correr'];
  const ICONS={clavada:'🎯',salto:'🙌',puno:'✊',giro:'🌀',bailar:'💃',robot:'🤖',aspersor:'💦',disco:'🕺',twist:'🎶',balanceo:'👐',dab:'😎',correr:'🏃',
    casi:'😬',encoger:'😕',facepalm:'🤦',horror:'😱',desmayo:'😵',suspiro:'😮‍💨',negar:'🙅',saludo:'👋',saludo2:'✋',pensar:'🤔',hombros:'🤷'};
  const LABELS={saludo:'Saludar',puno:'¡Vamos!',bailar:'Bailar',negar:'No'};
  // Los encogimientos de hombros (rest «meh») y los saludos van con los neutros; «Por poco» es un lamento aunque no deje triste.
  const kindOf=item=>DANCES.includes(item.id)?'baile':item.rest==='cheer'?'celebracion':['sad','ko'].includes(item.rest)||item.id==='casi'?'decepcion':'neutro';
  const EMOTES=[...CLIPS,{id:'hombros',name:'Ni idea',rest:'meh'}].map(item=>({...item,kind:kindOf(item),icon:ICONS[item.id],label:LABELS[item.id]||item.name}));
  // La rueda de emotes: los favoritos del jugador (hasta WHEEL_MAX, en su orden) o, si no ha elegido, la del Salón.
  const WHEEL=['saludo','puno','giro','bailar','robot','disco','twist','dab','negar','pensar','hombros','suspiro'],WHEEL_MAX=10;
  const favorites=raw=>Array.isArray(raw)?[...new Set(raw.filter(id=>typeof id==='string'&&EMOTES.some(item=>item.id===id)))].slice(0,WHEEL_MAX):[];
  function wheel(raw){
    const ids=favorites(raw);
    return (ids.length?ids:WHEEL).map(id=>{const item=EMOTES.find(one=>one.id===id);return {id,name:item.label,icon:item.icon}});
  }
  // En cuántos momentos (de todos los modos) sale cada gesto con la selección del jugador: {gesto: n}.
  function used(settings){
    const count={};
    for(const [mode] of MODES)for(const {id} of cuesOf(mode)){const {clip}=reaction(settings,mode,id);if(clip)count[clip]=(count[clip]||0)+1}
    return count;
  }
  window.Celebrations={CLIPS,MODES,TIERS,CUES,normalize,tierOf,trendTier,choice,reaction,loadout,GROUPS,groupOf,cuesOf,KINDS,EMOTES,WHEEL,WHEEL_MAX,favorites,wheel,used};
})();

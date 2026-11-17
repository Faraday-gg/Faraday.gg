import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';

const original=JSON.parse(fs.readFileSync(new URL('./dist/questions.json',import.meta.url),'utf8'));
// Base congelada del banco editorial (16 nov – 14 dic): las 21 preguntas del piloto tal como se publicaron.
// Así el banco no cambia aunque se revise el piloto en dist/questions.json.
const base=JSON.parse(fs.readFileSync(new URL('./content/banco-base.json',import.meta.url),'utf8'));
// Archivo editorial: una jornada verificada por archivo en content/archivo/AAAA-MM-DD.json, anteriores al piloto.
const archiveDirectory=new URL('./content/archivo/',import.meta.url);
export const archive=fs.existsSync(archiveDirectory)?fs.readdirSync(archiveDirectory).filter(f=>/^\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort().map(f=>JSON.parse(fs.readFileSync(new URL(f,archiveDirectory),'utf8'))):[];
// Jornadas escritas a mano después del piloto (decisión 0046): una por archivo en content/jornadas/AAAA-MM-DD.json.
// Sustituyen al banco de plantillas en sus fechas, con referentes mundiales, de España y de Latinoamérica.
const daysDirectory=new URL('./content/jornadas/',import.meta.url);
export const written=fs.existsSync(daysDirectory)?fs.readdirSync(daysDirectory).filter(f=>/^\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort().map(f=>JSON.parse(fs.readFileSync(new URL(f,daysDirectory),'utf8'))):[];
// Jornadas escritas a mano (archivo + piloto + jornadas), por orden de fecha.
export const editorialDays=[...archive,...original,...written].sort((a,b)=>a.id<b.id?-1:1);
// Primera edición del juego: la Nº 1.
export const FIRST_DAY=editorialDays[0].id;
const fixtures=new Map(editorialDays.map(d=>[d.id,d]));
const dayMs=86400000,start=Date.parse('2026-11-16T12:00:00Z');
const units={
 area:[['folios A4',.210*.297,'m²','Una hoja A4 ocupa 0,210 × 0,297 m.'],['tarjetas bancarias',.0856*.05398,'m²','Tarjeta de referencia de 85,60 × 53,98 mm.'],['servilletas de papel',.33**2,'m²','Servilleta abierta ideal de 33 × 33 cm.'],['esterillas de yoga',1.8*.6,'m²','Esterilla de referencia de 180 × 60 cm.'],['posavasos',.1**2,'m²','Posavasos cuadrados de 10 cm de lado.'],['fichas de dominó',.05*.025,'m²','Ficha plana ideal de 5 × 2,5 cm.'],['manteles de restaurante',1.4**2,'m²','Manteles cuadrados de referencia de 1,4 m.'],['portadas de discos de vinilo',.315**2,'m²','Carátula cuadrada de referencia de 31,5 cm.']],
 mass:[['maletas de avión',23,'kg','Maleta de referencia de 23 kg.'],['gatos adultos',4,'kg','Gato adulto de referencia de 4 kg; las razas varían.'],['paquetes de arroz',1,'kg','Paquetes de referencia de 1 kg.'],['bicicletas urbanas',15,'kg','Bicicleta urbana ideal de 15 kg.'],['huevos de gallina',.06,'kg','Huevo de referencia de 60 g, incluida la cáscara.'],['sacos de patatas',25,'kg','Sacos de referencia de 25 kg.'],['tabletas de chocolate',.1,'kg','Tabletas de referencia de 100 g.'],['bolas de bolera',7,'kg','Bola de referencia de 7 kg.']],
 length:[['tapones de corcho',.045,'m','Tapones ideales de 4,5 cm colocados por su longitud.'],['bocadillos',.25,'m','Bocadillos ideales de 25 cm, punta con punta.'],['botellas de vino',.30,'m','Botellas de referencia de 30 cm de alto.'],['cajas de zapatos',.12,'m','Cajas de referencia de 12 cm de alto.'],['tazas de café',.09,'m','Tazas de referencia de 9 cm de alto.'],['lápices',.175,'m','Lápices nuevos de referencia de 17,5 cm.'],['barajas de cartas',.02,'m','Baraja de referencia de 2 cm de grosor.'],['teléfonos móviles',.15,'m','Teléfonos de referencia de 15 cm colocados por su lado largo.']],
 volume:[['botellas de agua',1.5,'L','Botellas de referencia de 1,5 litros.'],['cañas de cerveza',.2,'L','Cañas ideales de 200 ml, sin espuma.'],['cubos de fregona',12,'L','Cubos de referencia de 12 litros.'],['tazas de desayuno',.25,'L','Tazas de referencia de 250 ml.'],['ollas de cocina',5,'L','Ollas ideales de 5 litros hasta el borde.'],['regaderas',10,'L','Regaderas de referencia de 10 litros.'],['vasos de chupito',.04,'L','Vasos de referencia de 40 ml.'],['garrafas',8,'L','Garrafas de referencia de 8 litros.']]
};
const families=[
 [0,'area',155000,'la superficie de arena de Las Canteras'],[1,'mass',419725,'la masa de la Estación Espacial Internacional'],[2,'area',3.493*7.766,'la superficie del Guernica'],[4,'length',3715,'la altitud del Teide desde el nivel del mar'],[5,'area',7140,'la superficie del césped del Bernabéu'],[7,'mass',7300000,'la masa de la estructura metálica de la torre Eiffel'],[8,'length',172.5,'la altura de la torre principal de la Sagrada Família'],[9,'length',384400000,'la distancia media entre los centros de la Tierra y la Luna'],[10,'volume',320000,'la capacidad máxima de combustible de un Airbus A380'],[13,'volume',4129000000,'la cerveza fabricada en España en 2024'],[20,'volume',3900000,'el volumen de la piscina del Mundial de Singapur 2025']
];
// El cálculo de la plantilla hereda únicamente la fuente de la magnitud grande.
const model = {
  0: {
    explanation: 'El Ayuntamiento mide 3.100 m de playa. Para estimar la arena la representamos como una franja de 50 m de ancho, una hipótesis que da 155.000 m².',
    sources: [{title:'Ayuntamiento de Las Palmas de Gran Canaria · Las Canteras',url:'https://lpamar.laspalmasgc.es/las-playas/las-canteras',fact:'La playa cuenta con 3.100 metros lineales de arena.'}],
    assumptions: 'Los 50 m de ancho uniforme son un supuesto. La arena expuesta varía con el tramo y la marea.',
    rows: [{label:'Longitud de la playa',value:'3.100 m',source:1},{label:'Anchura de la franja',value:'× 50 m',assumed:true},{label:'Área estimada',value:'= 155.000 m²'}]
  },
  1: {explanation:'La NASA toma como referencia 419.725 kg para la estación. La masa depende de su configuración y de los vehículos acoplados.'},
  2: {
    explanation:'El Museo Reina Sofía publica las medidas del lienzo. Multiplicamos 3,493 m por 7,766 m para obtener su superficie de unos 27,13 m².',
    rows:[{label:'Altura del lienzo',value:'3,493 m',source:1},{label:'Anchura del lienzo',value:'× 7,766 m',source:1}]
  },
  4: {explanation:'El Centro Nacional de Información Geográfica sitúa la cima a 3.715 m sobre el nivel del mar. Comparamos ese desnivel con una fila vertical.'},
  5: {
    explanation:'LALIGA da 105 × 68 m para el terreno de juego. Su superficie rectangular es de 7.140 m².',
    rows:[{label:'Largo del campo',value:'105 m',source:1},{label:'Ancho del campo',value:'× 68 m',source:1}]
  },
  7: {
    explanation:'La ficha de la torre separa las 7.300 toneladas de estructura metálica de las 10.100 toneladas del conjunto. Usamos solo la estructura.',
    sources:[{title:'Tour Eiffel · La torre en cifras',url:'https://www.toureiffel.paris/en/the-monument/key-figures',fact:'La estructura metálica pesa 7.300 toneladas. La torre completa pesa 10.100 toneladas.'}],
    rows:[{label:'Masa de la estructura',value:'7.300 t',source:1},{label:'Kilogramos por tonelada',value:'× 1.000 kg/t'}]
  },
  8: {
    explanation:'La Sagrada Família alcanzó 172,5 m al instalar el brazo superior de la cruz de la torre de Jesucristo. Usamos esa altura hasta la cruz.',
    sources:[{title:'Sagrada Família · Construcción de la torre de Jesús',url:'https://blog.sagradafamilia.org/en/phases-construction-jesus-tower/',fact:'La instalación del brazo superior de la cruz llevó la altura de la torre a 172,5 m.'}]
  },
  9: {
    explanation:'El JPL de la NASA usa 384.400 km como distancia lunar de referencia. La separación real entre los centros cambia durante la órbita.',
    rows:[{label:'Distancia lunar de referencia',value:'384.400 km',source:1},{label:'Metros por kilómetro',value:'× 1.000 m/km'}]
  },
  10: {
    explanation:'El certificado EASA suma 324.339 litros utilizables, incluidos los sistemas. La plantilla redondea a 320.000 L.',
    sources:[{title:'EASA · Certificado de tipo del Airbus A380, § 3.3',url:'https://www.easa.europa.eu/en/downloads/7309/en',fact:'El A380-841 y el A380-842 tienen 324.339 litros de combustible utilizable contando los sistemas.'}],
    rows:[{label:'Capacidad utilizable redondeada',value:'≈ 320.000 L',source:1}]
  },
  13: {
    explanation:'El Ministerio de Agricultura y Cerveceros de España registran 41,29 millones de hectolitros de producción en 2024. Un hectolitro son 100 litros.',
    rows:[{label:'Producción en España en 2024',value:'41.290.000 hL',source:1},{label:'Litros por hectolitro',value:'× 100 L/hL'}]
  },
  20: {
    explanation:'World Aquatics da 50 × 26 × 3 m para la piscina de competición. El rectángulo de esas dimensiones contiene 3.900 m³, es decir, 3,9 millones de litros.',
    rows:[{label:'Largo, ancho y fondo',value:'50 m × 26 m × 3 m',source:1},{label:'Litros por metro cúbico',value:'× 1.000 L/m³'}]
  }
};
const equivalent = {
  area:'Dividimos el área grande entre la de una sola pieza. El resultado compara superficies, sin simular huecos ni recortes.',
  mass:'Ponemos ambas masas en kilogramos. Al dividir, vemos cuántas piezas del peso elegido equilibrarían la balanza.',
  length:'Ponemos ambas longitudes en metros y alineamos las piezas sin huecos. El cociente cuenta las piezas que cubrirían esa distancia.',
  volume:'Ponemos ambos volúmenes en litros. Dividimos la capacidad grande entre lo que cabe en un recipiente lleno.'
};
const cap=text=>text[0].toUpperCase()+text.slice(1);
const formatInput=new Intl.NumberFormat('es-ES',{maximumFractionDigits:12,useGrouping:'always'});
const formatResult=new Intl.NumberFormat('es-ES',{maximumSignificantDigits:3,useGrouping:'always'});
const numericExpression=n=>String(Number(n.toPrecision(14))).replace('.',',');

// Banco editorial finito: cada pareja de hecho y objeto aparece una vez.
const candidates=families.flatMap(([index,kind,anchor,label])=>units[kind].map(([object,size,unit,assumption],variant)=>{
  const parent=base[index],id=`daily-v1-${index}-${variant}`;
  const how=/^(maletas|bicicletas|tabletas|bolas|tarjetas|servilletas|esterillas|fichas|portadas|botellas|cajas|tazas|barajas|cañas|ollas|regaderas|garrafas)/.test(object)?'Cuántas':'Cuántos';
  const title=kind==='area'?`¿${how} ${object} sumarían ${label}?`:kind==='mass'?`¿${how} ${object} pesarían lo mismo que ${label.replace('la masa de ','')}?`:kind==='length'?`¿${how} ${object} en fila alcanzarían ${label}?`:`¿${how} ${object} podrías llenar con ${label}?`;
  const answer=anchor/size;
  const {explanation,sources=[parent.sources[0]],rows=[{label:cap(label),value:`${formatInput.format(anchor)} ${unit}`,source:1}],assumptions}=model[index];
  const division=`${formatInput.format(anchor)} ${unit} ÷ ${formatInput.format(size)} ${unit}`;
  return {
    ...parent,id,revision:1,title,detail:'',unit:object,answer,sources,
    math:`${explanation} ${division} ≈ ${formatResult.format(answer)} ${object}.`,
    referenceExpression:`${numericExpression(anchor)} ÷ ${numericExpression(size)}`,
    assumptions:[assumptions,assumption].filter(Boolean).join(' '),
    reasoning:{heading:'De la magnitud grande a las piezas',steps:[
      explanation,
      `${assumption} ${equivalent[kind]}`,
      `${division} da unas ${formatResult.format(answer)} unidades. Si cada pieza representara el doble de ${{area:'superficie',mass:'masa',length:'longitud',volume:'volumen'}[kind]}, harían falta la mitad.`
    ]},
    calc:{intro:explanation,rows:[...rows,{label:cap(object),value:`÷ ${formatInput.format(size)} ${unit}`,assumed:true}],result:cap(object)},
    family:index
  };
}));

// Las plantillas publicadas conservan su id y su respuesta. Se actualiza la
// explicación solo si coinciden las unidades y la cifra con la plantilla conocida.
const candidateById=new Map(candidates.map(candidate=>[candidate.id,candidate]));
export function refreshTemplateExplanation(question){
  const stem=/^(daily-v1-\d+-\d+)-[a-f0-9]{8}$/.exec(question?.id||'')?.[1];
  const candidate=candidateById.get(stem);
  if(!candidate||candidate.unit!==question.unit||question.revision!==candidate.revision
    ||!Number.isFinite(question.answer)||Math.abs(question.answer/candidate.answer-1)>1e-12)return question;
  const {math,referenceExpression,assumptions,reasoning,calc,sources}=candidate;
  return {...question,math,referenceExpression,assumptions,reasoning,calc,sources};
}
// Intercalar familias: cada jornada emplea tres referentes distintos.
const pool=[];for(let variant=0;variant<8;variant++)for(let k=0;k<families.length;k++)pool.push(candidates[k*8+variant]);
export function madridDate(date=new Date()){const parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'Europe/Madrid',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date).map(p=>[p.type,p.value]));return `${parts.year}-${parts.month}-${parts.day}`}
export function getDay(date,{persist=true,directory=process.env.DAYS_DIRECTORY||'runtime/days'}={}){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date))return null;
 const timestamp=Date.parse(date+'T12:00:00Z');if(!Number.isFinite(timestamp)||new Date(timestamp).toISOString().slice(0,10)!==date)return null;
 if(fixtures.has(date))return fixtures.get(date);
 const ordinal=Math.round((Date.parse(date+'T12:00:00Z')-start)/dayMs),offset=ordinal*3;
 if(ordinal<0||offset+3>pool.length)return null;
 const file=path.resolve(directory,date+'.json');if(persist&&fs.existsSync(file))return JSON.parse(fs.readFileSync(file,'utf8'));
 const questions=pool.slice(offset,offset+3).map(q=>({...q,id:q.id+'-'+createHash('sha256').update(date+q.id).digest('hex').slice(0,8)}));
 const day={id:date,name:new Intl.DateTimeFormat('es-ES',{weekday:'long',timeZone:'Europe/Madrid'}).format(new Date(date+'T12:00:00Z')),theme:questions.map(q=>q.tag).join(' · '),questions};
 if(persist){fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file+'.tmp',JSON.stringify(day));fs.renameSync(file+'.tmp',file)}return day;
}
// options se pasa a getDay: {persist:false} evita escribir en disco (p. ej. en Vercel, de solo lectura).
export function calendar(date=madridDate(),options={}){
 const end=Math.max(Date.parse('2026-11-15T12:00:00Z'),Date.parse(date+'T12:00:00Z'));
 const days=[];for(let i=29;i>=0;i--){const key=new Date(end-i*dayMs).toISOString().slice(0,10),day=getDay(key,options);if(day)days.push(day)}
 // Jornadas más antiguas que la ventana de 30 días: solo un resumen; el navegador pide la jornada completa a /api/day al abrirla.
 const from=new Date(end-29*dayMs).toISOString().slice(0,10);
 const older=editorialDays.filter(d=>d.id<from).map(d=>({id:d.id,name:d.name,theme:d.theme,categories:d.questions.map(q=>q.category)}));
 return {date,first:FIRST_DAY,days,archive:older,availableThrough:new Date(start+(Math.floor(pool.length/3)-1)*dayMs).toISOString().slice(0,10),generation:'verified-editorial-bank',exhausted:!getDay(date,options)};
}

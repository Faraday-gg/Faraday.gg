import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';

const original=JSON.parse(fs.readFileSync(new URL('./dist/questions.json',import.meta.url),'utf8'));
const base=original.flatMap(d=>d.questions);
// Archivo editorial: una jornada verificada por archivo en content/archivo/AAAA-MM-DD.json, anteriores al piloto.
const archiveDirectory=new URL('./content/archivo/',import.meta.url);
export const archive=fs.existsSync(archiveDirectory)?fs.readdirSync(archiveDirectory).filter(f=>/^\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort().map(f=>JSON.parse(fs.readFileSync(new URL(f,archiveDirectory),'utf8'))):[];
// Jornadas escritas a mano (archivo + piloto), por orden de fecha.
export const editorialDays=[...archive,...original].sort((a,b)=>a.id<b.id?-1:1);
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
// Banco editorial finito: cada pareja de hecho y objeto aparece una vez.
// No se presenta una remezcla repetida como contenido nuevo al agotarse.
const candidates=families.flatMap(([index,kind,anchor,label])=>units[kind].map(([object,size,unit,assumption],variant)=>{
 const parent=base[index],id=`daily-v1-${index}-${variant}`;
 const how=/^(maletas|bicicletas|tabletas|bolas|tarjetas|servilletas|esterillas|fichas|portadas|botellas|cajas|tazas|barajas|cañas|ollas|regaderas|garrafas)/.test(object)?'Cuántas':'Cuántos';
 const title=kind==='area'?`¿${how} ${object} sumarían ${label}?`:kind==='mass'?`¿${how} ${object} pesarían lo mismo que ${label.replace('la masa de ','')}?`:kind==='length'?`¿${how} ${object} en fila alcanzarían ${label}?`:`¿${how} ${object} podrías llenar con ${label}?`;
 const answer=anchor/size;
 return {...parent,id,revision:1,title,detail:'',unit:object,answer,math:`La magnitud de referencia es ${anchor.toLocaleString('es-ES')} ${unit}. Cada unidad del modelo representa ${size.toLocaleString('es-ES')} ${unit}. El cociente es ${answer.toLocaleString('es-ES',{maximumFractionDigits:6})}.`,referenceExpression:`${anchor.toLocaleString('es-ES')} ÷ ${size.toLocaleString('es-ES')}`,assumptions:`${assumption} Comparamos magnitudes equivalentes; no contamos huecos, pérdidas, deformaciones ni recipientes parcialmente llenos. El tamaño del objeto es un supuesto del modelo, no una medida universal.`,reasoning:{heading:'Separa la gran magnitud del objeto cotidiano',steps:[`Empieza por imaginar ${label}. Busca una escala conocida que te ayude a estimarla antes de hacer operaciones. La foto orienta sobre el contexto, pero no es una medición.`,`Ahora estima cuánto representa una sola unidad de «${object}». Trabaja en la misma unidad que la magnitud grande. Un error al convertir centímetros, litros o toneladas puede desplazar la respuesta por factores de mil.`,`Con los datos documentados y el objeto elegido como referencia, dividimos ${anchor.toLocaleString('es-ES')} entre ${size.toLocaleString('es-ES')}. El resultado es ${answer.toLocaleString('es-ES',{maximumFractionDigits:2})}. Si el objeto real fuera un 20% mayor, necesitaríamos aproximadamente un 17% menos: ese supuesto pesa más que los últimos decimales.`]},family:index};
}));
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

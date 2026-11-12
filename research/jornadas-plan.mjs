// Genera research/jornadas-plan.json: el plan de las jornadas escritas a mano del 16 de noviembre al 14 de diciembre de 2026
// (decisión 0046). El ámbito de cada posición sale del mismo sorteo que usa el generador diario (ambitos() de lib/generar.mjs);
// aquí se reparte cada referente en un hueco de su ámbito, con tres categorías distintas por día.
//   node research/jornadas-plan.mjs
import fs from 'node:fs';
import {ambitos,addDays} from '../lib/generar.mjs';

// [categoría, referente e idea, lleva foto]
const pools={
  latam:[
    ['naturaleza','Aconcagua (Argentina): alfajores apilados hasta su cumbre',1],
    ['arquitectura','Obelisco de Buenos Aires: personas subidas a hombros hasta la punta',1],
    ['historia','Pirámide del Sol de Teotihuacan (México): piscinas olímpicas de tierra que caben en su volumen',1],
    ['deportes','«Gol del siglo» de Maradona en México 86: velocidad media de la carrera comparada con algo cotidiano',0],
    ['cultura','«Despacito» (Luis Fonsi y Daddy Yankee): si cada reproducción en YouTube durara un segundo, cuántos años',0],
    ['naturaleza','Cataratas del Iguazú: bañeras por segundo de caudal medio',1],
    ['lugares','Salto Ángel (Venezuela): jirafas apiladas para igualar su caída',1],
    ['espacio','Telescopio ELT en Atacama (Chile): pizzas familiares que cubrirían su espejo de 39 m',0],
    ['lugares','Hundimiento de Ciudad de México: años que tarda en hundirse lo que mide una persona',0],
    ['naturaleza','Tortugas gigantes de Galápagos (Ecuador): cuántas pesan lo mismo que un auto pequeño',0],
    ['comida','Tequila: botellas que salen de una piña de agave azul',0],
    ['comida','Aguacates de México: guacamole que se come en EE. UU. el fin de semana del Super Bowl, en piscinas olímpicas',0],
    ['hogar','Yerba mate en Argentina: kilos al año por persona, en mates cebados',0],
    ['deportes','Festejo de Argentina campeona del mundo 2022 en Buenos Aires: cuántas Bomboneras llenas',0],
    ['transporte','Mi Teleférico de La Paz y El Alto (Bolivia): kilómetros de la red y viajes al día',1],
    ['transporte','TransMilenio de Bogotá (Colombia): pasajeros al día comparados con la población de un país',0],
    ['historia','Colibrí de las líneas de Nazca (Perú): cuántos colibríes reales en fila miden lo que el geoglifo',1],
    ['lugares','Murallas de Cartagena de Indias (Colombia): personas de la mano para rodearlas',1],
    ['cultura','Día de Muertos: flores de cempasúchil que se cosechan en México, comparadas con algo cotidiano',0],
    ['cuerpo','Corredores rarámuri (México): pasos en una carrera de 100 km con sandalias',0]
  ],
  espana:[
    ['cultura','Las Meninas de Velázquez: cuántas hojas de papel o teléfonos cubren el cuadro',1],
    ['deportes','Pau Gasol en la NBA: puntos totales convertidos en algo cotidiano',0],
    ['arquitectura','Mezquita-catedral de Córdoba: columnas del bosque de columnas en fila',1],
    ['lugares','Gran Vía de Madrid: churros puestos en fila de punta a punta',0],
    ['cultura','Rosalía: reproducciones de una canción famosa convertidas en algo cotidiano',0],
    ['dinero','Zara (Inditex): prendas vendidas por segundo',0],
    ['transporte','AVE Madrid-Barcelona: cuántas veces más rápido que ir caminando',0],
    ['naturaleza','Olivos de España: olivos por habitante',0],
    ['espacio','Gran Telescopio Canarias (La Palma): espejo de 10,4 m cubierto de algo cotidiano',0],
    ['comida','Chupa Chups (logotipo de Dalí): chupetines vendidos al día',0],
    ['dinero','Lotería de Navidad, «El Gordo»: décimos emitidos apilados o en fila',0],
    ['transporte','SEAT 600: unidades fabricadas puestas en fila',0],
    ['cultura','Encierro de San Fermín (875 m): velocidad de los toros comparada con algo cotidiano',0]
  ],
  mundial:[
    ['arquitectura','Burj Khalifa (Dubái): hamburguesas apiladas hasta la punta',0],
    ['arquitectura','Taj Mahal (India): baldosas de mármol o algo cotidiano en su superficie',0],
    ['arquitectura','Big Ben (Londres): campanadas al año',0],
    ['arquitectura','Empire State Building: escalones de la carrera anual y pisos por minuto',0],
    ['arquitectura','Puente de Brooklyn: cables o personas que lo cruzan',0],
    ['historia','Ciudad Prohibida (Pekín): años durmiendo una noche en cada habitación',1],
    ['historia','Muro de Berlín: personas de la mano a lo largo de su recorrido',0],
    ['historia','Monte Rushmore: narices humanas que caben en la nariz de un presidente',1],
    ['historia','Cleopatra: más cerca en el tiempo del primer iPhone que de la Gran Pirámide, años de diferencia',0],
    ['cultura','Obras completas de Shakespeare: horas leyendo en voz alta',0],
    ['cultura','Canciones de los Beatles: horas de escucha seguida',0],
    ['cultura','«Thriller» de Michael Jackson: discos vendidos apilados',0],
    ['cultura','Pokémon: horas para atrapar a todas las especies a un ritmo fijo',0],
    ['cultura','Obras de Mozart: minutos de música compuestos por cada año de vida',0],
    ['tecnologia','Búsquedas en Google por segundo',0],
    ['tecnologia','Mensajes de WhatsApp al día por persona del planeta',0],
    ['tecnologia','Cables submarinos de internet: vueltas a la Tierra',0],
    ['tecnologia','Horas de video que se suben a YouTube por minuto',0],
    ['tecnologia','Satélites Starlink en órbita: cuántos por país del mundo',0],
    ['deportes','Kipchoge y la maratón en menos de 2 horas: ritmo frente a algo cotidiano',0],
    ['deportes','Pelé y sus goles: minutos de celebración',0],
    ['deportes','Parada en boxes de Fórmula 1: neumáticos cambiados en el tiempo de algo cotidiano',0],
    ['deportes','Maratón de Nueva York: corredores en fila',0],
    ['dinero','Anuncios del Super Bowl: dólares por segundo',0],
    ['dinero','Billetes de Monopoly impresos frente a billetes reales',0],
    ['dinero','Billetes de 100 dólares en circulación apilados',0],
    ['naturaleza','Monte Fuji: escalones de escalera hasta la cima',0],
    ['naturaleza','Gran Barrera de Coral: canchas de fútbol que caben en ella',1],
    ['naturaleza','Secuoya General Sherman: lápices que saldrían de su madera',1],
    ['naturaleza','Elefante africano: comida al día en algo cotidiano',0],
    ['naturaleza','Guepardo: velocidad punta frente a un auto o una persona',0],
    ['espacio','Júpiter: cuántas Tierras caben',0],
    ['espacio','Telescopio James Webb: parasol del tamaño de una cancha de tenis, toallas que lo cubren',1],
    ['espacio','Starship de SpaceX: personas apiladas hasta su punta',0],
    ['espacio','Asteroide de los dinosaurios: tamaño frente a algo cotidiano o una ciudad',0],
    ['espacio','Día en Marte: minutos de más frente al día terrestre, sumados en un año',0],
    ['transporte','Bicicletas en Ámsterdam: bicis por habitante',0],
    ['transporte','Ruta 66: días en bicicleta',0],
    ['transporte','Canal de Suez: barcos al día',0],
    ['transporte','Ascensores Otis: personas que transportan al día frente a la población mundial',0],
    ['comida','Nutella: frascos al año en fila',0],
    ['comida','Fideos instantáneos (ramen): raciones al año por persona',0],
    ['comida','Kétchup Heinz: botellas al año',0],
    ['comida','Bananas producidas en el mundo al año, en fila',0],
    ['hogar','Estantería Billy de IKEA: cada cuántos segundos se vende una',0],
    ['hogar','Papel higiénico: rollos que usa una persona al año, desenrollados',0],
    ['hogar','Cepillarse los dientes: días enteros cepillándose en toda una vida',0],
    ['cuerpo','Piel muerta que suelta una persona en toda su vida',0],
    ['cuerpo','Vasos sanguíneos de una persona: vueltas a la Tierra',0],
    ['cuerpo','Encogemos durante el día: cuánto más alto eres al despertar, en hojas de papel apiladas',0],
    ['lugares','Times Square: visitantes al día comparados con una ciudad',0],
    ['lugares','Venecia: puentes que cruzarías en un paseo por todos',0],
    ['lugares','Central Park: campos de fútbol que caben',0],
    ['lugares','Palm Jumeirah (Dubái): camiones de arena',1]
  ]
};

// Barajado con semilla fija, para que el plan sea reproducible.
let seed=20261116;const random=()=>(seed=(seed*1103515245+12345)%2147483648)/2147483648;
for(const key in pools)pools[key].sort(()=>random()-.5);

const dates=[...Array(29)].map((_,i)=>addDays('2026-11-16',i)),plan=[];
function solve(d){
  if(d===dates.length)return true;
  const slots=ambitos(dates[d]);
  const pick=(i,used,chosen)=>{
    if(i===3){plan.push({date:dates[d],questions:chosen});if(solve(d+1))return true;plan.pop();return false}
    const pool=pools[slots[i]];
    for(let j=0;j<pool.length;j++){
      const item=pool[j];if(used.has(item[0]))continue;
      pool.splice(j,1);used.add(item[0]);
      if(pick(i+1,used,[...chosen,{position:i+1,ambito:slots[i],category:item[0],idea:item[1],photo:!!item[2]}]))return true;
      used.delete(item[0]);pool.splice(j,0,item);
    }
    return false;
  };
  return pick(0,new Set(),[]);
}
if(!solve(0))throw Error('No hay reparto posible con tres categorías distintas por día');
fs.writeFileSync(new URL('./jornadas-plan.json',import.meta.url),JSON.stringify(plan,null,2)+'\n');
const all=plan.flatMap(d=>d.questions);
console.log(`Plan: ${plan.length} jornadas, ${all.length} preguntas, ${all.filter(q=>q.photo).length} con foto; sobran ${Object.values(pools).flat().length} referentes.`);

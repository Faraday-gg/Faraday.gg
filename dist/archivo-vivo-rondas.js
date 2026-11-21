export const MIN_YEAR = 1840;
export const MAX_YEAR = 2020;
export const MAX_POINTS = 1000;
export const INITIAL_SCENE_IDS = ['11', '01', '03'];
const DAILY_COLLECTIONS = [
  INITIAL_SCENE_IDS,
  ['07', '13', '09'],
  ['12', '03', '01']
];
const LAUNCH = Date.parse('2026-11-21');

export function initialSceneIdsForDay(day) {
  const offset = Math.floor((Date.parse(day) - LAUNCH) / 86_400_000);
  return DAILY_COLLECTIONS[Math.max(0, offset) % DAILY_COLLECTIONS.length] ?? INITIAL_SCENE_IDS;
}

export const scoreYear = (guess, year) => Math.round(MAX_POINTS * Math.exp(-Math.abs(guess - year) / 12));

export const scenes = [
  {
    id: '01',
    alt: 'Peatones con sombreros y vestidos estampados cruzan una calle adoquinada con tranvías.',
    type: 'reconstruction',
    year: 1940,
    title: 'El cruce de State Street',
    place: 'Chicago, Estados Unidos',
    story: 'John Vachon fotografió a los peatones del centro de Chicago en julio de 1940 para la Farm Security Administration. Por la calle circulaban tranvías y la esquina estaba cubierta de marquesinas.',
    detail: 'Fíjate en las vías incrustadas en el pavimento, los tranvías y los sombreros de los peatones.',
    credit: 'John Vachon / Library of Congress',
    rights: 'Sin restricciones conocidas',
    source: 'https://www.loc.gov/resource/fsa.8a06473/',
    ground: {
      surface: 'Acera de State Street', eyeHeight: 1.62, shadow: 0.32,
      reference: 'https://www.loc.gov/item/2017720270/'
    },
    yaw: 0,
    pitch: -0.05
  },
  {
    id: '02',
    alt: 'Un vehículo pequeño con ruedas junto a un fondo de polvo, piedras y un cielo oscuro.',
    type: 'archive',
    year: 1972,
    title: 'Una estación científica en la Luna',
    place: 'Tierras altas de Descartes, Luna',
    story: 'En abril de 1972, la tripulación del Apolo 16 utilizó un vehículo eléctrico para desplazarse por la Luna. Estas tomas muestran el lugar donde instaló instrumentos para medir, entre otras cosas, la actividad sísmica lunar.',
    detail: 'Busca las antenas del vehículo y el contraste entre el suelo polvoriento y el cielo completamente oscuro.',
    credit: 'NASA / John Young y Charlie Duke. Montaje de Eric Jones',
    rights: 'Dominio público (EE. UU.)',
    source: 'https://commons.wikimedia.org/wiki/File:Apollo_16_-_ALSEP_Pan_HR_2_panorama.jpg',
    yaw: -1.95,
    pitch: -0.065
  },
  {
    id: '03',
    alt: 'Cinco tranvías de frente bajo la cubierta metálica de una cochera, con números sobre los parabrisas.',
    type: 'reconstruction',
    year: 1982,
    title: 'Los tranvías que se quedaron en la cochera',
    place: 'Ámsterdam, Países Bajos',
    story: 'El 22 de noviembre de 1982, Marcel Antonisse fotografió los tranvías estacionados en la cochera de la calle Lekstraat durante las protestas contra la congelación de los salarios del sector público.',
    detail: 'Las ventanas cuadradas, los faros redondos y los números de línea sobre el parabrisas dan pistas sobre la generación de estos tranvías.',
    credit: 'Marcel Antonisse / Anefo / Nationaal Archief',
    rights: 'CC0 1.0',
    source: 'https://commons.wikimedia.org/wiki/File:Trams_in_de_remise_in_de_Lekstraat,_Bestanddeelnr_932-4096.jpg',
    ground: {
      surface: 'Pasillo de ladrillo de la cochera', eyeHeight: 1.62, shadow: 0.30,
      reference: 'https://monumentenregister.cultureelerfgoed.nl/monumenten/526708'
    },
    yaw: 0,
    pitch: -0.03
  },
  {
    id: '04',
    alt: 'Una multitud con sombreros, sombrillas y vestidos largos se reúne frente a un edificio de piedra.',
    type: 'reconstruction',
    year: 1865,
    title: 'La multitud del gran desfile',
    place: 'Washington D. C., Estados Unidos',
    story: 'En mayo de 1865, tras el final de la Guerra de Secesión, Washington recibió a los ejércitos de la Unión con un gran desfile. Esta toma muestra a quienes esperaban el paso de la comitiva.',
    detail: 'Los sombreros de copa, las sombrillas y las faldas anchas aparecen juntos en la foto.',
    credit: 'Autoría sin identificar / Library of Congress',
    rights: 'Sin restricciones conocidas',
    source: 'https://www.loc.gov/pictures/item/2013649000/',
    yaw: 0,
    pitch: -0.12
  },
  {
    id: '05',
    alt: 'Una gran estructura de hierro en obras con cuatro patas inclinadas y un entramado de andamios.',
    type: 'reconstruction',
    year: 1888,
    title: 'Una torre todavía por terminar',
    place: 'París, Francia',
    story: 'Théophile Féau fotografió la construcción de la torre Eiffel en distintas etapas. El 10 de mayo de 1888 todavía faltaba gran parte de la estructura, que se inauguró al año siguiente.',
    detail: 'La primera plataforma ya une las patas de hierro. Por encima todavía se ven los extremos separados.',
    credit: 'Théophile Féau / Paris Musées, Musée Carnavalet',
    rights: 'CC0 1.0',
    source: 'https://parismuseescollections.paris.fr/en/node/461661',
    yaw: 0,
    pitch: -0.08
  },
  {
    id: '06',
    alt: 'Elefantes, cebras y sus cuidadores posan delante de un gran arco decorado junto a una farola.',
    type: 'reconstruction',
    year: 1893,
    title: 'Un espectáculo en la feria',
    place: 'Chicago, Estados Unidos',
    story: 'Frances Benjamin Johnston fotografió esta fila de animales y sus cuidadores en el Midway, la zona de espectáculos de la Exposición Colombina de Chicago de 1893.',
    detail: 'Además de los elefantes y las cebras, busca los bombines del público y la farola junto al pabellón.',
    credit: 'Frances Benjamin Johnston / Library of Congress',
    rights: 'Sin restricciones conocidas',
    source: 'https://www.loc.gov/resource/ds.14184/',
    yaw: 0,
    pitch: -0.10
  },
  {
    id: '07',
    alt: 'Un camino estrecho en zigzag sube entre muros de piedra, ropa tendida y varias casas.',
    type: 'reconstruction',
    year: 1852,
    title: 'Un camino entre molinos',
    place: 'Grasse, Francia',
    story: 'En 1852, Charles Nègre fotografió esta calle de su ciudad natal. La copia en papel salado conserva el juego de luces y sombras entre el camino, los molinos y las viviendas.',
    detail: 'Mira la ropa tendida en los muros y el camino sin asfaltar. El papel salado también da una pista sobre la antigüedad de la toma.',
    credit: 'Charles Nègre / The Metropolitan Museum of Art',
    rights: 'Dominio público · Open Access',
    source: 'https://www.metmuseum.org/art/collection/search/283736',
    ground: {
      surface: 'Camino de tierra junto al muro', eyeHeight: 1.62, shadow: 0.28,
      reference: 'https://www.metmuseum.org/art/collection/search/283736'
    },
    yaw: 0,
    pitch: -0.10
  },
  {
    id: '08',
    alt: 'Tres hombres sentados en un escalón y dos mujeres que pasan junto a un automóvil en una calle adoquinada.',
    type: 'reconstruction',
    year: 1938,
    title: 'Un momento en la acera',
    place: 'San Juan, Puerto Rico',
    story: 'Edwin Rosskam fotografió esta escena de San Juan en enero de 1938. El negativo se conserva en la colección de la Farm Security Administration y la Office of War Information.',
    detail: 'Fíjate en la carrocería redondeada que cruza en primer plano y en el ala de los sombreros.',
    credit: 'Edwin Rosskam / Library of Congress, FSA-OWI',
    rights: 'Dominio público · Sin restricciones conocidas',
    source: 'https://www.loc.gov/resource/fsa.8b30615/',
    yaw: 0,
    pitch: -0.11
  },
  {
    id: '09',
    alt: 'Tres personas vigilan pantallas y teclados en una sala con un gran mapa proyectado al fondo.',
    type: 'reconstruction',
    year: 2001,
    title: 'La estación espacial desde Houston',
    place: 'Houston, Estados Unidos',
    story: 'El 16 de agosto de 2001, el equipo de control de la NASA siguió los datos de la Estación Espacial Internacional durante la misión STS-105.',
    detail: 'Los monitores gruesos, el teléfono de sobremesa con cable y los teclados separados son pistas de la época.',
    credit: 'NASA / Johnson Space Center',
    rights: 'Dominio público (EE. UU.)',
    source: 'https://www.nasa.gov/image-article/space-station-flight-control-room/',
    ground: {
      surface: 'Pasillo enmoquetado detrás de los puestos', eyeHeight: 1.62, shadow: 0.38,
      reference: 'https://historycollection.jsc.nasa.gov/JSCHistoryPortal/history/oral_histories/HeflinJM/HeflinJM_6-3-03.pdf'
    },
    yaw: 0,
    pitch: -0.05
  },
  {
    id: '10',
    alt: 'Una ciudad con calles en cuesta y casas bajas se extiende hasta una bahía con barcos de vela.',
    type: 'archive',
    year: 1878,
    title: 'Una ciudad alrededor de una colina',
    place: 'San Francisco, Estados Unidos',
    story: 'En 1878, Eadweard Muybridge fotografió San Francisco desde Nob Hill. Las trece placas de su panorama recorren la ciudad entera desde el mismo punto de vista.',
    detail: 'Busca los veleros en la bahía, las calles empinadas y la ausencia de edificios altos.',
    credit: 'Eadweard Muybridge / Society of California Pioneers. Digitalización de Gawain Weaver',
    rights: 'Dominio público',
    source: 'https://commons.wikimedia.org/wiki/File:Panorama_of_San_Francisco_by_Eadweard_Muybridge,_1878.jpg',
    yaw: 0.58,
    pitch: -0.04,
    archivePitchLimit: 0.12,
    archiveField: 0.29
  },
  {
    id: '11',
    alt: 'Caballos y carros junto a una calle ancha con una farola, almacenes y mástiles al fondo.',
    type: 'reconstruction',
    year: 1865,
    title: 'Los carros de Dock Street',
    place: 'Richmond, Estados Unidos',
    story: 'La Library of Congress conserva esta fotografía de Dock Street, tomada en abril de 1865. Los caballos y los carros aparecen alineados junto a la zona portuaria.',
    detail: 'Fíjate en las ruedas de radios, la farola y los aparejos que sobresalen al fondo.',
    credit: 'Autoría sin identificar / Library of Congress',
    rights: 'Sin restricciones conocidas',
    source: 'https://www.loc.gov/item/2014645787/',
    ground: {
      surface: 'Calzada de piedra y tierra junto al muelle', eyeHeight: 1.62, shadow: 0.32,
      reference: 'https://www.loc.gov/pictures/resource/ppmsca.34849/'
    },
    yaw: 0,
    pitch: -0.05
  },
  {
    id: '12',
    alt: 'Un puesto de verduras con cestas y un toldo de lona ocupa una esquina junto a la acera.',
    type: 'reconstruction',
    year: 1898,
    title: 'Un puesto en Les Halles',
    place: 'París, Francia',
    story: 'Eugène Atget fotografió a una vendedora de verduras en 1898, en la esquina de las calles Vauvilliers y de l’Arbre-Sec. El Musée Carnavalet conserva varias tomas de esa esquina.',
    detail: 'Las cestas de mimbre, los toldos y los carteles pegados a la fachada dan pistas.',
    credit: 'Eugène Atget / Paris Musées, Musée Carnavalet',
    rights: 'CC0 1.0',
    source: 'https://www.parismuseescollections.paris.fr/fr/musee-carnavalet/oeuvres/coin-de-la-rue-vauvillers-1898',
    ground: {
      surface: 'Adoquines junto al bordillo del mercado', eyeHeight: 1.62, shadow: 0.30,
      reference: 'https://www.parismuseescollections.paris.fr/fr/musee-carnavalet/oeuvres/les-halles-coin-de-la-rue-vauvilliers-1898'
    },
    yaw: 0,
    pitch: -0.06
  },
  {
    id: '13',
    alt: 'Peatones y automóviles recorren una calle estrecha con balcones de hierro y toldos.',
    type: 'reconstruction',
    year: 1941,
    title: 'Una calle de tiendas en San Juan',
    place: 'San Juan, Puerto Rico',
    story: 'Jack Delano fotografió el distrito comercial de San Juan en diciembre de 1941. La serie muestra las tiendas y el tránsito entre los balcones de las calles estrechas.',
    detail: 'Los guardabarros redondeados de los coches y los toldos de las tiendas dan pistas sobre la época.',
    credit: 'Jack Delano / Library of Congress, FSA-OWI',
    rights: 'Dominio público · Sin restricciones conocidas',
    source: 'https://www.loc.gov/item/2017797137/',
    ground: {
      surface: 'Acera de cemento del distrito comercial', eyeHeight: 1.62, shadow: 0.32, horizon: 0.61,
      reference: 'https://www.loc.gov/pictures/item/2017797131/'
    },
    yaw: 0,
    pitch: -0.04
  }
];

// Las fotos retiradas siguen disponibles para las partidas guardadas.
export const activeSceneIds = scenes.filter(scene => scene.ground).map(scene => scene.id);

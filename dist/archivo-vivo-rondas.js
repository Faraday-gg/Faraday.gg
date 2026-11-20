export const MIN_YEAR = 1900;
export const MAX_YEAR = 2000;
export const MAX_POINTS = 1000;
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
    yaw: 0.1,
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
    yaw: 0,
    pitch: -0.03
  }
];

// Categorías de las preguntas: cada pregunta lleva una en el campo «category».
// «tone» es el color de la tarjeta de pregunta (decisión 0018): seis tonos vivos agrupados por tema.
// Los iconos son trazos propios de 24 × 24 que heredan el color del texto.
window.CATEGORIES = {
  deportes:{label:'Deportes',color:'blue',tone:'rosa',icon:'<circle cx="12" cy="12" r="9"/><path d="M12 7.5l4 2.9-1.5 4.7h-5L8 10.4z"/><path d="M12 3v4.5M16 10.4l4.3-1.4M14.5 15.1l2.7 3.7M9.5 15.1l-2.7 3.7M8 10.4 3.7 9"/>'},
  comida:{label:'Comida',color:'yellow',tone:'mostaza',icon:'<path d="M3 11h18a9 9 0 0 1-18 0z"/><path d="M8 7c-1-1.5 1-2.5 0-4M12 7c-1-1.5 1-2.5 0-4M16 7c-1-1.5 1-2.5 0-4"/>'},
  espacio:{label:'Espacio',color:'blue',tone:'cian',icon:'<circle cx="12" cy="12" r="5.5"/><path d="M6.6 14.6C3.4 16.9 2.2 19 3.2 19.8c1.6 1.2 6.6-1 11.2-4.9s7.4-8.2 6.4-9.6c-.6-.8-2.3-.4-4.6.9"/>'},
  naturaleza:{label:'Naturaleza',color:'paper',tone:'verde',icon:'<path d="M5 19C5 10 10 5 20 4c-1 10-6 15-15 15z"/><path d="M5 19 13 11"/>'},
  lugares:{label:'Lugares',color:'yellow',tone:'coral',icon:'<path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>'},
  arquitectura:{label:'Arquitectura',color:'paper',tone:'coral',icon:'<path d="M3 9.5 12 4l9 5.5zM4 20h16M5.5 10v8M9.8 10v8M14.2 10v8M18.5 10v8"/>'},
  cultura:{label:'Cultura',color:'yellow',tone:'violeta',icon:'<path d="M12 3a9 9 0 1 0 0 18c1.4 0 2-1 1.6-2.1-.5-1.3.4-2.4 1.7-2.4H18a3 3 0 0 0 3-3C21 7.9 17 3 12 3z"/><circle cx="7.5" cy="11" r="1.2"/><circle cx="10.5" cy="7" r="1.2"/><circle cx="15.5" cy="8" r="1.2"/>'},
  historia:{label:'Historia',color:'paper',tone:'violeta',icon:'<path d="M9 3h6M10 3v3c-3 1.5-4 4.5-3 8 .6 2.2 2 4 2 5.5V21h6v-1.5c0-1.5 1.4-3.3 2-5.5 1-3.5 0-6.5-3-8V3"/><path d="M7.4 9.2c-2 .2-2.3 3-.8 4M16.6 9.2c2 .2 2.3 3 .8 4"/>'},
  transporte:{label:'Transporte',color:'blue',tone:'cian',icon:'<rect x="5" y="3" width="14" height="14" rx="3"/><path d="M5 11h14M8.5 14h.01M15.5 14h.01M8 17l-2 4M16 17l2 4"/>'},
  tecnologia:{label:'Tecnología',color:'blue',tone:'cian',icon:'<rect x="4" y="5" width="16" height="10" rx="1.5"/><path d="M2 19h20"/>'},
  cuerpo:{label:'Cuerpo humano',color:'paper',tone:'verde',icon:'<path d="M12 20s-8-4.8-8-10.5A4.5 4.5 0 0 1 12 7a4.5 4.5 0 0 1 8 2.5C20 15.2 12 20 12 20z"/>'},
  dinero:{label:'Dinero',color:'yellow',tone:'mostaza',icon:'<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5a4 4 0 1 0 0 7M7.5 11h6M7.5 13.5h6"/>'},
  hogar:{label:'Vida cotidiana',color:'paper',tone:'rosa',icon:'<path d="M3 11 12 4l9 7M5.5 9.5V20h13V9.5M10 20v-5h4v5"/>'}
};
window.categoryIcon = (key, className='cat-icon') => {
  const category = window.CATEGORIES[key];
  if(!category) return '';
  return `<span class="${className} cat-${category.color}" title="${category.label}"><svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${category.icon}</svg></span>`;
};

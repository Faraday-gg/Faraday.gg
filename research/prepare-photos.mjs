import fs from 'node:fs';
const days=JSON.parse(fs.readFileSync('dist/questions.json','utf8'));
const topics=[null,'International Space Station','Museo Nacional Centro de Arte Reina Sofía','Adolfo Suárez Madrid–Barajas Airport','Teide','Santiago Bernabéu Stadium','Royal Palace of Madrid','Eiffel Tower','Sagrada Família','Croquette','Airbus A380','Lego','Rubik’s Cube','Beer','La Tomatina','Royal Library of the Monastery of El Escorial','Suez Canal','Nintendo DS','Spanish Christmas Lottery','Ocean','Espresso'];
const fallback={11:'Lego brick',12:"Rubik's Cube",15:'El Escorial'};
const strip=t=>String(t||'').replace(/<[^>]*>/g,'').replace(/&amp;/g,'&').replace(/&#[^;]+;/g,'').trim();
const manifest={};
for(let index=1;index<topics.length;index++){
  const q=days.flatMap(d=>d.questions)[index];
  try{
    let summary=await(await fetch('https://en.wikipedia.org/api/rest_v1/page/summary/'+encodeURIComponent(topics[index]))).json();
    if((!summary.thumbnail||summary.thumbnail.source.includes('.svg'))&&fallback[index])summary=await(await fetch('https://en.wikipedia.org/api/rest_v1/page/summary/'+encodeURIComponent(fallback[index]))).json();
    const thumb=summary.thumbnail?.source;if(!thumb||thumb.includes('.svg'))throw Error('Sin fotografía adecuada');
    const parsed=new URL(thumb);if(!parsed.pathname.includes('/commons/'))throw Error('Imagen fuera de Commons');
    const file=decodeURIComponent(parsed.pathname.split('/').at(-2));
    const api='https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo&iiprop=url%7Cextmetadata&iiurlwidth=1000&titles='+encodeURIComponent('File:'+file);
    const result=await(await fetch(api)).json(),info=Object.values(result.query.pages)[0].imageinfo?.[0];
    if(!info)throw Error('Sin ficha de derechos');
    const meta=info.extmetadata,license=strip(meta.LicenseShortName?.value);
    if(!/CC|Public domain/i.test(license))throw Error('Licencia no compatible: '+license);
    const response=await fetch(info.thumburl||info.url);if(!response.ok)throw Error(response.status);
    const src=`assets/question-${index+1}.jpg`;fs.writeFileSync('dist/'+src,Buffer.from(await response.arrayBuffer()));
    q.image={src,alt:`Fotografía de referencia: ${topics[index]}`,credit:strip(meta.Artist?.value).slice(0,180)||'Wikimedia Commons',url:info.descriptionurl,license,licenseUrl:meta.LicenseUrl?.value||info.descriptionurl};
    manifest[q.id]=q.image;console.log(index+1,topics[index],license);
  }catch(error){console.log('REVISAR',index+1,topics[index],error.message)}
}
fs.writeFileSync('research/photo-manifest.json',JSON.stringify(manifest,null,2));
fs.writeFileSync('dist/questions.json',JSON.stringify(days,null,2));fs.writeFileSync('dist/questions.js','window.PILOT_DAYS = '+JSON.stringify(days,null,2)+';\n');

// Busca y descarga fotos de Wikimedia Commons con licencia libre para las preguntas.
//   node research/foto-commons.mjs buscar "Acueducto de Segovia"
//   node research/foto-commons.mjs bajar "File:Nombre.jpg" 2026-08-09 1
// «bajar» guarda dist/assets/archivo-AAAA-MM-DD-N.jpg (o .png si Commons sirve PNG), de 800 px de ancho como máximo para no engordar el repositorio, e imprime
// el objeto image para la pregunta, con autoría y licencia tomadas de Commons. Falta añadir «alt».
// Solo acepta licencias que permiten reutilizar con atribución: CC BY, CC BY-SA, CC0 y dominio público.
import fs from 'node:fs';

const API='https://commons.wikimedia.org/w/api.php';
const headers={'User-Agent':'FaradayGG-contenido/1.0 (https://github.com/Faraday-gg/Faraday.gg)'};
const strip=t=>String(t||'').replace(/<[^>]*>/g,'').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#039;/g,"'").replace(/\s+/g,' ').trim();
const free=license=>/^(CC BY(-SA)? [\d.]+|CC0|Public domain|PD)/i.test(license)&&!/NC|ND/.test(license);

async function query(params){
  const url=new URL(API);url.search=new URLSearchParams({action:'query',format:'json',prop:'imageinfo',iiprop:'url|extmetadata|size|mime',iiurlwidth:'800',...params});
  const response=await fetch(url,{headers});if(!response.ok)throw Error('Commons respondió '+response.status);
  return Object.values((await response.json()).query?.pages||{});
}
function describe(page){
  const info=page.imageinfo?.[0];if(!info)return null;const m=info.extmetadata||{};
  return {title:page.title,license:strip(m.LicenseShortName?.value),licenseUrl:m.LicenseUrl?.value||info.descriptionurl,credit:strip(m.Artist?.value).replace(/^(.{4,}?)\1.*$/,'$1').replace(/^Unknown author.*$/,'Autor desconocido · Wikimedia Commons').slice(0,160)||'Wikimedia Commons',url:info.descriptionurl,thumb:info.thumburl||info.url,mime:info.mime,width:info.width,height:info.height};
}

const [mode,arg,date,position]=process.argv.slice(2);
if(mode==='buscar'&&arg){
  const pages=await query({generator:'search',gsrsearch:arg+' filetype:bitmap',gsrnamespace:'6',gsrlimit:'15'});
  const found=pages.map(describe).filter(d=>d&&free(d.license)&&/jpeg|png/.test(d.mime)&&d.width>=800);
  if(!found.length)console.log('Sin resultados libres. Prueba otra búsqueda (en inglés suele haber más).');
  for(const d of found)console.log(`${d.title}\n   ${d.license} · ${d.width}×${d.height} · ${d.credit.slice(0,70)}`);
}else if(mode==='bajar'&&arg&&/^\d{4}-\d{2}-\d{2}$/.test(date||'')&&/^[1-3]$/.test(position||'')){
  const [page]=await query({titles:arg.startsWith('File:')?arg:'File:'+arg});const d=page&&describe(page);
  if(!d)throw Error('No existe ese archivo en Commons: '+arg);
  if(!free(d.license))throw Error(`Licencia no válida para el juego: «${d.license}». Busca otra foto.`);
  if(!/jpeg|png/.test(d.mime))throw Error('Solo fotos JPEG o PNG, no '+d.mime);
  const response=await fetch(d.thumb,{headers});if(!response.ok)throw Error('Descarga fallida: '+response.status);
  const src=`assets/archivo-${date}-${position}.${/png/.test(d.mime)?'png':'jpg'}`;fs.writeFileSync(new URL('../dist/'+src,import.meta.url),Buffer.from(await response.arrayBuffer()));
  console.log(JSON.stringify({src,alt:'',credit:d.credit,url:d.url,license:d.license,licenseUrl:d.licenseUrl},null,2));
}else{
  console.log('Uso:\n  node research/foto-commons.mjs buscar "texto"\n  node research/foto-commons.mjs bajar "File:Nombre.jpg" AAAA-MM-DD posición(1-3)');
  process.exitCode=1;
}

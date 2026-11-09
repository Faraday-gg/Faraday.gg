import fs from 'node:fs';
const days=JSON.parse(fs.readFileSync('dist/questions.json','utf8')),qs=days.flatMap(d=>d.questions);
const titles=['Museo Reina Sofía','Adolfo Suárez Madrid–Barajas Airport','Eiffel Tower','Airbus A380','Lego House (Billund)',"Rubik's Cube",'Beer','La Tomatina','El Escorial','Suez Canal','Nintendo DS','Spanish Christmas Lottery','Ocean','Espresso'];
const indexes=[2,3,7,10,11,12,13,14,15,16,17,18,19,20];
const url=new URL('https://en.wikipedia.org/w/api.php');url.search=new URLSearchParams({action:'query',format:'json',prop:'pageimages',piprop:'thumbnail|name',pithumbsize:'1000',redirects:'1',titles:titles.join('|')});
const pages=Object.values((await(await fetch(url)).json()).query.pages);
const files=pages.filter(p=>p.pageimage&&!p.pageimage.endsWith('.svg')).map(p=>'File:'+p.pageimage);
const commons=new URL('https://commons.wikimedia.org/w/api.php');commons.search=new URLSearchParams({action:'query',format:'json',prop:'imageinfo',iiprop:'url|extmetadata',iiurlwidth:'1000',titles:files.join('|')});
const entries=Object.values((await(await fetch(commons)).json()).query.pages);
const strip=t=>String(t||'').replace(/<[^>]*>/g,'').replace(/&amp;/g,'&').trim();
for(let k=0;k<titles.length;k++){
 const p=pages.find(p=>p.title.toLowerCase()===titles[k].toLowerCase());
 const normalize=t=>String(t).replaceAll('_',' ').toLowerCase();
 const info=entries.find(e=>normalize(e.title)===normalize('File:'+p?.pageimage))?.imageinfo?.[0],q=qs[indexes[k]];
 if(!info){console.log('Sin imagen',indexes[k]+1,titles[k]);continue}
 const m=info.extmetadata,license=strip(m.LicenseShortName?.value);if(!/CC|Public domain/.test(license))continue;
 const response=await fetch(info.thumburl||info.url);if(!response.ok){console.log('HTTP',response.status);continue}
 const src=`assets/question-${indexes[k]+1}.jpg`;fs.writeFileSync('dist/'+src,Buffer.from(await response.arrayBuffer()));
 q.image={src,alt:'Fotografía de referencia: '+titles[k],credit:strip(m.Artist?.value).slice(0,180)||'Wikimedia Commons',url:info.descriptionurl,license,licenseUrl:m.LicenseUrl?.value||info.descriptionurl};console.log('OK',indexes[k]+1,titles[k]);
}
fs.writeFileSync('dist/questions.json',JSON.stringify(days,null,2));fs.writeFileSync('dist/questions.js','window.PILOT_DAYS = '+JSON.stringify(days,null,2)+';\n');fs.writeFileSync('research/photo-manifest.json',JSON.stringify(Object.fromEntries(qs.filter(q=>q.image).map(q=>[q.id,q.image])),null,2));

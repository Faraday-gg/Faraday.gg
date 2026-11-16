// Prueba lo que no necesita lienzo de las tarjetas para compartir (dist/share-card.js, decisiones 0032 y 0081):
// el resumen del reto, el texto que acompaña a cada tarjeta y que ninguno destripa una cifra real.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const page={location:{origin:'https://faraday.gg',pathname:'/'}};page.window=page;vm.createContext(page);
vm.runInContext(fs.readFileSync(new URL('../dist/share-card.js',import.meta.url),'utf8'),page,{filename:'dist/share-card.js'});
const {ShareCard}=page;
for(const name of ['open','openDuel','draw','drawDuel','summarize','shareText','duelText','markOf'])assert.equal(typeof ShareCard[name],'function',name);

// Reto del día: marcas, media y pregunta destacada.
const day={id:'2026-11-16',name:'Lunes',questions:[{answer:137},{answer:2300},{answer:47}]};
const sum=ShareCard.summarize(day,[210,2400,141]);
assert.deepEqual([...sum.marks],['yellow','target','red']);assert.equal(sum.golden,true);assert.equal(sum.pick,1,'Con un «Casi casi», se destaca la más cercana');
assert.equal(ShareCard.summarize(day,[210,4600,141]).pick,2,'Sin «Casi casi», aquella en la que más lejos se quedó');
const text=ShareCard.shareText(day,sum,100);
assert.match(text,/Nº 100/);assert.match(text,/Juega en faraday\.gg/);
for(const q of day.questions)assert.ok(!text.includes(String(q.answer)),'El texto no lleva cifras reales');

// Duelo: resultado, rival, rondas y lo que se presume (rango y medalla), sin líneas vacías.
const win={result:'win',name:'Ana',rival:'Luis',won:5,lost:2,level:14,ranked:true,rank:'Estimador II',medal:'Pulso fino · Oro'};
assert.deepEqual(ShareCard.duelText(win).split('\n'),['Faraday.gg · Duelo clasificatorio','He ganado contra Luis · 5–2 en rondas','Estimador II · Pulso fino · Oro','¿Me ganas tú?','Juega en faraday.gg']);
const loss=ShareCard.duelText({result:'loss',name:'Ana',rival:'Bot',won:1,lost:4,level:2,ranked:false,rank:'',medal:''}).split('\n');
assert.deepEqual(loss,['Faraday.gg · Duelo','He perdido contra Bot · 1–4 en rondas','¿Lo haces mejor?','Juega en faraday.gg']);
assert.match(ShareCard.duelText({...win,result:'draw'}),/He empatado contra Luis/);
assert.match(ShareCard.duelText({...win,result:'otra-cosa'}),/He perdido/,'Un resultado desconocido no rompe la tarjeta');
// Con el Circuito cargado, el enlace es el de invitación del jugador.
page.Circuito={link:url=>url+'?de=ABC123'};
assert.match(ShareCard.duelText(win),/Juega conmigo: https:\/\/faraday\.gg\/\?de=ABC123$/);

console.log('tarjetas: ok');

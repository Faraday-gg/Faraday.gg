import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../dist/celebrations.js',import.meta.url),'utf8');
function page(saved){
  const context={window:{CasiCasi:{LIMIT:1.1}}};vm.createContext(context);vm.runInContext(source,context);
  return {rules:context.window.Celebrations,settings:context.window.Celebrations.normalize(saved)};
}
const {rules:C,settings}=page();
for(const [factor,id] of [[1,'clavada'],[1.099,'clavada'],[1.1,'acierto'],[1.9,'cerca'],[5,'lejos'],[10,'fallo'],[20,'desastre'],[100,'ko'],[Infinity,'ko'],[NaN,'ko']])assert.equal(C.tierOf(factor).id,id);
for(const [score,id] of [[1000,'clavada'],[950,'clavada'],[949,'acierto'],[800,'acierto'],[799,'cerca'],[600,'cerca'],[350,'lejos'],[349,'fallo'],[0,'fallo']])assert.equal(C.trendTier(score).id,id);
assert.equal(C.reaction(settings,'daily','ko').clip,'desmayo');
assert.equal(C.reaction(settings,'trends','cerca').clip,'puno','Conserva el gesto original de Traza');
assert.equal(C.reaction(settings,'ascension','cerca').clip,'puno','Una respuesta rara de Ascensión tiene celebración positiva');
assert.equal(C.reaction(settings,'ascension','fallo').clip,'saludo','Una respuesta conocida sigue siendo válida');

settings.all.clavada='robot';settings.archive.clavada='dab';settings.ranked.clavada='default';
assert.equal(C.reaction(settings,'daily','clavada').clip,'robot');
assert.equal(C.reaction(settings,'duel3','clavada').clip,'robot');
assert.equal(C.reaction(settings,'ascension','clavada').clip,'robot','Ascensión hereda el emote general');
settings.ascension.clavada='dab';
assert.equal(C.reaction(settings,'ascension','clavada').clip,'dab','Ascensión permite elegir un emote propio');
assert.equal(C.reaction(settings,'archive','clavada').clip,'dab');
assert.equal(C.reaction(settings,'ranked','clavada').clip,'clavada','Un modo puede recuperar el original aunque haya selección general');
settings.daily.ko='disco';
assert.equal(C.reaction(settings,'daily','ko').then,'cheer','Un baile elegido para un fallo no acaba tumbado');
assert.equal(C.reaction(settings,'daily','ko').repeat,'disco');
assert.equal(C.reaction(settings,'daily','ko',{animate:false}).clip,undefined,'Repasar un resultado no repite el baile');
assert.equal(C.reaction(settings,'daily','ko',{animate:false}).repeat,'');
assert.equal(C.reaction(settings,'daily','ko',{animate:false}).quiet,true,'El repaso no sortea otros bailes después');
settings.duel.defeat='none';assert.equal(C.reaction(settings,'duel','defeat').mood,'still');
settings.all.reward='desmayo';assert.equal(C.reaction(settings,'all','reward').repeat,'','El desmayo no se repite');

const again=page(JSON.parse(JSON.stringify(settings)));
assert.equal(again.rules.reaction(again.settings,'archive','clavada').clip,'dab','Persiste al recargar o recuperar la cuenta');
const invalid=C.normalize({all:{clavada:'<script>',acierto:{},ko:'desmayo',unknown:'robot'},unknown:{clavada:'robot'},daily:null});
assert.equal(invalid.all.ko,'desmayo');assert.equal(Object.keys(invalid.all).length,1);assert.equal(invalid.unknown,undefined);
assert.equal(C.reaction(invalid,'daily','clavada').clip,'clavada');
for(const item of C.CLIPS)assert.match(fs.readFileSync(new URL('../dist/avatar3d.js',import.meta.url),'utf8'),new RegExp('\\b'+item.id+':\\{d:'),'Cada gesto del catálogo existe en el esqueleto');
assert.equal(C.loadout(settings,'daily').clavada,'robot');

// Categorías «Celebraciones» y «Emotes» del armario: momentos de cada modo, catálogo de emotes y rueda de favoritos.
const skeleton=fs.readFileSync(new URL('../dist/avatar3d.js',import.meta.url),'utf8'),ids=list=>Array.from(list,item=>item.id).join(',');
assert.equal(ids(C.cuesOf('all')),ids(C.CUES),'La selección general tiene todos los momentos');
assert.equal(ids(C.cuesOf('daily')),ids(C.TIERS));assert.equal(ids(C.cuesOf('archive')),ids(C.TIERS));
for(const mode of ['duel','duel3','ranked'])assert.equal(ids(C.cuesOf(mode)),ids(C.TIERS)+',victory,draw,defeat','Los duelos añaden su final');
assert.equal(ids(C.cuesOf('trends')),'clavada,acierto,cerca,lejos,fallo');
assert.equal(ids(C.cuesOf('ascension')),'clavada,acierto,cerca,lejos,fallo,ko');
for(const cue of C.CUES)assert.ok(Array.from(C.GROUPS).some(([id,,list])=>id===C.groupOf(cue.id)&&list.includes(cue.id)),'Cada momento tiene su tipo');
assert.equal(C.CLIPS.length,22,'Los gestos elegibles para las celebraciones no cambian');
assert.equal(new Set(Array.from(C.EMOTES,item=>item.id)).size,C.EMOTES.length,'No hay emotes repetidos');
for(const clip of C.CLIPS)assert.ok(Array.from(C.EMOTES).some(item=>item.id===clip.id),'Todo gesto es también un emote');
for(const item of C.EMOTES){
  assert.match(skeleton,new RegExp('\\b'+item.id+':\\{d:'),'Cada emote existe en el esqueleto');
  assert.ok(Array.from(C.KINDS).some(([id])=>id===item.kind)&&item.icon&&item.name&&item.label,'Cada emote tiene tipo, icono y nombre');
}
for(const id of skeleton.match(/const DANCES=\[([^\]]+)\]/)[1].match(/\w+/g))assert.equal(Array.from(C.EMOTES).find(item=>item.id===id).kind,'baile','Los bailes del esqueleto son de tipo baile');
// Sin favoritos, la rueda es la del Salón tal cual (casino-chat.js): mismos gestos, iconos, nombres y orden.
const salon=[...fs.readFileSync(new URL('../dist/casino-chat.js',import.meta.url),'utf8').match(/export const EMOTES=\[([\s\S]*?)\];/)[1].matchAll(/\{id:'(\w+)',icon:'([^']+)',name:'([^']+)'\}/g)].map(([,id,icon,name])=>({id,name,icon}));
assert.equal(salon.length,12);
assert.equal(JSON.stringify(C.wheel()),JSON.stringify(salon));assert.equal(JSON.stringify(C.wheel([])),JSON.stringify(salon));assert.equal(JSON.stringify(C.wheel(['<script>'])),JSON.stringify(salon));
// Los favoritos: solo emotes del catálogo, sin repetir, en su orden y como mucho WHEEL_MAX.
assert.equal(C.favorites(['robot','robot','<script>',7,null,'dab']).join(),'robot,dab');
assert.equal(C.favorites('robot').length,0);assert.equal(C.favorites().length,0);
assert.equal(C.WHEEL_MAX,10);assert.equal(C.favorites(Array.from(C.EMOTES,item=>item.id)).length,10);
assert.equal(JSON.stringify(C.wheel(['dab','hombros','saludo'])),JSON.stringify([{id:'dab',name:'Dab',icon:'😎'},{id:'hombros',name:'Ni idea',icon:'🤷'},{id:'saludo',name:'Saludar',icon:'👋'}]));
// «En uso»: los gestos que de verdad salen con la selección del jugador, originales incluidos.
const original=C.used(C.normalize());
assert.ok(original.clavada>0&&original.desmayo>0&&original.saludo>0&&original.giro>0,'Los originales cuentan como en uso');assert.equal(original.robot,undefined);
const custom=C.used(C.normalize({all:{clavada:'robot'},duel:{defeat:'none'},ascension:{clavada:'default'}}));
assert.ok(custom.robot>0,'Un gesto elegido está en uso');assert.ok(custom.clavada>0,'Ascensión conserva el original');assert.ok(custom.suspiro<original.suspiro,'«Sin gesto» deja de usar el original');
console.log('celebraciones: OK');

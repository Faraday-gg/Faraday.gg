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
console.log('celebraciones: OK');

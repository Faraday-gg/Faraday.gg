import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

let clock=0,tick;
const events={},bar={style:{setProperty(){}}},status={},done={hidden:true,focus(){}};
const dialog={open:false,setAttribute(){},addEventListener(name,callback){events[name]=callback},
  querySelector(selector){return selector==='.ad-progress i'?bar:selector==='.ad-status'?status:done},
  showModal(){this.open=true},close(){this.open=false}};
const page={window:{Progress:{plus:()=>false}},document:{createElement:()=>dialog,body:{append(){}}},
  Date:{now:()=>clock},setInterval:callback=>(tick=callback,1),clearInterval(){}};
vm.createContext(page);vm.runInContext(fs.readFileSync(new URL('../dist/ads.js',import.meta.url),'utf8'),page);
const ads=page.window.Ads;
let watching=ads.rewarded({kind:'continuation',seconds:15,doneLabel:'Continuar jugando →'});
assert.equal(dialog.open,true);assert.equal(done.hidden,true);assert.match(status.textContent,/15 s/);
clock=14999;tick();assert.equal(done.hidden,true);
clock=15000;tick();assert.equal(done.hidden,false);assert.match(done.textContent,/Continuar jugando/);
events.click({target:{closest:selector=>selector==='.ad-done'?done:null}});assert.equal(await watching,true);
watching=ads.rewarded({kind:'continuation',seconds:60});clock+=15000;tick();assert.equal(done.hidden,true);assert.match(status.textContent,/45 s/);
events.cancel();assert.equal(await watching,false);assert.equal(dialog.open,false);
watching=ads.rewarded({kind:'continuation',seconds:60});clock+=60000;tick();assert.equal(done.hidden,false);
events.click({target:{closest:selector=>selector==='.ad-done'?done:null}});assert.equal(await watching,true);
page.window.Progress.plus=()=>true;assert.equal(await ads.rewarded({kind:'pista'}),true);assert.equal(dialog.open,false);
console.log('anuncios: duración explícita de 15/60 s, cierre, confirmación y pistas Plus correctos');

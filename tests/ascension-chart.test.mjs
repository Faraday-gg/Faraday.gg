import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const page={window:{}};vm.createContext(page);
vm.runInContext(fs.readFileSync(new URL('../dist/ascension-chart.js',import.meta.url),'utf8'),page);
const {render}=page.window.AscensionChart;
assert.equal(render(null,100),'');assert.equal(render({others:0,bins:Array(14).fill(0)},100),'');
const bins=[0,1,2,4,6,8,12,8,6,4,2,1,0,0];
const html=render({others:54,bins,normal:{mean:325,deviation:90}},325);
assert.equal((html.match(/<rect /g)||[]).length,14);
assert.match(html,/class="ascension-chart-normal"/);
assert.match(render({others:2,bins,normal:{mean:325,deviation:90}},325),/class="ascension-chart-normal"/,'Dos puntuaciones distintas ya permiten mostrar el ajuste');assert.match(html,/Curva normal ajustada/);
assert.match(html,/M261.42857142857144 25V166/,'La marca representa el valor propio exacto');
for(const [mean,deviation] of [[0,.001],[700,.001],[350,350]]){
  const edge=render({others:5,bins,normal:{mean,deviation}},mean);
  assert(!/NaN|Infinity/.test(edge));assert.match(edge,/ascension-chart-normal/);
}
const small=render({others:1,bins,normal:{mean:300,deviation:80}},100);
assert.doesNotMatch(small,/class="ascension-chart-normal"/);assert.match(small,/dos resultados/);
const flat=render({others:5,bins,normal:{mean:300,deviation:0}},100);
assert.doesNotMatch(flat,/class="ascension-chart-normal"/);assert.match(flat,/no hay dispersión/);
assert.doesNotMatch(render({others:5,bins,normal:{mean:NaN,deviation:100}},100),/NaN|Infinity/);
console.log('Ascensión: barras reales, curva normal, marca propia y casos límite: OK');

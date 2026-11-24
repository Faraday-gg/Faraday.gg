import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const script = name => readFileSync(new URL(`../dist/${name}.js`, import.meta.url), 'utf8');
const window = {};
runInNewContext(script('ascension-flight'), { window });
const { profile, zoneFor } = window.AscensionFlight;
const tiers = [[10, false], [30, false], [60, false], [85, false], [100, false], [100, true]];
let previous = { strength: 0, duration: Infinity };
for (const [points, bonus] of tiers) {
  const impulse = profile(points, bonus);
  assert.ok(impulse.strength > previous.strength);
  assert.ok(impulse.duration < previous.duration);
  previous = impulse;
}
assert.equal(zoneFor(0), 'Plataforma');
assert.equal(zoneFor(650), 'Mar de nubes');
assert.equal(zoneFor(2000), 'Cielo abierto');
assert.equal(zoneFor(3900), 'Borde azul');
assert.equal(zoneFor(6000), 'Espacio');
assert.equal(zoneFor(8000), 'Espacio');

const document = { hidden: false };
let tones = [], noises = [];
window.Sound = { on: true, tone(...args) { tones.push(args); }, noise(...args) { noises.push(args); } };
runInNewContext(script('ascension-audio'), { window, document });
const audio = window.AscensionAudio;

const motifs = tiers.map(([points, bonus]) => {
  tones = [];
  audio.response(points, { bonus });
  assert.ok(tones.length > 0);
  assert.ok(tones.every(([, at, duration]) => at + duration <= .8 + Number.EPSILON));
  return JSON.stringify(tones);
});
assert.equal(new Set(motifs).size, 6, 'Todos los niveles se distinguen sin subir el volumen');

audio.launch(10);
audio.launch(100, true);
assert.equal(noises.length, 2);
assert.ok(noises[1][2].to > noises[0][2].to);

tones = [];
audio.response(0, { reason: 'timeout' });
assert.equal(tones.length, 2);
assert.ok(tones[0][0] > tones[1][0], 'El fin de tiempo suena descendente');
tones = [];
noises = [];
window.Sound.on = false;
audio.play('start');
audio.launch(100, true);
window.Sound.on = true;
document.hidden = true;
audio.response(100, { bonus: true });
assert.equal(tones.length, 0);
assert.equal(noises.length, 0);

console.log('Ascensión: zonas, fuerza, duración y señales de audio por rareza correctas');

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { MIN_YEAR, MAX_YEAR, MAX_POINTS, scenes, scoreYear } from '../dist/archivo-vivo-rondas.js';

assert.equal(scoreYear(1940, 1940), MAX_POINTS);
assert.equal(scoreYear(1939, 1940), scoreYear(1941, 1940));
for (let gap = 1; gap <= MAX_YEAR - MIN_YEAR; gap += 1) {
  assert.ok(scoreYear(MIN_YEAR + gap, MIN_YEAR) <= scoreYear(MIN_YEAR + gap - 1, MIN_YEAR));
  assert.ok(scoreYear(MIN_YEAR + gap, MIN_YEAR) >= 0);
}

assert.equal(new Set(scenes.map(scene => scene.id)).size, scenes.length);
assert.ok(scenes.some(scene => scene.type === 'archive'));
assert.ok(scenes.some(scene => scene.type === 'reconstruction'));
for (const scene of scenes) {
  assert.ok(Number.isInteger(scene.year) && scene.year >= MIN_YEAR && scene.year <= MAX_YEAR);
  assert.ok(scene.credit && scene.rights && scene.detail && scene.alt);
  assert.equal(new URL(scene.source).protocol, 'https:');
  for (const variant of ['foto', 'escena']) {
    const data = readFileSync(new URL(`../dist/assets/archivo-vivo/${scene.id}-${variant}.jpg`, import.meta.url));
    assert.deepEqual([...data.subarray(0, 2)], [0xff, 0xd8], `El recurso de ${scene.id} debe ser JPEG`);
  }
}
console.log('Archivo Vivo: puntuación, créditos y recursos correctos');

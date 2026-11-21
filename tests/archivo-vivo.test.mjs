import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { MIN_YEAR, MAX_YEAR, MAX_POINTS, INITIAL_SCENE_IDS, initialSceneIdsForDay, scenes, scoreYear } from '../dist/archivo-vivo-rondas.js';
import { mountPanorama, photographPitch } from '../dist/archivo-vivo-visor.js';

assert.equal(scoreYear(1940, 1940), MAX_POINTS);
assert.equal(scoreYear(1939, 1940), scoreYear(1941, 1940));
for (let gap = 1; gap <= MAX_YEAR - MIN_YEAR; gap += 1) {
  assert.ok(scoreYear(MIN_YEAR + gap, MIN_YEAR) <= scoreYear(MIN_YEAR + gap - 1, MIN_YEAR));
  assert.ok(scoreYear(MIN_YEAR + gap, MIN_YEAR) >= 0);
}

assert.equal(new Set(scenes.map(scene => scene.id)).size, scenes.length);
assert.equal(new Set(INITIAL_SCENE_IDS).size, 3);
assert.ok(INITIAL_SCENE_IDS.every(id => scenes.some(scene => scene.id === id)));
assert.ok(INITIAL_SCENE_IDS.some(id => scenes.some(scene => scene.id === id && scene.year < 1900)));
assert.ok(scenes.filter(scene => scene.year < 1900).length >= 4);
assert.ok(scenes.some(scene => scene.year < 1860));
assert.deepEqual(initialSceneIdsForDay('2026-11-21'), INITIAL_SCENE_IDS);
const seenInFreeCollections = new Set();
for (const date of ['2026-11-21', '2026-11-22', '2026-11-23', '2026-11-24']) {
  const ids = initialSceneIdsForDay(date);
  assert.equal(new Set(ids).size, 3);
  assert.ok(ids.every(id => scenes.some(scene => scene.id === id)));
  assert.ok(scenes.some(scene => ids.includes(scene.id) && scene.year < 1900));
  ids.forEach(id => seenInFreeCollections.add(id));
}
assert.equal(seenInFreeCollections.size, scenes.length);
const archive = scenes.find(scene => scene.type === 'archive');
const reconstruction = scenes.find(scene => scene.type === 'reconstruction');
assert.ok(archive && reconstruction);
assert.equal(photographPitch(archive, archive.pitch), archive.pitch);
assert.equal(photographPitch(archive, 0.5), 0.20);
const archiveLookingDown = photographPitch(archive, -1.34);
assert.ok(archiveLookingDown < archive.pitch && archiveLookingDown > -0.20);
assert.equal(photographPitch(archive, -1.46), -0.20);
assert.equal(photographPitch(reconstruction, -1.34), -1.34);
const historicPanorama = scenes.find(scene => scene.type === 'archive' && scene.year < 1900);
assert.ok(historicPanorama);
assert.equal(photographPitch(historicPanorama, 0.5), historicPanorama.archivePitchLimit);
assert.equal(photographPitch(historicPanorama, -1.46), -historicPanorama.archivePitchLimit);
let unavailable = false;
assert.equal(mountPanorama({ getContext: () => null }, reconstruction, {
  unavailable() { unavailable = true; }
}), null);
assert.ok(unavailable);
for (const scene of scenes) {
  assert.ok(Number.isInteger(scene.year) && scene.year >= MIN_YEAR && scene.year <= MAX_YEAR);
  assert.ok(scene.credit && scene.rights && scene.detail && scene.alt);
  assert.equal(new URL(scene.source).protocol, 'https:');
  for (const variant of ['foto', 'escena']) {
    const data = readFileSync(new URL(`../dist/assets/archivo-vivo/${scene.id}-${variant}.jpg`, import.meta.url));
    assert.deepEqual([...data.subarray(0, 2)], [0xff, 0xd8], `El recurso de ${scene.id} debe ser JPEG`);
  }
}
console.log('Archivo Vivo: puntuación, créditos, recursos y cobertura del visor correctos');

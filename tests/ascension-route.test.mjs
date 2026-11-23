import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const window = {};
runInNewContext(readFileSync(new URL('../dist/ascension-route.js', import.meta.url), 'utf8'), { window });
const { plan, elevation } = window.AscensionRoute;
const near = (actual, expected) => {
  for (let axis = 0; axis < expected.length; axis++) {
    assert.ok(Math.abs(actual[axis] - expected[axis]) < 1e-9, `${actual} debe coincidir con ${expected}`);
  }
};
const world = (point, center) => point.map((value, axis) => value + center[axis]);

let lastBeat = Infinity, lastDuration = Infinity, lastSpeed = 0;
for (const [points, transfers] of [[10, 2], [30, 3], [60, 4], [85, 5], [100, 6]]) {
  const from = 1700, drift = .04;
  const direct = plan(points, 'directa', drift);
  const traverse = plan(points, 'travesia', drift);
  near(direct.finish, traverse.finish);
  near(direct.finish, [drift, elevation(from + points * 10) - elevation(from)]);
  assert.equal(direct.duration, traverse.duration);
  assert.ok(traverse.steps[0].next[0] > direct.steps[0].next[0]);
  const speed = points * 10 / direct.duration;
  assert.ok(direct.beat < lastBeat, 'Los agarres se encadenan más rápido cuanto más rara es la respuesta');
  assert.ok(direct.duration < lastDuration && speed > lastSpeed, 'Subir más metros lleva menos tiempo');
  lastBeat = direct.beat;
  lastDuration = direct.duration;
  lastSpeed = speed;

  for (const route of [direct, traverse]) {
    assert.equal(route.steps.length, transfers);
    assert.ok(route.duration < 1_600);
    assert.ok(route.finish[1] < 0);
    const samples = Array.from({ length: route.duration + 1 }, (_, time) => route.sample(time));
    for (const [index, step] of route.steps.entries()) {
      const gripping = samples.filter(sample => sample.cue === `grip-${index}`);
      assert.ok(gripping.length > 0);
      assert.equal(step.side, index % 2);
      assert.equal(step.foot, 1 - step.side);
      for (const { pose, center, active } of gripping) {
        near(active, step.nextHands[step.side]);
        near(world(pose.hands[step.side], center), step.nextHands[step.side]);
        near(world(pose.hands[1 - step.side], center), step.hands[1 - step.side]);
        near(world(pose.feet[1 - step.foot], center), step.feet[1 - step.foot]);
      }
      const beforePush = gripping.find(sample => sample.center[1] < step.from[1] - .01);
      const afterPush = gripping.at(-1);
      assert.ok(beforePush.center[1] > afterPush.center[1], 'El cuerpo sube con los apoyos fijos');
      near(world(beforePush.pose.feet[step.foot], beforePush.center), step.nextFeet[step.foot]);
      near(world(afterPush.pose.feet[step.foot], afterPush.center), step.nextFeet[step.foot]);
    }
    for (const { pose } of samples) {
      for (const [x, y] of [...pose.hands, ...pose.feet]) {
        assert.ok(x >= 0 && x <= 1 && y >= 0 && y <= 1, 'El apoyo queda dentro del encuadre del avatar');
      }
    }
    const first = samples[0], last = samples.at(-1);
    near(first.pose.hands[0], route.ready.hands[0]);
    near(first.pose.feet[0], route.ready.feet[0]);
    near(last.center, route.finish);
    near(last.pose.feet[0], [.45, .94]);
    near(last.pose.feet[1], [.55, .94]);
    assert.equal(first.travel, 0);
    assert.equal(last.travel, 1);
    assert.ok(samples.every((sample, i) => !i || sample.travel >= samples[i - 1].travel));
    assert.equal(last.cue, 'land');
  }
}

console.log('Ascensión alterna apoyos fijos y llega a la misma altura por ambas vías');

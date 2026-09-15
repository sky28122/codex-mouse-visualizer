import assert from 'node:assert/strict';
import test from 'node:test';
import * as cursorKit from '../src/cursor.mjs';

test('entry paths begin outside each chosen edge and end exactly at the target', () => {
  assert.equal(typeof cursorKit.planEntry, 'function');
  for (const side of ['left', 'right', 'top', 'bottom']) {
    const points = cursorKit.planEntry({ x: 310, y: 240 }, {
      width: 800, height: 600, side, random: () => 0.5,
    });
    const first = points[0];
    assert.ok(side === 'left' ? first.x < -22 : side === 'right' ? first.x > 800
      : side === 'top' ? first.y < -22 : first.y > 600);
    assert.equal(points.at(-1).x, 310);
    assert.equal(points.at(-1).y, 240);
    const inside = (p) => p.x >= 0 && p.x < 800 && p.y >= 0 && p.y < 600;
    const firstVisible = points.findIndex(inside);
    assert.ok(firstVisible > 0);
    assert.ok(points.slice(firstVisible).every(inside));
    assert.ok(points.length > 20);
  }
});

test('automatic entry chooses the nearest edge and validates its target', () => {
  assert.equal(typeof cursorKit.planEntry, 'function');
  const options = { width: 800, height: 600, random: () => 0.5 };
  assert.ok(cursorKit.planEntry({ x: 50, y: 250 }, options)[0].x < 0);
  assert.ok(cursorKit.planEntry({ x: 760, y: 250 }, options)[0].x >= 800);
  assert.ok(cursorKit.planEntry({ x: 400, y: 20 }, options)[0].y < 0);
  assert.ok(cursorKit.planEntry({ x: 400, y: 580 }, options)[0].y >= 600);
  assert.throws(() => cursorKit.planEntry({ x: 810, y: 10 }, options), /viewport/i);
  assert.throws(() => cursorKit.planEntry({ x: 50, y: 50 }, { ...options, side: 'invalid' }), /side/i);
});

test('entry keeps valid fractional coordinates next to the viewport edges', () => {
  for (const { target, side } of [
    { target: { x: 799.75, y: 100 }, side: 'top' },
    { target: { x: 100, y: 599.75 }, side: 'left' },
  ]) {
    const points = cursorKit.planEntry(target, {
      width: 800, height: 600, side, random: () => 0.5,
    });
    assert.equal(points.at(-1).x, target.x);
    assert.equal(points.at(-1).y, target.y);
  }
});

test('first movement enters from outside, but only in-viewport points drive page input', async () => {
  const calls = [];
  let time = 0;
  const cursor = cursorKit.createCursor({
    async send(method, params) {
      calls.push({ method, params });
      if (method === 'Page.addScriptToEvaluateOnNewDocument') return { identifier: 'script' };
      if (method === 'Page.getLayoutMetrics') return { cssLayoutViewport: { clientWidth: 800, clientHeight: 600 } };
      if (method === 'Runtime.evaluate') return { result: { value: true } };
      return {};
    },
  }, { now: () => time, sleep: async (ms) => { time += ms; }, random: () => 0.5 });
  await cursor.install();
  calls.length = 0;
  const result = await cursor.moveTo(100, 250);
  assert.equal(result.entry, true);
  assert.ok(calls.some((call) => call.method === 'Runtime.evaluate'
    && call.params.expression.startsWith('window.__codexNaturalCursor?.presentOutside(')));
  const inputs = calls.filter((call) => call.method === 'Input.dispatchMouseEvent');
  assert.ok(inputs.length > 10);
  assert.ok(inputs[0].params.x < 8);
  assert.ok(inputs.every(({ params: p }) => p.x >= 0 && p.x < 800 && p.y >= 0 && p.y < 600));
  assert.ok(inputs.every(({ params: p }) => p.type === 'mouseMoved'));
  calls.length = 0;
  assert.equal((await cursor.moveTo(500, 300)).entry, false);
  assert.ok(!calls.some((call) => call.params.expression?.startsWith('window.__codexNaturalCursor?.presentOutside(')));
});

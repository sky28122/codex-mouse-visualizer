import assert from 'node:assert/strict';
import test from 'node:test';
import { createCursor, planMovement } from '../src/cursor.mjs';

test('movement starts and ends exactly at the requested coordinates', () => {
  const points = planMovement({ x: 30, y: 80 }, { x: 620, y: 370 }, {
    width: 800, height: 600, random: () => 0.65,
  });
  assert.deepEqual(points[0], { x: 30, y: 80, t: 0 });
  assert.equal(points.at(-1).x, 620);
  assert.equal(points.at(-1).y, 370);
  assert.ok(points.at(-1).t >= 350 && points.at(-1).t <= 1500);
  assert.ok(points.length >= 18);
  for (let i = 1; i < points.length; i += 1) {
    assert.ok(points[i].t > points[i - 1].t);
  }
});

test('movement is curved and accelerates then slows near its destination', () => {
  const points = planMovement({ x: 20, y: 200 }, { x: 720, y: 200 }, {
    width: 800, height: 600, random: () => 0.8,
  });
  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const mid = Math.floor(points.length / 2);
  const middleSpeed = distance(points[mid], points[mid - 1]);
  assert.ok(middleSpeed > distance(points[1], points[0]) * 3);
  assert.ok(middleSpeed > distance(points.at(-1), points.at(-2)) * 3);
  assert.ok(points.some((point) => Math.abs(point.y - 200) > 2));
  assert.ok(points.every((point) => Math.abs(point.y - 200) < 55));
});

test('edge trajectories stay within the viewport and reject invalid targets', () => {
  const points = planMovement({ x: 1, y: 1 }, { x: 798, y: 2 }, {
    width: 800, height: 600, random: () => 0.01,
  });
  assert.ok(points.every((point) => point.x >= 0 && point.x < 800
    && point.y >= 0 && point.y < 600));
  assert.throws(() => planMovement({ x: 0, y: 0 }, { x: 801, y: 0 }, {
    width: 800, height: 600,
  }), /viewport/i);
  assert.throws(() => planMovement({ x: 0, y: 0 }, { x: NaN, y: 20 }, {
    width: 800, height: 600,
  }), /finite/i);
});

test('no movement produces a single stationary sample', () => {
  assert.deepEqual(planMovement({ x: 10, y: 10 }, { x: 10, y: 10 }, {
    width: 800, height: 600,
  }), [{ x: 10, y: 10, t: 0 }]);
});

function harness(failure) {
  const calls = [];
  let time = 0;
  const send = async (method, params) => {
    calls.push({ method, params });
    if (method === 'Page.getLayoutMetrics') {
      return { cssLayoutViewport: { clientWidth: 800, clientHeight: 600 } };
    }
    if (method === 'Page.addScriptToEvaluateOnNewDocument') return { identifier: 'script-1' };
    if (method === 'Runtime.evaluate') return { result: { value: true } };
    if (failure) failure(method, params);
    return {};
  };
  const cursor = createCursor({ send }, {
    now: () => time,
    sleep: async (ms) => { time += ms; },
    random: () => 0.5,
  });
  return { cursor, calls };
}

test('a click follows actual movement and sends one press and one release', async () => {
  const { cursor, calls } = harness();
  await cursor.install();
  await cursor.moveTo(40, 50);
  await cursor.click(620, 310);
  const inputs = calls.filter((call) => call.method === 'Input.dispatchMouseEvent');
  const pressed = inputs.filter((call) => call.params.type === 'mousePressed');
  const released = inputs.filter((call) => call.params.type === 'mouseReleased');
  assert.equal(pressed.length, 1);
  assert.equal(released.length, 1);
  assert.ok(inputs.filter((call) => call.params.type === 'mouseMoved').length > 10);
  assert.equal(pressed[0].params.x, 620);
  assert.equal(pressed[0].params.y, 310);
  assert.equal(inputs.at(-1).params.buttons, 0);
});

test('a failed mouse press attempts release and does not claim success', async () => {
  const { cursor, calls } = harness((method, params) => {
    if (method === 'Input.dispatchMouseEvent' && params.type === 'mousePressed') {
      throw new Error('transport interrupted');
    }
  });
  await cursor.install();
  await assert.rejects(cursor.click(200, 100), /transport interrupted/);
  assert.ok(calls.some((call) => call.params.type === 'mouseReleased'));
});

test('destroy removes future injection and active overlay', async () => {
  const { cursor, calls } = harness();
  await cursor.install();
  await cursor.destroy();
  assert.ok(calls.some((call) => call.method === 'Page.removeScriptToEvaluateOnNewDocument'
    && call.params.identifier === 'script-1'));
  assert.ok(calls.some((call) => call.method === 'Runtime.evaluate'
    && call.params.expression.includes('destroy')));
  await assert.rejects(cursor.moveTo(10, 10), /install/i);
});

test('unsupported document hooks fall back to checking the overlay before movement', async () => {
  const calls = [];
  const cdp = {
    async send(method, params) {
      calls.push({ method, params });
      if (method === 'Page.addScriptToEvaluateOnNewDocument') {
        throw new Error('This method is not supported through raw CDP.');
      }
      if (method === 'Runtime.evaluate') return { result: { value: true } };
      if (method === 'Page.getLayoutMetrics') {
        return { cssLayoutViewport: { clientWidth: 800, clientHeight: 600 } };
      }
      return {};
    },
  };
  const cursor = createCursor(cdp, { sleep: async () => {} });
  const result = await cursor.install();
  assert.equal(result.navigationRestore, 'before-next-action');
  await cursor.moveTo(50, 50);
  const count = calls.filter((call) => call.method === 'Runtime.evaluate').length;
  await cursor.moveTo(100, 100);
  assert.equal(calls.filter((call) => call.method === 'Runtime.evaluate').length, count + 1);
  await cursor.destroy();
  assert.ok(!calls.some((call) => call.method === 'Page.removeScriptToEvaluateOnNewDocument'));
});

test('failed hook cleanup still removes the overlay and remains retryable', async () => {
  let removalAttempts = 0;
  const { cursor, calls } = harness((method) => {
    if (method === 'Page.removeScriptToEvaluateOnNewDocument' && ++removalAttempts === 1) {
      throw new Error('temporary cleanup failure');
    }
  });
  await cursor.install();
  await assert.rejects(cursor.destroy(), /cleanup/i);
  assert.ok(calls.some((call) => call.method === 'Runtime.evaluate'
    && call.params.expression.includes('?.destroy()')));
  await cursor.destroy();
  assert.equal(removalAttempts, 2);
});

test('destroy retries a release that previously failed', async () => {
  let releases = 0;
  const { cursor } = harness((method, params) => {
    if (method === 'Input.dispatchMouseEvent' && params.type === 'mouseReleased'
      && ++releases === 1) throw new Error('release failed');
  });
  await cursor.install();
  await assert.rejects(cursor.click(100, 100), /release failed/);
  await cursor.destroy();
  assert.equal(releases, 2);
});

test('scroll restores a navigated page before sending wheel events', async () => {
  const { cursor, calls } = harness();
  await cursor.install();
  await cursor.moveTo(100, 100);
  calls.length = 0;
  await cursor.scroll(150);
  const restored = calls.findIndex((call) => call.method === 'Runtime.evaluate');
  const wheel = calls.findIndex((call) => call.params.type === 'mouseWheel');
  assert.ok(restored >= 0 && restored < wheel);
  assert.ok(calls.some((call) => call.params.type === 'mouseMoved'));
});

test('slow transports skip expired intermediate samples instead of queueing every frame', async () => {
  let time = 0;
  const inputs = [];
  const cursor = createCursor({
    async send(method, params) {
      if (method === 'Page.getLayoutMetrics') return { cssLayoutViewport: { clientWidth: 800, clientHeight: 600 } };
      if (method === 'Page.addScriptToEvaluateOnNewDocument') return { identifier: 'script' };
      if (method === 'Runtime.evaluate') return { result: { value: true } };
      if (method === 'Input.dispatchMouseEvent') { time += 80; inputs.push(params); }
      return {};
    },
  }, { now: () => time, sleep: async (ms) => { time += ms; }, random: () => 0.5 });
  await cursor.install();
  await cursor.moveTo(10, 10);
  inputs.length = 0;
  const start = time;
  await cursor.moveTo(700, 400, { durationMs: 800 });
  assert.ok(time - start <= 960);
  assert.ok(inputs.length < 20);
  assert.equal(inputs.at(-1).x, 700);
  assert.equal(inputs.at(-1).y, 400);
});

test('movement resumes from the last visible cursor position after reconnection', async () => {
  const inputs = [];
  const cursor = createCursor({
    async send(method, params) {
      if (method === 'Page.getLayoutMetrics') return { cssLayoutViewport: { clientWidth: 800, clientHeight: 600 } };
      if (method === 'Page.addScriptToEvaluateOnNewDocument') return { identifier: 'script' };
      if (method === 'Runtime.evaluate') return { result: { value: { x: 100, y: 100 } } };
      if (method === 'Input.dispatchMouseEvent') inputs.push(params);
      return {};
    },
  }, { now: () => 0, sleep: async () => {}, random: () => 0.5 });
  await cursor.install();
  await cursor.moveTo(300, 300);
  assert.equal(inputs[0].x, 100);
  assert.equal(inputs[0].y, 100);
  assert.ok(inputs.length > 10);
});

test('failed installation keeps the document hook when rollback removal fails', async () => {
  let evaluations = 0;
  let removals = 0;
  const cursor = createCursor({
    async send(method) {
      if (method === 'Page.addScriptToEvaluateOnNewDocument') return { identifier: 'orphan-hook' };
      if (method === 'Runtime.evaluate') {
        if (++evaluations === 1) throw new Error('initial injection failed');
        return { result: { value: true } };
      }
      if (method === 'Page.removeScriptToEvaluateOnNewDocument' && ++removals === 1) {
        throw new Error('temporary removal failure');
      }
      return {};
    },
  });
  await assert.rejects(cursor.install());
  await cursor.destroy();
  assert.equal(removals, 2);
});

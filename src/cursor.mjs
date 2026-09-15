/*
 * The overlay adapts cenfun/mouse-helper (MIT, Copyright 2022 cenfun).
 * The curve geometry adapts Xetera/ghost-cursor (MIT, Copyright 2021 Xetera).
 * Full upstream notices are retained in third_party/.
 */

export function planMovement(start, end, options = {}) {
  const { width, height, random = Math.random, fps = 60 } = options;
  if (![start.x, start.y, end.x, end.y, width, height].every(Number.isFinite)) {
    throw new TypeError('Coordinates and viewport dimensions must be finite.');
  }
  const inside = (point) => point.x >= 0 && point.x < width
    && point.y >= 0 && point.y < height;
  if (width <= 0 || height <= 0 || !inside(start) || !inside(end)) {
    throw new RangeError('The movement must remain inside the viewport.');
  }
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const distance = Math.hypot(dx, dy);
  if (distance < 0.01) return [{ ...start, t: 0 }];
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const duration = options.durationMs ?? clamp(
    (260 + Math.sqrt(distance) * 23) * (0.94 + random() * 0.12), 280, 1400,
  );
  if (!Number.isFinite(duration) || duration <= 0 || !Number.isFinite(fps)
    || fps < 1 || fps > 120) throw new RangeError('Invalid duration or frame rate.');
  // Gentle control-point offsets avoid random overshoot and jitter.
  const bend = Math.min(46, distance * 0.075) * (random() < 0.5 ? -1 : 1);
  const nx = -dy / distance;
  const ny = dx / distance;
  const anchors = [0.32, 0.73].map((fraction, index) => ({
    x: clamp(start.x + dx * fraction + nx * bend * (index ? 0.55 : 1), 0, width - 1),
    y: clamp(start.y + dy * fraction + ny * bend * (index ? 0.55 : 1), 0, height - 1),
  }));
  const count = Math.max(2, Math.ceil(duration / (1000 / fps)));
  const points = [];
  for (let index = 0; index <= count; index += 1) {
    const t = index / count;
    // Minimum-jerk timing gives a smooth start and a slow final approach.
    const u = 10 * t ** 3 - 15 * t ** 4 + 6 * t ** 5;
    const v = 1 - u;
    points.push({
      x: v ** 3 * start.x + 3 * v ** 2 * u * anchors[0].x
        + 3 * v * u ** 2 * anchors[1].x + u ** 3 * end.x,
      y: v ** 3 * start.y + 3 * v ** 2 * u * anchors[0].y
        + 3 * v * u ** 2 * anchors[1].y + u ** 3 * end.y,
      t: duration * t,
    });
  }
  points[0] = { ...start, t: 0 };
  points[points.length - 1] = { ...end, t: duration };
  return points;
}

export function planEntry(end, options = {}) {
  const { width, height, random = Math.random, side = 'auto', margin = 40 } = options;
  // Validate the destination against the actual page, not the extended canvas.
  planMovement(end, end, { width, height });
  if (!Number.isFinite(margin) || margin < 32 || margin > 200) {
    throw new RangeError('Entry margin must be between 32 and 200 CSS pixels.');
  }
  const distances = { left: end.x, right: width - end.x, top: end.y, bottom: height - end.y };
  const edge = side === 'auto'
    ? Object.keys(distances).sort((a, b) => distances[a] - distances[b])[0] : side;
  if (!Object.hasOwn(distances, edge)) throw new RangeError('Invalid entry side.');
  const clamp = (value, max) => Math.min(max - 1, Math.max(0, value));
  const offset = (random() - 0.5) * 90;
  const verticalEdge = edge === 'left' || edge === 'right';
  const start = verticalEdge
    ? { x: edge === 'left' ? -margin : width + margin, y: clamp(end.y + offset, height) }
    : { x: clamp(end.x + offset, width), y: edge === 'top' ? -margin : height + margin };
  // A shared curve covers both the clipped entrance and real page movement.
  const shift = (point) => ({ x: point.x + margin + 1, y: point.y + margin + 1 });
  const points = planMovement(shift(start), shift(end), {
    ...options, random, width: width + 2 * margin + 3, height: height + 2 * margin + 3,
    durationMs: options.durationMs ?? 950,
  }).map((point) => ({
    x: verticalEdge ? point.x - margin - 1 : clamp(point.x - margin - 1, width),
    y: verticalEdge ? clamp(point.y - margin - 1, height) : point.y - margin - 1,
    t: point.t,
  }));
  points[points.length - 1] = { ...end, t: points.at(-1).t };
  return points;
}

export function installOverlay(options = {}) {
  const key = '__codexNaturalCursor';
  let previous = null;
  if (window[key]) {
    if (window[key].version === '0.2.0' && typeof window[key].presentOutside === 'function') return true;
    if (typeof window[key].destroy !== 'function') throw new Error('An incompatible cursor overlay already exists.');
    previous = window[key].state?.();
    window[key].destroy();
  }
  const size = Math.min(40, Math.max(16, Number(options.size) || 22));
  const trailMs = Math.min(220, Math.max(0, Number(options.trailMs) || 0));
  const host = document.createElement('div');
  host.id = 'codex-natural-cursor-overlay';
  host.setAttribute('aria-hidden', 'true');
  host.style.cssText = 'position:fixed;inset:0;pointer-events:none!important;'
    + 'z-index:2147483647;overflow:hidden;contain:strict;';
  const shadow = host.attachShadow({ mode: 'open' });
  const sheet = document.createElement('style');
  sheet.textContent = '*{box-sizing:border-box;pointer-events:none!important}'
    + '.arrow{position:absolute;left:0;top:0;display:none;will-change:transform;'
    + 'filter:drop-shadow(0 1px 1px #0005)}'
    + '.ring{position:absolute;width:28px;height:28px;border:2px solid #2177ce;'
    + 'border-radius:50%;background:#3c9cf51a;animation:pulse 320ms ease-out forwards}'
    + '.dot{position:absolute;width:3px;height:3px;background:#3876ac;'
    + 'border-radius:50%;will-change:transform}'
    + '@keyframes pulse{from{opacity:.75;scale:.45}to{opacity:0;scale:1.25}}';
  shadow.append(sheet);
  const arrow = document.createElement('div');
  arrow.className = 'arrow';
  arrow.style.width = `${size}px`;
  arrow.style.height = `${size}px`;
  // The original mouse-helper arrow is retained; offset aligns its hotspot.
  arrow.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">'
    + '<path fill="#fff" stroke="#151b23" stroke-width="20" d="M423.547,323.115l-320-320c-3.051-3.051-7.637-3.947-11.627-2.304s-6.592,5.547-6.592,9.856V480c0,4.501,2.837,8.533,7.083,10.048c4.224,1.536,8.981,0.192,11.84-3.285l85.205-104.128l56.853,123.179c1.792,3.883,5.653,6.187,9.685,6.187c1.408,0,2.837-0.277,4.203-0.875l74.667-32c2.645-1.131,4.736-3.285,5.76-5.973c1.024-2.688,0.939-5.675-0.277-8.299l-57.024-123.52h132.672c4.309,0,8.213-2.603,9.856-6.592C427.515,330.752,426.598,326.187,423.547,323.115z"/></svg>';
  shadow.append(arrow);
  const nativeStyle = document.createElement('style');
  nativeStyle.textContent = 'html,body,body *{cursor:none!important}';
  const dots = Array.from({ length: 9 }, () => {
    const dot = document.createElement('i');
    dot.className = 'dot';
    dot.style.display = 'none';
    shadow.insertBefore(dot, arrow);
    return dot;
  });
  let point = null;
  let pressed = false;
  let frame = 0;
  let disposed = false;
  let samples = [];
  const rings = new Set();
  const state = { moves: 0, presses: 0, releases: 0, x: null, y: null, entering: false };
  const mount = () => {
    if (!disposed && !host.isConnected && document.documentElement) {
      document.documentElement.append(host);
    }
  };
  const paint = () => {
    frame = 0;
    if (disposed || !point) return;
    mount();
    const time = performance.now();
    arrow.style.display = 'block';
    arrow.style.transform = `translate(${point.x - size * 85 / 512}px,${point.y}px)`;
    arrow.style.opacity = pressed ? '0.82' : '1';
    samples = samples.filter((sample) => time - sample.time < trailMs).slice(-dots.length);
    dots.forEach((dot, index) => {
      const sample = samples[index];
      dot.style.display = sample ? 'block' : 'none';
      if (sample) {
        dot.style.transform = `translate(${sample.x - 1.5}px,${sample.y - 1.5}px)`;
        dot.style.opacity = String(0.25 * (1 - (time - sample.time) / trailMs));
      }
    });
    if (samples.length) frame = requestAnimationFrame(paint);
  };
  const place = (x, y) => {
    point = { x, y };
    state.x = point.x;
    state.y = point.y;
    if (trailMs) samples.push({ ...point, time: performance.now() });
    if (options.hideNative !== false && !nativeStyle.isConnected) {
      document.documentElement.append(nativeStyle);
    }
    if (!frame) frame = requestAnimationFrame(paint);
  };
  const move = (event) => {
    state.entering = false;
    state.moves += 1;
    place(event.clientX, event.clientY);
  };
  const down = (event) => {
    move(event);
    pressed = true;
    state.presses += 1;
    const ring = document.createElement('span');
    ring.className = 'ring';
    ring.style.left = `${event.clientX - 14}px`;
    ring.style.top = `${event.clientY - 14}px`;
    ring.addEventListener('animationend', () => { ring.remove(); rings.delete(ring); }, { once: true });
    rings.add(ring);
    shadow.append(ring);
  };
  const up = (event) => { move(event); pressed = false; state.releases += 1; };
  const blur = () => { pressed = false; };
  window.addEventListener('mousemove', move, true);
  window.addEventListener('mousedown', down, true);
  window.addEventListener('mouseup', up, true);
  window.addEventListener('blur', blur, true);
  document.addEventListener('DOMContentLoaded', mount, { once: true });
  mount();
  window[key] = {
    version: '0.2.0',
    state: () => ({ ...state, pressed, mounted: host.isConnected, version: '0.2.0' }),
    presentOutside(x, y) {
      if (![x, y].every(Number.isFinite)) throw new TypeError('Entry coordinates must be finite.');
      const root = document.documentElement;
      if (x >= 0 && x < root.clientWidth && y >= 0 && y < root.clientHeight) {
        throw new RangeError('Entry preview only accepts off-page coordinates.');
      }
      state.entering = true;
      place(x, y);
      return true;
    },
    destroy() {
      disposed = true;
      cancelAnimationFrame(frame);
      window.removeEventListener('mousemove', move, true);
      window.removeEventListener('mousedown', down, true);
      window.removeEventListener('mouseup', up, true);
      window.removeEventListener('blur', blur, true);
      document.removeEventListener('DOMContentLoaded', mount);
      rings.forEach((ring) => ring.remove());
      host.remove();
      nativeStyle.remove();
      delete window[key];
    },
  };
  if (Number.isFinite(previous?.x) && Number.isFinite(previous?.y)
    && previous.x >= 0 && previous.y >= 0
    && previous.x < document.documentElement.clientWidth
    && previous.y < document.documentElement.clientHeight) place(previous.x, previous.y);
  return true;
}

export function createCursor(cdp, settings = {}) {
  const now = settings.now ?? (() => performance.now());
  const sleep = settings.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  const random = settings.random ?? Math.random;
  let point = null;
  let installed = false;
  let scriptId = null;
  let busy = false;
  let pendingRelease = false;
  const overlayOptions = { size: 22, trailMs: 110, hideNative: true, ...settings.overlay };
  const expression = `(() => { (${installOverlay.toString()})(${JSON.stringify(overlayOptions)}); return window.__codexNaturalCursor?.state(); })()`;
  const send = (method, params = {}) => cdp.send(method, params, { timeoutMs: 10000 });
  const evaluate = async (source) => {
    const reply = await send('Runtime.evaluate', { expression: source, returnByValue: true });
    if (reply.exceptionDetails) throw new Error(reply.exceptionDetails.text || 'Page script failed.');
    return reply.result?.value;
  };
  const guard = () => {
    if (!installed) throw new Error('Install the cursor before operating the page.');
  };
  const exclusive = async (operation) => {
    if (busy) throw new Error('Another cursor operation is in progress.');
    busy = true;
    try { return await operation(); } finally { busy = false; }
  };
  const input = (type, at, extra = {}) => send('Input.dispatchMouseEvent', {
    type, x: at.x, y: at.y, ...extra,
  });
  const press = async () => {
    pendingRelease = true;
    await input('mousePressed', point, { button: 'left', buttons: 1, clickCount: 1 });
  };
  const release = async () => {
    if (!pendingRelease) return;
    await input('mouseReleased', point, { button: 'left', buttons: 0, clickCount: 1 });
    pendingRelease = false;
  };
  const move = async (x, y, options = {}) => {
    guard();
    if (pendingRelease && !options.buttons) await release();
    // Some Codex providers permit current-page scripts but not document hooks.
    // Rechecking before input also restores the overlay after navigation.
    const observed = await evaluate(expression);
    if (Number.isFinite(observed?.x) && Number.isFinite(observed?.y)) {
      point = { x: observed.x, y: observed.y };
    }
    const metrics = await send('Page.getLayoutMetrics');
    const viewport = metrics.cssLayoutViewport;
    if (!viewport) throw new Error('CSS viewport metrics are unavailable.');
    const width = viewport.clientWidth;
    const height = viewport.clientHeight;
    const knownPosition = point && point.x >= 0 && point.y >= 0
      && point.x < width && point.y < height;
    const entry = !knownPosition && settings.entry !== false;
    const points = entry
      ? planEntry({ x, y }, { ...settings.entry, ...options, width, height, random })
      : planMovement(knownPosition ? point : { x, y }, { x, y }, { ...options, width, height, random });
    const started = now();
    let sent = 0;
    for (let index = 0; index < points.length; index += 1) {
      const elapsed = now() - started;
      while (index < points.length - 1 && points[index + 1].t <= elapsed) index += 1;
      const sample = points[index];
      const remaining = sample.t - (now() - started);
      if (remaining > 0) await sleep(remaining);
      if (sample.x < 0 || sample.x >= width || sample.y < 0 || sample.y >= height) {
        // Only the off-page entrance is a clipped visual. On-page samples use
        // real browser input, including hover and all eventual clicks.
        await evaluate(`window.__codexNaturalCursor?.presentOutside(${sample.x},${sample.y})`);
      } else {
        await input('mouseMoved', sample, { button: options.buttons ? 'left' : 'none', buttons: options.buttons ?? 0 });
      }
      point = { x: sample.x, y: sample.y };
      sent += 1;
    }
    return { ...point, samples: sent, elapsedMs: now() - started, entry };
  };
  return {
    async install() {
      return exclusive(async () => {
        if (installed) return { installed: true, scriptId };
        if (scriptId || pendingRelease) throw new Error('Retry destroy to finish pending cleanup before installing.');
        try {
          const result = await send('Page.addScriptToEvaluateOnNewDocument', { source: expression });
          scriptId = result.identifier;
        } catch (error) {
          if (!String(error.message).includes('not supported through raw CDP')) throw error;
          scriptId = null;
        }
        try {
          await evaluate(expression);
          installed = true;
          return { installed, scriptId, navigationRestore: scriptId ? 'document-hook' : 'before-next-action' };
        } catch (error) {
          if (scriptId) {
            try {
              await send('Page.removeScriptToEvaluateOnNewDocument', { identifier: scriptId });
              scriptId = null;
            } catch (rollbackError) {
              throw new AggregateError([error, rollbackError], 'Cursor installation failed; retry destroy for pending cleanup.');
            }
          }
          throw error;
        }
      });
    },
    moveTo(x, y, options) { return exclusive(() => move(x, y, options)); },
    async click(x, y, options = {}) {
      return exclusive(async () => {
        await move(x, y, options);
        await sleep(options.settleMs ?? 110 + random() * 90);
        // A failed press can still have reached the browser; always release it.
        try {
          await press();
          await sleep(options.holdMs ?? 75 + random() * 40);
        } finally {
          await release();
        }
        return { x, y, clicked: true };
      });
    },
    async scroll(deltaY, options = {}) {
      return exclusive(async () => {
        guard();
        if (!point) throw new Error('Move the cursor into the viewport before scrolling.');
        if (!Number.isFinite(deltaY)) throw new TypeError('Scroll distance must be finite.');
        await move(point.x, point.y);
        const chunks = Math.max(1, Math.ceil(Math.abs(deltaY) / 75));
        for (let index = 0; index < chunks; index += 1) {
          await input('mouseWheel', point, { deltaX: 0, deltaY: deltaY / chunks });
          await sleep(options.intervalMs ?? 28);
        }
      });
    },
    async dragTo(x, y, options = {}) {
      return exclusive(async () => {
        guard();
        if (!point) throw new Error('Move to the drag handle first.');
        await move(point.x, point.y);
        try {
          await press();
          await sleep(100);
          await move(x, y, { ...options, buttons: 1 });
        } finally {
          await release();
        }
      });
    },
    async refresh() {
      guard();
      await evaluate(expression);
      return evaluate('window.__codexNaturalCursor?.state()');
    },
    async status() {
      guard();
      return evaluate('window.__codexNaturalCursor?.state()');
    },
    async destroy() {
      return exclusive(async () => {
        const errors = [];
        installed = false;
        try { await release(); } catch (error) { errors.push(error); }
        try {
          if (scriptId) {
            await send('Page.removeScriptToEvaluateOnNewDocument', { identifier: scriptId });
            scriptId = null;
          }
        } catch (error) { errors.push(error); }
        try {
          await evaluate('window.__codexNaturalCursor?.destroy(); true');
        } catch (error) { errors.push(error); }
        if (!pendingRelease) point = null;
        if (errors.length) throw new AggregateError(errors, 'Cursor cleanup incomplete; retry destroy.');
      });
    },
  };
}

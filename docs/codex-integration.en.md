# Integrate a Natural Cursor with Codex

[中文](codex-integration.md) | **English**

Applies to **Codex Mouse Visualizer 0.2.0**. Before starting, open this repository as a workspace in Codex, use Node.js 24+, and run `npm start` from the repository root.

This project uses the tab CDP capability currently exposed by the Codex browser tools. Run the JavaScript below in the **CUA JavaScript session** that holds objects such as `cua` and `tab`; run `npm` commands in the repository terminal. Tool interfaces can differ between versions, so follow the documentation returned during the current initialization.

## 1. Find the target tab

Initialize the current CUA tool as instructed. When you need to find an existing browser page, execute the following as the first call on its own:

```javascript
await cua.getState();
```

Use the returned browser and tab list to find the HTTP page served by the test server, then obtain `tab` through the `getTab` interface described in the current documentation. Use the actual browser and tab identifiers returned in this session.

If the test page is not open yet, create an in-app browser tab according to the tool documentation. For the default test address:

```javascript
let tab = await cua.createBrowserTab(
  'iab',
  'http://127.0.0.1:4173/demo/index.html',
  { visible: true }
);
```

If you already have `tab`, keep using that object. If the test server uses a different port, use the page address printed in the terminal.

## 2. Read the tab's CDP capability documentation

```javascript
let cdp = await tab.capabilities.get('cdp');
nodeRepl.write(await cdp.documentation());
```

Read the returned documentation before running the remaining code. The controller uses `Runtime.evaluate`, `Page.getLayoutMetrics`, and `Input.dispatchMouseEvent`. When new-document script hooks are available, it also uses their corresponding add and remove interfaces.

Some Codex environments return `This method is not supported through raw CDP` for `Page.addScriptToEvaluateOnNewDocument`. The controller recognizes this case and instead checks and restores the overlay before each mouse operation. Other errors are still reported to the caller.

## 3. Import the local module and install the overlay

Run this in the repository terminal:

```sh
npm run loader
```

The script generates a `const cursorKit = await import(...)` statement from the current repository location. Paste the generated import statement unchanged into the same CUA JavaScript session where you obtained `tab` and `cdp`. The import URL includes the first 12 characters of the source file's SHA-256 hash: it stays stable when the source is unchanged and changes automatically when the source is updated, allowing Node.js to load the updated module. This output is for the session on the current computer; repository documentation does not need to store any machine's absolute paths.

Then run:

```javascript
let cursor = cursorKit.createCursor(cdp);
nodeRepl.write(await cursor.install());
```

The returned `navigationRestore` value indicates whether the controller uses a new-document hook or restores the overlay before the next operation. After installation, the first movement without a valid known position automatically enters from outside the viewport edge.

## 4. Read coordinates from the latest page state, then act

This example uses only the known `#increment` button on the test page. Inspect the latest page state to confirm that the target exists, then read its current `getBoundingClientRect()`. All coordinates are in **CSS viewport pixels**.

```javascript
async function readIncrementTarget() {
  await tab.getAXState();
  return tab.playwright.evaluate(() => {
    const element = document.getElementById('increment');
    if (!element) throw new Error('The current page has no increment button.');

    const rect = element.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const root = document.documentElement;
    if (rect.width <= 0 || rect.height <= 0
      || x < 0 || y < 0 || x >= root.clientWidth || y >= root.clientHeight) {
      throw new Error('The button is outside the visible viewport. Adjust the page and read its position again.');
    }
    return { x, y };
  });
}

let target = await readIncrementTarget();
nodeRepl.write(await cursor.moveTo(target.x, target.y, { durationMs: 950 }));
nodeRepl.write(await cursor.status());
```

Confirm the target position again before clicking, then read the page result and cursor state after the action:

```javascript
target = await readIncrementTarget();
await cursor.click(target.x, target.y);
await tab.getAXState();
nodeRepl.write(await tab.playwright.evaluate(() => ({
  count: document.getElementById('count')?.textContent
})));
nodeRepl.write(await cursor.status());
```

Use the same approach for menus, text fields, or sliders that you have confirmed in the page state. Read the target coordinates again after layout changes, scrolling, zooming, or navigation. For text entry, continue using an input interface supported by the current tab's documentation; this controller handles mouse actions.

## 5. Operations and parameters

### Operation interfaces

| Interface | Behavior |
|---|---|
| `install()` | Install the overlay and report the navigation recovery method |
| `moveTo(x, y, options)` | Move naturally to a target in the current viewport; can trigger real hover behavior |
| `click(x, y, options)` | Move, pause, press the left mouse button, and release it |
| `dragTo(x, y, options)` | Hold the left mouse button and move from the current position; first use `moveTo()` to reach the drag handle |
| `scroll(deltaY, options)` | Send wheel events in chunks at the current mouse position; positive values scroll down, and a mouse position must be established first |
| `refresh()` | Proactively restore the current page's overlay and read its state |
| `status()` | Read the position, event counts, pressed state, entry state, and version |
| `destroy()` | Retry any pending mouse release and remove the overlay and available new-document hooks; can be retried after a failure |

Use `await` for each operation in sequence. Mouse actions, installation, and destruction on the same controller do not support concurrent execution.

### Entry and appearance

Before changing the configuration, clean up the existing controller and create a new instance:

```javascript
await cursor.destroy();
cursor = cursorKit.createCursor(cdp, {
  entry: { side: 'left' },
  overlay: { size: 22, trailMs: 110, hideNative: true }
});
nodeRepl.write(await cursor.install());
```

| Parameter | Default and description |
|---|---|
| `entry` | Enabled by default; set to `false` to disable the initial entry |
| `entry.side` | `auto`; also accepts `left`, `right`, `top`, and `bottom` |
| `entry.margin` | `40` CSS pixels; accepts `32`–`200`, specifying the starting point's distance from the viewport edge |
| `entry.durationMs` | `950` milliseconds; an operation's parameter with the same name overrides it |
| `overlay.size` | `22` pixels; range `16`–`40` |
| `overlay.trailMs` | `110` milliseconds; range `0`–`220`; `0` disables the short trail |
| `overlay.hideNative` | `true`; hides the current page's native cursor style |

When no valid position is known at the start, the controller selects an entry path. When a valid position already exists, movement continues from there. The short segment outside the viewport is only drawn and clipped by the overlay; it sends no clicks and is not counted as native mouse events. Once inside the viewport, the controller sends real movement events through CDP.

Version 0.2.0 detects and upgrades older overlays during installation while preserving a valid position. To replay the full entry, call `destroy()`, then create and install a new controller.

### Timing individual actions

| Parameter | Applies to | Description |
|---|---|---|
| `durationMs` | Movement, movement before a click, dragging | A positive number specifying the target duration of the path |
| `fps` | Same as above | Defaults to `60`; accepts `1`–`120`; controls path sampling density |
| `settleMs` | Clicking | Pause after reaching the target and before pressing the button |
| `holdMs` | Clicking | Interval between pressing and releasing the left mouse button |
| `intervalMs` | Scrolling | Defaults to `28` milliseconds; interval between successive wheel events |

Actual elapsed time depends on the browser tool's response speed. The controller skips expired intermediate samples to keep the path progressing toward its destination.

## 6. Navigation, reconnection, and cleanup

After navigation, read the new page state first. Subsequent `moveTo()`, `click()`, `scroll()`, and `dragTo()` calls check and restore the overlay. You can also restore it explicitly:

```javascript
nodeRepl.write(await cursor.refresh());
```

If a tool call times out, read the page result and cursor state to determine how much of the action actually completed before continuing. A tool timeout does not mean that a click did not happen. After reestablishing a session, follow the steps above to obtain `tab` and `cdp` again and import the module. A valid position in an existing overlay lets the new controller continue from that position.

Clean up when finished:

```javascript
await cursor.destroy();
```

If cleanup is reported as incomplete, call `destroy()` again on the same controller after the connection recovers. The controller retains pending release state and script handles that have not yet been removed so cleanup can be retried.

After changing the source, clean up the existing controller, run `npm run loader` again, and import the newly generated URL. If `const cursorKit` has already been declared in the same JavaScript session, give the new import statement an unused module variable name and create the controller from that new module. Alternatively, reinitialize the CUA session and repeat the complete loading procedure. The source hash distinguishes module versions; variable names still follow JavaScript's redeclaration rules.

This project affects the connected page and actions performed through this controller. It does not move the operating system pointer or take over all Codex browser operations. See the [README](../README.en.md) for compatibility details and a demonstration.

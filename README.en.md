# Codex Mouse Visualizer

[中文](README.md) | **English**

**0.2.0 · Node.js 24+ · No runtime dependencies · MIT**

Make Codex browser mouse actions visible: the pointer enters naturally from the edge of the viewport, follows gentle curves, and displays subtle click ripples. In-page movement, hovering, button presses, dragging, and scrolling use the current tab's exposed Chrome DevTools Protocol (CDP) capability.

## Live demonstration

[![Natural cursor demonstration preview](docs/media/demo-preview.png)](docs/media/natural-cursor-entry-demo.mp4)

**[Watch the actual browser recording](docs/media/natural-cursor-entry-demo.mp4)** · [View the preview image](docs/media/demo-preview.png)

[Recording and encoding guide](docs/recording.en.md)

The demonstration uses the plain HTML page included in this repository. The controller installs the cursor at runtime; the page itself only provides buttons, a menu, an input, a slider, and event counters.

## Features

- **Natural movement:** gentle curves, smooth acceleration and deceleration, and a brief pause before clicking. Expired intermediate samples are skipped when transport is slow.
- **Offscreen entry:** when no valid position is known, the pointer enters from the nearest edge. Choose a specific side or disable entry.
- **Visible feedback:** an arrow, adjustable short trails, and click ripples. The overlay does not intercept page controls.
- **Real interaction:** hover menus, left clicks, dragging, and incremental scrolling.
- **State recovery:** the controller checks the overlay before each mouse operation, restores it after navigation, upgrades older overlays, and supports retrying incomplete cleanup.

## Quick start

Open this repository as your workspace in Codex and use Node.js 24 or later. From the repository root, run:

```sh
npm start
```

Open the local address printed in the terminal. The default is the [interaction workbench](http://127.0.0.1:4173/demo/index.html). The development server only listens on the local machine.

`npm start` serves the plain test page. **The visible natural cursor also requires connecting the controller to the current Codex tab's CDP capability.** Follow the [Codex integration guide](docs/codex-integration.en.md). No runtime dependency installation is required.

Run the checks in another terminal:

```sh
npm test
```

Version 0.2.0 includes **18 automated tests** covering paths, offscreen entry, fractional endpoints, input ordering, release recovery, cleanup retries, and navigation recovery. Separate live browser checks covered clicking, hovering, Chinese text input, dragging, scrolling, page navigation, and restoring native cursor styles after cleanup.

## Repository layout

```text
codex-mouse-visualizer/
├── src/cursor.mjs          # Paths, overlay, and CDP controller
├── demo/                   # Plain HTML interaction test page
├── tests/                  # Node.js automated tests
├── scripts/                # Local module loader and other utilities
├── docs/
│   ├── codex-integration.en.md
│   └── media/              # Demo video and preview image
├── third_party/            # Original upstream license notices
├── server.mjs              # Local development server
└── package.json
```

## Scope and compatibility

- This is a controller invoked from a Codex session, **not a global plugin**. The effect applies to operations sent through this controller; it does not automatically intercept clicks from other tools.
- The target tab must expose CDP and permit current-page scripts, CSS viewport inspection, and mouse input. Use the capability documentation returned by that tab as the authority for available interfaces.
- Plain local HTML pages and same-origin navigation have been verified. Cross-origin iframes, native browser dialogs, and complex Canvas applications have not been verified.
- Offscreen entry refers to the browser viewport. The short offscreen segment is rendered with clipping and sends no page input; points inside the viewport use real CDP mouse events.
- After navigation, the pointer may remain hidden until the next controller operation. Call `refresh()` to restore it explicitly. After a tool timeout, inspect the page result before continuing to avoid duplicate clicks.
- The overlay can hide the page's native cursor styles while enabled. `destroy()` removes the overlay and restores those styles.

## License and upstream projects

This project uses the [MIT License](LICENSE). It references and adapts these MIT-licensed projects:

- [cenfun/mouse-helper](https://github.com/cenfun/mouse-helper): cursor overlay and arrow; [retained license](third_party/mouse-helper.LICENSE).
- [Xetera/ghost-cursor](https://github.com/Xetera/ghost-cursor): curve geometry; [retained license](third_party/ghost-cursor.LICENSE).

The implementation drives the browser directly through the Codex tab's CDP capability and does not require Puppeteer.

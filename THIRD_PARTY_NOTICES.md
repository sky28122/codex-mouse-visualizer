# Third-party notices

This project adapts the following MIT-licensed components. Their copyright
and license notices are retained in `third_party/` and must accompany any
redistribution of the corresponding code.

## mouse-helper

- Repository: [cenfun/mouse-helper](https://github.com/cenfun/mouse-helper)
- Reviewed commit: `12817819d66be928e00c5c2e6fc4d19f221743fa`
- Copyright: 2022 cenfun
- License: [MIT](third_party/mouse-helper.LICENSE)
- Adapted parts: the DOM cursor overlay/event handling pattern and normal
  cursor SVG from `src/index.js` and `src/images/mouse-normal.svg`.
- Local modifications: viewport positioning, shadow DOM isolation, subtle
  trails and click feedback, lifecycle cleanup, version upgrades, and a
  clipped offscreen entrance.

## ghost-cursor

- Repository: [Xetera/ghost-cursor](https://github.com/Xetera/ghost-cursor)
- Reviewed commit: `5525a783fcf833a60f1b0746a8f80653ccfee2ba`
- Copyright: 2021 Xetera
- License: [MIT](third_party/ghost-cursor.LICENSE)
- Adapted parts: vector and Bézier path construction ideas from `src/math.ts`.
- Local modifications: dependency-free cubic curve evaluation, constrained
  gentle control points, minimum-jerk timing, viewport checks, and offscreen
  entry planning. The Puppeteer driver is not included.

## Product names

Codex is referenced to identify the tested integration. This project is an
independent implementation and is not an official OpenAI product.

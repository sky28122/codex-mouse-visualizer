"use strict";

(() => {
  const incrementButton = document.getElementById("increment");
  const countOutput = document.getElementById("count");
  let count = 0;

  incrementButton?.addEventListener("click", () => {
    count += 1;
    countOutput.textContent = String(count);
  });

  const menu = document.getElementById("menu");
  const menuButton = document.getElementById("menu-button");
  const menuChoice = document.getElementById("menu-choice");
  const menuResult = document.getElementById("menu-result");
  let menuSelections = 0;

  function setMenuOpen(open) {
    if (!menu || !menuButton) return;
    menu.dataset.open = String(open);
    menuButton.setAttribute("aria-expanded", String(open));
  }

  menu?.addEventListener("pointerenter", () => setMenuOpen(true));
  menu?.addEventListener("pointerleave", () => {
    setMenuOpen(menu.contains(document.activeElement));
  });
  menu?.addEventListener("focusin", () => setMenuOpen(true));
  menu?.addEventListener("focusout", (event) => {
    if (!menu.contains(event.relatedTarget)) setMenuOpen(menu.matches(":hover"));
  });
  menuButton?.addEventListener("click", () => setMenuOpen(true));
  menuChoice?.addEventListener("click", () => {
    menuSelections += 1;
    menuResult.textContent = `已选择本地示例（${menuSelections} 次）`;
  });

  const searchForm = document.getElementById("search-form");
  const queryInput = document.getElementById("query");
  const searchResult = document.getElementById("search-result");

  searchForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    const query = queryInput.value.trim();
    searchResult.textContent = query ? `已提交：${query}` : "请先输入一个检索词。";
  });

  const volumeInput = document.getElementById("volume");
  const volumeOutput = document.getElementById("volume-value");
  volumeInput?.addEventListener("input", () => {
    volumeOutput.textContent = `${volumeInput.value}%`;
  });

  const bottomButton = document.getElementById("bottom-button");
  const bottomResult = document.getElementById("bottom-result");
  let bottomClicks = 0;
  bottomButton?.addEventListener("click", () => {
    bottomClicks += 1;
    bottomResult.textContent = `已确认到达，底部按钮已点击 ${bottomClicks} 次。`;
  });

  const eventOutputs = {
    pointermove: document.getElementById("pointermove-count"),
    mousedown: document.getElementById("mousedown-count"),
    click: document.getElementById("click-count"),
  };
  const eventCounts = { pointermove: 0, mousedown: 0, click: 0 };
  const lastPoint = document.getElementById("last-point");
  const eventLog = document.getElementById("event-log");
  let lastMoveLogTime = -Infinity;

  function recordNativeEvent(event) {
    // Browser-delivered events include input dispatched through CDP.
    if (!event.isTrusted || !eventOutputs[event.type]) return;

    eventCounts[event.type] += 1;
    eventOutputs[event.type].textContent = String(eventCounts[event.type]);

    const x = Math.round(event.clientX);
    const y = Math.round(event.clientY);
    lastPoint.textContent = `${x}，${y}`;

    // Count every movement but keep the compact event list readable.
    if (event.type === "pointermove") {
      if (event.timeStamp - lastMoveLogTime < 250) return;
      lastMoveLogTime = event.timeStamp;
    }

    const target = event.target instanceof Element ? event.target : null;
    const targetName = target?.id ? `#${target.id}` : target?.tagName.toLowerCase() ?? "document";
    const item = document.createElement("li");
    item.textContent = `${event.type.padEnd(11)} (${x}, ${y}) → ${targetName}`;
    eventLog.querySelector(".empty-event")?.remove();
    eventLog.prepend(item);
    while (eventLog.children.length > 4) eventLog.lastElementChild.remove();
  }

  for (const eventType of Object.keys(eventOutputs)) {
    document.addEventListener(eventType, recordNativeEvent, { capture: true, passive: true });
  }
})();

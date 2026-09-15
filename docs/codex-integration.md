# 在 Codex 中接入自然光标

适用版本：**Codex Mouse Visualizer 0.2.0**。开始前，在 Codex 中将本仓库打开为工作区，使用 Node.js 24+，并在仓库根目录运行 `npm start`。

本项目使用 Codex 浏览器工具当前公开的标签页 CDP 能力。以下 JavaScript 在持有 `cua`、`tab` 等对象的 **CUA JavaScript 会话**中执行；`npm` 命令在仓库终端执行。不同版本的工具接口应以当次初始化返回的文档为准。

## 1. 找到目标标签页

先按当前 CUA 工具要求初始化。需要查找已打开的浏览器页面时，首个调用单独执行：

```javascript
await cua.getState();
```

根据返回的浏览器及标签页清单，找到测试服务对应的 HTTP 页面，并通过当前文档中的 `getTab` 接口取得 `tab`。浏览器和标签页标识均使用本次实际返回值。

如果尚未打开测试页，可按工具文档创建内置浏览器标签页。默认测试地址的示例为：

```javascript
let tab = await cua.createBrowserTab(
  'iab',
  'http://127.0.0.1:4173/demo/index.html',
  { visible: true }
);
```

已取得 `tab` 时继续使用现有对象。若测试服务使用了其他端口，页面地址应与终端输出一致。

## 2. 读取该标签页的 CDP 能力文档

```javascript
let cdp = await tab.capabilities.get('cdp');
nodeRepl.write(await cdp.documentation());
```

先阅读返回的文档，再执行后续代码。控制器使用 `Runtime.evaluate`、`Page.getLayoutMetrics` 和 `Input.dispatchMouseEvent`；新文档脚本钩子可用时也会使用对应的添加与移除接口。

部分 Codex 环境对 `Page.addScriptToEvaluateOnNewDocument` 返回 `This method is not supported through raw CDP`。控制器会识别该情况，采用每次鼠标操作前检查并恢复覆盖层的方式；其他错误仍会向调用者报告。

## 3. 导入本机模块并安装

在仓库终端执行：

```sh
npm run loader
```

脚本根据当前仓库位置生成 `const cursorKit = await import(...)` 语句。把输出的导入语句原样放入已经取得 `tab` 和 `cdp` 的同一 CUA JavaScript 会话。导入 URL 带有源码 SHA-256 的前 12 位：源码不变时 URL 稳定，源码更新后自动改变，供 Node.js 加载更新后的模块。该输出供当前计算机的会话使用，仓库文档无需保存任何机器的绝对路径。

随后执行：

```javascript
let cursor = cursorKit.createCursor(cdp);
nodeRepl.write(await cursor.install());
```

返回结果中的 `navigationRestore` 表示采用新文档钩子，还是下一次操作前恢复。安装完成后，首次没有有效位置的移动将自动从视口边缘外进入。

## 4. 从最新页面状态读取坐标，再执行操作

下面仅使用测试页中已知的 `#increment` 按钮。先查看新页面状态，确认目标存在，再读取其当前 `getBoundingClientRect()`。所有坐标均为 **CSS 视口像素**。

```javascript
async function readIncrementTarget() {
  await tab.getAXState();
  return tab.playwright.evaluate(() => {
    const element = document.getElementById('increment');
    if (!element) throw new Error('当前页面没有计数按钮。');

    const rect = element.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const root = document.documentElement;
    if (rect.width <= 0 || rect.height <= 0
      || x < 0 || y < 0 || x >= root.clientWidth || y >= root.clientHeight) {
      throw new Error('按钮不在当前可见视口，请先调整页面并重新读取。');
    }
    return { x, y };
  });
}

let target = await readIncrementTarget();
nodeRepl.write(await cursor.moveTo(target.x, target.y, { durationMs: 950 }));
nodeRepl.write(await cursor.status());
```

点击前再次确认目标位置，动作后读取页面结果和光标状态：

```javascript
target = await readIncrementTarget();
await cursor.click(target.x, target.y);
await tab.getAXState();
nodeRepl.write(await tab.playwright.evaluate(() => ({
  count: document.getElementById('count')?.textContent
})));
nodeRepl.write(await cursor.status());
```

同样的方法可用于已从页面状态确认的菜单、输入框或滑块。布局变化、滚动、缩放或导航后都应重新读取目标坐标。文字输入继续使用当前标签页文档支持的输入接口；本控制器负责鼠标动作。

## 5. 操作与参数

### 操作接口

| 接口 | 行为 |
|---|---|
| `install()` | 安装覆盖层并报告导航恢复方式 |
| `moveTo(x, y, options)` | 自然移动到当前视口中的目标；可触发真实悬停 |
| `click(x, y, options)` | 移动、停留、左键按下并释放 |
| `dragTo(x, y, options)` | 从当前位置按住左键移动；先用 `moveTo()` 定位拖动手柄 |
| `scroll(deltaY, options)` | 从当前鼠标位置发送分段滚轮事件；正值向下，先建立鼠标位置 |
| `refresh()` | 主动恢复当前页覆盖层并读取状态 |
| `status()` | 读取位置、事件计数、按下状态、入场状态和版本 |
| `destroy()` | 补偿松键、清理覆盖层与可用的新文档钩子；失败后可重试 |

操作应逐个 `await`，同一控制器的鼠标动作和安装、销毁操作不支持并发执行。

### 入场与外观

更改配置前先清理现有控制器，再创建新实例：

```javascript
await cursor.destroy();
cursor = cursorKit.createCursor(cdp, {
  entry: { side: 'left' },
  overlay: { size: 22, trailMs: 110, hideNative: true }
});
nodeRepl.write(await cursor.install());
```

| 参数 | 默认值与说明 |
|---|---|
| `entry` | 默认启用；设为 `false` 可关闭首次入场 |
| `entry.side` | `auto`；也可设为 `left`、`right`、`top`、`bottom` |
| `entry.margin` | `40` CSS 像素，允许 `32`–`200`；表示起点离画面边缘的距离 |
| `entry.durationMs` | `950` 毫秒；单次操作的同名参数可覆盖它 |
| `overlay.size` | `22` 像素，范围 `16`–`40` |
| `overlay.trailMs` | `110` 毫秒，范围 `0`–`220`；`0` 关闭短尾迹 |
| `overlay.hideNative` | `true`；隐藏当前页的原生光标样式 |

首次没有有效位置时，控制器选择入场路径；已有有效位置时接续移动。画面外的短段仅由覆盖层裁切显示，不发送点击或计入原生鼠标事件；进入视口后通过 CDP 发送真实移动事件。

0.2.0 会在安装时检测并升级旧版覆盖层，保留其中有效的位置。若需要重播完整入场，先 `destroy()`，再创建新控制器并安装。

### 单次动作节奏

| 参数 | 适用操作 | 说明 |
|---|---|---|
| `durationMs` | 移动、点击前移动、拖动 | 正数；指定路径的目标时长 |
| `fps` | 同上 | 默认 `60`，允许 `1`–`120`；控制路径采样密度 |
| `settleMs` | 点击 | 到达目标后、按下前的停留时长 |
| `holdMs` | 点击 | 左键按下至释放的间隔 |
| `intervalMs` | 滚动 | 默认 `28` 毫秒；相邻滚轮事件之间的间隔 |

实际耗时受浏览器工具响应速度影响。控制器会跳过过期的中间采样，保持路径朝终点推进。

## 6. 导航、重连与退出

导航后先读取新页面状态。后续 `moveTo()`、`click()`、`scroll()` 和 `dragTo()` 会检查并恢复覆盖层；也可以主动执行：

```javascript
nodeRepl.write(await cursor.refresh());
```

若工具调用超时，先读取页面结果与光标状态，确认动作实际完成到哪一步，再继续。工具超时不等于点击未发生。重新建立会话后，按上面的流程重新取得 `tab`、`cdp` 并导入模块；已有覆盖层的有效位置可供新控制器接续移动。

结束时清理：

```javascript
await cursor.destroy();
```

若报告清理未完成，在连接恢复后对同一控制器再次调用 `destroy()`。控制器会保留待释放状态和未移除的脚本句柄，便于重试。

修改源码后，先清理现有控制器，再运行 `npm run loader` 并导入新输出的 URL。若同一 JavaScript 会话已经声明了 `const cursorKit`，将新的导入语句改用一个未使用的模块变量名，并用新模块创建控制器；也可以重新初始化 CUA 会话，再完整执行加载步骤。源码哈希负责区分模块版本，变量名则需要遵循 JavaScript 的重复声明规则。

本项目作用于所连接的网页及通过此控制器执行的操作，不会移动操作系统指针或接管 Codex 的全部浏览器操作。兼容范围和演示见 [README](../README.md)。

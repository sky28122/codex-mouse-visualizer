# Codex Mouse Visualizer

**0.2.0 · Node.js 24+ · 无运行依赖 · MIT**

让 Codex 在浏览器中的鼠标操作清晰可见：光标从画面边缘自然移入，沿柔和曲线移动，并在点击时显示轻量波纹。页面内的移动、悬停、按下、拖动和滚动通过当前标签页公开的 CDP 能力执行。

## 实际演示

[![自然光标演示预览](docs/media/demo-preview.png)](docs/media/natural-cursor-entry-demo.mp4)

**[观看真实浏览器演示视频](docs/media/natural-cursor-entry-demo.mp4)** · [查看预览图](docs/media/demo-preview.png)

演示使用仓库内的普通 HTML 页面。光标由控制器在运行时注入，页面自身只提供按钮、菜单、输入框、滑块和事件统计。

## 功能

- **自然移动**：柔和曲线、起止减速、点击前短暂停留；传输较慢时跳过过期的中间采样。
- **边缘入场**：首次没有有效位置时，从最近边缘外移入；可指定方向或关闭入场。
- **可见反馈**：箭头、可调短尾迹和点击波纹，覆盖层不阻挡页面控件。
- **真实交互**：支持悬停菜单、左键点击、拖动和分段滚动。
- **状态恢复**：每次鼠标操作前检查覆盖层，支持导航后恢复、旧覆盖层升级及清理失败重试。

## 快速运行

在 Codex 中将本仓库打开为工作区，并使用 Node.js 24 或更高版本。在仓库根目录运行：

```sh
npm start
```

打开终端输出的本地地址，默认是 [交互工作台](http://127.0.0.1:4173/demo/index.html)。测试服务仅监听本机地址。

`npm start` 启动普通测试页。**可见自然光标需要继续接入 Codex 当前标签页的 CDP 能力**，详见 [Codex 集成说明](docs/codex-integration.md)。本项目无需安装运行依赖。

另开终端运行检查：

```sh
npm test
```

0.2.0 包含 **18 项自动化测试**，覆盖路径、边缘入场、小数终点、鼠标事件顺序、松键补偿、清理重试和导航恢复。真实浏览器另行验证了点击、悬停、中文输入、拖动、滚动、页面跳转与销毁后的样式恢复。

## 仓库结构

```text
codex-mouse-visualizer/
├── src/cursor.mjs          # 曲线路径、覆盖层与 CDP 控制器
├── demo/                   # 无外部依赖的 HTML 交互测试页
├── tests/                  # Node.js 自动化测试
├── scripts/                # 本机模块加载等辅助脚本
├── docs/
│   ├── codex-integration.md
│   └── media/              # 演示视频与预览图
├── third_party/            # 上游许可原文
├── server.mjs              # 本地测试服务
└── package.json
```

## 使用范围

- 本项目是供 Codex 会话调用的控制器，**不是全局插件**。效果只作用于通过该控制器发送的操作，不会自动接管其他工具的点击。
- 运行时需要目标标签页公开 CDP 能力，并允许当前页脚本、CSS 视口读取和鼠标输入。具体接口以该标签页返回的能力文档为准。
- 已验证普通本地 HTML 页及同源导航。跨域 iframe、浏览器原生弹窗和复杂 Canvas 应用尚未验证。
- “从画面外移入”指网页视口边缘。画面外的短段仅作裁切绘制，不发送页面输入；进入视口后的点位使用真实 CDP 鼠标事件。
- 页面导航后，光标可能在下一次控制器操作前暂时不可见；可调用 `refresh()` 主动恢复。工具超时后应先读取页面结果，再决定是否继续，避免重复点击。
- 覆盖层启用期间可隐藏当前页原生光标样式；`destroy()` 会清理覆盖层并恢复样式。

## 许可与上游

本项目使用 [MIT License](LICENSE)。实现参考并改造了以下 MIT 项目：

- [cenfun/mouse-helper](https://github.com/cenfun/mouse-helper)：光标覆盖层与箭头；[保留的许可原文](third_party/mouse-helper.LICENSE)。
- [Xetera/ghost-cursor](https://github.com/Xetera/ghost-cursor)：曲线路径几何；[保留的许可原文](third_party/ghost-cursor.LICENSE)。

当前实现直接通过 Codex 标签页的 CDP 能力驱动浏览器，无需引入 Puppeteer。

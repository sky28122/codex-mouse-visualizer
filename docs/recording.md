# 演示视频与编码

**中文** | [English](recording.en.md)

仓库附有真实浏览器录制：[从画面外自然移入](media/natural-cursor-entry-demo.mp4)。

- 1280 × 720，60 fps，约 10.17 秒。
- 展示移入、点击、菜单悬停与选择、输入提交、滑块拖动。
- 通过标签页 CDP screencast 采集实际画面，按原始时间戳编码，无配音或加速。

## 可复用编码工具

`scripts/encode-recording.mjs` 把已经采集的 JPEG 帧和时间戳合成为 MP4。
此脚本负责编码；画面采集由支持 screencast 的浏览器工具会话完成。
它需要已安装 FFmpeg，正常鼠标功能和测试不需要 FFmpeg。

帧目录包含 JPEG 图片与 `manifest.json`：

```json
{
  "elapsedMs": 10000,
  "error": null,
  "frames": [
    { "file": "frame-00000.jpg", "timestamp": 1000.0 },
    { "file": "frame-00001.jpg", "timestamp": 1000.016667 }
  ]
}
```

`timestamp` 单位为秒，实际录制应保留 CDP 帧元数据中的时间戳。上述为格式示例。
如果 `error` 非空，脚本拒绝将中断的录制标记为成功；已有输出视频不会被覆盖。

```powershell
node scripts/encode-recording.mjs recordings/session recordings/demo.mp4
```

`recordings/` 已加入忽略清单，避免将大量原始帧提交到仓库。

[返回项目说明](../README.md)

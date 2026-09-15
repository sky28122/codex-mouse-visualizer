# Demo recording and encoding

[中文](recording.md) | **English**

This repository includes an actual browser recording: [natural offscreen entry](media/natural-cursor-entry-demo.mp4).

- 1280 × 720, 60 fps, approximately 10.17 seconds.
- Shows offscreen entry, clicking, menu hovering and selection, text submission, and slider dragging.
- Captured from the browser tab through CDP screencast and encoded using the original timestamps, without narration or playback acceleration.

## Reusable encoder

`scripts/encode-recording.mjs` combines previously captured JPEG frames and timestamps into an MP4 file. The script handles encoding; capture is performed in a browser tool session that supports screencast.

FFmpeg must be installed to use the encoder. The cursor controller and its tests do not require FFmpeg.

The frame directory contains JPEG images and a `manifest.json` file:

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

`timestamp` is measured in seconds. Preserve the timestamps from the actual CDP frame metadata when recording; the values above only illustrate the format.

If `error` is not null, the script refuses to treat the interrupted recording as successful. Existing output videos are never overwritten.

```powershell
node scripts/encode-recording.mjs recordings/session recordings/demo.mp4
```

`recordings/` is included in the ignore list so that large collections of raw frames are not committed to the repository.

[Back to the project overview](../README.en.md)

import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { dirname, resolve, basename } from 'node:path';

// Encode genuine CDP screencast frames without changing their playback speed.
const [folderArgument, outputArgument] = process.argv.slice(2);
if (!folderArgument || !outputArgument) {
  throw new Error('Usage: node encode-recording.mjs <frame-folder> <output.mp4>');
}
const folder = resolve(folderArgument);
const output = resolve(outputArgument);
const manifest = JSON.parse(await readFile(resolve(folder, 'manifest.json'), 'utf8'));
if (manifest.error) throw new Error(`Recording was interrupted: ${manifest.error}`);
if (manifest.frames.length < 2) throw new Error('Not enough recorded frames.');
try {
  await access(output);
  throw new Error(`Refusing to overwrite ${output}`);
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
const frames = [...manifest.frames].sort((a, b) => a.timestamp - b.timestamp);
const start = frames[0].timestamp;
const duration = Math.max(manifest.elapsedMs / 1000, frames.at(-1).timestamp - start);
const lines = ['ffconcat version 1.0'];
for (let index = 0; index < frames.length; index += 1) {
  const frame = frames[index];
  if (basename(frame.file) !== frame.file || !/^frame-\d+\.jpg$/.test(frame.file)) {
    throw new Error('Unexpected frame filename.');
  }
  const next = index + 1 < frames.length
    ? frames[index + 1].timestamp : start + duration;
  if (next <= frame.timestamp) continue;
  lines.push(`file '${frame.file}'`, 'option framerate 1000',
    `duration ${(next - frame.timestamp).toFixed(6)}`);
}
lines.push(`file '${frames.at(-1).file}'`, 'option framerate 1000');
const listPath = resolve(folder, 'frames.ffconcat');
await writeFile(listPath, `${lines.join('\n')}\n`, 'utf8');
await mkdir(dirname(output), { recursive: true });
const result = spawnSync('ffmpeg', [
  '-hide_banner', '-loglevel', 'warning', '-n', '-f', 'concat', '-safe', '0',
  '-i', listPath, '-an', '-vf', 'fps=60,scale=trunc(iw/2)*2:trunc(ih/2)*2',
  '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p',
  '-movflags', '+faststart', '-t', duration.toFixed(6), output,
], { stdio: 'inherit', windowsHide: true });
if (result.error) throw result.error;
if (result.status !== 0) throw new Error(`FFmpeg failed: ${result.status}`);
console.log(JSON.stringify({ output, duration, capturedFrames: frames.length }));

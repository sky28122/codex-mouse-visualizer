import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

// Resolve from this file, so moving the repository does not break the loader.
const moduleUrl = new URL('../src/cursor.mjs', import.meta.url);
const fingerprint = createHash('sha256').update(await readFile(moduleUrl)).digest('hex').slice(0, 12);
moduleUrl.searchParams.set('v', fingerprint);
console.log(`const cursorKit = await import(${JSON.stringify(moduleUrl.href)});`);

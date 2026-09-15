import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.CURSOR_DEMO_PORT || 4173);
const mime = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript', '.svg': 'image/svg+xml' };
const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://127.0.0.1:${port}`);
    const pathname = decodeURIComponent(url.pathname === '/' ? '/demo/index.html' : url.pathname);
    if (!pathname.startsWith('/demo/') && !pathname.startsWith('/src/')) {
      response.writeHead(404).end('Not found');
      return;
    }
    const target = resolve(root, `.${pathname}`);
    if (!target.startsWith(`${root}${sep}`)) {
      response.writeHead(403).end('Forbidden');
      return;
    }
    const contents = await readFile(target);
    response.writeHead(200, {
      'Content-Type': `${mime[extname(target)] || 'application/octet-stream'}; charset=utf-8`,
      'Cache-Control': 'no-store',
    });
    response.end(contents);
  } catch {
    response.writeHead(404).end('Not found');
  }
});
server.listen(port, '127.0.0.1', () => {
  console.log(`Cursor demo: http://127.0.0.1:${port}/demo/index.html`);
});

/* Local preview for the living landing draft. No dependencies.
   Serves this folder as /marketing/* layered over app/public, so the page's
   paths are the ones it will have once it is approved and moved into
   app/public/marketing. Nothing here is deployed.

   node docs/marketing-drafts/living-landing/preview.mjs [port]
   then open http://localhost:4812/marketing/arbor-living-en.html */
import { createServer } from 'node:http';
import { createReadStream, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const draft = path.dirname(fileURLToPath(import.meta.url));
const pub = path.resolve(draft, '..', '..', '..', 'app', 'public');
const port = Number(process.argv[2]) || 4812;
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.woff2': 'font/woff2', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.mp4': 'video/mp4', '.txt': 'text/plain; charset=utf-8' };

const inside = (root, rel) => { const p = path.resolve(root, '.' + rel); return p === root || p.startsWith(root + path.sep) ? p : null; };
const isFile = p => { try { return !!p && statSync(p).isFile(); } catch { return false; } };

createServer((req, res) => {
  let rel;
  try { rel = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); } catch { res.writeHead(400).end(); return; }
  const candidates = [rel.startsWith('/marketing/') ? inside(draft, rel.slice('/marketing'.length)) : null, inside(pub, rel)];
  const file = candidates.find(isFile);
  if (!file) { res.writeHead(404, { 'content-type': 'text/plain' }).end('Not found'); return; }
  res.writeHead(200, { 'content-type': types[path.extname(file).toLowerCase()] || 'application/octet-stream', 'cache-control': 'no-store' });
  createReadStream(file).pipe(res);
}).listen(port, '127.0.0.1', () => console.log(`Living landing draft: http://localhost:${port}/marketing/arbor-living-en.html`));

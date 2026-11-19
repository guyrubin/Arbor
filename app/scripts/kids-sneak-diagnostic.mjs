/** Temporary, read-only replay diagnosis through the normal synthetic preview. */
import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import { chromium } from 'playwright';
import { verifyMakerGameCycles } from './kids-maker-cycle-browser.mjs';

const output = path.resolve('output/kids-sneak-diagnostic');
await mkdir(output, { recursive: true });
const metadata = { sha: process.env.GITHUB_SHA ?? null, fixture: 'synthetic preview; actual Sneak driver; no cloud writes or private proof art', gameIds: ['sneak'], expectedCells: 4 };
await writeFile(path.join(output, 'run.json'), JSON.stringify({ ...metadata, started: new Date().toISOString() }, null, 2));
// Match the full performance runner: static preview/assets only; API and
// private proof paths remain unavailable. The driver owns explicit null fixtures.
const types = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.json': 'application/json', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.wav': 'audio/wav', '.ogg': 'audio/ogg', '.aac': 'audio/aac' };
const server = createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    if (pathname.includes('..') || pathname.startsWith('/_proof') || pathname.startsWith('/api')) { res.statusCode = 404; res.end('{}'); return; }
    const root = pathname.startsWith('/visuals/') || pathname.startsWith('/fonts/') || pathname.startsWith('/audio/') ? 'public' : 'dist-studio-preview';
    const file = path.join(root, pathname === '/' ? 'index.html' : pathname);
    res.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream');
    res.end(await readFile(file));
  } catch { res.statusCode = 404; res.end('Not found'); }
});

let browser;
try {
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const base = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const rows = await verifyMakerGameCycles({ browser, base, output, gameIds: ['sneak'] });
  assert.equal(rows.length, 4, 'The diagnostic operates all four release cells');
  assert.ok(rows.every(row => row.game === 'sneak' && row.passed), 'Every diagnostic cell passes the unchanged strict driver');
  await writeFile(path.join(output, 'result.json'), JSON.stringify({ ...metadata, passed: true, rows }, null, 2));
  console.log('PASS Sneak replay diagnostic: 4/4 cells');
} catch (error) {
  await writeFile(path.join(output, 'result.json'), JSON.stringify({ ...metadata, passed: false, error: String(error), causes: error instanceof AggregateError ? error.errors.map(String) : [] }, null, 2));
  throw error;
} finally {
  await browser?.close();
  if (server.listening) await new Promise(resolve => server.close(resolve));
}

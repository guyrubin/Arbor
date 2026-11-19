/** Isolated read-only evidence run of the unchanged complete 120-cell driver. */
import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { chromium } from 'playwright';
import { verifyStoryCatalogue } from './kids-story-catalogue-browser.mjs';

const output = path.resolve('output/kids-story-diagnostic');
await mkdir(output, { recursive: true });
const sourcePaths = ['app/src', 'app/public', 'app/package-lock.json', 'app/scripts/studio-v2-preview', 'app/scripts/kids-story-catalogue-browser.mjs', 'app/scripts/kids-story-paint.mjs'];
const metadata = {
  sha: process.env.GITHUB_SHA ?? null,
  fixture: 'same complete synthetic story catalogue; no assertion fork, cloud writes or private proof art',
  expectedCells: 120,
  sourceObjects: Object.fromEntries(sourcePaths.map(file => [file, execFileSync('git', ['rev-parse', `HEAD:${file}`], { encoding: 'utf8' }).trim()])),
};
await writeFile(path.join(output, 'run.json'), JSON.stringify({ ...metadata, started: new Date().toISOString() }, null, 2));
// Same static serving and private/API exclusion as the normal CI runner.
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
  const rows = await verifyStoryCatalogue({ browser, base, output });
  assert.equal(rows.length, 120);
  assert.equal(new Set(rows.map(row => row.label)).size, 120);
  assert.ok(rows.every(row => row.passed));
  await writeFile(path.join(output, 'result.json'), JSON.stringify({ ...metadata, passed: true, cells: rows.length }, null, 2));
  console.log('PASS complete story diagnostic: 120/120 cells');
} catch (error) {
  await writeFile(path.join(output, 'result.json'), JSON.stringify({ ...metadata, passed: false, error: String(error), causes: error instanceof AggregateError ? error.errors.map(String) : [] }, null, 2));
  throw error;
} finally {
  await browser?.close();
  if (server.listening) await new Promise(resolve => server.close(resolve));
}

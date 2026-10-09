/** Build-only. Public font GETs only; no app imports, browser, provider or credentials. */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FONT_CACHE_DIR, chromiumUserAgent, cssFontResources, fontMode, readPublicResource, sha256, sourceFontUrl } from './font-cache.mjs';

export async function prepareFontCache() {
  const mode = fontMode(process.env.CAPTURE_FONT_MODE);
  if (mode === 'fallback') { console.log('Font setup explicitly disabled: fallback-font evidence only.'); return; }
  if (process.env.CAPTURE_DISPOSABLE_CI !== 'true' || process.platform !== 'linux' || !existsSync('/.dockerenv')) throw new Error('FONT_DISPOSABLE_CI_REQUIRED');
  const deadline = AbortSignal.timeout(120_000);
  const app = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
  const source = await readFile(path.join(app, 'src/index.css'));
  const url = sourceFontUrl(source.toString());
  const pwDir = path.dirname(fileURLToPath(import.meta.resolve('playwright-core/package.json')));
  const browsers = JSON.parse(await readFile(path.join(pwDir, 'browsers.json'), 'utf8'));
  const browser = browsers.browsers.find((entry) => entry.name === 'chromium');
  const userAgent = chromiumUserAgent(browser.browserVersion);
  const playwrightVersion = JSON.parse(await readFile(path.join(pwDir, 'package.json'), 'utf8')).version;
  await mkdir(FONT_CACHE_DIR); // Refuse reusing a stale/preexisting cache.
  const resources = [];
  let total = 0;
  async function store(url, kind) {
    deadline.throwIfAborted();
    const fetched = await readPublicResource(url, userAgent, kind, fetch, deadline);
    total += fetched.size;
    if (total > 64 * 1024 * 1024) throw new Error('FONT_TOTAL_SIZE_LIMIT');
    const file = `${fetched.sha256}.${kind}`;
    await writeFile(path.join(FONT_CACHE_DIR, file), fetched.bytes);
    const { bytes, ...metadata } = fetched;
    resources.push({ url, kind, file, ...metadata });
    return bytes;
  }
  const stylesheet = await store(url, 'css');
  const { faces, urls } = cssFontResources(stylesheet.toString());
  for (const font of urls) await store(font, 'woff2');
  await writeFile(path.join(FONT_CACHE_DIR, 'manifest.json'), JSON.stringify({
    schema: 1, mode: 'exact', source: 'app/src/index.css', sourceCssSha256: sha256(source),
    cssUrl: url, userAgent, playwrightVersion, chromiumVersion: browser.browserVersion,
    chromiumRevision: browser.revision, completedAt: new Date().toISOString(), resources, faces,
  }, null, 2));
  console.log(`Exact source-font cache prepared: ${urls.length} WOFF2 resources; ${total} bytes. Runtime remains offline.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  prepareFontCache().catch((error) => {
    const code = /^FONT_[A-Z0-9_]+$/.test(error?.message ?? '') ? error.message : 'FONT_FETCH_UNAVAILABLE';
    console.error(`${code}: public font setup stopped; no redirects, alternate origin or fallback attempted.`);
    process.exitCode = 1;
  });
}

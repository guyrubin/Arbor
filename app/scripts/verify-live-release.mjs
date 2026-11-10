/** Read-only post-promotion gate: Hosting and its worker must match the built
 * artifact, and the live API must identify the exact full release commit. */
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { validateTarget, verifyCandidate } from './post-deploy-smoke.mjs';

export async function verifyHosting(host, sha, expectedWorker, fetcher = fetch) {
  const origin = validateTarget(host, sha);
  if (!expectedWorker || expectedWorker.includes('__BUILD_ID__')) throw new Error('A stamped worker artifact is required');
  const get = async path => {
    const response = await fetcher(`${origin}/${path}?release=${sha}`, {
      signal: AbortSignal.timeout(10000), cache: 'no-store', redirect: 'error',
    });
    if (response.status !== 200) throw new Error(`Hosting ${path} returned HTTP ${response.status}`);
    return response.text();
  };
  const [stamp, worker] = await Promise.all([get('timestamp.txt'), get('sw.js')]);
  if (!new RegExp(`^${sha}-[0-9]+-[0-9]+$`).test(stamp.trim())) throw new Error('Hosting build stamp does not match the release');
  if (worker !== expectedWorker) throw new Error('Live service worker differs from the tested release artifact');
  return sha;
}

/** A 200 HTML fallback is not a working JavaScript entry. Follow only same-origin
 * redirects, then resolve the actual module URL exactly as the browser does. */
export async function verifyAppEntry(host, sha, path = '/app/', fetcher = fetch) {
  const origin = validateTarget(host, sha);
  let url = new URL(path, origin);
  url.searchParams.set('release', sha);
  let response;
  for (let hop = 0; hop < 4; hop++) {
    response = await fetcher(url.href, { signal: AbortSignal.timeout(10000), cache: 'no-store', redirect: 'manual' });
    if (![301, 302, 303, 307, 308].includes(response.status)) break;
    const location = response.headers.get('location');
    if (!location) throw new Error('App entry redirect has no location');
    const next = new URL(location, url);
    if (next.origin !== origin) throw new Error('App entry redirected outside Hosting');
    url = next;
  }
  if (response?.status !== 200) throw new Error(`App entry ${path} returned HTTP ${response?.status}`);
  const html = await response.text();
  const tags = html.match(/<script\b[^>]*>/gi) ?? [];
  const tag = tags.find(t => /\btype=["']module["']/i.test(t));
  const src = tag?.match(/\bsrc=["']([^"']+)["']/i)?.[1];
  if (!src) throw new Error('App entry has no module script');
  const baseHref = html.match(/<base\b[^>]*href=["']([^"']+)["']/i)?.[1];
  const entry = new URL(src, baseHref ? new URL(baseHref, url) : url);
  if (entry.origin !== origin) throw new Error('App module is outside Hosting');
  const asset = await fetcher(entry.href, { signal: AbortSignal.timeout(10000), cache: 'no-store', redirect: 'error' });
  if (asset.status !== 200 || !/javascript/.test(asset.headers.get('content-type') ?? '')) throw new Error(`App module is not JavaScript: ${entry.pathname}`);
  return entry.pathname;
}

export async function main(host, api, sha, workerPath) {
  validateTarget(host, sha); validateTarget(api, sha);
  const worker = await readFile(workerPath, 'utf8');
  if (worker.includes('__BUILD_ID__')) throw new Error('Build the worker before verifying production');
  for (let attempt = 1; attempt <= 6; attempt++) {
    try {
      await verifyHosting(host, sha, worker);
      await Promise.all([verifyAppEntry(host, sha, "/"), verifyAppEntry(host, sha, "/app"), verifyAppEntry(host, sha)]);
      await verifyCandidate(api, sha);
      console.log(`[release] PASS — Hosting, executable app entry, service worker and live API match ${sha}`);
      return;
    } catch (error) {
      console.error(`[release] attempt ${attempt}: ${error.message}`);
      if (attempt === 6) throw error;
      await new Promise(resolve => setTimeout(resolve, 10000));
    }
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(...process.argv.slice(2)).catch(error => { console.error(`[release] FAIL — ${error.message}`); process.exitCode = 1; });
}

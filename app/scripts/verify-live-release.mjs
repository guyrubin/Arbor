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

export async function main(host, api, sha, workerPath) {
  validateTarget(host, sha); validateTarget(api, sha);
  const worker = await readFile(workerPath, 'utf8');
  if (worker.includes('__BUILD_ID__')) throw new Error('Build the worker before verifying production');
  for (let attempt = 1; attempt <= 6; attempt++) {
    try {
      await verifyHosting(host, sha, worker);
      await verifyCandidate(api, sha);
      console.log(`[release] PASS — Hosting, service worker and live API match ${sha}`);
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

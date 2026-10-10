/** Inspect app-produced synthetic bytes inside disposable CI; retain no payload. */
import { createHash } from 'node:crypto';
import { BASE } from './config.mjs';
import { EXPORT_DOWNLOAD_LIMIT, validatePartialExport } from './private-export-contract.mjs';

export async function inspectPartialDownload(download, fixture) {
  let receipt;
  try {
    if (!download.url().startsWith(`blob:${BASE}/`) || download.suggestedFilename() !== fixture.filename) throw new Error('UNEXPECTED_EXPORT_DOWNLOAD');
    const stream = await download.createReadStream();
    if (!stream) throw new Error('EXPORT_DOWNLOAD_STREAM_MISSING');
    const chunks = []; let bytes = 0;
    for await (const chunk of stream) {
      bytes += chunk.length;
      if (bytes > EXPORT_DOWNLOAD_LIMIT) { stream.destroy(); throw new Error('EXPORT_DOWNLOAD_TOO_LARGE'); }
      chunks.push(chunk);
    }
    const payload = Buffer.concat(chunks);
    if (!validatePartialExport(payload.toString('utf8'), download.suggestedFilename(), fixture)) throw new Error('EXPORT_DOWNLOAD_INVALID');
    receipt = { passed: true, delivery: 'actual-browser-download', syntheticOnly: true, filename: fixture.filename, childId: fixture.childId,
      bytes, sha256: createHash('sha256').update(payload).digest('hex'), status: 'incomplete', privateFileStatus: 'unauthorized', includedPrivateFiles: 0,
      collectionCount: 43, deleted: false };
  } finally { await download.delete(); }
  receipt.deleted = true;
  return receipt;
}

/** Hold only a successfully obtained unchanged HTTP-200 local response. */
export function createPrivacyResponseGate(apiState) {
  let pending = null;
  const gates = new Set();
  const pause = () => {
    if (pending) throw new Error('EXPORT_GATE_ALREADY_PENDING');
    let enter, ready, rejectReady, finish, releaseWait;
    const facts = { responseReady: false, responseStatus: null, released: false, releasedAfterReady: false, releaseReason: null, outcome: 'pending' };
    const entered = new Promise(resolve => { enter = resolve; });
    const responseReady = new Promise((resolve, reject) => { ready = resolve; rejectReady = reject; });
    responseReady.catch(() => undefined);
    const settled = new Promise(resolve => { finish = resolve; });
    const released = new Promise(resolve => { releaseWait = resolve; });
    const release = (reason = 'cleanup') => {
      if (facts.released) return;
      facts.releasedAfterReady = facts.responseReady;
      facts.released = true;
      facts.releaseReason = reason;
      releaseWait();
    };
    const gate = { enter, ready, rejectReady, finish, facts, released, release };
    pending = gate; gates.add(gate);
    return { entered, responseReady, settled, release };
  };
  const route = async route => {
    const gate = pending; pending = null;
    apiState.privateExportReads++;
    gate?.enter();
    try {
      const response = await route.fetch({ timeout: 15000 });
      apiState.privateExportResponses++;
      apiState.privateExportLastStatus = response.status();
      if (gate) {
        gate.facts.responseStatus = response.status();
        if (response.status() !== 200) {
          gate.facts.outcome = 'non-200-response';
          gate.rejectReady(new Error('EXPORT_RESPONSE_NOT_200'));
          await route.fulfill({ response });
          return;
        }
        gate.facts.responseReady = true;
        gate.ready({ ...gate.facts });
        await gate.released;
      }
      await route.fulfill({ response });
      if (gate) gate.facts.outcome = 'fulfilled';
    } catch {
      if (gate) {
        // A failed fetch/non-200 response cannot prove a held-response close.
        // After release, accept cancellation only with Chromium's own failed
        // request fact; an arbitrary fulfillment error remains a failure.
        const browserCancelled = route.request().failure()?.errorText === 'net::ERR_ABORTED';
        gate.facts.outcome = !gate.facts.responseReady ? (gate.facts.outcome === 'non-200-response' ? 'non-200-response' : 'response-fetch-failed')
          : gate.facts.released && gate.facts.releaseReason === 'after-close' && browserCancelled ? 'browser-cancelled-after-close' : 'response-delivery-failed';
        gate.rejectReady(new Error('EXPORT_RESPONSE_NOT_READY'));
      }
      await route.abort().catch(() => {});
    } finally {
      if (gate) { gate.finish({ ...gate.facts }); gates.delete(gate); }
    }
  };
  return { pause, route, releasePending: () => { for (const gate of gates) gate.release('cleanup'); pending = null; } };
}

#!/usr/bin/env node
/**
 * OPS-A2 — post-deploy smoke (liveness gate for the canary→promote pipeline).
 *
 * Asserts the freshly-deployed CANDIDATE revision is actually serving before the
 * promote job shifts live traffic to it. Exits non-zero on failure so the pipeline
 * gates / rolls back instead of promoting blind.
 *
 * LIVENESS (the hard gate): GET `/` on the candidate tag URL must return 200 with the
 * app shell. The candidate tag URL routes ONLY to the new revision, so a 200 here proves
 * the NEW revision booted and serves — without depending on `/healthz`.
 *
 * VERSION (best-effort, non-fatal): `/healthz` would also confirm the exact build SHA,
 * but it is currently intercepted at the ingress (returns 404 with no Google-Frontend
 * header — a known infra issue, see RELEASE-LEDGER REL-ARBOR-002 note). So the version
 * match is logged when available and never fails the gate. Re-instate it as the hard
 * gate once `/healthz` is reachable in prod.
 *
 * Usage: node scripts/post-deploy-smoke.mjs <candidate-url> [expectedSha]
 */

const host = (process.argv[2] || "https://arborprd-westeu.web.app").replace(/\/$/, "");
const expectedVersion = process.argv[3] || "";
const ATTEMPTS = 20;
const DELAY_MS = 15000;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function versionNote() {
  // Best-effort only — never throws, never gates.
  try {
    const res = await fetch(`${host}/healthz`, { signal: AbortSignal.timeout(8000) });
    if (res.ok) {
      const body = await res.json().catch(() => null);
      if (body?.version) {
        const match = !expectedVersion || body.version === expectedVersion ? "match" : `!= ${expectedVersion}`;
        console.log(`[smoke] /healthz version ${body.version} (${match})`);
      }
    } else {
      console.log(`[smoke] /healthz unavailable (HTTP ${res.status}) — liveness gated on / instead (known infra note)`);
    }
  } catch {
    console.log("[smoke] /healthz unreachable — liveness gated on / instead (known infra note)");
  }
}

async function main() {
  const url = `${host}/`;
  for (let i = 1; i <= ATTEMPTS; i++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
      const body = res.ok ? await res.text().catch(() => "") : "";
      // Liveness: the candidate must serve the app shell (200 + an HTML document).
      if (res.ok && /<!doctype html/i.test(body)) {
        console.log(`[smoke] PASS — ${url} → 200, app shell served (candidate revision live)`);
        await versionNote();
        process.exit(0);
      }
      console.error(`[smoke] attempt ${i}: HTTP ${res.status}${res.ok ? " (2xx but not the app shell yet)" : ""}`);
    } catch (err) {
      console.error(`[smoke] attempt ${i}: ${err?.message ?? err}`);
    }
    if (i < ATTEMPTS) await sleep(DELAY_MS);
  }
  console.error(`[smoke] FAIL — ${url} did not serve the app shell within ${ATTEMPTS} attempts`);
  process.exit(1);
}

main();

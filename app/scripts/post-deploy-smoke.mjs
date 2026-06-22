#!/usr/bin/env node
/**
 * OPS-A2 (building block) — post-deploy smoke.
 *
 * Polls /healthz on the target host and asserts {status:"ok"}; if an expected build
 * version (SHA) is given, waits until the LIVE version matches it — so the check only
 * passes once the NEW revision is actually serving, not the old one. Exits non-zero on
 * failure so a deploy pipeline can gate / trigger rollback instead of shipping blind.
 *
 * Usage (e.g. wired into arbor-deploy.yml after the deploy step):
 *   node scripts/post-deploy-smoke.mjs https://arborprd-westeu.web.app "$GITHUB_SHA"
 *
 * Standalone — wires into nothing by itself (no pipeline risk until someone adds the step).
 */

const host = (process.argv[2] || "https://arborprd-westeu.web.app").replace(/\/$/, "");
const expectedVersion = process.argv[3] || "";
const url = `${host}/healthz`;
const ATTEMPTS = 20;
const DELAY_MS = 15000;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  for (let i = 1; i <= ATTEMPTS; i++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
      if (res.ok) {
        const body = await res.json().catch(() => null);
        if (body && body.status === "ok") {
          if (expectedVersion && body.version !== expectedVersion) {
            console.error(
              `[smoke] attempt ${i}: /healthz ok but live version ${body.version} != expected ${expectedVersion} — old revision still serving, retrying`
            );
          } else {
            console.log(`[smoke] PASS — ${url} → ${JSON.stringify(body)}`);
            process.exit(0);
          }
        } else {
          console.error(`[smoke] attempt ${i}: 2xx but not a healthz payload (rewrite/route not live yet)`);
        }
      } else {
        console.error(`[smoke] attempt ${i}: HTTP ${res.status}`);
      }
    } catch (err) {
      console.error(`[smoke] attempt ${i}: ${err?.message ?? err}`);
    }
    if (i < ATTEMPTS) await sleep(DELAY_MS);
  }
  console.error(
    `[smoke] FAIL — ${url} did not return status:ok${expectedVersion ? ` at version ${expectedVersion}` : ""} within ${ATTEMPTS} attempts`
  );
  process.exit(1);
}

main();

#!/usr/bin/env node
/**
 * OPS-A2 / REL-ARBOR-002 — candidate liveness AND exact revision gate.
 *
 * The candidate must serve the app shell and identify the full expected commit
 * through /api/health before the promote job may shift production traffic.
 * /healthz remains a compatibility alias; Google ingress intercepts that path.
 * Neither missing identity nor a stale or malformed response can pass the gate.
 *
 * Usage: node scripts/post-deploy-smoke.mjs <candidate-url> <full-commit-sha>
 */
import { pathToFileURL } from "node:url";

const ATTEMPTS = 20;
const DELAY_MS = 15000;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function validateTarget(host, expectedVersion) {
  if (!/^[a-f0-9]{40}$/.test(expectedVersion ?? "")) {
    throw new Error("The expected full 40-character commit SHA is required");
  }
  const target = new URL(host);
  if (!["http:", "https:"].includes(target.protocol) || target.username || target.password) {
    throw new Error("A valid candidate HTTP(S) URL without credentials is required");
  }
  if (target.pathname !== "/" || target.search || target.hash) {
    throw new Error("The candidate URL must be an origin without a path, query, or fragment");
  }
  return target.origin;
}

export async function verifyCandidate(host, expectedVersion, fetcher = fetch) {
  const origin = validateTarget(host, expectedVersion);
  const shell = await fetcher(`${origin}/`, {
    signal: AbortSignal.timeout(10000), cache: "no-store", redirect: "error",
  });
  if (shell.status !== 200 || !/<!doctype html/i.test(await shell.text())) {
    throw new Error(`App shell unavailable (HTTP ${shell.status})`);
  }
  const health = await fetcher(`${origin}/api/health?release=${expectedVersion}`, {
    signal: AbortSignal.timeout(8000), cache: "no-store", redirect: "error",
  });
  if (health.status !== 200 || !/^application\/json\b/i.test(health.headers.get("content-type") ?? "")) {
    throw new Error(`Revision probe unavailable or not JSON (HTTP ${health.status})`);
  }
  const payload = await health.json();
  if (payload?.status !== "ok" || payload?.version !== expectedVersion) {
    throw new Error("Revision probe does not identify the expected healthy commit");
  }
  return payload.version;
}

export async function main(host, expectedVersion) {
  // Configuration mistakes fail immediately, rather than waiting five minutes.
  const origin = validateTarget(host, expectedVersion);
  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    try {
      const version = await verifyCandidate(origin, expectedVersion);
      console.log(`[smoke] PASS — ${origin} serves the app shell and commit ${version}`);
      return;
    } catch (error) {
      console.error(`[smoke] attempt ${attempt}: ${error?.message ?? error}`);
    }
    if (attempt < ATTEMPTS) await sleep(DELAY_MS);
  }
  throw new Error(`Candidate failed liveness or exact revision verification after ${ATTEMPTS} attempts`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv[2], process.argv[3]).catch((error) => {
    console.error(`[smoke] FAIL — ${error?.message ?? error}`);
    process.exitCode = 1;
  });
}

/**
 * collection-census — B-GROWTH-06 step (2) / B-GROWTH-31 steps 1–2. READ-ONLY.
 *
 *   node app/scripts/collection-census.mjs            # counts, one row per name
 *   node app/scripts/collection-census.mjs --json     # the same, as JSON
 *   node app/scripts/collection-census.mjs --list     # offline: the names only
 *
 * The G12 precondition: before anyone may ask Guy to delete stored composite
 * grades (`devScoreSnapshots`, `bandSnapshots`), the ask must carry the live
 * document counts. This script produces them and NOTHING else:
 *   - one collection-group COUNT aggregation per registered child
 *     subcollection (`CHILD_SUBCOLLECTIONS`, read from lib/childData.ts so the
 *     census can never drift from the registry the export/erase paths use);
 *   - no document is read (a count aggregation returns an integer only), so no
 *     child data reaches this terminal;
 *   - zero writes: the script holds no write call at all, and the guard test
 *     (src/growth/collectionCensus.test.ts) fails if one ever appears.
 * There is deliberately NO delete flag here. The purge is a separate,
 * Guy-gated script (B-GROWTH-31 step 3) that refuses any count but the signed one.
 *
 * Runs on Application Default Credentials (ADC bypasses security rules, which
 * is why the read surface is a count and nothing more).
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP_SRC = path.resolve(HERE, "..", "src");

/** The names the export/erase sweep uses, parsed from the registry source. */
export function readChildSubcollections(srcDir = APP_SRC) {
  const src = fs.readFileSync(path.join(srcDir, "lib", "childData.ts"), "utf8");
  const block = /export const CHILD_SUBCOLLECTIONS = \[([\s\S]*?)\];/.exec(src)?.[1];
  if (!block) throw new Error("CHILD_SUBCOLLECTIONS not found in lib/childData.ts");
  const names = [...block.replace(/\/\/.*$/gm, "").matchAll(/"([A-Za-z0-9_]+)"/g)].map((m) => m[1]);
  if (names.length === 0) throw new Error("CHILD_SUBCOLLECTIONS parsed empty");
  return names;
}

/** One printed row per name: an integer, or the error that prevented it. */
export function formatCensus(rows) {
  const width = Math.max(...rows.map((r) => r.name.length), 10);
  const lines = [`${"collection".padEnd(width)}  documents`];
  for (const r of rows) lines.push(`${r.name.padEnd(width)}  ${Number.isInteger(r.count) ? r.count : `ERROR ${r.error}`}`);
  return lines.join("\n");
}

/** Count every name through `countFn(name) → Promise<number>` (injected). */
export async function runCensus(names, countFn) {
  const rows = [];
  for (const name of names) {
    try {
      rows.push({ name, count: await countFn(name) });
    } catch (e) {
      rows.push({ name, count: null, error: e instanceof Error ? e.message : String(e) });
    }
  }
  return rows;
}

async function connect() {
  const { getApps, initializeApp, applicationDefault } = await import("firebase-admin/app");
  const { getFirestore } = await import("firebase-admin/firestore");
  if (!getApps().length) {
    initializeApp({
      credential: applicationDefault(),
      projectId: process.env.FIREBASE_PROJECT_ID || process.env.GCP_PROJECT_ID,
    });
  }
  return getFirestore(process.env.FIRESTORE_DATABASE_ID || "(default)");
}

/** collectionGroup(name).count() — an aggregation; no document is fetched. */
export const firestoreCounter = (db) => async (name) => {
  const snap = await db.collectionGroup(name).count().get();
  return snap.data().count;
};

async function main(argv) {
  const names = readChildSubcollections();
  if (argv.includes("--list")) {
    console.log(names.join("\n"));
    return;
  }
  const db = await connect();
  const rows = await runCensus(names, firestoreCounter(db));
  const at = new Date().toISOString();
  if (argv.includes("--json")) console.log(JSON.stringify({ at, rows }, null, 2));
  else console.log(`collection census — ${at} (read-only, count aggregations)\n${formatCensus(rows)}`);
  if (rows.some((r) => !Number.isInteger(r.count))) process.exitCode = 1;
}

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (invokedDirectly) {
  main(process.argv.slice(2)).catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
}

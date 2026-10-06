/**
 * count-band-snapshots — B-GROWTH-22a dry-run counter. READ-ONLY.
 *
 *   node app/scripts/count-band-snapshots.mjs           # one row per collection
 *   node app/scripts/count-band-snapshots.mjs --json    # the same, as JSON
 *   node app/scripts/count-band-snapshots.mjs --help    # usage, offline
 *
 * B-GROWTH-22a stopped the last writer of a stored grade on a child (the
 * weekly `bandSnapshots` upsert in practice/usePracticeData.ts; B-GROWTH-06
 * had stopped `devScoreSnapshots`). The documents already stored stay until
 * W4-P1 (Guy G12). This script prints, for each of the two collections:
 *   - the number of documents across all children (a collection-group COUNT
 *     aggregation: an integer, no document is fetched);
 *   - the number of children holding at least one document (a collection-group
 *     query with an EMPTY field mask, `.select()`: only document paths come
 *     back, never a field, so no grade reaches this terminal).
 * Zero writes, zero deletes: the script holds no write call, and
 * src/practice/noStoredGrades.test.ts fails if one ever appears. There is
 * deliberately NO delete flag; the purge is W4-P1's Guy-gated script.
 *
 * Runs on Application Default Credentials (ADC bypasses security rules, which
 * is why the read surface is a count and a set of paths, nothing more).
 * Model: scripts/collection-census.mjs (B-GROWTH-06).
 */
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

export const GRADE_COLLECTIONS = ["bandSnapshots", "devScoreSnapshots"];

export const USAGE = [
  "count-band-snapshots — read-only dry-run counter for the stored-grade collections (B-GROWTH-22a)",
  "",
  "  node app/scripts/count-band-snapshots.mjs          counts per collection + children with >=1 document",
  "  node app/scripts/count-band-snapshots.mjs --json   the same, as JSON",
  "  node app/scripts/count-band-snapshots.mjs --help   this text",
  "",
  "Collections: " + GRADE_COLLECTIONS.join(", "),
  "Credentials: Application Default Credentials; FIREBASE_PROJECT_ID / GCP_PROJECT_ID, FIRESTORE_DATABASE_ID.",
  "Writes nothing, deletes nothing, reads no document field.",
].join("\n");

/**
 * The owning child of a child-subcollection document path
 * (`users/{uid}/children/{childId}/<collection>/{docId}` → `users/{uid}/children/{childId}`),
 * or null when the path is not under a child.
 */
export function childPathOf(docPath) {
  const parts = String(docPath).split("/");
  if (parts.length < 6) return null;
  const i = parts.length - 6;
  if (parts[i] !== "users" || parts[i + 2] !== "children") return null;
  return parts.slice(i, i + 4).join("/");
}

/** Distinct children owning at least one of the given document paths. */
export function countChildren(docPaths) {
  return new Set(docPaths.map(childPathOf).filter(Boolean)).size;
}

/**
 * One row per collection through injected readers:
 *   countFn(name) → Promise<number>      (count aggregation)
 *   pathsFn(name) → Promise<string[]>    (document paths, empty field mask)
 * A failure prints as an ERROR row, never a silent 0.
 */
export async function runCount(names, countFn, pathsFn) {
  const rows = [];
  for (const name of names) {
    try {
      const documents = await countFn(name);
      const children = countChildren(await pathsFn(name));
      rows.push({ name, documents, children });
    } catch (e) {
      rows.push({ name, documents: null, children: null, error: e instanceof Error ? e.message : String(e) });
    }
  }
  return rows;
}

export function formatRows(rows) {
  const width = Math.max(...rows.map((r) => r.name.length), 10);
  const lines = [`${"collection".padEnd(width)}  documents  children(>=1)`];
  for (const r of rows) {
    lines.push(
      Number.isInteger(r.documents)
        ? `${r.name.padEnd(width)}  ${String(r.documents).padStart(9)}  ${String(r.children).padStart(13)}`
        : `${r.name.padEnd(width)}  ERROR ${r.error}`
    );
  }
  return lines.join("\n");
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
export const firestoreCounter = (db) => async (name) => (await db.collectionGroup(name).count().get()).data().count;

/** collectionGroup(name).select() — paths only (empty field mask); no field is read. */
export const firestorePaths = (db) => async (name) => {
  const snap = await db.collectionGroup(name).select().get();
  return snap.docs.map((d) => d.ref.path);
};

async function main(argv) {
  if (argv.includes("--help") || argv.includes("-h")) {
    console.log(USAGE);
    return;
  }
  const db = await connect();
  const rows = await runCount(GRADE_COLLECTIONS, firestoreCounter(db), firestorePaths(db));
  const at = new Date().toISOString();
  if (argv.includes("--json")) console.log(JSON.stringify({ at, rows }, null, 2));
  else console.log(`stored-grade count — ${at} (read-only dry run)\n${formatRows(rows)}`);
  if (rows.some((r) => !Number.isInteger(r.documents))) process.exitCode = 1;
}

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (invokedDirectly) {
  main(process.argv.slice(2)).catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
}

/**
 * B-KID-150: write the ACTUAL billed cost of studio production into the
 * studio cost ledger (studioCostLedger/{kind:ref}), one row per asset, from
 * the invoice or the billing export. The in-app paints already count their
 * calls and list-price estimate there; the offline art and audio rounds come
 * in only through this file. A billed cost is SET (it replaces, never adds),
 * and nothing here touches the family usage rollup.
 *
 *   npx tsx scripts/studio-ledger-import.mts rows.json            dry run: validate and print
 *   npx tsx scripts/studio-ledger-import.mts rows.json --apply    write (Application Default
 *                                                                 Credentials; FIREBASE_PROJECT_ID,
 *                                                                 FIRESTORE_DATABASE_ID)
 *
 * rows.json: [{ "kind": "book-plate", "ref": "five-smooth-stones/PL1",
 *   "billedCostUsd": 0.42, "billedSource": "billing-export", "billedPeriod": "2026-10",
 *   "acceptedSeconds": 0, "calls": { "image": 6 } }, …]
 */
import { readFileSync } from "node:fs";
import { billRowFields, billRowProblems, STUDIO_COST_LEDGER_COLLECTION, type StudioBillRow } from "../src/server/studioCostLedger.ts";

const [file, ...rest] = process.argv.slice(2);
if (!file) {
  console.error("usage: studio-ledger-import.mts <rows.json> [--apply]");
  process.exit(2);
}
const rows = JSON.parse(readFileSync(file, "utf8")) as StudioBillRow[];
if (!Array.isArray(rows)) throw new Error("rows.json must be a list");
let bad = 0;
const writes = rows.map((row, i) => {
  const problems = billRowProblems(row);
  if (problems.length) {
    bad++;
    console.log(`row ${i}: REFUSED — ${problems.join("; ")}`);
    return null;
  }
  const w = billRowFields(row);
  console.log(`row ${i}: ${w.key} billed $${row.billedCostUsd} (${row.billedSource}, ${row.billedPeriod})${row.acceptedSeconds !== undefined ? `, ${row.acceptedSeconds} s accepted` : ""}`);
  return w;
});
if (bad) {
  console.log(`${bad} row(s) refused; nothing written.`);
  process.exit(1);
}
if (!rest.includes("--apply")) {
  console.log(`dry run: ${writes.length} row(s) valid. Add --apply to write them.`);
  process.exit(0);
}
const { initializeApp, applicationDefault, getApps } = await import("firebase-admin/app");
const { getFirestore } = await import("firebase-admin/firestore");
if (!getApps().length) initializeApp({ credential: applicationDefault(), projectId: process.env.FIREBASE_PROJECT_ID });
const db = getFirestore(process.env.FIRESTORE_DATABASE_ID || "(default)");
for (const w of writes) await db.collection(STUDIO_COST_LEDGER_COLLECTION).doc(w!.key).set(w!.fields, { merge: true });
console.log(`wrote ${writes.length} row(s) to ${STUDIO_COST_LEDGER_COLLECTION}.`);

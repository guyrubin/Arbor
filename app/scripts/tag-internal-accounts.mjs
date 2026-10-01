/**
 * tag-internal-accounts — B-MEAS-07. A one-time, NON-destructive tag of the
 * founder / comped / smoke accounts whose `retentionRollups/{uid}` was written
 * before B-MEAS-01 (78b8bdd) and so carries no `cohort` tag: until tagged, a
 * smoke account that never returns counts as a family in every cohort number.
 *
 *   node app/scripts/tag-internal-accounts.mjs --since 2026-09-01 [--uids a,b] [--apply] [--json]
 *
 * Who is internal: the uids behind ARBOR_ADMIN_EMAILS (resolved through the
 * Admin Auth API) plus every uid passed with --uids. Nothing else — this
 * script never guesses from an address pattern.
 *
 * DRY RUN (default): prints one row per matched uid — whether a rollup exists,
 * its current tag, first/last seen day, the event count since --since — and
 * the number of rollups --apply WOULD change. It writes nothing; a second dry
 * run prints the identical table.
 *
 * --apply: sets `cohort: "internal"` (merge) on each matched rollup that is not
 * already tagged internal. That one field and nothing else; no document is
 * created or deleted. A re-run is idempotent (it finds nothing to change).
 *
 * Runs on Application Default Credentials, like cohort-report.mjs. Builders
 * never run it against production: Fable runs the dry run, then --apply.
 */
import process from "node:process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROLLUPS = "retentionRollups";
const MAX_EVENTS_PER_UID = 5000;

/* ── pure: flags, matcher, plan ─────────────────────────────────────────── */

export function parseArgs(argv) {
  const out = { since: null, uids: [], apply: false, json: false, help: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--since") out.since = argv[++i] ?? null;
    else if (a === "--uids") out.uids = String(argv[++i] ?? "").split(",").map((s) => s.trim()).filter(Boolean);
    else if (a === "--apply") out.apply = true;
    else if (a === "--json") out.json = true;
    else if (a === "--help" || a === "-h") out.help = true;
  }
  if (!out.since) out.since = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);
  return out;
}

/** Comma list → lower-cased, trimmed, non-empty (the admin.ts envList shape). */
export function envList(value) {
  return String(value ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
}

/**
 * The internal uid set: --uids ∪ the uids the admin emails resolve to.
 * `emailToUid` is the resolved map (an email that resolves to nothing is
 * reported, never guessed). Sorted, de-duplicated.
 */
export function matchInternalUids({ adminEmails, emailToUid, uids }) {
  const set = new Set(uids.filter(Boolean));
  const unresolved = [];
  for (const email of adminEmails) {
    const uid = emailToUid[email];
    if (uid) set.add(uid);
    else unresolved.push(email);
  }
  return { uids: [...set].sort(), unresolved };
}

/**
 * Per matched uid: what is there and what --apply would do. A uid with no
 * rollup has nothing to tag (no document is ever created); an already
 * internal rollup is left alone (idempotence).
 */
export function planTagChanges(matched, rollupsByUid, eventCounts) {
  return matched.map((uid) => {
    const r = rollupsByUid[uid] ?? null;
    const days = r && Array.isArray(r.activeDays) ? r.activeDays.filter((d) => typeof d === "string").sort() : [];
    return {
      uid,
      rollups: r ? 1 : 0,
      cohort: r ? (r.cohort === "internal" ? "internal" : "untagged") : "none",
      firstSeen: r && typeof r.firstSeen === "string" ? r.firstSeen : null,
      lastSeen: days.length ? days[days.length - 1] : null,
      events: eventCounts[uid] ?? 0,
      change: !!r && r.cohort !== "internal",
    };
  });
}

export function printPlan(rows, { since, apply, unresolved }) {
  const lines = [];
  lines.push(`tag-internal-accounts — ${apply ? "APPLY" : "dry run (writes nothing)"} · events since ${since}`);
  lines.push("uid                           rollups  cohort     first seen  last seen   events");
  for (const r of rows) {
    lines.push(`${r.uid.padEnd(30)}${String(r.rollups).padStart(7)}  ${r.cohort.padEnd(9)}  ${String(r.firstSeen ?? "-").padEnd(10)}  ${String(r.lastSeen ?? "-").padEnd(10)}  ${r.events}`);
  }
  const changes = rows.filter((r) => r.change).length;
  lines.push(`${apply ? "tagged" : "would tag"} cohort:"internal" on ${changes} rollup(s); ${rows.length - changes} unchanged`);
  if (unresolved.length) lines.push(`admin emails with no account: ${unresolved.length}`);
  return lines.join("\n");
}

/* ── Firestore + Auth, on ADC ───────────────────────────────────────────── */

async function connect() {
  const { getApps, initializeApp, applicationDefault } = await import("firebase-admin/app");
  const { getFirestore } = await import("firebase-admin/firestore");
  const { getAuth } = await import("firebase-admin/auth");
  if (!getApps().length) {
    initializeApp({ credential: applicationDefault(), projectId: process.env.FIREBASE_PROJECT_ID || process.env.GCP_PROJECT_ID });
  }
  return { db: getFirestore(process.env.FIRESTORE_DATABASE_ID || "(default)"), auth: getAuth() };
}

async function resolveEmails(auth, emails) {
  const out = {};
  for (const email of emails) {
    try {
      out[email] = (await auth.getUserByEmail(email)).uid;
    } catch {
      /* no such account — reported as unresolved */
    }
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    process.stdout.write("tag-internal-accounts --since <YYYY-MM-DD> [--uids a,b] [--apply] [--json]\nDry run by default; --apply sets cohort:\"internal\" only.\n");
    return;
  }
  let conn;
  try {
    conn = await connect();
  } catch (error) {
    process.stderr.write(`tag-internal-accounts: no Firestore connection (ADC missing?) — ${error?.message || error}\n`);
    process.exitCode = 2;
    return;
  }
  const { db, auth } = conn;
  const adminEmails = envList(process.env.ARBOR_ADMIN_EMAILS);
  const emailToUid = await resolveEmails(auth, adminEmails);
  const { uids, unresolved } = matchInternalUids({ adminEmails, emailToUid, uids: args.uids });

  const rollupsByUid = {};
  const eventCounts = {};
  for (const uid of uids) {
    const snap = await db.collection(ROLLUPS).doc(uid).get();
    if (snap.exists) rollupsByUid[uid] = snap.data();
    const events = await db.collection(`users/${uid}/events`).where("at", ">=", new Date(args.since)).limit(MAX_EVENTS_PER_UID).get();
    eventCounts[uid] = events.size;
  }
  const rows = planTagChanges(uids, rollupsByUid, eventCounts);

  if (args.apply) {
    for (const r of rows) {
      if (!r.change) continue;
      // The ONE field. merge:true never touches activeDays/firstSeen/props.
      await db.collection(ROLLUPS).doc(r.uid).set({ cohort: "internal" }, { merge: true });
    }
  }
  process.stdout.write(args.json ? `${JSON.stringify({ apply: args.apply, since: args.since, rows, unresolved: unresolved.length }, null, 2)}\n` : `${printPlan(rows, { since: args.since, apply: args.apply, unresolved })}\n`);
}

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (invokedDirectly) {
  main().catch((error) => {
    process.stderr.write(`tag-internal-accounts: ${error?.stack || error}\n`);
    process.exitCode = 1;
  });
}

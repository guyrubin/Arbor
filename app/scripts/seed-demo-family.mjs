/**
 * seed-demo-family — B-DIST-01. The sanitized demo family: one seed, three uses
 * (sandbox drive, institutional demo, store review). Every string is invented
 * (app/src/demo/demoFamily.ts); the two moment photos are bundled app art.
 *
 *   npm run seed:demo                               # DRY RUN (default): prints what it would write
 *   npm run seed:demo -- --apply                    # sandbox: the local synthetic parent (local-sandbox)
 *   npm run seed:demo -- --apply --lang he          # the same family, Hebrew record text
 *   npm run seed:demo -- --json                     # dry run + every document as JSON
 *
 * DRY RUN prints the counts per collection, the memory ledger events and the
 * flag writes, and writes NOTHING (a second dry run prints the same table).
 *
 * --apply (sandbox, the default target) writes:
 *   - app/.data/demo-family.json — the bundle the sandbox serves at
 *     GET /sandbox/demo-family.json (non-prod, local memory adapter only);
 *     the client's lib/demoFamilyHydrate.ts writes it, on load, into the SAME
 *     per-child storage keys useChildCollection reads (`arbor.<name>.<childId>`),
 *     so rendered-sweep.mjs and the parent's-week drive run on a populated record;
 *   - the memory ledger (app/.data/memory-ledger.json) through the app's own
 *     write path: appendMemoryProposals (2 proposals) + transitionMemory
 *     (approve 1) — 1 approved fact, 1 pending proposal.
 *
 * --apply --target firestore --uid <uid> --project <id>   ← GUY ONLY (account act)
 *   The production Auth user is created by Guy; this then writes users/{uid}
 *   { demo: true }, users/{uid}/children/<childId> (demo: true) + every
 *   subcollection, retentionRollups/{uid} { cohort: "demo" } (the B-MEAS-07
 *   tag path: cohort readers drop it like an internal family), and the memory
 *   ledger through FirestoreMemoryStore. Builders never run it. The exact
 *   command is printed by --help.
 *
 * Guards (scripts/seedDemoFamily.test.ts): a dry run writes nothing; every
 * collection written is in CHILD_SUBCOLLECTIONS (read from lib/childData.ts —
 * export/erase cover the demo); no fixture string matches a real-name list;
 * the cohort reader excludes the demo family.
 *
 * Runs under tsx (it imports the TypeScript demo module): `npm run seed:demo`.
 */
import process from "node:process";
import path from "node:path";
import { readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const APP_DIR = path.resolve(HERE, "..");
export const SANDBOX_BUNDLE_PATH = path.join(APP_DIR, ".data", "demo-family.json");
export const SANDBOX_UID = "local-sandbox";

export const PROD_COMMAND =
  "GOOGLE_CLOUD_PROJECT=<project> npm run seed:demo -- --apply --target firestore --uid <demo-auth-uid> --project <project>";

/* ── pure: flags, the allow-list, the plan ───────────────────────────────── */

export function parseArgs(argv) {
  const out = { apply: false, target: "sandbox", uid: null, project: null, lang: "en", json: false, now: null, help: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--apply") out.apply = true;
    else if (a === "--target") out.target = String(argv[++i] ?? "");
    else if (a === "--uid") out.uid = argv[++i] ?? null;
    else if (a === "--project") out.project = argv[++i] ?? null;
    else if (a === "--lang") out.lang = argv[++i] === "he" ? "he" : "en";
    else if (a === "--now") out.now = argv[++i] ?? null;
    else if (a === "--json") out.json = true;
    else if (a === "--help" || a === "-h") out.help = true;
  }
  if (out.target !== "sandbox" && out.target !== "firestore") throw new Error(`--target must be sandbox or firestore (got "${out.target}")`);
  if (out.target === "firestore" && (!out.uid || !out.project)) throw new Error("--target firestore needs --uid <demo-auth-uid> and --project <id> (GUY only)");
  return out;
}

/** CHILD_SUBCOLLECTIONS, read-only, from the source of record (lib/childData.ts). */
export function childSubcollectionsFromSource(src = readFileSync(path.join(APP_DIR, "src", "lib", "childData.ts"), "utf8")) {
  const block = src.match(/export const CHILD_SUBCOLLECTIONS = \[([\s\S]*?)\];/);
  if (!block) throw new Error("CHILD_SUBCOLLECTIONS not found in lib/childData.ts");
  const body = block[1].replace(/\/\/.*$/gm, "");
  return [...body.matchAll(/"([A-Za-z]+)"/g)].map((m) => m[1]);
}

/** Every write the seed makes, as data. Throws when a collection is not export/erase-covered. */
export function planDemoWrites(family, { target, uid, allowed = childSubcollectionsFromSource() }) {
  const childId = family.child.id;
  const collections = Object.entries(family.collections).map(([name, docs]) => {
    if (!allowed.includes(name)) throw new Error(`demo collection "${name}" is not in CHILD_SUBCOLLECTIONS — export/erase would miss it`);
    return { name, count: docs.length, docs };
  });
  const parentUid = target === "firestore" ? uid : SANDBOX_UID;
  // P2A AGES: the family's other children, each with her own collections.
  const siblings = (family.siblings ?? []).map((sib) => ({
    childId: sib.child.id,
    collections: Object.entries(sib.collections).map(([name, docs]) => {
      if (!allowed.includes(name)) throw new Error(`demo collection "${name}" is not in CHILD_SUBCOLLECTIONS — export/erase would miss it`);
      return { name, count: docs.length, docs };
    }),
  }));
  return {
    target,
    parentUid,
    childId,
    collections,
    siblings,
    noticedMilestones: family.collections.milestones.filter((m) => m.checked).length,
    // Sandbox: the flag rides in the bundle (child.demo); Firestore: three merges.
    flags:
      target === "firestore"
        ? [
            { path: `users/${parentUid}`, merge: { demo: true, displayName: family.parent.displayName } },
            { path: `users/${parentUid}/children/${childId}`, merge: { demo: true } },
            { path: `retentionRollups/${parentUid}`, merge: { cohort: "demo" } },
          ]
        : [{ path: `bundle child ${childId}`, merge: { demo: true } }],
    memory: [
      { op: "propose+approve", fact: family.memory.approved.fact },
      { op: "propose", fact: family.memory.pending.fact },
      ...(family.memory.pendingMore ?? []).map((m) => ({ op: "propose", fact: m.fact })),
    ],
  };
}

export function renderPlan(plan, { apply }) {
  const lines = [];
  lines.push(`seed-demo-family · ${apply ? "APPLY" : "DRY RUN — writes nothing"} · target ${plan.target} · parent ${plan.parentUid} · child ${plan.childId}`);
  for (const c of plan.collections) lines.push(`  ${c.name.padEnd(16)} ${String(c.count).padStart(4)} docs`);
  lines.push(`  milestones noticed ${plan.noticedMilestones}`);
  for (const sib of plan.siblings ?? []) {
    lines.push(`  sibling ${sib.childId}`);
    for (const c of sib.collections) lines.push(`    ${c.name.padEnd(14)} ${String(c.count).padStart(4)} docs`);
  }
  for (const f of plan.flags) lines.push(`  flag  ${f.path} ← ${JSON.stringify(f.merge)}`);
  for (const m of plan.memory) lines.push(`  memory ${m.op}: ${m.fact}`);
  return lines.join("\n");
}

/* ── effects (injected, so the dry run is provably write-free) ───────────── */

async function sandboxWriters() {
  const { LocalMemoryStore } = await import("../src/memory/localMemoryStore.ts");
  return { memoryStore: new LocalMemoryStore(), familyId: "default-family" };
}

async function applySandbox(family, plan) {
  await mkdir(path.dirname(SANDBOX_BUNDLE_PATH), { recursive: true });
  // W2-GROWTH r2 (Law 8): the bundle carries the same family in BOTH UI
  // languages; the client hydrator picks the one the parent reads in
  // (lib/demoFamilyHydrate). The memory ledger stays in --lang (server-side).
  const { buildDemoFamily } = await import("../src/demo/demoFamily.ts");
  const now = Date.parse(family.seededAt);
  const locales = {};
  for (const lang of ["en", "he"]) {
    const f = lang === family.lang ? family : buildDemoFamily({ now, lang, childId: family.child.id });
    locales[lang] = { child: f.child, collections: f.collections, siblings: f.siblings };
  }
  await writeFile(SANDBOX_BUNDLE_PATH, JSON.stringify({ ...family, locales }, null, 2));
  const { memoryStore, familyId } = await sandboxWriters();
  await seedMemory(memoryStore, family, familyId);
  return { wrote: [SANDBOX_BUNDLE_PATH, "app/.data/memory-ledger.json"], plan };
}

/** The app's own memory write path: propose both, approve one. Idempotent (proposals dedupe on fact).
 *  P1-NEXTLEVEL critic r2 (profile + consult, Law 8/9): the ledger is ONE
 *  language per run. A run in --lang X first retires (status "deleted", the
 *  same decision Forget makes) every live demo fact of the OTHER language, so
 *  an en run after a he run never leaves the Hebrew fact beside the English
 *  one (the EN packet carried the fact twice; Profile counted 9 pending). */
export async function seedMemory(memoryStore, family, familyId) {
  const { appendMemoryProposals, transitionMemory, foldMemoryEvents } = await import("../src/memory/memoryService.ts");
  const { buildDemoFamily } = await import("../src/demo/demoFamily.ts");
  const otherLang = family.lang === "he" ? "en" : "he";
  const other = buildDemoFamily({ now: Date.parse(family.seededAt) || Date.now(), lang: otherLang, childId: family.child.id }).memory;
  const otherFacts = new Set([other.approved.fact, other.pending.fact, ...(other.pendingMore ?? []).map((m) => m.fact)]);
  const live = foldMemoryEvents(await memoryStore.listEvents(family.child.id), family.child.id)
    .filter((i) => otherFacts.has(i.fact) && (i.status === "pending" || i.status === "approved"));
  for (const stale of live) await transitionMemory(memoryStore, stale.memoryId, "deleted");
  const frameRouting = { aim: "-", twoAxes: "-", story: "-", shadow: "-", marriage: "-", shepherd: "-" };
  const items = await appendMemoryProposals(
    memoryStore,
    family.child.id,
    [
      { fact: family.memory.approved.fact, source: family.memory.approved.source, retention: "3 months" },
      { fact: family.memory.pending.fact, source: family.memory.pending.source, retention: "3 months" },
      // W2-CAREPRO c2 r1: the same-topic volume the grouped review needs.
      ...(family.memory.pendingMore ?? []).map((m) => ({ fact: m.fact, source: m.source, retention: "3 months" })),
    ],
    { familyId, prompt: "demo family seed (invented)", frameRouting },
  );
  const toApprove = items.find((i) => i.fact === family.memory.approved.fact && i.status === "pending");
  if (toApprove) await transitionMemory(memoryStore, toApprove.memoryId, "approved");
}

async function applyFirestore(family, plan, args) {
  const { getApps, initializeApp, applicationDefault } = await import("firebase-admin/app");
  const { getFirestore } = await import("firebase-admin/firestore");
  if (!getApps().length) initializeApp({ credential: applicationDefault(), projectId: args.project });
  const db = getFirestore(process.env.FIRESTORE_DATABASE_ID || "(default)");
  const base = `users/${args.uid}/children/${family.child.id}`;
  await db.doc(`users/${args.uid}`).set({ demo: true, displayName: family.parent.displayName }, { merge: true });
  await db.doc(base).set(family.child, { merge: true });
  for (const c of plan.collections) {
    for (const d of c.docs) await db.doc(`${base}/${c.name}/${d.id}`).set(d);
  }
  for (const sib of family.siblings ?? []) {
    const sibBase = `users/${args.uid}/children/${sib.child.id}`;
    await db.doc(sibBase).set(sib.child, { merge: true });
    for (const [name, docs] of Object.entries(sib.collections)) {
      for (const d of docs) await db.doc(`${sibBase}/${name}/${d.id}`).set(d);
    }
  }
  await db.doc(`retentionRollups/${args.uid}`).set({ cohort: "demo" }, { merge: true });
  const { FirestoreMemoryStore } = await import("../src/memory/firestoreMemoryStore.ts");
  const memoryStore = new FirestoreMemoryStore({ firebaseProjectId: args.project, firestoreDatabaseId: process.env.FIRESTORE_DATABASE_ID || "(default)" });
  const familyId = (await memoryStore.ensureFamilyForUser(args.uid)).familyId;
  await seedMemory(memoryStore, family, familyId);
  return { wrote: [`users/${args.uid}`, base, `retentionRollups/${args.uid}`, "children/<childId>/memoryEvents"], plan };
}

export async function runDemoSeed(args, { log = console.log, apply = { sandbox: applySandbox, firestore: applyFirestore } } = {}) {
  const { buildDemoFamily } = await import("../src/demo/demoFamily.ts");
  const now = args.now ? Date.parse(args.now) : Date.now();
  const childId = args.target === "firestore" ? `demo-${String(args.uid).slice(0, 8)}` : undefined;
  const family = buildDemoFamily({ now, lang: args.lang, ...(childId ? { childId } : {}) });
  const plan = planDemoWrites(family, args);
  log(renderPlan(plan, args));
  if (args.json) log(JSON.stringify(family, null, 2));
  if (!args.apply) return { wrote: [], plan, family };
  const result = await apply[args.target](family, plan, args);
  log(`wrote: ${result.wrote.join(" · ")}`);
  return { ...result, family };
}

/* ── CLI ─────────────────────────────────────────────────────────────────── */

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    const args = parseArgs(process.argv.slice(2));
    if (args.help) {
      console.log(`Sandbox: npm run seed:demo [-- --apply] [--lang he] [--json]\nProduction (GUY only, after creating the demo Auth user):\n  ${PROD_COMMAND}`);
    } else {
      await runDemoSeed(args);
    }
  } catch (error) {
    console.error(`seed-demo-family: ${error?.message ?? error}`);
    process.exitCode = 1;
  }
}

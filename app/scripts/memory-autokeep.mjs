/**
 * memory-autokeep — B-SHELL-26. End the review queue for what the parent
 * wrote themselves: list the PENDING memory proposals per family/child by
 * provenance class (memoryService.memoryProvenanceClass — the same rule the
 * server now applies when a proposal is created: ≥ 80 % of the fact's content
 * tokens are in the parent's own message), and, with --apply, approve the
 * parent-written class. Inferences stay pending (asked inline, B-AI-07).
 *
 *   npx tsx app/scripts/memory-autokeep.mjs [--child <id>] [--json]
 *   npx tsx app/scripts/memory-autokeep.mjs --apply      ← GUY only, after reading the dry run
 *
 * DRY RUN (default): prints counts per family/child (pending · parent-written
 * · inference) and the facts that would be kept. Writes NOTHING.
 *
 * --apply: for each parent-written pending fact, ONE appended `approved`
 * event, actor "system", reason "parent-written" (the ledger stays
 * append-only; nothing is edited or deleted). Re-running finds nothing to do.
 *
 * Runs on Application Default Credentials against the configured Firestore
 * (FIREBASE_PROJECT_ID / FIRESTORE_DATABASE_ID). Builders never run --apply
 * against production.
 */
import process from "node:process";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";

export function parseArgs(argv) {
  const out = { apply: false, json: false, child: null, help: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--apply") out.apply = true;
    else if (a === "--json") out.json = true;
    else if (a === "--child") out.child = argv[++i] ?? null;
    else if (a === "--help" || a === "-h") out.help = true;
  }
  return out;
}

/** Pure: fold the ledger, classify pending facts per family + child. */
export async function planAutokeep(events, { child = null, childNames = {} } = {}) {
  const { foldMemoryEvents, memoryProvenanceClass } = await import("../src/memory/memoryService.ts");
  const groups = new Map();
  for (const item of foldMemoryEvents(events)) {
    if (item.status !== "pending") continue;
    if (child && item.childId !== child) continue;
    const key = `${item.familyId}/${item.childId}`;
    if (!groups.has(key)) groups.set(key, { familyId: item.familyId, childId: item.childId, pending: 0, parentWritten: [], inference: 0 });
    const g = groups.get(key);
    g.pending += 1;
    if (memoryProvenanceClass(item.fact, item.prompt, childNames[item.childId] ?? null) === "parent_written") g.parentWritten.push(item);
    else g.inference += 1;
  }
  const children = [...groups.values()];
  return {
    pending: children.reduce((n, c) => n + c.pending, 0),
    parentWritten: children.reduce((n, c) => n + c.parentWritten.length, 0),
    inference: children.reduce((n, c) => n + c.inference, 0),
    children,
  };
}

/** The approved events --apply would append (one per parent-written fact). */
export function approvalEvents(plan, now = new Date().toISOString()) {
  const out = [];
  for (const c of plan.children) {
    for (const d of c.parentWritten) {
      out.push({
        eventId: randomUUID(),
        memoryId: d.memoryId,
        familyId: d.familyId,
        childId: d.childId,
        eventType: "approved",
        status: "approved",
        fact: d.fact,
        source: d.source,
        retention: d.retention,
        createdAt: now,
        actor: "system",
        reason: "parent-written",
        ...(d.prompt ? { prompt: d.prompt } : {}),
        ...(d.frameRouting ? { frameRouting: d.frameRouting } : {}),
        ...(d.domains ? { domains: d.domains } : {}),
        ...(d.topicKey ? { topicKey: d.topicKey } : {}),
      });
    }
  }
  return out;
}

export function renderPlan(plan, { apply }) {
  const lines = [`memory-autokeep · ${apply ? "APPLY" : "DRY RUN — writes nothing"}`];
  lines.push(`  pending ${plan.pending} · parent-written ${plan.parentWritten} · inference ${plan.inference}`);
  for (const c of plan.children) {
    lines.push(`  family ${c.familyId} · child ${c.childId}: pending ${c.pending} → keep ${c.parentWritten.length} · ask inline ${c.inference}`);
    for (const d of c.parentWritten) lines.push(`    keep  ${d.fact}`);
  }
  return lines.join("\n");
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    const args = parseArgs(process.argv.slice(2));
    if (args.help) {
      console.log("npx tsx app/scripts/memory-autokeep.mjs [--child <id>] [--json] [--apply]");
    } else {
      const { FirestoreMemoryStore } = await import("../src/memory/firestoreMemoryStore.ts");
      const store = new FirestoreMemoryStore({
        firebaseProjectId: process.env.FIREBASE_PROJECT_ID || process.env.GCP_PROJECT_ID,
        firestoreDatabaseId: process.env.FIRESTORE_DATABASE_ID || "(default)",
      });
      const plan = await planAutokeep(await store.listEvents(args.child ?? undefined), { child: args.child });
      console.log(renderPlan(plan, args));
      if (args.json) console.log(JSON.stringify(plan, null, 2));
      if (args.apply) {
        const events = approvalEvents(plan);
        for (const e of events) await store.appendEvent(e);
        console.log(`appended ${events.length} approved(parent-written) events`);
      }
    }
  } catch (error) {
    console.error(`memory-autokeep: ${error?.message ?? error}`);
    process.exitCode = 1;
  }
}

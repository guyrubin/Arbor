/**
 * memory-dedupe-report — B-AI-07. The one-off cleanup of the pending memory
 * queue (103 proposed / 0 approved on prod, 23 Sep): group near-duplicate
 * pending facts per child with the SAME rule the server now applies before a
 * proposal is appended (memoryService.groupNearDuplicates: normalised word
 * sets, Jaccard ≥ 0.6, child name → one token, HE niqqud-insensitive).
 *
 *   npx tsx app/scripts/memory-dedupe-report.mjs [--child <id>] [--json]
 *   npx tsx app/scripts/memory-dedupe-report.mjs --apply      ← only after Guy reads the report
 *
 * DRY RUN (default): prints, per child, pending facts → groups → duplicates,
 * and the total group count (target ≤ 12 for the 103). Writes NOTHING.
 *
 * --apply: for every group, the OLDEST fact stays pending; each other member
 * gets ONE appended `rejected` event with `reason: "duplicate"` (the ledger
 * stays append-only — F8; no event is edited or deleted). Re-running finds
 * nothing to do.
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

/** Pure: fold the ledger, group pending facts per child. */
export async function planDedupe(events, { child = null } = {}) {
  const { foldMemoryEvents, groupNearDuplicates } = await import("../src/memory/memoryService.ts");
  const byChild = new Map();
  for (const item of foldMemoryEvents(events)) {
    if (child && item.childId !== child) continue;
    if (!byChild.has(item.childId)) byChild.set(item.childId, []);
    byChild.get(item.childId).push(item);
  }
  const children = [...byChild.entries()].map(([childId, items]) => {
    const groups = groupNearDuplicates(items);
    return {
      childId,
      pending: items.filter((i) => i.status === "pending").length,
      groups: groups.length,
      duplicates: groups.reduce((n, g) => n + g.duplicates.length, 0),
      detail: groups,
    };
  });
  return {
    pending: children.reduce((n, c) => n + c.pending, 0),
    groups: children.reduce((n, c) => n + c.groups, 0),
    duplicates: children.reduce((n, c) => n + c.duplicates, 0),
    children,
  };
}

/** The rejected events --apply would append (one per duplicate). */
export function rejectionEvents(plan, now = new Date().toISOString()) {
  const out = [];
  for (const c of plan.children) {
    for (const g of c.detail) {
      for (const d of g.duplicates) {
        out.push({
          eventId: randomUUID(),
          memoryId: d.memoryId,
          familyId: d.familyId,
          childId: d.childId,
          eventType: "rejected",
          status: "rejected",
          fact: d.fact,
          source: d.source,
          retention: d.retention,
          createdAt: now,
          actor: "system",
          reason: "duplicate",
          ...(d.prompt ? { prompt: d.prompt } : {}),
          ...(d.frameRouting ? { frameRouting: d.frameRouting } : {}),
          ...(d.domains ? { domains: d.domains } : {}),
          ...(d.topicKey ? { topicKey: d.topicKey } : {}),
        });
      }
    }
  }
  return out;
}

export function renderPlan(plan, { apply }) {
  const lines = [`memory-dedupe-report · ${apply ? "APPLY" : "DRY RUN — writes nothing"}`];
  lines.push(`  pending ${plan.pending} · groups ${plan.groups} · duplicates ${plan.duplicates}`);
  for (const c of plan.children) {
    lines.push(`  child ${c.childId}: pending ${c.pending} → groups ${c.groups} (duplicates ${c.duplicates})`);
    for (const g of c.detail.filter((x) => x.duplicates.length)) {
      lines.push(`    keep  ${g.head.fact}`);
      for (const d of g.duplicates) lines.push(`    dup   ${d.fact}`);
    }
  }
  return lines.join("\n");
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    const args = parseArgs(process.argv.slice(2));
    if (args.help) {
      console.log("npx tsx app/scripts/memory-dedupe-report.mjs [--child <id>] [--json] [--apply]");
    } else {
      const { FirestoreMemoryStore } = await import("../src/memory/firestoreMemoryStore.ts");
      const store = new FirestoreMemoryStore({
        firebaseProjectId: process.env.FIREBASE_PROJECT_ID || process.env.GCP_PROJECT_ID,
        firestoreDatabaseId: process.env.FIRESTORE_DATABASE_ID || "(default)",
      });
      const plan = await planDedupe(await store.listEvents(args.child ?? undefined), { child: args.child });
      console.log(renderPlan(plan, args));
      if (args.json) console.log(JSON.stringify(plan, null, 2));
      if (args.apply) {
        const events = rejectionEvents(plan);
        for (const e of events) await store.appendEvent(e);
        console.log(`appended ${events.length} rejected(duplicate) events`);
      }
    }
  } catch (error) {
    console.error(`memory-dedupe-report: ${error?.message ?? error}`);
    process.exitCode = 1;
  }
}

/**
 * B-GROWTH-22a — no stored grades on a child (law 1, stored data).
 *
 * Until 6 Oct `useCopilot` built a weekly `bandSnapshots` document
 * (`pendingSnapshot(…)` → `snapshotsCol.upsert(snap)`, one per ISO week) that
 * stored every practice domain's 0–100 `signal` and its `band` — a grade on a
 * child, kept in Firestore and in every GDPR export — and `bandTrend` read the
 * stored series back as per-domain deltas. B-GROWTH-06 had already stopped the
 * `devScoreSnapshots` writer. This guard pins BOTH collections: no non-test
 * file under app/src writes either one.
 *
 * What is still allowed: the registry entries (lib/childData.ts +
 * lib/childDataGroups.ts — export + erase until W4-P1 / Guy G12) and the
 * read-only bindings in practice/usePracticeData.ts and the supported Record
 * disclosure SavedMilestoneHistory.tsx (saved counts only). Erasure
 * (`remove`, `deleteDoc` in the GDPR sweep) is not a write of a grade.
 */
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { CHILD_SUBCOLLECTIONS } from "../lib/childData";
import * as signals from "./signals";
import * as counter from "../../scripts/count-band-snapshots.mjs";

const SRC = path.resolve(__dirname, "..");
const stripComments = (s: string) =>
  s.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const walk = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return walk(p);
    return /\.(ts|tsx)$/.test(e.name) && !/\.test\.(ts|tsx)$/.test(e.name) ? [p] : [];
  });
const rel = (abs: string) => path.relative(SRC, abs).split(path.sep).join("/");
const NON_TEST = walk(SRC).map((abs) => ({ rel: rel(abs), code: stripComments(readFileSync(abs, "utf8")) }));

const GRADE_COLLECTIONS = ["bandSnapshots", "devScoreSnapshots"] as const;
const NAMES = /\b(bandSnapshots|devScoreSnapshots)\b/;

/** `const X = useChildCollection<…>(…, "bandSnapshots", …)` → X. */
function boundCollections(code: string): { name: string; collection: string }[] {
  const out: { name: string; collection: string }[] = [];
  const re = /(?:const|let|var)\s+(\w+)\s*=\s*useChildCollection\s*(?:<[^>]*>)?\s*\([^)]*?"(bandSnapshots|devScoreSnapshots)"/g;
  for (const m of code.matchAll(re)) out.push({ name: m[1], collection: m[2] });
  return out;
}

/** Every write a ChildCollection or the Firestore SDK offers, on a bound variable. */
function writesThrough(code: string, name: string): boolean {
  return new RegExp(`\\b${name}\\s*\\.\\s*(upsert|replaceAll|set|add|update)\\s*\\(`).test(code)
    || new RegExp(`\\{[^}]*\\b(upsert|replaceAll)\\b[^}]*\\}\\s*=\\s*${name}\\b`).test(code);
}

/** A direct Firestore write naming a grade collection in the same statement window. */
const DIRECT_WRITE = /\b(setDoc|addDoc|updateDoc|\w+\.set|\w+\.update)\s*\([\s\S]{0,200}?["'`/](bandSnapshots|devScoreSnapshots)["'`/]/;
const DIRECT_WRITE_REF = /(?:collection|doc)\s*\([\s\S]{0,160}?["'`/](bandSnapshots|devScoreSnapshots)["'`/][\s\S]{0,400}?\b(setDoc|addDoc|updateDoc)\s*\(/;

describe("B-GROWTH-22a — 0 non-test writers of a stored grade", () => {
  it("only the registry + explicit read-only bindings name either collection", () => {
    const naming = NON_TEST.filter((f) => NAMES.test(f.code)).map((f) => f.rel).sort();
    expect(naming).toEqual(["components/companion/SavedMilestoneHistory.tsx", "lib/childData.ts", "lib/childDataGroups.ts", "practice/usePracticeData.ts"]);
  });

  it("no useChildCollection binding of either collection is ever written", () => {
    const bindings = NON_TEST.flatMap((f) => boundCollections(f.code).map((b) => ({ ...b, rel: f.rel, code: f.code })));
    expect(bindings.map((b) => `${b.rel}:${b.collection}`)).toEqual(["components/companion/SavedMilestoneHistory.tsx:bandSnapshots", "practice/usePracticeData.ts:bandSnapshots"]);
    expect(bindings.filter((b) => writesThrough(b.code, b.name)).map((b) => `${b.rel}:${b.name}`)).toEqual([]);
  });

  it("no direct Firestore write names either collection", () => {
    const hits = NON_TEST.filter((f) => DIRECT_WRITE.test(f.code) || DIRECT_WRITE_REF.test(f.code)).map((f) => f.rel);
    expect(hits).toEqual([]);
  });

  it("the snapshot builder and the stored-trend reader are gone", () => {
    expect("pendingSnapshot" in signals).toBe(false);
    expect("bandTrend" in signals).toBe(false);
    expect(NON_TEST.filter((f) => /\b(pendingSnapshot|bandTrend)\b/.test(f.code)).map((f) => f.rel)).toEqual([]);
  });

  it("useCopilot returns no stored trend and runs no persist effect", () => {
    const hook = NON_TEST.find((f) => f.rel === "practice/usePracticeData.ts")!.code;
    expect(hook).not.toMatch(/\btrend\b/);
    expect(hook).not.toMatch(/\buseEffect\b/);
  });

  it("the legacy documents still export and erase until W4-P1 (Guy G12)", () => {
    for (const c of GRADE_COLLECTIONS) expect(CHILD_SUBCOLLECTIONS).toContain(c);
  });
});

describe("B-GROWTH-22a — NEGATIVE CONTROL: the pre-change writer shapes trip the scans", () => {
  const OLD_WRITER = `
    const snapshotsCol = useChildCollection<BandSnapshot>(childId, "bandSnapshots", {
      orderByField: "date",
      orderDir: "desc",
      max: 60,
    });
    useEffect(() => {
      const snap = pendingSnapshot(snapshotsCol.items, bands, data.today, milestones);
      if (snap) void snapshotsCol.upsert(snap);
    }, [snapshotsCol.items]);
    const trend = useMemo(() => bandTrend(snapshotsCol.items, bands), [snapshotsCol.items, bands]);
  `;

  it("binding + upsert", () => {
    expect(boundCollections(OLD_WRITER)).toEqual([{ name: "snapshotsCol", collection: "bandSnapshots" }]);
    expect(writesThrough(OLD_WRITER, "snapshotsCol")).toBe(true);
    expect(writesThrough(OLD_WRITER.replace("snapshotsCol.upsert(snap)", "snapshotsCol.replaceAll([snap])"), "snapshotsCol")).toBe(true);
    expect(writesThrough("const { upsert } = snapshotsCol;", "snapshotsCol")).toBe(true);
    expect(writesThrough(OLD_WRITER.replace("if (snap) void snapshotsCol.upsert(snap);", ""), "snapshotsCol")).toBe(false);
  });

  it("the devScore writer shape B-GROWTH-06 removed", () => {
    const old = 'const snapCol = useChildCollection<StoredDevScoreSnapshot>(childProfile.id, "devScoreSnapshots", { max: 60 });\n snapCol.upsert(toSnapshot(score));';
    expect(boundCollections(old)).toEqual([{ name: "snapCol", collection: "devScoreSnapshots" }]);
    expect(writesThrough(old, "snapCol")).toBe(true);
  });

  it("direct Firestore writes", () => {
    expect(DIRECT_WRITE.test("await setDoc(doc(db, `users/${uid}/children/${id}/bandSnapshots/${wk}`), snap);")).toBe(true);
    expect(DIRECT_WRITE_REF.test('const ref = collection(db, "users", uid, "children", id, "devScoreSnapshots");\n await addDoc(ref, s);')).toBe(true);
  });

  it("the identifier scans", () => {
    expect(/\b(pendingSnapshot|bandTrend)\b/.test(OLD_WRITER)).toBe(true);
    expect(/\btrend\b/.test(OLD_WRITER)).toBe(true);
    expect(/\buseEffect\b/.test(OLD_WRITER)).toBe(true);
  });
});

describe("B-GROWTH-22a — the dry-run counter (scripts/count-band-snapshots.mjs) is read-only", () => {
  const SCRIPT = readFileSync(path.resolve(__dirname, "..", "..", "scripts", "count-band-snapshots.mjs"), "utf8");
  const code = SCRIPT.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

  it("counts both grade collections, documents and distinct children, ERROR (never 0) on failure", async () => {
    expect(counter.GRADE_COLLECTIONS).toEqual(["bandSnapshots", "devScoreSnapshots"]);
    const rows = await counter.runCount(
      ["bandSnapshots", "devScoreSnapshots", "broken"],
      async (n: string) => { if (n === "broken") throw new Error("permission-denied"); return n === "bandSnapshots" ? 3 : 1; },
      async (n: string) => n === "bandSnapshots"
        ? ["users/u1/children/c1/bandSnapshots/2026-W40", "users/u1/children/c1/bandSnapshots/2026-W41", "users/u2/children/c9/bandSnapshots/2026-W40"]
        : ["users/u1/children/c1/devScoreSnapshots/2026-W30"],
    );
    expect(rows.map((r: { documents: number | null; children: number | null }) => [r.documents, r.children])).toEqual([[3, 2], [1, 1], [null, null]]);
    const table = counter.formatRows(rows);
    expect(table).toMatch(/bandSnapshots\s+3\s+2/);
    expect(table).toMatch(/broken\s+ERROR permission-denied/);
    expect(counter.childPathOf("not/a/child/path")).toBeNull();
  });

  it("--help prints usage offline", () => {
    expect(counter.USAGE).toContain("--help");
    expect(code).toMatch(/argv\.includes\("--help"\)[\s\S]{0,80}console\.log\(USAGE\)/);
  });

  it("zero writes, zero deletes, no field read", () => {
    for (const banned of [".delete(", ".set(", ".update(", ".add(", "batch(", "bulkWriter", "recursiveDelete", "runTransaction", ".listDocuments(", "--delete", "--purge"]) {
      expect(code, `counter must not call ${banned}`).not.toContain(banned);
    }
    expect(code).toContain("db.collectionGroup(name).count().get()");
    expect(code).toContain("db.collectionGroup(name).select().get()");
    // the only .data() read is the aggregation's integer
    expect(code.match(/\.data\(\)/g)?.length).toBe(1);
    expect(code).toContain(".data().count");
    expect(code).not.toMatch(/--(delete|purge|confirm)/);
  });
});

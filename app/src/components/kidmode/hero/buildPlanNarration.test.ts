/**
 * PR C (Everyday Plans) — the plan narration builder: every file of every
 * shelf plan book in the folder the child hears, ids only (the sandbox adds
 * the plan document), files the device already sees stored are not asked for,
 * a refusal or the quota stops the run, the settling plan is waited out, the
 * sandbox keeps the docs, a finished configuration is not asked again (and a
 * new name or a re-approved plan is), the approved document rides along, and
 * the canonical triggers (the handover, the sheet's commit) start it.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const h = vi.hoisted(() => ({ owner: "owner-a", plan: vi.fn() }));
vi.mock("../../../lib/heroSheetStore", async (original) => ({ ...(await original<typeof import("../../../lib/heroSheetStore")>()), heroSheetOwnerKey: () => h.owner }));
vi.mock("../../../lib/api", () => ({ authHeaders: async () => ({ "content-type": "application/json" }) }));

import type { BookAssetsDoc } from "../../../lib/library/bookAssetPaths";
import { planBookFromDoc, type PlanBookDoc } from "../../../lib/library/plans/planBookDoc";
import { emptyPlanNarrationDoc, planNarrationFiles, planNarrationRel, planNarrationRequest } from "../../../lib/library/plans/planNarration";
import { PLAN_POSES, PLAN_SHEET_BOOK_ID } from "../../../lib/library/plans/planPoses";
import { buildPlanNarration, ensurePlanNarration, planEntriesOf, resetPlanNarrationForTest, spokenFirstName, type PlanNarrationBuilderDeps, type PlanNarrationCall, type PlanNarrationSource } from "./buildPlanNarration";

const here = path.dirname(fileURLToPath(import.meta.url));
const CHILD = "synthetic-child";
const child = { id: CHILD, name: "Maya Cohen", gender: "girl" as const };
const planOf = (pattern: "plan-poo-sit" | "plan-sleep-alone", extra: Partial<PlanBookDoc> = {}): PlanBookDoc => ({
  id: `${pattern}.${CHILD}`, bookId: `${pattern}.${CHILD}`, kind: "plan", pattern, lang: "en",
  stepMenuIds: pattern === "plan-poo-sit" ? ["sit-after-meal", "the-box", "just-try"] : ["four-steps", "sit-further", "morning-check-in"],
  minutes: 5, time: "after-meal", boxItemIds: [], durationDays: 14,
  approvedAt: new Date().toISOString(), approvedBy: "parent", createdAt: "t", updatedAt: "t", status: "active", ...extra,
});
const SHEET = "h-0123456789abcdef";
const sheet: BookAssetsDoc = {
  id: PLAN_SHEET_BOOK_ID, bookId: PLAN_SHEET_BOOK_ID, sheetId: SHEET, setId: SHEET,
  sheetManifest: { poses: Object.fromEntries(PLAN_POSES.map((p) => [p, { file: `${p}.webp` }])) },
  files: PLAN_POSES.map((p) => `hero-sheets/${SHEET}/${p}.webp`), bytes: 1, createdAt: "t0",
};
const POO = planNarrationFiles(planBookFromDoc(planOf("plan-poo-sit"))!, "en").map((f) => f.file);

function fake(source: PlanNarrationSource, answer: (body: { pattern: string; lang: string; file: string; plan?: PlanBookDoc }, n: number) => PlanNarrationCall = () => ({ ok: true, complete: false, cached: false }), extra: Partial<PlanNarrationBuilderDeps> = {}) {
  const bodies: { pattern: string; lang: string; file: string; plan?: PlanBookDoc }[] = [];
  const kept: BookAssetsDoc[] = [];
  const sleeps: number[] = [];
  const deps: PlanNarrationBuilderDeps = {
    read: async () => source,
    render: async (body) => { bodies.push(body); return answer(body, bodies.length); },
    keepLocalDoc: async (d) => void kept.push(d),
    sleep: async (ms) => void sleeps.push(ms),
    ...extra,
  };
  return { deps, bodies, kept, sleeps };
}
const mem = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), m };
};

beforeEach(() => { h.owner = "owner-a"; resetPlanNarrationForTest(); });
afterEach(() => vi.unstubAllGlobals());

describe("PR C: the plan narration builder", () => {
  it("the shelf's plan books only: an active plan with a complete plan sheet; a closed plan, a missing sheet, junk rows never", () => {
    expect(planEntriesOf({ docs: [sheet], plans: [planOf("plan-poo-sit"), planOf("plan-sleep-alone", { status: "closed" }), { junk: true }] }).map((e) => e.book.id)).toEqual([`plan-poo-sit.${CHILD}`]);
    expect(planEntriesOf({ docs: [], plans: [planOf("plan-poo-sit")] })).toEqual([]);
    // the just-approved document replaces the stored row of the same id
    const entries = planEntriesOf({ docs: [sheet], plans: [planOf("plan-poo-sit", { minutes: 3 })] }, planOf("plan-poo-sit", { minutes: 7 }));
    expect(entries[0].doc.minutes).toBe(7);
    expect(entries[0].book.pages.map((p) => p.id)).toContain("s1-sit-after-meal-7m");
  });

  it("asks for every file of every plan book in the folder, ids only; the sandbox adds the plan document; the kept docs are the sandbox's", async () => {
    const both = { docs: [sheet], plans: [planOf("plan-poo-sit"), planOf("plan-sleep-alone")] };
    const doc = emptyPlanNarrationDoc(CHILD, "plan-poo-sit", "t1");
    const f = fake(both, (b, n) => ({ ok: true, complete: n === 9, cached: n % 2 === 0, ...(b.pattern === "plan-poo-sit" ? { doc, local: true } : {}) }));
    const r = await buildPlanNarration({ childId: CHILD, folder: "he-f", child }, f.deps);
    expect(r).toMatchObject({ status: "complete", asked: 18, rendered: 9 });
    expect(r.books.sort()).toEqual([`plan-poo-sit.${CHILD}`, `plan-sleep-alone.${CHILD}`]);
    expect(f.bodies.filter((b) => b.pattern === "plan-poo-sit").map((b) => b.file)).toEqual(POO);
    for (const b of f.bodies) expect(Object.keys(b).sort()).toEqual(["file", "lang", "pattern"]);
    expect(f.bodies.every((b) => b.lang === "he-f")).toBe(true);
    expect(f.kept).toEqual([doc]);
    const sandbox = fake(both, () => ({ ok: true, complete: false, cached: false }), { planInBody: true });
    await buildPlanNarration({ childId: CHILD, folder: "en", child }, sandbox.deps);
    expect(sandbox.bodies.find((b) => b.pattern === "plan-poo-sit")!.plan).toStrictEqual(both.plans[0]);
  });

  it("a file the device already sees stored with the current words is not asked for; a renamed child asks for the name lines again", async () => {
    const book = planBookFromDoc(planOf("plan-poo-sit"))!;
    const rels = POO.map((f) => planNarrationRel(CHILD, "en", f));
    const text = Object.fromEntries(POO.map((f, i) => [rels[i], planNarrationRequest(book, "en", f, spokenFirstName(child, "en"))!.textHash]));
    const narration: BookAssetsDoc = { ...emptyPlanNarrationDoc(CHILD, "plan-poo-sit", "t1"), files: rels, narrationText: text };
    const done = fake({ docs: [sheet, narration], plans: [planOf("plan-poo-sit")] });
    expect(await buildPlanNarration({ childId: CHILD, folder: "en", child }, done.deps)).toMatchObject({ status: "complete", asked: 0, rendered: 0 });
    const renamed = fake({ docs: [sheet, narration], plans: [planOf("plan-poo-sit")] });
    await buildPlanNarration({ childId: CHILD, folder: "en", child: { ...child, name: "Noa Cohen" } }, renamed.deps);
    expect(renamed.bodies.map((b) => b.file)).toEqual(["cover.mp3", "p8.mp3"]);
    // the English voice says the English letters when the parent saved them (B-KID-168)
    expect(spokenFirstName({ id: CHILD, name: "נועה כהן", nameLatin: "Noa Cohen" }, "en")).toBe("Noa");
    expect(spokenFirstName({ id: CHILD, name: "נועה כהן", nameLatin: "Noa Cohen" }, "he-f")).toBe("נועה");
  });

  it("a refusal or the quota stops the run; the rate limit, a busy voice and a settling plan are waited out; no plan = nothing", async () => {
    const one = { docs: [sheet], plans: [planOf("plan-poo-sit")] };
    const quota = fake(one, (_b, n) => (n === 3 ? { ok: false, status: 429, code: "book_narration_resting" } : { ok: true, complete: false, cached: false }));
    expect(await buildPlanNarration({ childId: CHILD, folder: "en", child }, quota.deps)).toMatchObject({ status: "stopped", stoppedBy: "book_narration_resting", rendered: 2 });
    expect(quota.bodies).toHaveLength(3);
    const plan = fake(one, () => ({ ok: false, status: 403, code: "book_narration_plan" }));
    expect(await buildPlanNarration({ childId: CHILD, folder: "en", child }, plan.deps)).toMatchObject({ status: "not-started", stoppedBy: "book_narration_plan" });
    const limited = fake(one, (_b, n) => (n <= 2 ? { ok: false, status: 429, code: "book_assets_rate" } : n === 3 ? { ok: false, status: 503, code: "book_narration_busy" } : n === 4 ? { ok: false, status: 409, code: "plan_narration_no_plan" } : { ok: true, complete: false, cached: true }));
    expect((await buildPlanNarration({ childId: CHILD, folder: "en", child }, limited.deps)).status).toBe("complete");
    expect(limited.sleeps).toEqual([20_000, 20_000, 8000, 5000]);
    const none = fake({ docs: [sheet], plans: [] });
    expect(await buildPlanNarration({ childId: CHILD, folder: "en", child }, none.deps)).toMatchObject({ status: "not-started", stoppedBy: "no-plan" });
    expect(none.bodies).toEqual([]);
  });

  it("a retired scope stops before the next request", async () => {
    let alive = true;
    const f = fake({ docs: [sheet], plans: [planOf("plan-poo-sit")] }, (_b, n) => { if (n === 2) alive = false; return { ok: true, complete: false, cached: false }; }, { isCurrent: () => alive });
    expect(await buildPlanNarration({ childId: CHILD, folder: "en", child }, f.deps)).toMatchObject({ status: "stopped", stoppedBy: "scope_changed" });
    expect(f.bodies).toHaveLength(2);
  });
});

describe("PR C: when it runs", () => {
  const one = { docs: [sheet], plans: [planOf("plan-poo-sit")] };

  it("runs once per configuration on a device: again only when the name, the folder or a plan's words change; the approved document rides along", async () => {
    const storage = mem();
    const a = fake(one);
    expect((await ensurePlanNarration(child, "he-f", { deps: a.deps, storage }))?.status).toBe("complete");
    expect(a.bodies).toHaveLength(9);
    resetPlanNarrationForTest();
    const b = fake(one);
    expect(await ensurePlanNarration(child, "he-f", { deps: b.deps, storage })).toBeNull();
    expect(b.bodies).toHaveLength(0);
    const c = fake(one);
    await ensurePlanNarration({ ...child, name: "Noa" }, "he-f", { deps: c.deps, storage });
    expect(c.bodies).toHaveLength(9);
    const d = fake(one);
    await ensurePlanNarration({ ...child, name: "Noa" }, "en", { deps: d.deps, storage });
    expect(d.bodies.every((x) => x.lang === "en")).toBe(true);
    // a re-approved plan (other words) runs again, with the approved document even before the collection has it
    const e = fake({ docs: [sheet], plans: [] });
    await ensurePlanNarration({ ...child, name: "Noa" }, "en", { deps: e.deps, storage, planDoc: planOf("plan-poo-sit", { minutes: 8 }) });
    expect(e.bodies.map((x) => x.file)).toContain("s1-sit-after-meal-8m.mp3");
    const f = fake({ docs: [sheet], plans: [] });
    expect(await ensurePlanNarration({ ...child, name: "Noa" }, "en", { deps: f.deps, storage, planDoc: planOf("plan-poo-sit", { minutes: 8 }) })).toBeNull();
    // no plan on the shelf, no name, a signed-out owner: nothing
    expect(await ensurePlanNarration(child, "en", { deps: fake({ docs: [sheet], plans: [] }).deps, storage })).toBeNull();
    expect(ensurePlanNarration({ ...child, name: "" }, "en", { deps: fake(one).deps, storage })).toBeNull();
    h.owner = "signed-out";
    expect(ensurePlanNarration(child, "en", { deps: fake(one).deps, storage })).toBeNull();
  });

  it("shares in-flight work; a refusal never poisons a later trigger; a retired owner's work stops", async () => {
    let finish: ((v: PlanNarrationCall) => void) | undefined;
    const slow = fake(one);
    slow.deps.render = async (body) => { slow.bodies.push(body); return slow.bodies.length === 1 ? new Promise<PlanNarrationCall>((r) => { finish = r; }) : { ok: true, complete: false, cached: true }; };
    const first = ensurePlanNarration(child, "en", { deps: slow.deps, storage: null });
    const second = ensurePlanNarration(child, "en", { deps: slow.deps, storage: null });
    expect(second).toBe(first);
    while (!finish) await new Promise((r) => setTimeout(r, 0));
    finish({ ok: true, complete: false, cached: false });
    expect((await first)?.status).toBe("complete");
    expect(await ensurePlanNarration(child, "en", { deps: slow.deps, storage: null })).toBeNull();
    resetPlanNarrationForTest();
    const refused = fake(one, () => ({ ok: false, status: 403, code: "book_narration_plan" }));
    expect((await ensurePlanNarration(child, "en", { deps: refused.deps, storage: null }))?.status).toBe("not-started");
    const again = fake(one);
    expect((await ensurePlanNarration(child, "en", { deps: again.deps, storage: null }))?.status).toBe("complete");
    resetPlanNarrationForTest();
    const owned = fake(one, (_b, n) => { if (n === 1) h.owner = "owner-b"; return { ok: true, complete: false, cached: false }; });
    expect(await ensurePlanNarration(child, "en", { deps: owned.deps, storage: null, scope: { ownerKey: "owner-a", isCurrent: () => true } })).toMatchObject({ status: "stopped", stoppedBy: "scope_changed" });
    expect(owned.bodies).toHaveLength(1);
  });

  it("the canonical triggers start it: the handover (ensureBookNarration) and the sheet's commit (afterBookSheet) in the browser wiring; the plan's approval in the composer", () => {
    const narration = readFileSync(path.join(here, "buildBookNarration.ts"), "utf8");
    expect(narration).toContain('import { ensurePlanNarration } from "./buildPlanNarration";');
    expect(narration).toContain("if (!deps) planNarrationFor(child.id, ctx);");
    expect(narration).toContain("if (!deps) planNarrationFor(childId, ctx);");
    expect((narration.match(/planNarrationFor\(/g) ?? []).length).toBe(3);
    const composer = readFileSync(path.resolve(here, "../../plans/PlanComposer.tsx"), "utf8");
    expect(composer).toContain('import("../kidmode/hero/buildPlanNarration")');
    expect(composer).toContain("m.ensurePlanNarration(child, m.narrationFolder(doc.lang, child.gender), { planDoc: doc })");
    // the builder itself never talks to Firebase (cosmeticsFirewall): the read lives in lib/planNarrationSource
    const builder = readFileSync(path.join(here, "buildPlanNarration.ts"), "utf8");
    expect(builder).not.toMatch(/firebase/);
    expect(builder).toContain('from "../../../lib/planNarrationSource"');
    // the only parent doors: no other module starts it
    const sheet = readFileSync(path.join(here, "buildBookSheet.ts"), "utf8");
    expect(sheet).not.toContain("buildPlanNarration");
  });
});

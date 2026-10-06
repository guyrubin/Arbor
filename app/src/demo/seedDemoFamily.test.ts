/**
 * B-DIST-01 — the sanitized demo family guard (the item's
 * `scripts/seedDemoFamily.test.ts`; vitest only collects src/**, so it lives
 * beside the demo module and drives app/scripts/seed-demo-family.mjs).
 *
 *  1. the dry run writes nothing; --apply calls exactly the target's writer;
 *  2. every collection written is in CHILD_SUBCOLLECTIONS (export + erase cover it);
 *  3. the record is the item's shape (14 moments, 2 photos, 3 hard, 5 noticed,
 *     4 words with 2 HE, 2 steps one "helped", 1 Kid session, 1 visit + note,
 *     1 approved + 1 pending fact), EN + HE;
 *  4. no fixture string matches a real-name list;
 *  5. the cohort reader (route + cohort-report.mjs) excludes the demo family
 *     and reports it in `excluded`; a session never re-tags it;
 *  6. the sandbox hydrator writes the same per-child keys the app reads;
 *     the sandbox route does not exist in prod;
 *  7. every egress (Consult Markdown + PDF, School Brief, Sharing views) carries
 *     the demo header EN + HE; the switcher chip is a quiet token-only label.
 */
import { describe, expect, it, vi } from "vitest";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import express from "express";
import type { AddressInfo } from "node:net";
import { buildDemoFamily, DEMO_CHILD_ID, DEMO_FAMILY_VERSION, DEMO_SIBLING_ID, demoFamilyCounts, demoSandboxStorage } from "./demoFamily";
import type { ActionLoopEntry } from "../actionLoop/model";
import { initialMilestones } from "../initialData";
import { PRACTICES } from "../content/practices";
import { milestoneAgeWindow } from "../lib/milestoneData";
import { observeMilestoneDoc } from "../lib/milestones/observe";
import { shelfOfMilestone } from "../lib/milestones/selectByShelf";
import { practiceDoseEntry, practiceDoseId } from "../lib/practice/choosePractice";
import { quoteKeepsakeDoc, quotesFromDocs, tonightLineEntry, tonightOutcomeEntry } from "../lib/loop/tonight";
import { lastNightWords } from "../lib/today/shelfWords";
import { toObservations } from "../lib/observations";
import { dayKey } from "../practice/signals";
import { bandFor } from "../lib/age/forChild";
import { formatChildAge } from "../lib/age/format";
import { CHILD_SUBCOLLECTIONS } from "../lib/childData";
import { hydrateDemoFamily, DEMO_FAMILY_MARKER } from "../lib/demoFamilyHydrate";
import { createDemoFamilyRouter } from "../server/demoFamilyRoute";
import { buildCohortReport, type CohortEventDoc, type CohortMetricsStore, type StoredRollup } from "../server/cohortMetrics";
import { nextRollupDoc } from "../lib/retentionRollup";
import { buildConsultPacket, buildPacketInput, presetPacketToPrintSections, serializePacket } from "../consult/packet";
import { buildSchoolBriefExport, schoolBriefToPrintSections, serializeSchoolBrief } from "../schoolBrief/schoolBrief";
import { translate } from "../lib/i18n";
import * as seedScript from "../../scripts/seed-demo-family.mjs";
import * as reportScript from "../../scripts/cohort-report.mjs";

const NOW = Date.parse("2026-10-04T12:00:00.000Z");
const SRC = path.resolve(__dirname, "..");
const HEBREW = /[֐-׿]/;

describe("B-DIST-01 · the seed script", () => {
  it("the dry run writes nothing; --apply calls exactly the target's writer", async () => {
    const sandbox = vi.fn(async (_family: unknown, plan: unknown) => ({ wrote: ["x"], plan }));
    const firestore = vi.fn(async (_family: unknown, plan: unknown) => ({ wrote: ["y"], plan }));
    const log = vi.fn();
    const dry = await seedScript.runDemoSeed(seedScript.parseArgs(["--now", new Date(NOW).toISOString()]), { log, apply: { sandbox, firestore } });
    expect(dry.wrote).toEqual([]);
    expect(sandbox).not.toHaveBeenCalled();
    expect(firestore).not.toHaveBeenCalled();
    expect(String(log.mock.calls[0][0])).toMatch(/DRY RUN — writes nothing/);
    expect(String(log.mock.calls[0][0])).toMatch(/behaviorLogs\s+17 docs/);
    await seedScript.runDemoSeed(seedScript.parseArgs(["--apply", "--now", new Date(NOW).toISOString()]), { log, apply: { sandbox, firestore } });
    expect(sandbox).toHaveBeenCalledTimes(1);
    expect(firestore).not.toHaveBeenCalled();
  });

  it("the production target needs a uid and a project (GUY), and names its own child id", async () => {
    expect(() => seedScript.parseArgs(["--target", "firestore"])).toThrow(/--uid/);
    expect(() => seedScript.parseArgs(["--target", "staging"])).toThrow(/--target/);
    const plan = seedScript.planDemoWrites(buildDemoFamily({ now: NOW, childId: "demo-abc12345" }), { target: "firestore", uid: "abc12345xyz" });
    expect(plan.flags.map((f: { path: string }) => f.path)).toEqual(["users/abc12345xyz", "users/abc12345xyz/children/demo-abc12345", "retentionRollups/abc12345xyz"]);
    expect(seedScript.PROD_COMMAND).toMatch(/--target firestore --uid <demo-auth-uid>/);
  });

  it("every collection written is in CHILD_SUBCOLLECTIONS, and the script reads the real list", () => {
    expect(seedScript.childSubcollectionsFromSource()).toEqual(CHILD_SUBCOLLECTIONS);
    for (const name of Object.keys(buildDemoFamily({ now: NOW }).collections)) expect(CHILD_SUBCOLLECTIONS).toContain(name);
    const rogue = { ...buildDemoFamily({ now: NOW }), collections: { notRegistered: [{ id: "x" }] } };
    expect(() => seedScript.planDemoWrites(rogue, { target: "sandbox", uid: null })).toThrow(/not in CHILD_SUBCOLLECTIONS/);
  });
});

describe("B-DIST-01 · the invented record", () => {
  for (const lang of ["en", "he"] as const) {
    it(`${lang}: six weeks, the item's counts, the demo flag`, () => {
      const f = buildDemoFamily({ now: NOW, lang });
      const logs = f.collections.behaviorLogs;
      expect(logs.filter((l) => l.behaviorType === "Moment")).toHaveLength(14);
      expect(logs.filter((l) => l.photoAttachment)).toHaveLength(2);
      for (const l of logs.filter((x) => x.photoAttachment)) expect(l.photoAttachment).toMatch(/^\/visuals\//);
      expect(logs.filter((l) => l.behaviorType !== "Moment")).toHaveLength(3);
      expect(logs.some((l) => l.behaviorType === "Transition Refusal" && new Date(l.timestamp).getUTCHours() < 10)).toBe(true);
      const oldest = Math.min(...logs.map((l) => Date.parse(l.timestamp)));
      expect((NOW - oldest) / 86_400_000).toBeLessThanOrEqual(42);
      // B-LOOP-17: ten "yes" answers + one "not sure" (the loop's shelf-aware distribution).
      expect(f.collections.milestones.filter((m) => m.checked)).toHaveLength(10);
      expect(f.collections.langObs).toHaveLength(4);
      expect(f.collections.langObs.filter((w) => HEBREW.test(w.phrase))).toHaveLength(2);
      // Two Today steps + (NEXTLEVEL r1) one held hard-moment step + (B-LOOP-17) nine practice dose rows.
      expect(f.collections.actionLoops).toHaveLength(12);
      expect(f.collections.actionLoops.filter((a) => a.source === "today-guidance" && a.outcome === "helped")).toHaveLength(1);
      const held = f.collections.actionLoops.filter((a) => a.source === "hard-moment" && a.held === "yes" && a.outcomeAt);
      expect(held).toHaveLength(1);
      expect(f.collections.practiceEvents.length).toBeGreaterThan(0);
      expect(f.collections.heroRuns).toHaveLength(1);
      // W2-CAREPRO c2 r1: a done visit + one booked inside the 14-day Prepare window.
      expect(f.collections.appointments).toHaveLength(2);
      expect(f.collections.appointments.filter((a) => a.status === "done")).toHaveLength(1);
      expect(f.collections.apptFollowUps).toHaveLength(1);
      expect(f.memory.approved.fact).not.toEqual(f.memory.pending.fact);
      expect(f.child.demo).toBe(true);
      expect(f.child.id).toBe(DEMO_CHILD_ID);
      expect(f.parent.demo).toBe(true);
      expect(f.child.ageMonths).toBe(38);
      if (lang === "he") expect(HEBREW.test(logs[0].trigger)).toBe(true);
      expect(demoFamilyCounts(f).behaviorLogs).toBe(17);
    });
  }

  it("is deterministic for a given now", () => {
    expect(JSON.stringify(buildDemoFamily({ now: NOW }))).toBe(JSON.stringify(buildDemoFamily({ now: NOW })));
  });

  it("no fixture string matches a real-name list", () => {
    // The team, the family and the people in the ROS record — none may appear.
    const REAL = ["Guy", "Rubin", "Joseph", "Maytal", "Karin", "Keren", "Daniel", "Robert", "Shiv", "Fredi", "Noa Levi", "Plijter"];
    const text = JSON.stringify([buildDemoFamily({ now: NOW, lang: "en" }), buildDemoFamily({ now: NOW, lang: "he" })].map((f) => ({ ...f, collections: { ...f.collections, milestones: [] } })));
    for (const name of REAL) expect(text, name).not.toMatch(new RegExp(`\\b${name}\\b`));
  });
});

/* P2A AGES (B-INF-10): the founder's second child — Leni, 22 months, a girl,
 * "getting to two" — so every chooser runs on two bands and on the switch. */
describe("P2A AGES · the toddler sibling", () => {
  for (const lang of ["en", "he"] as const) {
    it(`${lang}: Leni is 22 months, a girl, a demo child with a small toddler record`, () => {
      const f = buildDemoFamily({ now: NOW, lang });
      expect(f.siblings).toHaveLength(1);
      const leni = f.siblings[0];
      expect(leni.child.id).toBe(DEMO_SIBLING_ID);
      expect(leni.child.name).toBe("Leni");
      expect(leni.child.gender).toBe("girl");
      expect(leni.child.demo).toBe(true);
      expect(leni.child.ageMonths).toBe(22);
      const now = new Date(NOW);
      expect(bandFor(leni.child, now).id).toBe("18m");
      expect(bandFor(f.child, now).id).not.toBe(bandFor(leni.child, now).id);
      expect(formatChildAge(leni.child, undefined, now)).toBe("22 months");
      const moments = leni.collections.behaviorLogs;
      expect(moments.every((l) => l.behaviorType === "Moment")).toBe(true);
      expect(moments).toHaveLength(4); // three word-moments + one bedtime note
      expect(leni.collections.langObs).toHaveLength(3);
      // B-LOOP-17: the lighter loop — seven answers inside her 15–18 m window.
      expect(leni.collections.milestones.filter((m) => m.checked)).toHaveLength(7);
      for (const m of leni.collections.milestones.filter((x) => x.checked)) expect([15, 18]).toContain(m.ageMonths);
      if (lang === "he") expect(HEBREW.test(moments[0].trigger)).toBe(true);
      for (const name of Object.keys(leni.collections)) expect(CHILD_SUBCOLLECTIONS).toContain(name);
    });
  }

  it("the sandbox storage and the seed plan carry her own per-child keys", () => {
    const f = buildDemoFamily({ now: NOW });
    const keys = Object.keys(demoSandboxStorage(f));
    expect(keys).toContain(`arbor.behaviorLogs.${DEMO_SIBLING_ID}`);
    expect(keys).toContain(`arbor.behaviorLogs.${DEMO_CHILD_ID}`);
    const plan = seedScript.planDemoWrites(f, { target: "sandbox", uid: null });
    expect(plan.siblings.map((s: { childId: string }) => s.childId)).toEqual([DEMO_SIBLING_ID]);
    expect(seedScript.renderPlan(plan, { apply: false })).toMatch(/sibling leni-demo/);
  });
});

describe("B-DIST-01 · cohort readers exclude the demo family", () => {
  const DAY = 86_400_000;
  const day = (d: number) => new Date(NOW - d * DAY).toISOString().slice(0, 10);
  const rollup = (uid: string, cohort?: StoredRollup["cohort"]): StoredRollup => ({ uid, ...(cohort ? { cohort } : {}), firstSeen: day(10), activeDays: [day(10), day(9)], source: "organic", market: "il" });
  const ROLLUPS = [rollup("demo-uid", "demo"), rollup("guy-uid", "internal"), rollup("family-a", "family")];
  const ev = (uid: string): CohortEventDoc => ({ uid, event: "paywall_view", at: new Date(NOW - DAY).toISOString(), props: { source: "organic", market: "il" } });
  const store: CohortMetricsStore = { mode: "firestore", listRetentionRollups: async () => ROLLUPS, listEvents: async () => [ev("demo-uid"), ev("guy-uid"), ev("family-a")] };

  it("the /admin/cohorts report leaves the demo family out and counts it in excluded — even with includeInternal", async () => {
    const report = await buildCohortReport(store, { since: day(30), now: new Date(NOW), funnels: [] });
    expect(report.internal.excluded).toBe(2);
    expect(report.demo.excluded).toBe(1);
    expect(report.eventCensus.find((c) => c.stage === "paywall_view")?.count).toBe(1);
    const withInternal = await buildCohortReport(store, { since: day(30), now: new Date(NOW), funnels: [], includeInternal: true });
    expect(withInternal.demo.excluded).toBe(1);
    expect(withInternal.eventCensus.find((c) => c.stage === "paywall_view")?.count).toBe(2);
  });

  it("cohort-report.mjs mirrors it", () => {
    const out = reportScript.excludeInternal(ROLLUPS, [ev("demo-uid"), ev("family-a")], true);
    expect(out.rollups.map((r: StoredRollup) => r.uid)).toEqual(["guy-uid", "family-a"]);
    expect(out.events.map((e: CohortEventDoc) => e.uid)).toEqual(["family-a"]);
  });

  it("a session never re-tags a demo rollup", () => {
    const stored = { firstSeen: day(3), activeDays: [day(3)], source: null, market: null, tzOffsetMinutes: 0, updatedAt: new Date(NOW).toISOString(), cohort: "demo" };
    const next = nextRollupDoc(stored, { uid: "demo-uid", at: NOW, tzOffsetMinutes: 0, source: null, market: null, cohort: "family" });
    expect(next?.cohort).toBe("demo");
  });
});

describe("B-DIST-01 · the sandbox run", () => {
  const memoryStorage = () => {
    const m = new Map<string, string>();
    return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), m };
  };
  const bundle = { ...buildDemoFamily({ now: NOW }), collections: { ...buildDemoFamily({ now: NOW }).collections, notRegistered: [{ id: "x" }] } };
  const okFetch = (async () => ({ ok: true, json: async () => bundle })) as unknown as typeof fetch;

  it("the hydrator writes the per-child keys useChildCollection + ProfileContext read, once per seed", async () => {
    const storage = memoryStorage();
    storage.setItem("arbor.children", JSON.stringify([{ id: "other-child", name: "Other" }]));
    expect(await hydrateDemoFamily({ fetchImpl: okFetch, storage })).toBe("seeded");
    expect(JSON.parse(storage.getItem(`arbor.behaviorLogs.${DEMO_CHILD_ID}`)!)).toHaveLength(17);
    expect(JSON.parse(storage.getItem(`arbor.appointments.${DEMO_CHILD_ID}`)!)).toHaveLength(2); // W2-CAREPRO c2 r1: done + one booked
    expect(storage.getItem(`arbor.notRegistered.${DEMO_CHILD_ID}`)).toBeNull();
    const profiles = JSON.parse(storage.getItem("arbor.children")!);
    // P2A AGES: the toddler sibling is seeded after the demo child, before any other profile.
    expect(profiles.map((p: { id: string }) => p.id)).toEqual([DEMO_CHILD_ID, DEMO_SIBLING_ID, "other-child"]);
    expect(JSON.parse(storage.getItem(`arbor.langObs.${DEMO_SIBLING_ID}`)!)).toHaveLength(3);
    expect(profiles[0].demo).toBe(true);
    expect(storage.getItem("arbor.activeChildId")).toBe(DEMO_CHILD_ID);
    expect(storage.getItem(DEMO_FAMILY_MARKER)).toContain(bundle.version);
    expect(await hydrateDemoFamily({ fetchImpl: okFetch, storage })).toBe("current");
  });

  it("W2-GROWTH r2 (Law 8): a two-locale bundle hydrates in the parent's UI language; a language switch re-hydrates", async () => {
    const en = buildDemoFamily({ now: NOW, lang: "en" });
    const he = buildDemoFamily({ now: NOW, lang: "he" });
    const twoLocale = { ...en, locales: { en: { child: en.child, collections: en.collections }, he: { child: he.child, collections: he.collections } } };
    const fetch2 = (async () => ({ ok: true, json: async () => twoLocale })) as unknown as typeof fetch;
    const storage = memoryStorage();
    storage.setItem("arbor.uiLang", "he");
    expect(await hydrateDemoFamily({ fetchImpl: fetch2, storage })).toBe("seeded");
    const child = JSON.parse(storage.getItem("arbor.children")!)[0];
    expect(child.schoolContext).toBe("גן עירוני, שנה ראשונה");
    expect(storage.getItem(DEMO_FAMILY_MARKER)).toMatch(/@he$/);
    expect(await hydrateDemoFamily({ fetchImpl: fetch2, storage })).toBe("current");
    storage.setItem("arbor.uiLang", "en");
    expect(await hydrateDemoFamily({ fetchImpl: fetch2, storage })).toBe("seeded");
    expect(JSON.parse(storage.getItem("arbor.children")!)[0].schoolContext).toBe("City kindergarten, first year");
    // the sandbox writer puts both locales in the bundle
    const seedSrc = readFileSync(new URL("../../scripts/seed-demo-family.mjs", import.meta.url), "utf8");
    expect(seedSrc).toMatch(/for \(const lang of \["en", "he"\]\)/);
    expect(seedSrc).toContain("JSON.stringify({ ...family, locales }, null, 2)");
  });

  it("no bundle, a failing server or a non-demo body leaves storage untouched", async () => {
    const storage = memoryStorage();
    expect(await hydrateDemoFamily({ fetchImpl: (async () => ({ ok: false })) as unknown as typeof fetch, storage })).toBe("none");
    expect(await hydrateDemoFamily({ fetchImpl: (async () => { throw new Error("down"); }) as unknown as typeof fetch, storage })).toBe("none");
    const notDemo = { ...bundle, child: { ...bundle.child, demo: false } };
    expect(await hydrateDemoFamily({ fetchImpl: (async () => ({ ok: true, json: async () => notDemo })) as unknown as typeof fetch, storage })).toBe("none");
    expect(storage.m.size).toBe(0);
  });

  it("main.tsx hydrates before the first render only without Firebase", () => {
    const main = readFileSync(path.join(SRC, "main.tsx"), "utf8");
    expect(main).toMatch(/if \(firebaseEnabled\) renderApp\(\);\s*else void hydrateDemoFamily\(\)/);
  });

  it("the sandbox route does not exist in prod (or with Firestore), and serves the bundle in the sandbox", async () => {
    expect(createDemoFamilyRouter({ arborEnv: "prod", memoryAdapter: "local" })).toBeNull();
    expect(createDemoFamilyRouter({ arborEnv: "dev", memoryAdapter: "firestore" })).toBeNull();
    const dir = mkdtempSync(path.join(os.tmpdir(), "demo-family-"));
    const file = path.join(dir, "demo-family.json");
    const router = createDemoFamilyRouter({ arborEnv: "local", memoryAdapter: "local" }, file)!;
    const app = express();
    app.use(router);
    const server = app.listen(0, "127.0.0.1");
    await new Promise((r) => server.once("listening", r));
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    try {
      expect((await fetch(`${base}/sandbox/demo-family.json`)).status).toBe(404);
      writeFileSync(file, JSON.stringify(bundle));
      const res = await fetch(`${base}/sandbox/demo-family.json`);
      expect(res.status).toBe(200);
      expect((await res.json()).child.demo).toBe(true);
    } finally {
      await new Promise((r) => server.close(r));
    }
  });
});

describe("B-DIST-01 · every egress carries the demo header (EN + HE)", () => {
  const f = buildDemoFamily({ now: NOW });
  const record = { profile: f.child, logs: f.collections.behaviorLogs, milestones: f.collections.milestones, plans: [], memory: [] };

  for (const lang of ["en", "he"] as const) {
    const header = translate(lang, "elev.demo.header");

    it(`${lang}: Consult Markdown and PDF sections lead with "${header}"`, () => {
      expect(header).toMatch(lang === "he" ? /משפחת הדגמה/ : /^Demo family — invented data$/);
      const packet = buildConsultPacket(buildPacketInput(record as never, NOW));
      expect(packet.demo).toBe(true);
      expect(serializePacket(packet, new Set(), lang)).toContain(`**${header}**`);
      expect(presetPacketToPrintSections("pediatrician", packet, new Set(), lang)[0].heading).toBe(header);
    });

    it(`${lang}: the School Brief Markdown and print sections lead with it`, () => {
      const labels = { overview: "o", strengths: "s", challenges: "c", language: "l", strategies: "t" };
      const ex = buildSchoolBriefExport({ overview: "Likes building.", keyStrengths: ["Pretend play"] }, { title: "Brief", date: "2026-10-04", demoHeader: header });
      expect(serializeSchoolBrief(ex, labels)).toContain(`**${header}**`);
      expect(schoolBriefToPrintSections(ex, labels)[0]).toEqual({ heading: header, body: [] });
    });
  }

  it("a real family's documents carry no demo header", () => {
    const packet = buildConsultPacket(buildPacketInput({ ...record, profile: { ...f.child, demo: false } } as never, NOW));
    expect(packet.demo).toBeUndefined();
    expect(serializePacket(packet)).not.toContain("Demo family");
    const ex = buildSchoolBriefExport({ overview: "x" }, { title: "Brief", date: "2026-10-04" });
    expect(serializeSchoolBrief(ex, { overview: "o", strengths: "s", challenges: "c", language: "l", strategies: "t" })).not.toContain("Demo");
  });

  it("the Sharing previews, the recipient view and the School Brief read the flag", () => {
    const sharing = readFileSync(path.join(SRC, "components/sections/TrustedSharing.tsx"), "utf8");
    expect(sharing.match(/childProfile\.demo === true && \(\s*<p data-demo-header/g)?.length).toBe(2);
    expect(sharing).toMatch(/view\.demo === true && \(\s*<p data-demo-header/);
    expect(readFileSync(path.join(SRC, "server/sharedPacket.ts"), "utf8")).toMatch(/packet\.demo \? \{ demo: true as const \}/);
    expect(readFileSync(path.join(SRC, "components/sections/SchoolBrief.tsx"), "utf8")).toMatch(/childProfile\.demo === true \? \{ demoHeader: t\("elev\.demo\.header"\) \}/);
  });

  it("the switcher chip: shown only for the demo child, tokens only, inside ≥44 px rows", () => {
    const src = readFileSync(path.join(SRC, "components/layout/TopbarKidSwitcher.tsx"), "utf8");
    // P5-LOOP c2 r1: the closed trigger carries a 6 px dot (named), the family list the chip
    expect(src).toMatch(/activeChild\.demo === true && <DemoDot t=\{t\} \/>/);
    const dot = src.slice(src.indexOf("function DemoDot"), src.indexOf("export function SwitcherChildOption"));
    expect(dot).toMatch(/aria-label=\{t\("elev\.demo\.chipAria"\)\}/);
    expect(dot).toMatch(/background: "var\(--arbor-muted\)"/);
    expect(dot).not.toMatch(/#[0-9a-fA-F]{3,8}\b|green|amber|coral|red/);
    expect(src).toMatch(/p\.demo === true && <DemoChip t=\{t\} \/>/);
    const chip = src.slice(src.indexOf("function DemoChip"), src.indexOf("export default function"));
    expect(chip).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(chip).toMatch(/var\(--arbor-muted\)/);
    expect(chip).not.toMatch(/green|amber|coral|red/);
    expect(src.match(/minHeight: "44px"/g)?.length).toBeGreaterThanOrEqual(2);
    for (const lang of ["en", "he"] as const) expect(translate(lang, "elev.demo.chip")).not.toBe("elev.demo.chip");
  });
});

/* W2-CAREPRO c2 r1 (memory product P1 + design P1) — the grouped review
 * (B-CAREPRO-25: "{n} similar · See all {n} · Dismiss all {n}") had never
 * rendered: the demo seed held two singleton topics. The seed now carries
 * three distinct same-topic pending facts (EN + HE) that survive the B-AI-07
 * near-duplicate merge, so one group holds 4 facts. */
describe("W2-CAREPRO c2 r1 · the demo memory seed renders a group at volume", () => {
  for (const lang of ["en", "he"] as const) {
    it(`${lang}: seedMemory leaves 4 pending facts in ONE topic after the near-duplicate merge`, async () => {
      const { foldMemoryEvents } = await import("../memory/memoryService");
      const { groupPendingMemory } = await import("../lib/memoryGroups");
      const events: import("../memory/types").MemoryLedgerEvent[] = [];
      const store = {
        async listEvents(childId?: string) { return events.filter((e) => !childId || e.childId === childId); },
        async appendEvent(e: import("../memory/types").MemoryLedgerEvent) { events.push(e); },
        async eraseChild() { return 0; },
      };
      const f = buildDemoFamily({ lang, now: Date.UTC(2026, 9, 4, 12) });
      if (lang === "he") expect(/[֐-׿]/.test(f.memory.pendingMore[0].fact)).toBe(true);
      expect(f.memory.pendingMore).toHaveLength(3);
      await seedScript.seedMemory(store, f, "fam-demo");
      const items = foldMemoryEvents(events, f.child.id);
      const pending = items.filter((i) => i.status === "pending");
      expect(items.filter((i) => i.status === "approved")).toHaveLength(1);
      expect(pending).toHaveLength(4);
      const groups = groupPendingMemory(pending as unknown as import("../types").MemoryReviewItem[]);
      expect(groups[0].items.length, JSON.stringify(groups.map((g) => [g.topic, g.items.length]))).toBe(4);
      expect(groups[0].topic).not.toBe("other");
    });
  }
});

/* W2-CAREPRO c2 r2 (appointments + memory critics, P1 G1): two rounds of new
 * demo content (the booked T+9 SLP visit; three same-topic pending facts)
 * never rendered because DEMO_FAMILY_VERSION was not bumped, so nothing told
 * the served bundle was stale. The family's CONTENT is pinned to its version:
 * change the family → this fails until the version is bumped and the pin
 * re-recorded (then `npm run seed:demo -- --apply` re-seeds the sandbox). */
describe("W2-CAREPRO c2 r2 · the demo content is pinned to DEMO_FAMILY_VERSION", () => {
  const PINNED = { version: "2026-10-07.2", sha256: "74345201c184904c797e630a0d64f2713bcee773465b9989c019b5056c018315" };
  const contentHash = async () => {
    const { createHash } = await import("node:crypto");
    const body = JSON.stringify([buildDemoFamily({ now: NOW, lang: "en" }), buildDemoFamily({ now: NOW, lang: "he" })]);
    return createHash("sha256").update(body).digest("hex");
  };

  it("content and version move together", async () => {
    const { DEMO_FAMILY_VERSION } = await import("./demoFamily");
    const hash = await contentHash();
    expect(
      { version: DEMO_FAMILY_VERSION, sha256: hash },
      "demo family content changed: bump DEMO_FAMILY_VERSION, re-pin PINNED here, then run `npm run seed:demo -- --apply` (and --lang he for HE cells)",
    ).toEqual(PINNED);
  });

  it("the content the critics need is in it: a booked visit within 14 days, and a pending topic at volume (EN + HE)", () => {
    for (const lang of ["en", "he"] as const) {
      const fam = buildDemoFamily({ now: NOW, lang });
      const upcoming = fam.collections.appointments
        .filter((a) => a.whenIso && Date.parse(a.whenIso) > NOW && Date.parse(a.whenIso) - NOW <= 14 * 86_400_000);
      expect(upcoming.length, lang).toBeGreaterThan(0);
      expect(fam.memory.pendingMore.length, lang).toBeGreaterThanOrEqual(3);
    }
  });
});

/* P1-NEXTLEVEL critic r2 (profile product P1 + consult product P1, Laws 8/9):
 * seeding en then he (or he then en) left BOTH languages' facts live under one
 * child id — the EN packet carried one fact twice and Profile read 9 pending
 * against a seed of 4. One run leaves one language. */
describe("P1-NEXTLEVEL r2 · the demo memory ledger is one language per run", () => {
  for (const [first, second] of [["en", "he"], ["he", "en"]] as const) {
    it(`${first} then ${second}: only the ${second} facts stay live (1 approved, 4 pending)`, async () => {
      const { foldMemoryEvents } = await import("../memory/memoryService");
      const events: import("../memory/types").MemoryLedgerEvent[] = [];
      const store = {
        async listEvents(childId?: string) { return events.filter((e) => !childId || e.childId === childId); },
        async appendEvent(e: import("../memory/types").MemoryLedgerEvent) { events.push(e); },
        async eraseChild() { return 0; },
      };
      const now = Date.UTC(2026, 9, 4, 12);
      const a = buildDemoFamily({ lang: first, now });
      const b = buildDemoFamily({ lang: second, now, childId: a.child.id });
      await seedScript.seedMemory(store, a, "fam-demo");
      await seedScript.seedMemory(store, b, "fam-demo");
      const live = foldMemoryEvents(events, a.child.id).filter((i) => i.status === "pending" || i.status === "approved");
      const firstFacts = new Set([a.memory.approved.fact, a.memory.pending.fact, ...a.memory.pendingMore.map((m) => m.fact)]);
      expect(live.filter((i) => firstFacts.has(i.fact))).toEqual([]);
      expect(live.filter((i) => i.status === "approved")).toHaveLength(1);
      expect(live.filter((i) => i.status === "pending")).toHaveLength(4);
    });
  }
});

/* B-LOOP-17 — the loop's seeded states (demo seed v2026-10-07.1). Critics
 * converge only on SEEDED states (5 Oct lesson): the demo child carries a
 * shelf-aware milestone distribution with ONE thin shelf (Sleep: zero entries
 * of any kind), a 14-day practice dose log with Tonight's night answers and
 * the quotes — every document exactly what the app's own builder writes. */
describe("B-LOOP-17 · the loop's seeded record", () => {
  const DAY = 86_400_000;
  const LOOP_SHELVES = ["words", "feelings", "play", "moving"] as const;
  const catalogue = (id: string) => initialMilestones.find((m) => m.id === id)!;
  const practiceRows = (rows: readonly ActionLoopEntry[]) => rows.filter((r) => r.source === "practice");

  it("the version string is bumped to 2026-10-07.2 (night lines, P5-LOOP c2 r1)", () => {
    expect(DEMO_FAMILY_VERSION).toBe("2026-10-07.2");
    expect(buildDemoFamily({ now: NOW }).version).toBe("2026-10-07.2");
  });

  it("the dry run prints the new counts per collection, child and sibling, and writes nothing", async () => {
    const log = vi.fn();
    const sandbox = vi.fn();
    const dry = await seedScript.runDemoSeed(seedScript.parseArgs(["--now", new Date(NOW).toISOString()]), { log, apply: { sandbox, firestore: vi.fn() } });
    expect(dry.wrote).toEqual([]);
    expect(sandbox).not.toHaveBeenCalled();
    const out = String(log.mock.calls[0][0]);
    const n = initialMilestones.length;
    const child: Record<string, number> = { behaviorLogs: 17, milestones: n, langObs: 4, actionLoops: 12, practiceEvents: 4, heroRuns: 1, appointments: 2, apptFollowUps: 1, keepsakes: 4 };
    for (const [name, count] of Object.entries(child)) expect(out, name).toMatch(new RegExp(`\\n  ${name}\\s+${count} docs`));
    expect(out).toMatch(/milestones noticed 10/);
    const sib: Record<string, number> = { behaviorLogs: 4, milestones: n, langObs: 3, actionLoops: 3, keepsakes: 1 };
    const sibOut = out.slice(out.indexOf("sibling leni-demo"));
    for (const [name, count] of Object.entries(sib)) expect(sibOut, `sibling ${name}`).toMatch(new RegExp(`\\n    ${name}\\s+${count} docs`));
    expect(demoFamilyCounts(dry.family)).toEqual(child);
  });

  it("every written collection — the child's and the sibling's — is in CHILD_SUBCOLLECTIONS", () => {
    const plan = seedScript.planDemoWrites(buildDemoFamily({ now: NOW }), { target: "sandbox", uid: null });
    const names = [
      ...plan.collections.map((c: { name: string }) => c.name),
      ...plan.siblings.flatMap((s: { collections: { name: string }[] }) => s.collections.map((c) => c.name)),
    ];
    expect(names).toContain("keepsakes");
    expect(names).toContain("actionLoops");
    for (const name of names) expect(CHILD_SUBCOLLECTIONS).toContain(name);
  });

  for (const lang of ["en", "he"] as const) {
    it(`${lang}: ~60 % "yes" in Words / Feelings / Play / Moving, one "not sure" in Hands, two feeding rows "yes"`, () => {
      const f = buildDemoFamily({ now: NOW, lang });
      const window = milestoneAgeWindow(f.child.ageMonths!);
      const inWindow = f.collections.milestones.filter((m) => typeof m.ageMonths === "number" && window.includes(m.ageMonths));
      for (const shelf of LOOP_SHELVES) {
        const rows = inWindow.filter((m) => shelfOfMilestone(m) === shelf);
        expect(rows.length, shelf).toBeGreaterThan(0);
        expect(rows.filter((m) => m.observationStatus === "yes").length, shelf).toBe(Math.round(0.6 * rows.length));
      }
      const notSure = f.collections.milestones.filter((m) => m.observationStatus === "not_sure");
      expect(notSure.map((m) => shelfOfMilestone(m))).toEqual(["hands"]);
      expect(f.collections.milestones.filter((m) => m.observationStatus === "yes" && shelfOfMilestone(m) === "food")).toHaveLength(2);
      // Written through THE seam: each answered row is byte-identical to observeMilestoneDoc's document.
      for (const m of f.collections.milestones.filter((x) => x.observationStatus)) {
        expect(m).toEqual(observeMilestoneDoc(catalogue(m.id), m.observationStatus as "yes" | "not_sure", { now: m.observationUpdatedAt }));
      }
    });

    it(`${lang}: the Sleep shelf is the thin shelf — no answer, no moment, no practice row, no observation (child and sibling)`, () => {
      const f = buildDemoFamily({ now: NOW, lang });
      const kids = [
        { child: f.child, c: f.collections as Partial<typeof f.collections> },
        ...f.siblings.map((s) => ({ child: s.child, c: s.collections as Partial<typeof f.collections> })),
      ];
      for (const { child, c } of kids) {
        expect(c.milestones!.filter((m) => m.observationStatus && shelfOfMilestone(m) === "sleep"), child.id).toHaveLength(0);
        expect(practiceRows(c.actionLoops ?? []).filter((r) => r.shelf === "sleep"), child.id).toHaveLength(0);
        expect(c.behaviorLogs!.filter((l) => l.behaviorType === "Sleep Meltdown"), child.id).toHaveLength(0);
        const obs = toObservations(
          { behaviorLogs: c.behaviorLogs, milestones: c.milestones, langObs: c.langObs, actionLoops: c.actionLoops, practiceEvents: c.practiceEvents, keepsakes: c.keepsakes },
          child,
        );
        expect(obs.length, child.id).toBeGreaterThan(0);
        expect(obs.filter((o) => o.shelf === "sleep").map((o) => o.id), child.id).toEqual([]);
      }
    });

    it(`${lang}: nine practice rows over 14 days (mixed, never today), three night answers, four quotes — the app's own documents`, () => {
      const f = buildDemoFamily({ now: NOW, lang });
      const rows = practiceRows(f.collections.actionLoops);
      expect(rows).toHaveLength(9);
      const today = dayKey(new Date(NOW));
      for (const r of rows) {
        const t = Date.parse(r.acceptedAt);
        const daysBack = Math.round((Date.parse(today) - Date.parse(dayKey(new Date(t)))) / DAY);
        expect(daysBack).toBeGreaterThanOrEqual(1);
        expect(daysBack).toBeLessThanOrEqual(14); // over the last 14 days
        expect(dayKey(new Date(t))).not.toBe(today); // the morning state finds today's practice pending
        expect(r.id).toBe(practiceDoseId(f.child.id, new Date(t)));
        const practice = PRACTICES.find((p) => p.id === r.practiceId)!;
        expect(practice.shelf).not.toBe("sleep");
        const base = practiceDoseEntry(
          { practice, milestone: catalogue(r.milestoneId!), shelf: practice.shelf },
          r.outcome === "not_today" ? "not_today" : "did",
          f.child.id,
          r.recommendation,
          new Date(t),
        );
        const night = r.outcome && r.outcome !== "not_today" ? tonightOutcomeEntry(base, r.outcome, new Date(r.outcomeAt!)) : base;
        expect(r).toEqual(r.whatHappened ? tonightLineEntry(night, r.whatHappened) : night);
      }
      expect(new Set(rows.map((r) => r.id)).size).toBe(9);
      expect(rows.filter((r) => r.outcome === "not_today").length).toBeGreaterThan(0);
      expect(rows.filter((r) => r.outcome !== "not_today").length).toBeGreaterThan(0);
      const night = rows.filter((r) => r.outcome === "helped" || r.outcome === "somewhat");
      expect(night).toHaveLength(3);
      for (const r of night) expect(new Date(r.outcomeAt!).getUTCHours()).toBe(19);
      // P5-LOOP c2 r1: every night answer carries the parent's line, and
      // YESTERDAY's is Today's line 1 (lastNightWords), on its own shelf
      for (const r of night) expect(r.whatHappened, r.id).toBeTruthy();
      if (lang === "he") for (const r of night) expect(HEBREW.test(r.whatHappened!)).toBe(true);
      const yesterday = lastNightWords(f.collections.actionLoops, f.child.id, new Date(NOW));
      expect(yesterday?.text).toBe(rows.find((r) => r.id === practiceDoseId(f.child.id, new Date(NOW - DAY)))?.whatHappened);
      expect(yesterday?.shelf).not.toBe("sleep");
      const quotes = quotesFromDocs(f.collections.keepsakes);
      expect(quotes).toHaveLength(4);
      for (const d of f.collections.keepsakes) expect(d).toEqual(quoteKeepsakeDoc(d.note, new Date(d.createdAt)));
      if (lang === "he") for (const q of quotes) expect(HEBREW.test(q.note)).toBe(true);
    });

    it(`${lang}: Leni carries the lighter loop — three practice rows, one night answer, one quote`, () => {
      const leni = buildDemoFamily({ now: NOW, lang }).siblings[0];
      const rows = practiceRows(leni.collections.actionLoops);
      expect(rows).toHaveLength(3);
      for (const r of rows) expect(r.id).toBe(practiceDoseId(DEMO_SIBLING_ID, new Date(r.acceptedAt)));
      expect(rows.filter((r) => r.outcome === "helped" || r.outcome === "somewhat")).toHaveLength(1);
      expect(quotesFromDocs(leni.collections.keepsakes)).toHaveLength(1);
    });
  }
});

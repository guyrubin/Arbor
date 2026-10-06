/**
 * B-GROWTH-35 — ONE truth: one fixture record gives identical counts through
 * every call site (Care "What changed", the visit packet's delta, Milestones'
 * headline, the Journal's moment rows, the Profile chapter) because every one
 * of them calls lib/record/counts. Source pins keep each surface on it; the
 * behaviour checks prove the Care/Milestones disagreement ("0 milestones
 * noticed" beside "6 noticed") cannot come back.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { firstsSince, milestonesNoticedSince, momentRowsSince, momentsSince, noticedMilestoneCounts, reportsLeadCounts, wordDays } from "./counts";
import { noticedMilestoneCounts as pulseNoticed } from "../pulse";
import { reportsLeadCounts as legacyLead } from "../recordCounts";
import { buildTimeline, weekMomentCount } from "../signalTimeline";
import { buildConsultPacket } from "../../consult/packet";

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(path.join(here, "..", "..", rel), "utf8").replace(/\r\n/g, "\n");
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const NOW = Date.parse("2026-10-06T12:00:00.000Z");
const DAY = 86_400_000;
const iso = (daysAgo: number) => new Date(NOW - daysAgo * DAY).toISOString();

// The production shape: three moments since June, a day of words, six noticed
// milestones of which only two carry a date (four legacy undated marks).
const RECORD = {
  behaviorLogs: [
    { id: "l1", timestamp: iso(118), behaviorType: "Moment", intensity: 1, trigger: "first one" },
    { id: "l2", timestamp: iso(40), behaviorType: "Tantrum", intensity: 3 },
    { id: "l3", timestamp: iso(2), behaviorType: "Moment", intensity: 1, trigger: "today" },
  ],
  langObs: [
    { id: "w1", timestamp: iso(3), language: "Hebrew", phrase: "כדור" },
    { id: "w2", timestamp: new Date(NOW - 3 * DAY + 60_000).toISOString(), language: "Hebrew", phrase: "מים" },
  ],
  milestones: [
    { id: "m1", domain: "language_communication", title: "a", description: "", checked: true, ageMonths: 36 },
    { id: "m2", domain: "language_communication", title: "b", description: "", checked: true, ageMonths: 36 },
    { id: "m3", domain: "social_emotional", title: "c", description: "", checked: true, ageMonths: 36 },
    { id: "m4", domain: "social_emotional", title: "d", description: "", checked: true, ageMonths: 36 },
    { id: "m5", domain: "movement_physical", title: "e", description: "", checked: true, ageMonths: 36, observationUpdatedAt: iso(30) },
    { id: "m6", domain: "movement_physical", title: "f", description: "", checked: true, ageMonths: 36, observationUpdatedAt: iso(1) },
    { id: "m7", domain: "movement_physical", title: "g", description: "", checked: false, ageMonths: 36 },
  ],
  keepsakes: [{ milestoneId: "m6", note: "ran", noticedOn: iso(1).slice(0, 10), createdAt: iso(1), updatedAt: iso(1) }],
};

describe("B-GROWTH-35 — the selectors", () => {
  it("whole record: every moment and every noticed milestone, undated marks included", () => {
    expect(momentsSince(RECORD, null, NOW)).toBe(4); // 3 logs + 1 day of Hebrew words
    expect(milestonesNoticedSince(RECORD, null, NOW)).toBe(6);
    expect(firstsSince(RECORD, null, NOW)).toBe(1);
  });

  it("a date: strictly after it, never an undated record", () => {
    expect(momentsSince(RECORD, iso(7), NOW)).toBe(2);
    expect(milestonesNoticedSince(RECORD, iso(7), NOW)).toBe(1);
    expect(firstsSince(RECORD, iso(7), NOW)).toBe(1);
    expect(firstsSince(RECORD, iso(0), NOW)).toBe(0);
  });

  it("the words fold is the Journal's row fold", () => {
    const days = wordDays(RECORD.langObs);
    expect(days).toHaveLength(1);
    expect(days[0].phrases).toEqual(["מים", "כדור"]);
  });

  it("integers only — never a denominator or a share", () => {
    const c = noticedMilestoneCounts(RECORD.milestones);
    expect(c).toEqual({ noticed: 6, areas: 3, byDomain: { language_communication: 2, social_emotional: 2, movement_physical: 2 } });
    for (const v of [momentsSince(RECORD, null, NOW), milestonesNoticedSince(RECORD, null, NOW)]) expect(Number.isInteger(v)).toBe(true);
  });
});

describe("B-GROWTH-35 — one fixture, identical numbers at every call site", () => {
  it("Care 'since you started' (wholeRecord) = Milestones headline = Profile chapter = Journal moment rows", () => {
    // Care: AskSpecialist calls reportsLeadCounts with wholeRecord for the "start" anchor.
    const care = reportsLeadCounts({ logs: RECORD.behaviorLogs, milestones: RECORD.milestones, langObs: RECORD.langObs, sinceIso: null, nowMs: NOW, wholeRecord: true });
    // Milestones + Profile: noticedMilestoneCounts(milestones) (pulse re-exports the same function).
    const milestonesTab = noticedMilestoneCounts(RECORD.milestones).noticed;
    const profile = pulseNoticed(RECORD.milestones).noticed;
    // Journal: the timeline rows the Journal renders, counted by the same rule.
    const signals = buildTimeline({ behaviorLogs: RECORD.behaviorLogs as never, milestones: RECORD.milestones as never, langObs: RECORD.langObs as never });
    const journalMoments = momentRowsSince(signals, null, NOW);
    expect(care.milestones).toBe(6);
    expect(milestonesTab).toBe(6);
    expect(profile).toBe(6);
    expect(care.moments).toBe(4);
    expect(journalMoments).toBe(4);
    // the Journal's week line is the same rule over the trailing week
    expect(weekMomentCount(signals, NOW)).toBe(momentsSince(RECORD, iso(7), NOW));
    // the old re-export path is the same function
    expect(legacyLead).toBe(reportsLeadCounts);
  });

  it("the visit packet's 'since the last export' delta reads the same selectors", () => {
    const packet = buildConsultPacket({
      profile: { id: "c1", name: "Dylan", age: 3, birthDate: "2023-08-01", languages: [], challenges: [], strengths: [], interests: [] } as never,
      logs: RECORD.behaviorLogs as never,
      milestones: RECORD.milestones.map((m) => ({ ...m, observedAt: m.observationUpdatedAt })) as never,
      plans: [], memory: [], nowMs: NOW,
      langObs: RECORD.langObs.map((o) => ({ phrase: o.phrase, language: o.language, at: o.timestamp })),
      lastExportedAt: iso(7),
    } as never);
    const since = packet.sections.find((s) => s.id === "since-last-visit");
    expect(since).toBeTruthy();
    const n = (id: string) => (since!.items.find((i) => i.id === id)?.vars as { n: number } | undefined)?.n;
    expect(n("delta-logs")).toBe(momentsSince(RECORD, iso(7), NOW));
    expect(n("delta-milestones")).toBe(milestonesNoticedSince(RECORD, iso(7), NOW));
  });
});

describe("B-GROWTH-35 — source pins: every surface reads lib/record/counts", () => {
  it("no surface keeps a local count", () => {
    const ask = strip(read("components/sections/AskSpecialist.tsx"));
    expect(ask).toMatch(/reportsLeadCounts\(\{[^}]*wholeRecord: anchor\.kind === "start"/);
    expect(ask).toMatch(/langObs: langObsCol\.items/);
    const milestonesTab = strip(read("components/tabs/MilestonesTab.tsx"));
    expect(milestonesTab).toContain('import { milestonesNoticedSince, noticedMilestoneCounts } from "../../lib/record/counts"');
    // the per-age-band count reads the same selector — no local .filter(checked).length
    expect(milestonesTab).toContain("milestonesNoticedSince({ milestones: band.items }, null)");
    expect(milestonesTab).not.toMatch(/\.filter\(\(m\) => m\.checked\)\.length/);
    // Journal: its moments line is signalTimeline.weekMomentCount, which delegates to momentRowsSince
    expect(strip(read("components/tabs/JournalTab.tsx"))).toMatch(/weekMomentCount\(signals/);
    expect(strip(read("components/sections/ChildProfile.tsx"))).toContain('import { noticedMilestoneCounts } from "../../lib/record/counts"');
    const timeline = strip(read("lib/signalTimeline.ts"));
    expect(timeline).toContain("momentRowsSince(signals");
    expect(timeline).toContain("wordDays(sources.langObs)");
    const packet = strip(read("consult/packet.ts"));
    expect(packet).toContain("recordMomentsSince(");
    expect(packet).toContain("milestonesNoticedSince(");
    expect(packet).not.toMatch(/const newLogs = logs\.filter/);
    // the old helpers are re-exports, not second implementations
    expect(strip(read("lib/recordCounts.ts"))).not.toMatch(/function reportsLeadCounts/);
    expect(strip(read("lib/pulse.ts"))).not.toMatch(/function noticedMilestoneCounts/);
  });
});

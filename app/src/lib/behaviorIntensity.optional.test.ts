/**
 * B-DATA-09 — `BehaviorLog.intensity` is optional. A plain moment stores no
 * intensity; every consumer treats absence as "not recorded": it renders no
 * dots or level, and it is excluded from every intensity reducer (never a
 * neutral 1 or 3 invented on its behalf).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { BehaviorLog } from "../types";
import { buildDayWindowsSummary } from "../growth/dayWindowsAgg";
import { predictRhythm } from "../rhythm/predict";
import { deriveMonitoring } from "./monitoring";
import { computeMomentum } from "./signalTimeline";
import { watchSignals } from "../practice/watch";
import { buildConsultPacket, buildPacketInput } from "../consult/packet";
import { buildBehaviorExportHtml } from "./behaviorExport";
import { buildMomentLog, momentLogFields, normalizeExtractedLog, clampIntensity } from "../content/behaviorTaxonomy";

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(here, "..");
const read = (rel: string) => readFileSync(path.join(SRC, rel), "utf8");

const DAY = 86_400_000;
const NOW = new Date(2026, 9, 6, 21, 0, 0).getTime();
const at = (daysAgo: number, hour: number, base = NOW) => {
  const d = new Date(base - daysAgo * DAY);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
};

let seq = 0;
const log = (over: Partial<BehaviorLog> & { timestamp: string }): BehaviorLog => ({
  id: `l-${++seq}`,
  behaviorType: "Moment",
  durationMinutes: 0,
  trigger: "said butterfly",
  context: "Home",
  ...over,
});

/** A plain moment exactly as the capture sheet writes it (no intensity key). */
const plain = (daysAgo: number, hour: number, base = NOW): BehaviorLog => {
  const m = buildMomentLog("Built a tall tower", "Home", {}, new Date(at(daysAgo, hour, base)));
  if (!m) throw new Error("fixture moment has no words");
  return { ...m, id: `m-${++seq}`, context: "Home" };
};

describe("B-DATA-09 — the record shape", () => {
  it("a plain moment stores no intensity (buildMomentLog + momentLogFields)", () => {
    expect("intensity" in plain(0, 9)).toBe(false);
    expect("intensity" in momentLogFields("said butterfly")).toBe(false);
  });

  it("no neutral value is invented; an explicit one is clamped to 1-5", () => {
    expect(clampIntensity(undefined)).toBeUndefined();
    expect(clampIntensity(null)).toBeUndefined();
    expect(clampIntensity("")).toBeUndefined();
    expect(clampIntensity("nope")).toBeUndefined();
    expect(clampIntensity(0)).toBe(1);
    expect(clampIntensity(4)).toBe(4);
    expect(clampIntensity(9)).toBe(5);
    expect(normalizeExtractedLog({}).intensity).toBeUndefined();
    expect(normalizeExtractedLog({ intensity: 2 }).intensity).toBe(2);
  });

  it("the handleAddLog write stores no intensity for a Moment; startEditLog never forces one", () => {
    const ctx = read("context/ArborContext.tsx");
    expect(ctx).toMatch(/intensity: newLogType === MOMENT_BEHAVIOR_TYPE \? undefined : newLogIntensity/);
    expect(ctx).toContain('if (typeof log.intensity === "number") setNewLogIntensity(log.intensity);');
    // The co-regulation request never reads "Intensity: undefined/5".
    expect(ctx).toContain('${typeof log.intensity === "number" ? ` Intensity: ${log.intensity}/5.` : ""}');
  });
});

describe("B-DATA-09 — a log without intensity is outside every intensity reducer", () => {
  // Eight days with one intensity-5 hard moment at 17:00, plus a plain moment
  // at 09:00 on each of fourteen days.
  const hard = Array.from({ length: 8 }, (_, i) => log({ behaviorType: "Transition Refusal", intensity: 5, timestamp: at(i + 1, 17), response: "stayed close" }));
  const moments = Array.from({ length: 14 }, (_, i) => plain(i + 1, 9));
  const events = [...hard, ...moments].map((l) => ({ timestamp: l.timestamp, intensity: l.intensity }));

  it("rhythm/predict: events without intensity are never hard events", () => {
    const withMoments = predictRhythm(events, NOW);
    const hardOnly = predictRhythm(hard.map((l) => ({ timestamp: l.timestamp, intensity: l.intensity })), NOW);
    expect(withMoments.hardLogs).toBe(8);
    expect(withMoments.hardDays).toBe(8);
    expect(withMoments.hardLogs).toBe(hardOnly.hardLogs);
    expect(withMoments.bands.find((b) => b.hour === 9)?.score).toBe(0);
    for (const b of withMoments.bands) expect(Number.isNaN(b.score)).toBe(false);
  });

  it("growth/dayWindowsAgg: the high-intensity hour counts skip a log without intensity", () => {
    const summary = buildDayWindowsSummary(predictRhythm(events, NOW), NOW, events);
    expect(summary.hasEnoughData).toBe(true);
    expect(summary.hourCounts.find((c) => c.hour === 9)?.count).toBe(0);
    expect(summary.hourCounts.find((c) => c.hour === 17)?.count).toBe(8);
  });

  it("lib/monitoring: a log without intensity never reaches the pattern threshold", () => {
    const unresolved = Array.from({ length: 6 }, (_, i) => log({ behaviorType: "Meltdown", timestamp: at(i + 1, 10), resolved: false }));
    const r = deriveMonitoring({ ageYears: 3, behaviorLogs: unresolved, now: NOW });
    expect(r.domains.every((d) => d.patternMoments === 0)).toBe(true);
    expect(r.elevated).toBe(false);
  });

  it("lib/signalTimeline: the week averages read only recorded intensities", () => {
    const week = [log({ behaviorType: "Transition Refusal", intensity: 4, timestamp: at(1, 10), response: "x" }), plain(2, 10), plain(3, 10)];
    const m = computeMomentum(week, [], [], NOW);
    expect(m.momentsThisWeek).toBe(3);
    expect(m.avgIntensityThisWeek).toBe(4);
    expect(computeMomentum([plain(1, 10), plain(2, 10)], [], [], NOW).avgIntensityThisWeek).toBeNull();
  });

  it("practice/watch: the intense filter skips a log without intensity", () => {
    const real = Date.now();
    const many = Array.from({ length: 12 }, (_, i) => plain(i + 1, 10, real));
    const signals = watchSignals({ age: 3, screeningWatchLabels: [], logs: many, stats: [], bands: [], missions: [], adventureScenes: 0 });
    expect(signals.find((s) => s.id === "regulation")).toBeUndefined();
  });

  it("consult/packet: maxIntensity skips a log without intensity (no NaN poisoning a later 5)", () => {
    const logs = [
      log({ behaviorType: "Transition Refusal", timestamp: at(1, 10), trigger: "leaving" }),
      log({ behaviorType: "Transition Refusal", intensity: 5, timestamp: at(2, 10), trigger: "leaving" }),
      log({ behaviorType: "Transition Refusal", timestamp: at(3, 10), trigger: "leaving" }),
    ];
    const input = buildPacketInput({ profile: { name: "Dylan", age: 3 }, logs, milestones: [], plans: [], memory: [] }, NOW);
    expect(input.logs.map((l) => l.intensity)).toEqual([undefined, 5, undefined]);
    const pattern = buildConsultPacket(input).sections.flatMap((s) => s.items).find((i) => i.id === "pattern-0");
    expect(pattern?.textKey).toBe("elev.packet.item.patternIntense");

    const plainOnly = buildPacketInput({ profile: { name: "Dylan", age: 3 }, logs: [logs[0], logs[2]], milestones: [], plans: [], memory: [] }, NOW);
    const p2 = buildConsultPacket(plainOnly).sections.flatMap((s) => s.items).find((i) => i.id === "pattern-0");
    expect(p2?.textKey).toBe("elev.packet.item.pattern");
  });
});

describe("B-DATA-09 — absence renders nothing", () => {
  it("lib/behaviorExport prints an empty intensity cell, never 'undefined/5'", () => {
    const t = (k: string) => k;
    const html = buildBehaviorExportHtml(
      [
        { timestamp: at(1, 10), behaviorType: "Moment", durationMinutes: 0, trigger: "tower" },
        { timestamp: at(2, 10), behaviorType: "Transition Refusal", intensity: 4, durationMinutes: 10, trigger: "leaving" },
      ],
      { t, lang: "en", now: NOW },
    );
    expect(html).not.toContain("undefined");
    expect(html).toContain("<td>4/5</td>");
    expect(html).toMatch(/<td><\/td><td>0m<\/td>/);
  });

  it("BehaviorsTab: the row's colour-coded IntensityMeter mount is gone; the level pill renders only for a recorded number", () => {
    const tab = read("components/tabs/BehaviorsTab.tsx");
    expect(tab).not.toMatch(/<IntensityMeter\b/);
    expect(tab).toContain('isIncidentType(log.behaviorType) && typeof log.intensity === "number" && <span');
    expect(tab).toContain('if (typeof n.intensity === "number") setNewLogIntensity(n.intensity);');
  });

  it("QuickLogModal: an extraction without intensity leaves the sheet's own value", () => {
    const modal = read("components/overview/QuickLogModal.tsx");
    expect(modal).toContain('if (typeof n.intensity === "number") setNewLogIntensity(n.intensity);');
    expect(modal).not.toMatch(/^\s*setNewLogIntensity\(n\.intensity\);$/m);
  });
});

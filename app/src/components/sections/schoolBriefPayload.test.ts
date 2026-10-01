/**
 * B-CAREPRO-12 (client half) — the School Brief sends the teacher preset, not
 * the child's whole record. Pinned by evals/school-handoff-v1.eval.json
 * (runner.offlineGate names this file).
 *
 *  - logs: last 30 days only, as {behaviorType, trigger, response, day};
 *  - milestones: OBSERVED and inside the child's age window, as {domain, title};
 *  - the escalation screen still covers the FULL record (notes included) —
 *    on the device, before anything is sent.
 */
import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { BehaviorLog, Milestone } from "../../types";

vi.mock("../../context/ArborContext", () => ({ useArbor: () => ({}) }));
vi.mock("../../context/LanguageContext", () => ({ useLanguage: () => ({ t: (k: string) => k, uiLang: "en" }) }));
vi.mock("../../context/ToastContext", () => ({ useToast: () => ({ toast: () => {} }) }));

import { teacherBriefInput, recordNeedsEscalation, BRIEF_WINDOW_DAYS } from "./SchoolBrief";

const NOW = Date.parse("2026-10-01T12:00:00Z");
const DAY = 86_400_000;
const log = (ageDays: number, extra: Partial<BehaviorLog> = {}): BehaviorLog => ({
  id: `l-${ageDays}`,
  timestamp: new Date(NOW - ageDays * DAY).toISOString(),
  behaviorType: "Transition Refusal",
  intensity: 4,
  durationMinutes: 20,
  trigger: "leaving the park",
  response: "two-minute warning",
  notes: "PRIVATE note about grandma",
  photoAttachment: "data:image/png;base64,AAAA",
  sourceExcerpt: "PRIVATE excerpt",
  ...extra,
});
const ms = (title: string, ageMonths: number, checked: boolean): Milestone =>
  ({ id: title, domain: "language_communication", ageGroup: "", ageMonths, title, description: "CATALOGUE description", checked } as Milestone);

describe("B-CAREPRO-12 · teacherBriefInput", () => {
  const AGE = 60; // a five-year-old

  it("logs: last 30 days, four fields, no notes/intensity/duration/photo/excerpt", () => {
    const { logs } = teacherBriefInput([log(2), log(BRIEF_WINDOW_DAYS + 5)], [], AGE, NOW);
    expect(logs).toHaveLength(1);
    expect(Object.keys(logs[0]).sort()).toEqual(["behaviorType", "day", "response", "trigger"]);
    expect(logs[0].day).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const wire = JSON.stringify(logs);
    for (const banned of ["PRIVATE", "base64", "intensity", "durationMinutes", "notes"]) expect(wire).not.toContain(banned);
  });

  it("milestones: observed AND in the age window, area + title only", () => {
    const { milestones } = teacherBriefInput([], [ms("in-window seen", 60, true), ms("in-window unseen", 60, false), ms("infant item", 9, true)], AGE, NOW);
    expect(milestones).toEqual([{ domain: "language_communication", title: "in-window seen" }]);
    expect(JSON.stringify(milestones)).not.toContain("CATALOGUE");
  });

  it("the escalation screen covers notes on the device (notes never leave)", () => {
    expect(recordNeedsEscalation([log(1, { notes: "he said he wants to hurt himself" })])).toBe(true);
    expect(recordNeedsEscalation([log(1)])).toBe(false);
  });

  it("the generate call sends the preset and pre-screens first (source)", () => {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const src = readFileSync(path.join(here, "SchoolBrief.tsx"), "utf8").replace(/\r\n/g, "\n");
    const call = /api\.generateBrief\(\{[\s\S]*?\}\)/.exec(src);
    expect(call).toBeTruthy();
    expect(call![0]).toContain("logs: preset.logs");
    expect(call![0]).toContain("milestones: preset.milestones");
    expect(call![0]).not.toMatch(/logs: behaviorLogs/);
    expect(src.indexOf("recordNeedsEscalation(behaviorLogs)")).toBeLessThan(src.indexOf("api.generateBrief("));
    // NEGATIVE CONTROL: the pre-change call posted the raw context arrays.
    expect("logs: behaviorLogs,\n        milestones,").toMatch(/logs: behaviorLogs/);
  });
});

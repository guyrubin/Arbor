import { describe, expect, it } from "vitest";
import { buildClinicianSummary, type ClinicianSummaryInput } from "./clinicianSummary";
import { assertClinicianExportCeiling } from "./packet";
import { DOMAIN_COUNT } from "../lib/domains/registry";
import type { ChildProfile, Milestone } from "../types";

const childProfile = { id: "summary-child", name: "Noa", age: 3, ageMonths: 36 } as ChildProfile;
const milestone = (id: string, ageMonths: number, checked: boolean): Milestone => ({
  id, ageMonths, checked, domain: "language_communication", title: "Parent observation", description: "", icon: "chat",
} as Milestone);
const input = (): ClinicianSummaryInput => ({
  childProfile,
  milestones: [milestone("earlier", 30, true), milestone("current", 36, false), milestone("later", 60, false)],
  bands: [
    { domain: "language", signal: 99, band: "strong", basis: ["milestones"] },
    { domain: "speech", signal: 5, band: "emerging", basis: ["home practice"] },
  ],
  data: {
    today: "2026-10-10", streak: 3,
    week: { sessions: 4, activeDays: 2, domainsTouched: ["language", "speech"], missionsCompleted: 0, speechTrials: 0 } as ClinicianSummaryInput["data"]["week"],
    stats: [{ sound: "s", attempts: 12, accuracy: 50, recentAccuracy: 50, trend: "down", levelReached: "word" }],
  },
  advCount: 2,
  watch: [{ id: "watch", area: "Language", domain: "language", domainLabel: "Language", level: "discuss", evidence: ["Two observations logged", "Signal is currently emerging"], plan: [] }],
});

describe("B-GROWTH-22 — the real Consult summary builder", () => {
  it("keeps the existing practice, articulation, story and watch counts", () => {
    const { clinicianSummary, previewSummary } = buildClinicianSummary(input());
    expect(previewSummary).toContain("ARBOR PRACTICE SUMMARY — Noa, age 3 years");
    expect(previewSummary).toContain("1 of 2 milestones noticed by parent");
    expect(previewSummary).not.toContain("0 of 0");
    expect(previewSummary).not.toContain("1 of 3");
    // speech and language resolve to one registry area.
    expect(previewSummary).toContain(`across 1 of ${DOMAIN_COUNT} domains.`);
    expect(previewSummary).toContain("12 attempts, about 5 of the last 10 landed");
    expect(previewSummary).toContain("2 story scenes played");
    expect(previewSummary).toContain("1 contributing observation; evidence: Two observations logged");
    expect(previewSummary).not.toMatch(/99|emerging|strong|discuss|Increase |Current focus suggested|\d+%/);
    expect(clinicianSummary).toContain(" Streak: 3 days.");
    expect(previewSummary).not.toContain("Streak:");
    expect(clinicianSummary?.replace(" Streak: 3 days.", "")).toBe(previewSummary);
    for (const text of [clinicianSummary, previewSummary]) expect(() => assertClinicianExportCeiling(text!)).not.toThrow();
  });

  it("zero state is count-only with correct plurals and no empty domain rows", () => {
    const value = input();
    value.milestones = [];
    value.watch = [];
    value.advCount = 0;
    value.data.stats = [];
    value.data.week = { ...value.data.week, activeDays: 1, domainsTouched: [], sessions: 1 };
    value.data.streak = 1;
    const result = buildClinicianSummary(value);
    expect(result.previewSummary).toContain("on 1 day across 0 of 8 domains");
    expect(result.clinicianSummary).toContain("Streak: 1 day.");
    expect(result.previewSummary).not.toMatch(/day\(s\)|domain\(s\)|0 of 0|milestones noticed by parent/);
  });

  for (const token of ["riskLevel", "milestonesPercent", "42%", "12.5 %"]) {
    for (const source of ["name", "basis", "sound", "evidence", "area"] as const) {
      it(`fails closed for ${token} injected through ${source}`, () => {
        const value = input();
        if (source === "name") value.childProfile = { ...childProfile, name: token };
        if (source === "basis") value.bands[0].basis = [token];
        if (source === "sound") value.data.stats[0].sound = token;
        if (source === "evidence") value.watch[0].evidence = [token];
        if (source === "area") value.watch[0].area = token;
        expect(buildClinicianSummary(value)).toEqual({ clinicianSummary: null, previewSummary: null });
      });
    }
  }

  it("the ceiling negative control rejects a forbidden token without the builder", () => {
    expect(() => assertClinicianExportCeiling("riskLevel: High")).toThrow();
    expect(() => assertClinicianExportCeiling("50% of milestones")).toThrow();
  });
});

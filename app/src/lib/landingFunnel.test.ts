import { describe, expect, it } from "vitest";
import { countLandingFunnel, LANDING_STAGES, LANDING_COVERAGE } from "./landingFunnel.mjs";

const ev = (uid: string, event: string, at: number, source = "arbor_landing") => ({ uid, event, at, props: { source } });
describe("the landing cohort measures signed-in progression honestly", () => {
  it("counts each account once, despite reloads and duplicate events", () => {
    const events = LANDING_STAGES.flatMap((stage, i) => [ev("a", stage, i + 1), ev("a", stage, i + 1)]);
    expect(countLandingFunnel(events)[0].stages.map((s: { count: number }) => s.count)).toEqual([1, 1, 1, 1]);
  });
  it("requires every stage in order and excludes activity before the entry", () => {
    const events = [ev("a", "paid", 1), ev("a", "onboarding_completed", 2), ev("a", "landing_entry", 3), ev("a", "activated", 4), ev("b", "paid", 5)];
    expect(countLandingFunnel(events)[0].stages.map((s: { count: number }) => s.count)).toEqual([1, 0, 0, 0]);
  });
  it("uses the arrival's source, rejects missing identities/timestamps, and exposes no identities", () => {
    const result = countLandingFunnel([ev("a", "landing_entry", 1, "partner"), ev("a", "onboarding_completed", 2, "different"), ev("", "landing_entry", 1), ev("unknown", "landing_entry", 1), ev("c", "landing_entry", NaN)]);
    expect(result).toEqual([{ key: "partner", stages: LANDING_STAGES.map((stage, i) => ({ stage, count: i < 2 ? 1 : 0 })) }]);
    expect(JSON.stringify(result)).not.toContain('"uid"');
  });
  it("does not invent a denominator or claim visitor conversion", () => {
    expect(countLandingFunnel([])).toEqual([]);
    expect(LANDING_COVERAGE).toContain("Anonymous page views and exits are not collected");
    expect(LANDING_COVERAGE).toContain("not visitor-to-signup conversion");
  });
});

/**
 * B-ASKJB-10 — Ask's fast-start leads with the child's own recurring moment.
 *
 * The chip builder reuses patternEchoFor (ECHO_MIN_COUNT = 3 inside
 * ECHO_WINDOW_DAYS = 21) — never a second threshold. Its label is keyed and
 * carries the localized type only (no count, no intensity).
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { BehaviorLog } from "../types";
import { ECHO_MIN_COUNT, ECHO_WINDOW_DAYS, recurringScenario } from "./patternEcho";
import { behaviorTypeLabel } from "../content/behaviorTaxonomy";
import { translate } from "./i18n";

const TODAY = "2026-10-01";
const log = (behaviorType: string, daysAgo: number, intensity = 5): BehaviorLog =>
  ({
    id: `${behaviorType}-${daysAgo}`,
    behaviorType,
    trigger: "leaving for school",
    timestamp: new Date(Date.parse(`${TODAY}T09:00:00`) - daysAgo * 86_400_000).toISOString(),
    intensity,
    resolved: false,
    context: "Home",
  }) as unknown as BehaviorLog;

const PROMPTS = { "Transition Refusal": "TRANSITION PROMPT" };
const optsFor = (lang: "en" | "he") => {
  const t = (key: string, vars?: Record<string, string | number>) => translate(lang, key, vars);
  return { prompts: PROMPTS, typeLabel: (type: string) => behaviorTypeLabel(type, t), t, fallbackPrompt: "GENERIC {type}" };
};

describe("B-ASKJB-10 · recurringScenario", () => {
  it("reuses the echo constants (3 in 21 days)", () => {
    expect(ECHO_MIN_COUNT).toBe(3);
    expect(ECHO_WINDOW_DAYS).toBe(21);
  });

  it("3 'Transition Refusal' logs in 21 days → that chip, keyed label, mapped prompt (EN)", () => {
    const logs = [log("Transition Refusal", 1), log("Transition Refusal", 4), log("Transition Refusal", 9)];
    const s = recurringScenario(logs, TODAY, optsFor("en"))!;
    expect(s.type).toBe("Transition Refusal");
    expect(s.label).toContain("Departure Refusal");
    expect(s.label).toContain("again");
    expect(s.prompt).toBe("TRANSITION PROMPT");
  });

  it("HE label is Hebrew (localized type, keyed template)", () => {
    const logs = [log("Transition Refusal", 1), log("Transition Refusal", 4), log("Transition Refusal", 9)];
    const s = recurringScenario(logs, TODAY, optsFor("he"))!;
    expect(s.label).toContain("סירוב ליציאה");
    expect(s.label).not.toMatch(/[A-Za-z]/);
  });

  it("below the threshold (2) or outside the window → null (today's chips)", () => {
    expect(recurringScenario([log("Transition Refusal", 1), log("Transition Refusal", 2)], TODAY, optsFor("en"))).toBeNull();
    expect(recurringScenario([log("Transition Refusal", 30), log("Transition Refusal", 31), log("Transition Refusal", 40)], TODAY, optsFor("en"))).toBeNull();
    expect(recurringScenario([], TODAY, optsFor("en"))).toBeNull();
  });

  it("plain Moments never recur into a chip", () => {
    expect(recurringScenario([log("Moment", 1), log("Moment", 2), log("Moment", 3)], TODAY, optsFor("en"))).toBeNull();
  });

  it("an unmapped type takes the generic prompt with the localized label", () => {
    const logs = [log("Sleep Meltdown", 1), log("Sleep Meltdown", 2), log("Sleep Meltdown", 3)];
    const s = recurringScenario(logs, TODAY, optsFor("en"))!;
    expect(s.prompt).toBe(`GENERIC ${behaviorTypeLabel("Sleep Meltdown", (k) => translate("en", k))}`);
  });

  it("no count and no intensity in the label", () => {
    const logs = [log("Transition Refusal", 1, 5), log("Transition Refusal", 4, 5), log("Transition Refusal", 9, 5)];
    const s = recurringScenario(logs, TODAY, optsFor("en"))!;
    expect(s.label).not.toMatch(/\d/);
    expect(s.label).not.toMatch(/intens|severe|\/5/i);
  });
});

describe("B-ASKJB-10 · CoachTab wiring", () => {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const coach = readFileSync(path.join(here, "..", "components", "tabs", "CoachTab.tsx"), "utf8");

  it("the echo chip leads, then 2 static chips; the map sits beside SCENARIOS", () => {
    expect(coach).toContain("const ECHO_PROMPTS: Readonly<Record<string, string>> = {");
    expect(coach.indexOf("const ECHO_PROMPTS")).toBeGreaterThan(coach.indexOf("const SCENARIOS"));
    expect(coach.indexOf('data-testid="coach-scenario-echo"')).toBeLessThan(coach.indexOf("SCENARIOS.slice(0, staticShown)"));
    expect(coach).toContain("const staticShown = echoScenario ? 2 : 3;");
    expect(coach).toContain("recurringScenario(behaviorLogs, localDayKey(), {");
  });
});

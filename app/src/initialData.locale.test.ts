/**
 * Critic r1 (W2-ASKJB journal P1 G0 + plans P0 G0, Law 8): the sandbox demo
 * record rendered English free text on the Hebrew journal and plan (sweep
 * latinChromeHE 6 and 18). The seed is keyed by locale; this guard keeps the
 * Hebrew seed Latin-free and its counts identical to English, and keeps
 * ArborContext seeding through demoSeedFor(uiLang).
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { demoSeedFor, sampleBehaviorLogs, defaultActionPlans } from "./initialData";

const here = path.dirname(fileURLToPath(import.meta.url));
const LATIN = /[A-Za-z]/;

describe("the demo seed speaks the parent's language", () => {
  const he = demoSeedFor("he");
  const en = demoSeedFor("en");

  it("EN is the original seed", () => {
    expect(en.logs).toBe(sampleBehaviorLogs);
    expect(en.plans).toBe(defaultActionPlans);
  });

  it("HE log free text has no Latin letters; ids, types, times and intensities match EN", () => {
    expect(he.logs.map((l) => [l.id, l.behaviorType, l.timestamp, l.intensity])).toEqual(
      en.logs.map((l) => [l.id, l.behaviorType, l.timestamp, l.intensity]),
    );
    for (const l of he.logs) for (const f of [l.trigger, l.response, l.notes]) expect(f ?? "").not.toMatch(LATIN);
  });

  it("HE plan text has no Latin letters; phase/step shape and completion flags match EN", () => {
    expect(he.plans).toHaveLength(en.plans.length);
    he.plans.forEach((p, i) => {
      const e = en.plans[i];
      expect(p.id).toBe(e.id);
      const texts = [
        p.title, p.issue,
        ...p.phases.flatMap((ph) => [ph.name, ph.description, ...ph.steps.map((s) => s.text)]),
        ...(p.scripts ?? []).flatMap((sc) => [sc.scenario, sc.say, sc.avoid]),
        ...(p.successIndicators ?? []),
      ];
      for (const tx of texts) expect(tx ?? "").not.toMatch(LATIN);
      expect(p.phases.map((ph) => ph.steps.map((s) => s.completed))).toEqual(e.phases.map((ph) => ph.steps.map((s) => s.completed)));
      expect((p.scripts ?? []).length).toBe((e.scripts ?? []).length);
    });
  });

  it("ArborContext seeds the sandbox through demoSeedFor(uiLang)", () => {
    const ctx = readFileSync(path.join(here, "context", "ArborContext.tsx"), "utf8");
    expect(ctx).toContain('demoSeedFor(uiLang === "he" ? "he" : "en")');
    expect(ctx).toContain("sandboxSeed: demoSeed.logs");
    expect(ctx).toContain("sandboxSeed: demoSeed.plans");
    expect(ctx).not.toMatch(/sandboxSeed:\s*(sampleBehaviorLogs|defaultActionPlans)\b/);
  });
});

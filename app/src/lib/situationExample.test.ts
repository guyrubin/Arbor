import { describe, expect, it, vi } from "vitest";
import { toParentWords } from "../server/parentWordsScrub";
import { memoryProvenanceClass } from "../memory/memoryService";
import { translate } from "./i18n";
import { SITUATION_MOMENTS, clearSituationKept, captureTrialEntry, readTrialEntry, type SituationMoment } from "./trialEntry";
import { LANDING_EXAMPLE_PROMPT, decideLandingExample, landingExampleFact, proposeLandingExample } from "./situationExample";

describe("landing example fact", () => {
  it.each(SITUATION_MOMENTS)("%s stays in parent words in both languages and does not grade a child", moment => {
    for (const lang of ["en", "he"] as const) {
      const fact = landingExampleFact(moment, lang);
      expect(fact).toBe(translate(lang, `elev.situation.example.fact.${moment}`));
      expect(toParentWords(fact)).toBe(fact);
      expect(fact.toLowerCase()).not.toMatch(/\b(score|percentile|diagnosis|delay|disorder)\b/);
      expect(fact).toMatch(lang === "en" ? /illustration/i : /המחשה/);
    }
  });

  it("the landing prompt stays an inference, so the example waits for the parent", () => {
    expect(memoryProvenanceClass(landingExampleFact("bedtime", "en"), LANDING_EXAMPLE_PROMPT)).toBe("inference");
  });
});

describe("landing example review", () => {
  it("proposes once, then approves or leaves out through the memory routes", async () => {
    const calls: { url: string; body: string }[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit) => {
      calls.push({ url: String(url), body: String(init.body) });
      if (String(url).endsWith("/propose")) {
        return { ok: true, json: async () => ({ items: [{ memoryId: "m1", prompt: LANDING_EXAMPLE_PROMPT, status: "pending", fact: landingExampleFact("play", "en") }] }) };
      }
      return { ok: true, json: async () => ({ items: [] }) };
    }));
    const data = new Map<string, string>();
    vi.stubGlobal("sessionStorage", { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => data.set(k, v) });
    const now = Date.now();
    captureTrialEntry("?entry=landing&start=trial&lang=en&moment=play&kept=1", now);
    const proposed = proposeLandingExample("child-1", "play", "en");
    expect(await proposeLandingExample("child-1", "play", "en")).toEqual(await proposed);
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("/api/memory/child-1/propose");
    expect(JSON.parse(calls[0].body)).toMatchObject({ prompt: LANDING_EXAMPLE_PROMPT, source: "landing-example", fact: landingExampleFact("play", "en") });
    expect(await decideLandingExample("m1", "approved")).toBe(true);
    expect(calls[1].url).toBe("/api/memory/m1");
    expect(JSON.parse(calls[1].body)).toEqual({ status: "approved" });
    expect(readTrialEntry(now + 1)?.kept).toBeUndefined();
    expect(readTrialEntry(now + 1)?.moment).toBe("play");
    clearSituationKept();
    vi.unstubAllGlobals();
  });

  it("a failed propose stays unavailable and does not clear the kept flag", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, json: async () => ({}) })));
    const data = new Map<string, string>();
    vi.stubGlobal("sessionStorage", { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => data.set(k, v) });
    const now = Date.now();
    captureTrialEntry("?entry=landing&start=trial&lang=he&moment=bedtime&kept=1", now);
    const moment: SituationMoment = "bedtime";
    expect(await proposeLandingExample("child-2", moment, "he")).toEqual({ status: "unavailable" });
    expect(readTrialEntry(now + 1)?.kept).toBe(true);
    vi.unstubAllGlobals();
  });
});

/**
 * B-CAREPRO-33 · "Still true?" — the as-of model, the drawer's stamping, the
 * packet's "Setting (as of {month})" line (EN + HE) and the export carrying
 * `factsAsOf`. The rendered prompt on #/profile is pinned in
 * components/sections/ChildProfile.layout.test.tsx.
 */
import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { FACT_FIELDS, confirmFact, factMonthLabel, isFactStale, stampChangedFacts } from "./factsAsOf";
import { buildConsultPacket, buildPacketInput, itemText } from "../consult/packet";
import { exportChildData } from "./childData";
import type { ChildProfile } from "../types";

vi.mock("./api", () => ({
  api: {
    privacyExport: async () => { throw new Error("offline"); },
    privacyErase: async () => { throw new Error("offline"); },
  },
}));

const NOW = Date.parse("2026-10-02T09:00:00.000Z");
const DAY = 86_400_000;
const HERE = path.dirname(fileURLToPath(import.meta.url));

describe("B-CAREPRO-33 · the as-of model", () => {
  it("the four quoted fields", () => {
    expect([...FACT_FIELDS]).toEqual(["schoolContext", "languages", "challenges", "strengths"]);
  });

  it("a save stamps only the fields whose value changed", () => {
    const old = new Date(NOW - 200 * DAY).toISOString();
    const nowIso = new Date(NOW).toISOString();
    const prev = { schoolContext: "Gan Alon", languages: ["Hebrew", "English"], challenges: [], strengths: ["curious"], factsAsOf: { schoolContext: old, languages: old } };
    const out = stampChangedFacts(prev, { schoolContext: "School Rimon", languages: ["Hebrew", "English"], challenges: [], strengths: [" curious "] }, nowIso);
    expect(out.schoolContext).toBe(nowIso);
    expect(out.languages).toBe(old); // unchanged list keeps its date
    expect(out.strengths).toBeUndefined(); // whitespace-only difference is no change
    expect(out.challenges).toBeUndefined();
  });

  it("120 days old asks Still true?; 30 days or undated does not; Keep stamps today", () => {
    const at120 = new Date(NOW - 120 * DAY).toISOString();
    expect(isFactStale(at120, NOW)).toBe(true);
    expect(isFactStale(new Date(NOW - 30 * DAY).toISOString(), NOW)).toBe(false);
    expect(isFactStale(undefined, NOW)).toBe(false);
    const today = new Date(NOW).toISOString();
    const kept = confirmFact({ schoolContext: at120, languages: at120 }, "schoolContext", today);
    expect(kept).toEqual({ schoolContext: today, languages: at120 });
    expect(isFactStale(kept.schoolContext, NOW)).toBe(false);
  });

  it("the month label is the reader's language", () => {
    expect(factMonthLabel("2026-06-04T00:00:00.000Z", "en")).toBe("June 2026");
    expect(factMonthLabel("2026-06-04T00:00:00.000Z", "he")).toMatch(/יוני/);
  });

  it("ProfileEditDrawer writes factsAsOf through stampChangedFacts on save", () => {
    const src = readFileSync(path.join(HERE, "..", "components", "profile", "ProfileEditDrawer.tsx"), "utf8");
    expect(src).toContain("factsAsOf: stampChangedFacts(activeChild, facts, new Date().toISOString())");
  });
});

describe("B-CAREPRO-33 · the packet's setting line", () => {
  const raw = (factsAsOf?: { schoolContext?: string }) => ({
    profile: { name: "Noa", age: 5, languages: ["Hebrew"], schoolContext: "Bilingual gan", factsAsOf },
    logs: [], milestones: [], plans: [], memory: [],
  });
  const settingOf = (r: ReturnType<typeof raw>) =>
    buildConsultPacket(buildPacketInput(r, NOW)).sections.flatMap((s) => s.items).find((i) => i.id === "about-school")!;

  it("a dated setting reads 'Setting (as of {month})' in EN and HE", () => {
    const item = settingOf(raw({ schoolContext: "2026-06-04T00:00:00.000Z" }));
    expect(item.text).toBe("Setting (as of June 2026): Bilingual gan.");
    const he = itemText(item, "he");
    expect(he).toContain("נכון ל");
    expect(he).toMatch(/יוני/);
    expect(he).toContain("Bilingual gan");
  });

  it("an undated or malformed date keeps the plain line (no invented date)", () => {
    expect(settingOf(raw()).text).toBe("Setting: Bilingual gan.");
    expect(settingOf(raw({ schoolContext: "not a date" })).text).toBe("Setting: Bilingual gan.");
  });
});

describe("B-CAREPRO-33 · the export JSON carries factsAsOf", () => {
  it("exportChildData returns the profile with its factsAsOf", async () => {
    const store = new Map<string, string>();
    (globalThis as unknown as { localStorage: Storage }).localStorage = {
      getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, v); },
      removeItem: (k: string) => { store.delete(k); }, clear: () => store.clear(), key: () => null, get length() { return store.size; },
    } as Storage;
    const child = { id: "c1", name: "Noa", age: 5, languages: ["Hebrew"], schoolContext: "Gan", challenges: [], strengths: [], factsAsOf: { schoolContext: "2026-06-04T00:00:00.000Z" } } as unknown as ChildProfile;
    const out = await exportChildData(undefined, child);
    expect(out.profile.factsAsOf).toEqual({ schoolContext: "2026-06-04T00:00:00.000Z" });
    expect(JSON.stringify(out)).toContain('"factsAsOf":{"schoolContext":"2026-06-04T00:00:00.000Z"}');
    delete (globalThis as unknown as { localStorage?: Storage }).localStorage;
  });
});

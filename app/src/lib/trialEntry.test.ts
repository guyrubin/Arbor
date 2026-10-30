import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("./analytics", () => ({ track: vi.fn() }));
vi.mock("./kidModeGate", () => ({ isKidModeActive: vi.fn(() => false) }));
import { track } from "./analytics";
import { isKidModeActive } from "./kidModeGate";
import { captureTrialEntry, readTrialEntry, recordLandingEntry, trialLanguage, TRIAL_ENTRY_KEY, TRIAL_ENTRY_TTL } from "./trialEntry";
import { trialHref } from "../../public/marketing/arbor-conversion-v12.js";

describe("landing to trial continuity", () => {
  let data: Map<string, string>;
  beforeEach(() => {
    data = new Map();
    vi.stubGlobal("sessionStorage", { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => data.set(k, v) });
    vi.clearAllMocks();
    vi.mocked(isKidModeActive).mockReturnValue(false);
  });
  afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

  it("accepts only an explicit landing trial and a supported language", () => {
    expect(trialLanguage("?entry=landing&start=trial&lang=he")).toBe("he");
    for (const search of ["?lang=he", "?entry=landing&start=paid&lang=en", "?entry=landing&start=trial&lang=de"]) expect(trialLanguage(search)).toBeNull();
  });
  it("keeps the situation id across auth and expires it, never a name or example prose", () => {
    captureTrialEntry("?entry=landing&start=trial&lang=he&moment=feelings&kept=1&name=Example", 100);
    expect(readTrialEntry(101)).toEqual({ lang: "he", at: 100, recorded: false, moment: "feelings", kept: true });
    captureTrialEntry("?entry=landing&start=trial&lang=he", 102);
    expect(readTrialEntry(103)).toEqual({ lang: "he", at: 100, recorded: false, moment: "feelings", kept: true });
    const stored = data.get(TRIAL_ENTRY_KEY) ?? "";
    expect(stored).not.toMatch(/name|Example|hug|story/);
    expect(readTrialEntry(100 + TRIAL_ENTRY_TTL)).toBeNull();
    expect(readTrialEntry(99)).toBeNull();
  });
  it("drops an unknown moment and a kept flag with no situation", () => {
    captureTrialEntry("?entry=landing&start=trial&lang=en&moment=secret&kept=1", 200);
    expect(readTrialEntry(201)).toEqual({ lang: "en", at: 200, recorded: false });
    captureTrialEntry("?entry=landing&start=trial&lang=en&moment=play", 202);
    expect(readTrialEntry(203)).toEqual({ lang: "en", at: 200, recorded: false, moment: "play" });
  });
  it("emits one signed-in arrival through the existing analytics gate, without family details", () => {
    captureTrialEntry("?entry=landing&start=trial&lang=en");
    recordLandingEntry("local-sandbox");
    vi.mocked(isKidModeActive).mockReturnValue(true);
    recordLandingEntry("test-account");
    expect(track).not.toHaveBeenCalled();
    vi.mocked(isKidModeActive).mockReturnValue(false);
    recordLandingEntry("test-account");
    recordLandingEntry("test-account");
    expect(track).toHaveBeenCalledExactlyOnceWith("landing_entry", { landing_version: "v12", locale: "en" });
    expect(JSON.stringify(vi.mocked(track).mock.calls)).not.toMatch(/moment|kept/);
  });
  it("fails quietly when browser storage is unavailable or malformed", () => {
    data.set(TRIAL_ENTRY_KEY, "invalid-json");
    expect(readTrialEntry()).toBeNull();
    vi.stubGlobal("sessionStorage", { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } });
    expect(() => captureTrialEntry("?entry=landing&start=trial&lang=en")).not.toThrow();
    recordLandingEntry("test-account");
    expect(track).not.toHaveBeenCalled();
  });
  it("preserves referral/campaign attribution and ignores unrelated query data", () => {
    const base = "/?entry=landing&start=trial&lang=en&utm_source=arbor_landing&utm_campaign=landing_v12";
    const target = new URL(trialHref(base, "?utm_source=partner&utm_campaign=autumn&ref=ABC123&moment=feelings&redirect=https://elsewhere.test", "he"), "https://arborparentingapp.com");
    expect(target.pathname).toBe("/");
    expect(Object.fromEntries(target.searchParams)).toEqual({ entry: "landing", start: "trial", lang: "he", utm_source: "partner", utm_campaign: "autumn", ref: "ABC123", moment: "feelings" });
    expect(target.searchParams.has("redirect")).toBe(false);
    expect(new URLSearchParams(trialHref(base, "?ref=ABC123", "en").split("?")[1]).has("utm_source")).toBe(false);
    const kept = new URL(trialHref(base, "?moment=play&kept=1&name=Noa", "en"), "https://arborparentingapp.com");
    expect(kept.searchParams.get("moment")).toBe("play");
    expect(kept.searchParams.get("kept")).toBe("1");
    expect(kept.searchParams.has("name")).toBe(false);
    const dropped = new URL(trialHref("/?entry=landing&start=trial&lang=en&moment=bedtime&kept=1", "?moment=nope&kept=later", "en"), "https://arborparentingapp.com");
    expect(dropped.searchParams.get("moment")).toBe("bedtime");
    expect(dropped.searchParams.has("kept")).toBe(false);
    const bare = new URL(trialHref("/?entry=landing&start=trial&lang=en", "?kept=1&redirect=https://elsewhere.test", "en"), "https://arborparentingapp.com");
    expect(bare.searchParams.has("moment")).toBe(false);
    expect(bare.searchParams.has("kept")).toBe(false);
    expect(bare.searchParams.has("redirect")).toBe(false);
  });
  it("the landing script stamps the situation id onto trial links when a moment or example is chosen", () => {
    const immersive = readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "../../public/marketing/arbor-immersive-v3.js"), "utf8");
    expect(immersive).toContain("function arborStampSituation(moment, kept)");
    expect(immersive).toContain("arborStampSituation(button.dataset.moment, false)");
    expect(immersive).toContain("arborStampSituation(moment.value, keep)");
    expect(immersive).toContain("url.searchParams.set('moment', moment)");
    expect(immersive).toContain("url.searchParams.set('kept', '1')");
  });
});

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
  it("keeps only navigation intent across auth and expires it", () => {
    captureTrialEntry("?entry=landing&start=trial&lang=he&moment=feelings&name=Example", 100);
    expect(readTrialEntry(101)).toEqual({ lang: "he", at: 100, recorded: false });
    captureTrialEntry("?entry=landing&start=trial&lang=he", 102);
    expect(readTrialEntry(103)?.at).toBe(100);
    expect(data.get(TRIAL_ENTRY_KEY)).not.toMatch(/moment|name|feelings/);
    expect(readTrialEntry(100 + TRIAL_ENTRY_TTL)).toBeNull();
    expect(readTrialEntry(99)).toBeNull();
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
    expect(Object.fromEntries(target.searchParams)).toEqual({ entry: "landing", start: "trial", lang: "he", utm_source: "partner", utm_campaign: "autumn", ref: "ABC123" });
    expect(new URLSearchParams(trialHref(base, "?ref=ABC123", "en").split("?")[1]).has("utm_source")).toBe(false);
  });
});

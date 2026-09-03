/**
 * MOB-01 (wave T) — Privacy · Terms · Support are reachable in-app.
 *
 * Apple 3.1.2 (paywall) + 5.1.1(i) (policy reachable in-app) + Play Data
 * Safety. ONE constant set (lib/legalLinks.ts) feeds ONE component mounted in
 * exactly the three surfaces a reviewer / consenting parent reaches:
 * onboarding consent block, Settings footer, PaywallModal footer.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import { LEGAL_LINKS, LEGAL_LINK_ORDER, LEGAL_ORIGIN, legalLabelKey, openLegalLink } from "../../lib/legalLinks";
import { en as shellEn, he as shellHe } from "../../lib/i18nElevation/storeShell";

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(here, "..", "..");
const read = (rel: string) => readFileSync(path.join(SRC, rel), "utf8");
const stripComments = (code: string) => code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

describe("one constant set on the product domain", () => {
  it("privacy / terms / support resolve to the real public pages on arborparentingapp.com", () => {
    expect(LEGAL_ORIGIN).toBe("https://arborparentingapp.com");
    expect(LEGAL_LINKS).toEqual({
      privacy: "https://arborparentingapp.com/privacy.html",
      terms: "https://arborparentingapp.com/terms.html",
      support: "https://arborparentingapp.com/support.html",
    });
    expect(LEGAL_LINK_ORDER).toEqual(["privacy", "terms", "support"]);
  });

  it("matches the fastlane privacy_url.txt so store metadata and the in-app link cannot drift", () => {
    const fastlane = readFileSync(path.join(SRC, "..", "ios", "App", "fastlane", "metadata", "en-US", "privacy_url.txt"), "utf8").trim();
    expect(fastlane).toBe(LEGAL_LINKS.privacy);
  });

  it("every label key exists in EN and HE", () => {
    for (const key of LEGAL_LINK_ORDER) {
      expect(shellEn[legalLabelKey(key)], `en missing ${key}`).toBeTruthy();
      expect(shellHe[legalLabelKey(key)], `he missing ${key}`).toBeTruthy();
      expect(shellHe[legalLabelKey(key)]).not.toBe(shellEn[legalLabelKey(key)]);
    }
  });
});

describe("openLegalLink — native opens the in-app browser, web opens a noopener tab", () => {
  it("native: opens the URL via the native opener, never window.open", async () => {
    const openNative = vi.fn(async () => undefined);
    const openWeb = vi.fn();
    expect(await openLegalLink("terms", { isNative: true, openNative, openWeb })).toBe(true);
    expect(openNative).toHaveBeenCalledWith(LEGAL_LINKS.terms);
    expect(openWeb).not.toHaveBeenCalled();
  });

  it("negative control — web: uses the web opener, never the native plugin", async () => {
    const openNative = vi.fn(async () => undefined);
    const openWeb = vi.fn();
    expect(await openLegalLink("privacy", { isNative: false, openNative, openWeb })).toBe(true);
    expect(openWeb).toHaveBeenCalledWith(LEGAL_LINKS.privacy);
    expect(openNative).not.toHaveBeenCalled();
  });

  it("reports false instead of throwing when the opener fails", async () => {
    expect(await openLegalLink("support", { isNative: true, openNative: async () => { throw new Error("no browser"); } })).toBe(false);
  });
});

describe("the three mounts (structural)", () => {
  const MOUNTS = ["components/billing/PaywallModal.tsx", "components/layout/SettingsModal.tsx", "components/auth/OnboardingFlow.tsx"];

  it.each(MOUNTS)("%s imports and mounts <LegalLinks", (file) => {
    const src = stripComments(read(file));
    expect(src).toMatch(/import \{ LegalLinks \} from "(?:[./]+\/billing|\.)\/LegalLinks"/);
    expect(src).toContain("<LegalLinks");
  });

  it("OnboardingFlow mounts the links INSIDE the consent block (beside the checkbox)", () => {
    const src = stripComments(read("components/auth/OnboardingFlow.tsx"));
    const consent = src.indexOf('t("ob.consent.controller")');
    const links = src.indexOf("<LegalLinks", consent);
    expect(consent).toBeGreaterThan(-1);
    expect(links).toBeGreaterThan(consent);
    expect(links - consent).toBeLessThan(600);
  });

  it("LegalLinks: web anchors are target=_blank + noopener; native goes through openLegalLink (dynamic Browser import)", () => {
    const comp = stripComments(read("components/billing/LegalLinks.tsx"));
    expect(comp).toMatch(/target="_blank"\s+rel="noopener noreferrer"/);
    expect(comp).toContain("openLegalLink(key, { isNative: true })");
    const lib = read("lib/legalLinks.ts");
    expect(lib).toContain('await import("@capacitor/browser")');
    expect(lib).not.toMatch(/^\s*import\s+[^;]*from\s+["']@capacitor\/browser["']/m);
  });
});

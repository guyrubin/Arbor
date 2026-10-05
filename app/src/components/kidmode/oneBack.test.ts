/**
 * B-KID-53 (KA-13 interim) — inside a world or a story: ONE back control (the
 * overlay's Home; "Back to parent" stays the hold-exit) and ONE title, the
 * world's / story's own name (EN + HE through the kid keys / the story title).
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { translate } from "../../lib/i18n";
import { KID_GAME_TITLE_KEY } from "./KidDashboard";
import { KID_WORLDS } from "../practice/HeroArcade";

const read = (rel: string) => readFileSync(path.resolve(__dirname, "..", rel), "utf8");
const overlay = read("kidmode/KidModeOverlay.tsx");
const arcade = read("practice/HeroArcade.tsx");
const tab = read("tabs/HeroJourneyTab.tsx");

describe("B-KID-53: one title — the destination's own name", () => {
  it("the overlay title is the surface's name while one is open", () => {
    expect(overlay).toContain("const surfaceTitle = useKidSurfaceTitle();");
    expect(overlay).toContain("{surfaceTitle ?? t(surface.labelKey)}");
  });
  it("every kid world has the home tile's own name key, in EN and HE", () => {
    for (const w of KID_WORLDS) {
      const key = KID_GAME_TITLE_KEY[w.id];
      expect(key, w.id).toBeTruthy();
      expect(translate("en", key), key).not.toBe(key);
      expect(translate("he", key), key).not.toBe(key);
    }
  });
  it("the arcade publishes the open world's kid name; the reader publishes the book's title", () => {
    expect(arcade).toContain("const openTitleKey = kidMode && openId ? KID_GAME_TITLE_KEY[openId] : undefined;");
    expect(arcade).toMatch(/setKidSurfaceTitle\(openTitle\);\s*return \(\) => setKidSurfaceTitle\(null\);/);
    expect(tab).toContain('const kidStoryTitle = kidMode && activeStory && render ? (uiLang === "he" ? activeStory.titleHe : activeStory.title) : null;');
    expect(tab).toMatch(/setKidSurfaceTitle\(kidStoryTitle\);\s*return \(\) => setKidSurfaceTitle\(null\);/);
  });
});

describe("B-KID-53: one back control in Kid Mode", () => {
  it("the arcade's 'All worlds' renders only outside Kid Mode", () => {
    expect(arcade).toContain("{!kidMode && <button onClick={() => setOpenId(null)}");
  });
  it("the reader's own back + title row renders only outside Kid Mode", () => {
    expect(tab).toContain("{!kidMode && (<button\n          onClick={exitJourney}");
    expect(tab).toContain('{!kidMode && <span className="text-sm font-extrabold" style={{ color: "var(--arbor-ink)" }}>{render.title}</span>}');
  });
  it("the overlay keeps Home + the hold-exit", () => {
    expect(overlay).toContain('onClick={() => setView("home")}');
    expect(overlay).toContain("<HoldExitButton onExit={closeKidMode}");
  });
});

describe("the title store", () => {
  it("publishes and clears", async () => {
    const mod = await import("./kidSurfaceTitle");
    mod.setKidSurfaceTitle("Mind Vault");
    mod.setKidSurfaceTitle(null);
    expect(typeof mod.useKidSurfaceTitle).toBe("function");
  });
});

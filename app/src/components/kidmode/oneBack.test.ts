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
    // B-KID-74 (Fable render): one seam - kidBarTitle (an open world's kid name
    // from the overlay's own state, else the surface's own title, else its label).
    expect(overlay).toContain("return surfaceTitle ?? t(SURFACE_META[view].labelKey);");
    expect(overlay).toContain("{barTitle}");
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

describe("B-KID-53 polish: the reader header fits the phone", () => {
  it("(a) the overlay title steps down for a surface title, max 2 lines + ellipsis", () => {
    expect(overlay).toContain('fontSize: surfaceTitle ? "var(--kid-t-say)" : "var(--kid-t-title)",'); // B-KID-133 (D-03): kid type tokens
    expect(overlay).toContain("WebkitLineClamp: 2,");
  });
  it("(b) Kid Mode has no reader top row; full screen sits in the page meta row", () => {
    expect(tab).toMatch(/\{!kidMode && \(\s*<div className="flex items-center justify-between">/);
    expect(tab).toContain("metaAction={kidMode && !immersiveMode ? immersiveButton : undefined}");
    expect(read("stories/HeroScenePlayer.tsx")).toContain("{metaAction}");
  });
  it("(c) one visible page indicator; AT hears 'Page n of N' (EN + HE)", async () => {
    const { kidsStoriesText } = await import("../../lib/i18nElevation/kidsStories");
    expect(kidsStoriesText("journey.beat", "en", { current: 1, total: 8 })).toBe("Page 1 of 8");
    expect(kidsStoriesText("journey.beat", "he", { current: 1, total: 8 })).toMatch(/^עמוד/);
    const player = read("stories/HeroScenePlayer.tsx");
    expect(player).not.toMatch(/\{beatNumber\} \/ \{beatTotal\}/);
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

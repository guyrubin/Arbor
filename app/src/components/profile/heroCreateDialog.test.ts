/**
 * B-PLAY-15 guard — the Stories and Comics hero-first gates create the hero
 * IN PLACE through the one shared HeroCreateDialog, never by switching the
 * parent to the Profile hub.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const read = (...p: string[]) => readFileSync(path.join(__dirname, "..", ...p), "utf8").replace(/\r\n/g, "\n");

const GATES = [
  ["tabs", "HeroJourneyTab.tsx"],
  ["tabs", "ComicsTab.tsx"],
] as const;

describe("B-PLAY-15 · hero gates open HeroCreateDialog in place", () => {
  const dialog = read("profile", "HeroCreateDialog.tsx");

  it("the dialog reuses AvatarCreator (consent gate inside it) + persistHero", () => {
    expect(dialog).toContain('import AvatarCreator from "./AvatarCreator"');
    expect(dialog).toContain('import { persistHero } from "./heroPersistence"');
    expect(dialog).toContain('toast(t("elev.hero.save.failed"), "error")');
    // the dialog never navigates
    expect(dialog).not.toMatch(/setActiveTab\(/);
  });

  for (const [dir, file] of GATES) {
    it(`${file} imports HeroCreateDialog and has no setActiveTab("profile")`, () => {
      const src = read(dir, file);
      expect(src.length).toBeGreaterThan(2000);
      expect(src).toContain('import HeroCreateDialog from "../profile/HeroCreateDialog"');
      expect(src).toMatch(/<HeroCreateDialog\b/);
      expect(src).toContain("onClick={() => setHeroDialogOpen(true)}");
      expect(src).not.toContain('setActiveTab("profile")');
    });
  }

  it("HeroFirstStep reuses the same dialog (one implementation)", () => {
    const step = read("kidmode", "HeroFirstStep.tsx");
    expect(step).toContain('import HeroCreateDialog from "../profile/HeroCreateDialog"');
    expect(step).not.toContain("persistHero(");
    expect(step).not.toContain('from "../profile/AvatarCreator"');
  });
});

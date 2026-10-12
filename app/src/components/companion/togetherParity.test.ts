import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { companionEn, companionHe } from "../../lib/i18nCompanion";
import { OFFSCREEN_IDEAS } from "./companionChoices";
import { COMPANION_PLACES } from "../../lib/companionPlaces";

/** Parity 9 Oct — Together carries what Practice Studio's door said. */
const read = (rel: string) => readFileSync(path.resolve(__dirname, "..", "..", rel), "utf8")
  .replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const together = read("components/companion/TogetherView.tsx");

describe("Together restores, inside its five modules", () => {
  // v3 F-TOG-1 re-pin: the invitation is the v3 hero (one move and the studio
  // doors). The since-line, its Keep and the hand-over left it; Start playing
  // lives on the gate card, and kid-world moments surface in Now and Moments.
  it("the invitation holds the one move and the studio doors, and no since-line, Keep or hand-over", () => {
    const hero = together.slice(together.indexOf('data-module="together-invitation"'), together.indexOf("</section>"));
    expect(hero).toContain('data-primary-move="choose-together" data-testid="together-cta"');
    expect(hero).toContain('data-testid="together-doors"');
    for (const gone of ['data-testid="together-since"', 'data-testid="together-since-keep"', 'data-testid="together-handover"']) expect(together).not.toContain(gone);
    expect(together).not.toContain("doorSinceSentence(");
    expect(together).toContain('data-testid="together-start-playing"');
    expect((together.match(/\bdata-module=/g) ?? []).length).toBe(5);
  });
  it("keeping an away idea owns its failure message (the seam stays quiet)", () => {
    expect(together).toContain("saveMoment(moment, { callerShowsFailure: true })");
    expect(together).toContain("{saveError && <p role=\"alert\"");
  });
  // v3 F-TOG-2 re-pin: the count shows on every pill that shows the games (All
  // together and Games), still a plain count in the world's own unit.
  it("per-world counts show with every game card, each in its own unit (B-PLAY-02)", () => {
    expect(together).toMatch(/playLoaded && \(counts\.byWorld\[world\.id\] \?\? 0\) > 0 && <span className="companion-world-count"/);
    expect(together).toContain("studioCountKey(world.unit, counts.byWorld[world.id])");
  });
  it("trust chips and the play note are parent copy in Settings › PIN; the gate card asks for the PIN", () => {
    // v3 F-TOG-1 re-pin: they moved from Together's footer to the PIN section,
    // and the one-time nudge folded into the gate card's "set a PIN" line.
    const settings = read("components/layout/ParentalGatePanel.tsx");
    for (const key of ["elev.practice.door.locked", "elev.practice.door.gated", "elev.practice.door.private", "elev.practice.door.stars", "practice.studio.note"]) expect(settings).toContain(key);
    for (const key of ["elev.practice.door.private", "practice.studio.note", "elev.gate.set.title", "shouldNudgeForPin", "markPinNudgeShown"]) expect(together).not.toContain(key);
    expect(together).toContain('t("companion.together-view.you-choose-when-to-enter-play-your-pin-pro")');
    expect(together).toContain('t("companion.together-view.play-opens-in-the-child-area-set-a-pin-to")');
  });
  it("under three, the from-three line names the child in the right grammatical gender", () => {
    expect(together).toContain('t(genderedKey("elev.ages.practice.fromThree", childProfile.gender), { name })');
  });
});

describe("the companion copy lives in the dictionaries (native review covers it)", () => {
  it("no Hebrew is written inline in the place or choice modules", () => {
    for (const rel of ["components/companion/companionChoices.ts", "lib/companionPlaces.ts"]) {
      expect(read(rel), rel).not.toMatch(/[֐-׿]/);
    }
  });
  // v3 F-TOG-2: the story doors left with the real story cards (TogetherStories).
  it("every idea and place reads a non-empty EN and HE string", () => {
    const pairs = [
      ...OFFSCREEN_IDEAS.flatMap((d) => [d.title, d.detail, d.say]),
      ...COMPANION_PLACES.flatMap((p) => [{ en: p.en, he: p.he }, { en: p.detailEn, he: p.detailHe }]),
    ];
    expect(pairs).toHaveLength(3 * 3 + 3 * 2);
    for (const pair of pairs) {
      expect(pair.en).toBeTruthy();
      expect(pair.he).toBeTruthy();
      expect(pair.he).not.toBe(pair.en);
    }
  });
  it("the moved keys exist in both dictionaries", () => {
    const moved = Object.keys(companionEn).filter((k) => /^companion\.(story|offscreen|place)\./.test(k));
    // v3 F-TOG-2 re-pin: the four story doors (8 keys) left with the real story cards; 9 away + 6 place keys remain.
    expect(moved).toHaveLength(15);
    for (const key of moved) expect((companionHe as Record<string, string>)[key], key).toBeTruthy();
  });
});

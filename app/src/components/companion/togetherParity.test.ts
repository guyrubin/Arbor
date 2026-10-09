import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { companionEn, companionHe } from "../../lib/i18nCompanion";
import { OFFSCREEN_IDEAS, STORY_DOORS } from "./companionChoices";
import { COMPANION_PLACES } from "../../lib/companionPlaces";

/** Parity 9 Oct — Together carries what Practice Studio's door said. */
const read = (rel: string) => readFileSync(path.resolve(__dirname, "..", "..", rel), "utf8")
  .replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const together = read("components/companion/TogetherView.tsx");

describe("Together restores, inside its four modules", () => {
  it("the since-line (B-PLAY-05/B-KID-31) and its Keep (B-SHELL-NEW-1b) sit in the invitation", () => {
    const hero = together.slice(together.indexOf('data-module="together-invitation"'), together.indexOf("</section>"));
    expect(hero).toContain('data-testid="together-since"');
    expect(hero).toContain('data-testid="together-since-keep"');
    expect(hero).toContain('data-testid="together-handover"');
    expect(together).toContain("doorSinceSentence({");
    expect((together.match(/\bdata-module=/g) ?? []).length).toBe(4);
  });
  it("the Keep owns its failure message (the seam stays quiet)", () => {
    expect(together).toContain("saveMoment(sinceText, { callerShowsFailure: true })");
    expect(together).toContain("{sinceError && <p role=\"alert\"");
  });
  it("per-world counts show in the Games filter only, each in its own unit (B-PLAY-02)", () => {
    expect(together).toMatch(/category === "games" && \(counts\.byWorld\[world\.id\] \?\? 0\) > 0 && <span className="companion-world-count"/);
    expect(together).toContain("studioCountKey(world.unit, counts.byWorld[world.id])");
  });
  it("trust chips, the play note and the one-time PIN nudge are parent copy on the parent page", () => {
    for (const key of ["elev.practice.door.private", "elev.practice.door.stars", "practice.studio.note", "elev.gate.set.title"]) expect(together).toContain(key);
    expect(together).toContain("const [nudgePin] = useState(() => shouldNudgeForPin());");
    expect(together).toContain("if (nudgePin) markPinNudgeShown();");
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
  it("every door, idea and place reads a non-empty EN and HE string", () => {
    const pairs = [
      ...STORY_DOORS.flatMap((d) => [d.title, d.detail]),
      ...OFFSCREEN_IDEAS.flatMap((d) => [d.title, d.detail, d.say]),
      ...COMPANION_PLACES.flatMap((p) => [{ en: p.en, he: p.he }, { en: p.detailEn, he: p.detailHe }]),
    ];
    expect(pairs).toHaveLength(4 * 2 + 3 * 3 + 3 * 2);
    for (const pair of pairs) {
      expect(pair.en).toBeTruthy();
      expect(pair.he).toBeTruthy();
      expect(pair.he).not.toBe(pair.en);
    }
  });
  it("the moved keys exist in both dictionaries", () => {
    const moved = Object.keys(companionEn).filter((k) => /^companion\.(story|offscreen|place)\./.test(k));
    expect(moved).toHaveLength(23);
    for (const key of moved) expect((companionHe as Record<string, string>)[key], key).toBeTruthy();
  });
});

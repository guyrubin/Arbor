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
// v10.1: the games, the away ideas and the Kids Studio hand-over moved from
// Together's in-page filter to Together › Play (#/daily-play), whose Kids
// Studio side lives in PlayStudio.tsx. The capabilities are pinned there.
const play = read("components/together/PlayStudio.tsx");

describe("Together restores, across Routines and Play", () => {
  // v10.1 re-pin: the v3 hero ("choose-together") is gone; Routines' one move is
  // "start-routine", stamped on every routine card, beside the ways into
  // stories and games. Still no since-line, Keep or hand-over on Routines;
  // Start playing lives on Play's hand-over card.
  it("Routines holds the one move and the doors, and no since-line, Keep or hand-over", () => {
    expect(together).toContain('const START_ROUTINE_MOVE = { "data-primary-move": "start-routine" } as const;');
    expect(together).toContain("primaryMoveProps={START_ROUTINE_MOVE}");
    for (const door of ["together-door-story", "together-door-continue", "together-door-find"]) expect(together, door).toContain(`door("${door}"`);
    for (const source of [together, play]) {
      for (const gone of ['data-testid="together-since"', 'data-testid="together-since-keep"', 'data-testid="together-handover"']) expect(source).not.toContain(gone);
      expect(source).not.toContain("doorSinceSentence(");
    }
    expect(together).not.toContain('data-testid="together-start-playing"');
    expect(play).toContain('data-testid="together-start-playing"');
    expect((together.match(/\bdata-module=/g) ?? []).length).toBe(2);
  });
  // V77 re-pin: Routines is built on the shared frame (Now, My child). The routines
  // module is stamped once and placed in either composition (never both rendered);
  // the index of the times of day only scrolls to a band.
  it("V77: Routines sits on the shared frame; one routines module element, placed by composition; the index only scrolls", () => {
    expect(together).toContain('className="ds-mychild together-v10"');
    expect(together).toContain('import "../moments/mychild.css";');
    expect(together.match(/<div data-module="together-routines">/g)).toHaveLength(1);
    expect(together.match(/\{routinesModule\}/g)).toHaveLength(2);
    expect(together).toMatch(/\{phone \? \([\s\S]*?\{routinesModule\}[\s\S]*?\) : \([\s\S]*?<StageCard[^>]*>\s*\{routinesModule\}/);
    expect(together).toContain("onOpen: () => scrollToSection(`band-${band}`),");
    expect(read("components/companion/TogetherRoutines.tsx")).toContain('<section key={band} className="tgb" id={`band-${band}`}');
    // NEGATIVE CONTROL: the v10.1 module sections (with their own ids) are gone.
    expect(together).not.toMatch(/<section[^>]*data-module="together-routines"/);
    expect(together).not.toContain('id="routines" data-module');
  });
  it("keeping an away idea owns its failure message (the seam stays quiet)", () => {
    expect(play).toContain("saveMoment(moment, { callerShowsFailure: true, requireAcknowledgement: true, retryKey: `together-offscreen:${id}`, isCurrent })");
    expect(play).toContain("{studio.saveError && <p role=\"alert\"");
  });
  it("per-world counts show on the game cards only, each in its own unit (B-PLAY-02)", () => {
    // v10.1 re-pin: "the Games filter" is now Play's games section (PlayGames).
    expect(play).toContain("const n = counts.byWorld[world.id] ?? 0;");
    expect(play).toMatch(/playLoaded && n > 0 && <span className="tg-rnd"[^>]*data-testid="together-world-count">\{t\(studioCountKey\(world\.unit, n\), \{ n \}\)\}/);
    expect(play.match(/studioCountKey\(/g)).toHaveLength(1);
    expect(together).not.toContain("studioCountKey");
    expect(together).not.toContain("together-world-count");
  });
  it("trust chips and the play note are parent copy in Settings › PIN; the gate card asks for the PIN", () => {
    // v3 F-TOG-1 re-pin: they moved from Together's footer to the PIN section,
    // and the one-time nudge folded into the gate card's "set a PIN" line
    // (v10.1: the gate card is Play's hand-over).
    const settings = read("components/layout/ParentalGatePanel.tsx");
    for (const key of ["elev.practice.door.locked", "elev.practice.door.gated", "elev.practice.door.private", "elev.practice.door.stars", "practice.studio.note"]) expect(settings).toContain(key);
    for (const source of [together, play]) for (const key of ["elev.practice.door.private", "practice.studio.note", "elev.gate.set.title", "shouldNudgeForPin", "markPinNudgeShown"]) expect(source).not.toContain(key);
    expect(play).toContain('t("companion.together-view.you-choose-when-to-enter-play-your-pin-pro")');
    expect(play).toContain('t("companion.together-view.play-opens-in-the-child-area-set-a-pin-to")');
  });
  it("under three, the from-three line names the child in the right grammatical gender", () => {
    expect(play).toContain('t(genderedKey("elev.ages.practice.fromThree", childProfile.gender), { name })');
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

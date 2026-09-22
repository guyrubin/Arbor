import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { EMOTIONS, EMOTION_SCENARIOS } from "../../practice/playContent";

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (relative: string) => readFileSync(path.resolve(here, relative), "utf8");

describe("Kids experience visual and session contract", () => {
  it("keeps one active-world heading and the All worlds action", () => {
    const arcade = read("../practice/HeroArcade.tsx");
    const active = arcade.slice(arcade.indexOf("if (open?.Comp)"), arcade.indexOf("return (", arcade.indexOf("if (open?.Comp)") + 80));
    expect(active).not.toMatch(/<h1[^>]*>\s*\{open\.name\}/);
    expect(active).toContain('<span className="sr-only" role="status">{open.name}</span>');
    expect(arcade).toContain('t("elev.play.arcade.allWorlds")');
  });

  it("uses the avatar-led compact header in all nine child worlds", () => {
    const files = [
      "SpeechCoachTab.tsx",
      "MimicStudioTab.tsx",
      "FeelingsLabTab.tsx",
      "AdventuresTab.tsx",
      "MindVaultWorld.tsx",
      "SpellForgeWorld.tsx",
      "BeatKeeperWorld.tsx",
      "HeroPoseWorld.tsx",
      "PatternPowerWorld.tsx",
    ];
    for (const file of files) {
      const source = read(`../practice/${file}`);
      expect(source, file).toMatch(/(?:headerVariant|variant)="compact"/);
      expect(source, file).toMatch(/worldId="[a-z-]+"/);
    }
  });

  it("M1 — the shared header cameo announces the hero BY DEFAULT, in every world", () => {
    // The nine worlds all reach the child's hero through ONE primitive. It was
    // `aria-hidden` + `decorative`, so nothing announced a hero anywhere in the
    // child experience. The prop's own stated reason ("the child's name is
    // already adjacent") is false in this header: the adjacent text is the
    // WORLD's name. Round 2: the opt-out is back as a caller's choice, default
    // OFF — one world silences it, the other eight must not lose it.
    const playkit = read("../ui/playkit.tsx");
    const cameo = playkit.slice(playkit.indexOf('<div className="play-hero-cameo'), playkit.indexOf("</div>", playkit.indexOf('<div className="play-hero-cameo')));
    expect(cameo).toContain("<HeroAvatar");
    expect(cameo, "the silence must never be hard-coded on").toContain("aria-hidden={heroDecorative || undefined}");
    expect(cameo).toContain("decorative={heroDecorative}");
    expect(playkit, "the opt-out defaults to OFF").toContain("heroDecorative = false");
    // Sprout stays the fallback through HeroAvatar itself — the header must not
    // grow its own avatar resolver.
    expect(playkit).not.toMatch(/photoUrl|comicAvatarUrl/);
  });

  it("M1 — Hero Pose has a hero in it, announced ONCE, carrying the instruction", () => {
    // Round 1 restored the in-world hero but left the header cameo announcing
    // too: a screen-reader child heard "Dylan, the hero" twice on one screen and
    // saw the identical headshot 190 px apart.
    const pose = read("../practice/HeroPoseWorld.tsx");
    expect(pose).toContain('import { HeroAvatar } from "../ui/HeroAvatar"');
    expect(pose, "the header cameo defers to the in-world hero here").toContain("heroDecorative");
    expect(pose).toContain('alt={t("elev.kids.pose.heroAlt", { name: first, pose: poseName })}');
    // It sits with the pose glyph — that pairing IS the game's instruction.
    const panel = pose.slice(pose.indexOf("comic-panel"), pose.indexOf("{poseName}</h2>"));
    expect(panel).toContain("<HeroAvatar");
    expect(panel).toContain("{pose.emoji}");
  });

  it("M1 — the instructional alt is bilingual through the existing kid copy path", () => {
    const copy = read("../../lib/i18nElevation/kidsExperience.ts");
    const lines = copy.split("\n").filter((l) => l.includes('"elev.kids.pose.heroAlt"'));
    expect(lines.length, "one EN line and one HE line").toBe(2);
    expect(lines[0]).toContain("{name} in the {pose} pose");
    expect(/[֐-׿]/.test(lines[1]), `HE value is not Hebrew: ${lines[1]}`).toBe(true);
    // The interpolation slots must survive translation.
    for (const line of lines) for (const slot of ["{name}", "{pose}"]) expect(line).toContain(slot);
  });

  it("P2-2 — Material ligature names never reach the accessibility tree", () => {
    // The round-2 critic measured `mic`, `favorite`, `arrow_back` in innerText
    // and concluded a screen-reader child hears "mic" before "Sound Lab".
    // innerText is not the accessible text: `Icon` already sets
    // aria-hidden="true" whenever it has no label (Icon.tsx:50), so the glyph is
    // removed from the tree. The finding is closed at the primitive — this
    // guard is what keeps it closed, because the default is one expression.
    const icon = read("../ui/Icon.tsx");
    expect(icon).toContain("aria-hidden={ariaLabel ? undefined : true}");
    expect(icon).toContain('role={ariaLabel ? "img" : undefined}');
    expect(icon).toContain("{name}");
    // A labelled glyph must NOT also be hidden, or the label is unreachable.
    expect(icon).toContain('aria-label={ariaLabel}');
  });

  it("M1 — no other world silences its cameo; it is the only hero they have", () => {
    for (const file of ["SpeechCoachTab.tsx", "MimicStudioTab.tsx", "FeelingsLabTab.tsx", "AdventuresTab.tsx", "MindVaultWorld.tsx", "SpellForgeWorld.tsx", "BeatKeeperWorld.tsx", "PatternPowerWorld.tsx"]) {
      expect(read(`../practice/${file}`), file).not.toContain("heroDecorative");
    }
  });

  it("wires expanded banks into bounded sessions and visible selectors", () => {
    const pattern = read("../practice/PatternPowerWorld.tsx");
    const pose = read("../practice/HeroPoseWorld.tsx");
    const beat = read("../practice/BeatKeeperWorld.tsx");
    const feelings = read("../practice/FeelingsLabTab.tsx");
    const memory = read("../practice/MemoryMatch.tsx");

    expect(pattern).toContain("selectPatternSession(");
    expect(pose).toContain("selectPoseSession(");
    expect(beat).toContain("BEAT_SETS.map");
    expect(beat).not.toContain("BEAT_ROUNDS");
    expect(feelings).toContain("scenario.textHe");
    expect(memory).toContain("MEMORY_THEMES.map");
    expect(memory).toContain("s.titleHe");
  });

  it("keeps Hebrew feeling prompts, choices, feedback, and self-check labels in one vocabulary", () => {
    const feelings = read("../practice/FeelingsLabTab.tsx");
    const heLabels = new Map(EMOTION_SCENARIOS.map((scenario) => [scenario.answer, scenario.answerLabelHe]));

    expect([...new Set(EMOTIONS.map((emotion) => emotion.id))].every((id) => heLabels.has(id))).toBe(true);
    expect(feelings).toContain("emotionLabelFor(emotion, uiLang)");
    expect(feelings).toContain("const answerLabel = emotionLabelFor(answer, uiLang)");
    expect(feelings).toContain('aria-label={emotionLabelFor(e, uiLang)}');
    expect(feelings).toContain('t("elev.kids.feelings.selfCheck"');
    expect(feelings).not.toContain("label={emotion.label}");
    expect(feelings).not.toContain("aria-label={e.label}");
  });

  it("uses truthful pose completion and beat-choice language in both locales", () => {
    const copy = read("../../lib/i18nElevation/kidsExperience.ts");
    expect(copy).toContain("That is the end of this set. Rest, or choose six more.");
    expect(copy).toContain("זה סוף הסט הזה. אפשר לנוח, או לבחור עוד שש.");
    expect(copy).toContain("Choose a different beat and pace");
    expect(copy).not.toContain("Strong body, strong hero");
    expect(copy).not.toContain("sound pattern");
    expect(copy).toContain("Your rhythm set is complete, {name}!");
    expect(copy).toContain("סיימתם את ערכת המקצבים, {name}!");
    expect(copy).toContain("Choose six more");
    expect(copy).toContain("לבחור עוד שש");
  });

  it("keeps compact sessions, fresh arrivals, and child-only embedded shells", () => {
    const pattern = read("../practice/PatternPowerWorld.tsx");
    const memory = read("../practice/MemoryMatch.tsx");
    const reading = read("../practice/EarlyReadingTrack.tsx");
    const overlay = read("KidModeOverlay.tsx");
    const arcade = read("../practice/HeroArcade.tsx");

    expect(pattern).toContain("pattern-sequence-missing");
    expect(pattern).toContain("${dayKey(new Date())}:${sessionSeed}");
    expect(pattern).toContain("setSessionSeed((seed) => seed + 1)");
    expect(memory).toContain("createMemoryPairLifecycle");
    expect(memory).toContain("!embedded");
    expect(reading).toContain("embedded && kidMode ? content");
    expect(overlay).toContain("contentRef.current.scrollTop = 0");
    expect(overlay).toContain("[isKidModeOpen, view, arcadeWorldId]");
    expect(arcade).toContain("{kidMode ? (");
    expect(arcade).toContain("{!kidMode && <div>");
    expect(arcade).toContain("{live && !kidMode && <Stars");
  });

  it("keeps tile and child arrival titles aligned", () => {
    const adventures = read("../practice/AdventuresTab.tsx");
    const mimic = read("../practice/MimicStudioTab.tsx");
    const beat = read("../practice/BeatKeeperWorld.tsx");
    expect(adventures).toContain('kidMode ? t("elev.kids.adventures.title")');
    expect(mimic).toContain('kidMode ? t("elev.kids.mimic.title")');
    expect(beat).toContain('title={t("elev.play.beat.title")}');
  });

  it("mounts the read-only comics shelf as a child-keyed lower-home destination", () => {
    const dashboard = read("KidDashboard.tsx");
    const overlay = read("KidModeOverlay.tsx");
    expect(dashboard).toContain('onOpenSurface("comics")');
    expect(dashboard).toContain('{ tile: "hero-comics", surface: "comics", arg: null }');
    expect(overlay).toContain("<KidComicsShelf key={childProfile.id}");
    expect(overlay).toContain('view === "comics"');
  });
});

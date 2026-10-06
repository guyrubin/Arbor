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
    // B-KID-68 re-pin: the world's name is its registry key, resolved by t().
    expect(active).not.toMatch(/<h1[^>]*>\s*\{(open\.name|t\(open\.nameKey\))\}/);
    expect(active).toContain('<span className="sr-only" role="status">{t(open.nameKey)}</span>');
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
      // B-KID-74: a world on the GameShell gets the compact parent header by
      // default (GameShell variant="compact"); the rest still say it.
      if (!source.includes("<GameShell")) expect(source, file).toMatch(/(?:headerVariant|variant)="compact"/);
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
    // B-KID-74 re-pin: fresh arrival at the top for every view but the home,
    // which restores where the child left it (arrivalScrollTop, oneKidView.test).
    expect(overlay).toContain("contentRef.current.scrollTop = arrivalScrollTop(view, homeScrollRef.current);");
    expect(overlay).toContain("[isKidModeOpen, view, arcadeWorldId]");
    expect(arcade).toContain("{kidMode ? (");
    expect(arcade).toContain("{!kidMode && <div>");
    expect(arcade).toContain("{live && !kidMode && <Stars");
  });

  it("keeps tile and child arrival titles aligned", () => {
    const adventures = read("../practice/AdventuresTab.tsx");
    const mimic = read("../practice/MimicStudioTab.tsx");
    const beat = read("../practice/BeatKeeperWorld.tsx");
    // B-KID-74: the kid branch is the GameShell, titled with the kid name.
    expect(adventures).toContain('<GameShell worldId="adventures" title={t("elev.kids.adventures.title")}');
    expect(mimic).toContain('<GameShell worldId="mimic" title={t("elev.kids.mimic.title")}');
    expect(beat).toContain('title={t("elev.play.beat.title")}');
  });

  it("B-KID-85: the read-only comics shelf lives in the kid library (child-keyed), not behind a home door", () => {
    const dashboard = read("KidDashboard.tsx");
    const overlay = read("KidModeOverlay.tsx");
    const library = read("KidLibrary.tsx");
    expect(dashboard).not.toContain('onOpenSurface("comics")');
    expect(dashboard).not.toContain('tile: "hero-comics"');
    expect(library).toContain('<KidComicsShelf key={childProfile.id} childProfile={childProfile} variant="madeBefore"');
    // a persisted or parent-door "comics" view still renders the full shelf
    expect(overlay).toContain("<KidComicsShelf key={childProfile.id}");
    expect(overlay).toContain('view === "comics"');
  });
});

describe("B-KID-06 · kid copy says what the door does", async () => {
  const { en: kidsEn, he: kidsHe } = await import("../../lib/i18nElevation/kidsExperience");
  const { en: storiesEn, he: storiesHe } = await import("../../lib/i18nElevation/kidsStories");
  const { en: baseEn, he: baseHe } = await import("../../lib/i18n");
  const { HERO_STORIES } = await import("../../lib/heroJourneys");

  it("the comics door uses the shelf's own line — nothing a grown-up 'saved' (books shelve themselves)", () => {
    expect(kidsEn["elev.kids.comics.sub"]).toBe(storiesEn["shelf.subtitle"]);
    expect(kidsHe["elev.kids.comics.sub"]).toBe(storiesHe["shelf.subtitle"]);
    expect(kidsEn["elev.kids.comics.sub"]).not.toMatch(/grown-up|saved/i);
    expect(kidsHe["elev.kids.comics.sub"]).not.toContain("מבוגר");
  });

  it("the banner names tonight's ONE story, EN title or HE titleHe; no 'pick a world'", () => {
    // R-2b: the eyebrow says "Tonight's story" and the title IS the story's
    // title (max 2 lines) — no "Tonight's story: …" prefix wrapping to 5 lines.
    expect(baseEn["kid.quest.eyebrow"]).toBe("Tonight's story");
    expect(baseHe["kid.quest.eyebrow"]).toBe("הסיפור של הערב");
    expect(baseEn["kid.quest.title"]).toBeUndefined();
    for (const v of [baseEn["kid.quest.eyebrow"], baseEn["kid.quest.sub"]]) expect(v).not.toMatch(/pick a world|start a hero story/i);
    for (const v of [baseHe["kid.quest.eyebrow"], baseHe["kid.quest.sub"]]) expect(v).not.toContain("בוחרים עולם");
    const dashboard = read("KidDashboard.tsx");
    // B-BOOK release re-pin: the library book's title when the banner shows one
    expect(dashboard).toContain(">{tonightLib ? kidIsolate(tonightLib.book.title[bookLang]) : tonightsTitle}</span>");
    expect(dashboard).toContain('uiLang === "he" ? tonightsStory.titleHe : tonightsStory.title');
    expect(HERO_STORIES.length).toBeGreaterThan(0);
    for (const s of HERO_STORIES) expect(s.titleHe, s.id).toMatch(/[֐-׿]/);
  });
});

describe("B-KID-06 · Word World never claims a Kid Mode seat", async () => {
  const { STUDIO_WORLDS } = await import("../practice/studioWorlds");
  const { en: baseEn, he: baseHe } = await import("../../lib/i18n");
  it("a parent-only arcade world opens its parent tab and the label names that tab (EN + HE)", () => {
    const arcade = read("../practice/HeroArcade.tsx");
    const parentOnly = [...arcade.matchAll(/\{ id: "([a-z-]+)"[^\n]*parentOnly: true/g)].map((m) => m[1]);
    expect(parentOnly).toEqual(["word-world"]);
    for (const id of parentOnly) {
      const w = STUDIO_WORLDS.find((x) => x.id === id)!;
      expect(w.tab, id).toBe("language");
      expect(w.tabNameKey, id).toBe("nav.tab.language");
    }
    expect(baseEn["practice.studio.openIn"]).toContain("{tab}");
    expect(baseHe["practice.studio.openIn"]).toContain("{tab}");
    expect(baseHe["nav.tab.language"]).toMatch(/[֐-׿]/);
    expect(read("../practice/PracticeStudioTab.tsx")).toContain('t("practice.studio.openIn", { tab: t(world.tabNameKey) })');
  });
});

/**
 * B-KID-50 (KC-06) — Pattern Power gives a second try before the rebuild.
 * A wrong tap nudges that tile, says "Try another one!" and leaves the other
 * tiles live; a second miss reveals the answer as a pulse (no sentence); only
 * the FIRST try is logged (one row per round). Static render + source pins.
 */
import { describe, expect, it, vi } from "vitest";
import React from "react";

// Providers stubbed the way patternPower.test.ts does; PlayKit renders for real.
vi.mock("../../practice/useArcadeLogger", () => ({
  useArcadeLogger: () => ({ first: "Mia", childProfile: { id: "c1", name: "Mia Test", age: 5 }, log: () => undefined }),
}));
vi.mock("../../context/LanguageContext", () => ({
  useLanguage: () => ({ t: (k: string) => k, uiLang: "en", aiLang: "en" }),
}));
vi.mock("../../context/ArborContext", () => ({
  useArbor: () => ({ childProfile: { id: "c1", name: "Mia Test", age: 5 } }),
  // B-KID-74: the game shell reads the active child (theme + read-aloud mute).
  useArborOptional: () => ({ childProfile: { id: "c1", name: "Mia Test", age: 5 } }),
}));
vi.mock("../ui/HeroAvatar", () => ({
  HeroAvatar: () => React.createElement("span", { "data-hero": "1" }),
  useHeroAvatar: () => ({ name: "Mia", url: null, hasHero: false }),
}));
vi.mock("../ui/ArborMascot", () => ({
  ArborMascot: () => React.createElement("span", { "data-mascot": "1" }),
}));
vi.mock("../../lib/celebrate", () => ({ celebrate: () => undefined }));
import { renderToString } from "react-dom/server";
import { readFileSync } from "node:fs";
import path from "node:path";
import { PatternRoundView } from "./PatternPowerWorld";
import { patternRound } from "../../practice/newGames";
import { en, he } from "../../lib/i18nElevation/kidsExperience";

const { puzzle } = patternRound(0);
const wrong = puzzle.options.find((o) => o !== puzzle.answer)!;
const view = (over: Record<string, unknown>) =>
  renderToString(React.createElement(PatternRoundView, {
    puzzle, idx: 0, options: puzzle.options, picked: null, onChoose: () => undefined,
    patternAria: "pattern", title: "Pattern Power", say: "What comes next?", speakLabel: "Hear it", lang: "en", total: 6,
    correctFeedback: "YES-LINE", retryFeedback: "RETRY-LINE {answer}", supportLabel: "support",
    tryAnotherFeedback: "TRY-ANOTHER", ...over,
  }));
const disabledCount = (html: string) => (html.match(/<button[^>]*disabled=""/g) ?? []).length;

describe("B-KID-50: a wrong tap leaves the round open", () => {
  it("after one miss: the nudge line shows, only the missed tile is disabled, the slot still asks", () => {
    const html = view({ missed: [wrong] });
    expect(html).toContain("TRY-ANOTHER");
    expect(html).not.toContain("RETRY-LINE");
    expect(disabledCount(html)).toBe(1);
    expect(html).toContain("play-nudge");
    expect(html).toContain(">?<");
  });
  it("after a second miss: the answer pulses in place, no sentence, no answer in words", () => {
    const html = view({ missed: [wrong], picked: puzzle.answer, revealed: true });
    expect(html).toContain("play-correct");
    expect(html).not.toContain("YES-LINE");
    expect(html).not.toContain("RETRY-LINE");
    expect(html).not.toContain("TRY-ANOTHER");
  });
  it("a right answer still says the yes line", () => {
    expect(view({ picked: puzzle.answer })).toContain("YES-LINE");
  });
  it("the nudge line exists in EN and HE", () => {
    expect(en["elev.kids.pattern.feedback.tryAnother"]).toBe("Try another one!");
    expect(/[א-ת]/.test(he["elev.kids.pattern.feedback.tryAnother"] ?? "")).toBe(true);
  });
});

describe("B-KID-50: the world logs the first try only", () => {
  const src = readFileSync(path.join(__dirname, "PatternPowerWorld.tsx"), "utf8");
  const choose = src.slice(src.indexOf("const choose = (opt: string) => {"), src.indexOf("return (\n    <PatternRoundView"));
  it("one log call, guarded by firstTry; a first miss returns before resolving the round", () => {
    expect(choose.match(/log\(/g)).toHaveLength(1);
    expect(choose).toContain('if (firstTry) log("pattern", "cognition"');
    expect(choose).toContain("if (!correct && firstTry) { setMissed([opt]); return; }");
    expect(choose).toContain("if (!correct) setRevealed(true);");
  });
  it("NEGATIVE CONTROL: the pre-fix choose resolved the round on any tap", () => {
    expect(choose).not.toMatch(/if \(picked\) return;\s*const correct = opt === puzzle\.answer;\s*const score = correct \? 100 : 0;\s*setPicked\(opt\);/);
  });
});

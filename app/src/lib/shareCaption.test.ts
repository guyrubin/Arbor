/**
 * shareCaption.test.ts — ENG-16: the mislabelled play share.
 *
 * THE BUG, RESTATED AS A TEST: DailyPlayCard mounts
 *   <ShareButton artifact="growth_card" surface="daily_play" />
 * with no captionKey, so ShareButton's artifact-only fallback resolved
 * `share.caption.growth` — "{name}'s progress this month" — for ONE completed
 * activity. The card that left the app made a progress claim nobody made.
 *
 * The first test below fails against the pre-change resolution rule (which
 * returned share.caption.growth for that exact pair), and the source pins at
 * the bottom carry the pre-change shape as an explicit negative control.
 */
import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { PLAY_CAPTION_KEY, PLAY_SURFACES, isPlaySurface, resolveCaptionKey } from "./shareCaption";
import { en as waveEEn, he as waveEHe } from "./i18nElevation/waveE";

describe("a single activity is never captioned as a month of progress", () => {
  it("growth_card on the daily-play surface resolves the honest play caption", () => {
    expect(resolveCaptionKey({ artifact: "growth_card", surface: "daily_play" })).toBe(PLAY_CAPTION_KEY);
    // The pre-change answer, pinned as the thing that must NOT come back.
    expect(resolveCaptionKey({ artifact: "growth_card", surface: "daily_play" })).not.toBe("share.caption.growth");
  });

  it("covers the surface-id spellings a play mount might use", () => {
    for (const surface of PLAY_SURFACES) {
      expect(isPlaySurface(surface)).toBe(true);
      expect(resolveCaptionKey({ artifact: "growth_card", surface })).toBe(PLAY_CAPTION_KEY);
    }
    expect(isPlaySurface("DAILY_PLAY")).toBe(true); // case-insensitive
    expect(isPlaySurface("milestones")).toBe(false);
    expect(isPlaySurface(undefined)).toBe(false);
  });

  it("a growth_card on a genuine progress surface keeps the progress caption", () => {
    expect(resolveCaptionKey({ artifact: "growth_card", surface: "milestones" })).toBe("share.caption.growth");
    expect(resolveCaptionKey({ artifact: "growth_card" })).toBe("share.caption.growth");
  });

  it("every other artifact keeps its existing fallback exactly", () => {
    expect(resolveCaptionKey({ artifact: "avatar", surface: "profile" })).toBe("share.caption.avatar");
    expect(resolveCaptionKey({ artifact: "story", surface: "bedtime" })).toBe("share.caption.story");
    expect(resolveCaptionKey({ artifact: "answer_card", surface: "coach" })).toBe("share.caption.answer");
    // Even on a play surface: only growth_card was mislabelled.
    expect(resolveCaptionKey({ artifact: "story", surface: "daily_play" })).toBe("share.caption.story");
  });

  it("an explicit caption key from the call site always wins", () => {
    expect(
      resolveCaptionKey({ artifact: "growth_card", surface: "daily_play", captionKey: "pride.shareCaption" }),
    ).toBe("pride.shareCaption");
  });
});

describe("the play caption exists, in both languages, and claims nothing", () => {
  it("is registered EN + HE and interpolates only what share.ts can fill", () => {
    for (const dict of [waveEEn, waveEHe]) {
      const caption = dict[PLAY_CAPTION_KEY];
      expect(caption).toBeTruthy();
      expect(caption).toContain("{name}");
      expect(caption).toContain("{url}");
      // buildShareCaption fills {name} and {url} ONLY — any other placeholder
      // would ship to a parent's timeline as literal braces.
      expect(caption.replace(/\{name\}|\{url\}/g, "")).not.toContain("{");
    }
  });

  it("says what happened and makes no progress or period claim", () => {
    const caption = waveEEn[PLAY_CAPTION_KEY].toLowerCase();
    for (const banned of ["progress", "this month", "this week", "%", "score", "level", "ahead", "behind"]) {
      expect(caption).not.toContain(banned);
    }
  });
});

describe("ShareButton actually uses the resolver (source pin + negative control)", () => {
  const src = fs
    .readFileSync(path.resolve(__dirname, "..", "components/ui/ShareButton.tsx"), "utf8")
    .replace(/\r\n/g, "\n")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

  it("the scanned file is real (a vacuous scan is not a pass)", () => {
    expect(src).toBeTruthy();
    expect(src.length).toBeGreaterThan(500);
    expect(src).toContain("export function ShareButton");
  });

  it("resolves through lib/shareCaption, passing the surface", () => {
    const call = src.match(/const caption = resolveCaptionKey\(\{[^}]*\}\)/)?.[0];
    expect(call).toBeTruthy();
    expect(call).toContain("artifact");
    expect(call).toContain("surface");
    expect(call).toContain("captionKey");
  });

  it("NEGATIVE CONTROL: the artifact-only fallback is gone", () => {
    // The exact pre-change line and its helper. If either returns, the play
    // share silently goes back to claiming a month of progress.
    expect(src).not.toContain("const caption = captionKey ?? `share.caption.${captionFor(artifact)}`");
    expect(src).not.toMatch(/function captionFor\(/);
  });
});

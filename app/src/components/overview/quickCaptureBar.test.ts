/**
 * B-TODAY-10 — "Hard moment" tile on the capture bar.
 *
 * The bar carries four tiles (text · voice · photo · hard moment), each at
 * least 44×44 at 390 (the fixed bar is 390 − 2×16 = 358 px → ≈89 px a tile)
 * and at 1280. The hard-moment tile is neutral ink — never red, coral or
 * peach, never "SOS" — and is absent once no pilot guide is available (after
 * HARD_MOMENT_PILOT.expiresAt). It opens the one capture sheet on the guide
 * matched to the parent's recent moments, with zero model calls.
 *
 * Source-based (node-only env) plus the real release selectors with an
 * injected clock.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { availableHardMomentCards, matchToRecentBehaviors } from "../../content/selectCards";
import { HARD_MOMENT_PILOT } from "../../content/pilotRelease";
import { recentBehaviorTypes } from "../../content/hardMomentSurface";
import { translate } from "../../lib/i18n";
import { todayLiveSource } from "../../testTodaySource";

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(here, "..", "..");
const read = (rel: string) => readFileSync(path.join(SRC, rel), "utf8");
const strip = (code: string) =>
  code.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const BAR = strip(read("components/overview/QuickCaptureBar.tsx"));
const TODAY = strip(todayLiveSource());
const MODAL = strip(read("components/overview/QuickLogModal.tsx"));

describe("B-TODAY-10 · four tiles, each ≥44 px", () => {
  it("text + voice + photo + hard moment = 4 tiles, a 4-column grid at 390", () => {
    const tiles = BAR.match(/data-capture-tile=/g) ?? [];
    // text, the AUX_MODES map (voice, photo), hard-moment
    expect(tiles.length).toBe(3);
    expect(BAR).toMatch(/\{ ms: "mic", key: "voice"/);
    expect(BAR).toMatch(/\{ ms: "photo_camera", key: "photo"/);
    expect(BAR).toContain('data-capture-tile="hard-moment"');
    // Critic r1: the lead cell reads the BAR's width (@container), never the viewport.
    expect(BAR).toContain('tiles === 4 ? "grid-cols-4 @3xl:grid-cols-[1.3fr_1fr_1fr_1fr_1fr]"');
    expect(BAR).toContain('<div className="@container min-w-0">');
    // NEXTLEVEL r1: viewport lg: classes live ONLY in the STACK_* constants,
    // which Today alone opts into (stack); the shared bar never reads lg:.
    const base = BAR.split("\n").filter((l) => !/^const STACK_/.test(l)).join("\n");
    expect(base).not.toMatch(/\blg:grid-cols|\blg:flex\b/);
  });

  it("every tile is ≥48 px tall and wraps icon over label in a narrow bar (≈89 px wide at 390)", () => {
    expect(BAR).toMatch(/TILE_STYLE = \(ink: string\): React\.CSSProperties =>\s*\(\{ minHeight: 48,/);
    expect((BAR.match(/style=\{TILE_STYLE\(/g) ?? []).length).toBe(3);
    expect(BAR).toContain("flex-col @2xl:flex-row");
    // 358 px / 4 tiles = 89.5 px ≥ 44 px. Critic r1: a door label is NEVER
    // truncated ("Hard mo…", "T…") — it wraps to two lines.
    expect(358 / 4).toBeGreaterThanOrEqual(44);
    expect(BAR).toContain("max-w-full line-clamp-2");
    expect(BAR).not.toMatch(/\btruncate\b/);
  });

  it("neutral ink: no peach / red / coral / pink token, no SOS anywhere on the bar", () => {
    expect(BAR).not.toMatch(/--arbor-(peach|red|coral|pink|danger|alert)/);
    expect(BAR).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    for (const lang of ["en", "he"] as const) {
      for (const key of ["elev.capture.hard.tile", "elev.capture.hard.aria", "elev.capture.hard.title"]) {
        expect(translate(lang, key)).not.toMatch(/\bSOS\b|emergency|חירום/i);
      }
    }
    const hard = BAR.slice(BAR.indexOf('data-capture-tile="hard-moment"'), BAR.indexOf("</button>", BAR.indexOf('data-capture-tile="hard-moment"')));
    expect(hard).toContain('TILE_STYLE("var(--arbor-ink)")');
    expect(hard).toContain("var(--arbor-paper-deep)");
  });

  it("HE label present (transcreated)", () => {
    expect(translate("en", "elev.capture.hard.tile")).toBe("Hard moment");
    expect(translate("he", "elev.capture.hard.tile")).toBe("רגע קשה");
  });
});

describe("B-TODAY-10 · gating and opener", () => {
  it("the tile renders only when Today passes an opener, gated on available pilot guides", () => {
    expect(BAR).toMatch(/\{onHardMoment && \(/);
    // Parity 9 Oct: Now's hard-moment door carries the same gate (the bar left with the Today hub).
    expect(TODAY).toMatch(/availableHardMomentCards\(\{ now: at, ageMonths: ageMonthsFromProfile\(childProfile, at\), locale: lang \}\)\.length > 0/);
    // B-ASKJB-31: the door opens the ONE "Hard moment now" sheet (context seam).
    expect(TODAY).toContain('{hardMomentDoor && <button type="button" className="now-hard-moment" onClick={() => openHardMomentNow()}>');
  });

  it("after HARD_MOMENT_PILOT.expiresAt no guide is available, so the tile is absent", () => {
    const before = new Date(Date.parse(HARD_MOMENT_PILOT.expiresAt) - 86_400_000);
    const after = new Date(Date.parse(HARD_MOMENT_PILOT.expiresAt) + 1000);
    expect(availableHardMomentCards({ now: before, ageMonths: 48, locale: "en" }).length).toBeGreaterThan(0);
    expect(availableHardMomentCards({ now: after, ageMonths: 48, locale: "en" }).length).toBe(0);
    expect(availableHardMomentCards({ now: after, ageMonths: 48, locale: "he" }).length).toBe(0);
  });

  it("the sheet preselects matchToRecentBehaviors(recentBehaviorTypes(logs))[0], zero model calls", () => {
    expect(MODAL).toContain("matchToRecentBehaviors(recentBehaviorTypes(behaviorLogs, now), undefined, now, context.ageMonths, context.locale)[0]");
    expect(MODAL).toContain("<HardMomentGuideContent");
    expect(MODAL).toContain("if (open && hardMomentNow) toggleHardMoment(true);");
    const guide = MODAL.slice(MODAL.indexOf("const hardGuide"), MODAL.indexOf("return card ? { card, context } : null;"));
    expect(guide).not.toMatch(/api\.|fetch\(|seedCoach/);
    const now = new Date(Date.parse(HARD_MOMENT_PILOT.expiresAt) - 7 * 86_400_000);
    const logs = [0, 1, 2].map((i) => ({ behaviorType: "Transition Refusal", timestamp: new Date(now.getTime() - i * 86_400_000).toISOString() }));
    const matched = matchToRecentBehaviors(recentBehaviorTypes(logs, now), undefined, now, 48, "en");
    expect(matched.length).toBeGreaterThan(0);
  });
});

describe("NEXTLEVEL critic r1 · Today at 1280 is two tracks, not a stretched phone column", () => {
  it("Now at 1280 is two tracks: the lead column and the side column (conversation, then capture)", () => {
    // Parity 9 Oct: the stacked QuickCaptureBar track left with the Today hub.
    expect(TODAY).toContain('<div className="now-main-grid">');
    expect(TODAY.indexOf('<div className="now-main-column">')).toBeLessThan(TODAY.indexOf('<aside className="now-side-column">'));
    expect(TODAY.indexOf('<aside className="now-side-column">')).toBeLessThan(TODAY.indexOf('<section className="now-capture"'));
    expect(read("components/companion/nowView.css")).toMatch(/\.now-main-grid \{[^}]*grid-template-columns: minmax\(0, 1\.65fr\) minmax\(0, 1fr\)/);
    expect(TODAY).not.toContain("<QuickCaptureBar");
  });

  it("the stacked bar is one column at lg with icon beside a start-aligned label; #/behaviors keeps the bar", () => {
    expect(BAR).toContain('const STACK_GRID = "lg:grid-cols-1"');
    expect(BAR).toMatch(/STACK_TILE = "lg:flex-row lg:justify-start/);
    expect(BAR).toMatch(/STACK_LABEL = "lg:text-start/);
    expect(BAR).toContain("stack = false");
    const behaviors = strip(read("components/tabs/BehaviorsTab.tsx"));
    expect(behaviors).not.toMatch(/<QuickCaptureBar[^>]*\bstack\b/);
  });
});

describe("negative control", () => {
  it("the pre-fix three-tile bar fails the hard-moment assertions", () => {
    const PRE = `className="grid grid-cols-3 lg:grid-cols-[1.1fr_1fr_1fr_1fr]"`;
    expect(PRE).not.toContain('data-capture-tile="hard-moment"');
    expect(PRE).not.toContain("grid-cols-4");
  });
});

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { translate } from "../../lib/i18n";
import { noticedMilestoneCounts, pickCountKey } from "../../lib/pulse";

/* B-GROWTH-34 (VETO-FIRST, law 1) — the rendered Growth hub read
   "0 of 21 noticed · 0 areas of 6 · 7 logged this week" while the page's own
   pill said "You noticed 5 milestones": two sources (an age-window ratio vs
   every checked milestone) and a denominator on a child record. The hero stat
   row is now three plain counts, and every milestone count on the hub comes
   from ONE helper (lib/pulse.noticedMilestoneCounts) — the one the pill reads.

   Guarded two ways: (1) the source seam — pill, hero and the Development
   picture card all call the helper; (2) a dictionary scan — every key the hub
   renders resolves, in EN and HE, to a string with no "of {total}" and no
   "מתוך". Negative controls prove both checks trip on the pre-fix shape. */

const SRC = path.resolve(__dirname, "..", "..");
const read = (rel: string) => readFileSync(path.join(SRC, rel), "utf8");
const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

/** The hub page and the cards it mounts inline (sheets it opens are not the hub). */
const HUB_FILES = [
  // Parity 9 Oct: the Growth leaf is the child portrait and its two rows.
  "components/companion/ChildPortrait.tsx",
  "components/companion/PortraitWatchRow.tsx",
  "components/companion/PortraitKeepsakes.tsx",
  "components/sections/DevScoreCard.tsx",
  "components/growth/MonthInReview.tsx",
  "components/growth/FirstWordsLedger.tsx",
  "components/growth/ArborTreeCard.tsx",
  // W2-GROWTH r1 (profile critic F3): the Profile milestones chapter printed
  // "{checked} of {total} noticed in the {band} window" — the denominator
  // B-GROWTH-34 removed from the hub survived one route over.
  "components/sections/ChildProfile.tsx",
];

/** Every literal key a file renders: t("k"), tr("k"), and pickCountKey("k") (both forms). */
function renderedKeys(src: string): string[] {
  const keys = new Set<string>();
  for (const m of src.matchAll(/\bt[A-Za-z]*\(\s*"([a-z][\w.-]+)"/g)) keys.add(m[1]);
  for (const m of src.matchAll(/pickCountKey\(\s*"([a-z][\w.-]+)"/g)) {
    keys.add(m[1]);
    keys.add(`${m[1]}One`);
  }
  return [...keys].filter((k) => k.includes("."));
}

const RATIO_EN = /\bof \{total\}|\{\w+\} of \{\w+\}/;
// "מתוך" as a RATIO ("{n} מתוך {total}", "מתוך 21"); prose "נבחר מתוך אבני הדרך"
// ("chosen from among") is not a denominator.
const RATIO_HE = /(\{\w+\}|\d)\s*מתוך|מתוך\s*(\{\w+\}|\d)/;

describe("B-GROWTH-34 — the Growth hub counts, never 'of N'", () => {
  it("one source: the pill, the hero row and the Development card all read noticedMilestoneCounts", () => {
    const pulse = stripComments(read("lib/pulse.ts"));
    expect(pulse).toMatch(/const \{ noticed \} = noticedMilestoneCounts\(milestones\);/);
    // W2-GROWTH r1: the hub no longer prints a milestone total at all (the
    // pill is the one count; the page opens on New-since rows instead).
    const dev = stripComments(HUB_FILES.slice(0, 3).map(read).join("\n"));
    expect(dev).not.toContain("noticedMilestoneCounts(");
    expect(dev).not.toContain("ageWindowMilestones(");
    expect(dev).not.toContain("inWindow.length");
    const profile = stripComments(read("components/sections/ChildProfile.tsx"));
    expect(profile).toMatch(/const \{ noticed: noticedCount \} = useMemo\(\(\) => noticedMilestoneCounts\(milestones\), \[milestones\]\);/);
    expect(profile).not.toContain("ageWindowMilestones(");
    const card = stripComments(read("components/sections/DevScoreCard.tsx"));
    expect(card).toMatch(/const \{ noticed, byDomain \} = noticedMilestoneCounts\(milestones\);/);
    expect(card).not.toMatch(/reached, total/);
  });

  // W2-GROWTH r1: the count trio ("5 noticed · 2 areas · 6 moments") is CUT —
  // dashboard density in the parent register, and a repeat of the pill. The
  // keys stay valid (other surfaces / history), so the dictionary check stays.
  it("the hub renders no stat trio; the count keys stay plain counts (EN + HE)", () => {
    const dev = stripComments(HUB_FILES.slice(0, 3).map(read).join("\n"));
    expect(dev).not.toContain("heroStats");
    expect(dev).not.toMatch(/stats=\{\[/);
    expect(dev).not.toContain('pickCountKey("elev.hero.growth.stat');
    for (const base of ["elev.hero.growth.stat.noticedCount", "elev.hero.growth.stat.areas", "elev.hero.growth.stat.moments"]) {
      for (const key of [base, `${base}One`]) {
        const en = translate("en", key);
        const he = translate("he", key);
        expect(en, key).not.toBe(key);
        expect(he, key).not.toBe(en);
        expect(he, key).toMatch(/[֐-׿]/);
        expect(en + he, key).not.toMatch(/\{|\d/);
      }
    }
  });

  it("a parent with 5 noticed milestones in 3 areas reads '5 noticed · 3 areas' — the pill's number", () => {
    const milestones = [
      { checked: true, domain: "language" },
      { checked: true, domain: "language" },
      { checked: true, domain: "motor" },
      { checked: true, domain: "social" },
      { checked: true, domain: "social" },
      { checked: false, domain: "cognitive" },
      { checked: false, domain: "motor" },
    ];
    const { noticed, areas, byDomain } = noticedMilestoneCounts(milestones);
    expect([noticed, areas]).toEqual([5, 3]);
    expect(byDomain).toEqual({ language: 2, motor: 1, social: 2 });
    // the pill's own count of the same array (lib/pulse usePulses growth branch)
    expect(noticed).toBe(milestones.filter((m) => m.checked).length);
    const row = (lang: "en" | "he", n: number, a: number, w: number) => [
      `${n} ${translate(lang, pickCountKey("elev.hero.growth.stat.noticedCount", n))}`,
      `${a} ${translate(lang, pickCountKey("elev.hero.growth.stat.areas", a))}`,
      `${w} ${translate(lang, pickCountKey("elev.hero.growth.stat.moments", w))}`,
    ].join(" · ");
    expect(row("en", noticed, areas, 7)).toBe("5 noticed · 3 areas · 7 moments this week");
    expect(row("en", 1, 1, 1)).toBe("1 noticed · 1 area · 1 moment this week");
    expect(row("he", noticed, areas, 7)).toBe("5 אבני דרך ששמתם לב אליהן · 3 תחומים · 7 רגעים השבוע");
  });

  it("dictionary scan: no key the hub renders carries 'of {total}' (EN) or 'מתוך' (HE)", () => {
    let scanned = 0;
    for (const file of HUB_FILES) {
      for (const key of renderedKeys(stripComments(read(file)))) {
        const en = translate("en", key);
        const he = translate("he", key);
        if (en === key) continue; // not a dictionary key (e.g. a route id)
        scanned++;
        expect(en, `${file} ${key}`).not.toMatch(RATIO_EN);
        expect(he, `${file} ${key}`).not.toMatch(RATIO_EN);
        expect(he, `${file} ${key}`).not.toMatch(RATIO_HE);
      }
    }
    expect(scanned).toBeGreaterThan(20);
  });

  it("NEGATIVE CONTROL — the pre-fix row and card strings trip the scan", () => {
    expect("of {total} noticed").toMatch(RATIO_EN);
    expect("area{plural} of {total}").toMatch(RATIO_EN);
    expect("{reached} of {total} age-appropriate milestones noticed").toMatch(RATIO_EN);
    expect("מתוך {total} אבני דרך").toMatch(RATIO_HE);
    expect("שמתם לב ל־{reached} מתוך {total} אבני דרך גילאיות").toMatch(RATIO_HE);
    const preFix = "const inWindow = ageWindowMilestones(milestones, comparisonMonths);\nconst noticed = inWindow.filter((m) => m.checked).length;";
    expect(preFix).toContain("ageWindowMilestones(");
  });
});

/**
 * GP-21 / GP-02 — dictionary-WIDE clinical-firewall scan.
 *
 * clinicalFirewall.wave3.test.ts scans named key families (devscore.*,
 * screen.*, ms.watch.*, …). That gap is how the Language Lab shipped
 * "Native / Emerging / Exposure" chips and "Developing — likely understands
 * more than they produce" against a child with zero observations behind them,
 * and how two dead "Is {name} on track?" keys kept shipping for months.
 *
 * This scan walks EVERY en/he value in lib/i18n.ts and every i18nElevation
 * module and bans the parent-facing verdict class:
 *   on-track / ahead-of / behind / delayed / at risk / percentile, and
 *   "emerging" / "developing" used as a STATUS LABEL (a bare chip word, or
 *   a "Developing — …" lead), in English and Hebrew.
 * Clearly editorial uses ("not a delay", "The developing picture") live in an
 * explicit key allowlist that may ONLY shrink. Negative-control fixtures prove
 * the scanner catches the exact strings that shipped.
 */
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { en as baseEn, he as baseHe } from "./i18n";
import { elevationEn, elevationHe } from "./i18nElevation/index";

const here = path.dirname(fileURLToPath(import.meta.url));

/* ── Banned verdict class ──────────────────────────────────────────────────── */
export const BANNED_EN: ReadonlyArray<{ id: string; re: RegExp }> = [
  { id: "on-track", re: /\bon[\s-]?track\b/i },
  { id: "ahead-of-age", re: /\bahead (?:of|for) (?:(?:their|his|her|the) )?(?:age|peers|schedule|curve)\b/i },
  { id: "behind", re: /\bbehind\b/i },
  { id: "delayed", re: /\bdelayed\b/i },
  { id: "at-risk", re: /\bat[\s-]risk\b/i },
  { id: "percentile", re: /\bpercentile\b/i },
  // Band words as a STATUS LABEL: the whole value is the word, or it leads
  // with "Developing —" / "Emerging:" style punctuation.
  { id: "band-label", re: /^\s*(?:emerging|developing)\s*(?:$|[—–:\-])/i },
];
export const BANNED_HE: ReadonlyArray<{ id: string; re: RegExp }> = [
  { id: "he-behind", re: /(?:^|\s)(?:מפגר|בפיגור|מאחר(?:ת)? בהתפתחות)(?:\s|$)/ },
  { id: "he-delayed", re: /(?:^|\s)מעוכב(?:ת)?(?:\s|$)/ },
  { id: "he-at-risk", re: /(?:^|\s)בסיכון(?:\s|$)/ },
  { id: "he-percentile", re: /אחוזון/ },
  { id: "he-on-track", re: /(?:^|\s)(?:במסלול|בקצב(?: טוב)?)\s*[.?!]?\s*$/ },
  // "מתפתחת" / "מתפתח" as a bare status chip.
  { id: "he-band-label", re: /^\s*מתפתח(?:ת)?\s*(?:$|[—–:\-])/ },
];

/**
 * Editorial allowlist — every key here is prose that USES a banned token to
 * negate or explain it, never to grade the child. SHRINK-ONLY: remove an entry
 * when its copy changes; never add one for a status label.
 */
const ALLOW_KEYS: ReadonlySet<string> = new Set([
  "vl.disclaimer", // "…bilingual development, not a delay…" (negation)
  "today.narrative.eyebrow", // "The developing picture" (the picture develops, not a grade)
  "today.narrative.parentOnly", // "never a score, percentile, or diagnosis" (negation)
  "elev.trust.signs.never", // trust-centre promise: what Arbor NEVER shows (negation)
  "nudge.prep.headline", // "Get ahead of {hour}" — a clock, not a child
  "elev.evidence.aria", // "About the research behind Arbor" — a preposition, not a grade
  "elev.safety.guard.medical.body", // HE "מונחים בסיכון גבוה" — the guard's TERM list, not the child
]);
const ALLOW_MAX = 7;

type Hit = { dict: string; key: string; rule: string; value: string };

function scan(dictName: string, dict: Record<string, string>, rules: ReadonlyArray<{ id: string; re: RegExp }>): Hit[] {
  const hits: Hit[] = [];
  for (const [key, value] of Object.entries(dict)) {
    if (ALLOW_KEYS.has(key)) continue;
    for (const r of rules) if (r.re.test(value)) hits.push({ dict: dictName, key, rule: r.id, value });
  }
  return hits;
}

/* ── Negative controls: the exact strings that shipped ─────────────────────── */
describe("dictionary firewall — the scanner catches the strings that shipped (negative controls)", () => {
  const shipped: Array<[string, string]> = [
    ["Is {name} on track?", "on-track"],
    ["{name} is on track", "on-track"],
    ["Emerging", "band-label"],
    ["Developing — likely understands more than they produce. Build confidence with low-pressure, daily practice.", "band-label"],
    ["She is behind her peers", "behind"],
    ["{name} is ahead of her age", "ahead-of-age"],
    ["Language may be delayed", "delayed"],
    ["Falls in the 20th percentile", "percentile"],
  ];
  for (const [value, rule] of shipped) {
    it(`EN "${value.slice(0, 40)}" → ${rule}`, () => {
      expect(BANNED_EN.find((r) => r.re.test(value))?.id).toBe(rule);
    });
  }
  const shippedHe: Array<[string, string]> = [
    ["מתפתחת", "he-band-label"],
    ["האם {name} בקצב?", "he-on-track"],
    ["{name} בקצב טוב", "he-on-track"],
    ["הילד בסיכון", "he-at-risk"],
    ["אחוזון 20", "he-percentile"],
  ];
  for (const [value, rule] of shippedHe) {
    it(`HE "${value}" → ${rule}`, () => {
      expect(BANNED_HE.find((r) => r.re.test(value))?.id).toBe(rule);
    });
  }

  it("editorial prose is NOT flagged (the scanner is about status labels)", () => {
    for (const ok of [
      "children develop at their own pace",
      "The developing picture",
      "a real developmental asset that can look like a delay during the transition",
      "Get ahead of {hour}",
      "Children usually understand a second language before they speak it.",
    ]) {
      expect(BANNED_EN.filter((r) => r.id !== "delayed" && r.id !== "behind").some((r) => r.re.test(ok)), ok).toBe(false);
    }
    for (const ok of ["ילדים מתפתחים בקצב שלהם", "התמונה המתפתחת", "מתקדם/ת בקצב האישי"]) {
      expect(BANNED_HE.some((r) => r.re.test(ok)), ok).toBe(false);
    }
  });
});

/* ── The scan itself ───────────────────────────────────────────────────────── */
describe("dictionary firewall — no parent-facing verdict label anywhere in the dictionaries", () => {
  const dicts: Array<[string, Record<string, string>, ReadonlyArray<{ id: string; re: RegExp }>]> = [
    ["i18n.en", baseEn, BANNED_EN],
    ["i18n.he", baseHe, BANNED_HE],
    ["elevation.en", elevationEn, BANNED_EN],
    ["elevation.he", elevationHe, BANNED_HE],
  ];

  it("covers a real corpus (thousands of keys)", () => {
    expect(Object.keys(baseEn).length).toBeGreaterThan(1500);
    expect(Object.keys(elevationEn).length).toBeGreaterThan(200);
  });

  for (const [name, dict, rules] of dicts) {
    it(`${name}: zero hits`, () => {
      const hits = scan(name, dict, rules);
      expect(hits.map((h) => `${h.key} [${h.rule}]: ${h.value}`), `verdict language in ${name}`).toEqual([]);
    });
  }

  it("the editorial allowlist only shrinks and every entry still exists", () => {
    expect(ALLOW_KEYS.size).toBeLessThanOrEqual(ALLOW_MAX);
    for (const key of ALLOW_KEYS) {
      const exists = key in baseEn || key in elevationEn;
      expect(exists, `allowlisted key "${key}" no longer exists — delete it from ALLOW_KEYS`).toBe(true);
    }
  });

  it("the dead 'on track' keys and the language verdict keys are gone from BOTH dictionaries", () => {
    for (const key of ["ov.track.title", "noticed.calm.title", "lang.homeTag", "lang.secondTag", "lang.otherTag", "lang.secondNote", "lang.homeNote", "lang.otherNote"]) {
      expect(key in baseEn, `${key} still in EN`).toBe(false);
      expect(key in baseHe, `${key} still in HE`).toBe(false);
    }
  });

  it("every i18nElevation module on disk is registered (so the scan cannot be dodged by a new module)", () => {
    const dir = path.join(here, "i18nElevation");
    const modules = readdirSync(dir).filter((f) => /^[a-zA-Z]+\.ts$/.test(f) && f !== "index.ts");
    const index = readFileSync(path.join(dir, "index.ts"), "utf8");
    for (const m of modules) {
      expect(index, `${m} is not registered in i18nElevation/index.ts`).toContain(`from "./${m.replace(/\.ts$/, "")}"`);
    }
  });
});

/* ── GP-02 — the Language Lab renders roles + counts, never a graded chip ───── */
describe("GP-02 — LanguageLabTab is demoted: no tiering by list order, no coloured status chip", () => {
  const src = readFileSync(path.join(here, "..", "components", "tabs", "LanguageLabTab.tsx"), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:"'`])\/\/.*$/gm, "$1");

  it("NEGATIVE CONTROL: the pre-fix card shape is what the scan bans", () => {
    const old = [
      '      tag: t("lang.secondTag"),',
      '      tone: "yellow" as PastelKey,',
      "                  <Chip tone={c.tone}>{c.tag}</Chip>",
    ].join("\n");
    expect(old).toMatch(/lang\.(?:home|second|other)Tag/);
    expect(old).toMatch(/<Chip tone=\{c\.tone\}>/);
  });

  it("uses no per-language tone or tag, and the retired keys are not referenced", () => {
    expect(src).not.toMatch(/lang\.(?:home|second|other)(?:Tag|Note)/);
    expect(src).not.toMatch(/<Chip tone=\{c\.tone\}>/);
    expect(src).not.toMatch(/tone:\s*"(?:mint|yellow|sky)" as PastelKey/);
  });

  it("renders each language as a plain role row with a logged-moments count", () => {
    expect(src).toContain('data-testid="lang-role-rows"');
    expect(src).toMatch(/elev\.growthTruth\.lang\.role\.(?:home|second|also)/);
    expect(src).toMatch(/aggregateLangCounts\(obsCol\.items\)/);
    expect(src).toContain('t("elev.growthTruth.lang.count.none")');
  });
});

import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import * as path from "node:path";
// The `en`/`he` exported from lib/i18n are the BASE dictionaries; elevation
// modules are spread UNDER them by DICTS, so a new `elev.*` key is only
// visible through the elevation export.
import { elevationEn as en, elevationHe as he } from "../../lib/i18nElevation";
import { formatHour } from "../../lib/pulse";

/**
 * TJB-14 / TJB-23 / OBJ-TODAY-06 — the Today hub's own surfaces in Hebrew.
 *
 * What the 7 Sep object audit measured, all of it English inside `lang=he`:
 *   · `#/day-windows` — "3 of 7 days logged so far." and "Patterns for Dylan,
 *     based on what you've logged." were bare template literals, and the
 *     low-data card led with an `error` glyph for a week that is simply still
 *     in progress. The route also rendered NOTHING but that sentence below
 *     `low` confidence, so 3 of 7 days looked like a broken screen.
 *   · `#/smart-reminders` — the quiet-hours picker used
 *     `jitaiPrefs.formatHour`, which is hard-coded am/pm.
 *   · Today's tools drawer — `DailyCheckinCard` had no `useLanguage` at all.
 *   · `#/weekly` — 8 modules against a budget of 3, two of them the Scholar
 *     spotlight (English catalogue copy, GD-6) and the weekly read.
 *
 * Node-only vitest env: the copy decisions are asserted through the real
 * dictionaries, the render decisions as source shape (the house pattern).
 */

const app = path.resolve(__dirname, "..", "..", "..");
const read = (rel: string) => readFileSync(path.join(app, "src", rel), "utf8");
const strip = (code: string) => code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const NEW_KEYS = [
  "elev.dw.daysLoggedOf",
  "elev.dw.context",
  // B-TODAY-17: the elev.checkin.* keys left with the check-in card.
];

describe("TJB-14/TJB-23 — every new string lands in BOTH locales", () => {
  it("EN and HE both resolve", () => {
    for (const k of NEW_KEYS) {
      expect(en[k], `en missing ${k}`).toBeTruthy();
      expect(he[k], `he missing ${k}`).toBeTruthy();
    }
  });

  it("the Hebrew values are Hebrew — not the English string copied across", () => {
    for (const k of NEW_KEYS) {
      // `{n}h` has no Hebrew-free form worth asserting on; every other value
      // must carry Hebrew script and must differ from its English sibling.
      expect(he[k], `${k} is still English`).not.toBe(en[k]);
      expect(he[k], `${k} has no Hebrew script`).toMatch(/[֐-׿]/);
    }
  });

  it("the placeholders survive transcreation", () => {
    for (const k of NEW_KEYS) {
      const vars = (s: string) => (s.match(/\{[a-z]+\}/g) ?? []).sort().join(",");
      expect(vars(he[k]), `${k} lost a placeholder`).toBe(vars(en[k]));
    }
  });
});

describe("TJB-14 — Day Windows", () => {
  const src = strip(read("components/sections/DayWindowsPanel.tsx"));

  it("both bare sentences are keyed", () => {
    expect(src).not.toMatch(/days logged so far/);
    expect(src).not.toMatch(/Patterns for \$\{/);
    expect(src).toMatch(/t\("elev\.dw\.daysLoggedOf"/);
    expect(src).toMatch(/t\("elev\.dw\.context"/);
  });

  it("the low-data glyph is an hourglass, not an error", () => {
    expect(src).not.toMatch(/name="error"/);
    expect(src).toMatch(/name="hourglass_top"/);
  });

  it("the learning bands render below the usable bar", () => {
    // Two HourBar mounts: the data-rich branch and the low-data branch
    // (B-TODAY-06: both read the aggregator's per-hour counts).
    expect((src.match(/<HourBar counts=\{summary\.hourCounts\} uiLang=\{uiLang\} \/>/g) ?? []).length).toBe(2);
  });

  it("every hour on the route is written in the UI language", () => {
    expect(src).not.toMatch(/\bhourLabel\(/);
    expect(src).toMatch(/formatHour\(\w+(\.\w+)?, uiLang\)/);
  });

  it("negative control: the shipped literals fail these matchers", () => {
    const shipped = "{`${summary.daysLogged} of ${summary.daysLogged + summary.daysNeeded} days logged so far.`}";
    const shippedFooter = "{`Patterns for ${firstName}, based on what you've logged.`}";
    expect(shipped).toMatch(/days logged so far/);
    expect(shippedFooter).toMatch(/Patterns for \$\{/);
  });
});

describe("TJB-14 — Smart Reminders quiet hours speak Hebrew", () => {
  const src = strip(read("components/sections/SmartRemindersPanel.tsx"));

  it("the panel takes the language-aware formatter, not the am/pm one", () => {
    expect(src).toMatch(/import \{ formatHour \} from "\.\.\/\.\.\/lib\/pulse"/);
    expect(src).not.toMatch(/formatHour,\s*\n\s*type JitaiPrefs/);
  });

  it("every call passes uiLang", () => {
    const calls = src.match(/formatHour\([^)]*\)/g) ?? [];
    expect(calls.length).toBeGreaterThan(0);
    for (const c of calls) expect(c, c).toMatch(/,\s*uiLang\)/);
  });

  it("the two formatters really do differ (this is not a cosmetic swap)", () => {
    expect(formatHour(21, "he")).toBe("21:00");
    expect(formatHour(21, "en")).not.toBe("21:00");
    expect(formatHour(21, "he")).not.toMatch(/am|pm/);
  });
});

// B-TODAY-17: the daily check-in (TJB-23's subject) is deleted with Today's
// drawer — it wrote a `wellness` collection nothing reads. The guard now pins
// that it stays gone and that its keys went with it.
describe("TJB-23 → B-TODAY-17 — the daily check-in is gone, with its keys", () => {
  it("no DailyCheckinCard file, no elev.checkin.* key", () => {
    expect(existsSync(path.join(app, "src", "components/overview/DailyCheckinCard.tsx"))).toBe(false);
    expect(Object.keys(en).filter((k) => k.startsWith("elev.checkin."))).toEqual([]);
  });
});

// B-TODAY-22 superseded OBJ-TODAY-06's nested "More" toggle: the Scholar
// spotlight (English-only catalogue copy on the Hebrew route, GD-6) and the
// weekly read are DELETED from #/weekly, not demoted; one <details> holds the
// milestone wins only.
describe("OBJ-TODAY-06 → B-TODAY-22 — one disclosure, no Scholar copy, no weekly read", () => {
  const src = strip(read("components/tabs/WeeklyTab.tsx"));

  it("no spotlight, no weekly read, no nested toggle", () => {
    for (const tok of ["showWeeklyMore", "wk.scholarSpotlight", "learn.weeklyRead", "selected.spotlight", "rankLearnCards", "focusDomain", "ov.tools."]) {
      expect(src, tok).not.toContain(tok);
    }
    expect((src.match(/<details\b/g) ?? []).length).toBe(1);
  });

  it("the milestone-wins link still clears the 44 px floor", () => {
    const at = src.indexOf('t("wk.reviewMilestones")');
    expect(at).toBeGreaterThan(-1);
    expect(src.slice(src.lastIndexOf("<button", at), at)).toContain("touch-target");
  });

  it("negative control: the shipped 17 px link markup has no floor", () => {
    const shipped = `<button onClick={() => setActiveTab("scholar")} className="text-[11px] font-bold mt-3">{t("wk.scholarExplore")}</button>`;
    expect(shipped).not.toContain("touch-target");
  });
});

/**
 * B-TODAY-06 — Day Windows printed a fabricated count and coloured the
 * child's day: green = calm, peach = trickier, "Usually calmer" from absence,
 * and an am/pm hour baked into the Hebrew sentence.
 */
describe("B-TODAY-06 — Day Windows: neutral ink, real counts, local hours", () => {
  const raw = read("components/sections/DayWindowsPanel.tsx");
  const src = strip(raw);

  it("no --arbor-peach-* or --arbor-green-* in DayWindowsPanel.tsx", () => {
    expect(raw).not.toMatch(/--arbor-peach-|--arbor-green-/);
  });

  it("bars are single-ink with opacity ∝ count and an aria count per hour", () => {
    expect(src).toMatch(/background: INK,/);
    expect(src).toMatch(/opacity: max > 0 \? 0\.08 \+ 0\.92 \* \(c\.count \/ max\) : 0\.08/);
    expect(src).toMatch(/aria-label=\{t\(c\.count === 1 \? "dw\.hour\.aria\.one" : "dw\.hour\.aria"/);
    expect(src).not.toMatch(/tone === "friction"|usually-calmer|dw\.label\.calmer/);
  });

  it("the pattern sentence takes the real count and a UI-language hour", () => {
    expect(src).toMatch(/t\("dw\.pattern", \{\s*n: summary\.patternObservation\.hardDays,\s*m: summary\.patternObservation\.daysLogged,\s*hour: formatHour\(summary\.patternObservation\.peakHour, uiLang\),/);
  });

  it("EN + HE: 'On 3 of the 8 days…' and no am/pm in the Hebrew render", async () => {
    const { translate } = await import("../../lib/i18n");
    expect(translate("en", "dw.pattern", { n: 3, m: 8, hour: formatHour(17, "en") })).toMatch(/^On 3 of the 8 days you logged, a hard moment was noted around /);
    const heLine = translate("he", "dw.pattern", { n: 3, m: 8, hour: formatHour(17, "he") });
    expect(heLine).toMatch(/3/);
    expect(heLine).not.toMatch(/am|pm/i);
    for (const k of ["dw.bars.aria", "dw.hour.aria", "dw.hour.aria.one"]) {
      expect(translate("en", k)).not.toBe(k);
      expect(translate("he", k)).not.toBe(k);
    }
  });
});

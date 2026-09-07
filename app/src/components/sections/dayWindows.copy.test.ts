import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
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
  "elev.wk.more.title",
  "elev.checkin.title",
  "elev.checkin.mood",
  "elev.checkin.moodAria",
  "elev.checkin.sleep",
  "elev.checkin.sleepValue",
  "elev.checkin.sleepAria",
  "elev.checkin.appetite",
  "elev.checkin.appetite.good",
  "elev.checkin.appetite.ok",
  "elev.checkin.appetite.poor",
  "elev.checkin.saved",
  "elev.checkin.hint",
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
    // Two HourBar mounts: the data-rich branch and the low-data branch.
    expect((src.match(/<HourBar bands=\{vizBands\} uiLang=\{uiLang\} \/>/g) ?? []).length).toBe(2);
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

describe("TJB-23 — the daily check-in has a translator", () => {
  const src = strip(read("components/overview/DailyCheckinCard.tsx"));

  it("it uses useLanguage and no bare English label survives", () => {
    expect(src).toMatch(/useLanguage\(\)/);
    for (const literal of ["Today&apos;s check-in", ">Mood<", ">Appetite<", "Saved for today", "pattern insights"]) {
      expect(src, `bare literal still present: ${literal}`).not.toContain(literal);
    }
  });

  it("the appetite chips read from keys, not the raw enum value", () => {
    expect(src).toMatch(/t\(`elev\.checkin\.appetite\.\$\{a\}`\)/);
    // `capitalize` was doing the English-only prettifying of the enum.
    expect(src).not.toMatch(/capitalize/);
  });

  it("the footer no longer promises pattern insights the app does not compute", () => {
    expect(en["elev.checkin.hint"]).not.toMatch(/pattern|insight/i);
    expect(en["elev.checkin.saved"]).not.toMatch(/pattern|insight/i);
  });

  it("negative control: the shipped markup fails the translator check", () => {
    const shipped = `<Icon name="favorite" size={14} /> Today&apos;s check-in`;
    expect(shipped).toContain("Today&apos;s check-in");
  });
});

describe("OBJ-TODAY-06 — the weekly secondary modules are demoted", () => {
  const src = strip(read("components/tabs/WeeklyTab.tsx"));

  it("Scholar and the weekly read sit behind the disclosure, not in the default read", () => {
    expect(src).toMatch(/showWeeklyMore/);
    const gate = src.indexOf("showWeeklyMore && (");
    expect(gate).toBeGreaterThan(-1);
    // Both demoted cards live AFTER the gate; milestone wins stays before it.
    expect(src.indexOf('t("wk.scholarSpotlight")')).toBeGreaterThan(gate);
    expect(src.indexOf('t("learn.weeklyRead")')).toBeGreaterThan(gate);
    expect(src.indexOf('t("wk.milestoneWins"')).toBeLessThan(gate);
  });

  it("the disclosure reuses Today's Show/Hide verbs — no second vocabulary", () => {
    expect(src).toMatch(/t\("ov\.tools\.hide"\) : t\("ov\.tools\.show"\)/);
    expect(en["elev.wk.more.title"]).toBeTruthy();
  });

  it("the three secondary links clear the 44 px floor", () => {
    for (const key of ["wk.reviewMilestones", "wk.scholarExplore", "learn.readCard"]) {
      const at = src.indexOf(`t("${key}")`);
      expect(at, `${key} not found`).toBeGreaterThan(-1);
      // the button opening tag immediately before the label carries touch-target
      const openTag = src.lastIndexOf("<button", at);
      expect(src.slice(openTag, at), `${key} link is still under 44 px`).toContain("touch-target");
    }
    expect(src).toMatch(/aria-expanded=\{showWeeklyMore\}[\s\S]{0,80}/);
    expect(src).toMatch(/onClick=\{\(\) => setShowWeeklyMore/);
  });

  it("negative control: the shipped 17 px link markup has no floor", () => {
    const shipped = `<button onClick={() => setActiveTab("scholar")} className="text-[11px] font-bold mt-3">{t("wk.scholarExplore")}</button>`;
    expect(shipped).not.toContain("touch-target");
  });
});

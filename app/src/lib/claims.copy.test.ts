/**
 * ENG-07 / AI-19 · OBJ-GROWTH-07 · RUN-10 · OBJ-TODAY-07 · RUN-18 (item 20) —
 * six sentences the app could not back.
 *
 * Each named a mechanism that does not exist:
 *   1. Learn why-lines claimed "your Development Map" at zero milestones —
 *      `devScore.focusDomain` is set for a day-0 profile too, because "room to
 *      grow" is measured against the catalogue, not against what was noticed.
 *   2. The Routines footer chip said "Feeds the Development Map" on a surface
 *      whose own contract declares `threadWrite: "none"`.
 *   3. Masterclasses said "Our first lessons are in production; here's what's
 *      coming." beside ten live courses.
 *   4. Weekly's empty state said the report "will build itself"; it builds when
 *      the parent taps the header button.
 *   5. Journal's eyebrow said "The journal that writes itself".
 *   6. The weekly-email opt-in said "you're on the list"; nothing is POSTed.
 *
 * Retired strings are asserted absent from BOTH dictionaries — a claim removed
 * in English and left standing in Hebrew is still shipped.
 */
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { en, he, translate, type UiLang } from "./i18n";
import { en as recapEn, he as recapHe } from "./i18nElevation/recap";
import { devMapHasSignal, focusDomainContributed } from "../learn/todaysPick";
import { SURFACE_CONTRACTS } from "./surfaceContract";

const LANGS: UiLang[] = ["en", "he"];
const SRC = path.resolve(__dirname, "..");
const read = (rel: string) => fs.readFileSync(path.join(SRC, rel), "utf8");

/** Every string a parent can be shown, from both base dictionaries and the
 *  elevation module that owns the recap copy. */
const allCopy = (): string[] => [
  ...Object.values(en), ...Object.values(he),
  ...Object.values(recapEn), ...Object.values(recapHe),
];

const RETIRED = [
  "in production",           // masterclasses
  "will build itself",       // weekly empty state
  "writes itself",           // journal eyebrow
  "on the list",             // weekly email opt-in
  "בהפקה",
  "ייבנה מעצמו",
  "שכותב את עצמו",
  "ברשימה",
];

describe("1 · the retired claims are gone from BOTH dictionaries", () => {
  it("no shipped string contains a retired claim", () => {
    const copy = allCopy();
    const offenders = RETIRED.flatMap((needle) => copy.filter((s) => s.includes(needle)).map((s) => `${needle} → ${s}`));
    expect(offenders).toEqual([]);
  });

  it("the four replaced keys still say something, in both languages", () => {
    for (const key of ["sec.master.sub", "journal.eyebrow", "elev.wk.emptyThisWeek", "elev.recap.email.soon"]) {
      for (const lang of LANGS) {
        const s = translate(lang, key);
        expect(s, `${lang}:${key}`).not.toBe(key);
        expect(s.length).toBeGreaterThan(10);
      }
    }
  });

  it("negative control: the retired sentences are still detectable as strings", () => {
    // Proves the needles are the right ones — each matches the sentence it
    // was written for, so the scan above is not passing on a typo'd needle.
    expect("Our first lessons are in production; here's what's coming.").toContain("in production");
    expect("log a moment and this week's report will build itself.").toContain("will build itself");
    expect("The journal that writes itself").toContain("writes itself");
    expect("Coming soon — you're on the list.").toContain("on the list");
    expect("השיעורים הראשונים בהפקה").toContain("בהפקה");
  });
});

describe("2 · the Development-Map claim is re-derived, never asserted", () => {
  const featuredWithFocus = [{ domains: ["language_communication"] }, { domains: ["sleep"] }];

  it("day 0: a focus domain exists, and the claim is still refused", () => {
    // devScore sets focusDomain from the CATALOGUE (lowest score with room to
    // grow), so a brand-new profile has one while having noticed nothing.
    const dayZero = { focusDomain: "language_communication", domains: [{ reached: 0 }, { reached: 0 }] };
    expect(dayZero.focusDomain).toBeTruthy();
    expect(devMapHasSignal(dayZero)).toBe(false);
    expect(focusDomainContributed(dayZero, featuredWithFocus)).toBe(false);
  });

  it("with one milestone noticed the claim is allowed — if the domain carries a shown card", () => {
    const seeded = { focusDomain: "language_communication", domains: [{ reached: 1 }, { reached: 0 }] };
    expect(devMapHasSignal(seeded)).toBe(true);
    expect(focusDomainContributed(seeded, featuredWithFocus)).toBe(true);
    // A focus domain that moved nothing on screen still cannot be named.
    expect(focusDomainContributed(seeded, [{ domains: ["motor"] }])).toBe(false);
  });

  it("a null / absent score never produces a claim", () => {
    expect(devMapHasSignal(null)).toBe(false);
    expect(devMapHasSignal({})).toBe(false);
    expect(focusDomainContributed({ focusDomain: null, domains: [{ reached: 4 }] }, featuredWithFocus)).toBe(false);
  });

  it("negative control: the shipped expression claimed the map from focusDomain alone", () => {
    const dayZero = { focusDomain: "language_communication", domains: [{ reached: 0 }] };
    expect(Boolean(dayZero.focusDomain)).toBe(true);           // the shipped test
    expect(focusDomainContributed(dayZero, featuredWithFocus)).toBe(false); // the fixed one
    // …and the library reads the fixed one.
    const lib = read("components/sections/LearnLibrary.tsx");
    expect(lib).toContain("focusDomainContributed(score, featured)");
    expect(lib).not.toMatch(/score\.focusDomain && logsContributed \?/);
  });
});

describe("3 · Routines claims no write path it does not have", () => {
  it("the surface declares threadWrite none, and the chip that contradicted it is gone", () => {
    const contract = SURFACE_CONTRACTS.find((c) => c.route === "routines");
    expect(contract?.threadWrite).toBe("none");
    const tab = read("components/tabs/RoutinesTab.tsx");
    expect(tab).not.toContain('t("routines.feeds")');
  });

  it("negative control: the claim is gone from the dictionary too, not just unmounted", () => {
    // An unmounted key is a chip waiting to be re-mounted. `routines.feeds` no
    // longer resolves in either language, so re-introducing it is a visible
    // decision rather than a one-line import.
    for (const lang of LANGS) expect(translate(lang, "routines.feeds")).toBe("routines.feeds");
    // The sentence itself is still recognisable — the needle is right.
    expect("Feeds the Development Map").toContain("Development Map");
  });
});

describe("4 · Weekly's empty state offers the move instead of describing it", () => {
  const tab = read("components/tabs/WeeklyTab.tsx");

  it("the empty state carries a 44 px Log-a-moment control wired to QuickLogModal", () => {
    expect(tab).toContain('data-testid="weekly-log-a-moment"');
    expect(tab).toContain('t("elev.wk.logMoment")');
    expect(tab).toContain("<QuickLogModal open={logOpen}");
    const btn = /data-testid="weekly-log-a-moment"[\s\S]{0,400}?<\/button>/.exec(tab)?.[0] ?? "";
    expect(btn).toContain("minHeight: 44");
  });

  it("negative control: the promise key is gone, and the honest sibling stayed", () => {
    // `wk.emptyThisWeek` was the sentence, so the key went with it — in both
    // languages. `wk.noReports` never made a false claim and is untouched, so
    // this is a retirement, not a blanket rewrite of the empty states.
    for (const lang of LANGS) expect(translate(lang, "wk.emptyThisWeek")).toBe("wk.emptyThisWeek");
    expect(tab).not.toContain('t("wk.emptyThisWeek")');
    expect(translate("en", "wk.noReports")).toContain("No reports yet");
    expect(tab).toContain('t("wk.noReports")');
  });
});

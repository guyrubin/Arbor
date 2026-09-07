/**
 * ENG-07 / AI-19 · OBJ-GROWTH-07 · RUN-10 · OBJ-TODAY-07 · RUN-18 (item 20) ·
 * ENG-03 — seven sentences the app could not back.
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
 *   7. The paywall + Settings sold Arbor Family as "a seat for a co-parent" /
 *      "a co-parent seat to share the account". The only family-over-plus gate
 *      is `coParentSeats: 1`, and all it buys is ONE share grant — a read-only,
 *      scope-exact, revocable packet. No second adult ever enters the account.
 *
 * Retired strings are asserted absent from BOTH dictionaries — a claim removed
 * in English and left standing in Hebrew is still shipped.
 */
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { en, he, translate, type UiLang } from "./i18n";
import { en as recapEn, he as recapHe } from "./i18nElevation/recap";
import { en as planEn, he as planHe } from "./i18nElevation/planclarity";
import { PLAN_LIMITS } from "../server/entitlements";
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
  // ENG-03: the paywall's plan bullets live in their own module (PaywallModal
  // and PlanBadge import it directly), so a claim could sit there and never be
  // seen by this scan. It is in the corpus now.
  ...Object.values(planEn), ...Object.values(planHe),
];

const RETIRED = [
  "in production",           // masterclasses
  "will build itself",       // weekly empty state
  "writes itself",           // journal eyebrow
  "on the list",             // weekly email opt-in
  // ENG-03 — the Family "seat". Family grants ONE co-parent share grant, and
  // that grant is a read-only, scope-exact, revocable packet. Nobody gets a
  // seat in the account: no second sign-in, no writing, no shared session.
  "a seat for a co-parent",
  "seat to share the account",
  "בהפקה",
  "ייבנה מעצמו",
  "שכותב את עצמו",
  "ברשימה",
  "מושב להורה שותף",
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
    expect("Everything in Plus, plus a seat for a co-parent").toContain("a seat for a co-parent");
    expect("Everything in Plus, plus a co-parent seat to share the account.").toContain("seat to share the account");
    expect("כל מה שבפלוס, בתוספת מושב להורה שותף").toContain("מושב להורה שותף");
  });
});

/**
 * ENG-03 — the Family plan describes the thing the server actually grants.
 *
 * `PLAN_LIMITS.family.coParentSeats = 1` is the ONLY family-over-plus gate, and
 * all it unlocks is `POST /shares` with `role: "co_parent"`. What the invited
 * adult then receives is `GET /shared/:grantId/packet`: a read-only, scope-exact
 * packet, server-enforced expiry, revocable by the owner. "A seat for a
 * co-parent" and "a co-parent seat to share the account" both promise a second
 * adult inside the account — a sign-in, a session, the ability to write. No such
 * thing exists, at either price.
 */
describe("5 · the Family plan promises one co-parent invite, not a seat", () => {
  it("the seat is the only thing Family adds — and it is a share grant", () => {
    expect(PLAN_LIMITS.family.coParentSeats).toBe(1);
    expect(PLAN_LIMITS.plus.coParentSeats).toBe(0);
    // Everything else Family "adds" is already in Plus, which is exactly why
    // this one bullet had to carry the difference honestly.
    expect(PLAN_LIMITS.family.maxChildren).toBe(PLAN_LIMITS.plus.maxChildren);
    expect(PLAN_LIMITS.family.coachMessagesPerDay).toBe(PLAN_LIMITS.plus.coachMessagesPerDay);
  });

  it("both surfaces name the invite and its limits, in both languages", () => {
    for (const s of [planEn["elev.plan.family.1"], en["set.plan.familyDesc"]]) {
      expect(s).toMatch(/co-parent invite/);
      expect(s).toMatch(/read-only/);
      expect(s).toMatch(/revoke|revocable/);
      expect(s).not.toMatch(/\bseat\b/);
    }
    for (const s of [planHe["elev.plan.family.1"], he["set.plan.familyDesc"]]) {
      expect(s).toContain("הזמנה אחת");
      expect(s).toContain("צפייה בלבד");
      expect(s).toContain("לבטל");
      expect(s).not.toContain("מושב");
    }
  });

  it("no future tense: the copy never sells what has not shipped", () => {
    // The rejected alternative was "the family plan when it launches". A plan
    // a parent is being charged for today may not be described in the future.
    for (const s of [planEn["elev.plan.family.1"], en["set.plan.familyDesc"]]) {
      expect(s).not.toMatch(/when it launches|coming soon|will be|soon\b/i);
    }
    for (const s of [planHe["elev.plan.family.1"], he["set.plan.familyDesc"]]) {
      expect(s).not.toMatch(/בקרוב|כשי|יושק/);
    }
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

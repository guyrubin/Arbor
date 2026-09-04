/**
 * ENG-L4 — the day-30 keepsake: the window, the spine slot, and the copy law.
 *
 * The failure this file exists to prevent is not a crash. It is a card that
 * says something untrue about a parent's first month:
 *   · counting weeks five and six as part of "your first month" (a late
 *     render reading an all-time total);
 *   · putting a number on screen that can FALL between two renders — the
 *     rolling week count, or the band-windowed noticed count, either of which
 *     turns a keepsake into a verdict;
 *   · congratulating a parent who kept almost nothing, or noting that they
 *     kept almost nothing;
 *   · captioning the shared card "{name}'s progress this month", which is what
 *     the growth_card artifact fallback says and what nobody claimed.
 *
 * Scan discipline (this repo has been bitten by vacuous scans): every rule
 * carries a NEGATIVE CONTROL built from the shape it bans, so a reverted fix
 * fails here rather than passing silently.
 */
import { describe, expect, it } from "vitest";
import {
  FIRST_MONTH_DAYS,
  buildFirstMonthKeepsake,
} from "./firstMonthKeepsake";
import {
  FIRST_MONTH_DAY,
  FIRST_MONTH_MIN_MOMENTS,
  FIRST_WEEK_DAY,
  FIRST_WEEK_MIN_MOMENTS,
  LIFECYCLE_LOSS_FRAME_BANS,
  resolveLifecycle,
  type LifecycleInput,
} from "./lifecycle";
import { resolveCaptionKey } from "./shareCaption";
import { en as l4En, he as l4He } from "./i18nElevation/firstMonth";
import { en as lifecycleEn, he as lifecycleHe } from "./i18nElevation/lifecycle";
import { elevationEn, elevationHe } from "./i18nElevation";
import { en as baseEn } from "./i18n";

/* ── Local-time fixtures, built from components so the suite is TZ-independent. */
const at = (y: number, m: number, d: number, h = 9) => new Date(y, m - 1, d, h).getTime();
const iso = (y: number, m: number, d: number, h = 9) => new Date(y, m - 1, d, h).toISOString();

/** Onboarding on 1 August 2026; day N is 1 August + N. */
const ANCHOR = iso(2026, 8, 1, 8);
const onDay = (n: number, h = 12) => iso(2026, 8, 1 + n, h);

describe("the first-month window is CLOSED — it cannot grow with the render date", () => {
  it("counts day 0 through day 29 and stops", () => {
    const built = buildFirstMonthKeepsake({
      onboardingCompletedAt: ANCHOR,
      timestamps: [onDay(0), onDay(1), onDay(29)],
    });
    expect(built.hasWindow).toBe(true);
    expect(built.momentsKept).toBe(3);
    expect(built.daysWritten).toBe(3);
  });

  it("day 30 and later are OUTSIDE the first month", () => {
    const built = buildFirstMonthKeepsake({
      onboardingCompletedAt: ANCHOR,
      timestamps: [onDay(30), onDay(44), onDay(400)],
    });
    expect(built.momentsKept).toBe(0);
    expect(built.tone).toBe("quiet");
  });

  it("NEGATIVE CONTROL — an all-time total would over-count a LATE render", () => {
    // The parent's first open after onboarding is week six. `counts.total` on
    // the resolved moment is every capture ever, so a card that rendered it
    // under "your first month" would count weeks five and six as well.
    const stamps = [onDay(2), onDay(9), onDay(33), onDay(41)];
    const naiveAllTime = stamps.length;
    const built = buildFirstMonthKeepsake({ onboardingCompletedAt: ANCHOR, timestamps: stamps });
    expect(naiveAllTime).toBe(4);
    expect(built.momentsKept).toBe(2);
    expect(built.momentsKept).not.toBe(naiveAllTime);
  });

  it("a render on day 45 reports exactly what a render on day 30 reported", () => {
    // The build takes no clock at all, which is the mechanism: there is no
    // `now` for a later render to widen the window with.
    const stamps = [onDay(0), onDay(3), onDay(3, 20), onDay(28)];
    const first = buildFirstMonthKeepsake({ onboardingCompletedAt: ANCHOR, timestamps: stamps });
    const later = buildFirstMonthKeepsake({
      onboardingCompletedAt: ANCHOR,
      timestamps: [...stamps, onDay(31), onDay(44)],
    });
    expect(later.momentsKept).toBe(first.momentsKept);
    expect(later.daysWritten).toBe(first.daysWritten);
  });

  it("the window length is the day the spine fires on — one constant, not two", () => {
    expect(FIRST_MONTH_DAYS).toBe(FIRST_MONTH_DAY);
  });
});

describe("the two numbers are counts of what the PARENT did, and neither can fall", () => {
  it("daysWritten is DISTINCT days, so three entries in one evening is one day", () => {
    const built = buildFirstMonthKeepsake({
      onboardingCompletedAt: ANCHOR,
      timestamps: [onDay(4, 8), onDay(4, 13), onDay(4, 21)],
    });
    expect(built.momentsKept).toBe(3);
    expect(built.daysWritten).toBe(1);
  });

  it("adding a moment never lowers either number (monotone inside the window)", () => {
    const before = buildFirstMonthKeepsake({
      onboardingCompletedAt: ANCHOR,
      timestamps: [onDay(2)],
    });
    const after = buildFirstMonthKeepsake({
      onboardingCompletedAt: ANCHOR,
      timestamps: [onDay(2), onDay(7)],
    });
    expect(after.momentsKept).toBeGreaterThanOrEqual(before.momentsKept);
    expect(after.daysWritten).toBeGreaterThanOrEqual(before.daysWritten);
  });

  it("NEGATIVE CONTROL — the counts the card is NOT allowed to use really do fall", () => {
    // This is why the card derives its own numbers instead of rendering the
    // resolver's. `counts.week` is a rolling seven-day figure: the SAME rows,
    // a week later, are a smaller number. A card that showed it would print a
    // falling count next to "your first month".
    const rows = [onDay(2), onDay(3)];
    const rollingWeek = (nowMs: number) =>
      rows.filter((r) => Date.parse(r) >= nowMs - 7 * 86_400_000).length;
    expect(rollingWeek(at(2026, 8, 6))).toBe(2);
    expect(rollingWeek(at(2026, 8, 20))).toBe(0);
    // The window count, over the same rows, is stable.
    expect(buildFirstMonthKeepsake({ onboardingCompletedAt: ANCHOR, timestamps: rows }).momentsKept).toBe(2);
  });

  it("a stamp from during onboarding itself clamps into day 0 and still counts", () => {
    const built = buildFirstMonthKeepsake({
      onboardingCompletedAt: ANCHOR,
      timestamps: [iso(2026, 8, 1, 7)],
    });
    expect(built.momentsKept).toBe(1);
    expect(built.daysWritten).toBe(1);
  });

  it("unparseable stamps are ignored, never counted as day 0", () => {
    const built = buildFirstMonthKeepsake({
      onboardingCompletedAt: ANCHOR,
      timestamps: ["not-a-date", "", Number.NaN, onDay(5)],
    });
    expect(built.momentsKept).toBe(1);
  });

  it("accepts epoch milliseconds as well as ISO strings", () => {
    const built = buildFirstMonthKeepsake({
      onboardingCompletedAt: ANCHOR,
      timestamps: [at(2026, 8, 3), at(2026, 8, 3, 22)],
    });
    expect(built.momentsKept).toBe(2);
    expect(built.daysWritten).toBe(1);
  });
});

describe("honest at zero — and honest when there is no window at all", () => {
  it("an empty first month is 'quiet', not a zero to be congratulated or corrected", () => {
    const built = buildFirstMonthKeepsake({ onboardingCompletedAt: ANCHOR, timestamps: [] });
    expect(built.tone).toBe("quiet");
    expect(built.momentsKept).toBe(0);
    expect(built.hasWindow).toBe(true);
  });

  it("exactly one kept thing is 'kept' — the floor is one, not a threshold on effort", () => {
    const built = buildFirstMonthKeepsake({ onboardingCompletedAt: ANCHOR, timestamps: [onDay(11)] });
    expect(built.tone).toBe("kept");
    expect(built.momentsKept).toBe(1);
    expect(built.daysWritten).toBe(1);
  });

  it("a missing or corrupt anchor is 'no window', never a confident zero", () => {
    for (const anchor of [null, undefined, "", "not-a-date"]) {
      const built = buildFirstMonthKeepsake({ onboardingCompletedAt: anchor, timestamps: [onDay(1)] });
      expect(built.hasWindow, `anchor ${String(anchor)}`).toBe(false);
      expect(built.momentsKept).toBe(0);
    }
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   The spine slot
   ═══════════════════════════════════════════════════════════════════════════ */
const NOW = at(2026, 9, 4);

const base: LifecycleInput = {
  onboardingCompletedAt: iso(2026, 9, 4, 8),
  previousVisitAt: iso(2026, 9, 3, 9),
  birthDate: null,
  ageMonths: 40,
  band: "preschool",
  recordedBand: "preschool",
  interestCount: 2,
  totalMoments: 0,
  weekMoments: 0,
  noticedMilestones: 0,
  seen: [],
  now: NOW,
};
const resolve = (patch: Partial<LifecycleInput> = {}) => resolveLifecycle({ ...base, ...patch });
/** An account exactly `day` days old at NOW. */
const aged = (day: number) => iso(2026, 9, 4 - day, 8);

describe("ENG-L4 — the first-month moment", () => {
  const month = { onboardingCompletedAt: aged(FIRST_MONTH_DAY), totalMoments: 4 };

  it(`fires on day ${FIRST_MONTH_DAY}, and not a day before`, () => {
    expect(resolve(month).moment?.kind).toBe("first-month");
    expect(resolve({ ...month, onboardingCompletedAt: aged(FIRST_MONTH_DAY - 1) }).moment?.kind)
      .not.toBe("first-month");
  });

  it("does not fire with nothing kept at all", () => {
    expect(resolve({ ...month, totalMoments: FIRST_MONTH_MIN_MOMENTS - 1 }).moment?.kind)
      .not.toBe("first-month");
  });

  it("fires at the floor of one kept thing", () => {
    expect(resolve({ ...month, totalMoments: FIRST_MONTH_MIN_MOMENTS }).moment?.kind).toBe("first-month");
  });

  it("happens exactly once, ever", () => {
    const m = resolve(month).moment!;
    expect(m.key).toBe("first-month");
    expect(resolve({ ...month, seen: [m.key] }).moment?.kind).not.toBe("first-month");
  });

  it("never fires for a LEGACY account — a five-year customer has no knowable first month", () => {
    expect(resolve({ onboardingCompletedAt: null, totalMoments: 40 }).moment?.kind)
      .not.toBe("first-month");
  });

  it("outranks the first-week keepsake when both are still unshown, and the week follows", () => {
    const bothArmed = {
      onboardingCompletedAt: aged(FIRST_MONTH_DAY + 12),
      totalMoments: Math.max(FIRST_WEEK_MIN_MOMENTS, FIRST_MONTH_MIN_MOMENTS) + 2,
      weekMoments: 1,
    };
    const first = resolve(bothArmed).moment!;
    expect(first.kind).toBe("first-month");
    expect(resolve({ ...bothArmed, seen: [first.key] }).moment?.kind).toBe("first-week");
  });

  it("still yields to a lapse, a birthday and a band change — priority is unchanged above it", () => {
    const armed = {
      onboardingCompletedAt: aged(FIRST_MONTH_DAY + 1),
      totalMoments: 6,
      previousVisitAt: iso(2026, 8, 1),
      birthDate: "2022-09-04",
      band: "early-school",
      recordedBand: "preschool",
    };
    const seen: string[] = [];
    const order: string[] = [];
    for (let i = 0; i < 6; i++) {
      const m = resolve({ ...armed, seen: [...seen] }).moment;
      if (!m) break;
      order.push(m.kind);
      seen.push(m.key);
    }
    expect(order.slice(0, 4)).toEqual(["welcome-back", "birthday", "age-band", "first-month"]);
  });

  it(`day ${FIRST_WEEK_DAY} is unaffected: ENG-L3 still owns the first week`, () => {
    expect(
      resolve({ onboardingCompletedAt: aged(FIRST_WEEK_DAY), totalMoments: FIRST_WEEK_MIN_MOMENTS })
        .moment?.kind,
    ).toBe("first-week");
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   Copy law
   ═══════════════════════════════════════════════════════════════════════════ */
/** The elev.lifecycle.* keys ENG-L4 added to the shared lifecycle dictionary. */
const MONTH_CHROME_KEYS = [
  "elev.lifecycle.month.eyebrow",
  "elev.lifecycle.month.title",
  "elev.lifecycle.month.body",
  "elev.lifecycle.month.cta",
] as const;

describe("ENG-L4 copy is registered, bilingual and complete", () => {
  it("EN and HE cover exactly the same keys, none empty", () => {
    expect(Object.keys(l4En).length).toBeGreaterThan(5);
    expect(Object.keys(l4En).sort()).toEqual(Object.keys(l4He).sort());
    for (const [key, value] of Object.entries({ ...l4En, ...l4He })) {
      expect(value.trim().length, `${key} is empty`).toBeGreaterThan(0);
    }
  });

  it("every key reaches the MERGED dictionaries — an unregistered module renders raw keys", () => {
    for (const key of Object.keys(l4En)) {
      expect(elevationEn[key], `${key} missing from merged EN`).toBe(l4En[key]);
      expect(elevationHe[key], `${key} missing from merged HE`).toBe(l4He[key]);
    }
    for (const key of MONTH_CHROME_KEYS) {
      expect(elevationEn[key], `${key} missing from merged EN`).toBeTruthy();
      expect(elevationHe[key], `${key} missing from merged HE`).toBeTruthy();
    }
  });

  it("the Hebrew is really Hebrew, not the English copied across", () => {
    for (const key of Object.keys(l4He)) {
      expect(l4He[key], `${key} has no Hebrew letters`).toMatch(/[֐-׿]/);
      expect(l4He[key], `${key} is identical to the English`).not.toBe(l4En[key]);
    }
    for (const key of MONTH_CHROME_KEYS) {
      expect(lifecycleHe[key], `${key} has no Hebrew letters`).toMatch(/[֐-׿]/);
      expect(lifecycleHe[key]).not.toBe(lifecycleEn[key]);
    }
  });

  it("the card's month chrome keys off the same elev.lifecycle prefix as every other kind", () => {
    for (const key of MONTH_CHROME_KEYS) {
      expect(lifecycleEn[key], `${key} missing from the lifecycle dictionary`).toBeTruthy();
      expect(key.startsWith("elev.lifecycle.")).toBe(true);
    }
  });
});

describe("clinical firewall — a first month is not a verdict on the child", () => {
  const BANNED: ReadonlyArray<{ id: string; re: RegExp }> = [
    { id: "percent", re: /%|\bpercent\b|אחוז/i },
    { id: "score", re: /\bscore\b|\brating\b|\blevel\b|ניקוד|ציון/i },
    { id: "verdict", re: /\bon[\s-]?track\b|\bahead\b|\bbehind\b|\bdelay(ed)?\b|פיגור|תקין/i },
    { id: "streak", re: /\bstreak\b|\bin a row\b|רצף/i },
    { id: "progress-claim", re: /\bprogress\b|\bimproved?\b|\bgrowth of\b|התקדמות|השתפר/i },
    { id: "comparison", re: /\bother (?:children|families|parents)\b|\baverage\b|\btypical\b|ממוצע/i },
    { id: "delta", re: /\bmore than last\b|\bup from\b|\bcompared (?:to|with)\b|לעומת/i },
    { id: "target", re: /\bgoal of\b|\bshould have\b|\btry to\b|\bonly \{n\}\b/i },
  ];

  it("NEGATIVE CONTROL: the ban list catches the copy a growth app would write here", () => {
    const wouldBe = [
      "You logged 4 moments — 60% of a typical first month",
      "{name}'s progress this month",
      "Only {n} days — try to beat it next month",
      "Your 12-day streak",
      "ההתקדמות של {name} החודש",
      "רק 2 ימים לעומת החודש הקודם",
    ];
    for (const s of wouldBe) {
      expect(BANNED.some((r) => r.re.test(s)), s).toBe(true);
    }
  });

  it("no ENG-L4 string in either language trips any of them", () => {
    const hits: string[] = [];
    const dicts: ReadonlyArray<[string, Record<string, string>]> = [
      ["l4.en", l4En],
      ["l4.he", l4He],
    ];
    for (const [name, dict] of dicts) {
      for (const [key, value] of Object.entries(dict)) {
        for (const rule of BANNED) if (rule.re.test(value)) hits.push(`${name}.${key} [${rule.id}]: ${value}`);
      }
    }
    for (const key of MONTH_CHROME_KEYS) {
      for (const rule of BANNED) {
        if (rule.re.test(lifecycleEn[key])) hits.push(`en.${key} [${rule.id}]`);
        if (rule.re.test(lifecycleHe[key])) hits.push(`he.${key} [${rule.id}]`);
      }
    }
    expect(hits, "firewall breach on the day-30 keepsake").toEqual([]);
  });

  it("carries no loss frame either — the shared ENG-L5 ban list applies here too", () => {
    const hits: string[] = [];
    for (const dict of [l4En, l4He]) {
      for (const [key, value] of Object.entries(dict)) {
        for (const rule of LIFECYCLE_LOSS_FRAME_BANS) {
          if (rule.re.test(value)) hits.push(`${key} [${rule.id}]: ${value}`);
        }
      }
    }
    expect(hits).toEqual([]);
  });

  it("the quiet line neither congratulates nor corrects", () => {
    const quiet = l4En["elev.l4.quiet"];
    expect(quiet.length).toBeGreaterThan(20);
    // No praise for something that did not happen…
    expect(quiet).not.toMatch(/\bwell done\b|\bgreat\b|\bamazing\b|\bproud\b|\bachieved?\b/i);
    // …and no correction for it either.
    expect(quiet).not.toMatch(/\bshould\b|\btry\b|\bstart\b|\bmissed\b|\bempty\b|\bnothing yet\b/i);
    // It also states no number, because there is no number worth stating.
    expect(quiet).not.toMatch(/\{n\}|\d/);
  });
});

describe("the shared card is captioned honestly, never as a month of progress", () => {
  it("the explicit key wins over the growth_card fallback", () => {
    expect(
      resolveCaptionKey({
        artifact: "growth_card",
        surface: "l4_first_month",
        captionKey: "elev.l4.share.caption",
      }),
    ).toBe("elev.l4.share.caption");
  });

  it("NEGATIVE CONTROL — without the explicit key this surface claims PROGRESS", () => {
    const inherited = resolveCaptionKey({ artifact: "growth_card", surface: "l4_first_month" });
    expect(inherited).toBe("share.caption.growth");
    // The exact sentence the explicit key exists to avoid.
    expect(baseEn[inherited]).toMatch(/progress this month/i);
  });

  it("the ENG-L4 caption says what was KEPT, and claims nothing else", () => {
    expect(l4En["elev.l4.share.caption"]).toMatch(/kept with/i);
    expect(l4En["elev.l4.share.caption"]).not.toMatch(/progress|made with|by arbor/i);
    expect(l4En["elev.l4.share.caption"]).toContain("{url}");
    expect(l4He["elev.l4.share.caption"]).toContain("{url}");
  });
});

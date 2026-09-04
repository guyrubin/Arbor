import { describe, it, expect, beforeEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  BIRTHDAY_WINDOW_DAYS,
  FIRST_WEEK_DAY,
  FIRST_WEEK_MIN_MOMENTS,
  INTEREST_ASK_DAY,
  LAPSE_DAYS,
  LIFECYCLE_LOSS_FRAME_BANS,
  calendarDaysBetween,
  daysSinceBirthday,
  lifecycleDay,
  resolveLifecycle,
  type LifecycleInput,
} from "./lifecycle";
import {
  LIFECYCLE_NAMESPACE,
  markLifecycleSeen,
  readLifecycleLedger,
  recordLifecycleBand,
} from "./lifecycleState";
import { isChildScopedKey } from "./childLocalState";
import { en as lifecycleEn, he as lifecycleHe } from "./i18nElevation/lifecycle";
import { elevationEn, elevationHe } from "./i18nElevation";

/**
 * ENG-09 — the lifecycle spine.
 *
 * Before this module `onboardingCompletedAt` had ZERO readers: it was written
 * once at the end of onboarding and never looked at again, so Today was the
 * same screen on day 1 and day 40. These tests pin the spine that reads it —
 * the day arithmetic, the ONE-moment-per-open priority, the once-per-occurrence
 * ledger — plus the two rules the copy must obey: never a loss frame (ENG-L5),
 * and never a claim that something was sent (there is no push, email or
 * local-notification path in this app).
 *
 * Behavioural first. The only source scans are the two rules a behaviour test
 * cannot express, and each carries a negative control proving the scan catches
 * the shape it bans, plus a truthiness guard on the extracted text so a CRLF
 * or a moved file cannot make the scan pass vacuously.
 */

/* ── Local-time fixtures. Every date is built from components, never parsed
      from a "…Z" string, so the whole suite is timezone-independent. ──────── */
const at = (y: number, m: number, d: number, h = 9) => new Date(y, m - 1, d, h).getTime();
const iso = (y: number, m: number, d: number, h = 9) => new Date(y, m - 1, d, h).toISOString();

const NOW = at(2026, 9, 4);

const base: LifecycleInput = {
  onboardingCompletedAt: iso(2026, 9, 4, 8),
  previousVisitAt: null,
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

/* ═══════════════════════════════════════════════════════════════════════════
   Day arithmetic — the reader `onboardingCompletedAt` never had
   ═══════════════════════════════════════════════════════════════════════════ */
describe("lifecycleDay — the anchor finally has a reader", () => {
  it("counts CALENDAR days, so a 23:40 signup is day 1 the next morning", () => {
    expect(lifecycleDay(iso(2026, 9, 3, 23), at(2026, 9, 4, 7))).toBe(1);
    // Elapsed-hours arithmetic would say 0 here — that is the bug this avoids.
    expect((at(2026, 9, 4, 7) - at(2026, 9, 3, 23)) / 86_400_000).toBeLessThan(1);
  });

  it("day 0 is the day of onboarding itself", () => {
    expect(lifecycleDay(iso(2026, 9, 4, 8), NOW)).toBe(0);
  });

  it("a MISSING anchor is null, never 0 — a legacy account is not a new one", () => {
    expect(lifecycleDay(undefined, NOW)).toBeNull();
    expect(lifecycleDay(null, NOW)).toBeNull();
    expect(lifecycleDay("not-a-date", NOW)).toBeNull();
    expect(resolve({ onboardingCompletedAt: null }).stage).toBe("established");
  });

  it("never returns a negative day for a clock that ran backwards", () => {
    expect(lifecycleDay(iso(2026, 9, 10), NOW)).toBe(0);
    expect(calendarDaysBetween(iso(2026, 9, 10), NOW)).toBe(0);
  });
});

describe("stage", () => {
  const cases: Array<[number, string]> = [
    [0, "day-zero"],
    [1, "first-week"],
    [6, "first-week"],
    [7, "first-month"],
    [29, "first-month"],
    [30, "established"],
  ];
  for (const [day, stage] of cases) {
    it(`day ${day} → ${stage}`, () => {
      expect(resolve({ onboardingCompletedAt: iso(2026, 9, 4 - day, 8) }).stage).toBe(stage);
    });
  }

  it("a lapse outranks every other stage", () => {
    expect(resolve({ previousVisitAt: iso(2026, 8, 1) }).stage).toBe("lapsed");
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   ENG-L5 / ENG-20(a) — the return after a lapse
   ═══════════════════════════════════════════════════════════════════════════ */
describe("ENG-L5 — welcome back, never a loss frame", () => {
  const lapsed = {
    onboardingCompletedAt: iso(2026, 6, 1),
    previousVisitAt: iso(2026, 8, 15),
    totalMoments: 12,
    weekMoments: 0,
    noticedMilestones: 4,
  };

  it("fires at exactly the lapse threshold, and not a day before", () => {
    const away = (days: number) =>
      resolve({ ...lapsed, previousVisitAt: iso(2026, 9, 4 - days, 9) }).moment?.kind ?? null;
    expect(away(LAPSE_DAYS)).toBe("welcome-back");
    expect(away(LAPSE_DAYS + 30)).toBe("welcome-back");
    expect(away(LAPSE_DAYS - 1)).not.toBe("welcome-back");
    expect(away(1)).not.toBe("welcome-back");
  });

  it("carries the child's age and the parent's counts — the only numbers it may show", () => {
    const m = resolve({ ...lapsed, ageMonths: 41 }).moment!;
    expect(m.kind).toBe("welcome-back");
    expect(m.ageMonths).toBe(41);
    expect(m.counts).toEqual({ total: 12, week: 0, noticed: 4 });
  });

  it("the daysAway figure CHOOSES the moment but is never part of it", () => {
    const state = resolve(lapsed);
    expect(state.daysAway).toBeGreaterThanOrEqual(LAPSE_DAYS);
    // Nothing in the moment payload can be rendered as "you were gone N days":
    // the payload is exactly a kind, an occurrence key, three counts and an age.
    expect(Object.keys(state.moment!)).toEqual(["kind", "key", "counts", "ageMonths"]);
    const numbers = [
      state.moment!.counts.total,
      state.moment!.counts.week,
      state.moment!.counts.noticed,
      state.moment!.ageMonths,
    ];
    expect(numbers).not.toContain(state.daysAway);
    // And the resolver still HAS the figure — it just refuses to hand it over.
    expect(state.daysAway).toBe(20);
  });

  it("one lapse produces one welcome: the key is the return DATE", () => {
    const first = resolve(lapsed).moment!;
    expect(resolve({ ...lapsed, seen: [first.key] }).moment?.kind).not.toBe("welcome-back");
  });

  it("outranks a birthday, a band change and the day-3 ask", () => {
    const m = resolve({
      ...lapsed,
      birthDate: "2022-09-04",
      band: "early-school",
      recordedBand: "preschool",
      interestCount: 0,
    }).moment!;
    expect(m.kind).toBe("welcome-back");
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   ENG-20(b)/(c) — the child's calendar
   ═══════════════════════════════════════════════════════════════════════════ */
describe("ENG-20(b) — birthdays no longer pass silently", () => {
  it("daysSinceBirthday is timezone-safe (the YYYY-MM-DD is split by hand)", () => {
    // `new Date("2022-09-04")` is UTC midnight = 3 Sep in every negative offset.
    expect(daysSinceBirthday("2022-09-04", at(2026, 9, 4, 0))).toBe(0);
    expect(daysSinceBirthday("2022-09-04", at(2026, 9, 4, 23))).toBe(0);
    expect(daysSinceBirthday("2022-09-03", at(2026, 9, 4, 9))).toBe(1);
  });

  it("stays offerable for a few days, then stops", () => {
    const kind = (d: number) =>
      resolve({ birthDate: "2022-09-04", now: at(2026, 9, 4 + d, 9) }).moment?.kind ?? null;
    for (let d = 0; d <= BIRTHDAY_WINDOW_DAYS; d++) expect(kind(d)).toBe("birthday");
    expect(kind(BIRTHDAY_WINDOW_DAYS + 1)).not.toBe("birthday");
  });

  it("does not fire before the birthday has happened this year", () => {
    expect(daysSinceBirthday("2022-12-25", at(2026, 9, 4))).toBeNull();
    expect(resolve({ birthDate: "2022-12-25" }).moment).toBeNull();
  });

  it("does not fire before the child was born", () => {
    expect(daysSinceBirthday("2027-01-04", at(2026, 9, 4))).toBeNull();
  });

  it("a 29 February child still gets a birthday in a common year (28 Feb)", () => {
    // Skipping it three years in four is the alternative; the card lands on the
    // last day of February instead.
    expect(daysSinceBirthday("2024-02-29", at(2026, 2, 28, 9))).toBe(0);
    expect(daysSinceBirthday("2024-02-29", at(2026, 3, 1, 9))).toBe(1);
    // And on a real leap year it lands on the day itself.
    expect(daysSinceBirthday("2024-02-29", at(2028, 2, 29, 9))).toBe(0);
  });

  it("is keyed by YEAR, so it can recur next year but not this week", () => {
    const m = resolve({ birthDate: "2022-09-04" }).moment!;
    expect(m.key).toBe("birthday.2026");
    expect(resolve({ birthDate: "2022-09-04", seen: [m.key] }).moment).toBeNull();
    expect(resolve({ birthDate: "2022-09-04", seen: [m.key], now: at(2027, 9, 4) }).moment?.key)
      .toBe("birthday.2027");
  });
});

describe("ENG-20(c) — an age-band change is noticed", () => {
  it("fires when the recorded band differs from the current one", () => {
    const m = resolve({ band: "early-school", recordedBand: "preschool" }).moment!;
    expect(m.kind).toBe("age-band");
    expect(m.key).toBe("age-band.early-school");
  });

  it("a FIRST sighting is not a transition (no recorded band → nothing)", () => {
    // Otherwise every brand-new parent is greeted with "moved into a new stage"
    // about a child who has not moved.
    expect(resolve({ band: "preschool", recordedBand: null }).moment).toBeNull();
  });

  it("no change, no moment", () => {
    expect(resolve({ band: "preschool", recordedBand: "preschool" }).moment).toBeNull();
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   ENG-L0 / L1 / L2 / L3 — the designed first month
   ═══════════════════════════════════════════════════════════════════════════ */
describe("ENG-L0 — the first captured moment", () => {
  it("fires on day 0 once one thing is captured", () => {
    const m = resolve({ totalMoments: 1, weekMoments: 1 }).moment!;
    expect(m.kind).toBe("first-moment");
    expect(m.counts.total).toBe(1);
  });

  it("never fires before the first capture — day 0 with no data stays bare", () => {
    expect(resolve({ totalMoments: 0 }).moment).toBeNull();
  });

  it("stops being offered after day 1", () => {
    expect(
      resolve({ onboardingCompletedAt: iso(2026, 9, 2, 8), totalMoments: 1 }).moment?.kind,
    ).not.toBe("first-moment");
  });
});

describe("ENG-L1 — day one, framed forward", () => {
  const d1 = { onboardingCompletedAt: iso(2026, 9, 3, 8) };

  it("fires on day 1", () => {
    expect(resolve(d1).moment?.kind).toBe("day-one");
  });

  it("yields to the first-moment payoff when the parent already captured", () => {
    expect(resolve({ ...d1, totalMoments: 1 }).moment?.kind).toBe("first-moment");
  });

  it("is a one-off: day 2 says nothing", () => {
    expect(resolve({ onboardingCompletedAt: iso(2026, 9, 2, 8) }).moment).toBeNull();
  });
});

describe("ENG-L2 — tell Arbor one thing they love", () => {
  const day3 = { onboardingCompletedAt: iso(2026, 9, 4 - INTEREST_ASK_DAY, 8), interestCount: 0 };

  it(`fires from day ${INTEREST_ASK_DAY}, not before`, () => {
    expect(resolve(day3).moment?.kind).toBe("interest-ask");
    expect(
      resolve({ onboardingCompletedAt: iso(2026, 9, 3, 8), interestCount: 0 }).moment?.kind,
    ).not.toBe("interest-ask");
  });

  it("is never asked again once ANY interest is recorded (profile is server state)", () => {
    expect(resolve({ ...day3, interestCount: 1 }).moment).toBeNull();
  });

  it("is offered to established accounts that never answered", () => {
    expect(resolve({ onboardingCompletedAt: null, interestCount: 0 }).moment?.kind).toBe("interest-ask");
  });

  it("is dismissible, and stays dismissed", () => {
    expect(resolve({ ...day3, seen: ["interest-ask"] }).moment).toBeNull();
  });
});

describe("ENG-L3 — the first-week keepsake", () => {
  const week = {
    onboardingCompletedAt: iso(2026, 9, 4 - FIRST_WEEK_DAY, 8),
    totalMoments: FIRST_WEEK_MIN_MOMENTS,
    weekMoments: 3,
    noticedMilestones: 2,
  };

  it("fires on day 7 with enough captured to be a keepsake OF", () => {
    const m = resolve(week).moment!;
    expect(m.kind).toBe("first-week");
    expect(m.counts).toEqual({ total: 3, week: 3, noticed: 2 });
  });

  it("does not fire with too little to show", () => {
    expect(resolve({ ...week, totalMoments: FIRST_WEEK_MIN_MOMENTS - 1 }).moment?.kind)
      .not.toBe("first-week");
  });

  it("does not fire before day 7", () => {
    expect(resolve({ ...week, onboardingCompletedAt: iso(2026, 9, 4 - 6, 8) }).moment?.kind)
      .not.toBe("first-week");
  });

  it("happens exactly once, ever", () => {
    expect(resolve({ ...week, seen: ["first-week"] }).moment).toBeNull();
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   The Rule-A contract: AT MOST ONE moment, ever
   ═══════════════════════════════════════════════════════════════════════════ */
describe("one moment per open", () => {
  it("returns a single moment even when every trigger is armed at once", () => {
    const state = resolve({
      onboardingCompletedAt: iso(2026, 9, 4 - FIRST_WEEK_DAY, 8),
      previousVisitAt: iso(2026, 8, 1),
      birthDate: "2022-09-04",
      band: "early-school",
      recordedBand: "preschool",
      interestCount: 0,
      totalMoments: 9,
    });
    expect(state.moment).not.toBeNull();
    expect(state.moment!.kind).toBe("welcome-back");
  });

  it("walks DOWN the priority list as each occurrence is retired", () => {
    const armed: Partial<LifecycleInput> = {
      onboardingCompletedAt: iso(2026, 9, 4 - FIRST_WEEK_DAY, 8),
      previousVisitAt: iso(2026, 8, 1),
      birthDate: "2022-09-04",
      band: "early-school",
      recordedBand: "preschool",
      interestCount: 0,
      totalMoments: 9,
    };
    const seen: string[] = [];
    const order: string[] = [];
    for (let i = 0; i < 6; i++) {
      const m = resolve({ ...armed, seen: [...seen] }).moment;
      if (!m) break;
      order.push(m.kind);
      seen.push(m.key);
    }
    expect(order).toEqual(["welcome-back", "birthday", "age-band", "first-week", "interest-ask"]);
  });

  it("an ordinary open in an ordinary week says nothing at all", () => {
    expect(resolve({ onboardingCompletedAt: iso(2026, 7, 1), previousVisitAt: iso(2026, 9, 3) }).moment)
      .toBeNull();
  });

  it("counts are clamped to zero — a card can never render a negative count", () => {
    const m = resolve({
      onboardingCompletedAt: iso(2026, 9, 3, 8),
      totalMoments: -3,
      weekMoments: -1,
      noticedMilestones: -5,
    }).moment!;
    expect(m.kind).toBe("day-one");
    expect(m.counts).toEqual({ total: 0, week: 0, noticed: 0 });
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   The ledger
   ═══════════════════════════════════════════════════════════════════════════ */
describe("lifecycleState — the already-said-that ledger", () => {
  /** The vitest env is node-only; the real Storage does not exist there. */
  function fakeStorage(seed: Record<string, string> = {}): Storage {
    const map = new Map(Object.entries(seed));
    return {
      get length() { return map.size; },
      key: (i: number) => [...map.keys()][i] ?? null,
      getItem: (k: string) => map.get(k) ?? null,
      setItem: (k: string, v: string) => void map.set(k, v),
      removeItem: (k: string) => void map.delete(k),
      clear: () => map.clear(),
    } as unknown as Storage;
  }

  let store: Storage;
  beforeEach(() => {
    store = fakeStorage();
  });

  it("uses the sweepable per-child key convention, so child deletion removes it", () => {
    markLifecycleSeen("child-1", "first-week", store);
    const keys: string[] = [];
    for (let i = 0; i < store.length; i++) keys.push(store.key(i)!);
    expect(keys).toContain(`arbor.${LIFECYCLE_NAMESPACE}.child-1`);
    // childLocalState's sweep finds a key only if it matches this shape.
    for (const k of keys) expect(isChildScopedKey(k, "child-1")).toBe(true);
  });

  it("remembers what was shown, and is idempotent", () => {
    markLifecycleSeen("child-1", "first-week", store);
    markLifecycleSeen("child-1", "first-week", store);
    expect(readLifecycleLedger("child-1", store).seen).toEqual(["first-week"]);
  });

  it("keeps children apart", () => {
    markLifecycleSeen("child-1", "first-week", store);
    expect(readLifecycleLedger("child-2", store).seen).toEqual([]);
  });

  it("records the band so the NEXT change is detectable", () => {
    recordLifecycleBand("child-1", "toddler", store);
    expect(readLifecycleLedger("child-1", store).band).toBe("toddler");
    recordLifecycleBand("child-1", "preschool", store);
    expect(readLifecycleLedger("child-1", store).band).toBe("preschool");
    // Marking a moment seen must not wipe the recorded band, and vice versa.
    markLifecycleSeen("child-1", "first-week", store);
    expect(readLifecycleLedger("child-1", store)).toEqual({ seen: ["first-week"], band: "preschool" });
  });

  it("survives corrupt storage as an empty ledger, never a throw", () => {
    const bad = fakeStorage({ [`arbor.${LIFECYCLE_NAMESPACE}.child-1`]: "{not json" });
    expect(readLifecycleLedger("child-1", bad)).toEqual({ seen: [], band: null });
    const wrongShape = fakeStorage({
      [`arbor.${LIFECYCLE_NAMESPACE}.child-1`]: JSON.stringify({ seen: "nope", band: 7 }),
    });
    expect(readLifecycleLedger("child-1", wrongShape)).toEqual({ seen: [], band: null });
  });

  it("a missing store is 'nothing remembered', never a crash", () => {
    expect(readLifecycleLedger("child-1", null)).toEqual({ seen: [], band: null });
    expect(() => markLifecycleSeen("child-1", "first-week", null)).not.toThrow();
  });

  it("a write that throws is swallowed — a full store never breaks the screen", () => {
    const full = fakeStorage();
    vi.spyOn(full, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    expect(() => markLifecycleSeen("child-1", "first-week", full)).not.toThrow();
  });

  it("feeds straight back into the resolver: a shown moment does not return", () => {
    const first = resolve({ totalMoments: 1 }).moment!;
    expect(first.kind).toBe("first-moment");
    markLifecycleSeen("child-1", first.key, store);
    const again = resolve({ totalMoments: 1, seen: readLifecycleLedger("child-1", store).seen }).moment;
    expect(again).toBeNull();
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   Copy law — the two rules a behaviour test cannot express
   ═══════════════════════════════════════════════════════════════════════════ */
describe("ENG-L5 copy law — no loss frame anywhere in the lifecycle dictionary", () => {
  it("NEGATIVE CONTROL: the ban list catches the copy habit-apps reach for", () => {
    const shipped = [
      "You missed 3 days — pick your streak back up",
      "It's been a while since you logged a moment",
      "You haven't captured anything this week",
      "Your 12-day streak was lost",
      "פספסת שלושה ימים",
      "הרצף שלך נשבר",
      "הרבה זמן שלא היית כאן",
    ];
    for (const s of shipped) {
      expect(LIFECYCLE_LOSS_FRAME_BANS.some((r) => r.re.test(s)), s).toBe(true);
    }
  });

  it("NEGATIVE CONTROL: the shipped welcome copy is NOT flagged", () => {
    for (const ok of [
      "Everything you kept is still here, exactly as you left it.",
      "כל מה ששמרתם נמצא כאן, בדיוק כמו שהשארתם.",
    ]) {
      expect(LIFECYCLE_LOSS_FRAME_BANS.filter((r) => r.re.test(ok)).map((r) => r.id)).toEqual([]);
    }
  });

  it("no EN or HE lifecycle value carries a loss frame", () => {
    const hits: string[] = [];
    for (const [dict, values] of [["en", lifecycleEn], ["he", lifecycleHe]] as const) {
      for (const [key, value] of Object.entries(values)) {
        for (const rule of LIFECYCLE_LOSS_FRAME_BANS) {
          if (rule.re.test(value)) hits.push(`${dict}.${key} [${rule.id}]: ${value}`);
        }
      }
    }
    expect(hits, "loss-frame copy on a re-engagement surface").toEqual([]);
  });
});

describe("no notification is implied — nothing is sent, ever", () => {
  // `@capacitor/local-notifications` is not a dependency, lib/push.ts is dead
  // without a VAPID key and RESEND_API_KEY is unset. Copy that says Arbor
  // reminded, pinged, emailed or notified anyone would be a lie.
  const SENT = /\b(we|arbor)\s+(sent|emailed|texted|notified|reminded|pinged)\b|\bnotification\b|\breminder we sent\b/i;
  const SENT_HE = /שלחנו|התראה ששלחנו|הודעה ששלחנו/;

  it("NEGATIVE CONTROL: the scan catches the claim it bans", () => {
    expect(SENT.test("We sent you a reminder yesterday")).toBe(true);
    expect(SENT.test("Arbor notified you at 8pm")).toBe(true);
    expect(SENT_HE.test("שלחנו לך תזכורת")).toBe(true);
  });

  it("no lifecycle string claims Arbor reached out", () => {
    for (const [key, value] of Object.entries(lifecycleEn)) {
      expect(SENT.test(value), `${key}: ${value}`).toBe(false);
    }
    for (const [key, value] of Object.entries(lifecycleHe)) {
      expect(SENT_HE.test(value), `${key}: ${value}`).toBe(false);
    }
  });
});

describe("the lifecycle dictionary is registered and complete", () => {
  const here = path.dirname(fileURLToPath(import.meta.url));

  it("EN and HE carry exactly the same keys, none empty", () => {
    expect(Object.keys(lifecycleEn).sort()).toEqual(Object.keys(lifecycleHe).sort());
    for (const [key, value] of Object.entries({ ...lifecycleEn, ...lifecycleHe })) {
      expect(value.trim().length, `${key} is empty`).toBeGreaterThan(0);
    }
  });

  it("every key is elev.*-namespaced (an unnamespaced key silently loses the merge)", () => {
    for (const key of Object.keys(lifecycleEn)) expect(key.startsWith("elev.lifecycle.")).toBe(true);
  });

  it("the module is REGISTERED — an unregistered module dodges the firewall scan", () => {
    const index = readFileSync(path.join(here, "i18nElevation", "index.ts"), "utf8").replace(/\r\n/g, "\n");
    expect(index.length).toBeGreaterThan(0);
    expect(index).toContain('from "./lifecycle"');
    // Registration means the merged dictionary actually carries the strings.
    for (const key of Object.keys(lifecycleEn)) {
      expect(elevationEn[key], `${key} missing from the merged EN dictionary`).toBe(lifecycleEn[key]);
      expect(elevationHe[key], `${key} missing from the merged HE dictionary`).toBe(lifecycleHe[key]);
    }
  });
});

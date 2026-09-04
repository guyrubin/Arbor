/**
 * TJB-28 — "Tomorrow's reason": the day closes with a return hook.
 *
 * WHAT SHIPPED: nothing. A parent's day in Arbor ended with no reason to come
 * back, and the only mechanism that could have carried one (a notification) has
 * no sender in any build (lib/pushPriming). These pin the in-app shape: ONE
 * concrete thing written at the close of a day, shown on a LATER day's open,
 * and shown once.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ROUTE_IDS } from "./routes";
import {
  chooseReason,
  clearStoredReason,
  closeDay,
  dayStamp,
  isDayClosing,
  markReasonSeen,
  reasonForThisOpen,
  reasonPresentation,
  readStoredReason,
  type DayCloseSignals,
  type ReasonKind,
} from "./tomorrowReason";

/** One child id for the whole file: the store is child-scoped, so a reason
 *  written for one child must never be readable as another's. */
const KID = "kid-a";
import { en, he } from "./i18nElevation/returnhooks";

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(path.join(here, rel), "utf8").replace(/\r\n/g, "\n");

function fakeStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() { return map.size; },
    key: (i: number) => [...map.keys()][i] ?? null,
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    clear: () => map.clear(),
  } as unknown as Storage;
}

/** Local-time constructors, because the day boundary is the parent's own. */
const at = (day: number, hour: number) => new Date(2026, 8, day, hour, 0, 0).getTime();
const EVENING = at(4, 20);
const NEXT_MORNING = at(5, 8);

const signals = (o: Partial<DayCloseSignals> = {}): DayCloseSignals => ({
  ritualDue: false,
  watchFocus: false,
  unopenedStory: false,
  momentsToday: 3,
  ...o,
});

beforeEach(() => {
  (globalThis as { localStorage?: Storage }).localStorage = fakeStorage();
  clearStoredReason(KID);
});

describe("TJB-28 — the close of a day", () => {
  it("NEGATIVE CONTROL: with nothing ever written there is no hook to show", () => {
    expect(readStoredReason(KID)).toBeNull();
    expect(reasonForThisOpen(KID, NEXT_MORNING)).toBeNull();
  });

  it("nothing is written before the closing hour", () => {
    expect(isDayClosing(at(4, 15))).toBe(false);
    expect(closeDay(KID, at(4, 15), signals())).toBeNull();
    expect(readStoredReason(KID)).toBeNull();
  });

  it("at the close of the day ONE reason is written down", () => {
    const written = closeDay(KID, EVENING, signals({ ritualDue: true }));
    expect(written).toBeTruthy();
    expect(written!.kind).toBe("ritual");
    expect(written!.setOn).toBe(dayStamp(EVENING));
  });

  it("re-opening later the same evening does not rewrite (or flip) it", () => {
    closeDay(KID, at(4, 19), signals({ ritualDue: true }));
    const again = closeDay(KID, at(4, 23), signals({ ritualDue: false, watchFocus: true }));
    expect(again!.kind).toBe("ritual");
    expect(readStoredReason(KID)!.kind).toBe("ritual");
  });

  it("picks by how concrete the next move is", () => {
    expect(chooseReason(signals({ ritualDue: true, watchFocus: true }))).toBe("ritual");
    expect(chooseReason(signals({ watchFocus: true, unopenedStory: true }))).toBe("focus");
    expect(chooseReason(signals({ unopenedStory: true }))).toBe("story");
    expect(chooseReason(signals({ momentsToday: 0 }))).toBe("moment");
    // The vacuous version of this test passed with momentsToday: 99, because
    // every other signal defaults to false and the field was never read.
    expect(chooseReason(signals({ momentsToday: 5 }))).toBeNull();
  });
});

describe("TJB-28 — the next open", () => {
  it("the reason does NOT show on the day it was written", () => {
    closeDay(KID, EVENING, signals({ unopenedStory: true }));
    expect(reasonForThisOpen(KID, at(4, 22))).toBeNull();
  });

  it("it shows on the next day's open", () => {
    closeDay(KID, EVENING, signals({ unopenedStory: true }));
    const shown = reasonForThisOpen(KID, NEXT_MORNING);
    expect(shown).toBeTruthy();
    expect(shown!.kind).toBe("story");
  });

  it("it shows ONCE — acting on it or putting it away ends it for the day", () => {
    closeDay(KID, EVENING, signals({ watchFocus: true }));
    expect(reasonForThisOpen(KID, NEXT_MORNING)).toBeTruthy();
    markReasonSeen(KID, NEXT_MORNING);
    expect(reasonForThisOpen(KID, NEXT_MORNING)).toBeNull();
    expect(reasonForThisOpen(KID, at(5, 21))).toBeNull();
  });

  it("a reason left unseen still carries to a later day", () => {
    closeDay(KID, EVENING, signals({ ritualDue: true }));
    expect(reasonForThisOpen(KID, at(8, 9))).toBeTruthy();
  });

  it("garbage in storage degrades to no hook, never a throw", () => {
    localStorage.setItem("arbor.tomorrowReason", "{not json");
    expect(readStoredReason(KID)).toBeNull();
    localStorage.setItem("arbor.tomorrowReason", '{"kind":"verdict","setOn":"2026-09-04"}');
    expect(readStoredReason(KID)).toBeNull();
  });
});

describe("TJB-28 — what the hook is allowed to say and where it goes", () => {
  const kinds: ReasonKind[] = ["ritual", "focus", "story", "moment"];

  it("every reason lands on a REGISTERED route (a hook that 404s is worse than none)", () => {
    for (const k of kinds) {
      expect((ROUTE_IDS as readonly string[]).includes(reasonPresentation(k).action), k).toBe(true);
    }
  });

  it("every reason's copy exists in EN and HE", () => {
    for (const k of kinds) {
      const p = reasonPresentation(k);
      for (const key of [p.titleKey, p.bodyKey, p.ctaKey]) {
        expect(en[key], `EN missing ${key}`).toBeTruthy();
        expect(he[key], `HE missing ${key}`).toBeTruthy();
      }
    }
    for (const key of ["elev.rh.tomorrow.eyebrow", "elev.rh.tomorrow.dismiss", "elev.rh.tomorrow.dismissAria"]) {
      expect(en[key]).toBeTruthy();
      expect(he[key]).toBeTruthy();
    }
  });

  it("no reason counts what was missed or grades anything", () => {
    for (const k of kinds) {
      const p = reasonPresentation(k);
      for (const key of [p.titleKey, p.bodyKey, p.ctaKey]) {
        expect(en[key]).not.toMatch(/\b(missed|streak|behind|on track|score)\b/i);
      }
    }
  });

  it("the record holds a kind and two day stamps — no child data", () => {
    closeDay(KID, EVENING, signals({ ritualDue: true }));
    markReasonSeen(KID, NEXT_MORNING);
    const parsed = JSON.parse(localStorage.getItem(`arbor.tomorrowReason.${KID}`)!) as Record<string, unknown>;
    expect(Object.keys(parsed).sort()).toEqual(["kind", "seenOn", "setOn"]);
  });

  it("a reason written for one child is never readable as a sibling's", () => {
    // The reason is derived from ONE child's signals (their watch focus, their
    // unopened book, their day). Under a single global key, closing the day on
    // one child and opening on a sibling handed the sibling the first child's
    // reason — and the key was not swept when that child was deleted.
    closeDay(KID, EVENING, signals({ ritualDue: true }));
    expect(readStoredReason(KID)).not.toBeNull();
    expect(readStoredReason("kid-b")).toBeNull();
    expect(reasonForThisOpen("kid-b", NEXT_MORNING)).toBeNull();
    // And the key is sweepable by lib/childLocalState on deletion.
    expect(localStorage.getItem(`arbor.tomorrowReason.${KID}`)).not.toBeNull();
    expect(`arbor.tomorrowReason.${KID}`.endsWith(`.${KID}`)).toBe(true);
  });
});

describe("TJB-28 — the hook is mounted, in-app, and sends nothing", () => {
  const growth = read("../components/tabs/DevelopmentTab.tsx");
  const card = read("../components/nextopen/TomorrowReasonCard.tsx");

  it("reads both files (a scan over an empty string proves nothing)", () => {
    expect(growth.length).toBeGreaterThan(2000);
    expect(card.length).toBeGreaterThan(1000);
  });

  it("Growth mounts the card with real close-of-day signals", () => {
    const mount = growth.match(/<TomorrowReasonCard[\s\S]{0,300}?\/>/)?.[0];
    expect(mount).toBeTruthy();
    expect(mount).toContain("signals=");
    expect(growth).toContain("returnSignals");
    // The signals are derived, not hard-coded to a constant.
    expect(growth).toMatch(/ritualDue:\s*ritualOfTheMoment\(/);
  });

  it("the shelf writes the close too — an evening usually ends there, not on Growth", () => {
    const shelf = read("../components/tabs/ComicsTab.tsx");
    expect(shelf.length).toBeGreaterThan(5000);
    expect(shelf).toContain("closeDay(childProfile.id, ");
    // It WRITES the hook; it never renders it (one display surface only).
    expect(shelf).not.toContain("<TomorrowReasonCard");
    const call = shelf.match(/closeDay\(childProfile\.id, now, \{[\s\S]{0,500}?\}\);/)?.[0];
    expect(call).toBeTruthy();
    for (const field of ["ritualDue:", "watchFocus:", "unopenedStory:", "momentsToday:"]) {
      expect(call, `close-of-day write missing ${field}`).toContain(field);
    }
  });

  it("the card runs BOTH halves — the close and the open", () => {
    expect(card).toContain("closeDay(childProfile.id, ");
    expect(card).toContain("reasonForThisOpen(childProfile.id, ");
    expect(card).toContain("markReasonSeen(childProfile.id, ");
  });

  it("nothing about the hook is a notification", () => {
    expect(card).not.toMatch(/registerPush|Notification\.|new Notification|serviceWorker/);
    expect(read("./tomorrowReason.ts")).not.toMatch(/registerPush|Notification\.|serviceWorker|fetch\(/);
  });
});

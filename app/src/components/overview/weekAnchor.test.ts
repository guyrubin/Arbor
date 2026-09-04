/**
 * ENG-24 — "the week has turned and last week is waiting".
 *
 * BEHAVIOUR tests on the decision, plus a scan proving the anchor card exists
 * and stays a DOOR (it must not become a second recap surface rendering facts
 * about the child on Today).
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  markWeekAnchorSeen,
  readWeekAnchorSeen,
  weekAnchorRecapDue,
  weekAnchorSeenKey,
} from "./weekAnchor";
import { isRecapUnopened, recapWeekId } from "../../hooks/useWeeklyRecap";
import { elevationEn, elevationHe } from "../../lib/i18nElevation/index";

/** Minimal in-memory Storage stand-in (the suite runs in `environment: "node"`). */
function fakeStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (k: string) => map.get(k) ?? null,
    key: (i: number) => [...map.keys()][i] ?? null,
    removeItem: (k: string) => void map.delete(k),
    setItem: (k: string, v: string) => void map.set(k, v),
  } as Storage;
}

describe("weekAnchorRecapDue — when the recap becomes the day's anchor", () => {
  it("is due when a fresh, unopened recap exists for a week never anchored", () => {
    expect(weekAnchorRecapDue({ weekId: "2026-W36", recapUnopened: true, anchorSeenWeekId: null })).toBe(true);
  });

  it("is NOT due once the parent dismissed the anchor for that same week", () => {
    expect(weekAnchorRecapDue({ weekId: "2026-W36", recapUnopened: true, anchorSeenWeekId: "2026-W36" })).toBe(false);
  });

  it("IS due again when a new week starts", () => {
    expect(weekAnchorRecapDue({ weekId: "2026-W37", recapUnopened: true, anchorSeenWeekId: "2026-W36" })).toBe(true);
  });

  it("is never due when the recap has already been opened", () => {
    expect(weekAnchorRecapDue({ weekId: "2026-W36", recapUnopened: false, anchorSeenWeekId: null })).toBe(false);
  });

  it("is never due without a resolvable week id", () => {
    expect(weekAnchorRecapDue({ weekId: "", recapUnopened: true, anchorSeenWeekId: null })).toBe(false);
  });

  it("reuses the app's ONE definition of 'a new recap is waiting'", () => {
    const weekId = recapWeekId(new Date(2026, 8, 4));
    expect(weekId).toBeTruthy();
    // isRecapUnopened is the existing since-strip decision; the anchor is that
    // decision plus the device-local dismissal, never a second derivation.
    expect(
      weekAnchorRecapDue({
        weekId,
        recapUnopened: isRecapUnopened(true, weekId, null),
        anchorSeenWeekId: null,
      }),
    ).toBe(true);
    expect(
      weekAnchorRecapDue({
        weekId,
        recapUnopened: isRecapUnopened(true, weekId, weekId),
        anchorSeenWeekId: null,
      }),
    ).toBe(false);
  });
});

describe("the dismissal marker is per child and survives a reload", () => {
  it("round-trips through storage", () => {
    const store = fakeStorage();
    expect(readWeekAnchorSeen("kid-1", store)).toBeNull();
    markWeekAnchorSeen("kid-1", "2026-W36", store);
    expect(readWeekAnchorSeen("kid-1", store)).toBe("2026-W36");
    expect(readWeekAnchorSeen("kid-2", store)).toBeNull();
  });

  it("keys per child", () => {
    expect(weekAnchorSeenKey("kid-1")).not.toBe(weekAnchorSeenKey("kid-2"));
  });

  it("never throws when storage is blocked", () => {
    const blocked = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    } as unknown as Storage;
    expect(() => markWeekAnchorSeen("kid-1", "2026-W36", blocked)).not.toThrow();
    expect(readWeekAnchorSeen("kid-1", blocked)).toBeNull();
  });
});

describe("ENG-24 — the anchor card is a door, not a second recap", () => {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const CARD = readFileSync(path.join(here, "WeekAnchorCard.tsx"), "utf8").replace(/\r\n/g, "\n");

  it("the card was actually read (extraction proven)", () => {
    expect(CARD.length).toBeGreaterThan(800);
  });

  it("opens the weekly surface and marks the week anchored", () => {
    expect(CARD).toContain('setActiveTab("weekly")');
    expect(CARD).toContain("markWeekAnchorSeen(childProfile.id, weekId)");
    expect(CARD).toContain('data-testid="today-week-anchor-open"');
    expect(CARD).toContain('data-testid="today-week-anchor-later"');
  });

  it("renders NOTHING about the child — no counts, no narrative, no verdict", () => {
    const code = CARD.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    expect(code).not.toMatch(/behaviorLogs|playLogs|milestones|digest|stats|streak/i);
    expect(code).not.toMatch(/%|\bscore\b|\bon[\s-]?track\b|\bbehind\b|\bdelay(ed)?\b/i);
  });

  it("keeps 44px targets on both controls", () => {
    const buttons = CARD.match(/data-testid="today-week-anchor-(open|later)"[\s\S]{0,400}?className="([^"]+)"/g) ?? [];
    expect(buttons.length).toBe(2);
    for (const b of buttons) expect(b).toContain("min-h-11");
  });
});

/**
 * WHY THE ANCHOR IS STILL UNMOUNTED (2026-09-04 review).
 *
 * The mount was re-examined on the view that "did the parent open last week's
 * recap?" is a REFINEMENT of a Monday nudge, not a precondition — and that the
 * device-local dismissal marker above should therefore be enough to mount the
 * card with no new Firestore subscription on Today.
 *
 * The dismissal half is indeed free, and so is the opened half: the recap's own
 * opened marker (`arbor.recap.opened.<childId>`, useWeeklyRecap) is already
 * localStorage. What is NOT free is EXISTENCE, and the shipped copy makes
 * existence a hard claim: the body says last week is "written up and waiting"
 * and the CTA says "Open last week". A weekly report is only ever generated
 * when the trailing week has at least one logged moment
 * (shouldAutoGenerateRecap), and useChildCollection mirrors to localStorage in
 * SANDBOX MODE ONLY — so a signed-in device holds no local copy to read. A
 * parent who logged nothing last week would be told a report is waiting and
 * land on an empty Weekly surface.
 *
 * Softening the copy to fit what Today knows was explicitly ruled out. So the
 * card stays unmounted until Today has a real recap signal, and this guard
 * makes that conditional rather than permanent: mount it the day the signal is
 * there, and this test passes.
 */
describe("ENG-24 — the anchor may only be mounted WITH a real recap signal", () => {
  const OVERVIEW = readFileSync(
    path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "tabs", "OverviewTab.tsx"),
    "utf8",
  )
    .replace(/\r\n/g, "\n")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

  it("the Today hub source was actually read", () => {
    expect(OVERVIEW.length).toBeGreaterThan(20_000);
    expect(OVERVIEW).toContain("export default function OverviewTab");
  });

  it("the copy really does claim a written report is waiting", () => {
    // If this ever fails, the copy has been softened — which is the one way to
    // mount the card that was ruled out. Re-read the note above before editing.
    expect(elevationEn["elev.waveR.recap.body"]).toMatch(/written up and waiting/i);
    expect(elevationEn["elev.waveR.recap.cta"]).toMatch(/open last week/i);
    expect(elevationHe["elev.waveR.recap.body"]).toMatch(/כתוב ומחכה/);
  });

  it("Today never renders the anchor without a recap signal in the same file", () => {
    const mounts = /<WeekAnchorCard|weekAnchorRecapDue\(/.test(OVERVIEW);
    const hasSignal = /useWeeklyRecap\(|recapUnopened/.test(OVERVIEW);
    expect(
      !mounts || hasSignal,
      "OverviewTab mounts the week anchor but derives no recap signal. The card claims " +
        'last week is "written up and waiting"; without a real report that claim is false ' +
        "and the CTA lands the parent on an empty Weekly surface.",
    ).toBe(true);
  });

  it("NEGATIVE CONTROL — the guard fires on a mount with no signal", () => {
    const bad = "return <WeekAnchorCard weekId={recapWeekId()} />;";
    expect(/<WeekAnchorCard|weekAnchorRecapDue\(/.test(bad)).toBe(true);
    expect(/useWeeklyRecap\(|recapUnopened/.test(bad)).toBe(false);
    // …and passes once the signal is genuinely there.
    const good = "const recap = useWeeklyRecap();\n  return <WeekAnchorCard weekId={recap.currentId} />;";
    expect(/useWeeklyRecap\(|recapUnopened/.test(good)).toBe(true);
  });
});

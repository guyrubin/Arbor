/**
 * The Learn-hub why-line may name only signals that MOVED the winning card.
 *
 * `todaysLearnPick` already re-derived the concerns claim by rescoring the
 * winner with `recentConcerns: []`, "so the why-line can never overstate". The
 * hub did not hold the focus-domain claim to that standard: Masterclasses fell
 * through to "chosen for {name}'s age and the area you have been exploring"
 * whenever `devScore.focusDomain` was merely SET. A focus domain of "language"
 * and a winning card about sleep made that sentence plainly false, on a surface
 * whose own firewall note promises the opposite.
 *
 * Behaviour is pinned below on synthetic shelves (so the assertion does not
 * move when the real catalogue is edited), and the mount is pinned by a source
 * scan with a negative control against the pre-change expression.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { LearnCard, LearnRankSignals } from "./learnLibrary";
import { todaysLearnPick, devMapHasSignal, focusDomainContributed } from "./todaysPick";

const CHILD = "child-why";
const DAY = "2026-09-04";

const card = (id: string, domains: string[], over: Partial<LearnCard> = {}): LearnCard => ({
  id,
  category: "sleep",
  domains,
  ageMin: 0,
  ageMax: 18,
  minutes: 3,
  title: { en: id, he: id },
  hook: { en: id, he: id },
  keyPoints: [],
  body: { en: id, he: id },
  tryToday: { en: id, he: id },
  ask: { en: id, he: id },
  concerns: [],
  ...over,
});

const signals = (over: Partial<LearnRankSignals> = {}): LearnRankSignals => ({
  ageYears: 4,
  focusDomain: null,
  ...over,
});

describe("fromFocus is re-derived, not asserted", () => {
  it("true only when the WINNING card carries the focus domain", () => {
    const shelf = [card("focus-hit", ["language_communication"]), card("other", ["motor"])];
    const pick = todaysLearnPick(shelf, signals({ focusDomain: "language_communication" }), {
      childId: CHILD,
      dayKey: DAY,
    });
    expect(pick).toBeTruthy();
    // +3 for the domain match makes this card the unambiguous winner.
    expect(pick!.card.id).toBe("focus-hit");
    expect(pick!.fromFocus).toBe(true);
  });

  it("FALSE when a focus domain is set but the winner does not share it", () => {
    // This is the exact defect: focusDomain is set, so the old hub claimed
    // "the area you have been exploring" — but no card on the shelf carries it,
    // so the focus domain contributed nothing to the winner's score.
    const shelf = [card("a", ["motor"]), card("b", ["social_emotional"])];
    const pick = todaysLearnPick(shelf, signals({ focusDomain: "language_communication" }), {
      childId: CHILD,
      dayKey: DAY,
    });
    expect(pick).toBeTruthy();
    expect(pick!.card.domains).not.toContain("language_communication");
    expect(pick!.fromFocus).toBe(false);
  });

  it("false when there is no focus domain at all", () => {
    const shelf = [card("a", ["language_communication"])];
    const pick = todaysLearnPick(shelf, signals({ focusDomain: null }), { childId: CHILD, dayKey: DAY });
    expect(pick!.fromFocus).toBe(false);
  });

  it("negative control — the sibling flags are unaffected and still honest", () => {
    const shelf = [card("a", ["language_communication"])];
    const pick = todaysLearnPick(shelf, signals({ focusDomain: "language_communication" }), {
      childId: CHILD,
      dayKey: DAY,
    });
    // No concerns logged and nothing saved: those two claims must stay false
    // even though fromFocus is true, or the flags are not independent.
    expect(pick!.fromFocus).toBe(true);
    expect(pick!.fromConcerns).toBe(false);
    expect(pick!.fromSaved).toBe(false);
  });
});

/* ── The hub actually reads the re-derived flag ───────────────────────────── */

const here = path.dirname(fileURLToPath(import.meta.url));
const HUB = readFileSync(
  path.join(here, "..", "components", "sections", "Masterclasses.tsx"),
  "utf8",
).replace(/\r\n/g, "\n");

/** The pre-change why-line, verbatim — the negative control. */
const PRE_CHANGE = `
  const pickWhy = !todaysRead
    ? ""
    : todaysRead.fromSaved
      ? t("elev.learnCare.pick.why.saved")
      : todaysRead.fromConcerns
        ? t("elev.learnCare.pick.why.logs")
        : devScore.focusDomain
          ? t("elev.learnCare.pick.why.focus", { name: childName })
          : t("elev.learnCare.pick.why.age", { name: childName });
`.replace(/\r\n/g, "\n");

const WHY_BLOCK = /const pickWhy = !todaysRead[\s\S]*?why\.age", \{ name: childName \}\);/;
const FOCUS_FROM_PICK = /todaysRead\.fromFocus\s*\n?\s*\?\s*t\("elev\.learnCare\.pick\.why\.focus"/;
const FOCUS_FROM_RAW_SIGNAL = /:\s*devScore\.focusDomain\s*\n?\s*\?\s*t\("elev\.learnCare\.pick\.why\.focus"/;

describe("Masterclasses gates the focus why-line on the re-derived flag", () => {
  it("the source was really read", () => {
    expect(HUB.length).toBeGreaterThan(2000);
    expect(HUB).toContain("export default function Masterclasses");
    expect(WHY_BLOCK.exec(HUB), "why-line block not found").toBeTruthy();
  });

  it("the focus branch reads todaysRead.fromFocus", () => {
    expect(FOCUS_FROM_PICK.exec(HUB)).toBeTruthy();
    expect(FOCUS_FROM_PICK.exec(PRE_CHANGE), "negative control").toBeNull();
  });

  it("the focus branch no longer reads the raw devScore signal", () => {
    expect(FOCUS_FROM_RAW_SIGNAL.exec(HUB)).toBeNull();
    // Negative control: the matcher does fire on the pre-change source, so a
    // null result above means "absent", not "unmatchable".
    expect(FOCUS_FROM_RAW_SIGNAL.exec(PRE_CHANGE)).toBeTruthy();
  });

  it("devScore.focusDomain is still fed to the RANKER (only the claim moved)", () => {
    expect(HUB).toMatch(/focusDomain:\s*devScore\.focusDomain/);
  });
});

/**
 * ENG-07 (item 20) — the SAME standard, applied to the Learn Library's rail.
 *
 * `todaysPickWhy` fixed the Masterclasses hero. The Library's why-line
 * (LearnLibrary.tsx:249-260) was still reading `devScore.focusDomain` raw, and
 * that signal is set for a day-0 profile: `focusDomain` is the lowest-scoring
 * domain with room to grow, and "room to grow" is measured against the
 * catalogue, not against what the parent has actually noticed. So a parent with
 * zero milestones and zero logs was told their reading list came from "your
 * Development Map".
 */
describe("ENG-07 · the Library why-line falls to the age variant at zero data", () => {
  const featured = [{ domains: ["language_communication"] }, { domains: ["sleep"] }];

  it("zero milestones → no map claim, even though focusDomain is set", () => {
    const dayZero = { focusDomain: "language_communication", domains: [{ reached: 0 }, { reached: 0 }] };
    expect(dayZero.focusDomain).toBeTruthy();
    expect(devMapHasSignal(dayZero)).toBe(false);
    expect(focusDomainContributed(dayZero, featured)).toBe(false);
  });

  it("one noticed milestone plus a matching shown card → the claim is true and allowed", () => {
    const seeded = { focusDomain: "language_communication", domains: [{ reached: 1 }] };
    expect(focusDomainContributed(seeded, featured)).toBe(true);
  });

  it("negative control: the shipped condition was truthiness of focusDomain alone", () => {
    const dayZero = { focusDomain: "language_communication", domains: [{ reached: 0 }] };
    expect(Boolean(dayZero.focusDomain)).toBe(true);
    expect(focusDomainContributed(dayZero, featured)).toBe(false);
    const lib = readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "../components/sections/LearnLibrary.tsx"), "utf8");
    expect(lib).toContain("focusDomainContributed(score, featured)");
    expect(lib).not.toMatch(/:\s*score\.focusDomain \? t\("learn\.whyFull"/);
  });
});

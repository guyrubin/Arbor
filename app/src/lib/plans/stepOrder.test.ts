/**
 * B-ASKJB-35 (b) — the step-order guard: an observation step is never the
 * first thing a plan asks for. Fixture = Guy's live plan step 1 (REVIEW-
 * PRODUCTION §4 F): "Observe and log specific triggers and behaviors during
 * morning departures for 3 days".
 */
import { describe, expect, it } from "vitest";
import { OBSERVE_CUES, demoteObservationSteps, firstActStep, isObservationStep } from "./stepOrder";

const s = (text: string, id = text) => ({ id, text });

describe("isObservationStep (EN + HE)", () => {
  it("observation verbs at the start, after a bullet, a number or a 'Day 1:' lead-in", () => {
    for (const t of [
      "Observe and log specific triggers and behaviors during morning departures for 3 days",
      "Log every tantrum for a week",
      "track bedtime for 5 nights",
      "Notice what happens just before",
      "- Record when it starts",
      "1. Monitor screen time",
      "Day 1: Observe the morning",
      "Keep a log of meals",
      "תעדו את הבקרים במשך 3 ימים",
      "שימו לב מה קורה רגע לפני",
      "עקבו אחרי שעת השינה",
      "יום 1: צפו בבוקר",
      "לתעד כל התפרצות",
    ]) expect(isObservationStep(t), t).toBe(true);
  });
  it("acts are not observation — including words that merely contain a cue", () => {
    for (const t of [
      "Say 'Shoes, then car' at the door tomorrow and hand him one shoe",
      "Lay out clothes the night before",
      "Logically explain the plan", // 'log' is not a word here
      "Recordings of his favourite song in the car",
      "תגידו 'נעליים ואז אוטו' ליד הדלת",
      "שימושי: הכינו את התיק בערב", // starts with שימו… but is not "שימו לב"
      "",
    ]) expect(isObservationStep(t), t).toBe(false);
  });
  it("the cue lists are exported as data, EN + HE", () => {
    expect(OBSERVE_CUES.en).toEqual(expect.arrayContaining(["observe", "log", "track", "notice"]));
    expect(OBSERVE_CUES.he).toEqual(expect.arrayContaining(["תעדו", "שימו לב", "עקבו", "צפו"]));
  });
});

describe("demoteObservationSteps", () => {
  it("the live plan: the observe step drops below the first act", () => {
    const steps = [
      s("Observe and log specific triggers and behaviors during morning departures for 3 days", "o1"),
      s("Picture schedule by the door: say 'First shoes, then car'", "a1"),
      s("Practise the goodbye ritual", "a2"),
    ];
    expect(demoteObservationSteps(steps).map((x) => x.id)).toEqual(["a1", "o1", "a2"]);
    expect(firstActStep(steps)?.id).toBe("a1");
  });
  it("several leading observation steps keep their own order after the act", () => {
    const steps = [s("Notice A", "o1"), s("תעדו ב", "o2"), s("Say C", "a1"), s("Track D", "o3")];
    expect(demoteObservationSteps(steps).map((x) => x.id)).toEqual(["a1", "o1", "o2", "o3"]);
  });
  it("an act first → unchanged; all observation → unchanged; empty → empty", () => {
    const acts = [s("Say A", "a1"), s("Notice B", "o1")];
    expect(demoteObservationSteps(acts)).toEqual(acts);
    const obs = [s("Observe A", "o1"), s("Log B", "o2")];
    expect(demoteObservationSteps(obs).map((x) => x.id)).toEqual(["o1", "o2"]);
    expect(firstActStep(obs)?.id).toBe("o1");
    expect(demoteObservationSteps([])).toEqual([]);
    expect(firstActStep([])).toBeNull();
  });
  it("pure: returns a new array of the same objects, input untouched", () => {
    const steps = [s("Observe A", "o1"), s("Say B", "a1")];
    const copy = [...steps];
    const out = demoteObservationSteps(steps);
    expect(steps).toEqual(copy);
    expect(out[0]).toBe(steps[1]);
  });
});

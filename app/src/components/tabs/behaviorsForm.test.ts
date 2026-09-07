/**
 * OBJ-BEH-02 · OBJ-BEH-03 — the Behaviors capture form told two lies.
 *
 * OBJ-BEH-02: the validation toast read «Fill in "What triggered this?" and
 * "What was your response?"». The form's labels are `beh.capture.happened`
 * ("What happened?") and `beh.capture.tried` ("What did you try?"). The parent
 * was told to fill in fields that are not on the screen. The toast is built
 * from those two label keys now, so the copy cannot drift from the form again.
 *
 * OBJ-BEH-03: a "Moment" — "she said butterfly for the first time" — saved
 * with `intensity: 3`, the form default for a field a Moment never shows. It
 * drew a 3/5 severity meter, a "Level 3" badge, and answered the "intensity 3"
 * filter. Nothing intensity-shaped reaches the parent for a moment now, and
 * both capture routes write the same neutral value.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { en, he } from "../../lib/i18n";
import { en as loopEn, he as loopHe } from "../../lib/i18nElevation/closeloop";
import {
  MOMENT_BEHAVIOR_TYPE, isIncidentType, momentLogFields, validateLogDraft,
} from "../../content/behaviorTaxonomy";
import type { BehaviorLog } from "../../types";

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(here, "..", "..");
const read = (rel: string) => readFileSync(path.join(SRC, rel), "utf8");
const BEH = read("components/tabs/BehaviorsTab.tsx");
const CTX = read("context/ArborContext.tsx");

describe("OBJ-BEH-02 · the toast names the fields the form shows", () => {
  it("the two keys the toast interpolates are the two the form renders as labels", () => {
    // The labels, read off the form.
    expect(BEH).toContain("happened: t(\"beh.capture.happened\")");
    expect(BEH).toContain("tried: t(\"beh.capture.tried\")");
    // The toast, built from the same two.
    expect(BEH).toMatch(/t\("elev\.closeloop\.validate\.both", \{ happened: captureCopy\.happened, tried: captureCopy\.tried \}\)/);
    expect(BEH).toMatch(/t\("elev\.closeloop\.validate\.one", \{ happened: captureCopy\.happened \}\)/);
  });

  it("every write path routes through the one toast builder", () => {
    // submitLog and confirmReview — the two places a draft can fail validation.
    expect(BEH.match(/toast\(validationToast\(invalid\), "error"\)/g)).toHaveLength(2);
    // NEGATIVE CONTROL: the pre-fix call, which toasted the raw key.
    expect(BEH).not.toMatch(/toast\(t\(invalid\), "error"\)/);
  });

  it("the new strings exist in EN and HE and carry both field tokens", () => {
    for (const dict of [loopEn, loopHe]) {
      expect(dict["elev.closeloop.validate.one"]).toContain("{happened}");
      expect(dict["elev.closeloop.validate.both"]).toContain("{happened}");
      expect(dict["elev.closeloop.validate.both"]).toContain("{tried}");
    }
    expect(loopHe["elev.closeloop.validate.both"]).toMatch(/[֐-׿]/);
  });

  it("NEGATIVE CONTROL: the shipped toast quoted labels the form does not have", () => {
    // The strings still in lib/i18n.ts, retained for validateLogDraft's return
    // type — and provably naming fields the form no longer renders.
    expect(en["beh.toast.fillBoth"]).toContain("What triggered this?");
    expect(en["beh.toast.fillBoth"]).not.toContain(en["beh.capture.happened"]);
    expect(he["beh.toast.fillBoth"]).not.toContain(he["beh.capture.happened"]);
  });

  it("validateLogDraft still owns the RULE (this item changed only the words)", () => {
    expect(validateLogDraft({ behaviorType: MOMENT_BEHAVIOR_TYPE, trigger: "", response: "" })).toBe("beh.toast.fillTrigger");
    expect(validateLogDraft({ behaviorType: "Sleep Meltdown", trigger: "bedtime", response: "" })).toBe("beh.toast.fillBoth");
    expect(validateLogDraft({ behaviorType: MOMENT_BEHAVIOR_TYPE, trigger: "said butterfly", response: "" })).toBeNull();
  });
});

describe("OBJ-BEH-03 · a Moment is not graded", () => {
  const moment = (intensity: number): BehaviorLog => ({
    id: "m", childId: "c", behaviorType: MOMENT_BEHAVIOR_TYPE, intensity,
    durationMinutes: 0, trigger: "said butterfly", context: "Home", notes: "",
    timestamp: new Date().toISOString(), resolved: false,
  } as BehaviorLog);

  it("the newLog path no longer writes the form default for a Moment", () => {
    expect(CTX).toMatch(/intensity: newLogType === MOMENT_BEHAVIOR_TYPE \? momentLogFields\(""\)\.intensity : newLogIntensity/);
    // NEGATIVE CONTROL: the unconditional write that shipped.
    expect(CTX).not.toMatch(/^\s*intensity: newLogIntensity,$/m);
  });

  it("both capture routes agree on the value a Moment carries", () => {
    expect(momentLogFields("said butterfly").intensity).toBe(1);
    expect(momentLogFields("said butterfly").behaviorType).toBe(MOMENT_BEHAVIOR_TYPE);
  });

  it("a specific intensity filter excludes every non-incident row, whatever it stores", () => {
    // The predicate the list applies, exercised directly.
    const excluded = (l: BehaviorLog, intensityFilter: string) =>
      intensityFilter !== "all" && (!isIncidentType(l.behaviorType) || l.intensity !== Number(intensityFilter));
    expect(excluded(moment(1), "1")).toBe(true);
    expect(excluded(moment(3), "3")).toBe(true);
    expect(excluded(moment(3), "all")).toBe(false);
    // An incident still filters exactly as before.
    const incident = { ...moment(3), behaviorType: "Sleep Meltdown" } as BehaviorLog;
    expect(excluded(incident, "3")).toBe(false);
    expect(excluded(incident, "4")).toBe(true);
  });

  it("the list applies that predicate, and hides the meter and level for a Moment", () => {
    expect(BEH).toMatch(/intensityFilter !== "all" && \(!isIncidentType\(l\.behaviorType\) \|\| l\.intensity !== Number\(intensityFilter\)\)/);
    expect(BEH).toMatch(/\{isIncidentType\(log\.behaviorType\) && <span className="hidden min-\[520px\]:inline-flex"><IntensityMeter/);
    expect(BEH).toMatch(/\{isIncidentType\(log\.behaviorType\) && <span[^\n]*beh\.level/);
  });

  it("NEGATIVE CONTROL: the pre-fix predicate matched a Moment stored at 3", () => {
    const prefix = (l: BehaviorLog, f: string) => f !== "all" && l.intensity !== Number(f);
    expect(prefix(moment(3), "3")).toBe(false); // i.e. the moment was SHOWN
  });
});

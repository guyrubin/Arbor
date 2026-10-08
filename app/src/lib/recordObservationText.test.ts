import { describe, expect, it } from "vitest";
import { translate } from "./i18n";
import type { Observation } from "./observations";
import { recordObservationText } from "./recordObservationText";
import { PRACTICES } from "../content/practices";

const observation = (value: Observation["value"]): Observation => ({
  id: "o1", childId: "demo", at: "2026-10-08", domains: ["talking"],
  kind: "moment", source: "parent_typed", origin: "behaviorLogs",
  ageAtObservationMonths: 36, pretermCorrected: false, value,
});
const context = (locale: "en" | "he") => ({
  locale, t: (key: string, vars?: Record<string, string | number>) => translate(locale, key, vars),
  childName: "Dylan", gender: "boy",
});

describe("saved evidence in the development map", () => {
  it("shows the parent's words verbatim instead of a generic moment label or location", () => {
    const result = recordObservationText(observation({ type: "moment", behaviorType: "Moment", context: "Home" }), {
      ...context("en"), parentNote: "Sang the whole bath song on his own",
    });
    expect(result).toEqual({ text: "Sang the whole bath song on his own", ownWords: true });
  });
  it("resolves a saved practice in each locale instead of exposing its storage id", () => {
    const source = observation({ type: "practice", activity: `practice:${PRACTICES[0].id}` });
    const en = recordObservationText(source, context("en")).text;
    const he = recordObservationText(source, context("he")).text;
    expect(en).not.toBe("Practice session");
    expect(he).toMatch(/[א-ת]/);
    expect(he).not.toBe(en);
    for (const text of [en, he]) expect(text).not.toMatch(/practice:|elev\./);
  });
  it("unknown activity ids never become parent-facing copy", () => {
    for (const locale of ["en", "he"] as const) {
      const text = recordObservationText(observation({ type: "practice", activity: "private-internal-id-42" }), context(locale)).text;
      expect(text).not.toMatch(/private-internal|elev\./);
      expect(text.length).toBeGreaterThan(0);
    }
  });
  it("names known kinds of activity without displaying or grading performance", () => {
    expect(recordObservationText(observation({ type: "practice", activity: "speech:r" }), context("en")).text).toBe("Speech practice");
    expect(recordObservationText(observation({ type: "practice", activity: "mimic:pack-12" }), context("en")).text).toBe("A session of copying expressions");
  });
  it("localizes a language label without pretending it is part of the child's quote", () => {
    const result = recordObservationText(observation({ type: "word", phrase: "moon", language: "English" }), context("he"));
    expect(result.text).toContain("moon");
    expect(result.text).not.toContain("English");
    expect(result.ownWords).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { toObservations, type ObservationSources } from "../../lib/observations";
import { translate } from "../../lib/i18n";
import { portraitEvidenceLines } from "./portraitEvidence";

/**
 * F-CHILD-2 — the evidence sheet (Moments and the portrait) reads a hard
 * moment's recorded intensity back as the capture slider's word, never as a
 * bare number; a moment with no recorded intensity prints no intensity line.
 */

const child = { id: "child-a", name: "Noa", age: 4, languages: [] };
const sources: ObservationSources = {
  behaviorLogs: [
    { id: "hard-a", timestamp: "2026-10-09T10:00:00Z", behaviorType: "Tantrum", intensity: 4, trigger: "Leaving the park", response: "Named the feeling", durationMinutes: 6 },
    { id: "hard-b", timestamp: "2026-10-08T10:00:00Z", behaviorType: "Tantrum", trigger: "Bath time", response: "Waited", durationMinutes: 3 },
  ],
};

describe("F-CHILD-2 · evidence intensity in words", () => {
  for (const he of [false, true]) {
    it(`${he ? "he" : "en"}: a recorded intensity is its word, never a number`, () => {
      const observations = toObservations(sources, child);
      const hard = observations.find(o => o.id === "behaviorLogs:hard-a")!;
      const lines = portraitEvidenceLines(hard, sources, he);
      const label = he ? "העוצמה שתיעדתם" : "Intensity you recorded";
      const line = lines.find(l => l.label === label);
      expect(line, "the intensity line").toBeTruthy();
      expect(line!.text).toBe(translate(he ? "he" : "en", "companion.capture.intensity.4"));
      expect(line!.text).not.toMatch(/\d/);
      const missing = observations.find(o => o.id === "behaviorLogs:hard-b")!;
      expect(portraitEvidenceLines(missing, sources, he).some(l => l.label === label)).toBe(false);
    });
  }
});

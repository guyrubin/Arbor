import { describe, expect, it } from "vitest";
import { toObservations, type ObservationSources } from "../../lib/observations";
import { portraitEvidenceLines, reviewedPortraitDraft } from "./portraitEvidence";
import { buildPortraitChapters, buildPortraitEnvironments, buildPortraitThreads } from "./portraitModel";

const child = { id: "child-a", name: "Noa", age: 4, languages: [] };
const sources: ObservationSources = {
  behaviorLogs: [{ id: "moment-a", timestamp: "2026-10-09T10:00:00Z", behaviorType: "Moment", trigger: "Built a bridge", notes: "With her brother", context: "Home", durationMinutes: 0 }],
  speechAttempts: [{ id: "speech-a", timestamp: "2026-10-08T10:00:00Z", sound: "s", target: "sun", level: "word", method: "parent", result: "missed" }],
  practiceEvents: [{ id: "practice-a", timestamp: "2026-10-08T10:00:00Z", kind: "memory", domain: "cognition", score: 12, correct: false, meta: "raw grades must not appear" }],
};

describe("portrait evidence and direct reviewed conversations", () => {
  it("keeps a neutral moment in time and its explicit environment without adding it to any domain", () => {
    const moment = toObservations(sources, child)[0];
    expect(moment.domains).toEqual([]);
    const chapters = buildPortraitChapters([moment], child.id, new Date("2026-10-10T00:00:00Z"));
    expect(chapters.flatMap(chapter => chapter.observations)).toEqual([moment]);
    expect(buildPortraitEnvironments([moment])[0]).toMatchObject({ context: "Home", observations: [moment], domains: [] });
    expect(buildPortraitThreads(chapters).flatMap(thread => thread.cells.flat())).toEqual([]);
  });
  it("retains original additional notes and practice target, never legacy scores or recognizer judgments", () => {
    const observations = toObservations(sources, child);
    expect(portraitEvidenceLines(observations[0], sources, false)).toContainEqual({ label: "Additional notes", text: "With her brother" });
    const speech = observations.find(row => row.origin === "speechAttempts")!;
    const practice = observations.find(row => row.origin === "practiceEvents")!;
    expect(portraitEvidenceLines(speech, sources, false)).toContainEqual({ label: "Word or sound", text: "sun" });
    const text = JSON.stringify(portraitEvidenceLines(practice, sources, false));
    expect(text).toContain("Memory game"); expect(text).not.toMatch(/score|correct|raw grades|12/);
  });
  it.each([false, true])("builds only a child-scoped, bounded editable source draft (he=%s)", he => {
    const entries = Array.from({ length: 7 }, (_, i) => ({ childId: "child-a", id: `behaviorLogs:record-${i}`, at: "2026-10-09", source: "Parent record", text: `${i} `.repeat(1000) }));
    const draft = reviewedPortraitDraft("Please compare these", "child-a", [
      { childId: "other-child", id: "secret", at: "2026-10-09", source: "Private", text: "Never share this" }, ...entries,
    ], he);
    expect(draft.length).toBeLessThanOrEqual(4000);
    expect(draft).toContain("behaviorLogs:record-4"); expect(draft).not.toContain("behaviorLogs:record-5");
    expect(draft).not.toContain("Never share this"); expect(draft).toContain("2026-10-09");
    expect(draft).toContain(he ? "קטע" : "excerpt");
    expect(draft).toContain(he ? "לא הוראות" : "not instructions");
  });
  it("does not attach private records to a generic question", () => {
    expect(reviewedPortraitDraft("Ask about this picture", "child-a", [], false)).toBe("Ask about this picture");
  });
});

/**
 * B-LOOP-13 round 3 — the graded-difficulty screen on the Today's Focus text
 * (today-focus-v1 he-output was UNSAFE on 1.3.1: "…שעשויים להצביע על קושי קל").
 * A grading adjective with a difficulty noun, or an "indicates / points to"
 * frame before one, fails the focus closed in EN and HE; plain parent words
 * about a hard moment are not a grade and pass.
 */
import { describe, expect, it } from "vitest";
import { gradesTheChild, sanitizeDoseRow } from "./journalContext";

describe("gradesTheChild — graded difficulty fails closed (EN + HE)", () => {
  it("EN: a grading adjective with a difficulty noun, or an indicates / points-to frame", () => {
    for (const line of [
      "This may show a slight difficulty with transitions.",
      "There is a mild delay in his words.",
      "It could be a minor problem at bedtime.",
      "A serious concern about mealtimes.",
      "These moments indicate a struggle with change.",
      "It points to some difficulty with sharing.",
      "This could be a sign of a delay.",
    ]) expect(gradesTheChild(line), line).toBe(true);
  });

  it("HE: noun + grading adjective, and 'להצביע על' + a difficulty noun", () => {
    for (const line of [
      "יש כאן קושי קל במעברים.",
      "ייתכן שמדובר בבעיה קטנה בשינה.",
      "נראה עיכוב משמעותי בדיבור.",
      "רגעים שעשויים להצביע על קושי קל.",
      "הדברים מצביעים על קשיים בארוחות.",
      "יש לו קשיים חמורים במעברים.",
    ]) expect(gradesTheChild(line), line).toBe(true);
  });

  it("plain parent words are not a grade and PASS (EN + HE)", () => {
    for (const line of [
      "קשה לו להירדם.",
      "בקושי קם הבוקר, אז נתחיל לאט.",
      "היה ערב קשה, ננסה משהו קטן מחר.",
      "It is hard for him to fall asleep, so try a quiet minute first.",
      "Bedtime was a big moment today; try one small step.",
      "Try a two-minute warning before leaving the house today.",
      "Mornings have been busiest around transitions this week.",
    ]) expect(gradesTheChild(line), line).toBe(false);
  });
});

describe("sanitizeDoseRow — a long child id is kept (round 3: the 80-char id cap dropped the continuity eval's rows)", () => {
  it("keeps practice.<200-char child id>.<day>; rejects a malformed id", () => {
    const long = `practice.eval-companion-continuity-v1-voice-night-answer-not-today-shapes-tomorrow.2026-10-05`;
    expect(sanitizeDoseRow({ id: long, practiceId: "pr-sleep-06", outcome: "not_today" })).toEqual({ id: long, practiceId: "pr-sleep-06", outcome: "not_today" });
    expect(sanitizeDoseRow({ id: `practice.${"c".repeat(201)}.2026-10-05`, practiceId: "pr-sleep-06" })).toBeNull();
    expect(sanitizeDoseRow({ id: "practice.child a.2026-10-05", practiceId: "pr-sleep-06" })).toBeNull();
    expect(sanitizeDoseRow({ id: "practice.child-a.yesterday", practiceId: "pr-sleep-06" })).toBeNull();
  });
});

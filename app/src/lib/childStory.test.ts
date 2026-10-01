import { describe, it, expect } from "vitest";
import { composeChildStory, childStoryToText, type ChildStoryInput } from "./childStory";

const base: ChildStoryInput = {
  name: "Mia Cohen",
  ageYears: 4,
  approvedFacts: [],
  milestonesObserved: 0,
  momentsThisWeek: 0,
  momentsPrevWeek: 0,
  planWins: 0,
};

describe("composeChildStory (T4)", () => {
  it("returns an honest empty state when there is nothing to narrate", () => {
    const s = composeChildStory(base);
    expect(s.empty).toBe(true);
    expect(s.factCount).toBe(0);
    expect(s.title).toBe("The Story of Mia");
    expect(s.paragraphs[0]).toMatch(/hasn't started yet/);
  });

  it("weaves approved facts into the narrative (only what was approved — G2)", () => {
    const s = composeChildStory({
      ...base,
      approvedFacts: [{ fact: "loves dinosaurs." }, { fact: "settles faster with a bath at night" }],
    });
    expect(s.empty).toBe(false);
    expect(s.factCount).toBe(2);
    const text = s.paragraphs.join(" ");
    expect(text).toContain("loves dinosaurs");
    expect(text).toContain("bath at night");
    // G2: no clinical/outcome verbs invented by the composer.
    expect(text).not.toMatch(/\b(improv|delay|proven|diagnos|disorder)/i);
  });

  it("notes how many memories underpin the story when there are many", () => {
    const facts = Array.from({ length: 7 }, (_, n) => ({ fact: `fact number ${n}` }));
    const s = composeChildStory({ ...base, approvedFacts: facts });
    expect(s.paragraphs.join(" ")).toContain("7 memories");
  });

  it("summarizes momentum + milestones + wins observationally", () => {
    const s = composeChildStory({
      ...base,
      momentsThisWeek: 5,
      momentsPrevWeek: 3,
      milestonesObserved: 4,
      planWins: 2,
    });
    const text = s.paragraphs.join(" ");
    expect(text).toContain("5 moments");
    // CLINICAL FIREWALL (2026-08-12): this assertion used to REQUIRE the
    // week-over-week clause ("more than the 3"), pinning a breach in place —
    // comparing the child's own windows is a trend delta, and the losing branch
    // ("a quieter week than…") was an intensity verdict in prose. Both are gone;
    // the flat count of what the PARENT noticed stays. Guarded in both
    // directions so neither phrasing can return.
    expect(text).not.toMatch(/more than the|quieter week|the week before|last week/i);
    // Wave-3: the intensity-trend prose ("calmer" / "bigger lately") is gone.
    expect(text).not.toMatch(/calmer|bigger lately/i);
    // B-ASKJB-19 residue (law 1): a count of what was noticed, never "of {total}".
    expect(text).toContain("Together you've noted 4 milestones.");
    expect(text).not.toMatch(/\d+ of \d+/);
    expect(text).toContain("2 small wins");
  });

  it("childStoryToText renders a shareable plain-text artifact", () => {
    const s = composeChildStory({ ...base, approvedFacts: [{ fact: "is curious about everything" }] });
    const txt = childStoryToText(s);
    expect(txt.startsWith("The Story of Mia")).toBe(true);
    expect(txt).toContain("is curious about everything");
  });
});

describe("B-ASKJB-19 residue — the story's count sentences, EN + HE", () => {
  it("HE renders the Hebrew count sentences (singular and plural), no denominator", () => {
    const one = composeChildStory({ ...base, milestonesObserved: 1, planWins: 1, lang: "he" }).paragraphs.join(" ");
    expect(one).toContain("יחד סימנתם אבן דרך אחת.");
    expect(one).toContain("חגגתם ניצחון קטן אחד בדרך.");
    const many = composeChildStory({ ...base, milestonesObserved: 6, planWins: 3, lang: "he" }).paragraphs.join(" ");
    expect(many).toContain("אבני דרך");
    expect(many).toContain("ניצחונות קטנים");
    expect(many).not.toMatch(/\d+\s*(of|מתוך)\s*\d+/);
  });
  it("the input type carries no total (a denominator cannot be passed in)", () => {
    // @ts-expect-error — milestonesTotal is gone from ChildStoryInput
    const s = composeChildStory({ ...base, milestonesObserved: 2, milestonesTotal: 40 });
    expect(s.paragraphs.join(" ")).not.toContain("40");
  });
});

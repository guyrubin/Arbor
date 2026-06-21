import { describe, it, expect } from "vitest";
import { composeChildStory, childStoryToText, type ChildStoryInput } from "./childStory";

const base: ChildStoryInput = {
  name: "Mia Cohen",
  ageYears: 4,
  approvedFacts: [],
  milestonesObserved: 0,
  milestonesTotal: 0,
  momentsThisWeek: 0,
  momentsPrevWeek: 0,
  intensityTrend: "none",
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
      intensityTrend: "easing",
      milestonesObserved: 4,
      milestonesTotal: 10,
      planWins: 2,
    });
    const text = s.paragraphs.join(" ");
    expect(text).toContain("5 moments");
    expect(text).toContain("more than the 3");
    expect(text).toMatch(/calmer/);
    expect(text).toContain("4 of 10 milestones");
    expect(text).toContain("2 small wins");
  });

  it("childStoryToText renders a shareable plain-text artifact", () => {
    const s = composeChildStory({ ...base, approvedFacts: [{ fact: "is curious about everything" }] });
    const txt = childStoryToText(s);
    expect(txt.startsWith("The Story of Mia")).toBe(true);
    expect(txt).toContain("is curious about everything");
  });
});

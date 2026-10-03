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

describe("B-ASKJB-20 — the story card in the parent's language", () => {
  const full: ChildStoryInput = {
    ...base,
    name: "נועה כהן",
    ageYears: 4,
    approvedFacts: [
      { fact: "אוהבת דינוזאורים." },
      { fact: "נרגעת מהר יותר עם אמבטיה בערב" },
      { fact: "loves Lego" },
    ],
    momentsThisWeek: 3,
    milestonesObserved: 2,
    planWins: 1,
    lang: "he",
  };
  const strip = (s: string) => s.replace(/[\u2066-\u2069]/g, "");

  it("HE story: every sentence Hebrew; the only Latin is what the parent wrote", () => {
    const s = composeChildStory(full);
    const text = strip([s.title, ...s.paragraphs].join("\n"));
    expect(s.title).toContain("הסיפור של");
    // Facts stay verbatim (incl. the Latin one the parent typed).
    expect(text).toContain("אוהבת דינוזאורים");
    expect(text).toContain("loves Lego");
    const withoutFacts = text.replace("loves Lego", "");
    expect(withoutFacts).not.toMatch(/[A-Za-z]/);
    expect(strip(s.paragraphs.join(" "))).toContain("השבוע שמתם לב ל-3 רגעים ששווה לשמור.");
  });

  it("HE snapshot (age, facts list, counts, closing) and the text export is the same output", () => {
    const s = composeChildStory({ ...full, approvedFacts: full.approvedFacts.slice(0, 2) });
    expect(s.paragraphs.map(strip)).toMatchInlineSnapshot(`
      [
        "זה הסיפור של נועה עד עכשיו, בגיל 4 — בנוי רק ממה שאישרתם.",
        "שיתפתם כמה דברים על נועה: אוהבת דינוזאורים; וגם נרגעת מהר יותר עם אמבטיה בערב.",
        "השבוע שמתם לב ל-3 רגעים ששווה לשמור.",
        "יחד סימנתם 2 אבני דרך. חגגתם ניצחון קטן אחד בדרך.",
        "כל זיכרון שאתם מאשרים הופך את ההכוונה של ארבור לכזו שמדברת באמת על נועה.",
      ]
    `);
    expect(childStoryToText(s)).toBe([s.title, "", ...s.paragraphs].join("\n\n"));
  });

  it("HE empty state, one-year opening, many-memories line and fallback name are Hebrew", () => {
    const empty = composeChildStory({ ...base, name: "", lang: "he" });
    expect(empty.empty).toBe(true);
    expect(strip(empty.title)).toBe("הסיפור של הילד שלכם");
    expect(strip(empty.paragraphs[0])).not.toMatch(/[A-Za-z]/);
    const one = composeChildStory({ ...full, ageYears: 1 });
    expect(strip(one.paragraphs[0])).toContain("בגיל שנה");
    const many = composeChildStory({ ...full, approvedFacts: Array.from({ length: 7 }, (_, n) => ({ fact: `עובדה ${n}` })) });
    expect(strip(many.paragraphs.join(" "))).toContain("ארבור שומר בסך הכול 7 זיכרונות על נועה.");
  });

  it("EN bytes unchanged for the shapes the card showed before", () => {
    const s = composeChildStory({ ...base, approvedFacts: [{ fact: "loves dinosaurs." }, { fact: "is kind" }, { fact: "sings" }], momentsThisWeek: 1 });
    expect(s.paragraphs[1]).toBe("You've shared a few things that make Mia who they are: loves dinosaurs; is kind; and sings.");
    expect(s.paragraphs[2]).toBe("This week you noticed 1 moment worth keeping.");
    expect(composeChildStory({ ...base, approvedFacts: [{ fact: "x" }] }).paragraphs[0]).toBe("Here's Mia's story so far, at 4 years old — built only from what you've approved.");
  });

  it("no hard-coded English prose left in the composer (every sentence is a story.* key)", async () => {
    const { readFileSync } = await import("node:fs");
    const path = await import("node:path");
    const src = readFileSync(path.resolve(__dirname, "childStory.ts"), "utf8");
    const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    // String/template literals that carry two+ English words are prose.
    const literals = code.match(/(["'`])(?:(?!\1)[^\\n]|\.)*\1/g) ?? [];
    const prose = literals.filter((l) => /[A-Za-z]{2,}\s+[A-Za-z]{2,}/.test(l));
    expect(prose).toEqual([]);
  });
});

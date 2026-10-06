import { describe, expect, it } from "vitest";
import {
  FAMILY_SET_SCALE_LABEL, MAX_FAMILY_GOALS, activeGoals, archiveGoal, editGoal, goalForPacket, goalParentLine, latestScore, latestScoreWord, scoreGoal, setGoal, type FamilyGoal,
} from "./goals";

/* B-PROG-07 — family goals with goal attainment scaling: three goals in the
   family's own words, the FAMILY writes the five labels, the family scores;
   a parent surface gets words only (never the number); the number lives in
   the professional packet, labelled as the family-set scale. */

const at = (d: number, h = 9) => new Date(2026, 9, d, h, 0);
const SCALE = { "-2": "Much less than we hoped", "-1": "A bit less", "0": "What we hoped", "1": "A bit more", "2": "Much more than we hoped" };
const SCALE_HE = { "-2": "הרבה פחות ממה שקיווינו", "-1": "קצת פחות", "0": "מה שקיווינו", "1": "קצת יותר", "2": "הרבה יותר ממה שקיווינו" };
const make = (existing: FamilyGoal[] = [], text = "Bedtime without shouting", scale: Record<string, string> = SCALE): FamilyGoal => {
  const r = setGoal(existing, { text, scale }, at(6));
  if ("reason" in r) throw new Error(r.reason);
  return r.goal;
};

describe("B-PROG-07 — setting a goal", () => {
  it("keeps the family's words verbatim (whitespace collapsed) and their own five labels", () => {
    const g = make([], "  Bedtime   without shouting ");
    expect(g).toMatchObject({ text: "Bedtime without shouting", scale: SCALE, scores: [] });
    expect(make([], "ללכת לישון בלי צעקות", SCALE_HE).scale).toEqual(SCALE_HE);
  });

  it("refuses empty words, an incomplete scale and a fourth active goal; an archived goal frees a seat", () => {
    expect(setGoal([], { text: " ", scale: SCALE }, at(6))).toEqual({ ok: false, reason: "empty_text" });
    expect(setGoal([], { text: "x", scale: { ...SCALE, "1": " " } }, at(6))).toEqual({ ok: false, reason: "incomplete_scale" });
    const three: FamilyGoal[] = [];
    for (let i = 0; i < MAX_FAMILY_GOALS; i++) three.push(make(three, `goal ${i}`));
    expect(new Set(three.map((g) => g.id)).size).toBe(3);
    expect(setGoal(three, { text: "four", scale: SCALE }, at(6))).toEqual({ ok: false, reason: "too_many" });
    const freed = [archiveGoal(three[0], at(7)), three[1], three[2]];
    expect(activeGoals(freed)).toHaveLength(2);
    expect(setGoal(freed, { text: "four", scale: SCALE }, at(7)).ok).toBe(true);
  });

  it("an edit keeps the family's words; invalid edits change nothing", () => {
    const g = make();
    expect(editGoal(g, { text: "Calmer bedtimes" }, at(7)).text).toBe("Calmer bedtimes");
    expect(editGoal(g, { text: "" }, at(7))).toBe(g);
    expect(editGoal(g, { scale: { ...SCALE, "0": "" } }, at(7))).toBe(g);
  });
});

describe("B-PROG-07 — scoring", () => {
  it("one score per local day (a later one replaces it); scores stay in time order; out-of-scale values are ignored", () => {
    let g = make();
    g = scoreGoal(g, -1, at(7, 9));
    g = scoreGoal(g, 0, at(7, 21));
    g = scoreGoal(g, 1, at(14));
    expect(g.scores.map((s) => s.value)).toEqual([0, 1]);
    expect(scoreGoal(g, 3 as never, at(15))).toBe(g);
    expect(latestScore(g)?.value).toBe(1);
  });

  it("the latest score word is the FAMILY's own label — never the number", () => {
    const g = scoreGoal(make(), 2, at(13));
    expect(latestScoreWord(g)).toBe("Much more than we hoped");
    expect(latestScoreWord(make())).toBeNull();
    const he = scoreGoal(make([], "ללכת לישון בלי צעקות", SCALE_HE), -2, at(13));
    expect(latestScoreWord(he)).toBe("הרבה פחות ממה שקיווינו");
  });
});

describe("B-PROG-07 — the firewall", () => {
  it("a parent line carries words only: no digit, sign or scale number next to the goal (EN + HE, every step)", () => {
    for (const [scale, text] of [[SCALE, "Bedtime without shouting"], [SCALE_HE, "ללכת לישון בלי צעקות"]] as const) {
      for (const v of [-2, -1, 0, 1, 2] as const) {
        const line = goalParentLine(scoreGoal(make([], text, scale), v, at(13)));
        expect(Object.keys(line).sort()).toEqual(["text", "word"]);
        expect(`${line.text} ${line.word}`).not.toMatch(/[0-9+−%]|-\d/);
      }
    }
  });

  it("the packet shows the GAS number with the label 'family-set scale' (EN + HE)", () => {
    const g = scoreGoal(make(), -1, at(13));
    expect(goalForPacket(g)).toMatchObject({ text: "Bedtime without shouting", scaleLabel: "family-set scale", latest: { value: -1, word: "A bit less" }, scored: 1 });
    expect(goalForPacket(g, "he").scaleLabel).toBe(FAMILY_SET_SCALE_LABEL.he);
    expect(goalForPacket(make()).latest).toBeNull();
  });
});

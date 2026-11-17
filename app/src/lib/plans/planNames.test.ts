/**
 * The parent-facing plan and step names (lib/plans/planNames): complete for
 * every authored pattern and menu item, EN and HE, short, and clean under the
 * plan guards — no diagnosis noun, no virtue noun, no pattern-banned word, no
 * pronoun for the child, no AI wording, no new number claims.
 */
import { describe, expect, it } from "vitest";
import { authoredPatterns } from "../library/plans/planBooks";
import { DIAGNOSIS_NOUNS_EN, DIAGNOSIS_NOUNS_HE, VIRTUE_NOUNS_EN, VIRTUE_NOUNS_HE } from "../library/plans/planLint";
import { PLAN_NAMES, planName, stepName, type PatternNames } from "./planNames";

const hasEn = (t: string, w: string) => new RegExp(`(?<![\\p{L}])${w.replace(/\s+/g, "\\s+")}(?![\\p{L}])`, "iu").test(t);
const hasHe = (t: string, w: string) => new RegExp(`(^|[^\\p{L}])(?:[והבלמשכ]{0,2})${w}(?![\\p{L}])`, "u").test(t);
const CHILD_PRONOUNS_EN = ["he", "she", "him", "her", "his", "hers", "they", "them", "their", "theirs", "my", "mine", "me", "i"];
const CHILD_PRONOUNS_HE = ["הוא", "היא", "שלו", "שלה", "אותו", "אותה", "שלי", "אני"];
const AI_WORDING = /\bAI\b|\bA\.I\.|artificial|Arbor's|בינה מלאכותית|\bAI\b/i;

/** Every problem a names table has (the test's subject; [] = clean). */
function problems(table: Record<string, PatternNames>): string[] {
  const out: string[] = [];
  for (const def of authoredPatterns()) {
    const names = table[def.id];
    if (!names) { out.push(`${def.id}: no plan name`); continue; }
    const all: [string, { en: string; he: string }][] = [[`${def.id}.plan`, names.plan]];
    for (const m of def.menu) {
      const n = names.steps[m.id];
      if (!n) out.push(`${def.id}.${m.id}: no step name`);
      else all.push([`${def.id}.${m.id}`, n]);
    }
    for (const [where, l] of all) {
      if (!l.en.trim() || !l.he.trim()) out.push(`${where}: empty`);
      if (l.en.split(/\s+/).length > 7 || l.he.split(/\s+/).length > 7) out.push(`${where}: longer than seven words`);
      if (/\d/.test(l.en + l.he)) out.push(`${where}: a number claim`);
      if (/[֐-׿]/.test(l.en) || /[A-Za-z]/.test(l.he)) out.push(`${where}: mixed script`);
      if (AI_WORDING.test(l.en) || AI_WORDING.test(l.he)) out.push(`${where}: AI wording`);
      for (const w of [...DIAGNOSIS_NOUNS_EN, ...VIRTUE_NOUNS_EN, ...def.bannedWords.en, ...CHILD_PRONOUNS_EN]) if (hasEn(l.en, w)) out.push(`${where}: "${w}"`);
      for (const w of [...DIAGNOSIS_NOUNS_HE, ...VIRTUE_NOUNS_HE, ...def.bannedWords.he, ...CHILD_PRONOUNS_HE]) if (hasHe(l.he, w)) out.push(`${where}: "${w}"`);
    }
  }
  return out;
}

describe("plan and step names", () => {
  it("every authored pattern and menu item is named, EN and HE, and passes the guards", () => {
    expect(problems(PLAN_NAMES)).toEqual([]);
  });

  it("negative controls: a missing name, a pronoun, AI wording, a diagnosis noun and a number are each caught", () => {
    const bad = structuredClone(PLAN_NAMES);
    delete bad["plan-dropoff"].steps["thing-from-home"];
    bad["plan-dropoff"].plan = { en: "Saying goodbye to his class", he: "להיפרד בבוקר בדלת" };
    bad["plan-big-feelings"].plan = { en: "AI calm plan", he: "לפנות מקום לרגשות גדולים" };
    bad["plan-poo-sit"].plan = { en: "Constipation help", he: "עזרה בעצירות" };
    bad["plan-new-food"].plan = { en: "Ten new foods", he: "10 מאכלים" };
    const found = problems(bad).join("\n");
    expect(found).toContain("plan-dropoff.thing-from-home: no step name");
    expect(found).toContain('plan-dropoff.plan: "his"');
    expect(found).toContain("plan-big-feelings.plan: AI wording");
    expect(found).toContain('plan-poo-sit.plan: "constipation"');
    expect(found).toContain("plan-new-food.plan: a number claim");
  });

  it("the drop-off names read as N-Challenge-D draws them", () => {
    expect(planName("plan-dropoff", "en")).toBe("Saying goodbye at drop-off");
    expect(stepName("plan-dropoff", "goodbye-ritual", "en")).toBe("Our goodbye");
    expect(stepName("plan-dropoff", "thing-from-home", "en")).toBe("A thing from home");
    expect(stepName("plan-dropoff", "door-opens-again", "en")).toBe("When the door opens again");
    expect(stepName("plan-dropoff", "own", "en")).toBeNull();
  });
});

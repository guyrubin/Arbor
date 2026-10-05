/**
 * B-KID-23 (story half) — the illustrated stories are told in Hebrew.
 *
 * Every story in STORY_HE_REVIEW carries an AI-first-pass Hebrew for every beat
 * title, beat, choice and ending (native review owed, GD-6). This guard keeps
 * that Hebrew complete and in the kid read-aloud register: Hebrew letters only
 * (no Latin left behind), no nikud, no slash-gendering, short sentences.
 */
import { describe, expect, it } from "vitest";
import { HERO_STORIES, STORY_HE_REVIEW, getStorySpec, storyHasLanguage } from "./heroJourneys";

const reviewed = Object.keys(STORY_HE_REVIEW);
// U+05BE (maqaf) is punctuation, not nikud.
const NIKUD = /[\u0591-\u05BD\u05BF-\u05C7]/;
const LATIN = /[A-Za-z]/;
const HEBREW = /[\u05D0-\u05EA]/;

function hebrewFields(id: string): { where: string; text: string }[] {
  const s = getStorySpec(id)!;
  const out: { where: string; text: string }[] = [{ where: "title", text: s.titleHe }];
  for (const b of s.beats) {
    out.push({ where: `${b.id}.title`, text: b.titleHe ?? "" }, { where: `${b.id}.spine`, text: b.spineHe ?? "" });
    for (const c of b.choices ?? []) {
      out.push({ where: `${b.id}.${c.id}.label`, text: c.labelHe ?? "" }, { where: `${b.id}.${c.id}.ending`, text: c.outcomeHintHe ?? "" });
    }
  }
  return out;
}

describe("B-KID-23: the AI-first-pass Hebrew stories", () => {
  it("the review list names real catalogue stories, each flagged ai-first-pass", () => {
    expect(reviewed.length).toBeGreaterThan(0);
    for (const id of reviewed) {
      expect(getStorySpec(id), id).toBeDefined();
      expect(STORY_HE_REVIEW[id]).toBe("ai-first-pass");
    }
  });

  it("every listed story is fully told in Hebrew: 8 beat titles + beats, 3 choices + endings", () => {
    for (const id of reviewed) {
      const s = getStorySpec(id)!;
      expect(storyHasLanguage(s, "he"), id).toBe(true);
      expect(s.beats, id).toHaveLength(8);
      for (const f of hebrewFields(id)) expect(f.text.trim(), `${id} ${f.where}`).not.toBe("");
      expect(s.beats.find((b) => b.id === "decision")!.choices, id).toHaveLength(3);
    }
  });

  it("read-aloud register: Hebrew text, no Latin, no nikud, no slash-gendering, short sentences", () => {
    for (const id of reviewed) {
      for (const f of hebrewFields(id)) {
        const where = `${id} ${f.where}: ${f.text}`;
        expect(HEBREW.test(f.text), where).toBe(true);
        expect(LATIN.test(f.text), where).toBe(false);
        expect(NIKUD.test(f.text), where).toBe(false);
        expect(f.text, where).not.toMatch(/[\u05D0-\u05EA]\/[\u05D0-\u05EA]/);
        for (const sentence of f.text.split(/[.!?:]/)) {
          expect(sentence.trim().split(/\s+/).length, where).toBeLessThanOrEqual(16);
        }
      }
    }
  });

  it("the Hebrew is the story's own, not a copy of another story's beat", () => {
    const seen = new Map<string, string>();
    for (const id of reviewed) {
      for (const b of getStorySpec(id)!.beats) {
        const prior = seen.get(b.spineHe!);
        expect(prior, `${id}/${b.id} repeats ${prior}`).toBeUndefined();
        seen.set(b.spineHe!, `${id}/${b.id}`);
      }
    }
  });

  it("NEGATIVE CONTROL: a story outside the list that lacks Hebrew is not tellable in Hebrew", () => {
    const untold = HERO_STORIES.filter((s) => !storyHasLanguage(s, "he"));
    for (const s of untold) expect(reviewed, s.id).not.toContain(s.id);
  });
});

/**
 * K2 block 3b — the BOOK pose prompts on the ONE hero pipeline: every book
 * pose has a prompt; each is the game's character (the same SPRITE_STYLE,
 * REFS_POSE and HERO blocks) on the book's stage and tail; fixed text with no
 * name and nothing of one child; and the game's eight prompts are unchanged.
 */
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { HERO_BOOK_POSE_IDS, HERO_SHEET_POSE_IDS } from "../lib/heroSheetContract.js";
import { BOOK_POSES, HERO, REFS_POSE, SPRITE_STYLE, STAGE, STAGE_BOOK, TAIL, TAIL_BOOK, heroPosePrompt } from "./heroPosePrompts.js";

const book = HERO_BOOK_POSE_IDS.map((pose) => [pose, heroPosePrompt(pose)] as const);

describe("K2 book pose prompts", () => {
  it("every book pose has a prompt, and the table holds book poses only", () => {
    expect(HERO_BOOK_POSE_IDS).toHaveLength(18);
    expect(Object.keys(BOOK_POSES).sort()).toEqual([...HERO_BOOK_POSE_IDS].sort());
    for (const [pose, p] of book) expect(p.length, pose).toBeGreaterThan(1000);
  });

  it("ONE character: the game's SPRITE_STYLE, REFS_POSE and HERO blocks, anchored on the approved idle; the book's stage and tail", () => {
    for (const [pose, p] of book) {
      for (const block of [SPRITE_STYLE, REFS_POSE, HERO, STAGE_BOOK, TAIL_BOOK]) expect(p, pose).toContain(block);
      expect(p, pose).toContain("Image 1 is THE HERO exactly as the hero must look");
      expect(p, pose).not.toContain(STAGE);
      expect(p, pose).not.toContain(TAIL);
      expect(p, pose).toContain("#00B140");
      expect(p, pose).toContain("the same age as the reference");
    }
    expect(STAGE_BOOK).not.toContain("CAMERA-FACING");
    expect(STAGE_BOOK).not.toContain("nothing in the hands");
  });

  it("the scan: no name slot, no Dylan or David, no suit, emblem, tunic or cape, no boy, no pronoun of one child, no age clause", () => {
    for (const [pose, p] of book) {
      expect(p, pose).not.toMatch(/\$\{|\{name\}|\{hero\}|dylan|david|suit|emblem|tunic|\bcape\b|\bboys?\b|\bgirl\b|\bhe\b|\bhis\b|\bhim\b|\bshe\b|\bher\b|years old|not older/i);
    }
  });

  it("the armour goes over the hero's own clothes; the hands hold only the named sling and staff", () => {
    expect(heroPosePrompt("armour-stuck")).toMatch(/over the hero's own clothes the hero wears an OVERSIZED adult's coat of bronze scale mail/i);
    expect(heroPosePrompt("armour-stuck")).not.toContain("shepherd's bag on a thin leather strap");
    expect(heroPosePrompt("worried")).toContain("Over the hero's own clothes, a small brown leather shepherd's bag");
    expect(TAIL_BOOK).toContain("only the named sling and staff");
    expect(TAIL_BOOK).not.toContain("No weapons");
    expect(TAIL_BOOK.replace("In the hands, only the named sling and staff and only where the pose names them: nothing sharp, no sword, no spear, no knife; no blood,", "No weapons, no blood,")).toBe(TAIL);
  });

  it("sit-hunched is the round-3 rewording that passed the safety filter; worried-tunic draws the worried pose", () => {
    const p = heroPosePrompt("sit-hunched");
    expect(p).toContain("curled up small: knees pulled up high to the chest, both arms hugging the knees");
    expect(p).toContain("a small uncertain expression");
    expect(p).not.toMatch(/afraid|worried/i);
    expect(heroPosePrompt("worried-tunic")).toBe(heroPosePrompt("worried"));
  });

  it("the game's eight prompts are byte-identical to K1 (live)", () => {
    const hash = createHash("sha256").update(HERO_SHEET_POSE_IDS.map((pose) => heroPosePrompt(pose)).join("\n")).digest("hex");
    expect(hash).toBe("c60b5ef29a74dfde55f7449981f91fa0fab27e5ddf09ff0c9fbd111665c437dd");
  });
});

/**
 * B-BOOK-45 / B-BOOK-46 — the mode of one read: bedtime by the parent's time
 * (until 06:00), Together only when a grown-up's door asked for it, and the
 * Together prompts on exactly the cover, the decision, the first branch page,
 * the rejoin and the last page (the book's own talk prompt).
 */
import { describe, expect, it } from "vitest";
import { fiveSmoothStones as book } from "./books/fiveSmoothStones";
import { readPath } from "./bookFlow";
import { BEDTIME_PLAYBACK_RATE, BEDTIME_SFX_GAIN, BEDTIME_TIMES, isBedtimeNow, readModeFor, togetherPrompt, validBedtime } from "./readMode";
import { BOOK_STRINGS } from "./bookStrings";

const at = (h: number, m = 0) => new Date(2026, 9, 28, h, m);

describe("B-BOOK-45: bedtime by the parent's time", () => {
  it("the agreed feel: 0.92x narration, half-gain sounds; the times a parent can pick", () => {
    expect(BEDTIME_PLAYBACK_RATE).toBe(0.92);
    expect(BEDTIME_SFX_GAIN).toBe(0.5);
    expect(BEDTIME_TIMES.every((t) => validBedtime(t) === t)).toBe(true);
  });
  it("from the set time until 06:00 the next morning; off, garbage or empty = never", () => {
    expect([at(19, 29), at(19, 30), at(23, 59), at(3), at(5, 59), at(6), at(12)].map((d) => isBedtimeNow("19:30", d))).toEqual([false, true, true, true, true, false, false]);
    for (const off of [undefined, null, "", "7pm", "25:00", "19:3", 1930]) expect(isBedtimeNow(off, at(21)), String(off)).toBe(false);
  });
  it("a grown-up's Together wins over the clock; otherwise bedtime, else alone", () => {
    expect(readModeFor({ together: true, bedtimeFrom: "19:00", now: at(21) })).toBe("together");
    expect(readModeFor({ bedtimeFrom: "19:00", now: at(21) })).toBe("bedtime");
    expect(readModeFor({ bedtimeFrom: "19:00", now: at(17) })).toBe("alone");
    expect(readModeFor({ now: at(21) })).toBe("alone");
  });
  it("the Goodnight word is a word, never a count (EN + HE)", () => {
    expect(BOOK_STRINGS.en.goodnight).toBe("Goodnight");
    expect(BOOK_STRINGS.he.goodnight).toBe("לילה טוב");
    for (const v of [BOOK_STRINGS.en.goodnight, BOOK_STRINGS.he.goodnight]) expect(v).not.toMatch(/\d|streak|night \d|in a row/i);
  });
});

describe("B-BOOK-46: the Together prompts", () => {
  const c = book.decision.choices[1];
  const path = readPath(book, c.id);
  it("never outside Together", () => {
    for (const mode of ["alone", "bedtime"] as const) {
      for (const st of [{ at: "cover", choiceId: null }, { at: book.decision.pageId, choiceId: null }, ...path.map((p) => ({ at: p.id, choiceId: c.id }))]) expect(togetherPrompt(mode, book, st), `${mode} ${st.at}`).toBeNull();
    }
  });
  it("in Together: the cover, the decision, the first branch page, the rejoin and the book's own talk prompt on the last page; quiet elsewhere", () => {
    const shown = [{ at: "cover", choiceId: null }, ...path.map((p) => ({ at: p.id, choiceId: p.id === book.decision.pageId || book.pages.indexOf(p) >= 0 && book.pages.indexOf(p) < book.pages.findIndex((x) => x.id === book.decision.pageId) ? null : c.id }))]
      .map((st) => [st.at, togetherPrompt("together", book, st)] as const).filter(([, p]) => p);
    expect(shown.map(([id]) => id)).toEqual(["cover", book.decision.pageId, c.branch[0].id, book.rejoinPageId, path[path.length - 1].id]);
    expect(shown[shown.length - 1][1]).toEqual({ label: book.parent.together });
  });
  it("the prompts are parent register in EN and HE: questions to ask, no count, no verdict", () => {
    for (const k of ["together.label", "together.cover", "together.decision", "together.branch", "together.rejoin"] as const) {
      expect(BOOK_STRINGS.en[k].trim()).not.toBe("");
      expect(BOOK_STRINGS.he[k]).toMatch(/[א-ת]/);
      for (const v of [BOOK_STRINGS.en[k], BOOK_STRINGS.he[k]]) expect(v).not.toMatch(/\d|right answer|wrong|good job|well done|score/i);
    }
  });
});

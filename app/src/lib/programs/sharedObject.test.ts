/**
 * B-PROG-16 — one eligible shared object for the week and focus, in EN and
 * HE, with a useful fallback; the next-day handback is cover, tomorrow and
 * ask-after. A choice or a score never arrives.
 */
import { describe, expect, it } from "vitest";
import { authoredPatterns } from "../library/plans/planBooks";
import { loopFirewallHits } from "../loop/firewall";
import { childScopedKey } from "../childLocalState";
import { translate } from "../i18n";
import {
  PROGRAM_SHARED_OBJECT_FLAG,
  bookHandback,
  catalogueSharedObjects,
  dismissHandback,
  matchSharedObject,
  programSharedObjectOn,
  readDismissedHandbacks,
  type SharedObject,
} from "./sharedObject";

const NOW = new Date(2026, 9, 29, 9, 0, 0);
const YDAY = new Date(2026, 9, 28, 20, 0, 0).toISOString();
const SAME = new Date(2026, 9, 29, 8, 0, 0).toISOString();

const object = (over: Partial<SharedObject> & { id: string; shelf: SharedObject["shelf"] }): SharedObject => ({
  title: { en: `${over.id} title`, he: `${over.id} כותרת` },
  coverLine: { en: `${over.id} cover`, he: `${over.id} כריכה` },
  tomorrow: { en: "Do the four steps tomorrow evening.", he: "מחר בערב, ארבעת השלבים." },
  askAfter: { en: "What are our steps?", he: { m: "מה השלבים שלנו?", f: "מה השלבים שלנו?" } },
  ...over,
});

const sleep = object({ id: "plan-sleep-alone", shelf: "sleep" });
const stay = object({ id: "plan-stay-in-bed", shelf: "sleep" });
const food = object({ id: "plan-new-food", shelf: "food" });
const objects = [sleep, stay, food];

describe("B-PROG-16 · one eligible object matches the week and the focus", () => {
  it("the shelf's only object is the match, EN and HE", () => {
    const en = matchSharedObject({ weekShelf: "food", objects, weekSkill: "Notice one new food." });
    expect(en).toEqual({ kind: "object", via: "only", object: food });
    const card = bookHandback({
      weekShelf: "food", objects, reads: [{ bookId: food.id, finishedAt: YDAY }], now: NOW,
      lang: "he", gender: "girl", childName: "Noa", weekSkill: "שימו לב לאוכל אחד חדש.",
    });
    expect(card).toMatchObject({ objectId: food.id, title: "plan-new-food כותרת", coverLine: "plan-new-food כריכה", askAfter: "מה השלבים שלנו?" });
  });

  it("two objects on the shelf do not get a guessed winner — the week's skill is the fallback", () => {
    const m = matchSharedObject({ weekShelf: "sleep", objects, weekSkill: "Keep one calm bedtime routine." });
    expect(m).toEqual({ kind: "fallback", reason: "many", text: "Keep one calm bedtime routine." });
  });

  it("the parent's own single plan on the shelf is the one object", () => {
    const m = matchSharedObject({ weekShelf: "sleep", objects, chosenIds: ["plan-stay-in-bed"], weekSkill: "skill" });
    expect(m).toMatchObject({ kind: "object", via: "chosen", object: stay });
  });

  it("two parent plans, or a focus shelf that disagrees, fall back", () => {
    expect(matchSharedObject({ weekShelf: "sleep", objects, chosenIds: ["plan-sleep-alone", "plan-stay-in-bed"], weekSkill: "skill" }).kind).toBe("fallback");
    expect(matchSharedObject({ weekShelf: "sleep", focusShelf: "words", objects, weekSkill: "Wait for their turn." }))
      .toEqual({ kind: "fallback", reason: "focus", text: "Wait for their turn." });
  });

  it("a named id wins only when it is eligible and on the week's shelf; a missing one falls through", () => {
    expect(matchSharedObject({ weekShelf: "sleep", objectId: "plan-sleep-alone", objects, weekSkill: "skill" }))
      .toMatchObject({ via: "named", object: sleep });
    expect(matchSharedObject({ weekShelf: "food", objectId: "plan-sleep-alone", objects, weekSkill: "skill" }))
      .toMatchObject({ via: "only", object: food });
    expect(matchSharedObject({ weekShelf: "words", objects, weekSkill: "Wait, then answer." }))
      .toEqual({ kind: "fallback", reason: "none", text: "Wait, then answer." });
  });

  it("a line missing in one language is not eligible, so it cannot be the only match", () => {
    const thin = object({ id: "plan-half", shelf: "family", tomorrow: { en: "Tomorrow.", he: "" } });
    expect(matchSharedObject({ weekShelf: "family", objects: [thin], weekSkill: "skill" })).toMatchObject({ kind: "fallback", reason: "none" });
  });
});

describe("B-PROG-16 · next-day handback is cover, tomorrow and ask-after", () => {
  const base = { weekShelf: "food" as const, objects, now: NOW, weekSkill: "Notice one new food.", childName: "Noa" };

  it("yesterday's finished read hands the cover, tomorrow and the question back", () => {
    const card = bookHandback({ ...base, reads: [{ bookId: food.id, finishedAt: YDAY, choice: "hard" } as { bookId: string; finishedAt: string }], lang: "en" });
    expect(card).toMatchObject({
      key: "plan-new-food:2026-10-28",
      title: "plan-new-food title",
      coverLine: "plan-new-food cover",
      tomorrow: "Do the four steps tomorrow evening.",
      askAfter: "What are our steps?",
    });
    expect(JSON.stringify(card)).not.toMatch(/hard|score|choice/);
    expect(loopFirewallHits([card].flatMap((c) => ("title" in c ? [c.title, c.coverLine, c.tomorrow, c.askAfter] : [c.text])).join("\n"))).toEqual([]);
  });

  it("the same day is not next day; a different book is not this object; dismiss hides it", () => {
    const sameDay = bookHandback({ ...base, reads: [{ bookId: food.id, finishedAt: SAME }], lang: "en" });
    const otherBook = bookHandback({ ...base, reads: [{ bookId: "plan-sleep-alone", finishedAt: YDAY }], lang: "en" });
    const dismissed = bookHandback({ ...base, reads: [{ bookId: food.id, finishedAt: YDAY }], dismissed: ["plan-new-food:2026-10-28"], lang: "en" });
    expect("key" in sameDay).toBe(false);
    expect("key" in otherBook).toBe(false);
    expect("key" in dismissed).toBe(false);
  });

  it("Hebrew ask-after follows the child's gender and drops nothing of the authored line", () => {
    const gendered = object({
      id: "plan-new-food", shelf: "food",
      askAfter: { en: "What is in the box?", he: { m: "מה יש לך בקופסה?", f: "מה יש לך בקופסה, ילדה?" } },
    });
    const girl = bookHandback({ ...base, objects: [gendered], reads: [{ bookId: gendered.id, finishedAt: YDAY }], lang: "he", gender: "girl" });
    const boy = bookHandback({ ...base, objects: [gendered], reads: [{ bookId: gendered.id, finishedAt: YDAY }], lang: "he", gender: "boy" });
    expect(girl).toMatchObject({ askAfter: "מה יש לך בקופסה, ילדה?" });
    expect(boy).toMatchObject({ askAfter: "מה יש לך בקופסה?" });
  });
});

describe("B-PROG-16 · the real catalogue, the flag, and dismiss", () => {
  it("every authored pattern that is eligible has both languages; sleep does not collapse to one guess", () => {
    const real = catalogueSharedObjects(authoredPatterns());
    expect(real.length).toBeGreaterThan(0);
    for (const o of real) {
      expect(o.tomorrow.he.trim()).toBeTruthy();
      expect(o.askAfter.he.f.trim()).toBeTruthy();
    }
    expect(matchSharedObject({ weekShelf: "sleep", objects: real, weekSkill: "Keep one calm bedtime routine." }).kind).toBe("fallback");
    expect(matchSharedObject({ weekShelf: "food", objects: real, weekSkill: "skill" })).toMatchObject({ via: "only", object: { id: "plan-new-food" } });
  });

  it("the card is dark until the pilot flag; dismiss is per child and remembered", () => {
    expect(PROGRAM_SHARED_OBJECT_FLAG).toBe("arbor.flags.programSharedObject");
    expect(programSharedObjectOn(null)).toBe(false);
    expect(programSharedObjectOn({ getItem: () => "1" })).toBe(true);
    expect(programSharedObjectOn({ getItem: () => "0" })).toBe(false);
    const mem = new Map<string, string>();
    const storage = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => { mem.set(k, v); } };
    expect(dismissHandback(storage, "child-a", "plan-new-food:2026-10-28")).toEqual(["plan-new-food:2026-10-28"]);
    expect(readDismissedHandbacks(storage, "child-a")).toEqual(["plan-new-food:2026-10-28"]);
    expect(readDismissedHandbacks(storage, "child-b")).toEqual([]);
    expect([...mem.keys()][0]).toBe(childScopedKey("programHandback.local-sandbox", "child-a"));
  });

  it("dismissals belong to an owner and child; legacy and unknown-owner state cannot hide another family's card", () => {
    const mem = new Map([[childScopedKey("programHandback", "same-child"), '["legacy"]']]);
    const storage = { getItem: (key: string) => mem.get(key) ?? null, setItem: (key: string, value: string) => { mem.set(key, value); } };
    expect(readDismissedHandbacks(storage, "same-child", "owner-a")).toEqual([]);
    dismissHandback(storage, "same-child", "book:2026-11-09", "owner-a");
    expect(readDismissedHandbacks(storage, "same-child", "owner-a")).toEqual(["book:2026-11-09"]);
    expect(readDismissedHandbacks(storage, "same-child", "owner-b")).toEqual([]);
    expect(readDismissedHandbacks(storage, "other-child", "owner-a")).toEqual([]);
    expect(dismissHandback(storage, "same-child", "unknown", "")).toEqual([]);
    expect(mem.size).toBe(2);
  });

  it("12 Nov: a card dismissed before owner-scoping stays dismissed — the legacy list is claimed once, recent keys only, then deleted", () => {
    const now = Date.parse("2026-11-12T20:00:00Z");
    const mem = new Map([[childScopedKey("programHandback", "kid-1"), JSON.stringify(["plan-new-food:2026-11-11", "plan-old:2026-10-01", "no-date"])]]);
    const storage = { getItem: (key: string) => mem.get(key) ?? null, setItem: (key: string, value: string) => { mem.set(key, value); }, removeItem: (key: string) => { mem.delete(key); } };
    // The first owner to read claims today's card's key; the stale and malformed ones are dropped.
    expect(readDismissedHandbacks(storage, "kid-1", "owner-a", now)).toEqual(["plan-new-food:2026-11-11"]);
    expect(mem.has(childScopedKey("programHandback", "kid-1"))).toBe(false);
    expect(JSON.parse(mem.get(childScopedKey("programHandback.owner-a", "kid-1"))!)).toEqual(["plan-new-food:2026-11-11"]);
    // Claimed once: a second owner on the device gets nothing from it.
    expect(readDismissedHandbacks(storage, "kid-1", "owner-b", now)).toEqual([]);
    // The claimed card stays hidden on the real render path.
    expect(readDismissedHandbacks(storage, "kid-1", "owner-a", now)).toEqual(["plan-new-food:2026-11-11"]);
    // A new dismissal joins the claimed one.
    expect(dismissHandback(storage, "kid-1", "plan-new-food:2026-11-12", "owner-a")).toEqual(["plan-new-food:2026-11-11", "plan-new-food:2026-11-12"]);
  });

  it("the handback chrome exists in EN and HE and carries no verdict", () => {
    for (const lang of ["en", "he"] as const) {
      const lines = ["elev.program.object.handback", "elev.program.object.tomorrow", "elev.program.object.ask", "elev.program.object.dismiss", "elev.program.object.save", "elev.program.object.words"].map((k) => translate(lang, k));
      expect(lines.every((l) => l && !l.startsWith("elev."))).toBe(true);
      expect(loopFirewallHits(lines.join("\n"))).toEqual([]);
    }
  });
});

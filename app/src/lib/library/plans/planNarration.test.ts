/**
 * PR C (Everyday Plans) — the plan-narration contract: the file names a plan
 * book renders per voice folder, EN / HE-m / HE-f text selection, the
 * name-line route decision (child data = the EU path), where the files live
 * (the child's set, the pattern's registered doc), and idempotency by the
 * words.
 */
import { describe, expect, it } from "vitest";
import { CHILD_SUBCOLLECTIONS } from "../../childData";
import { bookAssetObject, childBookAssetPrefix, isBookAssetRel, type BookAssetsDoc } from "../bookAssetPaths";
import { narrationKey } from "../narration";
import { composePlanBook, defaultPlanComposition } from "./composePlanBook";
import { PLAN_POO_SIT } from "./patterns/planPooSit";
import { getPlanFixtureBook } from "./planBooks";
import {
  emptyPlanNarrationDoc, isPlanNarrationDoc, planNarrationComplete, planNarrationConfiguration, planNarrationDataClasses, planNarrationDocId,
  planNarrationFiles, planNarrationRel, planNarrationRequest, planNarrationRows, planNarrationSetId, planSheetCovers, storedPlanNarration,
} from "./planNarration";
import { PLAN_SHEET_BOOK_ID } from "./planPoses";

const book = getPlanFixtureBook("plan-poo-sit--demo")!;
const CHILD = "synthetic-child";
const OWN = "own";

describe("PR C: which files a plan book renders, per voice folder", () => {
  it("nine whole-page files in reading order: cover, p1–p4, the three steps, the win page; every folder the same names", () => {
    const en = planNarrationFiles(book, "en").map((f) => f.file);
    expect(en).toEqual(["cover.mp3", "p1.mp3", "p2.mp3", "p3.mp3", "p4.mp3", "s1-sit-after-meal-5m.mp3", "s2-the-box.mp3", "s3-just-try.mp3", "p8.mp3"]);
    expect(planNarrationFiles(book, "he-m").map((f) => f.file)).toEqual(en);
    expect(planNarrationFiles(book, "he-f").map((f) => f.file)).toEqual(en);
  });

  it("the name is spoken on the cover (the name line) and the win page (its closing line) only", () => {
    const named = planNarrationRows(book, "en").filter((r) => r.nameBearing).map((r) => r.stem);
    expect(named).toEqual(["cover", "p8"]);
    expect(planNarrationRows(book, "he-f").filter((r) => r.nameBearing).map((r) => r.stem)).toEqual(["cover", "p8"]);
  });

  it("EN reads the English text; HE-m and HE-f read the pattern's own Hebrew forms (first person, the verbs differ)", () => {
    const en = planNarrationRows(book, "en").find((r) => r.stem === "p2")!;
    const m = planNarrationRows(book, "he-m").find((r) => r.stem === "p2")!;
    const f = planNarrationRows(book, "he-f").find((r) => r.stem === "p2")!;
    expect(en.ttsText).toBe(book.pages[1].text.en);
    expect(m.ttsText).toBe(book.pages[1].text.he.m);
    expect(f.ttsText).toBe(book.pages[1].text.he.f);
    expect(m.ttsText).not.toBe(f.ttsText);
    expect(planNarrationRequest(book, "en", "p2.mp3", "Maya")!.languageCode).toBe("en-US");
    expect(planNarrationRequest(book, "he-f", "p2.mp3", "מאיה")!.languageCode).toBe("he-IL");
    // the canonical narrator's style prompt, Hebrew with its nikud rule
    expect(en.style).toContain("A warm grandparent reading a bedtime picture book");
    expect(f.style).toContain("Israeli Hebrew");
    expect(en.style).not.toContain("Israeli Hebrew");
  });

  it("the request fills the name on the name lines only; the hash follows the words", () => {
    const cover = planNarrationRequest(book, "en", "cover.mp3", "Maya")!;
    expect(cover.text).toContain("Maya's special plan");
    expect(cover.text).not.toContain("{name}");
    expect(cover.nameBearing).toBe(true);
    const p1 = planNarrationRequest(book, "en", "p1.mp3", "Maya")!;
    expect(p1.text).not.toContain("Maya");
    expect(p1.nameBearing).toBe(false);
    expect(planNarrationRequest(book, "en", "cover.mp3", "Noa")!.textHash).not.toBe(cover.textHash);
    expect(planNarrationRequest(book, "en", "cover.mp3", "Maya")!.textHash).toBe(cover.textHash);
    expect(planNarrationRequest(book, "he-f", "cover.mp3", "Maya")!.textHash).not.toBe(cover.textHash);
    expect(planNarrationRequest(book, "en", "p99.mp3", "Maya")).toBeNull();
  });
});

describe("PR C: the name-line route decision", () => {
  it("a line that says the name is child data (the EU path canonical name pages take); the pattern's text is public", () => {
    const rows = planNarrationRows(book, "en");
    expect(rows.find((r) => r.stem === "cover")!.dataClasses).toEqual(["child_profile"]);
    expect(rows.find((r) => r.stem === "p8")!.dataClasses).toEqual(["child_profile"]);
    expect(rows.find((r) => r.stem === "p1")!.dataClasses).toEqual(["public"]);
    expect(rows.find((r) => r.stem === "s1-sit-after-meal-5m")!.dataClasses).toEqual(["public"]);
    expect(planNarrationDataClasses({ nameBearing: true, ownStep: false })).toEqual(["child_profile"]);
    expect(planNarrationDataClasses({ nameBearing: false, ownStep: false })).toEqual(["public"]);
  });

  it("the parent's own-words step is the child's record: child data too", () => {
    const c = defaultPlanComposition(PLAN_POO_SIT, { bookId: `plan-poo-sit.${CHILD}`, approvedAt: "2026-10-28T10:00:00.000Z", approvedBy: "parent" });
    const own = composePlanBook(PLAN_POO_SIT, {
      ...c,
      stepMenuIds: [OWN, c.stepMenuIds[1], c.stepMenuIds[2]],
      ownStep: { slot: 1, sourceText: "sit after breakfast", text: { en: "After breakfast, I sit for a little while.", he: { m: "אחרי ארוחת הבוקר אני יושב קצת.", f: "אחרי ארוחת הבוקר אני יושבת קצת." } }, aiPhrased: true, approvedAt: "2026-10-28T10:00:00.000Z" },
    });
    const rows = planNarrationRows(own, "en");
    expect(rows.map((r) => r.stem)).toContain("s1-own");
    const step = rows.find((r) => r.stem === "s1-own")!;
    expect(step).toMatchObject({ ownStep: true, nameBearing: false, dataClasses: ["child_profile"] });
    expect(step.ttsText).toBe("After breakfast, I sit for a little while.");
  });
});
describe("PR C: where the files live (child data, registered for export and erase)", () => {
  it("the set is the child id; the path follows narration.ts; the rel is a valid private book path under the child's prefix", () => {
    expect(planNarrationSetId(CHILD)).toBe(CHILD);
    const rel = planNarrationRel(CHILD, "he-f", "cover.mp3");
    expect(rel).toBe(`narration/${CHILD}/he-f/cover.mp3`);
    expect(isBookAssetRel(rel)).toBe(true);
    expect(bookAssetObject(CHILD, book.pattern, rel)).toBe(`${childBookAssetPrefix(CHILD)}${book.pattern}/${rel}`);
    // the reader's convention: <root>/<pattern>/<childId>/<folder>/<pageId>.mp3 — the last two segments are the asset key
    expect(narrationKey({ bookId: book.pattern, voiceKey: CHILD, pageId: "cover", lang: "he", gender: "f" })).toBe(`/audio/books/${book.pattern}/${CHILD}/he-f/cover.mp3`);
  });

  it("the metadata doc is bookAssets/{pattern}: a registered child sub-collection, a narration-only doc the shelf never opens as a book", () => {
    expect(CHILD_SUBCOLLECTIONS).toContain("bookAssets");
    expect(CHILD_SUBCOLLECTIONS).toContain("books");
    const doc = emptyPlanNarrationDoc(CHILD, book.pattern, "t0");
    expect(planNarrationDocId(book.pattern)).toBe(book.pattern);
    expect(doc).toMatchObject({ id: book.pattern, bookId: book.pattern, setId: CHILD, sets: [CHILD], files: [], narrationText: {} });
    expect(isPlanNarrationDoc(doc)).toBe(true);
    expect(isPlanNarrationDoc({ sheetId: "h-0123456789abcdef" })).toBe(false);
  });

  it("the plan sheet covers the book only when bookAssets/plan-poses really has every pose the book needs", () => {
    const poses = [...new Set([book.cover, ...book.pages].map((p) => p.hero?.pose).filter((p): p is string => !!p))];
    const sheet = (have: string[]): BookAssetsDoc => ({
      id: PLAN_SHEET_BOOK_ID, bookId: PLAN_SHEET_BOOK_ID, sheetId: "h-0123456789abcdef", setId: "h-0123456789abcdef",
      sheetManifest: { poses: Object.fromEntries(poses.map((p) => [p, { file: `${p}.webp` }])) },
      files: have.map((p) => `hero-sheets/h-0123456789abcdef/${p}.webp`), bytes: 1, createdAt: "t0",
    });
    expect(planSheetCovers(sheet(poses), book)).toBe(true);
    expect(planSheetCovers(sheet(poses.slice(1)), book)).toBe(false);
    expect(planSheetCovers({ ...sheet(poses), bookId: "five-smooth-stones" }, book)).toBe(false);
    expect(planSheetCovers(null, book)).toBe(false);
  });
});

describe("PR C: idempotent by the words", () => {
  const req = (file: string, name = "Maya") => planNarrationRequest(book, "en", file, name)!;
  const docWith = (files: string[], text: Record<string, string>): BookAssetsDoc => ({ ...emptyPlanNarrationDoc(CHILD, book.pattern, "t0"), files, narrationText: text });

  it("a stored file with the same words is found (mp3 or wav); other words = stale; no memory = kept", () => {
    const rel = planNarrationRel(CHILD, "en", "cover.mp3");
    const h = req("cover.mp3").textHash;
    expect(storedPlanNarration(docWith([rel], { [rel]: h }), CHILD, "en", "cover.mp3", h)).toBe(rel);
    const wav = rel.replace(/\.mp3$/, ".wav");
    expect(storedPlanNarration(docWith([wav], { [wav]: h }), CHILD, "en", "cover.mp3", h)).toBe(wav);
    expect(storedPlanNarration(docWith([rel], { [rel]: req("cover.mp3", "Noa").textHash }), CHILD, "en", "cover.mp3", h)).toBeNull();
    expect(storedPlanNarration(docWith([rel], {}), CHILD, "en", "cover.mp3", h)).toBe(rel);
    expect(storedPlanNarration(docWith([], {}), CHILD, "en", "cover.mp3", h)).toBeNull();
    expect(storedPlanNarration(null, CHILD, "en", "cover.mp3", h)).toBeNull();
  });

  it("complete = every file of the folder stored with the current words; a renamed child makes the name files stale only", () => {
    const files = planNarrationFiles(book, "en").map((f) => f.file);
    const rels = files.map((f) => planNarrationRel(CHILD, "en", f));
    const text = Object.fromEntries(files.map((f, i) => [rels[i], req(f).textHash]));
    const doc = docWith(rels, text);
    expect(planNarrationComplete(doc, book, CHILD, "en", "Maya")).toBe(true);
    expect(planNarrationComplete(doc, book, CHILD, "en", "Noa")).toBe(false);
    const stale = files.filter((f) => !storedPlanNarration(doc, CHILD, "en", f, req(f, "Noa").textHash));
    expect(stale).toEqual(["cover.mp3", "p8.mp3"]);
    expect(planNarrationComplete(docWith(rels.slice(1), text), book, CHILD, "en", "Maya")).toBe(false);
    expect(planNarrationComplete(doc, book, CHILD, "he-m", "Maya")).toBe(false);
  });

  it("the client's key changes with the folder, the name or a plan's words, and with nothing else", () => {
    const a = planNarrationConfiguration([book], "en", "Maya");
    expect(planNarrationConfiguration([book], "en", "Maya")).toBe(a);
    expect(planNarrationConfiguration([book], "he-f", "Maya")).not.toBe(a);
    expect(planNarrationConfiguration([book], "en", "Noa")).not.toBe(a);
    expect(planNarrationConfiguration([], "en", "Maya")).not.toBe(a);
    const other = getPlanFixtureBook("plan-sleep-alone--demo")!;
    expect(planNarrationConfiguration([book, other], "en", "Maya")).toBe(planNarrationConfiguration([other, book], "en", "Maya"));
  });
});

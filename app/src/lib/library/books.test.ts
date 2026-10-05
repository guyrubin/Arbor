/**
 * B-BOOK-02 — the authored books are complete, bounded and every path ends.
 * Runs on every book the library knows (real + the Abram fixture): every page
 * has EN + HE m + HE f, every plate is registered (window, variants, focus
 * rects), every slot and repair item sits inside the plate, words per page are
 * capped (EN <= 40, HE <= 34 — RULINGS BR9; echo, closing and after-repair
 * text included), the decision offers exactly 3 typed choices of 1-2 branch
 * pages with a picture each, only the EASY branch repairs, and all three
 * paths reach the same ending. Plus the fixture's lane A specifics (C8 fix).
 */
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { allBooks, BOOK_PLATES, DEFAULT_REVIEW_BOOK, getLibraryBook, getPlate, LIBRARY_BOOKS } from "./books";
import { abramsLongRoad } from "./books/abramsLongRoad";
import { ART_PENDING, fiveSmoothStones, fiveSmoothStonesGeometry, GEOMETRY_FALLBACKS } from "./books/fiveSmoothStones";
import { readFileSync as readJson, existsSync } from "node:fs";
import { readPath } from "./bookFlow";
import type { Book, BookLine, Page, Slot } from "./types";

const here = path.dirname(fileURLToPath(import.meta.url));
const iconSubset = new Set(
  readFileSync(path.join(here, "..", "..", "..", "public", "fonts", "material-symbols-rounded-subset.icons.txt"), "utf8")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean),
);

/** The Abram fixture is not polished further (RULINGS BR1); its two HE pages
 *  over the BR9 cap are frozen here so the cap stays strict for real books.
 *  FROZEN: entries may only shrink. */
const FIXTURE_HE_OVER: Record<string, Record<string, number>> = { "abrams-long-road": { p3: 35, p4: 36 } };
/** Manuscript v2 p9 (depth-pass-david.md §3): its §3.1 says 40 EN words, a
 *  whitespace count gives 41 ("…The giant fell. BOOM."). Held exactly as
 *  written, flagged to Fable (BUILD-LOG v2). FROZEN: entries may only shrink. */
const MANUSCRIPT_EN_OVER: Record<string, Record<string, number>> = { "five-smooth-stones": { p9: 41 } };

const words = (text: string) => text.split(/\s+/).filter((w) => /[\p{L}\p{N}]|\{hero\}/u.test(w)).length;

function allPages(book: Book): Page[] {
  return [book.cover, ...book.pages, ...book.decision.choices.flatMap((c) => c.branch)];
}

function lines(page: Page): BookLine[] {
  const tapLines = (page.repair?.items ?? []).map((it) => it.line).filter((l): l is BookLine => !!l);
  return [page.text, ...Object.values(page.echo ?? {}), ...(page.closing ? [page.closing] : []), ...(page.repair ? [page.repair.textAfter] : []), ...tapLines];
}

function slots(page: Page): Slot[] {
  return [page.hero, page.repair?.heroAfter].filter((s): s is Slot => !!s);
}

describe.each(allBooks())("book $id", (book) => {
  it("is registered under its own id", () => {
    expect(getLibraryBook(book.id)).toBe(book);
    expect(getLibraryBook("no-such-book")).toBeUndefined();
    expect(getLibraryBook("constructor")).toBeUndefined();
  });

  it("every page has EN + HE m + HE f text (echo, closing and after-repair lines too)", () => {
    for (const page of allPages(book)) {
      for (const line of lines(page)) {
        expect(line.en.trim(), `${page.id} EN`).not.toBe("");
        expect(line.he.m.trim(), `${page.id} HE m`).not.toBe("");
        expect(line.he.f.trim(), `${page.id} HE f`).not.toBe("");
        expect(/[֐-׿]/.test(line.he.m) && /[֐-׿]/.test(line.he.f), `${page.id} HE is Hebrew`).toBe(true);
        expect(/[֐-׿]/.test(line.en), `${page.id} EN carries no Hebrew`).toBe(false);
      }
    }
    expect(book.title.en && book.title.he && book.coverLine.en && book.coverLine.he).toBeTruthy();
  });

  it("page ids are unique across the linear pages and every branch", () => {
    const ids = allPages(book).map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every plateId is registered at the 3:2 master size, with a window, valid variants and focus rects", () => {
    for (const page of allPages(book)) {
      const plate = getPlate(book.id, page.plateId);
      expect(plate, `${page.id} → ${page.plateId}`).toBeDefined();
      // 3:2 masters (the delivered 2K plates are 2528x1696 / 2048x1374 = 1.4906)
      expect(Math.abs(plate!.width / plate!.height - 1.5)).toBeLessThan(0.01);
      expect(plate!.file).toBe(`/visuals/books/${book.id}/${page.plateId}.webp`);
      expect(plate!.window.cx).toBeGreaterThanOrEqual(0);
      expect(plate!.window.cx).toBeLessThanOrEqual(1);
    }
    for (const plate of Object.values(BOOK_PLATES[book.id])) {
      if (plate.variantOf) expect(BOOK_PLATES[book.id][plate.variantOf], `${plate.id} variantOf`).toBeDefined();
      for (const [cid, r] of Object.entries(plate.focus ?? {})) {
        expect(book.decision.choices.some((c) => c.id === cid), `${plate.id} focus ${cid}`).toBe(true);
        expect(r.x >= 0 && r.y >= 0 && r.w > 0 && r.h > 0 && r.x + r.w <= 1 && r.y + r.h <= 1, `${plate.id} focus ${cid} inside`).toBe(true);
      }
    }
  });

  it("every slot and repair item is inside the plate (0..1); slots keep head room; poses are path-safe ids", () => {
    for (const page of allPages(book)) {
      if (page.phoneCrop != null) {
        expect(page.phoneCrop, page.id).toBeGreaterThanOrEqual(0);
        expect(page.phoneCrop, page.id).toBeLessThanOrEqual(1);
      }
      for (const s of slots(page)) {
        expect(s.pose, page.id).toMatch(/^[A-Za-z0-9_-]+$/);
        for (const v of [s.x, s.y]) {
          expect(v, page.id).toBeGreaterThan(0);
          expect(v, page.id).toBeLessThan(1);
        }
        expect(s.scale, page.id).toBeGreaterThan(0);
        expect(s.scale, page.id).toBeLessThan(1);
        expect(s.y - s.scale, `${page.id} head inside the plate`).toBeGreaterThan(0);
        expect(["left", "right"]).toContain(s.facing);
      }
      for (const it of page.repair?.items ?? []) {
        for (const v of [it.x, it.y, it.to?.x ?? 0.5, it.to?.y ?? 0.5]) {
          expect(v, `${page.id} ${it.id}`).toBeGreaterThan(0);
          expect(v, `${page.id} ${it.id}`).toBeLessThan(1);
        }
      }
    }
  });

  it("words per page (echo, closing and after-repair text included): EN <= 40, HE <= 34 (RULINGS BR9)", () => {
    const count = (page: Page, pick: (l: BookLine) => string) => {
      const echoMax = Math.max(0, ...Object.values(page.echo ?? {}).map((e) => words(pick(e))));
      const taps = (page.repair?.items ?? []).reduce((n, it) => n + (it.line ? words(pick(it.line)) : 0), 0);
      return words(pick(page.text)) + echoMax + (page.closing ? words(pick(page.closing)) : 0) + (page.repair ? words(pick(page.repair.textAfter)) : 0) + taps;
    };
    for (const page of allPages(book)) {
      const en = count(page, (l) => l.en);
      expect(en, `${page.id}: ${en} EN words`).toBeLessThanOrEqual(MANUSCRIPT_EN_OVER[book.id]?.[page.id] ?? 40);
      for (const g of ["m", "f"] as const) {
        const he = count(page, (l) => l.he[g]);
        expect(he, `${page.id}: ${he} HE-${g} words`).toBeLessThanOrEqual(FIXTURE_HE_OVER[book.id]?.[page.id] ?? 34);
      }
    }
  });

  it("the decision offers exactly 3 typed choices, each with 1-2 branch pages, a <= 5-word label and a picture", () => {
    const { choices, pageId } = book.decision;
    const decisionPage = book.pages.find((p) => p.id === pageId);
    expect(decisionPage).toBeDefined();
    const decisionPlate = getPlate(book.id, decisionPage!.plateId)!;
    expect(choices).toHaveLength(3);
    expect(choices.map((c) => c.type).sort()).toEqual(["easy", "hard", "third"]);
    for (const c of choices) {
      expect(c.branch.length).toBeGreaterThanOrEqual(1);
      expect(c.branch.length).toBeLessThanOrEqual(2);
      expect(words(c.label.en)).toBeLessThanOrEqual(5);
      expect(words(c.label.he)).toBeLessThanOrEqual(6);
      // a focus crop of the decision plate, else a shipped icon
      expect(!!decisionPlate.focus?.[c.id] || !!c.icon, `${c.id} has a picture`).toBe(true);
      if (c.icon) expect(iconSubset.has(c.icon), `${c.icon} is in the shipped icon subset`).toBe(true);
    }
    // Branches differ by at most one page (length never signals the answer).
    const lens = choices.map((c) => c.branch.length);
    expect(Math.max(...lens) - Math.min(...lens)).toBeLessThanOrEqual(1);
  });

  it("all three paths reach the same rejoin page and the same ending", () => {
    const endings = new Set<string>();
    for (const c of book.decision.choices) {
      const ids = readPath(book, c.id).map((p) => p.id);
      expect(ids).toContain(book.decision.pageId);
      expect(ids).toContain(book.rejoinPageId);
      expect(ids.indexOf(book.rejoinPageId)).toBe(ids.indexOf(c.branch[c.branch.length - 1].id) + 1);
      endings.add(ids[ids.length - 1]);
    }
    expect(endings.size).toBe(1);
    // Before a choice the path stops at the decision page.
    const open = readPath(book, null).map((p) => p.id);
    expect(open[open.length - 1]).toBe(book.decision.pageId);
  });

  it("the rejoin page and the last page carry one echo line per choice", () => {
    const last = book.pages[book.pages.length - 1];
    const rejoin = book.pages.find((p) => p.id === book.rejoinPageId)!;
    for (const p of [rejoin, last]) {
      expect(Object.keys(p.echo ?? {}).sort()).toEqual(book.decision.choices.map((c) => c.id).sort());
      for (const e of Object.values(p.echo!)) expect(words(e.en)).toBeLessThanOrEqual(12);
    }
  });

  it("the EASY branch has one repair page, THIRD at most one tap page, HARD none; items unique and >= 1", () => {
    for (const c of book.decision.choices) {
      const repairs = c.branch.filter((p) => p.repair);
      if (c.type === "easy") expect(repairs.length, c.id).toBe(1);
      else if (c.type === "third") expect(repairs.length, c.id).toBeLessThanOrEqual(1);
      else expect(repairs.length, c.id).toBe(0);
      for (const p of repairs) {
        const ids = p.repair!.items.map((it) => it.id);
        expect(ids.length).toBeGreaterThanOrEqual(1);
        expect(new Set(ids).size).toBe(ids.length);
      }
    }
    expect(book.pages.some((p) => p.repair)).toBe(false);
  });

  it("Hebrew is NFC-normalised (nikud kept as written)", () => {
    for (const page of allPages(book)) for (const l of lines(page)) for (const t of [l.he.m, l.he.f]) expect(t, page.id).toBe(t.normalize("NFC"));
    expect(book.title.he).toBe(book.title.he.normalize("NFC"));
  });

  it("fix round 2: every pose id the book names exists in every hero-sheet manifest under test fixtures", () => {
    const fixtures = readdirSync(path.join(here, "__fixtures__")).filter((f) => f.endsWith(".manifest.json"));
    expect(fixtures.length).toBeGreaterThan(0);
    const poses = new Set(allPages(book).flatMap((p) => [...slots(p), ...Object.values(p.heroAlt ?? {})].map((s) => s.pose)));
    for (const f of fixtures) {
      const man = JSON.parse(readFileSync(path.join(here, "__fixtures__", f), "utf8")) as { poses: Record<string, unknown> };
      for (const pose of poses) expect(Object.keys(man.poses), `${f} lacks ${pose}`).toContain(pose);
    }
  });

  it("the parent panel is complete in both languages (v1: builds + why; v2: knows + whyNow + tomorrow)", () => {
    const pp = book.parent;
    const sections = pp.knows ? [pp.knows, pp.whyNow, pp.tomorrow] : [pp.builds, pp.why];
    for (const l of [...sections, pp.sourceNote, ...(pp.together ? [pp.together] : [])]) expect(l && l.en && l.he).toBeTruthy();
    expect(pp.askAfter.en && pp.askAfter.he.m && pp.askAfter.he.f).toBeTruthy();
  });

  it("every pose fallback points at a pose the fixture sheets have", () => {
    const fixtures = readdirSync(path.join(here, "__fixtures__")).filter((f) => f.endsWith(".manifest.json"));
    for (const f of fixtures) {
      const man = JSON.parse(readFileSync(path.join(here, "__fixtures__", f), "utf8")) as { poses: Record<string, unknown> };
      for (const to of Object.values(book.poseFallbacks ?? {})) expect(Object.keys(man.poses), `${f} lacks ${to}`).toContain(to);
    }
  });
});

describe("Five Smooth Stones (the proof) — manuscript specifics", () => {
  const book = fiveSmoothStones;
  const pagesOf = allPages(book);
  const byId = Object.fromEntries(pagesOf.map((p) => [p.id, p]));

  it("is the default review book and a real library book", () => {
    expect(DEFAULT_REVIEW_BOOK).toBe(book.id);
    expect(LIBRARY_BOOKS[book.id]).toBe(book);
  });

  it("manuscript v2: read paths are 11 / 12 / 12 screens (cover included); p3b sits between p3 and p4", () => {
    const screens = (cid: string) => 1 + readPath(book, cid).length;
    expect(screens("a")).toBe(11);
    expect(screens("b")).toBe(12);
    expect(screens("c")).toBe(12);
    expect(book.pages.map((p) => p.id)).toEqual(["p1", "p2", "p3", "p3b", "p4", "p5", "p8", "p9", "p10"]);
    expect(book.decision.choices.find((c) => c.id === "c")!.label).toEqual({ en: "Wait for someone bigger", he: "לחכות למישהו גדול יותר" });
    expect(book.coverLine).toEqual({ en: "Everyone ran. One shepherd went.", he: "כולם ברחו. רועה אחד הלך." });
  });

  it("manuscript v2: p4 = stand-tall-hand, p6c = sit-hunched, p7c ENDS on David standing (stand-tall); stopgaps named until round 3", () => {
    expect(byId.p4.hero!.pose).toBe("stand-tall-hand");
    expect(byId.p6c.hero!.pose).toBe("sit-hunched");
    expect(byId.p7c.hero!.pose).toBe("sit-hunched");
    expect(byId.p7c.repair!.heroAfter!.pose).toBe("stand-tall");
    expect(book.poseFallbacks).toEqual({ "stand-tall-hand": "look-up", "stand-tall": "look-up", "sit-hunched": "sit" });
  });

  it("manuscript v2: p9 has ordered art states - the dust on the narration cue, then 'the soldiers rise' once PL7-rise is delivered", () => {
    const states = byId.p9.artStates!;
    expect(states[0]).toEqual({ id: "dust", overlays: ["dust-cloud"], trigger: "narration" });
    if (fiveSmoothStonesGeometry.plates["PL7-rise"]) {
      expect(states[1]).toMatchObject({ id: "rise", plateId: "PL7-rise", overlays: [], trigger: { afterMs: 2000, silentAfterMs: 3000 } });
      expect(getPlate(book.id, "PL7-rise")).toBeDefined();
    } else expect(states).toHaveLength(1);
  });

  it("manuscript v2: p3b waits for round 3 (PL3 + look-across stand in) until its geometry lands", () => {
    if (fiveSmoothStonesGeometry.pages.p3b) {
      expect(ART_PENDING.size).toBe(0);
      expect(byId.p3b.plateId).toBe("PL3e");
    } else {
      expect([...ART_PENDING]).toEqual(["p3b"]);
      expect(byId.p3b.plateId).toBe("PL3");
      expect(byId.p3b.hero!.pose).toBe("look-across");
    }
  });

  it("page types: spread for the cover, p5, p9, p10; facing elsewhere", () => {
    const spreads = pagesOf.filter((p) => p.type === "spread").map((p) => p.id).sort();
    expect(spreads).toEqual(["cover", "p10", "p5", "p9"]);
  });

  it("round 3 (v2): the plates the pages name, the edits, and the poses", () => {
    expect(new Set(pagesOf.map((p) => p.plateId))).toEqual(new Set(["PL1", "PL1b", "PL1d", "PL3", "PL3e", "PL3w2", "PL3w3", "PL4", "PL4e", "PL6", "PL7"]));
    const variants = Object.values(BOOK_PLATES[book.id]).filter((p) => p.variantOf).map((p) => p.id).sort();
    // + PL3w (the r2 day plate, now unused), PL7-dust (registered, unused) and PL7-rise (p9's third art state)
    expect(variants).toEqual(["PL1b", "PL1d", "PL3e", "PL3w", "PL3w2", "PL3w3", "PL4e", "PL7-dust", "PL7-rise"]);
    const poses = new Set(pagesOf.flatMap((p) => slots(p).map((s) => s.pose)));
    // the art agent's poses (LOG.md §1 + Round 2): left-facing variants keep the
    // key light upper-left; round 2 added look-across (cover), sling-swing-face-right (p9), squat-look (p8)
    // v2: stand-tall-hand (p4), sit-hunched (p6c, p7c), stand-tall (p7c after)
    expect([...poses].sort()).toEqual(["armour-stuck", "free-stretch", "look-across", "look-up", "run-staff", "run-staff-left", "sit", "sit-hunched", "sling-swing", "sling-swing-face-right", "squat-look", "stand-tall", "stand-tall-hand", "worried"]);
    expect(byId.p5.heroAlt?.tunic?.pose).toBe("worried-tunic");
    expect(Object.keys(getPlate(book.id, "PL4")!.focus ?? {}).sort()).toEqual(["a", "b", "c"]);
  });

  it("the name appears only on the cover name line and the p1 / p10 frame lines; HE-f differs only there", () => {
    const hasName = (t: string) => t.includes("{name}");
    const withName = pagesOf.filter((p) => lines(p).some((l) => hasName(l.en + l.he.m + l.he.f))).map((p) => p.id).sort();
    expect(withName).toEqual(["p1", "p10"]);
    expect(hasName(book.coverNameLine?.en ?? "")).toBe(true);
    for (const p of pagesOf) {
      for (const l of lines(p)) {
        if (l.he.m === l.he.f) continue;
        expect(["p1", "p10"], `${p.id} HE-f differs`).toContain(p.id);
      }
    }
    expect(byId.p1.text.he.f).toContain("היא דוד");
    expect(byId.p10.closing!.he.f).toContain("הייתה דוד");
  });

  it("p7b repairs by three taps (helmet, coat, sword) with a line each; p7c by one 'Stand up!'", () => {
    // fix round 1: a fixed order, helmet → sword → coat
    expect(byId.p7b.repair!.ordered).toBe(true);
    expect(byId.p7b.repair!.items.map((it) => it.id)).toEqual(["helmet", "sword", "coat"]);
    expect(byId.p7b.repair!.items.every((it) => it.line)).toBe(true);
    expect(byId.p7b.repair!.heroAfter!.pose).toBe("free-stretch");
    // v2 text order is helmet, coat, sword; the engine keeps ruling 4's order (the coat last) - flagged to Fable
    expect(byId.p7c.repair!.items).toHaveLength(1);
    expect(byId.p7c.repair!.promptLabel).toEqual({ en: "Stand up!", he: "לקום!" });
    expect(byId.p6b.overlays!.map((o) => o.id).sort()).toEqual(["helmet-worn", "sword"]);
    expect(byId.p9.overlays!.find((o) => o.id === "dust-cloud")?.reveal).toBe("afterNarration");
    // p7b: each tap hides the worn piece and shows it on the heap
    const when = Object.fromEntries(byId.p7b.overlays!.map((o) => [o.id, o.showWhen]));
    expect(when).toEqual({
      "helmet-worn": { item: "helmet", done: false },
      "sword-rug": { item: "sword", done: false },
      "coat-heap": { item: "coat", done: true },
      "sword-heap": { item: "sword", done: true },
      "helmet-heap": { item: "helmet", done: true },
    });
    // round 2 restaged p8 (squat-look on the boulder): no hand in the water, no occluder
    expect(byId.p8.occluders).toBeUndefined();
  });

  it("geometry comes from the one geometry object (overwritable JSON)", () => {
    expect(byId.p1.hero).toMatchObject(fiveSmoothStonesGeometry.pages.p1.hero!);
    expect(getPlate(book.id, "PL4")!.focus).toEqual(fiveSmoothStonesGeometry.plates.PL4.focus);
  });

  it("no page, slot, item or plate falls back to placeholder geometry (v2 pages waiting for round 3 excepted, by name)", () => {
    expect([...GEOMETRY_FALLBACKS]).toEqual([]);
    for (const p of pagesOf) {
      if (!ART_PENDING.has(p.id)) expect(fiveSmoothStonesGeometry.pages[p.id]?.hero, `${p.id} hero`).toBeDefined();
      expect(p.phoneCrop, `${p.id} window`).toBeDefined();
      if (p.type === "spread") expect(p.textRect, `${p.id} text rect`).toBeDefined();
    }
    expect(Object.keys(getPlate(book.id, "PL4")!.focus ?? {}).sort()).toEqual(["a", "b", "c"]);
  });

  it("every plate and overlay file the book names is shipped in public/ (child-free, committed)", () => {
    const pub = path.join(here, "..", "..", "..", "public");
    for (const p of pagesOf) {
      const plate = getPlate(book.id, p.plateId)!;
      const f = path.join(pub, plate.file);
      expect(existsSync(f), plate.file).toBe(true);
      // the registered size is the file's size (WebP VP8/VP8L/VP8X header)
      const b = readJson(f);
      expect(b.toString("ascii", 0, 4)).toBe("RIFF");
      for (const o of p.overlays ?? []) expect(existsSync(path.join(pub, o.file)), o.file).toBe(true);
    }
  });

  it("no divine name in the HE text (17:45 is quoted only in its first half)", () => {
    for (const page of pagesOf) for (const l of lines(page)) expect(`${l.he.m}${l.he.f}`).not.toMatch(/יהוה|יְהוָה|צְבָאוֹת/);
  });
});

describe("Abram's Long Road (engine fixture) — lane A specifics", () => {
  const p7b = abramsLongRoad.decision.choices.find((c) => c.id === "b")!.branch[1];

  it("C8 fix: p7b's before-text no longer says Abram is waiting (EN + HE m/f)", () => {
    expect(p7b.id).toBe("p7b");
    expect(p7b.text.en).toBe("{hero} stops. Everyone is waiting.");
    expect(p7b.text.en).not.toContain("Abram is waiting");
    expect(p7b.text.he.m).not.toContain("אברם מחכה");
    expect(p7b.text.he.f).not.toContain("אברם מחכה");
    expect(p7b.repair?.promptLabel).toEqual({ en: "Bring the goats!", he: "להביא את הגדיים!" });
    expect(p7b.repair?.items).toHaveLength(4);
  });

  it("uses the 9 plates of the ledger (§6.3) and 6 poses", () => {
    const used = new Set(allPages(abramsLongRoad).map((p) => p.plateId));
    expect([...used].sort()).toEqual(["P1b", "P1c", "P1e", "P1m", "P2", "P3", "P4", "P5", "P6"]);
    const poses = new Set(allPages(abramsLongRoad).flatMap((p) => slots(p).map((s) => s.pose)));
    expect([...poses].sort()).toEqual(["arms-wide", "run", "sit", "stand", "walk", "wave"]);
  });

  it("slots match the manuscript (spot checks)", () => {
    const byId = Object.fromEntries(allPages(abramsLongRoad).map((p) => [p.id, p]));
    expect(byId.cover.hero).toMatchObject({ pose: "walk", x: 0.3, y: 0.88, scale: 0.4 });
    expect(byId.p2.hero).toMatchObject({ pose: "stand", x: 0.18, y: 0.94, scale: 0.48, z: "fg" });
    expect(byId.p8.hero).toMatchObject({ pose: "arms-wide", x: 0.45, y: 0.8, scale: 0.34, facing: "left" });
    expect(byId.p10.hero).toMatchObject({ pose: "sit", x: 0.52, y: 0.9, scale: 0.36 });
  });

  it("God is never named in the HE text as the Tetragrammaton", () => {
    for (const page of allPages(abramsLongRoad)) for (const l of lines(page)) expect(`${l.he.m}${l.he.f}`).not.toMatch(/יהוה|יְהוָה/);
  });
});

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";

/* B-DESIGN-03 — #/milestones takes the P7-DESIGN blend frame
   (execution/2026-10-07--design-direction/option-ab-blend.html, frame 04;
   DESIGN-DIRECTION.md §Chosen rows 7, 11, 12; critics c2.r3 P2-12 / P2-13).

   1. The header collapses to the H1 on the hero step, ONE warm accent (the
      family's newest kept words, editorial, on the 2 px ink rule, the shelf
      and the day on their own t-sm line) and ONE muted t-sm line (latest ·
      day · count · Change). The green date chip is gone.
   2. The nine shelf glyphs (44 px duotone) form a jump rail under the header:
      navigation only — registry order, the shelf's own tint, the ring marks
      the shelf jumped to and nothing else.
   3. Every shelf row group leads with its duotone glyph + a SectionHead; no
      wash anywhere on the route (framer ruling).
   4. The answers are the ONE segmented control (NoticeCard answers="segmented").
   5. The fold: the stamp (`notice-milestone`, the first unanswered card's
      answers) stays above the 375 fold in EN + HE — a line model, owed to the
      rendered sweep (jsdom has no layout). */

const state = vi.hoisted(() => ({ lang: "en" as "en" | "he" }));
vi.mock("../../context/LanguageContext", async () => {
  const { translate } = await vi.importActual<typeof import("../../lib/i18n")>("../../lib/i18n");
  return {
    useLanguage: () => ({
      t: (k: string, v?: Record<string, string | number>) => translate(state.lang, k, v),
      uiLang: state.lang,
    }),
  };
});

import NoticeCard from "../loop/NoticeCard";
import { translate } from "../../lib/i18n";
import { ALL_MILESTONES, milestoneText } from "../../lib/milestoneData";
import { milestoneAgeLine } from "../../lib/milestoneAgeLine";
import { SHELF_IDS, shelfLabel } from "../../lib/shelves/registry";

const here = path.dirname(fileURLToPath(import.meta.url));
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/^\s*\/\/.*$/gm, "");
const MS = strip(readFileSync(path.join(here, "MilestonesTab.tsx"), "utf8").replace(/\r\n/g, "\n"));
const between = (from: string, to: string) => {
  const a = MS.indexOf(from);
  expect(a, from).toBeGreaterThan(-1);
  const b = MS.indexOf(to, a);
  expect(b, to).toBeGreaterThan(a);
  return MS.slice(a, b);
};
const decode = (html: string) => html.replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&amp;/g, "&");

describe("B-DESIGN-03 · the header: H1 + ONE warm accent + ONE muted line", () => {
  it("the H1 is the hero step; the date is plain text, never a chip", () => {
    expect(MS).toContain('<h1 className="arbor-type-hero min-w-0" style={{ color: "var(--arbor-ink)" }}>{t("ms.title")}</h1>');
    const line = between('<p data-testid="ms-latest"', "</p>");
    expect(line).not.toMatch(/green-soft|green-ink|rounded-full|font-editorial/);
    expect(line).toContain('<time data-testid="ms-latest-date"');
    // latest · area · day · count · Change, in that order, one paragraph
    const order = ["elev.ms.latest.lead", "ms-latest-area", "ms-latest-date", "ms-map-count", "{changeButton}"].map((k) => line.indexOf(k));
    expect(order.every((i) => i > -1)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it("ONE warm accent: the kept words on the ink rule, shelf + day on their own line; the first-open sentence only when there is no latest", () => {
    const head = between('data-testid="ms-header"', "{jumpRail}");
    expect(head).toContain('data-testid="ms-header-quote" className="arbor-accent-rule mt-3 min-w-0"');
    expect(head.match(/var\(--font-editorial\)/g)).toHaveLength(2); // the quote OR the first-open line, never both
    expect(head).toMatch(/\{headerQuote \? \(\s*<figure[\s\S]*\) : !latestNoticed \? \(/);
    // the order: H1 → accent → muted line → (Change answers) → jump rail
    const at = (s: string) => head.indexOf(s);
    expect(at("<h1")).toBeLessThan(at('data-testid="ms-header-quote"'));
    expect(at('data-testid="ms-header-quote"')).toBeLessThan(at("{latestLine}"));
    expect(at("{latestLine}")).toBeLessThan(MS.indexOf("{jumpRail}") - MS.indexOf('data-testid="ms-header"'));
  });

  it("one quote pair per locale (״…״ in HE), from i18n", () => {
    expect(translate("en", "elev.loop.ms.quoted", { text: "x" }).replace(/[⁨⁩]/g, "")).toBe("“x”");
    expect(translate("he", "elev.loop.ms.quoted", { text: "x" }).replace(/[⁨⁩]/g, "")).toBe("״x״");
    expect(MS).toContain("{quoted(headerQuote.text)}");
    expect(MS).toContain("{quoted(shelfWords[shelf]!.text)}");
    expect(MS).not.toContain('{"“"}');
  });
});

describe("B-DESIGN-03 · the jump rail is navigation only (firewall)", () => {
  const rail = between("const jumpRail = (", "</nav>");

  it("nine shelves in REGISTRY order, each a 44 px duotone glyph with its name as the accessible name", () => {
    expect(rail).toContain("{SHELF_IDS.map((shelf) => {");
    expect(rail).toContain("<ShelfGlyph shelf={shelf} />");
    expect(rail).toContain("aria-label={shelfLabel(shelf, t)}");
    expect(rail).toMatch(/className="flex min-h-11 min-w-11 flex-col/);
    expect(SHELF_IDS).toHaveLength(9);
  });

  it("the rail reads NO record state: no count, no answer, no action order, no held card, no words", () => {
    expect(rail).not.toMatch(/shelfCounts|recordCounts|noticeFor|mapShelves|heldNotice|observationStatus|\.checked|ownWords|shelfWords|quietShelves/);
    // the ring comes from the jump alone
    expect(rail).toContain("const on = jumpedTo === shelf;");
    expect(MS).toMatch(/const jumpTo = \(shelf: ShelfId\) => \{\s*setJumpedTo\(shelf\);/);
    expect(MS.match(/setJumpedTo\(/g)).toHaveLength(1);
  });

  it("search leads the rail (the map's 44 px icon, P5 r1 design P0); below sm the names live in the accessible name only", () => {
    expect(rail.indexOf('data-testid="ms-search-open"')).toBeLessThan(rail.indexOf("SHELF_IDS.map"));
    expect(rail.match(/className="hidden text-center t-xs font-semibold leading-tight sm:block"/g)).toHaveLength(2);
    expect(MS.match(/data-testid="ms-search-open"/g)).toHaveLength(1);
  });

  it("every jump lands on a target (the nine shelves: a map section, a quiet row or the quiet line)", () => {
    expect(MS).toContain("id={`ms-at-${shelf}`}");
    expect(MS).toContain("id={`ms-at-${q.shelf}`}");
    expect(MS).toContain('id="ms-at-quiet"');
    expect(MS).toContain('document.getElementById(`ms-at-${pendingJump}`) ?? document.getElementById("ms-at-quiet")');
  });
});

describe("B-DESIGN-03 · shelf rows: duotone glyph + section head; no wash on Milestones", () => {
  it("the duotone glyph from components/ui; every call carries the shelf alone (no count, no state, no wash)", () => {
    expect(MS).toContain('import { ShelfGlyph } from "../ui/ShelfGlyph";');
    expect(MS).not.toContain('from "../loop/ShelfGlyph"');
    const calls = MS.match(/<ShelfGlyph\b[^>]*\/>/g) ?? [];
    expect(calls.length).toBe(3); // rail · map rows · quiet rows
    for (const c of calls) expect(c).toMatch(/^<ShelfGlyph shelf=\{(?:shelf|q\.shelf)\} \/>$/);
  });

  it("no shelf wash on the route (framer ruling: never on Milestones)", () => {
    expect(MS).not.toMatch(/-wash\b|onWash/);
  });

  it("each map row group: glyph → SectionHead (h3, the label target) → count as text", () => {
    const row = between('data-testid="ms-shelf"', 'data-testid="ms-shelf-count"');
    expect(row).toContain("<ShelfGlyph shelf={shelf} />");
    expect(row).toContain('<SectionHead as="h3" id={`ms-shelf-${shelf}`} title={shelfLabel(shelf, t)} className="min-w-0 flex-1" />');
    expect(row.indexOf("<ShelfGlyph")).toBeLessThan(row.indexOf("<SectionHead"));
  });

  it("the same glyph markup for a shelf, whatever the shelf holds (the props carry no record input)", async () => {
    const { ShelfGlyph } = await import("../ui/ShelfGlyph");
    for (const shelf of SHELF_IDS) {
      const a = renderToStaticMarkup(<ShelfGlyph shelf={shelf} />);
      const b = renderToStaticMarkup(<ShelfGlyph shelf={shelf} />);
      expect(a).toBe(b);
      expect(a).not.toMatch(/wash/);
    }
  });
});

describe("B-DESIGN-03 · NoticeCard answers=\"segmented\"", () => {
  const m = ALL_MILESTONES.find((x) => x.id === "cdc-24m-1")!;
  const render = (lang: "en" | "he", answers?: "pills" | "segmented") => {
    state.lang = lang;
    return decode(renderToStaticMarkup(
      <NoticeCard milestone={m} shelf="words" childName="Noa" variant="row" hideShelf onAnswer={() => undefined} answersAttrs={{ "data-primary-move": "notice-milestone" }} {...(answers ? { answers } : {})} />,
    ));
  };

  for (const lang of ["en", "he"] as const) {
    it(`${lang}: the segmented control carries the stamp, three 44 px cells in the one order; no pills`, () => {
      const html = render(lang, "segmented");
      expect(html).toMatch(/data-testid="segmented-answers"[^>]*data-primary-move="notice-milestone"/);
      expect(html).not.toContain('data-testid="notice-answers"');
      const cells = [...html.matchAll(/<button[^>]*data-answer="([a-z_]+)"[^>]*>/g)];
      expect(cells.map((c) => c[1])).toEqual(["yes", "not_yet", "not_sure"]);
      for (const c of cells) expect(c[0]).toContain("min-h-[44px]");
      expect(html.match(/data-primary-move=/g)).toHaveLength(1);
    });
    it(`${lang}: the default stays the shipped pills (Today / Journal until B-DESIGN-04)`, () => {
      const html = render(lang);
      expect(html).toContain('data-testid="notice-answers"');
      expect(html).not.toContain('data-testid="segmented-answers"');
    });
  }

  it("every NoticeCard on #/milestones answers segmented", () => {
    expect(MS.match(/<NoticeCard\b/g)).toHaveLength(2);
    expect(MS.match(/answers="segmented"/g)).toHaveLength(2);
  });
});

/* The 375 × 812 line model. The fold on #/milestones is the dock's top edge,
   primaryMoveFoldY = 749 in the c2.r3 sweep (Arbor/sweeps/P5-LOOP-c2.r3,
   every 375 cell); the product critic's P2-6 asks for a 16 px margin, so the
   bound is 733. The header starts at y 183 at 375 (c2.r3 render, the shell
   strip + sub-tab pills + hub line above it; this item does not touch them).
   Widths: 375 − 2 × 16 gutter = 343 for the header lines (327 inside the
   accent rule); the map card's content is 343 − 2 × 16 = 311. Average
   advance per character is GENEROUS on purpose (display/body 0.5 em, the
   editorial face with its size-adjust 0.45 em; Hebrew uses the same, a
   conservative bound). The demo state is the c2.r3 base: Dylan, the kept
   line "Sang the whole bath song on his own" (Feelings, yesterday), latest
   "Jumps off the ground" (Moving, 3 Oct), 10 noticed, the stamp on Words'
   "Talks well enough to be understood" under its kept epigraph.
   OWED to the rendered sweep: primaryMove rect bottom ≤ 733 on #/milestones
   375 EN + HE (base, not-sure, quiet-shelves, loop-first-open). */
const FOLD_375 = 749;
const FOLD_LIMIT = FOLD_375 - 16;
const HEADER_TOP_375 = 183;
const lines = (text: string, px: number, width: number, em = 0.5) => Math.max(1, Math.ceil((text.length * px * em) / width));
const T_SM = 13, T_BASE = 15, T_LG = 19;

function stampBottom(lang: "en" | "he", opts: { quote: boolean; latest: boolean }) {
  const t = (k: string, v?: Record<string, string | number>) => translate(lang, k, v).replace(/[⁨⁩]/g, "");
  const g = { gender: "boy" };
  const latest = ALL_MILESTONES.find((x) => x.title === "Jumps off the ground")!;
  const card = ALL_MILESTONES.find((x) => x.title === "Talks well enough to be understood")!;
  expect(latest && card).toBeTruthy();
  let y = HEADER_TOP_375 + 52; // HeroAvatar 52 beside the hero H1 (34 × 1.08 = 37 px fits the row)
  if (opts.quote) {
    const quote = t("elev.loop.ms.quoted", { text: lang === "he" ? "שר לבד את כל שיר האמבטיה" : "Sang the whole bath song on his own" });
    y += 12 + lines(quote, T_LG, 327, 0.45) * T_LG * 1.375; // mt-3 + the words (t-lg, leading-snug)
    y += 4 + T_SM * 1.375; // figcaption: shelf · day
  } else if (!opts.latest) {
    const first = t("elev.loop.ms.firstCard", { name: "Dylan", title: milestoneText(card, "title", t, g) });
    y += 12 + lines(first, T_LG, 343, 0.45) * T_LG * 1.375;
  }
  if (opts.latest) {
    const muted = [
      `${t("elev.ms.latest.lead", { name: "Dylan" })} ${milestoneText(latest, "title", t, g)}`,
      t("elev.ms.latest.area", { area: shelfLabel("moving", t) }),
      lang === "he" ? "3 באוק׳" : "3 Oct",
      `10 ${t("ms.domainOf")}`,
      t("elev.loop.latest.change"),
    ].join(" · ");
    y += 8 + lines(muted, T_SM, 343) * T_SM * 1.375; // mt-2 + the ONE muted line (Change's 44 px box rides -my-3)
  }
  y += 12 + 4 + 44 + 4; // the jump rail: mt-3, py-1, 44 px glyphs (names in the accessible name below sm)
  y += 20; // the root's gap-5
  y += 16 + 4 + 12; // card p-4 (the h2 is sr-only below sm) · the map's mt-1 · the first section's py-3
  y += 44; // glyph + SectionHead row
  if (opts.quote || opts.latest) y += 8 + T_SM * 1.375; // the shelf's kept epigraph (one truncated line)
  y += 12; // the Notice row's py-3
  y += 2 + lines(milestoneText(card, "title", t, g), T_LG, 311) * T_LG * 1.25; // title, leading-tight
  const looks = milestoneText(card, "looks", t, g) || milestoneText(card, "desc", t, g);
  y += 4 + lines(looks, T_BASE, 311) * T_BASE * 1.375;
  if (milestoneAgeLine(card, t)) y += 6 + T_SM * 1.375;
  y += 12 + 4 + 44; // mt-3 + the segmented track's padding + the 44 px cells
  return Math.round(y);
}

describe("B-DESIGN-03 · the stamp stays above the 375 fold (line model, EN + HE)", () => {
  it("the source matches the model: header order, rail names hidden below sm, the map h2 sr-only below sm, the stamp on the first unanswered card", () => {
    expect(MS).toContain('<nav data-testid="ms-jump-rail" aria-labelledby="ms-map-title" className="no-scrollbar -mx-4 mt-3 overflow-x-auto px-4 py-1 sm:mx-0 sm:px-0">');
    expect(MS).toContain('<h2 id="ms-map-title" className="arbor-type-title sr-only sm:not-sr-only"');
    expect(MS).toContain('<HeroAvatar size={52}');
    expect(MS).toContain('className="-my-3 inline-flex min-h-11 items-center align-middle t-sm font-semibold"');
    expect(MS).toContain("const stampShelf = mapShelves.find((id) => noticeFor(id) && !heldNotice[id]);");
    expect(MS).toMatch(/answersAttrs=\{shelf === stampShelf \? \{ "data-primary-move": "notice-milestone" \} : undefined\}/);
  });

  for (const lang of ["en", "he"] as const) {
    it(`${lang}: base (kept words + latest) — stamp bottom ≤ ${FOLD_LIMIT}`, () => {
      expect(stampBottom(lang, { quote: true, latest: true })).toBeLessThanOrEqual(FOLD_LIMIT);
    });
    it(`${lang}: latest without kept words — stamp bottom ≤ ${FOLD_LIMIT}`, () => {
      expect(stampBottom(lang, { quote: false, latest: true })).toBeLessThanOrEqual(FOLD_LIMIT);
    });
    it(`${lang}: first open (one editorial sentence) — stamp bottom ≤ ${FOLD_LIMIT}`, () => {
      expect(stampBottom(lang, { quote: false, latest: false })).toBeLessThanOrEqual(FOLD_LIMIT);
    });
  }
});

/**
 * R17 / LC-05 residue — the Academy hub leads with COURSES on a phone.
 *
 * MEASURED at 390 in round 2b: the first course card's top was 1,675 px
 * (acceptance < 1,500). LC-05 had already deleted two kid-register tiles, but
 * the remaining distance was structural, not content: the two-column shell
 * collapses to one column below `xl`, and the left column is the Learning Map
 * rail — spine ribbon, Academy For You, Scholar Hub, the charter strip and the
 * catalogue progress bar. Five modules that are not courses, stacked between
 * the hero and the catalogue, on the surface whose one job is courses.
 *
 * The fix is order, not deletion (law 6): the gallery is FIRST in the document
 * and returns to the right-hand column at `xl` via `order-*`, and below `md`
 * the rail becomes a single collapsed `<details>` BELOW the gallery. The rail
 * is declared once (`railStack`) and rendered in exactly one of the two slots,
 * so the phone and the desktop can never drift into two different rails.
 *
 * These are source assertions: the acceptance is a rendered pixel measurement
 * the worktree cannot take, so what is pinned here is the structure that
 * produces it. The 390 px re-measure belongs to the orchestrator.
 *
 * v3 F-FORYOU-1 re-pins this file to "rail absent": the mock removes the rail
 * outright (its signals become ranking inputs), so the order/disclosure
 * mechanics above have nothing left to order. What stays pinned: nothing but
 * the pick (and the short reads) before the library, no scorekeeping, the
 * phone seam, one h1.
 */
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { en, he } from "../../lib/i18n";

const SRC = path.resolve(__dirname, "..", "..");
const source = fs.readFileSync(path.join(SRC, "components", "sections", "Masterclasses.tsx"), "utf8");

/** The main component's returned JSX only — `railStack` and `spineRibbon` are
 *  declared ABOVE it, and the Reader component's markup lives below it, so a
 *  whole-file index comparison would answer a different question. */
function hubBody(src: string): string {
  const start = src.indexOf("  return (");
  const end = src.indexOf("export function MasterclassReader(");
  expect(start, "the hub's return was not found").toBeGreaterThan(-1);
  expect(end, "the Reader component was not found").toBeGreaterThan(start);
  return src.slice(start, end);
}

/** v3 F-FORYOU-1 (re-pin): the rail is REMOVED, not reordered. Academy For
 *  You, Scholar Hub, the charter strip and the phone `<details>` that held
 *  them are gone; their signals rank the pick and the catalogue. The predicate
 *  the acceptance rests on is now: the library exists, and no rail or
 *  disclosure stands anywhere on the hub to push it down a phone. */
function libraryLeads(src: string): boolean {
  const body = hubBody(src);
  if (body.indexOf('data-testid="academy-courses"') < 0) return false;
  return !body.includes('data-testid="academy-rail"')
    && !body.includes('data-testid="academy-rail-disclosure"')
    && !body.includes("<details");
}

describe("R17 · the Academy hub opens on courses", () => {
  it("the library is there and no rail or disclosure exists on the hub (v3 F-FORYOU-1: rail absent)", () => {
    expect(libraryLeads(source)).toBe(true);
  });

  it("NEGATIVE CONTROL: a rail put back before the gallery fails the same predicate", () => {
    // Reproduce what shipped: the rail column emitted before the gallery. The
    // predicate must reject it, or it is not measuring anything.
    const body = hubBody(source);
    const gallery = body.indexOf('data-testid="academy-courses"');
    const preFix = source.replace(
      body,
      body.slice(0, gallery) +
        '<div data-testid="academy-rail">…</div>' +
        body.slice(gallery),
    );
    expect(libraryLeads(preFix)).toBe(false);
  });

  it("nothing that is not a course stands between the hero and the gallery", () => {
    const body = hubBody(source);
    const between = body.slice(
      body.indexOf('data-testid="academy-hub-hero"'),
      body.indexOf('data-testid="academy-courses"'),
    );
    // The hero, the pick why-line and the catalogue header may stand here.
    // The rail's five modules may not.
    for (const module of ["<AcademyForYou", "<ScholarHubCard", "{railStack}", "master.progress.count"]) {
      expect(between, `${module} is still above the gallery`).not.toContain(module);
    }
    // B-PLAY-18: no spine ribbon, no stat list, no completion bar — the
    // hero, the pick (title, why-line, minutes) and the gallery only.
    expect(between).not.toContain("academy-spine");
    expect(between).not.toContain("{spineRibbon}");
    expect(between).not.toContain("<SpineRibbon");
    expect(between).not.toContain("heroStats");
    expect(between).toContain('data-testid="academy-pick-minutes"');
  });

  it("B-PLAY-18: no scorekeeping anywhere on the hub — no stat list, no completion bar, no academy-spine module", () => {
    expect(source).not.toMatch(/const heroStats = \[/);
    expect(source).not.toContain("master.progress.count");
    expect(source).not.toContain("master.progress.all");
    expect(source).not.toMatch(/doneCount \/ total/);
    expect(source).not.toContain('data-module="academy-spine"');
    // "Done" stays on each card.
    expect(source).toContain('t("master.done")');
    // NEGATIVE CONTROL: the shipped bar trips the same rule.
    expect('style={{ width: `${(doneCount / total) * 100}%`').toMatch(/doneCount \/ total/);
  });

  // v3 F-FORYOU-1 (re-pin): one column set. The library grid is two columns
  // from sm and three at xl; the pick card splits at lg. No rail column and no
  // order-* swap remain.
  it("one responsive column set: the library grid, no rail column, no order swap", () => {
    expect(source).toContain('<div className="grid gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-3">');
    expect(source).toContain('data-module="academy-catalogue" data-testid="academy-courses"');
    expect(source).not.toContain("xl:grid-cols-[minmax(0,1fr)_minmax(0,1.7fr)]");
    expect(source).not.toMatch(/\border-[12]\b/);
    // NEGATIVE CONTROL: the shipped swap is caught by the same rule.
    expect('className="space-y-4 min-w-0 order-1 xl:order-2"').toMatch(/\border-[12]\b/);
  });

  // v3 F-FORYOU-1 (re-pin): there is no rail left to declare or to place.
  it("no rail declaration and no phone/desktop slots", () => {
    expect(source).not.toMatch(/const railStack = \(/);
    expect(source).not.toContain("{railStack}");
    const body = hubBody(source);
    expect(body).not.toContain("{!phone && (");
    expect(body).not.toContain("{phone && (");
    expect(body).not.toContain("<details");
  });

  it("the phone seam is a media query, not a device sniff", () => {
    expect(source).toContain('const PHONE_QUERY = "(max-width: 767.98px)"');
    expect(source).toContain("useSyncExternalStore(subscribePhone, readPhone, () => false)");
  });

  // v3 F-FORYOU-1 (re-pin): the disclosure left with the rail. Its string
  // stays translated; no <summary> is rendered on the hub.
  it("the disclosure's string stays translated; no summary renders on the hub", () => {
    expect(en["academy.rail.more"]).toBeTruthy();
    expect(he["academy.rail.more"]).toBeTruthy();
    expect(he["academy.rail.more"]).not.toBe(en["academy.rail.more"]);
    // Hebrew is transcreated, not transliterated: it must be Hebrew script.
    expect(he["academy.rail.more"]).toMatch(/[֐-׿]/);
    expect(source).not.toMatch(/<summary[\s>]/);
  });
});

describe("W2 — reading catalogue hierarchy", () => {
  it("has one catalogue h1 and no decorative course roof", () => {
    const body = hubBody(source);
    expect(body.match(/<h1[\s>]/g)).toHaveLength(1);
    expect(body).not.toContain("height: 74");
    expect(body).not.toContain("<ProgressBar");
    expect(body.indexOf("todaysRead.card.title")).toBeLessThan(body.indexOf('data-testid="academy-hero-cta"'));
    expect(body).toContain("catalog.map((c)");
  });
});

/* W2-SHELLPLAY critic r2 (G0): the rail heading said "Learning Map — Courses
 * matched to where Dylan is growing." over the no-signal branch, where nothing
 * is matched (the FU#23 claim B-PLAY-18 cut from the SpineRibbon). */
describe("W2-SHELLPLAY r2 · the rail heading claims a match only where one exists", () => {
  const code = source.replace(/\r\n/g, "\n").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

  // v3 F-FORYOU-1 (re-pin): the rail and its heading are gone, so the heading
  // can claim nothing; the pick's own why-line names only what moved it.
  it("the rail heading is gone with the rail (no learnMap title, no no-signal door)", () => {
    expect(code).not.toContain('t("academy.learnMap.title"');
    expect(code).not.toContain('data-testid="academy-rail-nosignal"');
    expect(code).not.toContain("academy.learnMap.sub");
    // The focus-domain claim is still gated on a real map signal.
    expect(code).toContain("todaysRead.fromFocus && devMapHasSignal(devScore)");
  });

  it("it names the pick, not a second map: 'Picked for {name}' in both locales", () => {
    expect(en["academy.learnMap.title"]).toBe("Picked for {name}");
    expect(he["academy.learnMap.title"]).toContain("{name}");
    for (const d of [en, he]) {
      expect(d["academy.learnMap.title"]).not.toMatch(/Map|מפת/);
      expect(d["academy.learnMap.sub"]).toBeUndefined();
    }
    // NEGATIVE CONTROL: the r1 heading is caught
    expect("Learning Map").toMatch(/Map|מפת/);
  });
});

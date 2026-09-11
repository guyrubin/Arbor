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
  const end = src.indexOf("function Reader(");
  expect(start, "the hub's return was not found").toBeGreaterThan(-1);
  expect(end, "the Reader component was not found").toBeGreaterThan(start);
  return src.slice(start, end);
}

/** The predicate the acceptance rests on: in the document the parent's phone
 *  builds, does the course gallery come before the rail? */
function galleryPrecedesRail(src: string): boolean {
  const body = hubBody(src);
  const gallery = body.indexOf('data-testid="academy-courses"');
  const rail = body.indexOf('data-testid="academy-rail"');
  const disclosure = body.indexOf('data-testid="academy-rail-disclosure"');
  if (gallery < 0 || rail < 0 || disclosure < 0) return false;
  return gallery < rail && gallery < disclosure;
}

describe("R17 · the Academy hub opens on courses", () => {
  it("the gallery precedes the rail and the disclosure in the document", () => {
    expect(galleryPrecedesRail(source)).toBe(true);
  });

  it("NEGATIVE CONTROL: the pre-fix order (rail first) fails the same predicate", () => {
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
    expect(galleryPrecedesRail(preFix)).toBe(false);
  });

  it("nothing that is not a course stands between the hero and the gallery", () => {
    const body = hubBody(source);
    const between = body.slice(
      body.indexOf('testId="academy-hub-hero"'),
      body.indexOf('data-testid="academy-courses"'),
    );
    // The hero, the pick why-line and the catalogue header may stand here.
    // The rail's five modules may not.
    for (const module of ["<AcademyForYou", "<ScholarHubCard", "{railStack}", "master.progress.count"]) {
      expect(between, `${module} is still above the gallery`).not.toContain(module);
    }
    // The spine ribbon is above the gallery only on a wide viewport. H3b/R17
    // wrapped it in its budget stamp, so the render site is the stamped div —
    // the `!phone` gate is unchanged and is what this rule is about.
    expect(between).toContain(
      '{!phone && <div data-module="academy-spine" style={{ display: "contents" }}>{spineRibbon}</div>}',
    );
    // …and it is the ONLY ribbon mount above the gallery, so the gate cannot be
    // sidestepped by a second, ungated one.
    expect([...between.matchAll(/\{spineRibbon\}/g)]).toHaveLength(1);
    expect(between).not.toContain("<SpineRibbon");
  });

  it("NEGATIVE CONTROL: an ungated ribbon above the gallery fails the same rule", () => {
    // What R17 measured at 1,675 px: the ribbon stacked into the phone's single
    // column between the hero and the catalogue.
    const body = hubBody(source);
    const gallery = body.indexOf('data-testid="academy-courses"');
    const between =
      body.slice(body.indexOf('testId="academy-hub-hero"'), gallery) + "{spineRibbon}";
    expect([...between.matchAll(/\{spineRibbon\}/g)].length).toBeGreaterThan(1);
  });

  it("the desktop two-column shell is unchanged: rail left, gallery right at xl", () => {
    expect(source).toContain('xl:grid-cols-[minmax(0,1fr)_minmax(0,1.7fr)]');
    expect(source).toContain('className="space-y-4 min-w-0 order-1 xl:order-2" data-testid="academy-courses"');
    expect(source).toContain('className="space-y-5 order-2 xl:order-1" data-testid="academy-rail"');
  });

  it("the rail is declared once and rendered in exactly one of the two slots", () => {
    // One definition — a phone and a desktop cannot show two different rails.
    expect((source.match(/const railStack = \(/g) || []).length).toBe(1);
    expect((source.match(/\{railStack\}/g) || []).length).toBe(2);
    // …and the two placements are mutually exclusive.
    const body = hubBody(source);
    expect(body).toContain("{!phone && (");
    expect(body).toContain("{phone && (");
    expect(body).toContain('<details data-testid="academy-rail-disclosure"');
  });

  it("the phone seam is a media query, not a device sniff", () => {
    expect(source).toContain('const PHONE_QUERY = "(max-width: 767.98px)"');
    expect(source).toContain("useSyncExternalStore(subscribePhone, readPhone, () => false)");
  });

  it("the disclosure names what it holds, in both languages, with a 44 px summary", () => {
    expect(en["academy.rail.more"]).toBeTruthy();
    expect(he["academy.rail.more"]).toBeTruthy();
    expect(he["academy.rail.more"]).not.toBe(en["academy.rail.more"]);
    // Hebrew is transcreated, not transliterated: it must be Hebrew script.
    expect(he["academy.rail.more"]).toMatch(/[֐-׿]/);
    const summary = /<summary[\s\S]{0,400}?>/.exec(source)?.[0] ?? "";
    expect(summary).toContain("minHeight: 44");
  });
});

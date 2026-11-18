/**
 * R17 / LC-05 residue → v10.1 (N-ForYou-D/M) — the For you hub leads with the
 * pick, then COURSES, at every width.
 *
 * R17 measured the first course card at 1,675 px on a phone because the
 * Learning Map rail (For You, Scholar Hub, the charter strip) stacked between
 * the hero and the catalogue. v10 keeps the fix and makes it structural for
 * both compositions: section 1 is the pick, section 2 is Courses by area (the
 * desk's side rail beside the pick, the phone's next section), and the rail's
 * modules sit behind ONE disclosure at the foot of More to read, declared once.
 * Desktop and phone are two compositions of one tree (useComposition), never
 * two trees hidden with CSS.
 */
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { en, he } from "../../lib/i18n";

const SRC = path.resolve(__dirname, "..", "..");
const source = fs.readFileSync(path.join(SRC, "components", "sections", "Masterclasses.tsx"), "utf8");

/** The hub's own component only — the course reader lives below it. */
function hubBody(src: string): string {
  const start = src.indexOf("export default function Masterclasses()");
  const end = src.indexOf("export function MasterclassReader(");
  expect(start, "the hub was not found").toBeGreaterThan(-1);
  expect(end, "the Reader component was not found").toBeGreaterThan(start);
  return src.slice(start, end);
}

/** In the returned tree, does the catalogue come before the rail's disclosure? */
function coursesPrecedeRail(src: string): boolean {
  const body = hubBody(src);
  const tree = body.slice(body.indexOf("  return ("));
  const pick = tree.indexOf("{pickScene}");
  const courses = tree.indexOf("{coursesBlock}");
  const rail = tree.indexOf('data-testid="academy-rail"');
  if (pick < 0 || courses < 0 || rail < 0) return false;
  return pick < courses && courses < rail;
}

describe("R17 → v10 · the For you hub opens on the pick, then courses", () => {
  it("the pick precedes the courses, and the courses precede the rail's disclosure", () => {
    expect(coursesPrecedeRail(source)).toBe(true);
  });

  it("NEGATIVE CONTROL: the rail placed above the courses fails the same predicate", () => {
    const body = hubBody(source);
    const tree = body.slice(body.indexOf("  return ("));
    const at = tree.indexOf("{coursesBlock}");
    const preFix = source.replace(tree, tree.slice(0, at) + '<details data-testid="academy-rail"></details>' + tree.slice(at));
    expect(coursesPrecedeRail(preFix)).toBe(false);
  });

  it("the rail's modules are declared once and rendered once, inside the one disclosure", () => {
    expect((source.match(/const railStack = \(/g) || []).length).toBe(1);
    expect((source.match(/\{railStack\}/g) || []).length).toBe(1);
    const disclosure = source.slice(source.indexOf('data-testid="academy-rail"'), source.indexOf("</details>", source.indexOf('data-testid="academy-rail"')));
    expect(disclosure).toContain("{railStack}");
    expect(source).toContain('data-module-disclosure="academy-rail"');
    const rail = source.slice(source.indexOf("const railStack = ("), source.indexOf("const moreTiles = ("));
    expect(rail).toContain("<AcademyForYou />");
    expect(rail).toContain("<ScholarHubCard />");
  });

  it("one tree for both compositions: the seam is useComposition, never a CSS-hidden second copy", () => {
    expect(source).toContain("const composition = useComposition();");
    expect((source.match(/const pickScene = \(/g) || []).length).toBe(1);
    expect((source.match(/const coursesBlock = \(/g) || []).length).toBe(1);
    expect(source).not.toMatch(/hidden (md|lg|xl):block|(md|lg|xl):hidden/);
  });

  it("B-PLAY-18: no scorekeeping anywhere on the hub — no stat list, no completion bar, no academy-spine module", () => {
    expect(source).not.toMatch(/const heroStats = \[/);
    expect(source).not.toContain("master.progress.count");
    expect(source).not.toContain("master.progress.all");
    expect(source).not.toMatch(/doneCount \/ total/);
    expect(source).not.toContain('data-module="academy-spine"');
    // "Done" stays on each course.
    expect(source).toContain('t("master.done")');
    // NEGATIVE CONTROL: the shipped bar trips the same rule.
    expect('style={{ width: `${(doneCount / total) * 100}%`').toMatch(/doneCount \/ total/);
  });

  it("the disclosure names what it holds, in both languages, with a 44 px summary", () => {
    expect(en["academy.rail.more"]).toBeTruthy();
    expect(he["academy.rail.more"]).toBeTruthy();
    expect(he["academy.rail.more"]).not.toBe(en["academy.rail.more"]);
    expect(he["academy.rail.more"]).toMatch(/[֐-׿]/);
    const summary = /<summary[\s\S]{0,400}?>/.exec(source)?.[0] ?? "";
    expect(summary).toContain("minHeight: 44");
  });
});

describe("v10 — reading hierarchy", () => {
  it("one h1, the pick's title, above the pick's one move; the catalogue maps the age-fit courses", () => {
    const body = hubBody(source);
    expect(body.match(/<h1[\s>]/g)).toHaveLength(1);
    expect(body).not.toContain("<ProgressBar");
    expect(body.indexOf('<h1 className="hero"')).toBeLessThan(body.indexOf('data-testid="academy-hero-cta"'));
    expect(body).toContain("const courseList = catalog.filter(");
    expect(body).toContain("shownCourses.map((c)");
  });
});

/* W2-SHELLPLAY critic r2 (G0): the rail heading claims a match only where one
 * exists — it renders inside the signal branch, and names the pick. */
describe("W2-SHELLPLAY r2 · the rail heading claims a match only where one exists", () => {
  const code = source.replace(/\r\n/g, "\n").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
  const signal = code.indexOf("devMapHasSignal(devScore) ? (");
  const noSignal = code.indexOf('data-testid="academy-rail-nosignal"');
  const title = code.indexOf('t("academy.learnMap.title"');

  it("the title renders inside the signal branch, never above the no-signal door", () => {
    expect(signal).toBeGreaterThan(-1);
    expect(title).toBeGreaterThan(signal);
    expect(title).toBeLessThan(noSignal);
    expect(code.split('t("academy.learnMap.title"').length - 1).toBe(1);
    expect(code).not.toContain("academy.learnMap.sub");
  });

  it("it names the pick, not a second map: 'Picked for {name}' in both locales", () => {
    expect(en["academy.learnMap.title"]).toBe("Picked for {name}");
    expect(he["academy.learnMap.title"]).toContain("{name}");
    for (const d of [en, he]) {
      expect(d["academy.learnMap.title"]).not.toMatch(/Map|מפת/);
      expect(d["academy.learnMap.sub"]).toBeUndefined();
    }
    expect("Learning Map").toMatch(/Map|מפת/);
  });
});

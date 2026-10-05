/**
 * B-PLAY-17 — Courses live inside the Learn Library; the course reader gets
 * the reader's actions.
 *
 * Before: Learn's filters were All, Saved + 10 categories (no Courses), and the
 * Masterclass reader had no Add-to-today / Ask / Listen; its reflection was a
 * <p> caption over a bare <textarea> (no accessible name); body 14 px.
 *
 * Scan discipline: \r\n normalised; every extraction asserted before use;
 * negative controls run against the pre-change shapes.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { MASTERCLASSES } from "../../lib/masterclasses";
import { translate } from "../../lib/i18n";

const here = path.dirname(fileURLToPath(import.meta.url));
const learn = readFileSync(path.join(here, "LearnLibrary.tsx"), "utf8").replace(/\r\n/g, "\n");
const master = readFileSync(path.join(here, "Masterclasses.tsx"), "utf8").replace(/\r\n/g, "\n");
const HEBREW = /[֐-׿]/;

const between = (src: string, a: string, b: string) => {
  const i = src.indexOf(a);
  expect(i, `marker not found: ${a}`).toBeGreaterThan(-1);
  const j = src.indexOf(b, i + a.length);
  expect(j, `end marker not found: ${b}`).toBeGreaterThan(i);
  return src.slice(i, j);
};

describe("B-PLAY-17 · Learn has a Courses filter that lists the Masterclasses", () => {
  it("the catalogue the filter lists is the 10 Masterclasses", () => {
    expect(MASTERCLASSES).toHaveLength(10);
  });

  it("Filter includes 'courses' and the pill sits in the filter row", () => {
    expect(learn).toContain('type Filter = "all" | "saved" | "courses" | LearnCategoryId;');
    const row = between(learn, 'data-module="learn-filters"', "LEARN_CATEGORIES.map");
    expect(row).toContain('active={filter === "courses"}');
    expect(row).toContain('label={t("learn.courses")}');
  });

  it("the courses shelf rides the same age switch and opens the course reader inline", () => {
    expect(learn).toMatch(/filterByAge\(MASTERCLASSES, \(m\) => windowFromYears\(m\.ageMinYears, m\.ageMaxYears\), childMonths\)/);
    expect(learn).toContain("const courses = showAllAges ? MASTERCLASSES : coursesAgeVisible;");
    const shelf = between(learn, '{filter === "courses" ? (', ") : gridCards.length > 0 ? (");
    expect(shelf).toContain("courses.map((m) =>");
    expect(shelf).toContain("onClick={() => setOpenCourseId(m.id)}");
    expect(shelf).toContain("onClick={toggleShowAllAges}");
    // It replaces the reads shelf while selected — no second module stamp (learn budget 3 holds).
    expect(shelf).toContain('data-testid="learn-courses"');
    expect(shelf).not.toContain("data-module=");
    expect(learn).toContain("return <MasterclassReader m={openCourse} onBack={() => setOpenCourseId(null)} />;");
    expect(learn).toContain('import { MasterclassReader, loadDone as loadCourseDone } from "./Masterclasses";');
  });

  it("the reads list is empty under Courses (no mixed shelf)", () => {
    expect(learn).toContain('else if (filter === "courses") list = [];');
  });

  it("EN + HE copy for every new key", () => {
    for (const key of ["learn.courses", "learn.courses.count", "learn.courses.done", "master.ask.prompt"]) {
      expect(translate("en", key), key).not.toBe(key);
      expect(HEBREW.test(translate("he", key)), `${key} HE`).toBe(true);
    }
    expect(translate("en", "learn.courses.count", { n: 10 })).toBe("10 courses");
    expect(translate("he", "learn.courses.count", { n: 10 })).toContain("10");
  });
});

describe("B-PLAY-17 · the course reader carries the Learn reader's actions", () => {
  const reader = between(master, "export function MasterclassReader(", "\n}\n");

  it("is exported and used by both the Masterclasses page and Learn", () => {
    expect(master).toContain("export function MasterclassReader(");
    expect(master).toMatch(/if \(open\) return <MasterclassReader m=\{open\}/);
    expect(master).not.toMatch(/\bfunction Reader\(/);
  });

  it("Add to today → ONE learn-read action-loop row, never twice", () => {
    expect(reader).toContain('acceptTodayAction(tryTonight, "tiny", "learn-read");');
    expect(reader).toMatch(/const todayTaken = actionLoop\.some\(\(a\) => a\.source === "learn-read" && a\.recommendation === tryTonight\);/);
    expect(reader).toMatch(/const addToday = \(\) => \{\s*if \(todayTaken\) return;/);
    expect(reader).toContain('data-testid="course-add-today"');
    expect(reader).toContain("disabled={todayTaken}");
  });

  it("Ask seeds the composer (prefill only) and Listen is the shared SpeakButton", () => {
    expect(reader).toMatch(/seedCoach\(\{ prompt: t\("master\.ask\.prompt"/);
    expect(reader).toContain('data-testid="course-ask"');
    expect(reader).toContain("<SpeakButton text={listenText}");
  });

  it("the reflection has an accessible name — a real <label htmlFor> on the textarea id", () => {
    expect(reader).toContain("<label htmlFor={`course-reflect-${m.id}`}");
    expect(reader).toContain("id={`course-reflect-${m.id}`}");
  });

  it("body text is var(--t-base), not 14 px", () => {
    expect(reader).toContain("text-[length:var(--t-base)] leading-relaxed\" dir=\"auto\" style={{ color: \"var(--arbor-ink-soft)\" }}>{he ? s.bodyHe : s.body}");
    expect(reader).not.toMatch(/text-\[14px\][^"]*" dir="auto" style=\{\{ color: "var\(--arbor-ink-soft\)" \}\}>\{he \? s\.bodyHe/);
  });

  it("NEGATIVE CONTROL: the pre-change reflection caption had no accessible name", () => {
    const pre = '<p className="text-xs uppercase">{t("master.reflect.label")}</p>\n<textarea value={reflection} />';
    expect(pre).not.toMatch(/<label htmlFor=/);
    expect(pre).not.toMatch(/<textarea[^>]*\bid=/);
  });
});

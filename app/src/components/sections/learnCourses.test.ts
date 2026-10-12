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

  // v3 F-FORYOU-1 (re-pin): #/learn is a reader only. Its filter row (and the
  // Courses pill in it) is gone; the courses live in For you's library,
  // "Courses by area", and open the course reader there.
  it("Learn carries no filter row and no course shelf; the courses live on For you", () => {
    expect(learn).not.toContain("type Filter =");
    expect(learn).not.toContain('data-module="learn-filters"');
    expect(learn).not.toContain('data-testid="learn-courses"');
    expect(learn).not.toContain("MasterclassReader");
    expect(learn).not.toContain('from "./Masterclasses"');
    expect(master).toContain("<button key={c.id} type=\"button\" onClick={() => setOpenId(c.id)} className={COURSE_CARD}>");
  });

  it("the library's courses ride the age switch and open the course reader in place", () => {
    expect(master).toMatch(/filterByAge\(\s*MASTERCLASSES,\s*\(m\) => windowFromYears\(m\.ageMinYears, m\.ageMaxYears\),\s*childMonths,?\s*\)/);
    expect(master).toContain("const ageCatalog = showAllAges ? MASTERCLASSES : ageVisible;");
    expect(master).toMatch(/if \(open\) return <MasterclassReader m=\{open\}/);
    expect(master).toContain("onClick={toggleShowAllAges}");
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

  // v3 F-FORYOU-1: Learn no longer mounts it (the courses left #/learn).
  it("is exported and used by the Masterclasses page", () => {
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

describe("W2-SHELLPLAY r1 · Learn: the move is a real control, never a section", () => {
  // v3 F-FORYOU-1 (re-pin): #/learn is a reader only, so its one stamp rides
  // the reader heading of the read the route opens (the shelf card that held
  // it is gone). A read in For you's sheet gets no stamp: that page has its own.
  it("the stamp is spread once, on the reader heading, never on a section", () => {
    expect(learn).not.toMatch(/<section[^>]*data-primary-move=/);
    expect(learn).toContain('const LEARN_MOVE_STAMP = { "data-primary-move": "open-learn-card" } as const;');
    expect(learn).toContain("moveProps={LEARN_MOVE_STAMP}");
    const heading = between(learn, "<h2\n          ref={headingRef}", "</h2>");
    expect(heading).toContain('data-testid="learn-reader-heading"');
    expect(heading).toContain("{...moveProps}");
    const code = learn.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
    expect((code.match(/\bdata-primary-move\b(?!-)/g) || []).length).toBe(1);
    expect((code.match(/\{\.\.\.moveProps\}/g) || []).length).toBe(1);
  });

  it("one module, the reader; no picked rail and no filter row", () => {
    const code = learn.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "");
    expect(code.match(/\bdata-module="[^"]+"/g)).toEqual(['data-module="learn-reader"']);
    expect(learn).not.toContain('data-module="learn-picked"');
    expect(learn).not.toContain('data-module="learn-filters"');
    // NEGATIVE CONTROL: the r1 page had both
    expect('<div data-module="learn-picked"></div><div data-module="learn-filters"></div>'.match(/\bdata-module="[^"]+"/g)).toHaveLength(2);
  });
});

describe("W2-SHELLPLAY r2 · learn design — one gradient on the reader's own move, one flat hero band", () => {
  it("the course reader's --gradient-cta sits on 'Add to today' (on-accent ink); 'Mark complete' is a ghost", () => {
    const add = between(master, 'data-testid="course-add-today"', "</button>");
    expect(add).toContain('{ background: "var(--gradient-cta)", color: "var(--arbor-on-accent)" }');
    const done = between(master, 'data-testid="course-mark-complete"', "</button>");
    expect(done).not.toContain("--gradient-cta");
    expect(done).toContain('border: "1px solid var(--arbor-rule)"');
    // exactly one gradient in the course reader file's CTA set: the pick CTA (hub) + Add to today (reader)
    expect((master.match(/var\(--gradient-cta\)/g) || []).length).toBe(2);
    // NEGATIVE CONTROL: the pre-fix Mark complete is caught
    expect('<button onClick={onComplete} className="w-full" style={{ background: "var(--gradient-cta)" }}>').toContain("--gradient-cta");
  });

  it("the Learn reader hero is ONE flat tone band — no gradient nesting a -soft token", () => {
    const hero = between(learn, 'data-testid="learn-reader-hero"', ">");
    expect(hero).toContain("style={{ background: tone.soft }}");
    expect(learn).not.toMatch(/linear-gradient\(135deg, \$\{tone\.soft\}/);
    // NEGATIVE CONTROL: the pre-fix band shape is caught
    expect("style={{ background: `linear-gradient(135deg, ${tone.soft}, var(--arbor-paper-deep))` }}").toMatch(/linear-gradient\(135deg, \$\{tone\.soft\}/);
  });
});

/**
 * GP-03 / MOB-04 / MOB-11 — one age, written whole, from every control.
 *
 * The defect was a split brain. Age could be edited from three different
 * controls, and one of them wrote `age` (whole years) alone. Every
 * months-precise consumer prefers `birthDate`, so after such an edit the child's
 * band, the milestone age window and the age label disagreed with what the
 * parent had just typed — and for an infant, "age 0" was rendered as a whole
 * year. GP-04 sits on the same foundation: corrected age for a preemie is
 * meaningless if the stored basis is a rounded year.
 *
 * All three controls are correct today. The risk now is a FOURTH one: this is
 * a shape that has to be remembered, and the item existed because it wasn't.
 * So the property is checked rather than the three known files — any call that
 * writes a child's age must write the whole triple, or go through one of the
 * helpers that does.
 */
import { describe, expect, it } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import ts from "typescript";

const SRC = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");

const listSources = (dir: string): string[] =>
  fs.readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry);
    if (fs.statSync(full).isDirectory()) return listSources(full);
    return /\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry) ? [full] : [];
  });

/** The helpers that are ALLOWED to stand in for the explicit fields, because
 *  each one writes ageMonths + ageMonthsAsOf + age from a single months value.
 *  B-DATA-03: `birthDateFromAgeMonths` is no longer one — a birth date is never
 *  invented from months (see childAge.test.ts for the tree scan). */
const AGE_WRITE_HELPERS = ["agePatchFromMonths", "buildNewChildInput"];

/** AST scan covers single-line calls and named patches as well as literals. */
const ageWrites = listSources(SRC).flatMap((file) => {
  const source = fs.readFileSync(file, "utf8");
  const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, file.endsWith("tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const definitions = new Map<string, ts.Expression>();
  const collect = (node: ts.Node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) definitions.set(node.name.text, node.initializer);
    ts.forEachChild(node, collect);
  };
  collect(tree);
  const expanded = (node: ts.Node, seen = new Set<string>()): string => {
    let text = node.getText(tree);
    const scan = (part: ts.Node) => {
      if (ts.isIdentifier(part) && definitions.has(part.text) && !seen.has(part.text)) {
        const next = new Set(seen); next.add(part.text);
        text += "\n" + expanded(definitions.get(part.text)!, next);
      } else ts.forEachChild(part, scan);
    };
    ts.forEachChild(node, scan);
    if (ts.isIdentifier(node) && definitions.has(node.text) && !seen.has(node.text)) {
      const next = new Set(seen); next.add(node.text); text += "\n" + expanded(definitions.get(node.text)!, next);
    }
    return text;
  };
  const writes: { file: string; call: string }[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node) && /(?:^|\.)(addChild|updateChild)$/.test(node.expression.getText(tree))) {
      const call = node.arguments.map(arg => expanded(arg)).join("\n");
      if (/\bage\s*:|\bageMonths\s*[:,}]|agePatchFromMonths|buildNewChildInput/.test(call)) writes.push({ file: path.relative(SRC, file).split(path.sep).join("/"), call });
    }
    ts.forEachChild(node, visit);
  };
  visit(tree); return writes;
});

describe("GP-03 · a child's age is never written in pieces", () => {
  it("the scan is real and finds the known write sites", () => {
    const files = new Set(ageWrites.map((w) => w.file));
    expect(ageWrites.length).toBeGreaterThan(0);
    expect(files.has("lib/onboardingFirstRun.ts")).toBe(true);
    expect(files.has("components/profile/ProfileEditDrawer.tsx")).toBe(true);
    // Named anchors: if these move or are renamed, fail loudly rather than
    // quietly scanning nothing and reporting success.
    // B-SHELL-36: first-run writes moved into its executable state machine;
    // the about patch is shared by create and Back-edit rather than duplicated.
    const firstRun = fs.readFileSync(path.join(SRC, "lib/onboardingFirstRun.ts"), "utf8");
    expect(firstRun).toContain("age: Math.floor(ageMonths / 12), ageMonths");
    expect(firstRun).toContain("ageMonthsAsOf: isoDateOf(now)");
    expect(firstRun).toContain("services.addChild({ ...about");
    expect(firstRun).toContain("services.updateChild(state.childId, about, { isCurrent: current })");
  });

  it("every age write carries birthDate and ageMonths, or goes through a helper", () => {
    const offenders = ageWrites
      .filter(({ call }) => {
        if (AGE_WRITE_HELPERS.some((helper) => call.includes(helper))) return false;
        // ageMonths plus the date it is true on (or a parent-typed birthDate).
        return !(call.includes("ageMonths") && (call.includes("ageMonthsAsOf") || call.includes("birthDate")));
      })
      .map(({ file }) => file);
    expect(
      offenders,
      "an age written without birthDate + ageMonths leaves the band, the milestone age window " +
        "and the age label disagreeing with what the parent just typed",
    ).toEqual([]);
  });

  it("NEGATIVE CONTROL: the check rejects the pre-fix shape and accepts both good ones", () => {
    const bad = `updateChild(id, {\n  name: n,\n  age: Number(years),\n})`;
    const explicit = `addChild({\n  name: n,\n  age: y,\n  birthDate,\n  ageMonths: total,\n})`;
    const viaHelper = `updateChild(id, {\n  name: n,\n  ...agePatchFromMonths(ageMonths),\n})`;

    const failing = (call: string) =>
      !AGE_WRITE_HELPERS.some((h) => call.includes(h)) && !(call.includes("ageMonths") && (call.includes("ageMonthsAsOf") || call.includes("birthDate")));

    expect(failing(bad)).toBe(true);
    expect(failing(explicit)).toBe(false);
    expect(failing(viaHelper)).toBe(false);
    // ...and the matcher that selects age writes actually selects it.
    expect(/\bage\s*:|\bageMonths\s*:/.test(bad)).toBe(true);
    expect(/\bage\s*:|\bageMonths\s*:/.test(`updateChild(id, { name: n })`)).toBe(false);
  });
});

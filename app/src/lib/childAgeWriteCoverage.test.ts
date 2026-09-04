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

const SRC = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");

const listSources = (dir: string): string[] =>
  fs.readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry);
    if (fs.statSync(full).isDirectory()) return listSources(full);
    return /\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry) ? [full] : [];
  });

/** The helpers that are ALLOWED to stand in for the explicit triple, because
 *  each one writes birthDate + ageMonths + age from a single months value. */
const AGE_WRITE_HELPERS = ["agePatchFromMonths", "buildNewChildInput", "birthDateFromAgeMonths"];

/** `addChild(...)` / `updateChild(...)` call text across the tree. */
const ageWrites = listSources(SRC).flatMap((file) => {
  const src = fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n");
  const stripped = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  return [...stripped.matchAll(/\b(?:addChild|updateChild)\s*\([\s\S]{0,1400}?\n\s{0,8}\}\s*\)/g)]
    .map((m) => ({ file: path.relative(SRC, file).split(path.sep).join("/"), call: m[0] }))
    .filter(({ call }) => /\bage\s*:|\bageMonths\s*:/.test(call));
});

describe("GP-03 · a child's age is never written in pieces", () => {
  it("the scan is real and finds the known write sites", () => {
    const files = new Set(ageWrites.map((w) => w.file));
    expect(ageWrites.length).toBeGreaterThan(0);
    // Named anchors: if these move or are renamed, fail loudly rather than
    // quietly scanning nothing and reporting success.
    expect(files.has("components/auth/OnboardingFlow.tsx")).toBe(true);
  });

  it("every age write carries birthDate and ageMonths, or goes through a helper", () => {
    const offenders = ageWrites
      .filter(({ call }) => {
        if (AGE_WRITE_HELPERS.some((helper) => call.includes(helper))) return false;
        return !(call.includes("birthDate") && call.includes("ageMonths"));
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
      !AGE_WRITE_HELPERS.some((h) => call.includes(h)) && !(call.includes("birthDate") && call.includes("ageMonths"));

    expect(failing(bad)).toBe(true);
    expect(failing(explicit)).toBe(false);
    expect(failing(viaHelper)).toBe(false);
    // ...and the matcher that selects age writes actually selects it.
    expect(/\bage\s*:|\bageMonths\s*:/.test(bad)).toBe(true);
    expect(/\bage\s*:|\bageMonths\s*:/.test(`updateChild(id, { name: n })`)).toBe(false);
  });
});

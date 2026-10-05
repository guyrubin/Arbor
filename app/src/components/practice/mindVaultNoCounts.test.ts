/**
 * B-KID-34 (KC-02, law 3) — no move counts in front of the child.
 * Mind Vault rendered "Moves: 14 · Found 3/6" above the board and "Solved in
 * 14 moves. Next round gets a little bigger!" on the win — a performance
 * number and a difficulty verdict in the kid register. Both are gone; the win
 * copy is keyed EN + HE. A scan rule keeps a {moves} interpolation out of
 * every kid dictionary.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import * as kidsExperience from "../../lib/i18nElevation/kidsExperience";
import * as kidRegister from "../../lib/i18nElevation/kidRegister";
import * as kidsStories from "../../lib/i18nElevation/kidsStories";

const vault = readFileSync(path.join(__dirname, "MemoryMatch.tsx"), "utf8");
const live = vault.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
const DICTS = { kidsExperience, kidRegister, kidsStories } as const;

/** The scan rule: a kid string may not interpolate a move/attempt count. */
const COUNT_VAR = /\{(moves|attempts|tries|mistakes|errors)\}/;

describe("B-KID-34: Mind Vault shows no move count", () => {
  it("the board header and the win carry no move number or difficulty verdict", () => {
    expect(live).not.toMatch(/elev\.kids\.memory\.moves|Solved in|\{moves\}|\$\{moves\}|Next round gets/);
    expect(live).toContain('subtitle={t("elev.kids.memory.done.sub")}');
    expect(live).toContain('title={t("elev.kids.memory.done.title")}');
  });
  it("the win copy and the hidden-card label exist in EN and Hebrew", () => {
    for (const key of ["elev.kids.memory.done.title", "elev.kids.memory.done.sub", "elev.kids.memory.again", "elev.kids.memory.hiddenCard"]) {
      expect(kidsExperience.en[key], key).toBeTruthy();
      expect(/[א-ת]/.test(kidsExperience.he[key] ?? ""), key).toBe(true);
    }
  });
});

describe("B-KID-34: scan rule — no count interpolation in kid keys", () => {
  it.each(Object.keys(DICTS))("%s has no {moves}-style count variable (EN + HE)", (name) => {
    const d = DICTS[name as keyof typeof DICTS];
    for (const dict of [d.en, d.he]) {
      const offenders = Object.entries(dict).filter(([, v]) => COUNT_VAR.test(v)).map(([k]) => k);
      expect(offenders).toEqual([]);
    }
  });
  it("NEGATIVE CONTROL: the rule fails a synthetic {moves} kid key", () => {
    expect(COUNT_VAR.test("Moves: {moves} · Found {found}/{total}")).toBe(true);
  });
});

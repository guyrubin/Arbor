/**
 * The sweep guard — EVERY per-child localStorage key template in the tree is
 * reachable by `clearChildLocalState`.
 *
 * Three separate keys have now escaped that sweep, each for the same reason:
 * the author appended a per-variant suffix AFTER the child id, so the key no
 * longer ended in `.${childId}` and `isChildScopedKey` stopped recognising it.
 * A deleted child then left rows behind on the parent's own device — the copy
 * they can actually see — and in the growth-month case one new orphan row per
 * month, forever.
 *
 * Naming a fixed list of stores would have the same blind spot the sweep did,
 * so this SCANS the source: it harvests every backtick template literal that
 * starts with `arbor.` and interpolates something child-shaped, synthesises the
 * concrete key that template produces, and asserts the real
 * `isChildScopedKey` would sweep it. A new store is covered the day it is
 * written, whether or not its author read the convention.
 *
 * Scan discipline (this repo has been bitten by vacuous scans):
 *  · \r\n normalised before any regex runs;
 *  · the harvest is asserted non-empty AND asserted to contain known real keys,
 *    so a walk that silently reads nothing cannot pass;
 *  · every rule carries a negative control — including one proving the matcher
 *    still REJECTS an unsweepable shape, so the guard is not vacuously true.
 */
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isChildScopedKey } from "./childLocalState";
import { monthReviewSeenKey } from "./growthMonth";
import { weekAnchorSeenKey } from "../components/overview/weekAnchor";

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC_ROOT = path.join(here, "..");

/** A child id that cannot collide with any literal text in the tree. */
const KID = "kid-sweep-sentinel";

/** Every non-test .ts/.tsx file under src/. */
function sourceFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === "dist") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) sourceFiles(full, acc);
    else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) acc.push(full);
  }
  return acc;
}

/** True when an interpolated expression names a child (childId, child.id,
 *  childProfile.id, activeChild.id, kidId…). Deliberately generous: a false
 *  positive only asks a key to be sweepable, which is never wrong. */
const looksLikeChild = (expr: string) => /child|kid/i.test(expr);

interface Harvested {
  file: string;
  template: string;
  /** The template with the child expression replaced by KID and every other
   *  interpolation replaced by a dot-free placeholder. */
  concrete: string;
}

/** Harvest `arbor.…` template literals that interpolate a child id. */
function harvest(files: string[]): { found: Harvested[]; scannedChars: number } {
  const found: Harvested[] = [];
  let scannedChars = 0;
  for (const file of files) {
    const src = readFileSync(file, "utf8").replace(/\r\n/g, "\n");
    scannedChars += src.length;
    for (const match of src.matchAll(/`arbor\.[^`]*`/g)) {
      const template = match[0].slice(1, -1);
      const parts = [...template.matchAll(/\$\{([^}]*)\}/g)];
      if (parts.length === 0) continue; // prose in a doc comment, not a key
      if (!parts.some((p) => looksLikeChild(p[1]))) continue; // not child-scoped
      const concrete = template.replace(/\$\{([^}]*)\}/g, (_, expr: string) =>
        looksLikeChild(expr) ? KID : "x"
      );
      found.push({ file: path.relative(SRC_ROOT, file), template, concrete });
    }
  }
  return { found, scannedChars };
}

const FILES = sourceFiles(SRC_ROOT);
const { found, scannedChars } = harvest(FILES);

describe("the source scan is real, not vacuous", () => {
  it("walked the tree and read actual bytes", () => {
    expect(FILES.length).toBeGreaterThan(100);
    expect(scannedChars).toBeGreaterThan(500_000);
  });

  it("harvested the per-child key templates that are known to exist", () => {
    expect(found.length).toBeGreaterThanOrEqual(15);
    const templates = found.map((f) => f.template);
    // Three real, independently-verifiable keys from three different modules.
    expect(templates).toContain("arbor.week.anchor.seen.${childId}");
    expect(templates).toContain("arbor.${namespace}.${childId}");
    expect(templates).toContain("arbor.growth.month.seen.${monthKey}.${childId}");
  });

  it("does NOT harvest arbor keys scoped to something other than a child", () => {
    const templates = found.map((f) => f.template);
    // Negative control for the child-shaped filter: these are per-surface and
    // per-banner keys, correctly outside the per-child sweep.
    expect(templates).not.toContain("arbor.agefilter.showAll.${surface}");
    expect(templates).not.toContain("arbor.syncBanner.dismissed.${kind}");
  });
});

describe("every per-child localStorage key is sweepable on child deletion", () => {
  it.each(found.map((f) => [`${f.file} :: ${f.template}`, f.concrete]))(
    "%s",
    (_label, concrete) => {
      expect(
        isChildScopedKey(concrete as string, KID),
        `"${concrete}" is arbor-namespaced and child-scoped but clearChildLocalState would NOT remove it. ` +
          "Put the child id in its own dot-delimited segment (see lib/childLocalState.childScopedKey).",
      ).toBe(true);
    },
  );
});

describe("negative controls — the guard can actually fail", () => {
  it("rejects a child id that is not a whole dot-delimited segment", () => {
    // The exact shape a future author would produce by gluing a suffix on.
    expect(isChildScopedKey(`arbor.growth.month.seen${KID}2026-09`, KID)).toBe(false);
    expect(isChildScopedKey(`arbor-growth-${KID}-seen`, KID)).toBe(false);
    // …and the namespace check still holds.
    expect(isChildScopedKey(`vendor.thing.${KID}`, KID)).toBe(false);
  });

  it("a sibling whose id merely shares a prefix is never swept", () => {
    expect(isChildScopedKey(`arbor.play.done.${KID}-2`, KID)).toBe(false);
    expect(isChildScopedKey(`arbor.play.done.${KID}-2.en`, KID)).toBe(false);
  });

  it("the OLD end-of-key-only rule really did miss these keys", () => {
    // Verbatim pre-change matcher. If this ever starts passing, the widening in
    // isChildScopedKey has been reverted and the leak is back.
    const oldRule = (key: string, childId: string) =>
      key.startsWith("arbor.") && childId.length > 0 && key.endsWith(`.${childId}`);
    expect(oldRule(`arbor.growth.month.seen.${KID}.2026-09`, KID)).toBe(false);
    expect(oldRule(`arbor.todaysFocus.${KID}.he`, KID)).toBe(false);
    // Same two keys, under the shipped rule.
    expect(isChildScopedKey(`arbor.growth.month.seen.${KID}.2026-09`, KID)).toBe(true);
    expect(isChildScopedKey(`arbor.todaysFocus.${KID}.he`, KID)).toBe(true);
  });
});

describe("the growth-month marker follows the mint-side convention", () => {
  it("ends with the child id, exactly as weekAnchorSeenKey does", () => {
    const key = monthReviewSeenKey(KID, "2026-09");
    expect(key.endsWith(`.${KID}`), `monthReviewSeenKey produced "${key}"`).toBe(true);
    expect(weekAnchorSeenKey(KID).endsWith(`.${KID}`)).toBe(true);
    // Negative control: the month must still be part of the key, or the card
    // would be offered once ever instead of once per month.
    expect(monthReviewSeenKey(KID, "2026-09")).not.toBe(monthReviewSeenKey(KID, "2026-10"));
  });
});

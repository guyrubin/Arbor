/**
 * B-GROWTH-06 — stop STORING composite child grades and celebrating score
 * thresholds.
 *
 * The Growth render had been count-only since Wave-3, but underneath it:
 * `computeDevScore` built per-domain 0–100 scores and an `overall` %, and
 * DevScoreCard upserted them weekly into `devScoreSnapshots` (so they left in
 * every GDPR export); `growth/prideMoment.ts` fired a CelebrationMoment when a
 * child's domain SCORE crossed 25/50/75/100; the card and the Development nav
 * item wore gauge icons. This guard pins the subtraction.
 *
 * Deletion of the legacy `devScoreSnapshots` documents is NOT done here and
 * never by a builder: they stay registered in CHILD_SUBCOLLECTIONS (export +
 * erase) until Guy's G12 decision, with the read-only census counts in the ask.
 */
import { describe, expect, expectTypeOf, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { computeDevScore, type DevScore, type DomainScore } from "./devScore";
import { CHILD_SUBCOLLECTIONS } from "../lib/childData";
import { translate } from "../lib/i18n";
import framework from "../framework.json";

const SRC = path.resolve(__dirname, "..");
const read = (rel: string) => readFileSync(path.join(SRC, rel), "utf8");
const stripComments = (s: string) =>
  s.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const walk = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return walk(p);
    return /\.(ts|tsx)$/.test(e.name) && !/\.test\.(ts|tsx)$/.test(e.name) ? [p] : [];
  });
const rel = (abs: string) => path.relative(SRC, abs).split(path.sep).join("/");
const NON_TEST = walk(SRC).map((abs) => ({ rel: rel(abs), code: stripComments(readFileSync(abs, "utf8")) }));

describe("B-GROWTH-06 — DevScore exposes counts, never a numeric grade", () => {
  it("the public types carry no score / overall / trend", () => {
    expectTypeOf<DevScore>().not.toHaveProperty("overall");
    expectTypeOf<DomainScore>().not.toHaveProperty("score");
    expectTypeOf<DomainScore>().not.toHaveProperty("trend");
    expectTypeOf<DomainScore>().toHaveProperty("reached").toEqualTypeOf<number>();
    expectTypeOf<DomainScore>().toHaveProperty("total").toEqualTypeOf<number>();
  });

  it("…and at runtime the result has no such keys either", () => {
    const s = computeDevScore([{ domain: "a", checked: true }, { domain: "a", checked: false }, { domain: "b", checked: false }]);
    expect(Object.keys(s).sort()).toEqual(["confidence", "domains", "focusDomain"]);
    for (const d of s.domains) expect(Object.keys(d).sort()).toEqual(["confidence", "domain", "reached", "total"]);
  });

  it("visible Growth counts are identical to the pre-change derivation (snapshot)", () => {
    // The fixture the pre-change suite used; reached/total are what every
    // surface renders, and they must not move.
    const s = computeDevScore([
      { domain: "Motor", checked: true }, { domain: "Motor", checked: true }, { domain: "Motor", checked: false }, { domain: "Motor", checked: false },
      { domain: "Language", checked: true }, { domain: "Language", checked: true }, { domain: "Language", checked: true },
      { domain: "Social", checked: false }, { domain: "Social", checked: false }, { domain: "Social", checked: true },
    ]);
    expect(s.domains.map((d) => `${d.domain} ${d.reached}/${d.total}`)).toMatchInlineSnapshot(`
      [
        "Language 3/3",
        "Motor 2/4",
        "Social 1/3",
      ]
    `);
    expect(s.focusDomain).toBe("Social"); // unchanged for Learn / Masterclasses
  });
});

describe("B-GROWTH-06 — grep acceptance over app/src (non-test)", () => {
  it("0 `overall:` under growth/", () => {
    const hits = NON_TEST.filter((f) => f.rel.startsWith("growth/") && /\boverall:/.test(f.code)).map((f) => f.rel);
    expect(hits).toEqual([]);
  });

  it("0 devScoreSnapshots writers (no useChildCollection sink, no upsert, no toSnapshot)", () => {
    const sinks = NON_TEST.filter((f) => /useChildCollection[\s\S]{0,120}?"devScoreSnapshots"/.test(f.code)).map((f) => f.rel);
    expect(sinks).toEqual([]);
    expect(NON_TEST.filter((f) => /\btoSnapshot\b|\bshouldSnapshot\b/.test(f.code)).map((f) => f.rel)).toEqual([]);
    // no components/ module imports toSnapshot (the writer's only door)
    expect(NON_TEST.filter((f) => f.rel.startsWith("components/") && /import[^;]*\btoSnapshot\b/.test(f.code))).toEqual([]);
    // the device-local mirror of the snapshot is gone too
    expect(NON_TEST.filter((f) => /arbor\.devscore\.\$\{/.test(f.code)).map((f) => f.rel)).toEqual([]);
  });

  it("0 DOMAIN_THRESHOLDS", () => {
    expect(NON_TEST.filter((f) => /\bDOMAIN_THRESHOLDS\b/.test(f.code)).map((f) => f.rel)).toEqual([]);
  });

  it("legacy devScoreSnapshots documents still export and erase until G12", () => {
    expect(CHILD_SUBCOLLECTIONS).toContain("devScoreSnapshots");
  });
});

describe("B-GROWTH-06 — no gauge metaphor, no Latin domain label under he", () => {
  it("DevScoreCard wears eco, not speed; the Development nav item a Sprout, not a Gauge", () => {
    const card = stripComments(read("components/sections/DevScoreCard.tsx"));
    expect(card).not.toContain('name="speed"');
    expect(card).toContain('<Icon name="eco" size={15} />');
    const nav = stripComments(read("lib/navigation.ts"));
    expect(nav).not.toMatch(/\bGauge\b/);
    expect(nav.match(/\{ tab: "development", label: "Development", icon: Sprout \}/g)?.length).toBe(2);
  });

  it("the sr-only domain labels go through screen.domain.* — Hebrew for every framework domain", () => {
    const card = stripComments(read("components/sections/DevScoreCard.tsx"));
    expect(card).toContain("domain: t(`screen.domain.${d.domain}`)");
    expect(card).not.toContain("framework.json");
    for (const { id } of (framework as { domains: { id: string }[] }).domains) {
      const he = translate("he", `screen.domain.${id}`);
      expect(he, id).not.toBe(`screen.domain.${id}`);
      expect(he, id).not.toMatch(/[A-Za-z]/);
      expect(translate("en", `screen.domain.${id}`), id).not.toBe(`screen.domain.${id}`);
    }
  });

  it("NEGATIVE CONTROL — the pre-change shapes trip the scans", () => {
    expect(/\boverall:/.test("  overall: totalAll > 0 ? Math.round((reachedAll / totalAll) * 100) : 0,")).toBe(true);
    expect(/useChildCollection[\s\S]{0,120}?"devScoreSnapshots"/.test('useChildCollection<StoredDevScoreSnapshot>(childProfile.id, "devScoreSnapshots", {')).toBe(true);
    expect(/\bDOMAIN_THRESHOLDS\b/.test("export const DOMAIN_THRESHOLDS = [25, 50, 75, 100] as const;")).toBe(true);
  });
});

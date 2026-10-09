import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { BREATH_CYCLES, BREATH_IN_MS, BREATH_OUT_MS, ParentBreathPacer, breathSchedule } from "./ParentBreathPacer";
import { en, he } from "../../lib/i18n";

const t = (k: string) => en[k] ?? k;
const sheet = readFileSync(path.resolve(__dirname, "HardMomentNowSheet.tsx"), "utf8");
const css = readFileSync(path.resolve(__dirname, "parentBreathPacer.css"), "utf8");

describe("B-ASKJB-40 — the parent's optional breath before the guides", () => {
  it("three slow breaths, a long exhale, no hold, about half a minute", () => {
    const s = breathSchedule();
    expect(s).toHaveLength(BREATH_CYCLES * 2);
    expect(s.map((x) => x.phase)).toEqual(["in", "out", "in", "out", "in", "out"]);
    expect(BREATH_OUT_MS).toBeGreaterThan(BREATH_IN_MS);
    expect(s.reduce((n, x) => n + x.ms, 0)).toBe(30_000);
  });

  it("rests collapsed: one optional row, no circle, no timer running", () => {
    const html = renderToStaticMarkup(<ParentBreathPacer t={t} />);
    expect(html).toContain('data-testid="breath-pacer-open"');
    expect(html).not.toContain('data-testid="breath-pacer"');
    expect(html).toContain("Steady yourself first");
    expect(html).toContain("Optional.");
  });

  it("sits above the situation picker and never replaces it (not a gate)", () => {
    const pacer = sheet.indexOf("<ParentBreathPacer t={t} />");
    const pick = sheet.indexOf('{t("hm.now.pick")}');
    expect(pacer).toBeGreaterThan(0);
    expect(pacer).toBeLessThan(pick);
    expect(sheet.slice(pacer, pick + 400)).toContain("lead.length > 0");
  });

  it("reduced motion keeps the words and drops the movement", () => {
    expect(css).toMatch(/prefers-reduced-motion: reduce[\s\S]*\.arbor-breath-circle[\s\S]*transition: none/);
  });

  it("the copy makes no physiological or outcome claim, EN and HE", () => {
    const keys = Object.keys(en).filter((k) => k.startsWith("hm.now.breathe."));
    expect(keys.length).toBe(7);
    for (const k of keys) {
      expect(he[k], k).toBeTruthy();
      expect(`${en[k]} ${he[k]}`).not.toMatch(/vagus|nervous|cortisol|heart rate|calms? (?:your|the) child|regulat|עצב|קורטיזול|דופק/i);
    }
  });
});

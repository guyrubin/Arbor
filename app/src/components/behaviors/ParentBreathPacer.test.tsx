import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { BREATH_CYCLES, BREATH_IN_MS, BREATH_OUT_MS, BREATH_TOTAL_MS, BreathClock, ParentBreathPacer, breathClock, breathSchedule } from "./ParentBreathPacer";
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

describe("FEAT-06 — the visible 30 s clock (showClock)", () => {
  const src = readFileSync(path.resolve(__dirname, "ParentBreathPacer.tsx"), "utf8");

  it("the whole pacer is exactly half a minute", () => {
    expect(BREATH_TOTAL_MS).toBe(30_000);
    expect(BREATH_TOTAL_MS).toBe(breathSchedule().reduce((n, x) => n + x.ms, 0));
  });

  it("reads remaining time as m:ss, rounded up, never negative", () => {
    expect(breathClock(30_000)).toBe("0:30");
    expect(breathClock(29_001)).toBe("0:30");
    expect(breathClock(29_000)).toBe("0:29");
    expect(breathClock(9_500)).toBe("0:10");
    expect(breathClock(1)).toBe("0:01");
    expect(breathClock(0)).toBe("0:00");
    expect(breathClock(-5)).toBe("0:00");
    expect(breathClock(Number.NaN)).toBe("0:00");
    expect(breathClock(90_000)).toBe("1:30");
  });

  it("at rest the step row shows its own words and 0:30, and nothing is running", () => {
    const html = renderToStaticMarkup(<ParentBreathPacer t={t} showClock label="Step title" sub="Step body" />);
    expect(html).toContain('data-testid="breath-pacer-open"');
    expect(html).toContain("Step title");
    expect(html).toContain("Step body");
    expect(html).not.toContain("Steady yourself first");
    expect(html).toMatch(/data-testid="breath-pacer-clock"[^>]*>0:30</);
    expect(html).not.toContain('role="timer"');
    expect(html).not.toContain('data-testid="breath-pacer"');
  });

  it("while running the clock is a timer that is not announced every second", () => {
    const html = renderToStaticMarkup(<BreathClock remainingMs={12_400} running />);
    expect(html).toContain('role="timer"');
    expect(html).toContain('aria-live="off"');
    expect(html).toContain(">0:13<");
    const done = renderToStaticMarkup(<BreathClock remainingMs={0} running={false} />);
    expect(done).not.toContain('role="timer"');
    expect(done).toContain(">0:00<");
  });

  it("without showClock the B-ASKJB-40 row is unchanged (no clock)", () => {
    const html = renderToStaticMarkup(<ParentBreathPacer t={t} />);
    expect(html).not.toContain("breath-pacer-clock");
  });

  it("the clock is text (kept under reduced motion), user-started (no autoplay), and stops on skip", () => {
    // The countdown starts only from the open button's click.
    expect(src).toMatch(/data-testid="breath-pacer-open"\s*onClick=\{\(\) => \{ const at = Date\.now\(\); setStep\(0\); setStartedAt\(at\);/);
    // The interval runs only while the clock shows and the breath is running.
    expect(src).toContain('if (!showClock || !open || phase === "done" || startedAt === null) return;');
    expect(src).toContain("setOpen(false); setStep(0); setStartedAt(null);");
    // Reduced motion drops the circle's movement only; the clock is not in the CSS rule.
    expect(css).not.toContain("breath-pacer-clock");
  });
});

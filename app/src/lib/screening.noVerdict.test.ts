/* B-CAREPRO-45 — the Development Check never reassures and never grades.
 * Every result screen reads "Your answers are saved for your next check-up" +
 * the answers; a quiet "worth a conversation" line routes to Care only when an
 * answer is "not yet"; no "calm" / "on track" wording in either language; one
 * CDC gross-motor question per band from 2 years. */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { AGE_BANDS, scoreScreening } from "./screening";
import { en as calmEn, he as calmHe } from "./i18nElevation/screeningcalm";
import { en, he } from "./i18n";

const SRC = resolve(__dirname, "..");
const code = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|\s)\/\/.*$/gm, "$1").replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, "");
const SCREENING = code(readFileSync(join(SRC, "components/sections/Screening.tsx"), "utf8"));

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : /\.tsx?$/.test(f) && !/\.test\./.test(f) ? [p] : [];
  });

describe("B-CAREPRO-45 — no verdict consumer of scoreScreening", () => {
  it("no component renders on_track / elevated / a per-area status as a verdict", () => {
    for (const file of walk(join(SRC, "components"))) {
      const src = code(readFileSync(file, "utf8"));
      expect(src, file).not.toMatch(/["']on_track["']/);
      expect(src, file).not.toMatch(/\b(?:result|last|screening|lastScreening)\??\.elevated\b/);
      expect(src, file).not.toMatch(/\.status === ["']watch["']/);
    }
  });

  it("the result screen: saved line + the answers + the quiet Care line on 'not yet' only", () => {
    expect(SCREENING).toContain('tCalm(uiLang, "elev.screencalm.saved.title")');
    expect(SCREENING).toContain('data-testid="screen-saved-answers"');
    expect(SCREENING).toMatch(/notYetAreas\.length > 0 && \(/);
    expect(SCREENING).toMatch(/a\.answer === "not_yet"/);
    expect(SCREENING).toContain("prepareForVisit(notYetAreas)");
    // the old verdict seams are gone
    for (const gone of ["elev.screencalm.title.none", "elev.screencalm.title.one", "elev.screencalm.row.reviewed", "elev.screencalm.row.discuss", "elev.gcare.screen.calm.title", "screen.last.calm", '"monitor.calm"']) {
      expect(SCREENING, gone).not.toContain(gone);
    }
  });

  it("the record keeps the answers it was built from", () => {
    const band = AGE_BANDS.find((b) => b.id === "2-3")!;
    const answers = Object.fromEntries(band.items.map((it, i) => [it.id, i === 0 ? "not_yet" : "yes"])) as Record<string, "yes" | "not_yet">;
    const r = scoreScreening(band.items, { ...answers, "not-in-band": "yes" });
    expect(r.answers).toEqual(answers);
  });

  it("the new strings: 'saved for your next check-up', EN + HE, and no calm / on-track wording", () => {
    expect(calmEn["elev.screencalm.saved.title"]).toBe("Your answers are saved for your next check-up");
    expect(calmHe["elev.screencalm.saved.title"]).toBeTruthy();
    const keys = Object.keys(calmEn).filter((k) => k.startsWith("elev.screencalm.saved.") || k === "elev.screencalm.monitor.none");
    expect(keys.length).toBe(5);
    for (const k of keys) {
      expect(calmHe[k], k).toBeTruthy();
      expect(calmEn[k], k).not.toMatch(/\bcalm|on[- ]track|nothing (stood|stands) out|all good|no concern/i);
      expect(calmHe[k], k).not.toMatch(/רגוע|בסדר גמור|תקין|אין סיבה לדאגה/);
    }
  });
});

describe("B-CAREPRO-45 — one CDC gross-motor question per band from 2 years", () => {
  const CDC = { "2-3": "b23-mot1", "3-5": "b35-mot2", "5-8": "b58-mot1" } as const;
  it.each(Object.entries(CDC))("band %s carries %s (EN + HE)", (bandId, itemId) => {
    const band = AGE_BANDS.find((b) => b.id === bandId)!;
    const item = band.items.find((i) => i.id === itemId);
    expect(item?.domain).toBe("sensory_motor_patterns");
    expect(en[`screen.item.${itemId}`]).toBe(item?.prompt);
    expect(he[`screen.item.${itemId}`]).toBeTruthy();
  });
  it("the source cites the CDC checklist page per question", () => {
    const src = readFileSync(join(SRC, "lib/screening.ts"), "utf8");
    for (const age of ["2-years", "4-years", "5-years"]) expect(src).toContain(`https://www.cdc.gov/act-early/milestones/${age}.html`);
  });
  it.todo("8–12: the CDC milestone checklist ends at 5 years — no CDC-sourced gross-motor item (framer residue, REJECTIONS P1-NEXTLEVEL 6 Oct)");
});

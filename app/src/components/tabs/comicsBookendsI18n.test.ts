import { describe, expect, it } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

/**
 * AIX-S7 — ComicsTab's two bookend states are bilingual.
 *
 * The file was he-aware everywhere EXCEPT the no-hero invitation panel and
 * the trust/safety footer — Hebrew families hit English exactly at the entry
 * gate and at the trust message. Both now follow the file's existing he?
 * pattern (ComicsTab is on the frozen LEGACY_INLINE_HE_FILES allowlist in
 * i18nInlineCopy.test.ts — kid-register copy behind the native transcreation
 * gate), and the safety claims must survive verbatim in meaning in BOTH
 * languages: never-a-real-photo + provenance-watermarked.
 */

const TAB_PATH = path.resolve(__dirname, "ComicsTab.tsx");
const code = fs.readFileSync(TAB_PATH, "utf8");
const stripped = code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

describe("AIX-S7 — the no-hero invitation bookend is bilingual", () => {
  it("headline, body and CTA all carry an he? branch with Hebrew copy", () => {
    expect(stripped).toContain("קודם כול, צרו את הגיבור של");
    expect(stripped).toContain("צרו את הגיבור של");
    expect(stripped).toContain("הפכו את");
    // The EN branch is unchanged.
    expect(stripped).toContain("First, create");
    expect(stripped).toContain("comic superhero");
    expect(stripped).toMatch(/PlayHeader[\s\S]{0,300}?say=\{he \?/);
  });

  it("the invite body renders with dir handled (dir=\"auto\")", () => {
    const noHero = stripped.slice(stripped.indexOf("if (!hasHero)"), stripped.indexOf("const openAdventure"));
    expect(noHero).toContain('dir="auto"');
  });
});

describe("AIX-S7 — the trust/safety footer keeps its claims verbatim in meaning in BOTH languages", () => {
  it("EN: never-a-real-photo + provenance-watermarked survive unchanged", () => {
    expect(stripped).toContain("never a real photo");
    expect(stripped).toContain("provenance-watermarked");
    expect(stripped).toMatch(/he \? .בטוח ופרטי. : "Safe & private"/);
  });

  it("HE: the same claims exist — לעולם לא תמונה אמיתית + סימן מים של מקור", () => {
    expect(stripped).toContain("לעולם לא בתמונה אמיתית");
    expect(stripped).toContain("סימן מים של מקור");
    expect(stripped).toContain("בטוח ופרטי");
  });

  it("both footer claims sit in the SAME he? ternary — no fork between languages", () => {
    const footer = stripped.slice(stripped.indexOf("verified_user"));
    expect(footer).toMatch(/he\s*\n?\s*\?\s*`[^`]*לעולם לא בתמונה אמיתית[^`]*`\s*:\s*`[^`]*never a real photo[^`]*`/);
  });
});

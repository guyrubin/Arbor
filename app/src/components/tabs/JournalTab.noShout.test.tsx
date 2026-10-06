/* B-ASKJB-34 — the Journal does not shout. Source pins on JournalTab.tsx (the
 * #/journal main): no upper-case labels, no gradient classes, no text under
 * 12 px, the removed eyebrow stays removed, and the one licensed gradient (the
 * Text capture tile = the capture-moment stamp, primaryMove.gradient ratchet)
 * stays the only one. Rendered measurement is the sweep's weight block
 * (B-INF-06). */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = readFileSync(resolve(__dirname, "JournalTab.tsx"), "utf8");
// code only: comments may name what was removed
const CODE = SRC.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\{\s*\}/g, "");

describe("B-ASKJB-34 — #/journal speaks in sentence case and one weight of grey", () => {
  it("the 'Catch the moment before it's gone' eyebrow is gone", () => {
    expect(CODE).not.toContain('t("journal.eyebrow")');
    expect(CODE).not.toContain("Catch the moment");
  });

  it("0 upper-case labels and 0 letter-spaced shouting", () => {
    expect(CODE).not.toMatch(/\buppercase\b/);
    expect(CODE).not.toMatch(/textTransform/);
    expect(CODE).not.toMatch(/tracking-(?:wide|wider|widest)\b/);
  });

  it("0 gradient classes; the licensed capture tile is the one gradient", () => {
    expect(CODE).not.toMatch(/bg-gradient-|\bfrom-\[|\bvia-\[|linear-gradient|radial-gradient/);
    expect(CODE.match(/--gradient-/g) ?? []).toHaveLength(1);
    expect(CODE).toMatch(/key === "text"\s*\?\s*\{[^}]*background: "var\(--gradient-cta\)"/);
  });

  it("no text under 12 px: no t-xs, no t-caption, no px literals under 12", () => {
    expect(CODE).not.toMatch(/\bt-xs\b|--t-xs|--t-caption|\bt-caption\b/);
    expect(CODE).not.toMatch(/text-\[(?:[0-9]|1[01])(?:\.\d+)?px\]/);
  });

  it("the child's play rows are the quiet line; the parent's words lead", () => {
    expect(CODE).toContain('const quiet = prov === "child"');
    expect(CODE).toMatch(/quiet \? "t-sm leading-relaxed"/);
    expect(CODE).toContain('data-testid="journal-row-words"');
  });

  it("the compose label is one quiet grey, not a second accent", () => {
    expect(CODE).toContain('<p className="t-sm" style={{ color: "var(--arbor-muted)" }}>{t("journal.compose.eyebrow")}</p>');
  });
});

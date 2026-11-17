import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { milestonesV10Copy } from "../companion/milestonesV10Copy";

/** V77 (N-About-D): "Worth knowing at three" closes About's desk rail — the
 *  shared NowWorthKnowing card (today's reviewed Learn pick), My child's own
 *  kicker rule, no new developmental sentence; the phone board does not draw it. */
const src = readFileSync(new URL("../sections/ChildProfile.tsx", import.meta.url), "utf8");
const block = src.slice(src.indexOf('data-testid="about-worth-knowing"') - 120, src.indexOf("</div>", src.indexOf('data-testid="about-worth-knowing"')));

describe("About · Worth knowing", () => {
  it("is the shared card, after the last visit, on the desk only", () => {
    expect(block).toContain("<NowWorthKnowing");
    expect(block).toContain('source="about-worth-knowing"');
    expect(block).toContain("{desk && (");
    expect(src.indexOf("<AboutLastVisit")).toBeLessThan(src.indexOf('data-testid="about-worth-knowing"'));
  });
  it("uses My child's kicker rule and copy (in words, both languages)", () => {
    expect(src).toContain('msCopy.worthKnowingAt.replace("{age}", msCopy.ageWords[years])');
    for (const lang of ["en", "he"] as const) {
      const c = milestonesV10Copy(lang);
      expect(c.worthKnowingAt).toContain("{age}");
      expect(c.ageWords[3]).toMatch(/\S/);
    }
  });
  it("negative controls: one card on the page, no sentence of its own, never on the phone", () => {
    expect(src.split("<NowWorthKnowing").length - 1).toBe(1);
    // the block passes copy keys and a source id, never a written sentence
    expect(block).not.toMatch(/>[^<{]*[a-z]{3,}[^<{]*</i);
    expect(block).not.toContain("composition={composition}");
    expect(src).not.toMatch(/!desk && <div className="about-know"/);
  });
});

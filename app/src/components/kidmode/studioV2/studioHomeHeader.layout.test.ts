/**
 * B-KID-162 (wave-3 kids round 2) — at phone width a long child name hid
 * "Pick a world to play in" under the keepsakes chip, which was pinned at
 * 82px. The chip now flows under the greeting (the header wraps, the exit
 * stays top-end) and the greeting keeps to two lines, so a long name moves the
 * chip down without reaching the doors. Rendered evidence: 390x844 EN / HE
 * with a long name (the wave-3 kids-p1 shots).
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(new URL("./studioV2.css", import.meta.url), "utf8");
const phone = css.slice(css.indexOf("@media(max-width:640px){"));
const rule = (selector: string) => {
  const at = phone.indexOf(`${selector}{`);
  return at < 0 ? "" : phone.slice(at + selector.length + 1, phone.indexOf("}", at));
};

describe("B-KID-162: the phone header keeps the keepsakes chip clear of the greeting", () => {
  it("the chip flows (no absolute position, no fixed top) and comes after the exit", () => {
    const chip = rule(".studio-v2__header-actions>.studio-v2__glass-button");
    expect(chip).toContain("position:static");
    expect(chip).not.toMatch(/position:absolute|inset-block-start/);
    expect(chip).toContain("order:3");
    expect(rule(".studio-v2__header-actions>:not(.studio-v2__glass-button)")).toContain("order:2");
  });
  it("the header wraps and the greeting holds the first line beside the exit", () => {
    expect(rule(".studio-v2__header")).toContain("flex-wrap:wrap");
    expect(rule(".studio-v2__greeting")).toContain("flex:1 1 calc(100% - 78px)");
  });
  it("round 2: Tab meets the doors in reading order (Hero Stories, Studio, then Playbank, Feelings)", async () => {
    const { STUDIO_DOOR_ORDER } = await import("./StudioHome");
    const { STUDIO_V2_WORLDS } = await import("./studioCatalog");
    expect(STUDIO_DOOR_ORDER).toEqual(["stories", "studio", "playbank", "feelings"]);
    expect([...STUDIO_DOOR_ORDER].sort()).toEqual([...STUDIO_V2_WORLDS].sort());
    expect(readFileSync(new URL("./StudioHome.tsx", import.meta.url), "utf8")).toContain("{STUDIO_DOOR_ORDER.map(worldId =>");
    // the upper doors sit above the lower ones at every width
    for (const block of [css, phone]) {
      const top = (w: string) => Number((new RegExp(`studio-v2__door\\[data-world=${w}\\]\\{[^}]*inset-block-start:([\\d.]+)`).exec(block) ?? [])[1]);
      expect(top("stories")).toBeLessThan(top("playbank"));
      expect(top("studio")).toBeLessThan(top("feelings"));
    }
  });
  it("a long name keeps to two lines", () => {
    const span = rule(".studio-v2__greeting h1>span");
    expect(span).toContain("-webkit-line-clamp:2");
    expect(span).toContain("overflow:hidden");
  });
});

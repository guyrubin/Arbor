/**
 * B-KID-162 (wave-3 kids round 2) — at phone width a long child name hid
 * "Pick a world to play in" under the keepsakes chip, which was pinned at
 * 82px. The chip now flows under the greeting (the header wraps, the exit
 * stays top-end) and the greeting keeps to two lines, so a long name moves the
 * chip down without reaching the doors. Rendered evidence: 390x844 EN / HE
 * with a long name (the wave-3 kids-p1 shots).
 *
 * Wave 4 (200% text): the doors no longer sit at a fixed 166px top; the phone
 * home is a grid whose header row grows with its text, so the doors flow below
 * it and a long name wraps in full. The browser half (320 / 375, EN / HE,
 * 100% and 200% text, a long name) is scripts/kids-performance-browser.mjs.
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
    expect(chip).toContain("order:4");
    expect(rule(".studio-v2__header-actions>:not(.studio-v2__glass-button)")).toContain("order:2");
  });
  it("the header wraps and the greeting holds the first line beside the exit", () => {
    expect(rule(".studio-v2__header")).toContain("flex-wrap:wrap");
    // only the chip takes line 2: a zero-height break between the exit (order 2) and the chip (order 4)
    expect(rule(".studio-v2__header::after")).toMatch(/order:3;flex-basis:100%/);
    expect(rule(".studio-v2__greeting")).toContain("flex:1 1 0;min-inline-size:0");
  });
  it("round 2: Tab meets the doors in reading order (Hero Stories, Studio, then Playbank, Feelings)", async () => {
    const { STUDIO_DOOR_ORDER } = await import("./StudioHome");
    const { STUDIO_V2_WORLDS } = await import("./studioCatalog");
    expect(STUDIO_DOOR_ORDER).toEqual(["stories", "studio", "playbank", "feelings"]);
    expect([...STUDIO_DOOR_ORDER].sort()).toEqual([...STUDIO_V2_WORLDS].sort());
    expect(readFileSync(new URL("./StudioHome.tsx", import.meta.url), "utf8")).toContain("{STUDIO_DOOR_ORDER.map(worldId =>");
    // the upper doors sit above the lower ones at every width (wide: by their top; phone: by their grid row)
    const top = (w: string) => Number((new RegExp(`studio-v2__door\\[data-world=${w}\\]\\{[^}]*inset-block-start:([\\d.]+)`).exec(css) ?? [])[1]);
    expect(top("stories")).toBeLessThan(top("playbank"));
    expect(top("studio")).toBeLessThan(top("feelings"));
    const row = (w: string) => Number((/grid-row:(\d+)/.exec(rule(`.studio-v2__door[data-world=${w}]`)) ?? [])[1]);
    expect(row("stories")).toBe(2);
    expect(row("studio")).toBe(2);
    expect(row("playbank")).toBe(3);
    expect(row("feelings")).toBe(3);
  }, 30_000); // a cold import of StudioHome takes over 5 s on a loaded box (also before wave 4)
});

describe("B-KID-162 (200% text): the phone doors flow below the header; a long name is never cut", () => {
  it("no door has a fixed offset: each is in flow in the home grid, under the header's own row", () => {
    // each door resets the wide layout's percentage insets (a relative door would still be offset by them)
    for (const w of ["stories", "studio", "playbank", "feelings"]) expect(rule(`.studio-v2__door[data-world=${w}]`)).toMatch(/^inset:auto;grid-column:\d;grid-row:\d;margin-block(-start)?:[\d px]+$/);
    expect(rule(".studio-v2__door")).toContain("position:relative;inset:auto");
    const home = rule(".studio-v2--home");
    expect(home).toContain("display:grid");
    // the header row grows with its text (minmax(…, auto)); the old 574px reservation is gone
    expect(home).toMatch(/grid-template-rows:minmax\(130px,auto\)/);
    expect(home).not.toMatch(/padding-block:574px/);
    const header = rule(".studio-v2__header");
    expect(header).toContain("position:relative;inset:auto;grid-column:1/-1;grid-row:1");
    // default text keeps the fixed layout's door lines: 22 + 130 + 14 = 166px, and the lower doors at 22 + 130 + 198 = 350px
    expect(home).toContain("padding-block:22px 12px");
    expect(home).toMatch(/grid-template-rows:minmax\(130px,auto\) minmax\(198px,auto\) auto minmax\(calc\(40px \+ 2\.25em\),auto\) auto 1fr/);
    expect(rule(".studio-v2__door[data-world=stories]")).toContain("margin-block:14px 27px");
    expect(rule(".studio-v2__door[data-world=playbank]")).toContain("margin-block-start:0");
  });
  it("the hero stands in the door rows' grid area down to the foot row (absolute, so it never sizes them); the guide and quest follow in flow", () => {
    expect(rule(".studio-v2__hero")).toMatch(/grid-column:1\/-1;grid-row:2\/5;.*inset-block-start:90px;inset-block-end:0/);
    expect(rule(".studio-v2__guide")).toMatch(/grid-row:5;margin:12px/);
    expect(rule(".studio-v2__quest")).toMatch(/grid-row:6/);
  });
  it("fix round 2: with no hero yet, the 'A place for your hero' label flows IN the foot row, under the lower doors (it overlapped them by 4px)", () => {
    expect(phone).toContain(".studio-v2__hero[data-avatar-source=mascot],.studio-v2__hero[data-avatar-source=mascot]>.studio-v2__hero-empty{display:contents}");
    expect(rule(".studio-v2__hero[data-avatar-source=mascot]>.studio-v2__hero-empty>p")).toMatch(/grid-row:4;.*margin:17px 0 0/);
    // the mascot stays between the lower doors without sizing their row
    expect(rule(".studio-v2__hero[data-avatar-source=mascot]>.studio-v2__hero-empty>svg")).toMatch(/grid-row:3;.*align-self:end;margin-block:-40px -9px/);
    // the browser half: the Kids home cells assert the label meets no door at 320/375, EN/HE, 100% and 200%
    const browser = readFileSync(new URL("../../../../scripts/kids-performance-browser.mjs", import.meta.url), "utf8");
    expect(browser).toContain("assert.deepEqual(m.labelMeetsDoor, [], `The hero label meets no door");
    expect(browser).toMatch(/for \(const width of \[320, 375\]\) for \(const lang of \['en', 'he'\]\) for \(const text of \[1, 2\]\)/);
  });
  it("a long name wraps in full (no line limit cuts it)", () => {
    const span = rule(".studio-v2__greeting h1>span");
    expect(span).not.toMatch(/line-clamp|overflow:hidden/);
    expect(span).toContain("overflow-wrap:anywhere");
  });
});

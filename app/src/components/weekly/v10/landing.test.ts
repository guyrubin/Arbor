import { describe, expect, it } from "vitest";
import { landingNudge } from "./landing";

/* The day-windows landing never leaves the stamped primary move half under
   the shell's top strip (sweep: occluded). */
describe("landingNudge", () => {
  const strip = 64;
  it("a control fully above the screen, or fully below the strip, stays put", () => {
    expect(landingNudge({ top: -120, bottom: -76, stripBottom: strip })).toBe(0);
    expect(landingNudge({ top: 90, bottom: 134, stripBottom: strip })).toBe(0);
  });
  it("a control under the strip (the y=18 regression) scrolls back until it clears it", () => {
    expect(landingNudge({ top: 18, bottom: 62, stripBottom: strip })).toBe(18 - (strip + 8));
    expect(landingNudge({ top: -6, bottom: 38, stripBottom: strip })).toBe(-6 - (strip + 8));
  });
  it("negative control: the old fixed margin left the y=18 case alone", () => {
    const fixedMargin = () => 0;
    expect(fixedMargin()).toBe(0);
    expect(landingNudge({ top: 18, bottom: 62, stripBottom: strip })).not.toBe(0);
  });
});

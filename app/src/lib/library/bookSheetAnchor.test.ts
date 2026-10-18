import { describe, expect, it } from "vitest";
import { readSpriteAnchor } from "./bookSheet";

const measured = { aspect: 0.5, footX: 0.5, footW: 0.4 };

describe("book sprite anchor integrity (B-BOOK-69)", () => {
  it("preserves valid measured anchors, including HTTP query strings", () => {
    expect(readSpriteAnchor(measured)).toEqual(measured);
    expect(readSpriteAnchor({ aspect: "0.5", footX: "0.5", footW: "0.4" })).toEqual(measured);
    expect(readSpriteAnchor({ aspect: 1, footX: 0.5, footW: 1 })).toEqual({ aspect: 1, footX: 0.5, footW: 1 });
  });

  it.each([
    { ...measured, footX: 0.05 },
    { ...measured, footX: 0.95 },
    { ...measured, footX: 0 },
    { ...measured, footX: 1 },
    { ...measured, footW: 0.000001 },
    { ...measured, aspect: 0.050001 },
    { ...measured, aspect: 4.999999 },
    { ...measured, footW: Infinity },
    { ...measured, footX: NaN },
    { ...measured, aspect: "Infinity" },
    { ...measured, footW: [] },
    { ...measured, footX: true },
  ])("rejects impossible or rounding-degenerate geometry: %j", (anchor) => {
    expect(readSpriteAnchor(anchor)).toBeNull();
  });

  it("tolerates only the existing keyer's four-decimal boundary rounding", () => {
    // Both centre and width are independently rounded by bookSpriteAnchor.
    expect(readSpriteAnchor({ aspect: 1, footX: 0.0656, footW: 0.1313 })).not.toBeNull();
    expect(readSpriteAnchor({ aspect: 1, footX: 0.9344, footW: 0.1313 })).not.toBeNull();
    expect(readSpriteAnchor({ aspect: 1, footX: 0.0654, footW: 0.1313 })).toBeNull();
    expect(readSpriteAnchor({ aspect: 1, footX: 0.9346, footW: 0.1313 })).toBeNull();
  });

  it("accepts the keyer's measured pixel bands without changing their values", () => {
    const r4 = (n: number) => Math.round(n * 10000) / 10000;
    for (const width of [16, 31, 128, 257, 512, 1024, 2048]) {
      for (let start = 0; start < width - 1; start += Math.max(1, Math.floor(width / 17))) {
        for (const end of [start + 1, Math.floor((start + width) / 2), width - 1]) {
          const anchor = { aspect: 1, footX: r4((start + end) / 2 / width), footW: r4((end - start) / width) };
          expect(readSpriteAnchor(anchor), JSON.stringify({ width, start, end })).toEqual(anchor);
        }
      }
    }
  });

  it("returns only values that remain valid on a second read", () => {
    for (let i = 1; i < 500; i++) {
      const anchor = readSpriteAnchor({ aspect: 0.05 + i * 0.0099, footX: 0.5, footW: i / 500 });
      if (anchor) expect(readSpriteAnchor(anchor)).toEqual(anchor);
    }
  });
});

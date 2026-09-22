/**
 * M4 — the hero data-URL budget (kids gauntlet, 22 Sep 2026).
 *
 * A generated hero is stored INLINE in the child document, so an unbounded
 * data URL is not a size nicety: past ~1 MiB the Firestore write fails, and
 * until this wave that failure was swallowed (see heroPersistence.test.ts).
 * This file pins the bound itself; the encoder is injected so the ladder is
 * exercised without a DOM.
 */
import { describe, it, expect } from "vitest";
import { HERO_MAX_BYTES, dataUrlByteLength, shrinkDataUrlToBudget } from "./image";

/** A base64 data URL whose decoded payload is ~`bytes` long. */
function dataUrlOfBytes(bytes: number): string {
  return `data:image/jpeg;base64,${"A".repeat(Math.ceil(bytes / 3) * 4)}`;
}

describe("dataUrlByteLength", () => {
  it("measures the DECODED payload, not the string", () => {
    // 4 base64 chars → 3 bytes.
    expect(dataUrlByteLength("data:image/png;base64,AAAA")).toBe(3);
    expect(dataUrlByteLength("data:image/png;base64,AAA=")).toBe(2);
    expect(dataUrlByteLength("data:image/png;base64,AA==")).toBe(1);
  });

  it("falls back to raw length for a non-base64 or malformed URL", () => {
    expect(dataUrlByteLength("data:image/svg+xml,<svg/>")).toBe("<svg/>".length);
    expect(dataUrlByteLength("not-a-data-url")).toBe("not-a-data-url".length);
  });

  it("the budget is the 200 KB the M4 brief names", () => {
    expect(HERO_MAX_BYTES).toBe(200_000);
  });
});

describe("shrinkDataUrlToBudget", () => {
  it("leaves an already-small hero untouched (no quality lost for nothing)", async () => {
    const small = dataUrlOfBytes(50_000);
    let calls = 0;
    const out = await shrinkDataUrlToBudget(small, { encode: async () => { calls += 1; return dataUrlOfBytes(10); } });
    expect(out).toBe(small);
    expect(calls).toBe(0);
  });

  it("returns the FIRST candidate inside the budget (widest/sharpest wins)", async () => {
    const attempts: Array<{ dim: number; quality: number }> = [];
    const out = await shrinkDataUrlToBudget(dataUrlOfBytes(900_000), {
      steps: [
        { dim: 512, quality: 0.86 },
        { dim: 512, quality: 0.72 },
        { dim: 256, quality: 0.6 },
      ],
      encode: async (_url, dim, quality) => {
        attempts.push({ dim, quality });
        // Only the second attempt gets under the budget.
        return dataUrlOfBytes(attempts.length === 1 ? 400_000 : 150_000);
      },
    });
    expect(dataUrlByteLength(out)).toBeLessThanOrEqual(HERO_MAX_BYTES);
    expect(attempts).toEqual([
      { dim: 512, quality: 0.86 },
      { dim: 512, quality: 0.72 },
    ]);
  });

  it("walks the whole ladder and keeps the SMALLEST when nothing fits", async () => {
    const sizes = [800_000, 600_000, 300_000];
    let i = 0;
    const out = await shrinkDataUrlToBudget(dataUrlOfBytes(2_000_000), {
      steps: [{ dim: 512, quality: 0.8 }, { dim: 384, quality: 0.7 }, { dim: 256, quality: 0.6 }],
      encode: async () => dataUrlOfBytes(sizes[i++]),
    });
    expect(dataUrlByteLength(out)).toBeLessThanOrEqual(dataUrlByteLength(dataUrlOfBytes(300_000)));
    expect(dataUrlByteLength(out)).toBeLessThan(dataUrlByteLength(dataUrlOfBytes(2_000_000)));
  });

  it("degrades to the original when the platform cannot re-encode at all", async () => {
    const big = dataUrlOfBytes(900_000);
    // No canvas (SSR, a locked-down webview): the parent still gets a hero, and
    // the write either lands or fails LOUDLY — never a silent empty profile.
    expect(await shrinkDataUrlToBudget(big, { encode: async () => null })).toBe(big);
  });

  it("an empty string is returned as-is (nothing to bound)", async () => {
    expect(await shrinkDataUrlToBudget("", { encode: async () => dataUrlOfBytes(10) })).toBe("");
  });
});

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { statueShareAllowed } from "./statueShareGate";

describe("statue production share gate", () => {
  it("fails closed independently of the released game and local flags", () => {
    expect(statueShareAllowed(false)).toBe(false);
    expect(statueShareAllowed(undefined as unknown as boolean)).toBe(false);
    expect(statueShareAllowed(true)).toBe(true);
    const source = readFileSync(new URL("../../SneakHandBackCard.tsx", import.meta.url), "utf8");
    expect(source).toContain("statueShareAllowed(import.meta.env.DEV)");
    expect(source).toContain("shareLabel={shareAllowed ?");
    expect(source).toContain("if (shareAllowed && picture)");
    expect(source).not.toContain("sneakFreezeFlagOn");
  });
});

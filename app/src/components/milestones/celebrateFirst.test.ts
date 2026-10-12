import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/* v3 F-CHILD-1 — one burst per skill ever, per child, through the shared
   helper the Milestones pill uses. Real CelebrationMoment storage helpers
   over an in-memory localStorage; only the confetti burst is a spy. */

const h = vi.hoisted(() => ({ celebrate: vi.fn() }));
vi.mock("../../lib/celebrate", () => ({ celebrate: h.celebrate }));

import { celebrateFirstOnce } from "./celebrateFirst";
import { celebrateSeenKey } from "../ui/CelebrationMoment";

let map: Map<string, string>;
beforeEach(() => {
  h.celebrate.mockClear();
  map = new Map();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => { map.set(k, String(v)); },
    removeItem: (k: string) => { map.delete(k); },
  });
});
afterEach(() => vi.unstubAllGlobals());

describe("v3 F-CHILD-1 — celebrateFirstOnce", () => {
  it("celebrates a skill once for a child, then never again", () => {
    expect(celebrateFirstOnce("child-a", "ms-1")).toBe(true);
    expect(h.celebrate).toHaveBeenCalledOnce();
    expect(h.celebrate).toHaveBeenCalledWith({ kind: "milestone" });
    expect(JSON.parse(map.get(celebrateSeenKey("child-a"))!)).toEqual(["ms-1"]);

    expect(celebrateFirstOnce("child-a", "ms-1")).toBe(false);
    expect(h.celebrate).toHaveBeenCalledOnce();
  });

  it("another skill, or the same skill for a sibling, is its own first", () => {
    celebrateFirstOnce("child-a", "ms-1");
    expect(celebrateFirstOnce("child-a", "ms-2")).toBe(true);
    expect(celebrateFirstOnce("child-b", "ms-1")).toBe(true);
    expect(h.celebrate).toHaveBeenCalledTimes(3);
  });

  it("the Milestones pill celebrates through the helper, never a fork of its steps", async () => {
    const { readFileSync } = await import("node:fs");
    const path = await import("node:path");
    const { fileURLToPath } = await import("node:url");
    const here = path.dirname(fileURLToPath(import.meta.url));
    const source = readFileSync(path.join(here, "..", "companion", "MilestoneAreas.tsx"), "utf8");
    expect(source).toContain("celebrateFirstOnce(childProfile.id, id)");
    expect(source).not.toMatch(/\bhasCelebrated\(|\bmarkCelebrated\(|\bcelebrate\(\{/);
  });
});

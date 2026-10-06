/**
 * B-GROWTH-42 — rendering the Copilot hook with a LOADED bandSnapshots
 * collection performs no write (spy), and the removed weekly effect stays
 * removed (source pin).
 *
 * B-GROWTH-22a (dabdf296) deleted the writer; this guard is the item's named
 * render-level proof. The hook runs as a plain function under a React shim in
 * which every useEffect callback executes immediately, so a re-introduced
 * persist effect would call the spied upsert during the "render".
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

const spy = vi.hoisted(() => ({
  upsert: vi.fn(async () => {}),
  remove: vi.fn(async () => {}),
  effects: 0,
  bound: [] as string[],
}));

vi.mock("react", async (orig) => {
  const real = await orig<typeof import("react")>();
  return {
    ...real,
    useMemo: (f: () => unknown) => f(),
    useCallback: (f: unknown) => f,
    useEffect: (f: () => unknown) => {
      spy.effects += 1;
      f();
    },
  };
});

vi.mock("../hooks/useChildCollection", () => ({
  useChildCollection: (_childId: string, name: string) => {
    spy.bound.push(name);
    const items =
      name === "bandSnapshots"
        ? [
            { id: "2026-W38", date: "2026-09-15", bands: [] },
            { id: "2026-W39", date: "2026-09-22", bands: [] },
          ]
        : [];
    return { items, loaded: true, loading: false, upsert: spy.upsert, remove: spy.remove };
  },
}));

import { useCopilot } from "./usePracticeData";

const col = () => ({ items: [], loaded: true, loading: false, upsert: vi.fn(), remove: vi.fn() });

describe("B-GROWTH-42 — no weekly band-grade snapshot write", () => {
  it("rendering useCopilot with a loaded collection performs no upsert and runs no effect", () => {
    const data = {
      speech: col(),
      missions: col(),
      adventures: col(),
      events: col(),
      today: "2026-10-06",
    } as unknown as Parameters<typeof useCopilot>[1];
    const out = useCopilot([], data, "child-1");
    expect(spy.bound).toContain("bandSnapshots");
    expect(spy.upsert).not.toHaveBeenCalled();
    expect(spy.remove).not.toHaveBeenCalled();
    expect(spy.effects).toBe(0);
    // the legacy documents stay readable (two history cards) but nothing new is stored
    expect(out.snapshots).toHaveLength(2);
    expect(Object.keys(out)).not.toContain("trend");
  });

  it("source pin: the hook has no effect, no pendingSnapshot, no bandTrend, no write on the snapshots binding", () => {
    const src = fs.readFileSync(path.join(__dirname, "usePracticeData.ts"), "utf8");
    const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    expect(code).not.toMatch(/\buseEffect\b/);
    expect(code).not.toMatch(/\bpendingSnapshot\b/);
    expect(code).not.toMatch(/\bbandTrend\b/);
    expect(code).not.toMatch(/snapshotsCol\s*\.\s*(upsert|remove|set)\b/);
  });

  it("no non-test source file imports or calls bandTrend", () => {
    const root = path.join(__dirname, "..");
    const hits: string[] = [];
    const walk = (dir: string) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) walk(p);
        else if (/\.(ts|tsx)$/.test(e.name) && !/\.test\.(ts|tsx)$/.test(e.name)) {
          const code = fs.readFileSync(p, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
          if (/\bbandTrend\b/.test(code)) hits.push(path.relative(root, p));
        }
      }
    };
    walk(root);
    expect(hits).toEqual([]);
  });
});

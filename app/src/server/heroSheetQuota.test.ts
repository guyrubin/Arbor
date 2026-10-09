/**
 * B-GAME-13b — the hero sheet's own allowance (imageQuota.chargeHeroSheetCall),
 * in the imageQuota suite's style: one sheet per hero creation per child, retries
 * and redraws counted but never re-charged, a per-sheet call cap, a global
 * breaker of its own, Free = no sheet (GD-5), and the scene buckets untouched.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryCounterStore } from "./quotaStore.js";

async function load(env: Record<string, string> = {}) {
  for (const [k, v] of Object.entries(env)) process.env[k] = v;
  vi.resetModules();
  return await import("./imageQuota.js");
}
const ENV_KEYS = ["IMAGE_SHEET_GLOBAL_DAILY", "IMAGE_SHEET_CALLS_PER_SHEET", "IMAGE_PLUS_SHEETS_PER_30D"];
afterEach(() => { for (const k of ENV_KEYS) delete process.env[k]; });
const MONTH = 30 * 86400000;
const DAY = 86400000;

describe("B-GAME-13b: the hero sheet allowance", () => {
  it("defaults: breaker 1,500/day, 24 calls a sheet, sheets = the plan's hero creations, Free and signed-out none", async () => {
    const q = await load();
    expect(q.IMAGE_SHEET_GLOBAL_DAILY).toBe(1500);
    expect(q.IMAGE_SHEET_CALLS_PER_SHEET).toBe(24);
    expect(q.sheetsPer30Days("plus")).toBe(4);
    expect(q.sheetsPer30Days("family")).toBe(6);
    expect(q.sheetsPer30Days("free")).toBe(0);
    expect(q.sheetsPer30Days("signed_out")).toBe(0);
    expect(q.HERO_SHEET_POSES_BY_PLAN.free).toEqual([]);
    expect(q.HERO_SHEET_POSES_BY_PLAN.plus).toHaveLength(8);
    expect(q.HERO_SHEET_POSES_BY_PLAN.family).toEqual(q.HERO_SHEET_POSES_BY_PLAN.plus);
  });

  it("one sheet per hero: retries and redraws for the same hero are counted, never re-charged", async () => {
    const q = await load();
    const c = new MemoryCounterStore();
    const at = { plan: "plus" as const, uid: "u1", childId: "c1", avatarHash: "h1" };
    const first = await q.chargeHeroSheetCall(c, at);
    expect(first).toMatchObject({ ok: true, newSheet: true });
    for (let i = 0; i < 11; i++) expect(await q.chargeHeroSheetCall(c, at)).toMatchObject({ ok: true, newSheet: false });
    expect((await c.peek("img_sheet_30d", "u1:c1", MONTH)).count).toBe(1);
    expect((await c.peek("img_sheet_calls_30d", "u1:c1:h1", MONTH)).count).toBe(12);
    expect((await c.peek("img_sheet_global_daily", "all", DAY)).count).toBe(12);
    // A new hero is a new sheet.
    expect(await q.chargeHeroSheetCall(c, { ...at, avatarHash: "h2" })).toMatchObject({ ok: true, newSheet: true });
    expect((await c.peek("img_sheet_30d", "u1:c1", MONTH)).count).toBe(2);
  });

  it("never touches the scene day/month buckets or the hero-creation bucket", async () => {
    const q = await load();
    const c = new MemoryCounterStore();
    await q.chargeHeroSheetCall(c, { plan: "plus", uid: "u1", childId: "c1", avatarHash: "h1" });
    for (const [name, key, win] of [["img_user_daily", "u1", DAY], ["img_user_30d", "u1", MONTH], ["img_hero_30d", "u1", MONTH], ["img_global_daily", "all", DAY]] as const) {
      expect((await c.peek(name, key, win)).count, name).toBe(0);
    }
  });

  it("the per-child sheet limit: the fifth Plus hero in a window gets no sheet (and is not charged)", async () => {
    const q = await load();
    const c = new MemoryCounterStore();
    for (let i = 1; i <= 4; i++) expect((await q.chargeHeroSheetCall(c, { plan: "plus", uid: "u1", childId: "c1", avatarHash: `h${i}` })).ok).toBe(true);
    const fifth = await q.chargeHeroSheetCall(c, { plan: "plus", uid: "u1", childId: "c1", avatarHash: "h5" });
    expect(fifth).toMatchObject({ ok: false, status: 429 });
    if (!fifth.ok) expect((fifth as Extract<typeof fifth, { ok: false }>).body).toMatchObject({ code: "hero_sheet_resting", window: "month", retryable: false });
    expect((await c.peek("img_sheet_30d", "u1:c1", MONTH)).count).toBe(4);
    // Another child of the same family has its own sheets.
    expect((await q.chargeHeroSheetCall(c, { plan: "plus", uid: "u1", childId: "c2", avatarHash: "h1" })).ok).toBe(true);
  });

  it("the per-sheet call cap, and release() gives a failed call back", async () => {
    const q = await load({ IMAGE_SHEET_CALLS_PER_SHEET: "3" });
    const c = new MemoryCounterStore();
    const at = { plan: "family" as const, uid: "u1", childId: "c1", avatarHash: "h1" };
    const a = await q.chargeHeroSheetCall(c, at);
    await q.chargeHeroSheetCall(c, at);
    await q.chargeHeroSheetCall(c, at);
    const over = await q.chargeHeroSheetCall(c, at);
    expect(over).toMatchObject({ ok: false, status: 429 });
    if (!over.ok) expect((over as Extract<typeof over, { ok: false }>).body.window).toBe("sheet");
    if (a.ok) { await a.release(); await a.release(); }
    expect((await c.peek("img_sheet_calls_30d", "u1:c1:h1", MONTH)).count).toBe(2);
    expect((await q.chargeHeroSheetCall(c, at)).ok).toBe(true);
  });

  it("its own global breaker, counted on every attempt and never refunded", async () => {
    const q = await load({ IMAGE_SHEET_GLOBAL_DAILY: "2" });
    const c = new MemoryCounterStore();
    expect((await q.chargeHeroSheetCall(c, { plan: "plus", uid: "a", childId: "c", avatarHash: "h" })).ok).toBe(true);
    const b = await q.chargeHeroSheetCall(c, { plan: "plus", uid: "b", childId: "c", avatarHash: "h" });
    expect(b.ok).toBe(true);
    if (b.ok) await b.release();
    const third = await q.chargeHeroSheetCall(c, { plan: "plus", uid: "c", childId: "c", avatarHash: "h" });
    expect(third).toMatchObject({ ok: false, status: 429 });
    if (!third.ok) expect((third as Extract<typeof third, { ok: false }>).body).toMatchObject({ code: "hero_sheet_resting", window: "day" });
    expect((await c.peek("img_sheet_global_daily", "all", DAY)).count).toBe(3);
  });

  it("Free (and signed-out) are refused before any counter moves", async () => {
    const q = await load();
    const c = new MemoryCounterStore();
    for (const plan of ["free", "signed_out"] as const) {
      const r = await q.chargeHeroSheetCall(c, { plan, uid: "u1", childId: "c1", avatarHash: "h1" });
      expect(r).toMatchObject({ ok: false, status: 403 });
      if (!r.ok) expect((r as Extract<typeof r, { ok: false }>).body.code).toBe("hero_sheet_plan");
    }
    expect((await c.peek("img_sheet_global_daily", "all", DAY)).count).toBe(0);
  });
});

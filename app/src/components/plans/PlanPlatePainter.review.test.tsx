/**
 * B-BOOK-27 — the owner's review step in the plate painter: each painted
 * plate shows its review (not reviewed / reviewed by whom and when / a child
 * or person found / words found), "Mark reviewed" opens the painted master
 * with two boxes to tick only for what was seen, and saving posts exactly
 * those two flags to POST /api/admin/plan-plates/review. A refusal (403, 404,
 * a server error) is shown as it is and nothing is shown as saved. EN and HE.
 * Synthetic accounts only; no network (fetch is stubbed).
 */
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import PlanPlatePainter from "./PlanPlatePainter";
import { getPattern } from "../../lib/library/plans/planBooks";
import { planPlateTable } from "../../lib/library/plans/planPlates";
import { PlanApiError, reviewPlanPlate, type PlanPlateStatus } from "../../lib/plans/planApi";
import { adminPlateImageUrl, reviewLabel, submitPlateReview } from "../../lib/plans/plateReview";
import { PLAN_STRINGS } from "../../lib/plans/planStrings";
import { setAuthTokenProvider } from "../../lib/api";

const def = getPattern("plan-poo-sit")!;
const ids = Object.keys(planPlateTable(def.id));
const painted = Object.fromEntries(ids.map((id, i) => [id, i < 4 ? "painted" : "unpainted"])) as Record<string, "painted" | "unpainted">;
const STATUS: PlanPlateStatus = {
  storage: true,
  patterns: { [def.id]: painted } as PlanPlateStatus["patterns"],
  reviews: {
    [def.id]: {
      [ids[0]]: { state: "unreviewed" },
      [ids[1]]: { state: "reviewed", reviewedBy: "owner@example.test", reviewedAt: "2026-11-27T09:30:00.000Z" },
      [ids[2]]: { state: "child-painted", reviewedBy: "owner@example.test", reviewedAt: "2026-11-27T09:31:00.000Z" },
      [ids[3]]: { state: "has-text", reviewedBy: "owner@example.test", reviewedAt: "2026-11-27T09:32:00.000Z" },
    },
  },
  costPerImageUsd: 0.039,
  maxImagesPerRun: 80,
  maxUsdPerRun: 10,
};
const render = (props: Partial<React.ComponentProps<typeof PlanPlatePainter>> = {}) =>
  renderToStaticMarkup(<PlanPlatePainter lang="en" patterns={[def]} initialStatus={STATUS} {...props} />);
const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&#x27;/g, "'").replace(/\s+/g, " ");

afterEach(() => { vi.unstubAllGlobals(); setAuthTokenProvider(async () => null); });

describe("B-BOOK-27: the painter shows each painted plate's review", () => {
  it("one review line per PAINTED plate, with its state, reviewer and time; an unpainted plate has none", () => {
    const h = render();
    for (const [i, state] of (["unreviewed", "reviewed", "child-painted", "has-text"] as const).entries()) {
      expect(h).toContain(`data-plan-plate-review="${def.id}/${ids[i]}" data-review-state="${state}"`);
    }
    for (const id of ids.slice(4)) expect(h).not.toContain(`data-plan-plate-review="${def.id}/${id}"`);
    const t = text(h);
    expect(t).toContain("not reviewed — families do not see it");
    expect(t).toContain("reviewed by owner@example.test on 2026-11-27 09:30");
    expect(t).toContain("a child or person is in it (owner@example.test, 2026-11-27 09:31) — families do not see it");
    expect(t).toContain("words are in it (owner@example.test, 2026-11-27 09:32) — families do not see it");
    expect((h.match(/data-plan-plate-review-open=/g) ?? []).length).toBe(4);
  });

  it("an older server without reviews: every painted plate reads as not reviewed", () => {
    const h = render({ initialStatus: { ...STATUS, reviews: undefined } });
    expect((h.match(/data-review-state="unreviewed"/g) ?? []).length).toBe(4);
    expect(reviewLabel(undefined).key).toBe("plates.review.unreviewed");
  });

  it("Mark reviewed: the painted master full size, two unticked boxes, Save disabled until the picture has loaded", () => {
    const key = `${def.id}/${ids[0]}`;
    const loading = render({ initialConfirm: { pattern: def.id, plate: ids[0], childFree: false, textFree: false, image: null } });
    expect(loading).toContain(`data-plan-plate-review-panel="${key}"`);
    expect(loading).not.toContain("data-plan-plate-review-image");
    expect(loading).toMatch(new RegExp(`<button[^>]*disabled=""[^>]*data-plan-plate-review-save="${key}"`));
    const open = render({ initialConfirm: { pattern: def.id, plate: ids[0], childFree: false, textFree: false, image: "blob:synthetic/plate" } });
    expect(open).toContain('src="blob:synthetic/plate"');
    expect(open).not.toMatch(/data-plan-plate-review-childfree=""[^>]*checked/);
    expect(open).not.toMatch(/checked=""[^>]*data-plan-plate-review-childfree/);
    expect(open).not.toMatch(new RegExp(`<button[^>]*disabled=""[^>]*data-plan-plate-review-save="${key}"`));
    expect(text(open)).toContain(`Open ${ids[0]} full size and look at the whole picture. Tick only what you saw.`);
    expect(text(open)).toContain("No child, person, face or hands anywhere in the picture");
    // only one panel at a time: the other plates' open buttons are disabled
    expect(open).not.toContain(`data-plan-plate-review-open="${key}"`);
    expect(open).toMatch(new RegExp(`<button[^>]*disabled=""[^>]*data-plan-plate-review-open="${def.id}/${ids[1]}"`));
  });

  it("Hebrew: the same control, RTL, in Hebrew; every review string exists in both languages", () => {
    const h = renderToStaticMarkup(<PlanPlatePainter lang="he" patterns={[def]} initialStatus={STATUS} initialConfirm={{ pattern: def.id, plate: ids[0], childFree: false, textFree: false, image: "blob:synthetic/plate" }} />);
    expect(h).toContain('dir="rtl"');
    expect(text(h)).toContain("לא נבדק — משפחות לא רואות אותו");
    expect(text(h)).toContain("נבדק על ידי owner@example.test ב-2026-11-27 09:30");
    expect(text(h)).toContain("לשמור את הבדיקה");
    const keys = (o: object) => Object.keys(o).filter((k) => k.startsWith("plates.review.")).sort();
    expect(keys(PLAN_STRINGS.he)).toEqual(keys(PLAN_STRINGS.en));
    expect(keys(PLAN_STRINGS.en).length).toBe(14);
    for (const k of keys(PLAN_STRINGS.he)) expect((PLAN_STRINGS.he as Record<string, string>)[k], k).toMatch(/[֐-׿]/);
  });
});

describe("B-BOOK-27: saving a review", () => {
  const calls: { url: string; init: RequestInit }[] = [];
  const stubFetch = (status: number, body: unknown) => {
    calls.length = 0;
    vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit) => { calls.push({ url, init }); return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }); }));
  };

  it("posts exactly the pattern, the plate and the two flags as ticked to the review route", async () => {
    stubFetch(200, { pattern: def.id, plate: ids[0], childFree: true, textFree: true, reviewedBy: "owner@example.test", servable: true });
    const out = await submitPlateReview({ pattern: def.id, plate: ids[0], childFree: true, textFree: true });
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("/api/admin/plan-plates/review");
    expect(calls[0].init.method).toBe("POST");
    expect(JSON.parse(String(calls[0].init.body))).toEqual({ pattern: def.id, plate: ids[0], childFree: true, textFree: true });
    expect(out).toEqual({ ok: true, review: { state: "reviewed", reviewedBy: "owner@example.test" }, servable: true });
  });

  it("an unticked box is posted as false and shown as what the reviewer found, never as reviewed", async () => {
    stubFetch(200, { pattern: def.id, plate: ids[0], childFree: false, textFree: true, reviewedBy: "owner@example.test", servable: false });
    const out = await submitPlateReview({ pattern: def.id, plate: ids[0], childFree: false, textFree: true });
    expect(JSON.parse(String(calls[0].init.body))).toMatchObject({ childFree: false, textFree: true });
    expect(out).toMatchObject({ ok: true, review: { state: "child-painted" }, servable: false });
    const api = { review: vi.fn(async () => ({ pattern: def.id, plate: ids[0], childFree: true, textFree: false, reviewedBy: "o", servable: false })) };
    expect(await submitPlateReview({ pattern: def.id, plate: ids[0], childFree: true, textFree: false }, api)).toMatchObject({ ok: true, review: { state: "has-text" } });
  });

  it("a refusal is reported as it is: 403 not allowed, 404 not painted, anything else not saved", async () => {
    for (const [status, note] of [[403, "plates.review.forbidden"], [404, "plates.review.unpainted"], [503, "plates.review.error"], [400, "plates.review.error"]] as const) {
      stubFetch(status, { error: "x", code: "plan_plates_forbidden" });
      expect(await submitPlateReview({ pattern: def.id, plate: ids[0], childFree: true, textFree: true }), String(status)).toEqual({ ok: false, note });
    }
    const offline = { review: vi.fn(async () => { throw new TypeError("network"); }) } as unknown as { review: typeof reviewPlanPlate };
    expect(await submitPlateReview({ pattern: def.id, plate: ids[0], childFree: true, textFree: true }, offline)).toEqual({ ok: false, note: "plates.review.error" });
    const forbidden = { review: vi.fn(async () => { throw new PlanApiError(403, "plan_plates_forbidden", "Not authorized"); }) } as unknown as { review: typeof reviewPlanPlate };
    expect(await submitPlateReview({ pattern: def.id, plate: ids[0], childFree: true, textFree: true }, forbidden)).toEqual({ ok: false, note: "plates.review.forbidden" });
  });

  it("the reviewer's picture comes from the painter-only image route, never the family read route", () => {
    expect(adminPlateImageUrl(def.id, ids[0])).toBe(`/api/admin/plan-plates/${def.id}/${ids[0]}/image`);
  });
});

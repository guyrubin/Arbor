import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
const h = vi.hoisted(() => ({ loaded: true, confirmed: true, error: false, child: "a", items: [] as any[], options: null as any, result: null as any }));
vi.mock("../../context/ArborContext", () => ({ useArbor: () => ({ childProfile: { id: h.child, name: "Synthetic", age: 4 }, behaviorLogs: [], actionLoop: [], activeTodayAction: null }) }));
vi.mock("../../context/LanguageContext", () => ({ useLanguage: () => ({ uiLang: "en" }) }));
vi.mock("../../hooks/useChildCollection", () => ({ useChildCollection: (child: string, name: string, options: unknown) => { if (name === "appointments") { h.options = options; return { items: child === "a" ? h.items : [], loaded: h.loaded, error: h.error, confirmed: h.confirmed }; } return { items: [] }; } }));
vi.mock("../../content/hardMomentSurface", () => ({ todayHardMomentOffer: () => null }));
vi.mock("../../lib/jitai", () => ({ nextNudge: () => null }));
vi.mock("../../lib/kpiEvents", () => ({ trackOfferShown: vi.fn(), trackOfferSuppressed: vi.fn() }));
import { useCompanionOffer } from "./useCompanionOffer";
const now = new Date(2026, 9, 12, 14);
function Probe() { h.result = useCompanionOffer("today", { now }); return null; }
const render = () => { renderToStaticMarkup(<Probe />); return h.result; };
beforeEach(() => { h.loaded = true; h.confirmed = true; h.error = false; h.child = "a"; h.items = [{ id: "visit", whenIso: "2026-10-14T16:00:00", status: "confirmed", profession: "slp" }]; });
describe("visit source trust at the actual coordinator hook", () => {
  it("promotes only a confirmed active-child read and asks for metadata updates", () => {
    expect(render().appointment?.id).toBe("visit"); expect(h.options).toEqual({ trackConfirmation: true });
    h.child = "b"; expect(render().appointment).toBeNull();
  });
  for (const state of [{ loaded: false, confirmed: false, error: false }, { loaded: true, confirmed: false, error: false }, { loaded: true, confirmed: false, error: true }, { loaded: true, confirmed: true, error: true }]) it(`rejects stale/pending/cache appointment data ${JSON.stringify(state)}`, () => {
    Object.assign(h, state); const result = render(); expect(result.appointment).toBeNull(); expect(result.offer?.kind).not.toBe("appointment");
  });
});

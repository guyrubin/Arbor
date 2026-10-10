import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ActionLoopEntry } from "../../actionLoop/model";
import { pendingActionFollowUp, offerCandidates, chooseOffer, type OfferState } from "../../lib/companionOffer";
import { DEFAULT_PREFS } from "../../growth/jitaiPrefs";
import { translate } from "../../lib/i18n";
const state = vi.hoisted(() => ({ lang: "en" as "en" | "he", rows: [] as ActionLoopEntry[] }));
vi.mock("../../context/ArborContext", () => ({ useArbor: () => ({ childProfile: { id: "a", name: "Noa", age: 4 }, actionLoop: state.rows, behaviorLogs: [], activeTodayAction: null }) }));
vi.mock("../../context/ProfileContext", () => ({ useProfile: () => ({ profiles: [{ id: "a", name: "Noa", age: 4 }, { id: "b", name: "Sibling", age: 4 }], setActiveChild: vi.fn() }) }));
vi.mock("../../context/LanguageContext", async () => {
  const { translate } = await vi.importActual<typeof import("../../lib/i18n")>("../../lib/i18n");
  return { useLanguage: () => ({ uiLang: state.lang, t: (key: string, vars?: Record<string, string | number>) => translate(state.lang, key, vars) }) };
});
vi.mock("../../context/ToastContext", () => ({ useToastOptional: () => null }));
vi.mock("../../hooks/useChildCollection", () => ({ useChildCollection: (id: string, name: string) => ({ items: name === "actionLoops" ? state.rows.map(row => ({ ...row, id: row.id.replace(".a.", `.${id}.`) })) : [], loaded: true, error: false, confirmed: true }) }));
import { useCompanionOffer } from "./useCompanionOffer";
import FamilyOfferLines from "./FamilyOfferLines";
import CompanionOfferSlot from "./CompanionOfferSlot";
const original: ActionLoopEntry = { id: "today.a.2026-10-09", source: "onboarding", status: "accepted", capacity: "tiny", acceptedAt: "2026-10-09T12:00:00Z", recommendation: "What happened with Noa today?\nFull details.", acceptanceKey: "onboarding-v1.a.exact" };
function HookReader({ surface }: { surface: "today" | "coach" }) {
  const { offer, ...controls } = useCompanionOffer(surface);
  return <CompanionOfferSlot surface={surface} offer={offer} controls={controls} />;
}
const offerState = (row: ActionLoopEntry): OfferState => ({ nowMs: Date.now(), surface: "today", pendingFollowUp: pendingActionFollowUp(row), whatChanged: null, appointment: null, screeningRecheckDue: false, nudge: null, groundedStep: null, prefs: { ...DEFAULT_PREFS }, shownToday: [], ledger: {} });
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-10T12:00:00Z")); state.rows = [{ ...original }]; });
afterEach(() => vi.useRealTimers());
describe("actual active-child and sibling observation follow-up readers", () => {
  it.each(["en", "he"] as const)("%s preserves observation semantics through both real callers and the offer renderer", lang => {
    state.lang = lang;
    for (const explicit of [false, true]) {
      state.rows = [{ ...original, ...(explicit ? { observation: true } : {}) }];
      for (const view of [<HookReader surface="today" />, <HookReader surface="coach" />, <FamilyOfferLines activeChildId="a" />]) {
        const html = renderToStaticMarkup(view);
        expect(html).toContain(lang === "en" ? "You chose this question:" : "בחרתם את השאלה:");
        expect(html).toContain("What happened with Noa today?");
        expect(html).not.toMatch(/chose to try|בחרתם לנסות|It helped|זה עזר/);
      }
    }
  });
  it("the shared projection changes only observation semantics, preserving provenance exclusions and ordinary copy", () => {
    expect(pendingActionFollowUp(null)).toBeNull();
    expect(pendingActionFollowUp(original)).toEqual({ id: original.id, recommendation: original.recommendation, observation: true });
    for (const row of [{ ...original, source: "hard-moment" as const }, { ...original, acceptanceKey: "onboarding-urgent.a.exact" }, { ...original, status: "completed" as const, outcome: "helped" as const }]) {
      expect(pendingActionFollowUp(row)).toEqual({ id: row.id, recommendation: row.recommendation });
      expect(offerCandidates(offerState(row))[0]).toMatchObject({ reasonKey: "elev.offer.reason.followUp", cta: { labelKey: "elev.offer.cta.followUp" } });
    }
    const candidate = offerCandidates(offerState(original))[0];
    expect(candidate).toMatchObject({ kind: "follow-up", ledgerKind: "follow-up", reasonKey: "elev.offer.reason.observation", cta: { action: "overview", labelKey: "ob.first.observation.resume" } });
    expect(translate("en", candidate.cta.labelKey)).toBe("Record a moment");
  });
  it("uses the same single follow-up budget, precedence, quiet-hours and suppression rules", () => {
    const input = offerState(original);
    expect(chooseOffer({ ...input, appointment: { id: "visit", dayOffset: 1 } })?.kind).toBe("follow-up");
    expect(chooseOffer({ ...input, shownToday: ["one", "two"] })).toBeNull();
    expect(chooseOffer({ ...input, ledger: { "follow-up": { snoozeUntil: Date.now() + 1000 } } })).toBeNull();
    const night = new Date(); night.setHours(2); expect(chooseOffer({ ...input, nowMs: night.getTime() })).toBeNull();
  });
});

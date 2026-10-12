/**
 * B-TODAY-18 — the continuation slot above the step (carry-over → tomorrow's reason).
 *
 * Precedence table through the REAL coordinator (decideOffer) and its Today
 * consumer (chooseContinuation), plus the source pins that make the slot sit
 * ABOVE the step card, with no gradient, through ONE CompanionOfferSlot.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chooseContinuation, isContinuationKind } from "./continuation";
import { chooseOffer, type OfferState } from "../../lib/companionOffer";
import { DEFAULT_PREFS } from "../../growth/jitaiPrefs";
import { translate } from "../../lib/i18n";
import { todayFile, todayLiveSource } from "../../testTodaySource";

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(path.join(here, rel), "utf8");
const strip = (c: string) => c.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const at = (h: number) => new Date(2026, 9, 2, h, 0).getTime();
const state = (over: Partial<OfferState>): OfferState => ({
  nowMs: at(10),
  surface: "today",
  pendingFollowUp: null,
  tomorrowReason: null,
  whatChanged: null,
  appointment: null,
  screeningRecheckDue: false,
  nudge: null,
  groundedStep: null,
  prefs: { ...DEFAULT_PREFS, types: { ...DEFAULT_PREFS.types } },
  shownToday: [],
  ledger: {},
  ...over,
});
const slotFor = (over: Partial<OfferState>) => chooseContinuation({ offerKind: chooseOffer(state(over))?.kind });

describe("B-TODAY-18 · precedence table (coordinator → continuation)", () => {
  const carry = { pendingFollowUp: { id: "today.c.2026-10-01", recommendation: "Name the next transition" } };
  const reason = { tomorrowReason: { kind: "story" } };

  it.each([
    ["carry-over pending AND a tomorrow reason stored → only the carry-over", { ...carry, ...reason }, "carry"],
    ["only a tomorrow reason (the outcome was tapped) → the reason", { ...reason }, "reason"],
    ["only a carry-over → the carry-over", { ...carry }, "carry"],
    ["neither → nothing", {}, "none"],
    ["an appointment alone renders UNDER the step, not in the slot", { appointment: { id: "a", dayOffset: 1 } }, "none"],
    ["a reason outranks an appointment and takes the slot", { ...reason, appointment: { id: "a", dayOffset: 0 } }, "reason"],
  ] as const)("%s", (_label, over, want) => {
    expect(slotFor(over as Partial<OfferState>)).toBe(want);
  });

  it("only the two continuation kinds are slot kinds", () => {
    expect(isContinuationKind("follow-up")).toBe(true);
    expect(isContinuationKind("tomorrow-reason")).toBe(true);
    for (const k of ["what-changed", "appointment", "screening-recheck", "rhythm", "grounded-step", "tonight", "engagement", null] as const) {
      expect(isContinuationKind(k)).toBe(false);
    }
  });
});

describe("B-TODAY-18 · placement on Today", () => {
  const overview = strip(todayLiveSource());
  const slot = strip(read("./CompanionOfferSlot.tsx"));
  const cont = strip(read("./TodayContinuation.tsx"));

  // B-LOOP-07 re-pin: the continuation slot (carry-over ask, tomorrow's
  // reason) is the coordinator's ONE slot behind Today's door, below the blocks.
  it("the slot renders behind the door, after the lead", () => {
    // Parity 9 Oct: the door is Now's NowMoreForToday, mounted after the lead.
    const view = strip(todayFile("NowView.tsx"));
    expect(view.indexOf("<NowMoreForToday")).toBeGreaterThan(view.indexOf("<NowRecommendation"));
    const slotAt = overview.indexOf("<CompanionOfferSlot");
    expect(slotAt).toBeGreaterThan(-1);
    expect(slotAt).toBeGreaterThan(overview.indexOf('data-testid="today-door"'));
  });

  it("ONE CompanionOfferSlot instance, fed the coordinator's winner (never a second arbiter)", () => {
    expect((overview.match(/<CompanionOfferSlot\b/g) ?? []).length).toBe(1);
    expect(overview).toContain('<CompanionOfferSlot surface="today" offer={todayOffer.offer} controls={todayOffer} placement="under-step" />');
    expect(overview).not.toMatch(/<CarryOverActionAsk\b|<TomorrowReasonCard\b/);
    expect(slot).toContain("<CarryOverActionAsk onSkip={controls.refresh} />");
    expect(slot).toContain("<TomorrowReasonCard onResolved={controls.refresh} />");
  });

  it("the resume eyebrow is the slot's eyebrow (EN + HE); the old floating eyebrow is gone", () => {
    expect(cont).toContain('t("elev.sincevisit.resume")');
    expect(overview).not.toContain("elev.sincevisit.resume");
    expect(translate("en", "elev.sincevisit.resume")).toBe("Continuing where we left off");
    expect(translate("he", "elev.sincevisit.resume")).toContain("ממשיכים");
  });

  it("0 gradients in the slot; its controls are ≥44 px", () => {
    const carryAsk = strip(read("./CarryOverActionAsk.tsx"));
    const reasonCard = strip(read("../nextopen/TomorrowReasonCard.tsx"));
    for (const src of [cont, carryAsk, reasonCard]) expect(src).not.toContain("--arbor-gradient-primary");
    // The reason card's CTA is an outline above the step, never a fill.
    expect(reasonCard).not.toMatch(/background: "var\(--arbor-clay\)"/);
    expect((carryAsk.match(/min-h-11/g) ?? []).length).toBeGreaterThanOrEqual(2);
    expect((reasonCard.match(/minHeight: 44/g) ?? []).length).toBe(2);
  });

  it("keys are reused (elev.closeloop.carry.*, elev.rh.tomorrow.*) in both locales", () => {
    for (const k of ["elev.closeloop.carry.eyebrow", "elev.closeloop.carry.ask", "elev.closeloop.carry.dismiss", "elev.rh.tomorrow.eyebrow", "elev.offer.reason.followUp", "elev.offer.reason.tomorrow"]) {
      expect(translate("en", k), k).not.toBe(k);
      expect(translate("he", k), k).not.toBe(k);
    }
  });
});

describe("negative control", () => {
  it("the pre-fix Today (carry-over under the step) fails the placement pin", () => {
    const PRE = `<TodayRecommendation />\n<CompanionOfferSlot surface="today" offer={todayOffer.offer} controls={todayOffer} />`;
    expect(PRE.indexOf("<TodayContinuation")).toBe(-1);
    expect(PRE.indexOf("<CompanionOfferSlot")).toBeGreaterThan(PRE.indexOf("<TodayRecommendation"));
  });
});

describe("B-TODAY-18 · the family line renders through the coordinator", () => {
  const overview = strip(todayLiveSource());
  const family = strip(read("./FamilyOfferLines.tsx"));

  it("one line per sibling, built by familyOfferLines from that child's own state", () => {
    expect(overview).toContain("<FamilyOfferLines activeChildId={childProfile.id} />");
    expect(family).toContain("familyOfferLines([{ childId, state }])");
    expect(family).toContain('useChildCollection<ActionLoopEntry>(childId, "actionLoops")');
    expect(family).toContain("reasonForThisOpen(childId, now)");
    expect(family).toContain("readOfferLedger(childId)");
    expect(family).toContain("profiles.filter((p) => p.id !== activeChildId)");
    expect(family).toContain("if (!offer || !isContinuationKind(offer.kind)) return null;");
  });

  it("each line is a 44 px control that switches to that child; EN + HE label", () => {
    expect(family).toMatch(/onClick=\{onOpen\}[\s\S]{0,120}className="flex min-h-11/);
    expect(family).toContain("setActiveChild(p.id)");
    expect(translate("en", "elev.brief.family.aria")).not.toBe("elev.brief.family.aria");
    expect(translate("he", "elev.brief.family.aria")).not.toBe(translate("en", "elev.brief.family.aria"));
  });
});

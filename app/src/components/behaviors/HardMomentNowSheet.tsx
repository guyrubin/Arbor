import React, { useEffect, useState } from "react";
import { Icon } from "../ui/Icon";
import { Modal } from "../ui/Modal";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import type { HardMomentCard, HardMomentCategory } from "../../content/hardMomentCards";
import { HARD_MOMENT_CATEGORIES, locText, recentBehaviorTypes } from "../../content/hardMomentSurface";
import { availableHardMomentCards, matchToRecentBehaviors } from "../../content/selectCards";
import type { HardMomentContext } from "../../content/pilotRelease";
import { ageMonthsFromProfile, ageYearsFromProfile } from "../../lib/childAge";
import { matchLearnCards } from "../../learn/learnLibrary";
import { LEARN_CARDS } from "../../learn/learnCards";
import { acceptHardMomentStep } from "../overview/hardMomentStep";
import { tryItState } from "../coach/CoachAnswerCards";
import { HardMomentGuideContent } from "./HardMomentsSection";
import type { BehaviorLog } from "../../types";

/**
 * B-ASKJB-31 — "Hard moment now": ONE sheet over the governed pilot guides,
 * opened from Ask (fast-start chip), Behaviors (a shelf card) and Today (the
 * capture-bar tile, B-TODAY-10) through the context seam `openHardMomentNow`.
 *
 * Rules the item fixes (and the guard tests pin):
 *  - neutral ink: the title is the parent's plain words, never red/coral,
 *    never "SOS";
 *  - situation chips by category, the card matched to the parent's own
 *    recent moment types first (matchToRecentBehaviors(recentBehaviorTypes));
 *  - the selected card renders the governed HardMomentGuideContent (do now ·
 *    say this through SayThis · avoid · escalation, pilot label included);
 *  - "Try this tonight" books the card's doNow through the ONE accept seam
 *    with source "hard-moment" (acceptHardMomentStep re-checks availability
 *    at tap time); "Talk it through in Ask" opens Ask with the card as a
 *    reference card above the composer — NEVER seeded into the prompt
 *    (clinical veto; coach-hardmoment-seed-v1 untouched);
 *  - opening or reading a card makes no request of any kind; every door hides
 *    when availableHardMomentCards is empty (age misfit, after expiry). The
 *    SafetyRing stays the human-escalation path.
 */

/** Pure: the sheet's order — the matched cards first (in match order), then
 *  every other available card in catalogue order. Never drops a card. */
export function hardMomentSheetOrder<T extends { id: string }>(available: readonly T[], matched: readonly T[]): T[] {
  const ids = new Set(available.map((card) => card.id));
  const lead = matched.filter((card) => ids.has(card.id));
  const leadIds = new Set(lead.map((card) => card.id));
  return [...lead, ...available.filter((card) => !leadIds.has(card.id))];
}

/** Pure: the cards the sheet offers for a child right now (the doors' gate). */
export function hardMomentSheetCards(ctx: HardMomentContext, logs: Pick<BehaviorLog, "behaviorType" | "timestamp">[]): { ordered: HardMomentCard[]; matchedIds: string[] } {
  const available = availableHardMomentCards(ctx);
  if (available.length === 0) return { ordered: [], matchedIds: [] };
  const matched = matchToRecentBehaviors(recentBehaviorTypes(logs, ctx.now), available, ctx.now, ctx.ageMonths, ctx.locale);
  return { ordered: hardMomentSheetOrder(available, matched), matchedIds: matched.map((card) => card.id) };
}

export default function HardMomentNowSheet() {
  const {
    hardMomentNow, closeHardMomentNow, childProfile, behaviorLogs,
    acceptTodayAction, activeTodayAction, setActiveTab, setAskHardMomentRef, requestLearnRead,
  } = useArbor();
  const { t, uiLang } = useLanguage();
  const locale = uiLang === "he" ? "he" : "en";
  const open = hardMomentNow.open;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [booked, setBooked] = useState<string | null>(null);

  useEffect(() => {
    if (open) { setSelectedId(hardMomentNow.cardId ?? null); setBooked(null); }
  }, [open, hardMomentNow.cardId]);

  if (!open) return null;
  const now = new Date();
  const context: HardMomentContext = { now, ageMonths: ageMonthsFromProfile(childProfile, now), locale };
  const { ordered, matchedIds } = hardMomentSheetCards(context, behaviorLogs || []);
  const childFirst = (childProfile.name || "").split(" ")[0];
  const card = ordered.find((c) => c.id === selectedId) ?? null;
  const matched = ordered.filter((c) => matchedIds.includes(c.id));
  const groups = HARD_MOMENT_CATEGORIES
    .map((category) => [category, ordered.filter((c) => c.category === category && !matchedIds.includes(c.id))] as [HardMomentCategory, HardMomentCard[]])
    .filter(([, cards]) => cards.length > 0);

  const chip = (c: HardMomentCard) => (
    <button
      key={c.id}
      type="button"
      data-testid="hard-moment-now-chip"
      onClick={() => setSelectedId(c.id)}
      className="inline-flex min-h-11 min-w-11 items-center gap-1.5 rounded-full px-3.5 py-2 text-start text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
      style={{ background: "var(--arbor-paper-elevated)", color: "var(--arbor-ink)", border: "1px solid var(--arbor-rule-strong)" }}
    >
      <span className="min-w-0 break-words">{locText(c.title, locale)}</span>
    </button>
  );

  const doNow = card ? locText(card.doNow, locale) : "";
  const tryState = card ? (booked === card.id ? "accepted" : tryItState(doNow, activeTodayAction)) : "accept";

  return (
    <Modal open={open} onClose={closeHardMomentNow} title={t("hm.now.title")}>
      <div data-testid="hard-moment-now-sheet" lang={locale} dir={locale === "he" ? "rtl" : "ltr"} className="min-w-0 space-y-4 text-start">
        {ordered.length === 0 ? (
          // The door is hidden in this case; a stale open (expiry mid-session)
          // closes honestly instead of rendering an empty sheet.
          <p role="status" className="text-sm" style={{ color: "var(--arbor-ink-soft)" }}>{t("hm.now.none")}</p>
        ) : !card ? (
          <>
            <p className="text-sm font-bold" style={{ color: "var(--arbor-ink)" }}>{t("hm.now.pick")}</p>
            {matched.length > 0 && (
              <div className="space-y-2" data-testid="hard-moment-now-matched">
                <p className="text-xs font-bold" style={{ color: "var(--arbor-green-ink)" }}>{t("hm.now.matched")}</p>
                <div className="flex flex-wrap gap-2">{matched.map(chip)}</div>
              </div>
            )}
            {groups.map(([category, cards]) => (
              <div key={category} className="space-y-2">
                <p className="text-xs font-bold" style={{ color: "var(--arbor-muted)" }}>{t(`hm.cat.${category}`)}</p>
                <div className="flex flex-wrap gap-2">{cards.map(chip)}</div>
              </div>
            ))}
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setSelectedId(null)}
              className="inline-flex min-h-11 items-center gap-1 px-1 text-sm font-bold"
              style={{ color: "var(--arbor-green-ink)" }}
            >
              <Icon name="arrow_back" size={16} className="rtl:-scale-x-100" /> {t("hm.now.back")}
            </button>
            <h4 className="text-base font-extrabold" style={{ color: "var(--arbor-ink)" }}>{locText(card.title, locale)}</h4>
            <HardMomentGuideContent card={card} context={context} childName={childFirst} t={t} />
            <div className="space-y-2">
              {tryState === "accepted" ? (
                <p role="status" data-testid="hard-moment-now-booked" className="inline-flex min-h-11 items-center gap-1.5 text-sm font-bold" style={{ color: "var(--arbor-green-ink)" }}>
                  <Icon name="check_circle" size={16} /> {t("coach.tryIt.accepted")}
                </p>
              ) : tryState !== "hidden" && (
                <>
                  <button
                    type="button"
                    data-testid="hard-moment-now-try"
                    onClick={() => {
                      if (acceptHardMomentStep(card.id, { now: new Date(), ageMonths: context.ageMonths, locale }, "standard", acceptTodayAction)) setBooked(card.id);
                    }}
                    className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold transition"
                    style={{ background: "var(--arbor-green-soft)", color: "var(--arbor-green-ink)", border: "1px solid var(--arbor-green-ink)" }}
                  >
                    <Icon name="flag" size={16} /> {t("hm.now.tryTonight")}
                  </button>
                  {tryState === "replace" && activeTodayAction && (
                    <p className="text-xs leading-snug" style={{ color: "var(--arbor-muted)" }}>{t("coach.tryIt.replaces", { current: activeTodayAction.recommendation })}</p>
                  )}
                </>
              )}
              <button
                type="button"
                data-testid="hard-moment-now-talk"
                onClick={() => {
                  // Clinical veto: the card rides as a reference card above
                  // the composer — nothing is written into the prompt.
                  setAskHardMomentRef(card.id);
                  closeHardMomentNow();
                  setActiveTab("coach");
                }}
                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold transition"
                style={{ color: "var(--arbor-green-ink)", border: "1px solid var(--arbor-green-ink)", background: "var(--arbor-paper-elevated)" }}
              >
                <Icon name="forum" size={16} /> {t("hm.now.talk")}
              </button>
              {/* Law 6: the Learn read the shelf's guide modal offered stays one tap away. */}
              {(() => {
                const read = matchLearnCards(LEARN_CARDS, { concerns: card.concerns, ageYears: ageYearsFromProfile(childProfile) }, 1)[0];
                if (!read) return null;
                return (
                  <button
                    type="button"
                    onClick={() => { requestLearnRead({ cardId: read.id, source: "hard-moment-card" }); closeHardMomentNow(); }}
                    className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold transition"
                    style={{ color: "var(--arbor-lav-ink)", border: "1px solid var(--arbor-lav-ink)", background: "var(--arbor-lav-soft)" }}
                  >
                    <Icon name="local_library" size={16} /> {t("learn.understandWhy")}
                  </button>
                );
              })()}
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

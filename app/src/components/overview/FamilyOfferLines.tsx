import React from "react";
import Icon from "../ui/Icon";
import { useProfile } from "../../context/ProfileContext";
import { useLanguage } from "../../context/LanguageContext";
import { useChildCollection } from "../../hooks/useChildCollection";
import { todayActionId, type ActionLoopEntry } from "../../actionLoop/model";
import { readSkippedCarryOvers, selectCarryOverAction } from "./carryOverAction";
import { reasonForThisOpen } from "../../lib/tomorrowReason";
import { pendingActionFollowUp, familyOfferLines, readOfferLedger, type OfferState } from "../../lib/companionOffer";
import { loadPrefs, shownNudgesToday } from "../../growth/jitaiPrefs";
import { isolate } from "../../lib/bidi";
import { isContinuationKind } from "./continuation";

/**
 * B-TODAY-18 + framer ruling (B-AI-06): the FAMILY line renders on Today
 * through the coordinator. One line per sibling of the active child, each
 * built by `familyOfferLines` from THAT child's state only (its own action
 * ledger, its own tomorrow's reason, its own suppression ledger — never merged
 * with the active child's). Only a continuation (carry-over / tomorrow's
 * reason) speaks here; tapping the line switches to that child, whose own
 * Today then shows the full slot. Single-child families render nothing.
 */
function SiblingLine({ childId, name, onOpen }: { childId: string; name: string; onOpen: () => void }) {
  const { t, uiLang } = useLanguage();
  const loops = useChildCollection<ActionLoopEntry>(childId, "actionLoops");
  const now = Date.now();
  const pending = selectCarryOverAction(loops.items, todayActionId(childId), now, readSkippedCarryOvers());
  const reason = reasonForThisOpen(childId, now);
  const state: OfferState = {
    nowMs: now,
    surface: "today",
    pendingFollowUp: pendingActionFollowUp(pending),
    tomorrowReason: reason ? { kind: reason.kind } : null,
    whatChanged: null,
    appointment: null,
    screeningRecheckDue: false,
    nudge: null,
    groundedStep: null,
    prefs: loadPrefs(),
    shownToday: shownNudgesToday(now),
    ledger: readOfferLedger(childId),
  };
  const offer = familyOfferLines([{ childId, state }])[0]?.offer ?? null;
  if (!offer || !isContinuationKind(offer.kind)) return null;
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        data-testid="family-offer-line"
        data-child-id={childId}
        className="flex min-h-11 w-full items-center gap-2 rounded-xl px-2 text-start text-[12.5px] leading-snug"
        style={{ color: "var(--arbor-ink-soft)" }}
      >
        <span className="font-extrabold" style={{ color: "var(--arbor-ink)" }}>{isolate(name, uiLang === "he" ? "he" : "en")}</span>
        <span dir="auto" className="min-w-0 flex-1 truncate">{t(offer.reasonKey, offer.reasonVars)}</span>
        <Icon name="chevron_right" size={16} className="flex-none rtl:-scale-x-100" style={{ color: "var(--arbor-muted)" }} />
      </button>
    </li>
  );
}

export default function FamilyOfferLines({ activeChildId }: { activeChildId: string }) {
  const { profiles, setActiveChild } = useProfile();
  const { t } = useLanguage();
  const siblings = profiles.filter((p) => p.id !== activeChildId);
  if (siblings.length === 0) return null;
  return (
    <ul data-testid="family-offer-lines" aria-label={t("elev.brief.family.aria")} className="mt-2 space-y-0.5 empty:hidden">
      {siblings.map((p) => (
        <SiblingLine key={p.id} childId={p.id} name={(p.name || "").split(" ")[0]} onOpen={() => setActiveChild(p.id)} />
      ))}
    </ul>
  );
}

import { useCallback, useEffect, useMemo, useState } from "react";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { useChildCollection } from "../../hooks/useChildCollection";
import { todayActionId } from "../../actionLoop/model";
import { readSkippedCarryOvers, selectCarryOverAction } from "./carryOverAction";
import { predictRhythm } from "../../rhythm/predict";
import { nextNudge } from "../../lib/jitai";
import { loadPrefs, nudgeDayKey, recordNudgeShown, shownNudgesToday } from "../../growth/jitaiPrefs";
import { isRecheckDue, latestRecheckDueAt, type RecheckRecord } from "../../lib/screeningRecheck";
import { todayHardMomentOffer } from "../../content/hardMomentSurface";
import { ageMonthsFromProfile } from "../../lib/childAge";
import type { Appointment } from "../../lib/careTrack";
import {
  appointmentInWindow,
  decideOffer,
  dismissOfferIn,
  readOfferLedger,
  snoozeOfferIn,
  undoOfferIn,
  type CompanionOffer,
  type OfferKind,
  type OfferLedger,
  type OfferSurface,
} from "../../lib/companionOffer";
import { trackOfferShown, trackOfferSuppressed } from "../../lib/kpiEvents";
import { reasonForThisOpen } from "../../lib/tomorrowReason";

/** day|surface|kind(|reason) already emitted — one event per day, not per render. */
const SEEN = new Set<string>();

const writeLedger = (childId: string, ledger: OfferLedger) => {
  try {
    window.localStorage.setItem(`arbor.offer.ledger.${childId}`, JSON.stringify(ledger));
  } catch {
    /* best-effort */
  }
};

/**
 * B-AI-06 — the coordinator hook. Gathers every proactive candidate for the
 * ACTIVE child only (its own action ledger, appointments, screenings, logs and
 * suppression ledger), asks `decideOffer` for the one offer, spends the shared
 * shown-ledger slot when it renders, and emits offer_shown / offer_suppressed.
 */
export function useCompanionOffer(surface: OfferSurface, opts: { whatChanged?: { id: string } | null } = {}) {
  const { childProfile, behaviorLogs, actionLoop, activeTodayAction } = useArbor();
  const { uiLang } = useLanguage();
  const childId = childProfile.id;
  const appts = useChildCollection<Appointment>(childId, "appointments");
  const screenings = useChildCollection<RecheckRecord & { id: string }>(childId, "screenings");
  const [ledger, setLedger] = useState<OfferLedger>(() => readOfferLedger(childId));
  const [tick, setTick] = useState(0);
  useEffect(() => setLedger(readOfferLedger(childId)), [childId]);

  const rhythm = useMemo(
    () => predictRhythm(behaviorLogs.map((l) => ({ timestamp: l.timestamp, intensity: l.intensity })), Date.now(), { ageYears: childProfile.age }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [behaviorLogs.length, childProfile.age],
  );

  const now = Date.now();
  const locale = uiLang === "he" ? "he" : "en";
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const loggedToday = behaviorLogs.filter((l) => new Date(l.timestamp).getTime() >= startOfDay.getTime()).length;
  const recent7d = behaviorLogs.filter((l) => new Date(l.timestamp).getTime() >= now - 7 * 86_400_000).length;
  const prefs = loadPrefs();
  const shownToday = shownNudgesToday(now);
  const firstName = (childProfile.name || "").split(" ")[0];

  const nudge = nextNudge({ nowMs: now, rhythm, loggedToday, recent7d, childName: firstName, shownToday }, prefs);
  const pending = selectCarryOverAction(actionLoop, todayActionId(childId), now, readSkippedCarryOvers());
  const hardMoment = activeTodayAction
    ? null
    : todayHardMomentOffer(behaviorLogs, undefined, new Date(now), ageMonthsFromProfile(childProfile, new Date(now)), locale);

  const decision = decideOffer({
    nowMs: now,
    surface,
    pendingFollowUp: pending ? { id: pending.id, recommendation: pending.recommendation } : null,
    // B-TODAY-18: tomorrow's reason is a coordinator candidate (Today renders
    // it; Ask shows the same one offer per visit).
    tomorrowReason: (() => {
      const r = reasonForThisOpen(childId, now);
      return r ? { kind: r.kind } : null;
    })(),
    whatChanged: opts.whatChanged ?? null,
    appointment: appointmentInWindow(appts.items, now),
    screeningRecheckDue: isRecheckDue(latestRecheckDueAt(screenings.items), now),
    nudge,
    groundedStep: hardMoment ? { id: hardMoment.card.id } : null,
    prefs,
    shownToday,
    ledger,
  });
  const offer = decision.offer;

  // Spend the ceiling slot where the offer renders (idempotent per kind per
  // day) and emit the coordinator's own events — once per day per surface.
  const suppressedSig = decision.suppressed.map((s) => `${s.kind}:${s.reason}`).join(",");
  useEffect(() => {
    const day = nudgeDayKey();
    if (offer) {
      recordNudgeShown(offer.ledgerKind);
      const key = `${day}|${surface}|${offer.kind}`;
      if (!SEEN.has(key)) {
        SEEN.add(key);
        trackOfferShown({ kind: offer.kind, surface });
      }
    }
    for (const s of decision.suppressed) {
      const key = `${day}|${surface}|${s.kind}|${s.reason}`;
      if (SEEN.has(key)) continue;
      SEEN.add(key);
      trackOfferSuppressed({ kind: s.kind, reason: s.reason, surface });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offer?.kind, suppressedSig, surface]);

  const apply = useCallback(
    (next: OfferLedger) => {
      writeLedger(childId, next);
      setLedger(next);
    },
    [childId],
  );
  const snooze = useCallback((kind: OfferKind) => apply(snoozeOfferIn(readOfferLedger(childId), kind, Date.now())), [apply, childId]);
  const dismiss = useCallback((kind: OfferKind) => apply(dismissOfferIn(readOfferLedger(childId), kind, Date.now())), [apply, childId]);
  const undo = useCallback((kind: OfferKind) => apply(undoOfferIn(readOfferLedger(childId), kind)), [apply, childId]);
  /** A renderer resolved its own question (e.g. the carry-over "skip"). */
  const refresh = useCallback(() => setTick((n) => n + 1), []);

  return { offer: offer as CompanionOffer | null, decision, snooze, dismiss, undo, refresh, tick };
}

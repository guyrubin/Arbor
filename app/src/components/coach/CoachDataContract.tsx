import React, { useEffect, useMemo, useRef, useState } from "react";
import Icon from "../ui/Icon";
// Masterplan 1.3 — TrustPanel (the one reusable trust pattern) states EXACTLY
// what each conversation request sends, and hosts the weekly-context consent
// switch in its footer.
import { TrustPanel } from "../ui/TrustPanel";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { useHashQuery } from "../../hooks/useHashQuery";
import { api } from "../../lib/api";
import { coachContractText } from "../../lib/i18nElevation/coachcontract";
import { liveResidencyUntil } from "../../lib/liveResidency";
import { liveNoticeIdFrom, voiceNoticeResidencyKey } from "../../lib/voiceProviderNotice";
import { fmtDayLong } from "../../lib/formatDate";
// GP-14: the disclosure names WHICH approved facts and WHICH profile fields
// travel with a question, not just how many.
import { coachDisclosure } from "../../lib/coachDisclosure";
import { readWeeklyContextConsent, writeWeeklyContextConsent } from "../../ai/chatContext";
import { GlyphChip } from "../../design/primitives";

/**
 * F-TALK-1 — "What the coach sees", in its one home: the "What Arbor
 * remembers" destination (#/memory). It used to open from a toggle in the
 * conversation's identity strip; the Talk panel now has no sub-header (the
 * panel header already says "Arbor" and the composer foot carries the AI
 * disclosure). The conversation menu's "What Arbor remembers" row and the
 * weekly notice's "Change" both land here; "Change" arrives with
 * `?section=coach` and brings the switch into view.
 *
 * The copy states exactly what each question sends: the message · the
 * allow-listed profile fields and the parent's own approved facts by name ·
 * this conversation's recent turns · this week's counts only while the switch
 * is on · what a spoken turn carries (and, when Live is the path, where it is
 * processed). Counts and the parent's own words only (clinical firewall).
 * The switch is the per-child consent flag the send path reads fresh
 * (arbor.coach.weeklyContext.{childId}), so it is the single source of truth.
 *
 * The section never waits on the approved ledger: the switch is a consent
 * control, so it stays reachable while the ledger read fails (a 429 included).
 * Then `ledgerUnreadable` turns the facts line into "can't be read right now",
 * never "none" (OWN-1).
 */
export default function CoachDataContract({ ledgerUnreadable = false }: { ledgerUnreadable?: boolean }) {
  const { childProfile, approvedMemoryItems, chatMessages } = useArbor();
  const { t, uiLang } = useLanguage();
  const lang = uiLang === "he" ? "he" : "en";
  const tcc = (key: string, params?: Record<string, string | number>) => coachContractText(lang, key, params);
  const approved = approvedMemoryItems ?? [];
  const childFirst = (childProfile.name || "").split(" ")[0];

  const [weeklyOn, setWeeklyOn] = useState(() => readWeeklyContextConsent(childProfile.id));
  useEffect(() => { setWeeklyOn(readWeeklyContextConsent(childProfile.id)); }, [childProfile.id]);

  // AI-V8 / B-ASKJB-02: the config-only Live probe (no token is minted). When
  // Live is the path a tap takes, its line names the global endpoint and the
  // residency exception's last day (null → the undated line).
  const [liveAvail, setLiveAvail] = useState(false);
  const [liveUntil, setLiveUntil] = useState<Date | null>(null);
  // B-PROV-12: the residency clause follows the runtime route's notice (the
  // EU route has its own; the global route keeps the dated exception line).
  const [liveResidencyKey, setLiveResidencyKey] = useState<string | undefined>(undefined);
  useEffect(() => {
    let cancelled = false;
    api.liveAvailability().then((r) => {
      if (cancelled || !r.available) return;
      setLiveAvail(true);
      setLiveUntil(liveResidencyUntil(r));
      setLiveResidencyKey(voiceNoticeResidencyKey(liveNoticeIdFrom(r)));
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // ASK-6 count, per answer: the most recent settled answer's server-backfilled
  // approved-memory fact count (an integer only — never fact content).
  const lastFactsUsed = useMemo(
    () =>
      [...(chatMessages ?? [])].reverse().find((m) => m.sender === "ai" && typeof m.contract?.approvedMemoryFactsUsed === "number")
        ?.contract?.approvedMemoryFactsUsed,
    [chatMessages],
  );

  const sectionRef = useRef<HTMLElement | null>(null);
  const switchRef = useRef<HTMLButtonElement | null>(null);
  const arrivedForSwitch = useHashQuery().get("section") === "coach";
  useEffect(() => {
    if (!arrivedForSwitch) return;
    sectionRef.current?.scrollIntoView({ block: "start" });
    switchRef.current?.focus({ preventScroll: true });
  }, [arrivedForSwitch]);

  return (
    // v10: a design-system tile in About's section 3 ("What you told me, what
    // the coach sees"), rendered in every state of the ledger.
    <section
      ref={sectionRef}
      id="coach-data-contract"
      data-testid="coach-contract-panel"
      aria-labelledby="coach-data-contract-title"
      className="vt coach-contract scroll-mt-24"
    >
      <div className="vh">
        <GlyphChip icon="search" />
        <h3 id="coach-data-contract-title" className="h3">{tcc("elev.coachcontract.title")}</h3>
      </div>
      <p className="line1">{tcc("elev.coachcontract.titleHint")}</p>
      <TrustPanel
        tone="inline"
        uses={[
          tcc("elev.coachcontract.uses.message"),
          // GP-14: the profile line and the memory line NAME what travels —
          // which allow-listed fields, and the parent's own approved facts
          // verbatim — instead of a bare count the parent cannot check.
          ...coachDisclosure(
            {
              profile: childProfile,
              approvedFacts: approved.map((m) => ({ memoryId: m.memoryId, fact: m.fact })),
              factsUsedInLastAnswer: lastFactsUsed,
              childFirstName: childFirst || childProfile.name,
              factsUnreadable: ledgerUnreadable,
            },
            t,
          ).uses,
          tcc("elev.coachcontract.uses.turns"),
          ...(weeklyOn ? [tcc("elev.coachcontract.uses.weekly")] : []),
          // AI-02 / B-ASKJB-01: a SPOKEN turn is described too. Both spoken
          // paths are grounded from server/spokenContext.ts: profile, approved
          // memory facts and this conversation's recent turns (never the
          // weekly counts). Live HD pins the same context into its token with
          // names stripped, so its line says "without names" and renders only
          // when Live is the path a tap takes.
          tcc("elev.coachcontract.uses.spoken"),
          // B-ASKJB-02: whenever Live is the path, its line names the global
          // endpoint and the exception's end date.
          ...(liveAvail ? [tcc("elev.coachcontract.uses.spokenLive", {
            residency: liveResidencyKey && liveResidencyKey !== "elev.coachcontract.uses.liveResidencyUndated"
              ? tcc(liveResidencyKey)
              : liveUntil
              ? tcc("elev.coachcontract.uses.liveResidency", { date: fmtDayLong(liveUntil, lang) })
              : tcc("elev.coachcontract.uses.liveResidencyUndated"),
          })] : []),
        ]}
        stores={[
          // Durable facts wait for explicit parent approval before becoming memory.
          t("coach.contract.memoryBody"),
          tcc("elev.coachcontract.stores.thread"),
        ]}
        controls={[
          tcc("elev.coachcontract.controls.memory"),
          tcc("elev.coachcontract.controls.weekly"),
        ]}
        footer={
          <div className="coach-contract-switch">
            <button
              ref={switchRef}
              type="button"
              role="switch"
              aria-checked={weeklyOn}
              data-testid="coach-weekly-context-toggle"
              onClick={() => {
                const next = !weeklyOn;
                setWeeklyOn(next);
                writeWeeklyContextConsent(childProfile.id, next);
              }}
              className="msw touch-target"
              data-on={weeklyOn ? "" : undefined}
            >
              <i aria-hidden="true" />
              <span>{tcc("elev.coachcontract.toggle")}</span>
            </button>
            <p className="small">{tcc("elev.coachcontract.toggleHint")}</p>
          </div>
        }
      />
    </section>
  );
}

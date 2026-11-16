/**
 * v3 F-CHILD-3 → v10.3 — the selected area on My child › About ("What you told
 * Arbor" in the area panel; the index above picks the area).
 *
 * It holds what the parent TOLD Arbor about this area: the languages (on
 * Talking & understanding), the newest line in their own words with its day,
 * the parent's own kept lines for this area (Edit / Remove, passed in as
 * `kept`), or the question Arbor would ask. It never grades the area: no
 * share, no fill, no colour for how the child is doing. A proposal placed in
 * this area waits here, "Proposed, confirm?", and Confirm / No are the same
 * handleMemoryDecision the notebook uses; the receipt shows only after that
 * write resolved, names the proposal it answered, and clears itself. "Tell
 * more" opens the ONE guided conversation on this area.
 */
import React, { useEffect, useState } from "react";
import { FreeText } from "../ui/FreeText";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { isTold, receiptShows, RECEIPT_MS, type AspectFact, type AspectId, type AspectReceipt, type AspectState } from "../../lib/aboutAspects";
import { confirmFact, isFactStale, type FactField } from "../../lib/factsAsOf";
import { fmtDayFirst as fmtDay } from "../../lib/formatDate";
import { languageName } from "../../lib/languageName";
import { goToRoute } from "../../hooks/useHashQuery";
import { toParentWords } from "../../server/parentWordsScrub";
import { aboutCopy } from "./aboutViewCopy";

export interface AspectCardProps {
  state: AspectState;
  /** The child's first name (the ask lines name the child). */
  name: string;
  /** Open the guided conversation on this area. */
  onTell: (id: AspectId) => void;
  /** "Still true? Edit" opens the profile drawer. */
  onEditDetails: () => void;
  /** The parent's own kept lines for this area (KeptDescription rows). */
  kept?: React.ReactNode;
  /** Words those kept lines already show: the newest line is not printed twice. */
  keptWords?: ReadonlySet<string>;
}

export default function AspectCard({ state, name, onTell, onEditDetails, kept, keptWords }: AspectCardProps) {
  const { childProfile, updateChild, handleMemoryDecision, isMemoryUpdating } = useArbor();
  const { t, uiLang } = useLanguage();
  const [receipt, setReceipt] = useState<AspectReceipt | null>(null);
  const { id, known, languages, pending } = state;
  // A receipt answers ONE proposal: it clears itself after RECEIPT_MS, and a
  // different proposal arriving in the area clears it at once (receiptShows
  // hides it on that same render, so it never sits beside the wrong one).
  const pendingId = pending?.memoryId ?? null;
  useEffect(() => {
    if (!receipt) return;
    const timer = setTimeout(() => setReceipt(null), RECEIPT_MS);
    return () => clearTimeout(timer);
  }, [receipt]);
  useEffect(() => {
    if (receipt && pendingId !== null && pendingId !== receipt.memoryId) setReceipt(null);
  }, [pendingId, receipt]);
  const shown = receiptShows(receipt, pending) ? receipt : null;
  const told = isTold(state);
  const titleId = `about-aspect-${id}-title`;
  const copy = aboutCopy(uiLang);

  // The source line: "In your words · 10 Jun 2026" for what the parent said
  // or kept from the conversation, "Noted · …" for a kept memory.
  const srcLine = (source: AspectFact["source"], date: string | null): string => {
    if (source === "memory") return date ? t("companion.about.srcNoted", { date: fmtDay(date, uiLang) }) : t("companion.about.srcNotedUndated");
    return date ? t("companion.milestones.srcWords", { date: fmtDay(date, uiLang) }) : t("companion.milestones.srcWordsUndated");
  };

  // B-CAREPRO-33 (kept): a profile field older than 90 days asks "Still true?"
  // — Keep stamps today, Edit opens the drawer.
  const stillTrue = (field: FactField | undefined): React.ReactNode => {
    if (!field) return null;
    const asOf = childProfile.factsAsOf?.[field];
    if (!asOf || !isFactStale(asOf, Date.now())) return null;
    return (
      <span className="cn" role="group" data-testid={`profile-fact-stale-${field}`}>
        <span>{t("elev.profile.fact.stillTrue")}</span>
        <button type="button" className="y touch-target" data-testid={`profile-fact-keep-${field}`}
          onClick={() => { void updateChild(childProfile.id, { factsAsOf: confirmFact(childProfile.factsAsOf, field, new Date().toISOString()) }); }}>
          {t("elev.profile.fact.keep")}
        </button>
        <button type="button" className="touch-target" data-testid={`profile-fact-edit-${field}`} onClick={onEditDetails}>
          {t("elev.profile.fact.edit")}
        </button>
      </span>
    );
  };

  const busy = pending ? isMemoryUpdating === pending.memoryId : false;
  const decide = async (status: "approved" | "rejected") => {
    if (!pending) return;
    const memoryId = pending.memoryId;
    setReceipt(null);
    let ok = false;
    try { ok = await handleMemoryDecision(pending.memoryId, status); } catch { ok = false; }
    // The receipt follows the resolved write only — never optimistic — and
    // names the proposal it answered.
    setReceipt({ kind: ok ? (status === "approved" ? "kept" : "leftOut") : "failed", memoryId });
  };

  const languageSegments = languages ? [
    languages.home && `${languageName(languages.home, t)} · ${t("elev.growthTruth.lang.role.home")}`,
    languages.second && `${languageName(languages.second, t)} · ${t("elev.growthTruth.lang.role.second")}`,
    languages.others.length > 0 && `${t("companion.about.langAlso")}: ${languages.others.map((l) => languageName(l, t)).join(", ")}`,
  ].filter(Boolean) as string[] : [];
  // The newest line is printed here unless it is one of the parent's kept lines below (those carry Edit / Remove).
  const knownHere = known && !keptWords?.has(known.words.trim().toLowerCase()) ? known : null;

  return (
    <div className="about-area-told" data-testid={`about-aspect-${id}`} data-aspect={id} data-told={told ? "" : undefined} aria-labelledby={titleId}>
      <h3 className="lab" id={titleId}>{copy.youToldArbor}</h3>
      {languages && (
        <div className="tn">
          <span className="t">
            <span data-testid="about-lang-roles">{languageSegments.map((seg, i) => <React.Fragment key={i}>{i > 0 && " · "}<bdi>{seg}</bdi></React.Fragment>)}</span>
            <small data-testid="about-aspect-src">{srcLine("profile", languages.date)}</small>
          </span>
          {stillTrue("languages")}
        </div>
      )}
      {knownHere && (
        <div className="tn">
          <span className="t">
            <span className="a8-quote" data-testid="about-aspect-quote"><FreeText text={knownHere.words} /></span>
            <small data-testid="about-aspect-src">{srcLine(knownHere.source, knownHere.date)}</small>
          </span>
          {stillTrue(knownHere.factField)}
        </div>
      )}
      {kept}
      {!told && (
        <p className="about-area-ask" data-testid="about-aspect-ask">{t("companion.milestones.notTold")} · {t(`companion.about.ask.${id}`, { name })}</p>
      )}
      {pending && (
        <div className="tn ai" data-testid="about-aspect-pending">
          <span className="t"><strong>{t("companion.about.pending")}</strong><FreeText text={toParentWords(pending.fact)} /></span>
          <span className="cn" role="group">
            <button type="button" className="y touch-target" data-testid="about-pending-confirm" disabled={busy} onClick={() => { void decide("approved"); }}>{t("companion.about.confirm")}</button>
            <button type="button" className="touch-target" data-testid="about-pending-dismiss" disabled={busy} onClick={() => { void decide("rejected"); }}>{t("companion.about.dismiss")}</button>
          </span>
        </div>
      )}
      {shown && <p className="about-area-receipt" role="status" data-testid="about-aspect-receipt">{t(`companion.about.${shown.kind}`)}</p>}
      <div className="line about-area-acts">
        <button type="button" className="mbtn t touch-target" data-testid={`about-aspect-tell-${id}`} onClick={() => onTell(id)}>
          {told ? t("companion.about.tellMore") : t("companion.milestones.tell")}
        </button>
        {id === "lang" && (
          <button type="button" className="mbtn touch-target" data-testid="about-lang-moments" onClick={() => goToRoute("timeline", { view: "areas", area: "talking" })}>
            {t("companion.about.moments")}
          </button>
        )}
      </div>
    </div>
  );
}

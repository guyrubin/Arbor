/**
 * v3 F-CHILD-3, v10.1 — one of the eight areas on My child › About, as a row
 * of the notebook by area (N-About boards: art, name, what you told, tokens,
 * one link).
 *
 * The row holds what the parent TOLD Arbor about this area: the newest line in
 * their own words with its day, or the question Arbor would ask. It never
 * grades the area: no share, no fill, no colour for how the child is doing. An
 * ink token is something told, dated; a pencil token is a proposal waiting. A
 * proposal waits inside its area, "Proposed, confirm?", and Confirm / No are
 * the same handleMemoryDecision the notebook uses; the receipt shows only
 * after that write resolved, names the proposal it answered, and clears
 * itself. "Tell more" opens the ONE guided conversation on this area.
 */
import React, { useEffect, useState } from "react";
import { FreeText } from "../ui/FreeText";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { isTold, receiptShows, RECEIPT_MS, type AspectFact, type AspectId, type AspectReceipt, type AspectState } from "../../lib/aboutAspects";
import { confirmFact, isFactStale, type FactField } from "../../lib/factsAsOf";
import { fmtDay } from "../../lib/formatDate";
import { languageName } from "../../lib/languageName";
import { goToRoute } from "../../hooks/useHashQuery";
import { toParentWords } from "../../server/parentWordsScrub";
import { LivingForm, Token } from "../../design/primitives";
import { aboutCopy } from "./aboutViewCopy";

/** Production's Living Forms art per area, cropped as the boards draw it at 48 px. */
const AREA_ART: Readonly<Record<AspectId, { src: string; h: number; crop: { w: number; h: number; x: number; y: number } }>> = {
  temper: { src: "/visuals/parent/v2/area-feelings-480.webp", h: 31.5, crop: { w: 58.8, h: 58.8, x: -5.4, y: -14.6 } },
  lang: { src: "/visuals/parent/v2/area-words-480.webp", h: 33.6, crop: { w: 60.2, h: 60.2, x: -6.1, y: -14.2 } },
  social: { src: "/visuals/parent/v2/area-play-480.webp", h: 27.3, crop: { w: 54.3, h: 54.3, x: -3.2, y: -13.2 } },
  routine: { src: "/visuals/guides/screens-480.webp", h: 37.2, crop: { w: 147.7, h: 83.1, x: -86.8, y: -23.7 } },
  sleep: { src: "/visuals/parent/v2/area-sleep-480.webp", h: 30.9, crop: { w: 60.6, h: 60.6, x: -5.8, y: -15.5 } },
  senses: { src: "/visuals/parent/v2/area-food-480.webp", h: 26.9, crop: { w: 54.9, h: 54.9, x: -4, y: -16 } },
  school: { src: "/visuals/parent/v2/area-school-480.webp", h: 36.3, crop: { w: 54.9, h: 54.9, x: -3.9, y: -9.5 } },
  strengths: { src: "/visuals/parent/v2/area-hands-480.webp", h: 29, crop: { w: 54.9, h: 54.9, x: -3.4, y: -13.5 } },
};

function AreaArt({ id, size }: { id: AspectId; size: number }) {
  const art = AREA_ART[id];
  const k = size / 48;
  return <LivingForm src={art.src} width={size} height={art.h * k} crop={{ w: art.crop.w * k, h: art.crop.h * k, x: art.crop.x * k, y: art.crop.y * k }} />;
}

export interface AspectCardProps {
  state: AspectState;
  /** The child's first name (the ask lines name the child). */
  name: string;
  /** Open the guided conversation on this area. */
  onTell: (id: AspectId) => void;
  /** "Still true? Edit" opens the profile drawer. */
  onEditDetails: () => void;
  /** The art frame: 48 px on desktop, 36 px on a phone (the boards' sizes). */
  artSize?: number;
}

export default function AspectCard({ state, name, onTell, onEditDetails, artSize = 48 }: AspectCardProps) {
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
      <p className="about-aspect-still" data-testid={`profile-fact-stale-${field}`}>
        <span>{t("elev.profile.fact.stillTrue")}</span>
        <button type="button" className="touch-target" data-testid={`profile-fact-keep-${field}`}
          onClick={() => { void updateChild(childProfile.id, { factsAsOf: confirmFact(childProfile.factsAsOf, field, new Date().toISOString()) }); }}>
          {t("elev.profile.fact.keep")}
        </button>
        <span aria-hidden="true">·</span>
        <button type="button" className="touch-target" data-testid={`profile-fact-edit-${field}`} onClick={onEditDetails}>
          {t("elev.profile.fact.edit")}
        </button>
      </p>
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
  // One told token per thing told (both languages are two), one pencil token for a proposal.
  const toldTokens = languages ? Math.max(1, Math.min(2, languageSegments.length)) : known ? 1 : 0;

  return (
    <article className="a8" data-testid={`about-aspect-${id}`} data-aspect={id} data-told={told ? "" : undefined} aria-labelledby={titleId}>
      <span className="a8-art" data-quiet={told ? undefined : ""}><AreaArt id={id} size={artSize} /></span>
      <div className="nm">
        <h3 id={titleId} className="a8-name">{t(`companion.about.aspect.${id}`)}</h3>
        {languages && (
          <small>
            <span data-testid="about-lang-roles">{languageSegments.map((seg, i) => <React.Fragment key={i}>{i > 0 && " · "}<bdi>{seg}</bdi></React.Fragment>)}</span>
            {" · "}<span data-testid="about-aspect-src">{srcLine("profile", languages.date)}</span>
          </small>
        )}
        {known && (
          <small>
            <span className="a8-quote" data-testid="about-aspect-quote"><FreeText text={known.words} /></span>
            {" · "}<span data-testid="about-aspect-src">{srcLine(known.source, known.date)}</span>
          </small>
        )}
        {!told && <small className="a8-ask" data-testid="about-aspect-ask" title={t(`companion.about.ask.${id}`, { name })}>{t("companion.milestones.notTold")} · {t(`companion.about.ask.${id}`, { name })}</small>}
        {languages && stillTrue("languages")}
        {known && stillTrue(known.factField)}
        {pending && (
          <p className="a8-pending" data-testid="about-aspect-pending">
            <strong>{t("companion.about.pending")}</strong><FreeText text={toParentWords(pending.fact)} />
          </p>
        )}
        {shown && <p className="a8-receipt" role="status" data-testid="about-aspect-receipt">{t(`companion.about.${shown.kind}`)}</p>}
      </div>
      <div className="a8-act">
        {(toldTokens > 0 || pending) && (
          <span className="pile line">
            {Array.from({ length: toldTokens }, (_, i) => <Token key={i} kind="neutral" className="told" size="md" label={copy.tokenToldOne} />)}
            {pending && <Token kind="neutral" state="ai" size="md" label={copy.tokenWaitingOne} />}
          </span>
        )}
        <span className="a8-links">
          {pending && (
            <>
              <button type="button" className="a8-link touch-target" data-testid="about-pending-confirm" disabled={busy} onClick={() => { void decide("approved"); }}>{t("companion.about.confirm")}</button>
              <button type="button" className="a8-link touch-target" data-testid="about-pending-dismiss" disabled={busy} onClick={() => { void decide("rejected"); }}>{t("companion.about.dismiss")}</button>
            </>
          )}
          {id === "lang" && !pending && (
            <button type="button" className="a8-link touch-target" data-testid="about-lang-moments" onClick={() => goToRoute("timeline", { view: "areas", area: "talking" })}>
              {t("companion.about.moments")}
            </button>
          )}
          <button type="button" className="a8-link touch-target" data-testid={`about-aspect-tell-${id}`} onClick={() => onTell(id)}>
            {told ? t("companion.about.tellMore") : t("companion.milestones.tell")}
          </button>
        </span>
      </div>
    </article>
  );
}

/**
 * v3 F-CHILD-3 — one of the eight areas on About {child} (#/profile).
 *
 * The card holds what the parent TOLD Arbor about this area: the newest line
 * in their own words with its source and day, or the question Arbor would ask
 * and "Not told yet". It never grades the area: no share, no fill, no colour
 * for how the child is doing (the tone is the AREA's). A proposal still
 * waiting for the parent sits inside its area in amber, "Proposed, confirm?",
 * and Confirm / No are the same handleMemoryDecision #/memory uses; the
 * receipt shows only after that write resolved. "Tell more" opens the ONE
 * guided conversation on this area.
 */
import React, { useState } from "react";
import Icon from "../ui/Icon";
import { FreeText } from "../ui/FreeText";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { ASPECT_ICONS, ASPECT_TONE, isTold, type AspectFact, type AspectId, type AspectState } from "../../lib/aboutAspects";
import { confirmFact, isFactStale, type FactField } from "../../lib/factsAsOf";
import { fmtDay } from "../../lib/formatDate";
import { languageName } from "../../lib/languageName";
import { DOMAIN_VARS } from "../../lib/tokens";
import { goToRoute } from "../../hooks/useHashQuery";
import { toParentWords } from "../../server/parentWordsScrub";

type Receipt = "kept" | "leftOut" | "failed" | null;

export interface AspectCardProps {
  state: AspectState;
  /** The child's first name (the ask lines name the child). */
  name: string;
  /** Open the guided conversation on this area. */
  onTell: (id: AspectId) => void;
  /** "Still true? Edit" opens the profile drawer. */
  onEditDetails: () => void;
}

export default function AspectCard({ state, name, onTell, onEditDetails }: AspectCardProps) {
  const { childProfile, updateChild, handleMemoryDecision, isMemoryUpdating } = useArbor();
  const { t, uiLang } = useLanguage();
  const [receipt, setReceipt] = useState<Receipt>(null);
  const { id, known, languages, pending } = state;
  const told = isTold(state);
  const tone = DOMAIN_VARS[ASPECT_TONE[id]];
  const titleId = `about-aspect-${id}-title`;

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
    setReceipt(null);
    let ok = false;
    try { ok = await handleMemoryDecision(pending.memoryId, status); } catch { ok = false; }
    // The receipt follows the resolved write only — never optimistic.
    setReceipt(ok ? (status === "approved" ? "kept" : "leftOut") : "failed");
  };

  const languageRow = (role: string, value: string) => (
    <div>
      <dt>{role}</dt>
      <dd><bdi>{languageName(value, t)}</bdi></dd>
    </div>
  );

  return (
    <article className="about-aspect" data-testid={`about-aspect-${id}`} data-aspect={id} data-told={told ? "" : undefined}
      aria-labelledby={titleId}
      style={{ "--aspect-ink": tone.ink, "--aspect-soft": tone.soft } as React.CSSProperties}>
      <h3 id={titleId} className="about-aspect-head">
        <span className="about-aspect-glyph" aria-hidden="true"><Icon name={ASPECT_ICONS[id]} size={22} /></span>
        <span className="min-w-0">{t(`companion.about.aspect.${id}`)}</span>
      </h3>

      {languages && (
        <>
          <dl className="about-aspect-langs" data-testid="about-lang-roles">
            {languages.home && languageRow(t("elev.growthTruth.lang.role.home"), languages.home)}
            {languages.second && languageRow(t("elev.growthTruth.lang.role.second"), languages.second)}
            {languages.others.length > 0 && (
              <div>
                <dt>{t("companion.about.langAlso")}</dt>
                <dd>{languages.others.map((l, i) => <React.Fragment key={`${l}-${i}`}>{i > 0 && " · "}<bdi>{languageName(l, t)}</bdi></React.Fragment>)}</dd>
              </div>
            )}
          </dl>
          <p className="about-aspect-src" data-testid="about-aspect-src">{srcLine("profile", languages.date)}</p>
          {stillTrue("languages")}
        </>
      )}

      {known && (
        <>
          <p className="about-aspect-quote" data-testid="about-aspect-quote"><FreeText text={known.words} /></p>
          <p className="about-aspect-src" data-testid="about-aspect-src">{srcLine(known.source, known.date)}</p>
          {stillTrue(known.factField)}
        </>
      )}

      {!told && (
        <>
          <p className="about-aspect-ask" data-testid="about-aspect-ask">{t(`companion.about.ask.${id}`, { name })}</p>
          <p className="about-aspect-src">{t("companion.milestones.notTold")}</p>
        </>
      )}

      {pending && (
        <div className="about-aspect-pending" data-testid="about-aspect-pending">
          <p>
            <Icon name="help" size={16} />
            <span className="min-w-0"><strong>{t("companion.about.pending")}</strong><FreeText text={toParentWords(pending.fact)} /></span>
          </p>
          <div className="about-aspect-pending-actions">
            <button type="button" className="touch-target" data-testid="about-pending-confirm" disabled={busy} onClick={() => { void decide("approved"); }}>
              <Icon name="check" size={16} />{t("companion.about.confirm")}
            </button>
            <button type="button" className="touch-target" data-testid="about-pending-dismiss" disabled={busy} onClick={() => { void decide("rejected"); }}>
              <Icon name="close" size={16} />{t("companion.about.dismiss")}
            </button>
          </div>
        </div>
      )}
      {receipt && (
        <p className="about-aspect-receipt" role="status" data-testid="about-aspect-receipt">
          {t(`companion.about.${receipt}`)}
        </p>
      )}

      <div className="about-aspect-actions">
        {id === "lang" && (
          <button type="button" className="about-link touch-target" data-testid="about-lang-moments"
            onClick={() => goToRoute("timeline", { view: "areas", area: "talking" })}>
            {t("companion.about.moments")}<Icon name="arrow_forward" size={16} className="rtl:-scale-x-100" />
          </button>
        )}
        <button type="button" className="about-link touch-target" data-testid={`about-aspect-tell-${id}`} onClick={() => onTell(id)}>
          <Icon name="add_comment" size={16} />{told ? t("companion.about.tellMore") : t("companion.milestones.tell")}
        </button>
      </div>
    </article>
  );
}

import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useDialog } from "../../hooks/useDialog";
import { motion, AnimatePresence } from "motion/react";
import { celebrate as fireCelebration } from "../../lib/celebrate";
import { Icon } from "../ui/Icon";
// W5 celebration chain — the shared E7 celebration grammar layered on a fresh
// milestone "yes" (once per milestone id, ≤1/session), plus the threshold-
// crossing pride card (Rule A bars it from Today; the Map is its home).
import {
  CelebrationMoment,
  celebrationSessionAvailable,
  hasCelebrated,
  markCelebrated,
} from "../ui/CelebrationMoment";
import PrideMomentCard from "../overview/PrideMomentCard";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
// AI-17 — the explain route's two structured fields are rendered as fields
// (prose, then one framed step), not glued into markdown and re-parsed.
import { ExplainAnswerBlock } from "../ui/ExplainAnswer";
import { explainAnswerText, isEmptyExplainAnswer, type ExplainAnswer } from "../../lib/explainAnswer";
// GP-23 — the two AI answers a parent reads WHILE marking milestones were the
// least structured AI in the app: raw markdown, an English-only failure
// string, no why-line, no provenance, nothing to keep. They now ride the same
// shared action cluster every other content object uses.
import { ContentActionBar, ContentWhyLine } from "../ui/ContentActionBar";
import { cardCls, ProgressBar, RadialProgress, Split, domainVisual, PASTEL } from "../ui/kit";
import { authHeaders, getAiLanguage } from "../../lib/api";
import { DOMAIN_REFERENCES } from "../../lib/milestoneReferences";
import { MILESTONE_AGE_BANDS, ageWindowMilestones, bandForAgeMonths, comparisonAgeMonths, correctedAge, explainMilestonePrompt } from "../../lib/milestoneData";
// UND-7 — fail-closed gate for the governed milestone example-media slot
// (missing reviewer/rightsRef → never renders; ships with zero media entries).
import { isRenderableMilestoneMedia } from "../../content/governance";
// B0 — months-precise age spine
import { ageMonthsFromProfile, ageYearsFromProfile } from "../../lib/childAge";
// GP-10 — the record keeps DATES and "first time" language; Wave G strings.
import { tGCare } from "../../lib/growthCareText";
import { fmtDay } from "../../lib/formatDate";
// LL-A3 — milestone → Learn Library "why this matters" door
import { bestCardForDomain } from "../../learn/learnLibrary";
import { LEARN_CARDS } from "../../learn/learnCards";
// UND-3 — the ONE canonical watch derivation feeds the "Gentle watch points" card.
import { useMonitoring } from "../../hooks/useMonitoring";
import { watchPointsSummary } from "../../lib/monitoring";
import { HeroAvatar } from "../ui/HeroAvatar";
// GP-31 — a first is a note and a date, not a boolean. The editor lives in
// components/milestones; the record + its per-child, sweepable store live in
// lib/firstsKeepsake (beside lib/firsts, which owns the CELEBRATION of a first).
import FirstKeepsakeSheet from "../milestones/FirstKeepsakeSheet";
import {
  readKeepsakes, removeKeepsake, upsertKeepsake, writeKeepsakes,
  type KeepsakeDraft, type KeepsakeMap,
} from "../../lib/firstsKeepsake";
import framework from "../../framework.json";
import { DevelopmentalDomainId, Milestone } from "../../types";

function celebrate() {
  // ONE capped, brand-coloured, reduced-motion-safe burst — the Law 7 caps
  // (≤12 particles / ≤800 ms) and the reduced-motion gate live in lib/celebrate.
  fireCelebration({ kind: "milestone" });
}

export default function MilestonesTab() {
  const {
    milestones,
    setMilestoneObservation,
    addCustomMilestone,
    handleGenerateMilestoneScaffold,
    isAnalyzingMilestones,
    milestoneAnalysisOfGaps,
    setChatInput,
    setSelectedLens,
    setActiveTab,
    seedCoach,
    childProfile,
    updateChild,
    deleteMilestone,
    updateMilestoneTitle,
    requestLearnRead,
    // GP-23 "Keep this": the canonical save verb writes the answer into the
    // child's `insights` record (the TJB-04 seam) — one tap, no new sink.
    keepBehaviorInsight,
  } = useArbor();

  const { t, uiLang } = useLanguage();
  const isRtl = uiLang === "he";
  const domainOptions = framework.domains;
  // openDomain === null → the "all domains" master list (the closed Map);
  // set → the single-domain drill-in detail pane.
  const [openDomain, setOpenDomain] = useState<string | null>(null);
  // AI-17: the explain route's TWO structured fields are held as they arrive.
  // They used to be glued into a markdown string here and re-parsed by a
  // markdown renderer downstream, which threw the structure away.
  const [explanations, setExplanations] = useState<Record<string, ExplainAnswer>>({});
  const [explaining, setExplaining] = useState<Record<string, boolean>>({});
  // AI-17: the ONE text form of the gap analysis, for the two consumers that
  // genuinely need a string — one-tap keep, and seeding a coach thread. The
  // render uses the structured fields directly.
  const gapsText = milestoneAnalysisOfGaps ? explainAnswerText(milestoneAnalysisOfGaps, t("explain.tryToday")) : "";
  // GP-23: a failed explain is a STATE, not a fake answer. It used to be a
  // hard-coded English markdown heading rendered through
  // MarkdownBlock — untranslated, unstyled, and indistinguishable from real
  // guidance to anything downstream.
  const [explainFailed, setExplainFailed] = useState<Record<string, boolean>>({});
  // UND-8 — inline rename/delete for custom milestones (replaces the native
  // window.prompt/window.confirm dialogs — jarring, untranslated, un-themeable).
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  // W5 — the milestone whose CelebrationMoment overlay is currently layered.
  const [celebratingId, setCelebratingId] = useState<string | null>(null);

  const { ref: dialogRef, requestClose, onBackdropClick } = useDialog({ open: Boolean(celebratingId), onClose: () => setCelebratingId(null) });

  // GP-31 — the keepsakes this child's parent has written. Device-local at
  // `arbor.firstsKeepsakes.<childId>`, so clearChildLocalState sweeps them
  // with the child; re-seeded whenever the active child changes so one
  // child's notes can never appear under a sibling's milestones.
  const [keepsakes, setKeepsakes] = useState<KeepsakeMap>({});
  const [keepsakeFor, setKeepsakeFor] = useState<string | null>(null);
  useEffect(() => {
    setKeepsakes(readKeepsakes(childProfile.id));
  }, [childProfile.id]);
  const persistKeepsakes = (next: KeepsakeMap) => {
    setKeepsakes(next);
    writeKeepsakes(childProfile.id, next);
  };
  const saveKeepsake = (draft: KeepsakeDraft) =>
    persistKeepsakes(upsertKeepsake(keepsakes, draft, new Date().toISOString()));
  const dropKeepsake = (milestoneId: string) =>
    persistKeepsakes(removeKeepsake(keepsakes, milestoneId));
  const openKeepsake = keepsakeFor ? milestones.find((m) => m.id === keepsakeFor) ?? null : null;

  /** One place decides what a mark does. Celebration fires ONLY on a fresh
   *  "yes" (never on uncheck / not_yet / not_sure): confetti stays the light
   *  layer, and the FULL CelebrationMoment (parent-mediated share included)
   *  layers at most once per milestone id ever (arbor.celebrate.seen.{childId})
   *  and at most once per session — the card's own session guard is checked
   *  BEFORE opening so the overlay never mounts around an empty card. */
  const observeMilestone = (item: Milestone, status: "yes" | "not_sure" | "not_yet") => {
    setMilestoneObservation(item.id, status);
    if (status !== "yes" || item.checked) return;
    celebrate();
    if (!hasCelebrated(childProfile.id, item.id) && celebrationSessionAvailable()) {
      markCelebrated(childProfile.id, item.id);
      setCelebratingId(item.id);
    }
  };

  // ── Corrected age (preterm) ──────────────────────────────────────────────
  // B0: prefer months-precise value from birthDate/ageMonths over the legacy
  // whole-year field so a 9-month-old isn't compared against the 0-month band.
  const chronoMonths = ageMonthsFromProfile(childProfile) ?? Math.round((childProfile.age || 0) * 12);
  const gestationalWeeks = childProfile.preterm?.gestationalWeeks;
  const corrected = correctedAge(chronoMonths, gestationalWeeks);
  const comparisonMonths = comparisonAgeMonths(chronoMonths, gestationalWeeks);
  const currentBand = bandForAgeMonths(comparisonMonths);
  // GP-09: the ONE band after the current one stays open ("coming up"); bands
  // beyond it collapse behind "Show later milestones".
  const nextBandMonths = (() => {
    const idx = MILESTONE_AGE_BANDS.findIndex((b) => b.months === currentBand.months);
    return MILESTONE_AGE_BANDS[idx + 1]?.months ?? currentBand.months;
  })();
  // GP-08: every count on this surface is over the child's AGE WINDOW (current
  // corrected band + one earlier — the shared lib/milestoneData helper), never
  // the whole 0–6y catalogue ("0 of 133" / "0/28" on day 0).
  const windowMilestones = useMemo(() => ageWindowMilestones(milestones, comparisonMonths), [milestones, comparisonMonths]);
  const windowChecked = windowMilestones.filter((m) => m.checked).length;
  const windowTotal = windowMilestones.length;

  // UND-3 — "Gentle watch points" derives from the canonical useMonitoring
  // watch-area derivation: real domain names + COUNTS only (clinical firewall —
  // never severity, verdicts, or fabricated claims). Empty → neutral/hidden.
  const monitoring = useMonitoring();
  const watchPoints = useMemo(() => watchPointsSummary(monitoring), [monitoring]);

  const [showGestation, setShowGestation] = useState(false);
  const [gestationDraft, setGestationDraft] = useState<string>(gestationalWeeks ? String(gestationalWeeks) : "");
  const [savingGestation, setSavingGestation] = useState(false);

  const saveGestation = async (weeks: number | null) => {
    setSavingGestation(true);
    try {
      await updateChild(childProfile.id, {
        preterm: weeks && weeks < 40 && weeks > 0 ? { gestationalWeeks: weeks } : undefined,
      });
      setShowGestation(false);
    } finally {
      setSavingGestation(false);
    }
  };

  const explain = async (item: Milestone) => {
    if (explanations[item.id] || explainFailed[item.id]) {
      setExplanations((p) => {
        const n = { ...p };
        delete n[item.id];
        return n;
      });
      setExplainFailed((p) => ({ ...p, [item.id]: false }));
      return;
    }
    setExplaining((p) => ({ ...p, [item.id]: true }));
    setExplainFailed((p) => ({ ...p, [item.id]: false }));
    try {
      // Wave-T (lane A/T): the inline explainer uses the dedicated explain
      // route — never the chat route, the heaviest in the app — and renders
      // the STRUCTURED fields (explanation, then one "try today" step under
      // its own heading). Same body shape as ArborContext.explainViaApi.
      const res = await fetch("/api/explain", {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify({
          childProfile,
          subject: `The developmental milestone "${item.title}"`,
          // UND-8 — months-precise for under-24-month children ("a 9-month-old",
          // never "a 0-year-old"); the B0 chronoMonths spine is the source.
          details: explainMilestonePrompt(item.title, chronoMonths),
          language: getAiLanguage(),
        }),
      });
      if (!res.ok) throw new Error("fail");
      const data = await res.json();
      const answer: ExplainAnswer = {
        explanation: String(data?.explanation ?? "").trim(),
        tryToday: String(data?.tryToday ?? "").trim(),
      };
      if (isEmptyExplainAnswer(answer)) throw new Error("empty");
      setExplanations((p) => ({ ...p, [item.id]: answer }));
    } catch {
      // GP-23: an honest, translated failure state rendered by the card
      // below — never a markdown heading masquerading as guidance.
      setExplainFailed((p) => ({ ...p, [item.id]: true }));
    } finally {
      setExplaining((p) => ({ ...p, [item.id]: false }));
    }
  };
  // Bands strictly below the child's current band start collapsed (progressive
  // disclosure — a parent of a 5yo shouldn't wade through newborn items). The
  // current band and anything ahead start open. Tracks which collapsed bands the
  // parent has manually expanded.
  const [openEarlierBands, setOpenEarlierBands] = useState<Record<number, boolean>>({});
  // GP-09: bands beyond current + next start collapsed too ("Show later milestones").
  const [openLaterBands, setOpenLaterBands] = useState<Record<number, boolean>>({});

  const [showAdd, setShowAdd] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDomain, setNewDomain] = useState<DevelopmentalDomainId>(domainOptions[0].id as DevelopmentalDomainId);

  const domainStats = useMemo(() => {
    const map: Record<string, { total: number; checked: number }> = {};
    for (const dom of domainOptions) map[dom.id] = { total: 0, checked: 0 };
    for (const m of windowMilestones) {
      if (!map[m.domain]) map[m.domain] = { total: 0, checked: 0 };
      map[m.domain].total += 1;
      if (m.checked) map[m.domain].checked += 1;
    }
    return map;
  }, [windowMilestones, domainOptions]);

  const submitCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    addCustomMilestone(newTitle.trim(), newDomain);
    setNewTitle("");
    setShowAdd(false);
  };

  const renderItem = (item: Milestone) => (
    <div
      key={item.id}
      className="p-3 rounded-xl transition"
      style={item.checked ? { background: "var(--arbor-paper-deep)", border: "1px solid rgba(52,178,119,0.30)" } : { background: "#fff", border: "1px solid var(--arbor-rule)" }}
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-6 w-6 flex-none items-center justify-center rounded-full" style={{ background: item.checked ? "var(--arbor-green-soft)" : "var(--arbor-paper-deep)", color: item.checked ? "var(--arbor-green-ink)" : "var(--arbor-muted)" }}><Icon name={item.checked ? "check" : item.observationStatus === "not_sure" ? "question_mark" : "remove"} size={14} /></span>
        <div className="space-y-0.5 flex-1">
          <span className="font-bold block" style={{ color: item.checked ? "var(--arbor-green-ink)" : "var(--arbor-ink)" }}>{item.title}</span>
          <span className="text-[12px] block leading-relaxed" style={{ color: "var(--arbor-muted)" }}>{item.description}</span>
          {item.skillLooksLike && (
            <span className="text-[12px] block leading-relaxed" style={{ color: "var(--arbor-muted)" }}>
              <span className="font-bold" style={{ color: "var(--arbor-green-ink)" }}>{t("ms.looksLike")} </span>
              {item.skillLooksLike}
            </span>
          )}
          {/* UND-7 — governed example-media slot (AR-CAP-08/AR-CONT-07). FAIL-CLOSED:
              renders only a fully governed record (missing reviewer/rightsRef →
              never renders — isRenderableMilestoneMedia mirrors the AR-CONT-01
              gate) in the viewer's locale. Ships with ZERO media entries, so prod
              stays visually unchanged until licensed media (Guy-gated, GD-8) lands. */}
          {isRenderableMilestoneMedia(item.exampleMedia) && item.exampleMedia.locale === uiLang && (
            <figure className="mt-2 overflow-hidden rounded-xl" style={{ border: "1px solid var(--arbor-rule)", background: "var(--arbor-paper-deep)" }}>
              {item.exampleMedia.kind === "video" ? (
                <video src={item.exampleMedia.src} controls playsInline preload="metadata" className="w-full max-h-56" aria-label={item.exampleMedia.alt} />
              ) : (
                <img src={item.exampleMedia.src} alt={item.exampleMedia.alt} loading="lazy" className="w-full max-h-56 object-cover" />
              )}
              <figcaption className="px-3 py-1.5 text-[11px] leading-relaxed" style={{ color: "var(--arbor-muted)" }}>
                <span className="font-bold" style={{ color: "var(--arbor-green-ink)" }}>{t("ms.mediaExample")}</span>
                {" · "}
                {t("ms.mediaCredit")} {item.exampleMedia.credit}
              </figcaption>
            </figure>
          )}
          {/* UND-1 — observation labels resolve through i18n keys (were inline ternaries).
              GP-10 — "Yes" answered a question nobody asked; the act is noticing
              something for the FIRST TIME, so the control says "Seen it" and the
              group label says what marking means.
              GP-12 — min-h-11 (44px): this is the surface's primary move, and a
              mis-tap between "Not sure" and "Not yet" changes what monitoring
              counts as an answer (lib/monitoring.ts isMilestoneAnswered). */}
          <div className="grid grid-cols-3 gap-1.5 pt-2" role="group" aria-label={tGCare(uiLang, "elev.gcare.ms.observePrompt")}>
            {([
              ["yes", tGCare(uiLang, "elev.gcare.ms.observe.yes")],
              ["not_sure", t("ms.observe.notSure")],
              ["not_yet", t("ms.observe.notYet")],
            ] as const).map(([status, label]) => {
              const selected = (item.observationStatus ?? (item.checked ? "yes" : undefined)) === status;
              return <button key={status} type="button" onClick={() => observeMilestone(item, status)} aria-pressed={selected} className="min-h-11 rounded-lg px-1.5 text-[11px] font-bold" style={{ background: selected ? "var(--arbor-green-soft)" : "var(--arbor-paper-elevated)", color: selected ? "var(--arbor-green-ink)" : "var(--arbor-muted)", border: `1px solid ${selected ? "rgba(52,178,119,0.30)" : "var(--arbor-rule)"}` }}>{label}</button>;
            })}
          </div>
          {item.observationStatus === "not_sure" && <p className="pt-1 text-[11px] leading-relaxed" style={{ color: "var(--arbor-muted)" }}>{t("ms.observeNotSureHint")}</p>}
          <div className="flex items-center gap-2 flex-wrap pt-1">
            {/* GP-10 — `observationUpdatedAt` has been written on every mark since
                ArborContext setMilestoneObservation, but nothing ever rendered it:
                a milestone without a date is a checkbox, with one it is a keepsake
                ("First steps — 14 Aug"). Dates only; the chip never grades. */}
            {item.checked && (
              <span data-testid="ms-noticed-chip" className="text-[11px] font-extrabold px-1.5 py-0.5 rounded" style={{ color: "var(--arbor-green-ink)", background: "var(--arbor-green-soft)" }}>
                {item.observationUpdatedAt
                  ? tGCare(uiLang, "elev.gcare.ms.noticedOn", { date: fmtDay(item.observationUpdatedAt, uiLang) })
                  : tGCare(uiLang, "elev.gcare.ms.noticedUndated")}
              </span>
            )}
            {item.ageGroup && <span className="text-[11px] font-bold px-1.5 py-0.5 rounded" style={{ color: "var(--arbor-muted)", background: "var(--arbor-paper-deep)" }}>{t("ms.age")} {item.ageGroup}</span>}
            {item.custom && <span className="text-[11px] font-bold px-1.5 py-0.5 rounded" style={{ color: "var(--arbor-peach-ink)", background: "var(--arbor-peach-soft)" }}>{t("ms.custom")}</span>}
            {item.custom && (
              <button
                type="button"
                onClick={(e) => { e.preventDefault(); setConfirmDeleteId(null); setRenameDraft(item.title); setRenamingId(item.id); }}
                aria-label={t("aria.renameCustomMilestone")}
                className="text-[11px] transition"
                style={{ color: "var(--arbor-muted)" }}
              >
                <Icon name="edit" size={11} />
              </button>
            )}
            {item.custom && (
              <button
                type="button"
                onClick={(e) => { e.preventDefault(); setRenamingId(null); setConfirmDeleteId(item.id); }}
                aria-label={t("aria.deleteCustomMilestone")}
                className="text-[11px] transition"
                style={{ color: "var(--arbor-muted)" }}
              >
                <Icon name="delete" size={11} />
              </button>
            )}
            {item.references?.map((r, i) => (
              <a key={i} href={r.url} target="_blank" rel="noreferrer" className="text-[11px] font-bold flex items-center gap-0.5" style={{ color: "var(--arbor-sky-ink)" }}>
                {r.label} <Icon name="open_in_new" size={11} />
              </a>
            ))}
            {!item.custom && DOMAIN_REFERENCES[item.domain] && (
              <a
                href={DOMAIN_REFERENCES[item.domain].url}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="text-[11px] font-bold flex items-center gap-0.5"
                style={{ color: "var(--arbor-sky-ink)" }}
              >
                {DOMAIN_REFERENCES[item.domain].label} <Icon name="open_in_new" size={11} />
              </a>
            )}
            <button
              type="button"
              onClick={(e) => { e.preventDefault(); void explain(item); }}
              disabled={explaining[item.id]}
              className="text-[11px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1 transition"
              style={{ color: "var(--arbor-green-ink)", background: "var(--arbor-green-soft)" }}
            >
              {explaining[item.id] ? <Icon name="progress_activity" size={11} className="animate-spin" /> : <Icon name="menu_book" size={11} />}
              {explanations[item.id] || explainFailed[item.id] ? t("ms.hide") : t("ms.explain")}
            </button>
            {/* LL-A3 — one tap from a milestone to its "why this matters" read */}
            {(() => {
              const read = bestCardForDomain(LEARN_CARDS, item.domain, ageYearsFromProfile(childProfile));
              if (!read) return null;
              return (
                <button
                  type="button"
                  onClick={(e) => { e.preventDefault(); requestLearnRead({ cardId: read.id, source: "milestone" }); }}
                  className="text-[11px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1 transition"
                  style={{ color: "var(--arbor-lav-ink)", background: "var(--arbor-lav-soft)" }}
                >
                  <Icon name="local_library" size={11} />
                  {t("learn.whyMatters")}
                </button>
              );
            })()}
          </div>
          {/* GP-31 — the keepsake. `observationUpdatedAt` records the day the
              parent PRESSED the button; this records what they actually saw,
              on the day it happened, in their own words. Offered only once the
              milestone is marked — a keepsake belongs to a first that has
              happened. A photo is optional; the note and the date are the
              whole thing. Descriptive record only: no score, no comparison. */}
          {item.checked && (
            <div className="pt-2">
              {keepsakes[item.id] ? (
                <div
                  data-testid="ms-keepsake"
                  className="rounded-xl p-2.5"
                  style={{ background: "var(--arbor-lav-soft)", border: "1px solid var(--arbor-rule)" }}
                >
                  <p className="text-[12.5px] leading-relaxed" dir="auto" style={{ color: "var(--arbor-ink)" }}>
                    {keepsakes[item.id].note}
                  </p>
                  {keepsakes[item.id].photoUrl && (
                    <img
                      src={keepsakes[item.id].photoUrl}
                      alt=""
                      className="mt-2 w-full rounded-lg object-cover"
                      style={{ maxHeight: 160 }}
                    />
                  )}
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    <span className="text-[11px] font-extrabold" style={{ color: "var(--arbor-lav-ink)" }}>
                      {t("elev.waveR.keepsake.on", { date: fmtDay(keepsakes[item.id].noticedOn, uiLang) })}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => { e.preventDefault(); setKeepsakeFor(item.id); }}
                      className="text-[11px] font-bold"
                      style={{ color: "var(--arbor-muted)" }}
                    >
                      {t("elev.waveR.keepsake.edit")}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  data-testid="ms-keepsake-add"
                  aria-label={t("elev.waveR.keepsake.aria")}
                  onClick={(e) => { e.preventDefault(); setKeepsakeFor(item.id); }}
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2.5 text-[11px] font-bold"
                  style={{ color: "var(--arbor-lav-ink)", background: "var(--arbor-lav-soft)" }}
                >
                  <Icon name="bookmark_add" size={13} fill={1} /> {t("elev.waveR.keepsake.add")}
                </button>
              )}
            </div>
          )}
          {/* UND-8 — inline rename form (the gestation form is the pattern):
              in-app, translated, themed — no native window.prompt. */}
          {item.custom && renamingId === item.id && (
            <form
              onSubmit={(e) => { e.preventDefault(); const nt = renameDraft.trim(); if (nt) updateMilestoneTitle(item.id, nt); setRenamingId(null); }}
              className="flex flex-col sm:flex-row gap-2 items-stretch pt-2"
            >
              <input
                autoFocus
                value={renameDraft}
                onChange={(e) => setRenameDraft(e.target.value)}
                aria-label={t("aria.renameCustomMilestone")}
                className="flex-1 rounded-xl px-3 py-2 text-sm focus:outline-none"
                style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule-strong)", color: "var(--arbor-ink)" }}
              />
              <button type="submit" className="text-white font-extrabold text-xs px-4 py-2 rounded-xl transition" style={{ background: "var(--arbor-clay)" }}>{t("ms.renameSave")}</button>
              <button type="button" onClick={() => setRenamingId(null)} className="text-xs px-2" style={{ color: "var(--arbor-muted)" }}>{t("ms.cancel")}</button>
            </form>
          )}
          {/* UND-8 — inline delete confirm row — no native window.confirm. */}
          {item.custom && confirmDeleteId === item.id && (
            <div className="flex flex-wrap items-center gap-2 pt-2">
              <span className="text-[11px] font-bold" style={{ color: "var(--arbor-ink)" }}>{t("ms.deleteConfirm")}</span>
              <button type="button" onClick={() => { deleteMilestone(item.id); setConfirmDeleteId(null); }} className="text-xs font-extrabold px-3 py-1.5 rounded-xl text-white" style={{ background: "var(--arbor-clay-deep)" }}>{t("ms.deleteYes")}</button>
              <button type="button" onClick={() => setConfirmDeleteId(null)} className="text-xs px-2" style={{ color: "var(--arbor-muted)" }}>{t("ms.cancel")}</button>
            </div>
          )}
        </div>
        {item.checked && (
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Memory portrait — a quiet reminder this is a moment in the child's record. */}
            <HeroAvatar size={28} animate={false} ring={false} className="flex-shrink-0" />
            <button type="button" onClick={(e) => { e.preventDefault(); celebrate(); }} title="Celebrate" className="transition" style={{ color: "var(--arbor-peach-ink)" }}>
              <Icon name="celebration" size={16} />
            </button>
          </div>
        )}
      </div>
      <AnimatePresence initial={false}>
        {(explanations[item.id] || explainFailed[item.id]) && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            {/* GP-23 — the answer a parent reads WHILE marking a milestone.
                Structure (the /api/explain contract's explanation + one "try
                today" step), provenance (the why-line names what it was
                written from), a door to the Trust Center, and ONE tap to keep
                it in the child's record. Failure is its own honest, translated
                state — not a markdown heading pretending to be guidance. */}
            <div data-testid={`ms-explain-${item.id}`} className="mt-2 p-3 rounded-xl text-[11px] leading-relaxed select-text" style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule)" }}>
              {explainFailed[item.id] ? (
                <div data-testid="ms-explain-error">
                  <p className="text-[12px] font-extrabold" style={{ color: "var(--arbor-ink)" }}>{t("elev.waveR.ms.explain.error.title")}</p>
                  <p className="mt-1" style={{ color: "var(--arbor-muted)" }}>{t("elev.waveR.ms.explain.error.body")}</p>
                  <button
                    type="button"
                    onClick={(e) => { e.preventDefault(); setExplainFailed((prev) => ({ ...prev, [item.id]: false })); void explain(item); }}
                    className="mt-2 min-h-11 text-[11px] font-extrabold"
                    style={{ color: "var(--arbor-green-ink)" }}
                  >
                    {t("err.retry")}
                  </button>
                </div>
              ) : (
                <>
                  <ExplainAnswerBlock answer={explanations[item.id]} tryTodayLabel={t("explain.tryToday")} className="space-y-1.5" />
                  <ContentActionBar
                    variant="inline"
                    surface="milestone-explain"
                    why={firstName
                      ? t("elev.waveR.ms.explain.why", { name: firstName })
                      : t("elev.waveR.ms.explain.whyGeneric")}
                    trustLink
                    className="mt-2.5"
                    actions={[
                      { verb: "save", label: t("elev.waveR.ms.explain.keep"), icon: "bookmark_add", onClick: () => keepBehaviorInsight(`${item.title} — ${explainAnswerText(explanations[item.id], t("explain.tryToday"))}`) },
                    ]}
                  />
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );

  /**
   * Group a domain's milestones into the canonical age bands, in ascending age
   * order. Items without an `ageMonths` (legacy/custom) fall into a trailing
   * "other" bucket keyed -1 so they always render after the dated bands.
   */
  const groupByBand = (items: Milestone[]) => {
    const byBand = new Map<number, { label: string; items: Milestone[] }>();
    for (const m of items) {
      const key = typeof m.ageMonths === "number" ? bandForAgeMonths(m.ageMonths).months : -1;
      const label = key === -1 ? t("ms.custom") : bandForAgeMonths(m.ageMonths as number).label;
      if (!byBand.has(key)) byBand.set(key, { label, items: [] });
      byBand.get(key)!.items.push(m);
    }
    return [...byBand.entries()]
      .sort((a, b) => (a[0] === -1 ? 1 : b[0] === -1 ? -1 : a[0] - b[0]))
      .map(([months, v]) => ({ months, label: v.label, items: v.items }));
  };

  /** The age-banded checklist for one domain — reused inside the drill-in pane.
   *  Identical band/disclosure/renderItem behavior as before; only relocated. */
  const renderDomainChecklist = (domId: string) => {
    const itemsInDom = milestones.filter((m) => m.domain === domId);
    const bands = groupByBand(itemsInDom);
    if (itemsInDom.length === 0) {
      return <p className="text-[11px] italic" style={{ color: "var(--arbor-muted)" }}>{t("ms.noMilestones")}</p>;
    }
    return (
      <div className="space-y-2.5">
        {bands.map((band) => {
          const isCurrent = band.months === currentBand.months;
          const isEarlier = band.months !== -1 && band.months < currentBand.months;
          const isAhead = band.months !== -1 && band.months > currentBand.months;
          // GP-09: only the ONE next band opens as "coming up"; later bands
          // collapse behind "Show later milestones" (mirror of ms.showEarlier).
          const isLater = band.months !== -1 && band.months > nextBandMonths;
          const isToggleable = isEarlier || isLater;
          const collapsed = (isEarlier && !openEarlierBands[band.months]) || (isLater && !openLaterBands[band.months]);
          const toggleBand = () => {
            if (isEarlier) setOpenEarlierBands((p) => ({ ...p, [band.months]: !p[band.months] }));
            else if (isLater) setOpenLaterBands((p) => ({ ...p, [band.months]: !p[band.months] }));
          };
          const checkedInBand = band.items.filter((m) => m.checked).length;
          return (
            <div key={band.months} className="space-y-2">
              <button
                type="button"
                onClick={toggleBand}
                aria-expanded={!collapsed}
                className="w-full flex items-center justify-between gap-2 text-start"
                style={{ cursor: isToggleable ? "pointer" : "default" }}
              >
                <span className="flex items-center gap-2">
                  <span className="text-[11px] font-extrabold uppercase tracking-wide" style={{ color: isCurrent ? "var(--arbor-green-ink)" : "var(--arbor-muted)" }}>{band.label}</span>
                  {isCurrent && <span className="text-[11px] font-extrabold uppercase tracking-wide px-1.5 py-0.5 rounded" style={{ color: "var(--arbor-green-ink)", background: "var(--arbor-green-soft)" }}>{t("ms.currentBand")}</span>}
                  {isAhead && !isLater && <span className="text-[11px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded" style={{ color: "var(--arbor-muted)", background: "var(--arbor-paper-deep)" }}>{t("ms.aheadBand")}</span>}
                  {isLater && <span className="text-[11px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded" style={{ color: "var(--arbor-muted)", background: "var(--arbor-paper-deep)" }}>{t("elev.growthTruth.ms.laterBand")}</span>}
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="text-[11px] font-bold" style={{ color: "var(--arbor-muted)" }}>{checkedInBand}/{band.items.length}</span>
                  {isToggleable && (
                    <Icon name="expand_more" size={16} className="transition-transform" style={{ color: "var(--arbor-muted)", transform: collapsed ? "rotate(-90deg)" : "rotate(0deg)" }} />
                  )}
                </span>
              </button>
              <AnimatePresence initial={false}>
                {!collapsed && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden space-y-2">
                    {band.items.map(renderItem)}
                  </motion.div>
                )}
              </AnimatePresence>
              {collapsed && (
                <button
                  type="button"
                  onClick={toggleBand}
                  className="text-[11px] font-bold min-h-[44px]"
                  style={{ color: "var(--arbor-green-ink)" }}
                >
                  {isLater ? t("elev.growthTruth.ms.showLater") : t("ms.showEarlier")}
                </button>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  // Loop-2 affordance: turn a Map domain into a playful kid quest. Routes to the
  // existing Daily Play activity library (which surfaces in the child's world),
  // seeded with the domain context — no new write path or capability invented.
  const assignActivity = (domId: string, domLabel: string) => {
    setChatInput(`Suggest one playful, age-appropriate activity I can assign ${childProfile.name || "my child"} to gently support "${domLabel}". Keep it to a single quest they'd enjoy.`);
    setSelectedLens("Vygotsky's Scaffolding");
    setActiveTab("daily-play");
  };

  // RTL-aware directional chevrons via the shared Material Symbols <Icon>.
  // (Declared as components so they slot into the existing <ChevStart/> /
  // <ChevEnd/> render sites, including the domain-map scopes where a local
  // `Icon` shadows the import.)
  const chevStartName = isRtl ? "chevron_right" : "chevron_left";
  const chevEndName = isRtl ? "chevron_left" : "chevron_right";
  const ChevStart = ({ className, style }: { className?: string; style?: React.CSSProperties }) => (
    <Icon name={chevStartName} size={16} className={className} style={style} />
  );
  const ChevEnd = ({ className, style }: { className?: string; style?: React.CSSProperties }) => (
    <Icon name={chevEndName} size={16} className={className} style={style} />
  );
  const firstName = (childProfile.name || "").split(" ")[0];

  return (
    <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mx-auto w-full min-w-0 max-w-[1180px] space-y-5 sm:space-y-6">
      <div className="flex min-w-0 items-start gap-3.5 sm:items-center">
        {/* The child's memory portrait — modest, no comic frame in the parent register. */}
        <HeroAvatar size={52} mood="wave" animate={false} ring={false} className="flex-shrink-0" />
        <div className="min-w-0">
          <h2 className="text-2xl md:text-[2rem] leading-[1.1]" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}>{t("ms.title")}</h2>
          <p className="text-sm mt-1.5 max-w-2xl" style={{ color: "var(--arbor-muted)" }}>{t("ms.subtitle")}</p>
        </div>
      </div>

      {/* W5 mount — the R3 threshold-crossing pride moment. Designed for Today,
          but Rule A caps Today's module budget, so it lives here: the Map is
          where crossings are born. Renders nothing when there is no new
          crossing; ≤1/session via the shared CelebrationMoment guard. */}
      <PrideMomentCard />

      {/* Master/detail spine: left rail = the persistent Development Map summary
          (firewall-safe COUNT headline — never a 0–100 gauge or trend delta);
          right pane = the seven-domain master list, or a single-domain drill-in. */}
      <Split
        ratio="minmax(300px,1fr) minmax(0,1.4fr)"
        className="md:[&>div]:!contents xl:[&>div]:!grid"
        left={
          <div className="min-w-0 space-y-4 xl:sticky xl:top-4 xl:space-y-5">
            {/* Development Map summary — count headline only, no verdict score. */}
            <div className={`${cardCls} min-w-0 p-4 sm:p-6`}>
              <span className="text-[11px] uppercase font-extrabold tracking-wider" style={{ color: "var(--arbor-green-ink)" }}>{t("ms.developmentMap")}</span>
              {/* Ring/dial visual — CLINICAL FIREWALL: the number inside is a COUNT of
                  noticed milestones (never a %/score/verdict); the ring fill is only the
                  checked/total count-proportion, and it is not labelled as competence. */}
              <div className="mt-4 flex min-w-0 flex-col items-start gap-4 sm:flex-row sm:items-center">
                <RadialProgress value={windowChecked} total={windowTotal} tone="mint" size={92} thickness={10}>
                  <span className="text-center leading-none">
                    <span className="block text-[26px] font-extrabold" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-green-ink)" }}>{windowChecked}</span>
                    <span className="block text-[11px] font-bold mt-0.5" style={{ color: "var(--arbor-muted)" }}>{t("ms.of")} {windowTotal}</span>
                  </span>
                </RadialProgress>
                <div className="min-w-0">
                  <div className="text-[12px] uppercase font-extrabold tracking-wider" style={{ color: "var(--arbor-muted)" }}>{t("ms.observedSoFar")}</div>
                  <p className="text-[11px] mt-1.5 leading-relaxed" style={{ color: "var(--arbor-muted)" }}>{t("ms.snapshotNotScore")}</p>
                  {/* GP-08: the denominator is the age window, and the parent is told so. */}
                  <p className="text-[11px] mt-1.5 leading-relaxed" style={{ color: "var(--arbor-muted)" }}>{t("elev.growthTruth.window.hint")}</p>
                </div>
              </div>

              {/* B1 — under-2 reassurance lead: name the current stage, no checklist framing. */}
              {comparisonMonths < 24 && (
                <div className="mt-4 rounded-xl p-3.5" style={{ background: "var(--arbor-green-soft)" }}>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[11px] uppercase font-extrabold tracking-wider" style={{ color: "var(--arbor-green-ink)" }}>{t("ms.rightNow")}</span>
                    <span className="text-lg" style={{ fontFamily: "var(--font-editorial)", color: "var(--arbor-ink)" }}>{currentBand.label}</span>
                    {corrected.applied && (
                      <span className="text-[11px] font-extrabold uppercase tracking-wide px-1.5 py-0.5 rounded" style={{ color: "var(--arbor-green-ink)", background: "#fff" }}>
                        {t("ms.correctedBadge")} · {corrected.correctedMonths}m
                      </span>
                    )}
                  </div>
                  <p className="text-[12px] leading-relaxed mt-1.5" style={{ color: "var(--arbor-ink)" }}>{t("ms.rightNowBody")}</p>
                </div>
              )}
            </div>

            {/* Corrected-age (preterm) control + badge — relocated into the rail. */}
            <div className={`${cardCls} min-w-0 p-4`}>
              <div className="flex flex-col gap-3">
                <div className="flex items-start gap-2.5">
                  <span className="p-1.5 rounded-lg flex items-center justify-center mt-0.5" style={{ background: "var(--arbor-green-soft)", color: "var(--arbor-green-ink)" }}><Icon name="child_care" size={16} /></span>
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-extrabold" style={{ color: "var(--arbor-ink)" }}>{t("ms.bornEarly")}</span>
                      {corrected.applied && (
                        <span className="text-[11px] font-extrabold uppercase tracking-wide px-1.5 py-0.5 rounded" style={{ color: "var(--arbor-green-ink)", background: "var(--arbor-green-soft)" }}>
                          {t("ms.correctedBadge")} · {corrected.correctedMonths}m
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] leading-relaxed" style={{ color: "var(--arbor-muted)" }}>{t("ms.gestationHint")}</p>
                  </div>
                </div>
                {!showGestation && (
                  <button
                    type="button"
                    onClick={() => { setGestationDraft(gestationalWeeks ? String(gestationalWeeks) : ""); setShowGestation(true); }}
                    className="text-xs font-bold px-3 py-2 rounded-xl transition self-start whitespace-nowrap"
                    style={{ color: "var(--arbor-green-ink)", background: "var(--arbor-green-soft)", border: "1px solid rgba(52,178,119,0.30)" }}
                  >
                    {gestationalWeeks ? `${gestationalWeeks}w · ${t("ms.gestationSave")}` : t("ms.gestationLabel")}
                  </button>
                )}
              </div>
              {showGestation && (
                <form
                  onSubmit={(e) => { e.preventDefault(); const n = Number(gestationDraft); saveGestation(Number.isFinite(n) && n > 0 ? n : null); }}
                  className="flex flex-col gap-2 items-stretch mt-3"
                >
                  <label className="flex-1 flex items-center gap-2 text-[11px] font-bold" style={{ color: "var(--arbor-muted)" }}>
                    {t("ms.gestationLabel")}
                    <input
                      autoFocus
                      type="number"
                      min={22}
                      max={42}
                      inputMode="numeric"
                      value={gestationDraft}
                      onChange={(e) => setGestationDraft(e.target.value)}
                      placeholder="40"
                      className="w-24 rounded-xl px-3 py-2 text-sm focus:outline-none"
                      style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule-strong)", color: "var(--arbor-ink)" }}
                    />
                  </label>
                  <div className="flex flex-wrap items-stretch gap-2">
                    <button type="submit" disabled={savingGestation} className="text-white font-extrabold text-xs px-4 py-2 rounded-xl transition disabled:opacity-60" style={{ background: "var(--arbor-clay)" }}>
                      {savingGestation ? <Icon name="progress_activity" size={14} className="animate-spin" /> : t("ms.gestationSave")}
                    </button>
                    <button type="button" disabled={savingGestation} onClick={() => saveGestation(null)} className="text-xs px-3 py-2 rounded-xl" style={{ color: "var(--arbor-muted)", border: "1px solid var(--arbor-rule)" }}>{t("ms.gestationClear")}</button>
                    <button type="button" onClick={() => setShowGestation(false)} className="text-xs px-2" style={{ color: "var(--arbor-muted)" }}>{t("ms.cancel")}</button>
                  </div>
                </form>
              )}
            </div>
          </div>
        }
        right={
          openDomain === null ? (
            /* ── Closed Map: the seven domains as tappable rows with COUNT bars ── */
            <div className={`${cardCls} p-6`}>
              <h3 className="text-[15px] font-extrabold mb-4" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}>{t("ms.developmentMap")}</h3>
              <div className="flex flex-col gap-3.5">
                {domainOptions.filter((dom) => (domainStats[dom.id]?.total ?? 0) > 0).map((dom) => {
                  const s = domainStats[dom.id] || { total: 0, checked: 0 };
                  const dv = domainVisual(dom.id);
                  const Icon = dv.icon;
                  return (
                    <button
                      key={dom.id}
                      type="button"
                      onClick={() => setOpenDomain(dom.id)}
                      className="text-start rounded-[14px] p-3 transition hover:bg-[var(--arbor-paper-deep)]"
                      style={{ border: "1px solid var(--arbor-rule)", minHeight: 44 }}
                    >
                      <div className="flex items-center gap-2.5 mb-2">
                        <Icon className="w-[18px] h-[18px] flex-shrink-0" style={{ color: PASTEL[dv.tone].ink }} />
                        <span className="flex-1 text-[13.5px] font-bold" style={{ color: "var(--arbor-ink)" }}>{dom.label}</span>
                        <span className="text-[11px] font-extrabold" style={{ color: "var(--arbor-muted)" }}>{s.checked}/{s.total} {t("ms.domainOf")}</span>
                        <ChevEnd className="w-4 h-4 flex-shrink-0" style={{ color: "var(--arbor-muted)" }} />
                      </div>
                      <ProgressBar value={s.checked} total={s.total} tone={dv.tone} height={9} />
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            /* ── Domain drill-in: back-link + header + banded checklist + hints ── */
            (() => {
              const dom = domainOptions.find((d) => d.id === openDomain) || domainOptions[0];
              const s = domainStats[dom.id] || { total: 0, checked: 0 };
              const dv = domainVisual(dom.id);
              const Icon = dv.icon;
              return (
                <div className={`${cardCls} p-6 space-y-4 text-xs`}>
                  <button
                    type="button"
                    onClick={() => setOpenDomain(null)}
                    className="inline-flex items-center gap-1.5 text-[12px] font-extrabold rounded-lg px-2.5 py-1.5 transition"
                    style={{ color: "var(--arbor-green-ink)", background: "var(--arbor-green-soft)" }}
                  >
                    <ChevStart className="w-4 h-4" /> {t("ms.allDomains")}
                  </button>

                  <div className="flex items-center gap-3">
                    <span className="rounded-[13px] flex items-center justify-center flex-shrink-0" style={{ width: 46, height: 46, background: PASTEL[dv.tone].soft }}>
                      <Icon className="w-6 h-6" style={{ color: PASTEL[dv.tone].ink }} />
                    </span>
                    <div className="flex-1">
                      <div className="text-[17px] font-extrabold" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}>{dom.label}</div>
                      <div className="text-[11px] font-bold" style={{ color: "var(--arbor-muted)" }}>{s.checked}/{s.total} {t("ms.domainOf")}</div>
                    </div>
                  </div>
                  <ProgressBar value={s.checked} total={s.total} tone={dv.tone} height={9} />

                  {renderDomainChecklist(dom.id)}

                  {/* Loop-2: assign a playful activity for this domain → kid quest. */}
                  <button
                    type="button"
                    onClick={() => assignActivity(dom.id, dom.label)}
                    className="w-full flex items-center gap-2.5 rounded-[13px] p-3 text-start transition"
                    style={{ background: "var(--arbor-peach-soft)", border: "1px solid rgba(217,118,63,0.25)", minHeight: 44 }}
                  >
                    <Icon name="sports_esports" size={18} style={{ color: "var(--arbor-peach-ink)" }} />
                    <div className="flex-1">
                      <div className="text-[13px] font-extrabold" style={{ color: "var(--arbor-peach-ink)" }}>{t("ms.assignActivity")}</div>
                      <div className="text-[11px] leading-snug" style={{ color: "var(--arbor-muted)" }}>{t("ms.assignHint", { name: firstName || childProfile.name })}</div>
                    </div>
                    <ChevEnd className="w-4 h-4 flex-shrink-0" style={{ color: "var(--arbor-peach-ink)" }} />
                  </button>

                  {/* Connective-tissue hint: marking skills feeds Map/Academy/Care. */}
                  <div className="flex items-start gap-2.5 rounded-[13px] p-3.5" style={{ background: "var(--arbor-sky-soft)" }}>
                    <Icon name="sync" size={18} className="mt-0.5" style={{ color: "var(--arbor-sky-ink)" }} />
                    <span className="text-[12px] leading-relaxed font-semibold" style={{ color: "var(--arbor-sky-ink)" }}>{t("ms.mapHint")}</span>
                  </div>
                </div>
              );
            })()
          )
        }
      />

      {/* Add custom milestone */}
      <div className={`${cardCls} p-5`}>
        {!showAdd ? (
          <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 text-sm font-bold transition" style={{ color: "var(--arbor-green-ink)" }}>
            <Icon name="add" size={16} /> {t("ms.addMilestone")}
          </button>
        ) : (
          <form onSubmit={submitCustom} className="flex flex-col sm:flex-row gap-2 items-stretch">
            <input autoFocus value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder={t("ms.newPlaceholder")} className="flex-1 rounded-xl px-3 py-2 text-sm focus:outline-none" style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule-strong)", color: "var(--arbor-ink)" }} />
            <select value={newDomain} onChange={(e) => setNewDomain(e.target.value as DevelopmentalDomainId)} className="rounded-xl px-3 py-2 text-xs" style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule-strong)", color: "var(--arbor-ink)" }}>
              {domainOptions.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
            </select>
            <button type="submit" className="text-white font-extrabold text-xs px-4 py-2 rounded-xl transition" style={{ background: "var(--arbor-clay)" }}>{t("ms.add")}</button>
            <button type="button" onClick={() => setShowAdd(false)} className="text-xs px-2" style={{ color: "var(--arbor-muted)" }}>{t("ms.cancel")}</button>
          </form>
        )}
      </div>

      {/* Interactive AI scaffolding gap analyzer */}
      <div className="rounded-2xl p-6 space-y-4" style={{ background: "linear-gradient(120deg,var(--arbor-paper-tinted),var(--arbor-lav-soft))", border: "1px solid var(--arbor-rule)" }}>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h4 className="text-base font-extrabold flex items-center gap-1.5" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}>
              <Icon name="auto_awesome" size={16} style={{ color: "var(--arbor-green-ink)" }} /> {t("ms.nurtureNext")}
            </h4>
            <p className="text-xs mt-0.5" style={{ color: "var(--arbor-muted)" }}>{t("ms.nurtureDesc")}</p>
          </div>
          <button type="button" onClick={handleGenerateMilestoneScaffold} disabled={isAnalyzingMilestones} className="text-white text-xs font-extrabold px-4 py-2.5 rounded-xl transition flex items-center justify-center gap-2 cursor-pointer ms-auto sm:ms-0 disabled:opacity-60" style={{ background: "var(--arbor-gradient-primary)" }}>
            {isAnalyzingMilestones ? (<><Icon name="progress_activity" size={14} className="animate-spin" /> {t("ms.findingSteps")}</>) : (<><Icon name="psychology" size={15} /> {t("ms.findSteps")}</>)}
          </button>
        </div>

        {milestoneAnalysisOfGaps ? (
          <div className="p-4 rounded-xl text-xs leading-relaxed space-y-3 select-text bg-white" style={{ border: "1px solid var(--arbor-rule)" }}>
            <ExplainAnswerBlock answer={milestoneAnalysisOfGaps} tryTodayLabel={t("explain.tryToday")} className="space-y-2" />
            {/* GP-23 — "Find next steps" produced markdown whose only exit was
                "Discuss in Coach": nothing said where it came from, and the
                parent could not keep it. Same shared cluster as the inline
                explainer: why-line → Trust Center → one-tap Keep, with the
                coach hand-off demoted to a surface-specific extra. */}
            <ContentActionBar
              variant="inline"
              surface="milestone-gaps"
              why={t("elev.waveR.ms.gaps.why")}
              trustLink
              className="pt-2.5"
              actions={[
                { verb: "save", label: t("elev.waveR.ms.gaps.keep"), icon: "bookmark_add", onClick: () => keepBehaviorInsight(gapsText) },
              ]}
              extras={[
                { id: "coach", label: t("ms.discussCoach"), icon: "forum", onClick: () => seedCoach({ prompt: t("seed.milestoneGaps", { analysis: gapsText }), lens: "Vygotsky's Scaffolding", source: "milestones-gap" }) },
              ]}
            />
          </div>
        ) : (
          <div className="p-4 rounded-xl text-center text-xs bg-white" style={{ border: "1px solid var(--arbor-rule)", color: "var(--arbor-muted)" }}>
            {t("ms.runHint")}
          </div>
        )}
      </div>

      {/* UND-3 — "Gentle watch points" is DERIVED, never fabricated: real domain
          names + counts from the canonical useMonitoring derivation (clinical
          firewall: counts only, no severity/verdict language). Neutral line when
          nothing is in the not-seen column; hidden entirely when there is also
          no corrected-age note to carry. */}
      {(watchPoints.length > 0 || corrected.applied) && (
        <div data-testid="ms-watch-points" className="p-5 rounded-2xl flex items-start gap-4 text-xs" style={{ background: "var(--arbor-yellow-soft)" }}>
          <Icon name="visibility" size={20} className="mt-0.5" style={{ color: "var(--arbor-yellow-ink)" }} />
          <div className="space-y-1 leading-relaxed">
            <strong className="text-sm block" style={{ color: "var(--arbor-ink)" }}>{t("ms.watchPoints")}</strong>
            <p style={{ color: "var(--arbor-muted)" }}>
              {corrected.applied && (
                <>{t("ms.watch.corrected", { name: firstName || t("ms.watch.childFallback"), corrected: Math.round(corrected.correctedMonths), chrono: corrected.chronologicalMonths })} </>
              )}
              {watchPoints.length > 0 ? (
                <>
                  {watchPoints
                    .map((w) =>
                      w.count === 1
                        ? t("ms.watch.area.one", { area: t(`screen.domain.${w.domain}`).toLowerCase() })
                        : t("ms.watch.area.many", { n: w.count, area: t(`screen.domain.${w.domain}`).toLowerCase() }),
                    )
                    .join(" ")}{" "}
                  {t("ms.watch.close")}
                </>
              ) : (
                t("ms.watch.none")
              )}
            </p>
            {/* GP-22 — the highest-stakes why-line on this surface: it says a
                count of things not marked yet. It now says what it was built
                from, and opens the Trust Center. */}
            <div className="pt-1">
              <ContentWhyLine why={t("elev.waveR.why.watch")} trustLink surface="milestone-watch" />
            </div>
          </div>
        </div>
      )}

      {/* GP-31 — the keepsake editor. One sheet for the whole list; a null
          milestone keeps it closed. Save/remove write through the pure
          helpers in lib/firstsKeepsake and persist to this child's own
          sweepable store — the milestone record itself is never touched. */}
      <FirstKeepsakeSheet
        open={Boolean(openKeepsake)}
        milestoneId={openKeepsake?.id ?? ""}
        milestoneTitle={openKeepsake?.title ?? ""}
        childId={childProfile.id}
        childName={firstName}
        keepsake={openKeepsake ? keepsakes[openKeepsake.id] ?? null : null}
        onSave={saveKeepsake}
        onRemove={() => { if (openKeepsake) dropKeepsake(openKeepsake.id); }}
        onClose={() => setKeepsakeFor(null)}
      />

      {/* W5 celebration chain — the FULL moment layered over the tab on a fresh
          "yes" (never on uncheck), on top of the confetti burst. The card body
          is the shared E7 CelebrationMoment (parent register, factual copy,
          parent-mediated ShareButton, reduced-motion handled internally); the
          scrim click and Escape both dismiss. Dedupe: once per milestone id
          ever + ≤1/session, both enforced in observeMilestone before opening. */}
      {celebratingId && createPortal(
        <div className="arbor-app arbor-parent" style={{ display: "contents" }}>
        <div
          ref={dialogRef}
          tabIndex={-1}
          data-arbor-dialog-layer
          role="dialog"
          aria-modal="true"
          aria-label={t("elev.celebrate.titleGeneric")}
          data-testid="milestone-celebration-overlay"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-5"
          onClick={onBackdropClick}
        >
          <div className="w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <CelebrationMoment
              firstName={firstName || undefined}
              surface="milestones"
              onDismiss={requestClose}
              testId="milestone-celebration"
            />
          </div>
        </div>
        </div>, document.body
      )}
    </motion.div>
  );
}

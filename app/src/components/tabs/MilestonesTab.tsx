import React, { useEffect, useMemo, useRef, useState } from "react";
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
import { cardCls, Split } from "../ui/kit";
import { authHeaders, getAiLanguage } from "../../lib/api";
import { DOMAIN_REFERENCES } from "../../lib/milestoneReferences";
import { noticedMilestoneCounts } from "../../lib/record/counts";
import { MILESTONE_AGE_BANDS, ageWindowMilestones, bandForAgeMonths, comparisonAgeMonths, correctedAge, explainMilestonePrompt, milestoneAgeGroupText, milestoneAgeWindow, milestoneBandLabel, milestoneText } from "../../lib/milestoneData";
// UND-7 — fail-closed gate for the governed milestone example-media slot
// (missing reviewer/rightsRef → never renders; ships with zero media entries).
import { isRenderableMilestoneMedia } from "../../content/governance";
// B0 — months-precise age spine
import { ageLabelForMonths, ageYearsFromProfile } from "../../lib/childAge";
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
// components/milestones; the record's pure helpers live in lib/firstsKeepsake
// (beside lib/firsts, which owns the CELEBRATION of a first).
// B-GROWTH-10 — persistence is the registered `keepsakes` subcollection.
import FirstKeepsakeSheet from "../milestones/FirstKeepsakeSheet";
import {
  keepsakeDoc, keepsakeMapFromDocs, migrateLocalKeepsakes, upsertKeepsake,
  type KeepsakeDoc, type KeepsakeDraft,
} from "../../lib/firstsKeepsake";
import { useChildCollection } from "../../hooks/useChildCollection";
import { DEVELOPMENTAL_DOMAIN_IDS, domainLabel as registryDomainLabel, primaryDomainLabel } from "../../lib/domains/registry";
import { DevelopmentalDomainId, Milestone } from "../../types";
import { ageMonthsOf } from "../../lib/age/forChild";
import { localDay, type ObserveStatus } from "../../lib/milestones/observe";
import { milestoneAgeLine } from "../../lib/milestoneAgeLine";
import { selectNextMilestonesByShelf, shelfOfMilestone } from "../../lib/milestones/selectByShelf";
import { groupMilestonesByShelf, matchesMilestoneQuery, noticedByShelf, shelfBands } from "../../lib/milestones/shelfMap";
import { SHELF_IDS, shelfLabel, type ShelfId } from "../../lib/shelves/registry";
import NoticeCard, { NoticeAnswers } from "../loop/NoticeCard";
import { practiceText } from "../loop/PracticeCard";
import { PRACTICES } from "../../content/practices";
import { ShelfGlyph } from "../loop/ShelfGlyph";

/** NEXTLEVEL critic r1: "Born early?" leads the rail only while correction
 *  applies (under ~24 months, or a gestation is set); otherwise the same
 *  control waits in a quiet disclosure — reachable, never the fold's action. */
function BornEarlyFrame({ inline, summary, children }: { inline: boolean; summary: string; children: React.ReactNode }) {
  return inline ? (
    <div className={`${cardCls} min-w-0 p-4`}>{children}</div>
  ) : (
    <details data-testid="ms-born-early-disclosure" className={`${cardCls} min-w-0 px-4 py-1`}>
      <summary className="flex min-h-11 cursor-pointer items-center t-sm font-bold" style={{ color: "var(--arbor-muted)" }}>{summary}</summary>
      <div className="pb-3 pt-1">{children}</div>
    </details>
  );
}

/** NEXTLEVEL critic r1 (B-NEXTLEVEL-NEW-1i/1j) — pure: the newest milestone
 *  the parent marked "yes" that carries its own date (observationUpdatedAt).
 *  An undated tick never leads — the sentence quotes a date, so it needs one. */
export function latestNoticedMilestone<M extends { checked: boolean; observationUpdatedAt?: string }>(
  milestones: readonly M[],
): { milestone: M; at: string } | null {
  let best: { milestone: M; at: string; t: number } | null = null;
  for (const m of milestones) {
    if (!m.checked || !m.observationUpdatedAt) continue;
    const t = Date.parse(m.observationUpdatedAt);
    if (!Number.isFinite(t)) continue;
    if (!best || t > best.t) best = { milestone: m, at: m.observationUpdatedAt, t };
  }
  return best ? { milestone: best.milestone, at: best.at } : null;
}

function celebrate() {
  // ONE capped, brand-coloured, reduced-motion-safe burst — the Law 7 caps
  // (≤12 particles / ≤800 ms) and the reduced-motion gate live in lib/celebrate.
  fireCelebration({ kind: "milestone" });
}

export default function MilestonesTab() {
  const {
    milestones,
    setMilestoneObservation,
    restoreMilestone,
    addCustomMilestone,
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
  /* B-GROWTH-26 — the catalogue's domain list and every domain NAME come from
     the one domain registry (lib/domains/registry.ts, EN + HE in
     lib/i18nElevation/domains.ts): the same names Growth and Science print.
     No framework.json label, no screen.domain.* private dictionary. */
  const domainOptions = useMemo(() => DEVELOPMENTAL_DOMAIN_IDS.map((id) => ({ id })), []);
  // B-SHELL-28: one label per map row — the primary domain, never the cross-tag.
  const domainLabel = (id: string) => primaryDomainLabel("developmental", id, t);
  // AI-17: the explain route's TWO structured fields are held as they arrive.
  // They used to be glued into a markdown string here and re-parsed by a
  // markdown renderer downstream, which threw the structure away.
  const [explanations, setExplanations] = useState<Record<string, ExplainAnswer>>({});
  const [explaining, setExplaining] = useState<Record<string, boolean>>({});
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

  // GP-31 / B-GROWTH-10 — the keepsakes this child's parent has written, in
  // the registered `keepsakes` subcollection (doc id = milestone id): synced
  // across devices, in the GDPR export, erased with the child. The
  // collection is per child, so one child's notes never appear under a
  // sibling's milestones.
  const keepsakeCol = useChildCollection<KeepsakeDoc>(childProfile.id, "keepsakes");
  const keepsakes = useMemo(() => keepsakeMapFromDocs(keepsakeCol.items), [keepsakeCol.items]);
  const [keepsakeFor, setKeepsakeFor] = useState<string | null>(null);
  // One-time migration of the legacy device-local map
  // (`arbor.firstsKeepsakes.<childId>`): once per child per mount, and never
  // in the first commit after a child switch, when the collection still
  // holds the PREVIOUS child's documents.
  const keepsakeChildSeen = useRef(childProfile.id);
  const keepsakeMigratedFor = useRef<string | null>(null);
  useEffect(() => {
    const switched = keepsakeChildSeen.current !== childProfile.id;
    keepsakeChildSeen.current = childProfile.id;
    if (switched || !keepsakeCol.loaded || keepsakeMigratedFor.current === childProfile.id) return;
    keepsakeMigratedFor.current = childProfile.id;
    migrateLocalKeepsakes(childProfile.id, keepsakes, keepsakeCol.upsert).catch(() => {
      keepsakeMigratedFor.current = null; // the local key stays; the next load retries
    });
  }, [childProfile.id, keepsakeCol.loaded, keepsakeCol.items, keepsakeCol.upsert, keepsakes]);
  const saveKeepsake = (draft: KeepsakeDraft) => {
    const next = upsertKeepsake(keepsakes, draft, new Date().toISOString());
    void keepsakeCol.upsert(keepsakeDoc(next[draft.milestoneId]));
  };
  const dropKeepsake = (milestoneId: string) => {
    void keepsakeCol.remove(milestoneId);
  };
  const openKeepsake = keepsakeFor ? milestones.find((m) => m.id === keepsakeFor) ?? null : null;

  /** One place decides what a mark does. Celebration fires ONLY on a fresh
   *  "yes" (never on uncheck / not_yet / not_sure): confetti stays the light
   *  layer, and the FULL CelebrationMoment (parent-mediated share included)
   *  layers at most once per milestone id ever (arbor.celebrate.seen.{childId})
   *  and at most once per session — the card's own session guard is checked
   *  BEFORE opening so the overlay never mounts around an empty card. */
  const observeMilestone = (item: Milestone, status: ObserveStatus) => {
    // B-LOOP-04: the one write seam (lib/milestones/observe via the context),
    // shared with Today's and the Journal's Notice cards.
    setMilestoneObservation(item.id, status);
    if (status !== "yes" || item.checked) return;
    // P5 critic r1 (framer ruling 3): the confetti burst fires ONCE per
    // milestone id ever (a completion moment, never a repeat reward); an Undo and a
    // second "Seen it" replay nothing.
    if (hasCelebrated(childProfile.id, item.id)) return;
    celebrate();
    if (celebrationSessionAvailable()) {
      markCelebrated(childProfile.id, item.id);
      setCelebratingId(item.id);
    } else {
      markCelebrated(childProfile.id, item.id);
    }
  };

  // ── Corrected age (preterm) ──────────────────────────────────────────────
  // B0: prefer months-precise value from birthDate/ageMonths over the legacy
  // whole-year field so a 9-month-old isn't compared against the 0-month band.
  // P1-NEXTLEVEL critic r2 (Law 8): every catalogue string on this tab resolves
  // its Hebrew slash forms from the profile gender, as #/development does.
  const msGender = { gender: childProfile.gender };
  const chronoMonths = ageMonthsOf(childProfile);
  const gestationalWeeks = childProfile.preterm?.gestationalWeeks;
  const corrected = correctedAge(chronoMonths, gestationalWeeks);
  const comparisonMonths = comparisonAgeMonths(chronoMonths, gestationalWeeks);
  const currentBand = bandForAgeMonths(comparisonMonths);
  // GP-08: every count on this surface is over the child's AGE WINDOW (current
  // corrected band + one earlier — the shared lib/milestoneData helper), never
  // the whole 0–6y catalogue ("0 of 133" / "0/28" on day 0).
  const windowMilestones = useMemo(() => ageWindowMilestones(milestones, comparisonMonths), [milestones, comparisonMonths]);
  // NEXTLEVEL critic r1 (P0, B-GROWTH-35): the headline and the domain rows
  // count what the parent NOTICED, unwindowed — the same helper Growth, Care
  // and Profile read (lib/pulse noticedMilestoneCounts), so "0 noticed" here
  // can never sit beside "5 noticed" on #/development. The age window only
  // chooses which OPEN items are suggested.
  const recordCounts = useMemo(() => noticedMilestoneCounts(milestones), [milestones]);
  // NEXTLEVEL critic r1 (B-NEXTLEVEL-NEW-1i/1j): the parent's last first leads
  // the summary — the newest milestone marked "yes" that carries its date.
  const latestNoticed = useMemo(() => latestNoticedMilestone(milestones), [milestones]);
  // B-LOOP-05 — THE SHELF MAP. Every milestone sits on its parent shelf
  // (lib/shelves/registry); one Notice card per shelf from the shared
  // selector (never ahead of band, never a shelf answered today); a card the
  // parent just answered stays in place for the session as its receipt; the
  // only number is "{n} noticed" per shelf (their sum is recordCounts.noticed,
  // the count Care and Growth read).
  const noticeNow = useMemo(() => new Date(), [milestones]);
  const shelfItems = useMemo(() => groupMilestonesByShelf(milestones), [milestones]);
  const windowShelfItems = useMemo(() => groupMilestonesByShelf(windowMilestones), [windowMilestones]);
  const shelfCounts = useMemo(() => noticedByShelf(milestones), [milestones]);
  const noticedShelves = SHELF_IDS.filter((id) => shelfCounts[id] > 0).length;
  const noticePicks = useMemo(
    () => selectNextMilestonesByShelf(milestones, comparisonMonths, { perShelf: 1, total: SHELF_IDS.length, now: noticeNow }),
    [milestones, comparisonMonths, noticeNow],
  );
  const [heldNotice, setHeldNotice] = useState<Partial<Record<ShelfId, string>>>({});
  // Critic r3 (P1): the document BEFORE the answer, so Undo restores it byte-equal.
  const [beforeAnswer, setBeforeAnswer] = useState<Partial<Record<ShelfId, Milestone>>>({});
  const [changingLatest, setChangingLatest] = useState(false);
  const noticeFor = (shelf: ShelfId): Milestone | undefined => {
    const held = heldNotice[shelf];
    if (held) return milestones.find((m) => m.id === held);
    return noticePicks.find((p) => p.shelf === shelf)?.milestone;
  };
  const firstNoticeShelf = SHELF_IDS.find((id) => noticeFor(id));
  const [openShelves, setOpenShelves] = useState<Partial<Record<ShelfId, boolean>>>({});
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  // P5 critic r1 (design P0): the map in ACTION order — shelves holding a
  // Notice card first, then the shelves with only their door; a shelf with no
  // catalogue row (Sleep, Family) closes the map as a quiet row with its
  // shelf-level practice (B-LOOP-08 follow-up) inside the child's window.
  const mapShelves: ShelfId[] = [
    ...SHELF_IDS.filter((id) => noticeFor(id)),
    ...SHELF_IDS.filter((id) => !noticeFor(id) && shelfItems[id].length > 0),
  ];
  const quietWindow = milestoneAgeWindow(comparisonMonths);
  const quietShelves = SHELF_IDS.filter((id) => shelfItems[id].length === 0).map((shelf) => ({
    shelf,
    practice:
      PRACTICES.find((p) => {
        if (p.milestoneId !== null || p.shelf !== shelf) return false;
        const band = bandForAgeMonths(p.ageMonths).months;
        return band <= quietWindow.currentBandMonths && band >= quietWindow.earlierBandMonths;
      }) ?? null,
  }));

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
          // Pre-review R05: corrected age, no "typical age" ask, the sourced
          // sentence as the only age text the model may repeat.
          details: explainMilestonePrompt(item.title, comparisonMonths, milestoneAgeLine(item, t)),
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
  const [showAdd, setShowAdd] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDomain, setNewDomain] = useState<DevelopmentalDomainId>(domainOptions[0].id as DevelopmentalDomainId);

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
      style={item.checked ? { background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule-strong)" } : { background: "var(--arbor-paper-elevated)", border: "1px solid var(--arbor-rule)" }}
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-6 w-6 flex-none items-center justify-center rounded-full" style={{ background: item.checked ? "var(--arbor-green-soft)" : "var(--arbor-paper-deep)", color: item.checked ? "var(--arbor-green-ink)" : "var(--arbor-muted)" }}><Icon name={item.checked ? "check" : item.observationStatus === "not_sure" ? "question_mark" : "remove"} size={14} /></span>
        <div className="space-y-0.5 flex-1">
          {/* B-GROWTH-11 — catalogue text resolves by stable id in the page
              language (the stored doc carries the English seed); a parent's
              own milestone keeps the parent's words. */}
          <span className="font-bold block" style={{ color: item.checked ? "var(--arbor-green-ink)" : "var(--arbor-ink)" }}>{milestoneText(item, "title", t, msGender)}</span>
          <span className="text-[12px] block leading-relaxed" style={{ color: "var(--arbor-muted)" }}>{milestoneText(item, "desc", t, msGender)}</span>
          {item.skillLooksLike && (
            <span className="text-[12px] block leading-relaxed" style={{ color: "var(--arbor-muted)" }}>
              <span className="font-bold" style={{ color: "var(--arbor-green-ink)" }}>{t("ms.looksLike")} </span>
              {milestoneText(item, "looks", t, msGender)}
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
          {/* P5 critic r1 (P1-2): ONE answer grammar on the route — the Notice
              card's NoticeAnswers (yes · not_yet · not_sure, 44 px, "Seen it"
              outlined), never the old 11 px trio in another order. */}
          <NoticeAnswers
            selected={item.observationStatus ?? (item.checked ? "yes" : null)}
            onAnswer={(status) => observeMilestone(item, status)}
            ariaLabel={tGCare(uiLang, "elev.gcare.ms.observePrompt")}
            className="pt-2"
          />
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
            {item.custom && <span className="text-[11px] font-bold px-1.5 py-0.5 rounded" style={{ color: "var(--arbor-peach-ink)", background: "var(--arbor-peach-soft)" }}>{t("ms.custom")}</span>}
            {item.custom && (
              <button
                type="button"
                onClick={(e) => { e.preventDefault(); setConfirmDeleteId(null); setRenameDraft(item.title); setRenamingId(item.id); }}
                aria-label={t("aria.renameCustomMilestone")}
                className="min-h-11 text-[11px] transition"
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
                className="min-h-11 text-[11px] transition"
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
              className="min-h-11 text-[11px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1 transition"
              style={{ color: "var(--arbor-green-ink)", background: "var(--arbor-green-soft)" }}
            >
              {explaining[item.id] ? <Icon name="progress_activity" size={11} className="animate-spin" /> : <Icon name="menu_book" size={11} />}
              {explanations[item.id] || explainFailed[item.id] ? t("ms.hide") : t("ms.explain")}
            </button>
            {/* B-GROWTH-12 — ONE AI door per milestone: a keyed seed in the page
                language, no fixed lens (the /explain route above stays). */}
            <button
              type="button"
              data-testid="ms-ask-arbor"
              onClick={(e) => { e.preventDefault(); askAboutMilestone(item); }}
              className="min-h-11 text-[11px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1 transition"
              style={{ color: "var(--arbor-ink)", background: "var(--arbor-paper-deep)" }}
            >
              <Icon name="forum" size={11} />
              {t("ms.askArbor")}
            </button>
            {/* LL-A3 — one tap from a milestone to its "why this matters" read */}
            {(() => {
              const read = bestCardForDomain(LEARN_CARDS, item.domain, ageYearsFromProfile(childProfile));
              if (!read) return null;
              return (
                <button
                  type="button"
                  onClick={(e) => { e.preventDefault(); requestLearnRead({ cardId: read.id, source: "milestone" }); }}
                  className="min-h-11 text-[11px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1 transition"
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
                      className="min-h-11 text-[11px] font-bold"
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
              <button type="submit" className="min-h-11 text-white font-extrabold text-xs px-4 py-2 rounded-xl transition" style={{ background: "var(--arbor-clay)" }}>{t("ms.renameSave")}</button>
              <button type="button" onClick={() => setRenamingId(null)} className="min-h-11 text-xs px-2" style={{ color: "var(--arbor-muted)" }}>{t("ms.cancel")}</button>
            </form>
          )}
          {/* UND-8 — inline delete confirm row — no native window.confirm. */}
          {item.custom && confirmDeleteId === item.id && (
            <div className="flex flex-wrap items-center gap-2 pt-2">
              <span className="text-[11px] font-bold" style={{ color: "var(--arbor-ink)" }}>{t("ms.deleteConfirm")}</span>
              <button type="button" onClick={() => { deleteMilestone(item.id); setConfirmDeleteId(null); }} className="min-h-11 text-xs font-extrabold px-3 py-1.5 rounded-xl text-white" style={{ background: "var(--arbor-clay-deep)" }}>{t("ms.deleteYes")}</button>
              <button type="button" onClick={() => setConfirmDeleteId(null)} className="min-h-11 text-xs px-2" style={{ color: "var(--arbor-muted)" }}>{t("ms.cancel")}</button>
            </div>
          )}
        </div>
        {item.checked && (
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Memory portrait — a quiet reminder this is a moment in the child's record. */}
            <HeroAvatar size={28} animate={false} ring={false} className="flex-shrink-0" />
            <button type="button" onClick={(e) => { e.preventDefault(); celebrate(); }} title={t("elev.growthTruth.ms.celebrate")} className="min-h-11 transition" style={{ color: "var(--arbor-peach-ink)" }}>
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
                      { verb: "save", label: t("elev.waveR.ms.explain.keep"), icon: "bookmark_add", onClick: () => keepBehaviorInsight(`${milestoneText(item, "title", t, msGender)} — ${explainAnswerText(explanations[item.id], t("explain.tryToday"))}`) },
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

  /** B-LOOP-05 — one shelf behind its door: every band, earlier first. The
   *  child's band and the earlier ones answer through renderItem; a LATER
   *  band is titles only (a parent can read what comes next, never tick
   *  it). No per-band fraction anywhere. */
  const renderShelfBands = (shelf: ShelfId) => (
    <div className="space-y-3">
      {shelfBands(shelfItems[shelf], currentBand.months).map((band) => (
        <div key={band.months} data-testid="ms-shelf-band" data-band={band.months} className="space-y-2">
          <p className="t-sm font-semibold" style={{ color: band.current ? "var(--arbor-ink)" : "var(--arbor-muted)" }}>
            {band.months === -1 ? t("ms.custom") : milestoneBandLabel(band.months, t)}
            {band.current && <> · {t("ms.currentBand")}</>}
            {band.later && <> · {t("elev.loop.shelf.later")}</>}
          </p>
          {band.later ? (
            <ul className="space-y-1.5">
              {band.items.map((m) => (
                <li key={m.id} data-testid="ms-later-item" className="t-sm leading-snug" style={{ color: "var(--arbor-ink-soft)" }}>
                  {milestoneText(m, "title", t, msGender)}
                </li>
              ))}
            </ul>
          ) : (
            <div className="space-y-2">{band.items.filter((m) => m.id !== noticeFor(shelf)?.id).map(renderItem)}</div>
          )}
        </div>
      ))}
    </div>
  );

  /** B-LOOP-05 — word search across shelves: the page-language catalogue
   *  text and the stored words (a parent-added row keeps its own). */
  const searchText = (m: Milestone): string[] => [milestoneText(m, "title", t, msGender), milestoneText(m, "looks", t, msGender), m.title, m.skillLooksLike ?? ""];
  const searchHits = query.trim()
    ? SHELF_IDS.map((shelf) => ({ shelf, items: shelfItems[shelf].filter((m) => matchesMilestoneQuery(searchText(m), query)) })).filter((g) => g.items.length > 0)
    : null;
  const isLaterItem = (m: Milestone): boolean => typeof m.ageMonths === "number" && bandForAgeMonths(m.ageMonths).months > currentBand.months;

  // B-GROWTH-08: the honest destination. This used to seed an ENGLISH coach
  // prompt and a lens, then navigate to Daily Play (not Ask), so the prompt sat
  // unused — and the copy promised a quest in the child's world that was never
  // written. It now opens Daily Play and nothing else.
  // B-GROWTH-12 — the ONE "Ask Arbor about this" seed: title, the child's
  // first name and the milestone's age label, all in the page language.
  const askSeedName = (childProfile.name || "").split(" ")[0];
  const askAboutMilestone = (item: Milestone) =>
    seedCoach({
      prompt: t("seed.milestone.ask", {
        title: milestoneText(item, "title", t, msGender),
        name: askSeedName,
        band: typeof item.ageMonths === "number" ? ageLabelForMonths(item.ageMonths, t) : milestoneAgeGroupText(item, t),
      }),
      source: "milestone-ask",
    });
  const askAboutShelf = (shelf: ShelfId) =>
    seedCoach({
      prompt: t("seed.milestone.ask", {
        title: shelfLabel(shelf, t),
        name: askSeedName,
        band: ageLabelForMonths(comparisonMonths, t),
      }),
      source: "milestone-ask",
    });

  const openPlayIdeas = () => {
    setActiveTab("daily-play");
  };

  const firstName = (childProfile.name || "").split(" ")[0];
  const latestShelf = latestNoticed ? shelfOfMilestone(latestNoticed.milestone) : null;
  const latestShelfName = latestShelf ? shelfLabel(latestShelf, t) : latestNoticed ? domainLabel(latestNoticed.milestone.domain) : "";

  return (
    <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mx-auto w-full min-w-0 max-w-[1180px] space-y-5 sm:space-y-6">
      <div className="flex min-w-0 items-start gap-3.5 sm:items-center">
        {/* The child's memory portrait — modest, no comic frame in the parent register. */}
        <HeroAvatar size={52} mood="wave" animate={false} ring={false} className="flex-shrink-0" />
        <div className="min-w-0">
          <h1 className="text-2xl md:text-[2rem] leading-[1.1]" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}>{t("ms.title")}</h1>
          {latestNoticed ? (
            /* P5 critic r1 (design P0, stronger target 1): the one sentence that
               matters leads under the H1 — the parent's last first, dated. The
               four-line disclaimer moves to one muted line under the shelf map. */
            <p data-testid="ms-latest" className="mt-1.5 leading-snug" style={{ fontFamily: "var(--font-editorial)", fontSize: "var(--t-md)", color: "var(--arbor-ink-soft)" }}>
              {t("elev.ms.latest.lead", { name: firstName || t("ms.watch.childFallback") })}{" "}
              <bdi dir="auto">{milestoneText(latestNoticed.milestone, "title", t, msGender)}</bdi>
              <span data-testid="ms-latest-area" className="t-sm" style={{ fontFamily: "var(--font-sans)", color: "var(--arbor-muted)" }}> · {t("elev.ms.latest.area", { area: latestShelfName })} · {t("elev.ms.latest.when")} </span>
              <span data-testid="ms-latest-date" className="inline-flex items-center rounded-full px-2.5 py-0.5 t-sm font-semibold whitespace-nowrap" style={{ background: "var(--arbor-green-soft)", color: "var(--arbor-green-ink)", fontFamily: "var(--font-sans)" }}>
                <bdi>{new Date(latestNoticed.at).toLocaleDateString(uiLang === "he" ? "he-IL" : "en-GB", { day: "numeric", month: "short" })}</bdi>
              </span>
            </p>
          ) : (
            <p data-testid="ms-lede" className="t-sm mt-1.5 max-w-2xl" style={{ color: "var(--arbor-muted)" }}>{t("elev.loop.ms.lede")}</p>
          )}
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
      {/* Item 11 (IA-02): the surface contract reaches the DOM. `data-module`
          marks a top-level sibling module (what moduleBudget counts);
          `data-primary-move` marks the ONE control that performs the move
          surfaceContract.ts declares for this route. */}
      <div data-module="milestones-spine" style={{ display: "contents" }}>
      <Split
        ratio="minmax(300px,1fr) minmax(0,1.4fr)"
        className="md:[&>div]:!contents xl:[&>div]:!grid"
        left={
          <div className="min-w-0 space-y-4 xl:sticky xl:top-4 xl:space-y-5">
            {/* Development Map summary — count headline only, no verdict score. */}
            <div className={`${cardCls} min-w-0 p-4 sm:p-6`}>
              {/* NEXTLEVEL critic r1: one title per screen — the "DEVELOPMENT
                  MAP" eyebrow and the second disclaimer ("A snapshot, not a
                  score") are gone (the subtitle already says it). B-GROWTH-07:
                  the count stands alone as text, never a ring or a fraction. */}
              <div className="min-w-0" data-testid="ms-map-count">
                {latestNoticed && !changingLatest && (
                  <button
                    type="button"
                    data-testid="ms-latest-change"
                    onClick={() => setChangingLatest(true)}
                    className="inline-flex min-h-11 items-center t-sm font-semibold"
                    style={{ color: "var(--arbor-clay)" }}
                  >
                    {t("elev.loop.latest.change")}
                  </button>
                )}
                {/* Critic r3 (P1): correctable where it is read — "Not right?
                    Change" opens the ONE answer group for the latest milestone. */}
                {latestNoticed && changingLatest ? (
                  <div data-testid="ms-latest-change-answers">
                    <NoticeAnswers
                      onAnswer={(status) => { observeMilestone(latestNoticed.milestone, status); setChangingLatest(false); }}
                      ariaLabel={t("ms.observePrompt")}
                      className="mt-2"
                    />
                  </div>
                ) : null}
                <div className={latestNoticed ? "mt-1 t-sm" : "mt-1 t-2xl font-extrabold leading-tight"} style={latestNoticed ? { color: "var(--arbor-muted)" } : { fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}>
                  {recordCounts.noticed} {t("ms.domainOf")}
                </div>
              </div>

              {/* B1 — under-2 reassurance lead: name the current stage, no checklist framing. */}
              {comparisonMonths < 24 && (
                <div className="mt-4 rounded-xl p-3.5" style={{ background: "var(--arbor-green-soft)" }}>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[11px] uppercase font-extrabold tracking-wider" style={{ color: "var(--arbor-green-ink)" }}>{t("ms.rightNow")}</span>
                    <span className="text-lg" style={{ fontFamily: "var(--font-editorial)", color: "var(--arbor-ink)" }}>{milestoneBandLabel(currentBand.months, t)}</span>
                    {corrected.applied && (
                      <span className="text-[11px] font-extrabold uppercase tracking-wide px-1.5 py-0.5 rounded" style={{ color: "var(--arbor-green-ink)", background: "var(--arbor-paper-elevated)" }}>
                        {t("ms.correctedBadge")} · {corrected.correctedMonths}m
                      </span>
                    )}
                  </div>
                  <p className="text-[12px] leading-relaxed mt-1.5" style={{ color: "var(--arbor-ink)" }}>{t("ms.rightNowBody")}</p>
                </div>
              )}
            </div>


          </div>
        }
        right={
          <div data-testid="ms-shelf-map" className={`${cardCls} min-w-0 p-4 sm:p-6`}>
            <div className="flex items-center gap-2">
              <h2 className="min-w-0 flex-1 font-semibold leading-snug" style={{ fontFamily: "var(--font-display)", fontSize: "var(--t-lg)", color: "var(--arbor-ink)" }}>
                {t("elev.loop.shelfMap.title")}
              </h2>
              {/* P5 critic r1 (design P0): search is a 44 px icon in the map's
                  heading row that opens the field in place. */}
              <button
                type="button"
                data-testid="ms-search-open"
                aria-label={t("elev.loop.ms.search")}
                aria-expanded={searchOpen || !!query}
                onClick={() => setSearchOpen((v) => !v)}
                className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl"
                style={{ color: "var(--arbor-ink-soft)" }}
              >
                <Icon name="search" size={20} />
              </button>
            </div>
            {(searchOpen || !!query) && (
              <label className="field-pill mt-3 flex min-h-11 items-center gap-2 rounded-xl ps-3 pe-1">
                <Icon name="search" size={18} style={{ color: "var(--arbor-muted)" }} />
                <input
                  data-testid="ms-search"
                  type="search"
                  dir="auto"
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t("elev.loop.search.placeholder")}
                  aria-label={t("elev.loop.search.label")}
                  className="field-bare min-h-11 min-w-0 flex-1 bg-transparent t-base focus:outline-none"
                  style={{ color: "var(--arbor-ink)" }}
                />
                {query && (
                  <button type="button" onClick={() => setQuery("")} aria-label={t("elev.loop.search.clear")} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg" style={{ color: "var(--arbor-muted)" }}>
                    <Icon name="close" size={18} />
                  </button>
                )}
              </label>
            )}

            {searchHits ? (
              <div data-testid="ms-search-results" className="mt-4 space-y-4">
                {searchHits.length === 0 && (
                  <p className="t-sm" style={{ color: "var(--arbor-muted)" }}>{t("elev.loop.search.empty", { q: query.trim() })}</p>
                )}
                {searchHits.map((g) => (
                  <div key={g.shelf} className="space-y-2">
                    <p className="t-sm font-semibold" style={{ color: "var(--arbor-muted)" }}>{shelfLabel(g.shelf, t)}</p>
                    {g.items.map((m) =>
                      isLaterItem(m) ? (
                        <p key={m.id} data-testid="ms-search-later" className="t-sm leading-snug" style={{ color: "var(--arbor-ink-soft)" }}>
                          {milestoneText(m, "title", t, msGender)}
                        </p>
                      ) : (
                        renderItem(m)
                      ),
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-1">
                {/* P5 critic r1 (design P0): shelves in ACTION order — the
                    shelves holding a Notice card first, then the shelves with
                    only their door; the shelves with no catalogue row close
                    the map as quiet rows (framer ruling 2). */}
                {mapShelves.map((shelf, i) => {
                  const card = noticeFor(shelf);
                  const n = shelfCounts[shelf];
                  const open = Boolean(openShelves[shelf]);
                  return (
                    <section
                      key={shelf}
                      data-testid="ms-shelf"
                      data-shelf={shelf}
                      aria-labelledby={`ms-shelf-${shelf}`}
                      className="py-3"
                      style={i === 0 ? undefined : { borderTop: "1px solid var(--arbor-rule)" }}
                    >
                      <div className="flex items-center gap-3">
                        <ShelfGlyph shelf={shelf} size={36} />
                        <h3 id={`ms-shelf-${shelf}`} className="min-w-0 flex-1 font-semibold leading-tight" style={{ fontFamily: "var(--font-display)", fontSize: "var(--t-md)", color: "var(--arbor-ink)" }}>
                          {shelfLabel(shelf, t)}
                        </h3>
                        {n > 0 && (
                          <span data-testid="ms-shelf-count" className="t-sm whitespace-nowrap" style={{ color: "var(--arbor-muted)" }}>
                            {t(n === 1 ? "elev.loop.shelf.noticed.one" : "elev.loop.shelf.noticed", { n })}
                          </span>
                        )}
                      </div>
                      {card ? (
                        /* A ROW inside the map (no card in a card); the shelf is
                           named once by the header; the first shelf's answers
                           carry the route's one stamp. */
                        <NoticeCard
                          key={card.id}
                          milestone={card}
                          shelf={shelf}
                          gender={childProfile.gender}
                          childName={firstName}
                          variant="row"
                          hideShelf
                          answersAttrs={shelf === firstNoticeShelf ? { "data-primary-move": "notice-milestone" } : undefined}
                          onAnswer={(status) => {
                            setHeldNotice((p) => ({ ...p, [shelf]: card.id }));
                            setBeforeAnswer((p) => ({ ...p, [shelf]: card }));
                            observeMilestone(card, status);
                          }}
                          onUndo={() => {
                            const previous = beforeAnswer[shelf];
                            if (previous) restoreMilestone(previous);
                          }}
                          onWhen={(when) => setMilestoneObservation(card.id, "yes", { when })}
                          onKeepQuote={(note) => saveKeepsake({ milestoneId: card.id, note, noticedOn: localDay(new Date()) })}
                          onKeepPhoto={() => setKeepsakeFor(card.id)}
                        />
                      ) : windowShelfItems[shelf].length === 0 ? (
                        <p className="mt-2 t-sm" style={{ color: "var(--arbor-muted)" }}>{t("elev.loop.shelf.noneNow")}</p>
                      ) : null}
                      <button
                        type="button"
                        data-testid="ms-shelf-door"
                        aria-expanded={open}
                        onClick={() => setOpenShelves((p) => ({ ...p, [shelf]: !p[shelf] }))}
                        className="inline-flex min-h-11 items-center gap-1.5 t-sm font-semibold"
                        style={{ color: "var(--arbor-ink-soft)" }}
                      >
                        {t(open ? "elev.loop.shelf.doorClose" : "elev.loop.shelf.door")}
                        <Icon name="expand_more" size={18} style={{ transform: open ? "rotate(180deg)" : undefined }} />
                      </button>
                      {open && (
                        <div className="mt-2 space-y-3">
                          {renderShelfBands(shelf)}
                          <button
                            type="button"
                            data-testid="ms-play-ideas"
                            onClick={openPlayIdeas}
                            className="min-h-11 w-full flex items-center gap-2.5 rounded-xl p-3 text-start transition"
                            style={{ background: "var(--arbor-paper)", border: "1px solid var(--arbor-rule)" }}
                          >
                            <Icon name="sports_esports" size={18} style={{ color: "var(--arbor-ink-soft)" }} />
                            <span className="flex-1 t-base font-semibold" style={{ color: "var(--arbor-ink)" }}>
                              {t("ms.playIdeas", { area: shelfLabel(shelf, t) })}
                            </span>
                          </button>
                          <button
                            type="button"
                            data-testid="ms-map-ask-arbor"
                            onClick={() => askAboutShelf(shelf)}
                            className="min-h-11 inline-flex items-center gap-1.5 t-sm font-semibold"
                            style={{ color: "var(--arbor-ink)" }}
                          >
                            <Icon name="forum" size={16} />
                            {t("ms.askArbor")}
                          </button>
                        </div>
                      )}
                    </section>
                  );
                })}
                {/* Framer ruling 2: a shelf with no catalogue row (Sleep, Family)
                    never says "No milestones": it shows its shelf-level practice
                    as one thing to try, and no door; with none for this age the
                    shelves fold into ONE quiet line. */}
                {quietShelves.length > 0 && (
                  <div data-testid="ms-quiet-shelves" className="space-y-2 pt-3" style={{ borderTop: "1px solid var(--arbor-rule)" }}>
                    {quietShelves.filter((q) => q.practice).map((q) => (
                      <div key={q.shelf} data-testid="ms-shelf-try" data-shelf={q.shelf} className="flex items-start gap-3">
                        <ShelfGlyph shelf={q.shelf} size={36} />
                        <p className="min-w-0 flex-1 t-sm leading-snug" style={{ color: "var(--arbor-ink-soft)" }}>
                          <span className="font-semibold" style={{ color: "var(--arbor-ink)" }}>{shelfLabel(q.shelf, t)}</span>
                          {" · "}{t("elev.loop.ms.tryLabel")}: {q.practice ? practiceText(q.practice, "do", uiLang === "he" ? "he" : "en", childProfile.gender) : ""}
                        </p>
                      </div>
                    ))}
                    {quietShelves.some((q) => !q.practice) && (
                      <p data-testid="ms-shelf-none" className="t-sm" style={{ color: "var(--arbor-muted)" }}>
                        {t("elev.loop.ms.quietNone", { shelves: quietShelves.filter((q) => !q.practice).map((q) => shelfLabel(q.shelf, t)).join(" · ") })}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
            <p data-testid="ms-footer" className="mt-3 t-sm" style={{ color: "var(--arbor-muted)" }}>{t("elev.loop.ms.footer")}</p>
          </div>
        }
      />

      </div>

      {/* P5 critic r1 (P1-1): Born early sits AFTER the shelf map at every
          width (the contract's disclosure), never ahead of the one move. */}
            <BornEarlyFrame inline={comparisonMonths < 24 || !!gestationalWeeks} summary={t("ms.bornEarly")}>
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
                    className="text-xs font-bold px-3 py-2 min-h-11 rounded-xl transition self-start whitespace-nowrap"
                    style={{ color: "var(--arbor-green-ink)", background: "var(--arbor-green-soft)", border: "1px solid var(--arbor-rule-strong)" }}
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
                      className="w-24 min-h-11 rounded-xl px-3 py-2 text-sm focus:outline-none"
                      style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule-strong)", color: "var(--arbor-ink)" }}
                    />
                  </label>
                  <div className="flex flex-wrap items-stretch gap-2">
                    <button type="submit" disabled={savingGestation} className="min-h-11 font-extrabold text-xs px-4 py-2 rounded-xl transition disabled:opacity-60" style={{ background: "var(--arbor-clay)", color: "var(--arbor-on-accent)" }}>
                      {savingGestation ? <Icon name="progress_activity" size={14} className="animate-spin" /> : t("ms.gestationSave")}
                    </button>
                    <button type="button" disabled={savingGestation} onClick={() => saveGestation(null)} className="min-h-11 text-xs px-3 py-2 rounded-xl" style={{ color: "var(--arbor-muted)", border: "1px solid var(--arbor-rule)" }}>{t("ms.gestationClear")}</button>
                    <button type="button" onClick={() => setShowGestation(false)} className="min-h-11 text-xs px-2" style={{ color: "var(--arbor-muted)" }}>{t("ms.cancel")}</button>
                  </div>
                </form>
              )}
            </BornEarlyFrame>

      {/* Add custom milestone */}
      <div data-module="milestones-custom" className={`${cardCls} p-5`}>
        {!showAdd ? (
          <button onClick={() => setShowAdd(true)} className="touch-target -mx-2 gap-2 px-2 text-sm font-bold transition" style={{ color: "var(--arbor-green-ink)" }}>
            <Icon name="add" size={16} /> {t("ms.addMilestone")}
          </button>
        ) : (
          <form onSubmit={submitCustom} className="flex flex-col sm:flex-row gap-2 items-stretch">
            <input autoFocus value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder={t("ms.newPlaceholder")} className="flex-1 rounded-xl px-3 py-2 text-sm focus:outline-none" style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule-strong)", color: "var(--arbor-ink)" }} />
            <select value={newDomain} onChange={(e) => setNewDomain(e.target.value as DevelopmentalDomainId)} className="rounded-xl px-3 py-2 text-xs" style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule-strong)", color: "var(--arbor-ink)" }}>
              {domainOptions.map((d) => <option key={d.id} value={d.id}>{domainLabel(d.id)}</option>)}
            </select>
            <button type="submit" className="text-white font-extrabold text-xs px-4 py-2 min-h-11 rounded-xl transition" style={{ background: "var(--arbor-clay)" }}>{t("ms.add")}</button>
            <button type="button" onClick={() => setShowAdd(false)} className="touch-target px-2 text-xs" style={{ color: "var(--arbor-muted)" }}>{t("ms.cancel")}</button>
          </form>
        )}
      </div>

      {/* B-GROWTH-12: the "What to nurture next" analyzer (a second AI door
          with a fixed "Vygotsky's Scaffolding" lens) is gone — each milestone
          row and the Map's area pane carry the ONE door, "Ask Arbor about this". */}

      {/* UND-3 — "Gentle watch points" is DERIVED, never fabricated: real domain
          names + counts from the canonical useMonitoring derivation (clinical
          firewall: counts only, no severity/verdict language). Neutral line when
          nothing is in the not-seen column; hidden entirely when there is also
          no corrected-age note to carry. */}
      {(watchPoints.length > 0 || corrected.applied) && (
        // B-GROWTH-09: paper surface + muted ink — the Screening monitoring
        // card's treatment. The yellow wash was a chromatic verdict.
        <div data-testid="ms-watch-points" className="p-5 rounded-2xl flex items-start gap-4 text-xs" style={{ background: "var(--arbor-paper-deep)" }}>
          <Icon name="visibility" size={20} className="mt-0.5" style={{ color: "var(--arbor-muted)" }} />
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
                        ? t("ms.watch.area.one", { area: registryDomainLabel("screen", w.domain, t).toLowerCase() })
                        : t("ms.watch.area.many", { n: w.count, area: registryDomainLabel("screen", w.domain, t).toLowerCase() }),
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
        milestoneTitle={openKeepsake ? milestoneText(openKeepsake, "title", t, msGender) : ""}
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

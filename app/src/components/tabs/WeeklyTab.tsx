import React, { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import Icon from "../ui/Icon";
import { useArbor } from "../../context/ArborContext";
import { useAuth } from "../../context/AuthContext";
import { useLanguage } from "../../context/LanguageContext";
import { MarkdownBlock } from "../ui/MarkdownBlock";
import { Skeleton } from "../ui/Skeleton";
import { PageHeader, SectionCard, cardCls, IconBadge } from "../ui/kit";
import { HeroAvatar } from "../ui/HeroAvatar";
import { useDevScore } from "../../hooks/useDevScore";
import { useWeeklyRecap, topMomentDisplay, type WeeklyReport } from "../../hooks/useWeeklyRecap";
import { behaviorTypeLabel } from "../../content/behaviorTaxonomy";
import { rankLearnCards } from "../../learn/learnLibrary";
import { LEARN_CARDS } from "../../learn/learnCards";
import { ageYearsFromProfile } from "../../lib/childAge";
import { track } from "../../lib/analytics";
import RecapStoryCards from "../weekly/RecapStoryCards";
import QuickLogModal from "../overview/QuickLogModal";
import { rcString } from "../weekly/recapStrings";
import { weeklyChipIds, isEmptyCurrentWeek } from "../weekly/weeklySelection";
import { fetchDigestEmailStatus, readEmailOptIn, writeEmailOptIn, type DigestEmailStatus } from "../weekly/recapEmail";
import type { WeeklyDigest } from "../../lib/api";

/**
 * WeeklyTab — the weekly report surface. W2 2.1 hoisted ALL generation state
 * into hooks/useWeeklyRecap (app-level: the Since-strip mounts the same hook
 * on Today, so returning parents get this week's recap before ever finding
 * this tab); this component renders what the hook holds. The current week
 * leads with the RecapStoryCards ritual (Maytal Row-1 #2/#4); history weeks
 * keep the classic report layout. W2 2.2 adds the weekly-email opt-in row —
 * fail-closed: the opt-in is real, the channel ships when a provider is
 * configured (server/emailProvider.ts).
 */
export default function WeeklyTab() {
  const { childProfile, setActiveTab, acceptTodayAction, activeTodayAction, requestLearnRead } = useArbor();
  const { user } = useAuth();
  const { t, uiLang, aiLang } = useLanguage();
  const he = aiLang === "he";
  // ENG-07: the empty week offers the move that fills it, in place. QuickLogModal
  // is the existing "openable from anywhere" capture (its own doc comment) and
  // portals through Modal, so no new capture path is invented here.
  const [logOpen, setLogOpen] = useState(false);
  // OBJ-TODAY-06: the two demoted secondary modules, collapsed by default so
  // the generated week reads at its declared budget.
  const [showWeeklyMore, setShowWeeklyMore] = useState(false);
  const rc = (key: string, vars?: Record<string, string | number>) => rcString(t, uiLang, key, vars);

  const recap = useWeeklyRecap();
  const { reports, generating, generate, currentId, currentLabel, labelFor } = recap;

  // LL-A4: "This week's read" — the same explainable ranking the Library uses
  // (age window + focus-domain nurture), surfaced as one pick in the report.
  const devScore = useDevScore();
  const weeklyRead = useMemo(
    () => rankLearnCards(LEARN_CARDS, { ageYears: ageYearsFromProfile(childProfile), focusDomain: devScore.focusDomain })[0],
    [childProfile, devScore.focusDomain]
  );

  // F-06: the tab ALWAYS lands on the CURRENT week — never a stored
  // reports[0], which after a quiet stretch is a week months in the past
  // dressed as now. Pure landing/chip rules live in weekly/weeklySelection.
  const [selectedId, setSelectedId] = useState<string | null>(null);
  useEffect(() => {
    if (!selectedId) setSelectedId(currentId);
  }, [selectedId, currentId]);

  const selected = reports.find((r) => r.id === selectedId) ?? null;
  const hasStoredCurrentWeek = reports.some((r) => r.id === currentId);
  // Current week selected with no stored report yet → honest empty state.
  const emptyCurrentWeek = isEmptyCurrentWeek(selectedId, currentId, hasStoredCurrentWeek);
  // Chip strip: the current week always leads (synthetic when unstored).
  const chipIds = weeklyChipIds(reports.map((r) => r.id), currentId);
  // TJB-19: chip id → the label a parent reads. Every non-current chip comes
  // from a stored report, so labelFor always has its date anchor; the current
  // week may be synthetic, and names itself.
  const reportById = useMemo(() => new Map(reports.map((r) => [r.id, r])), [reports]);
  const chipLabel = (id: string) => (id === currentId ? t("elev.wk.thisWeek") : labelFor(reportById.get(id)));
  // Counts only under the moments stat (clinical firewall — never a derived
  // score). Legacy reports without a resolved count fall back to the digest's
  // resolvedCount; when neither exists the line is simply omitted.
  const selectedWins = selected ? selected.summary.resolved ?? selected.digest?.stats.resolvedCount : undefined;
  const first = childProfile.name.split(" ")[0];

  // P1 language fix: this week's stored narrative is in another language and a
  // language-correct regeneration is expected — hold the AI text rather than
  // render an English paragraph inside a Hebrew card (and vice versa). History
  // weeks are frozen documents: they keep their narrative, and only their
  // LABEL re-derives.
  const awaitingLanguage = selected?.id === currentId && recap.languageRefreshPending;

  // W2 2.1: the CURRENT week renders as the story-card ritual when its digest
  // exists; history weeks keep the classic layout below.
  const showRecap = !!selected?.digest && selected.id === currentId && !awaitingLanguage;
  useEffect(() => {
    if (showRecap && recap.recapUnopened) recap.markRecapOpened();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showRecap, recap.recapUnopened]);

  // ── W2 2.2: weekly email opt-in (fail-closed channel) ──
  const accountId = user?.uid ?? "local";
  const [emailOptIn, setEmailOptIn] = useState(false);
  useEffect(() => {
    setEmailOptIn(readEmailOptIn(accountId));
  }, [accountId]);
  const [emailStatus, setEmailStatus] = useState<DigestEmailStatus>({ enabled: false, provider: null });
  useEffect(() => {
    let live = true;
    void fetchDigestEmailStatus().then((s) => {
      if (live) setEmailStatus(s);
    });
    return () => {
      live = false;
    };
  }, []);
  const toggleEmailOptIn = () => {
    const next = !emailOptIn;
    writeEmailOptIn(accountId, next);
    setEmailOptIn(next);
    track("recap_email_optin", { on: next, channelEnabled: emailStatus.enabled });
  };

  return (
    <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6 max-w-[1180px]">
      {/* TJB-10: back went to #/timeline — a route the parent did not come from
          and which is not this surface's hub. Weekly is a Today tool
          (navigation.ts SECTIONS today.tools), so back is Today, at 44 px. */}
      <button
        onClick={() => setActiveTab("overview")}
        className="inline-flex items-center gap-1.5 text-sm font-bold"
        style={{ color: "var(--arbor-muted)", minHeight: 44, minWidth: 44 }}
      >
        <Icon name="arrow_back" size={16} className="rtl:-scale-x-100" /> {t("elev.wk.back")}
      </button>
      {/* E6a — the child fronts their own week: small portrait through the ONE
          shared HeroAvatar engine (identity resolution + Sprout fallback live
          inside the engine; we never re-composite). Parent register: no idle
          bob (animate={false}), calm mascot mood, and `decorative` because the
          name is already spoken by the "{first}'s week" title right beside it. */}
      <div className="flex items-start gap-4">
        <HeroAvatar size={48} mood="calm" animate={false} decorative className="mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-extrabold uppercase mb-1" style={{ color: "var(--arbor-muted)", letterSpacing: "0.14em" }}>
            {t("elev.personal.weekly.eyebrow")}
          </p>
          <PageHeader
            title={t("wk.title", { first })}
            /* The week label is LOCALIZED HERE, from the report's stored date
               anchor — never read back as a frozen English string (P1 language
               fix): labelFor honors a stored label only in its own language.
               F-06: the raw week id (a storage key) never renders here. */
            subtitle={selected ? labelFor(selected) : currentLabel}
            action={
              /* TJB-10 / principle 3: ONE gradient per screen, and it belongs to
                 the surface's primaryMove — "accept-recap-recommendation"
                 (surfaceContract weekly). Retelling a week the parent already
                 has is a secondary move and now reads as one; only "Create this
                 week's story", when there is nothing to accept yet, keeps the
                 gradient, because then it IS the only move on the screen. */
              <button
                onClick={() => void generate()}
                disabled={generating}
                className="inline-flex items-center gap-2 font-bold text-sm rounded-2xl px-5 py-3 disabled:opacity-60"
                style={hasStoredCurrentWeek
                  ? { background: "transparent", color: "var(--arbor-green-ink)", border: "1px solid var(--arbor-green-ink)", minHeight: 44 }
                  : { background: "var(--arbor-gradient-primary)", color: "var(--arbor-on-accent)", minHeight: 44 }}
              >
                {generating ? (<><Icon name="refresh" size={16} className="animate-spin" /> {t("wk.generating")}</>) : (<><Icon name="auto_awesome" size={16} /> {hasStoredCurrentWeek ? t("wk.regenerate") : t("wk.generate")}</>)}
              </button>
            }
          />
        </div>
      </div>

      {/* History strip — F-06: chipIds always leads with the current week
          (synthetic when no report is stored for it yet), so the newest chip
          is never a week in the past. */}
      {reports.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
          <Icon name="history" size={14} className="flex-shrink-0" style={{ color: "var(--arbor-muted)" }} />
          {chipIds.map((id) => {
            const on = id === (selectedId ?? currentId);
            return (
              <button
                key={id}
                onClick={() => setSelectedId(id)}
                className="text-[11px] font-bold px-3 py-1.5 rounded-full whitespace-nowrap transition flex-shrink-0"
                style={on ? { background: "var(--arbor-green-soft)", color: "var(--arbor-green-ink)", minHeight: 44 } : { background: "var(--arbor-paper-elevated)", color: "var(--arbor-muted)", border: "1px solid var(--arbor-rule)", minHeight: 44 }}
              >
                {/* TJB-19: the chip printed the raw week id — "2026-W37" is a
                    storage key, and F-06 already established that it never
                    renders. labelFor is the same resolver the page subtitle
                    uses, so a chip and the header agree in both languages; the
                    current week names itself rather than a date. */}
                {chipLabel(id)}
              </button>
            );
          })}
        </div>
      )}

      {generating && !selected ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Skeleton className="h-24" /><Skeleton className="h-24" /><Skeleton className="h-24" />
        </div>
      ) : !selected ? (
        /* F-06: the current week with nothing stored yet says so honestly —
           it never falls back to rendering a past week as if it were now. */
        <div className={`${cardCls} p-8 text-center text-sm`} style={{ color: "var(--arbor-muted)" }}>
          {/* ENG-07: the copy promised "log a moment and this week's report will
              build itself". Nothing builds itself — the report is generated when
              a parent taps the header button — so the sentence is now what
              actually happens, and the move it asks for is on the screen instead
              of being described. */}
          <p>{emptyCurrentWeek ? t("elev.wk.emptyThisWeek") : t("wk.noReports")}</p>
          <button
            type="button"
            onClick={() => setLogOpen(true)}
            data-testid="weekly-log-a-moment"
            className="mt-4 inline-flex items-center gap-2 font-bold text-sm rounded-2xl px-5 py-3 transition active:scale-[0.98]"
            style={{ background: "transparent", color: "var(--arbor-green-ink)", border: "1px solid var(--arbor-green-ink)", minHeight: 44, minWidth: 44 }}
          >
            <Icon name="add" size={16} /> {t("elev.wk.logMoment")}
          </button>
        </div>
      ) : (
        <>
          {/* ── W2 2.1: the recap ritual — the PRIMARY view of this week's
                 report. Story cards, one stat per card, last card = the single
                 recommendation (CTA through the acceptTodayAction seam inside,
                 TODAY-1: AI digests only). ── */}
          {/* Item 11 (IA-02): the surface contract reaches the DOM. `data-module`
          marks a top-level sibling module (what moduleBudget counts);
          `data-primary-move` marks the ONE control that performs the move
          surfaceContract.ts declares for this route. */}
          {showRecap && selected.digest && (
            <div data-module="weekly-recap" data-primary-move="accept-recap-recommendation" style={{ display: "contents" }}>
            <RecapStoryCards
              report={selected as WeeklyReport & { digest: WeeklyDigest }}
              childName={childProfile.name}
              canAccept={selected.digest.generated === "ai"}
              accepted={activeTodayAction?.recommendation === selected.digest.tryThisWeek.trim()}
              onAccept={() => acceptTodayAction(selected.digest!.tryThisWeek, "standard", "digest")}
            />
            </div>
          )}

          <div data-module="weekly-stats" className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className={`${cardCls} p-5`}>
              <span className="text-[10px] uppercase font-extrabold tracking-wider" style={{ color: "var(--arbor-muted)" }}>{t("wk.behaviorEvents")}</span>
              <div className="text-3xl font-extrabold mt-1" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}>{selected.summary.count}</div>
              {selectedWins !== undefined && (
                <p className="text-[11px] mt-1" style={{ color: "var(--arbor-muted)" }}>{t("wk.momentsResolved", { n: selected.summary.count, wins: selectedWins })}</p>
              )}
            </div>
            <div className={`${cardCls} p-5`}>
              <span className="text-[10px] uppercase font-extrabold tracking-wider" style={{ color: "var(--arbor-muted)" }}>{t("wk.topTrigger")}</span>
              {/* F-11: schema behaviorTypes render as the stat (label map);
                  the parent's free-typed trigger renders QUOTED + truncated —
                  parent words stay visibly parent words, never a
                  computed-looking value (topMomentDisplay untangles legacy
                  docs that conflated the two). */}
              {(() => {
                const top = topMomentDisplay(selected.summary);
                return (
                  <>
                    <div className="text-sm font-bold mt-2 leading-snug" dir="auto" style={{ color: "var(--arbor-ink)" }}>
                      {top.type
                        ? behaviorTypeLabel(top.type, t, "full")
                        : top.quote
                          ? t("wk.triggerQuote", { text: top.quote })
                          : "—"}
                    </div>
                    {top.type && top.quote && (
                      <p className="text-[11px] mt-1" dir="auto" style={{ color: "var(--arbor-muted)" }}>
                        {t("wk.triggerQuote", { text: top.quote })}
                      </p>
                    )}
                  </>
                );
              })()}
            </div>
            <div className={`${cardCls} p-5`}>
              <span className="text-[10px] uppercase font-extrabold tracking-wider" style={{ color: "var(--arbor-muted)" }}>{t("wk.actionSteps")}</span>
              <div className="text-3xl font-extrabold mt-1" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}>{selected.planProgress.done}<span className="text-lg" style={{ color: "var(--arbor-muted)" }}>/{selected.planProgress.total}</span></div>
              <p className="text-[11px] mt-1" style={{ color: "var(--arbor-muted)" }}>{t("wk.stepsComplete")}</p>
            </div>
          </div>

          {/* The week's narrative is being rewritten in the active language —
              the truthful counts above still stand. */}
          {awaitingLanguage && (
            <div className={`${cardCls} p-6 flex items-center gap-2 text-sm`} style={{ color: "var(--arbor-muted)" }} role="status">
              <Icon name="refresh" size={16} className="animate-spin" /> {t("wk.generating")}
            </div>
          )}

          {/* Classic insight card — history weeks (and digest-less reports);
              the current week's digest already leads as the story cards. */}
          {!showRecap && !awaitingLanguage && (
          <div data-module="weekly-insight" className="rounded-[22px] p-6 space-y-3" style={{ background: "var(--arbor-green-soft)" }}>
            <span className="text-xs font-extrabold uppercase tracking-wider flex items-center gap-1.5" style={{ color: "var(--arbor-green-ink)" }}>
              <Icon name="auto_awesome" size={14} /> {selected.digest ? selected.digest.title : t("wk.aiInsight")}
            </span>
            {selected.digest ? (
              <>
                <p className="text-sm leading-relaxed" style={{ color: "var(--arbor-ink)" }}>{selected.digest.summary}</p>
                {selected.digest.highlights.length > 0 && (
                  <ul className="space-y-1.5 text-sm" style={{ color: "var(--arbor-ink)" }}>
                    {selected.digest.highlights.map((h, i) => (
                      <li key={i} className="flex items-start gap-2"><span style={{ color: "var(--arbor-green-ink)" }}>✦</span> {h}</li>
                    ))}
                  </ul>
                )}
                {/* TJB-20: "Worth watching" was set in peach ink, the app's
                    caution colour, which turns an observation into a chromatic
                    verdict about the child on a parent surface. The words carry
                    the emphasis; the ink is the body ink. */}
                {selected.digest.watchFor.length > 0 && (
                  <p className="text-xs leading-relaxed" style={{ color: "var(--arbor-ink)" }}>
                    <strong>{t("wk.watchFor")}</strong> {selected.digest.watchFor.join(" ")}
                  </p>
                )}
                {selected.digest.tryThisWeek && (
                  <div className="rounded-xl p-3 text-sm bg-white" style={{ color: "var(--arbor-ink)", border: "1px solid var(--arbor-rule-strong)" }}>
                    <strong style={{ color: "var(--arbor-green-ink)" }}>{t("wk.tryThisWeek")}</strong> {selected.digest.tryThisWeek}
                    {/* AIX-S6: feed the action loop from the digest's next-step —
                        through the EXISTING acceptTodayAction seam, with digest
                        provenance. TODAY-1 guard: the CTA exists ONLY for
                        AI-generated digests (generated === "ai"); fallback
                        digests keep the plain card so deterministic copy can
                        never be persisted into actionLoops. */}
                    {selected.digest.generated === "ai" && (
                      activeTodayAction?.recommendation === selected.digest.tryThisWeek.trim() ? (
                        <span className="mt-2.5 flex items-center gap-1.5 text-[12px] font-extrabold" style={{ color: "var(--arbor-green-ink)" }} role="status">
                          <Icon name="check_circle" size={15} /> {t("wk.todayStepSet")}
                        </span>
                      ) : (
                        /* TJB-10: this IS the surface's primaryMove
                           (accept-recap-recommendation). On a history week the
                           recap ritual does not render, so this is where the one
                           gradient belongs; the header Retell is outline. */
                        <button
                          type="button"
                          onClick={() => acceptTodayAction(selected.digest!.tryThisWeek, "standard", "digest")}
                          className="mt-2.5 inline-flex items-center gap-1.5 min-h-[44px] px-4 text-[12px] font-extrabold rounded-xl transition active:scale-[0.98]"
                          style={{ background: "var(--arbor-gradient-primary)", color: "var(--arbor-on-accent)" }}
                        >
                          <Icon name="task_alt" size={15} /> {t("today.action.make")}
                          <Icon name="arrow_forward" size={14} className="rtl:-scale-x-100" />
                        </button>
                      )
                    )}
                  </div>
                )}
              </>
            ) : (
              <MarkdownBlock text={selected.insight} className="space-y-2 text-sm" />
            )}
          </div>
          )}

          {/* R25 (item 11) — #/weekly rendered 6 top-level modules against a declared
          moduleBudget of 3. The tail below is DEMOTED, never removed: one
          collapsed disclosure on the pattern components/practice/SpeechCoachTab.tsx
          `speech-more` already ships, so every capability keeps its door (law 6)
          while the fold belongs to the primary move. Demoted modules keep their
          own `data-module` stamp and add `data-module-demoted`, which is what
          makes the budget rule countable: top-level = stamps minus demoted. */}
          <details data-module-disclosure="weekly-more" className={`${cardCls} p-0 overflow-hidden`}>
            <summary className="cursor-pointer list-none px-6 py-4 min-h-[44px] flex items-center gap-3">
              <span className="grid place-items-center w-9 h-9 rounded-2xl flex-shrink-0" style={{ background: "var(--arbor-sky-soft)", color: "var(--arbor-sky-ink)" }}>
                <Icon name="trophy" size={18} />
              </span>
              <span className="min-w-0">
                <span className="block text-[15px] font-extrabold" style={{ color: "var(--arbor-ink)" }}>{t("elev.wk.rest.title")}</span>
                <span className="block text-[12px]" style={{ color: "var(--arbor-muted)" }}>{t("elev.wk.rest.sub")}</span>
              </span>
              <Icon name="expand_more" size={20} className="ms-auto" style={{ color: "var(--arbor-muted)" }} />
            </summary>
            <div className="px-4 pb-4 space-y-4">
            {/* demotionTarget: "overview" — the hub the contract sends these to. */}
            <button onClick={() => setActiveTab("overview")} className="inline-flex min-h-11 w-full items-center justify-between gap-2 rounded-xl px-4 py-2.5 text-sm font-bold" style={{ color: "var(--arbor-green-ink)", border: "1px solid var(--arbor-rule)" }}>
              <span>{t("elev.wk.rest.door")}</span>
              <Icon name="arrow_forward" size={16} className="rtl:-scale-x-100" />
            </button>
          <div data-module="weekly-detail" data-module-demoted className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <SectionCard title={t("wk.milestoneWins", { n: selected.milestoneWins.length })} icon={<Icon name="trophy" size={20} />} tone="mint">
              {selected.milestoneWins.length ? (
                <ul className="space-y-1.5 text-sm" style={{ color: "var(--arbor-ink)" }}>
                  {selected.milestoneWins.slice(0, 8).map((m, i) => (
                    <li key={i} className="flex items-center gap-2"><span style={{ color: "var(--arbor-green-ink)" }}>✓</span> {m}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs" style={{ color: "var(--arbor-muted)" }}>{t("wk.noMilestones")}</p>
              )}
              <button onClick={() => setActiveTab("milestones")} className="touch-target text-[11px] font-bold !inline-flex !justify-start gap-1 mt-3" style={{ color: "var(--arbor-green-ink)" }}>
                <Icon name="checklist" size={12} /> {t("wk.reviewMilestones")}
              </button>
            </SectionCard>
          </div>

          {/* ── OBJ-TODAY-06 · secondary modules, demoted ────────────────────
              `surfaceContract.weekly.moduleBudget` is 3 and the generated week
              rendered 8. The Scholar spotlight and the weekly read are the two
              that neither carry the week's story nor its move — and the Scholar
              body is catalogue copy that exists only in English (GD-6), so on
              the Hebrew route it was three Latin sentences inside an RTL page.
              Demoting them to the hub's own disclosure keeps both reachable and
              takes them off the default read. Same idiom as Today's tools
              drawer (OverviewTab `showTools`); every link inside clears 44 px. */}
          <div>
            <button
              type="button"
              onClick={() => setShowWeeklyMore((v) => !v)}
              className="w-full flex items-center justify-between min-h-11"
              aria-expanded={showWeeklyMore}
              data-testid="weekly-more-toggle"
            >
              <h2 className="text-[11px] font-extrabold uppercase tracking-wider" style={{ color: "var(--arbor-faint)" }}>{t("elev.wk.more.title")}</h2>
              <span className="inline-flex items-center gap-1 text-xs font-bold" style={{ color: "var(--arbor-green-ink)" }}>
                {/* Reuses Today's drawer verbs — one Show/Hide vocabulary app-wide. */}
                {showWeeklyMore ? t("ov.tools.hide") : t("ov.tools.show")}
                <Icon name="chevron_right" size={18} className={`transition-transform rtl:-scale-x-100 ${showWeeklyMore ? "rotate-90" : ""}`} />
              </span>
            </button>
            {showWeeklyMore && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mt-3">
                <SectionCard title={t("wk.scholarSpotlight")} icon={<Icon name="school" size={20} />} tone="lav">
                  <div className="flex items-baseline gap-2">
                    <strong className="text-sm" dir="auto" style={{ color: "var(--arbor-ink)" }}>{selected.spotlight.name}</strong>
                    <span className="text-[10px] uppercase font-bold" dir="auto" style={{ color: "var(--arbor-muted)" }}>{selected.spotlight.concept}</span>
                  </div>
                  <p className="text-xs leading-relaxed mt-2" dir="auto" style={{ color: "var(--arbor-muted)" }}>{selected.spotlight.value}</p>
                  <button onClick={() => setActiveTab("scholar")} className="touch-target text-[11px] font-bold !inline-flex !justify-start mt-3" style={{ color: "var(--arbor-lav-ink)" }}>{t("wk.scholarExplore")}</button>
                </SectionCard>

                {/* LL-A4: this week's read — one Library pick ranked by age window +
                    focus domain (opportunity framing; the Library door explains why). */}
                {weeklyRead && (
                  <SectionCard title={t("learn.weeklyRead")} icon={<Icon name="local_library" size={20} />} tone="sky">
                    <h4 className="text-sm font-extrabold leading-snug" dir="auto" style={{ color: "var(--arbor-ink)" }}>
                      {he ? weeklyRead.title.he : weeklyRead.title.en}
                    </h4>
                    <p className="text-xs leading-relaxed line-clamp-2 mt-1.5" dir="auto" style={{ color: "var(--arbor-muted)" }}>
                      {he ? weeklyRead.hook.he : weeklyRead.hook.en}
                    </p>
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold mt-2" style={{ color: "var(--arbor-muted)" }}>
                      <Icon name="schedule" size={13} /> {t("learn.minutes", { n: weeklyRead.minutes })}
                    </span>
                    <button
                      onClick={() => requestLearnRead({ cardId: weeklyRead.id, source: "weekly-report" })}
                      className="touch-target text-[11px] font-bold !inline-flex !justify-start gap-1 mt-3"
                      style={{ color: "var(--arbor-sky-ink)" }}
                    >
                      <Icon name="menu_book" size={12} /> {t("learn.readCard")}
                    </button>
                  </SectionCard>
                )}
              </div>
            )}
          </div>

          {/* ── W2 2.2: weekly email opt-in — settings row. The channel is
                 FAIL-CLOSED until a provider is configured server-side; the
                 opt-in is stored per account and honored the day it ships. ── */}
          <div data-module="weekly-email" data-module-demoted className={`${cardCls} p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4`}>
            <div className="flex items-center gap-3 min-w-0">
              <IconBadge tone="lav"><Icon name="mail" size={20} /></IconBadge>
              <div className="min-w-0">
                <h3 className="text-sm font-extrabold" style={{ color: "var(--arbor-ink)" }}>{rc("elev.recap.email.title")}</h3>
                <p className="text-sm mt-0.5" style={{ color: "var(--arbor-muted)" }}>{rc("elev.recap.email.desc", { name: first })}</p>
                {emailOptIn && !emailStatus.enabled && (
                  <p className="text-[12px] font-bold mt-1.5" style={{ color: "var(--arbor-green-ink)" }} role="status">
                    {rc("elev.recap.email.soon")}
                  </p>
                )}
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={emailOptIn}
              aria-label={rc("elev.recap.email.aria")}
              onClick={toggleEmailOptIn}
              className="relative inline-flex h-8 w-14 flex-shrink-0 items-center rounded-full transition-colors min-h-[44px] py-[6px] box-content"
              style={{ background: emailOptIn ? "var(--arbor-green-ink)" : "var(--arbor-rule-strong)" }}
            >
              <span
                aria-hidden
                className="inline-block h-6 w-6 rounded-full bg-white shadow transition-transform ltr:translate-x-1 rtl:-translate-x-1"
                style={{ transform: emailOptIn ? (uiLang === "he" ? "translateX(-28px)" : "translateX(28px)") : undefined }}
              />
            </button>
          </div>

          <div data-module="weekly-share" data-module-demoted className={`${cardCls} p-6 flex flex-col sm:flex-row items-center justify-between gap-4`}>
            <div className="flex items-center gap-3">
              <IconBadge tone="sky"><Icon name="send" size={20} /></IconBadge>
              <div>
                <h3 className="text-sm font-extrabold" style={{ color: "var(--arbor-ink)" }}>{t("wk.readyToShare")}</h3>
                <p className="text-sm mt-0.5" style={{ color: "var(--arbor-muted)" }}>{t("wk.compileBrief")}</p>
              </div>
            </div>
            {/* Principle 3: compiling a brief is a real capability and a
                SECONDARY move on this screen — outline, not a second gradient
                competing with the recommendation the week is for. */}
            <button
              onClick={() => setActiveTab("consult")}
              className="inline-flex items-center gap-2 font-bold text-sm rounded-2xl px-5 py-3 transition active:scale-[0.98] flex-shrink-0"
              style={{ background: "transparent", color: "var(--arbor-green-ink)", border: "1px solid var(--arbor-green-ink)", minHeight: 44 }}
            >
              <Icon name="send" size={16} /> {t("wk.brief", { first })}
            </button>
          </div>
            </div>
          </details>
        </>
      )}
      <QuickLogModal open={logOpen} onClose={() => setLogOpen(false)} />
    </motion.div>
  );
}

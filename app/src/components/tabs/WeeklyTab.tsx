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
import { useWeeklyRecap, recapWeekStartMs, type WeeklyReport } from "../../hooks/useWeeklyRecap";
import { ageYearsFromProfile } from "../../lib/childAge";
import { track } from "../../lib/analytics";
import RecapStoryCards, { type RecapRecord } from "../weekly/RecapStoryCards";
import { parseFirstsState } from "../overview/whatChangedEvents";
import { firstsStorageKey } from "../../lib/firsts";
import { dailyPromptKeys } from "../../lib/promptBank";
import QuickLogModal from "../overview/QuickLogModal";
import { rcString } from "../weekly/recapStrings";
import { weeklyChipIds, isEmptyCurrentWeek } from "../weekly/weeklySelection";
import { fetchDigestEmailStatus, readEmailOptIn, writeEmailOptIn, type DigestEmailStatus } from "../weekly/recapEmail";
import type { WeeklyDigest } from "../../lib/api";
import WhatWorkedCard, { whatWorkedThisWeek } from "../weekly/WhatWorkedCard";
import InviteCard from "../referral/InviteCard";
import { EMPTY_ART } from "../../lib/parentArt";

/* B-OCCL-02 (6 Oct): the route's ONE data-primary-move literal. It is spread
   on the control that performs the move — the letter's "Make it today's step"
   (RecapStoryCards acceptStamp, last card) or, on a history week, the insight card's
   accept — never on the letter's wrapper (650 px at 375, it ran under the
   capture dock). Both branches are mutually exclusive (showRecap).
   B-OCCL-03: with no accept rendered, the generate control carries it
   (generateIsMove) — the route never renders zero stamps or two.
   Weekly 1b: the letter receives it only when its last card offers an
   accept, and stamps the VISIBLE card's forward control — Next on cards
   1…n-1, the accept on the last. */
const ACCEPT_STAMP = { "data-primary-move": "accept-recap-recommendation" } as const;

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
  const {
    childProfile, setActiveTab, acceptTodayAction, activeTodayAction,
    behaviorLogs, playLogs, milestones, checkedMilestones, actionLoop, approvedMemoryItems, keptInsights,
  } = useArbor();
  const { user } = useAuth();
  const { t, uiLang } = useLanguage();
  // ENG-07: the empty week offers the move that fills it, in place. QuickLogModal
  // is the existing "openable from anywhere" capture (its own doc comment) and
  // portals through Modal, so no new capture path is invented here.
  const [logOpen, setLogOpen] = useState(false);
  // B-TODAY-23: card 3's fallback opens the same sheet with its question as the cue.
  const [logPrompt, setLogPrompt] = useState<string | null>(null);
  const rc = (key: string, vars?: Record<string, string | number>) => rcString(t, uiLang, key, vars);

  const recap = useWeeklyRecap();
  const { reports, generating, generate, currentId, currentLabel, labelFor } = recap;

  // B-TODAY-22: the weekly read (ranked by devScore.focusDomain — a hidden
  // weakest-domain pointer selecting content) and the Scholar spotlight are
  // gone from #/weekly. Learn owns ranking; #/learn and #/scholar keep their
  // hub doors.

  // F-06: the tab ALWAYS lands on the CURRENT week — never a stored
  // reports[0], which after a quiet stretch is a week months in the past
  // dressed as now. Pure landing/chip rules live in weekly/weeklySelection.
  const [selectedId, setSelectedId] = useState<string | null>(null);
  useEffect(() => {
    if (!selectedId) setSelectedId(currentId);
  }, [selectedId, currentId]);

  // B-OCCL-03: the first paint already reads the current week (selectedId is
  // null until the landing effect runs) — same landing rule, no empty flash.
  const selected = reports.find((r) => r.id === (selectedId ?? currentId)) ?? null;
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
  // B-TODAY-23: the stat trio ("behavior events" · top trigger · done/total
  // steps) is gone — the letter's cards carry the week, as events.
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

  /* B-OCCL-03 (7 Oct): WHICH control carries ACCEPT_STAMP in this state. An
     accept renders only for an AI digest not yet taken into today — the
     letter's last card (showRecap) or the insight card's button (history week
     / digest-less letter). With no accept on the page (nothing stored, a
     story the digest call could not write, a fallback digest, a step already
     taken) the move is performed by the ONE generate control — "Create this
     week's story" in the header, or "Retell" under the story once the week
     is stored — so the stamp (and the one gradient) sits there. Exactly one
     of the three renders the stamp; never none, never two. */
  const digestAccepted = !!selected?.digest && activeTodayAction?.recommendation === selected.digest.tryThisWeek.trim();
  const acceptRendered = !!selected && !awaitingLanguage && selected.digest?.generated === "ai" && !!selected.digest.tryThisWeek.trim() && !digestAccepted;
  const generateIsMove = !acceptRendered;

  // B-TODAY-23: the letter reads the parent's OWN record over the report's
  // calendar week (recapWeekStartMs: the same week recapWeekId files it under).
  // Everything here is already on the device; card 3's quotes never leave it.
  const recapRecord = useMemo<RecapRecord>(() => {
    let firstsRaw: string | null = null;
    try {
      firstsRaw = window.localStorage.getItem(firstsStorageKey(childProfile.id));
    } catch {
      firstsRaw = null;
    }
    const now = new Date();
    return {
      weekStartMs: recapWeekStartMs(now),
      behaviorLogs,
      playLogs,
      milestones,
      actionLoop,
      approvedFacts: approvedMemoryItems,
      keptIdeas: keptInsights,
      firstsState: parseFirstsState(firstsRaw),
      milestoneCount: checkedMilestones,
      promptKey: dailyPromptKeys({ ageYears: ageYearsFromProfile(childProfile), childId: childProfile.id, date: now })[0] ?? null,
    };
  }, [childProfile, behaviorLogs, playLogs, milestones, actionLoop, approvedMemoryItems, keptInsights, checkedMilestones]);
  // B-TODAY-29: the sentences the parent marked "held the plan" this week
  // (B-ASKJB-33), up to three — a card in the letter only when there are any.
  const worked = useMemo(
    () => whatWorkedThisWeek(actionLoop, recapRecord.weekStartMs, { locale: uiLang === "he" ? "he" : "en", childName: first }),
    [actionLoop, recapRecord.weekStartMs, uiLang, first]
  );
  const parentFirst = (user?.displayName || t("nav.parent")).split(" ")[0];
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

  /* TJB-10 / principle 3: ONE gradient per screen, and it belongs to
     the surface's primaryMove — "accept-recap-recommendation"
     (surfaceContract weekly). Retelling a week the parent already
     has is a secondary move and reads as one while an accept is on
     the page; when there is nothing to accept (generateIsMove) the
     generate control IS the only move on the screen, so it carries
     the stamp and the gradient — "Create this week's story" in the
     header, or Retell under a story the digest could not write. */
  const retellButton = (
    <button
      onClick={() => void generate()}
      disabled={generating}
      data-testid="weekly-generate"
      {...(generateIsMove ? ACCEPT_STAMP : undefined)}
      className="inline-flex items-center gap-2 font-bold text-sm rounded-2xl px-5 py-3 disabled:opacity-60"
      style={generateIsMove
        ? { background: "var(--arbor-gradient-primary)", color: "var(--arbor-on-accent)", minHeight: 44 }
        : { background: "transparent", color: "var(--arbor-green-ink)", border: "1px solid var(--arbor-green-ink)", minHeight: 44 }}
    >
      {generating ? (<><Icon name="refresh" size={16} className="animate-spin" /> {t("wk.generating")}</>) : (<><Icon name="auto_awesome" size={16} /> {hasStoredCurrentWeek ? t("wk.regenerate") : t("wk.generate")}</>)}
    </button>
  );

  /* History strip — F-06: chipIds always leads with the current week
     (synthetic when no report is stored for it yet), so the newest chip
     is never a week in the past. B-OCCL-02: the strip (and, once this week
     is stored, the outline Retell) sits UNDER the week's story instead of
     above it — at 375 the two rows pushed the letter's move under the
     capture dock. Nothing is removed; the order changed. */
  const afterStory = (hasStoredCurrentWeek || reports.length > 0) ? (
    <div data-testid="weekly-after-story" className="space-y-3">
      {hasStoredCurrentWeek && retellButton}
      {reports.length > 0 && (
      <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
        <Icon name="history" size={14} className="flex-shrink-0" style={{ color: "var(--arbor-muted)" }} />
        {chipIds.map((id) => {
          const on = id === (selectedId ?? currentId);
          return (
            <button
              key={id}
              onClick={() => setSelectedId(id)}
              className="text-[12px] font-bold px-3 py-1.5 rounded-full whitespace-nowrap transition flex-shrink-0"
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
    </div>
  ) : null;

  return (
    <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6 max-w-[1180px]">
      {/* E6a — the child fronts their own week: small portrait through the ONE
          shared HeroAvatar engine (identity resolution + Sprout fallback live
          inside the engine; we never re-composite). Parent register: no idle
          bob (animate={false}), calm mascot mood, and `decorative` because the
          name is already spoken by the "{first}'s week" title right beside it. */}
      <div className="flex items-start gap-4">
        <HeroAvatar size={48} mood="calm" animate={false} decorative className="mt-0.5" />
        <div className="flex-1 min-w-0">
          {/* B-OCCL-02: the eyebrow carries the week label (was a separate
              subtitle line under the H1) — one 12 px line, sentence case. */}
          <p data-testid="weekly-eyebrow" className="text-[12px] font-bold mb-1 truncate" style={{ color: "var(--arbor-muted)" }}>
            {t("elev.personal.weekly.eyebrow")}
            {" · "}
            {/* The week label is LOCALIZED HERE, from the report's stored date
                anchor — never read back as a frozen English string (P1 language
                fix): labelFor honors a stored label only in its own language.
                F-06: the raw week id (a storage key) never renders here. */}
            {selected ? labelFor(selected) : currentLabel}
          </p>
          <PageHeader
            flush
            title={t("wk.title", { first })}
            /* B-OCCL-02: once this week is stored, Retell is a secondary move
               and sits under the letter (it wrapped to its own 44 px row here
               at 375); "Create this week's story" stays in the header — then it
               IS the only move on the screen. */
            action={hasStoredCurrentWeek ? undefined : retellButton}
          />
        </div>
      </div>

      {generating && !selected ? (
        <>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Skeleton className="h-24" /><Skeleton className="h-24" /><Skeleton className="h-24" />
        </div>
        {afterStory}
        </>
      ) : !selected ? (
        /* F-06: the current week with nothing stored yet says so honestly —
           it never falls back to rendering a past week as if it were now. */
        /* B-TODAY-22 (FU-N1-L1, framer default): the empty week is a stamped
           module whose ONE move is the explicit secondary "capture-moment"
           (surfaceContract weekly) — the primary move has nothing to accept
           until a week exists. */
        <>
        <div data-module="weekly-empty" className={`${cardCls} p-8 text-center text-sm`} style={{ color: "var(--arbor-muted)" }}>
          {/* ENG-07: the copy promised "log a moment and this week's report will
              build itself". Nothing builds itself — the report is generated when
              a parent taps the header button — so the sentence is now what
              actually happens, and the move it asks for is on the screen instead
              of being described. */}
          {/* P7-DESIGN art: the week's still life above the honest line (decorative). */}
          <figure aria-hidden="true" data-testid="weekly-empty-art" className="m-0 mx-auto mb-4 overflow-hidden" style={{ inlineSize: "min(300px, 100%)", borderRadius: "var(--r-xl)", background: "var(--arbor-paper-deep)" }}>
            <img src={EMPTY_ART.weekly.src} srcSet={EMPTY_ART.weekly.srcSet} width={EMPTY_ART.weekly.width} height={EMPTY_ART.weekly.height} alt="" loading="lazy" decoding="async" style={{ display: "block", inlineSize: "100%", blockSize: "auto", aspectRatio: "3 / 2", objectFit: "cover" }} />
          </figure>
          <p>{emptyCurrentWeek ? t("elev.wk.emptyThisWeek") : t("wk.noReports")}</p>
          <button
            type="button"
            onClick={() => setLogOpen(true)}
            data-secondary-move="capture-moment"
            data-testid="weekly-log-a-moment"
            className="mt-4 inline-flex items-center gap-2 font-bold text-sm rounded-2xl px-5 py-3 transition active:scale-[0.98]"
            style={{ background: "transparent", color: "var(--arbor-green-ink)", border: "1px solid var(--arbor-green-ink)", minHeight: 44, minWidth: 44 }}
          >
            <Icon name="add" size={16} /> {t("elev.wk.logMoment")}
          </button>
        </div>
        {afterStory}
        </>
      ) : (
        <>
          {/* ── W2 2.1: the recap ritual — the PRIMARY view of this week's
                 report. Story cards, one stat per card, last card = the single
                 recommendation (CTA through the acceptTodayAction seam inside,
                 TODAY-1: AI digests only). ── */}
          {/* Item 11 (IA-02): the surface contract reaches the DOM. `data-module`
          marks a top-level sibling module (what moduleBudget counts);
          `data-primary-move` marks the ONE control that performs the move
          surfaceContract.ts declares for this route — B-OCCL-02: the
          letter's accept button (acceptStamp), not this wrapper. */}
          {showRecap && selected.digest && (
            <div data-module="weekly-recap" style={{ display: "contents" }}>
            <RecapStoryCards
              acceptStamp={acceptRendered ? ACCEPT_STAMP : undefined}
              report={selected as WeeklyReport & { digest: WeeklyDigest }}
              record={recapRecord}
              childName={childProfile.name}
              canAccept={selected.digest.generated === "ai"}
              accepted={activeTodayAction?.recommendation === selected.digest.tryThisWeek.trim()}
              onAccept={() => acceptTodayAction(selected.digest!.tryThisWeek, "standard", "digest")}
              onCapture={() => {
                setLogPrompt(recapRecord.promptKey);
                setLogOpen(true);
              }}
            />
            {/* B-TODAY-29: one of the letter's cards (inside its module, so the
                route's module budget is unchanged); absent when none held. */}
            <WhatWorkedCard lines={worked} childName={first} parentName={parentFirst} locale={uiLang === "he" ? "he" : "en"} t={t} />
            {/* B-SHELL-29: the invite closes the letter — the ONE place a link
                leaves the app (the referral link, two-sided free month); it
                carries no child content. Moved here from Settings. Inside the
                letter's module, so the route's budget is unchanged. */}
            <section data-testid="weekly-invite" aria-labelledby="weekly-invite-title" className="border-t pt-4" style={{ borderColor: "var(--arbor-rule)" }}>
              <h3 id="weekly-invite-title" className="text-[15px] font-semibold" style={{ color: "var(--arbor-ink)" }}>{t("elev.words.invite.title")}</h3>
              <p className="mt-1 text-[13px]" style={{ color: "var(--arbor-muted)" }}>{t("elev.words.invite.sub", { name: first })}</p>
              <InviteCard />
            </section>
            </div>
          )}

          {/* The week's narrative is being rewritten in the active language. */}
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
                  <div className="rounded-xl p-3 text-sm" style={{ background: "var(--arbor-paper-elevated)", color: "var(--arbor-ink)", border: "1px solid var(--arbor-rule-strong)" }}>
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
                          {...ACCEPT_STAMP}
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

          {afterStory}

          {/* R25 (item 11) → B-TODAY-22: ONE collapsed disclosure, holding the
              week's milestone wins only (one nested level at most). Demoted
              modules keep their `data-module` stamp and add
              `data-module-demoted` — top-level = stamps minus demoted. The
              Scholar spotlight, the weekly read, the nested "More" toggle and
              the door back to Today are gone (Today is the back button). */}
          <details data-module-disclosure="weekly-more" className={`${cardCls} p-0 overflow-hidden`}>
            <summary className="cursor-pointer list-none px-6 py-4 min-h-[44px] flex items-center gap-3">
              <span className="grid place-items-center w-9 h-9 rounded-2xl flex-shrink-0" style={{ background: "var(--arbor-sky-soft)", color: "var(--arbor-sky-ink)" }}>
                <Icon name="trophy" size={18} />
              </span>
              <span className="block min-w-0 text-[15px] font-extrabold" style={{ color: "var(--arbor-ink)" }}>{t("elev.wk.rest.title")}</span>
              <Icon name="expand_more" size={20} className="ms-auto" style={{ color: "var(--arbor-muted)" }} />
            </summary>
            <div className="px-4 pb-4">
              <div data-module="weekly-detail" data-module-demoted>
                <SectionCard title={t("wk.milestoneWins", { n: selected.milestoneWins.length })} icon={<Icon name="trophy" size={20} />} tone="mint">
                  {selected.milestoneWins.length ? (
                    <ul className="space-y-1.5 text-sm" style={{ color: "var(--arbor-ink)" }}>
                      {selected.milestoneWins.slice(0, 8).map((m, i) => (
                        <li key={i} className="flex items-center gap-2" dir="auto"><span style={{ color: "var(--arbor-green-ink)" }}>✓</span> {m}</li>
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
            </div>
          </details>

          {/* ── B-TODAY-22: ONE outline door — "Prepare a snapshot for a visit"
                 (wk.brief) → #/consult. A secondary move, never a second
                 gradient competing with the recommendation the week is for. ── */}
          <div data-module="weekly-share" data-module-demoted>
            <button onClick={() => setActiveTab("consult")}
              type="button"
              data-testid="weekly-snapshot-door"
              className="inline-flex w-full sm:w-auto items-center justify-center gap-2 font-bold text-sm rounded-2xl px-5 py-3 transition active:scale-[0.98]"
              style={{ background: "transparent", color: "var(--arbor-green-ink)", border: "1px solid var(--arbor-green-ink)", minHeight: 44 }}
            >
              <Icon name="send" size={16} /> {t("wk.brief", { first })}
            </button>
          </div>

          {/* ── W2 2.2: weekly email opt-in — settings row. FAIL-CLOSED until a
                 provider is configured server-side. B-TODAY-22 (Guy G4): the
                 row shows only once the channel exists or the parent already
                 opted in; the opt-in store is kept either way. ── */}
          {(emailStatus.enabled || emailOptIn) && (
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
                className="inline-block h-6 w-6 rounded-full shadow transition-transform ltr:translate-x-1 rtl:-translate-x-1"
                style={{ background: "var(--arbor-paper-elevated)", transform: emailOptIn ? (uiLang === "he" ? "translateX(-28px)" : "translateX(28px)") : undefined }}
              />
            </button>
          </div>
          )}
        </>
      )}
      <QuickLogModal open={logOpen} promptKey={logPrompt}
        onClose={() => {
          setLogOpen(false);
          setLogPrompt(null);
        }}
      />
    </motion.div>
  );
}

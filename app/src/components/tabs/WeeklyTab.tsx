import React, { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import Icon from "../ui/Icon";
import { useArbor } from "../../context/ArborContext";
import { useAuth } from "../../context/AuthContext";
import { useLanguage } from "../../context/LanguageContext";
import { cardCls } from "../ui/kit";
import { useWeeklyRecap, recapWeekId, recapWeekStartMs, weekAnchorDate } from "../../hooks/useWeeklyRecap";
import { useChildCollection } from "../../hooks/useChildCollection";
import { useObservations } from "../../hooks/useObservations";
import { track } from "../../lib/analytics";
import { nextPrepareVisit, type Appointment } from "../../lib/careTrack";
import { appointmentRoleLabel } from "../../lib/appointmentLabel";
import { weekGlance, glanceHasCounts } from "../../lib/weekGlance";
import { weekReportLines } from "../../lib/weekReport";
import { EMPTY_ART } from "../../lib/parentArt";
import QuickLogModal from "../overview/QuickLogModal";
import { weeklyChipIds, isEmptyCurrentWeek, reportWeekBounds } from "../weekly/weeklySelection";
import { whatWorkedThisWeek, WhatWorkedSend } from "../weekly/WhatWorkedCard";
import WeekGlance from "../weekly/WeekGlance";
import InviteCard from "../referral/InviteCard";

/* B-OCCL-02 (6 Oct): the route's ONE data-primary-move literal, spread on the
   control that performs the move, never on a wrapper.
   v3 F-NOW-3: the move lives in the carry band at the end of the report. While
   an AI digest's suggestion is not yet today's step, the band's "Make it
   today's step" carries it (acceptRendered); in every other state (nothing
   stored, the digest call failed, a fallback digest, the step already taken, a
   history week without an AI suggestion) the band's "Back to Now" carries it.
   Exactly one of the two renders the stamp: never none, never two. */
const ACCEPT_STAMP = { "data-primary-move": "accept-recap-recommendation" } as const;

/**
 * WeeklyTab — the Weekly report (v3 F-NOW-3), as the v3 mock draws it: the
 * kicker with the report week's dates, "{first}'s week, at a glance.", the
 * counts-not-scores line, then the dashboard (WeekGlance: four count tiles,
 * the day strip beside What helped and the child's words, every area), and the
 * carry band "For next week:" with the digest's suggestion. A past week
 * renders the same dashboard over its own dates, stepped to with Previous week
 * / Next week. The digest is written by useWeeklyRecap (auto-generated once a
 * week holds records); its only trace here is the band's suggestion.
 *
 * Clinical firewall: counts only, everywhere on the page; no share, no
 * denominator, no trend, no colour that grades the child.
 *
 * Departures from the v3 mock, on purpose: (1) the words card is fed by the
 * child's word observations kept this week (lib/weekReport), not by the
 * digest's weekQuotes, so it shows what the parent kept, never what a model
 * picked; (2) Previous / Next also render on phones (the mock's phone frame
 * has none), so every stored week stays reachable at 390 px.
 */
export default function WeeklyTab() {
  const { childProfile, setActiveTab, acceptTodayAction, activeTodayAction, actionLoop } = useArbor();
  const { user } = useAuth();
  const { t, uiLang } = useLanguage();
  const he = uiLang === "he";
  // ENG-07: the empty week offers the move that fills it, in place. QuickLogModal
  // is the existing "openable from anywhere" capture and portals through Modal.
  const [logOpen, setLogOpen] = useState(false);

  const recap = useWeeklyRecap();
  const { reports, generating, generate, currentId, currentLabel, labelFor } = recap;

  // F-06: the tab ALWAYS lands on the CURRENT week, never a stored reports[0].
  const [selectedId, setSelectedId] = useState<string | null>(null);
  useEffect(() => {
    if (!selectedId) setSelectedId(currentId);
  }, [selectedId, currentId]);

  // B-OCCL-03: the first paint already reads the current week.
  const selected = reports.find((r) => r.id === (selectedId ?? currentId)) ?? null;
  const hasStoredCurrentWeek = reports.some((r) => r.id === currentId);
  const emptyCurrentWeek = isEmptyCurrentWeek(selectedId, currentId, hasStoredCurrentWeek);
  // The weeks Previous / Next step through: the current week leads (synthetic
  // when unstored), then every stored week, newest first.
  const chipIds = weeklyChipIds(reports.map((r) => r.id), currentId);
  // TJB-19: a week id is a storage key and never renders; the current week
  // names itself, a past week reads its localized date label.
  const reportById = useMemo(() => new Map(reports.map((r) => [r.id, r])), [reports]);
  const chipLabel = (id: string) => (id === currentId ? t("elev.wk.thisWeek") : labelFor(reportById.get(id)));
  const viewId = selectedId ?? currentId;
  const isCurrent = viewId === currentId;
  const at = chipIds.indexOf(viewId);
  const prevId = at >= 0 ? chipIds[at + 1] ?? null : null;
  const nextId = at > 0 ? chipIds[at - 1] : null;

  const first = childProfile.name.split(" ")[0];
  const parentFirst = (user?.displayName || t("nav.parent")).split(" ")[0];
  const locale = he ? "he" : "en";

  // P1 language fix: this week's stored text is in another language and a
  // language-correct regeneration is expected, so the band holds it back.
  const awaitingLanguage = selected?.id === currentId && recap.languageRefreshPending;

  /* B-OCCL-03: an accept renders only for an AI digest not yet taken into
     today; otherwise "Back to Now" carries the stamp (see ACCEPT_STAMP). */
  const digestAccepted = !!selected?.digest && activeTodayAction?.recommendation === selected.digest.tryThisWeek.trim();
  const acceptRendered = !!selected && !awaitingLanguage && selected.digest?.generated === "ai" && !!selected.digest.tryThisWeek.trim() && !digestAccepted;

  /* The report week's counts (lib/weekGlance) and lines (lib/weekReport). The
     current week runs from its first instant to now; a past week is whole,
     bounded by the instants its report id holds (reportWeekBounds), so the
     history dashboard counts exactly the week its report was filed under. */
  const observations = useObservations();
  const week = useMemo(() => {
    const bounds = reportWeekBounds(viewId, weekAnchorDate(selected), { weekId: recapWeekId, weekStartMs: recapWeekStartMs });
    const nowMs = Date.now();
    const span = isCurrent
      ? { startMs: bounds?.startMs ?? recapWeekStartMs(new Date(nowMs)), endMs: nowMs, lastMs: bounds?.endMs ?? nowMs }
      : bounds && { startMs: bounds.startMs, endMs: bounds.endMs, lastMs: bounds.endMs };
    if (!span) return null;
    const counts = weekGlance({ observations, actionLoop, now: new Date(span.endMs), weekStartMs: span.startMs });
    return {
      ...span,
      // A past week lies wholly behind: no day of its strip is today.
      glance: isCurrent ? counts : { ...counts, today: 7 },
      lines: weekReportLines({ observations, actionLoop, startMs: span.startMs, endMs: span.endMs }),
    };
  }, [viewId, isCurrent, selected, observations, actionLoop]);
  const dashboardShown = !!week && (glanceHasCounts(week.glance) || !!selected);

  // The kicker's dates: the report week's first and last day ("10–16 Oct").
  const range = useMemo(() => {
    const fallback = selected ? labelFor(selected) : currentLabel;
    if (!week) return fallback;
    const firstDay = week.glance.perDay[0].startMs;
    const lastDay = Math.max(firstDay, Math.min(week.glance.perDay[6].startMs, week.lastMs - 1));
    try {
      return new Intl.DateTimeFormat(he ? "he-IL" : "en-GB", { month: "short", day: "numeric" }).formatRange(firstDay, lastDay);
    } catch {
      return fallback;
    }
  }, [week, he, selected, labelFor, currentLabel]);

  // B-TODAY-29: the sentences the parent marked "held the plan" this week;
  // their text-only send is What helped's one action.
  const worked = useMemo(
    () => (week ? whatWorkedThisWeek(actionLoop, week.startMs, { locale, childName: first, nowMs: week.endMs }) : []),
    [actionLoop, week, locale, first]
  );

  // The summary door names the next visit's professional when one is booked
  // inside its Prepare window (the same visit Consult anchors on).
  const appointments = useChildCollection<Appointment>(childProfile.id, "appointments");
  const visit = nextPrepareVisit(appointments.items, Date.now());
  const summaryLabel = visit ? t("elev.wk.summary.role", { role: appointmentRoleLabel(visit, t) }) : t("wk.brief", { first });
  // v3 F-NOW-3: the door opens the Care summary (#/handoff, FEAT-09), the
  // professional summary the mock's "Add to the summary" names.
  const openSummary = () => setActiveTab("handoff");

  // The digest the band shows; recap_opened once per shown week.
  const shownDigestWeek = selected?.digest && !awaitingLanguage ? selected.id : null;
  useEffect(() => {
    if (!shownDigestWeek) return;
    track("recap_opened", { week: shownDigestWeek });
    if (shownDigestWeek === currentId && recap.recapUnopened) recap.markRecapOpened();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shownDigestWeek, recap.recapUnopened]);

  const carry = shownDigestWeek && selected?.digest ? selected.digest.tryThisWeek.trim() : "";
  const carryNote = isCurrent && (generating || awaitingLanguage)
    ? t("elev.wk.carry.writing")
    : !isCurrent
      ? t("elev.wk.carry.history")
      : t("elev.wk.carry.none");
  // Generation is automatic; while this week holds records and no digest
  // exists yet, one quiet text link can still ask for it.
  const canWrite = isCurrent && !selected?.digest && !generating && !awaitingLanguage && !!week && glanceHasCounts(week.glance);

  const stepButton = (id: string, dir: "prev" | "next") => (
    <button
      type="button"
      data-testid={dir === "prev" ? "weekly-prev" : "weekly-next"}
      onClick={() => setSelectedId(id)}
      aria-label={t(dir === "prev" ? "elev.wk.prev.aria" : "elev.wk.next.aria", { week: chipLabel(id) })}
      className="inline-flex items-center gap-2 rounded-2xl px-4 text-sm font-semibold transition active:scale-[0.98]"
      style={{ background: "var(--arbor-paper-elevated)", color: "var(--arbor-ink)", border: "1px solid var(--arbor-rule-strong)", minHeight: 44 }}
    >
      {dir === "prev" && <Icon name="arrow_back" size={16} className="rtl:-scale-x-100" />}
      {t(dir === "prev" ? "elev.wk.prev" : "elev.wk.next")}
      {dir === "next" && <Icon name="arrow_forward" size={16} className="rtl:-scale-x-100" />}
    </button>
  );

  /* B-TODAY-22: ONE outline door to the visit summary (#/handoff). A secondary
     move, never a second gradient beside the band's accept. It sits in the
     header from md up and closes the page on phones: one handler, two seats,
     one visible at a time, each with its own test id. */
  const summaryDoor = (placement: "header" | "end") => (
    <button
      type="button"
      onClick={openSummary}
      data-testid={placement === "header" ? "weekly-snapshot-door" : "weekly-snapshot-door-phone"}
      data-placement={placement}
      className={`${placement === "header" ? "hidden md:inline-flex" : "inline-flex md:hidden w-full"} items-center justify-center gap-2 rounded-2xl px-5 text-sm font-bold transition active:scale-[0.98]`}
      style={{ background: "transparent", color: "var(--arbor-green-ink)", border: "1px solid var(--arbor-green-ink)", minHeight: 44 }}
    >
      <Icon name="description" size={16} /> <bdi>{summaryLabel}</bdi>
    </button>
  );

  return (
    <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex flex-col gap-6 max-w-[1180px]">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          {/* The kicker carries the report week's dates, in the page's language
              (F-06: never the raw week id); 12 px, sentence case. */}
          <p data-testid="weekly-eyebrow" className="text-[12px] font-bold mb-1" style={{ color: "var(--arbor-muted)" }}>
            {t("elev.wk.kicker", { range })}
          </p>
          <h1 data-testid="weekly-title" className="text-[28px] md:text-[40px] leading-[1.1] font-medium" style={{ color: "var(--arbor-ink)", fontFamily: "var(--font-display)" }}>
            {t("elev.wk.headline", { first })}
          </h1>
          <p data-testid="weekly-glance-sub" className="mt-2 text-sm" style={{ color: "var(--arbor-muted)" }}>
            {t("elev.wk.glance.sub")}
          </p>
        </div>
        {/* On phones the summary door closes the page, so the header row shows
            only when a week step exists; from md up it always holds the door. */}
        <div data-testid="weekly-header-actions" className={`${prevId || nextId ? "flex" : "hidden md:flex"} flex-wrap items-center gap-2`}>
          {prevId && stepButton(prevId, "prev")}
          {nextId && stepButton(nextId, "next")}
          {summaryDoor("header")}
        </div>
      </header>

      {dashboardShown && week ? (
        <WeekGlance
          glance={week.glance}
          lines={week.lines}
          childFirst={first}
          helpedAction={<WhatWorkedSend lines={worked} parentName={parentFirst} locale={locale} t={t} />}
          onOpenMilestones={() => setActiveTab("milestones")}
        />
      ) : !selected ? (
        /* F-06: the current week with nothing kept yet says so honestly; its
           ONE move is the explicit secondary capture-moment (surfaceContract
           weekly), opened in place. */
        <div data-module="weekly-empty" className={`${cardCls} p-8 text-center text-sm`} style={{ color: "var(--arbor-muted)" }}>
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
      ) : null}

      {/* For next week: the digest's one suggestion, carried forward. */}
      <div data-module="weekly-carry" data-testid="weekly-carry" className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl px-[18px] py-[14px]" style={{ background: "var(--arbor-paper-deep)", color: "var(--arbor-ink)" }}>
        <Icon name="lightbulb" size={20} style={{ color: "var(--arbor-sky-ink)" }} />
        <p data-testid="weekly-carry-text" className="m-0 min-w-0 flex-1 basis-[14rem] text-sm leading-relaxed">
          <b>{t("elev.wk.carry.label")}</b>{" "}
          {carry ? <bdi dir="auto">{carry}</bdi> : <span style={{ color: "var(--arbor-muted)" }}>{carryNote}</span>}
        </p>
        {/* AIX-S6 / TODAY-1: the suggestion feeds Today through the EXISTING
            acceptTodayAction seam with digest provenance, and ONLY for an AI
            digest; a fallback digest's text stays plain. Once taken, an honest
            done-state replaces the accept. */}
        {selected?.digest && !awaitingLanguage && selected.digest.generated === "ai" && !!carry && (
          digestAccepted ? (
            <span className="inline-flex items-center gap-1.5 text-[13px] font-bold" style={{ color: "var(--arbor-green-ink)" }} role="status">
              <Icon name="check_circle" size={16} /> {t("wk.todayStepSet")}
            </span>
          ) : (
            <button
              type="button"
              onClick={() => { track("recap_try_accept", { week: selected.id }); acceptTodayAction(selected.digest!.tryThisWeek, "standard", "digest"); }}
              {...ACCEPT_STAMP}
              data-testid="weekly-accept"
              className="inline-flex items-center gap-1.5 min-h-[44px] px-4 text-[13px] font-extrabold rounded-xl transition active:scale-[0.98]"
              style={{ background: "var(--arbor-gradient-primary)", color: "var(--arbor-on-accent)" }}
            >
              <Icon name="task_alt" size={16} /> {t("today.action.make")}
              <Icon name="arrow_forward" size={14} className="rtl:-scale-x-100" />
            </button>
          )
        )}
        {canWrite && (
          <button
            type="button"
            data-testid="weekly-generate"
            onClick={() => void generate()}
            className="inline-flex items-center gap-1.5 min-h-[44px] px-2 text-[13px] font-semibold underline underline-offset-4"
            style={{ color: "var(--arbor-ink)" }}
          >
            <Icon name="auto_awesome" size={16} /> {t("elev.wk.carry.write")}
          </button>
        )}
        <button
          type="button"
          data-testid="weekly-carry-back"
          onClick={() => setActiveTab("overview")}
          {...(acceptRendered ? undefined : ACCEPT_STAMP)}
          className="inline-flex items-center gap-1.5 min-h-[44px] px-4 text-[13px] font-bold rounded-xl transition active:scale-[0.98]"
          style={acceptRendered
            ? { background: "transparent", color: "var(--arbor-ink)" }
            : { background: "var(--arbor-ink)", color: "var(--arbor-paper-elevated)" }}
        >
          {t("elev.wk.carry.back")}
          <Icon name="arrow_forward" size={14} className="rtl:-scale-x-100" />
        </button>
      </div>

      {summaryDoor("end")}

      {/* B-SHELL-29: the invite (the ONE place a link leaves the app; it
          carries no child content) stays on Weekly, folded into the page's
          one collapsed disclosure; it is demoted, so the budget is unchanged. */}
      <details data-module-disclosure="weekly-more" data-testid="weekly-invite-more" className={`${cardCls} p-0 overflow-hidden`}>
        <summary className="cursor-pointer list-none px-6 py-3 min-h-[44px] flex items-center gap-3">
          <Icon name="favorite" size={18} style={{ color: "var(--arbor-muted)" }} />
          <span id="weekly-invite-title" className="block min-w-0 text-[15px] font-semibold" style={{ color: "var(--arbor-ink)" }}>{t("elev.words.invite.title")}</span>
          <Icon name="expand_more" size={20} className="ms-auto" style={{ color: "var(--arbor-muted)" }} />
        </summary>
        <div data-module="weekly-invite" data-module-demoted className="px-6 pb-5">
          <section data-testid="weekly-invite" aria-labelledby="weekly-invite-title">
            <p className="text-[13px]" style={{ color: "var(--arbor-muted)" }}>{t("elev.words.invite.sub", { name: first })}</p>
            <InviteCard />
          </section>
        </div>
      </details>

      <QuickLogModal open={logOpen} onClose={() => setLogOpen(false)} />
    </motion.div>
  );
}

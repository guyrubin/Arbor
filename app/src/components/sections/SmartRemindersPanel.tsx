/**
 * SmartRemindersPanel — AP-058
 *
 * A "Smart Reminders" parent-settings dashboard over the existing JITAI nudge
 * engine (lib/jitai.ts). This is a PARENT PREFERENCE surface ONLY.
 *
 * BINDING CLINICAL FRAMING (board-cleared, AP-058):
 *   - Quiet-hours: parent's chosen window, not a child-watching mechanism.
 *   - Calm-window: routes nudges to calmer stretches — NOT described as the app
 *     observing or tracking the child.
 *   - Max-2/day contract: always visible to the parent.
 *   - No copy implying more nudges = better development.
 *   - No monitoring/child-watching/child-tracking copy. No clinical/diagnostic terms.
 *
 * DATA SAFETY:
 *   - Reads/writes ONLY to localStorage via jitaiPrefs.ts.
 *   - No child-data write, no Firestore mutation, no new consent surface.
 *   - Reads next-nudge from the existing JITAI engine via nextNudge() with the
 *     parent's prefs and today's ledger (the same inputs RhythmCue renders
 *     from), no new signal path.
 *   - B-TODAY-02: nothing leaves the app. The contract line says "shows …
 *     inside the app" and that nothing is sent to a phone or email yet.
 *   - v3 F-NOW-3: the Delivery section also holds the weekly-report email
 *     opt-in (WeeklyEmailRow), moved here from #/weekly. It keeps its own
 *     store (recapEmail.ts: a local key plus a best-effort server row) and its
 *     fail-closed channel; it renders only once the channel exists or the
 *     parent already opted in.
 *
 * v10.1 (N-Remind boards): the page is the home of its own controls, operated
 * in place — today on the day arc (the clock now, the quiet hours you set, the
 * next nudge if one is due, the max-2 contract as two slots), the two nudge
 * switches and "When Arbor may reach you" (quiet hours, calmer stretches) in
 * the rail, then Delivery. No snooze, no invented nudge history.
 *
 * ENTRY POINTS: Settings modal → "Smart Reminders" row (always visible).
 * Also reachable from Ask Arbor section via setActiveTab("smart-reminders").
 */
import React, { useState, useMemo, useCallback } from "react";
import { Icon } from "../ui/Icon";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { nextNudge } from "../../lib/jitai";
import { shownNudgesToday, NUDGE_DAILY_CEILING } from "../../growth/jitaiPrefs";
import { predictRhythm } from "../../rhythm/predict";
import { ageMonthsFromProfile } from "../../lib/childAge";
import {
  loadPrefs,
  savePrefs,
  type JitaiPrefs,
  type NudgeTypeKey,
} from "../../growth/jitaiPrefs";
/* TJB-14: `jitaiPrefs.formatHour` is English-only ("9:00 pm"), so the Hebrew
   quiet-hours picker and its summary line printed am/pm inside an RTL page.
   `lib/pulse.formatHour` is the language-aware sibling already used by the
   Today pulse (he → 24h "21:00") — one formatter, both locales. */
import { formatHour } from "../../lib/pulse";
import PushPrimingCard from "../nextopen/PushPrimingCard";
import WeeklyEmailRow from "../weekly/WeeklyEmailRow";
import { usePushPriming } from "../../hooks/usePushPriming";
import { ageYearsOf } from "../../lib/age/forChild";
import { DsRoot, Fig, Guide, Route, RouteSection, Row12, Scene, StartHere, Tile, type GuideStop } from "../../design/primitives";
import { useComposition } from "../../design/useComposition";
import NowDayArc from "../companion/now10/NowDayArc";
import NowWorthKnowing from "../companion/now10/NowWorthKnowing";
import { NOW_V10_COPY } from "../companion/now10/nowV10Copy";
import { NOW_COPY } from "../companion/nowViewCopy";
import "../companion/now10/nowV10.css";
import "./smartRemindersV10.css";

// ── Hours available in the quiet-hours picker ────────────────────────────────
const HOUR_OPTIONS = Array.from({ length: 24 }, (_, i) => i);

// ── Nudge kind → i18n key map ─────────────────────────────────────────────────
const KIND_KEY: Record<string, string> = {
  prep:     "sr.nextNudge.kind.prep",
  calm:     "sr.nextNudge.kind.calm",
  log:      "sr.nextNudge.kind.log",
  practice: "sr.nextNudge.kind.practice",
  bedtime:  "sr.nextNudge.kind.bedtime",
};

/* B-OCCL-01 (6 Oct): the route's ONE data-primary-move literal, spread on the
   control that performs the move — the first nudge-type switch — never on the
   prefs wrapper. A static const (or undefined), so whiteLabelContrast resolves
   it as a data attribute. */
const PREFS_STAMP = { "data-primary-move": "set-reminder-prefs" } as const;

// B-TODAY-02: one switch per NudgeTypeKey; lib/jitai NUDGE_KIND_PREF maps
// every engine kind onto exactly one of these.
const NUDGE_TYPES: Array<{ key: NudgeTypeKey; labelKey: string; descKey: string }> = [
  { key: "guidance", labelKey: "sr.types.guidance.label", descKey: "sr.types.guidance.desc" },
  { key: "moments",  labelKey: "sr.types.moments.label",  descKey: "sr.types.moments.desc" },
];


// ── Component ─────────────────────────────────────────────────────────────────
export default function SmartRemindersPanel() {
  const push = usePushPriming();
  const { childProfile, behaviorLogs } = useArbor();
  const { t, uiLang } = useLanguage();
  const lang = uiLang === "he" ? "he" : "en";
  const v10 = NOW_V10_COPY[lang];
  const composition = useComposition();
  const desk = composition === "desk";

  // Load prefs from localStorage on first render — no Firestore, no child data.
  const [prefs, setPrefs] = useState<JitaiPrefs>(loadPrefs);
  const [savedFlash, setSavedFlash] = useState(false);

  // Derive the next nudge from the existing JITAI engine (read-only — the same
  // engine RhythmCue renders from, no new signal path).
  const firstName = (childProfile.name || "your child").split(" ")[0];

  const ageMonthsPrecise = ageMonthsFromProfile(childProfile);
  const ageYears = ageMonthsPrecise !== null
    ? ageMonthsPrecise / 12
    : (ageYearsOf(childProfile) ?? 0);

  const rhythm = useMemo(
    () =>
      predictRhythm(
        behaviorLogs.map((l) => ({ timestamp: l.timestamp, intensity: l.intensity })),
        Date.now(),
        { ageYears }
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [behaviorLogs.length, ageYears],
  );

  const loggedTodayCount = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return behaviorLogs.filter(
      (l) => new Date(l.timestamp).getTime() >= start.getTime()
    ).length;
  }, [behaviorLogs]);

  const recent7d = useMemo(() => {
    const cutoff = Date.now() - 7 * 86_400_000;
    return behaviorLogs.filter((l) => new Date(l.timestamp).getTime() >= cutoff).length;
  }, [behaviorLogs]);

  // TJB-03: the preview runs the SAME gated engine RhythmCue runs — the
  // parent's saved prefs + today's shown count are passed in, so the "next
  // nudge" shows what will actually fire, not what the engine could.
  const shownToday = useMemo(() => shownNudgesToday(), []);
  const nudge = useMemo(
    () =>
      nextNudge(
        {
          nowMs: Date.now(),
          rhythm,
          loggedToday: loggedTodayCount,
          recent7d,
          childName: firstName,
          shownToday,
        },
        prefs,
      ),
    [rhythm, loggedTodayCount, recent7d, firstName, prefs, shownToday],
  );
  const [now] = useState(() => new Date());
  const shown = Math.min(shownToday.length, NUDGE_DAILY_CEILING);
  const free = NUDGE_DAILY_CEILING - shown;

  // ── Persist helper ──────────────────────────────────────────────────────────
  const persist = useCallback((next: JitaiPrefs) => {
    setPrefs(next);
    savePrefs(next);
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1800);
  }, []);

  const toggleType = (key: NudgeTypeKey) => {
    persist({ ...prefs, types: { ...prefs.types, [key]: !prefs.types[key] } });
  };
  const setQuietStart = (h: number) => persist({ ...prefs, quietStart: h });
  const setQuietEnd = (h: number) => persist({ ...prefs, quietEnd: h });
  const toggleCalmWindow = () => persist({ ...prefs, calmWindowOnly: !prefs.calmWindowOnly });

  const switchWords = { on: v10.remOn, off: v10.remOff };
  const stops: GuideStop[] = [
    { id: "sr-today", title: v10.remToday, sub: v10.remTodaySub },
    { id: "sr-kinds", title: t("sr.types.heading"), sub: v10.remKindsSub },
    { id: "sr-delivery", title: t("elev.sr.delivery.heading"), sub: v10.remDeliveryStopSub },
  ];

  /* MAX-2 CONTRACT — always visible (AC-5). The sentence, then today's live count on its own line.
     On desktop it closes the stage (beside the two slots it describes); on the phone it follows the switches (B-OCCL-01). */
  const contract = <div className="nx-ex sr-contract" data-testid="sr-max2-contract" role="note" aria-label={t("sr.max2")}>
    <b>{t("sr.max2")}</b>
    <span className="sr-contract-count" data-testid="sr-max2-count">{t("sr.max2.count", { n: shown })}</span>
  </div>;

  // ── Stop 1 · today on the arc: the next nudge (or none), the two slots, the contract ──
  const bells = <span className="line nx-bells" aria-hidden="true">
    {Array.from({ length: NUDGE_DAILY_CEILING }, (_, i) => <span key={i} className={i < shown ? "nx-bell lg" : "nx-bell free lg"}><Icon name="notifications" size={24} /></span>)}
  </span>;
  const today = <Scene field="now" className={desk ? "x8 sr-stage" : "sr-stage"}
    orbs={desk ? [{ size: 420, left: -240, bottom: -280, opacity: 0.6 }, { size: 360, right: -170, top: -230, opacity: 0.7, b: true }] : [{ size: 240, left: -160, bottom: -150, opacity: 0.55 }, { size: 220, right: -120, top: -130, opacity: 0.65, b: true }]}>
    <div className="line between sr-stage-head">
      <span className="gsec"><h1 className="kicker">{t("sr.title")}</h1><StartHere>{v10.startHere}</StartHere></span>
    </div>
    <NowDayArc composition={composition} now={now} quietStart={prefs.quietStart} quietEnd={prefs.quietEnd} evening={false} copy={v10}>
      <div className="sr-face" data-module="reminders-contract">
        {/* NEXT NUDGE (AC-1): what the gated engine would show next, or nothing. */}
        <div data-testid="sr-next-nudge" aria-label={t("sr.nextNudge.label")} className="sr-next">
          <p className="nw-face-tag"><Icon name={nudge ? "notifications" : "notifications_off"} size={15} />{t("sr.nextNudge.label")}</p>
          {nudge ? <>
            <p className="hero sr-hero">{t(KIND_KEY[nudge.kind] ?? "sr.nextNudge.kind.prep")}</p>
            <p className="sr-sub" dir="auto">{t(nudge.headlineKey, nudge.vars)}</p>
          </> : <p className="hero sr-hero">{t("sr.nextNudge.none")}</p>}
        </div>
        <div className="line sr-slots">
          {bells}
          {/* ENG-02: the contract is a live count, not a promise. */}
          <Fig size="md" n={shown} unit={v10.remShown(NUDGE_DAILY_CEILING)} sub={free === NUDGE_DAILY_CEILING ? v10.remBothFree : free > 0 ? v10.remOneFree : v10.remNoneFree} />
        </div>
      </div>
    </NowDayArc>
    {desk && <div className="sr-stage-foot"><p className="sr-subtitle">{t("sr.subtitle")}</p>{contract}</div>}
  </Scene>;

  // ── Stop 2 · nudge types and when Arbor may reach you (the prefs module, operated in place) ──
  // B-OCCL-01: on the phone the subtitle follows the switches, so the first switch (the move) clears the capture dock at 375 × 812.
  const kinds = <div className="sr-kinds" data-module="reminders-prefs">
    {NUDGE_TYPES.map(({ key, labelKey, descKey }, i) => {
      const on = prefs.types[key];
      return <div key={key} className={on ? "nx-ctl" : "nx-ctl off"} data-testid={`sr-toggle-${key}`}>
        <span><b>{t(labelKey)}</b><span className="d">{t(descKey)}</span></span>
        <Toggle on={on} onToggle={() => toggleType(key)} label={t(labelKey)} words={switchWords} stamped={i === 0} />
      </div>;
    })}
    {!desk && <p className="sr-subtitle">{t("sr.subtitle")}</p>}
    {!desk && contract}
    {/* QUIET HOURS (AC-3) and CALM-WINDOW SCHEDULING (AC-4), in place */}
    <div className="nx-ex sr-when">
      <div className="line" style={{ gap: 10 }}>
        <span className="nx-ico sr-when-ico" aria-hidden="true"><Icon name="schedule" size={22} /></span>
        <span><b className="sr-when-title">{t("elev.sr.more.title")}</b><span className="small">{t("elev.sr.more.sub")}</span></span>
      </div>
      <p className="small sr-quiet-desc">{t("sr.quiet.desc")}</p>
      <div className="line sr-quiet" style={{ gap: 10 }}>
        <HourSelect id="sr-quiet-start" label={t("sr.quiet.start")} value={prefs.quietStart} uiLang={uiLang} onChange={setQuietStart} />
        <HourSelect id="sr-quiet-end" label={t("sr.quiet.end")} value={prefs.quietEnd} uiLang={uiLang} onChange={setQuietEnd} />
      </div>
      <p className="sr-summary" data-testid="sr-quiet-summary">
        {t("sr.quiet.summary", { start: formatHour(prefs.quietStart, uiLang), end: formatHour(prefs.quietEnd, uiLang) })}
      </p>
      <div className={prefs.calmWindowOnly ? "nx-ctl sr-calm" : "nx-ctl sr-calm off"} data-testid="sr-calm-window-row">
        <span><b>{t("sr.calm.label")}</b><span className="d">{t("sr.calm.desc")}</span></span>
        <Toggle on={prefs.calmWindowOnly} onToggle={toggleCalmWindow} label={t("sr.calm.label")} words={switchWords} />
      </div>
    </div>
    {savedFlash && <p className="sr-saved" role="status" aria-live="polite" data-testid="sr-saved-flash"><Icon name="check_circle" size={16} />{t("sr.saved")}</p>}
  </div>;

  // ── Stop 3 · delivery (B-TODAY-16): in the app, phone reminders, the weekly email ──
  const delivery = <div data-module="reminders-delivery" className="sr-delivery">
    <div className="nx-ch">
      <div className="live"><Icon name="grid_view" size={26} /><b>{v10.remInApp}</b>{v10.remInAppSub}<span className="nx-on"><i aria-hidden="true" />{v10.remOn}</span></div>
    </div>
    {/* One mount app-wide (state from hooks/usePushPriming); honest states (lib/pushPriming: "Arbor sends nothing" while pushCapable() is false). */}
    <PushPrimingCard capable={push.capable} permission={push.permission} registered={push.registered} pending={push.pending} onToggle={push.onToggle} />
    {/* v3 F-NOW-3: the weekly-report email opt-in (its own store, recapEmail.ts; fail-closed channel). */}
    <WeeklyEmailRow childFirst={firstName} />
  </div>;
  const know = <NowWorthKnowing lang={lang} kicker={v10.worthKnowing} readMinutes={NOW_COPY[lang].readMinutes} composition={composition} now={now} cardId="transitions-warnings" source="smart-reminders" />;

  return (
    <DsRoot composition={composition} className="now-v10 sr-v10" dir={lang === "he" ? "rtl" : "ltr"}>
      <Guide stops={stops} mini={!desk} label={v10.onThisPage} />
      <Route composition={composition} tight={!desk}>
        <RouteSection id="sr-today" n={1} on>
          {desk ? <Row12>
            {today}
            <aside className="siderail cards x4 sr-rail" id="sr-kinds" aria-labelledby="sr-kinds-title">
              <div className="rh"><span className="rstop inline" aria-hidden="true">2</span><h2 className="h3" id="sr-kinds-title">{t("sr.types.heading")}</h2></div>
              {kinds}
            </aside>
          </Row12> : today}
        </RouteSection>
        {!desk && <RouteSection id="sr-kinds" n={2} aria-labelledby="sr-kinds-title">
          <div className="rhead"><h2 className="h3" id="sr-kinds-title">{t("sr.types.heading")}</h2></div>
          {kinds}
        </RouteSection>}
        <RouteSection id="sr-delivery" n={3} aria-labelledby="sr-delivery-title" stopTop={desk ? 2 : 14}>
          {/* Delivery is named once: the tile's head on desktop, the section head on the phone. */}
          {!desk && <div className="rhead"><h2 className="h3" id="sr-delivery-title">{t("elev.sr.delivery.heading")}</h2><span className="small">{v10.remDeliverySub}</span></div>}
          {desk ? <Row12><Tile icon="link" title={t("elev.sr.delivery.heading")} titleId="sr-delivery-title" sub={v10.remDeliverySub} className="x8 sr-delivery-tile">{delivery}</Tile>{know}</Row12>
            : <><section className="vt sr-delivery-tile" aria-labelledby="sr-delivery-title">{delivery}</section>{know}</>}
        </RouteSection>
      </Route>
    </DsRoot>
  );
}

// ── Hour picker (a real <select>, drawn as the board's "Start: 9pm") ─────────
function HourSelect({ id, label, value, uiLang, onChange }: { id: string; label: string; value: number; uiLang: "en" | "he"; onChange: (h: number) => void }) {
  // The select covers the whole 44 px field (transparent), so the drawn "Start: 9pm" is the touch target.
  return <label className="nx-sel grow" htmlFor={id}>
    <span><small>{label}</small><span className="nx-sel-v" aria-hidden="true">{formatHour(value, uiLang)}</span>
      <select id={id} value={value} onChange={(e) => onChange(Number(e.target.value))} data-testid={id} aria-label={`${label}: ${formatHour(value, uiLang)}`}>
        {HOUR_OPTIONS.map((h) => <option key={h} value={h}>{formatHour(h, uiLang)}</option>)}
      </select>
    </span>
    <Icon name="expand_more" size={20} />
  </label>;
}

// ── Toggle switch ─────────────────────────────────────────────────────────────
function Toggle({ on, onToggle, label, words, stamped = false }: {
  on: boolean;
  onToggle: () => void;
  label: string;
  /** The state in words beside the track (V77: a switch says On or Off). */
  words: { on: string; off: string };
  /** B-OCCL-01: the route's primary-move stamp goes on the FIRST switch. */
  stamped?: boolean;
}) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={onToggle} {...(stamped ? PREFS_STAMP : undefined)} className="sr-switch">
      <span className={on ? "nx-sw" : "nx-sw off"} aria-hidden="true" />
      <span className="sr-switch-word" aria-hidden="true">{on ? words.on : words.off}</span>
    </button>
  );
}

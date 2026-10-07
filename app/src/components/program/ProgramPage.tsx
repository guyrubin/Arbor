import React, { useEffect, useMemo, useState } from "react";
import { Icon } from "../ui/Icon";
import { Modal } from "../ui/Modal";
import { Sheet, useCompactSurface } from "../ui/Sheet";
import { useLanguage } from "../../context/LanguageContext";
import { useArbor } from "../../context/ArborContext";
import { useChildCollection } from "../../hooks/useChildCollection";
import { useObservations } from "../../hooks/useObservations";
import { goToRoute } from "../../hooks/useHashQuery";
import { ShelfGlyph } from "../loop/ShelfGlyph";
import { ageMonthsOf } from "../../lib/age/forChild";
import { formatAgeMonths } from "../../lib/age/format";
import type { SleepLogEntry } from "../../types";
import { GUIDED_TIER_COACH, guidedTierOn } from "../../lib/entitlementsGuided";
import CoachSessions, { agreeToTry, type CoachSessionDoc } from "./CoachSessions";
import {
  captureBaseline,
  enrolInProgram,
  finishEnrolment,
  pauseEnrolment,
  resumeEnrolment,
  setEnrolmentNote,
  type ProgramEnrolment,
} from "../../lib/programs/enrolment";
import { programWeekMeasures } from "../../lib/programs/measures";
import {
  programPacketLine,
  programPageModel,
  startablePrograms,
  type ProgramCount,
  type ProgramPageModel,
  type StartableProgram,
} from "../../lib/programPage";

/** The page's ONE stamp literal (surfaceContract residue: route `program`, primaryMove do-this-week). */
const PROGRAM_STAMP = { "data-primary-move": "do-this-week" } as const;

const CARD: React.CSSProperties = {
  background: "var(--arbor-paper-elevated)",
  border: "1px solid var(--arbor-rule)",
  borderRadius: "var(--r-lg)",
  boxShadow: "var(--shadow-xs)",
};

const PRIMARY: React.CSSProperties = { background: "var(--gradient-cta)", color: "var(--arbor-on-accent)" };
const QUIET: React.CSSProperties = { background: "var(--arbor-paper-deep)", color: "var(--arbor-ink)" };

export interface ProgramPageViewProps {
  childName: string;
  /** The enrolled program (active or paused), or null → the quiet "No program running" page. */
  model: ProgramPageModel | null;
  /** The programs the quiet page offers (enrolInProgram). */
  startable: StartableProgram[];
  /** The professional's packet line (lib/programPage programPacketLine), plain text. */
  packetLine: string;
  onBack: () => void;
  onDoToday: () => void;
  onResume: () => void;
  onPause: () => void;
  onFinish: () => void;
  onEnrol: (programId: string) => void;
  /** B-PROG-07 seam: the family's goals, rendered inside the counts module. */
  goals?: React.ReactNode;
  /** B-PROG-10 seam: the guided tier's coach sessions, rendered inside the weeks module (absent when the flag is off). */
  coach?: React.ReactNode;
}

function CountRow({ c, week }: { c: ProgramCount; week: number }) {
  const { t } = useLanguage();
  const sub = [
    c.id === "dose" ? t("elev.program.counts.thisWeek") : "",
    c.from !== null ? t(`elev.program.counts.from.${c.measureId}`, { n: c.from }) : "",
    c.lastWeek !== null && week > 1 ? t("elev.program.counts.lastWeek", { n: c.lastWeek }) : "",
  ].filter(Boolean).join(" · ");
  return (
    <div data-testid="program-count" data-count={c.id} className="flex items-baseline gap-3 border-t py-3 first:border-t-0" style={{ borderColor: "var(--arbor-rule)" }}>
      <dt className="min-w-0 flex-1 t-base font-semibold leading-snug" style={{ color: "var(--arbor-ink)" }}>
        {c.label}
        {sub && <span className="block t-sm font-normal" style={{ color: "var(--arbor-muted)" }}>{sub}</span>}
      </dt>
      <dd className="flex flex-none flex-col items-end text-end">
        {c.value === null ? (
          <span data-testid="program-count-none" className="t-sm" style={{ color: "var(--arbor-muted)" }}>{t("elev.program.counts.none")}</span>
        ) : (
          <span data-testid="program-count-value" className="t-xl font-semibold leading-none tabular-nums" style={{ color: "var(--arbor-ink)" }}>
            <bdi>{c.value}</bdi>
          </span>
        )}
        {c.baseline !== null && (
          <span data-testid="program-count-baseline" className="mt-1 t-sm tabular-nums" style={{ color: "var(--arbor-muted)" }}>
            {t("elev.program.counts.firstWeek", { n: c.baseline })}
          </span>
        )}
      </dd>
    </div>
  );
}

/**
 * B-PROG-05 — the program page (`#/development?view=program`: a mode of the
 * Growth leaf until lib/routes.ts gains the `program` id — REJECTIONS
 * P6-PRACTICE session A). Shelf-page register (art/mockups/journal-shelves.html
 * phone 2): back link · 44 px glyph + "{Program} · week {n} of {N}" · ONE
 * band holding the week's skill (display face, the sentence that matters) on
 * a flat caption, and the ONE primary move — the page's only gradient · three labelled counts,
 * each beside the family's OWN first week in muted ink (no bar, no arrow, no
 * colour, no %) · the week list (done = plain rows, current open, future =
 * titles only) · Pause · Finish behind a confirm sheet · "What the
 * professional sees" → the packet line as plain text.
 *
 * Three modules: program-week · program-counts · program-weeks.
 * Not enrolled → the quiet page: one sentence and the two programs' Start.
 */
export function ProgramPageView({
  childName,
  model,
  startable,
  packetLine,
  onBack,
  onDoToday,
  onResume,
  onPause,
  onFinish,
  onEnrol,
  goals,
  coach,
}: ProgramPageViewProps) {
  const { t } = useLanguage();
  const compact = useCompactSurface();
  const [confirm, setConfirm] = useState<"toPause" | "toFinish" | null>(null);
  const ageT = (k: string, v?: Record<string, number>) => t(k, v);

  const back = (
    <button
      type="button"
      data-testid="program-back"
      onClick={onBack}
      className="-ms-1 inline-flex min-h-11 items-center gap-1 px-1 t-sm font-bold focus:outline-none focus-visible:ring-2"
      style={{ color: "var(--arbor-muted)" }}
    >
      <Icon name="arrow_back" size={18} aria-hidden className="rtl:-scale-x-100" />
      {t("elev.program.back")}
    </button>
  );

  if (!model) {
    const stampAt = startable.findIndex((p) => p.canEnrol);
    return (
      <div data-testid="program-page" data-state="none" className="mx-auto flex w-full min-w-0 max-w-[720px] flex-col gap-4">
        <header data-module="program-week" className="min-w-0">
          {back}
          <h1 className="mt-1 t-2xl leading-tight tracking-[-0.02em]" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}>
            {t("elev.program.none.title")}
          </h1>
          <p data-testid="program-none-lede" className="mt-2 t-base leading-relaxed" style={{ color: "var(--arbor-muted)" }}>{t("elev.program.none.lede")}</p>
        </header>
        <section data-module="program-choices" className="flex min-w-0 flex-col gap-3">
          {startable.map((p, i) => (
            <article key={p.id} data-testid="program-choice" data-program-id={p.id} className="p-4" style={CARD}>
              <div className="flex items-center gap-3">
                <ShelfGlyph shelf={p.shelf} size={40} />
                <div className="min-w-0">
                  <h2 className="t-lg font-semibold leading-snug" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}>{p.name}</h2>
                  <p className="t-sm" style={{ color: "var(--arbor-muted)" }}>
                    {t("elev.program.none.weeks", { n: p.weeks })}
                    {" · "}
                    {t("elev.program.none.builtFor", { from: formatAgeMonths(p.builtFor.fromMonths, ageT), to: formatAgeMonths(p.builtFor.toMonths, ageT) })}
                  </p>
                </div>
              </div>
              <p className="mt-2 t-sm leading-relaxed" style={{ color: "var(--arbor-ink-soft)" }}>{p.describedAs}</p>
              {p.canEnrol ? (
                <button
                  type="button"
                  data-testid="program-start"
                  onClick={() => onEnrol(p.id)}
                  {...(i === stampAt ? PROGRAM_STAMP : {})}
                  className="mt-3 inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full px-5 t-sm font-extrabold focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
                  style={i === stampAt ? PRIMARY : QUIET}
                >
                  <Icon name="play_arrow" size={18} aria-hidden />
                  {t("elev.program.none.start", { program: p.name })}
                </button>
              ) : (
                <p data-testid="program-from-age" className="mt-3 t-sm" style={{ color: "var(--arbor-muted)" }}>
                  {t("elev.program.none.fromAge", { age: formatAgeMonths(p.enrolFromMonths, ageT) })}
                </p>
              )}
            </article>
          ))}
        </section>
      </div>
    );
  }

  const paused = model.status === "paused";
  const confirmTitle = confirm ? t(`elev.program.confirm.${confirm}.title`, { program: model.name }) : "";
  const confirmBody = confirm === "toPause"
    ? t("elev.program.confirm.toPause.body")
    : t("elev.program.confirm.toFinish.body", { name: childName });
  const confirmBox = confirm && (
    <div data-testid="program-confirm" data-confirm={confirm} className="flex flex-col gap-3">
      <p className="t-base leading-relaxed" style={{ color: "var(--arbor-ink-soft)" }}>{confirmBody}</p>
      <button
        type="button"
        data-testid="program-confirm-yes"
        onClick={() => { const which = confirm; setConfirm(null); if (which === "toPause") onPause(); else onFinish(); }}
        className="inline-flex min-h-11 items-center justify-center rounded-full px-5 t-sm font-bold"
        style={{ background: "var(--arbor-ink)", color: "var(--arbor-on-accent)" }}
      >
        {t(`elev.program.confirm.${confirm}.yes`)}
      </button>
      <button
        type="button"
        data-testid="program-confirm-cancel"
        onClick={() => setConfirm(null)}
        className="inline-flex min-h-11 items-center justify-center rounded-full px-5 t-sm font-bold"
        style={QUIET}
      >
        {t("elev.program.confirm.cancel")}
      </button>
    </div>
  );

  return (
    <div data-testid="program-page" data-state={model.status} data-program-id={model.programId} className="mx-auto flex w-full min-w-0 max-w-[720px] flex-col gap-4">
      <section data-module="program-week" className="flex min-w-0 flex-col gap-3">
        <header className="min-w-0">
          {back}
          <div className="mt-1 flex items-center gap-3">
            <ShelfGlyph shelf={model.shelf} size={44} />
            <div className="min-w-0">
              <h1 data-testid="program-header" className="t-2xl leading-tight tracking-[-0.02em]" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}>
                {t("elev.program.header", { program: model.name, n: model.week, total: model.weeks })}
              </h1>
              <p className="t-sm" style={{ color: "var(--arbor-muted)" }}>
                {paused ? t("elev.program.paused", { n: model.week }) : model.describedAs}
              </p>
            </div>
          </div>
        </header>
        <article data-testid="program-week-band" className="overflow-hidden" style={CARD}>
          {/* The band's caption is a FLAT fill: the page's ONE gradient is the
              primary move's control below (primaryMove.gradient ratchet). */}
          <p className="px-4 py-2.5 t-sm font-bold" style={{ background: "var(--arbor-paper-deep)", color: "var(--arbor-muted)" }}>{t("elev.program.week.caption")}</p>
          <div className="px-4 pb-4 pt-3">
            <h2 data-testid="program-skill" className="t-lg font-semibold leading-snug" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}>
              <bdi dir="auto">{model.skill}</bdi>
            </h2>
            {!paused && <p className="mt-2 t-sm" style={{ color: "var(--arbor-muted)" }}>{t("elev.program.week.doSub")}</p>}
            <button
              type="button"
              data-testid={paused ? "program-resume" : "program-do-today"}
              onClick={paused ? onResume : onDoToday}
              {...PROGRAM_STAMP}
              className="mt-3 inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full px-5 t-sm font-extrabold focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
              style={PRIMARY}
            >
              <Icon name={paused ? "play_arrow" : "today"} size={18} aria-hidden />
              {paused ? t("elev.program.resume", { n: model.week }) : t("elev.program.week.do")}
            </button>
          </div>
        </article>
      </section>

      <section data-module="program-counts" aria-labelledby="program-counts-title" className="min-w-0">
        <h2 id="program-counts-title" className="t-sm font-bold" style={{ color: "var(--arbor-muted)" }}>{t("elev.program.counts.title")}</h2>
        <p data-testid="program-counts-note" className="mt-1 t-sm" style={{ color: "var(--arbor-muted)" }}>
          {model.week > 1 ? t("elev.program.counts.note") : t("elev.program.counts.firstWeekNote")}
        </p>
        <dl data-testid="program-counts" className="mt-2 px-4" style={CARD}>
          {model.counts.map((c) => <CountRow key={c.id} c={c} week={model.week} />)}
        </dl>
        <details data-testid="program-pro" className="mt-3">
          <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 t-sm font-bold" style={{ color: "var(--arbor-ink)" }}>
            <Icon name="visibility" size={18} aria-hidden />
            {t("elev.program.pro.door")}
            <Icon name="expand_more" size={18} aria-hidden className="ms-auto" style={{ color: "var(--arbor-muted)" }} />
          </summary>
          <p className="t-sm" style={{ color: "var(--arbor-muted)" }}>{t("elev.program.pro.note")}</p>
          <p data-testid="program-packet-line" className="mt-2 border-s-2 ps-3 t-sm leading-relaxed" style={{ borderColor: "var(--arbor-rule-strong)", color: "var(--arbor-ink-soft)" }}>
            <bdi dir="auto">{packetLine}</bdi>
          </p>
        </details>
        {goals}
      </section>

      <section data-module="program-weeks" aria-labelledby="program-weeks-title" className="min-w-0">
        <h2 id="program-weeks-title" className="t-sm font-bold" style={{ color: "var(--arbor-muted)" }}>{t("elev.program.weeks.title")}</h2>
        <ol className="mt-2">
          {model.weekRows.map((w) => (
            <li
              key={w.n}
              data-testid="program-week-row"
              data-week={w.n}
              data-state={w.state}
              className="border-t py-2.5 first:border-t-0"
              style={{ borderColor: "var(--arbor-rule)" }}
            >
              <p className="t-sm" style={{ color: w.state === "future" ? "var(--arbor-muted)" : "var(--arbor-ink-soft)" }}>
                <span className="font-semibold">{t("elev.program.weeks.row", { n: w.n })}</span>
                {" · "}
                <bdi dir="auto">{w.title}</bdi>
                {w.state === "current" && <>{" · "}<span className="font-bold" style={{ color: "var(--arbor-ink)" }}>{t("elev.program.weeks.now")}</span></>}
              </p>
              {w.state === "current" && (
                <p data-testid="program-week-open" className="mt-1 t-base leading-snug" style={{ color: "var(--arbor-ink)" }}><bdi dir="auto">{w.skill}</bdi></p>
              )}
            </li>
          ))}
        </ol>
        {coach}
        <div className="mt-3 flex gap-2">
          {!paused && (
            <button type="button" data-testid="program-pause" onClick={() => setConfirm("toPause")} className="inline-flex min-h-11 items-center rounded-full px-4 t-sm font-bold" style={QUIET}>
              {t("elev.program.pause")}
            </button>
          )}
          <button type="button" data-testid="program-finish" onClick={() => setConfirm("toFinish")} className="inline-flex min-h-11 items-center rounded-full px-4 t-sm font-bold" style={QUIET}>
            {t("elev.program.finish")}
          </button>
        </div>
      </section>

      {confirm && (compact
        ? <Sheet open onClose={() => setConfirm(null)} title={confirmTitle}>{confirmBox}</Sheet>
        : <Modal open onClose={() => setConfirm(null)} title={confirmTitle}>{confirmBox}</Modal>)}
    </div>
  );
}

/**
 * The container: reads the child's `programs` enrolments, the practice dose
 * rows (actionLoop), the sleep diary and the observations, and writes ONLY the
 * enrolment documents the B-PROG-01 engine returns (enrol · pause · resume ·
 * finish · the once-only first-week baseline). Zero model calls.
 */
export default function ProgramPage() {
  const { uiLang, t } = useLanguage();
  const lang: "en" | "he" = uiLang === "he" ? "he" : "en";
  const { childProfile, actionLoop } = useArbor();
  const childId = childProfile.id;
  const programs = useChildCollection<ProgramEnrolment>(childId, "programs");
  const sleepLogs = useChildCollection<SleepLogEntry & { id: string }>(childId, "sleepLogs");
  const observations = useObservations();
  // B-PROG-10: the guided tier (flag off → no coach surface at all).
  const coachSessions = useChildCollection<CoachSessionDoc>(childId, "coachSessions");
  const [guided] = useState(() => guidedTierOn());
  const [now] = useState(() => new Date());
  const inputs = useMemo(
    () => ({ childId, actionLoops: actionLoop, sleepLogs: sleepLogs.items, observations }),
    [childId, actionLoop, sleepLogs.items, observations],
  );
  const model = useMemo(
    () => programPageModel(programs.items, inputs, now, lang, childProfile.gender ?? null),
    [programs.items, inputs, now, lang, childProfile.gender],
  );
  const months = ageMonthsOf(childProfile);
  const startable = useMemo(() => startablePrograms(Number.isFinite(months) ? months : null, lang), [months, lang]);
  const packetLine = model ? programPacketLine(model, t) : "";

  // The family's own first-week child count, captured once when week 1 has closed.
  useEffect(() => {
    if (!model || model.week < 2 || model.enrolment.baseline?.childProxy !== null) return;
    const first = programWeekMeasures(model.enrolment, 1, inputs)?.childProxy?.value;
    if (typeof first !== "number") return;
    const next = captureBaseline(model.enrolment, first, new Date());
    if (next !== model.enrolment) void programs.upsert(next);
  }, [model, inputs, programs]);

  const firstName = (childProfile.name || "").split(" ")[0];
  return (
    <ProgramPageView
      childName={firstName}
      model={model}
      startable={startable}
      packetLine={packetLine}
      onBack={() => goToRoute("development")}
      onDoToday={() => goToRoute("overview")}
      onResume={() => {
        if (!model) return;
        const r = resumeEnrolment(programs.items, model.enrolment, new Date());
        if ("enrolment" in r) void programs.upsert(r.enrolment);
      }}
      onPause={() => { if (model) void programs.upsert(pauseEnrolment(model.enrolment, new Date())); }}
      onFinish={() => { if (model) void programs.upsert(finishEnrolment(model.enrolment, new Date())); }}
      onEnrol={(programId) => {
        const r = enrolInProgram(programs.items, programId, new Date());
        if ("enrolment" in r) void programs.upsert(r.enrolment);
      }}
      coach={model && guided ? (
        <CoachSessions
          coach={GUIDED_TIER_COACH}
          enrolment={model.enrolment}
          sessions={coachSessions.items}
          now={now}
          onBook={(url) => {
            try {
              window.open(url, "_blank", "noopener,noreferrer");
            } catch {
              /* SSR / tests */
            }
          }}
          onSave={(doc) => void coachSessions.upsert(doc)}
          onAgree={(doc, text) => {
            const kept = agreeToTry(doc, text, new Date());
            if (kept === doc) return;
            void coachSessions.upsert(kept);
            // the family's line is also a practice note on the enrolment
            void programs.upsert(setEnrolmentNote(model.enrolment, `coach-${doc.slot}`, kept.agreed ?? "", new Date()));
          }}
        />
      ) : undefined}
    />
  );
}

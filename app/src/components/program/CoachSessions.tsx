import React, { useState } from "react";
import { Icon } from "../ui/Icon";
import { useLanguage } from "../../context/LanguageContext";
import { fmtDay } from "../../lib/formatDate";
import { dayKey, type ProgramEnrolment } from "../../lib/programs/enrolment";
import type { GuidedTierCoach } from "../../lib/entitlementsGuided";

/**
 * B-PROG-10 — the guided tier on the program page (E3): "Your coach: {name}"
 * and four session slots (week 1 kick-off · week 3 · week 6 · wrap-up). "Book"
 * opens the coach's external scheduling link in the browser (never a dead
 * button, no in-app calendar); the PARENT writes the day it is booked for
 * ("Booked for {date}") to the child's `coachSessions` sub-collection; once the
 * day has passed, one line asks "What did you agree to try?" and the family's
 * words are kept (on the session doc and as a practice note on the
 * enrolment). The coach sees nothing here; zero model calls.
 *
 * Rendered ONLY when the tier is on (lib/entitlementsGuided guidedTierOn) —
 * the page passes nothing at all when it is off.
 */

export type CoachSlotId = "kickoff" | "week3" | "week6" | "wrapup";
export const COACH_SLOTS: readonly CoachSlotId[] = ["kickoff", "week3", "week6", "wrapup"];

/** users/{uid}/children/{childId}/coachSessions/{id} — one per enrolment per slot. */
export interface CoachSessionDoc {
  /** `${enrolmentId}.${slot}` */
  id: string;
  enrolmentId: string;
  programId: string;
  slot: CoachSlotId;
  /** LOCAL day key (YYYY-MM-DD) the parent says it is booked for. */
  bookedFor: string;
  /** What the family agreed to try, in their words (after the session). */
  agreed?: string;
  createdAt: string;
  updatedAt: string;
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;
export const coachSessionId = (enrolmentId: string, slot: CoachSlotId): string => `${enrolmentId}.${slot}`;

/** The doc to write when the parent says which day a slot is booked for (null for an invalid day). */
export function bookCoachSession(
  enrolment: Pick<ProgramEnrolment, "id" | "programId">,
  slot: CoachSlotId,
  bookedFor: string,
  existing: CoachSessionDoc | undefined,
  now: Date = new Date(),
): CoachSessionDoc | null {
  if (!DATE.test(bookedFor) || !COACH_SLOTS.includes(slot)) return null;
  const iso = now.toISOString();
  return {
    ...(existing ?? {}),
    id: coachSessionId(enrolment.id, slot),
    enrolmentId: enrolment.id,
    programId: enrolment.programId,
    slot,
    bookedFor,
    createdAt: existing?.createdAt ?? iso,
    updatedAt: iso,
  };
}

/** The doc with the family's own line kept (verbatim, trimmed, ≤ 300 chars); empty text changes nothing. */
export function agreeToTry(doc: CoachSessionDoc, text: string, now: Date = new Date()): CoachSessionDoc {
  const value = text.replace(/\s+/g, " ").trim().slice(0, 300);
  return value ? { ...doc, agreed: value, updatedAt: now.toISOString() } : doc;
}

/** The session's day has passed (the "What did you agree to try?" line opens the day after). */
export const sessionHeld = (doc: Pick<CoachSessionDoc, "bookedFor">, now: Date = new Date()): boolean =>
  DATE.test(doc.bookedFor) && doc.bookedFor < dayKey(now);

export interface CoachSessionsProps {
  coach: GuidedTierCoach;
  enrolment: Pick<ProgramEnrolment, "id" | "programId">;
  sessions: readonly CoachSessionDoc[];
  now?: Date;
  /** Opens the booking link (the container: window.open, noopener). */
  onBook: (url: string) => void;
  onSave: (doc: CoachSessionDoc) => void;
  /** The family's agreed line → a practice note on the enrolment (and the session doc). */
  onAgree: (doc: CoachSessionDoc, text: string) => void;
  /** B-PROG-07 seam: offer the agreed line as one of the family's hopes. */
  onMakeGoal?: (text: string) => void;
}

const QUIET: React.CSSProperties = { background: "var(--arbor-paper-deep)", color: "var(--arbor-ink)" };
const FIELD: React.CSSProperties = { border: "1px solid var(--arbor-rule-strong)", borderRadius: "var(--r)", background: "var(--arbor-paper-elevated)", color: "var(--arbor-ink)" };

function SlotRow({ slot, doc, props }: { slot: CoachSlotId; doc: CoachSessionDoc | undefined; props: CoachSessionsProps }) {
  const { t, uiLang } = useLanguage();
  const lang = uiLang === "he" ? "he" : "en";
  const now = props.now ?? new Date();
  const [editing, setEditing] = useState(false);
  const [day, setDay] = useState(doc?.bookedFor ?? "");
  const [line, setLine] = useState("");
  const held = !!doc && sessionHeld(doc, now);
  const fieldId = `coach-${slot}-day`;
  const lineId = `coach-${slot}-agree`;
  return (
    <li data-testid="coach-slot" data-slot={slot} data-booked={doc ? "yes" : "no"} className="border-t py-3 first:border-t-0" style={{ borderColor: "var(--arbor-rule)" }}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="min-w-0 flex-1 t-sm font-semibold" style={{ color: "var(--arbor-ink)" }}>{t(`elev.program.coach.slot.${slot}`)}</span>
        {doc && !editing ? (
          <span data-testid="coach-booked" className="t-sm" style={{ color: "var(--arbor-ink-soft)" }}>
            {t("elev.program.coach.booked", { date: fmtDay(`${doc.bookedFor}T12:00:00`, lang) })}
          </span>
        ) : (
          <button
            type="button"
            data-testid="coach-book"
            onClick={() => { props.onBook(props.coach.bookingUrl); setEditing(true); }}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-4 t-sm font-bold"
            style={QUIET}
          >
            <Icon name="open_in_new" size={16} aria-hidden />
            {t("elev.program.coach.book")}
          </button>
        )}
      </div>
      {(editing || (!doc && day)) && (
        <div className="mt-2 flex flex-wrap items-end gap-2">
          <label htmlFor={fieldId} className="block w-full t-sm" style={{ color: "var(--arbor-muted)" }}>{t("elev.program.coach.when")}</label>
          <input id={fieldId} data-testid="coach-day" type="date" value={day} onChange={(e) => setDay(e.target.value)} className="min-h-11 px-3 t-sm" style={FIELD} />
          <button
            type="button"
            data-testid="coach-save"
            disabled={!DATE.test(day)}
            onClick={() => {
              const next = bookCoachSession(props.enrolment, slot, day, doc, new Date());
              if (next) { props.onSave(next); setEditing(false); }
            }}
            className="inline-flex min-h-11 items-center rounded-full px-4 t-sm font-bold disabled:opacity-60"
            style={{ background: "var(--arbor-ink)", color: "var(--arbor-on-accent)" }}
          >
            {t("elev.program.coach.save")}
          </button>
        </div>
      )}
      {doc && !editing && !held && (
        <button type="button" data-testid="coach-change" onClick={() => setEditing(true)} className="mt-1 inline-flex min-h-11 items-center t-sm font-semibold" style={{ color: "var(--arbor-muted)" }}>
          {t("elev.program.coach.change")}
        </button>
      )}
      {doc && held && (doc.agreed ? (
        <div data-testid="coach-agreed" className="mt-2">
          <p className="t-sm" style={{ color: "var(--arbor-muted)" }}>{t("elev.program.coach.agree.saved")}</p>
          <p className="mt-1 border-s-2 ps-3 leading-snug" style={{ borderColor: "var(--arbor-ink)", fontFamily: "var(--font-editorial)", fontSize: "var(--t-lg)", color: "var(--arbor-ink-soft)" }}>
            {"“"}<bdi dir="auto">{doc.agreed}</bdi>{"”"}
          </p>
          {props.onMakeGoal && (
            <button type="button" data-testid="coach-make-goal" onClick={() => props.onMakeGoal?.(doc.agreed!)} className="mt-1 inline-flex min-h-11 items-center t-sm font-semibold" style={{ color: "var(--arbor-ink)" }}>
              {t("elev.program.coach.makeGoal")}
            </button>
          )}
        </div>
      ) : (
        <div data-testid="coach-agree" className="mt-2 flex flex-wrap items-end gap-2">
          <label htmlFor={lineId} className="block w-full t-sm font-semibold" style={{ color: "var(--arbor-ink)" }}>{t("elev.program.coach.agree.q")}</label>
          <input id={lineId} data-testid="coach-agree-input" type="text" dir="auto" maxLength={300} value={line} onChange={(e) => setLine(e.target.value)} className="min-h-11 min-w-0 flex-1 px-3 t-sm" style={FIELD} />
          <button
            type="button"
            data-testid="coach-agree-save"
            disabled={!line.trim()}
            onClick={() => { props.onAgree(doc, line); setLine(""); }}
            className="inline-flex min-h-11 items-center rounded-full px-4 t-sm font-bold disabled:opacity-60"
            style={{ background: "var(--arbor-ink)", color: "var(--arbor-on-accent)" }}
          >
            {t("elev.program.coach.agree.save")}
          </button>
        </div>
      ))}
    </li>
  );
}

export default function CoachSessions(props: CoachSessionsProps) {
  const { t, uiLang } = useLanguage();
  const name = uiLang === "he" ? props.coach.name.he : props.coach.name.en;
  const bySlot = new Map(props.sessions.filter((s) => s.enrolmentId === props.enrolment.id).map((s) => [s.slot, s]));
  return (
    <div data-testid="coach-sessions" data-placeholder={props.coach.placeholder ? "yes" : "no"} className="mt-4 p-4" style={{ background: "var(--arbor-paper-elevated)", border: "1px solid var(--arbor-rule)", borderRadius: "var(--r-lg)" }}>
      <h3 data-testid="coach-name" className="t-base font-semibold" style={{ color: "var(--arbor-ink)" }}>{t("elev.program.coach.title", { name })}</h3>
      <p className="mt-1 t-sm" style={{ color: "var(--arbor-muted)" }}>{t("elev.program.coach.lede")}</p>
      <ol className="mt-2">
        {COACH_SLOTS.map((slot) => <SlotRow key={slot} slot={slot} doc={bySlot.get(slot)} props={props} />)}
      </ol>
    </div>
  );
}

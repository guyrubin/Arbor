import React from "react";
import { Token, type TokenKind, type TokenState } from "../../../design/primitives";
import type { Composition } from "../../../design/useComposition";
import type { ActiveTab } from "../../../lib/routes";
import type { ActionPlan, BehaviorLog, Milestone, MemoryReviewItem } from "../../../types";
import { appointmentStartMs, type Appointment } from "../../../lib/careTrack";
import { fmtDayV10 } from "../../../lib/formatDate";
import type { UiLang } from "../../../lib/i18n";
import { Icon } from "../../ui/Icon";
import type { CareV10Copy } from "./careV10Copy";

/* Care › Records (design V77, N-Records-D/M): the record by kind. One row per
   kind — moments, milestones seen, plan steps done, the notebook, visits —
   with its real count, its latest date and a way to where those records
   live. Counts only: every mark is one thing the parent recorded; nothing
   here grades the child. Read from the collections production already loads
   (no new storage). */

export type LedgerKind = "moments" | "milestones" | "plan" | "notebook" | "visits";

export type LedgerMark = { kind: TokenKind; state: TokenState; isNew?: boolean; day?: number };

export type LedgerRow = {
  kind: LedgerKind;
  count: number;
  /** The plain clause after the name ("3 hard", "2 past, 1 ahead"). */
  sub: string;
  /** The newest record's day (visits: the next one, else the last). */
  latestIso: string | null;
  /** Visits read "next" when one is booked ahead. */
  latestIsNext: boolean;
  /** The place those records live. */
  route: ActiveTab;
  marks: LedgerMark[];
};

/** At most this many marks per row; the figure always carries the whole count. */
export const LEDGER_MAX_MARKS = 24;

const ROUTES: Record<LedgerKind, ActiveTab> = {
  moments: "journal",
  milestones: "milestones",
  plan: "plans",
  notebook: "memory",
  visits: "appointments",
};

const newest = (isos: Array<string | null | undefined>): string | null =>
  isos.reduce<string | null>((best, iso) => (iso && (!best || iso > best) ? iso : best), null);

const tail = <T,>(items: T[]): T[] => (items.length > LEDGER_MAX_MARKS ? items.slice(items.length - LEDGER_MAX_MARKS) : items);

export function recordLedgerRows(input: {
  logs: BehaviorLog[];
  milestones: Milestone[];
  plans: ActionPlan[];
  remembered: MemoryReviewItem[];
  waiting: MemoryReviewItem[];
  appointments: Appointment[];
  nowMs: number;
  copy: CareV10Copy["records"];
}): LedgerRow[] {
  const { copy, nowMs } = input;

  // Moments: a hard moment is one recorded on the hard-moment sheet (it carries an intensity).
  const logs = [...input.logs].sort((a, b) => (a.timestamp < b.timestamp ? -1 : a.timestamp > b.timestamp ? 1 : 0));
  const hard = logs.filter((l) => l.intensity != null).length;
  const momentMarks = tail(logs).map<LedgerMark>((l, i, shown) => ({ kind: l.intensity != null ? "hard" : "moment", state: "solid", isNew: i === shown.length - 1 }));

  // Milestones the parent marked seen, and on how many branches.
  const seen = input.milestones.filter((m) => m.checked || m.observationStatus === "yes");
  const branches = new Set(seen.map((m) => m.domain)).size;

  // Plan steps: done ones solid, the next one "here", the rest open.
  const steps = input.plans.flatMap((p) => p.phases.flatMap((ph) => ph.steps));
  const done = steps.filter((s) => s.completed).length;
  const open = steps.length - done;
  const planMarks: LedgerMark[] = [];
  for (let i = 0; i < done; i++) planMarks.push({ kind: "plan", state: "solid" });
  for (let i = 0; i < open; i++) planMarks.push({ kind: "plan", state: i === 0 ? "here" : "open" });

  // The notebook: what the parent approved, and what still waits for them.
  const rememberedMarks: LedgerMark[] = [
    ...input.remembered.map<LedgerMark>(() => ({ kind: "neutral", state: "solid" })),
    ...input.waiting.map<LedgerMark>(() => ({ kind: "neutral", state: "ai" })),
  ];

  // Visits, in date order; the next one ahead, else the last one past.
  const dated = input.appointments
    .map((a) => ({ a, ms: appointmentStartMs(a) }))
    .filter((x): x is { a: Appointment; ms: number } => x.ms != null)
    .sort((x, y) => x.ms - y.ms);
  const ahead = dated.filter((x) => x.ms >= nowMs);
  const past = dated.filter((x) => x.ms < nowMs);
  const nextVisit = ahead[0] ?? null;
  const lastVisit = past[past.length - 1] ?? null;
  const visitAnchor = nextVisit ?? lastVisit;

  return [
    {
      kind: "moments",
      count: logs.length,
      sub: logs.length === 0 ? copy.ledgerNone : hard > 0 ? copy.ledgerHard(hard) : copy.ledgerMomentsSub,
      latestIso: newest(logs.map((l) => l.timestamp)),
      latestIsNext: false,
      route: ROUTES.moments,
      marks: momentMarks,
    },
    {
      kind: "milestones",
      count: seen.length,
      sub: seen.length === 0 ? copy.ledgerNone : copy.ledgerBranches(branches),
      latestIso: newest(seen.map((m) => m.observedAt ?? m.observationUpdatedAt)),
      latestIsNext: false,
      route: ROUTES.milestones,
      marks: tail(seen).map(() => ({ kind: "moment", state: "solid" })),
    },
    {
      kind: "plan",
      count: done,
      sub: steps.length === 0 ? copy.ledgerNone : copy.ledgerStillOpen(open),
      latestIso: null,
      latestIsNext: false,
      route: ROUTES.plan,
      marks: planMarks.slice(0, LEDGER_MAX_MARKS),
    },
    {
      kind: "notebook",
      count: input.remembered.length,
      sub: copy.ledgerNotebookSub(input.waiting.length),
      latestIso: newest(input.remembered.map((m) => m.createdAt)),
      latestIsNext: false,
      route: ROUTES.notebook,
      marks: rememberedMarks.slice(0, LEDGER_MAX_MARKS),
    },
    {
      kind: "visits",
      count: dated.length,
      sub: dated.length === 0 ? copy.ledgerNone : copy.ledgerVisitsSub(past.length, ahead.length),
      latestIso: visitAnchor ? new Date(visitAnchor.ms).toISOString() : null,
      latestIsNext: !!nextVisit,
      route: ROUTES.visits,
      marks: tail(dated).map((x) => ({ kind: "date", state: x.ms >= nowMs ? "open" : "solid", day: new Date(x.ms).getDate() })),
    },
  ];
}

export default function RecordLedger({ composition, rows, copy, uiLang, labelledBy, onOpen }: {
  composition: Composition;
  rows: LedgerRow[];
  copy: CareV10Copy["records"];
  uiLang: UiLang;
  labelledBy: string;
  onOpen: (route: ActiveTab) => void;
}) {
  const desk = composition === "desk";
  return (
    <div className="care-ledger" data-testid="records-ledger">
      <ul className={desk ? "shelf care-ledger-shelf" : "care-ledger-list"} aria-labelledby={labelledBy}>
        {rows.map((row) => {
          const name = copy.ledgerName[row.kind];
          const date = row.latestIso ? fmtDayV10(row.latestIso, uiLang) : null;
          const when = date ? (row.latestIsNext ? copy.ledgerNext(date) : copy.ledgerLatest(date)) : null;
          return (
            <li key={row.kind} className={desk ? "ledge care-ledge" : "care-ledger-row"} data-testid="records-ledger-row" data-kind={row.kind} data-count={row.count}>
              <button
                type="button"
                className="care-ledger-open"
                onClick={() => onOpen(row.route)}
                aria-label={[`${name}: ${row.count}`, row.sub, when, copy.ledgerOpen].filter(Boolean).join(", ")}
              >
                {!desk && <b className="care-ledger-n" aria-hidden="true">{row.count}</b>}
                <span className="care-ledger-body">
                  <span className={desk ? "on" : "pile line care-ledger-marks"} aria-hidden="true">
                    {row.marks.map((m, i) => (
                      <Token key={i} kind={m.kind} state={m.state} size={desk && m.kind !== "plan" ? "md" : "sm"} isNew={m.isNew} label="">
                        {m.day}
                      </Token>
                    ))}
                  </span>
                  {desk ? (
                    <span className="nm" aria-hidden="true">{name}<b>{row.count}</b></span>
                  ) : (
                    <span className="care-ledger-name" aria-hidden="true">{name} <span className="care-ledger-sub">· {row.sub}</span></span>
                  )}
                  {desk && <small className="care-ledger-sub" aria-hidden="true">{row.sub}</small>}
                  {when && <small className="care-ledger-when" data-testid="records-ledger-latest" aria-hidden="true">{when}</small>}
                </span>
                {!desk && <Icon name="chevron_right" size={18} className="rtl:-scale-x-100 care-ledger-chev" />}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

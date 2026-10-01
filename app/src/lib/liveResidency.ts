/**
 * B-ASKJB-02 — Live voice residency, stated truthfully on the data-use panel.
 *
 * Live HD mints its token against Google's GLOBAL AI Studio endpoint
 * (routes/api.ts `/live/token`), not the EU Vertex region every text route is
 * pinned to. The program decision (ARBOR-AI-PROVIDER-STRATEGY 2026-10-01, D2):
 * attempt Vertex `eu` for Live, and until it lands run under a DATED
 * exception. Lane X (B-PROV-01) owns the server half — it extends
 * `/live/availability` with `exceptionUntil` and denies availability once the
 * exception lapses. This module is the screen half's ONE named place:
 *
 *  - the response's `exceptionUntil` wins when it is a valid YYYY-MM-DD date;
 *  - otherwise the program's dated end, LIVE_RESIDENCY_EXCEPTION_UNTIL;
 *  - a date already in the past is never shown ("until <yesterday>" would be
 *    false) — the panel then states the residency without a date.
 */

/** The dated exception's last day (program decision, 1 Oct 2026). */
export const LIVE_RESIDENCY_EXCEPTION_UNTIL = "2026-10-31";

const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** A YYYY-MM-DD string as a LOCAL calendar date (never UTC-shifted). */
export function isoDayToLocalDate(iso: string): Date | null {
  const m = ISO_DAY.exec(iso);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) || d.getMonth() !== Number(m[2]) - 1 ? null : d;
}

/**
 * The exception's last day to print beside the Live line, or null when no
 * truthful date can be printed (it has passed).
 */
export function liveResidencyUntil(
  availability: { exceptionUntil?: unknown } | null | undefined,
  nowMs: number = Date.now(),
): Date | null {
  const fromServer = typeof availability?.exceptionUntil === "string" ? isoDayToLocalDate(availability.exceptionUntil) : null;
  const until = fromServer ?? isoDayToLocalDate(LIVE_RESIDENCY_EXCEPTION_UNTIL);
  if (!until) return null;
  const endOfDay = new Date(until.getFullYear(), until.getMonth(), until.getDate(), 23, 59, 59, 999).getTime();
  return endOfDay >= nowMs ? until : null;
}

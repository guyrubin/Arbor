/* RecordingIndicator — the ONE "the microphone is on" surface for parent-register
 * dictation (the capture sheet, the Behaviours capture and, B-STATUS-02, Ask's
 * composer dictation; Ask's voice overlay carries the one-line RecordingLine).
 *
 * Why it exists (Guy, 8 Oct 2026: "when I'm recording a voice, there is no
 * indication of recording"): the capture sheet started the mic the moment it
 * opened in voice mode, but its listening strip rendered only on the ordinary
 * moment form — a HARD-MOMENT recording showed nothing at all — and the strip
 * that did render was a static icon in 12 px muted text with no time and no
 * motion. The Behaviours caption had no stop control.
 *
 * Contract:
 *  - Mounted ONLY while a dictation is genuinely live (the caller owns
 *    `listening`), so the pulse is real presence, never decoration (IA-25).
 *  - A recording dot that pulses (global reduced-motion rule makes it static),
 *    the word "Recording", the elapsed time, and a Stop button of 44 px.
 *  - The parent's OWN words render as they speak (interim transcript; never
 *    model output) in the calm register: muted ink, dir="auto", polite live
 *    region. The ticking timer is aria-hidden so a screen reader is not read
 *    a number every second.
 *  - The dot uses --arbor-danger: platform convention for a live microphone,
 *    a system state — never a statement about the child (firewall unaffected).
 */
import { useEffect, useState } from "react";
import { Icon } from "./Icon";

export interface RecordingIndicatorProps {
  /** The parent's live words (interim transcript); empty until they speak. */
  interim: string;
  /** Shown in the caption until the first words arrive. */
  hint: string;
  /** "Recording" in the reader's language. */
  label: string;
  /** Visible text of the stop control. */
  stopLabel: string;
  /** Accessible name of the stop control ("Stop recording"). */
  stopAria: string;
  onStop: () => void;
  testId?: string;
  captionTestId?: string;
}

/** m:ss — pure, unit-tested. */
export function formatElapsed(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Seconds since the caller mounted — the indicator is mounted only while the
 *  microphone is open, so this is the recording's own time. */
function useElapsedSeconds(): number {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const startedAt = Date.now();
    const timer = window.setInterval(() => setElapsed((Date.now() - startedAt) / 1000), 1000);
    return () => window.clearInterval(timer);
  }, []);
  return elapsed;
}

/** The pulsing dot — --arbor-danger, the platform's "microphone is live" mark. */
function RecordingDot() {
  return (
    <span className="relative inline-flex h-3 w-3 flex-none" aria-hidden="true">
      <span className="absolute inline-flex h-full w-full rounded-full animate-pulse" style={{ background: "var(--arbor-danger)", opacity: 0.45 }} />
      <span className="relative inline-flex h-3 w-3 rounded-full" style={{ background: "var(--arbor-danger)" }} />
    </span>
  );
}

/**
 * B-STATUS-02 — the same REC-01 signal as ONE line, for a surface that already
 * owns its stop control and caption (Ask's voice overlay keeps its orb, its X
 * and its captions; it gains "Recording · m:ss"). Same dot, same word, same
 * clock; the clock is aria-hidden for the same reason as above.
 */
export function RecordingLine({ label, testId = "recording-line" }: { label: string; testId?: string }) {
  const elapsed = useElapsedSeconds();
  return (
    <p data-testid={testId} className="t-sm inline-flex items-center gap-2 font-semibold" style={{ color: "var(--arbor-ink)" }}>
      <RecordingDot />
      <span style={{ whiteSpace: "nowrap" }}>{label}</span>
      <span aria-hidden="true" style={{ color: "var(--arbor-muted)" }}>·</span>
      <span aria-hidden="true" data-testid={`${testId}-time`} className="font-normal tabular-nums" style={{ color: "var(--arbor-muted)" }}>
        {formatElapsed(elapsed)}
      </span>
    </p>
  );
}

export default function RecordingIndicator({
  interim,
  hint,
  label,
  stopLabel,
  stopAria,
  onStop,
  testId = "recording-indicator",
  captionTestId = "recording-caption",
}: RecordingIndicatorProps) {
  const elapsed = useElapsedSeconds();

  return (
    <div
      role="status"
      data-testid={testId}
      className="rounded-xl p-3"
      style={{
        background: "var(--arbor-paper)",
        border: "1px solid var(--arbor-rule-strong)",
        borderInlineStart: "3px solid var(--arbor-danger)",
      }}
    >
      <div className="flex items-center gap-3">
        <RecordingDot />
        {/* Layout as inline styles: the app's unlayered CSS outranks Tailwind's
            layered utilities here (white-space measured 'normal' with the class).
            The label never breaks; the timer wraps under it on a narrow phone
            instead of running into Stop (measured: -20 px at 320 px). */}
        <p
          className="t-base min-w-0 flex-1 font-semibold"
          style={{ color: "var(--arbor-ink)", display: "flex", flexWrap: "wrap", alignItems: "baseline", columnGap: 8 }}
        >
          <span style={{ whiteSpace: "nowrap" }}>{label}</span>
          <span aria-hidden="true" data-testid={`${testId}-time`} className="font-normal tabular-nums" style={{ color: "var(--arbor-muted)" }}>
            {formatElapsed(elapsed)}
          </span>
        </p>
        <button
          type="button"
          onClick={onStop}
          aria-label={stopAria}
          data-testid={`${testId}-stop`}
          className="inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-xl px-3 t-sm font-semibold"
          style={{ border: "1px solid var(--arbor-rule-strong)", color: "var(--arbor-ink)", background: "var(--arbor-paper)" }}
        >
          <Icon name="stop" size={16} fill={1} />
          {stopLabel}
        </button>
      </div>
      <p
        dir="auto"
        aria-live="polite"
        data-testid={captionTestId}
        className="t-sm mt-2 leading-relaxed"
        style={{ color: "var(--arbor-muted)" }}
      >
        {interim || hint}
      </p>
    </div>
  );
}

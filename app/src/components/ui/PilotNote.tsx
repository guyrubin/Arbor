import React from "react";

/**
 * The pilot label, one component (B-PROG-15). It was inline markup on the
 * hard-moment guide (HardMomentsSection) and is now shared with the program
 * page, so a draft program says it is a pilot in the same place-of-voice,
 * weight and ink as a draft guide: a bold status line, then one calm
 * sentence, `role="note"`, `--arbor-ink-soft`, no colour chip, no badge.
 */
export function PilotNote({ status, explanation, testId }: { status: string; explanation: string; testId?: string }) {
  return (
    <div className="text-sm leading-relaxed" style={{ color: "var(--arbor-ink-soft)" }} role="note" data-testid={testId}>
      <p className="font-bold">{status}</p>
      <p>{explanation}</p>
    </div>
  );
}

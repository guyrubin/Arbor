import React from "react";
import type { UiLang } from "../../lib/i18n";

/** Reusable parent recovery notice: unlike a toast it remains beside capture
 * until retry/dismiss. Existing alerts did not provide microphone recovery. */
export default function MicrophoneNotice({ message, lang, onRetry, onDismiss }: {
  message: string;
  lang: UiLang;
  onRetry?: () => void;
  onDismiss?: () => void;
}) {
  return <div role="status" dir={lang === "he" ? "rtl" : "ltr"} data-testid="microphone-recovery"
    className="my-3 rounded-xl border p-3 text-start text-sm leading-relaxed"
    style={{ background: "var(--arbor-paper-deep)", borderColor: "var(--arbor-rule-strong)", color: "var(--arbor-ink)" }}>
    <p>{message}</p>
    {(onRetry || onDismiss) && <div className="mt-2 flex flex-wrap gap-2">
      {onRetry && <button type="button" onClick={onRetry} className="touch-target min-h-11 rounded-lg px-3 text-sm font-bold focus-visible:ring-2"
        style={{ color: "var(--arbor-clay-ink)", border: "1px solid var(--arbor-rule-strong)" }}>
        {lang === "he" ? "ננסה שוב" : "Try voice again"}
      </button>}
      {onDismiss && <button type="button" onClick={onDismiss} className="touch-target min-h-11 rounded-lg px-3 text-sm font-bold focus-visible:ring-2"
        style={{ color: "var(--arbor-muted)" }}>
        {lang === "he" ? "אמשיך בכתיבה" : "Continue typing"}
      </button>}
    </div>}
  </div>;
}

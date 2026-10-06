/* AnalyticsOptOutRow — B-DATA-05: the parent's switch for usage analytics.
 *
 * Self-contained Settings row (parent register: calm, dense, tokens only).
 * It reads and writes the preference through ONE module, lib/analyticsOptOut
 * (synchronous browser read + the per-account `users/{uid}.analyticsOptOut`
 * mirror), which lib/analytics track() and the retention rollup writer check
 * first. The switch is ON while usage is shared (= not opted out).
 *
 * Layout mirrors SettingsModal's Row (icon chip · title + one-line sub ·
 * control). RTL by logical properties only: the thumb moves with
 * inset-inline-start, so it travels the right way in Hebrew. The control's hit
 * area is 44 × 44 px (min-h-11 min-w-11). Mounted by Settings (privacy section).
 */
import { useEffect, useId, useState } from "react";
import { Icon } from "../ui/Icon";
import { useAuth } from "../../context/AuthContext";
import { useLanguage } from "../../context/LanguageContext";
import { isAnalyticsOptedOut, onAnalyticsOptOutSettled, setAnalyticsOptOut } from "../../lib/analyticsOptOut";

export function AnalyticsOptOutRow() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const uid = user?.uid;
  const [optedOut, setOptedOut] = useState(() => isAnalyticsOptedOut(uid));
  const [saveFailed, setSaveFailed] = useState(false);
  const labelId = useId();
  const descId = useId();

  useEffect(() => {
    setOptedOut(isAnalyticsOptedOut(uid));
    // Sign-in hydration (or another tab's choice through this module) can
    // settle the preference after mount: follow it.
    return onAnalyticsOptOutSettled((settledUid, value) => {
      if (settledUid === uid) setOptedOut(value);
    });
  }, [uid]);

  if (!uid) return null;

  const sharing = !optedOut;
  const toggle = async () => {
    const next = !optedOut;
    setOptedOut(next);
    setSaveFailed(false);
    const saved = await setAnalyticsOptOut(uid, next);
    if (!saved) setSaveFailed(true);
  };

  return (
    <div data-testid="settings-analytics-optout-row" className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div className="flex items-start gap-3 min-w-0">
        <span
          aria-hidden="true"
          className="inline-flex items-center justify-center w-8 h-8 rounded-xl flex-shrink-0"
          style={{ background: "var(--arbor-clay-dim)", color: "var(--arbor-clay-deep)" }}
        >
          <Icon name="lock" size={18} />
        </span>
        <div className="min-w-0">
          <p id={labelId} className="font-bold" style={{ color: "var(--arbor-ink)" }}>{t("privacy.analytics.label")}</p>
          <p id={descId} className="text-xs" style={{ color: "var(--arbor-muted)" }}>{t("privacy.analytics.body")}</p>
          {saveFailed && (
            <p role="status" className="text-xs mt-1" style={{ color: "var(--arbor-muted)" }} data-testid="settings-analytics-optout-save-failed">
              {t("privacy.analytics.saveFailed")}
            </p>
          )}
        </div>
      </div>
      <div className="flex-shrink-0">
        <button
          type="button"
          role="switch"
          aria-checked={sharing}
          aria-labelledby={labelId}
          aria-describedby={descId}
          onClick={toggle}
          data-testid="settings-analytics-optout-switch"
          className="inline-flex items-center justify-center min-h-11 min-w-11 rounded-full"
          style={{ background: "transparent", border: "none", padding: 0, cursor: "pointer" }}
        >
          <span
            aria-hidden="true"
            className="relative inline-block rounded-full transition"
            style={{ width: 44, height: 26, background: sharing ? "var(--arbor-ink)" : "var(--arbor-rule-strong)" }}
          >
            <span
              className="absolute rounded-full transition-all"
              style={{ width: 20, height: 20, top: 3, insetInlineStart: sharing ? 21 : 3, background: "var(--arbor-paper-elevated)" }}
            />
          </span>
        </button>
      </div>
    </div>
  );
}

export default AnalyticsOptOutRow;

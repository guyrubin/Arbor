import React, { useEffect, useRef, useState } from "react";
import { Icon } from "./Icon";
import { useLanguage } from "../../context/LanguageContext";
import { useSyncStatus } from "../../hooks/useSyncStatus";
import { track } from "../../lib/analytics";
import { en as syncEn, he as syncHe } from "../../lib/i18nElevation/syncstatus";

/**
 * SyncStatusBanner — W0.5 + W0.6: the ONE global data-freshness banner,
 * mounted once in Shell (inside the .arbor-parent <main>, above content).
 *
 * States (offline wins — it usually explains the sync errors too):
 *   offline    → "You're offline — showing saved data"
 *   sync-error → "Couldn't refresh some data" + Retry (re-mounts listeners)
 *
 * ADDITIVE by contract: cached/local data keeps rendering underneath — this
 * is a calm strip, never a screen takeover. Dismissible per kind per session
 * (sessionStorage). Strings come straight from the i18nElevation/syncstatus
 * module (en/he by uiLang), so the banner localizes without touching the
 * i18n registry. RTL-safe: flex + gap only, no directional margins.
 */

type BannerKind = "offline" | "sync-error";

const dismissKey = (kind: BannerKind) => `arbor.syncBanner.dismissed.${kind}`;

const readDismissed = (kind: BannerKind): boolean => {
  try {
    return sessionStorage.getItem(dismissKey(kind)) === "1";
  } catch {
    return false;
  }
};

export default function SyncStatusBanner() {
  const { online, hasSyncError, retry } = useSyncStatus();
  const { uiLang } = useLanguage();
  const s = uiLang === "he" ? syncHe : syncEn;

  const kind: BannerKind | null = !online ? "offline" : hasSyncError ? "sync-error" : null;

  const [dismissed, setDismissed] = useState<Record<BannerKind, boolean>>(() => ({
    offline: readDismissed("offline"),
    "sync-error": readDismissed("sync-error"),
  }));

  const visible = kind !== null && !dismissed[kind];

  // One shown event per appearance (kind change or reappearance after clear).
  const shownFor = useRef<BannerKind | null>(null);
  useEffect(() => {
    if (visible && kind && shownFor.current !== kind) {
      shownFor.current = kind;
      track("sync_banner_shown", { kind });
    }
    if (!visible) shownFor.current = null;
  }, [visible, kind]);

  if (!visible || !kind) return null;

  const dismiss = () => {
    try {
      sessionStorage.setItem(dismissKey(kind), "1");
    } catch {
      /* private mode — dismissal just won't survive a reload */
    }
    setDismissed((d) => ({ ...d, [kind]: true }));
  };

  return (
    <div
      role="status"
      aria-live="polite"
      className="mb-6 flex min-h-[44px] items-center gap-3 rounded-2xl px-4 py-1.5"
      style={{
        background: "var(--arbor-paper-elevated)",
        border: "1px solid var(--arbor-rule)",
        color: "var(--arbor-ink)",
      }}
    >
      <Icon
        name={kind === "offline" ? "cloud_off" : "sync_problem"}
        size={18}
        style={{ color: "var(--arbor-muted)" }}
      />
      <span className="min-w-0 flex-1 text-xs font-medium">
        {kind === "offline" ? s["elev.sync.offline"] : s["elev.sync.error"]}
      </span>
      {kind === "sync-error" && (
        <button
          onClick={() => {
            track("sync_banner_retry");
            retry();
          }}
          className="flex-shrink-0 rounded-xl px-3 py-2 min-h-[44px] text-[11px] font-bold transition"
          style={{
            background: "var(--arbor-paper)",
            color: "var(--arbor-ink)",
            border: "1px solid var(--arbor-rule)",
          }}
        >
          {s["elev.sync.retry"]}
        </button>
      )}
      <button
        onClick={dismiss}
        aria-label={s["elev.sync.dismiss"]}
        title={s["elev.sync.dismiss"]}
        className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl transition"
        style={{ color: "var(--arbor-muted)" }}
      >
        <Icon name="close" size={16} />
      </button>
    </div>
  );
}

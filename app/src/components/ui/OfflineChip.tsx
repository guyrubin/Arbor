import React from "react";
import { Icon } from "./Icon";
import { useLanguage } from "../../context/LanguageContext";
import { useSyncStatus } from "../../hooks/useSyncStatus";
import { en as syncEn, he as syncHe } from "../../lib/i18nElevation/syncstatus";

/**
 * OfflineChip — W0.6: subtle topbar chip, rendered ONLY while offline.
 * Quiet parent register (muted ink on elevated paper — no alarm colors).
 * RTL-safe: inline-flex + gap, no directional margins. Strings from the
 * i18nElevation/syncstatus module (en/he by uiLang).
 */
export default function OfflineChip() {
  const { online } = useSyncStatus();
  const { uiLang } = useLanguage();
  if (online) return null;
  const s = uiLang === "he" ? syncHe : syncEn;
  return (
    <span
      role="status"
      aria-label={s["elev.sync.chipAria"]}
      title={s["elev.sync.chipAria"]}
      className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold"
      style={{
        background: "var(--arbor-paper-elevated)",
        color: "var(--arbor-muted)",
        border: "1px solid var(--arbor-rule)",
      }}
    >
      <Icon name="cloud_off" size={14} />
      {s["elev.sync.chip"]}
    </span>
  );
}

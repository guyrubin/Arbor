import React from "react";
import { fmtShellDay, fmtShellNow } from "../../lib/formatDate";
import type { ShellRowEnd } from "../../lib/shellSlots";
import { Icon } from "../ui/Icon";

/**
 * V77 — the end of the desktop pill row. By default the day and the time
 * ("Monday 16 November · 17:40"); a route may put its own words there instead
 * (lib/shellSlots useShellRowEnd): the day and a suffix, the day alone, its own
 * sentence, a link, or an action after the day and time.
 */
export function ShellRowEndView({ now, uiLang, end }: { now: Date; uiLang: "en" | "he"; end: ShellRowEnd | null }) {
  if (end?.link && !end.suffix && !end.dateOnly && !end.text) {
    return (
      <button type="button" className="ds-link ds-shellrow-when" data-testid={end.link.testId ?? "shell-row-link"} onClick={end.link.onClick}>
        {end.link.label}
      </button>
    );
  }
  const when = end?.text
    ? end.text
    : end?.suffix
      ? `${fmtShellDay(now, uiLang)} · ${end.suffix}`
      : end?.dateOnly
        ? fmtShellDay(now, uiLang)
        : fmtShellNow(now, uiLang);
  return (
    <span className="ds-shellrow-end line" style={{ gap: 12, flex: "none" }}>
      <span className="small ds-shellrow-when" data-testid="shell-now" dir="auto">{when}</span>
      {end?.action && (
        <button type="button" className="btn ghost sm" data-testid={end.action.testId ?? "shell-row-action"} onClick={end.action.onClick}>
          {end.action.icon && <Icon name={end.action.icon} size={18} />}
          {end.action.label}
        </button>
      )}
    </span>
  );
}

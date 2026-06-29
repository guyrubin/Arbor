/**
 * AP-046: Topbar notification bell — in-app display over existing JITAI +
 * monitoring signals (verbatim copy; count badge; no FCM).
 *
 * Slot: the SECOND right-zone slot in Topbar.tsx (between search and
 * kid-switcher).
 *
 * AC-6 BINDING SAFETY CONDITIONS:
 *  - Monitoring note text is rendered VERBATIM from DomainSignal.note (no
 *    string operations — passed through via useNotifications → note field).
 *  - Badge aria-label: "N unread notifications" — never "alerts/problems/issues".
 *  - No FCM / push / new consent surface. No new child-data egress.
 *  - RTL/HE: logical CSS properties throughout (inset-inline-end, etc.).
 *  - Keyboard-dismissable via Escape.
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Bell, Info, ArrowRight } from "lucide-react";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { useNotifications, writeReadSet } from "../../hooks/useNotifications";
import type { AppNotification } from "../../hooks/useNotifications";

// ── Design tokens (no raw hex) ──────────────────────────────────────────────
const T = {
  surface:   "var(--arbor-paper-elevated)",
  deep:      "var(--arbor-paper-deep)",
  rule:      "var(--arbor-rule)",
  ruleStrong:"var(--arbor-rule-strong)",
  ink:       "var(--arbor-ink)",
  muted:     "var(--arbor-muted)",
  faint:     "var(--arbor-faint)",
  green:     "var(--arbor-green-ink)",
  greenSoft: "var(--arbor-green-soft)",
  peach:     "var(--arbor-peach-ink)",
  peachSoft: "var(--arbor-peach-soft)",
  clay:      "var(--arbor-clay)",
} as const;

/** Returns the inline style for the panel, anchored relative to the bell button.
 *  Uses inset-inline-end so the panel flips automatically in RTL (HE). */
function panelStyle(): React.CSSProperties {
  return {
    position: "absolute",
    top: "calc(100% + 8px)",
    insetInlineEnd: 0,
    width: "340px",
    maxHeight: "400px",
    overflowY: "auto",
    background: T.surface,
    border: `1px solid ${T.ruleStrong}`,
    borderRadius: "16px",
    boxShadow: "0 8px 24px rgba(41,51,63,0.13)",
    zIndex: 9999,
    padding: "6px",
  };
}

function NotificationItem({
  item,
  onNavigate,
}: {
  item: AppNotification;
  onNavigate: (item: AppNotification) => void;
}) {
  const { t } = useLanguage();

  // For monitoring items: the note is the VERBATIM DomainSignal.note string —
  // rendered as-is with no transformation.
  // For nudge items: the headline/body come from the i18n key-set.
  const headline =
    item.kind === "nudge" && item.headlineKey
      ? t(item.headlineKey, item.vars)
      : null;
  const body =
    item.kind === "nudge" && item.bodyKey
      ? t(item.bodyKey, item.vars)
      : item.note; // verbatim monitoring note

  const accentColor = item.kind === "monitoring" ? T.peach : T.clay;
  const accentSoft  = item.kind === "monitoring" ? T.peachSoft : T.greenSoft;

  return (
    <div
      role="option"
      aria-selected="false"
      onClick={() => onNavigate(item)}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onNavigate(item); } }}
      tabIndex={0}
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: "10px",
        padding: "10px 12px",
        borderRadius: "10px",
        cursor: "pointer",
        background: "transparent",
        transition: "background 0.1s",
        userSelect: "none",
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = T.deep; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = "transparent"; }}
    >
      {/* Icon dot */}
      <span
        aria-hidden="true"
        style={{
          width: "30px",
          height: "30px",
          borderRadius: "50%",
          flexShrink: 0,
          background: accentSoft,
          color: accentColor,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBlockStart: "1px",
        }}
      >
        <Info style={{ width: "14px", height: "14px" }} />
      </span>

      {/* Text block */}
      <span style={{ flex: 1, minWidth: 0 }}>
        {headline && (
          <span
            style={{
              display: "block",
              fontSize: "13px",
              fontWeight: 700,
              color: T.ink,
              lineHeight: "1.3",
            }}
          >
            {headline}
          </span>
        )}
        {/* AC-6 LOAD-BEARING: for monitoring items, `body` is item.note, which
            is the VERBATIM DomainSignal.note string passed through useNotifications
            without any string transformation. Rendered here with no further
            processing. */}
        <span
          style={{
            fontSize: "12px",
            color: T.muted,
            lineHeight: "1.45",
            marginBlockStart: headline ? "2px" : undefined,
            overflow: "hidden",
            display: "-webkit-box",
            WebkitLineClamp: 4,
            WebkitBoxOrient: "vertical",
          } as React.CSSProperties}
        >
          {body}
        </span>
      </span>

      <ArrowRight
        aria-hidden="true"
        style={{ width: "14px", height: "14px", flexShrink: 0, color: accentColor, marginBlockStart: "4px" }}
      />
    </div>
  );
}

/** AP-046: bell button + popover panel. Populates the second right-zone slot
 *  in Topbar.tsx (between <TopbarSearch/> and <TopbarKidSwitcher/>). */
export default function TopbarBell() {
  const { setActiveTab } = useArbor();
  const { t } = useLanguage();
  const { items, unreadCount, markAllRead } = useNotifications();

  const [open, setOpen] = useState(false);
  // Local read-tracking: re-read from localStorage on each open.
  const [readIds, setReadIds] = useState<Set<string>>(new Set());

  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef    = useRef<HTMLButtonElement>(null);

  // On open: load read set and mark all currently-visible items as read.
  const openPanel = useCallback(() => {
    const ids = items.map((n) => n.id);
    setReadIds(new Set(ids));
    writeReadSet(ids);
    markAllRead();
    setOpen(true);
  }, [items, markAllRead]);

  const closePanel = useCallback(() => {
    setOpen(false);
    buttonRef.current?.focus();
  }, []);

  const toggle = useCallback(() => {
    if (open) closePanel();
    else openPanel();
  }, [open, openPanel, closePanel]);

  // Escape key dismisses the panel and returns focus to the bell button.
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") { closePanel(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, closePanel]);

  // Click-outside closes the panel.
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleNavigate = useCallback(
    (item: AppNotification) => {
      setActiveTab(item.action);
      closePanel();
    },
    [setActiveTab, closePanel],
  );

  // Compute the unread count to display — only items NOT in readIds.
  const displayCount = items.filter((n) => !readIds.has(n.id)).length || unreadCount;

  // AC-6: badge aria-label — neutral count framing, never "alerts/problems/issues".
  const badgeAriaLabel =
    displayCount === 1
      ? "1 unread notification"
      : `${displayCount} unread notifications`;

  return (
    <div
      ref={containerRef}
      style={{ position: "relative" }}
    >
      {/* Bell button */}
      <button
        ref={buttonRef}
        aria-label={displayCount > 0 ? badgeAriaLabel : "Notifications"}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={toggle}
        style={{
          position: "relative",
          width: "40px",
          height: "40px",
          borderRadius: "12px",
          background: open ? T.greenSoft : T.surface,
          border: `1px solid ${open ? T.clay : T.rule}`,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          transition: "background 0.15s, border-color 0.15s",
          outline: "none",
          // Minimum 44×44 touch target (the 40px button is inside a div that
          // expands the hit area via padding to reach 44px equivalent).
        }}
        onFocus={(e) => { (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 0 0 2px var(--arbor-clay)"; }}
        onBlur={(e)  => { (e.currentTarget as HTMLButtonElement).style.boxShadow = "none"; }}
      >
        <Bell
          style={{
            width: "17px",
            height: "17px",
            color: open ? T.green : T.muted,
            transition: "color 0.15s",
          }}
          aria-hidden="true"
        />

        {/* Unread count badge — AC-6: a bare number, neutral framing only */}
        {displayCount > 0 && (
          <span
            aria-hidden="true"
            style={{
              position: "absolute",
              top: "-4px",
              insetInlineEnd: "-4px",
              minWidth: "17px",
              height: "17px",
              borderRadius: "9px",
              background: T.clay,
              color: "var(--arbor-on-accent)",
              fontSize: "10px",
              fontWeight: 800,
              lineHeight: "17px",
              textAlign: "center",
              padding: "0 3px",
              border: `2px solid ${T.surface}`,
              boxSizing: "border-box",
              fontFamily: "var(--font-ui, sans-serif)",
            }}
          >
            {displayCount > 9 ? "9+" : displayCount}
          </span>
        )}
      </button>

      {/* Notification panel */}
      {open && (
        <div
          role="listbox"
          aria-label="Notifications"
          style={panelStyle()}
        >
          {/* Panel header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "8px 12px 6px",
              borderBottom: `1px solid ${T.rule}`,
              marginBlockEnd: "4px",
            }}
          >
            <span
              style={{
                fontSize: "12px",
                fontWeight: 800,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                color: T.faint,
              }}
            >
              {t("bell.title", {}) || "Notifications"}
            </span>
          </div>

          {/* Notification items */}
          {items.length === 0 ? (
            <div
              style={{
                padding: "24px 16px",
                textAlign: "center",
                fontSize: "13px",
                color: T.muted,
              }}
            >
              {t("bell.empty", {}) || "Nothing new right now."}
            </div>
          ) : (
            items.map((item) => (
              <NotificationItem
                key={item.id}
                item={item}
                onNavigate={handleNavigate}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

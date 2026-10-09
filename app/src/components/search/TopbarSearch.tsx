/**
 * AP-045 + W2.4: Global search input for the Topbar right-zone (slot 1 of 3).
 *
 * - Opens a results overlay on focus.
 * - B-SHELL-14: renders the SAME result model as SearchModal
 *   (useSearchResults): the static catalogue, then the active child's own
 *   records (matched on-device, never added to searchIndex), then "Ask Arbor
 *   about …" (first when the query ends with "?"). Same query, same rows.
 * - LAZY CONTRACT: the index module is dynamic-import()ed on first open —
 *   only a type import lives here, so catalogs stay out of the initial parse.
 * - Ctrl/Cmd+K is owned by Shell (kid-lock-gated SearchModal hotkey); the
 *   old duplicate listener here was removed so one hotkey has one owner.
 * - Selecting a result deep-links via the existing setActiveTab navigation.
 * - Keyboard dismissable via Escape.
 * - RTL/HE correct: logical CSS properties throughout; overlay anchors are
 *   inline-start/end, not left/right.
 * - No raw hex values — all colours reference index.css tokens.
 * - No AI inference on query — normalized string match only (searchCatalog).
 * - Does NOT touch the bell slot or kid-switcher slot.
 */

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useLanguage } from "../../context/LanguageContext";
import { track } from "../../lib/analytics";
import { Icon } from "../ui/Icon";
import { useSearchResults, type SearchRow } from "./useSearchResults";

/** AP-045 global search input + results overlay (topbar slot 1). */
export default function TopbarSearch() {
  const { t } = useLanguage();
  const [query, setQuery]       = useState("");
  const [open, setOpen]         = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);

  const inputRef    = useRef<HTMLInputElement>(null);
  const overlayRef  = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Analytics: one search_open per closed→open transition.
  const wasOpen = useRef(false);
  useEffect(() => {
    if (open && !wasOpen.current) track("search_open", { surface: "desktop" });
    wasOpen.current = open;
  }, [open]);

  // B-SHELL-14: the one result model (catalogue · records · ask), same limits
  // as the modal so the same query returns the same rows on both surfaces.
  const { ordered: results, kindLabel } = useSearchResults(query, { enabled: open, catalogLimit: 12, recordLimit: 12 });

  // Reset active index whenever results change.
  useEffect(() => { setActiveIdx(0); }, [results.length]);

  // Close on click outside.
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const navigate = useCallback(
    (entry: SearchRow) => {
      // Analytics carry the kind only — never the query text.
      track("search_result_tap", { kind: entry.kind });
      entry.go();
      setOpen(false);
      setQuery("");
      inputRef.current?.blur();
    },
    []
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      setOpen(false);
      setQuery("");
      inputRef.current?.blur();
      return;
    }
    if (!open || results.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (results[activeIdx]) navigate(results[activeIdx]);
    }
  };

  const showOverlay = open && query.trim().length > 0;

  return (
    <div
      ref={containerRef}
      style={{ position: "relative", width: "clamp(170px, 16vw, 230px)", maxWidth: "100%" }}
      aria-label={t("aria.globalSearch")}
    >
      {/* ── Input ────────────────────────────────────────────────────────── */}
      {/* Critic r1 (W2-ASKJB, every 1280 cell): the visible pill was 40 px and
          the input inside it 18 px, so the hit target failed the 44 px floor.
          The whole pill is now a <label> 44 px tall (min-h-11) and the input
          stretches to fill it; the hairline is an inset shadow so it takes no
          height from the input. */}
      <label
        className="flex min-h-11 items-stretch rounded-xl px-3"
        style={{
          width: "100%",
          height: "44px",
          cursor: "text",
          background: "var(--arbor-paper-elevated)",
          boxShadow: open
            ? "inset 0 0 0 1px var(--arbor-clay)"
            : "inset 0 0 0 1px var(--arbor-rule)",
          color: "var(--arbor-faint)",
          fontSize: "var(--t-sm)",
          gap: "8px",
          transition: "box-shadow 0.15s",
          boxSizing: "border-box",
        }}
      >
        <Icon
          name="search"
          size={18}
          chrome
          active={open}
          style={{
            alignSelf: "center",
            color: open ? "var(--arbor-clay)" : "var(--arbor-faint)",
            transition: "color 0.15s",
          }}
        />
        <input
          ref={inputRef}
          type="search"
          role="combobox"
          aria-expanded={showOverlay}
          aria-controls="topbar-search-results"
          aria-autocomplete="list"
          aria-activedescendant={
            showOverlay && results[activeIdx]
              ? `search-result-${activeIdx}`
              : undefined
          }
          autoComplete="off"
          value={query}
          placeholder={t("top.search") + "…"}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          className="field-bare min-h-11 self-stretch"
          style={{
            flex: 1,
            minWidth: 0,
            height: "100%",
            border: "none",
            outline: "none",
            background: "transparent",
            color: "var(--arbor-ink)",
            fontSize: "var(--t-sm)",
            lineHeight: "1",
            // Suppress browser-default search cancel button — we render our own.
            WebkitAppearance: "none",
          }}
        />
        {query && (
          <button
            aria-label={t("aria.clearSearch")}
            onClick={(e) => { e.preventDefault(); setQuery(""); setOpen(false); inputRef.current?.focus(); }}
            style={{
              alignSelf: "center",
              flexShrink: 0,
              background: "none",
              border: "none",
              padding: 0,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              color: "var(--arbor-faint)",
            }}
          >
            <Icon name="close" size={16} />
          </button>
        )}
      </label>

      {/* ── Results overlay ───────────────────────────────────────────────── */}
      {showOverlay && (
        <div
          ref={overlayRef}
          id="topbar-search-results"
          role="listbox"
          aria-label={t("aria.searchResults")}
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            insetInlineStart: 0,
            width: "min(320px, calc(100vw - 32px))",
            maxHeight: "320px",
            overflowY: "auto",
            background: "var(--arbor-paper-elevated)",
            border: "1px solid var(--arbor-rule-strong)",
            borderRadius: "14px",
            boxShadow: "0 8px 24px rgba(41,51,63,0.12)",
            zIndex: 9999,
            padding: "6px",
          }}
        >
          {results.length === 0 ? (
            <div
              style={{
                padding: "16px",
                textAlign: "center",
                fontSize: "12px",
                color: "var(--arbor-muted)",
              }}
            >
              {t("sm.noMatches")}
            </div>
          ) : (
            results.map((entry, i) => (
              <div
                id={`search-result-${i}`}
                key={entry.kind + ":" + entry.id}
                data-testid={entry.kind === "ask" ? "search-ask-row" : undefined}
                role="option"
                aria-selected={i === activeIdx}
                onClick={() => navigate(entry)}
                onMouseEnter={() => setActiveIdx(i)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "8px 10px",
                  minHeight: "44px",
                  borderRadius: "10px",
                  cursor: "pointer",
                  background:
                    i === activeIdx
                      ? "var(--arbor-paper-deep)"
                      : "transparent",
                  transition: "background 0.1s",
                  userSelect: "none",
                }}
              >
                {/* Kind icon — the same glyph + token the modal shows */}
                <Icon name={entry.icon} size={16} style={{ color: entry.color, flexShrink: 0 }} />

                {/* Text block */}
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span
                    style={{
                      display: "block",
                      fontSize: "13px",
                      fontWeight: 700,
                      color: "var(--arbor-ink)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {entry.label}
                  </span>
                  <span
                    style={{
                      display: "block",
                      fontSize: "12px",
                      color: "var(--arbor-muted)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {entry.sub || kindLabel(entry.kind)}
                  </span>
                </span>

                {/* Kind badge */}
                <span
                  style={{
                    fontSize: "12px",
                    fontWeight: 500,
                    flexShrink: 0,
                    color: entry.color,
                  }}
                >
                  {kindLabel(entry.kind)}
                </span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

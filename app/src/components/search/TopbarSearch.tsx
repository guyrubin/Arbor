/**
 * AP-045: Global search input for the Topbar right-zone (slot 1 of 3).
 *
 * - Opens a results overlay on focus (or Cmd/Ctrl+K).
 * - Searches the STATIC content-catalog index only (AC-6: no child-record fields).
 * - Selecting a result deep-links via the existing setActiveTab navigation.
 * - Keyboard dismissable via Escape.
 * - RTL/HE correct: logical CSS properties throughout; overlay anchors are
 *   inline-start/end, not left/right.
 * - No raw hex values — all colours reference index.css tokens.
 * - No AI inference on query — plain string match only (via searchIndex()).
 * - Does NOT touch the bell slot or kid-switcher slot.
 */

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { Search, X } from "lucide-react";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { searchIndex, type SearchEntry } from "../../lib/searchIndex";

const CATEGORY_TOKEN: Record<SearchEntry["category"], string> = {
  "Activity":        "var(--arbor-green-ink)",
  "Milestone":       "var(--arbor-sky-ink)",
  "Journey":         "var(--arbor-lav-ink)",
  "Practice World":  "var(--arbor-peach-ink)",
};

/** AP-045 global search input + results overlay (topbar slot 1). */
export default function TopbarSearch() {
  const { setActiveTab } = useArbor();
  const { t } = useLanguage();
  const [query, setQuery]       = useState("");
  const [open, setOpen]         = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);

  const inputRef    = useRef<HTMLInputElement>(null);
  const overlayRef  = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const results = searchIndex(query);

  // Reset active index whenever results change.
  useEffect(() => { setActiveIdx(0); }, [results.length]);

  // Cmd/Ctrl+K → focus the input from anywhere.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

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
    (entry: SearchEntry) => {
      setActiveTab(entry.tab);
      setOpen(false);
      setQuery("");
      inputRef.current?.blur();
    },
    [setActiveTab]
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
      style={{ position: "relative", width: "230px" }}
      aria-label={t("aria.globalSearch")}
    >
      {/* ── Input ────────────────────────────────────────────────────────── */}
      <div
        className="flex items-center rounded-xl px-3"
        style={{
          width: "230px",
          height: "40px",
          background: "var(--arbor-paper-elevated)",
          border: open
            ? "1px solid var(--arbor-clay)"
            : "1px solid var(--arbor-rule)",
          color: "var(--arbor-faint)",
          fontSize: "var(--t-sm)",
          gap: "8px",
          transition: "border-color 0.15s",
          boxSizing: "border-box",
        }}
      >
        <Search
          style={{
            width: "14px",
            height: "14px",
            flexShrink: 0,
            color: open ? "var(--arbor-clay)" : "var(--arbor-faint)",
            transition: "color 0.15s",
          }}
          aria-hidden="true"
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
          placeholder="Search…"
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          style={{
            flex: 1,
            minWidth: 0,
            border: "none",
            outline: "none",
            background: "transparent",
            color: "var(--arbor-ink)",
            fontSize: "13px",
            lineHeight: "1",
            // Suppress browser-default search cancel button — we render our own.
            WebkitAppearance: "none",
          }}
        />
        {query && (
          <button
            aria-label={t("aria.clearSearch")}
            onClick={() => { setQuery(""); setOpen(false); inputRef.current?.focus(); }}
            style={{
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
            <X style={{ width: "13px", height: "13px" }} aria-hidden="true" />
          </button>
        )}
      </div>

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
            width: "320px",
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
              No matches for &ldquo;{query}&rdquo;
            </div>
          ) : (
            results.map((entry, i) => (
              <div
                id={`search-result-${i}`}
                key={entry.key}
                role="option"
                aria-selected={i === activeIdx}
                onClick={() => navigate(entry)}
                onMouseEnter={() => setActiveIdx(i)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "8px 10px",
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
                {/* Category dot */}
                <span
                  aria-hidden="true"
                  style={{
                    width: "7px",
                    height: "7px",
                    borderRadius: "50%",
                    flexShrink: 0,
                    background: CATEGORY_TOKEN[entry.category],
                  }}
                />

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
                      fontSize: "11px",
                      color: "var(--arbor-muted)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {entry.sub}
                  </span>
                </span>

                {/* Category badge */}
                <span
                  style={{
                    fontSize: "9px",
                    fontWeight: 800,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    flexShrink: 0,
                    color: CATEGORY_TOKEN[entry.category],
                  }}
                >
                  {entry.category}
                </span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

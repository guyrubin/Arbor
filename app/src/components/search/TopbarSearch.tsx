/**
 * AP-045 + W2.4: Global search input for the Topbar right-zone (slot 1 of 3).
 *
 * - Opens a results overlay on focus.
 * - Searches the STATIC content-catalog index only (AC-6: no child-record
 *   fields) — now the FULL catalog (routes, Learn, Masterclasses, Routines,
 *   Scholars, published hard moments, activities, milestones, journeys,
 *   worlds) with forgiving HE+EN matching (lib/searchIndex).
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
  useMemo,
  useRef,
  useState,
} from "react";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { ageMonthsFromProfile } from "../../lib/childAge";
import type { HardMomentContext } from "../../content/pilotRelease";
import { track } from "../../lib/analytics";
import { searchnavText } from "../../lib/i18nElevation/searchnav";
import type { SearchEntry, SearchKind } from "../../lib/searchIndex";
import { Icon } from "../ui/Icon";

type SearchIndexModule = {
  searchCatalog: (query: string, limit?: number, context?: HardMomentContext) => SearchEntry[];
};

const KIND_TOKEN: Partial<Record<SearchKind, string>> = {
  route: "var(--arbor-green-ink)",
  learn: "var(--arbor-sky-ink)",
  masterclass: "var(--arbor-lav-ink)",
  routine: "var(--arbor-peach-ink)",
  scholar: "var(--arbor-green-ink)",
  "hard-moment": "var(--arbor-clay-deep)",
  activity: "var(--arbor-green-ink)",
  milestone: "var(--arbor-sky-ink)",
  journey: "var(--arbor-lav-ink)",
  world: "var(--arbor-peach-ink)",
};

/** AP-045 global search input + results overlay (topbar slot 1). */
export default function TopbarSearch() {
  const { setActiveTab, childProfile } = useArbor();
  const { t, uiLang } = useLanguage();
  const heLang = uiLang === "he";
  const [query, setQuery]       = useState("");
  const [open, setOpen]         = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);

  const inputRef    = useRef<HTMLInputElement>(null);
  const overlayRef  = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // W2.4 lazy index: load the catalog module on first open.
  const [indexMod, setIndexMod] = useState<SearchIndexModule | null>(null);
  useEffect(() => {
    if (!open || indexMod) return;
    let alive = true;
    import("../../lib/searchIndex")
      .then((m) => { if (alive) setIndexMod(m); })
      .catch(() => { /* overlay simply shows no matches */ });
    return () => { alive = false; };
  }, [open, indexMod]);

  // Analytics: one search_open per closed→open transition.
  const wasOpen = useRef(false);
  useEffect(() => {
    if (open && !wasOpen.current) track("search_open", { surface: "desktop" });
    wasOpen.current = open;
  }, [open]);

  // Same child context as SearchModal — the hard-moment catalogue is
  // fail-closed on age + locale and stays invisible without it.
  const results = useMemo(
    () => {
      if (!indexMod || !query.trim()) return [];
      const now = new Date();
      return indexMod.searchCatalog(query, 10, {
        locale: heLang ? "he" : "en", now, ageMonths: ageMonthsFromProfile(childProfile, now),
      });
    },
    [indexMod, query, heLang, childProfile],
  );

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
    (entry: SearchEntry) => {
      track("search_result_tap", { kind: entry.kind });
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
  const pick = (p: { en: string; he: string }) => (heLang ? p.he : p.en);
  const kindLabel = (k: SearchKind) => searchnavText("elev.searchnav.kind." + k, heLang);
  const kindColor = (k: SearchKind) => KIND_TOKEN[k] ?? "var(--arbor-green-ink)";

  return (
    <div
      ref={containerRef}
      style={{ position: "relative", width: "clamp(170px, 16vw, 230px)", maxWidth: "100%" }}
      aria-label={t("aria.globalSearch")}
    >
      {/* ── Input ────────────────────────────────────────────────────────── */}
      <div
        className="flex items-center rounded-xl px-3"
        style={{
          width: "100%",
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
        <Icon
          name="search"
          size={18}
          style={{
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
            <Icon name="close" size={16} />
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
                key={entry.id}
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
                {/* Kind dot */}
                <span
                  aria-hidden="true"
                  style={{
                    width: "7px",
                    height: "7px",
                    borderRadius: "50%",
                    flexShrink: 0,
                    background: kindColor(entry.kind),
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
                    {pick(entry.title)}
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
                    {pick(entry.sub) || kindLabel(entry.kind)}
                  </span>
                </span>

                {/* Kind badge */}
                <span
                  style={{
                    fontSize: "9px",
                    fontWeight: 800,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    flexShrink: 0,
                    color: kindColor(entry.kind),
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

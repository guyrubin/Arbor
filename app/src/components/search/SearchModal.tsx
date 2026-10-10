import React, { useState } from "react";
import { Modal } from "../ui/Modal";
import { Icon } from "../ui/Icon";
import { useLanguage } from "../../context/LanguageContext";
import { track } from "../../lib/analytics";
import { searchnavText } from "../../lib/i18nElevation/searchnav";
// B-SHELL-14: ONE result model for both search surfaces (the lazy searchIndex
// import lives in the hook, still a dynamic import() on first open).
import { useSearchResults, type SearchRow } from "./useSearchResults";

/* ── Cross-surface open requests (W1.9 mobile entry points) ────────────────
 * MobileNav's More sheet and Shell's accessories strip both open THIS modal.
 * The open state lives in Shell (kid-lock gated there); they signal via a
 * window event so neither needs Shell props or new context. Shell's listener
 * re-checks the kid-mode gate before opening (LEAK 5 discipline). */
export type SearchOpenSurface = "mobile" | "desktop" | "more";
export const SEARCH_OPEN_EVENT = "arbor:search:open";
export function requestOpenSearch(surface: SearchOpenSurface): void {
  window.dispatchEvent(new CustomEvent(SEARCH_OPEN_EVENT, { detail: { surface } }));
}

/** Command palette + full-catalog search: jump to any section/capability,
 *  search every content library (Learn, Masterclasses, Routines, Scholars,
 *  published hard moments, activities, milestones, journeys, worlds) AND the
 *  active child's logs, conversations, milestones and plans. Full-screen-ish
 *  on mobile (375px: input top, scrollable results, 44px rows). */
export default function SearchModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t, uiLang } = useLanguage();
  const heLang = uiLang === "he";
  const [q, setQ] = useState("");
  const { indexReady, ordered, kindLabel } = useSearchResults(q, { enabled: open, catalogLimit: 12, recordLimit: 12 });

  const term = q.trim();
  const shown: SearchRow[] = ordered;

  const run = (r: SearchRow) => {
    track("search_result_tap", { kind: r.kind });
    r.go();
    onClose();
    setQ("");
  };

  return (
    <Modal open={open} onClose={onClose} title={t("sm.title")} maxWidth="max-w-lg max-sm:h-full max-sm:max-h-none">
      {/* 375px contract: input pinned top, results scroll, 44px rows. */}
      <div className="flex flex-col max-sm:h-[calc(100%-3rem)] space-y-3">
        <div className="relative flex-shrink-0">
          <Icon name="search" size={18} className="absolute start-3.5 top-1/2 -translate-y-1/2" style={{ color: "var(--arbor-muted)" }} />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && shown[0]) run(shown[0]); }}
            placeholder={t("sm.placeholder")}
            className="w-full rounded-xl ps-10 pe-4 py-2.5 min-h-[44px] text-sm focus:outline-none"
            style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule-strong)", color: "var(--arbor-ink)" }}
          />
        </div>

        <div className="max-sm:flex-1 max-sm:min-h-0 sm:max-h-[50vh] overflow-y-auto space-y-1">
          {!term && <p className="text-xs font-semibold px-1 pb-1" style={{ color: "var(--arbor-muted)" }}>{t("sm.goTo")}</p>}
          {!term && !indexReady && open && (
            <p className="text-xs py-6 text-center" style={{ color: "var(--arbor-muted)" }}>{searchnavText("elev.searchnav.loading", heLang)}</p>
          )}
          {term && shown.length === 0 && <p className="text-xs py-6 text-center" style={{ color: "var(--arbor-muted)" }}>{t("sm.noMatches")}</p>}
          {shown.map((r, i) => (
            <button
              key={r.kind + ":" + r.id}
              data-testid={r.kind === "ask" ? "search-ask-row" : undefined}
              onClick={() => run(r)}
              className="group w-full flex items-center gap-3 px-3 py-2 min-h-[44px] rounded-xl text-start transition"
              style={{ background: "transparent" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--arbor-paper-deep)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <span className="flex-shrink-0"><Icon name={r.icon} size={16} className={r.kind === "route" ? "rtl:-scale-x-100" : undefined} style={{ color: r.color }} /></span>
              <span className="min-w-0 flex-1">
                <span className="text-sm font-bold truncate block" style={{ color: "var(--arbor-ink)" }}>{r.label}</span>
                <span className="text-xs truncate block" style={{ color: "var(--arbor-muted)" }}>{r.sub}</span>
              </span>
              {i === 0 && <Icon name="keyboard_return" size={16} className="opacity-0 group-hover:opacity-100" style={{ color: "var(--arbor-muted)" }} />}
              <span className="text-xs font-medium flex-shrink-0" style={{ color: "var(--arbor-muted)" }}>{kindLabel(r.kind)}</span>
            </button>
          ))}
        </div>
      </div>
    </Modal>
  );
}

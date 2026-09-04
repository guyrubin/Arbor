import React, { useEffect, useMemo, useState } from "react";
import { Modal } from "../ui/Modal";
import { Icon } from "../ui/Icon";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { ageMonthsFromProfile } from "../../lib/childAge";
import type { HardMomentContext } from "../../content/pilotRelease";
import { track } from "../../lib/analytics";
import { searchnavText } from "../../lib/i18nElevation/searchnav";
// LAZY CONTRACT (W2.4): type-only — the searchIndex module (and the content
// catalogs behind it) is loaded via dynamic import() on first open, so it
// never joins the initial Today parse.
import type { SearchEntry, SearchKind } from "../../lib/searchIndex";

/** The searchIndex module surface we consume after dynamic import. */
type SearchIndexModule = {
  getSearchIndex: () => readonly SearchEntry[];
  searchCatalog: (query: string, limit?: number, context?: HardMomentContext) => SearchEntry[];
};

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

type Result = { kind: string; kindLabel: string; icon: React.ReactNode; label: string; sub: string; go: () => void };

const KIND_ICON: Partial<Record<SearchKind, string>> = {
  route: "arrow_forward",
  learn: "school",
  masterclass: "play_lesson",
  routine: "checklist",
  scholar: "explore",
  "hard-moment": "healing",
  activity: "toys",
  milestone: "check_circle",
  journey: "auto_stories",
  world: "sports_esports",
};

/** Command palette + full-catalog search: jump to any section/capability,
 *  search every content library (Learn, Masterclasses, Routines, Scholars,
 *  published hard moments, activities, milestones, journeys, worlds) AND the
 *  active child's logs, conversations, milestones and plans. Full-screen-ish
 *  on mobile (375px: input top, scrollable results, 44px rows). */
export default function SearchModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { behaviorLogs, milestones, actionPlans, conversations, childProfile, setActiveTab, openConversation } = useArbor();
  const { t, uiLang } = useLanguage();
  const heLang = uiLang === "he";
  const [q, setQ] = useState("");

  // W2.4 lazy index: dynamic-import the catalog module on first open only.
  const [indexMod, setIndexMod] = useState<SearchIndexModule | null>(null);
  useEffect(() => {
    if (!open || indexMod) return;
    let alive = true;
    import("../../lib/searchIndex")
      .then((m) => { if (alive) setIndexMod(m); })
      .catch(() => { /* search degrades to child-data results only */ });
    return () => { alive = false; };
  }, [open, indexMod]);

  const pick = (p: { en: string; he: string }) => (heLang ? p.he : p.en);

  const toResult = useMemo(() => {
    return (e: SearchEntry): Result => ({
      kind: e.kind,
      kindLabel: searchnavText("elev.searchnav.kind." + e.kind, heLang),
      icon: (
        <Icon
          name={KIND_ICON[e.kind] ?? "search"}
          size={16}
          style={{ color: KIND_TOKEN[e.kind] ?? "var(--arbor-green-ink)" }}
        />
      ),
      label: pick(e.title),
      sub: pick(e.sub) || searchnavText("elev.searchnav.kind." + e.kind, heLang),
      go: () => setActiveTab(e.tab),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [heLang, setActiveTab]);

  // Zero-query: the go-anywhere command list (route entries from the index).
  const routeCommands = useMemo<Result[]>(() => {
    if (!indexMod) return [];
    return indexMod.getSearchIndex().filter((e) => e.kind === "route").map(toResult);
  }, [indexMod, toResult]);

  // Query: forgiving HE+EN catalog search across every content library.
  // The governed hard-moment catalogue is fail-closed on age + locale, so it
  // only appears in search when the child context is supplied. Without this the
  // 25 published guides were unreachable from search entirely.
  const catalogResults = useMemo<Result[]>(() => {
    if (!indexMod || !q.trim()) return [];
    const now = new Date();
    return indexMod.searchCatalog(q, 12, {
      locale: heLang ? "he" : "en", now, ageMonths: ageMonthsFromProfile(childProfile, now),
    }).map(toResult);
  }, [indexMod, q, toResult, heLang, childProfile]);

  // Child-data results (existing behavior, unchanged): logs, threads,
  // recorded milestones, action plans from the active child's context.
  const dataResults = useMemo<Result[]>(() => {
    const term = q.trim().toLowerCase();
    if (!term) return [];
    const out: Result[] = [];
    behaviorLogs.forEach((l) => {
      if (`${l.behaviorType} ${l.trigger} ${l.response} ${l.notes || ""}`.toLowerCase().includes(term))
        out.push({ kind: "log", kindLabel: t("sm.kind.log"), icon: <Icon name="schedule" size={16} style={{ color: "var(--arbor-sky-ink)" }} />, label: l.behaviorType, sub: l.trigger, go: () => setActiveTab("behaviors") });
    });
    conversations.forEach((c) => {
      if (c.title.toLowerCase().includes(term) || c.messages.some((m) => m.text.toLowerCase().includes(term)))
        out.push({ kind: "thread", kindLabel: t("sm.kind.thread"), icon: <Icon name="psychology" size={16} style={{ color: "var(--arbor-peach-ink)" }} />, label: c.title, sub: t("sm.threadSub"), go: () => { openConversation(c.id); setActiveTab("coach"); } });
    });
    milestones.forEach((m) => {
      if (m.title.toLowerCase().includes(term))
        out.push({ kind: "milestone-record", kindLabel: t("sm.kind.milestone"), icon: <Icon name="check_circle" size={16} style={{ color: "var(--arbor-green-ink)" }} />, label: m.title, sub: m.description, go: () => setActiveTab("milestones") });
    });
    actionPlans.forEach((p) => {
      if (`${p.title} ${p.issue}`.toLowerCase().includes(term))
        out.push({ kind: "plan", kindLabel: t("sm.kind.plan"), icon: <Icon name="tune" size={16} style={{ color: "var(--arbor-lav-ink)" }} />, label: p.title, sub: p.issue, go: () => setActiveTab("plans") });
    });
    return out.slice(0, 12);
  }, [q, behaviorLogs, milestones, actionPlans, conversations, setActiveTab, openConversation, t]);

  const term = q.trim();
  const shown: Result[] = term ? [...catalogResults, ...dataResults] : routeCommands;

  const run = (r: Result) => {
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
          {!term && <p className="text-[10px] font-bold uppercase tracking-wider px-1 pb-1" style={{ color: "var(--arbor-muted)" }}>{t("sm.goTo")}</p>}
          {!term && !indexMod && open && (
            <p className="text-xs py-6 text-center" style={{ color: "var(--arbor-muted)" }}>{searchnavText("elev.searchnav.loading", heLang)}</p>
          )}
          {term && shown.length === 0 && <p className="text-xs py-6 text-center" style={{ color: "var(--arbor-muted)" }}>{t("sm.noMatches")}</p>}
          {shown.map((r, i) => (
            <button
              key={i}
              onClick={() => run(r)}
              className="group w-full flex items-center gap-3 px-3 py-2 min-h-[44px] rounded-xl text-start transition"
              style={{ background: "transparent" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--arbor-paper-deep)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <span className="flex-shrink-0">{r.icon}</span>
              <span className="min-w-0 flex-1">
                <span className="text-sm font-bold truncate block" style={{ color: "var(--arbor-ink)" }}>{r.label}</span>
                <span className="text-[11px] truncate block" style={{ color: "var(--arbor-muted)" }}>{r.sub}</span>
              </span>
              {i === 0 && <Icon name="keyboard_return" size={16} className="opacity-0 group-hover:opacity-100" style={{ color: "var(--arbor-muted)" }} />}
              <span className="text-[9px] uppercase font-black tracking-wider flex-shrink-0" style={{ color: "var(--arbor-muted)" }}>{r.kindLabel}</span>
            </button>
          ))}
        </div>
      </div>
    </Modal>
  );
}

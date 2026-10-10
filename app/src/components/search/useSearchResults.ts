/**
 * B-SHELL-14 — ONE search result model for both search surfaces.
 *
 * The topbar dropdown (TopbarSearch) searched the static catalogue only; the
 * modal (SearchModal) added the active child's logs, threads, milestones and
 * plans. Two models meant the same query gave different rows depending on
 * where the parent typed it. Both now render `useSearchResults(q)`:
 *
 *  · `catalog` — the static content index (lib/searchIndex, lazy-imported on
 *    first use so the catalogues never join the initial parse);
 *  · `record`  — the active child's own records, matched ON-DEVICE and never
 *    added to searchIndex. A log matches its LOCALIZED behaviour label (EN and
 *    HE, via behaviorTypeLabel) as well as trigger / response / notes, so a
 *    Hebrew query finds a log whose stored behaviorType is English. A log row
 *    reads in place on #/journal (requestJournalFocus("moment-" + id)) — no
 *    switch to Behaviors;
 *  · `ask`     — "Ask Arbor about '{q}'": seeds the Ask composer (prefill
 *    only, the parent sends) and opens Ask. It is listed LAST, or FIRST when
 *    the query ends with "?" (`askFirst`).
 *
 * Analytics: callers fire `search_result_tap { kind }` only — never the query.
 */
import { useEffect, useMemo, useState } from "react";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { ageMonthsFromProfile } from "../../lib/childAge";
import { translate } from "../../lib/i18n";
import { searchnavText } from "../../lib/i18nElevation/searchnav";
import { behaviorTypeLabel } from "../../content/behaviorTaxonomy";
import { normalizeSearchText } from "../../lib/searchNormalize";
import type { HardMomentContext } from "../../content/pilotRelease";
import type { SearchEntry, SearchKind } from "../../lib/searchIndex";

/** The searchIndex module surface we consume after dynamic import. */
export type SearchIndexModule = {
  getSearchIndex: () => readonly SearchEntry[];
  searchCatalog: (query: string, limit?: number, context?: HardMomentContext) => SearchEntry[];
};

export type RecordKind = "log" | "thread" | "milestone-record" | "plan";

/** One row either surface renders. Icon/colour are names/tokens, not nodes. */
export interface SearchRow {
  id: string;
  kind: SearchKind | RecordKind | "ask";
  label: string;
  sub: string;
  icon: string;
  color: string;
  go: () => void;
}

export const KIND_TOKEN: Partial<Record<SearchKind, string>> = {
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

export const KIND_ICON: Partial<Record<SearchKind, string>> = {
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

/** The text a log is matched on: its localized labels in BOTH languages plus
 *  the stored type and the parent's own words. Pure — tested directly. */
export function logSearchText(l: { behaviorType: string; trigger?: string; response?: string; notes?: string }): string {
  const tr = (lang: "en" | "he") => (k: string) => translate(lang, k);
  return normalizeSearchText([
    l.behaviorType,
    behaviorTypeLabel(l.behaviorType, tr("en"), "full"),
    behaviorTypeLabel(l.behaviorType, tr("en"), "short"),
    behaviorTypeLabel(l.behaviorType, tr("he"), "full"),
    behaviorTypeLabel(l.behaviorType, tr("he"), "short"),
    l.trigger ?? "",
    l.response ?? "",
    l.notes ?? "",
  ].join(" "));
}

/** "?" at the end of the query asks first. */
export const askFirst = (q: string): boolean => q.trim().endsWith("?");

export function useSearchResults(q: string, opts: { enabled: boolean; catalogLimit?: number; recordLimit?: number; onNavigate?: () => void }) {
  const {
    behaviorLogs, milestones, actionPlans, conversations, childProfile,
    setActiveTab, openConversation, setSelectedLens, requestJournalFocus, seedCoach,
  } = useArbor();
  const { t, uiLang } = useLanguage();
  const heLang = uiLang === "he";

  // W2.4 lazy index: dynamic-import the catalog module on first use only.
  const [indexMod, setIndexMod] = useState<SearchIndexModule | null>(null);
  useEffect(() => {
    if (!opts.enabled || indexMod) return;
    let alive = true;
    import("../../lib/searchIndex")
      .then((m) => { if (alive) setIndexMod(m); })
      .catch(() => { /* search degrades to record results only */ });
    return () => { alive = false; };
  }, [opts.enabled, indexMod]);

  const pick = (p: { en: string; he: string }) => (heLang ? p.he : p.en);
  const RECORD_KIND_KEY: Record<RecordKind | "ask", string> = {
    log: "sm.kind.log", thread: "sm.kind.thread", "milestone-record": "sm.kind.milestone", plan: "sm.kind.plan", ask: "sm.kind.ask",
  };
  /** The badge a row wears: record/ask kinds from sm.kind.*, catalogue kinds from searchnav. */
  const kindLabel = (k: SearchRow["kind"]) =>
    k in RECORD_KIND_KEY ? t(RECORD_KIND_KEY[k as RecordKind | "ask"]) : searchnavText("elev.searchnav.kind." + k, heLang);

  const toRow = (e: SearchEntry): SearchRow => ({
    id: e.id,
    kind: e.kind,
    label: pick(e.title),
    sub: pick(e.sub) || kindLabel(e.kind),
    icon: KIND_ICON[e.kind] ?? "search",
    color: KIND_TOKEN[e.kind] ?? "var(--arbor-green-ink)",
    // B-ASKJB-12: a scholar entry preselects its lens, then opens Ask.
    go: () => { if (e.lens) setSelectedLens(e.lens); setActiveTab(e.tab); },
  });

  const term = q.trim();

  // Zero-query: the go-anywhere command list (route entries from the index).
  const routes = useMemo<SearchRow[]>(() => {
    if (!indexMod) return [];
    return indexMod.getSearchIndex().filter((e) => e.kind === "route").map(toRow);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [indexMod, heLang]);

  // Query: forgiving HE+EN catalog search. The governed hard-moment catalogue
  // is fail-closed on age + locale, so the child context is supplied.
  const catalog = useMemo<SearchRow[]>(() => {
    if (!indexMod || !term) return [];
    const now = new Date();
    return indexMod.searchCatalog(term, opts.catalogLimit ?? 12, {
      locale: heLang ? "he" : "en", now, ageMonths: ageMonthsFromProfile(childProfile, now),
    }).map(toRow);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [indexMod, term, heLang, childProfile, opts.catalogLimit]);

  // The active child's records — on-device only, never in searchIndex.
  const record = useMemo<SearchRow[]>(() => {
    const needle = normalizeSearchText(term);
    // Marks alone are not a private-record query; never enumerate records.
    if (!needle) return [];
    const out: SearchRow[] = [];
    for (const l of behaviorLogs) {
      if (!logSearchText(l).includes(needle)) continue;
      out.push({
        id: "log-" + l.id, kind: "log",
        label: behaviorTypeLabel(l.behaviorType, t, "full"), sub: l.trigger,
        icon: "schedule", color: "var(--arbor-sky-ink)",
        // Read in place: the journal entry, focused — never a Behaviors switch.
        go: () => { requestJournalFocus("moment-" + l.id); setActiveTab("journal"); },
      });
    }
    for (const c of conversations) {
      if (normalizeSearchText(c.title).includes(needle) || c.messages.some((m) => normalizeSearchText(m.text).includes(needle)))
        out.push({ id: "thread-" + c.id, kind: "thread", label: c.title, sub: t("sm.threadSub"), icon: "psychology", color: "var(--arbor-peach-ink)", go: () => { openConversation(c.id); setActiveTab("coach"); } });
    }
    for (const m of milestones) {
      if (normalizeSearchText(m.title).includes(needle))
        out.push({ id: "ms-" + m.id, kind: "milestone-record", label: m.title, sub: m.description, icon: "check_circle", color: "var(--arbor-green-ink)", go: () => setActiveTab("milestones") });
    }
    for (const p of actionPlans) {
      if (normalizeSearchText(`${p.title} ${p.issue}`).includes(needle))
        out.push({ id: "plan-" + p.id, kind: "plan", label: p.title, sub: p.issue, icon: "tune", color: "var(--arbor-lav-ink)", go: () => setActiveTab("plans") });
    }
    return out.slice(0, opts.recordLimit ?? 12);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [term, behaviorLogs, conversations, milestones, actionPlans, t, opts.recordLimit]);

  // "Ask Arbor about …" — prefill only; the parent sends.
  const ask: SearchRow | null = term
    ? {
        id: "ask", kind: "ask",
        label: t("sm.askAbout", { q: term }), sub: t("sm.askAbout.sub"),
        icon: "forum", color: "var(--arbor-clay-deep)",
        go: () => { seedCoach({ prompt: term, source: "search" }); setActiveTab("coach"); },
      }
    : null;

  /** Every row in render order: catalog, record, then the ask row (first on "?"). */
  const ordered: SearchRow[] = term
    ? (ask && askFirst(term) ? [ask, ...catalog, ...record] : [...catalog, ...record, ...(ask ? [ask] : [])])
    : routes;

  return { indexReady: !!indexMod, routes, catalog, record, ask, ordered, kindLabel };
}

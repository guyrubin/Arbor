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
 *    only, the parent sends) and opens Talk. It is listed LAST, or FIRST when
 *    the query ends with "?" (`askFirst`).
 *
 * v3 IA-05 — search as the universal fallback. Every row except the ask row
 * names its HOME (lib/companionPlaces homeForTab, table A): the place or door
 * it opens in, with that home's glyph. The surfaces list rows under their
 * home. A route row wears the home's glyph and reads as a breadcrumb ("My
 * child › Milestones"). The index itself is untouched (its route `sub` stays
 * the place label, B-SHELL-37): home, glyph and crumb are computed here. The
 * parent's saved questions (kind `family-topic`, this child's only, on-device)
 * open their sheet through FEAT-05's one door, openFamilyTopicSheet(). The kind
 * is hyphenated on purpose: the bare word topic, quoted, is a Material
 * Symbols name outside the font subset, and the icon guard reads every quoted
 * lowercase literal.
 *
 * v3 IA-05r: Talk is a panel over the page the parent is on, never a page of
 * its own. Every row whose home is the Talk door (a thread, the ask row, the
 * coach route, a scholar lens) opens it through requestCompanionConversation
 * and leaves the active tab alone. A home's own row (Talk with Arbor, Care,
 * together, …) carries no crumb and no second line: its group header already
 * names it. A saved question is chosen through the sheet's own path
 * (chooseFamilyTopic): a set-aside one comes back before it is made active.
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
import { COMPANION_DOORS, COMPANION_PLACES, homeForTab } from "../../lib/companionPlaces";
import { requestCompanionConversation } from "../../lib/companionConversation";
import { openFamilyTopicSheet } from "../companion/familyTopicEvents";
import { INTENT_ICON, chooseFamilyTopic, type FamilyTopic } from "../../lib/familyTopics";
import type { ActiveTab } from "../../lib/routes";
import type { HardMomentContext } from "../../content/pilotRelease";
import type { SearchEntry, SearchKind } from "../../lib/searchIndex";

/** The searchIndex module surface we consume after dynamic import. */
export type SearchIndexModule = {
  getSearchIndex: () => readonly SearchEntry[];
  searchCatalog: (query: string, limit?: number, context?: HardMomentContext) => SearchEntry[];
};

export type RecordKind = "log" | "thread" | "milestone-record" | "plan" | "family-topic";

/** v3 IA-05 — the home (a place or a door) a row is listed under. */
export interface SearchRowGroup {
  id: string;
  label: string;
  icon: string;
}

/** One row either surface renders. Icon/colour are names/tokens, not nodes. */
export interface SearchRow {
  id: string;
  kind: SearchKind | RecordKind | "ask";
  label: string;
  sub: string;
  icon: string;
  color: string;
  go: () => void;
  /** v3 IA-05: the home the row is listed under. The ask row has none. */
  group?: SearchRowGroup;
  /** v3 IA-05: when set, the row's second line is this breadcrumb (its home,
   *  then where it opens) instead of `sub`. A route row carries one unless it
   *  is its home's own route (then `sub` is empty and there is no second line);
   *  a record row only when it has no words of its own to show. */
  crumb?: readonly string[];
}

/** v3 IA-05: the order homes are listed in before anything is typed — the
 *  three places, then the three doors, as the Sidebar lists them. */
const HOME_ORDER: readonly string[] = [...COMPANION_PLACES, ...COMPANION_DOORS].map((home) => home.id);

const NO_TOPICS: readonly FamilyTopic[] = [];

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

/** Content kinds only: a route row wears its home's glyph (v3 IA-05). */
export const KIND_ICON: Partial<Record<SearchKind, string>> = {
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
    familyTopics = NO_TOPICS, selectFamilyTopic, updateFamilyTopic,
  } = useArbor();
  const { t, uiLang } = useLanguage();
  const heLang = uiLang === "he";
  const activeChildId = childProfile?.id;

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
    log: "sm.kind.log", thread: "sm.kind.thread", "milestone-record": "sm.kind.milestone", plan: "sm.kind.plan", "family-topic": "sm.kind.topic", ask: "sm.kind.ask",
  };
  /** The badge a row wears: record/ask kinds from sm.kind.*, catalogue kinds from searchnav. */
  const kindLabel = (k: SearchRow["kind"]) =>
    k in RECORD_KIND_KEY ? t(RECORD_KIND_KEY[k as RecordKind | "ask"]) : searchnavText("elev.searchnav.kind." + k, heLang);

  /** v3 IA-05 — where a destination lives: its home (place or door) as the
   *  row's group, and the breadcrumb "home › destination". A home's own route
   *  (Now's overview, the Talk door's coach, …) has no crumb: the group header
   *  above it already names the home, so a crumb of the home alone would only
   *  say it again (v3 IA-05r). */
  const placeOf = (tab: ActiveTab, destination: string): { group: SearchRowGroup; crumb?: readonly string[] } => {
    const home = homeForTab(tab);
    const named = home.kind === "place" ? home.place : home.door;
    const group: SearchRowGroup = { id: named.id, label: pick(named), icon: named.icon };
    return named.tab === tab || destination === group.label ? { group } : { group, crumb: [group.label, destination] };
  };
  /** A record row keeps its own words as its second line; only a row without
   *  any reads as the breadcrumb. */
  const crumbUnless = (words: string | undefined, crumb: readonly string[] | undefined) => (words?.trim() || !crumb ? {} : { crumb });

  const toRow = (e: SearchEntry): SearchRow => {
    const label = pick(e.title);
    const { group, crumb } = placeOf(e.tab, label);
    const route = e.kind === "route";
    return {
      id: e.id,
      kind: e.kind,
      label,
      // v3 IA-05r: a home's own route row has no second line; its header,
      // its label and its glyph already say where it goes.
      sub: route && !crumb ? "" : pick(e.sub) || kindLabel(e.kind),
      // v3 IA-05: a route row wears its home's glyph and reads as a crumb;
      // a content row keeps its kind glyph and its shelf/domain line.
      icon: route ? group.icon : KIND_ICON[e.kind] ?? "search",
      color: KIND_TOKEN[e.kind] ?? "var(--arbor-green-ink)",
      group,
      ...(route && crumb ? { crumb } : {}),
      // B-ASKJB-12: a scholar entry preselects its lens, then opens Talk.
      // v3 IA-05r: the Talk door's rows open the panel over the current page.
      go: () => {
        if (e.lens) setSelectedLens(e.lens);
        if (e.tab === "coach") requestCompanionConversation({ source: "search" });
        else setActiveTab(e.tab);
      },
    };
  };

  const term = q.trim();

  // Zero-query: the go-anywhere command list (route entries from the index),
  // home by home in the Sidebar's order (a stable sort keeps each home's own
  // order).
  const routes = useMemo<SearchRow[]>(() => {
    if (!indexMod) return [];
    const rank = (row: SearchRow) => HOME_ORDER.indexOf(row.group?.id ?? "");
    return indexMod.getSearchIndex().filter((e) => e.kind === "route").map(toRow).sort((a, b) => rank(a) - rank(b));
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
    // v3 IA-05: the parent's own saved questions lead the records. They are
    // this child's (ArborContext keeps them per child, and a question filed
    // under another child is skipped here too), matched on-device and never
    // indexed. A row moves to Now, where questions live, chooses the question
    // through the sheet's own path, then opens its sheet through FEAT-05's one
    // door (Shell holds the only listener and drops it while Kid Mode is open).
    // v3 IA-05r: chooseFamilyTopic brings a set-aside question back before it
    // becomes the active one, as a tap in the sheet does. The sheet opens once
    // that choice has settled; if the write failed, it opens on the list with
    // the question still set aside and nothing chosen.
    const sheetTitle = t("companion.family-topic-sheet.what-we-re-exploring");
    const nowHome = placeOf("overview", sheetTitle).group;
    for (const topic of familyTopics) {
      if (topic.childId !== activeChildId || !normalizeSearchText(topic.title).includes(needle)) continue;
      out.push({
        id: "topic-" + topic.id, kind: "family-topic", label: topic.title, sub: sheetTitle,
        icon: INTENT_ICON[topic.intent] ?? "help", color: "var(--arbor-clay-deep)",
        group: nowHome, crumb: [nowHome.label, sheetTitle],
        go: () => {
          setActiveTab("overview");
          void chooseFamilyTopic(topic, { updateFamilyTopic, selectFamilyTopic })
            .catch(() => undefined)
            .then(() => openFamilyTopicSheet());
        },
      });
    }
    const journal = placeOf("journal", t("nav.tab.journal"));
    for (const l of behaviorLogs) {
      if (!logSearchText(l).includes(needle)) continue;
      out.push({
        id: "log-" + l.id, kind: "log",
        label: behaviorTypeLabel(l.behaviorType, t, "full"), sub: l.trigger,
        icon: "schedule", color: "var(--arbor-sky-ink)",
        group: journal.group, ...crumbUnless(l.trigger, journal.crumb),
        // Read in place: the journal entry, focused — never a Behaviors switch.
        go: () => { requestJournalFocus("moment-" + l.id); setActiveTab("journal"); },
      });
    }
    // v3 IA-05r: a thread wears the Talk door's glyph and opens in the Talk
    // panel, over the page the parent is on. It sits under the Talk with
    // Arbor header, so its second line is its own (sm.threadSub), not a crumb
    // that names the door again.
    const talk = placeOf("coach", t("nav.tab.coach"));
    for (const c of conversations) {
      if (normalizeSearchText(c.title).includes(needle) || c.messages.some((m) => normalizeSearchText(m.text).includes(needle)))
        out.push({ id: "thread-" + c.id, kind: "thread", label: c.title, sub: t("sm.threadSub"), icon: talk.group.icon, color: "var(--arbor-peach-ink)", group: talk.group, go: () => { openConversation(c.id); requestCompanionConversation({ source: "search" }); } });
    }
    const milestonesAt = placeOf("milestones", t("nav.tab.milestones"));
    for (const m of milestones) {
      if (normalizeSearchText(m.title).includes(needle))
        out.push({ id: "ms-" + m.id, kind: "milestone-record", label: m.title, sub: m.description, icon: "check_circle", color: "var(--arbor-green-ink)", group: milestonesAt.group, ...crumbUnless(m.description, milestonesAt.crumb), go: () => setActiveTab("milestones") });
    }
    const plansAt = placeOf("plans", t("nav.tab.plans"));
    for (const p of actionPlans) {
      if (normalizeSearchText(`${p.title} ${p.issue}`).includes(needle))
        out.push({ id: "plan-" + p.id, kind: "plan", label: p.title, sub: p.issue, icon: "tune", color: "var(--arbor-lav-ink)", group: plansAt.group, ...crumbUnless(p.issue, plansAt.crumb), go: () => setActiveTab("plans") });
    }
    return out.slice(0, opts.recordLimit ?? 12);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [term, behaviorLogs, conversations, milestones, actionPlans, familyTopics, activeChildId, t, heLang, opts.recordLimit]);

  // "Ask Arbor about …" — prefill only; the parent sends. seedCoach opens the
  // Talk panel itself (v3 IA-05r: no move to #/coach). Standalone
  // diacritics have no question text and must not become an Ask affordance.
  // Normalization is eligibility-only: meaningful questions keep their exact
  // original words, punctuation and marks in the label and composer.
  const ask: SearchRow | null = normalizeSearchText(term)
    ? {
        id: "ask", kind: "ask",
        label: t("sm.askAbout", { q: term }), sub: t("sm.askAbout.sub"),
        icon: "forum", color: "var(--arbor-clay-deep)",
        // F-TALK-1: seedCoach opens the conversation panel over this place.
        go: () => { seedCoach({ prompt: term, source: "search" }); },
      }
    : null;

  /** Every row in render order: catalog, record, then the ask row (first on "?"). */
  const ordered: SearchRow[] = term
    ? (ask && askFirst(term) ? [ask, ...catalog, ...record] : [...catalog, ...record, ...(ask ? [ask] : [])])
    : routes;

  return { indexReady: !!indexMod, routes, catalog, record, ask, ordered, kindLabel };
}

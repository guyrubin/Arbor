/**
 * B-ASKJB-14 — Journal finds things: search, "Hard moments" filter, month
 * jump. The predicates are pure (lib/journalFilters); the export moved to
 * lib/behaviorExport with its snapshot; the row's wiring is read from source
 * (no jsdom in this repo).
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  firstGroupOfMonth, isHardMomentSignal, journalMonthKeys, journalSearchText, matchesJournalFilter, monthLabel,
  type JournalFilterContext,
} from "../../lib/journalFilters";
import { buildBehaviorExportHtml, type BehaviorExportRow } from "../../lib/behaviorExport";
import { en, he, translate } from "../../lib/i18n";
import { behaviorTypeLabel } from "../../content/behaviorTaxonomy";
import type { TimelineSignal } from "../../lib/signalTimeline";

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(here, "..", "..");
const read = (rel: string) => readFileSync(path.join(SRC, rel), "utf8");

const sig = (id: string, over: Partial<TimelineSignal> = {}): TimelineSignal =>
  ({ id, kind: "moment", at: "2026-09-20T10:00:00.000Z", tone: "lav", ...over }) as TimelineSignal;

const logs = new Map([
  ["a", { behaviorType: "Transition Refusal", trigger: "Would not put shoes on", response: "Gave two choices", notes: "" }],
  ["b", { behaviorType: "Moment", trigger: "Sang in the bath", response: "", notes: "loves bubbles" }],
  ["c", { behaviorType: "Sleep Meltdown", trigger: "נעליים בבוקר", response: "חיבוק", notes: "" }],
]);
const signals = [
  sig("moment-a", { refTitle: "Transition Refusal", detail: "Would not put shoes on" }),
  sig("moment-b", { refTitle: "Moment", detail: "Sang in the bath" }),
  sig("moment-c", { refTitle: "Sleep Meltdown", detail: "נעליים בבוקר", at: "2026-08-03T10:00:00.000Z" }),
  sig("milestone-m1", { kind: "milestone", refTitle: "Hops on one foot" }),
];

const ctx = (lang: "en" | "he", over: Partial<JournalFilterContext> = {}): JournalFilterContext => ({
  filter: "all", query: "", logsById: logs, keptIds: new Set(["moment-b"]),
  labelOf: (s) => (s.kind === "moment" && s.refTitle ? behaviorTypeLabel(s.refTitle, (k: string) => translate(lang, k)) : s.refTitle ?? ""),
  ...over,
});
const ids = (c: JournalFilterContext) => signals.filter((s) => matchesJournalFilter(s, c)).map((s) => s.id);

describe("B-ASKJB-14 — filter predicates (pure)", () => {
  it("'shoes' narrows to the one row that says it (trigger text)", () => {
    expect(ids(ctx("en", { query: "shoes" }))).toEqual(["moment-a"]);
    expect(ids(ctx("en", { query: "  SHOES " }))).toEqual(["moment-a"]); // folded + trimmed
  });

  it("search reaches response and notes too, never only the title", () => {
    expect(ids(ctx("en", { query: "two choices" }))).toEqual(["moment-a"]);
    expect(ids(ctx("en", { query: "bubbles" }))).toEqual(["moment-b"]);
  });

  it("HE search matches Hebrew text and the HE type label", () => {
    expect(ids(ctx("he", { query: "נעליים" }))).toEqual(["moment-c"]);
    const heLabel = behaviorTypeLabel("Transition Refusal", (k: string) => translate("he", k));
    expect(heLabel).not.toBe("Transition Refusal");
    expect(ids(ctx("he", { query: heLabel }))).toContain("moment-a");
  });

  it("Hard moments = incident types only; Kept from Arbor = provenance ids", () => {
    expect(ids(ctx("en", { filter: "hard" }))).toEqual(["moment-a", "moment-c"]);
    expect(isHardMomentSignal(signals[1], logs)).toBe(false);
    expect(isHardMomentSignal(signals[3], logs)).toBe(false); // a milestone is never a hard moment
    expect(ids(ctx("en", { filter: "kept" }))).toEqual(["moment-b"]);
    expect(ids(ctx("en", { filter: "hard", query: "shoes" }))).toEqual(["moment-a"]);
  });

  it("empty query + All shows everything; a miss shows nothing (the empty state)", () => {
    expect(ids(ctx("en"))).toEqual(signals.map((s) => s.id));
    expect(ids(ctx("en", { query: "zebra" }))).toEqual([]);
  });

  it("journalSearchText folds the label, title, detail and log fields once", () => {
    expect(journalSearchText({ refTitle: "Tantrum", detail: "X" }, { trigger: "Shoes", response: "", notes: "" }, "Big Feelings")).toBe("big feelings\ntantrum\nx\nshoes");
  });

  it("month jump: months from groupByDay keys, newest first, 'ongoing' skipped; scrolls to the month's first day", () => {
    const keys = ["2026-09-20", "2026-09-02", "2026-08-03", "ongoing"];
    expect(journalMonthKeys(keys)).toEqual(["2026-09", "2026-08"]);
    expect(firstGroupOfMonth(keys, "2026-08")).toBe("2026-08-03");
    expect(firstGroupOfMonth(keys, "2026-07")).toBeNull();
    expect(monthLabel("2026-09", "en")).toBe("September 2026");
    expect(monthLabel("2026-09", "he")).toMatch(/ספטמבר/);
  });
});

describe("B-ASKJB-14 — the export moved with the function (same PDF as Behaviors)", () => {
  const t = (k: string, v?: Record<string, string | number>) => translate("en", k, v);
  const row = { timestamp: "2026-09-20T10:00:00.000Z", behaviorType: "Tantrum", intensity: 3, durationMinutes: 5, resolved: false, trigger: "Shoes <b>", response: "Hug", context: "home<script>" } as unknown as BehaviorExportRow;

  it("snapshot: one escaped row, the same headings, the generated-at count", () => {
    const html = buildBehaviorExportHtml([row], { t, lang: "en", now: Date.parse("2026-09-21T09:00:00.000Z") });
    expect(html).toContain(`<h1>${t("beh.pdf.heading")}</h1>`);
    expect(html).toContain("<td>Shoes &lt;b&gt;</td>");
    expect(html).toContain("<td>home&lt;script&gt;</td>"); // the context column is escaped now
    expect(html).not.toContain("<script>");
    expect((html.match(/<tr><td>/g) || []).length).toBe(1);
    expect(html).toContain(`<td>3/5</td><td>5m</td><td>${t("beh.open")}</td>`);
  });

  it("Behaviors and the Journal both print through lib/behaviorExport", () => {
    const beh = read("components/tabs/BehaviorsTab.tsx");
    expect(beh).toContain("const exportPdf = () => exportBehaviorPdf(filtered, { t, lang: uiLang });");
    expect(beh).not.toContain("w.document.write(html)");
    const journal = read("components/tabs/JournalTab.tsx");
    expect(journal).toContain("exportBehaviorPdf(rows, { t, lang: uiLang });");
    expect(journal).toMatch(/journalFilter === "hard" && visibleSignals\.some/);
  });
});

describe("B-ASKJB-14 — the filter row (source facts)", () => {
  const journal = read("components/tabs/JournalTab.tsx");
  const row = journal.slice(journal.indexOf('data-testid="journal-filters"'), journal.indexOf('data-testid="journal-filter-empty"') + 600);

  it("chips, search, month menu and the empty state; every control ≥44 px; logical props only", () => {
    expect(row).toContain("JOURNAL_FILTERS.map");
    expect(row).toContain('data-testid="journal-search"');
    expect(row).toContain('data-testid="journal-month"');
    for (const control of row.match(/<(button|select|input)\b[^>]*?className="[^"]*"/g) ?? []) {
      expect(control, control.slice(0, 80)).toMatch(/min-h-11/);
    }
    expect(row).not.toMatch(/\b(ml|mr|pl|pr)-\d|text-left|text-right/);
    expect(journal).toContain('id={`journal-day-${group.key}`}');
  });

  it("search state is per session: no storage, no request", () => {
    const filterCode = journal.slice(journal.indexOf("B-ASKJB-14 — Journal finds things."), journal.indexOf("const monthKeys"));
    expect(filterCode).not.toMatch(/localStorage|sessionStorage|fetch\(|api\.|track\(/);
  });

  it("EN + HE copy", () => {
    for (const k of ["journal.filter.aria", "journal.filter.all", "journal.filter.hard", "journal.filter.kept", "journal.filter.search", "journal.filter.month", "journal.filter.empty", "journal.filter.clear"]) {
      expect(en[k], k).toBeTruthy();
      expect(he[k], k).toBeTruthy();
      expect(he[k]).not.toMatch(/[A-Za-z]/);
    }
  });
});

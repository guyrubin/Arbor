import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BehaviorLog } from "../../types";
import { translate } from "../../lib/i18n";
import { fmtDay } from "../../lib/formatDate";
import { statesText } from "../../lib/i18nElevation/states";

// Run the real Journal module and its callbacks with controlled local state.
// SSR checks markup/contracts, not browser layout, native disclosure keyboard
// behavior or focus. Those require the exact-font EN/HE capture matrix.
const harness = vi.hoisted(() => ({
  lang: "en" as "en" | "he", logs: [] as BehaviorLog[], loaded: true,
  filter: null as "hard" | null, slots: [] as any[], cursor: 0,
  controls: new Map<string, any>(), sheet: null as any, compose: null as any,
}));
vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");
  return { ...actual, useState: (initial: any) => {
    const index = harness.cursor++;
    if (!(index in harness.slots)) harness.slots[index] = typeof initial === "function" ? initial() : initial;
    return [harness.slots[index], (next: any) => {
      harness.slots[index] = typeof next === "function" ? next(harness.slots[index]) : next;
    }];
  } };
});
vi.mock("react/jsx-runtime", async () => {
  const actual = await vi.importActual<typeof import("react/jsx-runtime")>("react/jsx-runtime");
  const capture = (type: any, props: any, key?: any, many = false) => {
    if (props?.["data-testid"]) harness.controls.set(props["data-testid"], props);
    if (props?.["data-module"] === "journal-compose") harness.compose = props;
    return (many ? actual.jsxs : actual.jsx)(type, props, key);
  };
  return { ...actual, jsx: (type: any, props: any, key?: any) => capture(type, props, key), jsxs: (type: any, props: any, key?: any) => capture(type, props, key, true) };
});
vi.mock("react/jsx-dev-runtime", async () => {
  const actual = await vi.importActual<typeof import("react/jsx-dev-runtime")>("react/jsx-dev-runtime");
  return { ...actual, jsxDEV: (type: any, props: any, key: any, isStatic: boolean, source: any, self: any) => {
    if (props?.["data-testid"]) harness.controls.set(props["data-testid"], props);
    if (props?.["data-module"] === "journal-compose") harness.compose = props;
    return actual.jsxDEV(type, props, key, isStatic, source, self);
  } };
});
vi.mock("motion/react", () => ({ motion: { div: ({ initial: _i, animate: _a, exit: _e, ...props }: any) => <div {...props} /> } }));
vi.mock("../../context/ArborContext", () => ({ useArbor: () => ({
  childProfile: { id: "child-a", name: "Dylan", age: 3 }, milestones: [], playLogs: [],
  behaviorLogs: harness.logs, logsLoaded: harness.loaded, pendingJournalFocusId: null,
  pendingJournalFilter: harness.filter, consumeJournalFocus: vi.fn(), consumeJournalFilter: vi.fn(),
  openCaptureSheet: vi.fn(), toggleLogResolved: vi.fn(), deleteLog: vi.fn(),
}) }));
vi.mock("../../context/LanguageContext", () => ({ useLanguage: () => ({
  uiLang: harness.lang, t: (key: string, vars?: Record<string, string | number>) => translate(harness.lang, key, vars),
}) }));
vi.mock("../../hooks/useTimeline", () => ({ useTimeline: () => [] }));
vi.mock("../../hooks/useHashQuery", () => ({ useHashQuery: () => new URLSearchParams("view=all"), goToRoute: vi.fn() }));
vi.mock("../../lib/analytics", () => ({ track: vi.fn() }));
vi.mock("../../lib/behaviorExport", () => ({ exportBehaviorPdf: vi.fn() }));
vi.mock("../journal/JournalShelves", () => ({ default: () => null, shelfFromQuery: () => null }));
vi.mock("../overview/QuickLogModal", () => ({ default: () => null }));
vi.mock("../journal/JournalEntrySheet", () => ({ default: (props: any) => { harness.sheet = props; return null; } }));

import JournalTab from "./JournalTab";

const latestWords = "A full parent-written memory, with every original word retained beyond the two-line preview.";
const latestAt = "2026-10-09T12:45:00.000Z";
const log = (id: string, timestamp: string, trigger: string, behaviorType = "Moment"): BehaviorLog => ({
  id, timestamp, trigger, behaviorType, response: "", notes: "", context: "Home", durationMinutes: 0, resolved: true,
});
const render = () => {
  harness.cursor = 0; harness.controls.clear();
  return renderToStaticMarkup(<JournalTab primaryMoveProps={{ "data-primary-move": "open-shelf" }} densityToggle={<div data-density-toggle=""><button className="min-h-11">Feed</button><button className="min-h-11">Story</button></div>} />);
};
const header = (html: string) => html.slice(html.indexOf('<header '), html.indexOf('</header>'));
const decode = (html: string) => html.replace(/&#x27;/g, "'").replace(/&amp;/g, "&").replace(/&quot;/g, '"');

beforeEach(() => {
  harness.lang = "en"; harness.logs = []; harness.loaded = true; harness.filter = null;
  harness.slots = []; harness.cursor = 0; harness.controls.clear(); harness.sheet = null;
});

for (const lang of ["en", "he"] as const) describe(`${lang}: Journal record hierarchy`, () => {
  beforeEach(() => { harness.lang = lang; });

  it("keeps three real modules, one primary control, and shelves/density in one compact navigation row", () => {
    harness.logs = [log("latest", latestAt, latestWords)];
    const html = render();
    expect([...html.matchAll(/data-module="([^"]+)"/g)].map(match => match[1])).toEqual(["journal-header", "journal-compose", "journal-thread"]);
    expect(html.match(/data-primary-move="/g)).toHaveLength(1);
    const nav = header(html).match(/<div data-testid="journal-header-nav"[\s\S]*?<\/div><\/div>/)?.[0] ?? "";
    expect(nav).toContain('data-testid="journal-all-back"');
    expect(nav).toContain('data-density-toggle=""');
    expect(nav).toContain("min-h-11");
    expect(header(html)).toMatch(/<h1 class="mt-2 t-lg leading-snug"/);
    expect(header(html)).not.toMatch(/t-2xl|md:grid-cols/);
  });

  it("starts the accessible latest-entry context closed while retaining full source words and localized date", () => {
    harness.logs = [log("latest", latestAt, latestWords)];
    const out = header(render());
    const details = out.match(/<details[^>]+>/)?.[0] ?? "";
    expect(details).toContain('data-testid="journal-last-context"');
    expect(details).not.toMatch(/\bopen(?:=|\s|>)/);
    const summary = out.match(/<summary[\s\S]*?<\/summary>/)?.[0] ?? "";
    expect(summary).toContain('data-testid="journal-last-context-toggle"');
    expect(summary).toContain("min-h-11");
    expect(decode(summary)).toContain(translate(lang, "elev.journal.lastEntry.summary", { date: fmtDay(latestAt, lang) }));
    expect(decode(summary)).toContain(`aria-label="${translate(lang, "elev.journal.lastEntry.summary", { date: fmtDay(latestAt, lang) })} · Dylan"`);
    expect(out).toContain(latestWords);
    expect(decode(out)).toContain(translate(lang, "elev.journal.lastEntry.open"));
    expect(harness.controls.get("journal-last-words").className).toContain("min-h-11");
  });

  it("opens the complete latest overall entry even under the hard filter, then closes without resetting that filter", () => {
    harness.logs = [log("latest", latestAt, latestWords), log("hard", "2026-10-08T08:00:00.000Z", "Hard moment words", "Sleep Meltdown")];
    harness.filter = "hard";
    let html = render();
    expect(html.match(/data-testid="journal-record-row"/g)).toHaveLength(1);
    expect(html).toContain('id="journal-signal-moment-hard"');
    expect(html).not.toContain('id="journal-signal-moment-latest"');
    harness.controls.get("journal-last-words").onClick();
    render();
    expect(harness.sheet.signal.id).toBe("moment-latest");
    expect(harness.sheet.detail).toBe(latestWords);
    expect(harness.sheet.momentLog.id).toBe("latest");
    expect(harness.sheet.when).toBe(new Date(latestAt).toLocaleString(lang, { dateStyle: "medium", timeStyle: "short" }));
    harness.sheet.onClose();
    html = render();
    expect(harness.sheet.signal).toBeNull();
    expect(html).toMatch(/data-testid="journal-filter-hard" aria-pressed="true"/);
    expect(html.match(/data-testid="journal-record-row"/g)).toHaveLength(1);
  });

  it("teaches the empty record once and its real CTA reaches the existing capture bar", () => {
    const html = render();
    expect(header(html)).not.toContain("journal-last-context");
    expect(header(html)).not.toContain("journal-story-line");
    expect(header(html)).not.toContain("journal-week-zero-line");
    expect(decode(html)).toContain(statesText("elev.states.journal.body", lang === "he", { name: "Dylan" }));
    expect(html.match(/data-testid="journal-empty-cta"/g)).toHaveLength(1);
    expect(html).not.toContain('data-testid="empty-state-art"');
    const focus = vi.fn(), scrollIntoView = vi.fn(), querySelector = vi.fn(() => ({ focus }));
    harness.compose.ref.current = { scrollIntoView, querySelector };
    harness.controls.get("journal-empty-cta").onClick();
    expect(scrollIntoView).toHaveBeenCalledOnce();
    expect(querySelector).toHaveBeenCalledWith("[data-capture-bar] button");
    expect(focus).toHaveBeenCalledOnce();
  });

  it("loading never flashes an empty action, and a wordless latest entry keeps an openable title/date", () => {
    harness.loaded = false;
    expect(render()).not.toContain('data-testid="journal-empty-cta"');
    harness.loaded = true; harness.logs = [log("wordless", latestAt, "")];
    const html = render();
    expect(html).toContain('data-testid="journal-last-context"');
    expect(html).toContain('data-story="entry"');
    harness.controls.get("journal-last-words").onClick(); render();
    expect(harness.sheet.signal.id).toBe("moment-wordless");
    expect(harness.sheet.title).toBeTruthy();
    expect(harness.sheet.when).toBeTruthy();
  });
});

for (const lang of ["en", "he"] as const) describe(`${lang}: latest entry and feed retain content lineage`, () => {
  it.each(["ai_draft", "unverified", undefined] as const)("%s is factual on both visible entry surfaces, while edit stays available", contentSource => {
    harness.lang = lang;
    harness.logs = [{ ...log("lineage", latestAt, latestWords), ...(contentSource ? { contentSource } : {}) }];
    const html = decode(render());
    if (contentSource) {
      const label = translate(lang, `kept.capture.source.${contentSource}`);
      expect(html).toContain(`data-testid="journal-last-content-source"`);
      expect(html).toContain(`data-testid="journal-row-content-source"`);
      expect(html.split(label)).toHaveLength(3);
    } else {
      expect(html).not.toContain('data-testid="journal-last-content-source"');
      expect(html).not.toContain('data-testid="journal-row-content-source"');
    }
    harness.controls.get("journal-last-words").onClick(); render();
    expect(harness.sheet.signal.contentSource).toBe(contentSource);
    expect(harness.sheet.prov).toBe("manual");
    expect(harness.sheet.onEdit).toEqual(expect.any(Function));
  });
});

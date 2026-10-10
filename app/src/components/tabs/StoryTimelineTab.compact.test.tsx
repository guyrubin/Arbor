import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { translate } from "../../lib/i18n";
import { withChildSignals } from "../../lib/i18nElevation/childsignals";
import { PARENT_RECORD_COPY } from "../companion/parentRecordCopy";

type Button = React.ButtonHTMLAttributes<HTMLButtonElement> & { "data-testid"?: string };
const state = vi.hoisted(() => ({
  lang: "en" as "en" | "he",
  pending: [] as { memoryId: string; fact: string; status: "pending" }[],
  empty: false,
  buttons: [] as Button[],
  setActiveTab: vi.fn(),
  openCaptureSheet: vi.fn(),
}));

vi.mock("../../context/ArborContext", () => ({ useArbor: () => ({
  childProfile: { id: "child-a", name: "Noa", age: 5 },
  setActiveTab: state.setActiveTab, openCaptureSheet: state.openCaptureSheet,
  behaviorLogs: [], milestones: [], actionPlans: [], playLogs: [],
  memoryReviewItems: state.empty ? [] : [{ memoryId: "approved", fact: "Enjoys building towers", status: "approved" }],
  pendingMemoryItems: state.pending,
}) }));
vi.mock("../../context/LanguageContext", () => ({ useLanguage: () => ({
  uiLang: state.lang, t: (key: string, vars?: Record<string, string | number>) => translate(state.lang, key, vars),
}) }));
vi.mock("../../hooks/useTimeline", () => ({ useTimeline: () => state.empty ? [] : [
  { id: "moment-1", kind: "moment", at: "2026-10-01T10:00:00Z", refTitle: "Built a tower", tone: "mint" },
  { id: "moment-2", kind: "moment", at: "2026-09-01T10:00:00Z", refTitle: "Read together", tone: "mint" },
] }));
vi.mock("../../lib/analytics", () => ({ track: vi.fn() }));

const capture = vi.hoisted(() => (type: unknown, props: unknown) => {
  if (type === "button" && props && typeof props === "object") state.buttons.push(props as Button);
});
vi.mock("react/jsx-runtime", async original => {
  const runtime = await original<typeof import("react/jsx-runtime")>();
  return { ...runtime,
    jsx: (...args: Parameters<typeof runtime.jsx>) => { capture(args[0], args[1]); return runtime.jsx(...args); },
    jsxs: (...args: Parameters<typeof runtime.jsxs>) => { capture(args[0], args[1]); return runtime.jsxs(...args); },
  };
});
vi.mock("react/jsx-dev-runtime", async original => {
  const runtime = await original<typeof import("react/jsx-dev-runtime")>();
  return { ...runtime, jsxDEV: (...args: Parameters<typeof runtime.jsxDEV>) => { capture(args[0], args[1]); return runtime.jsxDEV(...args); } };
});

import StoryTimelineTab from "./StoryTimelineTab";

const css = readFileSync(new URL("./StoryTimelineTab.css", import.meta.url), "utf8");
const tt = (key: string, vars?: Record<string, string | number>) => withChildSignals(
  (name, values) => translate(state.lang, name, values), state.lang === "he",
)(key, vars);
const render = () => renderToStaticMarkup(<StoryTimelineTab />);
const occurrences = (html: string, text: string) => html.split(text).length - 1;
const click = (button: Button) => button.onClick?.({} as React.MouseEvent<HTMLButtonElement>);

beforeEach(() => {
  vi.clearAllMocks(); state.lang = "en"; state.empty = false; state.buttons = [];
  state.pending = [
    { memoryId: "pending-1", fact: "Asks for the blue cup", status: "pending" },
    { memoryId: "pending-2", fact: "Enjoys drawing together", status: "pending" },
    { memoryId: "unsafe", fact: "Noa presents with autism spectrum disorder", status: "pending" },
  ];
});
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("Story's compact secondary controls", () => {
  it.each(["en", "he"] as const)("keeps two independent native disclosures inside one group in %s", lang => {
    state.lang = lang;
    const html = render();
    expect(occurrences(html, 'data-testid="timeline-context-group"')).toBe(1);
    const group = html.match(/<div[^>]*data-testid="timeline-context-group"[^>]*>([\s\S]*?<\/details>)<\/div>/)?.[1] ?? "";
    expect(occurrences(group, "<details")).toBe(2);
    for (const [id, label] of [
      ["timeline-story-disclosure", PARENT_RECORD_COPY[lang].storySummary],
      ["timeline-months-disclosure", tt("elev.childsignals.months.title")],
    ]) {
      expect(occurrences(html, `data-testid="${id}"`)).toBe(1);
      // Native summary is the first child, so Enter/Space and expanded state
      // retain browser semantics. No shared name forces accordion exclusion.
      expect(group).toContain(`<details data-testid="${id}"><summary>${label}</summary>`);
      expect(occurrences(group, label)).toBe(1);
    }
    expect(group).not.toMatch(/<(?:details|summary)[^>]*(?:\bopen|\bname=|\brole=|\btabindex=|\bhidden|\baria-hidden)/);
    expect(group).toContain("Enjoys building towers");
    expect(group).toContain(tt("elev.childsignals.months.by", { month: new Date("2026-10-01T12:00:00Z").toLocaleDateString(lang, { month: "long", year: "numeric" }), count: 2 }));
    expect(occurrences(html, "<h1 ")).toBe(1);
    expect(occurrences(html, ">Built a tower</p>")).toBe(1);
    expect(occurrences(html, ">Read together</p>")).toBe(1);
    expect(occurrences(html, 'data-testid="timeline-filter-chips"')).toBe(1);
    expect(occurrences(html, 'data-testid="timeline-save-story"')).toBe(1);
    expect(html).not.toContain("Asks for the blue cup");
  });

  it.each(["en", "he"] as const)("retains one counted, clearly named Memory destination in %s", lang => {
    state.lang = lang;
    const html = render();
    const label = tt("elev.childsignals.story.memory.title.many", { count: 2 });
    const button = state.buttons.filter(b => b["data-testid"] === "timeline-memory-review");
    expect(button).toHaveLength(1);
    expect(button[0]["aria-label"]).toBe(`${PARENT_RECORD_COPY[lang].reviewMemory}: ${label}`);
    expect(button[0].className).toContain("min-h-11");
    expect(button[0].className).not.toContain("py-3");
    const content = renderToStaticMarkup(<>{button[0].children}</>);
    expect(occurrences(content, label)).toBe(1);
    expect(content).not.toContain(PARENT_RECORD_COPY[lang].reviewMemory);
    expect(html).not.toMatch(/autism|disorder/);
    click(button[0]);
    expect(state.setActiveTab).toHaveBeenCalledExactlyOnceWith("memory");
  });

  it.each(["en", "he"] as const)("handles one or zero scrubbed proposals without an empty review control in %s", lang => {
    state.lang = lang; state.pending = state.pending.slice(0, 1);
    expect(render()).toContain(tt("elev.childsignals.story.memory.title.one"));
    state.pending = [{ memoryId: "unsafe", fact: "Noa presents with autism spectrum disorder", status: "pending" }];
    expect(render()).not.toContain('data-testid="timeline-memory-review"');
  });

  it.each(["en", "he"] as const)("keeps empty-state capture and a single narrative control in %s", lang => {
    state.lang = lang; state.empty = true; state.pending = [];
    const html = render();
    expect(occurrences(html, "<summary>")).toBe(1);
    expect(html).not.toContain('data-testid="timeline-months-disclosure"');
    expect(html).not.toContain('data-testid="timeline-save-story"');
    expect(html).not.toContain('data-testid="timeline-filter-chips"');
    const captureButton = state.buttons.find(button => renderToStaticMarkup(<>{button.children}</>).includes(tt("elev.childsignals.story.empty.cta")));
    expect(captureButton).toBeDefined();
    click(captureButton!);
    expect(state.openCaptureSheet).toHaveBeenCalledExactlyOnceWith({ mode: "photo" });
  });

  it("keeps story export wired to its full approved content", async () => {
    render();
    let blob: Blob | undefined;
    vi.spyOn(URL, "createObjectURL").mockImplementation(value => { blob = value as Blob; return "blob:story-test"; });
    const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    const anchor = { href: "", download: "", click: vi.fn() };
    vi.stubGlobal("document", { createElement: vi.fn(() => anchor) });
    click(state.buttons.find(button => button["data-testid"] === "timeline-save-story")!);
    expect(anchor.click).toHaveBeenCalledOnce();
    expect(anchor.download).toBe("noa-story.txt");
    expect(await blob?.text()).toContain("Enjoys building towers");
    expect(await blob?.text()).not.toContain("Asks for the blue cup");
    expect(revoke).toHaveBeenCalledExactlyOnceWith("blob:story-test");
  });

  it("scopes the 48px targets, divider and visible keyboard focus to this group", () => {
    const summary = css.match(/\.timeline-context-group > details > summary \{([^}]+)\}/)?.[1] ?? "";
    expect(summary).toContain("box-sizing: border-box");
    expect(summary).toContain("min-block-size: 48px");
    expect(summary).toContain("padding-block: 12px");
    expect(summary).toContain("line-height: 24px");
    expect(css).toContain(".timeline-context-group > details + details");
    expect(css).toContain("border-block-start: 1px solid var(--arbor-rule)");
    expect(css).toContain(".timeline-context-group > details > summary:focus-visible");
    expect(css).toContain("outline: 2px solid var(--arbor-clay)");
    expect(css).not.toMatch(/overflow:\s*hidden|display:\s*none|padding-(?:left|right)|margin-(?:left|right)/);
    // Negative control: two padded card disclosures are the reviewed defect.
    const source = readFileSync(new URL("./StoryTimelineTab.tsx", import.meta.url), "utf8");
    const paddedDisclosure = /<details[^>]*className=\{`\$\{cardCls\} px-4 py-3`\}/;
    expect(paddedDisclosure.test('<details className={`${cardCls} px-4 py-3`}')).toBe(true);
    expect(source).not.toMatch(paddedDisclosure);
  });
});

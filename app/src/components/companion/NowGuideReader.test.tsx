/**
 * v3 F-NOW-1 — the guide reader behind Now's Begin, the plan card's face
 * (the guide's picture once shipped, else shapes and the question's glyph),
 * and the page-session note that keeps a failed choice visible after the
 * remount its optimistic write causes.
 */
import React from "react";
import { readFileSync } from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GUIDE_ART, GUIDE_TOPICS, type GuideTopic } from "../../lib/guideArt";

const state = vi.hoisted(() => ({ buttons: [] as Record<string, any>[], shipped: false }));
vi.mock("../ui/Sheet", () => ({ Sheet: ({ title, children }: { title: string; children: React.ReactNode }) => <div data-sheet-title={title}>{children}</div> }));
vi.mock("../layout/Breadcrumb", () => ({ SheetBreadcrumb: ({ label }: { label: string }) => <nav data-testid="sheet-crumb">{label}</nav> }));
// The plan card asks for the guide's face; a test can pretend the mornings picture has shipped.
vi.mock("./nowGuideFace", async (original) => {
  const real = await original<typeof import("./nowGuideFace")>();
  return { ...real, guideFaceFor: (question: string | null | undefined, lang: "en" | "he") => real.guideFaceFor(question, lang, state.shipped ? new Set<GuideTopic>(["mornings"]) : undefined) };
});
const capture = vi.hoisted(() => (type: unknown, props: unknown) => {
  if (type === "button" && props && typeof props === "object") state.buttons.push(props as Record<string, any>);
});
vi.mock("react/jsx-runtime", async (original) => {
  const runtime = await original<typeof import("react/jsx-runtime")>();
  return {
    ...runtime,
    jsx: (...args: Parameters<typeof runtime.jsx>) => { capture(args[0], args[1]); return runtime.jsx(...args); },
    jsxs: (...args: Parameters<typeof runtime.jsxs>) => { capture(args[0], args[1]); return runtime.jsxs(...args); },
  };
});
vi.mock("react/jsx-dev-runtime", async (original) => {
  const runtime = await original<typeof import("react/jsx-dev-runtime")>();
  return { ...runtime, jsxDEV: (...args: Parameters<typeof runtime.jsxDEV>) => { capture(args[0], args[1]); return runtime.jsxDEV(...args); } };
});
import NowGuideReader from "./NowGuideReader";
import NowPlanFrame from "./NowPlanFrame";
import { GUIDE_TOPIC_GLYPH } from "./nowGuideFace";
import { acceptFailedFor, clearAcceptFailed, markAcceptFailed } from "./nowGuideAccept";
import { NOW_COPY } from "./nowViewCopy";

const STEP = "Offer a choice between two familiar shoes before leaving home.";
const HOW = ["Offer a choice between two familiar shoes.", "Wait for the answer.", "Keep it small."];
const button = (label: string) => {
  const found = state.buttons.find(item => React.Children.toArray(item.children).includes(label));
  expect(found, `button ${label}`).toBeDefined();
  return found!;
};

beforeEach(() => { state.buttons = []; state.shipped = false; clearAcceptFailed("child-a"); clearAcceptFailed("child-b"); });

describe("v3 F-NOW-1 · the guide reader", () => {
  it("renders nothing while closed", () => {
    expect(renderToStaticMarkup(<NowGuideReader open={false} onClose={() => {}} lang="en" title={STEP} crumb="Today's guide" how={HOW} />)).toBe("");
  });

  it("a screened AI step: How to begin, the words, and one choice that never claims a save", () => {
    const onChoose = vi.fn(), onClose = vi.fn(), onAdapt = vi.fn();
    const copy = NOW_COPY.en;
    const html = renderToStaticMarkup(<NowGuideReader open onClose={onClose} lang="en" title={STEP} crumb={copy.planTag.recommendation} intro="Mornings go easier with one small choice." how={HOW} words="“Red shoes or blue shoes?”" onChoose={onChoose} onAdapt={onAdapt} />);
    expect(html).toContain(`data-sheet-title="${STEP}"`);
    expect(html).toContain(`<nav data-testid="sheet-crumb">${copy.planTag.recommendation}</nav>`);
    expect(html).toContain('data-testid="now-guide-reader"');
    expect(html).toContain('dir="ltr"');
    expect(html).toContain(`>${copy.steps}</h3>`);
    expect(html.match(/<li>/g)).toHaveLength(3);
    expect(html).toContain(`>${copy.say}</h3>`);
    expect(html).toContain("“Red shoes or blue shoes?”</blockquote>");
    expect(html).toContain(copy.choose);
    expect(html).not.toContain(copy.saved);
    expect(html).not.toContain('role="alert"');
    // Now's one move is the card's Begin; the reader carries no second stamp.
    expect(html).not.toContain("data-primary-move");
    button(copy.choose).onClick();
    expect(onChoose).toHaveBeenCalledOnce();
    button(copy.adapt).onClick();
    expect(onClose).toHaveBeenCalledOnce();
    expect(onAdapt).toHaveBeenCalledOnce();
  });

  it("while the write runs the choice says so and cannot be sent twice; a failure is an alert, never a receipt", () => {
    const copy = NOW_COPY.en;
    let html = renderToStaticMarkup(<NowGuideReader open onClose={() => {}} lang="en" title={STEP} crumb="x" how={HOW} onChoose={() => {}} saving />);
    const choose = html.match(/<button[^>]*class="companion-primary"[^>]*>[\s\S]*?<\/button>/)?.[0] ?? "";
    expect(choose).toContain('disabled=""');
    expect(choose).toContain('aria-busy="true"');
    expect(choose).toContain(copy.saving);
    expect(choose).not.toContain(copy.choose);
    html = renderToStaticMarkup(<NowGuideReader open onClose={() => {}} lang="en" title={STEP} crumb="x" how={HOW} onChoose={() => {}} error />);
    expect(html).toContain(`role="alert">${copy.saveError}</p>`);
    expect(html).not.toContain(copy.saved);
  });

  it("a library guide is read, never written: what you need, the note, and Close", () => {
    const onClose = vi.fn();
    const copy = NOW_COPY.en;
    const html = renderToStaticMarkup(<NowGuideReader open onClose={onClose} lang="en" title="Sock puppets" crumb={copy.planTag.recommendation} how={HOW} materials={["a clean sock", "a marker"]} note={copy.putDown} />);
    expect(html).toContain(`<b>${copy.materials}</b>`);
    expect(html).toContain("a clean sock · a marker");
    expect(html).toContain(copy.putDown);
    expect(html).not.toContain(copy.choose);
    button(copy.close).onClick();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("Hebrew: the reader is RTL and every label is Hebrew", () => {
    const copy = NOW_COPY.he;
    const html = renderToStaticMarkup(<NowGuideReader open onClose={() => {}} lang="he" title="צעד קטן" crumb={copy.planTag.recommendation} how={["מציעים שתי אפשרויות."]} words="„אדומות או כחולות?”" onChoose={() => {}} onAdapt={() => {}} />);
    expect(html).toContain('dir="rtl"');
    for (const label of [copy.steps, copy.say, copy.choose, copy.adapt]) {
      expect(html).toContain(label);
      expect(label).not.toMatch(/[A-Za-z]/);
    }
    expect(html).not.toContain(NOW_COPY.en.choose);
  });
});

describe("v3 F-NOW-1 · the plan card's face", () => {
  const MORNINGS = "How could mornings feel easier?";

  it("before a guide picture ships: shapes and a medallion carrying the question's glyph, the tag, the say line and the meta", () => {
    const html = renderToStaticMarkup(<NowPlanFrame kind="recommendation" lang="en" tag="Today's guide" say="Start small. Stay close." meta="Not chosen yet" question={MORNINGS}><p>body</p></NowPlanFrame>);
    expect(html).toContain('class="now-plan arbor-depth-primary" data-plan="recommendation" data-guide="mornings"');
    expect(html).toContain('<div class="now-plan-art">');
    expect(html).toMatch(/class="now-plan-medallion"[^>]*><span[^>]*>wb_sunny<\/span>/);
    expect(html.match(/now-plan-blob /g)).toHaveLength(2);
    expect(html).not.toContain("<img");
    expect(html).toContain("Today&#x27;s guide");
    expect(html).toContain('<blockquote class="now-plan-say" dir="auto">Start small. Stay close.</blockquote>');
    expect(html).toContain('<p class="now-plan-meta">Not chosen yet</p>');
    expect(html).not.toContain(MORNINGS);
    expect(html.indexOf("now-plan-art")).toBeLessThan(html.indexOf("now-plan-body"));
    expect(html).toContain('<div class="now-plan-body"><p>body</p></div>');
  });

  it("no matching question keeps the lead's own glyph; no say or meta, no face block", () => {
    const html = renderToStaticMarkup(<NowPlanFrame kind="visit" lang="en" tag="Coming up"><p>body</p></NowPlanFrame>);
    expect(html).not.toContain("data-guide=");
    expect(html).toMatch(/class="now-plan-medallion"[^>]*><span[^>]*>event<\/span>/);
    expect(html).not.toContain("now-plan-face");
  });

  it("once the guide's picture ships it replaces the shapes, with its own alt in each language and a scrim for the words", () => {
    state.shipped = true;
    for (const lang of ["en", "he"] as const) {
      const html = renderToStaticMarkup(<NowPlanFrame kind="recommendation" lang={lang} tag="t" say="s" question={MORNINGS}><p>body</p></NowPlanFrame>);
      expect(html).toContain('class="now-plan-art now-plan-art-picture"');
      expect(html).toMatch(/<img class="now-plan-img" src="\/visuals\/guides\/mornings-960\.webp"/);
      expect(html).toContain(`alt="${GUIDE_ART.mornings.alt[lang]}"`);
      expect(html).toContain('<span class="now-plan-scrim" aria-hidden="true"></span>');
      expect(html).not.toContain("now-plan-medallion");
      expect(html).not.toContain("now-plan-blob");
    }
  });

  it("a bare lead brings its own frame", () => {
    expect(renderToStaticMarkup(<NowPlanFrame kind="recommendation" lang="en" tag="t" bare><p>own</p></NowPlanFrame>)).toBe("<p>own</p>");
  });

  it("every guide topic has a glyph from the shipped icon subset", () => {
    const subset = new Set(readFileSync(path.resolve(__dirname, "../../../public/fonts/material-symbols-rounded-subset.icons.txt"), "utf8")
      .split(/\r?\n/).map(line => line.trim()).filter(line => line && !line.startsWith("#")));
    for (const topic of GUIDE_TOPICS) {
      expect(GUIDE_TOPIC_GLYPH[topic], topic).toBeDefined();
      expect(subset.has(GUIDE_TOPIC_GLYPH[topic]), GUIDE_TOPIC_GLYPH[topic]).toBe(true);
    }
  });
});

describe("v3 F-NOW-1 · a failed choice outlives the remount", () => {
  it("is kept per child, for the step that failed only, until cleared", () => {
    expect(acceptFailedFor("child-a", STEP)).toBe(false);
    markAcceptFailed("child-a", STEP);
    expect(acceptFailedFor("child-a", STEP)).toBe(true);
    expect(acceptFailedFor("child-a", "Another step.")).toBe(false);
    expect(acceptFailedFor("child-a", null)).toBe(false);
    expect(acceptFailedFor("child-b", STEP)).toBe(false);
    clearAcceptFailed("child-a");
    expect(acceptFailedFor("child-a", STEP)).toBe(false);
  });
});

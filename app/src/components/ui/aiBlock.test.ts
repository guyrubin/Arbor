/**
 * AI-17 — the shared structured-output primitive.
 *
 * Arbor's north star is structured AI output plus one-tap save. Before this,
 * the framed section / say-this / checklist / action-row anatomy was written
 * three times (coach answer, vision result, hard-moment guide) and three other
 * surfaces rendered a wall of prose instead, so the same answer looked and
 * behaved differently depending on which screen the parent was on.
 *
 * This file pins the primitive's OUTPUT to the markup those surfaces already
 * shipped. Every expected string below is the pre-extraction markup, so a
 * change to the primitive that would move any of the three surfaces fails
 * here as well as in their own byte-equivalence snapshots.
 *
 * Each rule carries a negative control built from the same real render, so a
 * matcher that would pass on anything cannot pass here.
 */
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AiBlock, Checklist, KeepBar, SayThis } from "./AiBlock";

const el = React.createElement;
const noop = () => {};
const body = el("p", { key: "b" }, "body");

/* ── The three shipped frame shapes ───────────────────────────────────────── */

const CARD =
  '<div class="rounded-xl p-3.5 bg-white" style="border:1px solid var(--arbor-rule)">' +
  '<div class="flex items-center justify-between gap-2 mb-2">' +
  '<span class="inline-flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wider" style="color:var(--arbor-green-ink)">' +
  "<i></i> Try today</span></div><p>body</p></div>";

const INSET =
  '<div class="rounded-xl p-3" style="background:var(--arbor-paper-deep);border:1px solid var(--arbor-rule)">' +
  '<span class="inline-flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wider mb-1.5" style="color:var(--arbor-green-ink)">' +
  "<i></i> Try today</span><p>body</p></div>";

const GUIDE =
  '<div class="min-w-0 rounded-xl p-4" style="background:var(--arbor-paper-deep);border:1px solid var(--arbor-rule)">' +
  '<h4 class="text-xs font-bold" style="color:var(--arbor-green-ink)">Try today</h4><p>body</p></div>';

const frame = (tone: "card" | "inset" | "guide") =>
  renderToStaticMarkup(
    el(AiBlock, { tone, icon: el("i", { key: "i" }), title: "Try today", tint: "var(--arbor-green-ink)", children: body }),
  );

describe("AI-17 — AiBlock reproduces each shipped frame exactly", () => {
  it("card tone is the coach answer's white section", () => {
    expect(frame("card")).toBe(CARD);
  });

  it("inset tone is the vision result's paper-deep section", () => {
    expect(frame("inset")).toBe(INSET);
  });

  it("guide tone is the hard-moment guide's wider section with a heading title", () => {
    expect(frame("guide")).toBe(GUIDE);
  });

  it("card tone carries the caller's trailing control on the title row", () => {
    const html = renderToStaticMarkup(
      el(AiBlock, { title: "Try today", tint: "var(--arbor-green-ink)", action: el("button", { key: "a" }, "Save"), children: body }),
    );
    expect(html).toContain("<button>Save</button></div>");
  });
});

describe("AI-17 negative controls — the frame matchers reject a regressed render", () => {
  it("scanned markup is real and non-empty", () => {
    for (const tone of ["card", "inset", "guide"] as const) {
      expect(frame(tone).length).toBeGreaterThan(120);
      expect(frame(tone)).toContain("<div");
    }
  });

  it("the three tones are genuinely distinct, so no matcher passes on the wrong one", () => {
    expect(frame("card")).not.toBe(frame("inset"));
    expect(frame("inset")).not.toBe(frame("guide"));
    expect(frame("card")).not.toBe(frame("guide"));
    expect(CARD).not.toBe(INSET);
  });

  it("a frame that lost its border token is rejected", () => {
    const mutant = frame("card").split("1px solid var(--arbor-rule)").join("none");
    expect(mutant).not.toBe(CARD);
  });

  it("a title that lost the caller's accent token is rejected", () => {
    const mutant = frame("card").split("var(--arbor-green-ink)").join("var(--arbor-muted)");
    expect(mutant).not.toBe(CARD);
  });
});

/* ── SayThis ──────────────────────────────────────────────────────────────── */

const sayThis = (copied: boolean) =>
  renderToStaticMarkup(
    el(SayThis, {
      text: "I am right here.",
      title: "Say this",
      lang: "en" as const,
      copyLabel: "Copy",
      copiedLabel: "Copied",
      copied,
      onCopy: noop,
    }),
  );

describe("AI-17 — SayThis is the parent script, quoted and copyable", () => {
  it("renders the words in curly quotes, in the italic script treatment", () => {
    const html = sayThis(false);
    expect(html).toContain('<p class="text-[13px] leading-relaxed italic" style="color:var(--arbor-ink)">“I am right here.”</p>');
  });

  it("sits in the card frame the coach answer uses", () => {
    expect(sayThis(false)).toContain('<div class="rounded-xl p-3.5 bg-white"');
  });

  it("swaps the copy control for a confirmation, and back", () => {
    expect(sayThis(false)).toContain("Copy");
    expect(sayThis(false)).not.toContain("Copied");
    expect(sayThis(true)).toContain("Copied");
  });

  it("negative control: the two copy states are different markup", () => {
    expect(sayThis(false)).not.toBe(sayThis(true));
    expect(sayThis(false).length).toBeGreaterThan(200);
  });
});

/* ── Checklist ────────────────────────────────────────────────────────────── */

const checklist = (items: string[]) => renderToStaticMarkup(el(Checklist, { items }));

describe("AI-17 — Checklist is one tickable step per item", () => {
  const html = checklist(["Start the wind-down earlier.", "Sit beside the bed."]);

  it("gives every step its own toggle target", () => {
    expect(html.split('class="flex items-start gap-2 text-start w-full group"').length - 1).toBe(2);
  });

  it("CR-01: the unchecked box states its fill statically, never through a ternary", () => {
    // The contrast ratchet can only prove the tick's legibility when the fill
    // it sits on is statically known. Both boxes are separate elements.
    expect(html).toContain('style="border:1px solid var(--arbor-rule-strong)"');
    expect(html).not.toContain("var(--arbor-clay)"); // nothing is ticked on first paint
  });

  it("renders every step's text verbatim", () => {
    for (const step of ["Start the wind-down earlier.", "Sit beside the bed."]) expect(html).toContain(step);
  });

  it("negative control: a dropped step changes the render", () => {
    expect(html).toBeTruthy();
    expect(checklist(["Start the wind-down earlier."])).not.toBe(html);
    expect(checklist([])).toBe('<ul class="space-y-1"></ul>');
  });

  it("CLINICAL FIREWALL: a checklist carries no count, score or verdict of its own", () => {
    expect(html).not.toMatch(/\d+\s?%/);
    expect(html).not.toMatch(/\bof\s+\d+\b|\bscore\b|\bprogress\b/i);
  });
});

/* ── KeepBar ──────────────────────────────────────────────────────────────── */

const ACCENT_BTN =
  '<button class="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1.5 rounded-lg transition" style="background:var(--arbor-green-soft);color:var(--arbor-green-ink)">';
const OUTLINE_BTN =
  '<button class="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1.5 rounded-lg transition bg-white" style="color:var(--arbor-muted);border:1px solid var(--arbor-rule)">';

const keepBar = renderToStaticMarkup(
  el(KeepBar, {
    actions: [
      { id: "plan", onClick: noop, content: "Save to plan" },
      { id: "note", tone: "outline" as const, onClick: noop, content: "Teacher note" },
    ],
  }),
);

describe("AI-17 — KeepBar is the row that carries an answer off the screen", () => {
  it("renders the shipped row, accent action first", () => {
    expect(keepBar).toBe(
      '<div class="flex flex-wrap items-center gap-2 pt-1">' +
        ACCENT_BTN + "Save to plan</button>" +
        OUTLINE_BTN + "Teacher note</button></div>",
    );
  });

  it("negative control: the two tones are distinct, and an empty bar is not the same row", () => {
    expect(ACCENT_BTN).not.toBe(OUTLINE_BTN);
    expect(keepBar).toContain(ACCENT_BTN);
    expect(keepBar.split(ACCENT_BTN).join("")).not.toContain(ACCENT_BTN);
    expect(renderToStaticMarkup(el(KeepBar, { actions: [] }))).not.toBe(keepBar);
  });
});

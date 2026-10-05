/**
 * B-KID-53 (F-2) — Decision choices never overlap; keys never collide.
 * Rendered with react-dom/server (no jsdom in this repo); the 375 px visual
 * check is Fable's.
 */
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { DecisionChoices } from "./DecisionChoices";

const LONG = "Take one brave step into the dark, all the way to the far side of the hill";
const choices = [
  { id: LONG, label: LONG, consequence: "x" },
  { id: LONG, label: LONG, consequence: "y" }, // same text AND same id as the first
  { id: "c", label: "Wait for morning light", consequence: "z" },
];

describe("B-KID-53 (F-2): the Decision list", () => {
  it("the marker is the position (A/B/C), never the model's id; the label wraps in its own column; 44 px rows", () => {
    const html = renderToStaticMarkup(<DecisionChoices choices={choices} lang="en" onChoose={() => {}} />);
    const rows = html.split('data-testid="decision-choice"').slice(1);
    expect(rows).toHaveLength(3);
    const markers = [...html.matchAll(/aria-hidden="true"[^>]*>([^<]*)<\/span>/g)].map((m) => m[1]);
    expect(markers).toEqual(["A", "B", "C"]);
    for (const row of rows) {
      expect(row).toContain("min-h-[44px]");
      expect(row).toContain("min-w-0 flex-1");
      expect(row).toContain("overflow-wrap:anywhere");
      expect(row).toContain("text-start");
    }
    expect(html).not.toMatch(/\b(ml|mr|pl|pr|left|right)-/);
  });
  it("Hebrew markers are Hebrew letters", () => {
    const html = renderToStaticMarkup(<DecisionChoices choices={choices} lang="he" onChoose={() => {}} />);
    const markers = [...html.matchAll(/aria-hidden="true"[^>]*>([^<]*)<\/span>/g)].map((m) => m[1]);
    expect(markers).toEqual(["א", "ב", "ג"]);
  });
  it("two choices with the same text and id log no duplicate-key warning", () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      renderToStaticMarkup(<DecisionChoices choices={choices} lang="en" onChoose={() => {}} />);
      expect(err.mock.calls.flat().join(" ")).not.toMatch(/same key/i);
    } finally {
      err.mockRestore();
    }
  });
  it("the reader renders this list (no inline id badge left behind)", () => {
    const tab = readFileSync(path.resolve(__dirname, "..", "tabs", "HeroJourneyTab.tsx"), "utf8");
    expect(tab).toContain('<DecisionChoices choices={choices} lang={aiLang === "he" ? "he" : "en"} onChoose={chooseOption} />');
    expect(tab).not.toContain("key={c.id}");
  });
});

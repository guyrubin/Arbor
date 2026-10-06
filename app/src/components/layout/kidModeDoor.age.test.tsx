/**
 * B-PLAY-24 guard — the Kid Mode door is hidden (never removed) under three:
 * a 22-month-old is not handed Pattern Power. The button renders for a
 * five-year-old and when no child profile is in scope (unchanged behaviour);
 * Tonight for a toddler offers the parent's question, not a story.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { translate, type UiLang } from "../../lib/i18n";
import type { ChildProfile } from "../../types";

const ISO = new Date().toISOString().slice(0, 10);
const LENI = { id: "leni", name: "Leni", age: 1, ageMonths: 22, ageMonthsAsOf: ISO, gender: "girl" } as unknown as ChildProfile;
const DYLAN = { id: "dylan", name: "Dylan", age: 5, ageMonths: 62, ageMonthsAsOf: ISO, gender: "boy" } as unknown as ChildProfile;

const ui = vi.hoisted(() => ({ lang: "en" as "en" | "he", child: null as unknown }));
vi.mock("../../context/LanguageContext", () => ({
  useLanguage: () => ({ t: (k: string, v?: Record<string, string | number>) => translate(ui.lang as UiLang, k, v), uiLang: ui.lang }),
}));
vi.mock("../../context/ArborContext", () => ({
  useArborOptional: () => (ui.child ? { childProfile: ui.child } : null),
  useArbor: () => ({ childProfile: ui.child ?? { id: "x", name: "Leni" } }),
}));
vi.mock("../kidmode/useKidModeEntry", () => ({ useKidModeEntry: () => ({ request: () => undefined, step: null }) }));
vi.mock("../kidmode/parentGate", () => ({ readParentPin: () => "" }));
vi.mock("../../lib/analytics", () => ({ track: () => undefined }));

import KidModeButton from "./KidModeButton";
import TonightCard from "../overview/TonightCard";

const button = (child: ChildProfile | null, compact: boolean) => {
  ui.child = child;
  return renderToStaticMarkup(React.createElement(KidModeButton, { compact }));
};

describe("B-PLAY-24 · the Kid Mode door by age", () => {
  for (const compact of [false, true]) {
    it(`${compact ? "phone" : "desktop"}: hidden for Leni (22 m), shown for Dylan (5 y) and with no profile`, () => {
      expect(button(LENI, compact)).not.toContain("<button");
      expect(button(DYLAN, compact)).toContain("<button");
      expect(button(null, compact)).toContain("<button");
    });
  }

  it("hidden, not removed: the component and its mounts stay; the gate is the band", () => {
    const src = readFileSync(path.join(__dirname, "KidModeButton.tsx"), "utf8");
    expect(src).toMatch(/if \(child && !kidModeOpenFor\(child\)\) return <>\{step\}<\/>;/);
    const shell = readFileSync(path.join(__dirname, "Shell.tsx"), "utf8");
    expect(shell).toContain("<KidModeButton compact />");
  });
});

describe("B-PLAY-24 · Tonight for a toddler is the parent's question", () => {
  for (const lang of ["en", "he"] as const) {
    it(`${lang}: no Read button when no story fits; the question names her`, () => {
      ui.lang = lang;
      const html = renderToStaticMarkup(React.createElement(TonightCard, {
        momentsToday: 2, childName: "Leni", onRead: () => undefined, onRoutine: () => undefined, storyFits: false, onWrite: () => undefined,
      }));
      expect(html).not.toContain('data-testid="today-tonight-read"');
      expect(html).toContain('data-testid="today-tonight-write"');
      expect(html.replace(/&#x27;/g, "'")).toContain(translate(lang, "elev.ages.tonight.question", { name: "Leni" }));
      const story = renderToStaticMarkup(React.createElement(TonightCard, {
        momentsToday: 2, childName: "Dylan", onRead: () => undefined, onRoutine: () => undefined,
      }));
      expect(story).toContain('data-testid="today-tonight-read"');
    });
  }
  it("no upper-case label and nothing under 12 px on the card", () => {
    const src = readFileSync(path.join(__dirname, "../overview/TonightCard.tsx"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    const card = src.slice(src.indexOf("export default function TonightCard"), src.indexOf("export function DayCloseLine"));
    expect(card).not.toMatch(/uppercase|text-\[(?:[0-9]|1[01])px\]/);
  });
});

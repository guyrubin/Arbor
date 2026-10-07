import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

/* B-PROG-07 UI — "Three things you hope for" on the program page. Set · edit
   · put aside through lib/goals (max three active); each goal shows the
   family's words and the family's OWN word for the last time it was marked —
   never a number (firewall scan: no digit anywhere in the goals module, no
   −2..+2, no %); EN + HE. The GAS number for the professional's packet and
   Tonight's weekly question are residues (consult/packet.ts, components/loop). */

const state = vi.hoisted(() => ({ lang: "en" as "en" | "he" }));
vi.mock("../../context/LanguageContext", async () => {
  const { translate } = await vi.importActual<typeof import("../../lib/i18n")>("../../lib/i18n");
  return {
    useLanguage: () => ({
      t: (k: string, v?: Record<string, string | number>) => translate(state.lang, k, v),
      uiLang: state.lang,
    }),
  };
});

import FamilyGoals from "./FamilyGoals";
import { archiveGoal, editGoal, goalForPacket, scoreGoal, setGoal, type FamilyGoal } from "../../lib/goals";
import { translate } from "../../lib/i18n";
import { loopFirewallHits } from "../../lib/loop/firewall";

const NOW = new Date(2026, 9, 10, 12, 0, 0);
const SCALE_EN = { "-2": "Shouting every night", "-1": "Shouting most nights", "0": "Some calm nights", "1": "Mostly calm", "2": "Calm every night" };
const SCALE_HE = { "-2": "צעקות כל ערב", "-1": "צעקות ברוב הערבים", "0": "כמה ערבים רגועים", "1": "רוב הערבים רגועים", "2": "כל ערב רגוע" };
const make = (text: string, scale: Record<string, string>, existing: FamilyGoal[] = []): FamilyGoal => {
  const r = setGoal(existing, { text, scale, programId: "talk-together" }, NOW);
  if ("reason" in r) throw new Error(r.reason);
  return r.goal;
};
const decode = (html: string) => html.replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&amp;/g, "&");
const text = (html: string) => decode(html.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
const render = (lang: "en" | "he", goals: FamilyGoal[], prefill?: string) => {
  state.lang = lang;
  return renderToStaticMarkup(<FamilyGoals goals={goals} programId="talk-together" onSave={() => undefined} prefill={prefill} now={() => NOW} />);
};

describe("B-PROG-07 UI — words only, EN + HE", () => {
  for (const lang of ["en", "he"] as const) {
    it(`${lang}: each goal shows the family's words and their own last word — no digit, no sign, no %`, () => {
      const scale = lang === "en" ? SCALE_EN : SCALE_HE;
      const a = scoreGoal(make(lang === "en" ? "Bedtime without shouting" : "השכבה בלי צעקות", scale), 1, NOW);
      const b = make(lang === "en" ? "More words at dinner" : "יותר מילים בארוחת ערב", scale, [a]);
      const html = render(lang, [a, b]);
      const plain = text(html);
      expect(plain).toContain(translate(lang, "elev.program.goals.title"));
      expect((html.match(/data-testid="family-goal"/g) || []).length).toBe(2);
      expect(plain).toContain(scale["1"]); // the family's own word for the last mark
      expect(plain).toContain(translate(lang, "elev.program.goals.notMarked"));
      // FIREWALL: no number on the parent surface
      expect(plain).not.toMatch(/\d/);
      expect(plain).not.toMatch(/[+−]\s*\d|%/);
      expect(loopFirewallHits(plain)).toEqual([]);
      // the scale value never rides in the markup either
      expect(html).not.toMatch(/data-(?:score|value)=/);
    });

    it(`${lang}: the add form asks for the hope and the family's five words (labels without numbers)`, () => {
      const html = render(lang, [], "");
      const before = render(lang, []);
      expect(before).toContain('data-testid="family-goal-add"');
      const withForm = render(lang, [], lang === "en" ? "Wait at bath time" : "לחכות באמבטיה");
      expect(withForm).toContain('data-testid="goal-form"');
      expect((withForm.match(/data-testid="goal-step"/g) || []).length).toBe(5);
      expect(text(withForm)).not.toMatch(/\d/);
      expect(withForm).toContain(lang === "en" ? 'value="Wait at bath time"' : 'value="לחכות באמבטיה"');
      expect(html).toBeTruthy();
    });
  }

  it("three active goals is the most: the add control gives way to one quiet line", () => {
    const a = make("One", SCALE_EN);
    const b = make("Two", SCALE_EN, [a]);
    const c = make("Three", SCALE_EN, [a, b]);
    const html = render("en", [a, b, c]);
    expect(html).not.toContain('data-testid="family-goal-add"');
    expect(html).toContain('data-testid="family-goals-full"');
    expect("reason" in setGoal([a, b, c], { text: "Four", scale: SCALE_EN }, NOW)).toBe(true);
  });
});

describe("B-PROG-07 UI — set · edit · put aside through lib/goals", () => {
  it("edit keeps the id and the marks; put aside keeps the goal on the record but off the page", () => {
    const g = scoreGoal(make("Bedtime without shouting", SCALE_EN), -1, NOW);
    const edited = editGoal(g, { text: "Bedtime with fewer shouts" }, NOW);
    expect(edited.id).toBe(g.id);
    expect(edited.scores).toEqual(g.scores);
    const aside = archiveGoal(edited, NOW);
    expect(aside.archivedAt).toBeTruthy();
    const html = render("en", [aside]);
    expect(html).not.toContain('data-testid="family-goal"');
    expect(html).toContain('data-testid="family-goal-add"');
  });

  it("the number exists only in the packet view, labelled as the family's own scale", () => {
    const g = scoreGoal(make("Bedtime without shouting", SCALE_EN), 2, NOW);
    expect(goalForPacket(g, "en")).toMatchObject({ scaleLabel: "family-set scale", latest: { value: 2, word: "Calm every night" } });
  });

  it("source pins: the page mounts the goals inside its counts module; the row reads goalParentLine only", () => {
    const s = readFileSync(path.resolve(__dirname, "./FamilyGoals.tsx"), "utf8");
    expect(s).toContain("goalParentLine(g)");
    expect(s).not.toContain("latestScore(");
    const page = readFileSync(path.resolve(__dirname, "./ProgramPage.tsx"), "utf8");
    expect(page).toContain('useChildCollection<FamilyGoal>(childId, "familyGoals")');
    expect(page).toMatch(/goals=\{[\s\S]{0,200}<FamilyGoals/);
  });
});

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

/* B-PROG-09 (adherence out, pro view) — the "Home program" row: present only
   when the packet carries the home program THIS professional gave (home-ot →
   the OT view, never the SLP's), after Program, before Your questions. It
   shows the practice days as counts (d/7 the only slash) and the proposed
   goals in the family's words with the family's own last word — never the
   family-set-scale number (this is a parent surface). EN + HE. */

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

import ProView from "./ProView";
import { buildIntakePacket, type IntakeProfession } from "../../consult/packet";
import { acceptProposedGoal, startHomeProgram, toggleExerciseDay } from "../../content/programs/homeProgram";
import { scoreGoal } from "../../lib/goals";
import { translate } from "../../lib/i18n";

const START = new Date(2026, 9, 1, 9);
const NOW = new Date(2026, 9, 9, 20);
const SCALE = { "-2": "Not at all", "-1": "Once or twice", "0": "Some mornings", "1": "Most mornings", "2": "Every morning" };
const started = startHomeProgram([], { profession: "ot", exercises: [{ text: "Thread five big beads", shelf: "hands" }, { text: "Cushion tunnel twice", shelf: "moving" }] }, START);
if (!("enrolment" in started)) throw new Error("no enrolment");
let enrolment = started.enrolment;
for (const d of [2, 8, 9]) enrolment = toggleExerciseDay(enrolment, "ex-1", new Date(2026, 9, d, 9));
const accepted = acceptProposedGoal([], { text: "Puts on the top half alone", scale: SCALE }, "ot", START);
if (!("goal" in accepted)) throw new Error("no goal");
const goal = scoreGoal(accepted.goal, 2, new Date(2026, 9, 8, 20));

const noop = () => undefined;
const child = { id: "c1", name: "Dylan", age: 3, gender: "boy" as const };
const render = (profession: IntakeProfession, lang: "en" | "he", rows: unknown[] = [enrolment]) => {
  state.lang = lang;
  const packet = buildIntakePacket(profession, { child, milestones: [], behaviorLogs: [], actionLoops: [], nowMs: NOW.getTime(), lang, homePrograms: rows, familyGoals: [goal] });
  return renderToStaticMarkup(
    <ProView childName="Dylan" profession={profession} onSelectProfession={noop} packet={packet} questions="" onQuestionsChange={noop} onEgress={noop} counts={new Map()} onBack={noop} />,
  );
};
const sections = (html: string) => [...html.matchAll(/data-testid="pro-packet-line" data-section="([a-z-]+)"/g)].map((m) => m[1]);
const homeRow = (html: string) => {
  const i = html.indexOf('data-section="intake-home-program"');
  if (i < 0) return null;
  const end = html.indexOf('data-testid="pro-packet-line"', i + 10);
  return html.slice(html.indexOf(">", i) + 1, end < 0 ? undefined : end).replace(/<[^>]+>/g, " ").replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/\s+/g, " ").trim();
};

describe("ProView — the Home program row (B-PROG-09)", () => {
  it("OT + an active home-ot program: the row sits before Your questions, with week, practice days d/7 and the family's words (EN + HE)", () => {
    for (const lang of ["en", "he"] as const) {
      const html = render("ot", lang);
      const order = sections(html);
      expect(order.indexOf("intake-home-program")).toBeGreaterThan(-1);
      expect(order.indexOf("intake-home-program")).toBe(order.indexOf("intake-questions") - 1);
      const row = homeRow(html)!;
      expect(row.startsWith(translate(lang, "elev.homeProgram.pro.line"))).toBe(true);
      expect(row).toContain("Thread five big beads");
      // the goal line rides in the same section, behind the existing fold (ProView FOLD)
      const packet = buildIntakePacket("ot", { child, milestones: [], behaviorLogs: [], actionLoops: [], nowMs: NOW.getTime(), lang, homePrograms: [enrolment], familyGoals: [goal] });
      const goalLine = packet.sections.find((s) => s.id === "intake-home-program")!.items.find((it) => it.id.startsWith("intake-home-goal-"))!.text;
      expect(goalLine).toContain("Puts on the top half alone");
      expect(goalLine).toContain("Every morning"); // the family's own word for the last mark
      expect(goalLine).not.toMatch(/\+\s*\d|−\s*\d/);
      expect(row.match(/\d+\s*\/\s*\d+/g)).toEqual(["2/7"]);
      expect(row).not.toMatch(/%|\+\s*\d|−\s*\d/);
    }
  });

  it("the number never renders here, and another profession's view has no row", () => {
    const html = render("ot", "en");
    expect(html).not.toMatch(/\+2|family's scale/);
    expect(sections(render("slp", "en"))).not.toContain("intake-home-program");
    expect(sections(render("ot", "en", []))).not.toContain("intake-home-program");
  });

  it("the pro view reads the home program through the packet (JournalShelves passes the programs rows)", () => {
    const src = readFileSync(path.resolve(__dirname, "JournalShelves.tsx"), "utf8");
    expect(src).toMatch(/homePrograms: programRows\.items/);
    expect(readFileSync(path.resolve(__dirname, "ProView.tsx"), "utf8")).not.toContain("goalForPacket");
  });
});

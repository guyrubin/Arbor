import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

/* B-PROG-05 (pro view) — the "Program" line per profession: present (after
   Practice, before Your questions) only when the packet carries it — an
   ACTIVE enrolment whose shelf the profession owns (Talk Together → SLP, not
   OT); absent otherwise, never a muted "nothing yet" row. Counts only, the
   d/7 shape the only slash; the family-set-scale goals never render here
   (a parent surface). EN + HE. */

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
import { programPageModel } from "../../lib/programPage";
import { scoreGoal, type FamilyGoal } from "../../lib/goals";
import { translate } from "../../lib/i18n";
import type { ActionLoopEntry } from "../../actionLoop/model";

const NOW = new Date("2026-10-06T12:00:00");
const START = "2026-09-03"; // week 5
const enrolment = { id: `talk-together.${START}`, programId: "talk-together", startedAt: START, enrolledAt: `${START}T08:00:00.000Z`, currentWeek: 5, status: "active", baseline: { childProxy: null, capturedAt: null }, updatedAt: `${START}T08:00:00.000Z` };
const dose = (day: string, selfCount: number): ActionLoopEntry =>
  ({ id: `practice.c1.${day}`, recommendation: "x", source: "practice", capacity: "tiny", status: "completed", acceptedAt: `${day}T08:00:00`, practiceId: `p-${day}`, shelf: "words", selfCount }) as ActionLoopEntry;
const loops = [dose("2026-10-01", 2), dose("2026-10-02", 3), dose("2026-10-05", 4)];
const child = { id: "c1", name: "Dylan", age: 3, gender: "boy" };
const goal = scoreGoal({ id: "g1", text: "Gentle hands", setAt: "2026-09-01T08:00:00.000Z", scale: { "-2": "a", "-1": "b", "0": "c", "1": "d", "2": "e" }, scores: [], updatedAt: "2026-09-01T08:00:00.000Z" } as FamilyGoal, 1, NOW);

const noop = () => undefined;
const render = (profession: IntakeProfession, lang: "en" | "he", enrolled: boolean) => {
  state.lang = lang;
  const program = enrolled ? programPageModel([enrolment], { childId: "c1", actionLoops: loops }, NOW, lang, "boy") : null;
  const packet = buildIntakePacket(profession, { child, milestones: [], behaviorLogs: [], actionLoops: loops, nowMs: NOW.getTime(), lang, program, familyGoals: [goal] });
  return renderToStaticMarkup(
    <ProView childName="Dylan" profession={profession} onSelectProfession={noop} packet={packet} questions="" onQuestionsChange={noop} onEgress={noop} counts={new Map()} onBack={noop} />,
  );
};
const sections = (html: string) => [...html.matchAll(/data-testid="pro-packet-line" data-section="([a-z-]+)"/g)].map((m) => m[1]);
const programRow = (html: string) => {
  const i = html.indexOf('data-section="intake-program"');
  return i < 0 ? null : html.slice(html.indexOf(">", i) + 1, html.indexOf("</div>", i)).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
};

describe("ProView — the Program line (B-PROG-05)", () => {
  it("SLP + active enrolment: the Program line sits after Practice, labelled, with week and practice days d/7 (EN + HE)", () => {
    for (const lang of ["en", "he"] as const) {
      const html = render("slp", lang, true);
      expect(sections(html)).toEqual(["intake-seen", "intake-not-yet", "intake-moments", "intake-practice", "intake-program", "intake-questions"]);
      const row = programRow(html)!;
      expect(row.startsWith(translate(lang, "elev.program.pro.line"))).toBe(true);
      expect(row).toContain(lang === "en" ? "Talk Together: week 5 of" : "מדברים ביחד: שבוע 5 מתוך");
      expect(row).toContain("3/7");
      expect(row).not.toMatch(/%/);
      expect(row.match(/\d+\s*\/\s*\d+/g)).toEqual(["3/7"]);
    }
  });

  it("not enrolled, or a profession that does not own the shelf (OT): no Program row at all", () => {
    expect(sections(render("slp", "en", false))).not.toContain("intake-program");
    expect(sections(render("ot", "en", true))).not.toContain("intake-program");
    expect(render("ot", "he", true)).not.toContain(translate("he", "elev.program.pro.line") + "<");
  });

  it("the family-set-scale goals never render on this parent surface", () => {
    for (const lang of ["en", "he"] as const) {
      const html = render("slp", lang, true);
      expect(sections(html)).not.toContain("intake-goals");
      expect(html).not.toContain("Gentle hands");
      expect(html).not.toContain(translate(lang, "elev.program.goals.packet.title"));
    }
  });
});

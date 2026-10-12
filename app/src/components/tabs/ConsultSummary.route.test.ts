/**
 * v3 FEAT-09 — the Care summary pill (#/handoff) is the summary builder alone.
 *
 * ConsultContent renders #/consult, #/handoff and #/school-brief. On #/handoff
 * it shows its own H1 and lede, then AskSpecialist (who it is for, what
 * changed, what leaves) carrying the route's ONE stamp, copy-handoff-brief.
 * The visit's open loop (the outcome question), the home program and the
 * guided-coach line stay on #/consult. EN + HE. The same transpile harness as
 * ConsultDraft.lifecycle.test.ts (ConsultContent as a plain function).
 * v3 F-CARE-1 (re-pinned): on #/consult the open loop is ONE line in the visit
 * card's head that opens Appointments, where the answer and the home program
 * are written (care/VisitOutcome); the landing's H1 is the door's sentence.
 */
import React from "react";
import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ts from "typescript";
import { visitForConsult } from "../../lib/today/dayCard";
import { consultAudienceForProfession } from "../../lib/careTrack";
import { translate } from "../../lib/i18n";

const source = ts.createSourceFile("ConsultTab.tsx", readFileSync("src/components/tabs/ConsultTab.tsx", "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const declaration = source.statements.find((node) => ts.isFunctionDeclaration(node) && node.name?.text === "ConsultContent")!.getText(source);
const code = ts.transpileModule(`${declaration}; return ConsultContent;`, { compilerOptions: { target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React } }).outputText;

let cursor = 0, slots: any[] = [];
let tab = "handoff", lang: "en" | "he" = "en", rows: any[] = [];
const AskSpecialist = () => null;
const HomeProgramDays = () => null;
const HomeProgramEntry = () => null;
const Icon = () => null;
// v3 EXTRA-CARE: the Care landing's visit head, aside and doors render on #/consult only
const CareVisitHead = () => null;
const CareAside = () => null;
const CareDoors = () => null;
const visit = { id: "visit", whenIso: new Date(Date.now() + 86400000).toISOString(), status: "confirmed", profession: "slp" };
const env = {
  React, AskSpecialist, HomeProgramDays, HomeProgramEntry, Icon, CareVisitHead, CareAside, CareDoors, visitForConsult, consultAudienceForProfession,
  useRef: (initial: unknown) => slots[cursor++] ??= { current: initial },
  useState: (initial: unknown) => { const i = cursor++; if (!(i in slots)) slots[i] = initial; return [slots[i], (value: unknown) => { slots[i] = value; }]; },
  useMemo: (calculate: () => unknown) => calculate(),
  useAuth: () => ({ user: null }),
  useArbor: () => ({ childProfile: { id: "child-1", name: "Noa" }, activeTab: tab, setActiveTab: vi.fn() }),
  useLanguage: () => ({ uiLang: lang, t: (key: string, vars?: Record<string, string | number>) => translate(lang, key, vars) }),
  useToast: () => ({ toast: vi.fn() }),
  useChildCollection: (_child: string, name: string) => ({ items: name === "appointments" ? rows : [], loaded: true, error: false, confirmed: true, isCurrent: () => true }),
  // A visit is waiting for its outcome, a home program is active and the guided
  // pilot is on — everything #/consult carries besides the builder.
  visitAwaitingOutcome: () => ({ ...visit, id: "past", whenIso: new Date(Date.now() - 86400000).toISOString() }),
  isIntakeProfession: () => false,
  consultHeading: () => "visit",
  activeHomeEnrolments: () => [{ id: "home-1" }],
  guidedTierOn: () => true,
  appointmentRoleLabel: () => "Speech therapist", fmtDay: () => "date", lowerFor: (_lang: string, value: string) => value,
};
const component = new Function(...Object.keys(env), code)(...Object.values(env));

type El = React.ReactElement<Record<string, any>>;
function elements(node: React.ReactNode): El[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!React.isValidElement<Record<string, any>>(node)) return [];
  const element = node as El;
  return [element, ...React.Children.toArray(element.props.children).flatMap(elements)];
}
function render(): El[] { cursor = 0; return elements(component({ query: new URLSearchParams(""), isOwnerCurrent: () => true })); }
const byId = (all: El[], id: string) => all.find((el) => el.props["data-testid"] === id);
const textOf = (el: El | undefined) => (el ? React.Children.toArray(el.props.children).filter((c) => typeof c === "string").join("") : "");

beforeEach(() => { cursor = 0; slots = []; tab = "handoff"; lang = "en"; rows = [visit]; });

describe("v3 FEAT-09 · #/handoff is the care summary builder", () => {
  for (const l of ["en", "he"] as const) {
    it(`${l}: its own H1 and lede, then the builder with the route's one stamp`, () => {
      lang = l;
      const all = render();
      const h1s = all.filter((el) => el.type === "h1");
      expect(h1s).toHaveLength(1);
      expect(textOf(h1s[0])).toBe(translate(l, "elev.consult.h1.summary"));
      expect(textOf(byId(all, "consult-summary-lede"))).toBe(translate(l, "elev.consult.summary.lede"));
      if (l === "he") {
        expect(textOf(h1s[0])).not.toMatch(/[A-Za-z]/);
        expect(textOf(byId(all, "consult-summary-lede"))).not.toMatch(/[A-Za-z]/);
      }
      const builders = all.filter((el) => el.type === AskSpecialist);
      expect(builders).toHaveLength(1);
      expect(builders[0].props.primaryMoveStamp).toEqual({ "data-primary-move": "copy-handoff-brief" });
      // never the teacher branch here: School brief is its own pill
      expect(builders[0].props.excludeTeacher).toBe(true);
      // the page itself stamps nothing; the builder holds the one stamp
      expect(all.filter((el) => el.props["data-primary-move"])).toHaveLength(0);
      expect(all.filter((el) => el.props["data-module"]).map((el) => el.props["data-module"])).toEqual(["consult-packet"]);
    });
  }

  it("carries no visit outcome, no home program and no guided-coach line", () => {
    const all = render();
    expect(byId(all, "consult-visit-outcome")).toBeUndefined();
    expect(byId(all, "consult-home-program-choice")).toBeUndefined();
    expect(byId(all, "consult-guided-tier")).toBeUndefined();
    expect(all.some((el) => el.type === HomeProgramDays || el.type === HomeProgramEntry)).toBe(false);
    expect(all.some((el) => el.type === "section")).toBe(false);
    // v3 EXTRA-CARE: the landing's visit card, head, aside and doors stay on #/consult
    expect(all.some((el) => el.type === CareVisitHead || el.type === CareAside || el.type === CareDoors)).toBe(false);
    expect(all.find((el) => el.type === AskSpecialist)!.props.head).toBeUndefined();
    expect(all.find((el) => el.type === AskSpecialist)!.props.headAfter).toBeUndefined();
  });

  it("NEGATIVE CONTROL: #/consult keeps the visit's open loop (one line to Appointments) and the guided line under its own H1", () => {
    tab = "consult";
    const all = render();
    expect(byId(all, "consult-guided-tier")).toBeDefined();
    expect(byId(all, "consult-summary-lede")).toBeUndefined();
    expect(textOf(all.find((el) => el.type === "h1"))).not.toBe(translate("en", "elev.consult.h1.summary"));
    // v3 F-CARE-1: the landing's H1 is the door's sentence; the visit is named in the card
    expect(textOf(all.find((el) => el.type === "h1"))).toBe(translate("en", "elev.consult.title"));
    // v3 F-CARE-1: the answer and the home program moved to #/appointments
    // (care/VisitOutcome); the card's head carries ONE line that opens it
    expect(byId(all, "consult-visit-outcome")).toBeUndefined();
    expect(byId(all, "consult-home-program-choice")).toBeUndefined();
    expect(all.some((el) => el.type === HomeProgramDays || el.type === HomeProgramEntry)).toBe(false);
    const line = all.find((el) => el.type === AskSpecialist)!.props.headAfter;
    expect(line?.props["data-testid"]).toBe("consult-visit-outcome-link");
    expect(line?.props["data-primary-move"]).toBeUndefined();
    expect(line?.props.className).toContain("min-h-[44px]");
    expect(all.find((el) => el.type === AskSpecialist)!.props.primaryMoveStamp).toEqual({ "data-primary-move": "build-share-packet" });
    expect(all.find((el) => el.type === AskSpecialist)!.props.excludeTeacher).toBe(false);
    // v3 EXTRA-CARE: the Care landing adds its visit card (the builder, headed
    // by the visit), aside and doors
    const builder = all.find((el) => el.type === AskSpecialist)!;
    expect(builder.props.landing).toBe(true);
    expect(builder.props.head?.type).toBe(CareVisitHead);
    expect(builder.props.head?.props.visit.id).toBe("visit");
    expect(all.filter((el) => el.props["data-testid"] === "consult-visit-card")).toHaveLength(1);
    expect(all.filter((el) => el.type === CareAside)).toHaveLength(1);
    expect(all.filter((el) => el.type === CareDoors)).toHaveLength(1);
  });
});

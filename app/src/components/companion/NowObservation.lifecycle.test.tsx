import React from "react";
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import ts from "typescript";
import { completeObservation, isObservationAction, type ActionLoopEntry } from "../../actionLoop/model";
import { nextChosenAction } from "./companionChoices";
import { selectNowLead } from "../../lib/today/dayCard";
import { NOW_COPY } from "./nowViewCopy";
import { translate } from "../../lib/i18n";
import { screenForImmediateEscalation } from "../../safety/escalation";
const source = ts.createSourceFile("NowView.tsx", readFileSync("src/components/companion/NowView.tsx", "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const fn = source.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === "NowContent")!.getText(source);
const code = ts.transpileModule(`${fn}; return NowContent;`, { compilerOptions: { target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React } }).outputText;
const original: ActionLoopEntry = { id: "today.a.2026-10-10", source: "onboarding", observation: true, recommendation: "What happened with Noa today?\nFull say-back details.", capacity: "tiny", status: "accepted", acceptedAt: "2026-10-10T08:00:00Z" };
function nodes(node: React.ReactNode): React.ReactElement<any>[] {
  if (!React.isValidElement(node)) return [];
  const el = node as React.ReactElement<any>;
  return [el, ...React.Children.toArray(el.props.children).flatMap(nodes)];
}
function setup(lang: "en" | "he" = "en") {
  let at = 0; const slots: any[] = [], effects: (() => void)[] = [];
  const state = { childProfile: { id: "a", name: "Noa", age: 4 }, actionLoop: [{ ...original }], seedCoach: vi.fn(), requestJournalFocus: vi.fn(), setActiveTab: vi.fn(), openCaptureSheet: vi.fn(), openHardMomentNow: vi.fn(), saveTodayOutcome: vi.fn(), pendingCaptureMode: null, consumeCaptureRequest: vi.fn(),
    saveTodayObservation: vi.fn(async (_id: string, words: string) => completeObservation(original, words)) };
  const route = vi.fn();
  const env = { goToRoute: route, React, isObservationAction, nextChosenAction, selectNowLead, NOW_COPY, screenForImmediateEscalation,
    useState: (initial: any) => { const index = at++; if (!(index in slots)) slots[index] = { value: typeof initial === "function" ? initial() : initial }; return [slots[index].value, (value: any) => { slots[index].value = typeof value === "function" ? value(slots[index].value) : value; }]; },
    useRef: (value: any) => slots[at++] ??= { current: value }, useMemo: (run: () => unknown) => run(), useId: () => "now-test",
    useEffect: (run: () => any, deps: unknown[]) => { const index = at++, old = slots[index]; if (old && deps.every((value, n) => Object.is(value, old.deps[n]))) return; const slot = { deps, cleanup: undefined as any }; slots[index] = slot; effects.push(() => { old?.cleanup?.(); slot.cleanup = run(); }); },
    useArbor: () => state, useLanguage: () => ({ uiLang: lang, t: (key: string, vars?: any) => translate(lang, key, vars) }),
    useNowClock: () => new Date("2026-10-10T12:00:00Z"), useNowRecord: () => ({}), useChildCollection: () => ({ items: [] }), activeProgramWeek: () => null,
    useNowLoop: () => ({ plan: { order: [] }, blockNotices: [], evening: false, rhythm: {} }), useLastVisit: () => ({}), useLifecycleMoment: () => ({}), useCompanionOffer: () => ({}),
    availableHardMomentCards: () => [], ageMonthsFromProfile: () => 48, formatChildAge: () => "", childPicture: () => ({}), trackCompanionPlaceOpen: vi.fn(), markPracticeShown: vi.fn(), trackActionOffered: vi.fn(),
    Avatar: "avatar", Icon: "icon", PrimaryMove: "primary-move", Receipt: "receipt", UrgentSupport: "urgent-support", NowRecommendation: "recommendation", NowMoreForToday: "more", NowNoticeBlock: "notice", NowTonightPointer: "tonight-pointer", TOGETHER_ART: {},
  };
  const renderContent = new Function(...Object.keys(env), code)(...Object.values(env));
  let tree: React.ReactNode;
  const render = (topic?: { id: string; title: string }) => { at = 0; tree = renderContent({ topic }); effects.splice(0).forEach(run => run()); return nodes(tree); };
  const find = (type: string) => nodes(tree).find(el => el.type === type)!.props;
  const submit = () => find("form").onSubmit({ preventDefault() {} });
  const fill = (words: string) => find("textarea").onChange({ target: { value: words } });
  const unmount = () => slots.forEach(slot => slot?.cleanup?.());
  return { state, render, find, submit, fill, unmount, route };
}
async function flush() { for (let i = 0; i < 10; i++) await Promise.resolve(); }
describe("actual Now observation form lifecycle", () => {
  it.each(["en", "he"] as const)("%s explains blank/whitespace gating and changes only the observation save affordance", lang => {
    const h = setup(lang); h.render();
    for (const words of ["", "  \n  ", "A moment."]) {
      h.fill(words); const tree = h.render(); const button = h.find("primary-move");
      const blank = !words.trim();
      expect(button.disabled).toBe(blank);
      expect(button.className).toContain("now-observation-save");
      const hint = tree.find(el => el.props["data-testid"] === "now-observation-required");
      expect(Boolean(hint)).toBe(blank);
      if (blank) {
        expect(hint!.props.children).toBe(translate(lang, "ob.first.observation.required"));
        expect(button["aria-describedby"]).toBe(hint!.props.id);
        expect(h.find("textarea")["aria-describedby"]).toContain(hint!.props.id);
        expect(React.Children.toArray(button.children).flatMap(nodes).some(el => el.type === "icon" && el.props.name === "check")).toBe(false);
        h.submit(); expect(h.state.saveTodayObservation).not.toHaveBeenCalled();
      } else {
        expect(button["aria-describedby"]).toBeUndefined();
        expect(React.Children.toArray(button.children).flatMap(nodes).some(el => el.type === "icon" && el.props.name === "check")).toBe(true);
      }
    }
    h.unmount();
  });
  it("scopes disabled neutral styling to the observation submit button without dimming its text", () => {
    const css = readFileSync("src/components/companion/nowView.css", "utf8");
    const rule = css.match(/\.companion-primary\.now-observation-save:disabled\s*\{([^}]+)\}/)?.[1];
    expect(rule).toBeDefined();
    expect(rule).toContain("background: var(--arbor-paper-deep)");
    expect(rule).toContain("color: var(--arbor-muted)");
    expect(rule).toContain("border-color: var(--arbor-rule-strong)");
    expect(rule).toContain("cursor: not-allowed");
    expect(rule).not.toContain("opacity");
  });
  it.each(["en", "he"] as const)("%s keeps parent words through pending and failure, then acknowledges the exact saved row once", async lang => {
    const h = setup(lang); let resolve!: () => void, reject!: (error: unknown) => void;
    const pending = new Promise<void>((yes, no) => { resolve = yes; reject = no; });
    h.state.saveTodayObservation.mockImplementationOnce(async (_id, words) => { h.state.actionLoop = [completeObservation(original, words)]; await pending; return h.state.actionLoop[0]; });
    h.render(); expect(h.find("primary-move").disabled).toBe(true);
    h.fill("He said bus.\nThen waved."); h.render(); h.submit(); h.submit();
    const during = h.render(); expect(h.find("textarea").value).toBe("He said bus.\nThen waved."); expect(h.find("textarea").disabled).toBe(true);
    expect(h.find("primary-move").disabled).toBe(true); expect(h.find("primary-move")["aria-busy"]).toBe(true);
    expect(during.some(el => el.props["data-testid"] === "now-observation-required")).toBe(false);
    expect(during.some(el => el.type === "receipt")).toBe(false); expect(h.state.saveTodayObservation).toHaveBeenCalledOnce();
    reject(Error("rules")); await flush(); const failed = h.render();
    expect(failed.some(el => el.props.role === "alert")).toBe(true); expect(h.find("textarea").value).toBe("He said bus.\nThen waved.");
    h.submit(); await flush(); const saved = h.render();
    expect(saved.some(el => el.type === "receipt")).toBe(true); expect(saved.some(el => el.type === "textarea")).toBe(false);
    expect(saved.find(el => el.type === "h2")!.props.children).toBe(original.recommendation);
    expect(saved.some(el => el.type === "p" && el.props.children === "He said bus.\nThen waved.")).toBe(true);
    expect(h.state.saveTodayOutcome).not.toHaveBeenCalled(); h.find("primary-move").onClick(); expect(h.state.requestJournalFocus).toHaveBeenCalledWith(`action-${original.id}`); expect(h.route).toHaveBeenCalledWith("journal", { view: "all" }); expect(h.state.setActiveTab).not.toHaveBeenCalled();
    h.unmount(); void resolve;
  });
  it("renders the existing urgent-support component for concerning typed words", () => {
    const h = setup(); h.render(); h.fill("He wants to hurt himself");
    expect(h.render().some(el => el.type === "urgent-support")).toBe(true); h.unmount();
  });
  it("a persisted completion does not reopen the question on a fresh view", () => {
    const h = setup(); h.state.actionLoop = [completeObservation(original, "A moment")];
    const tree = h.render(); expect(tree.some(el => el.type === "textarea")).toBe(false); expect(tree.some(el => el.type === "receipt")).toBe(false); h.unmount();
  });
  // Permanent regressions from the independent 738e8d4 negative proof.
  it("a newer choice retires a pending observation failure without trapping Now on the superseded question", async () => {
    const h = setup(); let reject!: (error: unknown) => void;
    const pending = new Promise<ActionLoopEntry>((_resolve, no) => { reject = no; });
    h.state.saveTodayObservation.mockImplementationOnce(() => pending);
    h.render(); h.fill("A moment from the old question"); h.render(); h.submit(); h.render();
    const newer = { ...original, id: original.id + ".1", recommendation: "The newer explicit question", acceptedAt: "2026-10-10T09:00:00Z" };
    h.state.actionLoop = [{ ...original, status: "superseded" }, newer];
    h.render(); reject(Error("The observation request is no longer current")); await flush();
    const tree = h.render();
    expect(tree.find(el => el.type === "h2")!.props.children).toBe(newer.recommendation);
    expect(tree.some(el => el.props.role === "alert")).toBe(false);
    h.unmount();
  });
  it("a newer explicit choice replaces a completed observation receipt in the same mounted Now view", async () => {
    const h = setup(); h.render(); h.fill("A recorded moment"); h.render(); h.submit(); await flush(); h.render();
    const newer = { ...original, id: original.id + ".1", recommendation: "The newer explicit question", acceptedAt: "2026-10-10T09:00:00Z" };
    h.state.actionLoop = [completeObservation(original, "A recorded moment"), newer];
    const tree = h.render(); expect(tree.find(el => el.type === "h2")!.props.children).toBe(newer.recommendation); h.unmount();
  });

  it("an older still-open row revealed by an optimistic completion does not steal this observation's receipt", async () => {
    const h = setup(); let resolve!: (value: ActionLoopEntry) => void;
    h.state.saveTodayObservation.mockImplementationOnce(() => new Promise(yes => { resolve = yes; }));
    h.render(); h.fill("A recorded moment"); h.render(); h.submit();
    h.state.actionLoop = [completeObservation(original, "A recorded moment"), { ...original, id: "today.a.2026-10-09", acceptedAt: "2026-10-09T08:00:00Z", recommendation: "Older open question" }];
    expect(h.render().find(el => el.type === "h2")!.props.children).toBe(original.recommendation);
    resolve(completeObservation(original, "A recorded moment")); await flush();
    const tree = h.render(); expect(tree.some(el => el.type === "receipt")).toBe(true);
    expect(tree.find(el => el.type === "h2")!.props.children).toBe(original.recommendation); h.unmount();
  });

});

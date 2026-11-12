/**
 * v4.1 Now — Right now and Arbor learned this week, rendered against a
 * synthetic family. Every state comes from the record; with nothing for this
 * part of the day the line is absent, and only this week's proposals are asked.
 */
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { translate } from "../../lib/i18n";
import { routineTemplatesForAge, routineToPlan } from "../../lib/routineTemplates";
import type { MemoryReviewItem } from "../../types";

const harness = vi.hoisted(() => ({
  locale: "en" as "en" | "he",
  actionPlans: [] as unknown[],
  behaviorLogs: [] as unknown[],
  pending: [] as unknown[],
  hardDoor: true,
}));
vi.mock("../../context/ArborContext", () => ({
  useArborOptional: () => null,
  useArbor: () => ({
    childProfile: { id: "c1", name: "Noa Levi", gender: "girl", birthDate: "2022-03-01" },
    actionPlans: harness.actionPlans, behaviorLogs: harness.behaviorLogs, pendingMemoryItems: harness.pending,
    handleMemoryDecision: vi.fn(async () => true), isMemoryUpdating: null, openHardMomentNow: vi.fn(),
  }),
}));
vi.mock("../../context/LanguageContext", () => ({
  useLanguage: () => ({ uiLang: harness.locale, aiLang: harness.locale, t: (k: string, v?: Record<string, string | number>) => translate(harness.locale, k, v) }),
}));
vi.mock("../../content/selectCards", () => ({ availableHardMomentCards: () => (harness.hardDoor ? [{ id: "card" }] : []) }));
vi.mock("../ui/HeroAvatar", () => ({ HeroAvatar: () => <span data-testid="hero" />, default: () => <span data-testid="hero" /> }));

import NowRightNow, { TonightAsk, type RightNowTonight } from "./NowRightNow";
import NowLearned, { learnedThisWeek } from "./NowLearned";
import ThenAndNow, { thenAndNowPairs } from "./ThenAndNow";
import { LEARNED_COPY, RIGHT_NOW_COPY, THEN_NOW_COPY, VISIT_DRAFT_COPY } from "./nowV41Copy";
import { PRACTICES } from "../../content/practices";
import { childScopedKey } from "../../lib/childLocalState";
import { tonightQueue, type TonightQuestion } from "./rightNowTonight";
import type { Milestone } from "../../types";

const at = (day: number, hour: number, minute: number) => new Date(2026, 10, day, hour, minute);
const render = (node: React.ReactElement) => renderToStaticMarkup(node);
const reset = () => { harness.locale = "en"; harness.actionPlans = []; harness.behaviorLogs = []; harness.pending = []; harness.hardDoor = true; };
const startRoutine = (id: string) => {
  const routine = routineTemplatesForAge(56).find((r) => r.id === id);
  if (!routine) throw new Error(`no ${id} routine at 56 months`);
  harness.actionPlans = [routineToPlan(routine, "en", "Noa", at(1, 9, 0).getTime())];
  return routine;
};

describe("Right now", () => {
  it("offers the started morning routine's next step in the morning", () => {
    reset();
    const routine = startRoutine("morning");
    const html = render(<NowRightNow now={at(12, 7, 30)} lang="en" visit={null} tonight={null} />);
    expect(html).toContain('data-state="routine"');
    expect(html).toContain("Right now · 07:30");
    expect(html).toContain(`Next: ${routine.steps[0].label.en}`);
    expect(html).toContain("Start the routine");
  });

  it("names the window the parent's own hard moments fell in, before dinner", () => {
    reset();
    harness.behaviorLogs = [at(11, 16, 47), at(10, 17, 2), at(9, 17, 18), at(8, 9, 0)].map((d, i) => ({ id: `b${i}`, timestamp: d.toISOString(), intensity: 4 }));
    const html = render(<NowRightNow now={at(12, 16, 30)} lang="en" visit={null} tonight={null} />);
    expect(html).toContain('data-state="hard"');
    expect(html).toContain("3 of the last 4 hard moments you kept fell between 16:45 and 17:20.");
    expect(html).toContain("Open the words");
    harness.hardDoor = false;
    expect(render(<NowRightNow now={at(12, 16, 30)} lang="en" visit={null} tonight={null} />)).toBe("");
  });

  it("puts the visit at midday, and the drafted summary in the design's words when the record has moments since the anchor", () => {
    reset();
    const visit = { head: "Speech therapist · Friday 14 Nov", sub: "Look over the page.", cta: "Look over the page", onOpen: () => {} };
    const plain = render(<NowRightNow now={at(12, 13, 0)} lang="en" visit={visit} tonight={null} />);
    expect(plain).toContain("Speech therapist · Friday 14 Nov");
    expect(plain).not.toContain("data-drafted");
    const drafted = { head: VISIT_DRAFT_COPY.en.head, sub: VISIT_DRAFT_COPY.en.sub(14, "visit"), cta: VISIT_DRAFT_COPY.en.cta, onOpen: () => {}, drafted: true };
    const html = render(<NowRightNow now={at(12, 13, 0)} lang="en" visit={drafted} tonight={null} />);
    expect(html).toContain('data-state="visit"');
    expect(html).toContain('data-drafted="true"');
    expect(html).toContain("A quiet two minutes: the visit summary is drafted.");
    expect(html).toContain("Built from the 14 moments you kept since the last visit. Nothing is shared until you send it.");
    expect(html).toContain("Look it over");
  });

  it("asks tonight's questions in place in the evening, one at a time, in Hebrew too", () => {
    reset();
    harness.locale = "he";
    const html = render(<NowRightNow now={at(12, 20, 30)} lang="he" visit={null} tonight={tonightProps()} />);
    expect(html).toContain('data-state="tonight"');
    expect(html).toContain("עכשיו · 20:30");
    expect(html).toContain('data-question="practice"');
    expect(html).toContain(translate("he", "elev.loop.tonight.practice.q"));
    expect(html).toContain("הערב · שאלה 1 מתוך 3. מספיקה נגיעה אחת.");
    expect(html).toContain(translate("he", "elev.loop.practice.didIt"));
    expect(html).toContain(RIGHT_NOW_COPY.he.tonightAll);
    // No door to a separate flow: the answers are on the line itself.
    expect(html).not.toContain('data-testid="now-right-now-cta"');
  });

  it("does not ask an answered question again after a reload, and ends the evening with what was kept", () => {
    reset();
    const store = new Map<string, string>();
    vi.stubGlobal("localStorage", { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, v); }, removeItem: (k: string) => { store.delete(k); } });
    try {
      store.set(childScopedKey("rightNowTonight", "c1"), JSON.stringify({ day: "2026-11-12", done: ["practice"], kept: 1 }));
      const second = render(<NowRightNow now={at(12, 20, 30)} lang="en" visit={null} tonight={tonightProps()} />);
      expect(second).toContain('data-question="notice"');
      expect(second).toContain("Did you notice this today?");
      expect(second).toContain("Points to show you something");
      expect(second).toContain("Tonight · question 2 of 3. One tap is enough.");
      store.set(childScopedKey("rightNowTonight", "c1"), JSON.stringify({ day: "2026-11-12", done: ["practice", "notice", "words"], kept: 2 }));
      const done = render(<NowRightNow now={at(12, 20, 30)} lang="en" visit={null} tonight={tonightProps()} />);
      expect(done).toContain("That&#x27;s the day. Tomorrow&#x27;s step is ready when you are.");
      expect(done).toContain("Arbor kept your two answers.");
      // A new day starts empty.
      expect(render(<NowRightNow now={at(13, 20, 30)} lang="en" visit={null} tonight={tonightProps()} />)).toContain('data-question="practice"');
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("draws nothing when the record has nothing for this part of the day", () => {
    reset();
    expect(render(<NowRightNow now={at(12, 16, 30)} lang="en" visit={null} tonight={null} />)).toBe("");
    startRoutine("morning");
    expect(render(<NowRightNow now={at(12, 20, 30)} lang="en" visit={null} tonight={null} />)).toBe("");
  });
});

const proposal = (id: string, createdAt: string, status: "pending" | "approved" = "pending"): MemoryReviewItem => ({
  memoryId: id, childId: "c1", status, fact: `Fact ${id}`, source: "chat", retention: "90 days", createdAt, latestEventId: `e-${id}`,
});

describe("Arbor learned this week", () => {
  const now = at(12, 9, 0);

  it("asks only this week's waiting proposals, newest first, at most two on Now", () => {
    const items = [
      proposal("old", at(1, 9, 0).toISOString()),
      proposal("a", at(10, 9, 0).toISOString()),
      proposal("b", at(11, 9, 0).toISOString()),
      proposal("c", at(9, 9, 0).toISOString()),
      proposal("kept", at(11, 8, 0).toISOString(), "approved"),
      proposal("later", at(13, 9, 0).toISOString()),
    ];
    expect(learnedThisWeek(items, now.getTime()).map((m) => m.memoryId)).toEqual(["b", "a", "c"]);
    reset();
    harness.pending = items;
    const html = render(<NowLearned now={now} />);
    expect(html.match(/data-testid="now-learned-row"/g)).toHaveLength(2);
    expect(html).toContain("Fact b");
    expect(html).not.toContain("Fact old");
    expect(html).toContain("That&#x27;s right");
    expect(html).toContain("Not quite");
  });

  it("has no card when nothing waits this week", () => {
    reset();
    harness.pending = [proposal("old", at(1, 9, 0).toISOString())];
    expect(render(<NowLearned now={now} />)).toBe("");
  });
});

describe("Then and now", () => {
  const now = at(12, 9, 0);
  const note = (id: string, shelf: string, when: Date, notes: string) => ({
    obs: { id: `behaviorLogs:${id}`, origin: "behaviorLogs", shelf, at: when.toISOString() },
    log: { id, timestamp: when.toISOString(), behaviorType: "Moment", notes },
  });
  const rows = [
    note("w1", "words", new Date(2026, 8, 14, 9), "Me do shoes, she said at the door."),
    note("w2", "words", at(10, 18, 0), "I can do it by my own self, she said."),
    note("f1", "feelings", new Date(2026, 9, 2, 9), "Cried and hid when the tower fell."),
    note("f2", "feelings", at(1, 17, 0), "Said she was frustrated and needed a minute."),
    note("p1", "play", at(11, 10, 0), "Asked Dana to be the doctor today."), // one note only: no pair
    note("s1", "sleep", at(9, 20, 0), "Fell asleep after two songs tonight."),
    note("s2", "sleep", at(6, 20, 0), "Needed three songs and a back rub."), // under a week apart: no then
  ];
  const observations = rows.map((r) => r.obs) as never[];
  const logs = rows.map((r) => r.log) as never[];

  it("pairs only shelves with a note a week older than the newest, newest first", () => {
    const pairs = thenAndNowPairs(observations, logs);
    expect(pairs.map((p) => p.shelf)).toEqual(["words", "feelings"]);
    expect(pairs[0].then.text).toBe("Me do shoes, she said at the door.");
    expect(pairs[0].now.text).toBe("I can do it by my own self, she said.");
  });

  it("quotes and dates both sentences, this week's as This week, and draws nothing without a pair", () => {
    reset();
    const html = render(<ThenAndNow observations={observations} logs={logs} now={now} />);
    expect(html.match(/data-testid="then-now-pair"/g)).toHaveLength(2);
    expect(html).toContain(THEN_NOW_COPY.en.title);
    expect(html).toContain("This week");
    expect(html).toContain("Sep 14, 2026");
    expect(html).not.toMatch(/better|improv|progress|behind|ahead/i);
    harness.locale = "he";
    expect(render(<ThenAndNow observations={observations} logs={logs} now={now} />)).toContain(THEN_NOW_COPY.he.thisWeek);
    expect(render(<ThenAndNow observations={observations.slice(4, 5)} logs={logs} now={now} />)).toBe("");
  });
});

describe("v4.1 copy", () => {
  const keys = (o: object) => Object.keys(o).sort();
  it("says the same things in English and Hebrew", () => {
    expect(keys(RIGHT_NOW_COPY.he)).toEqual(keys(RIGHT_NOW_COPY.en));
    expect(keys(RIGHT_NOW_COPY.he.hardHead)).toEqual(["afternoon", "evening", "midday", "morning"]);
    expect(keys(LEARNED_COPY.he)).toEqual(keys(LEARNED_COPY.en));
    expect(keys(THEN_NOW_COPY.he)).toEqual(keys(THEN_NOW_COPY.en));
    for (const value of [...Object.values(LEARNED_COPY.he), ...Object.values(RIGHT_NOW_COPY.he.hardHead), RIGHT_NOW_COPY.he.hardCta]) {
      expect(value).toMatch(/[֐-׿]/);
    }
  });
});

describe("v4.1 wiring", () => {
  const read = (rel: string) => readFileSync(path.resolve(__dirname, rel), "utf8");
  it("mounts Right now under the question row and the learned card under the plans", () => {
    const view = read("NowView.tsx");
    expect(view.indexOf("<NowRightNow")).toBeGreaterThan(view.indexOf("<NowQuestionRow"));
    expect(view.indexOf("<NowLearned")).toBeGreaterThan(view.indexOf("<PlansSection"));
  });
  it("puts Then and now under the portrait cards on My child", () => {
    const portrait = read("ChildPortrait.tsx");
    expect(portrait.indexOf("<ThenAndNow")).toBeGreaterThan(portrait.indexOf("<PortraitCards"));
  });
  it("lets Together open a routine by address and drops it on close", () => {
    const src = read("TogetherRoutines.tsx");
    expect(src).toContain('useHashQuery().get("routine")');
    expect(src).toContain('routeHash("practice", { f: "routines" })');
  });
});

const NOTICE = { id: "custom-point", title: "Points to show you something", custom: true } as unknown as Milestone;
function tonightProps(over: Partial<RightNowTonight> = {}): RightNowTonight {
  return {
    childName: "Noa", gender: "girl", practice: PRACTICES[0], notice: NOTICE,
    dayQuestion: { key: "elev.loop.tonight.day.generic", vars: {} },
    onPractice: vi.fn(), onNotice: vi.fn(async () => {}), onWrite: vi.fn(), onOpenAll: vi.fn(),
    ...over,
  };
}

/* The question body is a plain function of its props: call it, find the
   buttons, tap them (no DOM in this suite). */
function ask(tonight: RightNowTonight, done: TonightQuestion[] = [], extra: { failed?: boolean } = {}) {
  const onDone = vi.fn();
  const setBusy = vi.fn();
  const setFailed = vi.fn();
  const available = { practice: !!tonight.practice, notice: !!tonight.notice, words: !!tonight.dayQuestion };
  const tree = TonightAsk({
    tonight, lang: "en", t: (k, v) => translate("en", k, v), queue: tonightQueue(available, { day: "d", done, kept: done.length }),
    kept: done.length, busy: false, failed: !!extra.failed, copy: RIGHT_NOW_COPY.en, onDone, setBusy, setFailed,
  });
  const walk = (node: React.ReactNode): React.ReactElement<any>[] => {
    if (!React.isValidElement(node)) return Array.isArray(node) ? node.flatMap(walk) : [];
    const el = node as React.ReactElement<any>;
    return [el, ...React.Children.toArray(el.props.children).flatMap(walk)];
  };
  const byId = (id: string) => walk(tree).find((el) => el.props["data-testid"] === id)?.props;
  return { tree, byId, onDone, setBusy, setFailed };
}

describe("Right now · tonight's answers go through Tonight's own seams", () => {
  it("Did it / Not today record the practice answer and move on", () => {
    const tonight = tonightProps();
    const a = ask(tonight);
    a.byId("now-right-now-yes").onClick();
    expect(tonight.onPractice).toHaveBeenCalledWith("did");
    expect(a.onDone).toHaveBeenCalledWith("practice", true);
    const b = ask(tonight);
    b.byId("now-right-now-no").onClick();
    expect(tonight.onPractice).toHaveBeenLastCalledWith("not_today");
  });

  it("the notice answer moves on only once it is saved; a failed save stays and says so", async () => {
    const tonight = tonightProps();
    const a = ask(tonight, ["practice"]);
    a.byId("now-right-now-yes").onClick();
    await vi.waitFor(() => expect(a.onDone).toHaveBeenCalledWith("notice", true));
    expect(tonight.onNotice).toHaveBeenCalledWith("yes");
    expect(a.setBusy).toHaveBeenLastCalledWith(false);
    const failing = tonightProps({ onNotice: vi.fn(async () => { throw new Error("offline"); }) });
    const b = ask(failing, ["practice"]);
    b.byId("now-right-now-no").onClick();
    await vi.waitFor(() => expect(b.setFailed).toHaveBeenLastCalledWith(true));
    expect(failing.onNotice).toHaveBeenCalledWith("not_yet");
    expect(b.onDone).not.toHaveBeenCalled();
    expect(ask(failing, ["practice"], { failed: true }).byId("now-right-now-failed")).toBeTruthy();
  });

  it("Now hands Tonight's own seams to Right now, and Write it down opens the full evening at step 2", () => {
    const view = readFileSync(path.resolve(__dirname, "NowView.tsx"), "utf8");
    expect(view).toContain("onWrite: () => openTonight(2),");
    expect(view).toContain("onNotice: (status) => loop.tonight.onNotice(status),");
    expect(view).toContain("onPractice: loop.answerPractice,");
    expect(view).toContain("<NowTonightLead loop={loop} initialStep={tonightStep} />");
    expect(view).toContain('practice: loop.pick && loop.practiceShown && !loop.doseAnswer && lead !== "practice" ? loop.pick.practice : null,');
    // The visit leading Now says the drafted count too (Right now is not shown beside it).
    expect(view).toContain('{visitDraft ? draftCopy.sub(visitDraft.moments, visitDraft.anchor) : copy.visitBody}');
    expect(view).toContain('{visitDraft ? draftCopy.cta : copy.visitOpen}');
    const blocks = readFileSync(path.resolve(__dirname, "NowLoopBlocks.tsx"), "utf8");
    expect(blocks).toContain("const loop = initialStep ? { ...base, tonight: { ...base.tonight, initialStep } } : base;");
  });

  it("Write it down opens the evening at its words step; Nothing today writes nothing", () => {
    const tonight = tonightProps();
    const a = ask(tonight, ["practice", "notice"]);
    expect(a.byId("now-right-now-question")["data-question"]).toBe("words");
    a.byId("now-right-now-yes").onClick();
    expect(tonight.onWrite).toHaveBeenCalledTimes(1);
    expect(a.onDone).toHaveBeenCalledWith("words", false);
    const b = ask(tonight, ["practice", "notice"]);
    b.byId("now-right-now-no").onClick();
    expect(b.onDone).toHaveBeenCalledWith("words", false);
    expect(tonight.onWrite).toHaveBeenCalledTimes(1);
    ask(tonight).byId("now-right-now-tonight-all").onClick();
    expect(tonight.onOpenAll).toHaveBeenCalledTimes(1);
  });
});

/**
 * v3 EXTRA-CARE — the visit-outcome receipt follows persistence.
 *
 * "What did they suggest?" on the Care landing writes the parent's answer as
 * the visit's follow-up. "Saved" shows only after that write is acknowledged;
 * an offline or unconfirmed write (useChildCollection rejects under
 * requireAcknowledgement) shows an error, keeps the answer in the field, and a
 * retry writes the SAME record (same document id). The same transpile harness
 * as ConsultDraft.lifecycle.test.ts (ConsultContent as a plain function).
 * Also: #/school-brief and #/handoff render none of the landing's modules.
 */
import React from "react";
import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ts from "typescript";
import { visitForConsult } from "../../lib/today/dayCard";
import { appointmentStatus, consultAudienceForProfession, makeFollowUp } from "../../lib/careTrack";

const source = ts.createSourceFile("ConsultTab.tsx", readFileSync("src/components/tabs/ConsultTab.tsx", "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const declaration = source.statements.find((node) => ts.isFunctionDeclaration(node) && node.name?.text === "ConsultContent")!.getText(source);
const code = ts.transpileModule(`${declaration}; return ConsultContent;`, { compilerOptions: { target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React } }).outputText;

type Deferred = { promise: Promise<void>; resolve: () => void; reject: (e: unknown) => void };
const deferred = (): Deferred => {
  let resolve!: () => void, reject!: (e: unknown) => void;
  const promise = new Promise<void>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
};
const flush = () => new Promise<void>((done) => setTimeout(done, 0));

let cursor = 0, slots: any[] = [];
let tab = "consult";
const DAY = 86_400_000;
const past = { id: "past-visit", whenIso: new Date(Date.now() - 2 * DAY).toISOString(), status: "confirmed", profession: "slp", role: "Speech therapist" };
const writes: Deferred[] = [];
const followUpUpsert = vi.fn((..._args: unknown[]) => { const d = deferred(); writes.push(d); return d.promise; });
const apptUpsert = vi.fn(async (..._args: unknown[]) => undefined);
const toast = vi.fn();
const AskSpecialist = () => null;
const CareVisitHead = () => null;
const CareAside = () => null;
const CareDoors = () => null;
const Icon = () => null;
const collection = (name: string) => ({
  items: name === "appointments" ? [past] : [],
  loaded: true, error: false, confirmed: true, isCurrent: () => true, remote: false,
  upsert: name === "apptFollowUps" ? followUpUpsert : name === "appointments" ? apptUpsert : vi.fn(async () => undefined),
});
const env = {
  React, AskSpecialist, CareVisitHead, CareAside, CareDoors, Icon, HomeProgramDays: () => null, HomeProgramEntry: () => null,
  visitForConsult, consultAudienceForProfession, appointmentStatus, makeFollowUp,
  useRef: (initial: unknown) => slots[cursor++] ??= { current: initial },
  useState: (initial: unknown) => { const i = cursor++; if (!(i in slots)) slots[i] = initial; return [slots[i], (value: unknown) => { slots[i] = value; }]; },
  useMemo: (calculate: () => unknown) => calculate(),
  useAuth: () => ({ user: null }),
  useArbor: () => ({ childProfile: { id: "c-outcome", name: "Mika" }, activeTab: tab, setActiveTab: vi.fn() }),
  useLanguage: () => ({ uiLang: "en", t: (key: string) => key }),
  useToast: () => ({ toast }),
  useChildCollection: (_child: string, name: string) => collection(name),
  visitAwaitingOutcome: () => past, isIntakeProfession: () => false, consultHeading: () => "generic", activeHomeEnrolments: () => [], guidedTierOn: () => false,
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
const byId = (all: El[], id: string) => all.find((el) => el.props["data-testid"] === id || el.props.id === id)!;
const save = (all: El[]) => byId(all, "consult-visit-outcome-save");
const type = (value: string) => byId(render(), "consult-visit-outcome-input").props.onChange({ target: { value } });
const successToasts = () => toast.mock.calls.filter((c) => c[1] === "success");

beforeEach(() => {
  cursor = 0; slots = []; tab = "consult"; writes.length = 0;
  followUpUpsert.mockClear(); apptUpsert.mockClear(); toast.mockClear();
});

describe("v3 EXTRA-CARE · the visit-outcome receipt shows only after persistence", () => {
  it("online: no receipt while the write is pending; the save is disabled; 'Saved' after it resolves", async () => {
    type("Read together every evening");
    expect(save(render()).props.disabled).toBe(false);
    save(render()).props.onClick();
    expect(followUpUpsert).toHaveBeenCalledTimes(1);
    const [record, options] = followUpUpsert.mock.calls[0] as [{ id: string; apptId: string; note: string }, unknown];
    expect(record.apptId).toBe("past-visit");
    expect(record.note).toBe("Read together every evening");
    expect(options).toEqual({ requireAcknowledgement: true });
    // pending: nothing claims success, the button cannot fire twice
    const pending = save(render());
    expect(pending.props.disabled).toBe(true);
    expect(pending.props["aria-busy"]).toBe(true);
    expect(byId(render(), "consult-visit-outcome-input").props.readOnly).toBe(true);
    pending.props.onClick();
    await flush();
    expect(followUpUpsert).toHaveBeenCalledTimes(1);
    expect(toast).not.toHaveBeenCalled();
    writes[0].resolve();
    await flush();
    expect(apptUpsert).toHaveBeenCalledWith(expect.objectContaining({ id: "past-visit", status: "done" }));
    expect(successToasts()).toEqual([["elev.learnCare.appt.followUp.saved", "success"]]);
    expect(byId(render(), "consult-visit-outcome-input").props.value).toBe("");
  });

  it("offline or unconfirmed: an error toast, never 'Saved'; the answer stays; a retry writes the same record", async () => {
    type("Practise naming colours at dinner");
    save(render()).props.onClick();
    writes[0].reject(new Error("offline"));
    await flush();
    expect(successToasts()).toEqual([]);
    expect(toast).toHaveBeenCalledWith("elev.consult.visitOutcome.saveError", "error");
    const after = render();
    expect(byId(after, "consult-visit-outcome-input").props.value).toBe("Practise naming colours at dinner");
    expect(save(after).props.disabled).toBe(false);
    expect(apptUpsert).not.toHaveBeenCalled();
    // retry, seconds later: the same document id, so a queued first write and
    // the retry are one record
    const clock = vi.spyOn(Date, "now").mockReturnValue(Date.now() + 5_000);
    try {
      save(render()).props.onClick();
    } finally {
      clock.mockRestore();
    }
    expect(followUpUpsert).toHaveBeenCalledTimes(2);
    const first = followUpUpsert.mock.calls[0][0] as { id: string };
    const second = followUpUpsert.mock.calls[1][0] as { id: string };
    expect(second.id).toBe(first.id);
    writes[1].resolve();
    await flush();
    expect(successToasts()).toEqual([["elev.learnCare.appt.followUp.saved", "success"]]);
  });

  it("an edited answer after a failure is a new record, not the old text under the old id", async () => {
    type("First answer");
    save(render()).props.onClick();
    writes[0].reject(new Error("offline"));
    await flush();
    type("A better answer");
    const clock = vi.spyOn(Date, "now").mockReturnValue(Date.now() + 5_000);
    try {
      save(render()).props.onClick();
    } finally {
      clock.mockRestore();
    }
    const first = followUpUpsert.mock.calls[0][0] as { id: string; note: string };
    const second = followUpUpsert.mock.calls[1][0] as { id: string; note: string };
    expect(second.note).toBe("A better answer");
    expect(first.note).toBe("First answer");
    expect(second.id).not.toBe(first.id);
  });

  it("source pin: the receipt is awaited, acknowledged and the only success toast of the save", () => {
    const text = source.getFullText().replace(/\r\n/g, "\n");
    expect(text).toContain("await followUpsCol.upsert(record, { requireAcknowledgement: true });");
    const body = text.slice(text.indexOf("const saveOutcome = async () => {"), text.indexOf("const saveHomeProgram"));
    expect(body.indexOf('toast(t("elev.learnCare.appt.followUp.saved"), "success")')).toBeGreaterThan(body.indexOf("await followUpsCol.upsert"));
  });
});

describe("v3 EXTRA-CARE · only #/consult is the landing", () => {
  for (const route of ["school-brief", "handoff"]) {
    it(`#/${route} renders no visit head, aside or doors, and the builder is not in landing mode`, () => {
      tab = route;
      const all = render();
      expect(all.some((el) => el.type === CareVisitHead || el.type === CareAside || el.type === CareDoors)).toBe(false);
      expect(all.some((el) => el.props["data-testid"] === "consult-kicker" || el.props["data-testid"] === "consult-sub")).toBe(false);
      expect(all.find((el) => el.type === AskSpecialist)!.props.landing).toBe(false);
    });
  }

  it("#/consult renders each of them once, and the builder in landing mode", () => {
    const all = render();
    expect(all.filter((el) => el.type === CareAside)).toHaveLength(1);
    expect(all.filter((el) => el.type === CareDoors)).toHaveLength(1);
    expect(all.find((el) => el.type === AskSpecialist)!.props.landing).toBe(true);
    expect(all.filter((el) => el.props["data-module"]).map((el) => el.props["data-module"])).toEqual(["consult-packet"]);
  });
});

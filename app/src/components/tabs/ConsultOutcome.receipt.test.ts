/**
 * v3 EXTRA-CARE — the visit-outcome receipt follows persistence.
 *
 * "What did they suggest?" writes the parent's answer as the visit's
 * follow-up. "Saved" shows only after that write is acknowledged; an offline
 * or unconfirmed write (useChildCollection rejects under
 * requireAcknowledgement) shows an error, keeps the answer in the field, and a
 * retry writes the SAME record (same document id, the current words).
 * Signed in, Firestore applies a write to the device cache at once, so the
 * follow-up reaches the collection's items before the server confirms it; the
 * held record must not close the loop (the field, the answer and the retry
 * stay) and the error must say the answer is kept, not lost.
 *
 * v3 F-CARE-1 (re-pinned): the answer and the home program moved from the Care
 * landing to #/appointments (care/VisitOutcome), and "Saved" is the Receipt
 * line there (B-STATUS-01), never a success toast. The same transpile harness
 * as ConsultDraft.lifecycle.test.ts, on VisitOutcome as a plain function. The
 * landing keeps ONE line that opens Appointments; #/school-brief and #/handoff
 * render none of the landing's modules (ConsultContent, below).
 */
import React from "react";
import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ts from "typescript";
import { visitForConsult } from "../../lib/today/dayCard";
import { appointmentStatus, consultAudienceForProfession, makeFollowUp, visitAskedForOutcome, visitAwaitingOutcome } from "../../lib/careTrack";

/** The named function declaration in a source file, as plain JS returning it. */
function transpiled(file: string, name: string): { code: string; text: string } {
  const sf = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const full = sf.statements.find((node) => ts.isFunctionDeclaration(node) && node.name?.text === name)!.getText(sf);
  // `export default` is dropped: the declaration runs inside a Function body.
  const declaration = full.slice(full.indexOf(`function ${name}`));
  const code = ts.transpileModule(`${declaration}; return ${name};`, { compilerOptions: { target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React } }).outputText;
  return { code, text: sf.getFullText().replace(/\r\n/g, "\n") };
}
const OUTCOME = transpiled("src/components/care/VisitOutcome.tsx", "VisitOutcome");
const CONSULT = transpiled("src/components/tabs/ConsultTab.tsx", "ConsultContent");

type Deferred = { promise: Promise<void>; resolve: () => void; reject: (e: unknown) => void };
const deferred = (): Deferred => {
  let resolve!: () => void, reject!: (e: unknown) => void;
  const promise = new Promise<void>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
};
const flush = () => new Promise<void>((done) => setTimeout(done, 0));

type FollowUp = { id: string; apptId: string; note: string; createdAt: string };
let cursor = 0, slots: any[] = [];
let tab = "consult";
/** Signed in (Firestore) vs. this device's sandbox store. */
let remote = false;
/** Firestore's local cache: a write lands in the listener's items at once. */
let cacheApplies = false;
let followUps: FollowUp[] = [];
const DAY = 86_400_000;
const past = { id: "past-visit", whenIso: new Date(Date.now() - 2 * DAY).toISOString(), status: "confirmed", profession: "slp", role: "Speech therapist" };
const writes: Deferred[] = [];
const followUpUpsert = vi.fn((...args: unknown[]) => {
  const record = args[0] as FollowUp;
  if (cacheApplies) followUps = [...followUps.filter((f) => f.id !== record.id), record];
  const d = deferred();
  writes.push(d);
  return d.promise;
});
const apptUpsert = vi.fn(async (..._args: unknown[]) => undefined);
const programUpsert = vi.fn(async (..._args: unknown[]) => undefined);
const toast = vi.fn();
const AskSpecialist = () => null;
const CareVisitHead = () => null;
const CareAside = () => null;
const CareDoors = () => null;
const Icon = () => null;
const Receipt = () => null;
const HomeProgramEntry = () => null;
const HomeProgramDays = () => null;
const collection = (name: string) => ({
  items: name === "appointments" ? [past] : name === "apptFollowUps" ? followUps : [],
  loaded: true, error: false, confirmed: true, isCurrent: () => true, remote,
  upsert: name === "apptFollowUps" ? followUpUpsert : name === "appointments" ? apptUpsert : name === "programs" ? programUpsert : vi.fn(async () => undefined),
  remove: vi.fn(async () => undefined),
});
const hooks = {
  useRef: (initial: unknown) => slots[cursor++] ??= { current: initial },
  useState: (initial: unknown) => { const i = cursor++; if (!(i in slots)) slots[i] = initial; return [slots[i], (value: unknown) => { slots[i] = value; }]; },
  useMemo: (calculate: () => unknown) => calculate(),
  useAuth: () => ({ user: null }),
  useArbor: () => ({ childProfile: { id: "c-outcome", name: "Mika" }, activeTab: tab, setActiveTab: vi.fn() }),
  useLanguage: () => ({ uiLang: "en", t: (key: string) => key }),
  useToast: () => ({ toast }),
  useChildCollection: (_child: string, name: string) => collection(name),
};
const outcomeEnv = {
  React, Icon, Receipt, HomeProgramEntry, HomeProgramDays, ...hooks,
  // the real open-loop rule: a follow-up for the visit closes it (v3 F-CARE-1
  // r2: through careTrack's visitAskedForOutcome, the rule Appointments shares)
  visitAskedForOutcome, appointmentStatus, makeFollowUp,
  homeProfessionForAppointment: () => "slp", nextVisitDayFor: () => null,
  activeHomeEnrolments: () => [], toggleExerciseDay: (e: unknown) => e,
  db: null, doc: vi.fn(), writeBatch: vi.fn(),
  appointmentRoleLabel: () => "Speech therapist", fmtDay: () => "date",
};
const VisitOutcome = new Function(...Object.keys(outcomeEnv), OUTCOME.code)(...Object.values(outcomeEnv));
const consultEnv = {
  React, AskSpecialist, CareVisitHead, CareAside, CareDoors, Icon, ...hooks,
  visitForConsult, consultAudienceForProfession, visitAwaitingOutcome,
  isIntakeProfession: () => false, consultHeading: () => "generic", guidedTierOn: () => false,
  appointmentRoleLabel: () => "Speech therapist", fmtDay: () => "date", lowerFor: (_lang: string, value: string) => value,
};
const ConsultContent = new Function(...Object.keys(consultEnv), CONSULT.code)(...Object.values(consultEnv));

type El = React.ReactElement<Record<string, any>>;
function elements(node: React.ReactNode): El[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!React.isValidElement<Record<string, any>>(node)) return [];
  const element = node as El;
  return [element, ...React.Children.toArray(element.props.children).flatMap(elements)];
}
function render(): El[] {
  cursor = 0;
  return elements(VisitOutcome({ apptsCol: collection("appointments"), followUpsCol: collection("apptFollowUps") }));
}
function renderConsult(): El[] { cursor = 0; return elements(ConsultContent({ query: new URLSearchParams(""), isOwnerCurrent: () => true })); }
const byId = (all: El[], id: string) => all.find((el) => el.props["data-testid"] === id || el.props.id === id);
const save = (all: El[]) => byId(all, "consult-visit-outcome-save")!;
const input = (all: El[]) => byId(all, "consult-visit-outcome-input");
const type = (value: string) => input(render())!.props.onChange({ target: { value } });
/** The Receipt line's words (its children), or null when none is drawn. */
const receipt = (all: El[]) => {
  const el = all.find((x) => x.type === Receipt);
  if (!el) return null;
  expect(el.props.testId).toBe("visit-outcome-saved");
  return React.Children.toArray(el.props.children).join("");
};
const successToasts = () => toast.mock.calls.filter((c) => c[1] === "success" || c[1] === "info" || c[1] === undefined);
const later = (fn: () => void) => {
  const clock = vi.spyOn(Date, "now").mockReturnValue(Date.now() + 5_000);
  try { fn(); } finally { clock.mockRestore(); }
};

beforeEach(() => {
  cursor = 0; slots = []; tab = "consult"; writes.length = 0;
  remote = false; cacheApplies = false; followUps = [];
  followUpUpsert.mockClear(); apptUpsert.mockClear(); programUpsert.mockClear(); toast.mockClear();
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
    const pending = render();
    expect(save(pending).props.disabled).toBe(true);
    expect(save(pending).props["aria-busy"]).toBe(true);
    expect(input(pending)!.props.readOnly).toBe(true);
    expect(receipt(pending)).toBeNull();
    save(pending).props.onClick();
    await flush();
    expect(followUpUpsert).toHaveBeenCalledTimes(1);
    expect(toast).not.toHaveBeenCalled();
    expect(receipt(render())).toBeNull();
    writes[0].resolve();
    await flush();
    expect(apptUpsert).toHaveBeenCalledWith(expect.objectContaining({ id: "past-visit", status: "done" }));
    // B-STATUS-01: the answer is the Receipt line, never a toast
    expect(receipt(render())).toBe("elev.learnCare.appt.followUp.saved");
    expect(toast).not.toHaveBeenCalled();
    expect(input(render())!.props.value).toBe("");
  });

  it("a device write that failed: an error toast, never 'Saved'; the answer stays; a retry writes the same record", async () => {
    type("Practise naming colours at dinner");
    save(render()).props.onClick();
    writes[0].reject(new Error("quota"));
    await flush();
    expect(successToasts()).toEqual([]);
    expect(toast).toHaveBeenCalledWith("elev.consult.visitOutcome.saveError", "error");
    const after = render();
    expect(receipt(after)).toBeNull();
    expect(input(after)!.props.value).toBe("Practise naming colours at dinner");
    expect(save(after).props.disabled).toBe(false);
    expect(byId(after, "consult-visit-outcome-held")).toBeUndefined();
    expect(apptUpsert).not.toHaveBeenCalled();
    // retry, seconds later: the same document id, so a queued first write and
    // the retry are one record
    later(() => save(render()).props.onClick());
    expect(followUpUpsert).toHaveBeenCalledTimes(2);
    const first = followUpUpsert.mock.calls[0][0] as { id: string };
    const second = followUpUpsert.mock.calls[1][0] as { id: string };
    expect(second.id).toBe(first.id);
    expect(receipt(render())).toBeNull();
    writes[1].resolve();
    await flush();
    expect(receipt(render())).toBe("elev.learnCare.appt.followUp.saved");
    expect(successToasts()).toEqual([]);
  });

  it("an edited answer after a failure replaces the held record: the same id, the new words (one follow-up, never two)", async () => {
    type("First answer");
    save(render()).props.onClick();
    writes[0].reject(new Error("offline"));
    await flush();
    type("A better answer");
    later(() => save(render()).props.onClick());
    const first = followUpUpsert.mock.calls[0][0] as { id: string; note: string };
    const second = followUpUpsert.mock.calls[1][0] as { id: string; note: string };
    expect(first.note).toBe("First answer");
    expect(second.note).toBe("A better answer");
    expect(second.id).toBe(first.id);
  });

  it("signed in, offline: the local cache already holds the record, yet the loop stays open with the answer, and the toast says it is kept", async () => {
    remote = true;
    cacheApplies = true;
    type("Name the colours at dinner");
    save(render()).props.onClick();
    // Firestore's cache applied the write: the follow-up is in the listener's items
    expect(followUps.map((f) => f.note)).toEqual(["Name the colours at dinner"]);
    // NEGATIVE CONTROL: by the open-loop rule alone, that record closes the visit
    expect(visitAwaitingOutcome([past] as never, followUps as never, Date.now())).toBeNull();
    // ...but while its write is unconfirmed the field stays, read-only
    expect(input(render())!.props.readOnly).toBe(true);
    writes[0].reject(new Error("The write needs an online confirmation"));
    await flush();
    expect(successToasts()).toEqual([]);
    expect(toast).toHaveBeenCalledWith("elev.consult.visitOutcome.queued", "error");
    expect(toast).not.toHaveBeenCalledWith("elev.consult.visitOutcome.saveError", "error");
    const after = render();
    expect(byId(after, "consult-visit-outcome")).toBeDefined();
    expect(input(after)!.props.value).toBe("Name the colours at dinner");
    expect(input(after)!.props.readOnly).toBe(false);
    expect(save(after).props.disabled).toBe(false);
    expect(byId(after, "consult-visit-outcome-held")).toBeDefined();
    expect(receipt(after)).toBeNull();
    expect(apptUpsert).not.toHaveBeenCalled();
    // back online: the retry is the same document, and only its ack says Saved
    later(() => save(render()).props.onClick());
    expect(followUpUpsert).toHaveBeenCalledTimes(2);
    expect((followUpUpsert.mock.calls[1][0] as FollowUp).id).toBe((followUpUpsert.mock.calls[0][0] as FollowUp).id);
    expect(followUps).toHaveLength(1);
    expect(receipt(render())).toBeNull();
    writes[1].resolve();
    await flush();
    // acknowledged: the record now closes the loop, and the Receipt says so
    const done = render();
    expect(receipt(done)).toBe("elev.learnCare.appt.followUp.saved");
    expect(byId(done, "consult-visit-outcome")).toBeUndefined();
    expect(byId(done, "visit-home-entry")).toBeDefined();
    expect(successToasts()).toEqual([]);
  });

  it("signed in, the server refused the write: 'wasn't saved', never 'kept on this device'", async () => {
    remote = true;
    type("Swing at the park twice a week");
    save(render()).props.onClick();
    writes[0].reject(Object.assign(new Error("Missing or insufficient permissions."), { code: "permission-denied" }));
    await flush();
    expect(toast).toHaveBeenCalledWith("elev.consult.visitOutcome.saveError", "error");
    expect(toast).not.toHaveBeenCalledWith("elev.consult.visitOutcome.queued", "error");
    expect(byId(render(), "consult-visit-outcome-held")).toBeUndefined();
    expect(input(render())!.props.value).toBe("Swing at the park twice a week");
    expect(receipt(render())).toBeNull();
  });

  it("the home program: its Receipt follows the writes (the follow-up last), never before", async () => {
    byId(render(), "consult-home-program-choice")!.props.onClick();
    const entry = render().find((el) => el.type === HomeProgramEntry)!;
    expect(entry).toBeDefined();
    const confirm = entry.props.onConfirm({ ok: true, enrolment: { id: "home-1", home: { exercises: [{ text: "Blow bubbles" }] } }, superseded: [], goals: [] });
    await flush();
    expect(programUpsert).toHaveBeenCalledTimes(1);
    expect(followUpUpsert).toHaveBeenCalledTimes(1);
    expect((followUpUpsert.mock.calls[0][0] as FollowUp).note).toBe("Blow bubbles");
    expect(receipt(render())).toBeNull();
    writes[0].resolve();
    await confirm;
    expect(receipt(render())).toBe("elev.homeProgram.saved");
    expect(toast).not.toHaveBeenCalled();
  });

  it("source pin: the receipt is awaited and acknowledged; the save holds no success toast", () => {
    const text = OUTCOME.text;
    expect(text).toContain("await followUpsCol.upsert(record, { requireAcknowledgement: true });");
    const body = text.slice(text.indexOf("const saveOutcome = async () => {"), text.indexOf("const saveHomeProgram"));
    expect(body.indexOf('setSaved("outcome");')).toBeGreaterThan(body.indexOf("await followUpsCol.upsert"));
    expect(text).not.toMatch(/toast\([^)]*\)\s*,\s*"(?:success|info)"/);
    expect(text).not.toContain('"success")');
    // NEGATIVE CONTROL: the toast this re-pin retired is caught by the same check
    expect('toast(t("elev.learnCare.appt.followUp.saved"), "success");').toContain('"success")');
  });
});

describe("v3 EXTRA-CARE · only #/consult is the landing", () => {
  for (const route of ["school-brief", "handoff"]) {
    it(`#/${route} renders no visit card, head, aside or doors, and the builder is not in landing mode`, () => {
      tab = route;
      const all = renderConsult();
      expect(all.some((el) => el.type === CareVisitHead || el.type === CareAside || el.type === CareDoors)).toBe(false);
      expect(all.some((el) => el.props["data-testid"] === "consult-kicker" || el.props["data-testid"] === "consult-sub" || el.props["data-testid"] === "consult-visit-card")).toBe(false);
      const builder = all.find((el) => el.type === AskSpecialist)!;
      expect(builder.props.landing).toBe(false);
      expect(builder.props.head).toBeUndefined();
      expect(builder.props.headAfter).toBeUndefined();
    });
  }

  it("#/consult renders each of them once, the builder in landing mode inside the visit card", () => {
    const all = renderConsult();
    expect(all.filter((el) => el.type === CareAside)).toHaveLength(1);
    expect(all.filter((el) => el.type === CareDoors)).toHaveLength(1);
    const card = byId(all, "consult-visit-card")!;
    expect(card.type).toBe("section");
    const inCard = elements(card.props.children);
    expect(inCard.filter((el) => el.type === AskSpecialist)).toHaveLength(1);
    expect(inCard.find((el) => el.type === AskSpecialist)!.props.landing).toBe(true);
    expect(all.filter((el) => el.props["data-module"]).map((el) => el.props["data-module"])).toEqual(["consult-packet"]);
  });

  it("v3 F-CARE-1: #/consult asks the open loop in ONE line that opens Appointments; the answer is not written here", () => {
    const all = renderConsult();
    expect(byId(all, "consult-visit-outcome")).toBeUndefined();
    expect(byId(all, "consult-visit-outcome-input")).toBeUndefined();
    const link = all.find((el) => el.type === AskSpecialist)!.props.headAfter as El;
    expect(link.props["data-testid"]).toBe("consult-visit-outcome-link");
    expect(link.props["data-primary-move"]).toBeUndefined();
    expect(link.props.className).toContain("min-h-[44px]");
    // answered: no line at all
    followUps = [{ id: "f1", apptId: "past-visit", note: "Read together", createdAt: new Date().toISOString() }];
    expect(renderConsult().find((el) => el.type === AskSpecialist)!.props.headAfter).toBeUndefined();
  });
});

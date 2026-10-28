/**
 * v3 EXTRA-CARE — the visit-outcome receipt follows persistence.
 *
 * "What did they suggest?" on the Care landing writes the parent's answer as
 * the visit's follow-up. "Saved" shows only after that write is acknowledged;
 * an offline or unconfirmed write (useChildCollection rejects under
 * requireAcknowledgement) shows an error, keeps the answer in the field, and a
 * retry writes the SAME record (same document id, the current words).
 * Signed in, Firestore applies a write to the device cache at once, so the
 * follow-up reaches the collection's items before the server confirms it; the
 * held record must not close the loop (the field, the answer and the retry
 * stay) and the error must say the answer is kept, not lost.
 * The same transpile harness as ConsultDraft.lifecycle.test.ts (ConsultContent
 * as a plain function). Also: #/school-brief and #/handoff render none of the
 * landing's modules.
 */
import React from "react";
import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ts from "typescript";
import { visitForConsult } from "../../lib/today/dayCard";
import { appointmentStatus, consultAudienceForProfession, makeFollowUp, visitAwaitingOutcome } from "../../lib/careTrack";

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
const toast = vi.fn();
/** B-STATUS-01: "Saved" is the ONE receipt line now (components/ui/Receipt
 *  useReceiptNote), never a success toast. */
const receiptShow = vi.fn();
const AskSpecialist = () => null;
const CareVisitHead = () => null;
const CareAside = () => null;
const CareShared = () => null;
const Icon = () => null;
const collection = (name: string) => ({
  items: name === "appointments" ? [past] : name === "apptFollowUps" ? followUps : [],
  loaded: true, error: false, confirmed: true, isCurrent: () => true, remote,
  upsert: name === "apptFollowUps" ? followUpUpsert : name === "appointments" ? apptUpsert : vi.fn(async () => undefined),
});
const env = {
  React, AskSpecialist, CareVisitHead, CareAside, CareShared, Icon, HomeProgramDays: () => null, HomeProgramEntry: () => null,
  visitForConsult, consultAudienceForProfession, appointmentStatus, makeFollowUp,
  useRef: (initial: unknown) => slots[cursor++] ??= { current: initial },
  useState: (initial: unknown) => { const i = cursor++; if (!(i in slots)) slots[i] = initial; return [slots[i], (value: unknown) => { slots[i] = value; }]; },
  useMemo: (calculate: () => unknown) => calculate(),
  useAuth: () => ({ user: null }),
  useArbor: () => ({ childProfile: { id: "c-outcome", name: "Mika" }, activeTab: tab, setActiveTab: vi.fn() }),
  useLanguage: () => ({ uiLang: "en", t: (key: string) => key }),
  useToast: () => ({ toast }),
  useReceiptNote: () => ({ note: null, show: receiptShow, clear: vi.fn() }),
  ReceiptNoteLine: () => null,
  useChildCollection: (_child: string, name: string) => collection(name),
  // the real open-loop rule: a follow-up for the visit closes it
  visitAwaitingOutcome, isIntakeProfession: () => false, consultHeading: () => "generic", activeHomeEnrolments: () => [], guidedTierOn: () => false,
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
const byId = (all: El[], id: string) => all.find((el) => el.props["data-testid"] === id || el.props.id === id);
const save = (all: El[]) => byId(all, "consult-visit-outcome-save")!;
const input = (all: El[]) => byId(all, "consult-visit-outcome-input");
const type = (value: string) => input(render())!.props.onChange({ target: { value } });
/** What answered "saved": the receipt lines shown, plus any success toast (there must be none). */
const successToasts = () => [
  ...receiptShow.mock.calls.map((c) => [(c[0] as { text: string }).text, "receipt"]),
  ...toast.mock.calls.filter((c) => c[1] === "success"),
];
const later = (fn: () => void) => {
  const clock = vi.spyOn(Date, "now").mockReturnValue(Date.now() + 5_000);
  try { fn(); } finally { clock.mockRestore(); }
};

beforeEach(() => {
  cursor = 0; slots = []; tab = "consult"; writes.length = 0;
  remote = false; cacheApplies = false; followUps = [];
  followUpUpsert.mockClear(); apptUpsert.mockClear(); toast.mockClear(); receiptShow.mockClear();
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
    expect(input(render())!.props.readOnly).toBe(true);
    pending.props.onClick();
    await flush();
    expect(followUpUpsert).toHaveBeenCalledTimes(1);
    expect(toast).not.toHaveBeenCalled();
    writes[0].resolve();
    await flush();
    expect(apptUpsert).toHaveBeenCalledWith(expect.objectContaining({ id: "past-visit", status: "done" }));
    expect(successToasts()).toEqual([["elev.learnCare.appt.followUp.saved", "receipt"]]);
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
    writes[1].resolve();
    await flush();
    expect(successToasts()).toEqual([["elev.learnCare.appt.followUp.saved", "receipt"]]);
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
    expect(apptUpsert).not.toHaveBeenCalled();
    // back online: the retry is the same document, and only its ack says Saved
    later(() => save(render()).props.onClick());
    expect(followUpUpsert).toHaveBeenCalledTimes(2);
    expect((followUpUpsert.mock.calls[1][0] as FollowUp).id).toBe((followUpUpsert.mock.calls[0][0] as FollowUp).id);
    expect(followUps).toHaveLength(1);
    expect(successToasts()).toEqual([]);
    writes[1].resolve();
    await flush();
    expect(successToasts()).toEqual([["elev.learnCare.appt.followUp.saved", "receipt"]]);
    // acknowledged: the record now closes the loop
    expect(byId(render(), "consult-visit-outcome")).toBeUndefined();
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
  });

  it("source pin: the receipt is awaited, acknowledged and the only answer of the save (a receipt line, never a success toast)", () => {
    const text = source.getFullText().replace(/\r\n/g, "\n");
    expect(text).toContain("await followUpsCol.upsert(record, { requireAcknowledgement: true });");
    const body = text.slice(text.indexOf("const saveOutcome = async () => {"), text.indexOf("const saveHomeProgram"));
    expect(body).not.toContain('"success"');
    expect(body.indexOf('text: t("elev.learnCare.appt.followUp.saved")')).toBeGreaterThan(body.indexOf("await followUpsCol.upsert"));
    expect(body).toContain('testId: "consult-receipt-undo"');
  });
});

describe("v3 EXTRA-CARE · only #/consult is the landing", () => {
  for (const route of ["school-brief", "handoff"]) {
    it(`#/${route} renders no visit card, head, aside or doors, and the builder is not in landing mode`, () => {
      tab = route;
      const all = render();
      expect(all.some((el) => el.type === CareVisitHead || el.type === CareAside || el.type === CareShared)).toBe(false);
      expect(all.some((el) => el.props["data-testid"] === "consult-kicker" || el.props["data-testid"] === "consult-sub" || el.props["data-testid"] === "consult-visit-card")).toBe(false);
      const builder = all.find((el) => el.type === AskSpecialist)!;
      expect(builder.props.landing).toBe(false);
      expect(builder.props.head).toBeUndefined();
    });
  }

  it("#/consult renders each of them once, the builder in landing mode inside the visit card", () => {
    const all = render();
    expect(all.filter((el) => el.type === CareAside)).toHaveLength(1);
    expect(all.filter((el) => el.type === CareShared)).toHaveLength(1);
    const card = byId(all, "consult-visit-card")!;
    expect(card.type).toBe("section");
    const inCard = elements(card.props.children);
    expect(inCard.filter((el) => el.type === AskSpecialist)).toHaveLength(1);
    expect(inCard.find((el) => el.type === AskSpecialist)!.props.landing).toBe(true);
    expect(all.filter((el) => el.props["data-module"]).map((el) => el.props["data-module"])).toEqual(["consult-packet"]);
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Milestone } from "../types";
import type { KeepsakeDoc } from "../lib/firstsKeepsake";
import { observeMilestoneDoc, type ObserveOptions, type ObserveStatus } from "../lib/milestones/observe";
import { toObservations } from "../lib/observations";

const h = vi.hoisted(() => ({
  cursor: 0, slots: [] as any[], effects: [] as (() => void)[], disposed: false,
  uid: "owner", child: "child-a", milestones: [] as Milestone[], loaded: true, confirmed: true,
  keeps: [] as KeepsakeDoc[], keepsLoaded: true, keepsConfirmed: true,
  observe: vi.fn(), restore: vi.fn(), keep: vi.fn(), remove: vi.fn(),
}));
vi.mock("react", () => ({
  useState: (initial: any) => {
    const i = h.cursor++;
    if (!(i in h.slots)) h.slots[i] = typeof initial === "function" ? initial() : initial;
    return [h.slots[i], (next: any) => {
      if (h.disposed) throw Error("setState after unmount");
      h.slots[i] = typeof next === "function" ? next(h.slots[i]) : next;
    }];
  },
  useRef: (initial: any) => { const i = h.cursor++; return h.slots[i] ??= { current: initial }; },
  useEffect: (effect: () => void | (() => void), deps: unknown[]) => {
    const i = h.cursor++, previous = h.slots[i];
    if (previous && deps.every((dep, index) => Object.is(dep, previous.deps[index]))) return;
    const slot = { deps, cleanup: undefined as any };
    h.slots[i] = slot;
    h.effects.push(() => { previous?.cleanup?.(); slot.cleanup = effect(); });
  },
}));
vi.mock("../context/AuthContext", () => ({ useAuth: () => ({ user: h.uid ? { uid: h.uid } : null }) }));
vi.mock("../context/ArborContext", () => ({ useArbor: () => ({
  childProfile: { id: h.child }, milestones: h.milestones, milestonesLoaded: h.loaded, milestonesConfirmed: h.confirmed,
  setMilestoneObservation: h.observe, restoreMilestone: h.restore,
}) }));
vi.mock("./useChildCollection", () => ({ useChildCollection: () => ({
  items: h.keeps, loaded: h.keepsLoaded, confirmed: h.keepsConfirmed, remote: true, error: false,
  upsert: h.keep, remove: h.remove, isCurrent: () => h.keepsConfirmed,
}) }));

import { useNoticeActions, withoutNoticeAnswer } from "./useNoticeActions";

const original: Milestone = {
  id: "one-observation", domain: "language_communication", ageGroup: "2 years", ageMonths: 24,
  title: "Uses two words together", description: "An everyday thing to notice", checked: false,
  references: [{ label: "Source", url: "https://example.test/source" }],
};
const kept: KeepsakeDoc = {
  id: original.id, milestoneId: original.id, note: "More bus, she said.", noticedOn: "2026-09-02",
  createdAt: "2026-09-03T12:00:00.000Z", updatedAt: "2026-09-03T12:00:00.000Z", photoUrl: "https://example.test/owned-photo",
};
const render = () => {
  h.cursor = 0;
  const result = useNoticeActions();
  h.effects.splice(0).forEach(effect => effect());
  return result;
};
const unmount = () => { h.slots.forEach(slot => slot?.cleanup?.()); h.disposed = true; };
function deferred() {
  let resolve!: () => void, reject!: (error: Error) => void;
  const promise = new Promise<void>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const updateMilestone = (row: Milestone) => { h.milestones = h.milestones.map(value => value.id === row.id ? row : value); };

beforeEach(() => {
  h.cursor = 0; h.slots = []; h.effects = []; h.disposed = false;
  h.uid = "owner"; h.child = "child-a"; h.loaded = true; h.confirmed = true;
  h.milestones = [structuredClone(original)]; h.keeps = []; h.keepsLoaded = true; h.keepsConfirmed = true;
  h.observe = vi.fn(async (id: string, status: ObserveStatus, opts: ObserveOptions) => updateMilestone(observeMilestoneDoc(h.milestones.find(row => row.id === id)!, status, opts)));
  h.restore = vi.fn(async (row: Milestone) => updateMilestone(row));
  h.keep = vi.fn(async (doc: KeepsakeDoc) => { h.keeps = [...h.keeps.filter(value => value.id !== doc.id), doc]; });
  h.remove = vi.fn();
  vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-18T12:00:00.000Z"));
});
afterEach(() => { vi.useRealTimers(); });

describe("the shared observation edit lifetime", () => {
  it.each(["yes", "not_yet", "not_sure"] as const)("acknowledges %s on the canonical row without turning a neutral answer into an observed event", async status => {
    const actions = render().forMilestone(h.milestones[0]);
    await actions.onAnswer(status);
    expect(h.observe).toHaveBeenCalledWith(original.id, status, { now: "2026-10-18T12:00:00.000Z", source: "parent_typed" }, { requireAcknowledgement: true });
    expect(h.milestones).toHaveLength(1);
    expect(h.milestones[0].observationStatus).toBe(status);
    expect(h.milestones[0].observationSource).toBe("parent_typed");
    expect(toObservations({ milestones: h.milestones }, { id: h.child, birthMonth: "2024-01" }).filter(row => row.origin === "milestones")).toHaveLength(status === "yes" ? 1 : 0);
    expect(h.keep).not.toHaveBeenCalled();
  });

  it("keeps a write pending, deduplicates a repeated tap, and refuses a competing answer until acknowledgement", async () => {
    const write = deferred(); h.observe.mockReturnValue(write.promise);
    const actions = render().forMilestone(h.milestones[0]);
    let saved = false;
    const pending = actions.onAnswer("yes");
    void pending.then(() => { saved = true; });
    expect(actions.onAnswer("yes")).toBe(pending);
    await expect(actions.onAnswer("not_yet")).rejects.toThrow("still being saved");
    await Promise.resolve(); expect(saved).toBe(false); expect(h.observe).toHaveBeenCalledOnce();
    write.resolve(); await pending; expect(saved).toBe(true);
  });

  it("retries the same timestamp and restores the immutable pre-answer record after date refinements", async () => {
    const before = structuredClone(original);
    const write = deferred(); h.observe.mockReturnValueOnce(write.promise);
    const started = render().forMilestone(h.milestones[0]).onAnswer("yes");
    const rejected = expect(started).rejects.toThrow("unconfirmed");
    write.reject(Error("unconfirmed")); await rejected;
    // A failed write need not have appeared in a snapshot; its retry still
    // carries the original timestamp and keeps exactly one source identity.
    vi.setSystemTime(new Date("2026-10-19T12:00:00.000Z"));
    await render().forMilestone(h.milestones[0]).onAnswer("yes");
    expect(h.observe.mock.calls[1][2].now).toBe(h.observe.mock.calls[0][2].now);
    await render().forMilestone(h.milestones[0]).onWhen("earlier");
    expect(h.milestones[0].observedAt).toBe("2026-10-18T12:00:00.000Z");
    expect(h.milestones[0].observedWhen).toBe("earlier");
    await expect(render().forMilestone(h.milestones[0]).onUndo!()).resolves.toEqual({ selected: null, observedWhen: null });
    expect(h.restore).toHaveBeenLastCalledWith(before, { requireAcknowledgement: true });
    expect(h.milestones[0]).toEqual(before);
    expect(render().forMilestone(h.milestones[0]).onUndo).toBeUndefined();
  });

  it("reconfirms an optimistic Seen it retry without moving its date or dropping its linked source", async () => {
    const before = structuredClone(original);
    h.observe.mockImplementationOnce(async (id, status, opts) => {
      updateMilestone(observeMilestoneDoc(h.milestones[0], status, opts));
      throw Error("unconfirmed");
    });
    await expect(render().forMilestone(h.milestones[0]).onAnswer("yes")).rejects.toThrow("unconfirmed");
    const optimistic = structuredClone(h.milestones[0]);
    vi.setSystemTime(new Date("2026-10-21T12:00:00.000Z"));
    await render().forMilestone(h.milestones[0]).onAnswer("yes");
    expect(h.restore).toHaveBeenLastCalledWith(optimistic, { requireAcknowledgement: true });
    await render().forMilestone(h.milestones[0]).onUndo!();
    expect(h.milestones[0]).toEqual(before);

    h.milestones = [observeMilestoneDoc(original, "yes", { now: "2026-09-01T12:00:00.000Z", source: "ai_proposed_parent_confirmed", provenance: "original-moment" })];
    const linked = structuredClone(h.milestones[0]);
    await render().forMilestone(h.milestones[0]).onAnswer("yes");
    expect(h.milestones[0]).toEqual(linked);
    await render().forMilestone(h.milestones[0]).onWhen("this_week");
    expect(h.milestones[0]).toMatchObject({ observedAt: "2026-09-01T12:00:00.000Z", observationUpdatedAt: "2026-09-01T12:00:00.000Z", observationSource: "ai_proposed_parent_confirmed", observationProvenance: "original-moment" });
  });

  it.each(["yes", "not_sure"] as const)("returns the restored %s answer after reaffirming it, even when the selected prop does not change", async status => {
    const before = observeMilestoneDoc(original, status, { when: "earlier", now: "2026-09-01T12:00:00.000Z" });
    h.milestones = [before];
    await render().forMilestone(before).onAnswer(status);
    const result = await render().forMilestone(before).onUndo!();
    expect(result).toEqual({ selected: status, observedWhen: before.observedWhen ?? null });
    expect(h.milestones[0]).toEqual(before);
  });

  it("edits only the kept words, preserves date/photo/creation, and leaves that evidence after Undo", async () => {
    h.keeps = [structuredClone(kept)];
    await render().forMilestone(h.milestones[0]).onAnswer("yes");
    await render().forMilestone(h.milestones[0]).onWhen("earlier");
    await render().forMilestone(h.milestones[0]).onKeepQuote("  More blue bus.  ");
    expect(h.keep).toHaveBeenCalledWith(expect.objectContaining({ id: kept.id, note: "More blue bus.", noticedOn: kept.noticedOn, photoUrl: kept.photoUrl, createdAt: kept.createdAt }), { requireAcknowledgement: true });
    await render().forMilestone(h.milestones[0]).onUndo!();
    expect(h.milestones[0]).toEqual(original);
    expect(h.keeps[0].note).toBe("More blue bus."); expect(h.remove).not.toHaveBeenCalled();
  });

  it("retains a failed quote's ID and metadata for retry while its own optimistic snapshot is unconfirmed", async () => {
    h.keeps = [structuredClone(kept)];
    h.keep.mockImplementationOnce(async (doc) => { h.keeps = [doc]; h.keepsConfirmed = false; throw Error("offline"); });
    await expect(render().forMilestone(h.milestones[0]).onKeepQuote("More blue bus.")).rejects.toThrow("offline");
    expect(render().forMilestone(h.milestones[0]).savedWords).toBeNull();
    await render().forMilestone(h.milestones[0]).onKeepQuote("More blue bus.");
    expect(h.keep).toHaveBeenCalledTimes(2);
    expect(h.keep.mock.calls[1][0]).toEqual(h.keep.mock.calls[0][0]);
    expect(h.milestones[0]).toEqual(original);
  });

  it("reads and edits only the exact canonical parent record, retaining its provenance metadata", async () => {
    const canonical = { ...kept, source: "parent_voice", captureSource: "journal" };
    h.keeps = [canonical, { ...kept, id: "different-document", note: "Unrelated imported words", source: "ai_generated" } as KeepsakeDoc];
    const actions = render().forMilestone(original);
    expect(actions).toMatchObject({ savedWords: kept.note, savedAt: kept.updatedAt, inlineEvidenceAllowed: true });
    await actions.onKeepQuote("The parent's corrected words");
    expect(h.keep).toHaveBeenCalledWith(expect.objectContaining({ id: original.id, note: "The parent's corrected words", source: "parent_voice", captureSource: "journal", noticedOn: kept.noticedOn, photoUrl: kept.photoUrl }), { requireAcknowledgement: true });
  });

  it("requires the detail editor for foreign or invalid records occupying the canonical ID", async () => {
    h.milestones = [observeMilestoneDoc(original, "yes")];
    for (const changed of [{ source: "ai_generated" }, { contentSource: "generated" }, { kind: "quote" }, { milestoneId: "another-milestone" }, { note: "" }]) {
      h.keeps = [{ ...kept, ...changed } as KeepsakeDoc];
      const actions = render().forMilestone(original);
      expect(actions).toMatchObject({ savedWords: null, savedAt: null, inlineEvidenceAllowed: false });
      await expect(actions.onKeepQuote("Do not replace its source")).rejects.toThrow("observation details");
    }
    expect(h.keep).not.toHaveBeenCalled();
  });

  it("does not use a different document's matching milestone field as inline evidence or its edit base", async () => {
    h.milestones = [observeMilestoneDoc(original, "yes", { now: "2026-10-18T12:00:00.000Z" })];
    h.keeps = [{ ...kept, id: "different-document" }];
    const actions = render().forMilestone(original);
    expect(actions).toMatchObject({ savedWords: null, savedAt: null, inlineEvidenceAllowed: true });
    await actions.onKeepQuote("The exact record's own words");
    expect(h.keep).toHaveBeenCalledWith(expect.objectContaining({ id: original.id, note: "The exact record's own words", noticedOn: "2026-10-18", createdAt: "2026-10-18T12:00:00.000Z" }), { requireAcknowledgement: true });
    expect(h.keep.mock.calls[0][0]).not.toHaveProperty("photoUrl");
  });

  it("does not invent an exact day for approximate observations or overwrite evidence that has not loaded", async () => {
    for (const when of ["this_week", "earlier"] as const) {
      h.milestones = [observeMilestoneDoc(original, "yes", { when, now: "2026-09-01T12:00:00.000Z" })];
      await expect(render().forMilestone(h.milestones[0]).onKeepQuote("A remembered moment.")).rejects.toThrow("date");
    }
    expect(h.keep).not.toHaveBeenCalled();
    h.milestones = [observeMilestoneDoc(original, "yes", { now: "2026-09-01T12:00:00.000Z" })];
    await render().forMilestone(h.milestones[0]).onKeepQuote("A moment on that day.");
    expect(h.keeps[0].noticedOn).toBe("2026-09-01");
    h.keepsConfirmed = false;
    await expect(render().forMilestone(h.milestones[0]).onKeepQuote("Unreviewed replacement")).rejects.toThrow("syncing");
    expect(h.keep).toHaveBeenCalledOnce();
  });

  it.each(["child", "account", "unmount"] as const)("retires old callbacks and late acknowledgements on %s change", async boundary => {
    const write = deferred(); h.observe.mockReturnValue(write.promise);
    const old = render(), actions = old.forMilestone(h.milestones[0]);
    const pending = actions.onAnswer("yes");
    if (boundary === "child") { h.child = "child-b"; render(); }
    if (boundary === "account") { h.uid = "another-owner"; render(); }
    if (boundary === "unmount") unmount();
    const rejected = expect(pending).rejects.toThrow("no longer current");
    write.resolve(); await rejected;
    await expect(actions.onAnswer("yes")).rejects.toThrow("no longer current");
    expect(h.observe).toHaveBeenCalledOnce(); expect(old.isCurrent()).toBe(false);
  });

  it("exposes the current saved state and suppresses receipts for unconfirmed snapshots", () => {
    h.milestones = [observeMilestoneDoc(original, "not_sure")]; h.keeps = [structuredClone(kept)];
    expect(render().forMilestone(h.milestones[0])).toMatchObject({ scopeKey: "owner:child-a", selected: "not_sure", observedWhen: null, savedWords: kept.note, savedAt: kept.updatedAt, confirmed: true });
    h.confirmed = false; h.keepsConfirmed = false;
    expect(render().forMilestone(h.milestones[0])).toMatchObject({ confirmed: false, savedWords: null, savedAt: null });
  });

  it("resolves a held card's answer and exact date from the live canonical row", async () => {
    const held = structuredClone(original);
    await render().forMilestone(held).onAnswer("yes");
    expect(render().forMilestone(held)).toMatchObject({ selected: "yes", observedWhen: "today", observedAt: "2026-10-18T12:00:00.000Z", confirmed: true });
    h.milestones = [];
    expect(render().forMilestone(held)).toMatchObject({ selected: null, observedWhen: null, observedAt: null, confirmed: false });
  });

  it("explicitly removes only the answer, with acknowledged Undo and separate evidence intact", async () => {
    h.milestones = [observeMilestoneDoc(original, "yes", { source: "ai_proposed_parent_confirmed", provenance: "moment-id" })];
    const before = structuredClone(h.milestones[0]); h.keeps = [structuredClone(kept)];
    await render().clearAnswer(h.milestones[0]);
    expect(h.milestones[0]).toEqual(withoutNoticeAnswer(before));
    for (const field of ["observationStatus", "observationUpdatedAt", "observedAt", "observedWhen", "observationSource", "observationProvenance"]) expect(h.milestones[0]).not.toHaveProperty(field);
    expect(h.milestones[0].references).toEqual(original.references);
    await render().forMilestone(h.milestones[0]).onUndo!();
    expect(h.milestones[0]).toEqual(before); expect(h.keeps).toEqual([kept]); expect(h.remove).not.toHaveBeenCalled();
  });
});

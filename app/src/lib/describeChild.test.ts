/**
 * B-SHELL-39 — the pure half of "Tell Arbor about {name}": the commit plan
 * (the only shape a Keep can write), the profile projection, and the guided
 * conversation's session (one question at a time, ≤ 4 follow-ups, nothing
 * written before "Keep these", Undo back to the prior state).
 * Synthetic children only (the repository is public).
 */
import { describe, expect, it, vi } from "vitest";
import {
  DescribeSession,
  MAX_FOLLOW_UPS,
  keptAndDrafted,
  keptItemsFromProfile,
  mergeRows,
  planDescribeCommit,
  planKeptEdit,
  planKeptRemove,
  type DescribeCommitPlan,
  type DescribeDraft,
  type DescribeDraftInput,
  type DescribeReceipt,
  type ReadbackItem,
} from "./describeChild";
import type { ChildProfile } from "../types";

const NOW = new Date("2026-10-10T09:00:00.000Z");
const row = (over: Partial<ReadbackItem>): ReadbackItem => ({ id: "r", kind: "strength", text: "x", quote: "x", op: "add", keep: true, round: 0, ...over });
const base = (): Partial<ChildProfile> => ({ strengths: ["Kind to the cat"], challenges: [], interests: ["Trains"] });

describe("keptItemsFromProfile", () => {
  it("projects the plain arrays, the describe ledger and the new fields as the parent's words", () => {
    const items = keptItemsFromProfile({
      strengths: ["Funny"], interests: ["Blocks"], challenges: ["Mornings are hard"],
      describedItems: [{ id: "d1", kind: "worry", words: "mornings are hard", domainId: "body", since: "2026-10-10", source: "describe", confirmedAt: "x" }],
      focusAreas: [{ id: "f1", words: "Getting dressed", domainId: "body", since: "2026-10-10", source: "describe", confirmedAt: "x" }],
      parentPreferences: [{ id: "p1", words: "Keep it short", since: "2026-10-10", source: "describe", confirmedAt: "x" }],
    });
    expect(items.map((i) => [i.kind, i.words, i.source])).toEqual([
      ["strength", "Funny", "profile"], ["interest", "Blocks", "profile"], ["worry", "Mornings are hard", "describe"],
      ["focus", "Getting dressed", "describe"], ["preference", "Keep it short", "describe"],
    ]);
    expect(items.find((i) => i.kind === "worry")).toMatchObject({ id: "d1", domainId: "body" });
  });
});

describe("planDescribeCommit — the only shape a Keep writes", () => {
  it("each kind lands where it belongs; a worry keeps its domainId; every kept item carries source and confirmedAt", () => {
    const plan = planDescribeCommit(base(), [
      row({ id: "a", kind: "strength", text: "Funny" }),
      row({ id: "b", kind: "worry", text: "Mornings are hard", domainId: "body" }),
      row({ id: "c", kind: "focus", text: "Getting dressed", domainId: "body" }),
      row({ id: "d", kind: "preference", text: "Don't push reading" }),
      row({ id: "e", kind: "context", text: "Speaks Hebrew at home" }),
      row({ id: "f", kind: "milestone", text: "Rides the balance bike alone" }),
      row({ id: "g", kind: "milestone", text: "Walks", milestoneId: "cdc-12m-1" }),
      row({ id: "h", kind: "milestone", text: "Says mama", milestoneId: "cdc-12m-2", milestoneDeclined: true }),
      row({ id: "i", kind: "interest", text: "Dinosaurs", keep: false }),
    ], NOW);
    expect(plan.patch.strengths).toEqual(["Kind to the cat", "Funny"]);
    expect(plan.patch.challenges).toEqual(["Mornings are hard"]);
    expect(plan.patch.interests).toBeUndefined();
    expect(plan.patch.focusAreas).toEqual([expect.objectContaining({ words: "Getting dressed", domainId: "body", source: "describe", confirmedAt: NOW.toISOString(), since: "2026-10-10" })]);
    expect(plan.patch.parentPreferences).toEqual([expect.objectContaining({ words: "Don't push reading", source: "describe" })]);
    expect(plan.patch.describedItems).toEqual(expect.arrayContaining([expect.objectContaining({ kind: "worry", words: "Mornings are hard", domainId: "body", source: "describe", confirmedAt: NOW.toISOString() })]));
    expect(plan.memoryFacts).toEqual(["Speaks Hebrew at home", "Rides the balance bike alone", "Says mama"]);
    expect(plan.milestoneIds).toEqual(["cdc-12m-1"]);
    expect(plan.previous).toEqual({ strengths: ["Kind to the cat"], challenges: [], focusAreas: undefined, parentPreferences: undefined, describedItems: undefined });
    expect(plan.kept).toBe(8);
  });
  it("Focus holds 3 and preferences 8: the extra is not kept, and said so", () => {
    const rows = [1, 2, 3, 4].map((n) => row({ id: `f${n}`, kind: "focus", text: `Focus ${n}` }));
    const plan = planDescribeCommit({}, rows, NOW);
    expect(plan.patch.focusAreas).toHaveLength(3);
    expect(plan.overCap).toBe(1);
  });
  it("a replace swaps the kept words (keeping the area); a remove leaves zero residue", () => {
    const profile = { ...base(), challenges: ["Mornings are hard"], describedItems: [{ id: "w1", kind: "worry" as const, words: "Mornings are hard", domainId: "body" as const, since: "2026-10-09", source: "describe" as const, confirmedAt: "2026-10-09T00:00:00.000Z" }] };
    const replaced = planDescribeCommit(profile, [row({ kind: "worry", text: "Evenings are hard now", op: "replace", itemId: "w1" })], NOW);
    expect(replaced.patch.challenges).toEqual(["Evenings are hard now"]);
    expect(replaced.patch.describedItems).toEqual([expect.objectContaining({ words: "Evenings are hard now", domainId: "body" })]);
    const removed = planKeptRemove(profile, "w1", NOW)!;
    const after = { ...profile, ...removed.patch };
    expect(after.challenges).toEqual([]);
    expect(after.describedItems).toEqual([]);
    expect(JSON.stringify(after)).not.toContain("Mornings");
    expect(removed.previous).toEqual({ challenges: ["Mornings are hard"], describedItems: profile.describedItems });
  });
  it("a later Edit keeps the item's identity", () => {
    const profile = { focusAreas: [{ id: "f1", words: "Getting dressed", domainId: "body" as const, since: "2026-10-01", source: "describe" as const, confirmedAt: "2026-10-01T00:00:00.000Z" }] };
    const plan = planKeptEdit(profile, "f1", "Getting dressed without a fight", NOW)!;
    expect(plan.patch.focusAreas).toEqual([expect.objectContaining({ id: "f1", words: "Getting dressed without a fight", domainId: "body" })]);
  });
});

describe("mergeRows / keptAndDrafted — the conversation's items so far", () => {
  it("a later answer replaces or removes a row drafted earlier, in place; a repeat is dropped", () => {
    const first = [row({ id: "r0-i0", kind: "interest", text: "Trains" }), row({ id: "r0-i1", kind: "worry", text: "Bedtime" })];
    const merged = mergeRows(first, [
      row({ id: "r1-i0", kind: "interest", text: "Dinosaurs now", op: "replace", itemId: "r0-i0", round: 1 }),
      row({ id: "r1-i1", kind: "worry", text: "x", op: "remove", itemId: "r0-i1", round: 1 }),
      row({ id: "r1-i2", kind: "interest", text: "Dinosaurs now", round: 1 }),
    ]);
    expect(merged.map((r) => [r.id, r.text, r.op])).toEqual([["r0-i0", "Dinosaurs now", "add"]]);
    expect(keptAndDrafted({ strengths: ["Funny"] }, merged).map((k) => [k.id.startsWith("strength:") ? "strength:*" : k.id, k.words])).toEqual([["strength:*", "Funny"], ["r0-i0", "Dinosaurs now"]]);
  });
});

function services(replies: Array<DescribeDraft | Error>, profile: Partial<ChildProfile> = base()) {
  const state = { profile: { ...profile } as Partial<ChildProfile> };
  const draft = vi.fn(async (_input: DescribeDraftInput): Promise<DescribeDraft> => { const next = replies.shift(); if (!next) throw new Error("no reply"); if (next instanceof Error) throw next; return next; });
  const commit = vi.fn(async (plan: DescribeCommitPlan): Promise<DescribeReceipt> => { state.profile = { ...state.profile, ...plan.patch }; return { plan, memoryIds: [], milestonesBefore: [] }; });
  const undo = vi.fn(async (receipt: DescribeReceipt): Promise<void> => { state.profile = { ...state.profile, ...receipt.plan.previous }; });
  const svc = { now: () => NOW, profile: () => state.profile, draft, commit, undo };
  return { svc, state };
}
const item = (text: string, kind: ReadbackItem["kind"] = "strength") => ({ id: "i0", kind, text, quote: text, op: "add" as const });

describe("DescribeSession — one guided conversation", () => {
  it("one question at a time; each request carries the question it answers, the ones asked and every item so far", async () => {
    const { svc } = services([
      { items: [item("Funny")], nextQuestion: "What makes her laugh?" },
      { items: [item("Silly songs", "interest")], nextQuestion: null },
    ]);
    const s = new DescribeSession(svc);
    expect(await s.start("She is funny.", "Tell me about Noa")).toBe("asking");
    expect(s.snapshot().thread.map((t) => [t.question, t.status])).toEqual([["Tell me about Noa", "answered"], ["What makes her laugh?", "open"]]);
    expect(await s.answer("Silly songs at bath time.")).toBe("ready");
    expect(svc.draft.mock.calls[1][0]).toMatchObject({ text: "Silly songs at bath time.", question: "What makes her laugh?", askedQuestions: ["What makes her laugh?"] });
    expect(svc.draft.mock.calls[1][0].keptItems.map((k: { words: string }) => k.words)).toEqual(["Kind to the cat", "Trains", "Funny"]);
    expect(s.snapshot().items.map((i) => i.text)).toEqual(["Funny", "Silly songs"]);
    expect(svc.commit).not.toHaveBeenCalled();
  });
  it(`stops after ${MAX_FOLLOW_UPS} follow-ups even if a question keeps coming`, async () => {
    const replies = Array.from({ length: 8 }, (_, n) => ({ items: [item(`Thing ${n}`)], nextQuestion: `Question ${n}?` }));
    const { svc } = services(replies);
    const s = new DescribeSession(svc);
    await s.start("Opening words.");
    let answered = 0;
    while (s.snapshot().status === "asking") { await s.answer(`Answer ${answered}`); answered++; }
    expect(answered).toBe(MAX_FOLLOW_UPS);
    expect(s.snapshot().thread).toHaveLength(MAX_FOLLOW_UPS + 1);
    expect(s.snapshot().status).toBe("ready");
  });
  it("Skip and Done on an open question go to the readback with no further request", async () => {
    for (const end of ["skip", "done"] as const) {
      const { svc } = services([{ items: [item("Funny")], nextQuestion: "What makes her laugh?" }]);
      const s = new DescribeSession(svc);
      await s.start("She is funny.");
      s[end]();
      expect(s.snapshot().status).toBe("ready");
      expect(s.snapshot().thread[1].status).toBe("skipped");
      expect(svc.draft).toHaveBeenCalledOnce();
    }
  });
  it("crisis words make no request; a failed opening is 'failed' (the caller keeps today's path)", async () => {
    const { svc } = services([new Error("504")]);
    const s = new DescribeSession(svc);
    expect(await s.start("Some nights I want to hurt myself.")).toBe("crisis");
    expect(svc.draft).not.toHaveBeenCalled();
    expect(await s.start("She is funny.")).toBe("failed");
    expect(s.snapshot()).toMatchObject({ status: "failed", error: "model", items: [] });
  });
  it("a failed follow-up keeps the question open and every item so far", async () => {
    const { svc } = services([{ items: [item("Funny")], nextQuestion: "What makes her laugh?" }, new Error("timeout")]);
    const s = new DescribeSession(svc);
    await s.start("She is funny.");
    expect(await s.answer("Songs.")).toBe("failed");
    expect(s.snapshot()).toMatchObject({ status: "asking", error: "followUp" });
    expect(s.snapshot().items.map((i) => i.text)).toEqual(["Funny"]);
    expect(s.snapshot().thread[1].status).toBe("open");
  });
  it("nothing is written before Keep these; Undo restores the prior child doc exactly", async () => {
    const before = { strengths: ["Kind to the cat"], challenges: [], interests: ["Trains"] };
    const { svc, state } = services([{ items: [item("Funny"), item("Getting dressed", "focus")], nextQuestion: null }], before);
    const s = new DescribeSession(svc);
    expect(await s.start("She is funny. Getting dressed is the focus.")).toBe("ready");
    s.toggle(s.snapshot().items[0].id);
    expect(svc.commit).not.toHaveBeenCalled();
    expect(await s.keep()).toBe(true);
    expect(state.profile.strengths).toEqual(["Kind to the cat"]);
    expect(state.profile.focusAreas).toHaveLength(1);
    expect(await s.undo()).toBe(true);
    expect(JSON.parse(JSON.stringify(state.profile))).toEqual(before);
  });
});

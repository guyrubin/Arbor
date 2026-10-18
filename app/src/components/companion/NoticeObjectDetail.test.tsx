import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FirstKeepsake, KeepsakeDraft } from "../../lib/firstsKeepsake";
import type { NoticeCardProps } from "../loop/NoticeCard";
import type { ChildProfile, Milestone } from "../../types";

const h = vi.hoisted(() => ({
  profile: { id: "child-a", name: "Noa", age: 3, gender: "girl" } as ChildProfile,
  milestones: [] as Milestone[], lang: "en" as "en" | "he",
  uid: "account-a", confirmed: true,
  collection: { items: [] as unknown[], loaded: true, confirmed: true, error: false, remote: false, isCurrent: vi.fn(() => true), upsert: vi.fn(async (_doc: unknown, _options?: unknown) => {}), remove: vi.fn(async (_id: string, _options?: unknown) => {}) },
  linked: [] as unknown[], linkedCurrent: true,
  answer: vi.fn(async () => {}), clear: vi.fn(async () => {}), undo: vi.fn(async () => {}),
  close: vi.fn(), capture: vi.fn(), journal: vi.fn(), tab: vi.fn(), talk: vi.fn(), care: vi.fn(), moment: vi.fn(),
  notice: null as NoticeCardProps | null,
  editor: null as { keepsake: FirstKeepsake | null; initialNoticedOn: string; onSave: (draft: KeepsakeDraft) => Promise<void>; onRemove: () => Promise<void>; onClose: () => void } | null,
  buttons: [] as { onClick?: () => void; "data-testid"?: string; children?: unknown }[],
  hooks: [] as unknown[], cursor: 0,
}));
vi.mock("react", async original => {
  const actual = await original<typeof import("react")>();
  return { ...actual,
    useState: (initial: unknown) => {
      const index = h.cursor++;
      if (!(index in h.hooks)) h.hooks[index] = typeof initial === "function" ? initial() : initial;
      return [h.hooks[index], (value: unknown) => { h.hooks[index] = typeof value === "function" ? value(h.hooks[index]) : value; }];
    },
    useRef: (initial: unknown) => {
      const index = h.cursor++;
      if (!(index in h.hooks)) h.hooks[index] = { current: initial };
      return h.hooks[index];
    },
  };
});
vi.mock("../../context/ArborContext", () => ({ useArbor: () => ({
  childProfile: h.profile, milestones: h.milestones, actionLoop: [], openCaptureSheet: h.capture, requestJournalFocus: h.journal, setActiveTab: h.tab,
}) }));
vi.mock("../../context/LanguageContext", async () => {
  const { translate } = await vi.importActual<typeof import("../../lib/i18n")>("../../lib/i18n");
  return { useLanguage: () => ({ uiLang: h.lang, t: (key: string, vars?: Record<string, string | number>) => translate(h.lang, key, vars) }) };
});
vi.mock("../../hooks/useNoticeActions", () => ({ useNoticeActions: () => ({
  scopeKey: `${h.uid}:${h.profile.id}`, keepsakes: h.collection, clearAnswer: h.clear, confirmed: h.confirmed,
  forMilestone: (milestone: Milestone) => ({ scopeKey: h.profile.id, selected: milestone.observationStatus ?? (milestone.checked ? "yes" : null), confirmed: h.confirmed, onAnswer: h.answer, onUndo: h.undo }),
}) }));
vi.mock("../../hooks/useChildCollection", () => ({ useChildCollection: () => ({ items: h.linked, loaded: true, confirmed: h.linkedCurrent, error: !h.linkedCurrent, isCurrent: () => h.linkedCurrent }) }));
vi.mock("../../lib/noticeHandoff", () => ({ openNoticeTalk: h.talk, openNoticeCare: h.care }));
vi.mock("../../lib/noticeNavigation", () => ({ openNoticeMoment: h.moment }));
vi.mock("../../lib/journal/shelfView", () => ({ shelfPractice: () => null, practiceTryTitle: () => "" }));
vi.mock("../ui/Sheet", () => ({ useCompactSurface: () => false, Sheet: ({ children, open }: { children: React.ReactNode; open: boolean }) => open ? <div>{children}</div> : null }));
vi.mock("../ui/Modal", () => ({ Modal: ({ children, open }: { children: React.ReactNode; open: boolean }) => open ? <div>{children}</div> : null }));
vi.mock("../loop/NoticeCard", () => ({ default: (props: NoticeCardProps) => { h.notice = props; return <div data-notice-selected={props.selected ?? "none"}>{props.milestone.title}</div>; } }));
vi.mock("../milestones/FirstKeepsakeSheet", () => ({ default: (props: NonNullable<typeof h.editor>) => { h.editor = props; return <div data-testid="evidence-editor" />; } }));
const capture = vi.hoisted(() => (type: unknown, props: unknown) => { if (type === "button" && props && typeof props === "object") h.buttons.push(props as typeof h.buttons[number]); });
vi.mock("react/jsx-runtime", async original => {
  const runtime = await original<typeof import("react/jsx-runtime")>();
  return { ...runtime, jsx: (...args: Parameters<typeof runtime.jsx>) => { capture(args[0], args[1]); return runtime.jsx(...args); }, jsxs: (...args: Parameters<typeof runtime.jsxs>) => { capture(args[0], args[1]); return runtime.jsxs(...args); } };
});
vi.mock("react/jsx-dev-runtime", async original => {
  const runtime = await original<typeof import("react/jsx-dev-runtime")>();
  return { ...runtime, jsxDEV: (...args: Parameters<typeof runtime.jsxDEV>) => { capture(args[0], args[1]); return runtime.jsxDEV(...args); } };
});
import NoticeObjectDetail from "./NoticeObjectDetail";
import { ALL_MILESTONES } from "../../lib/milestoneData";

const row = () => ({ ...ALL_MILESTONES.find((m) => m.domain === "language_communication" && m.ageMonths === 36)!, observationStatus: "not_yet" as const, checked: false, observationUpdatedAt: "2026-10-01T10:00:00Z" });
const render = (editEvidence = false, childId = "child-a") => {
  h.cursor = 0; h.notice = null; h.editor = null; h.buttons = [];
  return renderToStaticMarkup(<NoticeObjectDetail target={{ childId, milestoneId: h.milestones[0].id }} onClose={h.close} editEvidence={editEvidence} />);
};
beforeEach(() => {
  vi.clearAllMocks(); h.hooks = []; h.cursor = 0; h.lang = "en";
  h.uid = "account-a"; h.confirmed = true;
  h.profile = { id: "child-a", name: "Noa", age: 3, gender: "girl" } as ChildProfile;
  h.milestones = [row()]; h.collection.items = []; h.collection.loaded = true; h.collection.confirmed = true; h.collection.error = false;
  h.collection.isCurrent.mockReturnValue(true); h.linked = []; h.linkedCurrent = true;
});

describe("One current observation detail", () => {
  it.each(["yes", "not_yet", "not_sure"] as const)("reopens the exact persisted %s response without writing or interpreting it", status => {
    h.milestones[0] = { ...row(), observationStatus: status, checked: status === "yes" };
    const html = render();
    expect(h.notice?.selected).toBe(status);
    expect(html).toContain(`data-observation-id="milestones:${row().id}"`);
    expect(h.answer).not.toHaveBeenCalled(); expect(h.talk).not.toHaveBeenCalled(); expect(h.care).not.toHaveBeenCalled();
    if (status !== "yes") { expect(html).not.toContain("Open in Journal"); expect(html).not.toContain("Open in Moments"); }
  });

  it("keeps an authentic note/photo independently of a Not yet answer", async () => {
    h.collection.items = [{ id: row().id, milestoneId: row().id, note: "Reached for the blue cup", noticedOn: "2026-09-12", createdAt: "2026-09-12", updatedAt: "2026-09-12", photoUrl: "https://storage.test/child-a/photo.jpg" }];
    const html = render();
    expect(html).toContain("Reached for the blue cup"); expect(html).toContain("https://storage.test/child-a/photo.jpg");
    expect(html).toContain('<time dateTime="2026-09-12">Sep 12, 2026</time>');
    expect(html).toContain("Open in Moments"); expect(html).not.toContain("Open in Journal");
    h.buttons.find((button) => button["data-testid"] === "notice-object-remove-answer")!.onClick!();
    await Promise.resolve();
    expect(h.clear).toHaveBeenCalledWith(h.milestones[0]); expect(h.collection.remove).not.toHaveBeenCalled();
  });

  it("keeps removal retry accessible after an optimistic clear and restores only the answer on Undo", async () => {
    render();
    h.clear.mockRejectedValueOnce(new Error("The write was not confirmed; please retry"));
    h.buttons.find((button) => button["data-testid"] === "notice-object-remove-answer")!.onClick!();
    await Promise.resolve(); await Promise.resolve();
    h.milestones[0] = { ...row(), observationStatus: undefined, checked: false };
    h.confirmed = false;
    expect(render()).not.toContain("Answer removed.");
    h.buttons.find((button) => button["data-testid"] === "notice-object-remove-answer")!.onClick!();
    await Promise.resolve(); await Promise.resolve();
    h.confirmed = true;
    expect(render()).toContain("Answer removed.");
    h.buttons.find((button) => button["data-testid"] === "notice-object-undo-remove")!.onClick!();
    await Promise.resolve();
    expect(h.undo).toHaveBeenCalledOnce();
    expect(h.collection.upsert).not.toHaveBeenCalled(); expect(h.collection.remove).not.toHaveBeenCalled();
  });

  it("keeps the same editor and words through an unconfirmed snapshot, with same-id retry", async () => {
    const saved = { id: row().id, milestoneId: row().id, note: "First words", noticedOn: "2026-09-12", createdAt: "2026-09-12", updatedAt: "2026-09-12" };
    h.collection.items = [saved]; render(true);
    const draft = { milestoneId: row().id, note: "The words we wrote", noticedOn: "2026-09-12" };
    h.collection.upsert.mockRejectedValueOnce(new Error("The write was not confirmed; please retry"));
    await expect(h.editor!.onSave(draft)).rejects.toThrow("not confirmed");
    h.collection.confirmed = false; h.collection.isCurrent.mockReturnValue(false);
    const html = render(true);
    expect(html).toContain('data-testid="evidence-editor"'); expect(h.editor?.keepsake).toMatchObject({ note: saved.note, milestoneId: saved.milestoneId, noticedOn: saved.noticedOn });
    await h.editor!.onSave(draft);
    expect(h.collection.upsert).toHaveBeenCalledTimes(2);
    expect(h.collection.upsert.mock.calls[1][0]).toMatchObject({ id: row().id, note: draft.note, createdAt: saved.createdAt });
    expect(h.collection.upsert.mock.calls[1][1]).toEqual({ requireAcknowledgement: true });
  });

  it("never turns an approximate observation into an invented exact date", () => {
    h.milestones[0] = { ...row(), observationStatus: "yes", checked: true, observedWhen: "earlier", observedAt: "2026-10-01T10:00:00Z" };
    render(true);
    expect(h.editor?.initialNoticedOn).toBe("");
  });

  it("never presents an unconfirmed answer or linked source as a stored record", () => {
    h.milestones[0] = { ...row(), observationStatus: "yes", checked: true, observationProvenance: "original-a", observationSource: "ai_proposed_parent_confirmed" };
    h.linked = [{ id: "original-a", trigger: "Old linked words", timestamp: "2026-09-12" }];
    h.confirmed = false;
    const html = render();
    expect(h.notice?.confirmed).toBe(false);
    expect(html).toContain("Waiting for the saved response to be confirmed");
    expect(html).not.toContain("Old linked words");
    expect(html).not.toContain("Parent-confirmed from a moment");
    expect(html).not.toContain("Open in Moments"); expect(html).not.toContain("Open in Journal");
    expect(h.notice?.onDetails).toBeUndefined(); expect(h.notice?.onOpen).toBeUndefined();
  });

  it("retains imported attachment provenance without relabelling it as the parent's words", async () => {
    h.collection.items = [{ id: row().id, milestoneId: row().id, note: "Imported words", noticedOn: "2026-09-12", createdAt: "2026-09-12", updatedAt: "2026-09-12", contentSource: "ai_draft" }];
    const html = render(true);
    expect(html).toContain("Attached words"); expect(html).toContain("From another source");
    expect(html).not.toContain("Open in Moments");
    await h.editor!.onSave({ milestoneId: row().id, note: "Edited attachment", noticedOn: "2026-09-12" });
    expect(h.collection.upsert).toHaveBeenCalledWith(expect.objectContaining({ contentSource: "ai_draft" }), { requireAcknowledgement: true });
  });

  it("continues with exact IDs only and retires held handoffs on an account change", () => {
    render();
    const talk = h.buttons.find((button) => button["data-testid"] === "notice-object-talk")!.onClick!;
    const care = h.buttons.find((button) => button["data-testid"] === "notice-object-care")!.onClick!;
    talk(); care();
    expect(h.talk).toHaveBeenCalledWith("child-a", row().id);
    expect(h.care).toHaveBeenCalledWith("child-a", row().id);
    expect(h.close).toHaveBeenCalledOnce();
    expect(h.close.mock.invocationCallOrder[0]).toBeLessThan(h.talk.mock.invocationCallOrder[0]);
    h.talk.mockClear(); h.care.mockClear();
    h.uid = "account-b"; render();
    talk(); care();
    expect(h.talk).not.toHaveBeenCalled(); expect(h.care).not.toHaveBeenCalled();
  });

  it("hides a revoked linked source and cannot open its cached original", () => {
    h.milestones[0] = { ...row(), observationStatus: "yes", checked: true, observationProvenance: "original-a", observationSource: "ai_proposed_parent_confirmed" };
    h.linked = [{ id: "original-a", trigger: "The parent's original", timestamp: "2026-09-12" }];
    expect(render()).toContain("The parent&#x27;s original");
    h.linkedCurrent = false;
    const html = render();
    expect(html).not.toContain("The parent&#x27;s original"); expect(html).toContain("no longer available");
  });

  it("retires a held evidence callback immediately when the child changes", async () => {
    render(true);
    const oldSave = h.editor!.onSave;
    h.profile = { ...h.profile, id: "child-b" };
    expect(render()).not.toContain('data-testid="notice-object-detail"');
    await expect(oldSave({ milestoneId: row().id, note: "Old child", noticedOn: "2026-09-12" })).rejects.toThrow("source changed");
    expect(h.collection.upsert).not.toHaveBeenCalled();
  });
});

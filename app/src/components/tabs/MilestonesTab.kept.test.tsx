import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Milestone } from "../../types";
import type { KeepsakeDoc, KeepsakeDraft } from "../../lib/firstsKeepsake";
import { translate } from "../../lib/i18n";
import { ALL_MILESTONES } from "../../lib/milestoneData";

const h = vi.hoisted(() => ({
  lang: "en" as "en" | "he", child: "child-a", uid: "account-a", query: "Three", cursor: 0, slots: [] as unknown[],
  milestones: [] as Milestone[], notes: [] as KeepsakeDoc[], current: true, error: false, loading: false, confirmed: true, more: false,
  reload: vi.fn(), loadMore: vi.fn(), upsert: vi.fn(async () => {}), remove: vi.fn(async () => {}),
  buttons: [] as { "data-testid"?: string; onClick?: () => void; disabled?: boolean }[],
  editor: null as null | { open: boolean; childId: string; milestoneId: string; keepsake: KeepsakeDoc; canShare: boolean; beforeShare: () => boolean; onSave: (draft: KeepsakeDraft) => void; onRemove: () => void },
}));
vi.mock("react", async original => ({ ...await original<typeof import("react")>(), useState: (initial: unknown) => {
  const index = h.cursor++;
  if (!(index in h.slots)) h.slots[index] = initial === "" ? h.query : typeof initial === "function" ? initial() : initial;
  return [h.slots[index], (next: unknown) => { h.slots[index] = typeof next === "function" ? next(h.slots[index]) : next; }];
} }));
vi.mock("../../context/ArborContext", () => ({ useArbor: () => ({ childProfile: { id: h.child, name: "Noa Example", gender: "girl", birthDate: "2022-01-01" }, milestones: h.milestones, behaviorLogs: [], setActiveTab: vi.fn() }) }));
vi.mock("../../context/AuthContext", () => ({ useAuth: () => ({ user: { uid: h.uid } }) }));
vi.mock("../../context/LanguageContext", () => ({ useLanguage: () => ({ uiLang: h.lang, t: (key: string, vars?: Record<string, string | number>) => translate(h.lang, key, vars) }) }));
vi.mock("../../hooks/useObservations", () => ({ useObservations: () => [] }));
vi.mock("../../hooks/useChildCollection", () => ({ useChildCollection: () => ({ items: h.notes, loaded: true, error: false, remote: true, upsert: h.upsert, remove: h.remove }) }));
vi.mock("../../hooks/useChildHistory", () => ({ useChildHistory: (child: string, name: string) => {
  const scope = `${h.uid}:${child}`;
  return { items: name === "milestones" ? h.milestones : h.notes, loading: h.loading, error: h.error, confirmed: h.confirmed, more: h.more,
    reload: h.reload, loadMore: h.loadMore, isCurrent: () => h.current && scope === `${h.uid}:${h.child}` };
} }));
vi.mock("../overview/PrideMomentCard", () => ({ default: () => null }));
vi.mock("../ui/HeroAvatar", () => ({ HeroAvatar: () => null }));
vi.mock("../milestones/FirstKeepsakeSheet", () => ({ default: (props: NonNullable<typeof h.editor>) => { h.editor = props; return props.open ? <div data-testid="editor-open">{props.keepsake?.note}</div> : null; } }));
vi.mock("../share/SendSheet", () => ({ SendSheet: () => null }));
const capture = vi.hoisted(() => (type: unknown, props: unknown) => { if (type === "button") h.buttons.push(props as typeof h.buttons[number]); });
vi.mock("react/jsx-runtime", async original => {
  const runtime = await original<typeof import("react/jsx-runtime")>();
  return { ...runtime, jsx: (...a: Parameters<typeof runtime.jsx>) => { capture(a[0], a[1]); return runtime.jsx(...a); }, jsxs: (...a: Parameters<typeof runtime.jsxs>) => { capture(a[0], a[1]); return runtime.jsxs(...a); } };
});
vi.mock("react/jsx-dev-runtime", async original => {
  const runtime = await original<typeof import("react/jsx-dev-runtime")>();
  return { ...runtime, jsxDEV: (...a: Parameters<typeof runtime.jsxDEV>) => { capture(a[0], a[1]); return runtime.jsxDEV(...a); } };
});
import MilestonesTab from "./MilestonesTab";

const render = () => { h.cursor = 0; h.buttons = []; return renderToStaticMarkup(<MilestonesTab />); };
const make = (id: string, patch: Record<string, unknown> = {}): Milestone => ({ id, title: `Three steps ${id}`, checked: true, observationStatus: "yes", observationUpdatedAt: "2026-10-04", domain: "sensory_motor_patterns", ageMonths: 36, ...patch }) as Milestone;
const note = (row: Milestone): KeepsakeDoc => ({ id: row.id, milestoneId: row.id, note: `Own words ${row.id}`, noticedOn: "2026-10-04", createdAt: "2026-10-04", updatedAt: "2026-10-04", photoUrl: `photo-${row.id}` });
beforeEach(() => {
  vi.clearAllMocks(); h.lang = "en"; h.child = "child-a"; h.uid = "account-a"; h.query = "Three"; h.cursor = 0; h.slots = []; h.current = true; h.error = false; h.loading = false; h.confirmed = true; h.more = false;
  h.milestones = [make("custom", { custom: true }), make("catalogue"), make("later", { ageMonths: 96 })]; h.notes = h.milestones.map(note);
});

describe("Milestones live saved-note paths", () => {
  for (const lang of ["en", "he"] as const) it(`${lang}: actual tab renders shared custom, catalogue and later notes with original photo/edit paths`, () => {
    h.lang = lang; const html = render();
    expect(html.match(/data-testid="kept-item"/g)).toHaveLength(3);
    for (const row of h.notes) { expect(html).toContain(row.note); expect(html).toContain(`src="${row.photoUrl}"`); }
    expect(h.buttons.filter(button => button["data-testid"] === "ms-keepsake-edit")).toHaveLength(3);
    h.buttons.find(button => button["data-testid"] === "ms-keepsake-edit")!.onClick!();
    render(); expect(h.editor).toMatchObject({ open: true, childId: "child-a", milestoneId: "custom", canShare: true });
    expect(h.editor!.beforeShare()).toBe(true);
    h.editor!.onSave({ milestoneId: "custom", note: "Edited parent text", noticedOn: "2026-10-04", photoUrl: "photo-custom" });
    expect(h.upsert).toHaveBeenCalledWith(expect.objectContaining({ id: "custom", note: "Edited parent text", photoUrl: "photo-custom" }));
    h.editor!.onRemove(); expect(h.remove).toHaveBeenCalledWith("custom");
  });

  for (const lang of ["en", "he"] as const) it(`${lang}: a genuine CDC catalogue first retains its citation and parent-kept note`, () => {
    h.lang = lang;
    const catalogue = ALL_MILESTONES.find(row => row.source?.org === "CDC")!;
    expect(catalogue.source).toBeTruthy();
    h.milestones = [{ ...catalogue, checked: true, observationStatus: "yes", observedAt: "2026-10-04" }];
    h.notes = h.milestones.map(note); h.query = catalogue.title;
    const html = render();
    expect(html).toContain('data-testid="kept-item"'); expect(html).toContain(h.notes[0].note);
    expect(h.milestones[0].source).toEqual(catalogue.source);
  });

  for (const lang of ["en", "he"] as const) it(`${lang}: never promotes the capture AI quote fixture into the Milestones headline`, () => {
    h.lang = lang;
    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
    h.notes = [...h.notes,
      { ...note(make("safe-quote")), milestoneId: "", kind: "quote", note: "A genuine child quote kept by the parent", noticedOn: yesterday },
      { ...note(make("capture-ai-quote")), milestoneId: "", kind: "quote", note: "CAPTURE AI QUOTE MUST STAY OUT", noticedOn: today, source: "ai_proposed_parent_confirmed" } as KeepsakeDoc,
    ];
    const html = render();
    expect(html).not.toContain("CAPTURE AI QUOTE MUST STAY OUT");
    expect(html).toContain("A genuine child quote kept by the parent");
    expect(html).toContain('data-testid="ms-header-quote"');
  });

  it("uses the saved-note row beside the held current Notice card as well", () => {
    // An unchecked suggestion remains on the shelf, so its saved note is still
    // editable but must not be promoted to a parent-seen kept first.
    h.query = ""; h.milestones = [make("current", { checked: false, observationStatus: "not_sure", ageMonths: 48 })]; h.notes = h.milestones.map(note);
    const html = render();
    expect(html).toContain('data-testid="notice-card"');
    expect(html).toContain('data-testid="ms-keepsake-unverified"');
    expect(html).not.toContain('data-testid="kept-item"');
  });

  it("does not turn AI/uncertain saved notes into parent-attributed Send rows", () => {
    h.milestones[1] = make("catalogue", { observationSource: "ai_proposed_parent_confirmed" });
    h.milestones[2] = make("later", { observationStatus: "not_sure", ageMonths: 96 });
    const html = render();
    expect(html.match(/data-testid="kept-item"/g)).toHaveLength(1);
    expect(html.match(/data-testid="ms-keepsake-unverified"/g)).toHaveLength(2);
    expect(h.buttons.filter(button => button["data-testid"] === "ms-keepsake-edit")).toHaveLength(3);
  });

  it("passes no editor-export eligibility for a corrected or unverified selected note", () => {
    h.milestones = [make("custom", { custom: true, observationStatus: "not_sure" })]; h.notes = h.milestones.map(note);
    render(); h.buttons.find(button => button["data-testid"] === "ms-keepsake-edit")!.onClick!(); render();
    expect(h.editor).toMatchObject({ open: true, canShare: false });
  });

  it("preserves notes through incomplete and failed reads while blocking export and exposing retry", () => {
    h.error = true; h.more = true; const html = render();
    expect(html).toContain(translate("en", "kept.error")); expect(html).toContain(translate("en", "kept.notesPending"));
    expect(h.buttons.filter(button => button["data-testid"] === "kept-item-send").every(button => button.disabled)).toBe(true);
    expect(html.match(/data-testid="ms-keepsake-edit"/g)).toHaveLength(3);
  });

  it("retires editor selection on A to B to A while allowing a fresh explicit reopen", () => {
    render(); h.buttons.find(button => button["data-testid"] === "ms-keepsake-edit")!.onClick!(); render(); expect(h.editor?.open).toBe(true);
    h.child = "child-b"; render(); expect(h.editor?.open).toBe(false);
    h.child = "child-a"; render(); expect(h.editor?.open).toBe(false);
    h.buttons.find(button => button["data-testid"] === "ms-keepsake-edit")!.onClick!(); render(); expect(h.editor?.open).toBe(true);
    h.uid = "account-b"; render(); h.uid = "account-a"; render(); expect(h.editor?.open).toBe(false);
  });

  it("closes a saved-note editor synchronously on child or account change", () => {
    render(); h.buttons.find(button => button["data-testid"] === "ms-keepsake-edit")!.onClick!(); render(); expect(h.editor?.open).toBe(true);
    h.child = "child-b"; h.notes = []; render(); expect(h.editor?.open).toBe(false);
    h.child = "child-a"; h.uid = "account-b"; render(); expect(h.editor?.open).toBe(false);
  });
});

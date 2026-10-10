import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { translate } from "../../lib/i18n";
import type { MilestoneKeptHistory } from "../../hooks/useMilestoneKeptNotes";

const h = vi.hoisted(() => ({ lang: "en" as "en" | "he", buttons: [] as { children?: unknown; onClick?: () => void; disabled?: boolean; "data-testid"?: string }[] }));
vi.mock("../../context/LanguageContext", () => ({ useLanguage: () => ({ uiLang: h.lang, t: (key: string, vars?: Record<string, string | number>) => translate(h.lang, key, vars) }) }));
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
import MilestoneKeptNote, { MilestoneKeptStatus } from "./MilestoneKeptNote";

const note = { milestoneId: "first", note: "Three steps to me", noticedOn: "2026-10-04", createdAt: "2026-10-04", updatedAt: "2026-10-04", photoUrl: "test-saved-photo" };
const item = { id: "milestones:first", kind: "first" as const, keepsakeId: "first", text: note.note, at: note.noticedOn, attribution: "parent" as const };
const onEdit = vi.fn();
const beforeExport = vi.fn(() => true);
const history = (patch: Partial<MilestoneKeptHistory> = {}): MilestoneKeptHistory => ({ scope: "a:child-a", rows: new Map(), loading: false, error: false, confirmed: true, disabled: false, more: false, changed: false, beforeExport, reload: vi.fn(), loadMore: vi.fn(), ...patch });
const render = (eligible = true, disabled = false) => { h.buttons = []; return renderToStaticMarkup(<MilestoneKeptNote note={note} item={eligible ? item : undefined} childName="Noa" scope="a:child-a" disabled={disabled} beforeExport={beforeExport} onEdit={onEdit} />); };
beforeEach(() => { vi.clearAllMocks(); h.lang = "en"; h.buttons = []; });

describe("shared milestone row preserves the existing editor and optional photo", () => {
  for (const lang of ["en", "he"] as const) it(`${lang}: renders the actual shared row with date, bidi words, attribution and guarded Send`, () => {
    h.lang = lang;
    const html = render();
    expect(html).toContain('data-testid="kept-item"'); expect(html).toContain('dateTime="2026-10-04"');
    expect(html).toContain('<bdi dir="auto" lang="und">Three steps to me</bdi>');
    expect(html).toContain(translate(lang, "kept.noted"));
    expect(html).toContain('src="test-saved-photo"');
    h.buttons.find(button => button["data-testid"] === "ms-keepsake-edit")!.onClick!();
    expect(onEdit).toHaveBeenCalledOnce();
    h.buttons.find(button => button["data-testid"] === "kept-item-send")!.onClick!();
    expect(beforeExport).toHaveBeenCalledOnce();
  });

  it("retains unverified/ineligible note text, date, photo and Edit without parent attribution or Send", () => {
    const html = render(false);
    expect(html).toContain('data-testid="ms-keepsake-unverified"'); expect(html).toContain(note.note); expect(html).toContain('src="test-saved-photo"');
    expect(html).not.toContain('data-testid="kept-item"'); expect(html).not.toContain(translate("en", "kept.noted"));
    expect(h.buttons.map(button => button["data-testid"])).toEqual(["ms-keepsake-edit"]);
    h.buttons[0].onClick!(); expect(onEdit).toHaveBeenCalledOnce(); expect(beforeExport).not.toHaveBeenCalled();
  });

  it("disables only export during unconfirmed loading, leaving the note editor usable", () => {
    render(true, true);
    expect(h.buttons.find(button => button["data-testid"] === "kept-item-send")!.disabled).toBe(true);
    expect(h.buttons.find(button => button["data-testid"] === "ms-keepsake-edit")!.disabled).not.toBe(true);
  });

  it("remounts a review when child/account or note text/date/source identity changes", () => {
    const row = (scope: string, text = note.note, childName = "Noa") => MilestoneKeptNote({ note, item: { ...item, text }, childName, scope, disabled: false, beforeExport, onEdit });
    const key = (value: React.ReactElement) => (value.props as { children: React.ReactElement[] }).children[0].key;
    expect(key(row("a:child-a"))).not.toBe(key(row("a:child-b")));
    expect(key(row("a:child-a"))).not.toBe(key(row("b:child-a")));
    expect(key(row("a:child-a"))).not.toBe(key(row("a:child-a", "Changed words")));
    expect(key(row("a:child-a"))).not.toBe(key(row("a:child-a", note.note, "New name")));
  });

  for (const lang of ["en", "he"] as const) it(`${lang}: exposes truthful loading/error/cache/incomplete states and retry/paging`, () => {
    h.lang = lang;
    for (const [patch, text] of [[{ loading: true }, "kept.loading"], [{ error: true }, "kept.error"], [{ confirmed: false }, "kept.offline"], [{ changed: true }, "kept.changed"], [{ more: true }, "kept.notesPending"]] as const) {
      const state = history(patch); h.buttons = [];
      const html = renderToStaticMarkup(<MilestoneKeptStatus history={state} />);
      expect(html).toContain(translate(lang, text)); expect(html).not.toContain(translate(lang, "kept.filterEmpty"));
      if (text === "kept.error") { h.buttons[0].onClick!(); expect(state.reload).toHaveBeenCalledOnce(); }
      if (text === "kept.notesPending") { h.buttons[0].onClick!(); expect(state.loadMore).toHaveBeenCalledOnce(); }
    }
  });
});

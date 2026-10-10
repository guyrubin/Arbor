import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { translate } from "../../lib/i18n";
const h = vi.hoisted(() => ({ shares: [] as { beforeShare?: () => boolean; getCardOpts: () => unknown }[], keys: [] as (string | undefined)[] }));
vi.mock("../../context/LanguageContext", () => ({ useLanguage: () => ({ t: (key: string) => translate("en", key) }) }));
vi.mock("../../context/AuthContext", () => ({ useAuth: () => ({ user: { uid: "account-a" } }) }));
vi.mock("../../context/ToastContext", () => ({ useToastOptional: () => null }));
vi.mock("../ui/Modal", () => ({ Modal: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock("../ui/ShareButton", () => ({ ShareButton: (props: typeof h.shares[number]) => { h.shares.push(props); return <button data-testid="editor-share" />; } }));
const capture = vi.hoisted(() => (type: unknown, props: unknown, key: unknown) => { if (typeof type === "function" && (props as { beforeShare?: unknown })?.beforeShare) h.keys.push(String(key)); });
vi.mock("react/jsx-runtime", async original => {
  const runtime = await original<typeof import("react/jsx-runtime")>();
  return { ...runtime, jsx: (...a: Parameters<typeof runtime.jsx>) => { capture(a[0], a[1], a[2]); return runtime.jsx(...a); }, jsxs: (...a: Parameters<typeof runtime.jsxs>) => { capture(a[0], a[1], a[2]); return runtime.jsxs(...a); } };
});
vi.mock("react/jsx-dev-runtime", async original => {
  const runtime = await original<typeof import("react/jsx-dev-runtime")>();
  return { ...runtime, jsxDEV: (...a: Parameters<typeof runtime.jsxDEV>) => { capture(a[0], a[1], a[2]); return runtime.jsxDEV(...a); } };
});
import FirstKeepsakeSheet from "./FirstKeepsakeSheet";
const saved = { id: "first", milestoneId: "first", note: "Own saved words", noticedOn: "2026-10-04", createdAt: "2026-10-04", updatedAt: "2026-10-04" };
const guard = vi.fn(() => true);
const render = (canShare: boolean, note = saved.note) => renderToStaticMarkup(<FirstKeepsakeSheet open childId="child-a" childName="Noa" milestoneId="first" milestoneTitle="Three steps" keepsake={{ ...saved, note }} onSave={() => {}} onRemove={() => {}} onClose={() => {}} canShare={canShare} beforeShare={guard} />);
beforeEach(() => { vi.clearAllMocks(); h.shares = []; h.keys = []; });

describe("the retained first-note editor cannot bypass kept eligibility", () => {
  it("keeps note/date/photo/save/remove when export is unavailable and exposes no alternate Send", () => {
    const html = render(false);
    expect(html).toContain('data-testid="first-keepsake-save"'); expect(html).toContain('data-testid="first-keepsake-remove"'); expect(html).toContain('accept="image/*"');
    expect(h.shares).toHaveLength(0);
  });
  it("passes the exact shared freshness check to eligible saved-note sharing", () => {
    render(true); expect(h.shares).toHaveLength(1); expect(h.shares[0].beforeShare).toBe(guard);
    expect(h.shares[0].getCardOpts()).toMatchObject({ sub: saved.note });
  });
  it("retires the old review when the saved text changes", () => {
    render(true); const firstKey = h.keys.at(-1); render(true, "New saved words");
    expect(firstKey).toBeTruthy(); expect(h.keys.at(-1)).not.toBe(firstKey);
  });
});

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { translate } from "../../lib/i18n";

/* v3 F-CHILD-1 — a keepsake's receipt follows the write. "Kept" (or
   "removed") toasts, and the sheet closes, only after onSave / onRemove
   resolved; a rejected write keeps the sheet open with the parent's words and
   toasts the failure. Invented words only. The sheet renders once (SSR) and
   its buttons' handlers are captured from the JSX runtime. */

const h = vi.hoisted(() => ({
  toast: vi.fn(),
  buttons: {} as Record<string, { onClick?: () => void }>,
}));
vi.mock("../../context/LanguageContext", () => ({ useLanguage: () => ({ t: (key: string) => translate("en", key) }) }));
vi.mock("../../context/AuthContext", () => ({ useAuth: () => ({ user: { uid: "account-a" } }) }));
vi.mock("../../context/ToastContext", () => ({ useToastOptional: () => ({ toast: h.toast }) }));
vi.mock("../ui/Modal", () => ({ Modal: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock("../ui/ShareButton", () => ({ ShareButton: () => null }));
const capture = vi.hoisted(() => (type: unknown, props: unknown) => {
  if (type !== "button" || !props || typeof props !== "object") return;
  const id = (props as { "data-testid"?: string })["data-testid"];
  if (id) h.buttons[id] = props as { onClick?: () => void };
});
vi.mock("react/jsx-runtime", async original => {
  const runtime = await original<typeof import("react/jsx-runtime")>();
  return { ...runtime, jsx: (...a: Parameters<typeof runtime.jsx>) => { capture(a[0], a[1]); return runtime.jsx(...a); }, jsxs: (...a: Parameters<typeof runtime.jsxs>) => { capture(a[0], a[1]); return runtime.jsxs(...a); } };
});
vi.mock("react/jsx-dev-runtime", async original => {
  const runtime = await original<typeof import("react/jsx-dev-runtime")>();
  return { ...runtime, jsxDEV: (...a: Parameters<typeof runtime.jsxDEV>) => { capture(a[0], a[1]); return runtime.jsxDEV(...a); } };
});
import FirstKeepsakeSheet from "./FirstKeepsakeSheet";

const saved = { id: "first", milestoneId: "first", note: "Said the cat's name twice", noticedOn: "2026-01-04", createdAt: "2026-01-04", updatedAt: "2026-01-04" };
const en = (key: string) => translate("en", key);
const tick = () => new Promise<void>(resolve => setTimeout(resolve, 0));
const deferred = () => {
  let resolve!: () => void;
  let reject!: (e: Error) => void;
  const promise = new Promise<void>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
};

const render = (onSave: (draft: unknown) => Promise<unknown>, onRemove: () => Promise<unknown>, onClose: () => void) =>
  renderToStaticMarkup(
    <FirstKeepsakeSheet
      open
      childId="child-a"
      childName="Noa"
      milestoneId="first"
      milestoneTitle="Three steps"
      keepsake={saved}
      canShare={false}
      beforeShare={() => false}
      onSave={onSave}
      onRemove={onRemove}
      onClose={onClose}
    />,
  );

beforeEach(() => { vi.clearAllMocks(); h.buttons = {}; });

describe("v3 F-CHILD-1 — the keepsake receipt waits for the write", () => {
  it("Save: no 'Kept' and no close while the write is in flight; both after it resolved", async () => {
    const write = deferred();
    const onSave = vi.fn((_draft: unknown) => write.promise);
    const onClose = vi.fn();
    render(onSave, async () => {}, onClose);
    h.buttons["first-keepsake-save"].onClick!();
    expect(onSave).toHaveBeenCalledOnce();
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ milestoneId: "first", note: saved.note, noticedOn: saved.noticedOn }));
    await tick();
    expect(h.toast).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    write.resolve();
    await tick();
    expect(h.toast).toHaveBeenCalledOnce();
    expect(h.toast).toHaveBeenCalledWith(en("elev.waveR.keepsake.saved"), "success");
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("Save: a rejected write toasts the failure, never 'Kept', and keeps the sheet open", async () => {
    const write = deferred();
    const onClose = vi.fn();
    render(() => write.promise, async () => {}, onClose);
    h.buttons["first-keepsake-save"].onClick!();
    write.reject(new Error("offline"));
    await tick();
    expect(h.toast).toHaveBeenCalledOnce();
    expect(h.toast).toHaveBeenCalledWith(en("elev.waveR.keepsake.saveFailed"), "error");
    expect(h.toast).not.toHaveBeenCalledWith(en("elev.waveR.keepsake.saved"), expect.anything());
    expect(onClose).not.toHaveBeenCalled();
  });

  it("Remove: 'removed' and the close wait for the removal; a rejected removal says the keepsake is still here", async () => {
    const gone = deferred();
    const onClose = vi.fn();
    render(async () => {}, () => gone.promise, onClose);
    h.buttons["first-keepsake-remove"].onClick!();
    await tick();
    expect(h.toast).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    gone.resolve();
    await tick();
    expect(h.toast).toHaveBeenCalledWith(en("elev.waveR.keepsake.removed"), "info");
    expect(onClose).toHaveBeenCalledOnce();

    vi.clearAllMocks();
    const stuck = deferred();
    render(async () => {}, () => stuck.promise, onClose);
    h.buttons["first-keepsake-remove"].onClick!();
    stuck.reject(new Error("rules"));
    await tick();
    expect(h.toast).toHaveBeenCalledOnce();
    expect(h.toast).toHaveBeenCalledWith(en("elev.waveR.keepsake.removeFailed"), "error");
    expect(onClose).not.toHaveBeenCalled();
  });

  it("every new receipt string exists in English and Hebrew, and they differ", () => {
    for (const key of ["elev.waveR.keepsake.saveFailed", "elev.waveR.keepsake.removeFailed"]) {
      expect(translate("en", key)).not.toBe(key);
      expect(translate("he", key)).not.toBe(key);
      expect(translate("he", key)).not.toBe(translate("en", key));
      expect(translate("he", key)).not.toMatch(/[A-Za-z]/);
    }
  });
});

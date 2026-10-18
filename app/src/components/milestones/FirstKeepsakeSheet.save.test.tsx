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
  uid: "account-a", keepState: false, cursor: 0, hooks: [] as unknown[],
  buttons: {} as Record<string, { onClick?: () => void; disabled?: boolean }>,
  note: null as null | { onChange: (event: { target: { value: string } }) => void; disabled?: boolean },
}));
vi.mock("react", async original => {
  const actual = await original<typeof import("react")>();
  return { ...actual,
    useState: (initial: unknown) => {
      if (!h.keepState) return actual.useState(initial);
      const index = h.cursor++;
      if (!(index in h.hooks)) h.hooks[index] = typeof initial === "function" ? initial() : initial;
      return [h.hooks[index], (next: unknown) => { h.hooks[index] = typeof next === "function" ? next(h.hooks[index]) : next; }];
    },
    useRef: (initial: unknown) => {
      if (!h.keepState) return actual.useRef(initial);
      const index = h.cursor++;
      if (!(index in h.hooks)) h.hooks[index] = { current: initial };
      return h.hooks[index];
    },
  };
});
vi.mock("../../context/LanguageContext", () => ({ useLanguage: () => ({ t: (key: string) => translate("en", key) }) }));
vi.mock("../../context/AuthContext", () => ({ useAuth: () => ({ user: { uid: h.uid } }) }));
vi.mock("../../context/ToastContext", () => ({ useToastOptional: () => ({ toast: h.toast }) }));
vi.mock("../ui/Modal", () => ({ Modal: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock("../ui/ShareButton", () => ({ ShareButton: () => null }));
const capture = vi.hoisted(() => (type: unknown, props: unknown) => {
  if (type === "textarea" && props && typeof props === "object") h.note = props as NonNullable<typeof h.note>;
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

const render = (onSave: (draft: unknown) => Promise<unknown>, onRemove: () => Promise<unknown>, onClose: () => void, extra: { open?: boolean; pendingAcknowledgementMessage?: string } = {}) => {
  h.cursor = 0;
  return renderToStaticMarkup(
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
      {...extra}
    />,
  );
};

beforeEach(() => { vi.clearAllMocks(); h.buttons = {}; h.note = null; h.uid = "account-a"; h.keepState = false; h.hooks = []; h.cursor = 0; });

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

  it("blocks rapid duplicate taps and protects the submitted words until acknowledgement", async () => {
    h.keepState = true;
    const write = deferred();
    const onSave = vi.fn(() => write.promise), onClose = vi.fn();
    render(onSave, async () => {}, onClose);
    h.buttons["first-keepsake-save"].onClick!();
    h.buttons["first-keepsake-save"].onClick!();
    expect(onSave).toHaveBeenCalledOnce();
    render(onSave, async () => {}, onClose);
    expect(h.buttons["first-keepsake-save"].disabled).toBe(true);
    expect(h.note?.disabled).toBe(true);
    write.resolve(); await tick();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("keeps the parent's edited words and a truthful pending state after an acknowledgement timeout", async () => {
    h.keepState = true;
    const write = deferred();
    const onSave = vi.fn(() => write.promise), onClose = vi.fn();
    const extra = { pendingAcknowledgementMessage: "Waiting for confirmation. Retry when connected." };
    render(onSave, async () => {}, onClose, extra);
    h.note!.onChange({ target: { value: "The exact words we want to keep" } });
    render(onSave, async () => {}, onClose, extra);
    h.buttons["first-keepsake-save"].onClick!();
    write.reject(new Error("The write was not confirmed; please retry")); await tick();
    const html = render(onSave, async () => {}, onClose, extra);
    expect(html).toContain("The exact words we want to keep");
    expect(html).toContain('data-testid="first-keepsake-pending-ack"');
    expect(h.buttons["first-keepsake-save"].disabled).toBe(false);
    expect(onClose).not.toHaveBeenCalled(); expect(h.toast).not.toHaveBeenCalled();
  });

  it.each(["close", "account"] as const)("suppresses a late success receipt after %s", async change => {
    h.keepState = true;
    const write = deferred(), onClose = vi.fn();
    render(() => write.promise, async () => {}, onClose);
    h.buttons["first-keepsake-save"].onClick!();
    if (change === "account") h.uid = "account-b";
    render(() => write.promise, async () => {}, onClose, { open: change !== "close" });
    write.resolve(); await tick();
    expect(h.toast).not.toHaveBeenCalled(); expect(onClose).not.toHaveBeenCalled();
  });
});

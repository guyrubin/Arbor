import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { translate } from "../../lib/i18n";
const h = vi.hoisted(() => ({ send: vi.fn(async () => "shared"), buttons: [] as { "data-testid"?: string; onClick?: () => void }[] }));
vi.mock("../../context/LanguageContext", () => ({ useLanguage: () => ({ uiLang: "en", t: (key: string) => translate("en", key) }) }));
vi.mock("../../lib/share", () => ({ sendTextShare: h.send }));
vi.mock("../ui/Modal", () => ({ Modal: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock("../ui/Sheet", () => ({ Sheet: () => null, useCompactSurface: () => false }));
const capture = vi.hoisted(() => (type: unknown, props: unknown) => { if (type === "button" && props && typeof props === "object") h.buttons.push(props as typeof h.buttons[number]); });
vi.mock("react/jsx-runtime", async original => {
  const runtime = await original<typeof import("react/jsx-runtime")>();
  return { ...runtime, jsx: (...a: Parameters<typeof runtime.jsx>) => { capture(a[0], a[1]); return runtime.jsx(...a); }, jsxs: (...a: Parameters<typeof runtime.jsxs>) => { capture(a[0], a[1]); return runtime.jsxs(...a); } };
});
vi.mock("react/jsx-dev-runtime", async original => {
  const runtime = await original<typeof import("react/jsx-dev-runtime")>();
  return { ...runtime, jsxDEV: (...a: Parameters<typeof runtime.jsxDEV>) => { capture(a[0], a[1]); return runtime.jsxDEV(...a); } };
});
import { SendSheet } from "./SendSheet";
beforeEach(() => { vi.clearAllMocks(); h.buttons = []; });

describe("kept source freshness at the final Send action", () => {
  it("a source changed after opening closes review before the share/copy function", async () => {
    let current = true;
    const close = vi.fn();
    renderToStaticMarkup(<SendSheet open onClose={close} text="Original kept words" artifact="growth_card" surface="kept_item" beforeSend={() => current} />);
    current = false;
    h.buttons.find(button => button["data-testid"] === "send-sheet-send")!.onClick!();
    await Promise.resolve();
    expect(h.send).not.toHaveBeenCalled(); expect(close).toHaveBeenCalledOnce();
  });
  it("a current source reaches the existing share seam only on the final tap", async () => {
    renderToStaticMarkup(<SendSheet open onClose={() => {}} text="Current kept words" artifact="growth_card" surface="kept_month" beforeSend={() => true} />);
    expect(h.send).not.toHaveBeenCalled();
    h.buttons.find(button => button["data-testid"] === "send-sheet-send")!.onClick!();
    await Promise.resolve();
    expect(h.send).toHaveBeenCalledWith({ artifact: "growth_card", surface: "kept_month", text: "Current kept words" });
  });
  it("preserves existing caller behavior when no freshness guard is supplied", async () => {
    renderToStaticMarkup(<SendSheet open onClose={() => {}} text="Existing draft" artifact="growth_card" surface="said_page" />);
    h.buttons.find(button => button["data-testid"] === "send-sheet-send")!.onClick!();
    await Promise.resolve();
    expect(h.send).toHaveBeenCalledOnce();
  });
});

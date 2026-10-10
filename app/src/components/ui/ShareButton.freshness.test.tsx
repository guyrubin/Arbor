import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { translate } from "../../lib/i18n";
const h = vi.hoisted(() => ({ cursor: 0, slots: [] as unknown[], send: vi.fn(async () => "shared"), buttons: [] as { "data-testid"?: string; onClick?: () => void; disabled?: boolean }[] }));
vi.mock("react", async original => ({ ...await original<typeof import("react")>(), useState: (initial: unknown) => {
  const index = h.cursor++;
  if (!(index in h.slots)) h.slots[index] = initial;
  return [h.slots[index], (next: unknown) => { h.slots[index] = typeof next === "function" ? next(h.slots[index]) : next; }];
} }));
vi.mock("../../context/LanguageContext", () => ({ useLanguage: () => ({ uiLang: "en", t: (key: string, vars?: Record<string, string | number>) => translate("en", key, vars) }) }));
vi.mock("../../context/AuthContext", () => ({ useAuth: () => ({ user: { uid: "a", displayName: "Parent" } }) }));
vi.mock("../../lib/share", () => ({ sendTextShare: h.send, textFromCardOpts: (value: { headline?: string; sub?: string }) => [value.headline, value.sub].filter(Boolean) }));
vi.mock("./Modal", () => ({ Modal: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock("./Sheet", () => ({ Sheet: () => null, useCompactSurface: () => false }));
const capture = vi.hoisted(() => (type: unknown, props: unknown) => { if (type === "button") h.buttons.push(props as typeof h.buttons[number]); });
vi.mock("react/jsx-runtime", async original => {
  const runtime = await original<typeof import("react/jsx-runtime")>();
  return { ...runtime, jsx: (...a: Parameters<typeof runtime.jsx>) => { capture(a[0], a[1]); return runtime.jsx(...a); }, jsxs: (...a: Parameters<typeof runtime.jsxs>) => { capture(a[0], a[1]); return runtime.jsxs(...a); } };
});
vi.mock("react/jsx-dev-runtime", async original => {
  const runtime = await original<typeof import("react/jsx-dev-runtime")>();
  return { ...runtime, jsxDEV: (...a: Parameters<typeof runtime.jsxDEV>) => { capture(a[0], a[1]); return runtime.jsxDEV(...a); } };
});
import { ShareButton } from "./ShareButton";
const render = (beforeShare?: () => boolean, disabled = false) => { h.cursor = 0; h.buttons = []; return renderToStaticMarkup(<ShareButton artifact="growth_card" surface="firsts_keepsake" captionKey="elev.share.caption.firsts" childName="Noa" getCardOpts={() => ({ headline: "A first", sub: "Parent words" })} beforeShare={beforeShare} disabled={disabled} />); };
beforeEach(() => { vi.clearAllMocks(); h.cursor = 0; h.slots = []; h.buttons = []; });

describe("retained editor sharing honors source eligibility and freshness", () => {
  it("cannot open review when the source check fails", () => {
    const guard = vi.fn(() => false); render(guard); h.buttons[0].onClick!();
    expect(guard).toHaveBeenCalledOnce(); expect(render(guard)).not.toContain('data-testid="send-sheet"');
  });
  it("blocks the actual final share seam if the source changes after opening", async () => {
    let current = true; const guard = () => current;
    render(guard); h.buttons[0].onClick!(); render(guard); current = false;
    h.buttons.find(button => button["data-testid"] === "send-sheet-send")!.onClick!(); await Promise.resolve();
    expect(h.send).not.toHaveBeenCalled(); expect(render(guard)).not.toContain('data-testid="send-sheet"');
  });
  it("a still-current eligible source reaches the existing text-only share seam", async () => {
    render(() => true); h.buttons[0].onClick!(); render(() => true);
    h.buttons.find(button => button["data-testid"] === "send-sheet-send")!.onClick!(); await Promise.resolve();
    expect(h.send).toHaveBeenCalledWith(expect.objectContaining({ artifact: "growth_card", surface: "firsts_keepsake", text: expect.stringContaining("Parent words") }));
  });
  it("disables export and hides an already-open review when confirmation is lost", () => {
    render(() => true); h.buttons[0].onClick!(); expect(render(() => true)).toContain('data-testid="send-sheet"');
    expect(render(() => true, true)).not.toContain('data-testid="send-sheet"'); expect(h.buttons[0].disabled).toBe(true);
  });
  it("keeps unguarded existing callers working", async () => {
    render(); h.buttons[0].onClick!(); render();
    h.buttons.find(button => button["data-testid"] === "send-sheet-send")!.onClick!(); await Promise.resolve(); expect(h.send).toHaveBeenCalledOnce();
  });
});

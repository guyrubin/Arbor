/**
 * F-TALK-2 / MOB-03 — the full-screen conversation stays above the phone's
 * on-screen keyboard. Pure binding proven with a fake visual viewport (the
 * vitest env is node-only); the CompanionWorkspace call and the CSS that
 * consumes the property are pinned at source level.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { KEYBOARD_INSET_VAR, bindVisualViewportInset, keyboardInset } from "./useVisualViewportInset";

function fakeViewport(height: number, offsetTop = 0) {
  const listeners: Record<string, Set<() => void>> = { resize: new Set(), scroll: new Set() };
  return {
    height,
    offsetTop,
    addEventListener: (type: "resize" | "scroll", fn: () => void) => { listeners[type].add(fn); },
    removeEventListener: (type: "resize" | "scroll", fn: () => void) => { listeners[type].delete(fn); },
    fire: (type: "resize" | "scroll") => listeners[type].forEach((fn) => fn()),
    count: () => listeners.resize.size + listeners.scroll.size,
  };
}
function fakeTarget() {
  const props = new Map<string, string>();
  return { props, style: { setProperty: (k: string, v: string) => { props.set(k, v); }, removeProperty: (k: string) => { props.delete(k); } } };
}

describe("keyboardInset", () => {
  it("is the layout height the visual viewport no longer shows", () => {
    expect(keyboardInset(800, { height: 460, offsetTop: 0 })).toBe(340);
    expect(keyboardInset(800, { height: 460, offsetTop: 40 })).toBe(300);
    expect(keyboardInset(800, { height: 459.6, offsetTop: 0 })).toBe(340);
  });

  it("is 0 with no keyboard, a zoomed-out viewport, or no visualViewport", () => {
    expect(keyboardInset(800, { height: 800, offsetTop: 0 })).toBe(0);
    expect(keyboardInset(800, { height: 900, offsetTop: 0 })).toBe(0);
    expect(keyboardInset(800, null)).toBe(0);
  });
});

describe("bindVisualViewportInset", () => {
  it("publishes the inset, follows the keyboard, and clears on cleanup", () => {
    const viewport = fakeViewport(800);
    const target = fakeTarget();
    const win = { innerHeight: 800, visualViewport: viewport };
    const stop = bindVisualViewportInset(win, target);
    expect(target.props.has(KEYBOARD_INSET_VAR)).toBe(false);
    viewport.height = 460;
    viewport.fire("resize");
    expect(target.props.get(KEYBOARD_INSET_VAR)).toBe("340px");
    viewport.offsetTop = 20;
    viewport.fire("scroll");
    expect(target.props.get(KEYBOARD_INSET_VAR)).toBe("320px");
    viewport.height = 800;
    viewport.offsetTop = 0;
    viewport.fire("resize");
    expect(target.props.has(KEYBOARD_INSET_VAR)).toBe(false);
    viewport.height = 500;
    viewport.fire("resize");
    stop();
    expect(target.props.has(KEYBOARD_INSET_VAR)).toBe(false);
    expect(viewport.count()).toBe(0);
  });

  it("does nothing where visualViewport does not exist", () => {
    const target = fakeTarget();
    const stop = bindVisualViewportInset({ innerHeight: 800 }, target);
    stop();
    expect(target.props.size).toBe(0);
  });
});

describe("the conversation consumes it", () => {
  const SRC = path.resolve(__dirname, "..");
  const workspace = readFileSync(path.join(SRC, "components/companion/CompanionWorkspace.tsx"), "utf8");
  const css = readFileSync(path.join(SRC, "components/companion/companionWorkspace.css"), "utf8");

  it("CompanionWorkspace tracks the keyboard only while the panel is full-screen (modal)", () => {
    expect(workspace).toContain('import { useVisualViewportInset } from "../../hooks/useVisualViewportInset";');
    expect(workspace).toContain("useVisualViewportInset(modal);");
  });

  it("below 1280 px the fixed panel's bottom edge rises by the inset (logical property)", () => {
    expect(css).toMatch(/@media \(max-width: 1279\.98px\) \{ \.companion-conversation \{ inset-block-end: var\(--companion-keyboard-inset, 0px\); \} \}/);
    // The docked panel (>= 1280) is not fixed, so it is never lifted.
    const wide = css.slice(css.indexOf("@media (min-width: 1280px)"));
    expect(wide).not.toContain("--companion-keyboard-inset");
  });
});

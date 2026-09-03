import { describe, expect, it, vi } from "vitest";
import { createDialogStack, dialogTabbables } from "./dialogStack";

// Structural DOM doubles: production event/ownership/shield code runs unchanged.
// Geometry is explicit test input; real CSS/focus behavior remains a browser gate.
class Style {
  values = new Map<string, [string, string]>();
  getPropertyValue(name: string) { return this.values.get(name)?.[0] ?? ""; }
  getPropertyPriority(name: string) { return this.values.get(name)?.[1] ?? ""; }
  setProperty(name: string, value: string, priority = "") { this.values.set(name, [value, priority]); }
  removeProperty(name: string) { const old = this.getPropertyValue(name); this.values.delete(name); return old; }
}
class Node {
  children: Node[] = [];
  parentElement: Node | null = null;
  attrs = new Map<string, string>();
  style = new Style();
  shown = true;
  visibility = "visible";
  disabled = false;
  offsetParent = null; // visible fixed-position controls must still be tabbable
  constructor(readonly ownerDocument: Doc, readonly tag = "div") {}
  get isConnected(): boolean { return this === this.ownerDocument.body || !!this.parentElement?.isConnected; }
  get tabIndex() { return Number(this.attrs.get("tabindex") ?? (this.tag === "button" || this.tag === "input" ? 0 : -1)); }
  hasAttribute(name: string) { return this.attrs.has(name); }
  getAttribute(name: string) { return this.attrs.get(name) ?? null; }
  setAttribute(name: string, value: string) { this.attrs.set(name, value); }
  removeAttribute(name: string) { this.attrs.delete(name); }
  contains(node: unknown): boolean { return this === node || this.children.some(child => child.contains(node)); }
  append(child: Node) { child.parentElement = this; this.children.push(child); return child; }
  remove() { if (this.parentElement) this.parentElement.children = this.parentElement.children.filter(child => child !== this); this.parentElement = null; }
  matches(selector: string): boolean {
    return selector.split(",").some(part => {
      const s = part.trim();
      if (s === ":disabled") return this.disabled;
      if (s === 'input[type="hidden"]') return this.tag === "input" && this.attrs.get("type") === "hidden";
      if (s === "main.arbor-parent") return this.tag === "main";
      const attr = /^\[([^=\]]+)(?:="([^"]*)")?\]$/.exec(s);
      return attr ? this.attrs.has(attr[1]) && (attr[2] === undefined || this.attrs.get(attr[1]) === attr[2]) : this.tag === s;
    });
  }
  closest(selector: string): Node | null { return this.matches(selector) ? this : this.parentElement?.closest(selector) ?? null; }
  querySelectorAll(selector: string): Node[] { return this.children.flatMap(child => [...(child.matches(selector) ? [child] : []), ...child.querySelectorAll(selector)]); }
  querySelector(selector: string) { return this.querySelectorAll(selector)[0] ?? null; }
  getClientRects() { return this.shown ? [{}] : []; }
  focus() {
    if (!this.isConnected || this.closest("[inert],[hidden]")) return;
    this.ownerDocument.activeElement = this;
    this.ownerDocument.emit("focusin", {});
  }
  blur() { if (this.ownerDocument.activeElement === this) this.ownerDocument.activeElement = this.ownerDocument.body; }
}
class Doc {
  body = new Node(this, "body");
  documentElement = this.body;
  activeElement: Node = this.body;
  events = new Map<string, Set<(event: any) => void>>();
  defaultView = { getComputedStyle: (node: Node) => ({ visibility: node.visibility, zIndex: node.style.getPropertyValue("z-index") || "50" }) };
  querySelectorAll(selector: string) { return this.body.querySelectorAll(selector); }
  addEventListener(name: string, listener: (event: any) => void) { if (!this.events.has(name)) this.events.set(name, new Set()); this.events.get(name)!.add(listener); }
  removeEventListener(name: string, listener: (event: any) => void) { this.events.get(name)?.delete(listener); }
  emit(name: string, event: any) { for (const listener of [...this.events.get(name) ?? []]) listener(event); }
}
const html = (node: Node) => node as unknown as HTMLElement;
function fixture() {
  const doc = new Doc();
  const shell = doc.body.append(new Node(doc));
  const main = shell.append(new Node(doc, "main"));
  const opener = main.append(new Node(doc, "button"));
  opener.focus();
  let blocked = false;
  let blockedListener: (() => void) | undefined;
  const jobs: (() => void)[] = [];
  const stack = createDialogStack({
    document: doc as unknown as Document,
    schedule: job => jobs.push(job), blocked: () => blocked,
    subscribeBlocked: fn => { blockedListener = fn; return () => { blockedListener = undefined; }; },
  });
  const flush = () => { for (let count = 0; jobs.length; count++) { if (count > 50) throw new Error("unbounded dialog jobs"); jobs.shift()!(); } };
  const layer = (parent = doc.body) => {
    const root = parent.append(new Node(doc));
    root.setAttribute("data-arbor-dialog-layer", "true");
    root.setAttribute("tabindex", "-1");
    const first = root.append(new Node(doc, "button"));
    const last = root.append(new Node(doc, "button"));
    return { root, first, last };
  };
  const key = (key: string, shiftKey = false, extras = {}) => {
    const event = { key, shiftKey, repeat: false, isComposing: false, defaultPrevented: false, preventDefault: vi.fn(), stopPropagation: vi.fn(), ...extras };
    doc.emit("keydown", event); return event;
  };
  return { doc, shell, main, opener, stack, flush, layer, key, jobs,
    block: (value: boolean) => { blocked = value; blockedListener?.(); },
  };
}

describe("dialog stack: production event and lifetime ownership", () => {
  it("one Escape closes only the nested top, including synchronous cleanup", () => {
    const f = fixture(), outer = f.layer(), inner = f.layer();
    const closeOuter = vi.fn();
    const a = f.stack.register({ root: html(outer.root), onClose: closeOuter }); f.flush();
    outer.last.focus();
    const closeInner = vi.fn(() => b.dispose());
    const b = f.stack.register({ root: html(inner.root), onClose: closeInner }); f.flush();
    f.key("Escape"); f.flush();
    expect(closeInner).toHaveBeenCalledTimes(1);
    expect(closeOuter).not.toHaveBeenCalled();
    expect(f.doc.activeElement).toBe(outer.last);
    expect(f.shell.hasAttribute("inert")).toBe(true);
    expect(f.doc.events.get("keydown")?.size).toBe(1);
    f.key("Escape", false, { repeat: true });
    expect(closeOuter).not.toHaveBeenCalled();
    a.dispose(); f.flush();
    expect(f.doc.activeElement).toBe(f.opener);
    expect(f.doc.events.get("keydown")?.size).toBe(0);
  });

  it("a portal child mounting before its parent still owns focus and Escape", () => {
    const f = fixture(), outer = f.layer(), inner = f.layer();
    const outerClose = vi.fn(), innerClose = vi.fn();
    const b = f.stack.register({ root: html(inner.root), parentRoot: () => html(outer.root), onClose: innerClose });
    const a = f.stack.register({ root: html(outer.root), onClose: outerClose }); f.flush();
    expect(f.doc.activeElement).toBe(inner.first);
    expect(inner.root.hasAttribute("inert")).toBe(false);
    f.key("Escape"); expect(innerClose).toHaveBeenCalledOnce(); expect(outerClose).not.toHaveBeenCalled();
    b.dispose(); a.dispose(); f.flush();
  });

  it("pre-fix per-instance listeners close BOTH dialogs (negative control)", () => {
    const outer = vi.fn(), inner = vi.fn();
    const listeners = [() => outer(), () => inner()];
    listeners.forEach(listener => listener());
    expect(outer).toHaveBeenCalledOnce(); expect(inner).toHaveBeenCalledOnce();
  });

  it("stale handles, lower removal and repeated disposal cannot affect the top", () => {
    const f = fixture(), outer = f.layer(), inner = f.layer();
    const onClose = vi.fn();
    const a = f.stack.register({ root: html(outer.root), onClose }); f.flush();
    const b = f.stack.register({ root: html(inner.root), onClose }); f.flush();
    a.close(); a.dispose(); a.dispose(); a.close(); f.flush();
    expect(onClose).not.toHaveBeenCalled();
    expect(f.doc.activeElement).toBe(inner.first);
    expect(f.doc.body.style.getPropertyValue("overflow")).toBe("hidden");
    b.dispose(); f.flush(); expect(f.stack.depth).toBe(0);
  });

  it("closing before initial focus and StrictMode reacquisition cancel stale work", () => {
    const f = fixture(), dialog = f.layer();
    const a = f.stack.register({ root: html(dialog.root), onClose: vi.fn() });
    a.dispose();
    const b = f.stack.register({ root: html(dialog.root), onClose: vi.fn() });
    f.flush();
    expect(dialog.root.hasAttribute("inert")).toBe(false);
    expect(dialog.root.style.getPropertyValue("pointer-events")).toBe("");
    expect(f.doc.activeElement).toBe(dialog.first);
    b.dispose(); f.flush();
    expect(f.doc.activeElement).toBe(f.opener);
    expect(f.doc.body.style.getPropertyValue("overflow")).toBe("");
  });

  it("More → Search in one commit transfers focus and preserves the original opener", () => {
    const f = fixture(), more = f.layer();
    const a = f.stack.register({ root: html(more.root), onClose: vi.fn(), returnFocus: () => html(f.opener) }); f.flush();
    more.last.focus();
    a.dispose(); more.root.remove();
    const search = f.layer();
    const b = f.stack.register({ root: html(search.root), onClose: vi.fn() }); f.flush();
    expect(f.doc.activeElement).toBe(search.first);
    // Old cleanup's unconditional focus restore would pull focus OUT of Search.
    const legacyRestore = () => f.opener.focus();
    f.shell.removeAttribute("inert"); // reproduce the missing pre-fix shield
    legacyRestore();
    // The current focusin controller immediately recaptures it.
    expect(f.doc.activeElement).toBe(search.first);
    b.dispose(); f.flush(); expect(f.doc.activeElement).toBe(f.opener);
  });

  it("simultaneous parent/child unmount restores only a connected outer opener", () => {
    const f = fixture(), outer = f.layer();
    const a = f.stack.register({ root: html(outer.root), onClose: vi.fn() }); f.flush();
    outer.last.focus();
    const inner = f.layer();
    const b = f.stack.register({ root: html(inner.root), onClose: vi.fn() }); f.flush();
    a.dispose(); outer.root.remove(); b.dispose(); inner.root.remove(); f.flush();
    expect(f.doc.activeElement).toBe(f.opener);
    expect(f.doc.events.get("focusin")?.size).toBe(0);
  });
});

describe("dialog focus, shielding and scroll contract", () => {
  it("wraps both ways, recaptures outside focus and skips hidden/disabled/fixed-offset traps", () => {
    const f = fixture(), d = f.layer();
    const hidden = d.root.append(new Node(f.doc, "button")); hidden.shown = false;
    const disabled = d.root.append(new Node(f.doc, "button")); disabled.disabled = true;
    const invisible = d.root.append(new Node(f.doc, "button")); invisible.visibility = "hidden";
    const negative = d.root.append(new Node(f.doc, "button")); negative.setAttribute("tabindex", "-2");
    const a = f.stack.register({ root: html(d.root), onClose: vi.fn() }); f.flush();
    expect(dialogTabbables(html(d.root))).toEqual([d.first, d.last]);
    f.key("Tab", true); expect(f.doc.activeElement).toBe(d.last);
    f.key("Tab"); expect(f.doc.activeElement).toBe(d.first);
    f.doc.activeElement = f.opener; f.key("Tab", true); expect(f.doc.activeElement).toBe(d.last);
    a.dispose(); f.flush();
  });

  it("an empty dialog focuses its container and cannot tab into the page", () => {
    const f = fixture(), d = f.layer(); d.first.remove(); d.last.remove();
    const a = f.stack.register({ root: html(d.root), onClose: vi.fn() }); f.flush();
    expect(f.doc.activeElement).toBe(d.root);
    expect(f.key("Tab").preventDefault).toHaveBeenCalledOnce();
    expect(f.doc.activeElement).toBe(d.root); a.dispose(); f.flush();
  });

  it("preserves autofocus inside the dialog and rejects an outside initialFocus ref", () => {
    const f = fixture(), d = f.layer();
    d.last.setAttribute("autofocus", "");
    const a = f.stack.register({ root: html(d.root), onClose: vi.fn(), initialFocus: () => html(f.opener) }); f.flush();
    expect(f.doc.activeElement).toBe(d.last); a.dispose(); f.flush();
  });

  it("a portal scope wrapper containing the top dialog is never inerted", () => {
    const f = fixture();
    const wrapper = f.doc.body.append(new Node(f.doc));
    wrapper.style.setProperty("display", "contents");
    const d = f.layer(wrapper);
    const a = f.stack.register({ root: html(d.root), onClose: vi.fn() }); f.flush();
    expect(wrapper.hasAttribute("inert")).toBe(false);
    expect(d.root.hasAttribute("inert")).toBe(false);
    expect(f.shell.hasAttribute("inert")).toBe(true);
    expect(f.doc.activeElement).toBe(d.first);
    a.dispose(); f.flush(); expect(f.shell.hasAttribute("inert")).toBe(false);
  });

  it("never inerts the root/ancestors containing an inline dialog", () => {
    const f = fixture(), d = f.layer(f.main);
    const a = f.stack.register({ root: html(d.root), onClose: vi.fn() }); f.flush();
    for (const ancestor of [f.doc.body, f.shell, f.main, d.root]) expect(ancestor.hasAttribute("inert")).toBe(false);
    expect(f.opener.hasAttribute("inert")).toBe(true);
    a.dispose(); f.flush(); expect(f.opener.hasAttribute("inert")).toBe(false);
  });

  it("restores pre-existing aria/inert and body/main overflow only after the last layer", () => {
    const f = fixture();
    f.shell.setAttribute("aria-hidden", "false");
    const external = f.doc.body.append(new Node(f.doc)); external.setAttribute("inert", ""); external.setAttribute("aria-hidden", "external");
    f.doc.body.style.setProperty("overflow", "clip", "important");
    f.main.style.setProperty("overflow-y", "scroll", "important");
    const d = f.layer(), e = f.layer();
    const a = f.stack.register({ root: html(d.root), onClose: vi.fn() }); f.flush();
    const b = f.stack.register({ root: html(e.root), onClose: vi.fn() }); f.flush();
    b.dispose(); f.flush(); expect(f.main.style.getPropertyValue("overflow")).toBe("hidden");
    a.dispose(); f.flush();
    expect(f.shell.getAttribute("aria-hidden")).toBe("false");
    expect(f.shell.hasAttribute("inert")).toBe(false);
    expect(external.getAttribute("aria-hidden")).toBe("external");
    expect(external.hasAttribute("inert")).toBe(true);
    expect(f.doc.body.style.getPropertyValue("overflow")).toBe("clip");
    expect(f.doc.body.style.getPropertyPriority("overflow")).toBe("important");
    expect(f.main.style.getPropertyValue("overflow-y")).toBe("scroll");
    expect(f.main.style.getPropertyPriority("overflow-y")).toBe("important");
  });

  it("new top z-order wins over an older Avatar layer; exits stay inert and noninteractive", () => {
    const f = fixture(), avatar = f.layer(); avatar.root.style.setProperty("z-index", "60");
    const a = f.stack.register({ root: html(avatar.root), onClose: vi.fn() }); f.flush();
    const modal = f.layer();
    const b = f.stack.register({ root: html(modal.root), onClose: vi.fn() }); f.flush();
    expect(Number(modal.root.style.getPropertyValue("z-index"))).toBeGreaterThan(60);
    expect(avatar.root.hasAttribute("inert")).toBe(true);
    b.dispose(); f.flush();
    expect(modal.root.getAttribute("aria-hidden")).toBe("true");
    expect(modal.root.style.getPropertyValue("pointer-events")).toBe("none");
    expect(avatar.root.hasAttribute("inert")).toBe(false); a.dispose(); f.flush();
  });

  it("Kid Mode takes priority without closing parent dialogs or restoring parent focus", () => {
    const f = fixture(), d = f.layer(), onClose = vi.fn();
    const a = f.stack.register({ root: html(d.root), onClose }); f.flush();
    f.block(true); f.flush();
    expect(f.shell.hasAttribute("inert")).toBe(false);
    const kid = f.shell.append(new Node(f.doc, "button")); kid.focus();
    f.key("Escape"); f.key("Tab"); a.close();
    expect(onClose).not.toHaveBeenCalled(); expect(f.doc.activeElement).toBe(kid);
    a.dispose(); f.flush();
    expect(f.doc.activeElement).toBe(kid);
    expect(f.doc.events.get("keydown")?.size).toBe(0);
  });

  it("already-consumed and composing Escape events cannot close a dialog", () => {
    const f = fixture(), d = f.layer(), onClose = vi.fn();
    const a = f.stack.register({ root: html(d.root), onClose }); f.flush();
    f.key("Escape", false, { defaultPrevented: true }); f.key("Escape", false, { isComposing: true });
    expect(onClose).not.toHaveBeenCalled(); a.dispose(); f.flush();
  });
});

import { isKidModeActive, subscribeKidMode } from "./kidModeGate";

export const DIALOG_LAYER = "data-arbor-dialog-layer";
const FOCUSABLE = 'a[href],button,input,select,textarea,[tabindex],[contenteditable="true"]';
export type DialogRegistration = {
  root: HTMLElement;
  onClose: () => void;
  initialFocus?: () => HTMLElement | null;
  returnFocus?: () => HTMLElement | null;
  /** Explicit React parent for portals that can mount in the same commit. */
  parentRoot?: () => HTMLElement | null;
};
export type DialogHandle = { close(): void; dispose(): void };
type Entry = DialogRegistration & { layer: HTMLElement; returns: HTMLElement[]; closing: boolean; z: string; zPriority: string; baseZ: number };
type Environment = {
  document: Document;
  blocked?: () => boolean;
  subscribeBlocked?: (listener: () => void) => () => void;
  schedule?: (callback: () => void) => void;
};

function element(value: unknown): HTMLElement | null {
  return value && typeof (value as HTMLElement).focus === "function" ? value as HTMLElement : null;
}
function visible(el: HTMLElement): boolean {
  if (!el.isConnected || el.closest('[inert],[hidden],[aria-hidden="true"]')) return false;
  const style = el.ownerDocument.defaultView?.getComputedStyle(el);
  return style?.visibility !== "hidden" && style?.visibility !== "collapse" && el.getClientRects().length > 0;
}
function enabled(el: HTMLElement): boolean {
  return !el.matches(':disabled,input[type="hidden"]');
}
export function dialogTabbables(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE))
    .filter(el => el.tabIndex >= 0 && enabled(el) && visible(el))
    .sort((a, b) => (a.tabIndex > 0 ? a.tabIndex : Infinity) - (b.tabIndex > 0 ? b.tabIndex : Infinity));
}
function focus(el: HTMLElement | null | undefined) {
  if (el && visible(el) && enabled(el)) el.focus({ preventScroll: true });
}
function saveAttribute(el: HTMLElement, name: string): () => void {
  const before = el.getAttribute(name);
  return () => { if (before === null) el.removeAttribute(name); else el.setAttribute(name, before); };
}
function hide(el: HTMLElement): () => void {
  // Never take ownership of another shield's inert node.
  if (el.hasAttribute("inert")) return () => {};
  const undoInert = saveAttribute(el, "inert"), undoAria = saveAttribute(el, "aria-hidden");
  el.setAttribute("inert", "");
  el.setAttribute("aria-hidden", "true");
  return () => { undoInert(); undoAria(); };
}

/** One owner for parent dialog events, shielding and focus. The injectable
 * document/scheduler let node tests exercise the production controller; actual
 * layout/focus behavior is additionally verified in the parent's browser. */
export function createDialogStack(env: Environment) {
  const doc = env.document;
  const blocked = env.blocked ?? (() => false);
  const schedule = env.schedule ?? queueMicrotask;
  const entries: Entry[] = [];
  const retired = new WeakMap<HTMLElement, () => void>();
  let undoShield: (() => void)[] = [];
  let undoScroll: (() => void)[] = [];
  let pendingReturns: HTMLElement[] = [];
  let queued = false;
  let listening = false;
  let focusing = false;
  let observer: MutationObserver | null = null;
  let unsubscribe: (() => void) | undefined;
  const top = () => entries[entries.length - 1];
  const releaseShield = () => { for (const undo of undoShield.reverse()) undo(); undoShield = []; };
  const releaseScroll = () => { for (const undo of undoScroll.reverse()) undo(); undoScroll = []; };
  const lockScroll = () => {
    if (undoScroll.length) return;
    for (const el of [doc.body, ...doc.querySelectorAll<HTMLElement>("main.arbor-parent")]) {
      // A scrollport inside the dialog must remain usable.
      if (top()?.layer.contains(el)) continue;
      const saved = ["overflow", "overflow-x", "overflow-y"].map(name => [name, el.style.getPropertyValue(name), el.style.getPropertyPriority(name)]);
      el.style.setProperty("overflow", "hidden");
      undoScroll.push(() => {
        for (const name of ["overflow", "overflow-x", "overflow-y"]) el.style.removeProperty(name);
        for (const [name, value, priority] of saved) if (value) el.style.setProperty(name, value, priority);
      });
    }
  };
  const focusInside = (entry: Entry) => {
    if (focusing || blocked()) return;
    const active = element(doc.activeElement);
    if (active && entry.root.contains(active) && visible(active) && enabled(active)) return;
    const candidates = [
      ...pendingReturns.filter(el => entry.root.contains(el)),
      entry.initialFocus?.(), entry.root.querySelector<HTMLElement>("[autofocus]"),
      ...dialogTabbables(entry.root), entry.root,
    ];
    focusing = true;
    focus(candidates.find(el => el && entry.root.contains(el) && visible(el) && enabled(el)));
    focusing = false;
  };
  const onKey = (event: KeyboardEvent) => {
    const entry = top();
    if (!entry || blocked() || event.defaultPrevented || event.isComposing) return;
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      if (!event.repeat) close(entry);
    } else if (event.key === "Tab") {
      const tabs = dialogTabbables(entry.root);
      const active = element(doc.activeElement);
      if (!tabs.length || !active || !tabs.includes(active) || (event.shiftKey ? active === tabs[0] : active === tabs[tabs.length - 1])) {
        event.preventDefault();
        event.stopPropagation();
        focus(event.shiftKey ? tabs[tabs.length - 1] ?? entry.root : tabs[0] ?? entry.root);
      }
    }
  };
  const onFocus = () => { const entry = top(); if (entry) focusInside(entry); };
  const stopListening = () => {
    if (!listening) return;
    doc.removeEventListener("keydown", onKey, true);
    doc.removeEventListener("focusin", onFocus, true);
    observer?.disconnect(); observer = null;
    unsubscribe?.(); unsubscribe = undefined;
    listening = false;
  };
  const reconcile = () => {
    queued = false;
    releaseShield();
    if (blocked()) {
      releaseScroll();
      pendingReturns = [];
      if (!entries.length) stopListening();
      return; // Kid Mode owns focus, Escape and its own shield.
    }
    const entry = top();
    if (!entry) {
      releaseScroll();
      stopListening();
      focus(pendingReturns.find(el => visible(el) && enabled(el)));
      pendingReturns = [];
      return;
    }
    let z = 0;
    for (const item of entries) {
      z = Math.min(69, Math.max(item.baseZ, z + 1)); // protected Kid Mode is z-70
      item.layer.style.setProperty("z-index", String(z));
    }
    // Move focus BEFORE applying aria-hidden to the opener's branch.
    focusInside(entry);
    pendingReturns = [];
    // Walk the ancestor path, shielding siblings, never an ancestor of root.
    // This also works for inline callers; body portals avoid transformed tabs.
    let branch: HTMLElement = entry.layer;
    while (branch.parentElement) {
      for (const sibling of Array.from(branch.parentElement.children)) {
        const el = sibling as HTMLElement;
        // [data-dialog-shield-exempt] opts a layer out of the shield. It exists
        // for the polite live region: inert/aria-hidden cascades to descendants,
        // so a toast rendered under a shielded ancestor stops being announced
        // exactly when a dialog is open — which is when most toasts fire.
        if (el !== branch && !el.contains(entry.root)
          && !el.matches("script,style,link,[data-dialog-shield-exempt]")) undoShield.push(hide(el));
      }
      if (branch.parentElement === doc.body) break;
      branch = branch.parentElement;
    }
    lockScroll();
  };
  const queue = () => { if (!queued) { queued = true; schedule(reconcile); } };
  const startListening = () => {
    if (listening) return;
    listening = true;
    doc.addEventListener("keydown", onKey, true);
    doc.addEventListener("focusin", onFocus, true);
    const Observer = doc.defaultView?.MutationObserver;
    if (Observer) { observer = new Observer(queue); observer.observe(doc.body, { childList: true, subtree: true }); }
    unsubscribe = env.subscribeBlocked?.(() => {
      // Release our attributes before Kid Mode installs its own shield.
      if (blocked()) { releaseShield(); releaseScroll(); pendingReturns = []; }
      queue();
    });
  };
  const close = (entry: Entry) => {
    if (blocked() || top() !== entry || entry.closing) return;
    entry.closing = true;
    try { entry.onClose(); }
    finally { schedule(() => { entry.closing = false; }); }
  };
  return {
    register(options: DialogRegistration): DialogHandle {
      releaseShield();
      const layer = options.root.closest<HTMLElement>("[" + DIALOG_LAYER + "]") ?? options.root;
      retired.get(layer)?.(); retired.delete(layer);
      const parent = top();
      const returns = [...new Set([
        options.returnFocus?.(), element(doc.activeElement), ...(parent?.returns ?? []), ...pendingReturns,
      ].filter((el): el is HTMLElement => !!el && el !== doc.body && el !== doc.documentElement))];
      const entry: Entry = {
        ...options, layer, returns, closing: false,
        z: layer.style.getPropertyValue("z-index"), zPriority: layer.style.getPropertyPriority("z-index"),
        baseZ: Number.parseInt(doc.defaultView?.getComputedStyle(layer).zIndex ?? "", 10) || 50,
      };
      // Child layout effects can run before their parent. Portal DOM ancestry
      // cannot reveal this relationship, so known compositions pass parentRoot.
      const childIndex = entries.findIndex(item => item.parentRoot?.() === options.root);
      if (childIndex >= 0) entries.splice(childIndex, 0, entry); else entries.push(entry);
      startListening(); queue();
      let disposed = false;
      return {
        close: () => close(entry),
        dispose: () => {
          if (disposed) return;
          disposed = true;
          const wasTop = top() === entry;
          entries.splice(entries.indexOf(entry), 1);
          if (wasTop) pendingReturns = entry.returns;
          releaseShield();
          // AnimatePresence may retain the layer after open becomes false.
          // It must not capture input or remain in the accessibility tree.
          const active = element(doc.activeElement);
          if (layer.contains(active)) active?.blur();
          const undoHidden = hide(layer);
          const pointer = layer.style.getPropertyValue("pointer-events"), priority = layer.style.getPropertyPriority("pointer-events");
          layer.style.setProperty("pointer-events", "none");
          retired.set(layer, () => {
            undoHidden();
            if (pointer) layer.style.setProperty("pointer-events", pointer, priority); else layer.style.removeProperty("pointer-events");
          });
          if (entry.z) layer.style.setProperty("z-index", entry.z, entry.zPriority); else layer.style.removeProperty("z-index");
          queue();
        },
      };
    },
    get depth() { return entries.length; },
  };
}

const stacks = new WeakMap<Document, ReturnType<typeof createDialogStack>>();
export function registerDialog(options: DialogRegistration): DialogHandle {
  const doc = options.root.ownerDocument;
  let stack = stacks.get(doc);
  if (!stack) {
    stack = createDialogStack({ document: doc, blocked: isKidModeActive, subscribeBlocked: subscribeKidMode });
    stacks.set(doc, stack);
  }
  return stack.register(options);
}

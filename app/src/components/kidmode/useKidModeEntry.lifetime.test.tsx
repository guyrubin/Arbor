/** Executes the actual entry hook and button with deterministic React hook slots.
 * SDK, hero generation, narration and persistence boundaries are synthetic.
 * This proves callback/lifetime behavior, not browser focus or rendering. */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactElement } from "react";
import type { ChildProfile } from "../../types";

const h = vi.hoisted(() => ({
  child: null as ChildProfile | null, locked: false, cursor: 0,
  slots: [] as { value?: any; deps?: unknown[]; cleanup?: () => void }[], effects: [] as (() => void)[],
  listeners: new Set<(active: boolean) => void>(),
  open: vi.fn(), beforeOpen: vi.fn(), sheet: vi.fn(), narration: vi.fn(), persist: vi.fn(),
}));
vi.mock("react", async (importOriginal) => ({
  ...await importOriginal<typeof import("react")>(),
  useState(initial: unknown) {
    const i = h.cursor++, slot = h.slots[i] ??= { value: typeof initial === "function" ? initial() : initial };
    return [slot.value, (next: any) => { slot.value = typeof next === "function" ? next(slot.value) : next; }];
  },
  useRef(initial: unknown) { const i = h.cursor++; return (h.slots[i] ??= { value: { current: initial } }).value; },
  useEffect(effect: () => void | (() => void), deps: unknown[]) {
    const i = h.cursor++, old = h.slots[i];
    if (old?.deps && deps.length === old.deps.length && deps.every((value, n) => Object.is(value, old.deps![n]))) return;
    const slot = h.slots[i] = { deps, cleanup: old?.cleanup };
    h.effects.push(() => { slot.cleanup?.(); slot.cleanup = effect() || undefined; });
  },
}));
vi.mock("../../context/ArborContext", () => ({ useArborOptional: () => h.child ? { childProfile: h.child } : null }));
vi.mock("../../context/LanguageContext", () => ({ useLanguage: () => ({ t: (key: string) => key, uiLang: "en", aiLang: "en" }) }));
vi.mock("../../context/ProfileContext", () => ({ useProfile: () => ({ updateChild: vi.fn() }) }));
vi.mock("../../context/ToastContext", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("../../lib/kidModeGate", () => ({
  isKidModeActive: () => h.locked,
  subscribeKidMode: (listener: (active: boolean) => void) => { h.listeners.add(listener); return () => h.listeners.delete(listener); },
}));
vi.mock("./KidModeContext", () => ({ useKidMode: () => ({ openKidMode: h.open, isKidModeOpen: h.locked }) }));
vi.mock("../ui/HeroAvatar", () => ({ resolveHeroUrl: (child: ChildProfile) => child.photoUrl || null }));
vi.mock("./HeroFirstStep", () => ({ default: () => null }));
vi.mock("./parentGate", () => ({ readParentPin: () => "" }));
vi.mock("./hero/buildHeroSheet", () => ({ ensureHeroSheet: h.sheet }));
vi.mock("./hero/buildBookNarration", () => ({ ensureBookNarration: h.narration, narrationFolder: () => "en" }));
vi.mock("./hero/useHeroSheet", () => ({ PROOF_HERO_CHILD_IDS: [] }));
vi.mock("../../lib/heroJourneys", () => ({ storyLanguage: () => "en" }));
vi.mock("../ui/Icon", () => ({ Icon: () => null }));
vi.mock("../profile/AvatarCreator", () => ({ default: () => null }));
vi.mock("../profile/heroPersistence", () => ({ persistHero: h.persist }));

import { useKidModeEntry } from "./useKidModeEntry";
import { resetHeroStepMemory, wasHeroStepOffered } from "./heroPromptGate";
import KidModeButton from "../layout/KidModeButton";
import HeroCreateDialog from "../profile/HeroCreateDialog";

const child = (id: string, age = 5, photoUrl?: string): ChildProfile => ({
  id, name: id, age, languages: ["English"], schoolContext: "", strengths: [], challenges: [], photoUrl,
});
type StepProps = { open: boolean; childId: string; onEnterKidMode: () => void; onClose: () => void };
const render = () => { h.cursor = 0; return useKidModeEntry(h.beforeOpen); };
const commit = () => { for (const effect of h.effects.splice(0)) effect(); };
const unmount = () => { for (const slot of h.slots) slot.cleanup?.(); };
const gate = (active: boolean) => { h.locked = active; for (const listener of h.listeners) listener(active); };
const props = (step: ReactElement | null) => step?.props as StepProps | undefined;
const begin = () => { const entry = render(); commit(); entry.request({ view: "arcade", worldId: "sneak-freeze" }); return props(render().step)!; };
const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };
function elements(value: any): any[] {
  if (Array.isArray(value)) return value.flatMap(elements);
  if (!value || typeof value !== "object") return [];
  return [value, ...elements(value.props?.children)];
}

beforeEach(() => {
  vi.clearAllMocks(); resetHeroStepMemory(); h.child = child("child-a"); h.locked = false;
  h.cursor = 0; h.slots = []; h.effects = []; h.listeners.clear();
  h.open.mockImplementation(() => gate(true)); h.persist.mockResolvedValue(true);
});

describe("existing handover behavior", () => {
  it("keeps hero-first, the selected world, and the mobile close after parent continuation", () => {
    const step = begin(); expect(step.open).toBe(true); expect(step.childId).toBe("child-a");
    expect(h.beforeOpen).not.toHaveBeenCalled(); expect(h.open).not.toHaveBeenCalled();
    step.onEnterKidMode(); expect(h.beforeOpen).toHaveBeenCalledTimes(1);
    expect(h.open).toHaveBeenCalledExactlyOnceWith({ view: "arcade", worldId: "sneak-freeze" });
    expect(h.sheet).not.toHaveBeenCalled(); expect(h.narration).not.toHaveBeenCalled(); expect(h.persist).not.toHaveBeenCalled();
  });
  it("opens immediately for an existing hero and keeps the no-nag rule after cancellation", () => {
    h.child = child("with-hero", 5, "synthetic-hero"); const entry = render(); commit(); entry.request({ view: "journeys" });
    expect(h.open).toHaveBeenCalledExactlyOnceWith({ view: "journeys" }); gate(false); h.open.mockClear();
    h.child = child("child-a"); const step = begin(); step.onClose(); render().request({ view: "home" });
    expect(wasHeroStepOffered("child-a")).toBe(true); expect(h.open).toHaveBeenCalledExactlyOnceWith({ view: "home" });
  });
  it("allows a same-child hero save/profile refresh to complete the current handover", () => {
    const step = begin(); h.child = { ...h.child!, photoUrl: "new-hero" }; render(); step.onEnterKidMode();
    expect(h.open).toHaveBeenCalledTimes(1);
  });
  it.each([true, false])("preserves the actual hero save confirmation result (%s)", async (saved) => {
    const step = begin(); h.persist.mockResolvedValue(saved);
    const dialog = HeroCreateDialog({ open: true, childId: "child-a", childName: "A", onClose: vi.fn(), onSaved: step.onEnterKidMode });
    (dialog.props as { onCreated: (result: unknown) => void }).onCreated({}); await flush();
    expect(h.open).toHaveBeenCalledTimes(saved ? 1 : 0);
  });
});

describe("entry lifetime and final admission", () => {
  it.each(["missing", "under-three", "locked"])("fails closed at request for %s scope", (scope) => {
    if (scope === "missing") h.child = null;
    if (scope === "under-three") h.child = child("toddler", 2);
    if (scope === "locked") gate(true);
    const entry = render(); commit(); entry.request();
    expect(props(render().step)?.open ?? false).toBe(false); expect(h.open).not.toHaveBeenCalled();
    expect(h.beforeOpen).not.toHaveBeenCalled(); if (h.child) expect(wasHeroStepOffered(h.child.id)).toBe(false);
  });
  it("does not let a duplicate request skip the open hero step", () => {
    const entry = render(); commit(); entry.request({ view: "arcade" }); entry.request({ view: "home" });
    expect(h.open).not.toHaveBeenCalled(); props(render().step)!.onEnterKidMode();
    expect(h.open).toHaveBeenCalledExactlyOnceWith({ view: "arcade" });
  });
  it("invalidates visible and captured continuations at A→B before effect cleanup", () => {
    const step = begin(); h.child = child("child-b"); const b = render();
    expect(props(b.step)?.open ?? false).toBe(false); step.onEnterKidMode();
    expect(h.open).not.toHaveBeenCalled(); expect(h.beforeOpen).not.toHaveBeenCalled();
  });
  it("cannot resurrect A's old step after A→B→A", () => {
    const step = begin(); h.child = child("child-b"); render(); h.child = child("child-a");
    expect(props(render().step)?.open ?? false).toBe(false); step.onEnterKidMode(); expect(h.open).not.toHaveBeenCalled();
  });
  it("rejects a captured request from a previous child", () => {
    const a = render(); commit(); h.child = child("child-b"); render(); a.request();
    expect(props(render().step)?.open ?? false).toBe(false); expect(h.open).not.toHaveBeenCalled();
    expect(wasHeroStepOffered("child-a")).toBe(false);
  });
  it.each(["age corrected", "profile removed"])("retires an existing hero step when %s", (change) => {
    const step = begin(); h.child = change === "age corrected" ? child("child-a", 2) : null; render(); step.onEnterKidMode();
    expect(h.open).not.toHaveBeenCalled(); expect(h.beforeOpen).not.toHaveBeenCalled();
  });
  it("a cancelled callback cannot reopen Kid Mode or cancel a sibling's new step", () => {
    const a = begin(); a.onClose(); a.onEnterKidMode(); expect(h.open).not.toHaveBeenCalled();
    h.child = child("child-b"); const b = begin(); a.onClose(); a.onEnterKidMode();
    expect(props(render().step)?.open).toBe(true); b.onEnterKidMode(); expect(h.open).toHaveBeenCalledTimes(1);
  });
  it("an external lock retires pending parent UI even if Kid Mode exits before rerender", () => {
    const step = begin(); gate(true); gate(false);
    expect(props(render().step)?.open ?? false).toBe(false); step.onEnterKidMode(); expect(h.open).not.toHaveBeenCalled();
  });
  it("rechecks the actual gate and age at continuation, without relying on another render", () => {
    const step = begin(); h.locked = true; step.onEnterKidMode(); expect(h.open).not.toHaveBeenCalled();
    h.locked = false; h.child!.age = 2; step.onEnterKidMode(); expect(h.open).not.toHaveBeenCalled();
  });
  it("consumes a continuation once even if called again after exiting Kid Mode", () => {
    const step = begin(); step.onEnterKidMode(); gate(false); step.onEnterKidMode(); expect(h.open).toHaveBeenCalledTimes(1);
  });
  it("retires captured requests and continuations on auth/profile-gate or route unmount", () => {
    const entry = render(); commit(); entry.request(); const step = props(render().step)!; unmount();
    step.onEnterKidMode(); entry.request(); expect(h.open).not.toHaveBeenCalled(); expect(h.listeners.size).toBe(0);
  });
  it.each(["child switch", "cancel", "unmount", "eligibility loss"])("rejects the real HeroCreateDialog's delayed saved callback after %s", async (change) => {
    const step = begin(); let resolve!: (saved: boolean) => void;
    h.persist.mockReturnValue(new Promise<boolean>(done => { resolve = done; }));
    const dialog = HeroCreateDialog({ open: true, childId: "child-a", childName: "A", onClose: vi.fn(), onSaved: step.onEnterKidMode });
    (dialog.props as { onCreated: (result: unknown) => void }).onCreated({});
    if (change === "child switch") { h.child = child("child-b"); render(); }
    if (change === "cancel") step.onClose();
    if (change === "unmount") unmount();
    if (change === "eligibility loss") { h.child = child("child-a", 2); render(); }
    resolve(true); await flush();
    expect(h.persist).toHaveBeenCalledTimes(1); expect(h.open).not.toHaveBeenCalled();
  });
});

describe("actual persistent parent button", () => {
  it("cannot retain A's hero step when the live button hides for toddler B", () => {
    h.cursor = 0; const first = KidModeButton({ compact: false }); commit();
    elements(first).find(element => element.type === "button").props.onClick();
    h.cursor = 0; const pending = elements(KidModeButton({ compact: false })).find(element => element.props?.onEnterKidMode);
    expect(pending.props.open).toBe(true);
    h.child = child("child-b", 2); h.cursor = 0; const next = KidModeButton({ compact: false });
    expect(elements(next).some(element => element.type === "button")).toBe(false);
    expect(elements(next).some(element => element.props?.open)).toBe(false);
    pending.props.onEnterKidMode(); expect(h.open).not.toHaveBeenCalled();
  });
});

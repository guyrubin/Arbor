/**
 * B-SHELL-44 (critic round 1, P2e) — the Edit child drawer's actual handlers:
 * a failed save keeps every edit on screen and a retry writes the same values
 * once; switching the active child while the drawer is open re-reads the new
 * child and writes only to it. The production component runs through a
 * repository-style hook harness (the QuickLogModal.lifecycle pattern): real
 * state, effects and save path, with the contexts and the network stubbed. It
 * makes no DOM, focus or animation claim.
 */
import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";
import * as childAge from "../../lib/childAge";
import * as factsAsOf from "../../lib/factsAsOf";
import * as storyName from "../../lib/storyName";
import * as playbank from "../../playbank/select";
import * as choices from "../../lib/childProfileChoices";
import { translate } from "../../lib/i18n";

const source = readFileSync(resolve(process.cwd(), "src/components/profile/ProfileEditDrawer.tsx"), "utf8");
const code = ts.transpileModule(source, { compilerOptions: {
  module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React, esModuleInterop: true,
} }).outputText;

type View = { type: unknown; props: Record<string, any> };
function renderer(imports: Record<string, unknown>) {
  const slots: any[] = [];
  let cursor = 0, dirty = false, effects: (() => void)[] = [];
  const same = (a?: unknown[], b?: unknown[]) => !!a && !!b && a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
  const react = {
    createElement: (type: unknown, attrs: any, ...children: any[]): View => ({ type, props: { ...attrs, children } }),
    Fragment: "fragment",
    useState: (initial: any) => {
      const index = cursor++;
      if (!(index in slots)) slots[index] = typeof initial === "function" ? initial() : initial;
      return [slots[index], (next: any) => {
        const value = typeof next === "function" ? next(slots[index]) : next;
        if (!Object.is(value, slots[index])) { slots[index] = value; dirty = true; }
      }];
    },
    useRef: (initial: any) => { const index = cursor++; return slots[index] ??= { current: initial }; },
    useEffect: (callback: () => void | (() => void), deps?: unknown[]) => {
      const index = cursor++, previous = slots[index];
      if (!previous || !same(previous.deps, deps)) {
        const slot = { deps, cleanup: undefined as void | (() => void) };
        slots[index] = slot;
        effects.push(() => { previous?.cleanup?.(); slot.cleanup = callback(); });
      }
    },
  };
  const module = { exports: {} as { default: (props: any) => any } };
  // `document` is only the portal target here (createPortal is stubbed).
  new Function("require", "module", "exports", "document", code)((name: string) => {
    if (name === "react") return { __esModule: true, default: react, ...react };
    if (!(name in imports)) throw new Error(`Unmocked boundary: ${name}`);
    return imports[name];
  }, module, module.exports, { body: {} });
  return (props: any) => {
    for (let i = 0; i < 20; i++) {
      cursor = 0; dirty = false; effects = [];
      const tree = module.exports.default(props);
      effects.forEach((run) => run());
      if (!dirty) return tree as View;
    }
    throw new Error("Unbounded rerenders");
  };
}
const nodes = (tree: any): View[] => Array.isArray(tree) ? tree.flatMap(nodes)
  : !tree || typeof tree !== "object" || !("props" in tree) ? [] : [tree, ...nodes(tree.props.children)];
const text = (tree: any): string => Array.isArray(tree) ? tree.map(text).join("")
  : tree == null || typeof tree === "boolean" ? "" : typeof tree === "object" ? text(tree.props?.children) : String(tree);
const tick = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };

const childA = Object.freeze({ id: "child-a", name: "Noa", age: 4, ageMonths: 50, schoolContext: "Gan", languages: ["Hebrew"], strengths: ["Kind"], challenges: ["Sleep & Routines", "Needs a quiet corner"], interests: [] });
const childB = Object.freeze({ id: "child-b", name: "Ari", age: 6, ageMonths: 74, schoolContext: "Grade 1", languages: ["English", "Deutsch"], strengths: [], challenges: ["Likes a warning"], interests: [] });

function harness() {
  const state = { child: childA as Record<string, any> };
  const updateChild = vi.fn();
  const toast = vi.fn(), onClose = vi.fn();
  const ChildLanguageChoices = function ChildLanguageChoices() { return null; };
  const ChildFocusChoices = function ChildFocusChoices() { return null; };
  const stub = () => null;
  const render = renderer({
    "../../hooks/useDialog": { useDialog: () => ({ ref: { current: null }, requestClose: onClose, onBackdropClick: onClose }) },
    "react-dom": { createPortal: (node: unknown) => node },
    "motion/react": { motion: { div: "div" }, AnimatePresence: function AnimatePresence() { return null; } },
    "../../context/ProfileContext": { useProfile: () => ({ activeChild: state.child, updateChild }) },
    "../../context/AuthContext": { useAuth: () => ({ user: null }) },
    "../../context/ToastContext": { useToast: () => ({ toast }) },
    "../../context/LanguageContext": { useLanguage: () => ({ t: (key: string, vars?: Record<string, string | number>) => translate("en", key, vars), uiLang: "en" }) },
    "../layout/settingsBus": { requestOpenSettings: vi.fn() },
    "../../types": {},
    "../ui/Avatar": { Avatar: stub },
    "../ui/Icon": { Icon: stub },
    "../../lib/image": { fileToThumbnail: vi.fn() },
    "../../lib/storage": { uploadChildPhoto: vi.fn() },
    "../../playbank/select": playbank,
    "../../lib/formatDate": { fmtDay: () => "" },
    "../../lib/childAge": childAge,
    "./AvatarCreator": { __esModule: true, default: stub },
    "./HeroSheetPanel": { __esModule: true, default: stub },
    "./RewardsCard": { __esModule: true, default: stub },
    "../../lib/factsAsOf": factsAsOf,
    "../../lib/childPicture": { childPicture: () => ({ url: null }) },
    "../../lib/storyName": storyName,
    "./AddChildFields": { ChildLanguageChoices, ChildFocusChoices },
    "../../lib/childProfileChoices": choices,
  });
  const view = () => render({ open: true, onClose });
  const languages = () => nodes(view()).find((n) => n.type === ChildLanguageChoices)!;
  const focus = () => nodes(view()).find((n) => n.type === ChildFocusChoices)!;
  const saveButton = () => nodes(view()).find((n) => n.type === "button" && text(n) === translate("en", "profile.edit.save"))!;
  return { state, updateChild, toast, onClose, view, languages, focus, saveButton, ChildLanguageChoices };
}

describe("B-SHELL-44 · Edit child drawer — failure, retry and child switch (actual handlers)", () => {
  it("a failed save keeps the edits and the drawer open; Retry writes the same values once", async () => {
    const h = harness();
    h.languages().props.onChange(choices.toggleLanguage(h.languages().props.value, "Arabic"));
    h.focus().props.onChange(choices.toggleChoice(h.focus().props.value, choices.focusAliases("ob.step.domains.feelings"), "Big Feelings"));
    h.updateChild.mockResolvedValueOnce(null).mockResolvedValueOnce({ ok: true });
    await h.saveButton().props.onClick(); await tick();
    expect(h.toast).toHaveBeenCalledWith(translate("en", "elev.hero.saveProfile.failed"), "error");
    expect(h.onClose).not.toHaveBeenCalled();
    expect(h.languages().props.value).toEqual(["Hebrew", "Arabic"]);
    expect(h.saveButton().props.disabled).toBe(false);
    await h.saveButton().props.onClick(); await tick();
    expect(h.updateChild).toHaveBeenCalledTimes(2);
    const [firstId, first] = h.updateChild.mock.calls[0];
    const [retryId, retry] = h.updateChild.mock.calls[1];
    expect(firstId).toBe("child-a"); expect(retryId).toBe("child-a");
    expect(retry.languages).toEqual(["Hebrew", "Arabic"]);
    expect(retry.challenges).toEqual(["Sleep & Routines", "Needs a quiet corner", "Big Feelings"]);
    expect(retry.languages).toEqual(first.languages);
    expect(retry.challenges).toEqual(first.challenges);
    expect(h.onClose).toHaveBeenCalledTimes(1);
  });

  it("an untouched save writes the stored arrays exactly and stamps no fact as changed", async () => {
    const h = harness();
    h.updateChild.mockResolvedValueOnce({ ok: true });
    await h.saveButton().props.onClick(); await tick();
    const [, patch] = h.updateChild.mock.calls[0];
    expect(patch.languages).toEqual(childA.languages);
    expect(patch.challenges).toEqual(childA.challenges);
    expect(patch.factsAsOf).toEqual({});
  });

  it("switching the active child while the drawer is open re-reads the new child; Save writes only that child", async () => {
    const h = harness();
    h.languages().props.onChange(choices.toggleLanguage(h.languages().props.value, "Arabic"));
    expect(h.languages().props.value).toEqual(["Hebrew", "Arabic"]);
    h.state.child = childB;
    expect(h.languages().props.value).toEqual(["English", "Deutsch"]);
    expect(h.focus().props.value).toEqual(["Likes a warning"]);
    h.updateChild.mockResolvedValueOnce({ ok: true });
    await h.saveButton().props.onClick(); await tick();
    expect(h.updateChild).toHaveBeenCalledTimes(1);
    const [id, patch] = h.updateChild.mock.calls[0];
    expect(id).toBe("child-b");
    expect(patch.languages).toEqual(["English", "Deutsch"]);
    expect(patch.challenges).toEqual(["Likes a warning"]);
    expect(JSON.stringify(patch)).not.toContain("Arabic");
  });
});

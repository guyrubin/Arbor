import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import ts from "typescript";

const source = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
type View = { type: string; props: Record<string, any> };

/** Runs production render props and callbacks with inert I/O boundaries. This
 * is a layout-contract regression, not browser geometry or focus evidence. */
function renderComponent(path: string, rows: Record<string, any>[] = []) {
  let cursor = 0;
  const slots: any[] = [];
  const react = {
    createElement: (type: string, props: any, ...children: any[]): View => ({ type, props: { ...props, children } }),
    useState: (initial: any) => {
      const index = cursor++;
      if (!(index in slots)) slots[index] = initial;
      return [slots[index], (value: any) => { slots[index] = typeof value === "function" ? value(slots[index]) : value; }];
    },
    useRef: (value: any) => { const index = cursor++; return slots[index] ??= { current: value }; },
    useCallback: (callback: unknown) => callback,
    useEffect: () => {},
    useId: () => "dialog-title",
  };
  const imports: Record<string, unknown> = {
    react: { __esModule: true, default: react, ...react },
    "react-dom": { createPortal: (node: View) => node },
    "motion/react": { motion: { div: "div" }, AnimatePresence: "AnimatePresence" },
    "../../hooks/useDialog": { useDialog: ({ onClose }: any) => ({ ref: null, requestClose: onClose, onBackdropClick: vi.fn() }) },
    "../../context/LanguageContext": { useLanguage: () => ({ t: (key: string) => key, uiLang: "he" }) },
    "../../lib/analytics": { track: vi.fn() },
    "../../lib/i18nElevation/searchnav": { searchnavText: (key: string) => key },
    "./Icon": { Icon: "Icon" },
    "../ui/Icon": { Icon: "Icon" },
    "../ui/Modal": { Modal: "Modal" },
    "./useSearchResults": { useSearchResults: () => ({ indexReady: true, ordered: rows, kindLabel: (kind: string) => kind }) },
  };
  const code = ts.transpileModule(source(path), { compilerOptions: {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true,
  } }).outputText;
  const module = { exports: {} as { default: (props: any) => View } };
  new Function("require", "module", "exports", "document", code)((name: string) => {
    if (!(name in imports)) throw new Error(`Unmocked boundary: ${name}`);
    return imports[name];
  }, module, module.exports, { body: {} });
  return (props = {}) => { cursor = 0; return module.exports.default(props); };
}

function elements(node: any): View[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!node || typeof node !== "object" || !node.props) return [];
  return [node, ...elements(node.props.children)];
}
const classes = (node: View) => (node.props.className ?? "").split(/\s+/);
const find = (tree: View, predicate: (view: View) => boolean) => {
  const found = elements(tree).filter(predicate);
  expect(found).toHaveLength(1);
  return found[0];
};

describe("verified Parent control-clearance regressions", () => {
  it("lets the capture title wrap with a real gap and a non-shrinking Close", () => {
    const close = vi.fn();
    const render = renderComponent("./Modal.tsx");
    const tree = render({ open: true, onClose: close, title: "Tell Arbor what's happening" });
    const title = find(tree, node => node.type === "h3");
    const header = find(tree, node => node.props.children?.includes(title));
    const button = find(tree, node => node.props["aria-label"] === "aria.close");
    expect(classes(header)).toContain("gap-3");
    expect(classes(title)).toEqual(expect.arrayContaining(["min-w-0", "flex-1", "break-words"]));
    expect(classes(title)).not.toContain("truncate");
    expect(classes(button)).toEqual(expect.arrayContaining(["touch-target", "shrink-0"]));
    expect(button.props.style).toMatchObject({ minWidth: "var(--touch-min)", minHeight: "var(--touch-min)" });
    button.props.onClick();
    expect(close).toHaveBeenCalledOnce();
    expect(find(render({ open: true, onClose: close }), node => node.props["aria-label"] === "aria.close")).toBeDefined();
  });

  it("reserves the bookmark's full height above Learn titles in either text direction", () => {
    const learn = source("../sections/LearnLibrary.tsx");
    const card = learn.slice(learn.indexOf("function LearnGridCard("), learn.indexOf("function LearnReader("));
    const metadata = (text: string) => text.match(/className="([^"]*flex-wrap pe-12)"/)?.[1].split(/\s+/) ?? [];
    expect(metadata(card)).toContain("min-h-11");
    // Non-vacuous: the reviewed one-line metadata previously left the title
    // inside the 44px bookmark's footprint.
    expect(metadata(card.replace("flex min-h-11 items-center", "flex items-center"))).not.toContain("min-h-11");
    expect(card).toContain('className="absolute top-2.5 end-2.5"');
    expect(card).toContain('variant="inline"');
    expect(card).toContain('surface="learn-card"');
    expect(card).toMatch(/<h3[^>]+dir="auto"/);
    expect(card.indexOf("</button>")).toBeLessThan(card.indexOf("<ContentActionBar"));
  });

  it("keeps one explicit 44px Clear while suppressing only the native duplicate", () => {
    const render = renderComponent("../search/TopbarSearch.tsx");
    let tree = render();
    const input = () => find(tree, node => node.type === "input");
    expect(input().props.type).toBe("search");
    expect(input().props.role).toBe("combobox");
    input().props.onChange({ target: { value: "Café" } });
    tree = render();
    const focus = vi.fn(), blur = vi.fn();
    input().props.ref.current = { focus, blur };
    const clear = find(tree, node => node.props["aria-label"] === "aria.clearSearch");
    expect(classes(clear)).toEqual(expect.arrayContaining(["touch-target", "w-11", "h-11"]));
    expect(clear.props.type).toBe("button");
    expect(classes(input())).toContain("arbor-topbar-search-input");
    const css = source("../../index.css");
    const nativeCancelRule = css.match(/\.arbor-app input\.arbor-topbar-search-input::-webkit-search-cancel-button\s*\{([^}]+)\}/)?.[1];
    expect(nativeCancelRule).toContain("display: none;");
    expect(nativeCancelRule).toContain("-webkit-appearance: none;");
    expect(css).toMatch(/--touch-min:\s*44px/);
    const preventDefault = vi.fn();
    clear.props.onClick({ preventDefault });
    tree = render();
    expect(preventDefault).toHaveBeenCalledOnce();
    expect(focus).toHaveBeenCalledOnce();
    expect(input().props.value).toBe("");
    expect(input().props["aria-expanded"]).toBe(false);
    expect(elements(tree).filter(node => node.props["aria-label"] === "aria.clearSearch")).toHaveLength(0);
    input().props.onChange({ target: { value: "visits" } });
    tree = render();
    input().props.onKeyDown({ key: "Escape" });
    tree = render();
    expect(blur).toHaveBeenCalledOnce();
    expect(input().props.value).toBe("");
    expect(input().props["aria-expanded"]).toBe(false);
  });

  it.each(["TopbarSearch", "SearchModal"])("mirrors only route arrows in %s and preserves navigation", surface => {
    const go = vi.fn(), close = vi.fn();
    const rows = [
      { id: "visits", kind: "route", icon: "arrow_forward", label: "Appointments", sub: "My child", go },
      { id: "article", kind: "learn", icon: "school", label: "Learn", sub: "Read", go: vi.fn() },
    ];
    const render = renderComponent(`../search/${surface}.tsx`, rows);
    let tree = render({ open: true, onClose: close });
    find(tree, node => node.type === "input").props.onChange({ target: { value: "visits" } });
    tree = render({ open: true, onClose: close });
    expect(classes(find(tree, node => node.type === "Icon" && node.props.name === "arrow_forward"))).toContain("rtl:-scale-x-100");
    expect(classes(find(tree, node => node.type === "Icon" && node.props.name === "school"))).not.toContain("rtl:-scale-x-100");
    find(tree, node => node.type === "input").props.onKeyDown({ key: "Enter", preventDefault: vi.fn() });
    expect(go).toHaveBeenCalledOnce();
    if (surface === "SearchModal") expect(close).toHaveBeenCalledOnce();
  });
});

/** v3 IA-05 — both search surfaces list rows under their home and mirror only
 * glyphs that point a way. Runs the production render functions with inert
 * I/O boundaries (the parentControlClearance harness): a layout and wiring
 * contract, not browser geometry. Invented rows only. */
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import ts from "typescript";

const source = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
type View = { type: string; props: Record<string, any> };

function renderComponent(path: string, rows: Record<string, any>[]) {
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
    "../../context/LanguageContext": { useLanguage: () => ({ t: (key: string) => key, uiLang: "he" }) },
    "../../lib/analytics": { track: vi.fn() },
    "../../lib/i18nElevation/searchnav": { searchnavText: (key: string) => key },
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
function text(node: any): string {
  if (Array.isArray(node)) return node.map(text).join("");
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (!node || typeof node !== "object" || !node.props) return "";
  return text(node.props.children);
}
const classes = (node: View) => (node.props.className ?? "").split(/\s+/).filter(Boolean);
const icons = (tree: View, name?: string) => elements(tree).filter(node => node.type === "Icon" && (!name || node.props.name === name));

const SURFACES = ["SearchModal", "TopbarSearch"] as const;
/** Opens the surface and types a query, so the rows are on screen. */
function typed(surface: typeof SURFACES[number], rows: Record<string, any>[], close = vi.fn()) {
  const render = renderComponent(`./${surface}.tsx`, rows);
  let tree = render({ open: true, onClose: close });
  elements(tree).find(node => node.type === "input")!.props.onChange({ target: { value: "invented" } });
  tree = render({ open: true, onClose: close });
  return { render: () => (tree = render({ open: true, onClose: close })), tree: () => tree, close };
}
/** The row elements in render order: unlabelled buttons in the modal, options
 *  in the topbar (the topbar's labelled Clear button is not a row). */
const rowsOf = (tree: View) => elements(tree).filter(node => node.props.role === "option" || (node.type === "button" && !node.props["aria-label"]));

const CHILD = { id: "child", label: "My child", icon: "eco" };
const LEARN = { id: "learn", label: "For you, the parent", icon: "school" };
const grouped = () => [
  { id: "route:milestones", kind: "route", icon: "eco", label: "Milestones", sub: "My child", group: CHILD, crumb: ["My child", "Milestones"], go: vi.fn() },
  { id: "learn:invented", kind: "learn", icon: "school", label: "Invented article", sub: "Invented shelf", group: LEARN, go: vi.fn() },
  { id: "route:journal", kind: "route", icon: "eco", label: "Journal", sub: "My child", group: CHILD, crumb: ["My child", "Journal"], go: vi.fn() },
  { id: "ask", kind: "ask", icon: "forum", label: "Ask Arbor about invented", sub: "Ask", go: vi.fn() },
];

describe("v3 IA-05 · only directional glyphs mirror", () => {
  const NEVER = ["eco", "interests", "forum", "school", "diversity_1", "home", "lightbulb", "volunteer_activism"];
  const ALWAYS = ["arrow_forward", "arrow_back", "chevron_right", "chevron_left"];

  it.each(SURFACES)("%s: a place or door glyph never flips in Hebrew, even on a route row; an arrow always does", (surface) => {
    const rows = [...NEVER, ...ALWAYS].map((icon, i) => ({ id: "r" + i, kind: i % 2 ? "route" : "learn", icon, label: "Invented " + i, sub: "Invented", go: vi.fn() }));
    const { tree } = typed(surface, rows);
    for (const icon of NEVER) {
      const found = icons(tree(), icon);
      expect(found, icon).toHaveLength(1);
      expect(classes(found[0]), icon).not.toContain("rtl:-scale-x-100");
    }
    for (const icon of ALWAYS) {
      const found = icons(tree(), icon);
      expect(found, icon).toHaveLength(1);
      expect(classes(found[0]), icon).toContain("rtl:-scale-x-100");
    }
  });

  it("both surfaces declare the identical directional list, and the kind rule is gone", () => {
    const listOf = (src: string) => src.match(/const glyphMirror = \(glyph: string\) => \(\[([^\]]+)\]\.includes\(glyph\) \? "rtl:-scale-x-100" : undefined\);/)?.[1];
    const modal = listOf(source("./SearchModal.tsx")), topbar = listOf(source("./TopbarSearch.tsx"));
    expect(modal).toBeDefined();
    expect(topbar).toBe(modal);
    const list = JSON.parse(`[${modal}]`) as string[];
    expect(list).toEqual(expect.arrayContaining(["arrow_forward", "arrow_back", "chevron_right", "chevron_left"]));
    for (const glyph of NEVER) expect(list).not.toContain(glyph);
    // Every listed glyph is in the shipped font subset (no new glyphs).
    const subset = new Set(source("../../../public/fonts/material-symbols-rounded-subset.icons.txt").split(/\r?\n/).map(line => line.trim()));
    for (const glyph of list) expect(subset.has(glyph), glyph).toBe(true);
    // NEGATIVE CONTROL: the previous rule mirrored by row kind, which flipped
    // a route row's home glyph (eco) in Hebrew.
    for (const src of [source("./SearchModal.tsx"), source("./TopbarSearch.tsx")]) {
      expect(src).not.toMatch(/kind === "route" \? "rtl:-scale-x-100"/);
    }
    const oldRule = (row: { kind: string }) => (row.kind === "route" ? "rtl:-scale-x-100" : undefined);
    expect(oldRule({ kind: "route" })).toBe("rtl:-scale-x-100");
  });
});

describe("v3 IA-05 · rows are listed under their home", () => {
  it.each(SURFACES)("%s: one labelled group per home, its glyph in the header, in the order homes first appear", (surface) => {
    const { tree } = typed(surface, grouped());
    const groups = elements(tree()).filter(node => node.props.role === "group");
    expect(groups.map(group => group.props["aria-label"])).toEqual(["My child", "For you, the parent"]);
    for (const [group, home] of [[groups[0], CHILD], [groups[1], LEARN]] as const) {
      const header = elements(group).find(node => node.props["aria-hidden"] === "true")!;
      expect(header).toBeDefined();
      expect(classes(header)).toEqual(expect.arrayContaining(["text-xs", "font-bold"]));
      expect(header.props.style).toMatchObject({ color: "var(--arbor-muted)" });
      const glyph = icons(header);
      expect(glyph).toHaveLength(1);
      expect(glyph[0].props).toMatchObject({ name: home.icon, size: 18 });
      expect(classes(glyph[0])).not.toContain("rtl:-scale-x-100");
      expect(text(header)).toBe(home.label);
    }
    // Both My child rows sit together, before the For you row; the ask row has no group.
    expect(rowsOf(groups[0])).toHaveLength(2);
    expect(rowsOf(groups[1])).toHaveLength(1);
    const ask = rowsOf(tree()).find(node => node.props["data-testid"] === "search-ask-row")!;
    expect(groups.some(group => elements(group).includes(ask))).toBe(false);
    expect(rowsOf(tree()).at(-1)).toBe(ask);
  });

  it.each(SURFACES)("%s: rows stay 44 px and the crumb reads home › destination with one mirrored chevron per step", (surface) => {
    const { tree } = typed(surface, grouped());
    for (const node of rowsOf(tree())) {
      if (surface === "SearchModal") expect(classes(node)).toContain("min-h-[44px]");
      else expect(node.props.style).toMatchObject({ minHeight: "44px" });
    }
    const [milestones, journal, article] = rowsOf(tree());
    expect(text(milestones)).toContain("My childMilestones");
    const chevrons = icons(milestones, "chevron_right");
    expect(chevrons).toHaveLength(1);
    expect(chevrons[0].props.size).toBe(14);
    expect(classes(chevrons[0])).toContain("rtl:-scale-x-100");
    expect(icons(journal, "chevron_right")).toHaveLength(1);
    // A row without a crumb keeps its own second line.
    expect(icons(article, "chevron_right")).toHaveLength(0);
    expect(text(article)).toContain("Invented shelf");
    // A three-part crumb has two chevrons.
    const deep = typed(surface, [{ ...grouped()[0], crumb: ["My child", "Invented", "Milestones"] }]);
    expect(icons(rowsOf(deep.tree())[0], "chevron_right")).toHaveLength(2);
  });

  it("SearchModal: Enter runs the first row drawn, which is still the hook's first row", () => {
    const rows = grouped();
    const { tree, close } = typed("SearchModal", rows);
    const first = rowsOf(tree())[0];
    expect(icons(first, "keyboard_return")).toHaveLength(1);
    expect(icons(tree(), "keyboard_return")).toHaveLength(1);
    elements(tree()).find(node => node.type === "input")!.props.onKeyDown({ key: "Enter", preventDefault: vi.fn() });
    expect(rows[0].go).toHaveBeenCalledOnce();
    expect(close).toHaveBeenCalledOnce();
    // A click runs that row: render order is milestones, journal, article, ask.
    rowsOf(tree())[1].props.onClick();
    expect(rows[2].go).toHaveBeenCalledOnce();
    expect(rows[1].go).not.toHaveBeenCalled();
  });

  it("TopbarSearch: the arrow keys and Enter follow the grouped order, and option ids match it", () => {
    const rows = grouped();
    const view = typed("TopbarSearch", rows);
    const listbox = elements(view.tree()).find(node => node.props.role === "listbox")!;
    expect(elements(listbox).filter(node => node.props.role === "group")).toHaveLength(2);
    expect(rowsOf(view.tree()).map(node => node.props.id)).toEqual(["search-result-0", "search-result-1", "search-result-2", "search-result-3"]);
    for (const header of elements(listbox).filter(node => node.props["aria-hidden"] === "true" && node.props.role === "presentation")) {
      expect(rowsOf(header)).toHaveLength(0);
    }
    const input = () => elements(view.tree()).find(node => node.type === "input")!;
    input().props.onKeyDown({ key: "ArrowDown", preventDefault: vi.fn() });
    view.render();
    // Drawn second is Journal (the hook's third row), not the hook's second.
    expect(input().props["aria-activedescendant"]).toBe("search-result-1");
    const selected = rowsOf(view.tree()).find(node => node.props["aria-selected"] === true)!;
    expect(text(selected)).toContain("Journal");
    input().props.onKeyDown({ key: "Enter", preventDefault: vi.fn() });
    expect(rows[2].go).toHaveBeenCalledOnce();
    expect(rows[1].go).not.toHaveBeenCalled();
  });
});

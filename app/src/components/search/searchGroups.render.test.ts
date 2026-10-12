/** v3 IA-05 — both search surfaces list rows under their home and mirror only
 * glyphs that point a way. Runs the production render functions with inert
 * I/O boundaries (the parentControlClearance harness): a layout and wiring
 * contract, not browser geometry. Invented rows only.
 *
 * IA-05r: the sections and the mirror rule live once, in ./searchSections, and
 * are loaded here as the real module. The mirror test is behavioural (every
 * shipped glyph through both surfaces), and its negative control mutates the
 * production source back to the old kind rule.
 *
 * IA-05r round 2: a home's own row (Talk with Arbor under Talk with Arbor)
 * has no crumb and no sub, so neither surface draws a second line under it;
 * the negative control puts the always-drawn line back. */
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import ts from "typescript";
import * as searchSections from "./searchSections";
import { CRUMB_SPOKEN_SEPARATOR, DIRECTIONAL_GLYPHS } from "./searchSections";

const source = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
type View = { type: string; props: Record<string, any> };

function renderComponent(path: string, rows: Record<string, any>[], mutate: (src: string) => string = (src) => src) {
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
    // The real shared module: both surfaces lay rows out through it.
    "./searchSections": searchSections,
  };
  const code = ts.transpileModule(mutate(source(path)), { compilerOptions: {
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
function typed(surface: typeof SURFACES[number], rows: Record<string, any>[], close = vi.fn(), mutate?: (src: string) => string) {
  const render = renderComponent(`./${surface}.tsx`, rows, mutate);
  let tree = render({ open: true, onClose: close });
  elements(tree).find(node => node.type === "input")!.props.onChange({ target: { value: "invented" } });
  tree = render({ open: true, onClose: close });
  return { render: () => (tree = render({ open: true, onClose: close })), tree: () => tree, close };
}
/** The row elements in render order: unlabelled buttons in the modal, options
 *  in the topbar (the topbar's labelled Clear button is not a row). */
const rowsOf = (tree: View) => elements(tree).filter(node => node.props.role === "option" || (node.type === "button" && !node.props["aria-label"]));
/** A row's own glyph: the first icon drawn inside it. */
const leadingGlyph = (row: View) => icons(row)[0];
const mirrored = (glyph: View) => classes(glyph).includes("rtl:-scale-x-100");

const CHILD = { id: "child", label: "My child", icon: "eco" };
const LEARN = { id: "learn", label: "For you, the parent", icon: "school" };
const grouped = () => [
  { id: "route:milestones", kind: "route", icon: "eco", label: "Milestones", sub: "My child", group: CHILD, crumb: ["My child", "Milestones"], go: vi.fn() },
  { id: "learn:invented", kind: "learn", icon: "school", label: "Invented article", sub: "Invented shelf", group: LEARN, go: vi.fn() },
  { id: "route:journal", kind: "route", icon: "eco", label: "Journal", sub: "My child", group: CHILD, crumb: ["My child", "Journal"], go: vi.fn() },
  { id: "ask", kind: "ask", icon: "forum", label: "Ask Arbor about invented", sub: "Ask", go: vi.fn() },
];

/** Every glyph the shipped font carries (comments and blank lines dropped). */
const SHIPPED = source("../../../public/fonts/material-symbols-rounded-subset.icons.txt")
  .split(/\r?\n/).map(line => line.trim()).filter(line => line && !line.startsWith("#"));
/** Place, door and saved-question glyphs: never directional. */
const NEVER = ["eco", "interests", "forum", "school", "diversity_1", "home", "lightbulb", "volunteer_activism", "favorite"];

describe("v3 IA-05 · only directional glyphs mirror", () => {
  it("the directional list names arrows only, every one shipped in the font subset", () => {
    expect(DIRECTIONAL_GLYPHS).toEqual(expect.arrayContaining(["arrow_forward", "arrow_back", "chevron_right", "chevron_left"]));
    for (const glyph of NEVER) expect(DIRECTIONAL_GLYPHS).not.toContain(glyph);
    for (const glyph of DIRECTIONAL_GLYPHS) expect(SHIPPED, glyph).toContain(glyph);
  });

  it.each(SURFACES)("%s: across every shipped glyph, on route and content rows alike, exactly the directional ones flip", (surface) => {
    const rows = SHIPPED.flatMap((icon, i) => ["route", "learn"].map(kind => ({ id: `${kind}-${i}`, kind, icon, label: "Invented " + i, sub: "Invented", go: vi.fn() })));
    const { tree } = typed(surface, rows);
    const drawn = rowsOf(tree());
    expect(drawn).toHaveLength(rows.length);
    const flipped = new Set<string>();
    drawn.forEach((row, i) => {
      const glyph = leadingGlyph(row);
      expect(glyph.props.name).toBe(rows[i].icon);
      if (mirrored(glyph)) flipped.add(`${rows[i].kind}:${rows[i].icon}`);
    });
    const expected = SHIPPED.filter(icon => DIRECTIONAL_GLYPHS.includes(icon));
    expect([...flipped].sort()).toEqual(expected.flatMap(icon => [`learn:${icon}`, `route:${icon}`]).sort());
    for (const icon of NEVER) expect(flipped.has(`route:${icon}`), icon).toBe(false);
  });

  it.each([
    ["SearchModal", "className={glyphMirror(r.icon)}", 'className={r.kind === "route" ? "rtl:-scale-x-100" : undefined}'],
    ["TopbarSearch", "className={glyphMirror(entry.icon)}", 'className={entry.kind === "route" ? "rtl:-scale-x-100" : undefined}'],
  ] as const)("NEGATIVE CONTROL (%s): put the old kind rule back and a route row's place glyph flips in Hebrew", (surface, now, old) => {
    const rows = [{ id: "route:milestones", kind: "route", icon: "eco", label: "Milestones", sub: "My child", group: CHILD, go: vi.fn() }];
    expect(source(`./${surface}.tsx`)).toContain(now);
    const real = leadingGlyph(rowsOf(typed(surface, rows).tree())[0]);
    expect(mirrored(real)).toBe(false);
    const mutant = leadingGlyph(rowsOf(typed(surface, rows, vi.fn(), src => src.replace(now, old)).tree())[0]);
    expect(mutant.props.name).toBe("eco");
    expect(mirrored(mutant)).toBe(true);
  });

  it("neither surface keeps its own copy of the rule or the sections", () => {
    for (const surface of SURFACES) {
      const src = source(`./${surface}.tsx`);
      expect(src).toContain('import { CRUMB_SPOKEN_SEPARATOR, glyphMirror, searchSections } from "./searchSections";');
      expect(src).not.toMatch(/const glyphMirror|function bySection|function searchSections/);
    }
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

  it.each(SURFACES)("%s: rows stay 44 px; the crumb reads home › destination with one mirrored, silent chevron and one spoken separator per step", (surface) => {
    const { tree } = typed(surface, grouped());
    for (const node of rowsOf(tree())) {
      if (surface === "SearchModal") expect(classes(node)).toContain("min-h-[44px]");
      else expect(node.props.style).toMatchObject({ minHeight: "44px" });
    }
    const [milestones, journal, article] = rowsOf(tree());
    // Screen readers hear "My child, Milestones", not "My childMilestones".
    expect(CRUMB_SPOKEN_SEPARATOR.trim()).not.toBe("");
    expect(text(milestones)).toContain("My child" + CRUMB_SPOKEN_SEPARATOR + "Milestones");
    expect(text(milestones)).not.toContain("My childMilestones");
    const spoken = elements(milestones).filter(node => classes(node).includes("sr-only"));
    expect(spoken).toHaveLength(1);
    expect(text(spoken[0])).toBe(CRUMB_SPOKEN_SEPARATOR);
    const chevrons = icons(milestones, "chevron_right");
    expect(chevrons).toHaveLength(1);
    expect(chevrons[0].props.size).toBe(14);
    expect(classes(chevrons[0])).toContain("rtl:-scale-x-100");
    // Decorative: the Icon is aria-hidden unless given a label.
    expect(chevrons[0].props["aria-label"]).toBeUndefined();
    expect(icons(journal, "chevron_right")).toHaveLength(1);
    // A row without a crumb keeps its own second line, with nothing hidden in it.
    expect(icons(article, "chevron_right")).toHaveLength(0);
    expect(elements(article).filter(node => classes(node).includes("sr-only"))).toHaveLength(0);
    expect(text(article)).toContain("Invented shelf");
    // A three-part crumb has two chevrons and two spoken separators.
    const deep = typed(surface, [{ ...grouped()[0], crumb: ["My child", "Invented", "Milestones"] }]);
    const deepRow = rowsOf(deep.tree())[0];
    expect(icons(deepRow, "chevron_right")).toHaveLength(2);
    expect(text(deepRow)).toContain(["My child", "Invented", "Milestones"].join(CRUMB_SPOKEN_SEPARATOR));
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

describe("v3 IA-05r · the shared sections", () => {
  const row = (id: string, group?: { id: string; label: string; icon: string }) => ({ id, kind: group ? "route" : "ask", label: id, sub: "", icon: "eco", color: "", go: () => {}, group }) as any;

  it("groups by home where the home first appears, keeps each home's order, and leaves a homeless row alone", () => {
    const rows = [row("a", CHILD), row("b", LEARN), row("c", CHILD), row("ask"), row("d", LEARN)];
    const sections = searchSections.searchSections(rows);
    expect(sections.map(s => s.key)).toEqual(["home:child", "home:learn", "row:ask:ask"]);
    expect(sections.map(s => s.rows.map(r => r.id))).toEqual([["a", "c"], ["b", "d"], ["ask"]]);
    expect(sections[0].group).toBe(CHILD);
    expect(sections[2].group).toBeUndefined();
    // The first row drawn is the hook's first row.
    expect(sections.flatMap(s => s.rows)[0]).toBe(rows[0]);
  });

  it("returns nothing for nothing", () => {
    expect(searchSections.searchSections([])).toEqual([]);
  });
});

describe("v3 IA-05r · a home's own row says its name once", () => {
  const TALK = { id: "talk", label: "Talk with Arbor", icon: "forum" };
  const homeRows = () => [
    { id: "route:coach", kind: "route", icon: "forum", label: "Talk with Arbor", sub: "", group: TALK, go: vi.fn() },
    { id: "route:milestones", kind: "route", icon: "eco", label: "Milestones", sub: "My child", group: CHILD, crumb: ["My child", "Milestones"], go: vi.fn() },
  ];
  /** The muted line under a row's label (the modal's truncated text-xs line,
   *  the topbar's 12 px nowrap line); the kind badge is neither. */
  const secondLines = (surface: typeof SURFACES[number], row: View) => elements(row).filter(node => surface === "SearchModal"
    ? classes(node).includes("text-xs") && classes(node).includes("truncate")
    : node.props.style?.fontSize === "12px" && node.props.style?.whiteSpace === "nowrap");
  const times = (haystack: string, needle: string) => haystack.split(needle).length - 1;

  it.each(SURFACES)("%s: no second line under the home's own row; a destination keeps its crumb", (surface) => {
    const { tree } = typed(surface, homeRows());
    const [home, milestones] = rowsOf(tree());
    expect(secondLines(surface, home)).toHaveLength(0);
    expect(text(home)).toBe("Talk with Arbor" + "route");
    const talk = elements(tree()).find(node => node.props.role === "group" && node.props["aria-label"] === "Talk with Arbor")!;
    // Once in the header, once as the row: not a third time under it.
    expect(times(text(talk), "Talk with Arbor")).toBe(2);
    expect(secondLines(surface, milestones)).toHaveLength(1);
    expect(text(milestones)).toContain("My child" + CRUMB_SPOKEN_SEPARATOR + "Milestones");
  });

  it.each([
    ["SearchModal", (src: string) => src.replace("{(r.crumb || r.sub) && <span", "<span").replace(/(:\s*r\.sub\})(\s*)<\/span>\}/, "$1$2</span>")],
    ["TopbarSearch", (src: string) => src.replace("{(entry.crumb || entry.sub) && <span", "<span").replace(/:\s*entry\.sub\}(\s*)<\/span>\}/, ": (entry.sub || kindLabel(entry.kind))}$1</span>")],
  ] as const)("NEGATIVE CONTROL (%s): the old always-drawn line comes back under the home's own row", (surface, old) => {
    const real = source(`./${surface}.tsx`);
    expect(old(real)).not.toBe(real);
    const home = rowsOf(typed(surface, homeRows(), vi.fn(), old).tree())[0];
    expect(secondLines(surface, home)).toHaveLength(1);
    // The topbar's old fallback printed the kind word twice.
    if (surface === "TopbarSearch") expect(text(home)).toBe("Talk with Arbor" + "route" + "route");
  });
});

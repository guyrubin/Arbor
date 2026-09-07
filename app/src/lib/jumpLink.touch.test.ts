/**
 * Item 9 — the 44 px floor on the Profile / Growth primary-move controls.
 *
 * `--touch-min` is 44 px (DESIGN.md) and PRODUCT.md promises one-handed use on
 * a phone, yet the controls a parent actually has to hit on these hubs
 * rendered at 16–40 px: the Profile `JumpLink` (16 px, fourteen sites), the
 * Memory row's Edit / Approve / Dismiss / Forget (17 px — the Profile hub's
 * declared primary move), "Coach me" (58×13, four cards), the Daily Play
 * done-toggle (24 px) and session chips (37 px), the Milestones
 * add-milestone (20 px) and preterm input (34 px), and the edit drawer's
 * interest chips (31 px), Export (38 px) and Delete (36 px).
 *
 * The fix never grows the glyph or the type — only the hit box — so a visual
 * diff proves nothing and a jsdom render proves less (this suite runs in
 * `environment: "node"` with no stylesheet). The guard is therefore a SOURCE
 * RATCHET over the real JSX: every `<button>` in the listed files must carry a
 * height floor, and the files with a known, named exception pin that exception
 * by count. It fails the moment a new sub-44 control is added.
 *
 * Negative control: the verbatim pre-fix markup of each fixed control, run
 * through the same predicate, must be reported as an offender.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import * as ts from "typescript";

const SRC = path.resolve(__dirname, "..");

/** Class or style fragments that state a 44 px (or larger) hit box. */
const FLOOR_MARKERS = [
  "touch-target",
  "min-h-11",
  "min-h-12",
  "min-h-[44px]",
  "min-h-[48px]",
  "h-11",
  "py-3",
  "min-h-[var(--touch-min)]",
  "var(--touch-min)",
  "minHeight",
];

/** Every `<button>` in a file, as { line, className, style }. */
function buttons(file: string) {
  const source = readFileSync(path.join(SRC, file), "utf8");
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const found: { line: number; text: string }[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      if (node.tagName.getText(sf) === "button") {
        const attrs = node.attributes.properties
          .filter(ts.isJsxAttribute)
          .filter((a) => ["className", "style"].includes(a.name.getText(sf)))
          .map((a) => a.initializer?.getText(sf) ?? "")
          .join(" ");
        found.push({ line: sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1, text: attrs });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return found;
}

const hasFloor = (text: string) => FLOOR_MARKERS.some((m) => text.includes(m));

/**
 * Files fixed by this item, and the number of `<button>`s in each that are
 * still allowed to render without a stated floor. A shared class constant
 * (ChildMemory's ROW_ACTION_CLS) is resolved by the second assertion below,
 * not by this scan, so those four buttons count as exceptions here.
 */
const RATCHET: Record<string, number> = {
  "components/sections/ChildProfile.tsx": 0,
  "components/sections/ChildMemory.tsx": 4, // the four ROW_ACTION_CLS buttons
  "components/tabs/LanguageLabTab.tsx": 0,
  "components/tabs/LanguageLabVocabView.tsx": 0,
  "components/tabs/DailyPlayTab.tsx": 0,
  "components/practice/SessionLengthChips.tsx": 0,
  "components/overview/CourseCard.tsx": 0,
  "components/profile/ProfileEditDrawer.tsx": 0,
};

describe("item 9 · the primary-move controls state a 44 px hit box", () => {
  it("the scan is real — it finds buttons in every listed file", () => {
    for (const file of Object.keys(RATCHET)) {
      expect(buttons(file).length, `${file} parsed to zero buttons`).toBeGreaterThan(0);
    }
  });

  for (const [file, allowed] of Object.entries(RATCHET)) {
    it(`${file} — no more than ${allowed} button(s) without a floor`, () => {
      const offenders = buttons(file).filter((b) => !hasFloor(b.text));
      expect(
        offenders.map((o) => `${file}:${o.line}`),
        "a control on a primary-move path rendered under --touch-min",
      ).toHaveLength(allowed);
    });
  }

  it("ChildMemory's shared row-action class carries the floor, and all four actions use it", () => {
    const src = readFileSync(path.join(SRC, "components/sections/ChildMemory.tsx"), "utf8");
    expect(src).toMatch(/const ROW_ACTION_CLS = "[^"]*touch-target[^"]*"/);
    // Edit, Approve, Dismiss, Forget.
    expect(src.match(/className=\{ROW_ACTION_CLS\}/g) ?? []).toHaveLength(4);
  });

  it("the Profile JumpLink primitive — one component, every jump site", () => {
    const src = readFileSync(path.join(SRC, "components/sections/ChildProfile.tsx"), "utf8");
    const decl = src.slice(src.indexOf("function JumpLink"));
    expect(decl).toContain("touch-target");
    // The sites all go through the primitive rather than hand-rolled links.
    // (Eight since GP-26 retired the strengths door — see profileMemoryOrder.)
    expect((src.match(/<JumpLink /g) ?? []).length).toBeGreaterThanOrEqual(8);
  });

  it("the Milestones preterm input and the vocabulary add button state a floor", () => {
    const ms = readFileSync(path.join(SRC, "components/tabs/MilestonesTab.tsx"), "utf8");
    expect(ms).toContain('className="w-24 min-h-11 rounded-xl px-3 py-2 text-sm focus:outline-none"');
    const vocab = readFileSync(path.join(SRC, "components/tabs/LanguageLabVocabView.tsx"), "utf8");
    // A height floor is not a hit box: this one was 32 px WIDE inside a flex row.
    expect(vocab).toContain("shrink-0");
    expect(vocab).toContain("min-w-11");
  });

  it("NEGATIVE CONTROL: the pre-fix markup of each fixed control fails the predicate", () => {
    const preFix = [
      // JumpLink (ChildProfile.tsx:477)
      '"inline-flex items-center gap-1 text-xs font-bold" style={{ color }}',
      // Memory row Approve
      '"inline-flex items-center gap-1 font-bold" style={{ color: "var(--arbor-green-ink)" }}',
      // Language Lab "Coach me"
      '"inline-flex items-center gap-1 text-[10px] font-bold transition"',
      // Course done-toggle
      '"flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center transition"',
      // Milestones add-milestone
      '"flex items-center gap-2 text-sm font-bold transition"',
      // Drawer interest chip
      '"inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[12px] font-bold transition"',
      // Drawer Export
      '"w-full py-2.5 font-bold text-xs rounded-xl transition flex items-center justify-center gap-2 disabled:opacity-60 bg-white"',
    ];
    for (const markup of preFix) expect(hasFloor(markup), markup).toBe(false);
    // ...and the predicate is not simply always false.
    expect(hasFloor('"touch-target gap-1 px-2 font-bold"')).toBe(true);
    expect(hasFloor('"w-full py-2.5 min-h-11 font-bold text-xs"')).toBe(true);
  });
});

describe("GP-18 · the Level-5 delete no longer confirms in browser chrome", () => {
  const drawer = readFileSync(path.join(SRC, "components/profile/ProfileEditDrawer.tsx"), "utf8");

  it("window.confirm is gone from the delete path", () => {
    expect(drawer).not.toMatch(/window\.confirm\s*\(/);
  });

  it("it runs the same typed-name confirmation the Care surface uses", () => {
    expect(drawer).toContain('import { Modal } from "../ui/Modal";');
    expect(drawer).toContain("nameMatches");
    expect(drawer).toContain('t("sec.sharing.delete.typeToConfirm"');
    // The destructive button cannot fire until the typed name matches.
    expect(drawer).toContain("disabled={!nameMatches || busy}");
    // Reused keys, so both locales already exist.
    const dict = readFileSync(path.join(SRC, "lib/i18n.ts"), "utf8");
    for (const key of [
      "sec.sharing.delete.title",
      "sec.sharing.delete.body",
      "sec.sharing.delete.typeToConfirm",
      "sec.sharing.delete.confirm",
      "sec.sharing.delete.cancel",
      "sec.sharing.delete.working",
    ]) {
      expect((dict.match(new RegExp(`"${key.replace(/\./g, "\\.")}":`, "g")) ?? []).length, key).toBe(2);
    }
  });

  it("focus moves into the drawer, onto the first editable field", () => {
    expect(drawer).toContain("initialFocusRef: nameInputRef");
    expect(drawer).toContain("ref={nameInputRef}");
  });

  it("NEGATIVE CONTROL: the pre-fix delete path is detectable", () => {
    const preFix = 'if (!window.confirm(t("confirm.deleteChild", { name: activeChild.name }))) return;';
    expect(preFix.includes("window.confirm")).toBe(true);
    expect(drawer.includes(preFix)).toBe(false);
  });
});

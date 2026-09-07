/**
 * Item 9 subset — OBJ-JOURNAL-02 · OBJ-BEH-06 · OBJ-BEH-08.
 *
 * DESIGN.md sets `--touch-min` at 44 px and PRODUCT.md promises "one-handed on
 * mobile". These four surfaces missed it on their PRIMARY-MOVE path: the
 * Journal density pills and prompt chips at 36, the Behaviors capture tiles at
 * 40, the Plans template chips at 29, the Routines step input at 38 and its
 * icon buttons at 12, and Refine-in-Coach at 28.
 *
 * There is no jsdom in this repo, so this is a SOURCE ratchet, not a rendered
 * measurement: every interactive element listed below must carry an explicit
 * 44 px floor (`min-h-11` / `min-h-[44px]` / `.touch-target` / a
 * `var(--touch-min)` style), and the sub-44 utility classes are pinned absent
 * from the four files. The rendered sweep stays the orchestrator's.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(here, "..");
const read = (rel: string) => readFileSync(path.join(SRC, rel), "utf8");

const FILES = {
  timeline: "components/tabs/TimelineTab.tsx",
  journal: "components/tabs/JournalTab.tsx",
  entrySheet: "components/journal/JournalEntrySheet.tsx",
  behaviors: "components/tabs/BehaviorsTab.tsx",
  plans: "components/tabs/PlansTab.tsx",
  routines: "components/plans/RoutinesCard.tsx",
} as const;

/** Anything that declares a 44 px floor, in any of the four accepted forms. */
const FLOOR = /min-h-11\b|min-h-\[4[4-9]px\]|min-h-\[5\d px\]|touch-target|var\(--touch-min\)|min-h-\[48px\]/;

/** Each control the item names, matched by a snippet unique in its file. */
const CONTROLS: { id: string; file: keyof typeof FILES; near: string }[] = [
  { id: "OBJ-JOURNAL-02 density pills", file: "timeline", near: 'role="tab"' },
  { id: "OBJ-JOURNAL-02 prompt chips", file: "journal", near: "onPromptTap(key)" },
  { id: "OBJ-JOURNAL-02 compose tiles", file: "journal", near: "startCapture(key)" },
  { id: "OBJ-JOURNAL-02 entry-sheet edit", file: "entrySheet", near: 'data-testid="journal-entry-edit"' },
  { id: "OBJ-BEH-06 capture tiles", file: "behaviors", near: "m.key === \"voice\" && listening" },
  { id: "OBJ-BEH-08 template chips", file: "plans", near: "setPlanChallengeTopic(tpl)" },
  { id: "OBJ-BEH-08 suggestion chips", file: "plans", near: "setPlanChallengeTopic(s.topic)" },
  { id: "OBJ-BEH-08 refine in coach", file: "plans", near: 'source: "plans-coreg"' },
  { id: "OBJ-BEH-08 routine step input", file: "routines", near: "elev.closeloop.routines.addStep" },
  { id: "OBJ-BEH-08 new routine input", file: "routines", near: "elev.closeloop.routines.newName" },
];

/** The className/style of the element containing `near`. */
function shellAround(source: string, near: string): string {
  const at = source.indexOf(near);
  expect(at, `anchor not found: ${near}`).toBeGreaterThan(-1);
  // The enclosing tag: from the last "<" before the anchor to the ">" after it.
  const open = source.lastIndexOf("<", at);
  const close = source.indexOf(">", at);
  // A control's floor may sit on the same tag as the anchor or on the tag that
  // follows it (className usually comes after onClick), so take a window.
  return source.slice(open, Math.max(close, at) + 500);
}

describe("touch floor · the controls item 9 names", () => {
  for (const c of CONTROLS) {
    it(`${c.id} declares a 44 px floor`, () => {
      expect(shellAround(read(FILES[c.file]), c.near)).toMatch(FLOOR);
    });
  }
});

describe("touch floor · the sub-44 shapes stay out of these files", () => {
  const RETIRED: [keyof typeof FILES, string][] = [
    ["timeline", "min-h-[36px]"],
    ["journal", "min-h-[36px]"],
    ["behaviors", "min-h-10 items-center gap-2 rounded-xl"],
    ["behaviors", "flex h-10 w-10 items-center justify-center rounded-full text-white"],
    ["plans", 'className="px-3 py-1.5 rounded-lg text-[11px] font-bold transition"'],
    // The 12 px reset/delete glyphs that WERE the hit target (the checkbox
    // glyph stays 12 px — it sits inside a 44 px row and is decorative).
    ["routines", '<RotateCcw className="w-3 h-3" />'],
    ["routines", '<Trash2 className="w-3 h-3" />'],
    ["routines", "px-2 py-1 text-[11px]"],
  ];

  for (const [file, shape] of RETIRED) {
    it(`${FILES[file]} no longer contains \`${shape}\``, () => {
      expect(read(FILES[file])).not.toContain(shape);
    });
  }

  it("NEGATIVE CONTROL: the pre-fix markup fails the same floor check", () => {
    const prefix = '<button onClick={() => setPlanChallengeTopic(tpl)} className="px-3 py-1.5 rounded-lg text-[11px] font-bold transition">';
    expect(prefix).not.toMatch(FLOOR);
    // …and the post-fix markup passes it.
    expect(shellAround(read(FILES.plans), "setPlanChallengeTopic(tpl)")).toMatch(FLOOR);
  });

  it("every icon-only Routines control opts in explicitly (.touch-target)", () => {
    // Line-scoped: an icon-only control in this card is a <button> whose only
    // label is an aria-label, and each is written on one line.
    const iconOnly = read(FILES.routines)
      .split(/\r?\n/)
      .filter((line) => line.includes("<button") && line.includes("aria-label="));
    expect(iconOnly.length).toBeGreaterThanOrEqual(4);
    for (const line of iconOnly) {
      expect(line.trim().slice(0, 120), "icon-only button without a floor").toContain("touch-target");
    }
  });
});

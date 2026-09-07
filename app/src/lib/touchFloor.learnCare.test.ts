/**
 * Item 9 subset — OBJ-LEARN-03 · OBJ-CARE-03 · LC-23.
 *
 * DESIGN.md sets `--touch-min` at 44 px. These Learn·Care controls missed it:
 * the Learn filter pills and the helpful/not-really pulse at 38, the charter
 * remove glyph at 14×20, the sharing wizard's role/scope/duration chips at 24
 * with Back/Approve/Cancel/Confirm at 40, the Reports PDF buttons at 60×28,
 * the Find-a-pro search field at 19–20 tall with its filters at 27–30, the
 * Safety checklist rows at 13 px with "Mark reviewed" at 29, and the Consult
 * rail's own "Find a professional" door at 39.
 *
 * There is no jsdom in this repo, so this is a SOURCE ratchet, not a rendered
 * measurement — the same shape as touchFloor.journalPlans.test.ts. The
 * rendered sweep stays the orchestrator's.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(here, "..");
const read = (rel: string) => readFileSync(path.join(SRC, rel), "utf8");

const FILES = {
  learn: "components/sections/LearnLibrary.tsx",
  charter: "components/sections/FamilyFormation.tsx",
  sharing: "components/sections/TrustedSharing.tsx",
  reports: "components/sections/Reports.tsx",
  findpro: "components/sections/FindProfessional.tsx",
  safety: "components/tabs/SafetyTab.tsx",
  consult: "components/sections/AskSpecialist.tsx",
} as const;

/** Anything that declares a 44 px floor, in any of the accepted forms. */
const FLOOR = /min-h-11\b|min-h-\[4[4-9]px\]|min-h-\[5\d px\]|touch-target|var\(--touch-min\)|min-h-\[48px\]|min-h-\[52px\]/;

/** Each control the item names, matched by a snippet unique in its file. */
const CONTROLS: { id: string; file: keyof typeof FILES; near: string }[] = [
  { id: "OBJ-LEARN-03 filter pills", file: "learn", near: "{msIcon && <Icon name={msIcon} size={15} />}" },
  { id: "OBJ-LEARN-03 helpful pulse (yes)", file: "learn", near: "onPulse(1)" },
  { id: "OBJ-LEARN-03 helpful pulse (no)", file: "learn", near: "onPulse(-1)" },
  { id: "LC-22 charter remove", file: "charter", near: "remove(v)" },
  { id: "OBJ-CARE-03 sharing role chips", file: "sharing", near: "setDraft({ ...draft, role: r })" },
  { id: "OBJ-CARE-03 sharing scope chips", file: "sharing", near: "setScope(f)" },
  { id: "OBJ-CARE-03 sharing duration chips", file: "sharing", near: "setDraft({ ...draft, duration: d })" },
  { id: "OBJ-CARE-03 sharing review back", file: "sharing", near: "sec.sharing.review.back" },
  { id: "OBJ-CARE-03 sharing create", file: "sharing", near: "onClick={createShare}" },
  { id: "OBJ-CARE-03 delete confirm", file: "sharing", near: 'data-testid="delete-confirm-btn"' },
  { id: "OBJ-CARE-03 reports PDF button", file: "reports", near: "elev.reports.exportAria" },
  { id: "OBJ-CARE-03 findpro search", file: "findpro", near: "elev.careNet.search.placeholder" },
  { id: "OBJ-CARE-03 findpro filters", file: "findpro", near: "onClick={() => toggle(f.id)}" },
  { id: "OBJ-CARE-03 findpro specialty chips", file: "findpro", near: "setQuery(s.query)" },
  { id: "LC-23 safety checklist row", file: "safety", near: "<label key={n}" },
  { id: "LC-23 mark reviewed", file: "safety", near: "onClick={markReviewed}" },
  { id: "LC-23 forget a memory fact", file: "safety", near: 'handleMemoryDecision(item.memoryId, "deleted")' },
  { id: "LC-16 find a professional door", file: "consult", near: "rounded-[13px] min-h-11 transition hover:brightness-95" },
];

/** The className/style of the element containing `near`. */
function shellAround(source: string, near: string): string {
  const at = source.indexOf(near);
  expect(at, `anchor not found: ${near}`).toBeGreaterThan(-1);
  const open = source.lastIndexOf("<", at);
  const close = source.indexOf(">", at);
  return source.slice(open, Math.max(close, at) + 500);
}

describe("touch floor · the Learn·Care controls item 9 names", () => {
  for (const c of CONTROLS) {
    it(`${c.id} declares a 44 px floor`, () => {
      expect(shellAround(read(FILES[c.file]), c.near)).toMatch(FLOOR);
    });
  }
});

describe("touch floor · the sub-44 shapes stay out of these files", () => {
  const RETIRED: [keyof typeof FILES, string][] = [
    ["learn", "min-h-[38px]"],
    ["sharing", 'className="rounded-full px-3 py-1 text-xs font-bold"'],
    ["sharing", 'className="rounded-xl px-4 py-2.5 text-sm font-bold"'],
    ["findpro", 'className="rounded-full px-3 py-1.5 text-xs font-bold transition inline-flex items-center gap-1"'],
    ["safety", 'className="font-extrabold text-[11px] px-3 py-1.5 rounded-lg transition"'],
    ["safety", 'className="text-[10px] font-bold flex-shrink-0 disabled:opacity-50"'],
    ["reports", 'className="flex-shrink-0 inline-flex items-center gap-1 text-xs font-bold rounded-lg px-2.5 py-1.5 transition hover:brightness-95"'],
    ["consult", 'className="w-full text-center text-[12px] font-bold rounded-[13px] py-2.5 transition hover:brightness-95"'],
  ];

  for (const [file, shape] of RETIRED) {
    it(`${FILES[file]} no longer contains \`${shape.slice(0, 60)}\``, () => {
      expect(read(FILES[file])).not.toContain(shape);
    });
  }

  it("NEGATIVE CONTROL: the pre-fix markup fails the same floor check", () => {
    const preFixPill = 'className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 min-h-[38px] text-[12px] font-bold whitespace-nowrap"';
    expect(preFixPill).not.toMatch(FLOOR);
    const preFixRemove = '<button onClick={() => remove(v)} aria-label={t("elev.charter.remove", { value: v })}><Icon name="close" size={14} /></button>';
    expect(preFixRemove).not.toMatch(FLOOR);
    // …and the post-fix markup passes it.
    expect(shellAround(read(FILES.learn), "{msIcon && <Icon name={msIcon} size={15} />}")).toMatch(FLOOR);
    expect(shellAround(read(FILES.charter), "remove(v)")).toMatch(FLOOR);
  });

  it("the glyphs themselves did not grow — only the hit boxes", () => {
    // LC-23's checkbox is the one exception: a 13 px native checkbox IS the
    // control, so it grows to 20 px inside a 44 px row.
    expect(read(FILES.charter)).toContain('<Icon name="close" size={14} />');
    expect(read(FILES.learn)).toContain('<Icon name={msIcon} size={15} />');
    expect(read(FILES.safety)).toContain('className="mt-0.5 w-5 h-5 flex-shrink-0"');
  });
});

/* ── R13 — the Care residues round 2b measured in the running app ──────────
 *
 * Item 9 raised the checklist ROW to 44 and the wizard's own chips, but three
 * controls kept a sub-44 box because none of them was on the named list:
 * the four emergency-contact fields (308x38 — the floor was missing from the
 * SHARED `inputCls` recipe, so every field inherited the miss), the icon-only
 * "remove contact" button (no class at all), and the add-contact submit.
 * The two sharing-wizard Close buttons are re-pinned on `.touch-target`
 * (plain CSS in index.css) rather than a utility pair, so neither axis can be
 * lost to a class that fails to generate.
 */
describe("touch floor · R13 · the Care residues", () => {
  const R13: { id: string; file: keyof typeof FILES; near: string }[] = [
    { id: "remove a saved contact", file: "safety", near: "void contactsCol.remove(c.id)" },
    { id: "add a saved contact", file: "safety", near: 'aria-label={t("aria.addContact")}' },
    { id: "sharing wizard close", file: "sharing", near: 'data-testid="sharing-wizard-close"' },
    { id: "sharing invite close", file: "sharing", near: "setInvite(null)" },
  ];

  for (const c of R13) {
    it(`${c.id} declares a 44 px floor`, () => {
      expect(shellAround(read(FILES[c.file]), c.near)).toMatch(FLOOR);
    });
  }

  it("the floor sits on the shared input recipe, not on the call sites", () => {
    const safety = read(FILES.safety);
    expect(safety).toContain('const inputCls = "rounded-lg px-3 py-2 min-h-11 text-sm focus:outline-none";');
    expect(safety).not.toContain('const inputCls = "rounded-lg px-3 py-2 text-sm focus:outline-none";');
  });

  it("the checklist row is the node the 44 px acceptance measures", () => {
    // The checkbox itself stays a 20 px glyph on purpose; the <label> is the
    // control, and it now says so to whoever is measuring.
    const safety = read(FILES.safety);
    expect(safety).toContain('data-touch-shell="checklist-row"');
    expect(shellAround(safety, 'data-touch-shell="checklist-row"')).toMatch(FLOOR);
    expect(safety).toContain('className="mt-0.5 w-5 h-5 flex-shrink-0"');
  });

  it("NEGATIVE CONTROL: each pre-fix shape fails the floor it now has to pass", () => {
    expect('const inputCls = "rounded-lg px-3 py-2 text-sm focus:outline-none";').not.toMatch(FLOOR);
    expect('<button onClick={() => void contactsCol.remove(c.id)} className="transition">').not.toMatch(FLOOR);
    expect('<button type="submit" className="text-white font-extrabold px-3 rounded-lg flex items-center">').not.toMatch(FLOOR);
  });

  it("the two sharing Close buttons no longer depend on a utility pair", () => {
    const sharing = read(FILES.sharing);
    expect(sharing).not.toContain('className="inline-flex items-center justify-center min-h-11 min-w-11"');
    expect(sharing).not.toContain('className="inline-flex items-center justify-center min-w-[44px] min-h-[44px]"');
    expect((sharing.match(/touch-target flex-shrink-0/g) ?? []).length).toBe(2);
  });
});

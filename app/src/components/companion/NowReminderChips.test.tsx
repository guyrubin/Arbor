import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_PREFS, loadPrefs, type JitaiPrefs } from "../../growth/jitaiPrefs";
import NowReminderChips, { REMINDER_CHIPS } from "./NowReminderChips";
import { NOW_COPY } from "./nowViewCopy";

/**
 * v3 F-NOW-2 — Now's reminders: four switches in the glance card, each one a
 * Smart Reminders switch in the same JitaiPrefs store (so the chip and the
 * settings leaf never disagree), and "All reminders". No count, no clock
 * time, never the page's primary move; Hebrew carries no Latin.
 */
const mem = new Map<string, string>();
(globalThis as unknown as { localStorage: unknown }).localStorage = {
  getItem: (k: string) => (mem.has(k) ? mem.get(k)! : null),
  setItem: (k: string, v: string) => void mem.set(k, String(v)),
  removeItem: (k: string) => void mem.delete(k),
  clear: () => mem.clear(),
};
const LS_KEY = "arbor.jitai.prefs";
const here = path.dirname(fileURLToPath(import.meta.url));
const SUBSET = new Set(readFileSync(path.join(here, "..", "..", "..", "public", "fonts", "material-symbols-rounded-subset.icons.txt"), "utf8").split(/\r?\n/).map(l => l.trim()));

const prefsWith = (types: Partial<JitaiPrefs["types"]> = {}): JitaiPrefs => ({ ...DEFAULT_PREFS, types: { ...DEFAULT_PREFS.types, ...types } });
const render = (lang: "en" | "he", prefs: JitaiPrefs = prefsWith()) =>
  renderToStaticMarkup(<NowReminderChips lang={lang} prefs={prefs} onChange={() => {}} onAll={() => {}} />);
/** The visible words: the icon ligatures are decorative glyphs, not text. */
const visibleText = (html: string) => html.replace(/<span class="msr[^"]*"[^>]*>[^<]*<\/span>/g, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

type El = React.ReactElement<{ children?: React.ReactNode; onClick?: () => void; "data-testid"?: string }>;
function byTestId(node: React.ReactNode, id: string): El | null {
  if (Array.isArray(node)) {
    for (const child of node) { const hit = byTestId(child, id); if (hit) return hit; }
    return null;
  }
  if (!React.isValidElement(node)) return null;
  const el = node as El;
  if (el.props["data-testid"] === id) return el;
  return byTestId(el.props.children, id);
}

describe("v3 F-NOW-2 — Now's reminder switches", () => {
  beforeEach(() => mem.clear());

  it("each chip is exactly one Smart Reminders switch; 'Weekly report is ready' is the recap line, 'Tonight's story' the bedtime one", () => {
    expect(REMINDER_CHIPS.map(c => [c.id, c.pref, c.icon])).toEqual([
      ["morning", "guidance", "wb_sunny"],
      ["story", "story", "bedtime"],
      ["moment", "moments", "edit_note"],
      ["weekly", "recap", "bar_chart"],
    ]);
    expect(new Set(REMINDER_CHIPS.map(c => c.pref)).size).toBe(4);
    for (const icon of [...REMINDER_CHIPS.map(c => c.icon), "arrow_forward"]) expect(SUBSET.has(icon), icon).toBe(true);
  });

  for (const lang of ["en", "he"] as const) {
    it(`${lang}: four labelled switches whose state is the store's, plus "All reminders"; no count, no time, no primary move`, () => {
      const html = render(lang, prefsWith({ story: false, recap: false }));
      const switches = [...html.matchAll(/<button[^>]*role="switch" aria-checked="(true|false)"[^>]*data-testid="now-reminder-(\w+)"/g)].map(m => [m[2], m[1]]);
      expect(switches).toEqual([["morning", "true"], ["story", "false"], ["moment", "true"], ["weekly", "false"]]);
      const copy = NOW_COPY[lang];
      for (const id of ["morning", "story", "moment", "weekly"] as const) expect(html).toContain(copy.reminderChips[id]);
      expect(html).toContain(copy.remHint);
      expect(html).toContain(`data-testid="now-reminders-all">${copy.remindersAll}`);
      expect(html).toContain('class="msr rtl:-scale-x-100"');
      expect(html).not.toContain("data-primary-move");
      const text = visibleText(html);
      expect(text).not.toMatch(/\d|%/);
      if (lang === "he") expect(text).not.toMatch(/[A-Za-z]/);
    });
  }

  it("a switch writes the shared store, reading it fresh first so a change made on #/smart-reminders survives", () => {
    // Set elsewhere: moments off and a later quiet start. The chips still hold the older prefs.
    mem.set(LS_KEY, JSON.stringify({ ...DEFAULT_PREFS, types: { ...DEFAULT_PREFS.types, moments: false }, quietStart: 22 }));
    const onChange = vi.fn();
    const tree = NowReminderChips({ lang: "en", prefs: prefsWith(), onChange, onAll: () => {} });
    byTestId(tree, "now-reminder-weekly")?.props.onClick?.();
    expect(loadPrefs().types).toEqual({ guidance: true, moments: false, story: true, recap: false });
    expect(loadPrefs().quietStart).toBe(22);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0]).toEqual(loadPrefs());
  });

  it("an off switch turns back on; 'All reminders' only navigates", () => {
    const onChange = vi.fn();
    const onAll = vi.fn();
    mem.set(LS_KEY, JSON.stringify(prefsWith({ story: false })));
    expect(loadPrefs().types.story).toBe(false);
    const tree = NowReminderChips({ lang: "he", prefs: prefsWith({ story: false }), onChange, onAll });
    byTestId(tree, "now-reminder-story")?.props.onClick?.();
    expect(loadPrefs().types.story).toBe(true);
    byTestId(tree, "now-reminders-all")?.props.onClick?.();
    expect(onAll).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});

/**
 * v10.1 regression: leaving a screen whose query picks its view must never
 * strand the next tab.
 *
 * The shell swaps tabs inside AnimatePresence in wait mode: the old tab's
 * exit must finish before the new tab mounts. A hash change also re-renders
 * the exiting tab (useHashQuery listens to every hashchange). If that
 * re-render swaps the screen's top-level element for a motion element with an
 * `exit` of its own, the exit Motion is waiting on never completes and the new
 * tab never mounts: the address and the breadcrumb move on while the old
 * screen stays. Leaving `#/plans?challenge=…` (the Challenge Plans pages) and
 * `#/language?view=said` did exactly that in the browser.
 *
 * The rule these two screens now follow: one stable top-level wrapper whose
 * views switch inside it (Plans), or no `exit` on a wrapper that a query can
 * swap in (Things <name> said).
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const SRC = path.resolve(__dirname, "..", "..");
const code = (rel: string) => readFileSync(path.join(SRC, rel), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

describe("leaving a query-picked view never strands the next tab", () => {
  it("Plans renders every view (home, Challenge, composer, parent copy) inside one wrapper", () => {
    const plans = code("components/tabs/PlansTab.tsx");
    expect(plans.match(/<motion\.div\b/g) ?? []).toHaveLength(1);
    for (const view of ["compose", "parent-copy", "challenge", "home"]) expect(plans).toContain(`shell("${view}"`);
    expect(plans).not.toMatch(/<motion\.div[^>]*\bexit=/);
  });

  it("Things <name> said: the wrapper a leave from ?view=said swaps in has no exit of its own", () => {
    const lang = code("components/tabs/LanguageLabTab.tsx");
    expect(lang).toContain('if (view === "said") return <SaidPage />;');
    const wrapper = lang.slice(lang.indexOf('if (view === "said") return <SaidPage />;'));
    const firstMotion = wrapper.match(/<motion\.div[^>]*>/)?.[0] ?? "";
    expect(firstMotion).not.toBe("");
    expect(firstMotion).not.toMatch(/\bexit=/);
  });

  it("NEGATIVE CONTROL: the stranding shape is detectable (a query-swapped wrapper with an exit)", () => {
    const stranded = `if (view === "said") return <SaidPage />;\n  return (\n    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>`;
    const firstMotion = stranded.slice(stranded.indexOf("return <SaidPage />;")).match(/<motion\.div[^>]*>/)?.[0] ?? "";
    expect(firstMotion).toMatch(/\bexit=/);
  });
});

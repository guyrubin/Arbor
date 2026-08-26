/**
 * F-02 — tab switches must land at the top of the new tab (no carried scroll,
 * no ghost frame).
 *
 * <main> in Shell.tsx is the desktop scrollport (overflow-y-auto); below lg
 * the window itself scrolls. Switching tabs used to keep the previous tab's
 * scroll offset, opening the new tab mid-page. The fix resets BOTH scroll
 * owners in AnimatePresence's onExitComplete — exactly the tab-swap moment,
 * after the outgoing tab has finished exiting (mode="wait") — never in
 * ArborContext.setActiveTab, which would jump the still-visible old tab.
 *
 * Source-scan guard (house style, see kidLock.test.ts / chromeLayout.test.ts):
 * pins that neither the mode="wait" sequencing nor either reset can be
 * silently dropped.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = path.dirname(fileURLToPath(import.meta.url));
const shell = readFileSync(path.join(here, "Shell.tsx"), "utf8");

describe("F-02 — Shell resets scroll on tab swap (onExitComplete)", () => {
  // The whole AnimatePresence opening tag (props + comments span lines, so a
  // non-greedy `>` match would stop early — slice up to its <motion.div> child).
  const start = shell.indexOf("<AnimatePresence");
  const presence = start > -1 ? shell.slice(start, shell.indexOf("<motion.div", start)) : undefined;

  it("the tab AnimatePresence is found by the guard (guard stays honest)", () => {
    expect(presence, "AnimatePresence not found in Shell.tsx — update this guard").toBeTruthy();
  });

  it('keeps mode="wait" so the reset fires between exit and enter', () => {
    expect(presence!).toMatch(/mode="wait"/);
  });

  it("carries an onExitComplete that resets the <main> scrollport", () => {
    expect(presence!).toMatch(/onExitComplete=/);
    expect(presence!).toMatch(/mainRef\.current\?\.scrollTo\(\{\s*top:\s*0,\s*left:\s*0\s*\}\)/);
  });

  it("…and resets the mobile window scroll in the same handler", () => {
    expect(presence!).toMatch(/window\.scrollTo\(0,\s*0\)/);
  });

  it("mainRef is attached to the overflow-y-auto <main> scrollport", () => {
    expect(shell).toMatch(/<main ref=\{mainRef\} className="arbor-parent[^"]*overflow-y-auto/);
  });

  it("the reset does NOT live in ArborContext.setActiveTab", () => {
    const ctx = readFileSync(path.join(here, "..", "..", "context", "ArborContext.tsx"), "utf8");
    expect(ctx).not.toMatch(/scrollTo/);
  });
});

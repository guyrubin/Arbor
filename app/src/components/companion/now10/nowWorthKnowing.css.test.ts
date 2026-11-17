import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * The "Worth knowing" card is mounted by Now, My child, About, Stories and
 * Gentle reminders. Its styles travel with the component (a route that never
 * loaded Now's stylesheet dropped the read link's 44 px floor), and the phone
 * card is one column (the old two-column grid kept a column for art the V77
 * pass removed, so the kicker sat over the note and the link broke a word per
 * line on My child).
 */
const css = readFileSync(new URL("./nowWorthKnowing.css", import.meta.url), "utf8");
const component = readFileSync(new URL("./NowWorthKnowing.tsx", import.meta.url), "utf8");
const nowCss = readFileSync(new URL("./nowV10.css", import.meta.url), "utf8");

describe("Worth knowing card styles", () => {
  it("the component imports its own stylesheet", () => {
    expect(component).toContain('import "./nowWorthKnowing.css";');
  });

  it("the read link keeps the 44 px touch floor wherever the card is mounted", () => {
    expect(css).toMatch(/\.ds \.nw-know-link \{[^}]*min-height: 44px/);
    // Negative control: Now's stylesheet no longer owns it (so no route depends on loading Now).
    expect(nowCss).not.toMatch(/\.ds \.nw-know-link \{/);
  });

  it("the phone card is one column, never the art grid", () => {
    expect(css).toMatch(/\.ds \.nw-know\.m \{[^}]*display: flex; flex-direction: column/);
    expect(css).not.toMatch(/\.nw-know\.m \{[^}]*display: grid/);
    expect(component).not.toContain("nw-know-art");
  });
});

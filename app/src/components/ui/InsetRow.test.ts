/* LC-07 — the consult packet preview never truncates the line the parent
 * approves. Render test on the InsetRow primitive (node env, static markup)
 * + a source pin that the consult packet rows opt into `multiline`.
 * Negative control: the default (single-line) row still truncates, proving
 * the assertion is sensitive to the prop. */

import { describe, expect, it } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { InsetRow } from "./kit";

const here = path.dirname(fileURLToPath(import.meta.url));
const askSource = readFileSync(path.join(here, "..", "sections", "AskSpecialist.tsx"), "utf8");

const LONG = "Observed (12): Stacks 4 blocks (Sensory and movement, 2026-08-30); Hops on one foot (Sensory and movement, 2026-08-28); and 10 more.";

describe("InsetRow multiline (LC-07)", () => {
  it("renders the full value with no truncate / line-clamp when multiline", () => {
    const html = renderToStaticMarkup(
      React.createElement(InsetRow, { label: "Development snapshot", value: LONG, multiline: true, testId: "consult-packet-item" })
    );
    expect(html).toContain('data-testid="consult-packet-item"');
    expect(html).toContain(LONG);
    expect(html).not.toMatch(/\btruncate\b/);
    expect(html).not.toMatch(/line-clamp/);
    expect(html).toContain("whitespace-pre-wrap");
  });

  it("NEGATIVE CONTROL: the default row (pre-fix shape) still truncates", () => {
    const html = renderToStaticMarkup(React.createElement(InsetRow, { label: "L", value: LONG }));
    expect(html).toMatch(/\btruncate\b/);
  });

  it("consult packet rows opt into multiline and carry the test id", () => {
    const rows = askSource.match(/<InsetRow[\s\S]*?\/>/g) ?? [];
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row, row).toContain("multiline");
      expect(row).toContain('testId="consult-packet-item"');
    }
    expect(askSource).toContain("elev.carehonesty.consult.preview.toggle");
  });
});

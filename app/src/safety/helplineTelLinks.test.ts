/* LC-01 — every escalation render carries dialable helplines + a Safety route.
 *
 * The coach / behaviors / quick-log escalation surfaces render
 * `renderEscalationMarkdown(match)` through `MarkdownBlock`. This suite pins
 * the RENDERED output: one `href="tel:…"` per crisis-directory entry, the
 * `#/safety` route link, ≥44px targets — plus negative controls proving the
 * autolink is token-exact (an arbitrary number never becomes a call link) and
 * that the pre-fix shape (bold number, no anchor) is what would fail. */

import { describe, expect, it } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MarkdownBlock, parseInline } from "../components/ui/MarkdownBlock";
import {
  escalationCategories,
  escalationMatchForCategory,
  HELPLINE_DIRECTORY,
  renderEscalationMarkdown,
  renderHelplineLinksMarkdown,
  SAFETY_ROUTE_HASH,
  screenForImmediateEscalation,
} from "./escalation";

const render = (text: string) => renderToStaticMarkup(React.createElement(MarkdownBlock, { text }));
const telHrefs = (html: string) => [...html.matchAll(/href="tel:([^"]+)"/g)].map((m) => m[1]);

/** The three launch locales' crisis phrasings — each resolves to a match. */
const LOCALE_INPUTS = [
  ["en", "My child says he wants to die"],
  ["he", "הילדה אומרת שהיא רוצה למות"],
  ["nl", "ze wil niet meer leven"],
] as const;

describe("LC-01 — renderEscalationMarkdown emits tel: links + the Safety route", () => {
  it("the markdown itself carries [number](tel:…) for EVERY directory entry and the #/safety link", () => {
    for (const c of escalationCategories) {
      const md = renderEscalationMarkdown(escalationMatchForCategory(c.category));
      for (const h of HELPLINE_DIRECTORY) {
        expect(md, `${c.category}: missing tel link for ${h.id}`).toContain(`[${h.number}](tel:${h.tel})`);
      }
      expect(md).toContain(`](${SAFETY_ROUTE_HASH})`);
      expect(md).toContain("Get help now");
    }
  });

  it.each(LOCALE_INPUTS)("rendered output (%s input) has one href=\"tel:\" per directory number and the #/safety anchor", (_lang, input) => {
    const match = screenForImmediateEscalation({ message: input });
    expect(match).not.toBeNull();
    const html = render(renderEscalationMarkdown(match!));
    const tels = telHrefs(html);
    for (const h of HELPLINE_DIRECTORY) {
      expect(tels.filter((t) => t === h.tel).length, `no tel anchor for ${h.id} (${h.number})`).toBeGreaterThanOrEqual(1);
    }
    expect(tels.length).toBeGreaterThanOrEqual(HELPLINE_DIRECTORY.length);
    expect(html).toContain(`href="${SAFETY_ROUTE_HASH}"`);
  });

  it("tel and route anchors are ≥44px targets; tel anchors are LTR-isolated", () => {
    const html = render(renderHelplineLinksMarkdown());
    const anchors = html.match(/<a [^>]+>/g) ?? [];
    expect(anchors.length).toBeGreaterThanOrEqual(HELPLINE_DIRECTORY.length + 1);
    for (const a of anchors) {
      expect(a, a).toContain("min-h-[44px]");
      if (a.includes('href="tel:')) expect(a).toContain('dir="ltr"');
    }
  });

  it("autolinks a BARE directory number inside the existing bold resources copy", () => {
    // The resources blocks were never edited — `**112**` must still become a call link.
    const html = render(escalationMatchForCategory("self_harm").resources);
    expect(telHrefs(html)).toContain("112");
    expect(telHrefs(html)).toContain("988");
    expect(telHrefs(html)).toContain("08000113"); // "0800-0113" → dialable target
  });
});

describe("LC-01 — negative controls", () => {
  it("a bare number that is NOT in the directory never becomes a tel link", () => {
    const html = render("Room 1120 · call 555-1234 · code 112b · extension 9880");
    expect(telHrefs(html)).toEqual([]);
    expect(html).not.toContain("href=");
  });

  it("the pre-fix shape — a bold directory number with no anchor — is exactly what the renderer now fixes", () => {
    const fixed = renderToStaticMarkup(React.createElement(React.Fragment, null, ...parseInline("**988**")));
    expect(fixed).toContain('href="tel:988"');
    const control = renderToStaticMarkup(React.createElement(React.Fragment, null, ...parseInline("**9880**")));
    expect(control).not.toContain("href=");
    expect(control).toContain("<strong");
  });

  it("only tel:, #/ routes and https links are honoured — other schemes render as text", () => {
    const html = render("[x](javascript:alert(1)) and [y](mailto:a@b.c)");
    expect(html).not.toContain("href=");
    expect(html).toContain("[x](javascript:alert(1))");
  });
});

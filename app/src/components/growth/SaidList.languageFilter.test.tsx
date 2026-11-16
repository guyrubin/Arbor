/** v10.3 (N-SaidHe): the language index narrows the kept sayings. A quote kept
 * without a language (Tonight's keepsakes) reads as the language its script
 * names, by the same rule a keep on this page uses (`quoteLanguage`); a stored
 * language always wins. Synthetic fixtures only. */
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { translate } from "../../lib/i18n";
import type { KeepsakeDoc } from "../../lib/firstsKeepsake";

type QuoteDoc = KeepsakeDoc & Record<string, unknown>;
const h = vi.hoisted(() => ({ docs: [] as QuoteDoc[] }));
vi.mock("../../context/LanguageContext", () => ({ useLanguage: () => ({ uiLang: "en", aiLang: "en",
  t: (k: string, v?: Record<string, string | number>) => translate("en", k, v) }) }));
vi.mock("../../hooks/useChildCollection", () => ({ useChildCollection: () => ({
  items: h.docs, loaded: true, error: false, remote: false, upsert: vi.fn(), remove: vi.fn(), replaceAll: vi.fn(),
}) }));

import { SaidList } from "./ThingsSaid";

const quote = (id: string, note: string, patch: Record<string, unknown> = {}): QuoteDoc => ({
  id, kind: "quote", milestoneId: "", note, noticedOn: "2026-10-05", createdAt: "2026-10-05", updatedAt: "2026-10-05", ...patch,
});
const FAMILY = ["Hebrew", "English"];
const render = (props: Partial<React.ComponentProps<typeof SaidList>>) =>
  renderToStaticMarkup(<SaidList childId="synthetic-child" first="Dylan" gender="boy" rows {...props} />);

describe("SaidList — one language's sayings", () => {
  beforeEach(() => {
    h.docs = [
      quote("q-he", "אני שומר עליה"),
      quote("q-en", "The moon follows our car"),
      quote("q-stored", "moon moon", { language: "Hebrew" }),
    ];
  });

  it("reads an untagged quote as the language its script names", () => {
    const he = render({ language: "Hebrew", languages: FAMILY });
    expect(he).toContain("אני שומר עליה");
    expect(he).not.toContain("The moon follows our car");
    const en = render({ language: "English", languages: FAMILY });
    expect(en).toContain("The moon follows our car");
    expect(en).not.toContain("אני שומר עליה");
  });

  it("keeps the language a parent stored over the script", () => {
    expect(render({ language: "Hebrew", languages: FAMILY })).toContain("moon moon");
    expect(render({ language: "English", languages: FAMILY })).not.toContain("moon moon");
  });

  it("drops the per-row language tag under a filter and keeps it on All", () => {
    expect(render({ language: "Hebrew", languages: FAMILY })).not.toContain("sqlang");
    expect(render({ languages: FAMILY })).toContain("sqlang");
  });

  it("says the picked language is empty in the page's own words", () => {
    h.docs = [quote("q-en", "The moon follows our car")];
    const out = render({ language: "Hebrew", languages: FAMILY, emptyText: "No sayings kept in Hebrew yet." });
    expect(out).toContain("No sayings kept in Hebrew yet.");
    expect(out).toContain('data-testid="said-empty"');
  });
});

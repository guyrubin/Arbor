/**
 * B-GA-11 (critic r1) — the hero creator: Create sends the photo or the
 * description to Arbor's AI, so the Art. 50 line renders as the foot of that
 * action (Talk's composer-foot line, in the UI language), and the sheet makes
 * no claim about HOW the picture is made (the old "hand-illustrated" copy sat
 * directly above an AI line).
 */
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ ui: "en" as "en" | "he" }));
vi.mock("react-dom", async (original) => ({ ...(await original<typeof import("react-dom")>()), createPortal: (node: React.ReactNode) => node }));
vi.mock("../../context/LanguageContext", async () => {
  const { translate } = await vi.importActual<typeof import("../../lib/i18n")>("../../lib/i18n");
  return { useLanguage: () => ({ uiLang: h.ui, aiLang: h.ui, t: (key: string, vars?: Record<string, string | number>) => translate(h.ui, key, vars) }) };
});
vi.mock("../../context/ArborContext", () => ({ useArborOptional: () => null }));
import { translate } from "../../lib/i18n";
import AvatarCreator from "./AvatarCreator";

// createPortal(…, document.body): the portal target only; the stub returns the node.
vi.stubGlobal("document", { body: {} });

describe.each(["en", "he"] as const)("hero creator (%s)", (ui) => {
  it("the AI line is the foot of the Create action, in the UI language", () => {
    h.ui = ui;
    const html = renderToStaticMarkup(<AvatarCreator open childId="synthetic-kid" childName="Noa" onClose={() => {}} onCreated={() => {}} />);
    const line = translate(ui, "companion.input.foot").replace(/'/g, "&#x27;");
    expect((html.match(/data-ai-disclosure/g) ?? [])).toHaveLength(1);
    expect(html).toContain(line);
    const create = html.indexOf(translate(ui, "elev.hero.cta.create").replace(/'/g, "&#x27;"));
    expect(create).toBeGreaterThan(0);
    expect(html.indexOf("data-ai-disclosure")).toBeGreaterThan(create);
  });

  it("the sheet makes no claim about how the picture is made", () => {
    h.ui = ui;
    const claim = translate(ui, "trust.avatar.notRealPhoto");
    expect(claim).not.toMatch(/hand|illustrat|drawn|painted|מצויר|צייר/i);
    expect(claim).toMatch(ui === "en" ? /not a real photo/ : /לא תמונה אמיתית/);
  });
});

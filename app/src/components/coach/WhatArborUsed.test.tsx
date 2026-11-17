import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ lang: "en" as "en" | "he" }));
vi.mock("../../context/LanguageContext", async () => {
  const { translate } = await import("../../lib/i18n");
  return { useLanguage: () => ({ uiLang: h.lang, t: (k: string, v?: Record<string, string | number>) => translate(h.lang, k, v) }) };
});
vi.mock("../ui/Icon", () => ({ Icon: ({ name }: { name: string }) => <i data-icon={name} /> }));
import WhatArborUsed from "./WhatArborUsed";

const basedOn = {
  facts: [{ memoryId: "m1", fact: "Settles faster with the night light on" }],
  fields: ["name", "age"] as never[],
  weekly: { moments: 4 },
};
const guides = [{ id: "transitions", title: "Why transitions are hard" }];
const strip = (s: string) => s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

describe("What Arbor used (V77, read-only)", () => {
  it("lists the child line, the guides, the remembered notes and this week — only what the answer carried", () => {
    const html = renderToStaticMarkup(<WhatArborUsed basedOn={basedOn} guides={guides} childName="Dylan" onOpenFact={() => {}} />);
    const text = strip(html);
    expect(text).toContain("What Arbor used");
    expect(text).toContain("Dylan");
    expect(text).toContain("1 guide");
    expect(text).toContain("Why transitions are hard");
    expect(text).toContain("1 remembered note");
    expect(text).toContain("Settles faster with the night light on");
    expect(html).toContain('data-testid="based-on-week"');
  });
  it("negative controls: nothing is removable, and no plan or record tile is invented", () => {
    const html = renderToStaticMarkup(<WhatArborUsed basedOn={basedOn} guides={guides} childName="Dylan" onOpenFact={() => {}} />);
    expect(html).not.toContain('data-icon="close"');
    expect(html).not.toMatch(/[Rr]emove/);
    expect(html).not.toContain('data-used="plan"');
    expect(html).not.toContain('data-used="records"');
    // the only buttons are the notes, which open the notebook (Correct / Forget live there)
    expect((html.match(/<button/g) ?? []).length).toBe(1);
  });
  it("renders nothing when the answer carried nothing", () => {
    expect(renderToStaticMarkup(<WhatArborUsed basedOn={{ facts: [], fields: [], weekly: null }} guides={[]} />)).toBe("");
  });
  it("HE: Hebrew title and counts", () => {
    h.lang = "he";
    const text = strip(renderToStaticMarkup(<WhatArborUsed basedOn={basedOn} guides={guides} onOpenFact={() => {}} />));
    expect(text).toContain("על מה ארבור נשענה");
    expect(text).toContain("מדריך אחד");
    expect(text).not.toContain("What Arbor used");
    h.lang = "en";
  });
});

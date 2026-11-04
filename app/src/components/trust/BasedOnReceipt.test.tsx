import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { translate } from "../../lib/i18n";
import BasedOnReceipt from "./BasedOnReceipt";

const lang = vi.hoisted(() => ({ value: "en" as "en" | "he" }));
vi.mock("../../context/LanguageContext", () => ({
  useLanguage: () => ({ uiLang: lang.value, t: (key: string, vars?: Record<string, string | number>) => translate(lang.value, key, vars) }),
}));

describe("Based on receipt", () => {
  it.each(["en", "he"] as const)("names the fact, the profile fields, and the week counts in %s", (locale) => {
    lang.value = locale;
    const open = vi.fn();
    const html = renderToStaticMarkup(
      <BasedOnReceipt
        onOpenFact={open}
        model={{
          facts: [{ memoryId: "m1", fact: "Bedtime goes better after a warm bath" }],
          fields: ["name", "age"],
          weekly: { moments: 3, words: 2 },
        }}
      />,
    );
    expect(html).toContain('data-testid="based-on"');
    expect(html).toContain(translate(locale, "companion.basedOn.label"));
    expect(html).toContain("Bedtime goes better after a warm bath");
    expect(html).toContain(translate(locale, "elev.memdisc.field.name"));
    expect(html).toContain(translate(locale, "elev.memdisc.field.age"));
    expect(html).toContain(translate(locale, "companion.basedOn.weekWords", { n: 3, words: 2 }));
    expect(html).not.toMatch(/%|Low|Medium|High|Urgent/);
  });

  it("an empty model renders nothing", () => {
    expect(renderToStaticMarkup(<BasedOnReceipt model={{ facts: [], fields: [] }} onOpenFact={() => undefined} />)).toBe("");
    expect(renderToStaticMarkup(<BasedOnReceipt model={null} onOpenFact={() => undefined} />)).toBe("");
  });
});

/**
 * B-CAREPRO-27 — rendered: a Free parent opening the School Brief sees a
 * teacher brief at once (built on the device from the teacher preset), can
 * reach "Save as PDF", and no request or paywall fires on the way. EN + HE.
 */
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { translate } from "../../lib/i18n";

const harness = vi.hoisted(() => ({
  locale: "en" as "en" | "he",
  generateBrief: vi.fn(),
  openPaywall: vi.fn(),
}));

vi.mock("../../context/ArborContext", () => ({
  useArbor: () => ({
    childProfile: { id: "c1", name: "Noa", age: 5, languages: ["Hebrew"], schoolContext: harness.locale === "he" ? "גן שקד" : "Gan Shaked", strengths: [harness.locale === "he" ? "בונה מגדלים" : "Builds towers"], challenges: [] },
    behaviorLogs: [],
    milestones: [],
    actionPlans: [{ id: "p1", title: harness.locale === "he" ? "התראה של חמש דקות" : "Five-minute warning", phases: [] }],
    setActiveTab: vi.fn(),
    openPaywall: harness.openPaywall,
  }),
}));
vi.mock("../../context/ToastContext", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("../../context/LanguageContext", () => ({
  useLanguage: () => ({
    uiLang: harness.locale,
    t: (key: string, vars?: Record<string, string | number>) => translate(harness.locale, key, vars),
  }),
}));
vi.mock("../../lib/api", async (orig) => {
  const actual = await orig<typeof import("../../lib/api")>();
  return { ...actual, api: { ...actual.api, generateBrief: harness.generateBrief } };
});
vi.mock("../ui/Modal", () => ({ Modal: () => null }));

import SchoolBrief from "./SchoolBrief";

beforeEach(() => {
  harness.generateBrief.mockReset();
  harness.openPaywall.mockReset();
});

describe("B-CAREPRO-27 · Free parent: a teacher brief on open, no paywall", () => {
  for (const locale of ["en", "he"] as const) {
    it(`${locale}: the draft renders with the profile's setting, strengths and what the family tries`, () => {
      harness.locale = locale;
      const html = renderToStaticMarkup(<SchoolBrief />);
      expect(html).toContain('data-module="brief-draft"');
      expect(html).toContain(locale === "he" ? "גן שקד" : "Setting: Gan Shaked.");
      expect(html).toContain(locale === "he" ? "בונה מגדלים" : "Builds towers");
      expect(html).toContain(locale === "he" ? "התראה של חמש דקות" : "Five-minute warning");
      // the one primary move is the print button, reachable without Plus
      expect((html.match(/data-primary-move="build-school-brief"/g) ?? []).length).toBe(1);
      expect(html).toContain(translate(locale, "elev.learnCare.brief.print"));
      // Plus is offered as the AI draft, not demanded
      expect(html).toContain('data-testid="school-brief-ai-draft"');
      expect(harness.generateBrief).not.toHaveBeenCalled();
      expect(harness.openPaywall).not.toHaveBeenCalled();
    });

    it(`${locale}: W2-CAREPRO r1 — Save as PDF comes before the document, no page kicker, labels name what the lists hold`, () => {
      harness.locale = locale;
      const html = renderToStaticMarkup(<SchoolBrief />);
      // the one move precedes the draft card in document order (above the fold)
      const move = html.indexOf('data-primary-move="build-school-brief"');
      const card = html.indexOf('data-module="brief-draft"');
      expect(move).toBeGreaterThan(-1);
      expect(move).toBeLessThan(card);
      // and it is the first control of its row
      expect(html.indexOf('data-testid="school-brief-ai-draft"')).toBeGreaterThan(move);
      // no "Care Network" kicker: the hub already names it
      expect(html).not.toContain(translate(locale, "schoolBrief.eyebrow"));
      // the draft hint is a caption INSIDE the card, not a preamble layer
      expect(html.indexOf('data-testid="school-brief-draft-hint"')).toBeGreaterThan(card);
      // strengths are labelled as strengths
      expect(html).toContain(translate(locale, "schoolBrief.section.strengths", { name: "Noa" }));
      expect(html).not.toContain(locale === "he" ? "מה מרגיע" : "What calms");
    });
  }
});

/* W2-CAREPRO r2 (law 8, P1 G0) — the Arbor-composed Hebrew overview reads in
   Hebrew order. translate() already isolates the name (FSI…PDI), but the
   paragraph was dir="auto", and the HTML dir=auto rule takes the first strong
   letter WITHOUT skipping isolate content — the Latin name — so the line
   resolved LTR and "Noa, 5" landed at the far end. The composed overview now
   takes the UI direction; dir=auto stays only on parent-typed list items. */
describe("W2-CAREPRO r2 · the HE overview is RTL with the name first", () => {
  const FSI = "⁨";
  const PDI = "⁩";
  /** HTML dir=auto: the first strong letter in the text, isolates NOT skipped. */
  const htmlAutoDirection = (text: string): "rtl" | "ltr" | null => {
    for (const ch of text) {
      if (/[֐-׿]/.test(ch)) return "rtl";
      if (/[A-Za-z]/.test(ch)) return "ltr";
    }
    return null;
  };
  const overviewOf = (html: string) => {
    const m = /<p data-testid="school-brief-overview" dir="(rtl|ltr|auto)"[^>]*>([^<]*)<\/p>/.exec(html);
    return m ? { dir: m[1], text: m[2] } : null;
  };

  it("HE: the paragraph is dir=rtl and the isolated name comes first", () => {
    harness.locale = "he";
    const ov = overviewOf(renderToStaticMarkup(<SchoolBrief />))!;
    expect(ov.dir).toBe("rtl");
    expect(ov.text.startsWith(`${FSI}Noa${PDI}`)).toBe(true);
    expect(ov.text).toContain("גן שקד");
  });

  it("negative control: under dir=auto this very line resolves LTR (the r2 defect)", () => {
    harness.locale = "he";
    const ov = overviewOf(renderToStaticMarkup(<SchoolBrief />))!;
    expect(htmlAutoDirection(ov.text)).toBe("ltr");
  });

  it("EN: dir=ltr", () => {
    harness.locale = "en";
    expect(overviewOf(renderToStaticMarkup(<SchoolBrief />))!.dir).toBe("ltr");
  });
});

/* W2-CAREPRO r2 (P1 G1) + B-CAREPRO-NEW-2d — the fold at 375/390 holds the
   overview and strengths: ONE action row (Save as PDF + the Plus draft), the
   edit toggle is a 44 px pencil in the card header, the non-diagnostic promise
   is a card-header caption (no green card above the document), and the note
   opens on a "Start here" line built from the first curated strength. */
describe("W2-CAREPRO r2 · one action row, promise in the card, a Start-here line", () => {
  for (const locale of ["en", "he"] as const) {
    it(`${locale}: the action row holds exactly the PDF move and the Plus draft; edit + promise live in the card header`, () => {
      harness.locale = locale;
      const html = renderToStaticMarkup(<SchoolBrief />);
      const rowStart = html.indexOf('data-testid="school-brief-actions"');
      const card = html.indexOf('data-module="brief-draft"');
      const row = html.slice(rowStart, card);
      expect(row).toContain("flex-nowrap");
      expect((row.match(/<button/g) ?? []).length).toBe(2);
      expect(row).toContain('data-primary-move="build-school-brief"');
      expect(row).toContain('data-testid="school-brief-ai-draft"');
      // nothing between the header and the action row: the green card is gone
      expect(html.slice(html.indexOf("</header>"), rowStart)).not.toContain("arbor-green-soft");
      const header = html.slice(html.indexOf('data-testid="school-brief-card-header"'), html.indexOf('data-testid="school-brief-overview"'));
      expect(header).toContain('data-testid="school-brief-promise"');
      expect(header).toContain(translate(locale, "schoolBrief.nonDiagnostic", { name: "Noa" }));
      expect(header).toMatch(/data-testid="school-brief-edit"[^>]*w-11 h-11/);
      expect(html.indexOf('data-testid="school-brief-edit"')).toBeGreaterThan(card);
    });

    it(`${locale}: "Start here" opens the note from the first strength, and the overview does not repeat it`, () => {
      harness.locale = locale;
      const html = renderToStaticMarkup(<SchoolBrief />);
      const opening = translate(locale, "elev.teacherBrief.opening.neutral", { name: "Noa", strength: locale === "he" ? "בונה מגדלים" : "builds towers" });
      const band = html.slice(html.indexOf('data-testid="school-brief-opening"'), html.indexOf('data-testid="school-brief-overview"'));
      expect(band).toContain(translate(locale, "elev.learnCare.brief.startHere"));
      expect(band).toContain(opening.replace(/'/g, "&#x27;"));
      expect(band).toContain("var(--arbor-peach-soft)");
      const overview = /<p data-testid="school-brief-overview"[^>]*>([^<]*)<\/p>/.exec(html)![1];
      expect(overview).not.toContain(opening);
      // the band sits under the card header, above the overview section
      expect(html.indexOf('data-testid="school-brief-opening"')).toBeGreaterThan(html.indexOf('data-testid="school-brief-card-header"'));
    });
  }

  it("unit: the opening line rides the curated overview first (prints first), follows gender, and is empty with no strength", async () => {
    const { teacherBriefDraft, buildPacketInput } = await import("../../consult/packet");
    const mk = (strengths: string[], gender?: string) => teacherBriefDraft(
      buildPacketInput({ profile: { id: "c1", name: "Dylan Cohen", age: 5, languages: ["English"], schoolContext: "", strengths, challenges: [], interests: [], gender } as never, logs: [], milestones: [], plans: [], memory: [] }, Date.now()),
      "en",
    );
    expect(mk(["Imaginative play"], "boy").openingLine).toBe("With Dylan, start from what he loves: imaginative play.");
    expect(mk(["Imaginative play"], "girl").openingLine).toContain("she loves");
    expect(mk([]).openingLine).toBe("");
    const he = teacherBriefDraft(
      buildPacketInput({ profile: { id: "c1", name: "Dylan", age: 5, languages: [], schoolContext: "", strengths: ["משחק דמיון"], challenges: [], interests: [], gender: "boy" } as never, logs: [], milestones: [], plans: [], memory: [] }, Date.now()),
      "he",
    );
    expect(he.openingLine).toBe("עם ⁨Dylan⁩, הכי טוב להתחיל ממה שהוא אוהב: משחק דמיון.");
    expect(he.openingLine).not.toMatch(/\//);
  });
});

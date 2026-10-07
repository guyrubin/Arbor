import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

/* B-LOOP-04 — the Notice card: three ≥ 44 px answers, "Seen it" opens the
   When strip, the age line is milestoneAgeLine's sentence (or nothing), no
   firewall-scan string, logical properties only (EN + HE at 375). */

const state = vi.hoisted(() => ({ lang: "en" as "en" | "he" }));
vi.mock("../../context/LanguageContext", async () => {
  const { translate } = await vi.importActual<typeof import("../../lib/i18n")>("../../lib/i18n");
  return {
    useLanguage: () => ({
      t: (k: string, v?: Record<string, string | number>) => translate(state.lang, k, v),
      uiLang: state.lang,
    }),
  };
});

import NoticeCard, { type NoticePhase } from "./NoticeCard";
import { translate } from "../../lib/i18n";
import { ALL_MILESTONES } from "../../lib/milestoneData";
import { milestoneAgeLine } from "../../lib/milestoneAgeLine";
import { loopFirewallHits } from "../../lib/loop/firewall";
import type { Milestone } from "../../types";

const cdc = ALL_MILESTONES.find((m) => m.id === "cdc-24m-1")!;
const asha = ALL_MILESTONES.find((m) => m.source?.org === "ASHA")!;

const render = (m: Milestone, lang: "en" | "he" = "en", phase: NoticePhase = "ask", gender: string | null = "girl") => {
  state.lang = lang;
  return renderToStaticMarkup(
    <NoticeCard milestone={m} shelf="words" gender={gender} childName="Noa" onAnswer={() => undefined} onWhen={() => undefined} onKeepQuote={() => undefined} onKeepPhoto={() => undefined} initialPhase={phase} />,
  );
};
const decode = (html: string) => html.replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&amp;/g, "&");
const text = (html: string) => decode(html.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();

describe("NoticeCard — the answers", () => {
  it("renders three answer buttons, each at least 44 px, Seen it first", () => {
    const html = render(cdc);
    const buttons = [...html.matchAll(/<button[^>]*data-answer="([a-z_]+)"[^>]*>/g)];
    expect(buttons.map((b) => b[1])).toEqual(["yes", "not_yet", "not_sure"]);
    for (const b of buttons) expect(b[0]).toMatch(/min-h-\[44px\]/);
    expect(text(html)).toContain("Seen it");
    expect(text(html)).toContain("Not yet");
    expect(text(html)).toContain("Not sure");
  });

  it('"Seen it" shows the When strip (Today · This week · Earlier) and the keep row, not the answers', () => {
    const html = render(cdc, "en", "seen");
    expect(html).toContain('data-testid="notice-when"');
    expect([...html.matchAll(/data-when="([a-z_]+)"/g)].map((m) => m[1])).toEqual(["today", "this_week", "earlier"]);
    for (const b of html.match(/<button[^>]*data-when[^>]*>/g) ?? []) expect(b).toMatch(/min-h-\[44px\]/);
    expect(html).toContain('data-testid="notice-keep-quote"');
    expect(html).not.toContain('data-testid="notice-answers"');
    expect(text(html)).toContain("Noted on Noa's Words shelf.");
  });

  it("critic r3: Undo sits on the receipt (seen and thanked), 44 px, EN + HE; absent without onUndo", () => {
    for (const p of ["seen", "thanked"] as const) {
      state.lang = "en";
      const html = renderToStaticMarkup(<NoticeCard milestone={cdc} shelf="words" onAnswer={() => undefined} onUndo={() => undefined} initialPhase={p} />);
      const btn = html.match(/<button[^>]*data-testid="notice-undo"[^>]*>/)?.[0] ?? "";
      expect(btn).toMatch(/min-h-\[44px\]/);
      expect(text(html)).toContain("Undo");
      state.lang = "he";
      expect(text(renderToStaticMarkup(<NoticeCard milestone={cdc} shelf="words" onAnswer={() => undefined} onUndo={() => undefined} initialPhase={p} />))).toContain("ביטול");
    }
    expect(render(cdc, "en", "seen")).not.toContain("notice-undo");
  });

  it('"Not yet" / "Not sure" thank in one neutral line', () => {
    const html = render(cdc, "en", "thanked");
    expect(html).toContain('data-testid="notice-thanks"');
    expect(html).not.toContain('data-testid="notice-answers"');
  });
});

describe("NoticeCard — the age line is the source's own sentence", () => {
  it("equals milestoneAgeLine for a CDC row (EN + HE)", () => {
    for (const lang of ["en", "he"] as const) {
      const line = milestoneAgeLine(cdc, (k, v) => translate(lang, k, v));
      expect(line).toBeTruthy();
      const html = render(cdc, lang);
      expect(text(html.match(/data-testid="notice-age-text">([^<]*)<\/span>/)![1])).toBe(line);
    }
  });

  it("is absent where milestoneAgeLine is null (an ASHA 'unstated' row)", () => {
    expect(milestoneAgeLine(asha, (k, v) => translate("en", k, v))).toBeNull();
    expect(render(asha)).not.toContain("notice-age-line");
  });

  it("is the same sentence whatever the answer phase", () => {
    const pick = (h: string) => h.match(/data-testid="notice-age-line"[^>]*>([\s\S]*?)<\/p>/)![1];
    expect(pick(render(cdc, "en", "thanked"))).toBe(pick(render(cdc, "en", "ask")));
  });
});

describe("NoticeCard — firewall and direction", () => {
  const phases: NoticePhase[] = ["ask", "seen", "thanked", "kept"];

  it("no string from the firewall scan list, in any phase (EN + HE)", () => {
    for (const p of phases) {
      const en = text(render(cdc, "en", p));
      const he = text(render(cdc, "he", p));
      expect(loopFirewallHits(en), `${p} EN`).toEqual([]);
      expect(loopFirewallHits(he), `${p} HE`).toEqual([]);
    }
  });

  it("EN + HE markup at 375 carries no physical-direction class, no raw hex, no image", () => {
    for (const lang of ["en", "he"] as const) {
      for (const p of phases) {
        const html = render(cdc, lang, p);
        expect(html).not.toMatch(/\b(?:ml|mr|pl|pr|left|right)-[\w[]/);
        expect(html).not.toMatch(/\btext-(?:left|right)\b/);
        expect(html).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
        expect(html).not.toMatch(/<img\b/);
      }
    }
  });

  it("Hebrew resolves the catalogue's slash forms from the child's gender", () => {
    const he = text(render(cdc, "he"));
    expect(he).not.toMatch(/[א-ת]\/[א-ת]/);
  });

  it("snapshot — EN and HE, ask phase", () => {
    expect(render(cdc, "en")).toMatchSnapshot();
    expect(render(cdc, "he")).toMatchSnapshot();
  });
});

describe("NoticeCard — 'Seen it' is filed next to the shelf's kept line (P5-LOOP c2 r2, B-LOOP-NEW-2f)", () => {
  for (const lang of ["en", "he"] as const) {
    it(`${lang}: the receipt echoes the kept quote — one t-sm ink-soft line, the quote editorial + dir=auto, no chip, no number`, () => {
      state.lang = lang;
      const html = renderToStaticMarkup(
        <NoticeCard milestone={cdc} shelf="words" gender="boy" childName="Dylan" onAnswer={() => undefined} initialPhase="seen" besideWords="big ball" />,
      );
      const receipt = html.match(/<p role="status" data-testid="notice-receipt"[\s\S]*?<\/p>/)![0];
      expect(receipt).toContain('data-beside="true"');
      expect(receipt).toMatch(/class="min-w-0 t-sm leading-snug" style="color:var\(--arbor-ink-soft\)"/);
      expect(receipt).toMatch(/<span dir="auto" style="font-family:var\(--font-editorial\)">“big ball”<\/span>/);
      expect(text(receipt)).toContain(text(translate(lang, "elev.loop.notice.seenReceiptBeside", { name: "Dylan", shelf: translate(lang, "elev.shelves.words") })));
      expect(text(receipt)).not.toMatch(/\d/);
      expect(receipt).not.toMatch(/rounded-full|background:/);
      // no kept line → the plain receipt, unchanged
      const plain = renderToStaticMarkup(<NoticeCard milestone={cdc} shelf="words" childName="Dylan" onAnswer={() => undefined} initialPhase="seen" />);
      expect(plain).not.toContain('data-beside="true"');
      expect(text(plain)).toContain(text(translate(lang, "elev.loop.notice.seenReceipt", { name: "Dylan", shelf: translate(lang, "elev.shelves.words") })));
    });
  }
  it("the shelf map passes the shelf's newest kept line", async () => {
    const { readFileSync } = await import("node:fs");
    const path = await import("node:path");
    const src = readFileSync(path.resolve(__dirname, "../tabs/MilestonesTab.tsx"), "utf8");
    expect(src).toContain("besideWords={ownWords[shelf]?.[0]?.text ?? null}");
  });
});

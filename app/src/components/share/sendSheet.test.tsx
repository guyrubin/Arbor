/**
 * B-SHELL-29 — the ONE send sheet: child content leaves only as editable text,
 * one closing line, no URL, no referral code, no image. Payload fixtures EN +
 * HE (a kept quote month, a hard-moment sentence, a weekly card), the text-only
 * share path with its loop events, and the sheet's rendered body.
 */
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { translate } from "../../lib/i18n";

const h = vi.hoisted(() => ({ locale: "en" as "en" | "he", events: [] as unknown[][] }));
vi.mock("../../context/LanguageContext", () => ({
  useLanguage: () => ({ uiLang: h.locale, t: (k: string, v?: Record<string, string | number>) => translate(h.locale, k, v) }),
}));
vi.mock("../../context/AuthContext", () => ({ useAuth: () => ({ user: { displayName: "Guy Rubin" } }) }));
vi.mock("../../lib/loopEvents", async (orig) => {
  const real = await orig<typeof import("../../lib/loopEvents")>();
  return {
    ...real,
    trackShareInitiated: (...a: unknown[]) => void h.events.push(["initiated", ...a]),
    trackShareCompleted: (...a: unknown[]) => void h.events.push(["completed", ...a]),
  };
});
// The sheet renders through Modal (SSR has no matchMedia → not compact); portal-free stub.
vi.mock("../ui/Modal", () => ({ Modal: ({ title, children }: { title?: string; children: React.ReactNode }) => <div data-stub="modal" aria-label={title}>{children}</div> }));
vi.mock("../ui/Sheet", () => ({ Sheet: () => null, useCompactSurface: () => false }));

import { SendSheet, sendSheetText } from "./SendSheet";
import { shareButtonText } from "../ui/ShareButton";
import { sendTextShare, textFromCardOpts } from "../../lib/share";
import { saidSendText } from "../growth/SaidPage";

const NO_LINK = /https?:|www\.|\.com\b|\.app\b|ref=|utm_|\bcode\b/i;

describe("B-SHELL-29 · payload fixtures (EN + HE)", () => {
  for (const lang of ["en", "he"] as const) {
    const t = (k: string, v?: Record<string, string | number>) => translate(lang, k, v);
    it(`${lang}: a kept quote month — the quotes as lines + the closing line`, () => {
      const closing = t("elev.words.page.closing", { parent: "Guy", name: "Dylan" });
      const text = saidSendText([{ id: "a", note: "Daddy, the moon is following our car", noticedOn: "2026-10-05" }], { lang, closing });
      expect(text.split("\n")).toHaveLength(2);
      expect(text.split("\n")[1]).toBe(closing);
      expect(text).not.toMatch(NO_LINK);
    });
    it(`${lang}: a weekly card through ShareButton — the card's words, then 'From Arbor — {parent}'s notes about {name}'`, () => {
      const text = shareButtonText(
        { name: "Dylan", headline: "Bedtime went smoother three nights", sub: "The two-minute warning helped" },
        { caption: "share.caption.growth", parent: "Guy", t },
      );
      expect(text.split("\n")).toEqual([
        "Bedtime went smoother three nights",
        "The two-minute warning helped",
        t("elev.words.page.closing", { parent: "Guy", name: "Dylan" }),
      ]);
      expect(text).not.toMatch(NO_LINK);
    });
    it(`${lang}: an avatar card with no words of its own falls back to its caption, link-free`, () => {
      const text = shareButtonText({ name: "Dylan", imageUrl: "data:image/png;base64,AAAA" }, { caption: "share.caption.avatar", parent: "Guy", t });
      expect(text).not.toMatch(NO_LINK);
      expect(text).not.toContain("data:image");
      expect(text.split("\n").length).toBe(2);
    });
  }
  it("the closing line reads as the item says (EN) and names the parent and child (HE)", () => {
    expect(translate("en", "elev.words.page.closing", { parent: "Guy", name: "Dylan" }).replace(/[⁨⁩]/g, "")).toBe("From Arbor — Guy's notes about Dylan");
    expect(translate("he", "elev.words.page.closing", { parent: "גיא", name: "דילן" }).replace(/[⁨⁩]/g, "")).toBe("מתוך ארבור — הרשימות של גיא על דילן");
  });
  it("textFromCardOpts drops the image and the name; sendSheetText drops blanks", () => {
    expect(textFromCardOpts({ imageUrl: "x.png", name: "Dylan", title: "  The brave owl " })).toEqual(["The brave owl"]);
    expect(sendSheetText(["a", "", null, " b "], "c")).toBe("a\nb\nc");
  });
});

describe("B-SHELL-29 · the text-only share path", () => {
  it("navigator.share gets { text } only — never url, never files — and the loop events fire", async () => {
    h.events = [];
    const share = vi.fn(async (_d: ShareData) => {});
    await expect(sendTextShare({ artifact: "growth_card", surface: "said_page", text: "hi" }, { share, clipboard: undefined as unknown as Clipboard })).resolves.toBe("shared");
    expect(share).toHaveBeenCalledWith({ text: "hi" });
    expect(h.events).toEqual([["initiated", "growth_card", "said_page"], ["completed", "growth_card", "text"]]);
  });
  it("no share sheet → clipboard, channel 'clipboard'", async () => {
    h.events = [];
    const writeText = vi.fn(async () => {});
    await expect(sendTextShare({ artifact: "story", surface: "s", text: "x" }, { share: undefined as unknown as Navigator["share"], clipboard: { writeText } as unknown as Clipboard })).resolves.toBe("copied");
    expect(writeText).toHaveBeenCalledWith("x");
    expect(h.events.at(-1)).toEqual(["completed", "story", "clipboard"]);
  });
});

describe("B-SHELL-29 · the sheet", () => {
  for (const lang of ["en", "he"] as const) {
    it(`${lang}: an editable textarea prefilled with the text, the only-text line, one Send`, () => {
      h.locale = lang;
      const html = renderToStaticMarkup(<SendSheet open onClose={() => {}} text={"“Daddy, the moon”\nFrom Arbor"} artifact="growth_card" surface="said_page" />);
      expect(html).toContain('data-testid="send-sheet"');
      expect(html).toMatch(/<textarea[^>]*dir="auto"/);
      expect(html).toContain("“Daddy, the moon”");
      expect(html).toContain(translate(lang, "elev.words.send.onlyText"));
      expect(html.match(/data-testid="send-sheet-send"/g)).toHaveLength(1);
      expect(html).not.toMatch(/<img|<canvas|href=/);
      expect(html).not.toMatch(/gradient|uppercase/);
    });
  }
});

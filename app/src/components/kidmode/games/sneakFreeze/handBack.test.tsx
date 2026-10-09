/**
 * B-GAME-10 — the hand-back card: one count (times the child reached the cat,
 * from the sitting records' `rounds` only), the play-for-real line, Keep, and
 * Share only behind the sandbox flag, through the OS share sheet with no
 * network request. FIREWALL: no %, no level/band/score word, no catch or miss
 * count, no verdict chip, no arrow.
 */
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { translate } from "../../../../lib/i18n";
import { dataUrlToBlob, shareImageFile } from "../../../../lib/share";
import { SneakHandBackView } from "../../SneakHandBackCard";
import { dismissSneakHandBack, offerSneakHandBack, playRealKey, reachedKey, reachedTheCatToday } from "./handBack";

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (...p: string[]) => readFileSync(path.join(here, ...p), "utf8");
const textOf = (html: string) => html.replace(/<[^>]*>/g, " ").replace(/&[a-z#0-9]+;/gi, " ");

const NOW = new Date(2026, 9, 6, 18, 0, 0);
const TODAY = "2026-10-06";
/** Records as the practice ledger holds them, with fields the card must never read. */
const EVENTS = [
  { game: "sneak-freeze", day: TODAY, rounds: 3, kind: "stop-signal", durationBucket: "3-5m", experiences: ["sunglasses"], score: 99, correct: false, catches: 7, level: 3 },
  { game: "sneak-freeze", day: TODAY, rounds: 3, kind: "stop-signal", catches: 2, misses: 4 },
  { game: "sneak-freeze", day: "2026-10-05", rounds: 3 },
  { game: "beat-keeper", day: TODAY, rounds: 9, correct: true },
  { kind: "mood-checkin", day: TODAY },
] as unknown as { game?: string; day?: string; rounds?: number }[];

function card(lang: "en" | "he", name: string, gender: string | undefined, share: boolean) {
  const reached = reachedTheCatToday(EVENTS, NOW);
  return renderToStaticMarkup(
    <SneakHandBackView
      picture="data:image/jpeg;base64,AAAA"
      pictureAlt={translate(lang, "handBack.sneakFreeze.pictureAlt", { name })}
      label={translate(lang, "handBack.sneakFreeze.label")}
      reachedLine={translate(lang, reachedKey(name, gender, reached), { name, count: reached })}
      playRealLine={translate(lang, playRealKey(name, gender), { name })}
      keepLabel={translate(lang, "elev.learnCare.kidExit.keep")}
      shareLabel={share ? translate(lang, "handBack.sneakFreeze.share") : null}
      closeLabel={translate(lang, "aria.close")}
      onKeep={() => {}}
      onShare={() => {}}
      onClose={() => {}}
    />,
  );
}

afterEach(() => { vi.unstubAllGlobals(); dismissSneakHandBack(); });

describe("the count: only times the child reached the cat", () => {
  it("sums today's Sneak & Freeze `rounds` (tags) and nothing else", () => {
    expect(reachedTheCatToday(EVENTS, NOW)).toBe(6);
    expect(reachedTheCatToday([], NOW)).toBe(0);
    expect(reachedTheCatToday(EVENTS, new Date(2026, 9, 7))).toBe(0);
    // the source reads game, day and rounds — never catches, misses, level, score, duration
    const src = read("handBack.ts").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
    expect(src).not.toMatch(/\.(catches|misses|level|band|score|correct|durationBucket|experiences)\b/);
  });
});

describe("FIREWALL: the card from a fixture", () => {
  for (const [lang, name, gender] of [["en", "Dylan", "boy"], ["he", "דילן", "boy"], ["he", "מיה", "girl"], ["he", "נוי", undefined], ["en", "", undefined]] as const) {
    it(`${lang} ${gender ?? "neutral"}${name ? "" : " no name"}: no %, no level/band/score word, one number only — the reached count`, () => {
      const html = card(lang, name, gender, true);
      const text = textOf(html);
      expect(text).not.toContain("%");
      expect(text).not.toMatch(/\b(level|band|score|scores|streak|accuracy)\b/i);
      expect(text).not.toMatch(/שלב|ציון/);
      expect(text).not.toMatch(/[↑↓↗↘▲▼→←]/);
      expect(html).not.toMatch(/--arbor-(green|pink|amber|red|success|warn)/); // no coloured verdict chip
      expect(text.match(/\d+/g) ?? []).toEqual(["6"]);
      if (name) expect(text).toContain(name);
      if (lang === "he") expect(text).not.toMatch(/[A-Za-z]{3}/);
      expect(html).toContain("data-hand-back-picture");
      expect(html).toContain("data-hand-back-keep");
    });
  }

  it("Hebrew in three forms for both lines; English for both", () => {
    const forms = [["boy"], ["girl"], [undefined]] as const;
    const reached = new Set(forms.map(([g]) => translate("he", reachedKey("נוי", g, 3), { name: "נוי", count: 3 })));
    const real = new Set(forms.map(([g]) => translate("he", playRealKey("נוי", g), { name: "נוי" })));
    expect(reached.size).toBe(3);
    expect(real.size).toBe(3);
    expect(translate("en", reachedKey("Dylan", "boy", 3), { name: "Dylan", count: 3 })).toContain("reached the cat 3 times");
    expect(translate("en", playRealKey("Dylan", undefined), { name: "Dylan" })).toContain("Dylan is the cat");
    expect(translate("en", reachedKey("Dylan", "boy", 1), { name: "Dylan", count: 1 })).toContain("once");
  });

  it("Share is rendered only when the sandbox flag gives a label", () => {
    expect(card("en", "Dylan", "boy", false)).not.toContain("data-hand-back-share");
    expect(card("en", "Dylan", "boy", true)).toContain("data-hand-back-share");
    expect(read("..", "..", "SneakHandBackCard.tsx")).toContain('shareLabel={shareAllowed ? t("handBack.sneakFreeze.share") : null}');
  });
});

describe("Share: the device-rendered picture to the OS sheet, no network", () => {
  it("decodes the data url on the device and hands a JPEG file to the share sheet; no fetch, no link", async () => {
    const fetchSpy = vi.fn();
    const shared: { text?: string; files?: File[] }[] = [];
    vi.stubGlobal("fetch", fetchSpy);
    vi.stubGlobal("navigator", { share: async (d: { text?: string; files?: File[] }) => { shared.push(d); }, canShare: () => true });
    const res = await shareImageFile({ dataUrl: "data:image/jpeg;base64,/9j/4AAQ", filename: "statue.jpg" });
    expect(res).toEqual({ ok: true, channel: "web_share" });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(shared[0].files?.[0].type).toBe("image/jpeg");
    expect(shared[0].text ?? "").not.toMatch(/https?:/);
    expect(dataUrlToBlob("https://x/y.jpg")).toBeNull();
    const src = read("..", "..", "..", "..", "lib", "share.ts");
    const fn = src.slice(src.indexOf("export async function shareImageFile"));
    expect(fn).not.toMatch(/track|referral|buildShareUrl|fetch\(|api\./);
  });
});

describe("wiring: offered on exit, shown once Kid Mode is closed, memory only", () => {
  it("the exit recap offers the card after a finished sitting today, instead of the strip", () => {
    const recap = read("..", "..", "KidExitRecap.tsx");
    expect(recap).toContain("const reached = reachedTheCatToday(practice.events?.items ?? [], new Date());");
    expect(recap).toMatch(/if \(reached > 0\) \{\s*offerSneakHandBack\(/);
    const ctx = read("..", "..", "KidModeContext.tsx");
    expect(ctx).toContain("{!isKidModeOpen && <SneakHandBackCard />}");
    const cardSrc = read("..", "..", "SneakHandBackCard.tsx");
    expect(cardSrc).toContain("onKeep={async () => { if (await addMoment(keep)) dismissSneakHandBack(); }}");
    expect(cardSrc).not.toMatch(/["']kid\./); // parent register copy only
    expect(() => offerSneakHandBack({ childId: "c1", name: "Dylan", reached: 3, keepLine: null })).not.toThrow();
  });
});

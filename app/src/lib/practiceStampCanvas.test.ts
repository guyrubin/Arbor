import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHeroAvatarCanvas, renderPracticeStampCanvas } from "./heroAvatarCanvas";
import { translate } from "./i18n";
import { localizedMimicPacks } from "../practice/mimicContent";

type Draw = {
  text: string; x: number; y: number; width: number;
  align: CanvasTextAlign; direction: CanvasDirection; font: string;
};

// Record the ACTUAL canvas seam, not a mocked renderShareCard/helper. Synthetic
// text metrics make direction/alignment/coordinate failures deterministic;
// this is not a browser-font or pixel-layout certification. No image, download,
// sharing, provider or real canvas export is invoked.
function recordingCanvas() {
  const draws: Draw[] = [];
  const states: { textAlign: CanvasTextAlign; direction: CanvasDirection; font: string }[] = [];
  const ctx = {
    textAlign: "start" as CanvasTextAlign,
    direction: "inherit" as CanvasDirection,
    font: "10px sans-serif",
    fillStyle: "", textBaseline: "alphabetic",
    beginPath() {}, moveTo() {}, arcTo() {}, closePath() {}, fill() {}, fillRect() {}, arc() {}, clip() {},
    createLinearGradient: () => ({ addColorStop() {} }),
    save() { states.push({ textAlign: this.textAlign, direction: this.direction, font: this.font }); },
    restore() { Object.assign(this, states.pop()); },
    measureText(text: string) {
      const size = Number(/(\d+)px/.exec(this.font)![1]);
      return { width: Array.from(text.replace(/[\u2066-\u2069]/g, "")).length * size * 0.5 };
    },
    fillText(text: string, x: number, y: number) {
      draws.push({ text, x, y, width: this.measureText(text).width, align: this.textAlign, direction: this.direction, font: this.font });
    },
  };
  const canvas = {
    width: 0, height: 0,
    getContext: () => ctx,
    toDataURL: () => "data:image/png;base64,SYNTHETIC",
    toBlob: (callback: (blob: Blob) => void) => callback(new Blob(["synthetic"])),
  };
  return { canvas, draws };
}

let created: ReturnType<typeof recordingCanvas>[];
let createElement: ReturnType<typeof vi.fn>;
const bounds = (draw: Draw) => ({
  left: draw.align === "right" ? draw.x - draw.width : draw.x,
  right: draw.align === "right" ? draw.x : draw.x + draw.width,
});
const panelCopy = (draws: Draw[]) => draws.filter((draw) => draw.y < 900);

beforeEach(() => {
  created = [];
  createElement = vi.fn((tag: string) => {
    if (tag !== "canvas") throw new Error(`Unexpected DOM action: ${tag}`);
    const record = recordingCanvas(); created.push(record); return record.canvas;
  });
  vi.stubGlobal("document", { createElement });
  vi.stubGlobal("Image", class { constructor() { throw new Error("No image loading in stamp tests"); } });
  vi.stubGlobal("fetch", () => { throw new Error("No network in stamp tests"); });
  vi.stubGlobal("navigator", { share: () => { throw new Error("No sharing in stamp tests"); } });
});
afterEach(() => vi.unstubAllGlobals());

describe("localized practice stamp through the real canvas renderer", () => {
  it.each(["en", "he"] as const)("draws every %s pack's label, headline and count inward from the correct panel edge", async (lang) => {
    const packs = localizedMimicPacks((key) => translate(lang, key));
    for (const pack of packs) {
      const eyebrow = translate(lang, "elev.mimic.stamp.eyebrow");
      const headline = translate(lang, "elev.mimic.stamp.headline", { pack: pack.title });
      const sub = translate(lang, "elev.mimic.stamp.sub", { name: "Noa", count: pack.prompts.length });
      await renderPracticeStampCanvas({ name: "Noa", eyebrow, headline, sub });
      const { canvas, draws } = created.at(-1)!;
      expect([canvas.width, canvas.height]).toEqual([1080, 1350]);
      const copy = panelCopy(draws);
      expect(copy[0].text).toBe(eyebrow.toUpperCase());
      expect(copy.filter((draw) => draw.font.startsWith("700 64px")).map((draw) => draw.text).join(" ")).toBe(headline);
      expect(copy.filter((draw) => draw.font.startsWith("500 44px")).map((draw) => draw.text).join(" ")).toBe(sub);
      for (const draw of copy) {
        expect(draw.align).toBe(lang === "he" ? "right" : "left");
        expect(draw.direction).toBe(lang === "he" ? "rtl" : "ltr");
        expect(draw.x).toBe(lang === "he" ? 920 : 160);
        expect(bounds(draw).left).toBeGreaterThanOrEqual(160);
        expect(bounds(draw).right).toBeLessThanOrEqual(920);
      }
      if (lang === "he") expect(draws.some((draw) => draw.text === "PROGRESS")).toBe(false);
      // The intentionally Latin brand and child name are outside the translated
      // content label. No permissions or share/download controls are activated.
      expect(draws.slice(-2).map((draw) => draw.text)).toEqual(["Made with Arbor", "arborparentingapp.com"]);
    }
    expect(createElement.mock.calls.every(([tag]) => tag === "canvas")).toBe(true);
  });

  it("preserves the English stamp's drawing text, coordinates, direction and alignment", async () => {
    await renderPracticeStampCanvas({ name: "Noa", eyebrow: "Progress", headline: "Sounds complete!", sub: "Noa finished all 6 rounds" });
    expect(created[0].draws.map(({ text, x, y, align, direction }) => ({ text, x, y, align, direction }))).toEqual([
      { text: "PROGRESS", x: 160, y: 260, align: "left", direction: "ltr" },
      { text: "Sounds complete!", x: 160, y: 370, align: "left", direction: "ltr" },
      { text: "Noa finished all 6 rounds", x: 160, y: 480, align: "left", direction: "ltr" },
      { text: "Noa", x: 346, y: 936, align: "left", direction: "ltr" },
      { text: "Made with Arbor", x: 540, y: 1264, align: "center", direction: "ltr" },
      { text: "arborparentingapp.com", x: 540, y: 1306, align: "center", direction: "ltr" },
    ]);
  });

  it("resets alignment for each block when Hebrew headline and English count copy are mixed", async () => {
    await renderPracticeStampCanvas({ eyebrow: "התקדמות", headline: "סיימנו את הערכה", sub: "Noa finished all 6 rounds" });
    const [label, headline, sub] = panelCopy(created[0].draws);
    expect([label.align, label.direction, label.x]).toEqual(["right", "rtl", 920]);
    expect([headline.align, headline.direction, headline.x]).toEqual(["right", "rtl", 920]);
    expect([sub.align, sub.direction, sub.x]).toEqual(["left", "ltr", 160]);
  });

  it("confines the practice label override to the practice-stamp template", async () => {
    for (const [template, label] of [["story", "AN ARBOR STORY"], ["comic", "AN ARBOR STORY"], ["milestone", "PROGRESS"]] as const) {
      await renderHeroAvatarCanvas(template, { eyebrow: "חותמת תרגול", title: "Our story", headline: "A moment" });
      const draws = created.at(-1)!.draws;
      expect(draws[0].text).toBe(label);
      expect(draws.some((draw) => draw.text === "חותמת תרגול")).toBe(false);
    }
    await renderPracticeStampCanvas({ headline: "A moment" });
    expect(created.at(-1)!.draws[0].text).toBe("PROGRESS");
  });

  it("negative control: the pre-fix left alignment at the RTL anchor overflows", () => {
    const legacy: Draw = { text: "הערכה הושלמה", x: 920, y: 370, width: 400, align: "left", direction: "rtl", font: "700 64px Georgia" };
    expect(bounds(legacy).right).toBeGreaterThan(1080);
    expect(bounds({ ...legacy, align: "right" })).toEqual({ left: 520, right: 920 });
  });
});

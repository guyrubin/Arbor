/**
 * AI-V7 — the voice overlay bottom sheet.
 *
 * Acceptance pinned here:
 *  (1) all phases visually distinct WITHOUT reading text (distinct orb modes /
 *      shapes per phase, exposed structurally via data-orb-mode + markup);
 *  (2) captions are dir="auto" + aria-live (interim = the parent's own words,
 *      answer = the already-screened voice output) and always mounted;
 *  (3) reduced-motion renders static phase states (no keyframes, no
 *      animations) — pinned with a snapshot;
 *  (4) calm green register, tokens only (no hex literals in the markup);
 *  (5) full RTL mirroring (dir="rtl" + logical utilities) in Hebrew.
 *
 * Rendered via renderToStaticMarkup (house pattern — no DOM harness; the mic
 * AnalyserNode loop lives in useEffect, which never runs in static renders).
 */
import { describe, it, expect } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import VoiceOverlay, { orbMode, type VoiceOverlayPhase } from "./VoiceOverlay";
import type { UiLang } from "../../lib/i18n";

const noop = () => {};

function render(over: Partial<React.ComponentProps<typeof VoiceOverlay>> = {}): string {
  return renderToStaticMarkup(
    React.createElement(VoiceOverlay, {
      phase: "listening" as VoiceOverlayPhase,
      lang: "en" as UiLang,
      interimText: "",
      answerText: "",
      canInterrupt: false,
      reducedMotion: false,
      onOrbTap: noop,
      onClose: noop,
      ...over,
    }),
  );
}

describe("orbMode — pure phase → visual mapping", () => {
  it("maps each phase to a distinct animated mode", () => {
    expect(orbMode("listening", false)).toBe("pulse");
    expect(orbMode("thinking", false)).toBe("shimmer");
    expect(orbMode("speaking", false)).toBe("wave");
  });

  it("reduced motion is always static, for every phase", () => {
    expect(orbMode("listening", true)).toBe("static");
    expect(orbMode("thinking", true)).toBe("static");
    expect(orbMode("speaking", true)).toBe("static");
  });
});

describe("phases are visually distinct without reading text", () => {
  it("each phase renders a different orb mode + shape", () => {
    const listening = render({ phase: "listening" });
    const thinking = render({ phase: "thinking" });
    const speaking = render({ phase: "speaking" });
    expect(listening).toContain('data-orb-mode="pulse"');
    expect(thinking).toContain('data-orb-mode="shimmer"');
    expect(speaking).toContain('data-orb-mode="wave"');
    // Shape, not just labels: mic icon while listening, ellipsis while
    // thinking, waveform bars while speaking.
    expect(listening).toContain("mic");
    expect(thinking).toContain("more_horiz");
    expect(speaking).toContain("animation:vo-wave");
    expect(listening).not.toContain("animation:vo-wave");
    // The mic-level halo exists only while listening (real AnalyserNode drive).
    expect(listening).toContain("--vo-level");
    expect(thinking).not.toContain("--vo-level");
  });

  it("data-phase distinguishes all phases structurally", () => {
    for (const phase of ["listening", "thinking", "speaking"] as const) {
      expect(render({ phase })).toContain(`data-phase="${phase}"`);
    }
  });
});

describe("captions — parent's own words + screened answer only", () => {
  it("both caption slots are dir=auto, aria-live, and always mounted", () => {
    const html = render({ interimText: "so about mornings", answerText: "Try a visual routine." });
    expect(html.match(/dir="auto"/g)?.length).toBe(2);
    expect(html.match(/aria-live="polite"/g)?.length).toBe(2);
    expect(html).toContain("so about mornings");
    expect(html).toContain("Try a visual routine.");
    // Mounted even when empty — aria-live regions must pre-exist to announce.
    const empty = render({ interimText: "", answerText: "" });
    expect(empty.match(/aria-live="polite"/g)?.length).toBe(2);
  });

  it("Hebrew interim words render inside the dir=auto caption (RTL-safe)", () => {
    const html = render({ lang: "he" as UiLang, interimText: "מה עם הבקרים" });
    expect(html).toContain("מה עם הבקרים");
    expect(html).toContain('dir="auto"');
  });
});

describe("controls — tap-orb barge-in + X = end", () => {
  it("the orb offers tap-to-interrupt only when the fallback loop is speaking", () => {
    const speaking = render({ phase: "speaking", canInterrupt: true });
    expect(speaking).toContain('aria-label="Tap to interrupt"');
    expect(speaking).not.toContain('disabled=""'); // the orb is tappable
    const listening = render({ phase: "listening", canInterrupt: false });
    expect(listening).not.toContain("Tap to interrupt");
    expect(listening).toContain('disabled="" aria-label="Listening…"');
  });

  it("the close button is labeled End voice conversation (X = end)", () => {
    expect(render()).toContain('aria-label="End voice conversation"');
    expect(render({ lang: "he" as UiLang })).toContain("סיום השיחה הקולית");
  });
});

describe("register — calm green, tokens only, RTL mirroring", () => {
  it("uses --arbor-* green tokens and NO hex color literals", () => {
    const html = render({ phase: "speaking", canInterrupt: true, interimText: "a", answerText: "b" });
    expect(html).toContain("var(--arbor-green-soft)");
    expect(html).toContain("var(--arbor-green-ink)");
    // No raw hex colors anywhere in inline styles (tokens only).
    expect(html).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });

  it("Hebrew flips the sheet to dir=rtl with localized phase labels", () => {
    const html = render({ lang: "he" as UiLang });
    expect(html).toMatch(/<section[^>]*dir="rtl"/);
    expect(html).toContain("מקשיב…");
    expect(html).toContain("שיחה קולית עם ארבור");
  });

  it("English renders dir=ltr", () => {
    expect(render()).toMatch(/<section[^>]*dir="ltr"/);
  });
});

describe("reduced motion — static phase states", () => {
  it("no keyframes and no animations under reduced motion, phases still distinct", () => {
    for (const phase of ["listening", "thinking", "speaking"] as const) {
      const html = render({ phase, reducedMotion: true });
      expect(html).not.toContain("@keyframes");
      expect(html).not.toContain("animation");
      expect(html).toContain('data-orb-mode="static"');
      expect(html).toContain(`data-phase="${phase}"`);
    }
    // Distinct shapes survive: static waveform bars vs mic vs ellipsis.
    expect(render({ phase: "speaking", reducedMotion: true })).toContain("w-1.5 rounded-full");
    expect(render({ phase: "listening", reducedMotion: true })).toContain("mic");
    expect(render({ phase: "thinking", reducedMotion: true })).toContain("more_horiz");
  });

  it("reduced-motion snapshot (speaking)", () => {
    expect(render({ phase: "speaking", reducedMotion: true, answerText: "Keep goodbyes short." })).toMatchSnapshot();
  });

  it("reduced-motion snapshot (listening)", () => {
    expect(render({ phase: "listening", reducedMotion: true, interimText: "what about mornings" })).toMatchSnapshot();
  });
});

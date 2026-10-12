/**
 * B-SHELL-28 — "Capture" is said once on Today: the capture bar carries the
 * ONE label ("Tell Arbor what's happening"); the prompt card's heading is the
 * question and its button says "Write it down"; the repeated
 * "Capture a moment in {name}'s story" lines are gone (aria-label only).
 */
import React from "react";
import fs from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { translate } from "../../lib/i18n";

const harness = vi.hoisted(() => ({ lang: "en" as "en" | "he" }));
vi.mock("../../context/LanguageContext", () => ({
  useLanguage: () => ({ uiLang: harness.lang, t: (k: string, v?: Record<string, string | number>) => translate(harness.lang, k, v) }),
}));
vi.mock("../trust/TrustLink", () => ({ TrustLink: () => null }));
import PromptCaptureCard from "../overview/PromptCaptureCard";

const read = (p: string) => fs.readFileSync(path.resolve(__dirname, p), "utf8");
const TODAY = ["../companion/NowView.tsx", "../companion/NowMoreForToday.tsx", "../overview/QuickCaptureBar.tsx", "../overview/PromptCaptureCard.tsx", "../overview/FromRecordCard.tsx"].map(read).join("\n");

describe("B-SHELL-28 — one capture label on Today", () => {
  it("the label key renders exactly once across Today's files (the capture bar)", () => {
    expect(TODAY.match(/t\("today\.capture\.cta"\)/g)).toHaveLength(1);
    expect(read("../overview/QuickCaptureBar.tsx")).toContain('{t("today.capture.cta")}');
    expect(TODAY).not.toContain('t("today.intent.captureTitle")');
    // "Capture a moment in {name}'s story" survives only as an aria-label
    for (const m of TODAY.matchAll(/t\("today\.capture\.aria"/g)) {
      expect(TODAY.slice(Math.max(0, m.index! - 12), m.index!)).toContain("aria-label");
    }
  });

  for (const lang of ["en", "he"] as const) {
    it(`${lang}: the prompt card says no capture label; heading = the question; button = "Write it down"`, () => {
      harness.lang = lang;
      const html = renderToStaticMarkup(<PromptCaptureCard promptKey="elev.prompt.early-school.29" childName="Dylan" onCapture={() => {}} gender="boy" />);
      expect(html).not.toContain(translate(lang, "today.capture.cta"));
      expect(html).not.toContain(translate(lang, "today.intent.captureTitle"));
      expect(html).not.toContain(translate(lang, "today.capture.aria", { name: "Dylan" }));
      expect(html).toContain(translate(lang, "today.prompt.write"));
      if (lang === "en") expect(html).toMatch(/<h2[^>]*>[^<]*What did he wonder about out loud today\?/);
    });
  }
});

import React from "react";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import RecordingIndicator, { formatElapsed } from "./RecordingIndicator";
import { translate } from "../../lib/i18n";

/* REC-01 (Guy, 8 Oct 2026: "when I'm recording a voice, there is no indication
   of recording"). Pins (1) the indicator's anatomy, (2) that the capture sheet
   mounts it ABOVE every branch so a hard-moment recording is never silent, and
   (3) that Behaviours uses the same component with its pinned caption id. */

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(here, "..", "..");
const read = (rel: string) => readFileSync(path.join(SRC, rel), "utf8");
const stripComments = (code: string) => code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const html = (interim = "") =>
  renderToStaticMarkup(
    <RecordingIndicator
      interim={interim}
      hint="Listening — take your time, pauses are okay."
      label="Recording"
      stopLabel="Stop"
      stopAria="Stop recording"
      onStop={() => {}}
      testId="t-rec"
      captionTestId="t-cap"
    />,
  );

describe("REC-01 · RecordingIndicator anatomy", () => {
  it("says Recording, shows a ticking time, a 44 px Stop with an accessible name, and a status role", () => {
    const out = html();
    expect(out).toContain('role="status"');
    expect(out).toContain(">Recording<");
    expect(out).toContain('data-testid="t-rec-time"');
    expect(out).toMatch(/data-testid="t-rec-time"[^>]*>0:00</);
    expect(out).toMatch(/aria-label="Stop recording"[^>]*data-testid="t-rec-stop"[^>]*class="[^"]*min-h-11[^"]*min-w-11/);
  });

  it("the dot pulses only because the component is mounted only while recording (real presence)", () => {
    const out = html();
    expect(out).toContain("animate-pulse");
    expect(out).toContain("var(--arbor-danger)");
  });

  it("the timer is hidden from screen readers; the caption is a polite live region in the calm register", () => {
    const out = html();
    expect(out).toMatch(/aria-hidden="true"[^>]*data-testid="t-rec-time"/);
    const caption = /<p[^>]*data-testid="t-cap"[^>]*>[\s\S]*?<\/p>/.exec(out)?.[0] ?? "";
    expect(caption).toContain('dir="auto"');
    expect(caption).toContain('aria-live="polite"');
    expect(caption).toContain("var(--arbor-muted)");
  });

  it("shows the hint until words arrive, then the parent's own words", () => {
    expect(html()).toContain("Listening — take your time");
    const spoken = html("He took the shoes off again");
    expect(spoken).toContain("He took the shoes off again");
    expect(spoken).not.toContain("Listening — take your time");
  });

  it("formats elapsed time as m:ss", () => {
    expect(formatElapsed(0)).toBe("0:00");
    expect(formatElapsed(7.9)).toBe("0:07");
    expect(formatElapsed(65)).toBe("1:05");
    expect(formatElapsed(-3)).toBe("0:00");
  });

  it("strings exist in English and Hebrew", () => {
    for (const k of ["elev.rec.on", "elev.rec.stopAria", "elev.ql.voice.stop", "beh.capture.listening"]) {
      const enText = translate("en", k);
      const heText = translate("he", k);
      expect(enText, `en ${k}`).not.toBe(k);
      // translate falls back to English, so a missing Hebrew key reads as the English text.
      expect(heText, `he ${k}`).not.toBe(enText);
    }
  });
});

describe("REC-01 · the capture sheet is never silent while the mic is on", () => {
  const modal = stripComments(read("components/overview/QuickLogModal.tsx"));

  it("mounts exactly one RecordingIndicator, gated on listening", () => {
    expect((modal.match(/<RecordingIndicator/g) ?? []).length).toBe(1);
    expect(modal).toMatch(/\{listening && \(\s*<div className="mb-4">\s*<RecordingIndicator/);
  });

  it("renders it BEFORE the branch switch, so hard moment, review and escalation all show it", () => {
    const indicator = modal.indexOf("<RecordingIndicator");
    const hardGuide = modal.indexOf('data-testid="quicklog-hard-guide"');
    const escalation = modal.indexOf('data-testid="quicklog-escalation"');
    const momentForm = modal.indexOf('data-testid="quicklog-moment-form"');
    expect(indicator).toBeGreaterThan(-1);
    expect(indicator).toBeLessThan(hardGuide);
    expect(indicator).toBeLessThan(escalation);
    expect(indicator).toBeLessThan(momentForm);
  });

  it("the old moment-form-only strip is gone (negative control: the pre-fix shape is detectable)", () => {
    const preFix = '<div className="flex items-start gap-3 rounded-xl p-3" role="status" data-testid="quicklog-listening"';
    expect(preFix).toContain('data-testid="quicklog-listening"');
    expect(modal).not.toContain(preFix);
    const formStart = modal.indexOf('data-testid="quicklog-moment-form"');
    expect(modal.slice(formStart)).not.toContain("<RecordingIndicator");
  });
});

describe("REC-01 · Behaviours delegates recording to the guarded sheet", () => {
  const behaviors = stripComments(read("components/tabs/BehaviorsTab.tsx"));
  it("launches voice through the one capture sheet and cannot open an unindicated microphone", () => {
    expect(behaviors).toContain("onMode={(mode) => openCaptureSheet({ mode })}");
    expect(behaviors).not.toMatch(/startDictation|listening|<RecordingIndicator/);
    const modal = stripComments(read("components/overview/QuickLogModal.tsx"));
    expect(modal).toContain('captionTestId="quicklog-listening-caption"');
    expect(modal).toMatch(/\{listening && \(\s*<div className="mb-4">\s*<RecordingIndicator/);
  });
});

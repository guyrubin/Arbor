import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { resolveEmailProvider, sendWeeklyDigestEmail } from "./emailProvider.js";
import { buildDigestEmail, computeWeeklyDigestStats, fallbackDigestNarrative } from "./digest.js";

/**
 * W2 2.2 — the weekly-email seam is FAIL-CLOSED (masterplan 2026-08-11 §4
 * item 2.2 · Maytal Row-1 #6). No provider is configured today: status must
 * report disabled, sends must refuse (never fake), and the preview render
 * must reuse the digest's own fields under the same clinical firewall
 * (counts only — the previous week's count never reaches the email body).
 */

const NOW = Date.parse("2026-08-11T12:00:00.000Z");
const daysAgo = (n: number) => new Date(NOW - n * 86_400_000).toISOString();
const log = (n: number, resolved = false) => ({
  timestamp: daysAgo(n),
  behaviorType: "Transition refusal",
  intensity: 3,
  durationMinutes: 10,
  context: "Home",
  resolved,
});

describe("resolveEmailProvider — fail-closed configuration", () => {
  it("no EMAIL_PROVIDER env → disabled", () => {
    expect(resolveEmailProvider({})).toEqual({ enabled: false, provider: null, send: null });
  });

  it("an EMAIL_PROVIDER name with no implemented provider stays DISABLED (typo-proof)", () => {
    expect(resolveEmailProvider({ EMAIL_PROVIDER: "postmark" }).enabled).toBe(false);
    expect(resolveEmailProvider({ EMAIL_PROVIDER: "  SES  " }).enabled).toBe(false);
  });

  it("empty/whitespace values are treated as unset", () => {
    expect(resolveEmailProvider({ EMAIL_PROVIDER: "   " }).enabled).toBe(false);
  });
});

describe("sendWeeklyDigestEmail — never fakes a send", () => {
  it("without a provider it returns a typed refusal, not a success", async () => {
    const res = await sendWeeklyDigestEmail(
      { to: "parent@example.com", subject: "s", preheader: "p", bodyText: "b" },
      {}
    );
    expect(res).toEqual({ sent: false, reason: "not_configured" });
  });
});

describe("buildDigestEmail — digest-field reuse under the clinical firewall", () => {
  const stats = { ...computeWeeklyDigestStats([log(1), log(2, true), log(3)], [{ title: "m", checked: true }], NOW), previousWeekMoments: 999 };
  const narrative = fallbackDigestNarrative("Maya", stats);

  it("subject is the frame-6 notification voice, localized, with the child's name", () => {
    const en = buildDigestEmail({ childName: "Maya", language: "en", narrative, stats });
    const he = buildDigestEmail({ childName: "מאיה", language: "he", narrative, stats });
    expect(en.subject).toContain("Maya");
    expect(en.subject).toContain("💚");
    expect(he.subject).toContain("מאיה");
    expect(he.subject).toMatch(/תובנה חדשה/);
  });

  it("preheader reuses the digest's own preheader", () => {
    const out = buildDigestEmail({ childName: "Maya", language: "en", narrative, stats });
    expect(out.preheader).toBe(narrative.preheader);
  });

  it("body carries the digest fields: summary, highlights, tryThisWeek, this week's counts", () => {
    const { bodyText } = buildDigestEmail({ childName: "Maya", language: "en", narrative, stats });
    expect(bodyText).toContain(narrative.summary.slice(0, 40));
    expect(bodyText).toContain(narrative.tryThisWeek);
    expect(bodyText).toContain(`${stats.momentsLogged} moments`);
    expect(bodyText).toContain(`milestones: ${stats.milestonesDone} of ${stats.milestonesTotal}`);
  });

  it("clinical firewall: the previous week's count NEVER renders (counts only, no deltas, no %)", () => {
    for (const language of ["en", "he"] as const) {
      const out = buildDigestEmail({ childName: "Maya", language, narrative, stats });
      const all = `${out.subject}\n${out.preheader}\n${out.bodyText}`;
      expect(all).not.toContain("999"); // previousWeekMoments sentinel
      expect(all).not.toMatch(/\bmore than last\b|\bless than last\b|\btrend\b|[↑↓📈📉]|\d+\s*%/iu);
    }
  });
});

/* ── route wiring (source scan, house pattern) ────────────────────────────── */

describe("routes/api.ts — digest email endpoints", () => {
  const src = fs.readFileSync(path.resolve(__dirname, "..", "routes", "api.ts"), "utf8");
  const previewRoute = src.slice(src.indexOf('router.post("/digest/email-preview"'), src.indexOf('router.get("/privacy/export'));

  it("exposes email-status and email-preview next to /digest", () => {
    expect(src).toContain('router.get("/digest/email-status"');
    expect(src).toContain('router.post("/digest/email-preview"');
    expect(src).toContain("resolveEmailProvider");
  });

  it("the preview renders digest fields and NEVER sends", () => {
    expect(previewRoute).toContain("fallbackDigestNarrative");
    expect(previewRoute).toContain("buildDigestEmail");
    expect(previewRoute).not.toContain("sendWeeklyDigestEmail");
    expect(previewRoute).not.toMatch(/\.send\(/);
  });
});

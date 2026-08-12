import { describe, it, expect, vi } from "vitest";
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

  // The Resend adapter is implemented, so "configured" now has a credentials
  // axis too: naming a real provider without its own env must NOT half-enable
  // the channel and then throw at send time, in front of a parent.
  it("a REAL provider name without its credentials stays DISABLED", () => {
    expect(resolveEmailProvider({ EMAIL_PROVIDER: "resend" }).enabled).toBe(false);
    expect(resolveEmailProvider({ EMAIL_PROVIDER: "resend", RESEND_API_KEY: "re_x" }).enabled).toBe(false);
    expect(resolveEmailProvider({ EMAIL_PROVIDER: "resend", EMAIL_FROM: "a@b.co" }).enabled).toBe(false);
    expect(resolveEmailProvider({ EMAIL_PROVIDER: "resend", RESEND_API_KEY: " ", EMAIL_FROM: " " }).enabled).toBe(false);
  });

  it("a real provider WITH full credentials enables — and only then", () => {
    const r = resolveEmailProvider({ EMAIL_PROVIDER: "resend", RESEND_API_KEY: "re_x", EMAIL_FROM: "Arbor <hi@a.co>" });
    expect(r.enabled).toBe(true);
    expect(r.provider).toBe("resend");
    expect(typeof r.send).toBe("function");
  });
});

describe("resend adapter — request shape and secret hygiene", () => {
  const ENV = { EMAIL_PROVIDER: "resend", RESEND_API_KEY: "re_secret_key", EMAIL_FROM: "Arbor <hi@a.co>" };
  const MSG = { to: "parent@example.com", subject: "נושא", preheader: "p", bodyText: "counts only" };

  it("posts to Resend with the bearer token and the digest body as text", async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const fetchMock = vi.fn(async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return { ok: true, status: 200, json: async () => ({ id: "msg_1" }) } as unknown as Response;
    });
    vi.stubGlobal("fetch", fetchMock);
    const res = await sendWeeklyDigestEmail(MSG, ENV);
    expect(res).toEqual({ sent: true, id: "msg_1" });
    expect(calls[0].url).toBe("https://api.resend.com/emails");
    const headers = calls[0].init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer re_secret_key");
    const body = JSON.parse(String(calls[0].init.body));
    expect(body.from).toBe("Arbor <hi@a.co>");
    expect(body.to).toEqual(["parent@example.com"]);
    expect(body.subject).toBe("נושא");
    expect(body.text).toBe("counts only");
    // Plain text only — no HTML part that could smuggle unscreened markup.
    expect(body.html).toBeUndefined();
    vi.unstubAllGlobals();
  });

  it("a provider failure throws WITHOUT leaking the message body or the key", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 422, json: async () => ({}) }) as unknown as Response));
    await expect(sendWeeklyDigestEmail(MSG, ENV)).rejects.toThrow(/HTTP 422/);
    await expect(sendWeeklyDigestEmail(MSG, ENV)).rejects.not.toThrow(/counts only|re_secret_key|parent@example\.com/);
    vi.unstubAllGlobals();
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

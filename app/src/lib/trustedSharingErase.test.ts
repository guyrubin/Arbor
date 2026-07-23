/**
 * CARE-1 — the "Delete child data" control must be REAL, not confirm/alert
 * theater (the old code claimed "processed server-side" without any API call).
 *
 * Covers:
 *  - network contract: eraseEverything() actually POSTs /api/privacy/erase
 *    with the childId and returns the server's DeletionReceipt counts
 *  - best-effort contract: a server failure still resolves with an honest
 *    zero-count receipt (client wipe proceeds, never a throw)
 *  - source contract: TrustedSharing.tsx has ZERO window.confirm/alert left,
 *    uses the app Modal with typed child-name confirmation, runs through
 *    ProfileContext.deleteChild → eraseEverything (the ONE allow-listed erase
 *    seam), renders the DeletionReceipt done-state, and routes away after
 *  - i18n contract: the whole delete flow has EN + HE copy (no silent fallback)
 *
 * Node harness (vitest environment: "node") — no DOM, no React rendering.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { eraseEverything } from "./childData";
import { setAuthTokenProvider } from "./api";
import { en, he } from "./i18n";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const readSrc = (rel: string): string =>
  readFileSync(path.join(__dirname, "..", rel), "utf8");

// ── Network contract — the click path's seam hits /privacy/erase ────────────
describe("eraseEverything network contract (CARE-1)", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => setAuthTokenProvider(async () => null));
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("POSTs /api/privacy/erase with the childId and returns the server receipt counts", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    globalThis.fetch = (async (url: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ url: String(url), init });
      return new Response(
        JSON.stringify({
          erased: { memoryEvents: 4, shares: 2, consents: 1 },
          erasedAt: "2026-07-23T09:00:00.000Z",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }) as typeof fetch;

    const receipt = await eraseEverything(undefined, "child-42");

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("/api/privacy/erase");
    expect(calls[0].init?.method).toBe("POST");
    expect(JSON.parse(String(calls[0].init?.body))).toEqual({ childId: "child-42" });

    expect(receipt.childId).toBe("child-42");
    expect(receipt.counts).toEqual({ memoryEvents: 4, shares: 2, consents: 1 });
    // erasedAt is a valid ISO timestamp the parent can keep as proof.
    expect(Number.isFinite(new Date(receipt.erasedAt).getTime())).toBe(true);
  });

  it("still resolves with an honest zero-count receipt when the server erase fails", async () => {
    globalThis.fetch = (async () => {
      throw new Error("network down");
    }) as typeof fetch;

    const receipt = await eraseEverything(undefined, "child-7");
    expect(receipt.childId).toBe("child-7");
    expect(receipt.counts.memoryEvents).toBe(0);
    expect(receipt.counts.shares).toBe(0);
  });
});

// ── Source contract — TrustedSharing is wired to the real seam ──────────────
describe("TrustedSharing delete-control source contract (CARE-1)", () => {
  const src = readSrc("components/sections/TrustedSharing.tsx");

  it("has ZERO window.confirm / alert() left in the file", () => {
    expect(src).not.toMatch(/window\.confirm/);
    expect(src).not.toMatch(/\balert\s*\(/);
  });

  it("never again claims a deletion request was 'recorded' without an API call", () => {
    expect(src).not.toContain("Deletion request recorded");
  });

  it("uses the app Modal with typed child-name confirmation gating the destructive button", () => {
    expect(src).toContain("<Modal");
    expect(src).toContain('data-testid="delete-confirm-input"');
    expect(src).toContain("nameMatches");
    // The destructive button is disabled until the typed name matches.
    expect(src).toMatch(/disabled=\{!nameMatches/);
  });

  it("erases through ProfileContext.deleteChild (the allow-listed eraseEverything seam)", () => {
    expect(src).toContain("useProfile");
    expect(src).toMatch(/deleteChild\(/);
    // The chain's other link: ProfileContext.deleteChild → eraseEverything.
    const profileCtx = readSrc("context/ProfileContext.tsx");
    expect(profileCtx).toMatch(/deleteChild[\s\S]{0,400}eraseEverything\(/);
    // And eraseEverything → POST /privacy/erase (childData → api).
    const childData = readSrc("lib/childData.ts");
    expect(childData).toMatch(/eraseEverything[\s\S]{0,400}privacyErase\(/);
    const apiSrc = readSrc("lib/api.ts");
    expect(apiSrc).toContain('"/api/privacy/erase"');
  });

  it("renders the DeletionReceipt counts as the done-state and routes away after", () => {
    expect(src).toContain('data-testid="delete-receipt"');
    expect(src).toContain("receipt.counts.memoryEvents");
    expect(src).toContain("receipt.counts.shares");
    expect(src).toContain("receipt.counts.consents");
    expect(src).toContain("receipt.erasedAt");
    // Routing away from the deleted child once the receipt is acknowledged.
    expect(src).toMatch(/setActiveTab\("overview"\)/);
  });

  it("adds no raw hex literals (tokens only) in the delete flow markup", () => {
    // The new Modal block must be var(--arbor-*) only. (Legacy literals elsewhere
    // in the file are covered by the CARE parity entry, not re-audited here.)
    const modalBlock = src.slice(src.indexOf("<Modal"));
    expect(modalBlock.length).toBeGreaterThan(100);
    expect(modalBlock.match(/#[0-9a-fA-F]{3,6}\b/g) ?? []).toEqual([]);
  });
});

// ── i18n contract — EN + HE parity on the whole flow ────────────────────────
describe("delete-flow copy parity (CARE-1)", () => {
  const KEYS = [
    "sec.sharing.delete.btn",
    "sec.sharing.delete.title",
    "sec.sharing.delete.body",
    "sec.sharing.delete.typeToConfirm",
    "sec.sharing.delete.confirm",
    "sec.sharing.delete.working",
    "sec.sharing.delete.cancel",
    "sec.sharing.delete.error",
    "sec.sharing.receipt.title",
    "sec.sharing.receipt.body",
    "sec.sharing.receipt.memoryEvents",
    "sec.sharing.receipt.shares",
    "sec.sharing.receipt.consents",
    "sec.sharing.receipt.done",
  ] as const;

  it("all delete/receipt keys exist in EN and HE (no silent fallback)", () => {
    for (const k of KEYS) {
      expect(en[k], `en missing ${k}`).toBeTruthy();
      expect(he[k], `he missing ${k}`).toBeTruthy();
      expect(he[k], `he not translated for ${k}`).not.toBe(en[k]);
    }
  });

  it("the body copy is honest: permanent, server-side, irreversible — no fake 'request recorded'", () => {
    expect(en["sec.sharing.delete.body"]).toMatch(/permanently/i);
    expect(en["sec.sharing.delete.body"]).toMatch(/cannot be undone/i);
    expect(en["sec.sharing.delete.body"]).not.toMatch(/request.*recorded/i);
  });
});

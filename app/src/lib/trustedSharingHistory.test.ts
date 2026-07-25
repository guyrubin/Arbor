/**
 * CARE-6 + CARE-8 — persistent sharing history and the single roster.
 *
 * CARE-6: the share audit trail must be the persistent grant records
 * (created/expired/revoked with dates) served via /api/shares?history=1, NOT a
 * session-ephemeral useState list that dies on navigation.
 * CARE-8: the identical `team` array must render exactly ONCE — one card per
 * grant (InitialsTile visual) with the revoke action folded in.
 *
 * Node harness (vitest environment: "node") — source contracts + i18n parity,
 * mirroring trustedSharingErase.test.ts.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { en, he } from "./i18n";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const readSrc = (rel: string): string =>
  readFileSync(path.join(__dirname, "..", rel), "utf8");

const src = readSrc("components/sections/TrustedSharing.tsx");

// ── CARE-6: real history, wired end-to-end ───────────────────────────────────
describe("sharing history is persistent grant records (CARE-6)", () => {
  it("TrustedSharing requests the FULL grant record set (history: true)", () => {
    expect(src).toMatch(/listShares\(childProfile\.id, \{ history: true \}\)/);
  });

  it("the client api layer sends history=1 to /api/shares", () => {
    const apiSrc = readSrc("lib/api.ts");
    expect(apiSrc).toMatch(/history.*"1"/);
  });

  it("the route passes ?history=1 through as includeInactive on the OWNER read only", () => {
    const routes = readFileSync(path.join(__dirname, "..", "routes", "api.ts"), "utf8");
    expect(routes).toMatch(/req\.query\.history === "1"/);
    expect(routes).toMatch(/listByOwner\(uid, childId, \{ includeInactive \}\)/);
    // Recipient-side reads never opt into inactive grants.
    expect(routes).not.toMatch(/listByRecipient\([^)]*includeInactive/);
  });

  it("renders a real Sharing history section from grant dates, replacing the session list", () => {
    // History rows come from the grant records' own dates.
    expect(src).toContain('data-testid="sharing-history"');
    expect(src).toContain("sec.sharing.history.title");
    expect(src).toContain("sec.sharing.history.empty");
    expect(src).toMatch(/history\.map\(/);
    expect(src).toMatch(/revokedOn.*revokedAt/s);
    expect(src).toMatch(/expiredOn.*expiresAt/s);
    expect(src).toMatch(/createdOn.*createdAt/s);
    // The ephemeral session list is GONE: no audit useState, no session card.
    expect(src).not.toMatch(/setAudit/);
    expect(src).not.toContain("sec.sharing.audit.title");
  });

  it("splits live vs ended grants client-side (revoked OR expired ⇒ history)", () => {
    expect(src).toMatch(/isLiveGrant/);
    expect(src).toMatch(/!g\.revokedAt && \(!g\.expiresAt \|\| Date\.parse\(g\.expiresAt\) > Date\.now\(\)\)/);
  });
});

// ── CARE-8: ONE roster card per grant ────────────────────────────────────────
describe("single share roster (CARE-8)", () => {
  it("the owner team array renders exactly once", () => {
    expect(src.match(/team\.map\(/g) ?? []).toHaveLength(1);
  });

  it("the merged card keeps the richer InitialsTile visual with revoke folded in", () => {
    const rosterBlock = src.slice(src.indexOf("team.map("), src.indexOf("inbound.length"));
    expect(rosterBlock).toContain("InitialsTile");
    expect(rosterBlock).toMatch(/revoke\(g\)/);
    expect(rosterBlock).toContain("sec.sharing.revoke");
  });

  it("the duplicate 'Active shares' framing is gone", () => {
    expect(src).not.toContain("sec.sharing.active.title");
    // active.title was removed from BOTH dictionaries (no orphan keys).
    expect(en["sec.sharing.active.title"]).toBeUndefined();
    expect(he["sec.sharing.active.title"]).toBeUndefined();
  });
});

// ── i18n contract — EN + HE parity on the history copy ───────────────────────
describe("sharing-history copy parity (CARE-6)", () => {
  const KEYS = [
    "sec.sharing.history.title",
    "sec.sharing.history.empty",
    "sec.sharing.history.createdOn",
    "sec.sharing.history.revokedOn",
    "sec.sharing.history.expiredOn",
  ] as const;

  it("all history keys exist in EN and HE (no silent fallback)", () => {
    for (const k of KEYS) {
      expect(en[k], `en missing ${k}`).toBeTruthy();
      expect(he[k], `he missing ${k}`).toBeTruthy();
      expect(he[k], `he not translated for ${k}`).not.toBe(en[k]);
    }
  });

  it("dated templates interpolate {date}", () => {
    for (const k of ["sec.sharing.history.createdOn", "sec.sharing.history.revokedOn", "sec.sharing.history.expiredOn"] as const) {
      expect(en[k]).toContain("{date}");
      expect(he[k]).toContain("{date}");
    }
  });
});

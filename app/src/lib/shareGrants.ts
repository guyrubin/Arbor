/**
 * v3 EXTRA-CARE — what "live" means for a share grant, outside the Trusted
 * Sharing page. A grant is live while it is neither revoked nor past its
 * expiry: the same rule the roster applies (TrustedSharing.tsx isLiveGrant;
 * components/care/careLanding.test.tsx fails if the two expressions drift).
 * The Care landing's "Who sees what" lists live grants only, so it can never
 * imply sharing that has ended or was never granted.
 */
import type { ShareGrant } from "../types";
import { scopeDisplayLabels } from "./shareScopes";

export function isLiveGrant(g: Pick<ShareGrant, "revokedAt" | "expiresAt">): boolean {
  return !g.revokedAt && (!g.expiresAt || Date.parse(g.expiresAt) > Date.now());
}

export type GrantRow = {
  id: string;
  /** The recipient's address, verbatim (an LTR isolate on screen). */
  who: string;
  /** i18n key of the recipient's role. */
  roleKey: string;
  /** What they can see: the workspace label or the granted scopes' labels. */
  what: string[];
  /** The grant's end, when it has one. */
  expiresAt: string | null;
};

/** The live grants as rows for a compact summary, newest first. The shared
 *  family workspace (a co-parent) sees everything, so it says that instead of
 *  listing scopes. */
export function liveGrantRows(
  grants: readonly ShareGrant[],
  t: (key: string) => string,
  workspaceLabel: string,
): GrantRow[] {
  return grants
    .filter(isLiveGrant)
    .slice()
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0))
    .map((g) => ({
      id: g.id,
      who: g.recipientEmail,
      roleKey: `share.role.${g.role}`,
      what: g.accessMode === "family_workspace" ? [workspaceLabel] : scopeDisplayLabels(g.scopes, t),
      expiresAt: g.expiresAt,
    }));
}

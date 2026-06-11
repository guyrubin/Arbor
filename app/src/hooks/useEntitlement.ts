import { useEffect, useState } from "react";
import { api, type EntitlementInfo } from "../lib/api";

/** Default while loading / when the API is unreachable: full access (beta posture). */
const OPEN_ACCESS: EntitlementInfo = {
  plan: "plus",
  limits: { coachMessagesPerDay: null, maxChildren: 6, professionalReports: true, advancedPlans: true },
  source: "client_default",
  enforced: false,
  usage: { coachMessagesToday: 0 },
};

// Module-level cache so every consumer shares one fetch per session.
let cached: EntitlementInfo | null = null;
let inflight: Promise<EntitlementInfo> | null = null;

const fetchEntitlement = () => {
  if (!inflight) {
    inflight = api.entitlement()
      .then((e) => { cached = e; return e; })
      .catch(() => OPEN_ACCESS)
      .finally(() => { inflight = null; });
  }
  return inflight;
};

/** Invalidate after an upgrade (e.g. future billing success redirect). */
export const refreshEntitlement = () => { cached = null; return fetchEntitlement(); };

/**
 * MON-1 client seam: read the parent's plan, limits, and coach usage. While
 * entitlements are unenforced (beta) this resolves to Plus and no UI gates show.
 */
export function useEntitlement(): { entitlement: EntitlementInfo; loading: boolean } {
  const [entitlement, setEntitlement] = useState<EntitlementInfo>(cached || OPEN_ACCESS);
  const [loading, setLoading] = useState(!cached);

  useEffect(() => {
    let alive = true;
    if (!cached) {
      void fetchEntitlement().then((e) => {
        if (alive) { setEntitlement(e); setLoading(false); }
      });
    }
    return () => { alive = false; };
  }, []);

  return { entitlement, loading };
}

import { useEffect, useState } from "react";
import { api, type EntitlementInfo } from "../lib/api";

/** Default while loading / when the API is unreachable: fail closed to Free. */
const FALLBACK_FREE: EntitlementInfo = {
  plan: "free",
  limits: { coachMessagesPerDay: 10, maxChildren: 1, professionalReports: false, advancedPlans: false, coParentSeats: 0 },
  source: "client_fallback",
  enforced: true,
  usage: { coachMessagesToday: 0 },
  status: "active",
};

// Module-level cache so every consumer shares one fetch per session.
let cached: EntitlementInfo | null = null;
let inflight: Promise<EntitlementInfo> | null = null;

const fetchEntitlement = () => {
  if (!inflight) {
    inflight = api.entitlement()
      .then((e) => { cached = e; return e; })
      .catch(() => FALLBACK_FREE)
      .finally(() => { inflight = null; });
  }
  return inflight;
};

/** Invalidate after an upgrade (e.g. future billing success redirect). */
export const refreshEntitlement = () => { cached = null; return fetchEntitlement(); };

/**
 * MON-1 client seam: read the parent's plan, limits, and coach usage. The server
 * can still return beta Plus when enforcement is explicitly disabled; otherwise
 * the client fails closed until the entitlement endpoint answers.
 */
export function useEntitlement(): { entitlement: EntitlementInfo; loading: boolean } {
  const [entitlement, setEntitlement] = useState<EntitlementInfo>(cached || FALLBACK_FREE);
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

/**
 * lib/plans/planPlateSource — B-BOOK-75 (plates painted in-product): a plan
 * plate whose `file` is the shared-storage route (/api/plans/plates/…,
 * lib/library/plans/planPlates.planPlateFile) cannot be a plain <img src>:
 * the route keeps the app's auth. The reader fetches it with the bearer token
 * and shows a blob: URL (one fetch per plate per session, shared by every
 * page that reads the plate). A 404 (unpainted) keeps today's behaviour: the
 * original route stays in the source list, the <img> errors and the renderer
 * advances. A committed static plate passes through untouched.
 */
import { useEffect, useMemo, useState } from "react";
import { authHeaders } from "../api";
import { isApiPlanPlateUrl } from "../library/plans/planPlates";

const loads = new Map<string, Promise<string | null>>();

/** The blob: URL of a painted plate, null when it is not painted (404) or unreadable. */
export function loadPlanPlateUrl(url: string): Promise<string | null> {
  let p = loads.get(url);
  if (!p) {
    p = (async () => {
      try {
        const headers = await authHeaders();
        delete headers["Content-Type"];
        const res = await fetch(url, { headers });
        if (!res.ok) return null;
        return URL.createObjectURL(await res.blob());
      } catch {
        return null;
      }
    })();
    loads.set(url, p);
    // A failed read is tried again on the next mount; a painted plate is kept.
    void p.then((u) => { if (u === null) loads.delete(url); });
  }
  return p;
}

/** Test seam. */
export function resetPlanPlateSources(): void {
  loads.clear();
}

/** The sources to hand the <img> chain: static sources as they are, an API
 *  plate as its blob: URL once read (omitted while loading, kept as the route
 *  itself when the read failed so the chain errors and advances as today). */
export function usePlanPlateSrcs(srcs: readonly string[]): string[] {
  const key = srcs.join("|");
  const [resolved, setResolved] = useState<Record<string, string | null>>({});
  useEffect(() => {
    let live = true;
    for (const s of srcs) {
      if (!isApiPlanPlateUrl(s) || Object.prototype.hasOwnProperty.call(resolved, s)) continue;
      void loadPlanPlateUrl(s).then((u) => { if (live) setResolved((r) => (Object.prototype.hasOwnProperty.call(r, s) ? r : { ...r, [s]: u })); });
    }
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return useMemo(() => {
    const out: string[] = [];
    for (const s of srcs) {
      if (!isApiPlanPlateUrl(s)) out.push(s);
      else if (Object.prototype.hasOwnProperty.call(resolved, s)) out.push(resolved[s] ?? s);
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, resolved]);
}

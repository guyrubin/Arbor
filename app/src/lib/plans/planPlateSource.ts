/**
 * lib/plans/planPlateSource — B-BOOK-75 (plates painted in-product): a plan
 * plate whose `file` is the shared-storage route (/api/plans/plates/…,
 * lib/library/plans/planPlates.planPlateFile) cannot be a plain <img src>:
 * the route keeps the app's auth. The reader fetches it with the bearer token
 * and shows a blob: URL (one fetch per plate per session, shared by every
 * page that reads the plate). An unavailable plate is omitted from the image
 * chain: an <img> cannot send the bearer token. The reader can offer a
 * deliberate retry through this same authenticated read, never a paint call.
 * A committed static plate passes through untouched.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
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
        const blob = await res.blob();
        // A successful app-shell/auth response is not a picture. Do not pin
        // it in the session cache and leave every following page blank.
        if (!/^image\/(?:webp|png|jpeg)$/i.test(blob.type) || blob.size === 0) return null;
        return URL.createObjectURL(blob);
      } catch {
        return null;
      }
    })();
    loads.set(url, p);
    // A failed read is tried again on the next mount; a painted plate is kept.
    void p.then((u) => { if (u === null && loads.get(url) === p) loads.delete(url); });
  }
  return p;
}

/** Test seam. */
export function resetPlanPlateSources(): void {
  loads.clear();
}

/** A read-only picture request. One explicit retry starts one new attempt;
 * there is no automatic retry loop and other cached plates are preserved. */
export function usePlanPlatePicture(srcs: readonly string[]) {
  const key = srcs.join("|");
  const [attempt, setAttempt] = useState(0);
  const [resolved, setResolved] = useState<Record<string, string | null>>({});
  useEffect(() => {
    let live = true;
    for (const s of srcs) {
      if (!isApiPlanPlateUrl(s) || Object.prototype.hasOwnProperty.call(resolved, s)) continue;
      void loadPlanPlateUrl(s).then((u) => { if (live) setResolved((r) => (Object.prototype.hasOwnProperty.call(r, s) ? r : { ...r, [s]: u })); });
    }
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, attempt]);
  const sources = useMemo(() => {
    const out: string[] = [];
    for (const s of srcs) {
      if (!isApiPlanPlateUrl(s)) out.push(s);
      else if (resolved[s]) out.push(resolved[s]!);
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, resolved]);
  const pending = srcs.some((s) => isApiPlanPlateUrl(s) && !Object.prototype.hasOwnProperty.call(resolved, s));
  const retry = useCallback(() => {
    if (pending) return;
    // The caller retries only after the image chain failed. Invalidate only
    // this picture, including an unreadable cached blob, not the whole book.
    for (const s of srcs) if (isApiPlanPlateUrl(s)) loads.delete(s);
    setResolved((previous) => {
      const next = { ...previous };
      for (const s of srcs) if (isApiPlanPlateUrl(s)) delete next[s];
      return next;
    });
    setAttempt((n) => n + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, pending]);
  return { sources, pending, attempt, retry };
}

/** Existing cover/state-plate consumers need only the source chain. */
export function usePlanPlateSrcs(srcs: readonly string[]): string[] {
  return usePlanPlatePicture(srcs).sources;
}

import { useEffect, useState } from "react";

/** One render clock for identity, visit window and the evening door. The dev
 * clock seam already shifts Date; refresh on minute boundaries and re-entry. */
export function useNowClock(): Date {
  const [, tick] = useState(0);
  useEffect(() => {
    const refresh = () => tick(n => n + 1);
    const timer = window.setInterval(refresh, 60_000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);
  return new Date();
}

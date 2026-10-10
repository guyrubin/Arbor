import { useCallback, useEffect, useMemo, useRef } from "react";

/** Optional host-owned source receipt. No target means the existing standalone
 * flow; a targeted Consult binds outgoing actions to its confirmed live visit. */
export interface ConsultEgressGuard {
  isCurrent: () => boolean;
}

/** Also retire callbacks after the editor unmounts or changes source receipt. */
export function useConsultEgress(guard?: ConsultEgressGuard) {
  const receipt = useMemo(() => ({}), [guard]);
  const latest = useRef(receipt);
  latest.current = receipt;
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const isCurrent = useCallback(() => mounted.current && latest.current === receipt && (!guard || guard.isCurrent()), [guard, receipt]);
  return { receipt, isCurrent };
}

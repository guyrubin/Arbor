import { useLayoutEffect, useRef } from "react";

/** One request per pose in this mounted, identity-keyed review. A late result
 * cannot settle a later child's review, including a switch away and back. */
export function useProfileReviewRequests() {
  const active = useRef(true);
  const pending = useRef(new Set<string>());
  useLayoutEffect(() => {
    active.current = true;
    return () => { active.current = false; };
  }, []);
  return {
    begin(pose: string): boolean {
      if (!active.current || pending.current.has(pose)) return false;
      pending.current.add(pose);
      return true;
    },
    finish(pose: string): boolean {
      pending.current.delete(pose);
      return active.current;
    },
  };
}

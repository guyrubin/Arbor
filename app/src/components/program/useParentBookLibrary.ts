import { useMemo } from "react";
import { useChildCollection } from "../../hooks/useChildCollection";
import { bookDocsOnDevice, libraryBookEntries } from "../../lib/bookAssets";
import type { BookAssetsDoc } from "../../lib/library/bookAssetPaths";
import type { PlanBookDoc } from "../../lib/library/plans/planBookDoc";

/** Read-only, owner/child-scoped; a failed collection never supplies private art. */
export function useParentBookLibrary(childId: string, now: Date) {
  const assets = useChildCollection<BookAssetsDoc>(childId, "bookAssets");
  const plans = useChildCollection<PlanBookDoc>(childId, "books");
  const ready = assets.loaded && !assets.error && plans.loaded && !plans.error && (assets.remote || bookDocsOnDevice());
  const entries = useMemo(() => ready ? libraryBookEntries(assets.items, plans.items, now) : [], [ready, assets.items, plans.items, now]);
  return { entries, plans, isCurrent: () => ready && assets.isCurrent() && plans.isCurrent() };
}

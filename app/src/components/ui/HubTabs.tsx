import React, { Suspense, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { TabSkeleton } from "./Skeleton";

/* HubTabs — a faceted sub-surface: one leaf that holds several related panels.
   Used by the IA-v3 merges (Development, Practice, Consult) so confusable
   sibling tabs collapse into one labelled place with internal facets, reusing
   the existing tab components as panels. */

export interface HubPanel {
  id: string;
  label: string;
  icon?: LucideIcon;
  Comp: React.ComponentType;
}

export default function HubTabs({ panels, ariaLabel }: { panels: HubPanel[]; ariaLabel: string }) {
  const [active, setActive] = useState(panels[0]?.id);
  const Active = panels.find((p) => p.id === active)?.Comp ?? panels[0]?.Comp;

  return (
    <div className="space-y-5">
      <div role="tablist" aria-label={ariaLabel} className="flex gap-2 overflow-x-auto -mx-1 px-1 pb-1 no-scrollbar">
        {panels.map((p) => {
          const on = p.id === active;
          const Icon = p.icon;
          return (
            <button
              key={p.id}
              role="tab"
              aria-selected={on}
              onClick={() => setActive(p.id)}
              className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 min-h-[44px] text-[var(--t-sm)] font-bold whitespace-nowrap transition flex-shrink-0"
              style={on
                ? { background: "var(--arbor-primary)", color: "#fff", boxShadow: "var(--shadow-sm)" }
                : { background: "var(--arbor-paper-elevated)", color: "var(--arbor-muted)", border: "1px solid var(--arbor-rule)" }}
            >
              {Icon && <Icon className="w-3.5 h-3.5" />} {p.label}
            </button>
          );
        })}
      </div>
      <Suspense fallback={<TabSkeleton />}>
        {Active ? <Active /> : null}
      </Suspense>
    </div>
  );
}

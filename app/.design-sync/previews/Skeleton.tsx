import { Skeleton } from "arbor-private-beta-app";

export function Lines() {
  return (
    <div style={{ background: "var(--arbor-paper)", padding: 24, borderRadius: 24, maxWidth: 360 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    </div>
  );
}

export function CardPlaceholder() {
  return (
    <div style={{ background: "var(--arbor-paper)", padding: 24, borderRadius: 24, maxWidth: 360 }}>
      <div style={{ display: "flex", gap: 14, alignItems: "center", marginBottom: 16 }}>
        <Skeleton className="h-12 w-12 rounded-full" />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-20" />
        </div>
      </div>
      <Skeleton className="h-28 w-full" />
    </div>
  );
}

export function StatRow() {
  return (
    <div style={{ background: "var(--arbor-paper)", padding: 24, borderRadius: 24, maxWidth: 460 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
      </div>
    </div>
  );
}

export function FullTab() {
  return (
    <div style={{ background: "var(--arbor-paper)", padding: 24, borderRadius: 24, maxWidth: 640 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <Skeleton className="h-8 w-56" />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 14 }}>
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>
    </div>
  );
}

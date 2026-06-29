import React from "react";

/** Content-shaped loading placeholder. */
export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`arbor-skeleton ${className}`} />;
}

/** Generic tab loading fallback used as a Suspense boundary. */
export function TabSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-9 w-64" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
      </div>
      <Skeleton className="h-56" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Skeleton className="h-40" />
        <Skeleton className="h-40" />
      </div>
    </div>
  );
}

export default Skeleton;

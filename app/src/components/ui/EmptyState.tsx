import React from "react";

/** Centered empty state: optional icon/illustration, headline, body, and CTA. */
export function EmptyState({
  icon,
  headline,
  body,
  action,
  className = "",
}: {
  icon?: React.ReactNode;
  headline: string;
  body?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex flex-col items-center justify-center text-center gap-3 py-12 px-6 ${className}`}>
      {icon && <div className="text-[#d7aa55]/70">{icon}</div>}
      <h3 className="text-xl font-extrabold tracking-tight text-[#f7f1e7]">{headline}</h3>
      {body && <p className="text-xs text-[#a8a093] max-w-sm leading-relaxed">{body}</p>}
      {action && <div className="pt-1">{action}</div>}
    </div>
  );
}

export default EmptyState;

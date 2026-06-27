import React from "react";

/**
 * Centers the app shell and caps it at `--page-max` on wide canvases.
 *
 * This is the structural fix for the "full-width card desert" on large
 * desktops: instead of stretching the sidebar + content + rail edge-to-edge
 * across a 1920–2560px display, the whole composition recenters inside a
 * generous max width and the canvas breathes on either side.
 *
 * Structural only — no color, no opinion. Wrap the app grid; the three tracks
 * stay proportional and the rail stays sticky. Fixed/portal children (modals,
 * the mobile nav, Kid Mode overlay) are siblings, not children, so they are
 * unaffected.
 */
export default function PageContainer({
  children,
  className = "",
  as: Tag = "div",
}: {
  children: React.ReactNode;
  className?: string;
  as?: React.ElementType;
}) {
  return <Tag className={`page-shell ${className}`.trim()}>{children}</Tag>;
}

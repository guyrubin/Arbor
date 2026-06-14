import React from "react";

/**
 * Warm flat illustration of a parent holding a child — used on the safety /
 * "we're here to listen" bar. Soft rounded shapes in the Arbor palette; no
 * faces, so it reads as any family.
 */
export function ParentChildIllustration({ size = 96, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
      role="img"
      aria-label="A parent holding their child"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* soft halo */}
      <circle cx="60" cy="60" r="56" fill="var(--arbor-green-soft)" />

      {/* parent body */}
      <path d="M30 112 C30 84 42 70 60 70 C78 70 90 84 90 112 Z" fill="#5fb487" />
      {/* parent arm wrapping the child */}
      <path d="M44 92 C40 80 48 74 60 76 C70 78 74 86 72 94 C66 90 52 90 44 92 Z" fill="#4a9f74" />
      {/* parent head */}
      <circle cx="60" cy="50" r="16" fill="#f3a886" />
      <path d="M44 46 C44 33 76 33 76 46 C76 40 44 40 44 46 Z" fill="#3a2f2a" />

      {/* child tucked in */}
      <path d="M56 112 C56 96 62 88 73 88 C84 88 90 96 90 112 Z" fill="#f6c177" />
      <circle cx="73" cy="84" r="11" fill="#ffd2a8" />
      <path d="M62 82 C62 73 84 73 84 82 C84 77 62 77 62 82 Z" fill="#caa46a" />
    </svg>
  );
}

export default ParentChildIllustration;

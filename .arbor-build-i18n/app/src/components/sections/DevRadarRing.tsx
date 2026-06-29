import React from "react";
import { motion } from "motion/react";
import type { DomainScore, Trend } from "../../growth/devScore";

/* DevScoreCard's signature visualization — the dev-radar ring (prototype
 * "Arbor Web App" 6ddac523 centerpiece for the Development screen). Each
 * developmental domain is a spoke; the sapphire polygon fills to the share of
 * age-appropriate milestones reached. Strong domains get a green success dot.
 *
 * PARENT register: calm, clinical, HMO-trusted (Clalit/Maccabi). NOT toyish.
 * Presentation-only — the caller owns the numbers (growth/devScore.ts). */

const INK = "var(--arbor-ink)";
const MUTED = "var(--arbor-muted)";
const FAINT = "var(--arbor-faint)";
const CLAY = "var(--arbor-clay)";
const CLAY_DEEP = "var(--arbor-clay-deep)";
const GREEN = "var(--arbor-success)";
const RULE = "var(--arbor-rule)";
const RULE_STRONG = "var(--arbor-rule-strong)";

/** A "strong" domain = clearly past half-way AND enough data to trust it.
 *  Gets the green accent dot. */
const isStrong = (d: DomainScore) =>
  d.score >= 50 && d.confidence !== "none" && d.confidence !== "low";

const TREND_GLYPH: Record<Trend, string> = { up: "↑", flat: "→", down: "↓" };

/** Cartesian point for a spoke index at a given radius fraction (0–1). */
function polar(cx: number, cy: number, r: number, angleRad: number) {
  return { x: cx + r * Math.cos(angleRad), y: cy + r * Math.sin(angleRad) };
}

export interface DevRadarRingProps {
  domains: DomainScore[];
  /** Translator. Used for the visible caption + aria summary template. */
  t: (key: string, vars?: Record<string, string | number>) => string;
  /** Machine-id → human label (already resolved from framework.json by caller). */
  labelFor: (id: string) => string;
  /** First name for the caption copy. */
  firstName: string;
  animate?: boolean;
}

export function DevRadarRing({
  domains, t, labelFor, firstName, animate = true,
}: DevRadarRingProps) {
  const n = domains.length;

  // SVG coordinate space — large viewBox keeps text crisp; CSS scales it fluid.
  const SIZE = 460;
  const PAD = 86;           // room for spoke labels around the ring
  const cx = SIZE / 2;
  const cy = SIZE / 2;
  const R = SIZE / 2 - PAD; // outer ring radius
  const RING_LEVELS = 4;    // 0%, 25%, 50%, 75%, 100% (4 bands / 5 gridlines)

  // 12 o'clock start, clockwise. Undefined for n<2 but DevScoreCard only renders
  // us when score.confidence !== "none" (i.e. at least one domain); still guard.
  const angleFor = (i: number) =>
    n <= 1 ? -Math.PI / 2 : -Math.PI / 2 + (i * 2 * Math.PI) / n;

  // Vertices of the fill polygon, one per domain, scaled to its score (0–100).
  const fillPts = domains.map((d, i) => {
    const p = polar(cx, cy, R * (Math.max(0, Math.min(100, d.score)) / 100), angleFor(i));
    return `${p.x.toFixed(2)},${p.y.toFixed(2)}`;
  });
  const fillPath = fillPts.join(" ");

  // Outer ring vertices (100% baseline) — for the faint outline polygon.
  const outerPts = domains
    .map((_, i) => {
      const p = polar(cx, cy, R, angleFor(i));
      return `${p.x.toFixed(2)},${p.y.toFixed(2)}`;
    })
    .join(" ");

  // Accessible summary built from the same numbers — "communication 80 of 100, …".
  const summary = domains
    .map((d) => `${labelFor(d.domain)} ${d.score} of 100`)
    .join(", ");

  return (
    <div className="w-full">
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="w-full h-auto max-w-[440px] mx-auto block"
        role="img"
        aria-label={t("devscore.radar.aria", { summary })}
      >
        {/* Concentric grid rings — calm rule color, the outer one stronger. */}
        {Array.from({ length: RING_LEVELS + 1 }).map((_, idx) => {
          const r = (R * idx) / RING_LEVELS;
          const isOuter = idx === RING_LEVELS;
          return (
            <circle
              key={`ring-${idx}`}
              cx={cx}
              cy={cy}
              r={r}
              fill="none"
              stroke={isOuter ? RULE_STRONG : RULE}
              strokeWidth={isOuter ? 1.25 : 1}
            />
          );
        })}

        {/* Spokes from center to each outer vertex. */}
        {domains.map((_, i) => {
          const p = polar(cx, cy, R, angleFor(i));
          return (
            <line
              key={`spoke-${domains[i].domain}-${i}`}
              x1={cx}
              y1={cy}
              x2={p.x}
              y2={p.y}
              stroke={RULE}
              strokeWidth={1}
            />
          );
        })}

        {/* Faint outer outline = the "100%" reference shape. */}
        {n >= 3 && (
          <polygon
            points={outerPts}
            fill="none"
            stroke={RULE}
            strokeWidth={1}
            strokeDasharray="3 4"
          />
        )}

        {/* Sapphire fill polygon with a soft glow — the child's reached levels.
            Animates in once on mount (scales + fades); never perpetual. */}
        <motion.polygon
          points={fillPath}
          fill={CLAY}
          fillOpacity={0.22}
          stroke={CLAY_DEEP}
          strokeWidth={2}
          strokeLinejoin="round"
          style={{ filter: "drop-shadow(0 0 12px rgba(43,127,255,0.28))" }}
          initial={animate ? { opacity: 0, scale: 0.6 } : false}
          animate={animate ? { opacity: 1, scale: 1 } : undefined}
          transition={animate ? { duration: 0.7, ease: "easeOut" } : undefined}
          /* motion scales from the SVG origin (center). */
          transform-origin={`${cx}px ${cy}px`}
        />

        {/* Per-domain vertex dot. Strong domains get the green success accent;
            trend glyph sits just inside the spoke for orientation. */}
        {domains.map((d, i) => {
          const ang = angleFor(i);
          const strong = isStrong(d);
          const r = R * (Math.max(0, Math.min(100, d.score)) / 100);
          const p = polar(cx, cy, r, ang);
          return (
            <g key={`vtx-${d.domain}-${i}`}>
              <circle
                cx={p.x}
                cy={p.y}
                r={strong ? 5 : 3.5}
                fill={strong ? GREEN : CLAY_DEEP}
                stroke="var(--arbor-paper-elevated)"
                strokeWidth={1.5}
              />
            </g>
          );
        })}

        {/* Spoke labels — domain name + score. Anchored radially around the ring. */}
        {domains.map((d, i) => {
          const ang = angleFor(i);
          // Push labels just past the outer ring.
          const lp = polar(cx, cy, R + 22, ang);
          const isRight = Math.cos(ang) > 0.15;
          const isLeft = Math.cos(ang) < -0.15;
          const anchor: "start" | "middle" | "end" = isRight ? "start" : isLeft ? "end" : "middle";
          // Short label: framework label may be long ("Cognition and executive function"),
          // so the parent sees the score on its own line; full label stays in title + sr-only.
          return (
            <g key={`lbl-${d.domain}-${i}`}>
              <text
                x={lp.x}
                y={lp.y}
                textAnchor={anchor}
                dominantBaseline="middle"
                fontSize={12.5}
                fontWeight={700}
                fill={INK}
                style={{ letterSpacing: "-0.01em" }}
              >
                <title>{labelFor(d.domain)}</title>
                {labelFor(d.domain)}
              </text>
              <text
                x={lp.x}
                y={lp.y + 15}
                textAnchor={anchor}
                dominantBaseline="middle"
                fontSize={11.5}
                fontWeight={700}
                fill={isStrong(d) ? GREEN : MUTED}
              >
                {d.score}{` `}{TREND_GLYPH[d.trend]}
              </text>
            </g>
          );
        })}

        {/* Center scale hint — quiet, anchors the 0–100 reading. */}
        <text
          x={cx}
          y={cy - 6}
          textAnchor="middle"
          fontSize={10.5}
          fontWeight={700}
          fill={FAINT}
          style={{ letterSpacing: "0.06em", textTransform: "uppercase" }}
        >
          0–100
        </text>
      </svg>

      {/* Visible caption (not aria-redundant: the SVG already has role=img). */}
      <p
        className="text-[12px] mt-3 leading-relaxed text-center mx-auto max-w-[440px]"
        style={{ color: MUTED, textWrap: "pretty" } as React.CSSProperties}
      >
        {t("devscore.radar.caption", { name: firstName })}
      </p>
    </div>
  );
}

export default DevRadarRing;

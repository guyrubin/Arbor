import React from "react";

/**
 * Shared Material Symbols (Rounded) icon — the UC-2 visual-match icon system.
 *
 * Renders a single Material Symbols Rounded glyph via the `.msr` base class
 * (font-family + base font-variation-settings declared in index.html) with
 * per-instance overrides applied inline so callers can tune optical size,
 * weight, and fill without extra CSS.
 *
 * Usage (screen agents replace lucide with this):
 *   <Icon name="home" size={22} />
 *   <Icon name="check_circle" fill={1} />              // filled state
 *   <Icon name="notifications" size={21} weight={500} />
 *   <Icon name="home" chrome active={on} />            // chrome: 300 outline, filled when active
 *
 * `name` is the Material Symbols ligature (e.g. "home", "monitoring",
 * "edit_note"). `size` sets both the font-size (glyph size in px) and the
 * `opsz` optical-size axis so the stroke stays balanced at any size.
 *
 * a11y: decorative by default (aria-hidden). Pass an aria-label via the caller
 * (e.g. wrap in a button with its own label) when the glyph is the sole label.
 */
export type IconProps = {
  /** Material Symbols ligature name, e.g. "home", "monitoring", "edit_note". */
  name: string;
  /** Glyph size in px (drives font-size + the opsz axis). Default 24. */
  size?: number;
  /** Fill axis: 0 = outlined (default), 1 = filled. */
  fill?: 0 | 1;
  /** Weight axis (100–700). Default 500 (300 for an inactive `chrome` icon). */
  weight?: number;
  /** B-DESIGN-02: a chrome icon (top bar, dock, nav) — weight 300 outline at rest. */
  chrome?: boolean;
  /** B-DESIGN-02: the active chrome slot — filled (FILL 1) at the content weight 500. */
  active?: boolean;
  className?: string;
  style?: React.CSSProperties;
  /** Override the default aria-hidden when the glyph carries meaning. */
  "aria-label"?: string;
};

/** B-DESIGN-02 (P7-DESIGN framer decision): chrome icons are lighter than content glyphs. */
export const CHROME_ICON_WEIGHT = 300;
export const CONTENT_ICON_WEIGHT = 500;

export function Icon({
  name,
  size = 24,
  fill: fillProp = 0,
  weight: weightProp,
  chrome = false,
  active = false,
  className,
  style,
  "aria-label": ariaLabel,
}: IconProps) {
  const fill = active ? 1 : fillProp;
  const weight = weightProp ?? (chrome && !active ? CHROME_ICON_WEIGHT : CONTENT_ICON_WEIGHT);
  return (
    <span
      className={className ? `msr ${className}` : "msr"}
      aria-hidden={ariaLabel ? undefined : true}
      aria-label={ariaLabel}
      role={ariaLabel ? "img" : undefined}
      style={{
        fontSize: `${size}px`,
        fontVariationSettings: `'opsz' ${size}, 'wght' ${weight}, 'GRAD' 0, 'FILL' ${fill}`,
        flexShrink: 0,
        ...style,
      }}
    >
      {name}
    </span>
  );
}

export default Icon;

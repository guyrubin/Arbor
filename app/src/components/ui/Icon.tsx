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
  /** Weight axis (100–700). Default 500. */
  weight?: number;
  className?: string;
  style?: React.CSSProperties;
  /** Override the default aria-hidden when the glyph carries meaning. */
  "aria-label"?: string;
};

export function Icon({
  name,
  size = 24,
  fill = 0,
  weight = 500,
  className,
  style,
  "aria-label": ariaLabel,
}: IconProps) {
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

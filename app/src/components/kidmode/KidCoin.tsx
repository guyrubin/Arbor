/**
 * KidCoin — B-KID-133 (D-04, KID-DESIGN-DIRECTION §2.6): a 1:1 moulded coin.
 * Emoji are never art and never naked: until piece art exists, an emoji
 * appears only inside a coin — the world's flat wash on the face, a recessed
 * well, the glyph at 58 % of the coin, embossed with a drop shadow. The result
 * reads as a toy piece, not a text glyph. Decorative by default (the piece's
 * button or the run's role="img" names it).
 *
 * `.kid-coin` in index.css (.arbor-play only); the size is the shared piece
 * rule (`--piece`, 96-168 px) unless `size` pins it.
 */
import type { CSSProperties, ReactNode } from "react";

export type KidCoinWash = "paper" | "sky" | "lav" | "pink" | "peach" | "clay" | "green" | "yellow";

export interface KidCoinProps {
  emoji: ReactNode;
  wash?: KidCoinWash;
  /** A fixed diameter in px (else the piece size). */
  size?: number;
  className?: string;
}

export function KidCoin({ emoji, wash = "paper", size, className = "" }: KidCoinProps) {
  return (
    <span
      aria-hidden="true"
      className={`kid-coin ${className}`.trim()}
      data-wash={wash === "paper" ? undefined : wash}
      style={size ? ({ "--coin-size": `${size}px` } as CSSProperties) : undefined}
    >
      <span className="kid-coin-glyph">{emoji}</span>
    </span>
  );
}

export default KidCoin;

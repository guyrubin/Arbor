/** Kept apart from the words so the Studio copy never loads the icon library. */
import { ArrowUp, Footprints, RotateCw, Waves, Wind, Zap } from 'lucide-react';

/** One glyph per move, in MoveId order. Colour is never the only cue. */
export const BAND_GLYPHS = [ArrowUp, Wind, Zap, Waves, Footprints, RotateCw] as const;

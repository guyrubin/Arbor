import { useEffect, useRef } from 'react';
import { planOf } from './crankWorksRules';
import { S1, roomRect } from './crankGeometry';
import { paintScene, readPalette, type PaintImages, type Scene } from './crankPaint';
import { KIT_BENCH, KIT_ROOM } from './crankKit';
import '../makerPalette.css';
import './crankWorks.css';

/** How Things Move cover: the brass machine on the TrailBench in the
 * Wonderworks pavilion, close up, its housing half cleared so the crank and
 * rod show. It is the game's own painter on a small canvas (one still frame,
 * no loop), so the tile, the book row, the card window and the sticker all
 * show the machine the child will meet. The wheel sits left of the middle
 * (the Studio stands the player's hero to the right of a card window). */
const STILL: Scene = {
  theta: 5.25, omega: 0, time: 0, plan: planOf(3), room: { x: -180, y: -580, size: 1150 }, flower: 1, beads: 1, bell: 0, waiting: [], ask: null, carry: null, reveal: [0.62, 0, 0],
  bellSwing: 0, beadPop: [0, 0, 0, 0, 0, 0], bloomPop: 0, knobPop: 0, chock: { hop: 0, squash: 0, lean: 0, dx: 0 }, tool: null, tape: 0, held: false,
  jointCue: 0, puckCue: 0, lensOut: false, podOn: false, wheelCue: 0, wheelFocus: false,
};
export default function CrankWorksCover({ size = 'tile' }: { size?: 'tile' | 'card' }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const node = ref.current; if (!node) return;
    const images: PaintImages = { room: null, bench: null, chock: null, tool: null };
    let alive = true;
    const draw = () => {
      const w = node.clientWidth, h = node.clientHeight, c = node.getContext('2d');
      if (!alive || !w || !h || !c) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      node.width = Math.round(w * dpr); node.height = Math.round(h * dpr);
      // Fill the window with the piston and the flower beside it, whatever its shape.
      const s = Math.max(w / 250, h / 250), cx = S1.x + (w > h * 1.3 ? 62 : 34);
      const view = { s, ox: w / 2 - cx * s, oy: h / 2 - 104 * s };
      c.setTransform(dpr * s, 0, 0, dpr * s, dpr * view.ox, dpr * view.oy);
      paintScene(c, readPalette(node), images, { ...STILL, room: roomRect(view, w, h) });
    };
    const load = (key: 'room' | 'bench', src: string) => { const im = new Image(); im.decoding = 'async'; im.onload = () => { images[key] = im; draw(); }; im.src = src; };
    load('room', KIT_ROOM.src); load('bench', KIT_BENCH.src);
    draw();
    const watch = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(draw);
    watch?.observe(node);
    return () => { alive = false; watch?.disconnect(); };
  }, []);
  return <canvas ref={ref} className="ck-cover" data-size={size} aria-hidden="true" />;
}

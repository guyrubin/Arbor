import { useEffect, useRef, useState } from 'react';
import { planOf } from './crankWorksRules';
import { S1, roomRect } from './crankGeometry';
import { paintScene, readPalette, type PaintImages, type SceneStill } from './crankPaint';
import { KIT_BENCH, KIT_ROOM } from './crankKit';
import '../makerPalette.css';

/** How Things Move cover: the brass machine on the TrailBench in the
 * Wonderworks pavilion, close up: the flywheel, the enamel housing with its
 * knob near the top of the stroke, the flower open beside it. It is the
 * game's own painter, run once into a still picture (no loop) and shown as an
 * SVG image that slices to fill its window, so the tile, the book row, the
 * card window and the sticker all show the machine the child will meet. The
 * wheel sits left of the middle (the Studio stands the player's hero to the
 * right of a card window) and inside the band a wide window keeps. */
const VIEW_W = 400, VIEW_H = 300, DENSITY = 1.6, ZOOM = 1.1;
const STILL: SceneStill = {
  theta: 0.42, omega: 0, time: 0, plan: planOf(3), flower: 1, beads: 1, bell: 0, waiting: [], ask: null, carry: null, reveal: [0, 0, 0],
  bellSwing: 0, beadPop: [0, 0, 0, 0, 0, 0], bloomPop: 0, knobPop: 0, chock: { hop: 0, squash: 0, lean: 0, dx: 0 }, tool: null, tape: 0, held: false,
  jointCue: 0, puckCue: 0, lensOut: false, podOn: false, wheelCue: 0, wheelFocus: false,
};
export default function CrankWorksCover({ size = 'tile' }: { size?: 'tile' | 'card' }) {
  const host = useRef<SVGSVGElement>(null);
  const [still, setStill] = useState<string | null>(null);
  useEffect(() => {
    const node = host.current; if (!node || typeof document === 'undefined') return;
    const images: PaintImages = { roomImg: null, bench: null, chock: null, tool: null };
    let alive = true, pending = 2;
    const draw = () => {
      if (!alive || pending > 0) return;
      try {
        const sheet = document.createElement('canvas'); sheet.width = VIEW_W * DENSITY; sheet.height = VIEW_H * DENSITY;
        const c = sheet.getContext('2d'); if (!c) return;
        const view = { s: ZOOM, ox: VIEW_W / 2 - (S1.x + 58) * ZOOM, oy: VIEW_H / 2 - 128 * ZOOM };
        c.setTransform(DENSITY * view.s, 0, 0, DENSITY * view.s, DENSITY * view.ox, DENSITY * view.oy);
        paintScene(c, readPalette(node), images, { ...STILL, room: roomRect(view, VIEW_W, VIEW_H) });
        setStill(sheet.toDataURL('image/webp', 0.86));
      } catch { /* No canvas here: the bench picture below stays. */ }
    };
    const load = (key: 'roomImg' | 'bench', src: string) => { const im = new Image(); im.decoding = 'async'; im.onload = () => { images[key] = im; pending--; draw(); }; im.onerror = () => { pending--; draw(); }; im.src = src; };
    load('roomImg', KIT_ROOM.src); load('bench', KIT_BENCH.src);
    return () => { alive = false; };
  }, []);
  return <svg ref={host} viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} preserveAspectRatio="xMidYMid slice" style={{ width: '100%', height: '100%', display: 'block' }} data-size={size} aria-hidden="true" focusable="false">
    {/* Until the still is painted (a frame or two), the kit's own bench stands in the window. */}
    <image href={KIT_ROOM.src} x={-120} y={-250} width={640} height={640} preserveAspectRatio="xMidYMid slice" />
    <image href={KIT_BENCH.src} x={-123} y={9} width={869} height={596} />
    {still && <image href={still} x={0} y={0} width={VIEW_W} height={VIEW_H} preserveAspectRatio="none" />}
  </svg>;
}

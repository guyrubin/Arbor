/** One frame loop for the whole theatre. Playback, the coasting film strip,
 * the hands' clock and the curtain call all ride it, so there is never more
 * than one requestAnimationFrame running, none while nothing moves, and none
 * while the tab is hidden. */
export type TickFn = (dt: number) => boolean | void;
export interface ClayTicker {
  /** Runs `fn` every frame until it returns false or the returned function is called. */
  add(fn: TickFn): () => void;
  /** How many things are riding the loop now (the leak check reads it). */
  riders(): number;
  /** Drops every rider and stops. The ticker can be ridden again afterwards. */
  dispose(): void;
}
export function createClayTicker(): ClayTicker {
  const fns = new Set<TickFn>();
  let raf = 0, last = -1, listening = false;
  const hidden = () => typeof document !== 'undefined' && document.visibilityState === 'hidden';
  const halt = () => { if (raf) cancelAnimationFrame(raf); raf = 0; last = -1; };
  const step = (now: number) => {
    raf = 0;
    const dt = last < 0 ? 0 : Math.min(0.1, (now - last) / 1000); last = now;
    for (const fn of [...fns]) { if (fns.has(fn) && fn(dt) === false) fns.delete(fn); }
    wake();
  };
  function wake() {
    if (fns.size === 0) { rest(); return; }
    if (!raf && !hidden()) raf = requestAnimationFrame(step);
  }
  const seen = () => { if (hidden()) halt(); else wake(); };
  function rest() { halt(); if (listening && typeof document !== 'undefined') document.removeEventListener('visibilitychange', seen); listening = false; }
  return {
    add(fn) {
      fns.add(fn);
      if (!listening && typeof document !== 'undefined') { document.addEventListener('visibilitychange', seen); listening = true; }
      wake();
      return () => { fns.delete(fn); if (fns.size === 0) rest(); };
    },
    riders: () => fns.size,
    dispose() { fns.clear(); rest(); },
  };
}

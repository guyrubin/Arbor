/** One frame loop for the whole activity. Steps are added by name and run
 * together on a single requestAnimationFrame; the loop sleeps when no step is
 * left and pauses with the tab (frames stop; a long gap counts as one short
 * step, so nothing jumps on return). A step returns false to finish. */
export type TinyStep = (dtSeconds: number, nowMs: number) => boolean | void;
export interface TinyLoop {
  run(key: string, step: TinyStep): void;
  drop(key: string): void;
  has(key: string): boolean;
  stop(): void;
}
export function createTinyLoop(): TinyLoop {
  const steps = new Map<string, TinyStep>();
  let handle = 0, last = 0, alive = true;
  const frame = (now: number) => {
    handle = 0;
    const dt = last ? Math.min(0.1, Math.max(0, (now - last) / 1000)) : 1 / 60;
    last = now;
    for (const [key, step] of [...steps]) {
      let keep: boolean | void = false;
      try { keep = step(dt, now); } catch { keep = false; }
      if (keep === false && steps.get(key) === step) steps.delete(key);
    }
    if (alive && steps.size > 0) handle = requestAnimationFrame(frame); else last = 0;
  };
  const wake = () => { if (alive && !handle && steps.size > 0 && typeof requestAnimationFrame === 'function') handle = requestAnimationFrame(frame); };
  return {
    run(key, step) { if (!alive) return; steps.set(key, step); wake(); },
    drop(key) { steps.delete(key); },
    has: key => steps.has(key),
    stop() { alive = false; steps.clear(); if (handle && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(handle); handle = 0; },
  };
}

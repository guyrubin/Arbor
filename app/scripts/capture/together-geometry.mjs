/** Read one atomic geometry sample without waiting, scrolling or changing motion.
 * The wrapper is Shell's direct child above the display:contents SurfaceFrame.
 * Keeping the raw rectangle, matrix and scroll owners lets an audit distinguish
 * the declared 10px route entrance from content reflow or focus-induced scroll. */
export function observeTogetherGeometry(target) {
  const rect = target.getBoundingClientRect();
  const surface = target.closest('[data-route="practice"]');
  const entrance = surface?.parentElement;
  const main = document.querySelector('#main');
  const style = entrance && getComputedStyle(entrance);
  const matrix = style && new DOMMatrixReadOnly(style.transform);
  return {
    geometry: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
    scrollOffsets: { main: main?.scrollTop ?? null, mainLeft: main?.scrollLeft ?? null, windowX: window.scrollX, windowY: window.scrollY },
    entrance: entrance && matrix ? {
      shellBoundary: entrance.parentElement === main && getComputedStyle(surface).display === 'contents',
      transform: style.transform, is2D: matrix.is2D,
      matrix: [matrix.a, matrix.b, matrix.c, matrix.d, matrix.e, matrix.f],
      opacity: Number(style.opacity),
      animations: entrance.getAnimations().map(animation => ({ playState: animation.playState, currentTime: typeof animation.currentTime === 'number' ? animation.currentTime : null })),
    } : null,
  };
}

/** Normalize only Shell's documented y:10 -> 0 entrance, never an arbitrary
 * transform or ancestor position. Layout displacement and scroll still change
 * this rectangle. The final sample must have completed the entrance. */
export function togetherLayoutGeometry(observation, allowEntrance = false) {
  const rect = observation?.geometry, entrance = observation?.entrance;
  if (!rect || !['x', 'y', 'width', 'height'].every(key => Number.isFinite(rect[key])) || rect.width <= 0 || rect.height <= 0
    || entrance?.shellBoundary !== true || entrance.is2D !== true
    || !Array.isArray(entrance.matrix) || entrance.matrix.length !== 6 || !entrance.matrix.every(Number.isFinite)) return null;
  const [a, b, c, d, x, y] = entrance.matrix;
  if (a !== 1 || b !== 0 || c !== 0 || d !== 1 || x !== 0
    || y < 0 || y > 10 || !Number.isFinite(entrance.opacity) || entrance.opacity < 0 || entrance.opacity > 1
    || (!allowEntrance && (y !== 0 || entrance.opacity !== 1))) return null;
  return { ...rect, y: rect.y - y };
}

export function togetherScrollStable(before, after) {
  return !!before && !!after && ['main', 'mainLeft', 'windowX', 'windowY'].every(key =>
    Number.isFinite(before[key]) && Number.isFinite(after[key]) && before[key] === after[key]);
}

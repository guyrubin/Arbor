/** Read only the visible six-pixel ball painted on Maker Desk's canvas.
 * No engine state, React handle, seeded trajectory or completion hook is read.
 * The optional palette is for exercising the detector against captured pixels. */
export function readPaintedBounceBall(canvas, suppliedPalette) {
  const palette = suppliedPalette ?? (() => {
    const style = getComputedStyle(canvas), probe = document.createElement('canvas');
    probe.width = probe.height = 1;
    const context = probe.getContext('2d', { willReadFrequently: true });
    return Object.fromEntries(['slate', 'white', 'butter'].map(name => {
      const value = style.getPropertyValue(`--mk-${name}`).trim();
      if (!value) throw new Error(`The painted ball palette is missing ${name}`);
      context.clearRect(0, 0, 1, 1); context.fillStyle = value; context.fillRect(0, 0, 1, 1);
      return [name, [...context.getImageData(0, 0, 1, 1).data].slice(0, 3)];
    }));
  })();
  const width = canvas.width, height = canvas.height;
  // Copy at backing resolution. Repeated reads must not change the game's
  // rendering context or emit Chrome's readback-performance warning.
  const picture = canvas.ownerDocument.createElement('canvas');
  picture.width = width; picture.height = height;
  const reader = picture.getContext('2d', { willReadFrequently: true });
  reader.drawImage(canvas, 0, 0);
  const pixels = reader.getImageData(0, 0, width, height).data;
  const ink = { s: palette.slate, w: palette.white, b: palette.butter };
  const pattern = ['ssssss', 'sswwss', 'swbwws', 'swwwws', 'sswwss', 'ssssss'];
  const matches = (x, y, color) => {
    const at = (y * width + x) * 4;
    return pixels[at] === color[0] && pixels[at + 1] === color[1]
      && pixels[at + 2] === color[2] && pixels[at + 3] === 255;
  };
  const balls = [];
  for (let y = 0; y <= height - 6; y++) for (let x = 0; x <= width - 6; x++) {
    if (!matches(x + 2, y + 2, ink.b) || !matches(x + 2, y + 1, ink.w)) continue;
    let found = true;
    for (let row = 0; row < 6 && found; row++) for (let col = 0; col < 6; col++) {
      if (!matches(x + col, y + row, ink[pattern[row][col]])) { found = false; break; }
    }
    if (found) balls.push({ x: x + 3, y: y + 3 });
  }
  const { left, top, width: cssWidth, height: cssHeight } = canvas.getBoundingClientRect();
  return { balls, width, height, box: { left, top, width: cssWidth, height: cssHeight } };
}

/** A gently changing catch position varies the real paddle's rebound angle.
 * Following the visible ball avoids the old periodic blind sweep's loops. */
export const bounceDragOffset = elapsedMs => 10 * Math.sin(elapsedMs / 3100);

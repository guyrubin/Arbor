/** Recognizes only the catalogue's disclosed geometric plan fixture, never
 * private/real story art. Decode the ORIGINAL screenshot in Node so reading
 * the evidence cannot warm the browser's image raster path. */
import { PNG } from 'playwright-core/lib/utilsBundle';

export function inspectPlanFixturePng(buffer, { roi, viewport }) {
  let png;
  try { png = PNG.sync.read(buffer); }
  catch { return { painted: false, reason: 'invalid-png' }; }
  if (!roi || !viewport || ![roi.x, roi.y, roi.width, roi.height, viewport.width, viewport.height].every(Number.isFinite)
    || roi.width <= 0 || roi.height <= 0 || viewport.width <= 0 || viewport.height <= 0) return { painted: false, reason: 'invalid-geometry' };
  const scaleX = png.width / viewport.width, scaleY = png.height / viewport.height;
  if (Math.abs(scaleX - scaleY) > .001) return { painted: false, reason: 'not-a-viewport-capture' };
  const left = Math.max(0, roi.x), top = Math.max(0, roi.y);
  const right = Math.min(viewport.width, roi.x + roi.width), bottom = Math.min(viewport.height, roi.y + roi.height);
  const width = right - left, height = bottom - top;
  if (width < 48 || height < 32) return { painted: false, reason: 'picture-not-visible', roi: { x: left, y: top, width, height } };
  const columns = 48, rows = 32, samples = columns * rows;
  let wall = 0, floor = 0;
  const wallColumns = new Set(), floorColumns = new Set();
  const close = (offset, colour) => png.data[offset + 3] >= 250 && colour.every((value, channel) => Math.abs(png.data[offset + channel] - value) <= 2);
  for (let row = 0; row < rows; row++) for (let column = 0; column < columns; column++) {
    const x = Math.min(png.width - 1, Math.floor((left + (column + .5) / columns * width) * scaleX));
    const y = Math.min(png.height - 1, Math.floor((top + (row + .5) / rows * height) * scaleY));
    const offset = (y * png.width + x) * 4;
    if (close(offset, [237, 241, 238])) { wall++; wallColumns.add(column); }
    if (close(offset, [213, 225, 223])) { floor++; floorColumns.add(column); }
  }
  const wallFraction = wall / samples, floorFraction = floor / samples, combinedFraction = (wall + floor) / samples;
  // Both broad, opaque fixture regions must occupy meaningful area and
  // width. Thin grid lines disappear at valid scales and are not required.
  const painted = wallFraction >= .2 && floorFraction >= .1 && combinedFraction >= .5
    && wallColumns.size >= columns / 2 && floorColumns.size >= columns / 2;
  return { painted, reason: painted ? 'fixture-painted' : 'fixture-not-painted', roi: { x: left, y: top, width, height },
    screenshot: { width: png.width, height: png.height, scale: scaleX }, samples, wall, floor,
    wallFraction, floorFraction, combinedFraction, wallColumns: wallColumns.size, floorColumns: floorColumns.size };
}

/** Observe settled pixels without changing the browser. The first capture
 * has no performance deadline; only retries after a real miss have a budget.
 * A late painted retry and an async source/node replacement both fail. */
export async function observePlanFixturePaint({ first, capture, wait, onSample = async (_sample) => {}, now = () => performance.now(), deadlineMs = 4000 }) {
  const attempts = [], expected = first.before, firstMiss = !first.pixels.painted;
  const same = state => state?.sameNode === true && state.source === expected.source && state.page === expected.page;
  const started = now();
  const record = async (value, elapsedMs) => {
    const sample = { ...value, attempt: attempts.length + 1, elapsedMs,
      samePicture: same(value.before) && same(value.after), withinDeadline: attempts.length === 0 || elapsedMs <= deadlineMs };
    attempts.push(sample); await onSample(sample); return sample;
  };
  const result = (painted, reason, elapsedMs) => ({ painted, reason, firstMiss, deadlineMs, elapsedMs, attempts });
  let sample = await record(first, 0);
  if (!sample.samePicture) return result(false, 'picture-changed', 0);
  if (sample.pixels.painted) return result(true, 'initial-painted', 0);
  while (now() - started < deadlineMs) {
    const remaining = deadlineMs - (now() - started);
    if (!await wait(remaining) || now() - started >= deadlineMs) break;
    const value = await capture(attempts.length + 1);
    sample = await record(value, now() - started);
    if (!sample.samePicture) return result(false, 'picture-changed', sample.elapsedMs);
    if (!sample.withinDeadline) return result(false, 'deadline-exceeded', sample.elapsedMs);
    if (sample.pixels.painted) return result(true, 'native-painted', sample.elapsedMs);
  }
  return result(false, 'deadline-exceeded', now() - started);
}

/** Wind-up Racer's camera. Pure: no DOM, no time, no randomness.
 *
 * The whole world is drawn through one pinhole camera, so the floor, the
 * track, the pavilion wall, the light on the floor and every kit picture
 * share one horizon and one vanishing point.
 *
 * World axes (one unit is Rover's length): x runs along the track, the way
 * Rover drives; y is up from the floor; z runs across the floor, away from
 * the camera's side (the pavilion wall stands at a large +z). Screens are in
 * CSS pixels, y down. */

export interface Vec3 { x: number; y: number; z: number }
export interface Camera {
  /** Where the camera is. */
  ex: number; ey: number; ez: number;
  /** Its right, up and forward directions (unit length, at right angles). */
  rx: number; ry: number; rz: number;
  ux: number; uy: number; uz: number;
  fx: number; fy: number; fz: number;
  /** Focal length in pixels, and the pixel where the look-at point lands. */
  focal: number; cx: number; cy: number;
}
export interface Projected { x: number; y: number; /** Pixels per world unit at this depth. */ scale: number; /** Distance along the view. */ depth: number }

/** Nothing nearer than this is drawn (it would be behind or inside the lens). */
export const NEAR = 0.35;
/** Rover's kit picture is seen from this far round from side-on, and from this far above. */
export const ROVER_BEARING = 30 * Math.PI / 180;
export const ROVER_ELEVATION = 15 * Math.PI / 180;

const hyp = (x: number, y: number, z: number) => Math.hypot(x, y, z) || 1;

/** A camera at `eye` looking at `target`, which lands on the pixel (cx, cy). */
export function lookAt(eye: Vec3, target: Vec3, focal: number, cx: number, cy: number): Camera {
  let fx = target.x - eye.x, fy = target.y - eye.y, fz = target.z - eye.z;
  const fl = hyp(fx, fy, fz); fx /= fl; fy /= fl; fz /= fl;
  // right = up × forward, with the world's up; a camera never looks straight down here.
  let rx = fz, rz = -fx; const rl = Math.hypot(rx, rz) || 1; rx /= rl; rz /= rl;
  // up = forward × right
  const ux = fy * rz, uy = fz * rx - fx * rz, uz = -fy * rx;
  return { ex: eye.x, ey: eye.y, ez: eye.z, rx, ry: 0, rz, ux, uy, uz, fx, fy, fz, focal, cx, cy };
}

/** A world point on the screen, or null when it is behind the lens. */
export function project(cam: Camera, x: number, y: number, z: number): Projected | null {
  const dx = x - cam.ex, dy = y - cam.ey, dz = z - cam.ez;
  const depth = dx * cam.fx + dy * cam.fy + dz * cam.fz;
  if (depth < NEAR) return null;
  const scale = cam.focal / depth;
  return { x: cam.cx + (dx * cam.rx + dz * cam.rz) * scale, y: cam.cy - (dx * cam.ux + dy * cam.uy + dz * cam.uz) * scale, scale, depth };
}
/** Depth along the view only (for sorting). */
export function depthOf(cam: Camera, x: number, y: number, z: number): number {
  return (x - cam.ex) * cam.fx + (y - cam.ey) * cam.fy + (z - cam.ez) * cam.fz;
}
/** The screen row of the horizon straight ahead: every flat thing vanishes on it. */
export function horizonY(cam: Camera): number {
  const flat2 = cam.fx * cam.fx + cam.fz * cam.fz || 1e-6;
  return cam.cy - cam.focal * (cam.fx * cam.ux + cam.fz * cam.uz) / flat2;
}
/** Where a floor line running along the track (the x direction) vanishes, in
 * pixels, or null when the camera looks square across the track. */
export function trackVanish(cam: Camera, ahead = 1): number | null {
  const along = cam.fx * ahead;
  if (along < 0.02) return null;
  return cam.cx + cam.focal * (cam.rx * ahead) / along;
}
/** The floor point under a pixel (y = 0), or null above the horizon. */
export function floorAt(cam: Camera, sx: number, sy: number): { x: number; z: number } | null {
  const a = (sx - cam.cx) / cam.focal, b = -(sy - cam.cy) / cam.focal;
  const dx = cam.fx + a * cam.rx + b * cam.ux, dy = cam.fy + a * cam.ry + b * cam.uy, dz = cam.fz + a * cam.rz + b * cam.uz;
  if (dy > -1e-4) return null;
  const t = -cam.ey / dy;
  return { x: cam.ex + dx * t, z: cam.ez + dz * t };
}

/* ---------- shots ---------- */

/** A shot: where the camera sits relative to the thing it follows. */
export interface Shot {
  /** Round from side-on, in radians: positive is ahead of Rover (its face
   * shows), negative is behind it (the chase). */
  bearing: number;
  /** Above the floor plane, in radians. */
  elevation: number;
  /** How far from the subject, in world units. */
  distance: number;
  /** The subject's size on screen: pixels per world unit at the subject. */
  zoom: number;
  /** Where the subject sits in the frame, as fractions of its width and height. */
  ax: number; ay: number;
  /** The camera leads the subject by this much along the track. */
  lead: number;
}
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export function mixShot(a: Shot, b: Shot, t: number): Shot {
  const k = t <= 0 ? 0 : t >= 1 ? 1 : t;
  return { bearing: lerp(a.bearing, b.bearing, k), elevation: lerp(a.elevation, b.elevation, k), distance: lerp(a.distance, b.distance, k), zoom: lerp(a.zoom, b.zoom, k), ax: lerp(a.ax, b.ax, k), ay: lerp(a.ay, b.ay, k), lead: lerp(a.lead, b.lead, k) };
}
/** The camera for a shot of a subject at `at`, in a frame `width` × `height`. */
export function shotCamera(shot: Shot, at: Vec3, width: number, height: number): Camera {
  const flat = Math.cos(shot.elevation) * shot.distance;
  const eye = { x: at.x + shot.lead + Math.sin(shot.bearing) * flat, y: Math.max(0.12, at.y + Math.sin(shot.elevation) * shot.distance), z: at.z - Math.cos(shot.bearing) * flat };
  return lookAt(eye, { x: at.x + shot.lead, y: at.y, z: at.z }, shot.zoom * shot.distance, shot.ax * width, shot.ay * height);
}
/** Which of Rover's two kit pictures a camera sees, and whether it is flipped.
 * The front picture shows Rover's face (camera ahead of side-on); the rear
 * picture shows its back (camera behind). Either is flipped when the camera
 * stands on the far side of the track. */
export function roverView(cam: Camera, heading = 1): { face: 'front' | 'rear'; flip: boolean } {
  // Rover drives along +x (heading 1). The camera sees its front when it looks back down the track.
  const front = cam.fx * heading < 0;
  const nearSide = cam.fz > 0;
  // The stored pictures face right (front) with the camera on the near side.
  return { face: front ? 'front' : 'rear', flip: front ? !nearSide : nearSide };
}

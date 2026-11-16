import { describe, expect, it } from 'vitest';
import { NEAR, ROVER_BEARING, ROVER_ELEVATION, depthOf, floorAt, horizonY, lookAt, mixShot, project, roverView, shotCamera, trackVanish, type Shot } from './windupCamera';

const W = 1280, H = 740;
const wind: Shot = { bearing: ROVER_BEARING, elevation: ROVER_ELEVATION, distance: 4.4, zoom: 190, ax: 0.42, ay: 0.66, lead: 0 };
const chase: Shot = { ...wind, bearing: -ROVER_BEARING, distance: 6, zoom: 150, ax: 0.3, lead: 1 };
const rover = { x: 12, y: 0.45, z: 0 };

describe('one camera for the whole picture', () => {
  it('a side-on camera: the track runs to the right, up is up, and far things are smaller', () => {
    const cam = lookAt({ x: 0, y: 1, z: -5 }, { x: 0, y: 1, z: 0 }, 500, 640, 370);
    expect(project(cam, 0, 1, 0)).toMatchObject({ x: 640, y: 370, depth: 5 });
    expect(project(cam, 1, 1, 0)!.x).toBeCloseTo(740); expect(project(cam, 0, 2, 0)!.y).toBeCloseTo(270);
    expect(project(cam, 0, 1, 5)!.scale).toBeCloseTo(project(cam, 0, 1, 0)!.scale / 2);
    expect(project(cam, 0, 1, -5 + NEAR / 2)).toBeNull(); expect(project(cam, 3, 1, -9)).toBeNull();
    expect(depthOf(cam, 0, 1, 3)).toBeCloseTo(8);
  });
  it('its three directions are at right angles and of length one, wherever it looks', () => {
    for (const cam of [shotCamera(wind, rover, W, H), shotCamera(chase, rover, W, H), lookAt({ x: 3, y: 9, z: -2 }, { x: 7, y: 0, z: 6 }, 400, 0, 0)]) {
      const dot = (a: number[], b: number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
      const r = [cam.rx, cam.ry, cam.rz], u = [cam.ux, cam.uy, cam.uz], f = [cam.fx, cam.fy, cam.fz];
      for (const v of [r, u, f]) expect(dot(v, v)).toBeCloseTo(1, 6);
      expect(dot(r, u)).toBeCloseTo(0, 6); expect(dot(r, f)).toBeCloseTo(0, 6); expect(dot(u, f)).toBeCloseTo(0, 6);
      expect(cam.uy).toBeGreaterThan(0);
    }
  });
  it('a shot puts its subject where the frame asks, at the size it asks', () => {
    for (const shot of [wind, chase]) {
      const cam = shotCamera(shot, rover, W, H), at = project(cam, rover.x + shot.lead, rover.y, rover.z)!;
      expect(at.x).toBeCloseTo(shot.ax * W, 3); expect(at.y).toBeCloseTo(shot.ay * H, 3); expect(at.scale).toBeCloseTo(shot.zoom, 3);
      expect(cam.ey).toBeGreaterThan(rover.y);
    }
    // The camera never sinks into the floor, however low the shot.
    expect(shotCamera({ ...wind, elevation: -0.4 }, { x: 0, y: 0, z: 0 }, W, H).ey).toBeGreaterThan(0.1);
  });
  it('one horizon: the far floor climbs to it and never passes it', () => {
    for (const shot of [wind, chase]) {
      const cam = shotCamera(shot, rover, W, H), horizon = horizonY(cam);
      let last = Infinity;
      for (const far of [5, 20, 80, 400, 4000]) { const p = project(cam, rover.x + cam.fx * far, 0, cam.fz * far)!; expect(p.y).toBeGreaterThan(horizon); expect(p.y).toBeLessThan(last); last = p.y; }
      expect(last - horizon).toBeLessThan(1);
    }
  });
  it('one vanishing point: both edges of the track and a row of flowers beside it run to the same pixel', () => {
    const cam = shotCamera(chase, rover, W, H), vanish = trackVanish(cam)!, horizon = horizonY(cam);
    for (const [y, z] of [[0, -1.3], [0, 1.3], [1.9, 2.4], [0, 14]]) {
      const far = project(cam, 1e6, y, z)!;
      expect(far.x).toBeCloseTo(vanish, 0); expect(far.y).toBeCloseTo(horizon, 0);
    }
    // Looking square across the track there is none.
    expect(trackVanish(lookAt({ x: 0, y: 1, z: -5 }, { x: 0, y: 1, z: 0 }, 500, 0, 0))).toBeNull();
  });
  it('a pixel on the floor maps back to the floor point it shows', () => {
    const cam = shotCamera(wind, rover, W, H);
    for (const [x, z] of [[12, 0], [9, 3], [15, -1.2], [30, 12]]) { const p = project(cam, x, 0, z)!, back = floorAt(cam, p.x, p.y)!; expect(back.x).toBeCloseTo(x, 4); expect(back.z).toBeCloseTo(z, 4); }
    expect(floorAt(cam, 100, horizonY(cam) - 5)).toBeNull();
  });
});

describe('Rover is seen as its picture was made', () => {
  it('the wind shot shows its face and the chase shows its back, each from the picture\'s own angle', () => {
    expect(roverView(shotCamera(wind, rover, W, H))).toEqual({ face: 'front', flip: false });
    expect(roverView(shotCamera(chase, rover, W, H))).toEqual({ face: 'rear', flip: true });
    // From the far side of the track both pictures are mirrored.
    const farSide = (shot: Shot) => { const cam = shotCamera(shot, rover, W, H); return lookAt({ x: cam.ex, y: cam.ey, z: -cam.ez }, rover, cam.focal, cam.cx, cam.cy); };
    expect(roverView(farSide(wind))).toEqual({ face: 'front', flip: true });
    expect(roverView(farSide(chase))).toEqual({ face: 'rear', flip: false });
  });
  it('in both shots Rover drives toward the right of the frame', () => {
    for (const shot of [wind, chase]) { const cam = shotCamera(shot, rover, W, H); expect(project(cam, rover.x + 1, 0, 0)!.x).toBeGreaterThan(project(cam, rover.x, 0, 0)!.x); }
    // Ahead of Rover is nearer in the wind shot and further in the chase.
    const front = shotCamera(wind, rover, W, H), rear = shotCamera(chase, rover, W, H);
    expect(depthOf(front, rover.x + 2, 0, 0)).toBeLessThan(depthOf(front, rover.x, 0, 0));
    expect(depthOf(rear, rover.x + 2, 0, 0)).toBeGreaterThan(depthOf(rear, rover.x, 0, 0));
  });
  it('shots blend part by part', () => {
    const mid = mixShot(wind, chase, 0.5);
    expect(mid.distance).toBeCloseTo((wind.distance + chase.distance) / 2); expect(mid.bearing).toBeCloseTo(0);
    expect(mixShot(wind, chase, -3)).toEqual(wind); expect(mixShot(wind, chase, 9)).toEqual(chase);
  });
});

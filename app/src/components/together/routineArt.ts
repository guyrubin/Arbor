/**
 * The Living Forms face of each ready-made routine on the day map, cropped
 * as the Routines board crops it (frame and crop measured at a 40 px face;
 * `routineFace` scales both). Decorative identity only, never evidence.
 */
type Face = { src: string; frame: [number, number]; crop: { w: number; h: number; x: number; y: number } };

const FACES: Readonly<Record<string, Face>> = {
  morning: { src: "/visuals/guides/screens-480.webp", frame: [40, 31], crop: { w: 123.1, h: 69.2, x: -72.3, y: -19.7 } },
  goodbye: { src: "/visuals/guides/drop-off-480.webp", frame: [40, 29], crop: { w: 91.4, h: 51.4, x: -48.6, y: -13.3 } },
  reconnect: { src: "/visuals/parent/v2/area-school-480.webp", frame: [40, 30.3], crop: { w: 45.7, h: 45.7, x: -3.2, y: -7.9 } },
  nap: { src: "/visuals/parent/v2/area-sleep-480.webp", frame: [40, 25.8], crop: { w: 50.5, h: 50.5, x: -4.8, y: -12.9 } },
  tidy: { src: "/visuals/guides/tidy-up-480.webp", frame: [40, 24.6], crop: { w: 88.9, h: 50, x: -46.7, y: -13.1 } },
  screens: { src: "/visuals/guides/screens-480.webp", frame: [40, 31], crop: { w: 123.1, h: 69.2, x: -72.3, y: -19.7 } },
  meal: { src: "/visuals/guides/meals-480.webp", frame: [40, 22.7], crop: { w: 88.5, h: 49.8, x: -46.8, y: -15.1 } },
  gratitude: { src: "/visuals/parent/v2/area-family-480.webp", frame: [40, 28.6], crop: { w: 47.1, h: 47.1, x: -3.4, y: -11.4 } },
  bedtime: { src: "/visuals/guides/bedtime-480.webp", frame: [40, 26.3], crop: { w: 98, h: 55.1, x: -53.1, y: -14.9 } },
  potty: { src: "/visuals/parent/v2/domain-body-480.webp", frame: [30.4, 40], crop: { w: 51.3, h: 51.3, x: -9.6, y: -5.1 } },
  checkup: { src: "/visuals/parent/v2/area-hands-480.webp", frame: [40, 24.2], crop: { w: 45.7, h: 45.7, x: -2.9, y: -11.2 } },
  calm: { src: "/visuals/guides/big-feelings-480.webp", frame: [40, 26.7], crop: { w: 95, h: 53.5, x: -51.3, y: -14.1 } },
};

const FALLBACK: Face = { src: "/visuals/parent/v2/together-480.webp", frame: [40, 26.7], crop: { w: 60, h: 40, x: -10, y: -6 } };

/** The routine's face at `size` px wide (the frame keeps the board's proportion). */
export function routineFace(routineId: string, size: number) {
  const face = FACES[routineId] ?? FALLBACK;
  const k = size / 40;
  const r = (n: number) => Math.round(n * k * 10) / 10;
  return {
    src: face.src,
    width: r(face.frame[0]),
    height: r(face.frame[1]),
    crop: { w: r(face.crop.w), h: r(face.crop.h), x: r(face.crop.x), y: r(face.crop.y) },
  };
}

/**
 * B-GAME-13d — the hero pose route's MODEL_PROVIDER=mock image: the synthetic
 * pose (lib/heroPoseMockArt.ts) encoded as a PNG with node's zlib only (no
 * image library on the server). Deterministic: the same pose is the same bytes.
 * Never reachable in production (env.ts refuses MODEL_PROVIDER=mock there).
 */
import { deflateSync } from "node:zlib";
import type { GeneratedImage } from "../ai/modelRouter.js";
import type { HeroPoseId } from "../lib/heroSheetContract.js";
import { mockHeroPoseRaster, type MockRaster } from "../lib/heroPoseMockArt.js";

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, body: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(body.length, 0);
  const typed = Buffer.concat([Buffer.from(type, "latin1"), body]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typed), 0);
  return Buffer.concat([len, typed, crc]);
}

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** RGBA 8-bit, no interlace, filter 0 on every row. */
export function encodePng(img: MockRaster): Buffer {
  const { width: w, height: h, data } = img;
  const head = Buffer.alloc(13);
  head.writeUInt32BE(w, 0);
  head.writeUInt32BE(h, 4);
  head[8] = 8; // bit depth
  head[9] = 6; // RGBA
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    Buffer.from(data.buffer, data.byteOffset + y * w * 4, w * 4).copy(raw, y * (w * 4 + 1) + 1);
  }
  return Buffer.concat([SIGNATURE, chunk("IHDR", head), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}

export function mockHeroPoseImage(pose: HeroPoseId): GeneratedImage {
  return { data: encodePng(mockHeroPoseRaster(pose)).toString("base64"), mimeType: "image/png" };
}

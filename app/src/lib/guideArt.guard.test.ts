import { describe, expect, it } from "vitest";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { GUIDE_ART, GUIDE_ART_SHIPPED, GUIDE_ART_WIDTHS, GUIDE_TOPICS, guideArtFiles } from "./guideArt";

/**
 * VIS-05 — the guide illustrations on disk, their registry and their
 * provenance stay one thing. The art itself is not made yet (Guy's call:
 * image-model spend or a commission), so the file checks run against the
 * shipped topics only, and the WebP reader is proven on built headers.
 */

const publicDir = path.resolve(__dirname, "../../public");
const guidesDir = path.join(publicDir, "visuals", "guides");
const provenancePath = path.resolve(__dirname, "../../../docs/design/guide-art-v1.json");

/** 120 KB, inclusive. Stricter than parent art's 160 KB on purpose. */
const MAX_BYTES = 120 * 1024;
const HEIGHT_AT: Readonly<Record<number, number>> = { 480: 270, 960: 540 };
const NO_PEOPLE = /no people, no faces, no hands, no text/i;

/** Width and height from a WebP's first chunk (VP8X, VP8 or VP8L); undefined when it is not a WebP. */
function webpSize(buf: Buffer): { width: number; height: number } | undefined {
  if (buf.length < 30) return undefined;
  if (buf.toString("ascii", 0, 4) !== "RIFF" || buf.toString("ascii", 8, 12) !== "WEBP") return undefined;
  const chunk = buf.toString("ascii", 12, 16);
  if (chunk === "VP8X") {
    return { width: buf.readUIntLE(24, 3) + 1, height: buf.readUIntLE(27, 3) + 1 };
  }
  if (chunk === "VP8 ") {
    // Key-frame start code 9d 01 2a, then 14-bit width and height.
    if (buf[23] !== 0x9d || buf[24] !== 0x01 || buf[25] !== 0x2a) return undefined;
    return { width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
  }
  if (chunk === "VP8L") {
    if (buf[20] !== 0x2f) return undefined;
    const bits = buf.readUInt32LE(21);
    return { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 };
  }
  return undefined;
}

/** A minimal WebP header of the given kind, padded to a realistic length. */
function header(kind: "VP8X" | "VP8 " | "VP8L", width: number, height: number): Buffer {
  const buf = Buffer.alloc(64);
  buf.write("RIFF", 0, "ascii");
  buf.writeUInt32LE(buf.length - 8, 4);
  buf.write("WEBP", 8, "ascii");
  buf.write(kind, 12, "ascii");
  buf.writeUInt32LE(buf.length - 20, 16);
  if (kind === "VP8X") {
    buf.writeUIntLE(width - 1, 24, 3);
    buf.writeUIntLE(height - 1, 27, 3);
  } else if (kind === "VP8 ") {
    buf[23] = 0x9d;
    buf[24] = 0x01;
    buf[25] = 0x2a;
    buf.writeUInt16LE(width, 26);
    buf.writeUInt16LE(height, 28);
  } else {
    buf[20] = 0x2f;
    buf.writeUInt32LE(((width - 1) | ((height - 1) << 14)) >>> 0, 21);
  }
  return buf;
}

interface ProvenanceRecord {
  file: string;
  status: string;
  aspect: string;
  prompt: string;
  model?: string | null;
  date?: string | null;
  reviewer?: string | null;
  outputs?: string[];
  references?: string[];
}

const provenance = JSON.parse(readFileSync(provenancePath, "utf8")) as { assets: ProvenanceRecord[] };

describe("guide art registry (VIS-05)", () => {
  it("names twelve unique topics, each with a picture description", () => {
    expect(GUIDE_TOPICS).toHaveLength(12);
    expect(new Set(GUIDE_TOPICS).size).toBe(12);
    expect(Object.keys(GUIDE_ART).sort()).toEqual([...GUIDE_TOPICS].sort());
    for (const topic of GUIDE_ART_SHIPPED) expect(GUIDE_TOPICS).toContain(topic);
  });

  it("every alt names objects only, in plain words, in both languages", () => {
    const enBanned =
      /\b(child|children|kid|kids|baby|babies|toddler|boy|girl|person|people|face|faces|hand|hands|mother|father|mom|mum|dad|parent|parents)\b/i;
    const heBanned = new Set(["ילד", "ילדה", "ילדים", "ילדות", "תינוק", "תינוקת", "אמא", "אבא", "הורה", "הורים", "אנשים", "אדם", "פנים", "ידיים"]);
    for (const topic of GUIDE_TOPICS) {
      const { en, he } = GUIDE_ART[topic].alt;
      expect(en.trim().length, topic).toBeGreaterThan(10);
      expect(he.trim().length, topic).toBeGreaterThan(10);
      expect(he, `${topic}: the Hebrew alt is all Hebrew`).not.toMatch(/[A-Za-z]/);
      expect(en, `${topic}: the English alt names no person`).not.toMatch(enBanned);
      // A name would be a capitalised word after the first.
      expect(en.split(/\s+/).slice(1).filter((w) => /^[A-Z]/.test(w)), `${topic}: no names`).toEqual([]);
      const heWords = he.split(/[^א-ת]+/).filter(Boolean);
      const people = heWords.filter((w) => heBanned.has(w) || heBanned.has(w.replace(/^[והבלמשכ]/, "")));
      expect(people, `${topic}: the Hebrew alt names no person`).toEqual([]);
    }
  });
});

describe("guide art files (VIS-05)", () => {
  it("the WebP reader is not vacuous: it reads all three encodings and refuses anything else", () => {
    expect(webpSize(header("VP8X", 960, 540))).toEqual({ width: 960, height: 540 });
    expect(webpSize(header("VP8 ", 480, 270))).toEqual({ width: 480, height: 270 });
    expect(webpSize(header("VP8L", 960, 540))).toEqual({ width: 960, height: 540 });
    expect(webpSize(header("VP8X", 960, 640))).toEqual({ width: 960, height: 640 });
    const png = Buffer.alloc(64);
    png.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(webpSize(png)).toBeUndefined();
    expect(webpSize(Buffer.alloc(8))).toBeUndefined();
  });

  it("the folder holds the style brief and nothing unregistered", () => {
    expect(existsSync(path.join(guidesDir, "README.md"))).toBe(true);
    const allowed = new Set(["README.md", ...[...GUIDE_ART_SHIPPED].flatMap((t) => guideArtFiles(t).map((f) => path.basename(f)))]);
    const strays = readdirSync(guidesDir).filter((f) => !allowed.has(f));
    expect(strays, "a picture lands with its GUIDE_ART_SHIPPED entry and provenance record, or not at all").toEqual([]);
  });

  it("every shipped topic: both files on disk, WebP, at most 120 KB, exactly 16:9 at its width", () => {
    for (const topic of GUIDE_ART_SHIPPED) {
      const files = guideArtFiles(topic);
      expect(files).toHaveLength(GUIDE_ART_WIDTHS.length);
      GUIDE_ART_WIDTHS.forEach((width, i) => {
        const file = path.join(publicDir, files[i].slice(1));
        expect(existsSync(file), file).toBe(true);
        expect(statSync(file).size, file).toBeLessThanOrEqual(MAX_BYTES);
        const size = webpSize(readFileSync(file));
        expect(size, `${file} is a WebP`).toBeDefined();
        expect(size, file).toEqual({ width, height: HEIGHT_AT[width] });
        expect((size!.width * 9) / 16, file).toBe(size!.height);
      });
    }
  });

  it("the size table is 16:9 at both widths", () => {
    for (const width of GUIDE_ART_WIDTHS) expect(HEIGHT_AT[width] * 16).toBe(width * 9);
  });
});

describe("guide art provenance (VIS-05)", () => {
  const byFile = new Map(provenance.assets.map((a) => [a.file, a] as const));

  it("holds one record per topic and no other", () => {
    expect(provenance.assets.map((a) => a.file).sort()).toEqual([...GUIDE_TOPICS].sort());
    expect(byFile.size).toBe(GUIDE_TOPICS.length);
  });

  it("every prompt is a real, text-only brief that rules out people, faces, hands and text", () => {
    for (const record of provenance.assets) {
      expect(record.prompt.length, record.file).toBeGreaterThan(80);
      expect(record.prompt, record.file).toMatch(NO_PEOPLE);
      expect(record.aspect, record.file).toBe("16:9");
      // Style references may only be the app's own shipped art, never a photo or the hero avatar.
      for (const ref of record.references ?? []) {
        expect(ref, record.file).toMatch(/^public\/(visuals\/(companion|parent)|brand)\/[\w./-]+$/);
      }
    }
  });

  it("a record says shipped exactly when the topic ships, and a shipped one says what, when, with which model and who reviewed it", () => {
    for (const topic of GUIDE_TOPICS) {
      const record = byFile.get(topic)!;
      expect(record.status === "shipped", topic).toBe(GUIDE_ART_SHIPPED.has(topic));
      if (!GUIDE_ART_SHIPPED.has(topic)) continue;
      expect(record.outputs, topic).toEqual(guideArtFiles(topic).map((f) => path.basename(f)));
      expect(record.model, topic).toMatch(/\S/);
      expect(record.date, topic).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(record.reviewer, topic).toMatch(/\S/);
    }
  });
});

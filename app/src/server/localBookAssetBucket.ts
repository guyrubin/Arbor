/**
 * K2 block 4 — the sandbox's stand-in for the child-assets bucket: the same
 * BookAssetBucket shape (server/bookAssets.ts) over a git-ignored local folder
 * (app/.data/book-assets/ — `.data/` is in .gitignore), so the write path
 * (server/bookSheet.ts), the owner-checked read proxy and the erase sweep run
 * end to end with MEMORY_ADAPTER=local and no Firebase. Never used with
 * MEMORY_ADAPTER=firestore (production refuses anything else).
 *
 * An object `children/<cid>/books/<book>/<rel>` is the file of that path; its
 * object metadata (content type, size, custom anchors) is a sidecar
 * `<file>.meta.json` that the listing skips.
 */
import { createReadStream, existsSync, mkdirSync, readdirSync, readFileSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { BookAssetBucket, BookAssetFile, BookAssetSaveOptions } from "./bookAssets.js";

const META = ".meta.json";

export class LocalFsBookAssetBucket implements BookAssetBucket {
  constructor(readonly root: string) {}

  /** The absolute path of an object name, or throws when it escapes the root. */
  private pathOf(name: string): string {
    const p = path.resolve(this.root, name);
    if (p !== this.root && !p.startsWith(this.root + path.sep)) throw new Error("bad object name");
    return p;
  }

  file(name: string): BookAssetFile {
    const p = this.pathOf(name);
    const metaOf = (): Record<string, unknown> => {
      try {
        return JSON.parse(readFileSync(p + META, "utf8")) as Record<string, unknown>;
      } catch {
        return existsSync(p) ? { size: String(statSync(p).size) } : {};
      }
    };
    const f: BookAssetFile = {
      name,
      get metadata() {
        return metaOf() as BookAssetFile["metadata"];
      },
      exists: async () => [existsSync(p)],
      createReadStream: () => createReadStream(p),
      delete: async () => {
        if (existsSync(p)) unlinkSync(p);
        if (existsSync(p + META)) unlinkSync(p + META);
      },
      save: async (data: Buffer, opts: BookAssetSaveOptions) => {
        mkdirSync(path.dirname(p), { recursive: true });
        writeFileSync(p, data);
        writeFileSync(p + META, JSON.stringify({ contentType: opts.contentType, size: String(data.length), metadata: opts.metadata?.metadata ?? {} }));
      },
    };
    return f;
  }

  async getFiles(opts: { prefix: string }): Promise<[BookAssetFile[]]> {
    const out: BookAssetFile[] = [];
    // walk the deepest existing folder the prefix names
    const prefixPath = this.pathOf(opts.prefix || ".");
    let dir = opts.prefix.endsWith("/") ? prefixPath : path.dirname(prefixPath);
    if (!existsSync(dir)) return [out];
    if (!statSync(dir).isDirectory()) dir = path.dirname(dir);
    const walk = (d: string) => {
      for (const e of readdirSync(d)) {
        const p = path.join(d, e);
        if (statSync(p).isDirectory()) walk(p);
        else if (!e.endsWith(META)) {
          const name = path.relative(this.root, p).split(path.sep).join("/");
          if (name.startsWith(opts.prefix)) out.push(this.file(name));
        }
      }
    };
    walk(dir);
    return [out];
  }
}

/** The sandbox bucket under `<cwd>/.data/book-assets` (the app folder). */
export function localBookAssetBucket(cwd: string = process.cwd()): LocalFsBookAssetBucket {
  return new LocalFsBookAssetBucket(path.resolve(cwd, ".data", "book-assets"));
}

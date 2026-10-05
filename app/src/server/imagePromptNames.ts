/**
 * B-KID-40 (KB-45) — the child's name never travels to the image model.
 *
 * `/generate-comic` used to print `Hero name: <child>` (and a sidekick's name)
 * into the image prompt although the name is never drawn. The route now keeps
 * the names only to SCRUB them from the free-text fields it does send:
 *   - theme / setting: the name becomes "the hero" / "the sidekick";
 *   - title (lettered on a cover) and dialogue (lettered in a bubble): a field
 *     that names a child is dropped — the page renders without it rather than
 *     ask the model to draw a child's name.
 * Pure — no I/O; the route passes the request body's names.
 */

/** Names worth scrubbing: trimmed, at least 2 characters, max 40. */
export function childNamesFrom(...raw: unknown[]): string[] {
  const out: string[] = [];
  for (const r of raw) {
    if (typeof r !== "string") continue;
    const n = r.trim().slice(0, 40);
    if (n.length >= 2 && !out.includes(n)) out.push(n);
  }
  return out;
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** True when `text` contains any of `names` (case-insensitive). */
export function mentionsName(text: string, names: readonly string[]): boolean {
  const t = text.toLowerCase();
  return names.some((n) => t.includes(n.toLowerCase()));
}

/** `text` with every name replaced by `stand` (case-insensitive). */
export function replaceNames(text: string, names: readonly string[], stand: string): string {
  return names.reduce((acc, n) => acc.replace(new RegExp(escape(n), "gi"), stand), text);
}

/** A lettered field (title, dialogue): kept only when it names no child. */
export function letteredWithoutNames(text: string, names: readonly string[]): string {
  return mentionsName(text, names) ? "" : text;
}

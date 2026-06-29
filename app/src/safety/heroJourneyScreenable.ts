/**
 * Assembles every MODEL-AUTHORED, child-facing span of a hero-journey render into
 * one string for the output safety screen.
 *
 * This is load-bearing coverage: `/generate-hero-journey` emits model-generated
 * scenes / choices / reflection, so EVERY such span must pass `screenModelOutput`
 * before it can reach — or be voiced to — a child. Every other generative route
 * already screens its output; this closes the one that did not. Server-fixed
 * fields (storyId, beatId, the vetted catalog title) are model-independent and
 * deliberately excluded. Defensive against missing/mistyped fields so a malformed
 * render never throws here (the caller still screens whatever was assembled).
 */

const str = (v: unknown): string => (typeof v === "string" ? v : "");
const strArr = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];

/** Concatenate the model-authored spans of a hero-journey render, newline-joined. */
export function assembleHeroJourneyScreenable(render: unknown): string {
  if (!render || typeof render !== "object") return "";
  const r = render as Record<string, unknown>;
  const parts: string[] = [];

  const scenes = Array.isArray(r.scenes) ? r.scenes : [];
  for (const s of scenes) {
    if (!s || typeof s !== "object") continue;
    const scene = s as Record<string, unknown>;
    // beatId is server-fixed (matches the vetted spine) → excluded.
    parts.push(str(scene.title), str(scene.narration), str(scene.imagePrompt), str(scene.dialogue));
    parts.push(...strArr(scene.sfx));
  }

  const choices = Array.isArray(r.choices) ? r.choices : [];
  for (const c of choices) {
    if (!c || typeof c !== "object") continue;
    const choice = c as Record<string, unknown>;
    // id is server-fixed → excluded.
    parts.push(str(choice.label), str(choice.consequence));
  }

  const reflection =
    r.reflection && typeof r.reflection === "object" ? (r.reflection as Record<string, unknown>) : {};
  parts.push(...strArr(reflection.practiced), ...strArr(reflection.questions));

  return parts.filter((p) => p.trim().length > 0).join("\n");
}

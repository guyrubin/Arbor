import type { ModelProvider } from "../ai/modelRouter.js";
import { screenModelOutput, type OutputScreenVerdict } from "./outputScreen.js";

/** Screen every model-authored string, including nested choices, captions and drafts. */
export const screenStructuredModelOutput = async (provider: ModelProvider, value: unknown): Promise<OutputScreenVerdict> => {
  const pending: unknown[] = [value];
  const text: string[] = [];
  let nodes = 0;
  let chars = 0;
  while (pending.length) {
    const item = pending.pop();
    if (++nodes > 4000) return { flagged: true, category: "semantic_unsafe", reason: "Generated output exceeds screening bounds." };
    if (typeof item === "string") {
      chars += item.length;
      if (chars > 100000) return { flagged: true, category: "semantic_unsafe", reason: "Generated output exceeds screening bounds." };
      text.push(item);
    } else if (Array.isArray(item)) pending.push(...item);
    else if (item && typeof item === "object") pending.push(...Object.values(item));
  }
  return screenModelOutput(provider, text.join("\n"));
};

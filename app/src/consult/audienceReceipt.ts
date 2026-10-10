import type { ExportAudience } from "./packet";

/** Account/child host-owned receipt. Mutations retire held callbacks before
 * React commits the chosen audience or applies a pending prefill. */
export function createConsultAudienceReceipt() {
  let audience: ExportAudience | undefined;
  let revision = 0;
  return {
    publish(next: ExportAudience) { if (next !== audience) { audience = next; revision++; } },
    invalidate() { audience = undefined; revision++; },
    read() {
      const observed = revision;
      return { audience, isCurrent: () => observed === revision && audience !== undefined && audience !== "teacher" };
    },
  };
}

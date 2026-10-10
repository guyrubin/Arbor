/**
 * Firestore resolves a write only when the SERVER acknowledges it. The app runs
 * a persistent local cache (lib/firebase.ts), so an offline write is already
 * applied on this device and syncs on reconnect — awaiting the ack would leave
 * a capture on "Saving…" until the network returns, with no receipt or Undo.
 *
 * Offline, or after QUEUED_ACK_MS without an answer, the write counts as kept
 * (queued). A rejection that arrives in time (rules, invalid data) still
 * rejects, so the caller keeps its draft and offers retry; a later rejection is
 * rolled back by the listener and logged here.
 */
export const QUEUED_ACK_MS = 4000;

export async function settleOrQueue(
  write: Promise<void>,
  opts: { online?: () => boolean; ackMs?: number; requireAcknowledgement?: boolean } = {},
): Promise<"acknowledged" | "queued"> {
  const online = opts.online ?? (() => typeof navigator === "undefined" || navigator.onLine !== false);
  if (opts.requireAcknowledgement) {
    // Critical multi-write flows cannot treat the local Firestore queue as a
    // durable receipt. Timeout/offline keeps the caller's explicit retry open.
    // Firestore may still finish later; retry must use the same document ID.
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      if (!online()) {
        void write.catch(() => {});
        throw new Error("The write needs an online confirmation");
      }
      const timeout = new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error("The write was not confirmed; please retry")), opts.ackMs ?? QUEUED_ACK_MS);
      });
      await Promise.race([write, timeout]);
      return "acknowledged";
    } finally { clearTimeout(timer); }
  }
  const late = (err: unknown) => console.warn("[arbor] a queued write was rejected after it was kept", err);
  if (!online()) {
    write.catch(late);
    return "queued";
  }
  let timer: ReturnType<typeof setTimeout> | undefined;
  const queued = new Promise<"queued">((resolve) => { timer = setTimeout(() => resolve("queued"), opts.ackMs ?? QUEUED_ACK_MS); });
  try {
    const outcome = await Promise.race([write.then(() => "acknowledged" as const), queued]);
    if (outcome === "queued") write.catch(late);
    return outcome;
  } finally {
    clearTimeout(timer);
  }
}

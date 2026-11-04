/**
 * Likeness ceremony — a parent moment before a Kids Studio picture of the
 * child leaves the device.
 *
 * Share and export of that picture wait for one choice: use this likeness,
 * or keep it private. The choice is for this send only. It is not stored,
 * not a child record, and not a setting. A picture that does not show the
 * child (a shared plate, a mascot) is not part of the ceremony.
 *
 * Kid Mode never sees it. With no parent host listening, the picture stays.
 */

import { isKidModeActive } from "./kidModeGate";

export type LikenessPreview = {
  src: string;
  /** Child first name, when the picture is theirs. */
  name?: string;
};

type Pending = {
  preview: LikenessPreview;
  resolve: (allowed: boolean) => void;
};

const queue: Pending[] = [];
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

/** A generated or private picture of the child, not shared catalogue art. */
export function imageCarriesChildLook(src: string | null | undefined): boolean {
  if (!src) return false;
  const value = src.trim();
  if (/^data:image\/(?:png|jpe?g|webp)[;,]/i.test(value)) return true;
  if (/hero-sheets\//i.test(value)) return true;
  if (/\/children\/[^/?#]+\/books\//i.test(value)) return true;
  return false;
}

export function subscribeLikenessCeremony(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      const pending = queue.splice(0);
      for (const item of pending) item.resolve(false);
      if (pending.length) emit();
    }
  };
}

/** Stable while the same picture is waiting. Null when nothing is waiting. */
export function currentLikenessPreview(): LikenessPreview | null {
  return queue[0]?.preview ?? null;
}

export function answerLikenessCeremony(allowed: boolean): void {
  const item = queue.shift();
  if (!item) return;
  item.resolve(allowed);
  emit();
}

/**
 * True when this picture may leave. A picture without the child's look
 * leaves as it does today. Kid Mode, a missing host, or "keep private"
 * holds a picture that shows the child.
 */
export function releaseChildLikeness(preview: { src?: string | null; name?: string }): Promise<boolean> {
  const src = preview.src ?? "";
  if (!imageCarriesChildLook(src)) return Promise.resolve(true);
  if (isKidModeActive() || listeners.size === 0) return Promise.resolve(false);
  const name = preview.name?.trim();
  return new Promise((resolve) => {
    queue.push({ preview: { src, ...(name ? { name } : {}) }, resolve });
    emit();
  });
}

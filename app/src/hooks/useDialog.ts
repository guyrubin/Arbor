import { useCallback, useEffect, useLayoutEffect, useRef, type MouseEvent, type RefObject } from "react";
import { registerDialog, type DialogHandle } from "../lib/dialogStack";

const useDialogEffect = typeof document === "undefined" ? useEffect : useLayoutEffect;
/** Parent dialog behavior only. Registration survives inline callback changes;
 * Escape, focus and dismissal belong to the shared top layer. No media, data,
 * native Back, or presentation behavior is introduced here. */
export function useDialog<T extends HTMLElement = HTMLDivElement>({ open, onClose, initialFocusRef, returnFocusRef, parentRef }: {
  open: boolean;
  onClose: () => void;
  initialFocusRef?: RefObject<HTMLElement | null>;
  returnFocusRef?: RefObject<HTMLElement | null>;
  parentRef?: RefObject<HTMLElement | null>;
}) {
  const ref = useRef<T | null>(null);
  const latest = useRef({ onClose, initialFocusRef, returnFocusRef, parentRef });
  latest.current = { onClose, initialFocusRef, returnFocusRef, parentRef };
  const handle = useRef<DialogHandle | null>(null);
  useDialogEffect(() => {
    if (!open || !ref.current) return;
    const registration = registerDialog({
      root: ref.current,
      onClose: () => latest.current.onClose(),
      initialFocus: () => latest.current.initialFocusRef?.current ?? null,
      returnFocus: () => latest.current.returnFocusRef?.current ?? null,
      parentRoot: () => latest.current.parentRef?.current ?? null,
    });
    handle.current = registration;
    return () => {
      if (handle.current === registration) handle.current = null;
      registration.dispose();
    };
  }, [open]);
  const requestClose = useCallback(() => handle.current?.close(), []);
  const onBackdropClick = useCallback((event: MouseEvent<HTMLElement>) => {
    // React portal events still bubble through the owning drawer's ancestry.
    event.stopPropagation();
    if (event.target === event.currentTarget) requestClose();
  }, [requestClose]);
  return { ref, requestClose, onBackdropClick };
}

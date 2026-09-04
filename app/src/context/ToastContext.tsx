import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import { CheckCircle2, AlertTriangle, Info, X } from "lucide-react";
import { useLanguage } from "./LanguageContext";
import { isKidModeActive, subscribeKidMode } from "../lib/kidModeGate";

type ToastType = "success" | "error" | "info";
type Toast = { id: number; type: ToastType; message: string };

type ToastContextValue = {
  toast: (message: string, type?: ToastType) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

// TODO(m5): gate toast motion on prefers-reduced-motion
const STYLES: Record<ToastType, { border: string; icon: React.ReactNode }> = {
  success: { border: "rgba(52,178,119,0.40)", icon: <CheckCircle2 className="w-4 h-4" style={{ color: "var(--arbor-clay-deep)" }} /> },
  error: { border: "rgba(214,86,111,0.40)", icon: <AlertTriangle className="w-4 h-4" style={{ color: "var(--arbor-danger)" }} /> },
  info: { border: "rgba(63,140,201,0.40)", icon: <Info className="w-4 h-4" style={{ color: "var(--arbor-sky)" }} /> },
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const { t } = useLanguage();
  const [toasts, setToasts] = useState<Toast[]>([]);

  // KID-LOCK (W0.9, LEAK 4): ToastProvider renders OUTSIDE Shell (App.tsx), so
  // its z-[80] container paints ABOVE the Kid Mode overlay (z-70) with a
  // tabbable dismiss button. Parent-register toast text must never paint over
  // the kid surface: while the gate is active, toast() queues instead of
  // rendering (all types — error toasts are parent-register too) and the
  // container is not mounted at all; the queue flushes on Kid Mode exit.
  const [kidLocked, setKidLocked] = useState(isKidModeActive);
  const queueRef = useRef<Toast[]>([]);
  useEffect(() => subscribeKidMode(setKidLocked), []);

  const remove = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  const toast = useCallback(
    (message: string, type: ToastType = "info") => {
      const id = Date.now() + Math.random();
      if (isKidModeActive()) {
        queueRef.current.push({ id, type, message });
        return;
      }
      setToasts((t) => [...t, { id, type, message }]);
      setTimeout(() => remove(id), 4000);
    },
    [remove]
  );

  // Flush the queued toasts once Kid Mode exits (parent is back in control).
  useEffect(() => {
    if (kidLocked || queueRef.current.length === 0) return;
    const queued = queueRef.current;
    queueRef.current = [];
    setToasts((t) => [...t, ...queued]);
    for (const q of queued) setTimeout(() => remove(q.id), 4000);
  }, [kidLocked, remove]);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {/* Portalled to body and exempted from the dialog shield: rendered inside
          #root it inherits inert/aria-hidden whenever any dialog is open, which
          silences exactly the toasts dialogs raise (deletion done, gate blocked,
          avatar errors) and makes their dismiss button unclickable. */}
      {!kidLocked && typeof document !== "undefined" && createPortal(
      <div role="status" aria-live="polite" data-dialog-shield-exempt
        className="fixed top-4 end-4 z-[80] flex flex-col gap-2 w-[min(92vw,340px)]">
        <AnimatePresence>
          {toasts.map((tc) => (
            <motion.div
              key={tc.id}
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 40 }}
              className="border rounded-2xl px-4 py-3 shadow-2xl flex items-start gap-3 text-sm"
              style={{
                background: "var(--arbor-paper-elevated)",
                borderColor: STYLES[tc.type].border,
                color: "var(--arbor-ink)",
              }}
            >
              {STYLES[tc.type].icon}
              <span className="flex-1 leading-snug" style={{ color: "var(--arbor-ink)" }}>{tc.message}</span>
              <button onClick={() => remove(tc.id)} className="arbor-toast-dismiss" aria-label={t("aria.dismiss")}>
                <X className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>, document.body)}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within a ToastProvider");
  return ctx;
}

/** Optional variant for controls that must stay renderable OUTSIDE the
 *  provider (e.g. `SpeakButton`, which is context-free by design): returns
 *  null instead of throwing, so callers degrade gracefully in tests. */
export function useToastOptional(): ToastContextValue | null {
  return useContext(ToastContext);
}

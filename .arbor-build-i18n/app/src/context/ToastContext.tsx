import React, { createContext, useCallback, useContext, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { CheckCircle2, AlertTriangle, Info, X } from "lucide-react";

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
  const [toasts, setToasts] = useState<Toast[]>([]);

  const remove = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  const toast = useCallback(
    (message: string, type: ToastType = "info") => {
      const id = Date.now() + Math.random();
      setToasts((t) => [...t, { id, type, message }]);
      setTimeout(() => remove(id), 4000);
    },
    [remove]
  );

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div role="status" aria-live="polite" className="fixed top-4 right-4 z-[80] flex flex-col gap-2 w-[min(92vw,340px)]">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 40 }}
              className="border rounded-2xl px-4 py-3 shadow-2xl flex items-start gap-3 text-sm"
              style={{
                background: "var(--arbor-paper-elevated)",
                borderColor: STYLES[t.type].border,
                color: "var(--arbor-ink)",
              }}
            >
              {STYLES[t.type].icon}
              <span className="flex-1 leading-snug" style={{ color: "var(--arbor-ink)" }}>{t.message}</span>
              <button onClick={() => remove(t.id)} className="arbor-toast-dismiss" aria-label="Dismiss">
                <X className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within a ToastProvider");
  return ctx;
}

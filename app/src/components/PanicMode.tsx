import React, { useMemo, useState } from "react";
import { motion } from "motion/react";
import { X, Volume2, Square, LifeBuoy, NotebookPen } from "lucide-react";
import { CO_REGULATION_SCRIPTS, pickCoRegulationScript } from "../state/coRegulation";
import { useSpeech, speechLocaleFor } from "../state/voice";
import {
  screenForImmediateEscalation,
  CRISIS_RESOURCES,
  EMERGENCY_LINE,
  resolveCrisisLocale,
  type EscalationMatch
} from "../safety/escalation";
import type { ChildProfile } from "../types";

type PanicModeProps = {
  open: boolean;
  onClose: () => void;
  childProfile: ChildProfile;
  onLog?: (note: string) => void;
};

/**
 * E-01 — The 11pm button. One tap opens a calm, low-stimulation overlay with a
 * breathing pacer and an immediate co-regulation script. If the parent types
 * what's happening and it reads as a crisis, real localized resources surface
 * instantly (client-side screen, works offline). Gated on Wave 3 safety.
 */
export const PanicMode: React.FC<PanicModeProps> = ({ open, onClose, childProfile, onLog }) => {
  const [context, setContext] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [crisis, setCrisis] = useState<EscalationMatch | null>(null);
  const [logged, setLogged] = useState(false);
  const { supported: ttsSupported, speaking, speak, stop } = useSpeech();

  const locale = resolveCrisisLocale(childProfile);
  const speechLang = speechLocaleFor(childProfile?.languages);

  const script = useMemo(() => {
    if (activeId) return CO_REGULATION_SCRIPTS.find((s) => s.id === activeId) || pickCoRegulationScript(context);
    return pickCoRegulationScript(context);
  }, [activeId, context]);

  if (!open) return null;

  const handleContext = (value: string) => {
    setContext(value);
    setActiveId(null);
    const match = screenForImmediateEscalation({ message: value });
    setCrisis(match);
  };

  const handleClose = () => {
    stop();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-lg rounded-2xl border border-white/15 bg-[#0d1117] p-6 text-center shadow-2xl">
        <button
          type="button"
          onClick={handleClose}
          aria-label="Close calm mode"
          className="absolute right-3 top-3 rounded-lg p-1.5 text-[#a8a093] hover:bg-white/10 hover:text-white"
        >
          <X className="h-5 w-5" />
        </button>

        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#f4d991]">A calm minute</p>
        <h2 className="mt-1 text-xl font-extrabold text-white">First, you breathe.</h2>

        {/* Breathing pacer */}
        <div className="my-5 flex flex-col items-center">
          <div className="relative flex h-40 w-40 items-center justify-center">
            <motion.div
              className="absolute h-32 w-32 rounded-full bg-[#d7aa55]/20"
              animate={{ scale: [1, 1.5, 1.5, 1], opacity: [0.5, 0.85, 0.85, 0.5] }}
              transition={{ duration: 14, times: [0, 0.29, 0.57, 1], repeat: Infinity, ease: "easeInOut" }}
            />
            <motion.div
              className="absolute h-24 w-24 rounded-full bg-[#d7aa55]/40"
              animate={{ scale: [1, 1.5, 1.5, 1] }}
              transition={{ duration: 14, times: [0, 0.29, 0.57, 1], repeat: Infinity, ease: "easeInOut" }}
            />
            <span className="relative text-xs font-bold text-white">in · hold · out</span>
          </div>
          <p className="mt-2 text-[11px] text-[#a8a093]">Breathe in for 4, hold for 4, out for 6. Three rounds.</p>
        </div>

        {crisis ? (
          /* Crisis path — real, localized resources, instantly */
          <div className="space-y-3 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-left">
            <div className="flex items-center gap-2">
              <LifeBuoy className="h-4 w-4 text-red-400" />
              <h3 className="text-sm font-extrabold text-white">This needs a person, not an app</h3>
            </div>
            <p className="text-xs text-[#f4d991]">{EMERGENCY_LINE[locale].replace(/\*\*/g, "")}</p>
            <ul className="space-y-1 text-xs text-gray-100">
              {CRISIS_RESOURCES[crisis.category][locale].map((r) => (
                <li key={r.name}>
                  <strong className="text-white">{r.name}:</strong> {r.contact}
                </li>
              ))}
            </ul>
          </div>
        ) : (
          /* Co-regulation script */
          <div className="space-y-3 rounded-xl border border-white/10 bg-white/[0.03] p-4 text-left">
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#f4d991]">{script.situation}</p>
            <p className="text-[11px] text-[#a8a093]">{script.forParent}</p>
            <div className="rounded-lg bg-[#d7aa55]/10 p-3">
              <p className="text-base font-semibold leading-relaxed text-white select-text">"{script.say}"</p>
            </div>
            <p className="text-[11px] text-[#a8a093]">
              <span className="font-bold text-red-300">Avoid:</span> {script.avoid}
            </p>
            {ttsSupported && (
              <button
                type="button"
                onClick={() => (speaking ? stop() : speak(script.say, { lang: speechLang }))}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#d7aa55]/25 bg-[#d7aa55]/10 px-3 py-1.5 text-[11px] font-bold text-[#f4d991] hover:bg-[#d7aa55]/20"
              >
                {speaking ? <><Square className="h-3.5 w-3.5" /> Stop</> : <><Volume2 className="h-3.5 w-3.5" /> Read it to me</>}
              </button>
            )}
          </div>
        )}

        {/* Quick situation chips */}
        <div className="mt-4 flex flex-wrap justify-center gap-1.5">
          {CO_REGULATION_SCRIPTS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => {
                setActiveId(s.id);
                setCrisis(null);
              }}
              className={`rounded-full border px-2.5 py-1 text-[10px] font-bold transition ${
                !crisis && script.id === s.id
                  ? "border-[#d7aa55]/50 bg-[#d7aa55]/20 text-[#f4d991]"
                  : "border-white/10 bg-white/[0.02] text-[#a8a093] hover:bg-white/[0.06]"
              }`}
            >
              {s.situation}
            </button>
          ))}
        </div>

        {/* Optional context */}
        <input
          type="text"
          value={context}
          onChange={(e) => handleContext(e.target.value)}
          placeholder="What's happening right now? (optional)"
          className="mt-4 w-full rounded-lg border border-white/10 bg-[#08090c] px-3 py-2 text-xs text-white placeholder:text-[#a8a093] focus:border-[#d7aa55]/40 focus:outline-none"
        />

        {/* Aftercare */}
        <div className="mt-4 flex items-center justify-center gap-2">
          {onLog && (
            <button
              type="button"
              onClick={() => {
                onLog(context || script.situation);
                setLogged(true);
              }}
              disabled={logged}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.02] px-3 py-1.5 text-[11px] font-bold text-[#a8a093] hover:bg-white/[0.06] disabled:opacity-50"
            >
              <NotebookPen className="h-3.5 w-3.5" /> {logged ? "Logged" : "Log what happened"}
            </button>
          )}
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg bg-[#d7aa55] px-4 py-1.5 text-[11px] font-extrabold text-black hover:bg-[#c39947]"
          >
            We're okay now
          </button>
        </div>
      </div>
    </div>
  );
};

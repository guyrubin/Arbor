import React from "react";
import { Modal } from "../ui/Modal";
import { useArbor } from "../../context/ArborContext";

/** Lightweight behavior log capture that can be opened from anywhere (e.g. Overview). */
export default function QuickLogModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const {
    newLogType,
    setNewLogType,
    newLogIntensity,
    setNewLogIntensity,
    newLogTrigger,
    setNewLogTrigger,
    newLogResponse,
    setNewLogResponse,
    handleAddLog,
  } = useArbor();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLogTrigger.trim() || !newLogResponse.trim()) {
      handleAddLog(e); // surfaces the validation alert
      return;
    }
    handleAddLog(e);
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Quick log a moment">
      <form onSubmit={submit} className="space-y-4 text-sm">
        <div className="space-y-1.5">
          <label className="text-xs font-bold" style={{ color: "var(--arbor-muted)" }}>Type of challenge</label>
          <select value={newLogType} onChange={(e) => setNewLogType(e.target.value)} className="w-full rounded-xl p-2.5 text-xs focus:outline-none" style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule-strong)", color: "var(--arbor-ink)" }}>
            <option value="Transition Refusal">Departure Refusal</option>
            <option value="Sensory Overload">Sensory Overload</option>
            <option value="Screentime Dispute">Screen-time Switchoff</option>
            <option value="Sibling Conflict">Sibling Dispute</option>
            <option value="Food Refusal">Selective Eating</option>
            <option value="Sleep Meltdown">Bedtime Resistance</option>
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-bold" style={{ color: "var(--arbor-muted)" }}>Intensity: <span style={{ color: "#1f8a5a" }}>{newLogIntensity} / 5</span></label>
          <input type="range" min={1} max={5} value={newLogIntensity} onChange={(e) => setNewLogIntensity(parseInt(e.target.value))} className="w-full" style={{ accentColor: "#34b277" }} />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-bold" style={{ color: "var(--arbor-muted)" }}>What triggered this?</label>
          <input value={newLogTrigger} onChange={(e) => setNewLogTrigger(e.target.value)} placeholder="e.g. tablet turned off" className="w-full rounded-xl p-2.5 text-xs focus:outline-none" style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule-strong)", color: "var(--arbor-ink)" }} />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-bold" style={{ color: "var(--arbor-muted)" }}>How did you respond?</label>
          <input value={newLogResponse} onChange={(e) => setNewLogResponse(e.target.value)} placeholder="e.g. named the feeling, offered choice" className="w-full rounded-xl p-2.5 text-xs focus:outline-none" style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule-strong)", color: "var(--arbor-ink)" }} />
        </div>

        <button type="submit" className="w-full py-3 text-white font-extrabold text-xs rounded-xl transition active:scale-[0.98]" style={{ background: "linear-gradient(135deg,#3cc081,#34b277 60%,#2a9c66)" }}>
          Save log
        </button>
      </form>
    </Modal>
  );
}

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
          <label className="text-xs font-bold text-[#a8a093]">Type of challenge</label>
          <select value={newLogType} onChange={(e) => setNewLogType(e.target.value)} className="w-full bg-[#08090c] border border-white/10 rounded-xl p-2.5 text-white text-xs focus:outline-none focus:border-[#d7aa55]">
            <option value="Transition Refusal">Departure Refusal</option>
            <option value="Sensory Overload">Sensory Overload</option>
            <option value="Screentime Dispute">Screen-time Switchoff</option>
            <option value="Sibling Conflict">Sibling Dispute</option>
            <option value="Food Refusal">Selective Eating</option>
            <option value="Sleep Meltdown">Bedtime Resistance</option>
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-bold text-[#a8a093]">Intensity: <span className="text-[#f4d991]">{newLogIntensity} / 5</span></label>
          <input type="range" min={1} max={5} value={newLogIntensity} onChange={(e) => setNewLogIntensity(parseInt(e.target.value))} className="w-full accent-[#d7aa55]" />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-bold text-[#a8a093]">What triggered this?</label>
          <input value={newLogTrigger} onChange={(e) => setNewLogTrigger(e.target.value)} placeholder="e.g. tablet turned off" className="w-full bg-[#08090c] border border-white/10 rounded-xl p-2.5 text-white text-xs focus:outline-none focus:border-[#d7aa55]/50" />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-bold text-[#a8a093]">How did you respond?</label>
          <input value={newLogResponse} onChange={(e) => setNewLogResponse(e.target.value)} placeholder="e.g. named the feeling, offered choice" className="w-full bg-[#08090c] border border-white/10 rounded-xl p-2.5 text-white text-xs focus:outline-none focus:border-[#d7aa55]/50" />
        </div>

        <button type="submit" className="w-full py-3 bg-[#d7aa55] hover:bg-[#c39947] text-black font-extrabold text-xs rounded-xl transition active:scale-[0.98]">
          Save log
        </button>
      </form>
    </Modal>
  );
}

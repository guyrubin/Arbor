import React from "react";
import { Modal } from "../ui/Modal";
import { useArbor } from "../../context/ArborContext";
import { useToast } from "../../context/ToastContext";
import { useLanguage } from "../../context/LanguageContext";

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
  const { toast } = useToast();
  const { t } = useLanguage();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLogTrigger.trim() || !newLogResponse.trim()) {
      toast(t("ql.errToast"), "error");
      return;
    }
    handleAddLog(e);
    onClose();
    toast(t("ql.okToast"), "success");
  };

  return (
    <Modal open={open} onClose={onClose} title={t("ql.title")}>
      <form onSubmit={submit} className="space-y-4 text-sm">
        <div className="space-y-1.5">
          <label className="text-xs font-bold" style={{ color: "var(--arbor-muted)" }}>{t("ql.type")}</label>
          <select value={newLogType} onChange={(e) => setNewLogType(e.target.value)} className="w-full rounded-xl p-2.5 text-xs focus:outline-none" style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule-strong)", color: "var(--arbor-ink)" }}>
            <option value="Transition Refusal">{t("ql.type.transition")}</option>
            <option value="Sensory Overload">{t("ql.type.sensory")}</option>
            <option value="Screentime Dispute">{t("ql.type.screen")}</option>
            <option value="Sibling Conflict">{t("ql.type.sibling")}</option>
            <option value="Food Refusal">{t("ql.type.food")}</option>
            <option value="Sleep Meltdown">{t("ql.type.sleep")}</option>
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-bold" style={{ color: "var(--arbor-muted)" }}>{t("ql.intensity")} <span style={{ color: "var(--arbor-green-ink)" }}>{newLogIntensity} / 5</span></label>
          <input type="range" min={1} max={5} value={newLogIntensity} onChange={(e) => setNewLogIntensity(parseInt(e.target.value))} className="w-full" style={{ accentColor: "var(--arbor-clay)" }} />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-bold" style={{ color: "var(--arbor-muted)" }}>{t("ql.trigger")}</label>
          <input value={newLogTrigger} onChange={(e) => setNewLogTrigger(e.target.value)} placeholder={t("ql.triggerPh")} className="w-full rounded-xl p-2.5 text-xs focus:outline-none" style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule-strong)", color: "var(--arbor-ink)" }} />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-bold" style={{ color: "var(--arbor-muted)" }}>{t("ql.response")}</label>
          <input value={newLogResponse} onChange={(e) => setNewLogResponse(e.target.value)} placeholder={t("ql.responsePh")} className="w-full rounded-xl p-2.5 text-xs focus:outline-none" style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule-strong)", color: "var(--arbor-ink)" }} />
        </div>

        <button type="submit" className="w-full py-3 text-white font-extrabold text-xs rounded-xl transition active:scale-[0.98]" style={{ background: "var(--arbor-gradient-primary)" }}>
          {t("ql.save")}
        </button>
      </form>
    </Modal>
  );
}

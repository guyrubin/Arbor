import React, { useEffect, useState } from "react";
import { Modal } from "../ui/Modal";
import ConfirmCaptureReview from "./ConfirmCaptureReview";
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
  const [reviewing, setReviewing] = useState(false);
  useEffect(() => { if (!open) setReviewing(false); }, [open]);
  // TODAY-3: the review step is the SHARED ConfirmCaptureReview contract
  // (also rendered by BehaviorsTab for voice/photo/handoff captures — one
  // contract, never a forked path). CODEX-7: its provenance line states only
  // the factual source ("written by you"); NO static confidence/certainty
  // wording may return (firewall generative-honesty rule; guarded by
  // todayConsolidation.test.ts + confirmCaptureReview.test.ts).

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLogTrigger.trim() || !newLogResponse.trim()) {
      toast(t("ql.errToast"), "error");
      return;
    }
    setReviewing(true);
  };

  const confirm = (e: React.FormEvent) => {
    handleAddLog(e);
    setReviewing(false);
    onClose();
    toast(t("ql.okToast"), "success");
  };

  const discard = () => {
    setNewLogTrigger("");
    setNewLogResponse("");
    setReviewing(false);
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={t("ql.title")}>
      {reviewing ? <ConfirmCaptureReview
        source="text"
        rows={[
          { label: t("ql.type"), value: newLogType },
          { label: t("ql.review.trigger"), value: newLogTrigger },
          { label: t("ql.review.response"), value: newLogResponse },
        ]}
        onEdit={() => setReviewing(false)}
        onDiscard={discard}
        onConfirm={confirm}
      /> : <form onSubmit={submit} className="space-y-4 text-sm">
        <div className="space-y-1.5">
          <label htmlFor="quick-log-type" className="text-xs font-bold" style={{ color: "var(--arbor-muted)" }}>{t("ql.type")}</label>
          <select id="quick-log-type" value={newLogType} onChange={(e) => setNewLogType(e.target.value)} className="w-full rounded-xl p-2.5 text-xs focus:outline-none" style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule-strong)", color: "var(--arbor-ink)" }}>
            <option value="Transition Refusal">{t("ql.type.transition")}</option>
            <option value="Sensory Overload">{t("ql.type.sensory")}</option>
            <option value="Screentime Dispute">{t("ql.type.screen")}</option>
            <option value="Sibling Conflict">{t("ql.type.sibling")}</option>
            <option value="Food Refusal">{t("ql.type.food")}</option>
            <option value="Sleep Meltdown">{t("ql.type.sleep")}</option>
          </select>
        </div>

        <div className="space-y-1">
          <label htmlFor="quick-log-intensity" className="text-xs font-bold" style={{ color: "var(--arbor-muted)" }}>{t("ql.intensity")} <span style={{ color: "var(--arbor-green-ink)" }}>{newLogIntensity} / 5</span></label>
          <input id="quick-log-intensity" type="range" min={1} max={5} value={newLogIntensity} onChange={(e) => setNewLogIntensity(parseInt(e.target.value))} className="w-full" style={{ accentColor: "var(--arbor-clay)" }} />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="quick-log-trigger" className="text-xs font-bold" style={{ color: "var(--arbor-muted)" }}>{t("ql.trigger")}</label>
          <input id="quick-log-trigger" value={newLogTrigger} onChange={(e) => setNewLogTrigger(e.target.value)} placeholder={t("ql.triggerPh")} className="w-full rounded-xl p-2.5 text-xs focus:outline-none" style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule-strong)", color: "var(--arbor-ink)" }} />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="quick-log-response" className="text-xs font-bold" style={{ color: "var(--arbor-muted)" }}>{t("ql.response")}</label>
          <input id="quick-log-response" value={newLogResponse} onChange={(e) => setNewLogResponse(e.target.value)} placeholder={t("ql.responsePh")} className="w-full rounded-xl p-2.5 text-xs focus:outline-none" style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule-strong)", color: "var(--arbor-ink)" }} />
        </div>

        <button type="submit" className="w-full py-3 text-white font-extrabold text-xs rounded-xl transition active:scale-[0.98]" style={{ background: "var(--arbor-gradient-primary)" }}>
          {t("ql.save")}
        </button>
      </form>}
    </Modal>
  );
}

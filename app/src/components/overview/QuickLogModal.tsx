import React, { useEffect, useState } from "react";
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
  const { t, uiLang } = useLanguage();
  const [reviewing, setReviewing] = useState(false);
  useEffect(() => { if (!open) setReviewing(false); }, [open]);
  // CODEX-7: the provenance line states only the factual source ("written by
  // you"). NO static confidence/certainty wording may return here — an
  // unconditional "high confidence" is an asserted-not-computed system verdict
  // (firewall generative-honesty rule; guarded by todayConsolidation.test.ts).
  const copy = uiLang === "he" ? {
    reviewTitle: "בדקו לפני השמירה", source: "מקור: נכתב על ידכם",
    edit: "עריכה", discard: "מחיקה", confirm: "אישור ושמירה ברשומה",
    notSaved: "הטיוטה עדיין לא נשמרה ברשומה של הילד.", trigger: "מה קרה לפני", response: "מה ניסיתם",
  } : {
    reviewTitle: "Review before saving", source: "Source: written by you",
    edit: "Edit", discard: "Discard", confirm: "Confirm and save to record",
    notSaved: "This draft is not yet part of your child's record.", trigger: "What happened before", response: "What you tried",
  };

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
      {reviewing ? <form onSubmit={confirm} className="space-y-4 text-sm">
        <div className="rounded-2xl p-4" style={{ background: "var(--arbor-green-soft)", border: "1px solid var(--arbor-rule)" }} role="status">
          <p className="text-sm font-extrabold" style={{ color: "var(--arbor-ink)" }}>{copy.reviewTitle}</p>
          <p className="mt-1 text-[11px]" style={{ color: "var(--arbor-muted)" }}>{copy.source}</p>
          <p className="mt-3 text-xs leading-relaxed" style={{ color: "var(--arbor-muted)" }}>{copy.notSaved}</p>
        </div>
        <ReviewRow label={t("ql.type")} value={newLogType} />
        <ReviewRow label={copy.trigger} value={newLogTrigger} />
        <ReviewRow label={copy.response} value={newLogResponse} />
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <button type="button" onClick={() => setReviewing(false)} className="min-h-11 rounded-xl px-3 text-xs font-bold" style={{ border: "1px solid var(--arbor-rule-strong)", color: "var(--arbor-green-ink)" }}>{copy.edit}</button>
          <button type="button" onClick={discard} className="min-h-11 rounded-xl px-3 text-xs font-bold" style={{ color: "var(--arbor-muted)" }}>{copy.discard}</button>
          <button type="submit" className="col-span-2 min-h-11 rounded-xl px-3 text-xs font-extrabold text-white sm:col-span-1" style={{ background: "var(--arbor-gradient-primary)" }}>{copy.confirm}</button>
        </div>
      </form> : <form onSubmit={submit} className="space-y-4 text-sm">
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

function ReviewRow({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl p-3" style={{ background: "var(--arbor-paper-elevated)", border: "1px solid var(--arbor-rule)" }}><p className="text-[10px] font-extrabold uppercase tracking-[0.1em]" style={{ color: "var(--arbor-green-ink)" }}>{label}</p><p className="mt-1 text-xs leading-relaxed" style={{ color: "var(--arbor-ink)" }}>{value}</p></div>;
}

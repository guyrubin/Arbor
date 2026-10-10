import React from "react";
import { AnimatePresence, motion } from "motion/react";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { Icon } from "../ui/Icon";
import { SayThis } from "../ui/AiBlock";
import { ExplainAnswerBlock } from "../ui/ExplainAnswer";
import { explainAnswerText } from "../../lib/explainAnswer";
import { contextLabel } from "../behaviors/contextLabel";
import { isIncidentType } from "../../content/behaviorTaxonomy";
import type { BehaviorLog } from "../../types";

/** B-ASKJB-23: the existing per-log tools live with the Journal record.
 * Subjective intensity is plain text from the parent's note, never a grade. */
export default function JournalMomentDetails({ log }: { log: BehaviorLog }) {
  const { t, uiLang } = useLanguage();
  const { inlineCoRegulationScripts, isGeneratingInlineScript, handleGetInlineCoRegulationScript, seedCoach } = useArbor();
  return <section data-testid="journal-moment-details" className="space-y-3 t-sm" style={{ color: "var(--arbor-ink-soft)" }}>
    <dl className="space-y-2" dir="auto">
      <div><dt className="font-bold">{t("beh.triggerField")}</dt><dd>{log.trigger}</dd></div>
      {log.response && <div><dt className="font-bold">{t("beh.parentAction")}</dt><dd>{log.response}</dd></div>}
      {log.notes && <div><dt className="font-bold">{t("beh.observerNote")}</dt><dd>{log.notes}</dd></div>}
      {log.context && <div><dt className="font-bold">{t("beh.whereLabel")}</dt><dd>{contextLabel(log.context, t)}</dd></div>}
      {log.durationMinutes > 0 && <div><dt className="font-bold">{t("beh.duration")}</dt><dd>{log.durationMinutes}</dd></div>}
      {isIncidentType(log.behaviorType) && typeof log.intensity === "number" && <div><dt className="font-bold">{t("beh.intensity")}</dt><dd>{t("beh.level", { n: log.intensity })}</dd></div>}
    </dl>
    {/* co-regulation script */}
    <div className="pt-2.5 mt-1 flex flex-col gap-2" style={{ borderTop: "1px solid var(--arbor-rule)" }}>
      <div className="flex flex-col items-start gap-2 min-[520px]:flex-row min-[520px]:items-center min-[520px]:justify-between">
        <span className="t-sm font-bold flex items-center gap-1.5" style={{ color: "var(--arbor-green-ink)" }}>
          <Icon name="record_voice_over" size={14} fill={1} /> {t("beh.coRegScript")}
        </span>
        <button type="button" onClick={() => handleGetInlineCoRegulationScript(log)} disabled={isGeneratingInlineScript[log.id]} className="flex min-h-11 max-w-full cursor-pointer items-center gap-1.5 rounded-lg px-2.5 py-1 text-start t-sm font-bold transition-all" style={{ background: "var(--arbor-green-soft)", color: "var(--arbor-green-ink)" }}>
          {isGeneratingInlineScript[log.id] ? (<><Icon name="progress_activity" size={13} className="animate-spin" /> {t("beh.analyzing")}</>) : inlineCoRegulationScripts[log.id] ? (<><Icon name="auto_awesome" size={13} fill={1} /> {t("beh.regenerateScript")}</>) : (<><Icon name="auto_awesome" size={13} fill={1} /> {t("beh.generateScript")}</>)}
        </button>
      </div>

      <AnimatePresence initial={false}>
        {inlineCoRegulationScripts[log.id] && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="p-3 rounded-xl space-y-2 mt-1 t-sm leading-relaxed select-text overflow-hidden bg-white" style={{ border: "1px solid var(--arbor-rule)" }}>
            {/* B-ASKJB-24: a generated script renders through the shared
                SayThis (copy + read-aloud identical to Ask); its step keeps
                the checklist block. A failure (no step) keeps the prose
                block, whose MarkdownBlock turns a helpline into a link. */}
            {inlineCoRegulationScripts[log.id].tryToday ? (
              <>
                <SayThis text={inlineCoRegulationScripts[log.id].explanation} title={t("beh.coRegScript")} lang={uiLang === "he" ? "he" : "en"} copyLabel={t("coach.action.copy")} copiedLabel={t("coach.cards.copied")} />
                <ExplainAnswerBlock answer={{ explanation: "", tryToday: inlineCoRegulationScripts[log.id].tryToday }} tryTodayLabel={t("explain.tryToday")} className="space-y-1.5" />
              </>
            ) : (
              <ExplainAnswerBlock answer={inlineCoRegulationScripts[log.id]} tryTodayLabel={t("explain.tryToday")} className="space-y-1.5" />
            )}
            <div className="flex justify-end pt-1 gap-2" style={{ borderTop: "1px solid var(--arbor-rule)" }}>
              <button type="button" onClick={() => seedCoach({ prompt: t("seed.logCoreg", { trigger: log.trigger || "", response: log.response || "", script: explainAnswerText(inlineCoRegulationScripts[log.id], t("explain.tryToday")) }), source: "behavior-coreg" })} className="min-h-11 t-sm font-bold transition flex items-center gap-1" style={{ color: "var(--arbor-green-ink)" }}>
                {t("beh.discussCoach")} <Icon name="open_in_new" size={11} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>

  </section>;
}

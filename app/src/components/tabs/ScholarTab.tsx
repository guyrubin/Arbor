import React from "react";
import { motion } from "motion/react";
import { ExternalLink, Sparkles, ArrowLeft, ArrowRight } from "lucide-react";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { scholarsInfo } from "../../initialData";
import { PageHeader, cardCls, PASTEL, PastelKey } from "../ui/kit";

const TONES: PastelKey[] = ["mint", "sky", "lav", "coral", "yellow", "pink"];

export default function ScholarTab() {
  const { setSelectedLens, setChatInput, setActiveTab, childProfile } = useArbor();
  const { t, uiLang } = useLanguage();
  const first = childProfile.name.split(" ")[0];
  // Back-link glyph follows reading direction (LTR ← / RTL →).
  const BackGlyph = uiLang === "he" ? ArrowRight : ArrowLeft;

  return (
    <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6 max-w-[1180px]">
      <button onClick={() => setActiveTab("coach")} className="inline-flex items-center gap-1.5 min-h-[44px] text-sm font-bold focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 rounded-lg" style={{ color: "var(--arbor-muted)" }}>
        <BackGlyph className="w-4 h-4" aria-hidden /> {t("scholar.back")}
      </button>
      <PageHeader
        eyebrow={t("scholar.eyebrow")}
        title={t("scholar.title")}
        subtitle={t("scholar.subtitle")}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 text-xs">
        {scholarsInfo.map((sch, idx) => {
          const tone = TONES[idx % TONES.length];
          const p = PASTEL[tone];
          return (
            <div key={idx} className={`${cardCls} p-5 flex flex-col justify-between gap-5 transition motion-safe:hover:-translate-y-0.5`}>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl font-black text-lg flex items-center justify-center flex-shrink-0" style={{ background: p.soft, color: p.ink }}>
                    {sch.initial}
                  </div>
                  <div className="min-w-0">
                    <b className="text-sm font-extrabold block" style={{ color: "var(--arbor-ink)" }}>{sch.name}</b>
                    <p className="text-[10px] uppercase font-bold mt-0.5" style={{ color: "var(--arbor-muted)" }}>{sch.concept}</p>
                  </div>
                </div>

                <div className="space-y-2 pt-3" style={{ borderTop: "1px solid var(--arbor-rule)" }}>
                  <span className="text-[10px] font-bold block italic" style={{ color: p.ink }}>{t("scholar.focus", { theory: sch.theory })}</span>
                  <p className="leading-relaxed text-[11px]" style={{ color: "var(--arbor-muted)" }}>{sch.value}</p>
                  {sch.useWhen && (
                    <p className="leading-relaxed text-[11px] rounded-lg p-2.5" style={{ background: p.soft, color: p.ink }}>
                      {sch.useWhen}
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <button
                  onClick={() => {
                    setSelectedLens(sch.name);
                    // AI-input seed (sent to the model in aiLang) — intentionally English; the
                    // model localizes its reply via getAiLanguage(). Do not translate.
                    setChatInput(`Using ${sch.name}'s ${sch.concept} lens, give me practical, non-diagnostic guidance for ${childProfile.name} (age ${childProfile.age}) — what to notice and two things to try this week.`);
                    setActiveTab("coach");
                  }}
                  className="w-full min-h-[44px] py-2.5 font-bold text-xs rounded-xl transition flex items-center justify-center gap-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
                  style={{ background: "var(--arbor-green-soft)", color: "var(--arbor-green-ink)" }}
                >
                  <Sparkles className="w-3.5 h-3.5" aria-hidden /> {t("scholar.apply", { name: first })}
                </button>
                <button
                  onClick={() => {
                    setSelectedLens(sch.name);
                    // AI-input seed prompt — kept English on purpose (model replies in aiLang).
                    setChatInput(sch.examplePrompt);
                    setActiveTab("coach");
                  }}
                  className="w-full min-h-[44px] py-2 font-bold text-xs rounded-xl transition flex items-center justify-center gap-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
                  style={{ background: "var(--arbor-paper-deep)", color: "var(--arbor-muted)" }}
                >
                  {t("scholar.example")} <ExternalLink className="w-3.5 h-3.5" aria-hidden />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}

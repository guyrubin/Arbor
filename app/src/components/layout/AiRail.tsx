import React from "react";
import { Sparkles, Check, ChevronRight, ShieldCheck, Lock, ArrowRight } from "lucide-react";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";

/** Behind-the-answer trust panel. Reassures the parent about how Arbor reaches a
 *  suggestion without exposing model internals or jargon. */
const BEHIND = ["age", "safety", "memory", "step"] as const;

export default function AiRail() {
  const { setShowAiRail, setActiveTab } = useArbor();
  const { t } = useLanguage();

  return (
    <aside
      className="hidden xl:flex flex-col gap-5 p-5 h-screen sticky top-0 overflow-y-auto z-20 w-[340px] 2xl:w-[365px] bg-white"
      style={{ borderLeft: "1px solid var(--arbor-rule)" }}
    >
      <div className="flex items-center justify-between pb-4" style={{ borderBottom: "1px solid var(--arbor-rule)" }}>
        <div className="flex items-center gap-2.5">
          <span className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "var(--arbor-green-soft)", color: "var(--arbor-green-ink)" }}>
            <ShieldCheck className="w-[18px] h-[18px]" />
          </span>
          <div>
            <h3 className="font-extrabold text-sm" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}>{t("airail.title")}</h3>
            <p className="text-[11px]" style={{ color: "var(--arbor-muted)" }}>{t("airail.subtitle")}</p>
          </div>
        </div>
        {/* VIS-2: icon-only → min 44×44 hit area */}
        <button onClick={() => setShowAiRail(false)} title={t("aria.hidePanel")} aria-label={t("aria.hidePanel")} className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] rounded-lg transition" style={{ color: "var(--arbor-muted)" }}>
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      <ul className="space-y-2.5 flex-1">
        {BEHIND.map((b) => (
          <li key={b} className="flex items-start gap-3 rounded-2xl p-3.5" style={{ background: "var(--arbor-paper-deep)" }}>
            <span className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: "var(--arbor-clay)", color: "#fff" }}>
              <Check className="w-3.5 h-3.5" />
            </span>
            <span className="min-w-0">
              <span className="block text-[13px] font-bold" style={{ color: "var(--arbor-ink)" }}>{t("airail.b." + b + ".label")}</span>
              <span className="block text-[11.5px] leading-snug mt-0.5" style={{ color: "var(--arbor-muted)" }}>{t("airail.b." + b + ".note")}</span>
            </span>
          </li>
        ))}
      </ul>

      <div className="rounded-2xl p-4" style={{ background: "var(--arbor-green-soft)" }}>
        <div className="flex items-center gap-2">
          <Lock className="w-3.5 h-3.5" style={{ color: "var(--arbor-green-ink)" }} />
          <span className="text-[12px] font-extrabold" style={{ color: "var(--arbor-green-ink)" }}>{t("airail.privacy.title")}</span>
        </div>
        <p className="text-[11.5px] leading-relaxed mt-1.5" style={{ color: "#1f6f4b" }}>
          {t("airail.privacy.body")}
        </p>
        <button onClick={() => setActiveTab("memory")} className="inline-flex items-center gap-1 text-[12px] font-bold mt-2.5" style={{ color: "var(--arbor-green-ink)" }}>
          {t("airail.seeMemory")} <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      <button
        onClick={() => setActiveTab("coach")}
        className="w-full inline-flex items-center justify-center gap-2 text-white font-bold text-sm rounded-2xl py-3"
        style={{ background: "var(--arbor-gradient-primary)", boxShadow: "var(--arbor-clay-glow)" }}
      >
        <Sparkles className="w-4 h-4" /> {t("airail.askCta")}
      </button>
    </aside>
  );
}

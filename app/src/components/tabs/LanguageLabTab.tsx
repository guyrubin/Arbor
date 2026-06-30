import React from "react";
import { motion } from "motion/react";
import { Icon } from "../ui/Icon";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { PageHeader, SectionCard, cardCls, Chip, PastelKey } from "../ui/kit";
import LanguageLabVocabView from "./LanguageLabVocabView";

/**
 * Language Lab — multilingual development support, driven by the child's own
 * `languages` profile (not hard-coded). Home language = first listed, the
 * "second language" we help build = second listed, the rest are early exposure.
 */
export default function LanguageLabTab() {
  const { childProfile, setChatInput, setSelectedLens, setActiveTab } = useArbor();
  const { t } = useLanguage();
  const name = childProfile.name;
  const first = name.split(" ")[0];
  const langs = (childProfile.languages ?? []).map((l) => l.trim()).filter(Boolean);
  const home = langs[0];
  const second = langs[1];
  const others = langs.slice(2);
  const target = second || t("lang.theirSecondLang");

  const askCoach = (prompt: string) => {
    setSelectedLens("Lev Vygotsky");
    setChatInput(prompt);
    setActiveTab("coach");
  };

  const profileCards = [
    home && {
      label: t("lang.homeLabel"),
      value: home,
      note: t("lang.homeNote"),
      tag: t("lang.homeTag"),
      tone: "mint" as PastelKey,
    },
    second && {
      label: t("lang.secondLabel"),
      value: second,
      note: t("lang.secondNote"),
      tag: t("lang.secondTag"),
      tone: "yellow" as PastelKey,
    },
    ...others.map((o) => ({
      label: t("lang.otherLabel"),
      value: o,
      note: t("lang.otherNote"),
      tag: t("lang.otherTag"),
      tone: "sky" as PastelKey,
    })),
  ].filter(Boolean) as { label: string; value: string; note: string; tag: string; tone: PastelKey }[];

  const activities = [
    {
      title: t("lang.act.phrase.title"),
      time: "2 min",
      desc: t("lang.act.phrase.desc", { target, first }),
      example: t("lang.act.phrase.example"),
      lens: t("lang.act.phrase.lens"),
    },
    {
      title: t("lang.act.translate.title"),
      time: "5 min",
      desc: t("lang.act.translate.desc", { home: home || t("lang.theHomeLang"), first, target }),
      example: t("lang.act.translate.example"),
      lens: t("lang.act.translate.lens"),
    },
    {
      title: t("lang.act.story.title", { target }),
      time: "10 min",
      desc: t("lang.act.story.desc", { target }),
      example: t("lang.act.story.example"),
      lens: t("lang.act.story.lens"),
    },
    {
      title: t("lang.act.serve.title"),
      time: "Daily",
      desc: t("lang.act.serve.desc", { first, target }),
      example: t("lang.act.serve.example", { name: first }),
      lens: t("lang.act.serve.lens"),
    },
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6 max-w-[1180px]">
      <PageHeader
        eyebrow={t("lang.eyebrow")}
        title={t("lang.title")}
        subtitle={t("lang.subtitle", { first })}
        action={
          <button onClick={() => setActiveTab("speech")} className="inline-flex items-center gap-1.5 text-xs font-bold transition" style={{ color: "var(--arbor-green-ink)" }}>
            <Icon name="mic" size={14} /> {t("lang.soundPractice")}
          </button>
        }
      />

      {langs.length === 0 ? (
        <div className={`${cardCls} p-8 text-center space-y-3`}>
          <p className="text-sm" style={{ color: "var(--arbor-muted)" }}>
            {t("lang.noLangs", { first })}
          </p>
          <button
            onClick={() => setActiveTab("profile")}
            className="inline-flex items-center gap-2 font-bold text-xs px-4 py-2.5 rounded-xl transition"
            style={{ background: "var(--arbor-green-soft)", color: "var(--arbor-green-ink)" }}
          >
            {t("lang.editProfile", { first })}
          </button>
        </div>
      ) : (
        <>
          {/* AP-054 — Language Lab vocab view (combined-total-first, read-only over langObs) */}
          <LanguageLabVocabView />

          {/* Language profile */}
          <SectionCard title={t("lang.profileTitle", { first, age: childProfile.age })} icon={<Icon name="translate" size={20} />} tone="sky">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              {profileCards.map((c, i) => (
                <div key={i} className={`${cardCls} p-4 space-y-2`}>
                  <span className="text-[10px] uppercase font-bold tracking-wide block" style={{ color: "var(--arbor-muted)" }}>{c.label}</span>
                  <b className="block text-sm" style={{ color: "var(--arbor-ink)" }}>{c.value}</b>
                  <p className="leading-relaxed" style={{ color: "var(--arbor-muted)" }}>{c.note}</p>
                  <Chip tone={c.tone}>{c.tag}</Chip>
                </div>
              ))}
            </div>
            {!second && (
              <p className="text-[11px] italic mt-4" style={{ color: "var(--arbor-muted)" }}>
                {t("lang.onlyOne", { first })}
              </p>
            )}
          </SectionCard>

          {/* Daily practice */}
          <SectionCard
            title={t("lang.routinesTitle", { target })}
            icon={<Icon name="auto_awesome" size={20} />}
            tone="mint"
            action={
              <button
                onClick={() =>
                  askCoach(
                    `Give me a gentle one-week plan to build ${name}'s (age ${childProfile.age}) confidence in ${target}, with ${home || "the home language"} as the home language. Keep it low-pressure, play-based, and non-diagnostic — a few minutes a day.`
                  )
                }
                className="inline-flex items-center justify-center gap-2 font-bold text-xs px-4 py-2.5 rounded-xl transition"
                style={{ background: "var(--arbor-green-soft)", color: "var(--arbor-green-ink)" }}
              >
                <Icon name="auto_awesome" size={14} /> {t("lang.weekPlanCta")}
              </button>
            }
          >
            <p className="text-[11px] font-bold uppercase tracking-wider mb-4" style={{ color: "var(--arbor-green-ink)" }}>{t("lang.dailyPractice")}</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              {activities.map((item) => (
                <div key={item.title} className={`${cardCls} p-4 space-y-2`}>
                  <div className="flex items-center justify-between">
                    <b style={{ color: "var(--arbor-ink)" }}>{item.title}</b>
                    <Chip tone="yellow">{item.time}</Chip>
                  </div>
                  <p className="leading-relaxed" style={{ color: "var(--arbor-muted)" }}>{item.desc}</p>
                  <p className="italic rounded-xl p-2 text-[11px]" style={{ background: "var(--arbor-paper-deep)", color: "var(--arbor-ink)" }}>
                    {item.example}
                  </p>
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: "var(--arbor-green-ink)" }}>{item.lens}</span>
                    <button
                      onClick={() =>
                        askCoach(
                          `Help me run the "${item.title}" ${target} activity with ${name} (age ${childProfile.age}) today. Give me a 3-step script and one way to make it easier if they resist.`
                        )
                      }
                      className="inline-flex items-center gap-1 text-[10px] font-bold transition"
                      style={{ color: "var(--arbor-muted)" }}
                    >
                      <Icon name="chat" size={12} /> {t("lang.coachMe")}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>
        </>
      )}
    </motion.div>
  );
}

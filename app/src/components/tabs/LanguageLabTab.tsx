import React, { useMemo } from "react";
import { motion } from "motion/react";
import { Icon } from "../ui/Icon";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { useChildCollection } from "../../hooks/useChildCollection";
import { PageHeader, SectionCard, cardCls, Chip } from "../ui/kit";
import { ageLabel } from "../../lib/childAge";
import { aggregateLangCounts, type LangObservation } from "../../growth/vocabAgg";
import LanguageLabVocabView from "./LanguageLabVocabView";

/**
 * Language Lab — multilingual development support, driven by the child's own
 * `languages` profile (not hard-coded). Home language = first listed, the
 * "second language" we help build = second listed, the rest are also heard.
 *
 * CLINICAL FIREWALL (GP-02): each language is a ROLE in the home plus a COUNT
 * of the moments the parent logged for it — never a proficiency grade. The
 * old cards graded the child's languages by LIST ORDER ("Native" / "Emerging"
 * / "Exposure" in mint / yellow / sky, "Developing — …") with no observation
 * behind them; that is the verdict class Law 2 bans. One neutral tone, no
 * status chip.
 */
export default function LanguageLabTab() {
  const { childProfile, setActiveTab, seedCoach } = useArbor();
  const { t } = useLanguage();
  const name = childProfile.name;
  const first = name.split(" ")[0];
  const langs = (childProfile.languages ?? []).map((l) => l.trim()).filter(Boolean);
  const home = langs[0];
  const second = langs[1];
  const others = langs.slice(2);
  const target = second || t("lang.theirSecondLang");
  // GP-01: the months-precise age label — the ONE parent-facing age render.
  const age = ageLabel(childProfile, t);

  // Read-only over the SAME parent-logged phrase observations the vocabulary
  // log below writes ("langObs") — a count per language, nothing derived.
  const obsCol = useChildCollection<LangObservation>(childProfile.id, "langObs", { orderByField: "timestamp", orderDir: "desc" });
  const countByLang = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of aggregateLangCounts(obsCol.items)) map.set(c.language.toLowerCase(), c.count);
    return map;
  }, [obsCol.items]);
  const countLine = (lang: string): string => {
    const n = countByLang.get(lang.toLowerCase()) ?? 0;
    if (n === 0) return t("elev.growthTruth.lang.count.none");
    return n === 1 ? t("elev.growthTruth.lang.count.one") : t("elev.growthTruth.lang.count.many", { n });
  };

  const askCoach = (prompt: string) => {
    seedCoach({ prompt, lens: "Lev Vygotsky", source: "language-lab" });
  };

  // Roles in the home — plain rows, one tone, counts only.
  const languageRows = [
    home && { role: t("elev.growthTruth.lang.role.home"), value: home, note: t("elev.growthTruth.lang.role.note.home", { first }) },
    second && { role: t("elev.growthTruth.lang.role.second"), value: second, note: t("elev.growthTruth.lang.role.note.second") },
    ...others.map((o) => ({ role: t("elev.growthTruth.lang.role.also"), value: o, note: t("elev.growthTruth.lang.role.note.also") })),
  ].filter(Boolean) as { role: string; value: string; note: string }[];

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
    <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mx-auto w-full min-w-0 max-w-[1180px] space-y-5 sm:space-y-6">
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
          {/* Daily practice — the hero: real, usable value every day */}
          <SectionCard
            title={t("lang.routinesTitle", { target })}
            icon={<Icon name="auto_awesome" size={20} />}
            tone="mint"
            action={
              <button
                onClick={() =>
                  // AIX-S4: seed via i18n — HE parents see a Hebrew prompt in the chat box.
                  askCoach(t("seed.langWeekPlan", { name, age, target, home: home || t("lang.theHomeLang") }))
                }
                className="inline-flex items-center justify-center gap-2 font-bold text-xs px-4 py-2.5 rounded-xl transition"
                style={{ background: "var(--arbor-green-soft)", color: "var(--arbor-green-ink)" }}
              >
                <Icon name="auto_awesome" size={14} /> {t("lang.weekPlanCta")}
              </button>
            }
          >
            <p className="text-[11px] font-bold uppercase tracking-wider mb-4" style={{ color: "var(--arbor-green-ink)" }}>{t("lang.dailyPractice")}</p>
            <div className="grid min-w-0 grid-cols-1 gap-3 text-xs xl:grid-cols-2 xl:gap-4">
              {activities.map((item) => (
                <div key={item.title} className={`${cardCls} min-w-0 space-y-2 p-4`}>
                  <div className="flex min-w-0 items-start justify-between gap-3">
                    <b className="min-w-0 break-words leading-snug" style={{ color: "var(--arbor-ink)" }}>{item.title}</b>
                    <Chip tone="yellow">{item.time}</Chip>
                  </div>
                  <p className="leading-relaxed" style={{ color: "var(--arbor-muted)" }}>{item.desc}</p>
                  <p className="italic rounded-xl p-2 text-[11px]" style={{ background: "var(--arbor-paper-deep)", color: "var(--arbor-ink)" }}>
                    {item.example}
                  </p>
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                    <span className="break-words text-[10px] font-bold uppercase tracking-wide" style={{ color: "var(--arbor-green-ink)" }}>{item.lens}</span>
                    <button
                      onClick={() =>
                        askCoach(t("seed.langActivity", { title: item.title, target, name, age }))
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

          {/* Language profile — roles in the home + moments logged. One tone,
              no status chip, nothing graded (GP-02). */}
          <SectionCard title={t("lang.profileTitle", { first, age })} icon={<Icon name="translate" size={20} />} tone="sky">
            <ul className="divide-y" style={{ borderColor: "var(--arbor-rule)" }} data-testid="lang-role-rows">
              {languageRows.map((row) => (
                <li key={`${row.role}-${row.value}`} className="flex min-w-0 flex-wrap items-start justify-between gap-x-4 gap-y-1 py-3 first:pt-0 last:pb-0">
                  <div className="min-w-0 flex-1">
                    <span className="text-[10px] uppercase font-bold tracking-wide block" style={{ color: "var(--arbor-muted)" }}>{row.role}</span>
                    <b className="block break-words text-sm" dir="auto" style={{ color: "var(--arbor-ink)" }}>{row.value}</b>
                    <p className="text-xs leading-relaxed mt-0.5" style={{ color: "var(--arbor-muted)" }}>{row.note}</p>
                  </div>
                  <span className="text-xs font-bold whitespace-nowrap tabular-nums" style={{ color: "var(--arbor-muted)" }}>{countLine(row.value)}</span>
                </li>
              ))}
            </ul>
            {!second && (
              <p className="text-[11px] italic mt-4" style={{ color: "var(--arbor-muted)" }}>
                {t("lang.onlyOne", { first })}
              </p>
            )}
          </SectionCard>

          {/* AP-054 — Vocabulary log, now SECONDARY & optional. It sits below the
              daily practice and profile so an empty counter is never the hero;
              logging still works exactly as before. */}
          <LanguageLabVocabView />
        </>
      )}
    </motion.div>
  );
}

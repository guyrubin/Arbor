import React, { useMemo, useState } from "react";
import { motion } from "motion/react";
import { Icon } from "../ui/Icon";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { useChildCollection } from "../../hooks/useChildCollection";
import { PageHeader, SectionCard, cardCls, Chip } from "../ui/kit";
import { ageLabel } from "../../lib/childAge";
import { aggregateLangCounts, type LangObservation } from "../../growth/vocabAgg";
import LanguageLabVocabView, { PhraseLogForm, WordsList } from "./LanguageLabVocabView";
import { languageName } from "../../lib/languageName";
import { ageMonthsOf, isUnderThree } from "../../lib/age/forChild";
import { genderedKey } from "../../lib/today/fromRecord";
import { actNowKey, sayBackFor } from "../../lib/language/sayBack";
import { SaidCapture, SaidList, SayBackBlock } from "../growth/ThingsSaid";
import SaidPage from "../growth/SaidPage";
import { goToRoute, useHashQuery } from "../../hooks/useHashQuery";

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
  // Law 8 (W2-GROWTH r1): stored names stay as written; what a parent READS
  // is the reader's language ("Hebrew" → "עברית").
  const ln = (l: string) => languageName(l, t);
  const target = second ? ln(second) : t("lang.theirSecondLang");
  // GP-01: the months-precise age label — the ONE parent-facing age render.
  const age = ageLabel(childProfile, t);
  // B-GROWTH-36: age decides the object — words under 3 (the ledger below),
  // "Things {name} said" from 3 (a quote keepsake). After a keep, the
  // say-back (deterministic templates) is the largest text on the page.
  const gender = childProfile.gender;
  const gk = (k: string) => genderedKey(k, gender);
  const months = ageMonthsOf(childProfile);
  const underThree = isUnderThree(childProfile);
  const [kept, setKept] = useState<{ text: string; language: string | null } | null>(null);
  const sayBack = kept ? sayBackFor({ text: kept.text, language: kept.language, languages: langs, months }) : null;
  // B-GROWTH-37: #/language?view=said is the month page (a mode of this
  // route; lib/routes.ts holds no sub-routes — REJECTIONS P2-WORDS).
  const view = useHashQuery().get("view");

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
      time: t("elev.growth.lang.duration.minutes", { n: 2 }),
      desc: t("lang.act.phrase.desc", { target, first }),
      example: t("lang.act.phrase.example"),
    },
    {
      title: t("lang.act.translate.title"),
      time: t("elev.growth.lang.duration.minutes", { n: 5 }),
      desc: t("lang.act.translate.desc", { home: home ? ln(home) : t("lang.theHomeLang"), first, target }),
      example: t("lang.act.translate.example"),
    },
    {
      title: t("lang.act.story.title", { target }),
      time: t("elev.growth.lang.duration.minutes", { n: 10 }),
      desc: t("lang.act.story.desc", { target }),
      example: t("lang.act.story.example"),
    },
    {
      title: t("lang.act.serve.title"),
      time: t("elev.growth.lang.duration.daily"),
      desc: t("lang.act.serve.desc", { first, target }),
      example: t("lang.act.serve.example", { name: first }),
    },
  ];

  if (view === "said") return <SaidPage />;

  return (
    <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mx-auto w-full min-w-0 max-w-[1180px] space-y-5 sm:space-y-6">
      <PageHeader
        eyebrow={t("lang.eyebrow")}
        title={underThree ? t("lang.title") : t(gk("elev.words.said.title"), { name: first })}
        subtitle={t("lang.subtitle", { first })}
        action={
          <button onClick={() => setActiveTab("speech")} className="touch-target gap-1.5 px-2 text-xs font-bold transition" style={{ color: "var(--arbor-green-ink)" }}>
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
            className="inline-flex min-h-11 items-center gap-2 font-bold text-xs px-4 py-2.5 rounded-xl transition"
            style={{ background: "var(--arbor-green-soft)", color: "var(--arbor-green-ink)" }}
          >
            {t("lang.editProfile", { first })}
          </button>
        </div>
      ) : (
        <>
          {/* The primary move, under the header. Nothing above it but the page
              title, so a parent who opened this hub to log a phrase can. */}
          {/* Item 11 (IA-02): the surface contract reaches the DOM. `data-module`
          marks a top-level sibling module (what moduleBudget counts);
          `data-primary-move` marks the ONE control that performs the move
          surfaceContract.ts declares for this route. */}
          <div data-module="language-capture" data-primary-move="log-language-moment" className="space-y-4">
            {underThree ? (
              <PhraseLogForm childId={childProfile.id} languages={langs} onAdded={(obs) => setKept(obs ? { text: obs.phrase, language: obs.language } : null)} t={t} />
            ) : (
              <SaidCapture childId={childProfile.id} languages={langs} first={first} gender={gender} onKept={setKept} />
            )}
            {sayBack && <SayBackBlock back={sayBack} first={first} gender={gender} />}
          </div>

          {/* B-GROWTH-16 — the words written down are the second module (the
              parent's own record, under the form that writes it); the practice
              ideas moved into the disclosure below. */}
          <div data-module="language-words">
            {underThree ? <WordsList /> : <SaidList childId={childProfile.id} first={first} gender={gender} />}
            <button
              type="button"
              data-testid="said-page-door"
              onClick={() => goToRoute("language", { view: "said" })}
              className="mt-2 inline-flex min-h-[44px] items-center text-[14px] underline underline-offset-4"
              style={{ color: "var(--arbor-ink-soft)" }}
            >
              {t(underThree ? "elev.words.page.posterDoor" : "elev.words.page.door")}
            </button>
          </div>

          {/* Language profile — roles in the home + moments logged. One tone,
              no status chip, nothing graded (GP-02). */}
          <div data-module="language-profile">
          <SectionCard title={t("lang.profileTitle", { first, age })} icon={<Icon name="translate" size={20} />} tone="sky">
            <ul className="divide-y" style={{ borderColor: "var(--arbor-rule)" }} data-testid="lang-role-rows">
              {languageRows.map((row) => (
                <li key={`${row.role}-${row.value}`} className="flex min-w-0 flex-wrap items-start justify-between gap-x-4 gap-y-1 py-3 first:pt-0 last:pb-0">
                  <div className="min-w-0 flex-1">
                    <span className="text-[10px] uppercase font-bold tracking-wide block" style={{ color: "var(--arbor-muted)" }}>{row.role}</span>
                    <b className="block break-words text-sm" dir="auto" style={{ color: "var(--arbor-ink)" }}>{ln(row.value)}</b>
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
          </div>

          {/* R25 (item 11) — #/language rendered 4 top-level modules against a declared
          moduleBudget of 3. The tail below is DEMOTED, never removed: one
          collapsed disclosure on the pattern components/practice/SpeechCoachTab.tsx
          `speech-more` already ships, so every capability keeps its door (law 6)
          while the fold belongs to the primary move. Demoted modules keep their
          own `data-module` stamp and add `data-module-demoted`, which is what
          makes the budget rule countable: top-level = stamps minus demoted. */}
          <details data-module-disclosure="language-more" className={`${cardCls} p-0 overflow-hidden`}>
            <summary className="cursor-pointer list-none px-6 py-4 min-h-[44px] flex items-center gap-3">
              <span className="grid place-items-center w-9 h-9 rounded-2xl flex-shrink-0" style={{ background: "var(--arbor-sky-soft)", color: "var(--arbor-sky-ink)" }}>
                <Icon name="translate" size={18} />
              </span>
              <span className="min-w-0">
                <span className="block text-[15px] font-extrabold" style={{ color: "var(--arbor-ink)" }}>{t("elev.words.more.title")}</span>
                <span className="block text-[12px]" style={{ color: "var(--arbor-muted)" }}>{t("elev.words.more.sub")}</span>
              </span>
              <Icon name="expand_more" size={20} className="ms-auto" style={{ color: "var(--arbor-muted)" }} />
            </summary>
            <div className="px-4 pb-4 space-y-4">
          {/* B-GROWTH-36: the "Act now if…" line for the child's age — a DRAFT
              pending the clinical review line (REVIEW-SHEET.md, P2 WORDS). */}
          <p data-testid="lang-act-now" data-review="draft" className="text-[13px] leading-relaxed" style={{ color: "var(--arbor-ink-soft)" }}>
            <span className="block text-[12px]" style={{ color: "var(--arbor-muted)" }}>{t("elev.words.actNow.label")}</span>
            {t(gk(actNowKey(months)), { name: first })}
          </p>
          {/* B-GROWTH-16: daily practice ideas — demoted into the disclosure. */}
          <div data-module="language-practice" data-module-demoted style={{ display: "contents" }}>
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
                className="inline-flex min-h-11 items-center justify-center gap-2 font-bold text-xs px-4 py-2.5 rounded-xl transition"
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
                  <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
                    <button
                      onClick={() =>
                        askCoach(t("seed.langActivity", { title: item.title, target, name, age }))
                      }
                      // Item 9: "Coach me" rendered 58×13 px × 4 cards. Type and
                      // glyph unchanged; the hit box grows to --touch-min.
                      className="touch-target gap-1 px-2 text-[10px] font-bold transition"
                      style={{ color: "var(--arbor-muted)" }}
                    >
                      <Icon name="chat" size={12} /> {t("lang.coachMe")}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>
          </div>

          {/* AP-054 — Vocabulary log, now SECONDARY & optional. It sits below the
              daily practice and profile so an empty counter is never the hero;
              logging still works exactly as before. */}
          <div data-module="language-vocab" data-module-demoted style={{ display: "contents" }}><LanguageLabVocabView /></div>
            </div>
          </details>
        </>
      )}
    </motion.div>
  );
}

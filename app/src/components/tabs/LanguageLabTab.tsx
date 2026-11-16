import React, { useMemo, useState } from "react";
import { motion } from "motion/react";
import { Icon } from "../ui/Icon";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { useChildCollection } from "../../hooks/useChildCollection";
import { SectionCard, cardCls, Chip } from "../ui/kit";
import KindSwitch from "../moments/v10/KindSwitch";
import { Draw, FrameFigure, FrameHead, IndexRow, RailTile, ReadGuide, RowLink, StageCard, type IndexItem } from "../moments/v10/frame";
import { STAGE_ORBS } from "../moments/v10/stageOrbs";
import { MOMENTS_V10_COPY } from "../moments/momentsV10Copy";
import { DsRoot, Guide, Route, RouteSection, Scene } from "../../design/primitives";
import { useComposition } from "../../design/useComposition";
import "../moments/mychild.css";
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
  const { t, uiLang } = useLanguage();
  const composition = useComposition();
  const desk = composition === "desk";
  const v = MOMENTS_V10_COPY[uiLang === "he" ? "he" : "en"];
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
  // route); #/language/said resolves to the same query (lib/routes.ts SUB_ROUTES).
  const hashQuery = useHashQuery();
  const view = hashQuery.get("view");
  // v10.3: the language index (`?lang=`) narrows the kept sayings to one language.
  const langFilter = langs.find((l) => l.toLowerCase() === (hashQuery.get("lang") ?? "").toLowerCase()) ?? null;

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

  // v10.3 (the My child frame): #/language is Moments with the kind Things
  // <name> said selected — the band (kinds switch, the month's page, one
  // figure), the language index, the stage (capture and what you kept) and
  // the rail (how to read, the language profile, practice ideas).
  const title = underThree ? t("lang.title") : t(gk("elev.words.said.title"), { name: first });
  const totalLogged = [...countByLang.values()].reduce((sum, n) => sum + n, 0);
  const langIndex: IndexItem[] = !underThree && langs.length > 1 ? [
    { id: "all", icon: "grid_view", name: t("companion.moments.kind.all"), meta: v.said.allMeta, on: !langFilter, onOpen: () => goToRoute("language", {}) },
    ...languageRows.map((row) => ({
      id: row.value, icon: "translate", name: ln(row.value), meta: v.said.langMeta(row.role),
      figure: countByLang.get(row.value.toLowerCase()) || undefined, on: langFilter?.toLowerCase() === row.value.toLowerCase(),
      onOpen: () => goToRoute("language", { lang: row.value }),
    })),
  ] : [];
  const monthPage = (
    <button type="button" data-testid="said-page-door" onClick={() => goToRoute("language", { view: "said" })} className="btn sm ghost nowrap card-btn min-h-11">
      <Icon name="ios_share" size={16} />{t(underThree ? "elev.words.page.posterDoor" : "elev.words.page.door")}
    </button>
  );
  const band = (
    <Scene field="now" className="mband" orbs={STAGE_ORBS[composition]}>
      <div className="mstack mtools">
        <FrameHead phone={!desk} kicker={v.said.kicker(first)} startHere={v.startHere} title={title} sub={t("lang.subtitle", { first })}
          switcher={<KindSwitch kind="said" />} action={desk ? monthPage : undefined}
          figure={totalLogged > 0 ? <FrameFigure n={totalLogged} unit={v.said.figureUnit(totalLogged)} /> : undefined} />
        {/* Phone: the index follows the capture (inside the stage), so the
            primary move stays above the dock; desk keeps it in the band. */}
        {desk && langIndex.length > 0 && <IndexRow phone={false} label={v.said.guideLangs} items={langIndex} />}
      </div>
      {desk && langIndex.length > 0 && <div className="mcap"><span>{v.said.cap}</span></div>}
    </Scene>
  );
  const stage = (
    <StageCard icon="format_quote" title={v.said.stage} className="said-stage">
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
      {/* B-GROWTH-16 — the words written down, under the form that writes them. */}
      <div data-module="language-words">
        {!desk && langIndex.length > 0 && <IndexRow phone label={v.said.guideLangs} items={langIndex} />}
        {underThree ? <WordsList /> : <SaidList childId={childProfile.id} first={first} gender={gender} language={langFilter} rows />}
        {!desk && <div className="mt-2">{monthPage}</div>}
      </div>
    </StageCard>
  );
  const readGuide = (
    <RailTile icon="grid_view" title={v.howToRead} className="mguide">
      <ReadGuide phone={!desk}
        steps={[
          { drawing: Draw.pick(3), label: v.said.steps.pick },
          { drawing: Draw.list(), label: v.said.steps.read },
          { drawing: Draw.cards(), label: v.said.steps.practise },
        ]}
        keyItems={[
          { mark: <i className="tg-said" aria-hidden="true"><Icon name="format_quote" size={12} /></i>, label: v.said.keySaying },
          { mark: <i className="tg-said" aria-hidden="true">Aa</i>, label: v.said.keyWord },
        ]} />
    </RailTile>
  );
  const profile = (
    /* Language profile — roles in the home + moments logged. One tone, no
       status chip, nothing graded (GP-02). */
    <div data-module="language-profile">
      <RailTile icon="translate" title={t("lang.profileTitle", { first, age })} className="said-profile">
        <ul className="lang-roles" data-testid="lang-role-rows">
          {languageRows.map((row) => (
            <li key={`${row.role}-${row.value}`}>
              <span className="lr-role">{row.role}</span>
              <b className="lr-name" dir="auto">{ln(row.value)}</b>
              <p className="lr-note">{row.note}</p>
              <span className="lr-count">{countLine(row.value)}</span>
            </li>
          ))}
        </ul>
        {!second && <p className="line1">{t("lang.onlyOne", { first })}</p>}
      </RailTile>
    </div>
  );
  const more = (
    /* R25 (item 11): the tail is DEMOTED, never removed — one collapsed
       disclosure; demoted modules keep their stamp and add data-module-demoted. */
    <section className="vt said-more">
      <details data-module-disclosure="language-more">
        <summary className="said-more-sum">
          <span className="gi" aria-hidden="true"><Icon name="translate" size={16} /></span>
          <span className="min-w-0">
            <b>{t("elev.words.more.title")}</b>
            <small>{t("elev.words.more.sub")}</small>
          </span>
          <Icon name="expand_more" size={20} className="ms-auto" />
        </summary>
        <div className="space-y-4 pt-2">
          {/* B-GROWTH-36: the "Act now if…" line for the child's age — a DRAFT
              pending the clinical review line (REVIEW-SHEET.md, P2 WORDS). */}
          <p data-testid="lang-act-now" data-review="draft" className="text-[13px] leading-relaxed" style={{ color: "var(--arbor-ink-soft)" }}>
            <span className="block text-[12px]" style={{ color: "var(--arbor-muted)" }}>{t("elev.words.actNow.label")}</span>
            {t(gk(actNowKey(months)), { name: first })}
          </p>
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
              <div className="grid min-w-0 grid-cols-1 gap-3 text-xs">
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
                        onClick={() => askCoach(t("seed.langActivity", { title: item.title, target, name, age }))}
                        // Item 9: the hit box grows to --touch-min.
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
          {/* AP-054 — Vocabulary log, SECONDARY & optional. */}
          <div data-module="language-vocab" data-module-demoted style={{ display: "contents" }}><LanguageLabVocabView /></div>
        </div>
      </details>
      <RowLink icon="mic" label={t("lang.soundPractice")} onOpen={() => setActiveTab("speech")} />
    </section>
  );

  // No exit of its own: the shell's tab wrapper fades the page out. An inner
  // exit mounted mid-exit (leaving `?view=said` swaps SaidPage for this
  // element while the shell's wait-mode exit runs) never completes, and the
  // next tab never mounts.
  return (
    <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="w-full min-w-0">
      <DsRoot composition={composition} className="ds-mychild said-v10" dir={uiLang === "he" ? "rtl" : "ltr"} data-testid="said-v10">
        <Guide mini={!desk} label={v.onThisPage} stops={[
          { id: "s-langs", title: v.said.guideLangs, sub: v.said.guideLangsSub },
          { id: "s-kept", title: v.said.guideKept, sub: v.said.guideKeptSub },
        ]} />
        <Route composition={composition}>
          <RouteSection id="s-langs" n={1} on>{band}</RouteSection>
          <RouteSection id="s-kept" n={2}>
            {langs.length === 0 ? (
              <section className="vt said-nolangs">
                <p className="line1">{t("lang.noLangs", { first })}</p>
                <button type="button" onClick={() => setActiveTab("profile")} className="btn sm tint-btn nowrap min-h-11">{t("lang.editProfile", { first })}</button>
                <RowLink icon="mic" label={t("lang.soundPractice")} onOpen={() => setActiveTab("speech")} />
              </section>
            ) : desk ? (
              <div className="rowa">
                <div className="stg">{stage}</div>
                <aside className="rlc">{readGuide}{profile}{more}</aside>
              </div>
            ) : (
              <div className="mstack" style={{ gap: 14 }}>{stage}{readGuide}{profile}{more}</div>
            )}
          </RouteSection>
        </Route>
      </DsRoot>
    </motion.div>
  );
}

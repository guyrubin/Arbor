/**
 * AP-057 — Bedtime Stories Tab.
 *
 * A parent-accessible library of AI-generated nightly stories rooted in the
 * child's logged day, starring the child's hero avatar, with HE/EN read-aloud.
 *
 * DISTINCT from Hero Journeys (`stories` route):
 *   - Day-rooted: story seeds come from today's behavior logs / day events.
 *   - Parent-mediated: read aloud by the parent at bedtime (not an interactive comic).
 *   - Generate-and-discard: no story library is persisted (GDPR clearance: no new
 *     child-data store, so no new GDPR erase/export wiring is needed).
 *
 * BINDING SAFETY CONDITIONS (AP-057, all enforced SERVER-SIDE):
 *   1. Escalation screen on day-event input before any generation (server returns 409).
 *   2. Redaction at generation seam (server: createRedaction → model → restoreDeep).
 *   3. Generate-and-discard: no story is persisted here or server-side.
 *   4. ai_training default-OFF: nothing written to a training pipeline.
 *   5. Non-pathologizing prompt framing (enforced in lib/bedtimeStories.ts).
 *   6. No new ConsentPurpose; avatar reuse (no new face capture).
 *
 * UI: var(--arbor-*) tokens only. HE/EN + RTL. Touch targets >= 44px.
 */

import React, { useState } from "react";
import { useAsyncAction } from "../../hooks/useAsyncAction";
import { PaywallError } from "../../lib/api";
import { motion, AnimatePresence } from "motion/react";
import { Icon } from "../ui/Icon";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { useToast } from "../../context/ToastContext";
import { api, EscalationRequiredError } from "../../lib/api";
import { isolate } from "../../lib/i18n";
import { bedtimePrefill } from "../../lib/bedtimeStories";
import type { BedtimeStory } from "../../types";
import { cardCls } from "../ui/kit";
import { ShareButton } from "../ui/ShareButton";
import { SpeakButton } from "../ui/SpeakButton";
import type { ShareCardOpts } from "../../lib/shareCard";

// ── Day event input ────────────────────────────────────────────────────────────

interface LocalDayEvent {
  id: string;
  description: string;
}

const emptyEvent = (): LocalDayEvent => ({
  id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  description: "",
});

// ── Component ─────────────────────────────────────────────────────────────────

/**
 * B-PLAY-14 — the ONE bedtime body, shared by both routes: #/bedtime-stories
 * renders it as the page, and the Stories Tonight cover renders it inline
 * ("From today", components/stories/TonightFromToday). `embedded` drops the
 * page header and the route's surface stamps (the Stories cover is already the
 * module and carries its own primary move); everything else — prefill,
 * escalation wall, generate-and-discard, the reader — is the same code.
 */
export default function BedtimeStoriesTab() {
  return <BedtimeStoryBody />;
}

export function BedtimeStoryBody({ embedded = false }: { embedded?: boolean }) {
  const { childProfile, behaviorLogs, addMoment, openPaywall } = useArbor();
  const { aiLang, uiLang, t } = useLanguage();
  const { toast } = useToast();
  // B-PLAY-13: the page's chrome follows the UI language; only the story
  // request (and its read-aloud) keeps aiLang.
  const he = uiLang === "he";

  // Pre-seed from today's record so parents aren't staring at a blank form.
  // B-PLAY-13: the parent's LOCAL day (never the UTC slice), moments as their
  // own words, at most one incident by its localized label. Editable before
  // generating.
  const todayLogs = bedtimePrefill(behaviorLogs, new Date(), t).map(
    (p): LocalDayEvent => ({ id: `log-${p.id}`, description: p.description }),
  );

  const [events, setEvents] = useState<LocalDayEvent[]>(
    todayLogs.length > 0 ? todayLogs : [emptyEvent()]
  );
  const [story, setStory] = useState<BedtimeStory | null>(null);
  const [escalated, setEscalated] = useState(false);
  // B-PLAY-14: what the child answered to each goodnight question, and which
  // answers the parent has already kept (one moment each, never twice).
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [kept, setKept] = useState<Record<number, boolean>>({});
  const [pageIndex, setPageIndex] = useState(0);

  // Avatar description from the child's existing generated avatar — reuse, no new capture.
  const avatarStyle =
    typeof (childProfile as unknown as Record<string, unknown>).avatar === "object"
      ? ((childProfile as unknown as Record<string, unknown>).avatar as Record<string, string> | null)?.style ?? undefined
      : undefined;

  const addEvent = () => setEvents((es) => [...es, emptyEvent()]);
  const removeEvent = (id: string) => setEvents((es) => es.filter((e) => e.id !== id));
  const updateEvent = (id: string, description: string) =>
    setEvents((es) => es.map((e) => (e.id === id ? { ...e, description } : e)));

  const validEvents = events.filter((e) => e.description.trim().length > 0);

  // B-PLAY-14: a failed generation is said INLINE with a Retry (useAsyncAction),
  // not as a lone toast that disappears with the reason. The escalation 409 is
  // not a failure — it opens the calm wall, exactly as before; a 402 is the
  // paywall.
  const generation = useAsyncAction(
    "bedtime_generate",
    async () => {
      try {
        return await api.generateBedtimeStory({
        childName: childProfile.name,
        age: childProfile.age,
        dayEvents: validEvents.map((e) => ({ description: e.description })),
        avatarDescription: avatarStyle ? `Avatar style: ${avatarStyle}` : undefined,
        language: aiLang,
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        // The server returns 409 + escalationCategory when a safety trigger fires.
        // Show a calm, non-diagnostic prompt to reach professional support.
        if (
          // DUX-032: typed escalation error thrown by the api layer on HTTP 409.
          err instanceof EscalationRequiredError ||
          // DEPRECATED fallback — legacy substring matching, kept so the escalation
          // UI can never fire less often than before the typed error existed.
          message.includes("Professional support recommended") ||
          message.includes("409")
        ) {
          setEscalated(true);
          return null;
        }
        throw err;
      }
    },
    {
      fallbackError: t("elev.bedtime.generate.failed"),
      toMessage: () => t("elev.bedtime.generate.failed"),
      onPaywall: (err: PaywallError) => openPaywall(err.feature, err.plan),
    },
  );
  const loading = generation.loading;

  const generate = async () => {
    if (validEvents.length === 0) {
      toast(he ? "הוסיפו לפחות אירוע אחד מהיום" : "Add at least one event from today", "error");
      return;
    }
    setEscalated(false);
    setStory(null);
    setPageIndex(0);
    setAnswers({});
    setKept({});
    generation.clearError();
    const result = await generation.run();
    if (result) setStory(result);
  };

  /** B-PLAY-14: keep what the child said to one goodnight question — ONE
   *  parent-provenance moment through the addMoment seam (no new store). */
  const keepAnswer = (i: number, question: string) => {
    const answer = (answers[i] ?? "").trim();
    if (!answer || kept[i]) return;
    const written = addMoment(t("elev.bedtime.keep.line", { question, name, answer }));
    if (written) {
      setKept((k) => ({ ...k, [i]: true }));
      toast(t("elev.bedtime.goodnight.saved"), "success");
    }
  };

  const reset = () => {
    setStory(null);
    setEscalated(false);
    setPageIndex(0);
  };

  /**
   * KID-10: "Good night" used to be a bare reset — the one surface whose whole
   * point is a shared ritual left no trace of the ritual, and the surface
   * contract said so (`threadWrite: "none"`). It now writes ONE parent-
   * provenance moment through the existing `addMoment` seam (ArborContext),
   * the same seam Today's quick capture uses, so the row lands in
   * `behaviorLogs` and the timeline ingests it with no new store and no new
   * GDPR surface. Generate-and-discard is untouched: the STORY is still not
   * persisted — only the parent's own line that they read one tonight.
   */
  const goodNight = () => {
    const title = story?.title?.trim();
    const line = title
      ? t("elev.bedtime.goodnight.moment.titled").replace("{title}", title)
      : t("elev.bedtime.goodnight.moment");
    const written = addMoment(line);
    if (written) toast(t("elev.bedtime.goodnight.saved"), "success");
    reset();
  };

  // E8/F-10: display copy below bidi-isolates each interpolation of the name
  // so a Hebrew name can't reorder the English copy (e.g. the possessive in
  // `${name}'s bedtime story`). The API call above sends the raw name.
  const name = childProfile.name?.split(" ")[0] || (he ? "הילד" : "your child");

  // ── Escalation wall (non-diagnostic) ──────────────────────────────────────
  if (escalated) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className={`${cardCls} p-6 space-y-4`}
        data-testid="bedtime-escalation"
      >
        <div
          className="inline-flex items-center justify-center rounded-2xl w-11 h-11"
          style={{ background: "var(--arbor-peach-soft)", color: "var(--arbor-peach-ink)" }}
        >
          <Icon name="warning" size={20} />
        </div>
        <h2
          className="text-[16px] font-extrabold"
          style={{ color: "var(--arbor-ink)", fontFamily: "var(--font-display)" }}
          dir="auto"
        >
          {he ? "הגיע הזמן לדבר עם מישהו" : "It may help to talk with someone"}
        </h2>
        <p className="text-[14px] leading-relaxed" style={{ color: "var(--arbor-ink-soft)" }} dir="auto">
          {he
            ? `מה שציינתם היום חורג ממה שסיפור ערב יכול לטפל בו. הסיפור אינו מתאים לעת עתה — אבל אתם לא לבד. פנו לאיש מקצוע שיכול לעזור.`
            : `What you described today goes beyond what a bedtime story can address. The story is paused — but you are not alone. Please reach out to someone who can help.`}
        </p>
        <button
          onClick={reset}
          className="inline-flex items-center gap-2 text-[13px] font-bold rounded-xl px-4 py-2.5 min-h-[44px] transition"
          style={{
            background: "var(--arbor-paper-deep)",
            color: "var(--arbor-muted)",
            border: "1px solid var(--arbor-rule)",
          }}
        >
          {he ? "חזרה" : "Back"}
        </button>
      </motion.div>
    );
  }

  // ── Story reader ───────────────────────────────────────────────────────────
  if (story) {
    const pages = story.pages ?? [];
    const currentPage = pages[pageIndex] ?? "";
    const isLast = pageIndex === pages.length - 1;

    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-5"
        data-testid="bedtime-story-reader"
      >
        {/* Story header */}
        <div
          className={`${cardCls} p-5`}
          style={{
            background: "var(--arbor-sky-soft, var(--arbor-paper-elevated))",
            border: "1px solid var(--arbor-rule)",
          }}
        >
          <div className="flex items-center gap-3 mb-2">
            <span
              className="inline-flex items-center justify-center rounded-2xl flex-shrink-0"
              style={{
                background: "var(--arbor-sky-soft, var(--arbor-green-soft))",
                color: "var(--arbor-sky-ink, var(--arbor-green-ink))",
                width: 40,
                height: 40,
              }}
            >
              <Icon name="bedtime" size={20} />
            </span>
            <h1
              className="text-[16px] font-extrabold leading-snug"
              style={{ color: "var(--arbor-ink)", fontFamily: "var(--font-display)" }}
              dir="auto"
            >
              {story.title}
            </h1>
          </div>
          <p className="text-[11px] uppercase tracking-widest font-bold" style={{ color: "var(--arbor-muted)" }}>
            {he
              ? `${isolate(name)}'s ·  סיפור לילה · ${pageIndex + 1} מתוך ${pages.length}`
              : `${isolate(name)}'s bedtime story · ${pageIndex + 1} of ${pages.length}`}
          </p>
        </div>

        {/* Page display */}
        <AnimatePresence mode="wait">
          <motion.div
            key={pageIndex}
            initial={{ opacity: 0, x: he ? -10 : 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: he ? 10 : -10 }}
            className={`${cardCls} p-6`}
            data-testid="bedtime-story-page"
          >
            <p
              className="text-[16px] leading-loose"
              style={{
                color: "var(--arbor-ink)",
                fontFamily: "var(--font-display)",
                lineHeight: 1.85,
              }}
              dir="auto"
            >
              {currentPage}
            </p>
            {/* KID-10: the surface contract's job sentence says "read aloud
                together" and the reader had no read-aloud control, while
                #/stories has carried one per beat for months. Same component,
                same engine, same interrupt model (HeroScenePlayer:119). One per
                PAGE, so the control follows what is actually on screen. */}
            <div className="pt-3" data-testid="bedtime-page-speak">
              <SpeakButton text={currentPage} lang={aiLang} size="md" className="touch-target" />
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Navigation */}
        <div className="flex items-center justify-between gap-3">
          <button
            onClick={() => setPageIndex((i) => Math.max(0, i - 1))}
            disabled={pageIndex === 0}
            className="inline-flex items-center gap-1.5 text-[13px] font-bold rounded-xl px-4 py-2.5 min-h-[44px] disabled:opacity-30 transition"
            style={{
              background: "var(--arbor-paper-deep)",
              color: "var(--arbor-muted)",
              border: "1px solid var(--arbor-rule)",
            }}
            aria-label={he ? "עמוד קודם" : "Previous page"}
          >
            {he ? "הקודם" : "Prev"}
          </button>
          {isLast ? (
            <button
              onClick={goodNight}
              className="inline-flex items-center gap-1.5 text-[13px] font-bold rounded-xl px-4 py-2.5 min-h-[44px] transition"
              style={{
                background: "var(--arbor-green-soft)",
                color: "var(--arbor-green-ink)",
                border: "1px solid rgba(52,178,119,0.25)",
              }}
              data-testid="bedtime-story-done"
            >
              <Icon name="bedtime" size={16} />
              {he ? "לילה טוב" : "Good night"}
            </button>
          ) : (
            <button
              onClick={() => setPageIndex((i) => Math.min(pages.length - 1, i + 1))}
              className="inline-flex items-center gap-1.5 text-[13px] font-bold rounded-xl px-4 py-2.5 min-h-[44px] transition"
              style={{
                background: "var(--arbor-green-soft)",
                color: "var(--arbor-green-ink)",
                border: "1px solid rgba(52,178,119,0.25)",
              }}
              aria-label={he ? "עמוד הבא" : "Next page"}
            >
              {he ? "הבא" : "Next"}
            </button>
          )}
        </div>

        {/* Goodnight questions */}
        {isLast && story.discussionQuestions?.length > 0 && (
          <div
            className={`${cardCls} p-5 space-y-3`}
            style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule)" }}
            data-testid="bedtime-discussion-questions"
          >
            <p
              className="text-[11px] uppercase tracking-widest font-bold"
              style={{ color: "var(--arbor-muted)" }}
            >
              {he ? "שאלות לפני שינה" : "Goodnight questions"}
            </p>
            {story.discussionQuestions.map((q, i) => (
              <div key={i} className="space-y-1.5" data-testid="bedtime-question">
                <p
                  className="text-[14px] leading-relaxed"
                  style={{ color: "var(--arbor-ink-soft)" }}
                  dir="auto"
                >
                  {q}
                </p>
                {/* B-PLAY-14: "Keep what {name} said" — one parent moment per answer. */}
                {kept[i] ? (
                  <p className="text-[12px] font-bold" style={{ color: "var(--arbor-green-ink)" }} data-testid="bedtime-answer-kept">
                    {t("elev.bedtime.keep.done")}
                  </p>
                ) : (
                  <div className="flex items-end gap-2">
                    <label className="flex-1 min-w-0">
                      <span className="block text-[11.5px] font-bold mb-1" style={{ color: "var(--arbor-muted)" }} dir="auto">
                        {t("elev.bedtime.keep.label", { name })}
                      </span>
                      <input
                        type="text"
                        value={answers[i] ?? ""}
                        onChange={(e) => setAnswers((a) => ({ ...a, [i]: e.target.value }))}
                        dir="auto"
                        className="w-full rounded-xl px-3 min-h-11 text-[14px] focus:outline-none focus-visible:ring-2"
                        style={{ background: "var(--arbor-paper-elevated)", color: "var(--arbor-ink)", border: "1px solid var(--arbor-rule)" }}
                        data-testid="bedtime-answer-input"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => keepAnswer(i, q)}
                      disabled={!(answers[i] ?? "").trim()}
                      className="inline-flex items-center rounded-xl px-3 min-h-11 text-[13px] font-bold disabled:opacity-50"
                      style={{ background: "var(--arbor-green-soft)", color: "var(--arbor-green-ink)" }}
                      data-testid="bedtime-answer-keep"
                    >
                      {t("elev.bedtime.keep.cta")}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* ENG-16: the most shareable artefact in the app had no share button
            at all (grep for ShareButton in this file returned nothing). The
            keepsake is the COVER — title and hero only. The story body, the
            goodnight questions and the parent-only summary never reach the
            card, and nothing is persisted: this stays generate-and-discard. */}
        {isLast && (
          <div className="pt-1">
            <ShareButton
              artifact="story"
              surface="bedtime_story"
              childName={name}
              label={t("elev.keepsake.story.share")}
              getCardOpts={(): ShareCardOpts => ({ name, title: story.title })}
            />
          </div>
        )}

        {/* Parent-only summary (not read aloud) */}
        {isLast && story.summary && (
          <p
            className="text-[12px] px-1"
            style={{ color: "var(--arbor-faint)" }}
            dir="auto"
          >
            {he ? "למשפחה: " : "For the family: "}
            {story.summary}
          </p>
        )}
      </motion.div>
    );
  }

  // ── Day event input form ───────────────────────────────────────────────────
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-5"
      data-testid="bedtime-stories-form"
    >
      {/* Header — the page's own; the Stories cover is the header when embedded. */}
      {!embedded && (
      <div
        className={`${cardCls} p-5`}
        style={{ background: "var(--arbor-paper-elevated)", border: "1px solid var(--arbor-rule)" }}
      >
        <div className="flex items-center gap-3 mb-3">
          <span
            className="inline-flex items-center justify-center rounded-2xl flex-shrink-0"
            style={{
              background: "var(--arbor-sky-soft, var(--arbor-green-soft))",
              color: "var(--arbor-sky-ink, var(--arbor-green-ink))",
              width: 40,
              height: 40,
            }}
          >
            <Icon name="bedtime" size={20} />
          </span>
          <div>
            <h1
              className="text-[16px] font-extrabold leading-snug"
              style={{ color: "var(--arbor-ink)", fontFamily: "var(--font-display)" }}
            >
              {he ? `סיפור הלילה של ${isolate(name)}` : `${isolate(name)}'s Bedtime Story`}
            </h1>
            <p className="text-[12px] mt-0.5" style={{ color: "var(--arbor-muted)" }} dir="auto">
              {he
                ? "סיפור מותאם אישית שנולד מהיום שלכם — לקריאה משותפת לפני השינה"
                : "A personalised story born from today — read together at bedtime"}
            </p>
          </div>
        </div>
        <p className="text-[12.5px] leading-relaxed" style={{ color: "var(--arbor-ink-soft)" }} dir="auto">
          {he
            ? `ספרו ל-Arbor מה קרה היום, ו-Arbor ייצור סיפור לילה חמים שבו ${isolate(name)} הוא הגיבור.`
            : `Tell Arbor what happened today, and Arbor will create a warm bedtime story where ${isolate(name)} is the hero.`}
        </p>
      </div>
      )}

      {/* item 11 (IA-02): the surface contract reaches the DOM. `data-module`
          marks a top-level sibling module (counted against the route's
          moduleBudget); `data-primary-move` marks the ONE control the
          contract declares — here, generating tonight's story. Stamps only:
          this surface's own findings belong to another item. */}
      {/* Day event inputs */}
      <div
        data-module={embedded ? undefined : "bedtime-day-events"}
        className={`${cardCls} p-5 space-y-4`}
        style={{ background: "var(--arbor-paper-elevated)", border: "1px solid var(--arbor-rule)" }}
      >
        <p
          className="text-[12px] uppercase tracking-widest font-bold"
          style={{ color: "var(--arbor-muted)" }}
        >
          {he ? `מה קרה היום עם ${isolate(name)}?` : `What happened today with ${isolate(name)}?`}
        </p>

        <div className="space-y-3" data-testid="bedtime-events-list">
          {events.map((evt) => (
            <div key={evt.id} className="flex items-start gap-2">
              <textarea
                className="flex-1 rounded-xl px-3 py-2.5 text-[14px] resize-none min-h-[56px] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 transition"
                style={{
                  background: "var(--arbor-paper-deep)",
                  color: "var(--arbor-ink)",
                  border: "1px solid var(--arbor-rule)",
                }}
                dir="auto"
                placeholder={he ? "תארו רגע מהיום…" : "Describe a moment from today…"}
                value={evt.description}
                onChange={(e) => updateEvent(evt.id, e.target.value)}
                aria-label={he ? "אירוע מהיום" : "Day event"}
                rows={2}
              />
              {events.length > 1 && (
                <button
                  onClick={() => removeEvent(evt.id)}
                  className="mt-1 p-2 rounded-xl transition min-h-[44px] min-w-[44px] flex items-center justify-center"
                  style={{ color: "var(--arbor-muted)", border: "1px solid var(--arbor-rule)", background: "var(--arbor-paper-deep)" }}
                  aria-label={he ? "הסירו אירוע" : "Remove event"}
                >
                  <Icon name="delete" size={16} />
                </button>
              )}
            </div>
          ))}
        </div>

        <button
          onClick={addEvent}
          className="inline-flex items-center gap-1.5 text-[13px] font-bold rounded-xl px-3 py-2 min-h-[44px] transition"
          style={{
            color: "var(--arbor-green-ink)",
            background: "var(--arbor-green-soft)",
            border: "1px solid rgba(52,178,119,0.25)",
          }}
          data-testid="bedtime-add-event"
        >
          <Icon name="add" size={16} />
          {he ? "הוסיפו רגע נוסף" : "Add another moment"}
        </button>
      </div>

      {/* Generate CTA */}
      <button
        data-module={embedded ? undefined : "bedtime-generate"}
        data-primary-move={embedded ? undefined : "generate-bedtime-story"}
        onClick={generate}
        disabled={loading || validEvents.length === 0}
        className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-extrabold text-[15px] text-white disabled:opacity-50 transition active:scale-[0.98] min-h-[52px]"
        style={{
          background: "linear-gradient(135deg, var(--arbor-clay) 0%, var(--arbor-green-ink) 100%)",
        }}
        data-testid="bedtime-generate-btn"
      >
        {loading ? (
          <>
            <Icon name="autorenew" size={20} className="animate-spin" />
            {he ? "יוצר סיפור…" : "Creating story…"}
          </>
        ) : (
          <>
            <Icon name="auto_awesome" size={20} />
            {he ? `צרו את הסיפור של ${isolate(name)}` : `Create ${isolate(name)}'s story`}
          </>
        )}
      </button>

      {/* B-PLAY-14: a failed generation is said here, with Retry — not a toast. */}
      {generation.error && !loading && (
        <div role="alert" data-testid="bedtime-generate-error" className="rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-2" style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule)" }}>
          <p className="text-[13px]" style={{ color: "var(--arbor-ink)" }} dir="auto">{generation.error}</p>
          <button
            type="button"
            onClick={() => void generate()}
            className="inline-flex items-center gap-1.5 rounded-xl px-3 min-h-11 text-[13px] font-bold"
            style={{ background: "var(--arbor-paper-elevated)", color: "var(--arbor-ink)", border: "1px solid var(--arbor-rule)" }}
            data-testid="bedtime-generate-retry"
          >
            <Icon name="refresh" size={16} /> {t("err.retry")}
          </button>
        </div>
      )}

      {/* Privacy / generate-and-discard notice */}
      <div
        className="rounded-xl px-4 py-3 flex items-start gap-2.5"
        style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule)" }}
      >
        <Icon name="menu_book" size={16} className="mt-0.5" style={{ color: "var(--arbor-muted)" }} />
        <p className="text-[12px] leading-relaxed" style={{ color: "var(--arbor-muted)" }} dir="auto">
          {he
            ? "הסיפורים נוצרים ומוצגים בלבד — לא נשמרים ולא משמשים לאימון. היום של ילדכם שייך לכם בלבד."
            : "Stories are created and shown only — never saved or used for training. Your child's day belongs to you."}
        </p>
      </div>
    </motion.div>
  );
}

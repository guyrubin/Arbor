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
import { motion, AnimatePresence } from "motion/react";
import { Icon } from "../ui/Icon";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { useToast } from "../../context/ToastContext";
import { api } from "../../lib/api";
import type { BedtimeStory } from "../../types";
import { cardCls } from "../ui/kit";

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

export default function BedtimeStoriesTab() {
  const { childProfile, behaviorLogs } = useArbor();
  const { aiLang } = useLanguage();
  const { toast } = useToast();
  const he = aiLang === "he";

  // Pre-seed from today's behavior logs (most recent 3) so parents aren't staring
  // at a blank form. The parent can edit/remove before generating.
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayLogs = behaviorLogs
    .filter((l) => l.timestamp?.startsWith(todayStr))
    .slice(0, 3)
    .map((l): LocalDayEvent => ({
      id: `log-${l.id}`,
      description: [l.behaviorType, l.trigger].filter(Boolean).join(" — "),
    }));

  const [events, setEvents] = useState<LocalDayEvent[]>(
    todayLogs.length > 0 ? todayLogs : [emptyEvent()]
  );
  const [story, setStory] = useState<BedtimeStory | null>(null);
  const [loading, setLoading] = useState(false);
  const [escalated, setEscalated] = useState(false);
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

  const generate = async () => {
    if (validEvents.length === 0) {
      toast(he ? "הוסיפו לפחות אירוע אחד מהיום" : "Add at least one event from today", "error");
      return;
    }
    setLoading(true);
    setEscalated(false);
    setStory(null);
    setPageIndex(0);
    try {
      const result = await api.generateBedtimeStory({
        childName: childProfile.name,
        age: childProfile.age,
        dayEvents: validEvents.map((e) => ({ description: e.description })),
        avatarDescription: avatarStyle ? `Avatar style: ${avatarStyle}` : undefined,
        language: aiLang,
      });
      setStory(result);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      // The server returns 409 + escalationCategory when a safety trigger fires.
      // Show a calm, non-diagnostic prompt to reach professional support.
      if (message.includes("Professional support recommended") || message.includes("409")) {
        setEscalated(true);
      } else {
        toast(
          he ? "לא הצלחנו ליצור את הסיפור" : "Could not generate the story",
          "error"
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setStory(null);
    setEscalated(false);
    setPageIndex(0);
  };

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
              ? `${name}'s ·  סיפור לילה · ${pageIndex + 1} מתוך ${pages.length}`
              : `${name}'s bedtime story · ${pageIndex + 1} of ${pages.length}`}
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
              onClick={reset}
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
              <p
                key={i}
                className="text-[14px] leading-relaxed"
                style={{ color: "var(--arbor-ink-soft)" }}
                dir="auto"
              >
                {q}
              </p>
            ))}
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
      {/* Header */}
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
              {he ? `סיפור הלילה של ${name}` : `${name}'s Bedtime Story`}
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
            ? `ספרו ל-Arbor מה קרה היום, ו-Arbor ייצור סיפור לילה חמים שבו ${name} הוא הגיבור.`
            : `Tell Arbor what happened today, and Arbor will create a warm bedtime story where ${name} is the hero.`}
        </p>
      </div>

      {/* Day event inputs */}
      <div
        className={`${cardCls} p-5 space-y-4`}
        style={{ background: "var(--arbor-paper-elevated)", border: "1px solid var(--arbor-rule)" }}
      >
        <p
          className="text-[12px] uppercase tracking-widest font-bold"
          style={{ color: "var(--arbor-muted)" }}
        >
          {he ? `מה קרה היום עם ${name}?` : `What happened today with ${name}?`}
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
            {he ? `צרו את הסיפור של ${name}` : `Create ${name}'s story`}
          </>
        )}
      </button>

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

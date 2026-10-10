/**
 * B-SHELL-39 — the guided conversation as a simple thread: Arbor's question,
 * the parent's answer, the next question. One question at a time (≤ 4 after
 * the opening, server-enforced). Every question has Skip; "Done" goes to the
 * readback at any point; a null next question ends the conversation.
 *
 * Spoken questions: when the parent answered by mic, the tap that sends the
 * answer primes the EU text-to-speech (lib/naturalVoice, inside the gesture),
 * and the next question is read aloud with the route's screened-sentence
 * token. A typed answer is never spoken; a TTS failure leaves the text. The
 * mic never starts by itself after a question: the parent taps to answer
 * (B-VOICE-06 / B-STATUS-02).
 */
import React, { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { useLanguage } from "../../context/LanguageContext";
import { DESCRIBE_TEXT_MAX, type DescribeSession, type ThreadTurn } from "../../lib/describeChild";
import { primeQuestionVoice, type QuestionVoice } from "../../lib/describeChildClient";
import { UrgentSupport } from "../safety/UrgentSupport";
import { DictateButton } from "./DescribeChild";
import "./describe.css";

function AnswerBox({ turn, lang, busy, onSend, onSkip, onDone, onListen }: {
  turn: ThreadTurn; lang: "en" | "he"; busy: boolean;
  onSend: (text: string, viaMic: boolean) => void; onSkip: () => void; onDone: () => void; onListen: () => void;
}) {
  const { t } = useLanguage();
  const fieldId = useId();
  const [answer, setAnswer] = useState(turn.answer ?? "");
  const [viaMic, setViaMic] = useState(false);
  return <div className="describe-answer-box" data-testid="describe-answer-box">
    <label className="describe-field" htmlFor={fieldId}>
      <span className="sr-only">{t("elev.describe.answerField")}</span>
      <textarea id={fieldId} rows={3} maxLength={DESCRIBE_TEXT_MAX} dir="auto" value={answer} disabled={busy}
        onChange={(event) => setAnswer(event.target.value)} data-testid="describe-answer-text" />
    </label>
    <div className="describe-row">
      <DictateButton lang={lang} value={answer} onChange={setAnswer} disabled={busy} label={t("elev.describe.speak")} aria={t("elev.describe.speak")}
        testId={`describe-answer-mic-${turn.id}`} onListen={onListen} onVoiceText={() => setViaMic(true)} />
      <div className="describe-actions">
        <button type="button" className="describe-secondary" disabled={busy || !answer.trim()} onClick={() => onSend(answer, viaMic)} data-testid="describe-answer-send">
          {busy ? t("elev.describe.adding") : t("elev.describe.answer")}
        </button>
        <button type="button" className="describe-link" disabled={busy} onClick={onSkip} data-testid="describe-question-skip">{t("elev.describe.skipQuestion")}</button>
        <button type="button" className="describe-link" disabled={busy} onClick={onDone} data-testid="describe-done">{t("elev.describe.toReadback")}</button>
      </div>
    </div>
  </div>;
}

export interface DescribeThreadProps {
  name: string;
  lang: "en" | "he";
  session: DescribeSession;
  /** Onboarding advances its step after these; the door calls the session. */
  onAnswer?: (text: string) => Promise<unknown>;
  onSkip?: () => void | Promise<unknown>;
  onDone?: () => void | Promise<unknown>;
  /** The opening answer came by voice: read the first follow-up aloud. */
  primedVoice?: React.MutableRefObject<QuestionVoice | null>;
}

export default function DescribeThread({ name, lang, session, onAnswer, onSkip, onDone, primedVoice }: DescribeThreadProps) {
  const { t } = useLanguage();
  const state = useSyncExternalStore(session.subscribe, session.snapshot, session.snapshot);
  const voice = useRef<QuestionVoice | null>(null);
  const spoken = useRef(new Set<string>());
  useEffect(() => () => { voice.current?.cancel(); voice.current = null; }, []);
  const open = state.status === "asking" ? state.thread.find((turn) => turn.status === "open") : undefined;
  // The opening answer's voice was primed by the container's tap (onboarding's
  // Continue, the door's Play it back): speak the first question once.
  useEffect(() => {
    const primed = primedVoice?.current;
    if (!open || !primed || spoken.current.has(open.id)) return;
    spoken.current.add(open.id);
    primedVoice!.current = null;
    voice.current?.cancel();
    voice.current = primed;
    void primed.speak(open.question, open.lang ?? lang, open.ttsToken);
  }, [open, primedVoice, lang]);
  const busy = state.status === "drafting";
  const send = async (text: string, viaMic: boolean) => {
    // Inside the tap: prime the voice now, speak after the reply (autoplay rule).
    voice.current?.cancel();
    const primed = viaMic ? primeQuestionVoice() : null;
    voice.current = primed;
    await (onAnswer ? onAnswer(text) : session.answer(text));
    const after = session.snapshot();
    const next = after.status === "asking" ? after.thread.find((turn) => turn.status === "open") : undefined;
    if (primed && next && !spoken.current.has(next.id)) { spoken.current.add(next.id); void primed.speak(next.question, next.lang ?? lang, next.ttsToken); }
    else if (primed && !next) primed.cancel();
  };
  const stopVoice = () => { voice.current?.cancel(); voice.current = null; };
  return <section className="describe-thread" data-testid="describe-thread" aria-live="polite">
    <ol>
      {state.thread.map((turn, index) => <li key={turn.id} className="describe-turn" data-status={turn.status}>
        <p className="describe-ask"><span className="sr-only">{t("elev.describe.arbor")}: </span>{index === 0 && !turn.question ? t("elev.describe.opening", { name }) : turn.question}</p>
        {turn.answer && turn.status !== "open" && <p className="describe-answer" dir="auto"><span className="sr-only">{t("elev.describe.you")}: </span>{turn.answer}</p>}
        {turn.status === "skipped" && <p className="describe-note">{t("elev.describe.skipped")}</p>}
      </li>)}
    </ol>
    {busy && <p className="describe-note" role="status">{t("elev.describe.drafting")}</p>}
    {open && <AnswerBox key={open.id} turn={open} lang={lang} busy={busy} onListen={stopVoice}
      onSend={(text, viaMic) => void send(text, viaMic)}
      onSkip={() => { stopVoice(); void (onSkip ? onSkip() : session.skip()); }}
      onDone={() => { stopVoice(); void (onDone ? onDone() : session.done()); }} />}
    {state.error === "followUp" && <p className="describe-note" role="alert">{t("elev.describe.followUpFailed")}</p>}
    {state.error === "crisis" && <UrgentSupport testId="describe-thread-urgent-support" />}
  </section>;
}

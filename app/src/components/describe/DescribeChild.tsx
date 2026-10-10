/**
 * B-SHELL-39 — "Tell Arbor about {name}": the opening of the ONE guided
 * conversation. Arbor asks "Tell me about {name}" with three hint lines; the
 * parent answers by voice or text. Every answer in the thread (DescribeThread)
 * uses the same two inputs:
 *  - dictation (lib/speech, in the AI language) that starts ONLY on the
 *    parent's tap, with the RecordingIndicator while the microphone is live
 *    and the voice-door data line on first use;
 *  - a 2,000-character field.
 * The eight areas are quick fills on the "Tell Arbor more" door (onboarding
 * keeps its own one-worry tiles). Where dictation is not supported (a
 * native-shell WebView, Firefox) the mic hides and typing works. The
 * container owns Skip and the primary action.
 */
import React, { useEffect, useId, useRef, useState } from "react";
import Icon from "../ui/Icon";
import RecordingIndicator from "../ui/RecordingIndicator";
import { useLanguage } from "../../context/LanguageContext";
import { speechSupported, startDictation } from "../../lib/speech";
import { microphoneRecovery } from "../../lib/microphoneRecovery";
import { markVoiceDoorNoticeSeen, voiceDoorNoticeSeen } from "../../lib/voiceDoor";
import { DOMAIN_IDS, domainName, type DomainId } from "../../lib/domains/registry";
import { DOMAIN_ICONS } from "../../lib/domains/icons";
import { DESCRIBE_TEXT_MAX } from "../../lib/describeChild";
import "./describe.css";

/** A mic for one text field: starts dictation in the AI language, shows the
 *  RecordingIndicator while it is live, and appends the parent's words. */
export function DictateButton({ lang, value, onChange, disabled, label, aria, testId = "describe-mic", onListen, onVoiceText }: {
  lang: "en" | "he"; value: string; onChange: (text: string) => void; disabled?: boolean; label: string; aria: string; testId?: string;
  /** The parent tapped the mic (e.g. stop a question being read aloud). */
  onListen?: () => void;
  /** Dictated words arrived: the answer came by voice. */
  onVoiceText?: () => void;
}) {
  const { t } = useLanguage();
  const [supported] = useState(() => speechSupported());
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState("");
  const [firstUse, setFirstUse] = useState(() => !voiceDoorNoticeSeen());
  const stopRef = useRef<(() => void) | null>(null);
  const scope = useRef(0);
  const valueRef = useRef(value);
  valueRef.current = value;
  useEffect(() => () => { scope.current++; stopRef.current?.(); stopRef.current = null; }, []);
  useEffect(() => { if (disabled && listening) stopRef.current?.(); }, [disabled, listening]);
  if (!supported) return null;
  const toggle = () => {
    if (listening) { stopRef.current?.(); return; }
    const turn = ++scope.current;
    onListen?.();
    setError(""); setListening(true);
    if (firstUse) { markVoiceDoorNoticeSeen(); }
    stopRef.current = startDictation({
      onResult: (text) => { if (turn === scope.current && text.trim()) { onChange([valueRef.current.trim(), text.trim()].filter(Boolean).join(" ").slice(0, DESCRIBE_TEXT_MAX)); onVoiceText?.(); } },
      onInterim: (text) => { if (turn === scope.current) setInterim(text); },
      onError: (reason) => { if (turn === scope.current) setError(microphoneRecovery(reason, lang)); },
      onEnd: () => { if (turn === scope.current) { setListening(false); setInterim(""); stopRef.current = null; setFirstUse(false); } },
    }, lang === "he" ? "he-IL" : "en-US", { continuous: true });
  };
  return <div className="describe-mic">
    {/* The voice-door data line, once per device (lib/voiceDoor). */}
    {firstUse && <p className="describe-note" data-testid={`${testId}-data-use`}>{t("elev.wave2Daily.capture.voice.dataUse", { residency: t("elev.coachcontract.uses.liveResidencyUndated") })}</p>}
    {!listening && <button type="button" className="describe-secondary" onClick={toggle} disabled={disabled} aria-label={aria} data-testid={testId}>
      <Icon name="mic" size={20} /><span>{label}</span>
    </button>}
    {listening && <RecordingIndicator interim={interim} hint={t("elev.describe.listening")} label={t("elev.rec.on")} stopLabel={t("elev.describe.done")}
      stopAria={t("elev.rec.stopAria")} onStop={() => stopRef.current?.()} testId={`${testId}-recording`} captionTestId={`${testId}-caption`} />}
    {error && <p className="describe-note" role="alert">{error}</p>}
  </div>;
}

export interface DescribeChildProps {
  /** The child's first name. */
  name: string;
  /** The AI language: dictation and the parent's words. */
  lang: "en" | "he";
  value: string;
  onChange: (text: string) => void;
  disabled?: boolean;
  /** The eight areas as quick fills (the "Tell Arbor more" door). */
  quickFills?: boolean;
  autoFocus?: boolean;
  /** The answer came (at least partly) by voice: the next question is read aloud. */
  onVoiceText?: () => void;
}

export default function DescribeChild({ name, lang, value, onChange, disabled, quickFills, autoFocus, onVoiceText }: DescribeChildProps) {
  const { t } = useLanguage();
  const fieldId = useId();
  const hintsId = useId();
  const askId = useId();
  const fieldRef = useRef<HTMLTextAreaElement>(null);
  const fill = (domain: DomainId) => {
    const lead = `${domainName(domain, t)}: `;
    onChange([value.trim(), lead].filter(Boolean).join(value.trim() ? "\n" : "").slice(0, DESCRIBE_TEXT_MAX));
    fieldRef.current?.focus();
  };
  return <div className="describe-surface" data-testid="describe-child">
    <p id={askId} className="describe-ask" data-testid="describe-opening">{t("elev.describe.opening", { name })}</p>
    <div id={hintsId} className="describe-hints">
      <p className="describe-hints-label">{t("elev.describe.hintsLabel")}</p>
      <ul>
        <li>{t("elev.describe.hint1", { name })}</li>
        <li>{t("elev.describe.hint2")}</li>
        <li>{t("elev.describe.hint3")}</li>
      </ul>
    </div>
    <label className="describe-field" htmlFor={fieldId}>
      <span className="sr-only">{t("elev.describe.field", { name })}</span>
      <textarea id={fieldId} ref={fieldRef} rows={5} maxLength={DESCRIBE_TEXT_MAX} value={value} disabled={disabled} autoFocus={autoFocus} dir="auto"
        aria-labelledby={askId} aria-describedby={hintsId} placeholder={t("elev.describe.placeholder")} data-testid="describe-text"
        onChange={(event) => onChange(event.target.value)} />
    </label>
    <div className="describe-row">
      <DictateButton lang={lang} value={value} onChange={onChange} disabled={disabled} label={t("elev.describe.speak")} aria={t("elev.describe.speakAria", { name })} onVoiceText={onVoiceText} />
      <span className="describe-count" aria-live="off">{t("elev.describe.count", { n: value.length.toLocaleString(lang === "he" ? "he-IL" : "en-GB") })}</span>
    </div>
    {quickFills && <div className="describe-fills" role="group" aria-label={t("elev.describe.quickFills")}>
      <p className="describe-hints-label">{t("elev.describe.quickFills")}</p>
      <div>{DOMAIN_IDS.map((domain) => <button type="button" key={domain} className="describe-chip" disabled={disabled} onClick={() => fill(domain)} data-fill={domain}>
        <Icon name={DOMAIN_ICONS[domain]} size={18} /><span>{domainName(domain, t)}</span>
      </button>)}</div>
    </div>}
  </div>;
}

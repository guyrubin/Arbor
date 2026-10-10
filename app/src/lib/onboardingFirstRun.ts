/** B-SHELL-36 supersedes B-SHELL-08. All choices/cards are authored, on device. */
import type { ChildProfile } from "../types";
import { ageMonthsFromBirthMonth, ageMonthsFromProfile, isoDateOf } from "./childAge";
import { domainName, isDomainId, type DomainId } from "./domains/registry";
import { translate, type UiLang } from "./i18n";
import { availableHardMomentCards } from "../content/selectCards";
import type { HardMomentCard } from "../content/hardMomentCards";
import { locText } from "../content/hardMomentSurface";
import { sayBackFor } from "./language/sayBack";
import { bandForAge, type PlayBand } from "../playbank/content";
import { fnv1a } from "./promptBank";
import { hasOnboardingNoticeReview } from "../content/onboardingNoticeRelease";
import { screenForImmediateEscalation } from "../safety/escalation";

export type OnboardingChoice = DomainId | "hard-moment" | "nothing";
export interface OnboardingDraft {
  step: 2 | 3;
  choice: OnboardingChoice;
  words: string;
  quote: string;
  hardMomentId: string;
}
export interface FirstRunState {
  step: 1 | 2 | 3;
  childId: string | null;
  name: string;
  birthMonth: string;
  /** An existing exact birthday is preserved and is never inferred from a month. */
  exactBirthDate?: string;
  languages: string[];
  consent: boolean;
  worry: OnboardingDraft;
  busy: boolean;
  error: boolean;
  complete: boolean;
}
const blankWorry = (): OnboardingDraft => ({ step: 2, choice: "nothing", words: "", quote: "", hardMomentId: "" });
export function initialFirstRunState(child?: ChildProfile | null): FirstRunState {
  const draft = child?.onboardingDraft;
  const worry = draft && (isDomainId(draft.choice) || draft.choice === "hard-moment" || draft.choice === "nothing")
    ? { ...blankWorry(), ...draft, step: draft.step === 3 ? 3 as const : 2 as const } : { ...blankWorry(), words: child?.challenges?.[0] ?? "" };
  const birthMonth = child?.birthDate?.slice(0, 7) || child?.birthMonth || "";
  return { step: child && ageMonthsFromBirthMonth(birthMonth) !== null ? worry.step : 1,
    childId: child?.id ?? null, name: child?.name ?? "", birthMonth, exactBirthDate: child?.birthDate,
    languages: child?.languages ?? [], consent: !!child, worry, busy: false, error: false, complete: false };
}
export function firstRunAgeMonths(state: Pick<FirstRunState, "birthMonth" | "exactBirthDate">, now = new Date()): number | null {
  return ageMonthsFromProfile({ age: Number.NaN, birthDate: state.exactBirthDate, birthMonth: state.birthMonth }, now);
}
export function validAbout(state: Pick<FirstRunState, "name" | "birthMonth" | "languages" | "consent">, now = new Date()): boolean {
  const months = ageMonthsFromBirthMonth(state.birthMonth, now);
  return !!state.name.trim() && months !== null && months < 156 && state.languages.length > 0 && state.consent;
}
export function choiceName(choice: OnboardingChoice, lang: UiLang): string {
  return isDomainId(choice) ? domainName(choice, key => translate(lang, key)) : translate(lang, `ob.first.${choice}`);
}
export function onboardingChallenges(worry: OnboardingDraft, lang: UiLang): string[] {
  const text = worry.words.trim();
  return text ? [text] : worry.choice === "nothing" ? [] : [choiceName(worry.choice, lang)];
}

/** Existing Journal questions, unchanged. The clinical review packet identifies
 * every reused line. No new developmental advice is activated by this feature. */
export const FIRST_NOTICE_PROMPTS: Readonly<Record<PlayBand, Record<DomainId, number>>> = {
  infant: { talking: 7, moving: 9, hands: 3, thinking: 4, playing: 5, feelings: 6, body: 8, family: 20 },
  toddler: { talking: 1, moving: 15, hands: 28, thinking: 19, playing: 24, feelings: 10, body: 13, family: 9 },
  preschool: { talking: 1, moving: 11, hands: 5, thinking: 17, playing: 3, feelings: 10, body: 28, family: 14 },
  "early-school": { talking: 15, moving: 19, hands: 13, thinking: 4, playing: 5, feelings: 12, body: 23, family: 17 },
};
export interface FirstRunCard {
  key: string;
  title: string;
  notice: string;
  recommendation: string;
  source: "onboarding" | "hard-moment";
  guide?: HardMomentCard;
  urgent?: true;
  sayBack?: { heading: string; line: string };
}
export function firstRunCard(state: FirstRunState, lang: UiLang, now = new Date()): FirstRunCard {
  const months = firstRunAgeMonths(state, now);
  if (months === null) throw new Error("A birth month is required");
  const tr = (key: string, vars?: Record<string, string | number>) => translate(lang, key, vars);
  if (screenForImmediateEscalation({ message: state.worry.words, childQuote: state.worry.quote })) {
    const notice = `${tr("elev.safety.crisis.danger")} ${tr("screen.safetyNote")}`;
    return { key: "urgent-support", title: tr("elev.safety.header.title"), notice, recommendation: notice, source: "onboarding", urgent: true };
  }
  const choice = state.worry.choice;
  if (choice === "hard-moment") {
    const guide = availableHardMomentCards({ ageMonths: months, locale: lang, now }).find(card => card.id === state.worry.hardMomentId);
    if (guide) return { key: `guide:${guide.id}`, title: locText(guide.title, lang), notice: locText(guide.doNow, lang), recommendation: locText(guide.doNow, lang), source: "hard-moment", guide };
    // Expired (3 Dec), withdrawn, edited or age-mismatched: Feelings notice.
  }
  const area = choice === "hard-moment" ? "feelings" : isDomainId(choice) ? choice : null;
  const band = bandForAge(months / 12);
  const key = area ? `elev.prompt.${band}.${FIRST_NOTICE_PROMPTS[band][area]}` : "elev.journal.compose.ask";
  // The new surface's specific clinical gate stays closed. A neutral existing
  // day-0 observation question keeps setup useful while review is pending.
  const visibleKey = area && !hasOnboardingNoticeReview(key, now) ? "elev.journal.compose.ask" : key;
  const notice = tr(visibleKey, { name: state.name.trim() });
  const back = choice === "talking" && state.worry.quote.trim()
    ? sayBackFor({ text: state.worry.quote, languages: state.languages, months }) : null;
  const sayBack = back && back.lineKey && back.lineLocale ? {
    heading: tr(back.headKey, { said: back.said, kept: back.answerIn, name: state.name.trim() }),
    line: translate(back.lineLocale, back.lineKey, back.lineVars),
  } : undefined;
  return { key: `${key}:${visibleKey}`, title: area ? choiceName(area, lang) : tr("elev.prompt.lead"), notice,
    recommendation: sayBack ? `${notice}\n${sayBack.heading} ${sayBack.line}` : notice, source: "onboarding", ...(sayBack ? { sayBack } : {}) };
}
export function onboardingAcceptanceKey(childId: string, card: FirstRunCard): string {
  return `${card.urgent ? "onboarding-urgent" : "onboarding-v1"}.${childId}.${fnv1a(`${card.key}|${card.recommendation}`).toString(16)}`;
}

type FirstRunWriteOptions = { isCurrent?: () => boolean; onPersisted?: () => void };
interface FirstRunServices {
  /** Stable identity for one mounted owner session; omitted test services use object identity. */
  sessionKey?: object;
  isCurrent?: () => boolean;
  captureLifetime?: (childId: string | null) => () => boolean;
  addChild: (input: Omit<ChildProfile, "id">, options?: FirstRunWriteOptions) => Promise<ChildProfile>;
  updateChild: (id: string, patch: Partial<ChildProfile>, options?: FirstRunWriteOptions) => Promise<boolean>;
  accept: (childId: string, card: FirstRunCard, key: string, isCurrent?: () => boolean) => Promise<void>;
  lang: () => UiLang;
  now?: () => Date;
  onComplete?: () => void;
}
/** One synchronous in-flight latch covers double taps, Back during writes,
 * retry after failure and remount hydration. UI and offline tests use this exact controller. */
export class FirstRunController {
  private state: FirstRunState;
  private listeners = new Set<() => void>();
  constructor(child: ChildProfile | null | undefined, public services: FirstRunServices) { this.state = initialFirstRunState(child); }
  snapshot = () => this.state;
  subscribe = (fn: () => void) => { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; };
  private put(next: Partial<FirstRunState>) { this.state = { ...this.state, ...next }; this.listeners.forEach(fn => fn()); }
  edit(next: Partial<Pick<FirstRunState, "name" | "birthMonth" | "languages" | "consent">>) {
    if (this.state.busy || this.state.complete) return;
    if (this.state.exactBirthDate && next.birthMonth !== undefined) delete next.birthMonth;
    this.put({ ...next, error: false });
  }
  worry(next: Partial<OnboardingDraft>) {
    if (!this.state.busy && !this.state.complete) this.put({ worry: { ...this.state.worry, ...next }, error: false });
  }
  back() { if (!this.state.busy && !this.state.complete) this.put({ step: Math.max(1, this.state.step - 1) as FirstRunState["step"], error: false }); }
  /** Capture callbacks once. React may refresh callbacks within one session,
   * but an owner/lifetime change must stop every continuation after an await. */
  private operation(childId: string | null) {
    const original = this.services;
    const services = { ...original };
    const session = original.sessionKey ?? original;
    const captured = services.captureLifetime?.(childId) ?? (() => true);
    const lifetime = () => (this.services.sessionKey ?? this.services) === session
      && captured() && (services.isCurrent?.() ?? true);
    const current = (expectedChildId = childId) => lifetime() && this.state.childId === expectedChildId;
    return { services, current, lifetime };
  }
  async next() {
    if (this.state.busy || this.state.complete || this.state.step === 3) return;
    const state = this.state;
    const { services, current, lifetime } = this.operation(state.childId);
    const now = services.now?.() ?? new Date();
    if (!current() || !validAbout(state, now)) return;
    let targetId = state.childId;
    this.put({ busy: true, error: false });
    try {
      const step = (state.step + 1) as 2 | 3;
      const worry = { ...state.worry, step };
      if (state.step === 1) {
        const ageMonths = firstRunAgeMonths(state, now)!;
        const about = { name: state.name.trim(), birthMonth: state.birthMonth, age: Math.floor(ageMonths / 12), ageMonths,
          ageMonthsAsOf: isoDateOf(now), languages: state.languages, onboardingDraft: worry };
        if (!current()) return;
        if (state.childId) {
          const saved = await services.updateChild(state.childId, about, { isCurrent: current });
          if (!current()) return;
          if (!saved) throw new Error("Profile was not saved");
        } else {
          const child = await services.addChild({ ...about, schoolContext: "", strengths: [], challenges: [], onboardingComplete: false }, { isCurrent: lifetime });
          if (!current()) return;
          targetId = child.id;
          this.put({ childId: child.id });
        }
      } else if (state.childId) {
        if (!current()) return;
        const saved = await services.updateChild(state.childId, { challenges: onboardingChallenges(worry, services.lang()), onboardingDraft: worry }, { isCurrent: current });
        if (!current()) return;
        if (!saved) throw new Error("Worry was not saved");
      }
      if (current(targetId)) this.put({ step, worry });
    } catch { if (current(targetId)) this.put({ error: true }); }
    finally { if (current(targetId)) this.put({ busy: false }); }
  }
  async finish(renderedCard: FirstRunCard): Promise<void> {
    if (this.state.busy || this.state.complete || this.state.step !== 3 || !this.state.childId) return;
    const state = this.state;
    const { services, current: stillCurrent } = this.operation(state.childId);
    if (!stillCurrent()) return;
    const now = services.now?.() ?? new Date();
    const lang = services.lang();
    const current = firstRunCard(state, lang, now);
    // Expiry between render and tap must show the fallback before it is accepted.
    if (current.key !== renderedCard.key || current.recommendation !== renderedCard.recommendation) { this.put({ error: true }); return; }
    this.put({ busy: true, error: false });
    try {
      // Explicit acceptance checkpoints the exact reviewed step-3 input. A
      // quote typed here was not part of step 2; a later completion failure
      // must never turn its retry into a different, neutral action.
      if (!stillCurrent()) return;
      const checkpointed = await services.updateChild(state.childId!, {
        onboardingDraft: { ...state.worry, step: 3 }, challenges: onboardingChallenges(state.worry, lang),
      }, { isCurrent: stillCurrent });
      if (!stillCurrent()) return;
      if (!checkpointed) throw new Error("The reviewed draft was not saved");
      // The checkpoint may have crossed pilot expiry. Recheck before the action write.
      const afterCheckpoint = firstRunCard(state, lang, services.now?.() ?? new Date());
      if (afterCheckpoint.key !== current.key || afterCheckpoint.recommendation !== current.recommendation) throw new Error("The card changed");
      await services.accept(state.childId!, current, onboardingAcceptanceKey(state.childId!, current), stillCurrent);
      if (!stillCurrent()) return;
      const complete = () => {
        if (!stillCurrent() || this.state.complete) return;
        this.put({ complete: true });
        services.onComplete?.();
      };
      const completed = await services.updateChild(state.childId!, { onboardingComplete: true, onboardingCompletedAt: now.toISOString(),
        challenges: onboardingChallenges(state.worry, lang), onboardingDraft: undefined }, { isCurrent: stillCurrent, onPersisted: complete });
      if (!stillCurrent()) return;
      if (!completed) throw new Error("Completion was not saved");
      complete();
    } catch { if (stillCurrent()) this.put({ error: true }); }
    finally { if (stillCurrent()) this.put({ busy: false }); }
  }
}

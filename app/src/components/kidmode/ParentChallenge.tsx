/**
 * E10: ParentChallenge — the parent verification card summoned by the 3s hold.
 *
 * Flow: hold-to-exit completes → this card appears → the parent answers a
 * 2-digit addition question (deterministic from today's date; a wrong answer
 * regenerates it) OR enters the optional 4-digit parent PIN (device-local,
 * localStorage "arbor.parentPin", settable on first use) → exit fires.
 *
 * Safety contract (unchanged from AP-048): NO child data, NO Firestore, NO
 * network. Escape is already blocked at the overlay level; this card also
 * swallows Escape locally and traps focus while open. Dismissing the card
 * returns to Kid Mode — never out of it.
 *
 * Styling: TOKEN-ONLY (var(--arbor-*) / PASTEL var strings, zero raw hex),
 * logical properties for RTL; entrance motion gated on prefers-reduced-motion.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import { useLanguage } from "../../context/LanguageContext";
import { prefersReducedMotion } from "../../lib/devscore";
import { PASTEL } from "../../lib/tokens";
import {
  challengeFor,
  dateSeedKey,
  isChallengeAnswer,
  isPinShape,
  readParentPin,
  saveParentPin,
} from "./parentGate";

interface ParentChallengeProps {
  /** Parent verified — the actual exit action (e.g. closeKidMode). */
  onSuccess: () => void;
  /** Card dismissed — stays safely inside Kid Mode. */
  onDismiss: () => void;
}

const fieldStyle: React.CSSProperties = {
  minHeight: "44px",
  borderRadius: "var(--r)",
  border: "1px solid var(--arbor-rule-strong)",
  background: "var(--arbor-paper)",
  color: "var(--arbor-ink)",
  fontWeight: 800,
  fontSize: "var(--t-lg)",
  textAlign: "center",
  fontVariantNumeric: "tabular-nums",
};

export function ParentChallenge({ onSuccess, onDismiss }: ParentChallengeProps) {
  const { t } = useLanguage();
  const storedPin = useMemo(() => readParentPin(), []);
  const [mode, setMode] = useState<"pin" | "math">(storedPin ? "pin" : "math");
  const [attempt, setAttempt] = useState(0);
  const [input, setInput] = useState("");
  const [wrong, setWrong] = useState(false);
  const [setPinOpen, setSetPinOpen] = useState(false);
  const [newPin, setNewPin] = useState("");

  const seed = useMemo(() => dateSeedKey(), []);
  const challenge = useMemo(() => challengeFor(seed, attempt), [seed, attempt]);

  const cardRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Entrance rise-fade — collapses to an instant render under reduced motion.
  const [entered, setEntered] = useState(() => prefersReducedMotion());
  useEffect(() => {
    if (entered) return;
    const id = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(id);
  }, [entered]);

  // Focus the answer field on mount and whenever the mode flips.
  useEffect(() => {
    inputRef.current?.focus();
  }, [mode]);

  // Local focus trap + Escape swallow (the overlay blocks Escape too; this
  // keeps the card self-contained if ever mounted elsewhere).
  const onKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    if (e.key !== "Tab") return;
    const root = cardRef.current;
    if (!root) return;
    const focusables = Array.from(
      root.querySelectorAll<HTMLElement>('button, input, [tabindex]:not([tabindex="-1"])')
    ).filter((el) => !el.hasAttribute("disabled"));
    if (focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const active = document.activeElement as HTMLElement | null;
    if (e.shiftKey && (active === first || !root.contains(active))) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  }, []);

  const submit = useCallback(
    (e?: React.FormEvent) => {
      e?.preventDefault();
      if (mode === "pin") {
        if (storedPin !== null && input === storedPin) {
          onSuccess();
        } else {
          setWrong(true);
          setInput("");
          inputRef.current?.focus();
        }
        return;
      }
      if (isChallengeAnswer(challenge, input)) {
        // Optional first-use PIN: persist only when the parent typed a valid one.
        if (setPinOpen && isPinShape(newPin)) saveParentPin(newPin);
        onSuccess();
      } else {
        setAttempt((a) => a + 1); // deterministic regeneration
        setWrong(true);
        setInput("");
        inputRef.current?.focus();
      }
    },
    [mode, storedPin, input, challenge, setPinOpen, newPin, onSuccess]
  );

  const isPin = mode === "pin";

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 80,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
        background: "rgba(41,51,63,0.45)",
        opacity: entered ? 1 : 0,
        transition: "opacity 0.25s ease",
      }}
      onKeyDown={onKeyDown}
    >
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="parent-challenge-title"
        style={{
          position: "relative",
          width: "100%",
          maxWidth: "340px",
          borderRadius: "22px",
          border: "1px solid var(--arbor-rule)",
          background: "var(--arbor-paper-elevated)",
          boxShadow: "var(--shadow-sm)",
          padding: "24px",
          textAlign: "start",
          transform: entered ? "none" : "translateY(10px)",
          transition: "transform 0.25s ease",
        }}
      >
        {/* Dismiss = stay in Kid Mode (never an exit path). */}
        <button
          type="button"
          onClick={onDismiss}
          aria-label={t("elev.gate.stay")}
          style={{
            position: "absolute",
            insetInlineEnd: "8px",
            insetBlockStart: "8px",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: "44px",
            height: "44px",
            borderRadius: "50%",
            border: "none",
            background: "transparent",
            color: "var(--arbor-muted)",
            cursor: "pointer",
          }}
        >
          <X aria-hidden="true" style={{ width: "20px", height: "20px" }} />
        </button>

        <h2
          id="parent-challenge-title"
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 900,
            fontSize: "var(--t-xl)",
            color: "var(--arbor-ink)",
            marginInlineEnd: "44px",
          }}
        >
          {isPin ? t("elev.gate.pinTitle") : t("elev.gate.title")}
        </h2>
        <p style={{ marginBlockStart: "6px", fontSize: "var(--t-sm)", color: "var(--arbor-muted)" }}>
          {isPin ? t("elev.gate.pinSub") : t("elev.gate.sub")}
        </p>

        <form onSubmit={submit} style={{ marginBlockStart: "16px" }}>
          {isPin ? (
            <input
              ref={inputRef}
              type="password"
              inputMode="numeric"
              autoComplete="off"
              maxLength={4}
              value={input}
              onChange={(e) => { setInput(e.target.value.replace(/\D/g, "")); setWrong(false); }}
              aria-label={t("elev.gate.pinAria")}
              aria-invalid={wrong || undefined}
              style={{ ...fieldStyle, width: "100%", letterSpacing: "0.4em" }}
            />
          ) : (
            /* The sum reads left-to-right in both languages. */
            <div
              dir="ltr"
              aria-label={t("elev.gate.mathAria", { a: challenge.a, b: challenge.b })}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "10px",
                fontFamily: "var(--font-display)",
                fontWeight: 900,
                fontSize: "var(--t-xl)",
                color: "var(--arbor-ink)",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              <span aria-hidden="true">{challenge.a} + {challenge.b} =</span>
              <input
                ref={inputRef}
                type="text"
                inputMode="numeric"
                autoComplete="off"
                maxLength={3}
                value={input}
                onChange={(e) => { setInput(e.target.value.replace(/\D/g, "")); setWrong(false); }}
                aria-label={t("elev.gate.answerAria")}
                aria-invalid={wrong || undefined}
                style={{ ...fieldStyle, width: "84px" }}
              />
            </div>
          )}

          {/* Wrong-answer line: polite, regenerated question already in place. */}
          <p
            aria-live="polite"
            style={{
              minHeight: "18px",
              marginBlockStart: "8px",
              fontSize: "var(--t-xs)",
              fontWeight: 700,
              color: PASTEL.coral.ink,
            }}
          >
            {wrong ? (isPin ? t("elev.gate.pinWrong") : t("elev.gate.wrong")) : ""}
          </p>

          {/* Optional first-use PIN (math mode only, nothing stored until valid). */}
          {!isPin && !storedPin && (
            <div style={{ marginBlockStart: "4px" }}>
              {setPinOpen ? (
                <>
                  <input
                    type="password"
                    inputMode="numeric"
                    autoComplete="off"
                    maxLength={4}
                    value={newPin}
                    onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ""))}
                    aria-label={t("elev.gate.setPinAria")}
                    style={{ ...fieldStyle, width: "100%", letterSpacing: "0.4em", fontSize: "var(--t-md)" }}
                  />
                  <p style={{ marginBlockStart: "6px", fontSize: "var(--t-xs)", color: "var(--arbor-muted)" }}>
                    {t("elev.gate.setPinHint")}
                  </p>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setSetPinOpen(true)}
                  style={{
                    minHeight: "44px",
                    padding: 0,
                    border: "none",
                    background: "transparent",
                    color: "var(--arbor-muted)",
                    fontSize: "var(--t-xs)",
                    fontWeight: 700,
                    textDecoration: "underline",
                    cursor: "pointer",
                    textAlign: "start",
                  }}
                >
                  {t("elev.gate.setPinToggle")}
                </button>
              )}
            </div>
          )}

          {/* PIN mode always keeps the math question as a fallback. */}
          {isPin && (
            <button
              type="button"
              onClick={() => { setMode("math"); setInput(""); setWrong(false); }}
              style={{
                minHeight: "44px",
                padding: 0,
                border: "none",
                background: "transparent",
                color: "var(--arbor-muted)",
                fontSize: "var(--t-xs)",
                fontWeight: 700,
                textDecoration: "underline",
                cursor: "pointer",
                textAlign: "start",
              }}
            >
              {t("elev.gate.useMath")}
            </button>
          )}

          <button
            type="submit"
            style={{
              marginBlockStart: "12px",
              width: "100%",
              minHeight: "44px",
              borderRadius: "var(--r)",
              border: "none",
              background: "var(--arbor-clay)",
              color: "var(--arbor-on-accent)",
              fontWeight: 800,
              fontSize: "var(--t-sm)",
              cursor: "pointer",
            }}
          >
            {t("elev.gate.confirm")}
          </button>
        </form>
      </div>
    </div>
  );
}

export default ParentChallenge;

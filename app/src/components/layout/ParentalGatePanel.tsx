import React, { useState } from "react";
import { useLanguage } from "../../context/LanguageContext";
import { useToast } from "../../context/ToastContext";
import {
  isMathExitSession,
  isPinShape,
  readParentPin,
  saveParentPin,
  verifyParentPin,
} from "../kidmode/parentGate";

/**
 * STORE-3 — the ONLY place the parent PIN is created or changed (the kid-mode
 * challenge card can no longer set it). Lives in the authenticated parent
 * Settings surface. Three states:
 *   - math-exit session, PIN set   → unlock-with-PIN input
 *   - math-exit session, no PIN    → setup locked (a math-passer must not
 *                                    mint the PIN); a credentialed sign-in or
 *                                    fresh session unlocks setup
 *   - unrestricted                 → set / change (changing requires current)
 * Device-local only — never stored with child data.
 */
export default function ParentalGatePanel() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [pinSet, setPinSet] = useState(() => readParentPin() !== null);
  const [restricted, setRestricted] = useState(() => isMathExitSession());
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [wrong, setWrong] = useState(false);

  const fieldStyle: React.CSSProperties = {
    minHeight: "40px",
    borderRadius: "12px",
    border: "1px solid var(--arbor-rule)",
    background: "var(--arbor-paper)",
    color: "var(--arbor-ink)",
    fontWeight: 700,
    textAlign: "center",
    letterSpacing: "0.35em",
    width: "8.5rem",
  };

  const digitsOnly = (v: string) => v.replace(/\D/g, "").slice(0, 4);

  const unlock = () => {
    if (verifyParentPin(current)) {
      setRestricted(false);
      setCurrent("");
      setWrong(false);
      toast(t("elev.gate.unlocked"), "success");
    } else {
      setWrong(true);
      setCurrent("");
    }
  };

  const save = () => {
    if (pinSet && current !== readParentPin()) {
      setWrong(true);
      setCurrent("");
      return;
    }
    if (!isPinShape(next)) {
      setWrong(true);
      return;
    }
    saveParentPin(next);
    setPinSet(true);
    setCurrent("");
    setNext("");
    setWrong(false);
    toast(t("elev.gate.set.saved"), "success");
  };

  if (restricted && !pinSet) {
    return (
      <p className="text-xs leading-relaxed" style={{ color: "var(--arbor-muted)" }}>
        {t("elev.gate.set.blockedSetup")}
      </p>
    );
  }

  if (restricted) {
    return (
      <div className="space-y-2">
        <p className="text-xs leading-relaxed" style={{ color: "var(--arbor-muted)" }}>{t("elev.gate.blocked")}</p>
        <div className="flex items-center gap-2 flex-wrap">
          <input
            type="password"
            inputMode="numeric"
            autoComplete="off"
            maxLength={4}
            value={current}
            onChange={(e) => { setCurrent(digitsOnly(e.target.value)); setWrong(false); }}
            aria-label={t("elev.gate.pinAria")}
            aria-invalid={wrong || undefined}
            style={fieldStyle}
          />
          <button onClick={unlock} className="text-xs font-bold rounded-xl px-3 py-2" style={{ background: "var(--arbor-clay)", color: "var(--arbor-on-accent)" }}>
            {t("elev.gate.unlock")}
          </button>
        </div>
        {wrong && <p className="text-xs font-semibold" style={{ color: "var(--arbor-pink-ink)" }}>{t("elev.gate.pinWrong")}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs leading-relaxed" style={{ color: "var(--arbor-muted)" }}>{t("elev.gate.setPinHint")}</p>
      <div className="flex items-center gap-2 flex-wrap">
        {pinSet && (
          <input
            type="password"
            inputMode="numeric"
            autoComplete="off"
            maxLength={4}
            value={current}
            onChange={(e) => { setCurrent(digitsOnly(e.target.value)); setWrong(false); }}
            aria-label={t("elev.gate.set.currentAria")}
            aria-invalid={wrong || undefined}
            style={fieldStyle}
          />
        )}
        <input
          type="password"
          inputMode="numeric"
          autoComplete="off"
          maxLength={4}
          value={next}
          onChange={(e) => { setNext(digitsOnly(e.target.value)); setWrong(false); }}
          aria-label={t("elev.gate.setPinAria")}
          style={fieldStyle}
        />
        <button onClick={save} className="text-xs font-bold rounded-xl px-3 py-2" style={{ background: "var(--arbor-clay)", color: "var(--arbor-on-accent)" }}>
          {t(pinSet ? "elev.gate.set.change" : "elev.gate.set.cta")}
        </button>
      </div>
      {wrong && <p className="text-xs font-semibold" style={{ color: "var(--arbor-pink-ink)" }}>{t("elev.gate.pinWrong")}</p>}
    </div>
  );
}

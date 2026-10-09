import React, { useState } from "react";
import { Icon } from "../ui/Icon";
import { Modal } from "../ui/Modal";
import { Sheet } from "../ui/Sheet";
import { useProfile } from "../../context/ProfileContext";
import { useToast } from "../../context/ToastContext";
import { useLanguage } from "../../context/LanguageContext";
import { useArbor } from "../../context/ArborContext";
import { useEntitlement, childLimitReached, PAID_PLAN_LIMITS } from "../../hooks/useEntitlement";
import { buildNewChildInput } from "../../lib/childProfileInput";
import { PlanBadge } from "../ui/PlanBadge";
// B-SHELL-17: Add child IS onboarding steps 2–3 — the SAME StepChild (one age
// field: years + months, the controller-consent affirmation, LegalLinks) and
// the SAME StepDomains, rendered in a Sheet. No second form, no second age
// control. Strengths live in the profile drawer (ProfileEditDrawer), their
// named home; the avatar is out of scope (made in Wow / at the Kid Mode door).
import { StepChild, StepDomains, DOMAINS } from "../auth/OnboardingFlow";

export default function AddChildModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { addChild, profiles } = useProfile();
  const { toast } = useToast();
  const { t } = useLanguage();
  const { entitlement, loading: entitlementLoading } = useEntitlement();
  const { openPaywall } = useArbor();
  // MON-1: multi-child is a Plus feature once entitlements are enforced.
  // MOB-08: never hard-gate on the client fallback / while loading — a Plus
  // family on a flaky connection must not be told "one child only".
  const atChildLimit = childLimitReached({ entitlement, loading: entitlementLoading, childCount: profiles.length });
  const [step, setStep] = useState<"child" | "domains">("child");
  const [name, setName] = useState("");
  const [ageYears, setAgeYears] = useState(4);
  const [ageMonthsPart, setAgeMonthsPart] = useState(0);
  const [birthDate, setBirthDate] = useState("");
  const [languages, setLanguages] = useState<string[]>([]);
  const [controllerConsent, setControllerConsent] = useState(false);
  const [selectedDomains, setSelectedDomains] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setStep("child");
    setName("");
    setAgeYears(4);
    setAgeMonthsPart(0);
    setBirthDate("");
    setLanguages([]);
    setControllerConsent(false);
    setSelectedDomains([]);
    setSaving(false);
  };

  const close = () => {
    reset();
    onClose();
  };

  /** Step 3's choices become the profile's focus areas, named exactly as onboarding names them. */
  const finish = async () => {
    // StepChild already refuses to advance without a name and the consent box.
    if (!name.trim() || !controllerConsent || saving) return;
    setSaving(true);
    try {
      const challenges = selectedDomains.map((id) => {
        const d = DOMAINS.find((x) => x.id === id);
        return d ? t(d.nameKey) : id;
      });
      const input = buildNewChildInput({
        name, ageMonths: ageYears * 12 + ageMonthsPart, gender: "unspecified", languages,
        strengthsText: "", challengesText: challenges.join("\n"),
      });
      const childName = input.name;
      await addChild({ ...input, ...(birthDate ? { birthDate } : {}) });
      toast(t("ac.addedToast", { name: childName }), "success");
      close();
    } finally {
      setSaving(false);
    }
  };

  if (atChildLimit) {
    return (
      <Modal open={open} onClose={close} title={t("ac.title")}>
        <div className="space-y-4 text-sm">
          <div className="rounded-2xl p-4 flex items-start gap-3" style={{ background: "linear-gradient(120deg,var(--arbor-paper-tinted),var(--arbor-lav-soft))", border: "1px solid var(--arbor-rule)" }}>
            <span className="inline-flex items-center justify-center w-8 h-8 rounded-xl flex-shrink-0" style={{ background: "var(--arbor-paper-elevated)", color: "var(--arbor-green-ink)" }}><Icon name="auto_awesome" size={16} /></span>
            <div>
              {/* 3.6 — the at-limit state names its gate: multi-child is a Plus feature. */}
              <p className="font-bold flex items-center gap-2 flex-wrap" style={{ color: "var(--arbor-ink)" }}>
                {t("ac.limitTitle")}
                <PlanBadge feature="maxChildren" />
              </p>
              {/* MOB-13: the Plus limit comes from the ONE client mirror pinned to
                  server PLAN_LIMITS (useEntitlement.test.ts), never a literal. */}
              <p className="text-xs mt-1 leading-relaxed" style={{ color: "var(--arbor-muted)" }}>
                {t("ac.limitBody", { max: PAID_PLAN_LIMITS.maxChildren })}
              </p>
              {/* MOB-13: soft gate that SELLS — the real paywall (Stripe/StoreKit
                  live), not a "we'll let you know" toast nobody follows up. */}
              <button type="button" onClick={() => { close(); openPaywall("maxChildren", "plus"); }} className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold rounded-xl px-3 py-2 min-h-[44px]" style={{ background: "var(--arbor-clay)", color: "var(--arbor-on-accent)" }}>
                {t("elev.storeshell.ac.seePlus")}
              </button>
            </div>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Sheet open={open} onClose={close} title={t("ac.title")}>
      <div data-testid="add-child-sheet">
        {step === "child" ? (
          <StepChild
            name={name} setName={setName}
            ageYears={ageYears} setAgeYears={setAgeYears}
            ageMonthsPart={ageMonthsPart} setAgeMonthsPart={setAgeMonthsPart}
            birthDate={birthDate} setBirthDate={setBirthDate}
            languages={languages} setLanguages={setLanguages}
            controllerConsent={controllerConsent} setControllerConsent={setControllerConsent}
            creating={saving}
            onNext={() => setStep("domains")}
          />
        ) : (
          <StepDomains
            selectedDomains={selectedDomains}
            setSelectedDomains={setSelectedDomains}
            onNext={() => void finish()}
            onSkip={() => void finish()}
          />
        )}
      </div>
    </Sheet>
  );
}

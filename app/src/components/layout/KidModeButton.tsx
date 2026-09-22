import { useState } from "react";
import { Icon } from "../ui/Icon";
import { useKidMode } from "../kidmode/KidModeContext";
import { useLanguage } from "../../context/LanguageContext";
import { useArborOptional } from "../../context/ArborContext";
import { resolveHeroUrl } from "../ui/HeroAvatar";
import HeroFirstStep from "../kidmode/HeroFirstStep";
import { markHeroStepOffered, shouldOfferHeroStep } from "../kidmode/heroPromptGate";

/**
 * The single affordance to hand the device to the child (enter Kid Mode).
 *
 * `compact` renders the mobile icon-button (matches the Settings / Search
 * accessory buttons in the in-content header). The default is the labelled
 * desktop pill rendered in the Topbar.
 *
 * Sapphire, on-brand — the previous green fill was the P1.0 split-brand defect
 * (active nav was green while the brand is sapphire). Must live inside
 * <KidModeProvider> (Topbar + the in-content accessories row both qualify).
 */
export default function KidModeButton({ compact = false, onBeforeOpen }: { compact?: boolean; onBeforeOpen?: () => void }) {
  const { openKidMode } = useKidMode();
  const { t } = useLanguage();
  // M4: the ONE parent-side step before hand-over. Optional context so the
  // button stays renderable outside ArborProvider (it behaves exactly as
  // before there — straight into Kid Mode).
  const arbor = useArborOptional();
  const child = arbor?.childProfile;
  const [stepOpen, setStepOpen] = useState(false);

  // E10: the parent-lock safety line — ships true because kid-mode exit is
  // gated by the parent challenge (hold → question/PIN → exit).
  const lockedLine = t("elev.kidmode.locked");
  const handleOpen = () => {
    // Hero-first: a child with no hero gets their parent one step first —
    // offered once per session per child, never a block on the child.
    // onBeforeOpen (the mobile sheet's close) is deliberately NOT fired yet:
    // it unmounts this button, and with it the step it is about to show.
    if (child && shouldOfferHeroStep({ childId: child.id, hasHero: Boolean(resolveHeroUrl(child)) })) {
      markHeroStepOffered(child.id);
      setStepOpen(true);
      return;
    }
    onBeforeOpen?.();
    openKidMode();
  };
  const enterKidMode = () => { setStepOpen(false); onBeforeOpen?.(); openKidMode(); };
  // Rendered beside the button so both the compact and the labelled pill get it.
  const step = child ? (
    <HeroFirstStep
      open={stepOpen}
      childId={child.id}
      childName={child.name}
      onEnterKidMode={enterKidMode}
      onClose={() => setStepOpen(false)}
    />
  ) : null;

  if (compact) {
    return (
      <>
      {step}
      <button
        onClick={handleOpen}
        aria-label={`${t("aria.kidMode")} — ${lockedLine}`}
        title={`${t("aria.kidMode")} — ${lockedLine}`}
        className="lg:hidden flex items-center justify-center w-11 h-11 rounded-xl transition bg-white"
        style={{ color: "var(--arbor-clay-deep)", border: "1px solid var(--arbor-rule)" }}
      >
        <Icon name="sports_esports" size={18} />
      </button>
      </>
    );
  }

  return (
    <>
    {step}
    <button
      onClick={handleOpen}
      aria-label={`${t("aria.launchKidMode")} — ${lockedLine}`}
      title={`${t("aria.launchKidMode")} — ${lockedLine}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        paddingInline: "14px",
        paddingBlock: "4px",
        minHeight: "44px",
        minWidth: "44px",
        borderRadius: "var(--r)",
        fontWeight: 800,
        fontSize: "var(--t-sm)",
        background: "var(--arbor-clay-dim)",
        color: "var(--arbor-clay-deep)",
        border: "1px solid var(--arbor-clay-border)",
        cursor: "pointer",
        whiteSpace: "nowrap",
        transition: "background 120ms",
        textAlign: "start",
      }}
    >
      <Icon name="sports_esports" size={16} />
      <span style={{ display: "flex", flexDirection: "column", lineHeight: 1.25 }}>
        <span>{t("aria.kidMode")}</span>
        {/* Safety line — visible on wide topbars; always in the aria-label. */}
        <span
          className="hidden xl:block"
          style={{ fontSize: "var(--t-xs)", fontWeight: 600, opacity: 0.8 }}
        >
          {lockedLine}
        </span>
      </span>
    </button>
    </>
  );
}

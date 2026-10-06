import { Icon } from "../ui/Icon";
import { useLanguage } from "../../context/LanguageContext";
import { useKidModeEntry } from "../kidmode/useKidModeEntry";
import { readParentPin } from "../kidmode/parentGate";
import { useArborOptional } from "../../context/ArborContext";
import { kidModeOpenFor } from "../../lib/age/playGate";

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
  const { t } = useLanguage();
  // M4 / B-KID-11: the ONE parent-side step before hand-over lives in the
  // shared entry seam (hero-first once per session, then Kid Mode opens).
  const { request, step } = useKidModeEntry(onBeforeOpen);
  const handleOpen = () => request();

  // E10: the parent-lock safety line — the honest one: a grown-up gate
  // (hold → question), a lock only once a PIN is set (practice critic r2).
  const lockedLine = t(readParentPin() ? "elev.kidmode.locked" : "elev.kidmode.gated");

  // B-PLAY-24: under three the door is hidden, not removed (Practice says
  // "From 3, {name} can play on her own"). No profile in scope = shown as before.
  const child = useArborOptional()?.childProfile;
  if (child && !kidModeOpenFor(child)) return <>{step}</>;

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

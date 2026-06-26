import { Gamepad2 } from "lucide-react";
import { useKidMode } from "../kidmode/KidModeContext";
import { useLanguage } from "../../context/LanguageContext";

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
export default function KidModeButton({ compact = false }: { compact?: boolean }) {
  const { openKidMode } = useKidMode();
  const { t } = useLanguage();

  if (compact) {
    return (
      <button
        onClick={openKidMode}
        aria-label={t("aria.kidMode")}
        title="Kid Mode — hand the device to your child"
        className="md:hidden flex items-center justify-center w-11 h-11 rounded-xl transition bg-white"
        style={{ color: "var(--arbor-clay-deep)", border: "1px solid var(--arbor-rule)" }}
      >
        <Gamepad2 className="w-4 h-4" />
      </button>
    );
  }

  return (
    <button
      onClick={openKidMode}
      aria-label={t("aria.launchKidMode")}
      title="Kid Mode — hand the device to your child"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        paddingInline: "14px",
        paddingBlock: "0",
        height: "40px",
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
      }}
    >
      <Gamepad2 aria-hidden="true" style={{ width: "16px", height: "16px", flexShrink: 0 }} />
      <span>Kid Mode</span>
    </button>
  );
}

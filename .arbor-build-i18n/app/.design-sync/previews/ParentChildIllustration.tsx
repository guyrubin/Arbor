import { ParentChildIllustration } from "arbor-private-beta-app";

export function Default() {
  return (
    <div style={{ background: "var(--arbor-paper)", padding: 24, borderRadius: 24, display: "flex", justifyContent: "center" }}>
      <ParentChildIllustration size={120} />
    </div>
  );
}

export function Sizes() {
  return (
    <div style={{ background: "var(--arbor-paper)", padding: 24, borderRadius: 24, display: "flex", alignItems: "flex-end", gap: 18, justifyContent: "center" }}>
      <ParentChildIllustration size={56} />
      <ParentChildIllustration size={88} />
      <ParentChildIllustration size={120} />
    </div>
  );
}

export function SafetyBar() {
  return (
    <div style={{ maxWidth: 460, background: "var(--arbor-green-soft)", padding: 20, borderRadius: 24, display: "flex", alignItems: "center", gap: 18 }}>
      <ParentChildIllustration size={84} />
      <div>
        <div style={{ fontFamily: "var(--font-display)", fontSize: 17, fontWeight: 600, color: "var(--arbor-ink)" }}>
          We're here to listen
        </div>
        <p style={{ margin: "4px 0 0", fontFamily: "var(--font-sans)", fontSize: 13, lineHeight: 1.5, color: "var(--arbor-muted)" }}>
          Arbor supports your parenting — it never replaces your pediatrician. Worried about something? Talk to your doctor.
        </p>
      </div>
    </div>
  );
}

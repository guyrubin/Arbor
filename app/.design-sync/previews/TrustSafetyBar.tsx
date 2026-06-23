import { TrustSafetyBar } from "arbor-private-beta-app";

export function Low() {
  return (
    <div style={{ minWidth: 520, background: "var(--arbor-paper)", padding: 24, borderRadius: 24 }}>
      <TrustSafetyBar
        risk="Low"
        note="Mia's pattern looks typical for her age"
      />
    </div>
  );
}

export function Moderate() {
  return (
    <div style={{ minWidth: 520, background: "var(--arbor-paper)", padding: 24, borderRadius: 24 }}>
      <TrustSafetyBar
        risk="Moderate"
        note="A few language signals worth keeping an eye on"
        onEscalate={() => {}}
      />
    </div>
  );
}

export function High() {
  return (
    <div style={{ minWidth: 520, background: "var(--arbor-paper)", padding: 24, borderRadius: 24 }}>
      <TrustSafetyBar
        risk="High"
        note="We'd gently suggest a conversation with your pediatrician"
        onEscalate={() => {}}
      />
    </div>
  );
}

export function Stacked() {
  return (
    <div style={{ minWidth: 520, background: "var(--arbor-paper)", padding: 24, borderRadius: 24, display: "flex", flexDirection: "column", gap: 12 }}>
      <TrustSafetyBar risk="Low" />
      <TrustSafetyBar risk="Moderate" onEscalate={() => {}} />
      <TrustSafetyBar risk="High" note="Support is one tap away" onEscalate={() => {}} />
    </div>
  );
}

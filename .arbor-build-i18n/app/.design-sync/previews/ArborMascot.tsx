import { ArborMascot } from "arbor-private-beta-app";

export function Happy() {
  return (
    <div style={{ background: "var(--arbor-paper)", padding: 24, borderRadius: 24, display: "flex", justifyContent: "center" }}>
      <ArborMascot size={120} mood="happy" />
    </div>
  );
}

export function MoodRange() {
  return (
    <div style={{ background: "var(--arbor-paper)", padding: 24, borderRadius: 24, display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
      {(["happy", "cheer", "proud", "think", "wave", "calm"] as const).map((m) => (
        <div key={m} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, width: 92 }}>
          <ArborMascot size={84} mood={m} />
          <span style={{ fontFamily: "var(--font-sans)", fontSize: 11, fontWeight: 700, color: "var(--arbor-muted)", textTransform: "capitalize" }}>
            {m}
          </span>
        </div>
      ))}
    </div>
  );
}

export function CoachCard() {
  return (
    <div style={{ maxWidth: 440, background: "var(--arbor-paper-elevated)", padding: 20, borderRadius: 24, display: "flex", alignItems: "center", gap: 16, boxShadow: "0 10px 30px rgba(41,51,63,0.06)" }}>
      <ArborMascot size={88} mood="wave" />
      <div>
        <div style={{ fontFamily: "var(--font-display)", fontSize: 17, fontWeight: 600, color: "var(--arbor-ink)" }}>
          Ready for today's word?
        </div>
        <p style={{ margin: "4px 0 0", fontFamily: "var(--font-sans)", fontSize: 13, lineHeight: 1.5, color: "var(--arbor-muted)" }}>
          I'm Sprout. Let's practice "more" together — just one little try.
        </p>
      </div>
    </div>
  );
}

export function Celebration() {
  return (
    <div style={{ maxWidth: 360, background: "var(--arbor-green-soft)", padding: 24, borderRadius: 24, display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
      <ArborMascot size={104} mood="proud" />
      <div style={{ fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 600, color: "var(--arbor-ink)" }}>
        You did it!
      </div>
      <span style={{ fontFamily: "var(--font-sans)", fontSize: 13, color: "var(--arbor-muted)" }}>
        That's 3 new words this week.
      </span>
    </div>
  );
}

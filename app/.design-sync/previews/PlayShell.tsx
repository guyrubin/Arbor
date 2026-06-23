import { PlayShell, PlayPanel, MascotSay, StatBubble, ProgressPips, ChoiceTile } from "arbor-private-beta-app";

export function PracticeStudio() {
  return (
    <div style={{ background: "var(--arbor-paper)", padding: 24, borderRadius: 24, maxWidth: 640 }}>
      <PlayShell>
        <MascotSay mood="wave" tone="clay">
          Let's practice sounds, Mia! Three quick games — ready when you are.
        </MascotSay>
        <PlayPanel tone="lav">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
            <ProgressPips total={5} current={1} tone="lav" />
            <div style={{ display: "flex", gap: 12 }}>
              <StatBubble value="2" label="Games left" tone="sky" />
              <StatBubble value="4⭐" label="Earned today" tone="yellow" />
            </div>
          </div>
        </PlayPanel>
      </PlayShell>
    </div>
  );
}

export function ChoiceRound() {
  return (
    <div style={{ background: "var(--arbor-paper)", padding: 24, borderRadius: 24, maxWidth: 640 }}>
      <PlayShell>
        <MascotSay mood="happy" tone="peach">
          Tap the picture that starts with the "b" sound!
        </MascotSay>
        <PlayPanel>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
            <ChoiceTile emoji="🫧" label="Bubble" state="correct" />
            <ChoiceTile emoji="🍎" label="Apple" state="dim" />
            <ChoiceTile emoji="🐝" label="Bee" state="dim" />
          </div>
        </PlayPanel>
      </PlayShell>
    </div>
  );
}

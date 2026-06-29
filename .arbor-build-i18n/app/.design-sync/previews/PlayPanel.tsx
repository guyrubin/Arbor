import { PlayPanel, MascotSay, ProgressPips, PlayButton, StatBubble } from "arbor-private-beta-app";
import { Star } from "lucide-react";

export function Plain() {
  return (
    <div style={{ background: "var(--arbor-paper)", padding: 24, borderRadius: 24, maxWidth: 480 }}>
      <PlayPanel>
        <h3 style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)", fontSize: 20, margin: "0 0 8px" }}>
          Which animal says "moo"?
        </h3>
        <p style={{ color: "var(--arbor-muted)", fontSize: 14, lineHeight: 1.6, margin: 0 }}>
          Listen to the sound, then tap the picture. There's no wrong way to play.
        </p>
        <div style={{ marginTop: 16 }}>
          <ProgressPips total={4} current={2} tone="sky" />
        </div>
      </PlayPanel>
    </div>
  );
}

export function TintedLav() {
  return (
    <div style={{ background: "var(--arbor-paper)", padding: 24, borderRadius: 24, maxWidth: 480 }}>
      <PlayPanel tone="lav">
        <MascotSay mood="proud" tone="lav">
          You matched four sounds in a row — that's a brand-new high score!
        </MascotSay>
        <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
          <StatBubble value="12" label="Words today" tone="lav" />
          <StatBubble value="100%" label="Matched" tone="peach" />
        </div>
      </PlayPanel>
    </div>
  );
}

export function TintedPeach() {
  return (
    <div style={{ background: "var(--arbor-paper)", padding: 24, borderRadius: 24, maxWidth: 480 }}>
      <PlayPanel tone="peach">
        <h3 style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)", fontSize: 20, margin: "0 0 12px" }}>
          Today's reward
        </h3>
        <p style={{ color: "var(--arbor-muted)", fontSize: 14, lineHeight: 1.6, margin: "0 0 16px" }}>
          Finish one more game to unlock a new sticker for your collection.
        </p>
        <PlayButton tone="peach" size="md">
          <Star size={18} /> Keep going
        </PlayButton>
      </PlayPanel>
    </div>
  );
}

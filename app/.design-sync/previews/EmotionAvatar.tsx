import { EmotionAvatar } from "arbor-private-beta-app";

export function Happy() {
  return (
    <div style={{ background: "var(--arbor-paper)", padding: 24, borderRadius: 24, display: "flex", justifyContent: "center" }}>
      <EmotionAvatar name="Mia Levi" emotionEmoji="😊" emotionLabel="Happy" color="var(--arbor-clay)" size={88} />
    </div>
  );
}

export function FeelingsRow() {
  return (
    <div style={{ background: "var(--arbor-paper)", padding: 24, borderRadius: 24, display: "flex", flexWrap: "wrap", gap: 20, justifyContent: "center" }}>
      <EmotionAvatar name="Mia Levi" emotionEmoji="😊" emotionLabel="Happy" color="#34b277" size={72} />
      <EmotionAvatar name="Noa Cohen" emotionEmoji="😢" emotionLabel="Sad" color="#5b8fd6" size={72} />
      <EmotionAvatar name="Eli Roth" emotionEmoji="😠" emotionLabel="Frustrated" color="#e0784a" size={72} />
      <EmotionAvatar name="Yael Bar" emotionEmoji="😨" emotionLabel="Scared" color="#9a7ad8" size={72} />
      <EmotionAvatar name="Tom Adler" emotionEmoji="🤩" emotionLabel="Excited" color="#e6a23c" size={72} />
    </div>
  );
}

export function Plain() {
  return (
    <div style={{ background: "var(--arbor-paper)", padding: 24, borderRadius: 24, display: "flex", justifyContent: "center" }}>
      <EmotionAvatar name="Mia Levi" size={80} color="var(--arbor-clay)" />
    </div>
  );
}

export function LabPrompt() {
  return (
    <div style={{ maxWidth: 380, background: "var(--arbor-paper-elevated)", padding: 22, borderRadius: 24, display: "flex", alignItems: "center", gap: 18, boxShadow: "0 10px 30px rgba(41,51,63,0.06)" }}>
      <EmotionAvatar name="Mia Levi" emotionEmoji="😢" emotionLabel="Sad" color="#5b8fd6" size={84} />
      <div>
        <div style={{ fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 600, color: "var(--arbor-ink)" }}>
          When do you feel sad?
        </div>
        <p style={{ margin: "4px 0 0", fontFamily: "var(--font-sans)", fontSize: 13, lineHeight: 1.5, color: "var(--arbor-muted)" }}>
          Let's name it together in the Feelings Lab.
        </p>
      </div>
    </div>
  );
}

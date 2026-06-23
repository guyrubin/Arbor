import { MascotSay } from "arbor-private-beta-app";

export function Greeting() {
  return (
    <div style={{ background: "var(--arbor-paper)", padding: 24, borderRadius: 24, maxWidth: 440 }}>
      <MascotSay mood="happy" tone="clay">
        Let's warm up our voices! Can you say "bubble" with me?
      </MascotSay>
    </div>
  );
}

export function Encouragement() {
  return (
    <div style={{ background: "var(--arbor-paper)", padding: 24, borderRadius: 24, maxWidth: 440 }}>
      <MascotSay mood="proud" tone="lav">
        So close! The 'k' sound lives at the back of your throat — try again with me.
      </MascotSay>
    </div>
  );
}

export function Thinking() {
  return (
    <div style={{ background: "var(--arbor-paper)", padding: 24, borderRadius: 24, maxWidth: 440 }}>
      <MascotSay mood="think" tone="sky">
        Hmm, which one starts with "ssss" like a snake? Take your time.
      </MascotSay>
    </div>
  );
}

export function Cheer() {
  return (
    <div style={{ background: "var(--arbor-paper)", padding: 24, borderRadius: 24, maxWidth: 440 }}>
      <MascotSay mood="cheer" tone="peach" size={64}>
        You did it! Every sound was perfect. I'm so proud of you, Mia.
      </MascotSay>
    </div>
  );
}

import React from "react";
import { talkCopy } from "./talkViewCopy";

/**
 * v10.3 (N-Talk boards) — once, above the conversation: the answer's four
 * numbered stops (your question, what Arbor used, Arbor's answer, steps) and
 * the small palette key of how each kind is drawn. Shown only when the
 * conversation is expanded (companionWorkspace.css); beside a page or on a
 * phone the thread stays as it is. Decoration and words only: no control.
 */
export default function TalkReadingKey({ lang }: { lang: "en" | "he" }) {
  const copy = talkCopy(lang);
  const keys: Array<[keyof typeof copy.keys, string]> = [
    ["question", "q"], ["source", "src"], ["draft", "ai"], ["kept", "kept"], ["suggested", "sug"], ["plan", "plan"],
  ];
  return (
    <div className="talk-read" data-testid="talk-reading-key">
      <ol className="talk-read-guide" aria-label={copy.guideLabel}>
        {copy.stops.map((stop, i) => (
          <li key={stop} className={i === 0 ? "on" : undefined}>
            <span className="talk-read-num" aria-hidden="true">{i + 1}</span>
            <span><b>{stop}</b><small>{copy.stopSubs[i]}</small></span>
          </li>
        ))}
      </ol>
      <div className="talk-read-key" role="list" aria-label={copy.keyLabel}>
        {keys.map(([k, sw]) => (
          <span role="listitem" key={k}><i className={`talk-sw ${sw}`} aria-hidden="true" />{copy.keys[k]}</span>
        ))}
      </div>
    </div>
  );
}

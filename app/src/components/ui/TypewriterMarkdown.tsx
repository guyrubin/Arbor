import React, { useEffect, useRef, useState } from "react";
import { MarkdownBlock } from "./MarkdownBlock";

/**
 * Reveals markdown text progressively for a "streaming" feel. The Parent Coach
 * response is a structured JSON contract rendered at the end, so true token
 * streaming isn't possible; this gives the perceived-streaming benefit on the
 * final text. When `enabled` is false the full text renders immediately.
 */
export function TypewriterMarkdown({
  text,
  enabled,
  onDone,
  className,
}: {
  text: string;
  enabled: boolean;
  onDone?: () => void;
  className?: string;
}) {
  const [len, setLen] = useState(enabled ? 0 : text.length);
  const doneRef = useRef(false);

  useEffect(() => {
    if (!enabled) {
      setLen(text.length);
      return;
    }
    doneRef.current = false;
    let i = 0;
    // Finish in ~2s regardless of length.
    const step = Math.max(2, Math.round(text.length / 120));
    const id = setInterval(() => {
      i += step;
      if (i >= text.length) {
        setLen(text.length);
        clearInterval(id);
        if (!doneRef.current) {
          doneRef.current = true;
          onDone?.();
        }
      } else {
        setLen(i);
      }
    }, 16);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, enabled]);

  return <MarkdownBlock text={text.slice(0, len)} className={className} />;
}

export default TypewriterMarkdown;

import React, { useMemo, useState } from "react";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { fmtDay } from "../../lib/formatDate";
import { scrubMemoryProposals } from "../../server/parentWordsScrub";
import type { MemoryReviewItem } from "../../types";
import { BrandChip } from "../ui/BrandChip";
import Icon from "../ui/Icon";
import { LEARNED_COPY } from "./nowV41Copy";
import "./nowV41.css";

/* ════════════════════════════════════════════════════════════════════════════
   v4.1 Arbor learned this week — on Now, under the plan.

   The memory proposals of the last seven days that wait for the parent, at
   most two, each in the scrubbed parent-words version (B-CAREPRO-06) with
   where it came from. "That's right" / "Not quite" are About's own
   handleMemoryDecision (approved / rejected): one write path, and a row
   settles only after the server confirms, then shows Kept or Removed. Older
   proposals stay in About's notebook. Nothing waiting this week: no card.
   ════════════════════════════════════════════════════════════════════════════ */

const SHOWN = 2;
const WEEK_MS = 7 * 86_400_000;
const CONVERSATION_SOURCES: ReadonlySet<string> = new Set(["chat", "coach", "conversation", "journal"]);

/** The pending proposals created in the seven days before `now`, newest first. */
export function learnedThisWeek(pending: readonly MemoryReviewItem[], now: number): MemoryReviewItem[] {
  return scrubMemoryProposals([...pending])
    .filter((m) => {
      const at = m.createdAt ? Date.parse(m.createdAt) : NaN;
      return m.status === "pending" && Number.isFinite(at) && at <= now && now - at <= WEEK_MS;
    })
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export default function NowLearned({ now }: { now: Date }) {
  const { pendingMemoryItems, handleMemoryDecision, isMemoryUpdating } = useArbor();
  const { t, uiLang } = useLanguage();
  const lang = uiLang === "he" ? "he" : "en";
  const copy = LEARNED_COPY[lang];
  const [decided, setDecided] = useState<{ item: MemoryReviewItem; status: "approved" | "rejected" }[]>([]);
  const [failed, setFailed] = useState<string | null>(null);
  // The week is read once an hour, not per render.
  const hourStamp = Math.floor(now.getTime() / 3_600_000);
  const fresh = useMemo(() => learnedThisWeek(pendingMemoryItems ?? [], now.getTime()), [pendingMemoryItems, hourStamp]);
  const decidedIds = new Set(decided.map((d) => d.item.memoryId));
  const rows = [
    ...decided.slice(0, SHOWN).map((d) => ({ item: d.item, status: d.status as "approved" | "rejected" | null })),
    ...fresh.filter((m) => !decidedIds.has(m.memoryId)).slice(0, Math.max(0, SHOWN - decided.length)).map((item) => ({ item, status: null })),
  ];
  if (rows.length === 0) return null;

  const source = (m: MemoryReviewItem) => {
    const day = m.createdAt ? fmtDay(m.createdAt, uiLang) : null;
    if (CONVERSATION_SOURCES.has(m.source)) return day ? t("companion.about.memory.fromTalk", { date: day }) : t("companion.about.memory.fromTalkUndated");
    return day ? t("companion.about.srcNoted", { date: day }) : t("companion.about.srcNotedUndated");
  };
  const decide = async (item: MemoryReviewItem, status: "approved" | "rejected") => {
    setFailed(null);
    let ok = false;
    try { ok = await handleMemoryDecision(item.memoryId, status); } catch { ok = false; }
    if (ok) setDecided((list) => (list.some((d) => d.item.memoryId === item.memoryId) ? list : [...list, { item, status }]));
    else setFailed(item.memoryId);
  };

  return <section className="now-learned arbor-fade" data-module="now-learned" aria-labelledby="now-learned-title">
    <div className="now-learned-head">
      <BrandChip icon="psychology" tone="lav" size={34} />
      <div className="now-learned-titles">
        <h2 id="now-learned-title">{copy.title}</h2>
        <p>{copy.sub}</p>
      </div>
    </div>
    <ul className="now-learned-rows" role="list">
      {rows.map(({ item, status }) => {
        const busy = isMemoryUpdating === item.memoryId;
        return <li key={item.memoryId} className="now-learned-row" data-testid="now-learned-row" data-status={status ?? "pending"}>
          <p className="now-learned-fact" dir="auto">{item.fact}</p>
          <p className="now-learned-src">{source(item)}</p>
          {status ? <span className="now-learned-chip arbor-pop" data-status={status} role="status">
            <Icon name={status === "approved" ? "check_circle" : "check"} size={18} fill={status === "approved" ? 1 : 0} />{status === "approved" ? copy.kept : copy.removed}
          </span> : <span className="now-learned-actions">
            <button type="button" className="now-learned-yes arbor-press" data-testid="now-learned-yes" disabled={busy} onClick={() => void decide(item, "approved")}>
              <Icon name="check" size={18} />{copy.right}
            </button>
            <button type="button" className="now-learned-no arbor-press" data-testid="now-learned-no" disabled={busy} onClick={() => void decide(item, "rejected")}>{copy.notQuite}</button>
          </span>}
          {failed === item.memoryId && <p className="now-learned-failed" role="alert">{t("companion.about.memory.failed")}</p>}
        </li>;
      })}
    </ul>
  </section>;
}

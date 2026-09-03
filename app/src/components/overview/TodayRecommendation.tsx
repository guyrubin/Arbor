import React, { useEffect, useRef, useState } from "react";
import { Icon } from "../ui/Icon";
import { Skeleton } from "../ui/Skeleton";
import { capacityMinutes, type ActionCapacity } from "../../actionLoop/model";
import { trackActionOffered } from "../../lib/loopEvents";
import { ContentWhyLine } from "../ui/ContentActionBar";
import { TrustLink } from "../trust/TrustLink";

/**
 * TODAY-2/CODEX-1 consolidation: the pre-accept half of the old TodayActionLoop
 * card (capacity chips + "Make this today's step") now lives INSIDE this hero,
 * so pre-accept Today carries exactly ONE gradient-primary CTA and the focus
 * headline renders exactly once. When `accept` is provided the accept button is
 * the single gradient primary and "Begin" (coach seed) demotes to a secondary
 * outline button; without `accept` (day-0 / no real AI focus — the TODAY-1
 * guard upstream) "Begin" stays the lone primary and acceptTodayAction is
 * unreachable, so fallback copy can never be persisted into actionLoops.
 */
export default function TodayRecommendation({ eyebrow, headline, body, meta, action, loading, onBegin, accept, why }: {
  eyebrow: string;
  /** TJB-02: the model's ONE doable step (`tryToday`) — what the capacity
   *  chips + accept attach to and what acceptTodayAction persists. */
  headline: string;
  /** TJB-02: the model's observation (`focus`) rendered UNDER the step as
   *  context — never the thing that gets accepted. */
  body?: string;
  meta: string;
  action: string;
  loading: boolean;
  onBegin: () => void;
  /** Pre-accept action row (TODAY-2): present ONLY with a real AI focus headline. */
  accept?: { label: string; lengthAria: string; minUnit: string; onAccept: (capacity: ActionCapacity) => void };
  /** Masterplan 3.1 why-line text. When the caller owns the why copy it renders
   *  INSIDE the card through the shared ContentWhyLine slot; when it is omitted
   *  the TrustLink still mounts on its own so the why → Trust Center chain is
   *  never missing from this surface. */
  why?: string;
}) {
  const [capacity, setCapacity] = useState<ActionCapacity>("standard");
  // N8 KPI 3a: the offer moment — the accept row actually rendered (real AI
  // focus, TODAY-1 guard upstream). Once per hero instance; the headline text
  // itself never rides on the event (surface id only).
  const offeredTracked = useRef(false);
  const offered = !!accept;
  useEffect(() => {
    if (offered && !offeredTracked.current) {
      offeredTracked.current = true;
      trackActionOffered("today-hero");
    }
  }, [offered]);
  // Exactly one gradient-primary CTA per state: accept when offered, Begin otherwise.
  const primary = accept
    ? { label: accept.label, onClick: () => accept.onAccept(capacity), testid: "today-accept-cta" }
    : { label: action, onClick: onBegin, testid: "today-guidance-cta" };

  return (
    <section className="overflow-hidden rounded-[20px]" style={{ background: "var(--arbor-paper-elevated)", border: "1px solid var(--arbor-rule)" }}>
      <div className="grid min-h-[164px] grid-cols-1 sm:grid-cols-[180px_minmax(0,1fr)]">
        {/* CODEX-3: decorative hero art re-encoded 2.6MB PNG → ~56KB 800px WebP
            (crisp at 2x in the 180px column; ffmpeg libwebp q82). */}
        <div aria-hidden="true" className="min-h-[132px] bg-cover bg-center" style={{ backgroundImage: "url('/assets/today/calm-transition-activity.webp')" }} />
        <div className="flex min-w-0 flex-col justify-center p-5 sm:px-6">
          <span className="text-[10px] font-extrabold uppercase tracking-[0.13em]" style={{ color: "var(--arbor-green-ink)" }}>{eyebrow}</span>
          {loading ? <div className="mt-2 space-y-2"><Skeleton className="h-6 w-4/5" /><Skeleton className="h-5 w-1/2" /></div> : <h2 className="mt-1.5 text-[21px] font-extrabold leading-[1.12] sm:text-[23px]" style={{ color: "var(--arbor-ink)", fontFamily: "var(--font-display)", textWrap: "balance" } as React.CSSProperties}>{headline}</h2>}
          {!loading && body && (
            <p dir="auto" data-testid="today-focus-observation" className="mt-2 text-[13px] leading-relaxed" style={{ color: "var(--arbor-muted)" }}>{body}</p>
          )}
          {accept && (
            <div className="mt-3 inline-flex self-start rounded-xl p-1" style={{ background: "var(--arbor-paper-deep)" }} role="group" aria-label={accept.lengthAria}>
              {(["tiny", "standard", "roomy"] as ActionCapacity[]).map((value) => (
                <button key={value} type="button" onClick={() => setCapacity(value)} aria-pressed={capacity === value} className="min-h-10 rounded-lg px-3 text-xs font-bold transition" style={{ background: capacity === value ? "var(--arbor-paper)" : "transparent", color: capacity === value ? "var(--arbor-ink)" : "var(--arbor-muted)", boxShadow: capacity === value ? "var(--shadow-xs)" : "none" }}>
                  {capacityMinutes[value]} {accept.minUnit}
                </button>
              ))}
            </div>
          )}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button onClick={primary.onClick} data-testid={primary.testid} className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl px-4 py-2.5 text-[13px] font-extrabold text-white transition active:scale-[0.98]" style={{ background: "var(--arbor-gradient-primary)" }}>{primary.label}<Icon name="arrow_forward" size={17} className="rtl:-scale-x-100" /></button>
            {accept && (
              <button onClick={onBegin} data-testid="today-guidance-cta" className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl px-4 py-2.5 text-[13px] font-extrabold transition active:scale-[0.98]" style={{ border: "1px solid var(--arbor-rule-strong)", color: "var(--arbor-green-ink)", background: "transparent" }}>{action}</button>
            )}
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold" style={{ color: "var(--arbor-faint)" }}><Icon name="schedule" size={15} />{meta}</span>
          </div>
          {/* Masterplan 3.1: the why-line's Trust-Center chain. Deliberately its
              OWN row BELOW the action row — a quiet lav chip that never sits
              beside (and so never competes with) Today's single gradient
              primary CTA (Rule A: one primary action above the fold). */}
          <div className="mt-3">
            {why
              ? <ContentWhyLine why={why} trustLink surface="today-focus" />
              : <TrustLink surface="today-focus" />}
          </div>
        </div>
      </div>
    </section>
  );
}

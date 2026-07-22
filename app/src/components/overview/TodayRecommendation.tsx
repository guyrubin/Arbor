import React from "react";
import { Icon } from "../ui/Icon";
import { Skeleton } from "../ui/Skeleton";

export default function TodayRecommendation({ eyebrow, headline, meta, action, loading, onBegin }: { eyebrow: string; headline: string; meta: string; action: string; loading: boolean; onBegin: () => void }) {
  return (
    <section className="overflow-hidden rounded-[20px]" style={{ background: "var(--arbor-paper-elevated)", border: "1px solid var(--arbor-rule)" }}>
      <div className="grid min-h-[164px] grid-cols-1 sm:grid-cols-[180px_minmax(0,1fr)]">
        <div aria-hidden="true" className="min-h-[132px] bg-cover bg-center" style={{ backgroundImage: "url('/assets/today/calm-transition-activity.png')" }} />
        <div className="flex min-w-0 flex-col justify-center p-5 sm:px-6">
          <span className="text-[10px] font-extrabold uppercase tracking-[0.13em]" style={{ color: "var(--arbor-green-ink)" }}>{eyebrow}</span>
          {loading ? <div className="mt-2 space-y-2"><Skeleton className="h-6 w-4/5" /><Skeleton className="h-5 w-1/2" /></div> : <h2 className="mt-1.5 text-[21px] font-extrabold leading-[1.12] sm:text-[23px]" style={{ color: "var(--arbor-ink)", fontFamily: "var(--font-display)", textWrap: "balance" } as React.CSSProperties}>{headline}</h2>}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button onClick={onBegin} data-testid="today-guidance-cta" className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl px-4 py-2.5 text-[13px] font-extrabold text-white transition active:scale-[0.98]" style={{ background: "var(--arbor-gradient-primary)" }}>{action}<Icon name="arrow_forward" size={17} className="rtl:-scale-x-100" /></button>
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold" style={{ color: "var(--arbor-faint)" }}><Icon name="schedule" size={15} />{meta}</span>
          </div>
        </div>
      </div>
    </section>
  );
}

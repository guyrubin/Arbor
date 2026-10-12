import { useLanguage } from "../../context/LanguageContext";
import { useSheetHistory } from "../../hooks/useSheetHistory";
import { SCHOLAR_ARTICLES } from "../../growth/scholarHub";
import { domainName, primaryDomain } from "../../lib/domains/registry";
import { DOMAIN_ICONS } from "../../lib/domains/icons";
import { DOMAIN_VARS, PASTEL } from "../../lib/tokens";
import { Icon } from "../ui/Icon";
import { Sheet, useCompactSurface } from "../ui/Sheet";
import { Modal } from "../ui/Modal";
import { SheetBreadcrumb } from "../layout/Breadcrumb";
import { TrustLink } from "../trust/TrustLink";

/**
 * v3 F-FORYOU-1 (reviewer r1) — this week's concept, opened from the short
 * reads on For you, the parent. The concept the old Scholar hub card showed
 * (growth/scholarHub, one curated editorial piece for the week) reads here, in
 * the same surface a short read opens in: a bottom sheet on a phone, a dialog
 * on a wide screen, one history entry (Back closes it), a crumb under the
 * title.
 *
 * What it shows: the week's mark, the area it belongs to (the ONE domain
 * registry: glyph, name and the area's own tone — a colour names the AREA,
 * never anything about the child), its length, the piece, and the provenance
 * hedge with the chain to the Trust Center. No module and no primary move:
 * those belong to the page beneath. Static catalogue, no AI call, no write.
 */
export default function ForYouConceptSheet({ articleId, onClose }: { articleId: string; onClose: () => void }) {
  const { t, aiLang } = useLanguage();
  const close = useSheetHistory(true, onClose);
  const Surface = useCompactSurface() ? Sheet : Modal;
  const article = SCHOLAR_ARTICLES.find((a) => a.id === articleId);
  if (!article) return null;
  const he = aiLang === "he";
  const title = he ? article.titleHe : article.titleEn;
  const body = he ? article.bodyHe : article.bodyEn;
  const area = primaryDomain("developmental", article.domain);
  return (
    <Surface open onClose={() => close()} title={title} maxWidth="max-w-2xl">
      <SheetBreadcrumb label={title} close={close} />
      <article data-testid="foryou-concept-sheet" className="max-w-[760px] space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 text-xs font-semibold" style={{ color: PASTEL.lav.ink }}>
            <Icon name="lightbulb" size={14} />{t("elev.learnCare.weekly.mark")}
          </span>
          {area && (
            <span data-area={area} className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold" style={{ background: DOMAIN_VARS[area].soft, color: DOMAIN_VARS[area].ink }}>
              <Icon name={DOMAIN_ICONS[area]} size={14} /><span>{domainName(area, t)}</span>
            </span>
          )}
          <span className="inline-flex items-center gap-1 text-xs font-semibold" style={{ color: "var(--arbor-muted)" }}>
            <Icon name="schedule" size={13} />{t("learn.minutes", { n: article.readingMinutes })}
          </span>
        </div>
        <p className="t-base leading-relaxed max-w-[72ch]" dir="auto" style={{ color: "var(--arbor-ink-soft)" }}>
          {body}
        </p>
        {/* Provenance hedge — editorial, not diagnostic — then the chain to
            the Trust Center on the same wrapping row (the reader's pattern). */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs" style={{ color: "var(--arbor-faint)" }}>
          <span dir="auto">{t("hub.scholar.provenance")}</span>
          <TrustLink surface="foryou-weekly" />
        </div>
      </article>
    </Surface>
  );
}

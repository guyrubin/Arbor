/**
 * BookSheetStrip — K2 4d: the second row of the parent's hero review (inside
 * HeroSheetPanel, parent side only): the child's hero in the BOOK, one picture
 * per drawn book pose, each with Redraw (once per pose: the pose is drawn again
 * for the same hero, uploaded over the old one and the sheet recommitted — the
 * child's device fetches the new picture). While the book sheet is being drawn
 * on this device: one calm line. Nothing when the book does not show this hero.
 * The pictures come through the owner-checked proxy (lib/bookAssetStore).
 */
import React, { useEffect, useMemo, useState } from "react";
import { Icon } from "../ui/Icon";
import { useLanguage } from "../../context/LanguageContext";
import { useChildCollection } from "../../hooks/useChildCollection";
import { fetchBookAsset } from "../../lib/bookAssetStore";
import type { BookAssetsDoc } from "../../lib/library/bookAssetPaths";
import { getLibraryBook } from "../../lib/library/books";
import { bookSheetDrawPoses, bookSheetId } from "../../lib/library/bookSheet";
import { bookSheetRunning, browserBookBuilderDeps, DEFAULT_SHEET_BOOK, redrawBookPose } from "../kidmode/hero/buildBookSheet";
import type { ChildProfile } from "../../types";

const muted: React.CSSProperties = { color: "var(--arbor-muted)" };
const formKey = (base: string, gender?: ChildProfile["gender"]) => (gender === "boy" || gender === "girl" ? `${base}.${gender}` : base);

export default function BookSheetStrip({ child, avatarHash }: { child: Pick<ChildProfile, "id" | "name" | "gender">; avatarHash: string }) {
  const { t } = useLanguage();
  const col = useChildCollection<BookAssetsDoc>(child.id, "bookAssets");
  const [override, setOverride] = useState<BookAssetsDoc | null>(null);
  const sheetId = bookSheetId(avatarHash);
  const stored = col.items.find((d) => d?.bookId === DEFAULT_SHEET_BOOK && d.sheetId === sheetId) ?? null;
  const doc = override && override.sheetId === sheetId && (!stored || override.createdAt > stored.createdAt) ? override : stored;
  const book = getLibraryBook(DEFAULT_SHEET_BOOK);
  const poses = useMemo(() => (book && doc ? bookSheetDrawPoses(book).filter((p) => doc.sheetManifest.poses[p]) : []), [book, doc]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [failed, setFailed] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!doc) return;
    let live = true;
    const made: string[] = [];
    void (async () => {
      const next: Record<string, string> = {};
      for (const pose of poses) {
        const blob = await fetchBookAsset(child.id, doc, `hero-sheets/${doc.sheetId}/${doc.sheetManifest.poses[pose].file}`).catch(() => null);
        if (!blob || !live) continue;
        const u = URL.createObjectURL(blob);
        made.push(u);
        next[pose] = u;
      }
      if (live) setUrls(next);
    })();
    return () => {
      live = false;
      made.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [child.id, doc, poses]);

  const name = { name: child.name };
  if (!doc) {
    return bookSheetRunning(child.id) ? (
      <p data-book-sheet="building" role="status" className="text-xs" style={muted}>
        {t(formKey("elev.hero.sheet.book.building", child.gender), name)}
      </p>
    ) : null;
  }
  const redraw = async (pose: string) => {
    setBusy((b) => ({ ...b, [pose]: true }));
    const r = await redrawBookPose({ childId: child.id, avatarHash, pose }, browserBookBuilderDeps(child.id, () => false)).catch(() => ({ ok: false as const, doc: undefined }));
    setBusy((b) => ({ ...b, [pose]: false }));
    if (r.ok && r.doc) setOverride(r.doc);
    else setFailed((f) => ({ ...f, [pose]: true }));
  };

  return (
    <div data-book-sheet="review" className="space-y-2">
      <p className="text-xs font-bold" style={{ color: "var(--arbor-ink)" }}>{t(formKey("elev.hero.sheet.book.title", child.gender), name)}</p>
      <ul className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        {poses.map((pose) => {
          const entry = doc.sheetManifest.poses[pose];
          return (
            <li key={pose} data-book-pose={pose} className="rounded-xl p-2 flex flex-col items-center gap-1.5" style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule)" }}>
              {urls[pose] && !busy[pose] ? (
                <img src={urls[pose]} alt={t("elev.hero.sheet.book.alt", name)} className="h-20 w-auto object-contain" draggable={false} />
              ) : (
                <div className="h-20 flex items-center text-[11px] text-center" style={muted}>
                  {busy[pose] ? t("elev.hero.sheet.review.redrawing") : failed[pose] ? t("elev.hero.sheet.book.failed") : ""}
                </div>
              )}
              {entry.redrawn ? (
                <span className="inline-flex min-h-11 items-center text-[11px]" style={muted}>{t("elev.hero.sheet.review.redrawn")}</span>
              ) : (
                !busy[pose] && (
                  <button type="button" onClick={() => { void redraw(pose); }} className="inline-flex min-h-11 min-w-11 items-center justify-center gap-1 rounded-lg px-2 text-[11px] font-bold" style={{ background: "var(--arbor-paper)", color: "var(--arbor-ink)", border: "1px solid var(--arbor-rule)" }}>
                    <Icon name="refresh" size={14} /> {t("elev.hero.sheet.review.redraw")}
                  </button>
                )
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

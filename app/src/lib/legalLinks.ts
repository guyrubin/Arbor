/**
 * MOB-01 — the ONE constant set for the in-app legal + support links.
 *
 * Apple 3.1.2 / 5.1.1(i) and Play Data Safety require a reachable Privacy
 * Policy + Terms link on every auto-renewable paywall and inside the app. The
 * pages are real (public/privacy.html, terms.html, support.html) and served
 * from the product domain; fastlane's privacy_url.txt points at the same
 * origin, so the two cannot drift. Consumed by components/billing/LegalLinks.
 */

export const LEGAL_ORIGIN = "https://arborparentingapp.com";

export const LEGAL_LINKS = {
  privacy: `${LEGAL_ORIGIN}/privacy.html`,
  terms: `${LEGAL_ORIGIN}/terms.html`,
  support: `${LEGAL_ORIGIN}/support.html`,
} as const;

export type LegalLinkKey = keyof typeof LEGAL_LINKS;

/** Render order everywhere: Privacy · Terms · Support. */
export const LEGAL_LINK_ORDER: readonly LegalLinkKey[] = ["privacy", "terms", "support"];

/** i18n key for each link label (lib/i18nElevation/storeShell). */
export const legalLabelKey = (key: LegalLinkKey): string => `elev.storeshell.legal.${key}`;

/**
 * Open a legal page. Native → the Capacitor in-app browser (dynamic import,
 * same pattern as lib/nativeBilling.ts openNativeManage — the plugin never
 * enters the web bundle's static graph, storeCheckoutGuard G3). Web → a new
 * tab with `noopener`. Returns false when nothing could be opened.
 */
export async function openLegalLink(
  key: LegalLinkKey,
  deps: {
    isNative: boolean;
    openNative?: (url: string) => Promise<unknown>;
    openWeb?: (url: string) => unknown;
  },
): Promise<boolean> {
  const url = LEGAL_LINKS[key];
  try {
    if (deps.isNative) {
      const openNative =
        deps.openNative ?? (async (u: string) => {
          const { Browser } = await import("@capacitor/browser");
          await Browser.open({ url: u });
        });
      await openNative(url);
      return true;
    }
    const openWeb = deps.openWeb ?? ((u: string) => window.open(u, "_blank", "noopener,noreferrer"));
    openWeb(url);
    return true;
  } catch {
    return false;
  }
}

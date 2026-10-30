/**
 * BD-13 — the claim audit of the shipped copy against the offer.
 *
 *   npx tsx scripts/claim-audit.mts [--json]     the list, for review
 *   src/lib/claimAudit.test.ts                   the guard, in CI
 *
 * Every parent-facing string in the shipped dictionaries (lib/i18n.ts and the
 * lib/i18nElevation modules, EN and HE) that touches the offer, the price, the
 * trial, "free", a guarantee or an "unlimited" promise is a CLAIM, and every
 * claim is registered here with the basis that makes it true. The guard checks
 * each basis against the code that grants it (TRIAL_DAYS, lib/offers.ts,
 * PLAN_LIMITS, the image allowance), fails on an unregistered claim, and
 * refuses the claims BD-13 forbids outright in either language: clinical
 * proof, outcome promises, guarantees, diagnosis, professional equivalence,
 * unearned endorsement and unlimited generation.
 *
 * Round 2 (critic): the shipped marketing pages (app/public/marketing, the
 * allow-listed files of lib/marketingDeployGuard.test.ts) are audited too:
 * the same forbidden claims in either language, no plan that is not sold
 * (Family, BD-53), no standing free tier (14 days of Plus, then a
 * subscription), no "unlimited", and every price on a page equal to
 * lib/pricing.ts; a discrepancy only Guy can settle is pinned shrink-only.
 *
 * Existing machinery this sits beside, not over: lib/claims.copy.test.ts
 * (retired sentences), lib/planClaims.test.ts (every Plus bullet maps to a
 * gate), lib/honesty.test.ts (the non-diagnostic line), scripts/safety-eval.mts
 * (static copy in server sources). Marketing pages and partner copy are not in
 * these dictionaries; they are Guy's review.
 *
 * Pure: data and string tests only.
 */

export type ClaimTopic = "offer" | "trial" | "price" | "free" | "guarantee" | "unlimited";

/** What touches a topic, per language. Hebrew carries its one-letter prefixes (ה ב ל ו מ ש). */
export const CLAIM_TOPICS: Readonly<Record<ClaimTopic, { en: RegExp; he: RegExp }>> = {
  offer: {
    en: /\bfree months?\b|\bmonths? of (arbor )?plus\b|\breferral\b|\bdiscount|\bcoupon|\bpromo\b|\bfounding\b/i,
    he: /חודש(י)? חינם|חודש Plus|חודש פלוס|הנחה|קופון|חודשי ההזמנה/,
  },
  trial: {
    en: /\btrial\b|\bfirst \d+ days\b|\b\d+ days of arbor\b/i,
    he: /תקופת (ה)?ניסיון|\d+ (ה)?ימים (ה)?ראשונים|\d+ הימים/,
  },
  price: {
    en: /[€₪$]\s?\d|\d\s?[€₪]|\{price\}|\bprices?\b|\bper month\b|\/month\b|\bbilled\b|\bsubscri|\brenews?\b/i,
    he: /[€₪]\s?\d|\d\s?[€₪]|\{price\}|מחיר|(?:^|[\s(])[הבלומש]?מנוי(?:ים|י|ה)?(?=[\s,.;:—)]|$)|חיוב|מחויב|מתחדש/,
  },
  free: {
    en: /\bfree (plan|trial|months?|coaching|limit|access)\b|\barbor free\b|\btoday's free\b|\bis free\b|\bfree on every plan\b|\bfor free\b|\bno card\b/i,
    he: /חינם|ללא תשלום|החינמי|ללא כרטיס|בלי כרטיס/,
  },
  guarantee: {
    en: /\bguarantee|\bwe promise\b|\brisk[- ]free\b|\bmoney[- ]back\b|\b100%/i,
    he: /מובטח|אנחנו מבטיחים|החזר כספי|100%/,
  },
  unlimited: {
    en: /\bunlimited\b|\bno (daily )?(message )?limit\b|\bremoves the daily limit\b|\bdaily allowance\b|\bmore hero drawings\b/i,
    he: /ללא הגבלה|בלי הגבלה|בלתי מוגבל|מסיר את (ה)?(הגבלה|מכסה) (ה)?יומית|אין מכסה יומית|מגבלת הודעות יומית|מכסה יומית של תמונות|יותר ציורי גיבור/,
  },
};

/** Third-party facts, not Arbor's offer (a helpline being free to call). */
export const NOT_ARBOR_OFFER = /^elev\.safety\.helpline\./;

export function claimTopicsOf(text: string, lang: "en" | "he"): ClaimTopic[] {
  return (Object.keys(CLAIM_TOPICS) as ClaimTopic[]).filter((t) => CLAIM_TOPICS[t][lang].test(text));
}

/** Claims BD-13 forbids in any copy, either language. A negated statement
 *  ("Arbor is not clinically validated") is the opposite of the claim and passes. */
export const DENIED_CLAIMS: ReadonlyArray<{ id: string; why: string; en: RegExp; he: RegExp }> = [
  { id: "clinical-proof", why: "no clinical or scientific validation exists", en: /\b(clinically|scientifically|medically) (proven|validated|tested|approved)\b|\bproven to\b/i, he: /מוכח (קלינית|מדעית|רפואית)|הוכח (קלינית|מדעית)|מאומת קלינית/ },
  { id: "outcome-promise", why: "Arbor promises no developmental outcome", en: /\b(improves?|boosts?|accelerates?|speeds? up|fix(es)?) (your child'?s |their )?(development|speech|language|iq|brain|behaviou?r|sleep)\b/i, he: /(משפר|משפרת|מאיץ|מאיצה|מקדם|מקדמת) את (ה)?(התפתחות|הדיבור|השפה|ההתנהגות|השינה)/ },
  { id: "guarantee", why: "no guarantee is offered", en: /\bguarantee/i, he: /מובטח|ערבות|מבטיחים ש/ },
  { id: "diagnosis", why: "Arbor never diagnoses", en: /\b(we|arbor|it) (diagnoses?|detects?|identifies) (autism|adhd|delays?|disorders?)\b|\bdiagnoses your\b/i, he: /(מאבחן|מאבחנת|מזהה) (אוטיזם|הפרעת|עיכוב|הפרעות)/ },
  { id: "professional-equivalence", why: "Arbor is not a professional and replaces none", en: /\b(replaces?|instead of|as good as|like having) (a|your) (therapist|doctor|clinician|specialist|paediatrician|pediatrician|psychologist)\b/i, he: /במקום (קלינאי|רופא|מטפל|פסיכולוג)|כמו (קלינאי|רופא|מטפל|פסיכולוג) (צמוד|פרטי)/ },
  { id: "endorsement", why: "no professional body endorses Arbor", en: /\b(endorsed|approved|recommended|backed) by (doctors|paediatricians|pediatricians|clinicians|experts|therapists|psychologists)\b/i, he: /(מומלץ|מאושר|נתמך) (על ידי|ע"י) (רופאים|מומחים|קלינאים|פסיכולוגים)/ },
  { id: "unlimited-generation", why: "every plan has an image allowance (server/imageQuota.ts IMAGE_ALLOWANCE)", en: /\bno daily limit\b|\bremoves the daily limit, so\b|\bunlimited (images?|drawings?|heroes|comics?|stories|adventures?|pictures?)\b/i, he: /אין מכסה יומית|מסיר את המכסה היומית/ },
  { id: "unlimited-coaching", why: "coaching has a fair-use hourly limit (server/aiQuota.ts AI_USER_HOURLY_LIMIT)", en: /\bunlimited (coaching|answers|messages|questions)\b/i, he: /(אימון|ליווי|תשובות|שאלות) ללא הגבלה/ },
];

const NEGATION = { en: /\b(not|never|no|isn't|aren't|doesn't|don't|without|nor)\b[^.]{0,20}$/i, he: /(לא|אינו|אינה|אינם|אין|בלי|ללא)[^.]{0,20}$/ };

/** The denied claims a string makes (negated statements excluded). */
export function deniedClaimsIn(text: string, lang: "en" | "he"): string[] {
  const out: string[] = [];
  for (const d of DENIED_CLAIMS) {
    const m = d[lang].exec(text);
    if (m && !NEGATION[lang].test(text.slice(0, m.index))) out.push(d.id);
  }
  return out;
}

/** Why a registered claim is true, checked by the guard against the code. */
export type ClaimBasis =
  /** The trial every account gets (server/entitlements.ts TRIAL_DAYS, BD-53: no card). Any day count in the copy must equal it. */
  | { kind: "trial" }
  /** lib/offers.ts: an approved offer; "month" ⇔ 30 days; "both/each/you too" ⇔ grantsReferrer. */
  | { kind: "offer"; offer: "referral_month" }
  /** The amount is the store's: copy carries {price}/{total} placeholders, never a literal amount. */
  | { kind: "storePrice" }
  /** Co-parent sharing is free: every plan has the same coParentSeats (PLAN_LIMITS). */
  | { kind: "freeSharing" }
  /** The free plan's limits as PLAN_LIMITS states them (one child; a daily coach number). */
  | { kind: "freeLimits" }
  /** Plus has no daily coach limit: PLAN_LIMITS.plus.coachMessagesPerDay === null; the copy names the fair-use hourly limit or never says "unlimited". */
  | { kind: "unlimitedCoaching" }
  /** Plus draws more than Free: IMAGE_ALLOWANCE.plus beats IMAGE_ALLOWANCE.free per day and per 30 days. */
  | { kind: "imageAllowance" }
  /** A plain account or billing fact with no number in it (a plan's name, a status, where to manage it). */
  | { kind: "fact"; note: string };

const fact = (note: string): ClaimBasis => ({ kind: "fact", note });

/** Every registered claim key. A new claim fails the guard until it is added here with its basis. */
export const CLAIM_REGISTRY: Readonly<Record<string, ClaimBasis>> = {
  // the trial (BD-53)
  "elev.auth.trial.promise": { kind: "trial" },
  "elev.plan.plusTitleTrial": { kind: "trial" },
  "set.plan.trial": { kind: "trial" },
  "set.plan.trialDesc": { kind: "trial" },
  "set.plan.trialEnded": { kind: "trial" },
  "set.plan.trialLeft": { kind: "trial" },
  "set.plan.trialLeft.one": { kind: "trial" },
  "set.plan.trialEndsToday": { kind: "trial" },
  "trial.notice.days": { kind: "trial" },
  "trial.notice.days.one": { kind: "trial" },
  "trial.notice.endsToday": { kind: "trial" },
  "trial.notice.ended": { kind: "trial" },
  "pw.body.trialEnded": { kind: "trial" },
  "pw.body.trialEnding": { kind: "trial" },
  "set.plan.trialEndedDesc": { kind: "trial" },
  // the referral month (lib/offers.ts referral_month)
  "elev.words.invite.sub": { kind: "offer", offer: "referral_month" },
  "set.referral.title": { kind: "offer", offer: "referral_month" },
  "set.referral.sub": { kind: "offer", offer: "referral_month" },
  "set.referral.earned": { kind: "offer", offer: "referral_month" },
  "set.referral.earned.one": { kind: "offer", offer: "referral_month" },
  "set.referral.maxed": { kind: "offer", offer: "referral_month" },
  "set.referral.shareText": { kind: "offer", offer: "referral_month" },
  // B-GROWTH-43: the typed-code field (components/referral/OfferCodeField)
  "set.referral.code.sub": { kind: "offer", offer: "referral_month" },
  "set.referral.code.granted": { kind: "offer", offer: "referral_month" },
  "set.section.billingSub": fact("names the Settings section holding subscription, referral and account access"),
  // the price, which is the store's
  "elev.storeshell.pw.perMonthApprox": { kind: "storePrice" },
  "elev.storeshell.pw.cta": { kind: "storePrice" },
  "elev.storeshell.pw.pricesLoading": { kind: "storePrice" },
  "elev.storeshell.pw.pricesUnavailable": { kind: "storePrice" },
  "elev.storeshell.pw.disclosure": { kind: "storePrice" },
  "set.plan.price.perMonth": { kind: "storePrice" },
  "set.plan.price.perMonthAnnual": { kind: "storePrice" },
  // co-parent sharing is free
  "elev.coParent.free": { kind: "freeSharing" },
  "elev.plan.free.3": { kind: "freeSharing" },
  "elev.plan.family.1": { kind: "freeSharing" },
  "set.plan.familyDesc": { kind: "freeSharing" },
  "pw.body.coParentSeats": { kind: "freeSharing" },
  // the free plan's limits
  "coach.paywall.body": { kind: "freeLimits" },
  "pw.body.maxChildren": { kind: "freeLimits" },
  // Plus has no daily coach limit (an hourly fair-use cap exists: server/aiQuota.ts)
  "set.plan.plusDesc": { kind: "unlimitedCoaching" },
  "set.plan.plusPitch": { kind: "unlimitedCoaching" },
  "pw.body": { kind: "unlimitedCoaching" },
  "pw.bodyCoach": { kind: "unlimitedCoaching" },
  "ac.limitBody": { kind: "unlimitedCoaching" },
  // Plus has a larger image allowance than Free (server/imageQuota.ts)
  "pw.body.avatarGenerate": { kind: "imageAllowance" },
  "pw.body.heroComic": { kind: "imageAllowance" },
  "pw.body.adventureGenerate": { kind: "imageAllowance" },
  // plain account and billing facts
  "elev.plan.freeTitle": fact("what a family saved stays readable and exportable without a subscription (BD-53)"),
  "elev.plan.familyTitle": fact("Family is honoured for existing subscribers and not sold (BD-53)"),
  "elev.sidebar.plan.free": fact("a plan name"),
  "elev.sidebar.plan.plus": fact("a plan name"),
  "elev.sidebar.plan.family": fact("a plan name"),
  "set.plan.free": fact("a plan name"),
  "elev.storeshell.pw.purchaseFailed": fact("a purchase status"),
  "set.plan.manage": fact("where to manage the subscription"),
  "set.plan.renews": fact("the renewal date the store reports"),
  "set.plan.grace": fact("a billing-retry status (server/billing.ts BILLING_ISSUE)"),
  "set.plan.viaStore": fact("the store that bills the subscription"),
  "set.plan.manageStore": fact("where a store subscription is managed"),
  "set.plan.restoreDone": fact("a restore status"),
  "pw.activating": fact("a purchase status"),
  "pw.stillConfirming": fact("a purchase status"),
  "set.acctDel.body": fact("account deletion removes the subscription record; store payment records stay where the law requires (server/accountDeletion.ts)"),
  "set.admin.founder.sub": fact("the founder dashboard's contents"),
};

/**
 * Claims shipped today that the code contradicts, each awaiting a copy decision
 * (Guy). SHRINK-ONLY: the guard fails when one is fixed until its line goes,
 * and a new one can never be added to get green.
 */
export const KNOWN_FALSE_CLAIMS: Readonly<Record<string, string>> = {
  // Round 2: the three image paywall lines now state the allowance; none is left.
};

/* ── the shipped marketing pages ───────────────────────────────────────── */

/** Claims a marketing page may not make (beyond DENIED_CLAIMS), on the page text. */
export const MARKETING_DENIED: ReadonlyArray<{ id: string; why: string; re: RegExp }> = [
  { id: "plan-not-sold", why: "Family is not sold (BD-53); existing Family subscribers are handled in the app", re: /\bArbor Family\b|\bFamily plan\b|Arbor משפחתי|ארבור משפחתי|מסלול משפחתי|פלוס ומשפחתי/ },
  { id: "standing-free-tier", why: "there is no standing free tier: 14 days of Plus with no card, then a subscription (BD-53)", re: /\bfree (plan|tier)\b|\bfree forever\b|מסלול חינמי|תוכנית חינמית|חינם לתמיד/i },
  { id: "unlimited", why: "every AI feature has a fair-use or daily allowance", re: /\bunlimited\b|ללא הגבלה|בלי הגבלה|\bunbegrenzt\b|\billimité|\bonbeperkt\b/i },
];
/** A pricing tier priced "free" in the page markup is a standing free tier. */
const FREE_PRICE_TIER = /class="price"[^>]*>\s*<b>\s*(חינם|Free|Gratis|Gratuit|Kostenlos)\s*<\/b>/i;

/** The readable text of a page: styles and scripts dropped (JSON-LD kept, it is read by search engines), tags removed. */
export function marketingText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script(?![^>]*application\/ld\+json)[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ");
}

/** Every forbidden claim on one marketing page, as `rule: …excerpt…`. */
export function auditMarketingPage(html: string): string[] {
  const text = marketingText(html);
  const hits: string[] = [];
  const excerpt = (i: number) => text.slice(Math.max(0, i - 40), i + 60).trim();
  for (const rule of MARKETING_DENIED) {
    const m = rule.re.exec(text);
    if (m) hits.push(`${rule.id}: …${excerpt(m.index)}…`);
  }
  if (FREE_PRICE_TIER.test(html)) hits.push("standing-free-tier: a pricing tier priced free");
  for (const lang of ["en", "he"] as const) {
    for (const id of deniedClaimsIn(text, lang)) if (!hits.some((h) => h.startsWith(`${id}:`))) hits.push(`${id}: (${lang})`);
  }
  return hits;
}

/** Every price written on a page, normalised to "₪69.90" / "€12.99". */
export function marketingPrices(html: string): string[] {
  const text = marketingText(html);
  const out: string[] = [];
  const norm = (sym: string, n: string) => `${sym}${Number(n.replace(",", ".")).toFixed(2)}`;
  for (const m of text.matchAll(/([₪€])\s?(\d+(?:[.,]\d+)?)|(\d+(?:[.,]\d+)?)\s?([₪€])/g)) {
    out.push(m[1] ? norm(m[1], m[2]) : norm(m[4], m[3]));
  }
  return out;
}

/**
 * Prices a page shows that lib/pricing.ts does not, awaiting Guy (which price
 * is right is his). SHRINK-ONLY: a fixed page fails until its line goes.
 */
export const KNOWN_PRICE_DISCREPANCIES: Readonly<Record<string, { prices: readonly string[]; guy: string }>> = {
  "arbor-il.html": {
    prices: ["₪49.00", "₪449.00"],
    guy: "Guy: the IL page sells Plus at ₪49 / ₪449; lib/pricing.ts (BD-53), the HE landing page and marketing/index.html say ₪69.90 / ₪549. Which is right is Guy's; then this page or the code changes.",
  },
};

export type ClaimRow = { key: string; topics: ClaimTopic[]; en: string; he: string; basis: ClaimBasis | null; knownFalse: string | null; denied: string[] };

/** Every claim string in the given dictionaries, EN and HE side by side. */
export function auditClaimCopy(en: Readonly<Record<string, string>>, he: Readonly<Record<string, string>>): ClaimRow[] {
  const rows: ClaimRow[] = [];
  for (const key of [...new Set([...Object.keys(en), ...Object.keys(he)])].sort()) {
    const e = en[key] ?? "";
    const h = he[key] ?? "";
    const denied = [...new Set([...deniedClaimsIn(e, "en"), ...deniedClaimsIn(h, "he")])];
    const topics = NOT_ARBOR_OFFER.test(key) ? [] : [...new Set([...claimTopicsOf(e, "en"), ...claimTopicsOf(h, "he")])];
    if (topics.length === 0 && denied.length === 0) continue;
    rows.push({ key, topics, en: e, he: h, basis: CLAIM_REGISTRY[key] ?? null, knownFalse: KNOWN_FALSE_CLAIMS[key] ?? null, denied });
  }
  return rows;
}

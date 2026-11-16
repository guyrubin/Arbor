/**
 * Design system v10.1 — the new words on Moments (#/timeline), in both
 * languages. Production strings stay in their i18n modules (companion.moments.*,
 * kept.*, elev.shelfJournal.*); only what the v10 composition adds lives here.
 * Pattern: components/companion/nowViewCopy.ts (one object, `en` and `he`).
 */
export type MomentsV10Copy = {
  onThisPage: string;
  startHere: string;
  /** The stage's headline, per view. */
  headline: { areas: string; time: string; places: string; reader: string };
  /** The guide's short names on the phone strip. */
  guideShort: { areas: string; kinds: string; newest: string; shelves: string };
  guideAreasSub: (areas: number) => string;
  byKind: string;
  byKindSub: string;
  hardUnit: string;
  saidUnit: (n: number) => string;
  keptTitle: string;
  keptSub: string;
  timeSub: string;
  newest: string;
  newestSub: string;
  newestWent: string;
  youWrote: (when: string) => string;
  keptAsTyped: string;
  shelfIs: (shelf: string) => string;
  onTheMap: string;
  seeOnMap: string;
  latestByDate: string;
  shelves: string;
  shelvesSub: string;
  legend: string;
  nothingNewest: string;
  arborFiled: string;
  tokenMoment: string;
  tokenHard: string;
  doors: string;
  logHard: string;
};

export const MOMENTS_V10_COPY: Readonly<Record<"en" | "he", MomentsV10Copy>> = {
  en: {
    onThisPage: "On this page",
    startHere: "Start here",
    headline: {
      areas: "What you kept, area by area",
      time: "What you kept, month by month",
      places: "What you kept, place by place",
      reader: "Everything you kept, month by month",
    },
    guideShort: { areas: "Areas", kinds: "Kind", newest: "Newest", shelves: "Shelf by shelf" },
    guideAreasSub: (areas) => (areas === 1 ? "1 area" : `${areas} areas`),
    byKind: "By kind",
    byKindSub: "Hard moments, words, kept things",
    hardUnit: "logged",
    saidUnit: (n) => (n === 1 ? "saying or word" : "sayings and words"),
    keptTitle: "Kept things and the Year book",
    keptSub: "One reader for everything you kept.",
    timeSub: "Your journal, day by day, newest first.",
    newest: "The newest moment",
    newestSub: "Where it went, and the latest",
    newestWent: "Where the newest moment went",
    youWrote: (when) => `You wrote · ${when}`,
    keptAsTyped: "Kept exactly as you typed it.",
    shelfIs: (shelf) => `Shelf: ${shelf}`,
    onTheMap: "Shows on the milestone map under",
    seeOnMap: "See it on the map",
    latestByDate: "Latest, by date",
    shelves: "Shelf by shelf",
    shelvesSub: "Where each thing sits",
    legend: "Each mark is one thing you recorded.",
    nothingNewest: "Nothing kept yet.",
    arborFiled: "Arbor suggests",
    tokenMoment: "moment you kept",
    tokenHard: "hard moment",
    doors: "More ways to read the record",
    logHard: "Log a hard moment",
  },
  he: {
    onThisPage: "בעמוד הזה",
    startHere: "מתחילים כאן",
    headline: {
      areas: "מה ששמרתם, תחום אחר תחום",
      time: "מה ששמרתם, חודש אחר חודש",
      places: "מה ששמרתם, מקום אחר מקום",
      reader: "כל מה ששמרתם, חודש אחר חודש",
    },
    guideShort: { areas: "תחומים", kinds: "סוג", newest: "האחרון", shelves: "מדף אחר מדף" },
    guideAreasSub: (areas) => (areas === 1 ? "תחום אחד" : `${areas} תחומים`),
    byKind: "לפי סוג",
    byKindSub: "רגעים קשים, מילים, דברים ששמרתם",
    hardUnit: "תועדו",
    saidUnit: (n) => (n === 1 ? "משפט או מילה" : "משפטים ומילים"),
    keptTitle: "דברים ששמרתם וספר השנה",
    keptSub: "מקום אחד לקרוא בו את כל מה ששמרתם.",
    timeSub: "היומן שלכם, יום אחר יום, מהחדש לישן.",
    newest: "הרגע האחרון",
    newestSub: "לאן הוא הלך, והאחרונים",
    newestWent: "לאן הלך הרגע האחרון",
    youWrote: (when) => `כתבתם · ${when}`,
    keptAsTyped: "נשמר בדיוק כפי שכתבתם.",
    shelfIs: (shelf) => `מדף: ${shelf}`,
    onTheMap: "מופיע במפת אבני הדרך תחת",
    seeOnMap: "לראות במפה",
    latestByDate: "האחרונים, לפי תאריך",
    shelves: "מדף אחר מדף",
    shelvesSub: "איפה כל דבר נמצא",
    legend: "כל סימן הוא דבר אחד שתיעדתם.",
    nothingNewest: "עדיין לא נשמר כלום.",
    arborFiled: "ארבור מציעה",
    tokenMoment: "רגע ששמרתם",
    tokenHard: "רגע קשה",
    doors: "דרכים נוספות לקרוא את התיעוד",
    logHard: "לתעד רגע קשה",
  },
};

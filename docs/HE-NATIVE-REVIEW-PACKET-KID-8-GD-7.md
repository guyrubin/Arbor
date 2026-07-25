# Hebrew native-review packet — Playbank + Kid SFX (KID-8 / GD-7)

**Status:** OPEN — awaiting Guy naming the native Hebrew reviewer (decision GD-7).
**Scope:** every Hebrew string in `app/src/playbank/content.ts` (`PLAY_ACTIVITIES_HE`, 
267 entries + `PLAY_DOMAIN_LABEL`) and the kid-register micro-copy in
`app/src/components/tabs/HeroJourneyTab.tsx` (`STORY_ART` SFX, `PACK_WORLD` labels,
inline HE/EN celebration + chrome strings). Built from static source strings only —
no child data is included (clinical-firewall ruling: PASS).
**How to close:** the reviewer marks every section, corrections land as a **data-only PR**
(no logic change), and the “First draft — native review recommended” annotation at
`content.ts` (above `PLAY_ACTIVITIES_HE`) is replaced with a stamp naming the reviewer and the
review date. Until then the first-draft annotation stays.

Related, same reviewer session: `docs/KID-MODE-HE-TRANSCREATION-TODO-GD-6.md` (48 `kid.*`
i18n keys awaiting HE transcreation — GD-6). Hero-story TITLES and story body copy
(`titleHe` in `app/src/lib/heroJourneys.ts` / `heroComics.ts`) are a separate content module,
not part of this packet.

## Voice notes for the reviewer

- Playbank entries are PARENT-facing Hebrew: warm, plain, calm — never clinical jargon, never
  hype. Instructions a tired parent can follow.
- SFX + HeroJourney strings are KID-register (comic voice, ~4-9). Onomatopoeia must be what an
  Israeli child would actually say/see in a comic — transliterated English SFX are exactly what
  this review exists to remove.
- Proposed fixes below are non-native suggestions only; the reviewer's choice is authoritative.
- Keep `{...}`-style tokens and interpolation slots verbatim where shown (e.g. `${name}`).
- RTL is handled by the app; write natural Hebrew, no manual directional marks.

## Coverage check (generated from source)

- `PLAY_ACTIVITIES` (EN canon): 267 activities
- `PLAY_ACTIVITIES_HE`: 267 entries
- Every EN activity has an HE entry.
- No orphan HE entries.
- Guided-play fields (`easierVariation` / `harderVariation` / `whatToNotice` / `outcomePrompt`)
  are intentionally ABSENT from every HE entry (KID-5 EN-fallback doctrine). They are NOT part
  of this packet; their HE copy arrives only via a future native transcreation batch.

---

## Part 1 — Kid SFX table (`STORY_ART`, 18 + fallback)

Acceptance for this table: after review it contains ONLY reviewer-approved Hebrew onomatopoeia.

| # | Story id | EN SFX | Current HE | Proposed fix (suggestion) | Note | Reviewer verdict |
|---|---|---|---|---|---|---|
| 1 | `david-and-goliath` | BOOM! | בום! | — | Confirm it reads as native kid SFX. | |
| 2 | `moses-and-pharaoh` | ECHO! | הד! | — | Confirm it reads as native kid SFX. | |
| 3 | `the-lion-who-was-afraid` | ROAR! | שאגה! | — | Confirm it reads as native kid SFX. | |
| 4 | `noahs-ark` | SPLASH! | שלאמפ! | שפריץ! | FLAGGED — “שלאמפ” is an English transliteration, not Hebrew onomatopoeia. | |
| 5 | `jonah-and-the-great-fish` | GULP! | גלופ! | גלוק! / בלע! | FLAGGED — “גלופ” is a transliteration of GULP. | |
| 6 | `the-dragon-of-responsibility` | FWOOSH! | פוווש! | פשששש! | Check — “פוווש” may read as a transliteration of FWOOSH. | |
| 7 | `joseph-and-his-brothers` | SHINE! | ברק! | — | Confirm it reads as native kid SFX. | |
| 8 | `jacob-wrestling-the-angel` | HOLD ON! | חזק! | — | Confirm it reads as native kid SFX. | |
| 9 | `the-garden-of-forgotten-seeds` | BLOOM! | פריחה! | — | Confirm it reads as native kid SFX. | |
| 10 | `king-solomons-choice` | AHA! | אהה! | — | Confirm it reads as native kid SFX. | |
| 11 | `the-broken-music-box` | TING! | טינג! | דינג! | Check — “טינג” borderline; confirm it reads naturally to a child. | |
| 12 | `the-found-acorn-crown` | SHINE! | נצנוץ! | — | Confirm it reads as native kid SFX. | |
| 13 | `the-two-gifts` | KNOCK! | טוק! | — | Confirm it reads as native kid SFX. | |
| 14 | `leave-the-tent` | WHOOSH! | ואוש! | ווש! | Check — “ואוש” may read as a transliteration of WHOOSH. | |
| 15 | `the-two-paths-through-the-meadow` | HMM! | המ! | — | Confirm it reads as native kid SFX. | |
| 16 | `the-two-mothers-and-the-quiet-judge` | SHH… | ששש… | — | Confirm it reads as native kid SFX. | |
| 17 | `the-tyrant-and-the-town` | STOP! | די! | — | Confirm it reads as native kid SFX. | |
| 18 | `the-friendly-monster` | GRRAH! | גראח! | גררר! | FLAGGED — “גראח” is a transliteration of GRRAH. | |
| 19 | (fallback, unknown story) | POW! | פאו! | — | Confirm it reads as native kid SFX. | |

## Part 2 — Pack world labels (`PACK_WORLD`, 5)

| # | Pack | EN | Current HE | Reviewer verdict |
|---|---|---|---|---|
| 1 | `courage` | Courage | אומץ | |
| 2 | `responsibility` | Responsibility | אחריות | |
| 3 | `growth` | Growth | צמיחה | |
| 4 | `wisdom` | Wisdom | חוכמה | |
| 5 | `truth` | Truth | אמת | |

## Part 3 — HeroJourney kid-register micro-copy (28 inline strings)

Inline HE/EN pairs from `HeroJourneyTab.tsx` (chrome, celebration and save strings; kid
register unless marked). `${...}` slots are live interpolations — keep them verbatim.

| # | EN (source) | Current HE | Reviewer verdict |
|---|---|---|---|
| 1 | your hero | הגיבור | |
| 2 | Your hero | הגיבור שלך | |
| 3 | `${runs.length}` stories done | `${runs.length}` סיפורים הושלמו | |
| 4 | `${name}`'s Story Quests | מסעות הגיבור של `${name}` | |
| 5 | Raising `${name}` toward: `${charter.join(" · ")}` | מגדלים את `${name}` לקראת: `${charter.join(" · ")}` | |
| 6 | Pick a story, hero — `${name}` stars in every one! | `${name}`, הפכו לגיבור של כל סיפור! | |
| 7 | Hero Comics | קומיקס גיבור | |
| 8 | POW! | פאו! | |
| 9 | `${name}` stars in every story's comic | `${name}` כוכב הקומיקס של כל סיפור | |
| 10 | Family Formation | מגילת המשפחה | |
| 11 | The values that steer your stories | הערכים שמכוונים את הסיפורים שלכם | |
| 12 | Filter by power | סינון לפי כוח | |
| 13 | All | הכול | |
| 14 | Choose your story | בחרו את הסיפור שלכם | |
| 15 | Your aim | המטרה שלכם | |
| 16 | ORIGINAL | מקורי | |
| 17 | Age | גיל | |
| 18 | Loading… | טוען… | |
| 19 | Play | שחקו | |
| 20 | Library (`${runs.length}`) | הספרייה (`${runs.length}`) | |
| 21 | No quests yet | עדיין אין מסעות | |
| 22 | Pick a story above and start your first quest. Completed quests are saved here. | בחרו סיפור למעלה והתחילו את המסע הראשון. כל מסע שהושלם נשמר כאן. | |
| 23 | In progress | בתהליך | |
| 24 | For grown-ups · Why this story | למבוגרים · למה הסיפור הזה | |
| 25 | Today we practiced | מה תרגלנו היום | |
| 26 | Talk about it together | דברו על זה יחד | |
| 27 | Finish & save `${childProfile.name}`'s development | סיימו ושמרו את ההתפתחות של `${childProfile.name}` | |
| 28 | Saved to `${childProfile.name}`'s development | נשמר להתפתחות של `${childProfile.name}` | |

## Part 4 — Play domain labels (`PLAY_DOMAIN_LABEL`, parent-facing)

| Domain | EN | Current HE | Reviewer verdict |
|---|---|---|---|
| `regulation` | settling big feelings | להירגע מרגשות גדולים | |
| `language` | talking and words | דיבור ומילים | |
| `motor` | moving and coordination | תנועה ותיאום | |
| `cognitive` | focus and problem-solving | ריכוז ופתרון בעיות | |
| `social` | playing with others | משחק עם אחרים | |

---

## Part 5 — Full HE playbank (`PLAY_ACTIVITIES_HE`, 267 entries)

Grouped by domain. EN title + band shown for reference; the EN source text lives beside each
entry in `content.ts`. Review the HE for native register, clarity and parent-friendliness;
mark corrections inline or in the verdict line.

### Domain: regulation — settling big feelings / להירגע מרגשות גדולים (52)

#### 1. Make a calm-down jar `calm-down-jar` (preschool, early-school)

- **HE title:** להכין צנצנת הרגעה
- **HE what it builds:** כלי משותף לעבור דרך רגשות גדולים במקום להילחם בהם.
- **HE steps:**
  1. מלאו צנצנת כמעט עד הסוף במים והוסיפו כפית נצנצים.
  2. נערו יחד והתבוננו בנצנצים מסתחררים ואז שוקעים.
  3. תנו לזה שם: 'כשאנחנו מרגישים סערה, אנחנו מתבוננים בה נרגעת ונושמים'.
  4. השאירו אותה במקום נגיש כדי שיוכלו לבחור בה בהתפרצות הבאה.
- **HE household items:** צנצנת שקופה עם מכסה · מים · נצנצים או חרוזים קטנים
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 2. Today's feelings weather report `feelings-weather` (preschool, early-school)

- **HE title:** תחזית מזג האוויר של הרגשות היום
- **HE what it builds:** מילים לרגשות, כדי שיוכלו לקרוא בשם לסערה לפני שהיא נוחתת.
- **HE steps:**
  1. שאלו: 'מזג האוויר הפנימי שלך עכשיו שמשי, מעונן, גשום או סוער?'
  2. ציירו יחד, אין תשובות נכונות או שגויות.
  3. שתפו גם אתם, באותן מילים פשוטות.
  4. בדקו שוב לפני השינה ושימו לב אם מזג האוויר השתנה.
- **HE household items:** נייר · צבעים או טושים
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 3. Five-minute transition game `transition-countdown` (toddler, preschool)

- **HE title:** משחק המעבר של חמש דקות
- **HE what it builds:** מעברים והפסקות חלקים יותר, עם פחות מאבקים ביציאה מהפארק.
- **HE steps:**
  1. לפני המעבר הבא, כווננו יחד טיימר לחמש דקות.
  2. תנו למשימה שם: 'כשזה יצפצף, אנחנו בלשי נעליים'.
  3. ספרו לאחור לאט מחמש כשהזמן נגמר.
  4. חגגו את המעבר החלק, אפילו קטן.
- **HE household items:** טיימר מטבח או טיימר בטלפון
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 4. Name the wobble `name-the-feeling-toddler` (toddler)

- **HE title:** לתת שם לסערה
- **HE what it builds:** החיבור הראשון בין רגש גדול למילה עבורו.
- **HE steps:**
  1. התכופפו לגובה שלהם כשמתחילה התפרצות.
  2. הכניסו את הרגש למילה אחת קצרה: 'אתה כועס.'
  3. הישארו רגועים וקרובים; אתם העוגן.
  4. כשזה עובר, תנו שם למה שעזר: 'חיבוק עזר.'
- **HE household items:** כלום — רק אתם
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 5. Sway-and-shush wind-down `swaddle-sway` (infant)

- **HE title:** הרגעת נדנוד ושקט
- **HE what it builds:** נתיב מוקדם וחוזר מהבכי בחזרה לרוגע — ויסות משותף.
- **HE steps:**
  1. החזיקו אותם צמוד, חזה אל חזה, כשהבכי מתחיל.
  2. נדנדו לאט מצד לצד והוסיפו 'שששש' רך ויציב.
  3. התאימו את הנשימה שלכם לקצב איטי ואחיד.
  4. הישארו עד שהגוף מתרכך — הם שואלים מכם את הרוגע.
- **HE household items:** רק הזרועות שלכם · חדר שקט
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 6. Slow warm-water calm `warm-bath-calm` (infant, toddler)

- **HE title:** רוגע איטי של מים חמימים
- **HE what it builds:** טקס הרגעה צפוי שמרגיע את מערכת העצבים לפני השינה.
- **HE steps:**
  1. הכינו אמבט רדוד בחום נעים.
  2. שפכו מים לאט על הגב שלהם, תוך תיאור רך.
  3. השאירו אור עמום וקול שקט.
  4. עטפו אותם ישר למגבת חמה אחר כך.
- **HE household items:** אמבט חם או קערה · מטלית רכה
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 7. Five-senses reset `five-senses-reset` (preschool, early-school)

- **HE title:** איפוס חמשת החושים
- **HE what it builds:** דרך ניידת לחזור לרוגע דרך עיגון בחושים.
- **HE steps:**
  1. כשהרגשות עולים, האטו יחד.
  2. מנו חמישה דברים שאפשר לראות, ארבעה לשמוע.
  3. ואז שלושה למישוש, שניים להריח, אחד לטעום.
  4. שימו לב יחד איך הגוף מרגיש קצת יותר יציב.
- **HE household items:** איפה שאתם נמצאים
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 8. Freeze-dance music game `freeze-dance` (toddler, preschool, early-school)

- **HE title:** משחק ריקוד הקפאה
- **HE what it builds:** דוושת הבלם — לעצור את הגוף לפי אות, השורש של שליטה עצמית.
- **HE steps:**
  1. שימו שיר אהוב ורקדו יחד בחופשיות.
  2. עצרו את המוזיקה — כולם קופאים כמו פסל.
  3. הפעילו שוב והתנועעו בחזרה לחיים.
  4. תנו להם להיות מי שעוצר את המוזיקה לפעמים.
- **HE household items:** כל מוזיקה
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 9. Comfort the upset teddy `soft-toy-comfort` (toddler, preschool)

- **HE title:** לנחם את הדובי העצוב
- **HE what it builds:** מתן שם והרגעה של רגשות גדולים דרך תרגול על דובי קודם.
- **HE steps:**
  1. העמידו פנים שהדובי עצוב או כועס.
  2. שאלו 'מה יכול לעזור לדובי להרגיש טוב יותר?'
  3. תנו להם לנדנד, לחבק, או לדבר עם הדובי.
  4. שימו לב בקול: 'עזרת לדובי להירגע.'
- **HE household items:** בובה רכה
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 10. Heartbeat hold `reg-heartbeat-hold` (infant)

- **HE title:** חיבוק פעימות הלב
- **HE what it builds:** נתיב מוקדם מהמצוקה בחזרה לרוגע, דרך שיתוף פעימות הלב היציבות שלכם.
- **HE steps:**
  1. החזיקו את התינוק צמוד, חזה אל חזה, כשהבכי מתחיל.
  2. תנו לאוזן שלו לנוח ליד הלב שלכם ונשמו לאט.
  3. הוסיפו המהום נמוך ויציב כדי שירגישו את הקצב.
  4. הישארו עד שהגוף שלהם מתרכך אליכם.
- **HE household items:** 
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 11. Hum-along wind-down `reg-hum-along` (infant)

- **HE title:** רגיעה של המהום
- **HE what it builds:** קצב מרגיע ומוכר שהתינוק לומד לקשר עם הירגעות.
- **HE steps:**
  1. בחרו לחן רך אחד והמהמו אותו נמוך ולאט.
  2. התנדנדו בעדינות תוך כדי ההמהום, בקצב אחיד.
  3. השתמשו באותו לחן בכל פעם כדי שיהפוך לאות ההרגעה שלהם.
  4. תנו לקול שלכם להישאר שקט יותר ככל שהם נרגעים.
- **HE household items:** 
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 12. Slow rhythmic bounce `reg-gentle-bounce` (infant)

- **HE title:** קפיצות קצב איטיות
- **HE what it builds:** תנועה עדינה וחוזרת שעוזרת לגוף מוטרד למצוא את דרכו אל הרוגע.
- **HE steps:**
  1. החזיקו את התינוק בבטחה אל החזה או על הברך.
  2. קפצו לאט ובאופן אחיד, כמו פעימה רכה ויציבה.
  3. התאימו 'שששש' שקט לקצב הקפיצה.
  4. האטו את הקצב ככל שהנשימה שלהם מאטה.
- **HE household items:** 
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 13. Slow-stroke settle `reg-baby-massage` (infant)

- **HE title:** הרגעה בליטוף איטי
- **HE what it builds:** טקס חושי מרגיע שעוזר לגוף התינוק להירגע לפני המנוחה.
- **HE steps:**
  1. השכיבו את התינוק על משטח רך בחדר חמים ושקט.
  2. לטפו לאט במורד הזרועות והרגליים בלחץ עדין ואחיד.
  3. ספרו ברכות: 'נחמד ורגוע, נחמד ולאט'.
  4. עצרו וחבקו אם הם מפנים מבט או מתחילים לבכות.
- **HE household items:** מגבת או שמיכה רכה
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 14. Steady rocking rhythm `reg-rocking-rhythm` (infant)

- **HE title:** קצב נדנוד יציב
- **HE what it builds:** קצב נדנוד צפוי שמערכת העצבים לומדת להירגע אליו.
- **HE steps:**
  1. ערסלו את התינוק צמוד ומצאו קצב נדנוד איטי ואחיד.
  2. שמרו על נשימה רגועה ולא נחפזת.
  3. החזיקו את אותו קצב במקום להאיץ.
  4. האטו את הנדנוד עוד קצת ככל שהם נעשים כבדים ורגועים.
- **HE household items:** כיסא או פשוט הזרועות שלכם
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 15. Shush-and-walk soother `reg-shush-walk` (infant)

- **HE title:** מרגיע של הליכה ושקט
- **HE what it builds:** תנועה יחד עם צליל יציב שעוזרים לרגע קשה ומוטרד לחלוף.
- **HE steps:**
  1. החזיקו את התינוק צמוד והתחילו הליכה איטית וחלקה.
  2. הוסיפו 'שששש' ארוך ואחיד ליד האוזן שלהם.
  3. שמרו על הצעדים והצליל באותו קצב עדין.
  4. הרגישו את הרגע שבו הגוף שלהם משתחרר ומתרכך.
- **HE household items:** 
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 16. Skin-to-skin calm `reg-skin-to-skin` (infant)

- **HE title:** רוגע של מגע עור אל עור
- **HE what it builds:** חום קרוב שעוזר לפעימות הלב ולנשימה של התינוק להירגע יחד עם שלכם.
- **HE steps:**
  1. החזיקו את התינוק בחזה חשוף אל שלכם בחדר חמים.
  2. כסו את שניכם בשמיכה קלה.
  3. נשמו לאט ותנו להם להרגיש את העלייה והירידה.
  4. הישארו שקטים ורגועים, ותנו לקרבה לעשות את ההרגעה.
- **HE household items:** שמיכה חמה
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 17. Read-the-cues catch `reg-read-the-cues` (infant)

- **HE title:** לתפוס את הסימנים
- **HE what it builds:** ההלוך ושוב של שימת לב לסימנים המוקדמים של התינוק ומענה ברוגע.
- **HE steps:**
  1. שימו לב לסימנים מוקדמים של הצפה: הפניית מבט, פרפור, מצח מקומט.
  2. הגיבו בעדינות לפני שהמצוקה גדלה.
  3. תנו לזה שם ברכות: 'זה היה הרבה — בואו נאט'.
  4. הציעו שקט, פחות אור, או חיבוק כדי לעזור להם להתאפס.
- **HE household items:** 
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 18. Dim-the-lights wind-down `reg-dim-wind-down` (infant)

- **HE title:** הרגעה של עמעום האור
- **HE what it builds:** טקס הרגעה צפוי שמאותת לגוף שבטוח לנוח.
- **HE steps:**
  1. עמעמו את האור והשקיטו את החדר לפני השינה.
  2. נועו לאט ודברו בקול רך ונמוך.
  3. עשו את אותם כמה צעדים שקטים באותו סדר בכל לילה.
  4. החזיקו את התינוק ברוגע עד שעיניו נעשות כבדות.
- **HE household items:** מנורה או אור שניתן לעמעם
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 19. Warm-hands calm `reg-warm-hands-belly` (infant)

- **HE title:** רוגע של ידיים חמות
- **HE what it builds:** מגע עדין ויציב שעוזר לתינוק מוטרד למצוא שוב את הרוגע שלו.
- **HE steps:**
  1. חממו את הידיים בשפשוף זו בזו.
  2. הניחו יד אחת רכה ויציבה על הבטן או החזה של התינוק.
  3. נשמו לאט כדי שירגישו נוכחות רגועה ויציבה.
  4. שמרו על מגע יציב ועדין עד שהם נרגעים.
- **HE household items:** 
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 20. Bubble breaths together `reg-bubble-breaths` (toddler, preschool)

- **HE title:** נשימות בועות יחד
- **HE what it builds:** נשיפות איטיות ומרגיעות, שנלמדות דרך ניפוח בועות כצוות.
- **HE steps:**
  1. כשהרגשות נעשים גדולים, הוציאו יחד את הבועות.
  2. קחו נשימה איטית פנימה, ואז נשיפה ארוכה ועדינה.
  3. שימו לב שנשיפות רכות יוצרות את הבועות הכי יפות.
  4. רדפו ופוצצו אותן כשכולם מרגישים קלילים יותר.
- **HE household items:** תמיסת בועות, או סבון כלים ומים
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 21. Breathing-buddy belly breaths `reg-belly-breath-buddy` (toddler, preschool)

- **HE title:** נשימות בטן עם חבר
- **HE what it builds:** לשים לב לנשימה דרך התבוננות בצעצוע עולה ויורד על הבטן.
- **HE steps:**
  1. שכבו יחד והניחו צעצוע רך על הבטן.
  2. נשמו פנימה לאט והתבוננו בצעצוע עולה.
  3. נשמו החוצה לאט והתבוננו בו שוקע חזרה.
  4. תנו לצעצוע כמה 'נסיעות' עדינות עד שהגוף מרגיש רגוע.
- **HE household items:** צעצוע רך קטן
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 22. Build a cozy calm corner `reg-calm-corner-cozy` (toddler, preschool)

- **HE title:** לבנות פינת רוגע נעימה
- **HE what it builds:** מקום ידידותי ונבחר ללכת אליו כשהרגשות נעשים גדולים מדי להכיל.
- **HE steps:**
  1. בחרו פינה שקטה וערמו בה כריות ושמיכה.
  2. הוסיפו דבר או שניים מנחמים — צעצוע רך, ספר תמונות.
  3. בקרו בה יחד כשכולם רגועים, כדי שתרגיש בטוחה.
  4. הציעו אותה כבחירה, לא כעונש: 'רוצה להתכרבל בפינת הרוגע?'
- **HE household items:** כריות · שמיכה רכה · צעצוע רך אהוב
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 23. Feelings-faces page turn `reg-feelings-faces-book` (toddler)

- **HE title:** דפדוף בפרצופי רגשות
- **HE what it builds:** מילים ראשונות לרגשות דרך זיהוים על פרצופים זה לצד זה.
- **HE steps:**
  1. עברו יחד על ספר או תמונות, בנעימות וקרוב.
  2. הצביעו על פרצוף וקראו בשם: 'היא נראית שמחה — חיוך גדול!'
  3. נסו 'עצוב', 'כועס', 'מופתע', ושמרו על פשטות.
  4. תהו יחד: 'מתי הרגשת שמח היום?'
- **HE household items:** ספר תמונות או תמונות משפחה
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 24. Blow out the birthday candles `reg-blow-the-candles` (toddler, preschool)

- **HE title:** לכבות את נרות יום ההולדת
- **HE what it builds:** נשיפות ארוכות ומרגיעות דרך משחק 'כאילו' שכולם כבר מכירים.
- **HE steps:**
  1. הרימו חמש אצבעות כנרות יום הולדת מדומים.
  2. קחו נשימה גדולה פנימה דרך האף.
  3. כבו נר-אצבע אחד בכל פעם בנשיפות איטיות.
  4. נענעו את האחרון ונשפו רך במיוחד כדי לכבות אותו.
- **HE household items:** 
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 25. Big-squeeze bear hug `reg-big-squeeze-hug` (toddler, preschool)

- **HE title:** חיבוק דוב מתמשך
- **HE what it builds:** התחושה המרגיעה והמעגנת של לחץ יציב ובטוח ברגע קשה.
- **HE steps:**
  1. הציעו חיבוק גדול כשהרגשות רצים גבוה.
  2. תנו לחיצה עדינה ויציבה והחזיקו כמה נשימות איטיות.
  3. שאלו 'חזק יותר או רך יותר?' ולכו אחריהם.
  4. שחררו לאט ושימו לב יחד איך הגוף מרגיש.
- **HE household items:** 
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 26. Stomp the big feeling out `reg-stomp-it-out` (toddler, preschool)

- **HE title:** לרקוע את הרגש הגדול החוצה
- **HE what it builds:** דרך בטוחה להעביר רגש גדול דרך הגוף, ואז להירגע.
- **HE steps:**
  1. כשהתסכול עולה, אמרו 'בואו נרקע את זה החוצה!'
  2. רקעו גדול וחזק יחד, כמו דינוזאורים רוגזים.
  3. האטו את הרקיעות בהדרגה לדריכות עדינות על קצות האצבעות.
  4. סיימו בנשימה עמוקה ובהתנדנדות אל תוך דממה.
- **HE household items:** 
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 27. First-then picture plan `reg-first-then` (toddler, preschool)

- **HE title:** תוכנית תמונות 'קודם-אחר כך'
- **HE what it builds:** מעברים קלים יותר דרך הצגת מה קורה עכשיו ומה בא אחר כך.
- **HE steps:**
  1. ציירו שתי משבצות פשוטות: 'קודם' ו'אחר כך'.
  2. שרטטו את המשימה עכשיו במשבצת הראשונה (לסדר צעצועים).
  3. שרטטו את הכיף שבא אחר כך במשבצת השנייה (חטיף, פארק).
  4. הצביעו לאורכה בזמן המעבר: 'קודם זה, אחר כך זה'.
- **HE household items:** נייר · צבעים או טושים
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 28. All-done goodbye song `reg-goodbye-song` (toddler)

- **HE title:** שיר פרידה 'הכול נגמר'
- **HE what it builds:** אות עדין וצפוי שעוזר לסיים דבר אחד ולהתחיל את הבא.
- **HE steps:**
  1. המציאו לחן קטן לסיומים: 'ביי-ביי קוביות, נתראה בקרוב'.
  2. שירו אותו יחד כשאתם מסיימים ומסדרים.
  3. נופפו למה שאתם עוזבים: 'ביי פארק, ביי נדנדה'.
  4. השתמשו באותו שיר קטן בכל פעם כדי שיהפוך לאות.
- **HE household items:** 
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 29. Quiet mouse, loud lion `reg-quiet-mouse-loud-lion` (toddler, preschool)

- **HE title:** עכבר שקט, אריה רועם
- **HE what it builds:** מיומנות העצירה-והחלפה של התאמת הקול לאות במכוון.
- **HE steps:**
  1. אמרו 'אריה!' ורעמו גדול וחזק יחד.
  2. אמרו 'עכבר!' והצטמצמו ללחישת-צי'וץ' זעירה.
  3. החליפו ביניהם, לפעמים מהר, לפעמים לאט.
  4. תנו להם להיות הקוראים ואתם עוקבים אחרי ההחלפה שלהם.
- **HE household items:** 
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 30. Balloon-belly breathing `reg-balloon-breath` (preschool, early-school)

- **HE title:** נשימת בטן-בלון
- **HE what it builds:** כלי הרגעה נייד: מילוי וריקון הבטן כמו בלון.
- **HE steps:**
  1. הניחו ידיים על הבטן ודמיינו שהיא בלון.
  2. נשמו פנימה לאט ו'נפחו את הבלון' גדול ועגול.
  3. נשמו החוצה לאט ותנו לבלון להתרכך ולהתשטח.
  4. עשו כמה בלונים עגולים עד שהגוף מרגיש שקט יותר.
- **HE household items:** 
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 31. Long snake breath `reg-snake-breath` (preschool, early-school)

- **HE title:** נשימת נחש ארוכה
- **HE what it builds:** נשיפה ארוכה ואיטית שאומרת לגוף בעדינות שהוא יכול להירגע.
- **HE steps:**
  1. קחו נשימה גדולה פנימה דרך האף.
  2. הוציאו אותה ב'ססססס' ארוך ואיטי כמו נחש מנומנם.
  3. ראו מי מצליח ללחוש הכי חלק והכי ארוך.
  4. עשו שלוש נשימות נחש ושימו לב לרוגע שאחריהן.
- **HE household items:** 
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 32. Warm-cocoa breathing `reg-hot-cocoa-breath` (preschool, early-school)

- **HE title:** נשימת שוקו חם
- **HE what it builds:** נשימה איטית דרך משחק 'כאילו' נעים של הרחת וקירור משקה.
- **HE steps:**
  1. כופפו את הידיים סביב ספל שוקו מדומה.
  2. נשמו פנימה לאט כדי להריח כמה שהוא טוב.
  3. נשמו החוצה לאט ובעדינות כדי לקרר אותו.
  4. קחו לגימה מדומה ושימו לב לתחושה הרגועה והחמימה.
- **HE household items:** ספל או פשוט כפות ידיים
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 33. Turtle-shell tuck `reg-turtle-shell` (preschool)

- **HE title:** התכנסות לשריון צב
- **HE what it builds:** דרך משחקית לעצור ולקחת נשימה לפני שרגש גדול משתלט.
- **HE steps:**
  1. כשהרגשות נעשים גדולים, אמרו 'בואו נהיה צב'.
  2. אספו את הזרועות פנימה והתכרבלו לשריון קטן ונעים.
  3. קחו שלוש נשימות איטיות בתוך השריון הבטוח.
  4. הציצו החוצה כשרגועים ו'צאו מהשריון' יחד.
- **HE household items:** 
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 34. How-big feelings meter `reg-feelings-thermometer` (preschool, early-school)

- **HE title:** מד 'כמה גדול' לרגשות
- **HE what it builds:** לשים לב כמה גדול רגש, כדי שאפשר יהיה לתת לו שם לפני שהוא גדל.
- **HE steps:**
  1. ציירו מד פשוט: קטן למטה, גדול למעלה.
  2. שאלו 'כמה גדול הרגש עכשיו?' והצביעו יחד.
  3. התאימו כלי הרגעה לגודל: נשימה, חיבוק, הפסקה.
  4. בדקו את המד שוב אחר כך וראו אם הוא ירד.
- **HE household items:** נייר · צבעים או טושים
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 35. Pick-a-calm choice cards `reg-calm-down-cards` (preschool, early-school)

- **HE title:** קלפי 'בחר-רוגע'
- **HE what it builds:** תפריט קטן של בחירות מרגיעות שהילד יכול להושיט אליו יד בעצמו.
- **HE steps:**
  1. ציירו שלוש-ארבע רעיונות מרגיעים על קלפים: חיבוק, נשימה, מים, פינת רוגע.
  2. הכינו אותם יחד כשכולם רגועים.
  3. שמרו אותם במקום קל לתפיסה ברגע קשה.
  4. הציעו את הקלפים: 'איזה מהם מרגיש נכון עכשיו?'
- **HE household items:** נייר · צבעים או טושים
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 36. Stop and name it `reg-stop-and-name` (preschool, early-school)

- **HE title:** לעצור ולתת שם
- **HE what it builds:** לתת מילה לרגש גדול, מה שעוזר לו להרגיש קטן ובטוח יותר.
- **HE steps:**
  1. התכופפו לגובה שלהם ברגע קשה.
  2. הציעו מילה לזה: 'אתה ממש מתוסכל עכשיו'.
  3. הישארו רגועים וקרובים בזמן שהרגש עובר.
  4. כשזה מתרכך, תהו יחד מה יכול לעזור בפעם הבאה.
- **HE household items:** 
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 37. Squeeze-and-flop spaghetti `reg-squeeze-and-release` (preschool, early-school)

- **HE title:** ספגטי של לחיצה ושחרור
- **HE what it builds:** להרגיש את ההבדל בין מתוח לרגוע, ולבחור ברוגע.
- **HE steps:**
  1. לחצו את כל הגוף חזק כמו ספגטי קשה ויבש.
  2. החזיקו את הלחיצה לספירה איטית יחד.
  3. שחררו בבת אחת והתמוטטו רך כמו ספגטי מבושל.
  4. שימו לב כמה רפוי ורגוע הגוף מרגיש אחר כך.
- **HE household items:** 
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 38. Push-the-wall reset `reg-wall-push` (preschool, early-school)

- **HE title:** איפוס של דחיפת הקיר
- **HE what it builds:** פורקן בטוח לאנרגיה גדולה שעוזר לגוף לחזור לרוגע.
- **HE steps:**
  1. עמדו מול קיר יציב, כפות ידיים שטוחות עליו.
  2. דחפו חזק, כמו להזיז את הקיר, לספירה איטית.
  3. נוחו, נערו את הזרועות, וקחו נשימה.
  4. חזרו פעם או פעמיים עד שהגוף מרגיש רגוע.
- **HE household items:** קיר יציב
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 39. Watch-the-timer waiting game `reg-wait-and-watch-timer` (preschool)

- **HE title:** משחק ההמתנה של צפייה בטיימר
- **HE what it builds:** תרגול המיומנות הקשה של המתנה, עם משהו רגוע להתבונן בו.
- **HE steps:**
  1. כווננו טיימר קצר והתבוננו בו יחד.
  2. קחו נשימות איטיות בזמן שהחול זורם או השניות רצות.
  3. הריעו להמתנה כשהיא נגמרת: 'חיכית — זה היה קשה!'
  4. נסו המתנה קצת יותר ארוכה בפעם הבאה.
- **HE household items:** שעון חול או טיימר בטלפון
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 40. Square breathing `reg-square-breathing` (early-school)

- **HE title:** נשימת ריבוע
- **HE what it builds:** נשימה מרגיעה שאפשר לחזור עליה, שהילד יכול לשרטט ולעשות בעצמו.
- **HE steps:**
  1. שרטטו ריבוע באוויר עם אצבע תוך כדי נשימה.
  2. נשמו פנימה לאורך הצלע הראשונה, לאט ויציב.
  3. החזיקו לאורך העליונה, נשמו החוצה במורד הבאה, החזיקו לאורך התחתונה.
  4. שרטטו כמה ריבועים עד שהדברים מרגישים רגועים יותר.
- **HE household items:** 
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 41. Worry box `reg-worry-box` (early-school)

- **HE title:** קופסת דאגות
- **HE what it builds:** טקס עדין להניח דאגות במקום לשאת אותן כל היום.
- **HE steps:**
  1. קשטו יחד קופסה קטנה שתחזיק דאגות.
  2. כשמשהו מרגיש כבד, ציירו או כתבו אותו על פתק.
  3. קפלו והכניסו אותו לקופסה: 'הקופסה יכולה להחזיק את זה בינתיים'.
  4. בחרו זמן רגוע לפתוח אותה יחד ולדבר על מה שצריך.
- **HE household items:** קופסה קטנה · נייר · עט
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 42. Three good things wind-down `reg-three-good-things` (early-school)

- **HE title:** הרגעה של שלושה דברים טובים
- **HE what it builds:** הרגל מרגיע לפני השינה של שימת לב לרגעים טובים קטנים מהיום.
- **HE steps:**
  1. לפני השינה, כל אחד מונה שלושה דברים טובים מהיום.
  2. הם יכולים להיות זעירים: חטיף, בדיחה, אמבטיה חמה.
  3. שאלו שאלה עדינה אחת על הדבר האהוב עליהם.
  4. סיימו בנשימה איטית ולילה טוב.
- **HE household items:** 
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 43. Head-to-toe body scan `reg-body-scan` (early-school)

- **HE title:** סריקת גוף מהראש עד הבהונות
- **HE what it builds:** לשים לב ולרכך את הגוף חלק אחר חלק כדי למצוא מצב רגוע יותר.
- **HE steps:**
  1. שכבו בנוחות ועצמו את העיניים אם זה מרגיש בסדר.
  2. שימו לב לכפות הרגליים, ואז עלו לאט עד הראש.
  3. בכל חלק, נשמו ותנו לו להיות רך וכבד.
  4. סיימו בשימת לב לכך שכל הגוף מרגיש רגוע.
- **HE household items:** 
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 44. My-calm-down plan `reg-calm-plan` (early-school)

- **HE title:** תוכנית ההרגעה שלי
- **HE what it builds:** תוכנית שהילד מכין למה שעוזר לו כשרגש נעשה ממש גדול.
- **HE steps:**
  1. דברו על איך רגש גדול מרגיש בגוף.
  2. מנו כמה דברים שעוזרים: לנשום, ללכת, מים, חיבוק.
  3. ציירו או כתבו אותם כ'התוכנית שלי' על דף לשמור.
  4. תרגלו אותה פעם אחת יחד כשכולם רגועים.
- **HE household items:** נייר · צבעים או טושים
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 45. Cool-down countdown `reg-cool-down-countdown` (early-school)

- **HE title:** ספירה לאחור להירגעות
- **HE what it builds:** הרגל פשוט של עצירה-ונשימה לרגע שלפני התגובה.
- **HE steps:**
  1. כשמשהו מרגיש גדול מדי, ספרו לאחור לאט מחמש.
  2. קחו נשימה רגועה אחת על כל מספר.
  3. עד 'אחת', שימו לב שהדחף להגיב התרכך קצת.
  4. אז בחרו מה לעשות הלאה, יחד אם צריך.
- **HE household items:** 
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 46. Two-minute feelings check-in `reg-feelings-check-in` (early-school)

- **HE title:** צ'ק-אין רגשות של שתי דקות
- **HE what it builds:** ההרגל לעצור ולתת שם לאיך אתה מרגיש ומה אתה אולי צריך.
- **HE steps:**
  1. פעם ביום, עצרו ושאלו 'איך אני מרגיש עכשיו?'
  2. תנו לזה שם במילה או שתיים, בקול או במחברת.
  3. הוסיפו מה יכול לעזור: מנוחה, חטיף, שיחה, קצת שקט.
  4. שתפו גם אתם, כדי שזה ירגיש נורמלי ומשותף.
- **HE household items:** מחברת, לא חובה
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 47. Make a calm-down playlist `reg-calm-playlist` (early-school)

- **HE title:** להכין רשימת השמעה מרגיעה
- **HE what it builds:** בניית אוסף אישי של שירים מרגיעים להושיט אליו יד ככלי איפוס.
- **HE steps:**
  1. דברו על אילו שירים מרגישים רגועים ומרגיעים.
  2. בחרו כמה יחד שיהיו סט ה'הירגעות'.
  3. נסו אותו: השמיעו אחד ונשמו לאט יחד איתו.
  4. שמרו אותו בהישג יד לרגע קשה שצריך איפוס.
- **HE household items:** מוזיקה
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 48. Tell the story of the feeling `reg-name-it-to-tame-it` (early-school)

- **HE title:** לספר את הסיפור של הרגש
- **HE what it builds:** להרגיע רגש גדול דרך סיפור הסיפור שלו מההתחלה עד הסוף.
- **HE steps:**
  1. כשרגועים, שבו יחד וחזרו אל הרגע הקשה.
  2. ספרו אותו כמו סיפור: 'קודם זה קרה, ואז הרגשת...'
  3. תנו להם למלא את הרגשות ואת מה שרצו.
  4. שימו לב איך דיבור על זה גורם לו להרגיש קטן יותר.
- **HE household items:** 
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 49. Take-five hand breathing `reg-take-five-hand` (preschool, early-school)

- **HE title:** נשימת יד 'קח חמש'
- **HE what it builds:** כלי הרגעה שקט וזמין תמיד, שמשורטט לאורך היד שלך.
- **HE steps:**
  1. פרשו יד אחת כמו כוכב.
  2. השתמשו באצבע השנייה כדי לשרטט לאט במעלה כל אצבע.
  3. נשמו פנימה בעלייה על אצבע, החוצה בירידה.
  4. שרטטו את כל חמש האצבעות ושימו לב לתחושה הרגועה יותר.
- **HE household items:** 
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 50. Five-senses grounding `reg-five-senses-grounding` (preschool, early-school)

- **HE title:** עיגון בחמשת החושים
- **HE what it builds:** דרך קטנה לחזור לרגע הנוכחי כשהרגשות גדולים.
- **HE steps:**
  1. כשמרגישים מבולבלים, מאטים יחד ולוקחים נשימה אחת.
  2. מוצאים חמישה דברים שאפשר לראות, ואז ארבעה שאפשר לשמוע.
  3. שמים לב לשלושה דברים שאפשר לגעת בהם, שניים להריח ואחד לטעום.
  4. שמים לב איך הגוף קצת יותר יציב בסוף.
- **HE household items:** לא צריך כלום
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 51. Melting snowman `reg-melting-snowman` (toddler, preschool)

- **HE title:** איש שלג נמס
- **HE what it builds:** דרך משחקית לתת לגוף מתוח להתרכך ולהשתחרר.
- **HE steps:**
  1. עומדים זקופים ונוקשים כמו איש שלג קפוא.
  2. מדמיינים שהשמש יוצאת ולאט לאט מתחילים להימס.
  3. נותנים לידיים, לכתפיים ולברכיים להישמט עד שנמסים לרצפה.
  4. שוכבים רגע בשקט ומרגישים כמה הגוף רפוי וכבד.
- **HE household items:** לא צריך כלום
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 52. Blanket fort story camp `ext-blanket-fort-story` (toddler, preschool)

- **HE title:** מחנה סיפורים במבצר שמיכות
- **HE what it builds:** רגיעה איטית ונעימה שמסתיימת רגועה יותר משהתחילה.
- **HE steps:**
  1. בנו את המבצר יחד — כיסאות לקירות, שמיכות לגג, כריות בפנים.
  2. זחלו פנימה עם הספרים ואור רך.
  3. קראו בקול שקט יותר ויותר, ותנו לגוף להירגע.
  4. סיימו בקטע אהוב אחד בלחישה, כל אחד בתורו.
- **HE household items:** שמיכות וכיסאות · כריות · פנס או מנורה קטנה · שניים-שלושה ספרים אהובים
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

### Domain: language — talking and words / דיבור ומילים (53)

#### 53. Sportscaster of snack time `narrate-the-day` (infant, toddler)

- **HE title:** שדרן הספורט של ארוחת הביניים
- **HE what it builds:** יותר מילים והקצב של שיחה, שזורים ברגע רגיל.
- **HE steps:**
  1. תארו בקול את ארוחת הביניים או ההתלבשות, לאט.
  2. קראו בשם למה שהם מסתכלים עליו: 'אתה רואה את הכוס האדומה'.
  3. עצרו אחרי שדיברתם, ותנו מקום לצליל או מילה בחזרה.
  4. הגיבו לכל מה שהם מציעים כאילו זה משפט שלם.
- **HE household items:** מה שאתם כבר עושים
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 54. Make up a story, one line each `story-swap` (preschool, early-school)

- **HE title:** ממציאים סיפור, שורה לכל אחד
- **HE what it builds:** בניית משפטים ודמיון דרך סיפור הלוך ושוב.
- **HE steps:**
  1. התחילו ב'פעם היה דרקון מאוד מנומנם...'
  2. הוסיפו בתורות שורה אחת כל אחד.
  3. אמרו כן לפניות הפראיות שלהם, ואז בנו עליהן.
  4. סיימו יחד ב'וככה זה...'.
- **HE household items:** כלום, או צעצוע אהוב כדמות
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 55. Point and name around the room `point-and-name` (toddler)

- **HE title:** להצביע ולקרוא בשם בחדר
- **HE what it builds:** מילים ראשונות וקשב משותף דרך קריאת שם למה שהם מסתכלים עליו.
- **HE steps:**
  1. עקבו אחרי המבט שלהם והצביעו על מה שהם רואים.
  2. קראו בשם לאט וברור: 'כלב. זה כלב.'
  3. עצרו ותנו להם תור להצביע.
  4. חזרו על הצליל או המילה שלהם, קצת יותר מלאים.
- **HE household items:** ספר תמונות, או פשוט החדר
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 56. Two-step helper `two-step-helper` (toddler, preschool)

- **HE title:** עוזר בשני שלבים
- **HE what it builds:** הקשבה והחזקת שני דברים בראש: 'קח את הנעליים, תביא אותן לכאן.'
- **HE steps:**
  1. תנו קודם הוראה אחת ברורה וחגגו אותה.
  2. כשמוכנים, נסו שני שלבים: 'הרם את הכוס, שים אותה בכיור.'
  3. השתמשו בתנועות יחד עם המילים.
  4. הודו להם על העזרה, באופן ספציפי.
- **HE household items:** חפצים יומיומיים
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 57. Sing the everyday routine `sing-the-routine` (infant)

- **HE title:** לשיר את שגרת היום
- **HE what it builds:** המנגינה והקצב של השפה, הרבה לפני המילים הראשונות.
- **HE steps:**
  1. בחרו רגע יומי אחד — החלפת חיתול או התלבשות.
  2. שירו את מה שאתם עושים לכל לחן פשוט.
  3. השתמשו באותו שיר קטן בכל פעם כדי שיהיה מוכר.
  4. עצרו וחייכו, השאירו מקום לגעגוע בחזרה.
- **HE household items:** רק הקול שלכם
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 58. Copy the coo conversation `copy-the-coo` (infant)

- **HE title:** שיחת חיקוי גרגורים
- **HE what it builds:** פעימת הלב של תורות בשיחה, באמצעות צלילים ולא מילים.
- **HE steps:**
  1. התמקמו פנים אל פנים וחכו לגרגור או מלמול.
  2. חזרו על הצליל המדויק שלהם, בחום.
  3. עצרו ותנו להם תור לענות.
  4. הוסיפו צליל רך חדש אחד וראו אם ינסו אותו.
- **HE household items:** רק אתם, פנים אל פנים
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 59. I-spy with first sounds `i-spy-sounds` (preschool, early-school)

- **HE title:** 'אני רואה' עם צליל ראשון
- **HE what it builds:** שמיעת הצליל הראשון במילים — צעד מוקדם לקראת קריאה.
- **HE steps:**
  1. אמרו 'אני רואה משהו שמתחיל ב‑מממ…'
  2. תנו להם לנחש ולחפש בחדר.
  3. מתחו את הצליל יחד כשהם מוצאים.
  4. החליפו תפקידים ותנו להם להציב את הרמז הבא.
- **HE household items:** מה שיש בחדר
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 60. Two-true-things storytelling `two-truths-tale` (early-school)

- **HE title:** סיפור משני דברים אמיתיים
- **HE what it builds:** משפטים ארוכים יותר, רצף, והביטחון לספר סיפור בקול.
- **HE steps:**
  1. כל אחד משתף שני דברים אמיתיים שקרו היום.
  2. בחרו אחד ומתחו אותו לסיפור בן שלושה חלקים: התחלה, אמצע, סוף.
  3. שאלו שאלה סקרנית אחת כדי להצמיח את הגרסה שלהם.
  4. החליפו ותנו להם לשאול על שלכם.
- **HE household items:** לא צריך כלום
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 61. Make-a-rhyme word game `rhyme-time` (toddler, preschool)

- **HE title:** משחק מילים של חריזה
- **HE what it builds:** שמיעת הצלילים שבתוך מילים — הכנה משחקית לקריאה.
- **HE steps:**
  1. אמרו מילה פשוטה כמו 'גל'.
  2. בתורות הוסיפו חרוזים — תל, חל, ואפילו מומצאים מצחיקים.
  3. צחקו ממילות השטות; הן עדיין בונות את המיומנות.
  4. נסו מילת פתיחה חדשה בכל סיבוב.
- **HE household items:** לא צריך כלום
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 62. Sing-song baby talk `lang-parentese-play` (infant)

- **HE title:** דיבור תינוקי מזמר
- **HE what it builds:** הדיבור המזמר והמאורך שתינוקות הכי מתחברים אליו, שמכניס לאוזניהם את צלילי שפת הבית.
- **HE steps:**
  1. התקרבו, פנים אל פנים, במקום שבו הם רואים את הפה שלכם.
  2. דברו בקול חם, גבוה ומזמר, עם תנועות ארוכות ומתוחות.
  3. שמרו על משפטים קצרים: 'שלוֹוֹם, תינוק מתוק, אתה רעֵב?'
  4. עצרו וחייכו, ותנו להם רגע לגרגר בחזרה.
- **HE household items:** 
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 63. Wait for the answer `lang-wait-and-listen` (infant, toddler)

- **HE title:** לחכות לתשובה
- **HE what it builds:** התובנה שגם התור שייך להם, על ידי השארת שתיקה אמיתית שהם ימלאו.
- **HE steps:**
  1. אמרו דבר קצר אחד ואז הפסיקו לדבר.
  2. ספרו לאט עד עשר בראש, וצפו בהם בציפייה.
  3. התייחסו לכל צליל, תזוזה או מבט כאל תשובה, וענו בחום.
  4. חכו שוב, כדי שההלוך ושוב ישמור על הקצב.
- **HE household items:** 
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 64. Talk through dressing time `lang-dressing-play-by-play` (infant)

- **HE title:** לתאר את זמן ההתלבשות
- **HE what it builds:** זרם קבוע של מילים שעוטף רגע שממילא קורה בכל יום.
- **HE steps:**
  1. בזמן ההלבשה או ההחתלה, אמרו כל שלב בקול.
  2. קראו בשם לאיברי הגוף ולבגדים: 'יד פנימה… עכשיו הגרב הכחולה הרכה.'
  3. שמרו על קול קליל ולא ממהר.
  4. עצרו בסוף וחכו לצליל שיענה בחזרה.
- **HE household items:** 
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 65. What the animal says `lang-animal-says` (infant, toddler)

- **HE title:** מה החיה אומרת
- **HE what it builds:** גשר ראשון בין צליל למשמעות, שמקשר את ה'האו' לכלב שהם רואים.
- **HE steps:**
  1. הצביעו על חיה בספר או על צעצוע.
  2. קראו לה בשם והוסיפו את הקול שלה: 'כלב. הכלב עושה האו-האו.'
  3. עשו את הקול גדול ומשחקי, ואז חכו.
  4. חזרו על כל צליל שהם מנסים, כאילו אתם משוחחים.
- **HE household items:** ספר תמונות או חיות צעצוע
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 66. Babble back and forth `lang-babble-tennis` (infant)

- **HE title:** מלמול הלוך ושוב
- **HE what it builds:** פעימת הלב של תורות בשיחה, כולה במלמול.
- **HE steps:**
  1. חכו למלמול — 'בה-בה' או 'דה-דה'.
  2. ענו באותו צליל, בחום, כמו תשובה.
  3. עצרו ותנו להם את התור הבא.
  4. המשיכו את החילופין כל עוד הם מעוניינים.
- **HE household items:** 
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 67. First board-book share `lang-board-book-peek` (infant)

- **HE title:** שיתוף ספר קשיח ראשון
- **HE what it builds:** קשרים חמים ומוקדמים בין חיבוק, תמונות וצליל המילים על הדף.
- **HE steps:**
  1. הושיבו אותם בחיק עם ספר קשיח ועבה.
  2. אתם לא חייבים לקרוא כל מילה — פשוט דברו על התמונות.
  3. קראו בשם למה שהם מסתכלים עליו ותנו להם לטפוח על הדף.
  4. עצרו כשהם מאבדים עניין; שמרו על קצר ונעים.
- **HE household items:** ספר קשיח ועמיד
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 68. One rhyme, sung daily `lang-nursery-rhyme-time` (infant, toddler)

- **HE title:** חרוז אחד, מושר כל יום
- **HE what it builds:** אוזן לקצב ולחריזה של השפה, דרך שיר שהם שומעים שוב ושוב.
- **HE steps:**
  1. בחרו חרוז פשוט אחד כמו 'עוגה עוגה' או 'ידיים למעלה'.
  2. שירו אותו עם אותן תנועות ידיים בכל פעם.
  3. האטו לקראת הסוף ועצרו על המילה האחרונה.
  4. שימו לב לתזוזה או צליל שאומרים 'עוד!'
- **HE household items:** 
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 69. Name it at bath time `lang-name-that-part` (infant, toddler)

- **HE title:** לקרוא בשם בזמן האמבט
- **HE what it builds:** מאגר גדל של מילים ראשונות שקשורות לגוף שהם מרגישים ורואים.
- **HE steps:**
  1. בזמן הרחצה, קראו בשם לכל איבר: 'הנה האצבעות שלך… עכשיו הבטן.'
  2. לחצו בעדינות או דגדגו כשאתם אומרים את המילה.
  3. לכו לאט וחזרו על אותן מילים בכל אמבט.
  4. עצרו וחייכו, השאירו מקום לשכשוך או צליל בחזרה.
- **HE household items:** אמבט חמים · מטלית רכה
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 70. Echo the first sounds `lang-first-sounds-echo` (infant)

- **HE title:** להדהד את הצלילים הראשונים
- **HE what it builds:** תרגול של עיצוב צלילי דיבור מוקדמים דרך החלפתם הלוך ושוב כמו משחק.
- **HE steps:**
  1. התמקמו קרוב אליהם ואמרו צלילים פשוטים: 'מה… בה… דה.'
  2. תנו להם לראות את השפתיים זזות כדי שיראו איך זה נוצר.
  3. עצרו וחכו לראות אם הם מנסים צליל.
  4. חגגו כל ניסיון והדהדו אותו מיד בחזרה.
- **HE household items:** 
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 71. Follow the look, name the thing `lang-gaze-and-name` (infant)

- **HE title:** לעקוב אחרי המבט, לקרוא בשם
- **HE what it builds:** קשב משותף — המיומנות השקטה של להסתכל יחד על אותו דבר בזמן שאתם מספקים את המילה.
- **HE steps:**
  1. שימו לב במה התינוק בוהה.
  2. הסתכלו גם אתם, ואז קראו בשם פשוט: 'האור. אור בהיר.'
  3. הצביעו עליו כך שהאצבע שלכם והעיניים שלהם פוגשות את אותו דבר.
  4. חכו, ותארו את מה שהם פונים אליו אחר כך.
- **HE household items:** 
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 72. You pick the book `lang-book-basket-choice` (toddler)

- **HE title:** אתם בוחרים את הספר
- **HE what it builds:** אהבת ספרים ושיחה מבוססת-תורות, בהובלת הבחירה של הילד עצמו.
- **HE steps:**
  1. הציעו שניים או שלושה ספרים ותנו להם לבחור אחד.
  2. עקבו אחרי הקצב שלהם — התעכבו על הדפים שהם אוהבים.
  3. שאלו 'מה זה?' ותנו להם זמן להצביע או לקרוא בשם.
  4. קראו שוב את האהוב אם הם מבקשים; החזרה היא כל העניין.
- **HE household items:** כמה ספרי תמונות
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 73. What's this? naming hunt `lang-whats-this-hunt` (toddler)

- **HE title:** ציד 'מה זה?' של שמות
- **HE what it builds:** מאגר מילים מתרחב, שנבנה מקריאת שם לחפצים האמיתיים שהפעוט נמשך לגעת בהם.
- **HE steps:**
  1. שוטטו יחד בחדר ועצרו במשהו שהם שמים לב אליו.
  2. שאלו 'מה זה?' וחכו רגע שינסו.
  3. קראו לו בשם ברור, ואז הוסיפו פרט אחד: 'כף — כף מבריקה.'
  4. תנו להם להוביל אתכם לדבר הבא.
- **HE household items:** דברים יומיומיים בחדר
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 74. Add one more word `lang-add-one-word` (toddler)

- **HE title:** להוסיף עוד מילה אחת
- **HE what it builds:** המתיחה ממילים בודדות לעבר צירופים קצרים, על ידי הגדלה עדינה של מה שהם אומרים.
- **HE steps:**
  1. הקשיבו למילה שהם מציעים, כמו 'אוטו'.
  2. אמרו אותה בחזרה עם מילה אחת נוספת: 'אוטו אדום' או 'אוטו נוסע!'
  3. שמרו על טון חם, בלי לתקן.
  4. תנו להם מקום לנסות את הגרסה הארוכה בעצמם.
- **HE household items:** 
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 75. Bring-me helper errands `lang-bring-me-errand` (toddler)

- **HE title:** שליחויות עוזר של 'תביא לי'
- **HE what it builds:** הקשבה והבנה, שמתגלות כשבקשה מדוברת פשוטה הופכת לפעולה.
- **HE steps:**
  1. בקשו דבר ברור אחד: 'אתה יכול להביא לי את הנעל שלך?'
  2. הצביעו אם הם צריכים רמז, ואז חכו.
  3. הריעו על המסירה כאילו זו העזרה הכי טובה בעולם.
  4. נסו עוד אחת ברגע שהם תפסו את העניין.
- **HE household items:** חפצי בית מוכרים
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 76. This one or that one? `lang-this-or-that` (toddler)

- **HE title:** זה או זה?
- **HE what it builds:** סיבה להושיט יד למילים, דרך הצעת בחירה אמיתית שמילה או הצבעה יכולות להכריע.
- **HE steps:**
  1. הרימו שני דברים: 'תפוח או בננה?'
  2. קראו לכל אחד בשם כשאתם מראים אותו, ואז חכו בציפייה.
  3. קבלו הצבעה, צליל או מילה כתשובה.
  4. אמרו את הבחירה בחזרה: 'בננה! בחרת בננה.'
- **HE household items:** שני חפצים, חטיפים או בגדים יומיומיים
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 77. Vroom, splash, uh-oh `lang-sound-effects-play` (toddler)

- **HE title:** וְרוּם, שְׁפְּלַאשׁ, אוֹפְּס
- **HE what it builds:** צלילים משחקיים וקלים לחיקוי שלרוב מקדימים את המילים הראשונות, שזורים במשחק דמיוני.
- **HE steps:**
  1. שחקו לצידם והוסיפו אפקטים קוליים: 'וְרוּם… בּוּם… אוֹפְּס!'
  2. שמרו על הצלילים גדולים, פשוטים וניתנים לחזרה.
  3. עצרו אחרי כל אחד וחכו שהם יצטרפו.
  4. חזרו על כל צליל שהם עושים ובנו את המשחק סביבו.
- **HE household items:** מכוניות צעצוע, קוביות או חיות
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 78. Who's in the photo? `lang-photo-people-talk` (toddler)

- **HE title:** מי בתמונה?
- **HE what it builds:** שמות לאנשים שהם אוהבים ושיחות קצרות הלוך ושוב עליהם.
- **HE steps:**
  1. הסתכלו יחד בכמה תמונות משפחתיות.
  2. הצביעו וקראו בשם: 'זה סבא. סבא!'
  3. שאלו 'מי זה?' וחכו שהם ינסו.
  4. הוסיפו סיפור קטן: 'סבא נתן לך את הברווז הצהוב.'
- **HE household items:** תמונות משפחה מודפסות או בטלפון
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 79. Kitchen food words `lang-kitchen-food-words` (toddler, preschool)

- **HE title:** מילים של אוכל במטבח
- **HE what it builds:** מילות תיאור עשירות יותר, קשורות לדברים שהם יכולים לראות, לגעת, להריח ולטעום.
- **HE steps:**
  1. בזמן הבישול, תנו להם משהו בטוח להחזיק.
  2. קראו לו בשם ותארו אותו: 'עגבנייה קרה ועגולה — כל כך אדומה.'
  3. דברו על צבע, צורה ומרקם תוך כדי.
  4. שאלו מה הם שמים לב אליו וחזרו על המילים שלהם, מלאות יותר.
- **HE household items:** אוכל שאתם כבר מכינים
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 80. Leave the last word `lang-fill-in-the-blank` (toddler, preschool)

- **HE title:** להשאיר את המילה האחרונה
- **HE what it builds:** הקשבה פעילה וזיכרון, שמוזמנים על ידי עצירה שמתחננת להתמלא במילה החסרה.
- **HE steps:**
  1. בחרו ספר או שיר שהם מכירים היטב.
  2. קראו או שירו יחד, ואז עצרו בדיוק לפני המילה האחרונה.
  3. חכו עם חיוך: 'כוכב קטן…'
  4. תנו להם להשלים, והריעו לכל מה שהם מציעים.
- **HE household items:** ספר או שיר מוכר
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 81. Two-word phrase play `lang-two-word-builder` (toddler)

- **HE title:** משחק צירוף של שתי מילים
- **HE what it builds:** המעבר ממילים בודדות לחיבור של שתיים, שמודגם דרך משחק שהם יכולים לחקות.
- **HE steps:**
  1. במהלך המשחק, הדגימו צירופים פשוטים של שתי מילים: 'עוד מיץ', 'משאית גדולה', 'ביי כדור'.
  2. אמרו אותם לאט וחזרו עליהם לאורך היום.
  3. עצרו ותנו להם הזדמנות לנסות.
  4. קבלו בחום כל ניסיון ואמרו את הצמד בחזרה.
- **HE household items:** 
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 82. Turn a book into a chat `lang-dialogic-reading` (preschool)

- **HE title:** להפוך ספר לשיחה
- **HE what it builds:** הבנה עמוקה יותר ודיבור עשיר יותר, בהפיכת הסיפור לשיחה דו-כיוונית במקום מונולוג.
- **HE steps:**
  1. קראו דף, ואז שאלו שאלה פתוחה: 'מה קורה כאן?'
  2. עקבו אחרי התשובה שלהם עם 'למה אתה חושב ככה?'
  3. הוסיפו מילה או רעיון חדש, ואז קשרו אותו לחייהם.
  4. תנו להם להפוך את הדף ולהוביל לפעמים.
- **HE household items:** ספר תמונות
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 83. Three-step mission `lang-three-step-directions` (preschool)

- **HE title:** משימה בשלושה שלבים
- **HE what it builds:** החזקת כמה שלבים מדוברים בראש וביצועם לפי הסדר.
- **HE steps:**
  1. תפסו את תשומת ליבם וּודאו שהם מסתכלים עליכם.
  2. תנו שלושה שלבים: 'קח את הכוס, שים אותה בכיור, ואז שב.'
  3. תנו להם לנסות את כל הרצף לפני שאתם עוזרים.
  4. הריעו למאמץ, ואז החליפו כדי שגם הם יפקדו עליכם.
- **HE household items:** חפצים יומיומיים
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 84. The why-and-because game `lang-why-because-game` (preschool)

- **HE title:** משחק ה'למה' וה'כי'
- **HE what it builds:** משפטים ארוכים יותר וחשיבת סיבה-ותוצאה, שמתעוררים מהסבר של 'למה'.
- **HE steps:**
  1. שאלו 'למה' ידידותי על היום שלהם: 'למה אנחנו לובשים מעילים?'
  2. הקשיבו ל'כי…' ותנו לזה לרוץ לאן שזה הולך.
  3. הוסיפו 'כי' משלכם כדי להדגים משפט מלא יותר.
  4. החליפו תפקידים ותנו להם לחקור אתכם.
- **HE household items:** 
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 85. Describe the mystery object `lang-mystery-bag` (preschool, early-school)

- **HE title:** תארו את החפץ המסתורי
- **HE what it builds:** מילות תיאור מדויקות והקשבה קשובה, כשרמזים הופכים לניחוש.
- **HE steps:**
  1. הסתירו כמה חפצים בתוך שקית.
  2. הכניסו יד, מששו אחד, ותארו אותו בלי לקרוא לו בשם: 'הוא רך ועגול.'
  3. תנו לשני לנחש מהרמזים.
  4. החליפו כך שהם מתארים ואתם מנחשים.
- **HE household items:** שקית או ציפית · כמה חפצים קטנים
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 86. Name-all-the... round `lang-category-round` (preschool, early-school)

- **HE title:** סבב 'תמנו את כל ה...'
- **HE what it builds:** מאגר מילים גדול ומאורגן יותר, על ידי קיבוץ מילים למשפחות.
- **HE steps:**
  1. בחרו קטגוריה: 'כמה חיות אנחנו יכולים למנות?'
  2. מנו בתורות אחת כל אחד, בלי חזרות.
  3. הריעו לקשות ותנו רמז אם הם תקועים.
  4. נסו קטגוריה חדשה — פירות, דברים שנוסעים, דברים קרים.
- **HE household items:** 
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 87. Tell the story from pictures `lang-picture-story-tell` (preschool)

- **HE title:** לספר את הסיפור מהתמונות
- **HE what it builds:** סיפור ורצף, בהפיכת תמונות לסיפור עם התחלה, אמצע וסוף.
- **HE steps:**
  1. דפדפו בספר בלי לקרוא את המילים.
  2. בקשו מהם לספר לכם מה קורה מהתמונות.
  3. כוונו את הסדר: 'מה קרה קודם? ואז מה?'
  4. הוסיפו 'ובסוף…' כדי לעגל את הסיפור יחד.
- **HE household items:** ספר תמונות, או התמונות שלכם
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 88. A fancy word for today `lang-fancy-word-day` (preschool, early-school)

- **HE title:** מילה מפונפנת להיום
- **HE what it builds:** הנאה ממילים מעניינות, על ידי אימוץ מילה 'מפונפנת' אחת ושימוש בה כל היום.
- **HE steps:**
  1. הציעו מילה חדשה וכיפית: 'ענקי', 'משובח', 'עצום'.
  2. אמרו מה היא אומרת עם דוגמה שהם יבינו.
  3. עשו מזה משחק לשלב אותה ביום: 'הכריך הזה משובח!'
  4. ספרו כמה פעמים כל אחד השתמש בה עד השינה.
- **HE household items:** 
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 89. Opposites, go! `lang-opposites-game` (preschool)

- **HE title:** הפכים, קדימה!
- **HE what it builds:** מילים לרעיונות הפוכים — גדול וקטן, למעלה ולמטה — שמחדדות איך הם מתארים את העולם.
- **HE steps:**
  1. אמרו מילה ובקשו את ההפך שלה: 'חם…?'
  2. מנו בתורות: 'למעלה… יום… מהר… שמח.'
  3. גלמו את הזוגות בגדול עם הגוף אם הם אוהבים.
  4. תנו להם להקשות עליכם עם זוג משלהם.
- **HE household items:** 
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 90. Sock-puppet conversation `lang-puppet-chat` (preschool)

- **HE title:** שיחת בובת גרב
- **HE what it builds:** דיבור בטוח הלוך ושוב, לפעמים קל יותר לבובה ידידותית מאשר פנים אל פנים.
- **HE steps:**
  1. הלבישו גרב על היד ותנו לה קול מצחיק.
  2. תנו לבובה לשאול אותם שאלות ולהקשיב באמת.
  3. תנו לבובה לעשות טעויות מצחיקות שהם יתקנו.
  4. תנו להם בובה כדי ששתי דמויות יוכלו לשוחח.
- **HE household items:** גרב או צעצוע רך
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 91. Chef's step-by-step `lang-recipe-directions` (preschool, early-school)

- **HE title:** צעד-אחר-צעד של השף
- **HE what it builds:** הקשבה לשלבים לפי סדר והמילים שמחזיקות רצף יחד — קודם, אחר כך, בסוף.
- **HE steps:**
  1. הכינו יחד חטיף פשוט, כמו למרוח ולקשט קרקרים.
  2. תנו את זה כמתכון מסודר: 'קודם מורחים, אחר כך מוסיפים גבינה, בסוף ענב למעלה.'
  3. השתמשו במילות הסדר בקול תוך כדי.
  4. תנו להם להקריא לכם את ה'מתכון' בחזרה לסבב הבא.
- **HE household items:** מרכיבי חטיף פשוטים ללא בישול
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 92. Another word for that `lang-synonym-stretch` (early-school)

- **HE title:** מילה אחרת לזה
- **HE what it builds:** אוצר מילים גמיש, על ידי איסוף מילים רבות שמשמעותן כמעט זהה.
- **HE steps:**
  1. בחרו מילה פשוטה כמו 'גדול'.
  2. התחרו במניית מילים אחרות לזה: 'ענק, עצום, אדיר, כביר.'
  3. דברו על ההבדלים הזעירים במשמעות ביניהן.
  4. נסו מילת פתיחה חדשה ושמרו רשימה מתמשכת.
- **HE household items:** 
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 93. Would you rather...? `lang-would-you-rather` (early-school)

- **HE title:** מה היית מעדיף?
- **HE what it builds:** הסבר של בחירה עם נימוקים — השורשים של שכנוע ושל משפטים ארוכים ומקושרים.
- **HE steps:**
  1. הציגו בחירה כיפית: 'מה היית מעדיף — לעוף או להיות בלתי נראה?'
  2. בקשו מהם לבחור ולהסביר למה, במשפט שלם.
  3. שאלו שאלת המשך אחת: 'מה היית עושה קודם?'
  4. ענו גם אתם על השאלה שלהם.
- **HE household items:** 
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 94. Rhyme ladder challenge `lang-word-family-ladder` (early-school)

- **HE title:** אתגר סולם החריזה
- **HE what it builds:** אוזן למשפחות מילים ולתבניות איות, בטיפוס על סולם של מילים מתחרזות.
- **HE steps:**
  1. התחילו משפחת מילים: '-ל → גל.'
  2. הוסיפו בתורות חרוז: תל, חל, קל, צל.
  3. כתבו אותן ברשימה אם הם רוצים לראות את התבנית.
  4. עברו למשפחה קשה יותר והמשיכו לטפס.
- **HE household items:** נייר ועט (רשות)
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 95. Swap the first sound `lang-sound-swap` (early-school)

- **HE title:** להחליף את הצליל הראשון
- **HE what it builds:** שמיעה והזזה של הצלילים שבתוך מילים — צעד מפתח לקראת קריאה ואיות.
- **HE steps:**
  1. אמרו מילה לאט: 'ג-ל, גל.'
  2. החליפו רק את הצליל הראשון: 'עכשיו שיתחיל ב-ת — תל!'
  3. החליפו בתורות צלילים ראשונים כדי ליצור מילים חדשות.
  4. צחקו ממילות השטות; גם הן בונות את המיומנות.
- **HE household items:** 
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 96. Retell it in order `lang-retell-it` (early-school)

- **HE title:** לספר מחדש לפי הסדר
- **HE what it builds:** סיפור מחדש ברור ומסודר — ארגון אירועים ושמירה על הקשב של המאזין.
- **HE steps:**
  1. אחרי סיפור או בילוי, בקשו מהם לספר אותו מחדש מההתחלה.
  2. השתמשו במילות תמרור: 'מה קרה קודם? אחר כך? בסוף?'
  3. בקשו פרט אחד שהם השמיטו: 'איך היא הרגישה?'
  4. ספרו אחד בחזרה אליהם עם טעות מכוונת שיתפסו.
- **HE household items:** ספר שקראתם, או סרט שראיתם
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 97. Describe it, I'll draw it `lang-describe-and-draw` (early-school)

- **HE title:** תאר, ואני אצייר
- **HE what it builds:** הוראות מדויקות והקשבה קשובה, שנבחנות בשאלה אם הציור תואם את המילים.
- **HE steps:**
  1. אדם אחד מצייר תמונה פשוטה בסוד.
  2. הוא מתאר אותה צעד אחר צעד בזמן שהשני מצייר בעיוורון.
  3. בלי להציץ — רק מילים מותרות.
  4. השוו בין השניים וצחקו על הפערים, ואז החליפו תפקידים.
- **HE household items:** נייר · עטים
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 98. Riddles and word jokes `lang-riddle-and-pun` (early-school)

- **HE title:** חידות ומשחקי מילים
- **HE what it builds:** אוזן למשמעות כפולה ולמשחקי מילים מחוכמים — הקצה הכיפי של אוצר מילים עשיר.
- **HE steps:**
  1. שתפו חידה פשוטה או משחק מילים: 'למה הבננה הלכה לרופא?'
  2. תנו להם לפצח את זה וליהנות מהגניחה.
  3. דברו על המשמעות הכפולה שגורמת לזה לעבוד.
  4. אתגרו אותם להמציא אחד משלהם.
- **HE household items:** 
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 99. Write tonight's menu `lang-menu-writer` (early-school)

- **HE title:** לכתוב את התפריט של הערב
- **HE what it builds:** סיבה אמיתית לכתוב, לאיית ולהקריא — שימוש בכתב למשימה אמיתית.
- **HE steps:**
  1. הזמינו אותם להכין תפריט לארוחת ערב או לבית קפה מדומה.
  2. תנו להם לפצח את הצלילים ולכתוב את המנות בדרכם.
  3. הוסיפו מחירים, שמות מפונפנים, או מנה מיוחדת ליום.
  4. תנו להם להקריא את התפריט בקול כדי לקבל הזמנות מכולם.
- **HE household items:** נייר · עטים
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 100. Roving reporter interview `lang-kid-reporter` (early-school)

- **HE title:** ראיון של כתב נודד
- **HE what it builds:** לשאול שאלות טובות ולבנות על תשובות — התן-וקח של שיחה אמיתית.
- **HE steps:**
  1. תנו להם 'מיקרופון' ואדם לראיין.
  2. אמנו שאלות פתוחות: 'מה היה החלק הכי טוב ביום שלך?'
  3. כוונו לשאלת המשך שמבוססת על התשובה, לא לנושא חדש.
  4. החליפו כדי שגם הם יתראיינו.
- **HE household items:** מיקרופון מדומה (רשות)
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 101. Spot the letters out and about `lang-print-spotting` (early-school)

- **HE title:** לזהות אותיות בחוץ ובדרכים
- **HE what it builds:** מודעות לכתב — לשים לב שהאותיות והמילים סביבם נושאות משמעות.
- **HE steps:**
  1. בטיול או בחנות, חפשו אות נבחרת על שלטים.
  2. קראו יחד מילים קצרות: עצור, יציאה, שם של חנות.
  3. שאלו מה הם חושבים ששלט אומר לנו.
  4. תנו להם לזהות ו'לקרוא' את הבא.
- **HE household items:** שלטים ותוויות סביבכם
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 102. I spy, describe it `lang-i-spy-describe` (toddler, preschool)

- **HE title:** אני רואה, תארו את זה
- **HE what it builds:** מילים לצבעים, גדלים וצורות — וסבלנות להקשיב לרמזים.
- **HE steps:**
  1. בוחרים משהו ששניכם רואים אבל שומרים בסוד.
  2. נותנים רמז אחד עליו: 'אני רואה משהו עגול ואדום'.
  3. מוסיפים רמז חדש בכל ניחוש עד שמוצאים אותו.
  4. מתחלפים בתפקידים כדי שגם הם יתארו וגם אתם תנחשו.
- **HE household items:** לא צריך כלום
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 103. Story stones `lang-story-stones` (preschool, early-school)

- **HE title:** אבני סיפור
- **HE what it builds:** בניית סיפור עם התחלה, אמצע וסוף מתוך כמה תמונות רמז.
- **HE steps:**
  1. מציירים תמונה פשוטה על כל אבן או פיסת נייר — שמש, כלב, סירה.
  2. הופכים אותן כלפי מטה ומתחלפים בהפיכת אחת.
  3. מוסיפים משפט לסיפור בכל פעם שתמונה חדשה מתגלה.
  4. מספרים יחד את הגרסה האהובה עליכם בסוף.
- **HE household items:** כמה אבנים קטנות או פיסות נייר · טושים
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 104. Cozy book nest `std-infant-book-nest` (infant)

- **HE title:** קן ספרים מפנק
- **HE what it builds:** זמן חמים ולא ממהר עם ספרים, קולות ודפדוף משותף.
- **HE steps:**
  1. בנו קן קטן מכריות והתמקמו בו יחד.
  2. קראו ספר אחד לאט, ותנו שם למה ששניכם רואים בכל עמוד.
  3. תנו להם לטפוח, להצביע או ללעוס פינה — גם זו קריאה, בגיל הזה.
  4. שירו שיר שקט אחד לפני שיוצאים מהקן.
- **HE household items:** שניים-שלושה ספרי תינוקות קשיחים · כריות או שמיכה מקופלת
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 105. Make puppets, put on the show `ext-sock-puppet-show` (preschool, early-school)

- **HE title:** מכינים בובות ומעלים הצגה
- **HE what it builds:** להמציא דמויות ולתת להן קולות — מהכנה, דרך עלילה, ועד הופעה.
- **HE steps:**
  1. הפכו גרב בודדה לדמות עם טושים וחומרים מהבית, כל אחד את שלו.
  2. החליטו דבר אחד על כל בובה: שם, קול, מילה אהובה.
  3. המציאו הצגה קצרה מאחורי הספה — פגישה, בעיה, סוף.
  4. הופיעו בפני קהל של בובות פרווה, ואז התחלפו בבובות ושחזרו.
- **HE household items:** גרביים בודדות · טושים · כפתורים או פיסות בד · גב ספה כבמה
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

### Domain: motor — moving and coordination / תנועה ותיאום (54)

#### 106. Sock-ball basketball `sock-basketball` (toddler, preschool, early-school)

- **HE title:** כדורסל גרביים
- **HE what it builds:** כיוון, זריקה והמתנה לתור, תוך כדי שריפת אנרגיה.
- **HE steps:**
  1. גלגלו כמה זוגות גרביים לכדורים.
  2. הציבו את הסל כמה צעדים משם וזרקו בתורות.
  3. התרחקו צעד אחד בכל פעם שהם קולעים.
  4. הריעו לזריקה, לא רק לקליעה.
- **HE household items:** גרביים מגולגלים · סל כביסה
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 107. Pots-and-pans kitchen band `kitchen-band` (infant, toddler)

- **HE title:** תזמורת המטבח של סירים ומחבתות
- **HE what it builds:** סיבה ותוצאה וקצב יציב, דרך הקשה עם כוונה.
- **HE steps:**
  1. תנו להם סיר וכף עץ.
  2. החזירו להם את הקצב שלהם, ואז הוסיפו קצב משלכם.
  3. לכו חזק, אחר כך בלחישה, וחזרה לחזק.
  4. עקבו אחריהם יותר מאשר תובילו.
- **HE household items:** סיר או מחבת · כף עץ
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 108. Blow and chase bubbles `bubble-chase` (toddler)

- **HE title:** לנשוף ולרדוף אחרי בועות
- **HE what it builds:** תנועה של שרירים גדולים והנאה משותפת, ומעקב עם העיניים.
- **HE steps:**
  1. נשפו כמה בועות גבוה למעלה.
  2. רדפו ופוצצו אותן יחד.
  3. עצרו עם המקל וחכו ל'עוד'.
  4. תנו להם לנסות לנשוף, גם אם כלום לא יוצא.
- **HE household items:** תמיסת בועות, או סבון כלים ומים
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 109. Tummy-time reach `tummy-time-reach` (infant)

- **HE title:** הושטת יד בזמן שכיבה על הבטן
- **HE what it builds:** חוזק צוואר, גב וזרועות — הבסיס לישיבה ולזחילה.
- **HE steps:**
  1. השכיבו אותם על הבטן על משטח רך ובטוח.
  2. רדו לגובה שלהם, פנים אל פנים, ושוחחו.
  3. הניחו צעצוע מעט מחוץ להישג יד כדי להזמין מתיחה.
  4. שמרו על זמן קצר ושמח; הפסיקו לפני שזה מאבק.
- **HE household items:** שטיחון רך · צעצוע אהוב
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 110. Walk-the-tightrope tape line `tape-line-walk` (preschool, early-school)

- **HE title:** ללכת על חבל מתוח של נייר דבק
- **HE what it builds:** שיווי משקל ושליטה בגוף דרך הליכת 'לא ליפול ללבה' משחקית.
- **HE steps:**
  1. הדביקו קו ישר של נייר דבק לאורך הרצפה.
  2. לכו עליו עקב-אצבע יחד, ידיים פרושות כמו כנפיים.
  3. נסו לאחור, ואז על קצות האצבעות.
  4. הוסיפו משחק 'מתנדנד ומתאושש' לתרגול שיווי המשקל.
- **HE household items:** רצועת נייר דבק על הרצפה
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 111. Paper-ball target challenge `paper-toss-challenge` (early-school)

- **HE title:** אתגר קליעת כדורי נייר
- **HE what it builds:** כיוון, תיאום עין-יד, והתמדה באתגר כדי לשבור שיא.
- **HE steps:**
  1. כדררו כמה דפי טיוטה לכדורים.
  2. הציבו פח כמה צעדים משם וכוונו בתורות.
  3. התרחקו צעד בכל פעם שקולעים.
  4. עקבו אחרי השיא של היום ונסו לשבור אותו מחר.
- **HE household items:** דפי טיוטה · פח או קערה
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 112. Cushion obstacle course `obstacle-cushions` (toddler, preschool)

- **HE title:** מסלול מכשולים מכריות
- **HE what it builds:** תיאום שרירים גדולים ותכנון מסלול עם כל הגוף.
- **HE steps:**
  1. הניחו כריות כאבני דריכה לרוחב הרצפה.
  2. הראו את המסלול: מעל, מסביב, מתחת לשמיכה.
  3. הריעו לכל מעבר והוסיפו שלב חדש בכל סיבוב.
  4. תנו להם לתכנן את המסלול הבא.
- **HE household items:** כריות · שמיכה
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 113. Tummy time at the mirror `motor-tummy-mirror` (infant)

- **HE title:** זמן בטן מול מראה
- **HE what it builds:** חוזק צוואר, כתפיים וגב שמכין את הגוף להתהפך ולשבת.
- **HE steps:**
  1. השכיבו אותם על הבטן על משטח רך ובטוח כשהם ערים ושמחים.
  2. הציבו מראה בטוחה מולם בגובה העיניים.
  3. רדו גם אתם למטה ושוחחו, כדי שירימו את הראש להסתכל.
  4. שמרו על זמן קצר ושמח — הפסיקו לפני שזה הופך למאבק.
- **HE household items:** שטיחון או שמיכה רכה · מראה בלתי שבירה או מגש מבריק
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 114. Reach and bat the dangle `motor-reach-and-bat` (infant)

- **HE title:** להושיט יד ולחבוט בתלוי
- **HE what it builds:** לכוון זרוע אל משהו שהם רואים — ההתחלה של הושטת יד ותפיסה.
- **HE steps:**
  1. השכיבו אותם על הגב במקום נוח.
  2. תלו מטפחת קלה או צעצוע רך ממש מעל החזה שלהם.
  3. חכו לתנועת חבטה, אז תנו להם לגעת והריעו.
  4. הזיזו אותה לאט מצד לצד כדי שיושיטו יד לרוחב הגוף.
- **HE household items:** מטפחת קלה או צעצוע רך · היד שלכם כדי להחזיק
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 115. Grab-and-pull scarf play `motor-grasp-scarf` (infant)

- **HE title:** משחק תפיסה ומשיכה של מטפחת
- **HE what it builds:** אחיזה חזקה יותר והקצב של משיכה-ושחרור של אצבעות קטנות.
- **HE steps:**
  1. העבירו מטפחת גדולה וקלה על כף היד הפתוחה שלהם.
  2. כשהאצבעות נסגרות, עשו משיכת חבל עדינה ומשחקית.
  3. תנו להם לנצח ולמשוך אותה אליהם.
  4. הישארו קרוב כדי שהבד לעולם לא יכסה את הפנים.
- **HE household items:** מטפחת גדולה וקלה או בד מוסלין
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 116. Roll toward the toy `motor-roll-toward-toy` (infant)

- **HE title:** להתגלגל אל הצעצוע
- **HE what it builds:** הסיבוב של כל הגוף שהופך שכיבה להתהפכות.
- **HE steps:**
  1. השכיבו אותם על הגב על משטח רך ובטוח.
  2. הניחו צעצוע אהוב מעט מחוץ להישג יד לצד אחד.
  3. עודדו אותם להסתובב ולהתגלגל לכיוונו.
  4. חגגו את המאמץ עוד לפני שההתהפכות המלאה קורית.
- **HE household items:** שטיחון רך · צעצוע אהוב
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 117. Pass it hand to hand `motor-hand-to-hand-pass` (infant)

- **HE title:** להעביר מיד ליד
- **HE what it builds:** העברת חפץ מיד אחת לשנייה — עבודת צוות מוקדמת של שתי ידיים.
- **HE steps:**
  1. שבו איתם והציעו צעצוע קל ונוח לאחיזה ליד אחת.
  2. כשהם מחזיקים אותו, הציעו צעצוע שני לאותה יד.
  3. התבוננו בהם מעבירים את הצעצוע הראשון ליד השנייה כדי לקחת.
  4. האטו ותנו להם זמן לפתור את זה.
- **HE household items:** רעשן קל, נשכן או קובייה רכה
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 118. Sit-and-reach with support `motor-supported-sit-reach` (infant)

- **HE title:** לשבת ולהושיט יד בתמיכה
- **HE what it builds:** שיווי משקל של הגו לישיבה יציבה בזמן שהידיים עסוקות בהושטה.
- **HE steps:**
  1. הושיבו אותם עם כרית מאחור או הידיים שלכם על המותניים.
  2. הניחו כמה צעצועים בקשת מולם.
  3. תנו להם להישען ולהושיט יד לאחד, ואז לשני.
  4. הישארו ממש שם כדי לייצב כל רעידה.
- **HE household items:** כרית או הגוף שלכם לתמיכה · כמה צעצועים
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 119. Crawl-to-me chase `motor-crawl-to-me` (infant)

- **HE title:** מרדף זחילה אליי
- **HE what it builds:** תיאום הזרועות והרגליים של זחילה ותנועה אל מטרה.
- **HE steps:**
  1. פנו מקטע קצר ובטוח של רצפה.
  2. כרעו מעט מרחק והרימו צעצוע אהוב.
  3. הזמינו אותם לבוא לקחת, והריעו לכל תזוזה.
  4. התרחקו צעד קטן כשהם מגיעים, ואז חגגו יחד.
- **HE household items:** מקטע פנוי של רצפה · צעצוע שהם אוהבים
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 120. Pull up and cruise `motor-pull-to-stand-cruise` (infant)

- **HE title:** להתרומם לעמידה ולצעוד לצדדים
- **HE what it builds:** חוזק רגליים ושיווי משקל בעמידה — מסלול ההמראה לצעדים הראשונים.
- **HE steps:**
  1. הניחו צעצוע על משטח נמוך ויציב שהם יכולים להגיע אליו בעמידה.
  2. עזרו להם לאחוז בקצה ולהתרומם לעמידה.
  3. החליקו את הצעצוע לצד כדי שיצעדו לצדדים לכיוונו.
  4. הישארו לצדם כדי לתפוס כל נפילה לנחיתה רכה.
- **HE household items:** ספה או שולחן נמוך ויציב · צעצוע על המשטח
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 121. Soft finger-food pick-up `motor-soft-finger-food-pincer` (infant)

- **HE title:** הרמת מזון-אצבע רך
- **HE what it builds:** צביטת האגודל והאצבע שמאפשרת לידיים קטנות להרים דברים קטנים.
- **HE steps:**
  1. רק כשהם אוכלים מוצקים, הושיבו אותם זקוף ובטוח בכיסא אוכל.
  2. הניחו כמה חתיכות גדולות ורכות של בננה או ירק מבושל היטב על המגש.
  3. תנו להם להתאמן בהרמת החתיכות ובהבאתן לפה.
  4. הישארו בהישג יד ולעולם אל תשאירו אותם לבד עם אוכל.
- **HE household items:** חתיכות גדולות ורכות של בננה או ירק מבושל · מגש כיסא אוכל
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 122. Kick the dangling toy `motor-kick-the-dangle` (infant)

- **HE title:** לבעוט בצעצוע התלוי
- **HE what it builds:** כוח רגליים והשמחה של 'הזזתי את זה' כשבעיטה גורמת למשהו לקרות.
- **HE steps:**
  1. השכיבו אותם על הגב על משטח רך.
  2. החזיקו צעצוע רך במקום שהרגליים שלהם בדיוק מגיעות אליו.
  3. כשבעיטה נוחתת, הגיבו בגדול: 'הצלחת!'
  4. הזיזו אותו מעט כדי ששתי הרגליים יקבלו תור.
- **HE household items:** צעצוע רך על סרט או הידיים שלכם
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 123. Clap, wave, and copy `motor-clap-and-wave` (infant)

- **HE title:** למחוא כף, לנופף, ולחקות
- **HE what it builds:** לחבר שתי ידיים בכוונה ולחקות תנועה שהם רואים.
- **HE steps:**
  1. שבו פנים אל פנים ומחאו כף לאט, תוך שירת מנגינה קטנה.
  2. קחו את ידיהם ומחאו אותן יחד בעדינות.
  3. נופפו 'ביי-ביי' ועצרו כדי שהם ינסו בחזרה.
  4. הריעו לכל ניסיון, אפילו מתנדנד.
- **HE household items:** רק הידיים שלכם
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 124. Big chunky-crayon scribble `motor-chunky-crayon-scribble` (toddler)

- **HE title:** שרבוט גדול בצבע עבה
- **HE what it builds:** אחיזה של כל כף היד ושליטת שורש כף היד שהשרבוט הופך אליהם.
- **HE steps:**
  1. הדביקו דף נייר גדול לשולחן או לרצפה.
  2. תנו צבע עבה אחד ועשו סימן בעצמכם קודם.
  3. תנו להם לשרבט בחופשיות — נקודות, סלילים, מחיקות גדולות.
  4. תנו שם לסימנים: 'סחור סחור, למעלה ולמטה!'
- **HE household items:** דף נייר גדול · צבעים עבים
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 125. Stack it, topple it `motor-stack-and-topple` (toddler)

- **HE title:** לבנות ולהפיל
- **HE what it builds:** ההנחה-ושחרור היציבה של היד שבונה מגדל בלי להפיל אותו.
- **HE steps:**
  1. שבו יחד עם ערימה קטנה של קוביות או כוסות.
  2. הניחו שתיים, ואז תנו להם להוסיף את הבאה.
  3. ספרו את המגדל ככל שהוא גדל.
  4. הריעו למפולת, ואז בנו אותו שוב.
- **HE household items:** קוביות בנייה, כוסות פלסטיק או קופסאות קטנות
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 126. Climb the cushion mountain `motor-cushion-climb` (toddler)

- **HE title:** לטפס על הר הכריות
- **HE what it builds:** חוזק שרירים גדולים ושיווי משקל מטיפוס למעלה, מעל ולמטה בבטחה.
- **HE steps:**
  1. ערמו כמה כריות יציבות ל'הר' רך ונמוך על הרצפה.
  2. הראו להם איך לטפס למעלה ולהחליק או לרדת.
  3. הישארו קרוב עם יד תומכת לרעידות.
  4. הוסיפו עוד כרית ככל שהם נעשים אמיצים יותר.
- **HE household items:** כריות ספה · כריות רגילות
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 127. Push the loaded laundry basket `motor-push-the-basket` (toddler)

- **HE title:** לדחוף סל כביסה עמוס
- **HE what it builds:** כוח דחיפה של כל הגוף והליכה יציבה בזמן שהם מזיזים משהו כבד.
- **HE steps:**
  1. שימו כמה ספרים או צעצועים בסל כביסה למעט משקל.
  2. סובבו אותו כדי שיוכלו לדחוף אותו על רצפה פנויה.
  3. עודדו אותם ב'מסלול משלוחים' לחדר אחר.
  4. הוסיפו או הורידו משקל כדי שהמאמץ יהיה בדיוק נכון.
- **HE household items:** סל כביסה · כמה ספרים או צעצועים רכים למשקל
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 128. Pour between two cups `motor-cup-pour-transfer` (toddler)

- **HE title:** למזוג בין שתי כוסות
- **HE what it builds:** שליטת שורש כף היד של הטיה-ויציבה שמאחורי מזיגה, גריפה ואכילה עצמית.
- **HE steps:**
  1. הניחו שתי כוסות על מגש או מגבת לתפוס שפיכות.
  2. שימו מעט מים או אורז יבש בכוס אחת.
  3. הראו מזיגה איטית מכוס לכוס, ואז מסרו להם.
  4. תנו לשפיכות לקרות — זה שורש כף היד שלומד.
- **HE household items:** שתי כוסות קטנות · מעט מים או אורז יבש · מגש או מגבת
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 129. Peel and place stickers `motor-sticker-peel-place` (toddler)

- **HE title:** לקלף ולהדביק מדבקות
- **HE what it builds:** צביטת קצות האצבעות והרמה שמתפתחות מקילוף והדבקה של מדבקות קטנות.
- **HE steps:**
  1. קלפו את קצה המדבקה כדי שיהיה קל לתפוס.
  2. תנו להם לצבוט אותה ולהצמיד אותה לנייר.
  3. עשו מזה משחק: מדבקות על העיגול, על האף, על הדלת.
  4. לכו לאט כדי שהאצבעות שלהם יעשו את החלק העדין.
- **HE household items:** דף מדבקות · נייר
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 130. Kick the big ball `motor-big-ball-kick` (toddler)

- **HE title:** לבעוט בכדור הגדול
- **HE what it builds:** לעמוד על רגל אחת לרגע ולהניף את השנייה לבעיטה — עבודת שיווי משקל גדולה.
- **HE steps:**
  1. הניחו כדור רך גדול נייח על הרצפה במרחב פתוח.
  2. הראו בעיטה עדינה, ואז החזירו את הכדור למקומו עבורם.
  3. החזיקו יד בהתחלה אם הם צריכים ייצוב.
  4. הריעו להנפה, ואז רדפו אחרי הכדור יחד.
- **HE household items:** כדור רך גדול
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 131. Walk-and-carry helper `motor-walk-and-carry` (toddler)

- **HE title:** עוזר שהולך ונושא
- **HE what it builds:** שיווי משקל יציב בהליכה בזמן שהידיים עסוקות בהחזקת משהו.
- **HE steps:**
  1. תנו להם קערה או סל קלים עם פריט רך אחד בפנים.
  2. בקשו מהם לשאת אותו אליכם כמה צעדים משם.
  3. הרחיבו את המסע ככל שהאיזון שלהם מתייצב.
  4. הודו להם על המשלוח, באופן ספציפי.
- **HE household items:** קערה או סל קלים ובלתי שבירים · פריט רך לשאת בו
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 132. Drop pegs in the bottle `motor-peg-drop` (toddler)

- **HE title:** להפיל אטבים לבקבוק
- **HE what it builds:** ליישר חפץ צבוט מול מטרה ולשחרר בדיוק על הנקודה.
- **HE steps:**
  1. הניחו בקבוק רחב-פה על השולחן עם חופן אטבים גדולים.
  2. הראו להם לצבוט אטב ולהפיל אותו פנימה — 'פלינק!'
  3. שפכו אותם החוצה והתחילו שוב כמה פעמים שירצו.
  4. שמרו על האטבים גדולים והישארו קרוב לאורך כל הזמן.
- **HE household items:** בקבוק או צנצנת רחבי-פה · אטבי כביסה גדולים מעץ
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 133. Squish and pinch dough `motor-play-dough-squish` (toddler)

- **HE title:** ללחוץ ולצבוט בצק
- **HE what it builds:** חוזק היד של סחיטה-וצביטה שבהמשך מפעיל אחיזת עיפרון.
- **HE steps:**
  1. תנו להם כדור בצק על משטח נקי.
  2. לחצו אותו שטוח יחד, ואז נעצו בו אצבעות.
  3. גלגלו נחש, צבטו פיסות קטנות, ומעכו אותן.
  4. שמרו על משחק ידיים בלבד — בלי טעימות.
- **HE household items:** בצק משחק או בצק נוקשה מקמח ומים
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 134. Step up, step down `motor-step-up-step-down` (toddler)

- **HE title:** לעלות מדרגה, לרדת מדרגה
- **HE what it builds:** חוזק רגליים והעברת שיווי המשקל שדרושה לעלות ולרדת מפלס.
- **HE steps:**
  1. מצאו מדרגה נמוכה ובטוחה אחת או משטח נמוך ויציב.
  2. החזיקו יד ועלו יחד, ואז רדו.
  3. ספרו כל מדרגה ועשו מזה קצב.
  4. שחררו את היד רק כשהם יציבים וששים.
- **HE household items:** מדרגה נמוכה ויציבה או ספר עבה מודבק לרצפה
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 135. Snip-the-strips scissor play `motor-scissor-snip` (preschool)

- **HE title:** משחק מספריים של גזירת רצועות
- **HE what it builds:** חוזק היד של פתח-סגור ועבודת הצוות של שתי ידיים שמאחורי שימוש במספריים.
- **HE steps:**
  1. גזרו נייר לרצועות דקות שאפשר לגזור בגזירה אחת.
  2. הראו את אחיזת המספריים עם האגודל למעלה וגזירה נקייה אחת.
  3. תנו להם להחזיק את הרצועה ביד אחת ולגזור בשנייה.
  4. אספו את הקונפטי והתפעלו מהערימה.
- **HE household items:** מספריים בטוחים לילדים · רצועות נייר או מעטפה ישנה
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 136. Thread the pasta necklace `motor-thread-the-pasta` (preschool)

- **HE title:** להשחיל שרשרת פסטה
- **HE what it builds:** ליישר חורים קטנים ולהעביר שרוך דרכם — שליטה מדויקת של שתי ידיים.
- **HE steps:**
  1. קשרו קצה אחד של שרוך כדי שהפסטה לא תחליק.
  2. הראו איך להחזיק את הפסטה ביד אחת ואת השרוך בשנייה.
  3. השחילו פיסה אחר פיסה כדי להכין שרשרת או נחש.
  4. הישארו קרוב ושמרו על משחק השחלה, לא טעימה.
- **HE household items:** פסטה יבשה בצורת צינור (פנה או ריגטוני) · שרוך או חוט
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 137. Hop on one foot `motor-one-foot-hop` (preschool)

- **HE title:** לקפוץ על רגל אחת
- **HE what it builds:** שיווי משקל וקפיצה על רגל אחת — קפיצת תיאום גדולה לכל הגוף.
- **HE steps:**
  1. עמדו יחד והרימו רגל אחת כמו פלמינגו.
  2. נסו קפיצה קטנה אחת, תוך החזקת יד אם צריך.
  3. ספרו כמה קפיצות עד שהרגל יורדת.
  4. החליפו רגל וראו אם הצד השני רוצה תור.
- **HE household items:** מעט רצפה פנויה
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 138. Jump over the river `motor-jump-the-river` (preschool)

- **HE title:** לקפוץ מעל הנהר
- **HE what it builds:** המראה ונחיתה על שתי רגליים — הכוח והשליטה שקפיצה דורשת.
- **HE steps:**
  1. הניחו שני קווים קרובים זה לזה כגדות של 'נהר'.
  2. קפצו מעליו יחד בשתי הרגליים, ידיים מתנופפות.
  3. הרחיבו את הנהר מעט בכל סיבוב.
  4. הוסיפו 'שוווש!' גדול לנחיתה רכה.
- **HE household items:** שני סרטים, מטפחות או קווי נייר דבק
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 139. Tong the pompoms `motor-tong-transfer` (preschool)

- **HE title:** לתפוס פונפונים במלקחיים
- **HE what it builds:** חוזק היד של סחיטה-והחזקה שמייצב עיפרון ורוכס כפתורים.
- **HE steps:**
  1. שימו כדורי צמר גפן בקערה אחת וקערה ריקה לצדה.
  2. הראו איך לסחוט את המלקחיים כדי לתפוס אחד ולהעביר.
  3. התחרו להעביר את כולם בלי להפיל.
  4. נסו מלקחיים קטנים יותר, כמו אטב כביסה, כשהם מתחזקים.
- **HE household items:** מלקחי מטבח או אטב כביסה · כדורי צמר גפן או פונפונים · שתי קערות
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 140. Draw a whole person `motor-draw-a-person` (preschool)

- **HE title:** לצייר בן אדם שלם
- **HE what it builds:** שליטת האצבעות להנחות צבע לראשים, גופים, זרועות ורגליים בכוונה.
- **HE steps:**
  1. בקשו מהם לצייר בן אדם — 'את מי נצייר?'
  2. תהו בקול על חלקים: 'יש לו זרועות? חיוך גדול?'
  3. תנו להם להוסיף מה שהם רוצים, בלי תיקונים.
  4. תנו שם לחלקים שציירו ותנו לדמות סיפור.
- **HE household items:** נייר · צבעים או עפרונות
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 141. Gallop like a horse `motor-gallop-across` (preschool)

- **HE title:** לדהור כמו סוס
- **HE what it builds:** לשמור על רגל אחת מובילה בקצב קופצני — אבן דרך לקראת דילוג.
- **HE steps:**
  1. בחרו רגל מובילה וצעדו צעד-יחד, צעד-יחד לרוחב החדר.
  2. הוסיפו קול טפ-טפ ו'מושכות' מתנופפות.
  3. דהרו מהר, אז לאט, אז קפאו כמו סוס נח.
  4. החליפו את הרגל המובילה ונסו בכיוון השני.
- **HE household items:** מרחב פנוי לתנועה
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 142. Walk the low balance board `motor-plank-balance-walk` (preschool)

- **HE title:** ללכת על קורת שיווי משקל נמוכה
- **HE what it builds:** שיווי משקל יציב ומודעות גוף מהליכה על נתיב צר ומעט מוגבה.
- **HE steps:**
  1. הניחו קרש רחב שטוח על הרצפה (שום דבר גבוה).
  2. החזיקו יד ולכו לאורכו עקב-אצבע.
  3. נסו ידיים פרושות כמו מטוס לשיווי משקל.
  4. רדו למשחק רעידה, ואז טפסו בחזרה.
- **HE household items:** קרש רחב ושטוח או כרית ארוכה ויציבה על הרצפה
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 143. Toss and catch a scarf `motor-catch-the-scarf` (preschool)

- **HE title:** לזרוק ולתפוס מטפחת
- **HE what it builds:** מעקב אחרי חפץ שצף לאט וסגירת הידיים עליו — תפיסה מוקדמת ועדינה.
- **HE steps:**
  1. זרקו מטפחת קלה ישר למעלה כך שהיא צונחת לאט.
  2. עודדו אותם לתפוס אותה לפני שהיא נוחתת.
  3. נסו לתפוס בשתי ידיים, ואז ביד אחת.
  4. קראו חלק גוף לתפוס עליו — 'זרוע!', 'ראש!'
- **HE household items:** מטפחת קלה או שקית ניילון קשורה לכדור
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 144. Animal-walk safari `motor-animal-walks` (preschool)

- **HE title:** ספארי הליכות חיות
- **HE what it builds:** חוזק ליבה וזרועות ותיאום דרך תנועות של דוב, סרטן וארנב.
- **HE steps:**
  1. קראו שם של חיה ונועו כמוה יחד.
  2. הליכת דוב על ידיים ורגליים, הליכת סרטן על הישבן, קפיצת ארנב.
  3. חצו את החדר וחזרה כל יצור.
  4. תנו להם להמציא חיה ואת ההליכה המצחיקה שלה.
- **HE household items:** מרחב רצפה פנוי
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 145. Hole-punch confetti art `motor-hole-punch-art` (preschool)

- **HE title:** אמנות קונפטי במחורר
- **HE what it builds:** הסחיטה של כל היד והכיוון שמחורר דורש, שבונים חוזק יד.
- **HE steps:**
  1. הראו איך לסחוט את המחורר חזק עם כל היד.
  2. חוררו פיזור של חורים לאורך רצועת נייר.
  3. שפכו את עיגולי הנייר החוצה ככונפטי.
  4. הדביקו את העיגולים על דף כדי ליצור תמונה מנוקדת.
- **HE household items:** מחורר בודד · נייר טיוטה · דבק ודף
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 146. Learn the jump rope `motor-jump-rope` (early-school)

- **HE title:** ללמוד קפיצה בחבל
- **HE what it builds:** לתזמן ידיים ורגליים לאותו קצב — אתגר תיאום וקצב אמיתי.
- **HE steps:**
  1. קודם נדנדו את החבל ופסעו מעליו לאט, בלי קפיצה.
  2. אז הוסיפו קפיצה קטנה בשתי רגליים בכל פעם שהוא מגיע.
  3. ספרו את הקפיצות וחגגו שיא חדש.
  4. נסו לסובב את החבל זה עבור זה כשהם שולטים בזה.
- **HE household items:** חבל קפיצה או חוט ארוך
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 147. Bounce and catch rally `motor-bounce-and-catch` (early-school)

- **HE title:** מסירת הקפצה ותפיסה
- **HE what it builds:** לשפוט הקפצה ולסגור ידיים ברגע הנכון — תזמון עין-יד חד.
- **HE steps:**
  1. עמדו צעד או שניים זה מזה על רצפה קשה.
  2. הקפיצו את הכדור פעם אחת כך שיעלה לידיהם.
  3. ספרו כמה תפיסות ברצף בלי הפלה.
  4. התרחקו צעד כדי להקשות על המסירה.
- **HE household items:** כדור קופצני בינוני
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 148. Hopscotch grid `motor-hopscotch-grid` (early-school)

- **HE title:** רשת קלאס
- **HE what it builds:** מעבר בין נחיתות על רגל אחת ושתיים תוך שמירה על שיווי משקל וסדר.
- **HE steps:**
  1. סמנו רשת קלאס בנייר דבק או בגיר.
  2. זרקו את הסמן על משבצת לדלג מעליה.
  3. קפצו על המשבצות הבודדות ופסקו על הזוגות, הלוך וחזור.
  4. הרימו את הסמן בדרך חזרה בלי להתמוטט.
- **HE household items:** גיר או נייר דבק לרשת · שק חול קטן או אבן כסמן
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 149. Step-hop skipping `motor-learn-to-skip` (early-school)

- **HE title:** דילוג צעד-קפיצה
- **HE what it builds:** דפוס הצעד-קפיצה-צעד-קפיצה שמתחלף בין הצדדים — אבן דרך תיאום גדולה.
- **HE steps:**
  1. פרקו את זה: צעד קדימה, ואז קפיצה קטנה על אותה רגל.
  2. עכשיו הרגל השנייה: צעד, קפיצה.
  3. שירו 'צעד-קפיצה, צעד-קפיצה' תוך הגזמה.
  4. האיצו לדילוג חלק כשהדפוס מתחבר.
- **HE household items:** מרחב פנוי לתנועה
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 150. Copy shapes and letters `motor-letter-shape-copy` (early-school)

- **HE title:** להעתיק צורות ואותיות
- **HE what it builds:** שליטת העיפרון היציבה והמכוונת שממנה בנויות צורות ואותיות מסודרות.
- **HE steps:**
  1. ציירו צורה או אות ותנו להם להעתיק לצדכם.
  2. התחילו בגדול, אז נסו גרסה קטנה יותר למטה.
  3. עשו מזה משחק: כתבו שם באותיות בועה למעקב.
  4. שבחו קווים יציבים, לא מושלמים.
- **HE household items:** נייר · עיפרון
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 151. Keep the balloon up `motor-balloon-keep-up` (early-school)

- **HE title:** לשמור על הבלון באוויר
- **HE what it builds:** מעקב אחרי בלון נודד והושטת יד לטפוח בו — תיאום עין-יד ללא הפסקה.
- **HE steps:**
  1. נפחו בלון וטפחו בו לאוויר יחד.
  2. החוק: אל תתנו לו לגעת ברצפה.
  3. ספרו את הטפיחות ונסו לשבור את השיא.
  4. הקשו על זה — רק ראשים, או רק יד שמאל.
- **HE household items:** בלון
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 152. Coin stack and flip `motor-coin-stack-flip` (early-school)

- **HE title:** לבנות ולהפוך מגדל מטבעות
- **HE what it builds:** הזריזות של קצות האצבעות של הזזה וסיבוב חפצים קטנים בתוך יד אחת.
- **HE steps:**
  1. התחרו לבנות את מגדל המטבעות הגבוה והמסודר ביותר.
  2. אז החזיקו כמה מטבעות בכף יד אחת והזינו אותם לקצות האצבעות אחד-אחד.
  3. הפכו מטבע מגב היד ותפסו אותו.
  4. נסו את כל המשחק גם עם היד השנייה.
- **HE household items:** ערימה קטנה של מטבעות
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 153. Wall-ball target throw `motor-wall-ball-target` (early-school)

- **HE title:** זריקת מטרה לכדור-קיר
- **HE what it builds:** לכוון זריקה ולקרוא את ההקפצה כדי לתפוס — כישור משולב של זריקה ותפיסה.
- **HE steps:**
  1. הדביקו מטרה על קיר בטוח בלי שום דבר שביר בקרבת מקום.
  2. זרקו את הכדור למטרה ותפסו את החזרה.
  3. צברו נקודה על כל פגיעה ועל כל תפיסה נקייה.
  4. התרחקו או הקטינו את המטרה כדי לעלות רמה.
- **HE household items:** כדור רך · מעט נייר דבק למטרה בקיר · קיר בטוח
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 154. One-leg balance challenge `motor-one-leg-balance` (early-school)

- **HE title:** אתגר שיווי משקל על רגל אחת
- **HE what it builds:** שיווי משקל עמוק ומודעות גוף מהחזקת יציבות על רגל אחת דרך אתגרים מהנים.
- **HE steps:**
  1. שניכם עמדו על רגל אחת וספרו את השניות שאתם מחזיקים.
  2. נסו עם ידיים פרושות, אז מקופלות, אז עיניים עצומות.
  3. העבירו חפץ הלוך ושוב תוך שמירה על שיווי משקל.
  4. החליפו רגליים וראו איזה צד יציב יותר היום.
- **HE household items:** לא צריך כלום
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 155. Simple paper folding `motor-origami-fold` (early-school)

- **HE title:** קיפול נייר פשוט
- **HE what it builds:** קיפול מדויק בשתי ידיים ולחיצת קפלים חדים — שליטה עדינה ותכנון.
- **HE steps:**
  1. התחילו בקיפול קל — כובע נייר, סירה, או מגדת עתידות.
  2. קפלו לאט יחד, תוך התאמת פינות קצה לקצה.
  3. לחצו כל קפל חד עם ציפורן.
  4. הכינו כמה וסדרו את צי הנייר הקטן שלכם.
- **HE household items:** ריבועי נייר
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 156. Newspaper crumple and toss `motor-newspaper-crumple` (toddler, preschool)

- **HE title:** לקמט ולזרוק עיתון
- **HE what it builds:** חיזוק כף היד והאצבעות מהקימוט, וכיוון מהזריקה.
- **HE steps:**
  1. כל אחד קורע דף עיתון.
  2. מקמטים אותו לכדור הדוק, אם אפשר ביד אחת.
  3. עושים כמה צעדים אחורה וזורקים לתוך הסל.
  4. פותחים כדור בחזרה לשטוח לאימון אצבעות נוסף.
- **HE household items:** עיתון ישן או נייר גרוטאה · סל או קערה
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 157. Little floor play circuit `std-infant-floor-circuit` (infant)

- **HE title:** מסלול משחק קטן על הרצפה
- **HE what it builds:** הושטה, התגלגלות ודחיפה מעלה — תחנה קטנה אחת בכל פעם.
- **HE steps:**
  1. פרסו שלוש תחנות: צעצוע להושיט אליו יד, כרית להתרומם עליה, מראה או ספר להתבונן בהם.
  2. התחילו בזמן בטן בתחנה הראשונה כל עוד זה נשאר שמח.
  3. עברו בין התחנות בקצב שלהם, עם הפסקות כשהם מאותתים שמספיק.
  4. סיימו במשהו אהוב — שיר או הרמה עדינה באוויר.
- **HE household items:** שמיכה על הרצפה · שניים-שלושה צעצועים · כרית
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 158. Toy wash station `std-toddler-car-wash` (toddler)

- **HE title:** תחנת רחיצת צעצועים
- **HE what it builds:** עבודה בשתי ידיים — טבילה, קרצוף, סחיטה וייבוש.
- **HE steps:**
  1. פרסו מגבת והניחו עליה קערה עם מים וסבון.
  2. העמידו בתור את ה'לקוחות' המלוכלכים — מכוניות, חיות, קוביות.
  3. רחצו כל אחד יחד: לטבול, לקרצף, לסחוט, לייבש.
  4. החנו את הנקיים בשורה והתפעלו מהעבודה.
- **HE household items:** קערה עם מי סבון · ספוג או מטלית · צעצועים רחיצים · מגבת
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 159. Giant floor mural `ext-big-floor-mural` (toddler, preschool)

- **HE title:** ציור קיר ענק על הרצפה
- **HE what it builds:** תנועות זרוע גדולות והישארות עם יצירה אחת מספיק זמן כדי לסיים אותה.
- **HE steps:**
  1. הדביקו גיליון נייר גדול לרצפה.
  2. התחילו סצנה משותפת — כביש, גינה, ים — וכל אחד לוקח פינה.
  3. התחלפו בפינות באמצע והוסיפו לציורים אחד של השני.
  4. תלו את היצירה המוכנה במקום שכולם רואים.
- **HE household items:** גיליון נייר גדול או קופסת קרטון פתוחה · צבעים, טושים או צבע · נייר דבק
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

### Domain: cognitive — focus and problem-solving / ריכוז ופתרון בעיות (57)

#### 160. Colour-sort the laundry `sort-the-laundry` (toddler, preschool)

- **HE title:** מיון הכביסה לפי צבע
- **HE what it builds:** מיון, התאמה והתמדה במשימה עד הסוף.
- **HE steps:**
  1. שפכו יחד כביסה נקייה לערימה.
  2. עשו ערימות לפי צבע, או לפי למי זה שייך.
  3. התחרו במציאת כל הגרביים והתאמת הזוגות.
  4. תנו להם לשאת את הערימה שלהם לסידור.
- **HE household items:** סל כביסה נקייה
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 161. Five-things treasure hunt `treasure-hunt` (preschool, early-school)

- **HE title:** ציד אוצרות של חמישה דברים
- **HE what it builds:** הקשבה, החזקת תוכנית בראש, וביצוע עד הסוף.
- **HE steps:**
  1. תנו רשימה של חמישה דברים למצוא בחדר אחד.
  2. התחילו בשניים, הוסיפו עוד כשהם תופסים את העניין.
  3. תנו להם להכין גם לכם רשימה למצוא.
  4. ספרו יחד את האוצרות בסוף.
- **HE household items:** חמישה חפצים קטנים מהבית
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 162. In-and-out treasure box `in-and-out` (toddler)

- **HE title:** קופסת אוצר של פנימה והחוצה
- **HE what it builds:** סיבה ותוצאה ו'לאן זה נעלם' — השורשים של פתרון בעיות.
- **HE steps:**
  1. הניחו כמה חפצים בטוחים ליד קופסה ריקה.
  2. הראו להם להפיל אחד פנימה, ואז לשפוך החוצה.
  3. תנו להם למלא ולרוקן שוב ושוב.
  4. הסתירו אחד מתחת לבד ומצאו יחד.
- **HE household items:** קופסה או קערה · כמה חפצים בטוחים
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 163. Drop, look, and find `drop-and-find` (infant)

- **HE title:** להפיל, להסתכל ולמצוא
- **HE what it builds:** הרעיון הראשון שדברים עדיין קיימים אחרי שהם נעלמים מהעין.
- **HE steps:**
  1. הושיבו אותם במושב בטוח והציעו צעצוע רך.
  2. כשהם מפילים, אמרו 'אופס, לאן זה הלך?'
  3. הרימו לאט כדי שיעקבו לאן זה הלך.
  4. החזירו ותנו למעגל השמח לחזור.
- **HE household items:** צעצוע רך · מגש או כיסא אוכל
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 164. Touch-and-notice texture tray `texture-tray` (infant)

- **HE title:** מגש מרקמים למישוש ולשים לב
- **HE what it builds:** קשב ממוקד ומיון מוקדם של 'אלה מרגישים שונה' בעולם.
- **HE steps:**
  1. הניחו פריט חלק ופריט מחוספס ובטוחים על מגש.
  2. הובילו את ידם לכל אחד וקראו בשם: 'רך… מחוספס.'
  3. עצרו ותנו להם לחקור בקצב שלהם.
  4. שימו לב איזה מהם מחזיק את הקשב שלהם יותר.
- **HE household items:** מגש · שני פריטים בטוחים עם מרקמים שונים
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 165. Post-it-through container play `shape-posting` (toddler)

- **HE title:** משחק הכנסה דרך מכל
- **HE what it builds:** התאמת גודל וצורה לחור — פתרון בעיות מוקדם עם הידיים.
- **HE steps:**
  1. חתכו חריץ בטוח לידיים במכסה של מכל נקי.
  2. הראו להם להכניס חפץ אחד דרך החריץ.
  3. הריעו ל'בלופ' ושפכו את הכל החוצה כדי להתחיל שוב.
  4. תנו להם לפתור את הזווית בעצמם — התאפקו מלעזור מהר מדי.
- **HE household items:** מכל עם מכסה · חפצים בטוחים שנכנסים בחריץ חתוך
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 166. What-comes-next pattern game `what-comes-next` (preschool, early-school)

- **HE title:** משחק 'מה בא אחר כך' של דפוסים
- **HE what it builds:** זיהוי וניבוי דפוסים — בסיס לחשבון ולחשיבה.
- **HE steps:**
  1. הניחו דפוס פשוט: כף, מזלג, כף, מזלג…
  2. שאלו 'מה בא אחר כך?' ותנו להם להניח.
  3. הארכו את הדפוס מעט בכל סיבוב.
  4. תנו להם להמציא דפוס שאתם תשלימו.
- **HE household items:** חפצים קטנים משני סוגים (כפות ומזלגות, מטבעות, קוביות)
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 167. Twenty questions `twenty-questions` (early-school)

- **HE title:** עשרים שאלות
- **HE what it builds:** חשיבה לוגית וצמצום אפשרויות דרך שאלות חכמות של כן/לא.
- **HE steps:**
  1. חשבו על חפץ וספרו להם את הקטגוריה.
  2. הם שואלים שאלות כן/לא כדי לצמצם.
  3. כוונו אותם לשאלות מקבצות, לא לניחושים אקראיים.
  4. החליפו תפקידים כדי שגם הם יחזיקו את הסוד.
- **HE household items:** לא צריך כלום
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 168. Pour-and-measure kitchen helper `kitchen-helper-pour` (preschool, early-school)

- **HE title:** עוזר מטבח של מזיגה ומדידה
- **HE what it builds:** ספירה, מדידה, והגאווה של ביצוע עבודה אמיתית בזהירות.
- **HE steps:**
  1. תנו משימה פשוטה: 'מזוג שתי כוסות לקערה הזו.'
  2. ספרו את המזיגות בקול יחד.
  3. תנו לשפיכות לקרות — הן חלק מלימוד שליטת היד.
  4. הודו להם על העזרה הספציפית.
- **HE household items:** כוס · אורז יבש או מים · שתי קערות
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 169. Memory match with cards `memory-pairs` (preschool, early-school)

- **HE title:** משחק זיכרון של זוגות קלפים
- **HE what it builds:** זיכרון עבודה וקשב סבלני, יחד עם לקיחת תורות בחן.
- **HE steps:**
  1. הניחו כמה זוגות תואמים הפוכים ברשת.
  2. בתורות הפכו שניים, בחיפוש אחר זוג.
  3. דברו בקול על איפה אתם זוכרים שכל קלף היה.
  4. הוסיפו עוד זוגות ככל שהזיכרון שלהם נמתח.
- **HE household items:** כמה זוגות קלפים תואמים או ציורי נייר
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 170. Which cup is it under? `cog-cup-hide` (infant)

- **HE title:** מתחת לאיזו כוס זה?
- **HE what it builds:** הרעיון שדבר מוסתר עדיין קיים ואפשר למצוא אותו שוב.
- **HE steps:**
  1. שבו מולם, הראו צעצוע קטן ואז הסתירו אותו מתחת לכוס אחת.
  2. שאלו 'לאן זה הלך?' ותנו להם להפיל את הכוס כדי למצוא.
  3. הריעו לגילוי ועשו זאת שוב מתחת לאותה כוס.
  4. כשהם כבר מצפים לזה, הסתירו מתחת לכוס השנייה וצפו בהם מתלבטים.
- **HE household items:** שתי כוסות זהות · צעצוע קטן
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 171. Watch the ball roll away `cog-rolling-ball-track` (infant)

- **HE title:** עוקבים אחרי הכדור המתגלגל
- **HE what it builds:** קשב חזותי יציב כשהעיניים עוקבות אחרי דבר נע במרחב.
- **HE steps:**
  1. הושיבו אותם בישיבה נתמכת וגלגלו כדור לאט לרוחב שדה הראייה.
  2. תארו זאת: 'הנה זה הולך… עד לשם.'
  3. גלגלו אותו מאחורי כרית ועצרו — תנו להם לחפש לאן הלך.
  4. החזירו אותו וגלגלו לכיוון השני.
- **HE household items:** כדור רך או תפוז
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 172. Flashlight on, flashlight off `cog-flashlight-onoff` (infant)

- **HE title:** פנס נדלק, פנס נכבה
- **HE what it builds:** התחושה הראשונה שלעולם שלהם יש כפתורים — שדבר אחד גורם לדבר אחר.
- **HE steps:**
  1. בחדר מעומעם, האירו פנס קטן על התקרה.
  2. כבו ואמרו 'נעלם!', הדליקו ואמרו 'חזר!'
  3. האטו כדי שיתחילו לצפות למעבר.
  4. הזיזו את כתם האור לאט ותנו לעיניהם לרדוף אחריו.
- **HE household items:** פנס קטן או אור מהטלפון · חדר מעומעם
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 173. Crinkle-paper discovery `cog-crinkle-explore` (infant)

- **HE title:** גילוי נייר מרשרש
- **HE what it builds:** ריכוז סקרן והגילוי שהידיים שלהם יכולות להשמיע קול.
- **HE steps:**
  1. הציעו פיסת נייר מרשרש נקי ובטוח, גדול מספיק כדי לא להיבלע.
  2. קמטו אותו לידם כדי שישמעו את הקול, ואז מסרו להם.
  3. תנו להם ללחוץ, לנופף ולמשש אותו בזמן שאתם משגיחים מקרוב.
  4. חקו את התנועות שלהם וקראו בשם לקול: 'רשרוש, רשרוש!'
- **HE household items:** נייר מרשרש נקי או עטיפה מרשרשת
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 174. Who's that baby in the mirror? `cog-mirror-discover` (infant)

- **HE title:** מי התינוק הזה במראה?
- **HE what it builds:** התבוננות ממוקדת והעניין המתעורר לאט בבבואה של עצמם.
- **HE steps:**
  1. החזיקו אותם מול מראה, פנים ליד פנים.
  2. הצביעו ואמרו 'הנה אתה… והנה אני.'
  3. נופפו בידם וצפו בבבואה מנופפת בחזרה.
  4. תנו להם להושיט יד אל הזכוכית ולחקור מה קורה.
- **HE household items:** מראה בטוחה
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 175. Stack it up, knock it down `cog-cup-tower-knock` (infant)

- **HE title:** בונים מגדל, מפילים מגדל
- **HE what it builds:** סיבה ותוצאה והציפייה הנהדרת למגדל שמתמוטט.
- **HE steps:**
  1. בנו מגדל קטן משתיים-שלוש כוסות מולם.
  2. עצרו עם 'מוכנים…' גדול כדי שיצפו.
  3. תנו להם להפיל אותו, ואז הריעו יחד למפולת.
  4. בנו מחדש וחזרו — ההמתנה היא חצי מהכיף.
- **HE household items:** כמה כוסות פלסטיק או קוביות רכות
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 176. Pull the scarf out `cog-scarf-pull` (infant)

- **HE title:** מושכים את הצעיף החוצה
- **HE what it builds:** חשיבה מוקדמת של אמצעי-ומטרה — משיכה כאן גורמת למשהו לקרות שם.
- **HE steps:**
  1. דחפו רוב צעיף קל לתוך גליל או קופסה, והשאירו קצה בחוץ.
  2. הראו להם את הקצה ואמרו 'אפשר למשוך?'
  3. תנו להם למשוך אותו החוצה והתלהבו מהחשיפה.
  4. דחפו אותו בחזרה ותנו למעגל השמח לחזור.
- **HE household items:** צעיף או בד קל · גליל או קופסה ריקה עם חור
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 177. Two shakers, two sounds `cog-shaker-sounds` (infant)

- **HE title:** שני רעשנים, שני קולות
- **HE what it builds:** הקשבה קשובה וההבחנה המוקדמת ששני דברים יכולים להישמע שונה.
- **HE steps:**
  1. אטמו מעט אורז במיכל קטן אחד ופסטה יבשה במיכל אחר.
  2. נערו אחד ליד אוזנם, ואז את השני, וקראו בשם 'רך… רועש.'
  3. תנו להם אחד ותנו להם לנער בעצמם.
  4. החליפו וצפו בהם שמים לב לשינוי בקול.
- **HE household items:** שני מיכלים קטנים אטומים · אורז ופסטה יבשה
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 178. Find the peeking toy `cog-blanket-find` (infant)

- **HE title:** מוצאים את הצעצוע המציץ
- **HE what it builds:** שדבר שמוסתר ברובו עדיין שלם ועדיין שם כדי לגלותו.
- **HE steps:**
  1. הראו צעצוע אהוב, ואז כסו את רובו והשאירו פינה מציצה.
  2. שאלו 'איפה זה מתחבא?' ותנו להם למשוך את הבד.
  3. חגגו את המציאה ובפעם הבאה כסו קצת יותר.
  4. כשמוכנים, הסתירו לגמרי וראו אם עדיין מושיטים יד.
- **HE household items:** צעצוע קטן · שמיכה קלה או בד
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 179. Follow my voice `cog-follow-the-voice` (infant)

- **HE title:** עוקבים אחרי הקול שלי
- **HE what it builds:** פנייה לכיוון הקול והבנה מהיכן מגיע קול מוכר.
- **HE steps:**
  1. כשהם נתמכים ובטוחים, זוזו מעט לצד אחד.
  2. קראו בשמם בשקט וחכו שיפנו אליכם.
  3. שבחו את הפנייה, ואז עברו לצד השני וקראו שוב.
  4. שמרו על עדינות ואיטיות, ותנו להם לחפש בכל פעם.
- **HE household items:** רק הקול שלכם
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 180. Big pile, little pile `cog-big-little-sort` (toddler)

- **HE title:** ערימה גדולה, ערימה קטנה
- **HE what it builds:** שימת לב לגודל ומיון העולם ל'גדול' ו'קטן'.
- **HE steps:**
  1. אספו חופן חפצים בטוחים גדולים וקטנים בבירור.
  2. התחילו שתי ערימות ואמרו 'הגדולים כאן, הקטנים שם.'
  3. מסרו להם אחד בכל פעם ותנו להם לבחור ערימה.
  4. הריעו לכל מיון, ותנו לכמה 'טעויות' פשוט להיות.
- **HE household items:** ערבוב של חפצים בטוחים גדולים וקטנים
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 181. Match it to the right cup `cog-color-cup-match` (toddler)

- **HE title:** מתאימים לכוס הנכונה
- **HE what it builds:** התאמה לפי צבע — צעד מוקדם במיון דברים לפי מאפיין משותף.
- **HE steps:**
  1. סדרו בשורה שתיים-שלוש כוסות בצבעים שונים.
  2. תנו להם קובייה אדומה והצביעו על הכוס האדומה: 'זו מתאימה!'
  3. תנו להם להכניס כל חפץ לכוס שמתאימה לצבעו.
  4. שפכו החוצה וסבבו שוב, מהר יותר ומצחיק יותר.
- **HE household items:** כמה כוסות או קערות צבעוניות · חפצים צבעוניים תואמים
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 182. Nesting bowls, biggest to smallest `cog-nesting-bowls` (toddler)

- **HE title:** קערות מקוננות, מהגדולה לקטנה
- **HE what it builds:** סידור לפי גודל והבנה איזה חלק נכנס לתוך איזה.
- **HE steps:**
  1. פזרו שלוש-ארבע קערות בגדלים שונים על הרצפה.
  2. הראו איך הקטנה נכנסת לתוך הגדולה.
  3. ערבבו ותנו להם לפתור את סדר הקינון.
  4. דברו על זה: 'זו גדולה מדי… נסה את הקטנה.'
- **HE household items:** סט קערות או מיכלים בגדלים שונים
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 183. Match the shape to its outline `cog-shape-shadow-match` (toddler)

- **HE title:** מתאימים את הצורה למתאר שלה
- **HE what it builds:** התאמת חפץ למתאר שלו — זיהוי דמיון בצורה.
- **HE steps:**
  1. העבירו קו סביב שניים-שלושה חפצים על דף.
  2. ערבבו את החפצים על השולחן.
  3. בקשו מהם להניח כל חפץ על המתאר התואם שלו.
  4. קראו בשם לכל אחד כשהוא נוחת: 'הכוס הולכת על צורת הכוס.'
- **HE household items:** נייר · עט · כמה חפצים שטוחים (כוס, כף, קובייה)
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 184. One for you, one for me `cog-one-for-you-count` (toddler)

- **HE title:** אחד לך, אחד לי
- **HE what it builds:** הקצב של חפץ-אחד-ספירה-אחת שמתחת לכל ספירה מאוחרת יותר.
- **HE steps:**
  1. שימו ערימה קטנה של קרקרים או קוביות בין שתי צלחות.
  2. חלקו אותם לאט: 'אחד לך… אחד לי…'
  3. ספרו כל חתיכה בקול כשהיא נוחתת על צלחת.
  4. תנו להם להשתלט על החלוקה בזמן שאתם ממשיכים לספור.
- **HE household items:** חתיכות חטיף או קוביות קטנות · שתי צלחות
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 185. Hide-and-remember three toys `cog-hide-three-toys` (toddler)

- **HE title:** מחביאים וזוכרים שלושה צעצועים
- **HE what it builds:** החזקת תמונה קטנה בראש וזכירה היכן הונחו הדברים.
- **HE steps:**
  1. יחד, החביאו שלושה צעצועים במקומות קלים בחדר אחד.
  2. קראו להם בשם תוך כדי: 'המכונית מאחורי הכרית.'
  3. חכו רגע, ואז צאו לחפש את כל השלושה.
  4. כשאחד קשה, הציעו רמז במקום את התשובה.
- **HE household items:** שלושה צעצועים קטנים
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 186. Two-piece picture puzzle `cog-diy-puzzle` (toddler)

- **HE title:** פאזל תמונה משני חלקים
- **HE what it builds:** הבנה איך חלקים מרכיבים שלם — פתרון בעיות מרחבי מוקדם.
- **HE steps:**
  1. גזרו תמונה מקופסת דגני בוקר ישר באמצע.
  2. ערבבו את שני החצאים ושאלו 'אפשר להרכיב את התמונה שוב?'
  3. הריעו כשזה מתחבר, ואז נסו שלושה חלקים.
  4. שמרו על חלקים גדולים ומעטים כדי שההצלחה תגיע מהר.
- **HE household items:** תמונה מקופסת דגני בוקר או צילום · מספריים
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 187. Find the matching sock `cog-sock-pattern-match` (toddler)

- **HE title:** מוצאים את הגרב התואם
- **HE what it builds:** התאמה לפי דוגמה והתבוננות מקרוב כדי למצוא את הזהה.
- **HE steps:**
  1. פזרו כמה גרביים לא תואמים עם דוגמאות ברורות ושונות.
  2. הרימו אחד ושאלו 'איזה הוא התאום שלו?'
  3. תנו להם לחפש את ההתאמה וללחוץ את הזוג יחד.
  4. בנו את ערימת הזוגות וספרו אותם בסוף.
- **HE household items:** כמה זוגות גרביים עם דוגמאות
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 188. What goes with what? `cog-what-goes-together` (toddler)

- **HE title:** מה הולך עם מה?
- **HE what it builds:** קישור דברים ששייכים יחד — חשיבה מוקדמת על איך דברים קשורים.
- **HE steps:**
  1. הניחו כמה חפצים שמצטרפים לזוגות בחיים האמיתיים.
  2. הרימו את הכף ושאלו 'עם מה זה הולך?'
  3. תנו להם למצוא את הכוס ולהמחיז שימוש בהם יחד.
  4. דברו על למה: 'אנחנו מערבבים עם הכף בכוס.'
- **HE household items:** זוגות יומיומיים (כוס + כף, גרב + נעל, מברשת + שיער)
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 189. Find the lid that fits `cog-lids-and-jars` (toddler)

- **HE title:** מוצאים את המכסה שמתאים
- **HE what it builds:** פתרון בעיות בניסוי וטעייה — בדיקה איזה מכסה באמת מתאים לאיזה סיר.
- **HE steps:**
  1. הניחו כמה מיכלים ואת המכסים המעורבבים שלהם.
  2. שאלו 'איזה מכסה מתאים לזה?' ותנו להם לבדוק.
  3. תנו לניסיונות של גדול-מדי וקטן-מדי לקרות — זו החשיבה.
  4. חגגו כל התאמה מדויקת עם 'קליק!' מספק.
- **HE household items:** כמה מיכלים עם המכסים שלהם
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 190. Make a pattern necklace `cog-pattern-necklace` (preschool)

- **HE title:** מכינים שרשרת דוגמה
- **HE what it builds:** ראייה והמשכה של דוגמה חוזרת — אבן פינה בחשיבה מתמטית.
- **HE steps:**
  1. הניחו חלקים להשחלה בשני צבעים או צורות.
  2. התחילו דוגמה: אדום, לבן, אדום, לבן…
  3. שאלו 'מה בא אחר כך?' ותנו להם להוסיף את החלק.
  4. כשהם קלטו, תנו להם להמציא דוגמה שאתם תמשיכו.
- **HE household items:** חוט או שרוך · פסטה פנה או חרוזים · שני צבעים
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 191. Count everything on the way `cog-count-the-steps` (preschool)

- **HE title:** סופרים הכל בדרך
- **HE what it builds:** ספירה בטוחה של דברים אמיתיים, שקושרת מספרים לעולם סביבם.
- **HE steps:**
  1. בטיול או בעלייה במדרגות, ספרו כל מדרגה בקול יחד.
  2. ספרו גם דברים אחרים: מכוניות אדומות, דלתות כחולות, כלבים.
  3. עצרו ותנו להם לומר את המספר הבא לפניכם.
  4. שאלו 'כמה ספרנו?' בסוף.
- **HE household items:** איפה שאתם הולכים
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 192. Put the day in order `cog-sequence-cards` (preschool)

- **HE title:** מסדרים את היום לפי הסדר
- **HE what it builds:** סידור אירועים ראשון-אחר כך-אחרון — עמוד השדרה של תכנון וסיפור.
- **HE steps:**
  1. ציירו או אספו שלוש תמונות של שגרה: קימה, ארוחת בוקר, פארק.
  2. ערבבו אותן ושאלו 'מה קורה קודם?'
  3. סדרו אותן לפי הסדר יחד, תוך דיבור 'אחר כך… ואז…'
  4. נסו שגרת שינה ותנו להם לסדר אותה לבד.
- **HE household items:** נייר ועטים, או כמה צילומים
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 193. Guess it by feel `cog-mystery-bag` (preschool)

- **HE title:** מנחשים לפי מישוש
- **HE what it builds:** הסקה מרמזים — שימוש במישוש ובמילים כדי לגלות את הדבר המוסתר.
- **HE steps:**
  1. בסתר, שימו כמה חפצים מוכרים בשקית.
  2. תנו להם להכניס יד בלי להסתכל ולמשש אחד.
  3. שאלו 'זה קשה או רך? עגול או מחודד?' לפני שהם מנחשים.
  4. הוציאו לבדוק, ואז החליפו מי מחביא את החפצים.
- **HE household items:** שקית בד או ציפית · כמה חפצים מוכרים
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 194. Sort it a different way `cog-button-sort-ways` (preschool)

- **HE title:** ממיינים בדרך אחרת
- **HE what it builds:** חשיבה גמישה — ההבנה שאותם דברים אפשר לקבץ ביותר מדרך אחת.
- **HE steps:**
  1. שפכו חופן מעורב של חפצים קטנים ובטוחים.
  2. מיינו אותם יחד לפי צבע לקבוצות קטנות.
  3. ואז אמרו 'עכשיו נמיין בדרך חדשה — לפי גודל!' ומיינו מחדש.
  4. בקשו מהם דרך שלישית לקבץ אותם.
- **HE household items:** חופן מעורב של כפתורים, מטבעות או צעצועים
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 195. Simon says, freeze and go `cog-simon-says` (preschool)

- **HE title:** מלך אמר: קפאו וזוזו
- **HE what it builds:** שריר העצירה-וחשיבה — פעולה רק לפי האות הנכון ועצירה מול הלא-נכון.
- **HE steps:**
  1. הסבירו: עושים רק אם אמרתי 'מלך אמר' קודם.
  2. קראו הוראות קלות: 'מלך אמר גע באף.'
  3. הכניסו 'קפוץ!' רגיל וצחקו כשמישהו כמעט עשה.
  4. החליפו ותנו להם להיות המלך, ולתפוס אתכם.
- **HE household items:** לא צריך כלום
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 196. Follow the three-step snack `cog-recipe-steps` (preschool)

- **HE title:** עוקבים אחרי חטיף בשלושה שלבים
- **HE what it builds:** החזקת תוכנית קצרה בראש וביצועה לפי הסדר, שלב אחרי שלב.
- **HE steps:**
  1. קראו בשם לתוכנית קודם: 'אחת — לחם, שתיים — מריחה, שלוש — בננה.'
  2. תנו להם לעשות כל שלב, ולומר את המספר תוך כדי.
  3. אם שלב נדלג, שאלו 'מה בא לפני זה?'
  4. תיהנו מהחטיף שהם תכננו והכינו.
- **HE household items:** מרכיבי חטיף פשוטים (לחם, ממרח, בננה)
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 197. Shape hunt around the house `cog-shape-hunt` (preschool)

- **HE title:** ציד צורות בבית
- **HE what it builds:** זיהוי צורות בעולם האמיתי — גיאומטריה שמתחבאת בדברים יומיומיים.
- **HE steps:**
  1. בחרו צורה להיום: 'בואו נצוד עיגולים.'
  2. שוטטו בבית והצביעו על שעונים, צלחות, גלגלים.
  3. ספרו כמה עיגולים מצאתם יחד.
  4. בחרו צורה חדשה — ריבועים, משולשים — לסיבוב הבא.
- **HE household items:** פשוט הבית שלכם
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 198. Which plate has more? `cog-more-or-less` (preschool)

- **HE title:** לאיזו צלחת יש יותר?
- **HE what it builds:** תחושה לכמות — השוואת קבוצות ושיפוט של יותר, פחות, או אותו דבר.
- **HE steps:**
  1. שימו כמה חתיכות על כל אחת משתי צלחות.
  2. שאלו 'לאיזו צלחת יש יותר?' ותנו להם לנחש.
  3. ספרו כל צלחת יחד כדי לבדוק את הניחוש.
  4. השוו ביניהן כך שיהיו זהות, ואז הוסיפו לאחת שוב.
- **HE household items:** שתי צלחות · חתיכות חטיף או קוביות קטנות
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 199. Which one doesn't belong? `cog-odd-one-out` (preschool)

- **HE title:** מי לא שייך?
- **HE what it builds:** חשיבה על קטגוריות והסבר למה דבר אחד לא מתאים.
- **HE steps:**
  1. הניחו שלושה דברים ששייכים יחד ואחד שלא (כף, מזלג, כוס, גרב).
  2. שאלו 'מי לא שייך?'
  3. מה שהם בוחרים, שאלו 'למה?' — יכולה להיות יותר מתשובה טובה אחת.
  4. תנו להם לבנות חידה שאתם תפתרו.
- **HE household items:** קבוצות קטנות של חפצים יומיומיים
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 200. Higher-card showdown `cog-card-compare` (early-school)

- **HE title:** דו-קרב הקלף הגבוה
- **HE what it builds:** השוואת מספרים מהירה והכיף של משחק הוגן ומהיר-חשיבה.
- **HE steps:**
  1. חלקו את החפיסה וכל אחד הופך קלף בו-זמנית.
  2. מי שהקלף שלו גבוה יותר לוקח את שניהם.
  3. אמרו את המספרים בקול: 'שמונה מנצח חמש.'
  4. בתיקו, הפכו שוב לדו-קרב דרמטי.
- **HE household items:** חפיסת קלפים
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 201. Draw and follow a treasure map `cog-plan-the-route` (early-school)

- **HE title:** מציירים ועוקבים אחרי מפת אוצר
- **HE what it builds:** תכנון מסלול בראש קודם, ואז דבקות בתוכנית כדי להגיע ליעד.
- **HE steps:**
  1. החביאו 'אוצר' קטן איפשהו בבית.
  2. יחד, שרטטו מפה גסה עם נקודות ציון ומסלול אליו.
  3. עקבו אחרי המפה שלב-שלב כדי למצוא את האוצר.
  4. החליפו: הם מחביאים משהו ומציירים לכם את המפה.
- **HE household items:** נייר ועט · חפץ קטן מוסתר
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 202. I packed my bag and in it I put… `cog-packed-my-bag` (early-school)

- **HE title:** ארזתי תיק ושמתי בו…
- **HE what it builds:** זיכרון עבודה — החזקת רשימה גדלה בראש והוספה אליה לפי הסדר.
- **HE steps:**
  1. התחילו: 'ארזתי תיק ושמתי בו מברשת שיניים.'
  2. האדם הבא חוזר על זה ומוסיף פריט אחד.
  3. המשיכו, בכל פעם נזכרים בכל הרשימה לפי הסדר.
  4. צחקו מהפספוסים — הזכירה היא כל המשחק.
- **HE household items:** לא צריך כלום
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 203. Make up sneaky number stories `cog-story-problems` (early-school)

- **HE title:** ממציאים סיפורי מספרים ערמומיים
- **HE what it builds:** הפיכת מצבים אמיתיים לבעיות מספר והסקתן.
- **HE steps:**
  1. הציגו סיפור קטן: 'יש לנו חמישה ענבים, אתה אוכל שניים — כמה נשארו?'
  2. תנו להם לפתור עם אצבעות, חפצים או בראש.
  3. דברו על איך הם הבינו, לא רק על התשובה.
  4. תנו להם להמציא סיפור מסובך כדי להביך אתכם.
- **HE household items:** חפצים יומיומיים, או כלום
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 204. Name three in ten seconds `cog-category-race` (early-school)

- **HE title:** שלושה בעשר שניות
- **HE what it builds:** חשיבה מהירה וגמישה — שליפת רעיונות מקטגוריה אחת לפי דרישה.
- **HE steps:**
  1. קראו קטגוריה: 'שם שלוש חיות ששוחות!'
  2. ספרו עד עשר לאט יחד בזמן שהם עונים.
  3. הריעו למה שהם ממציאים, מצחיק או רציני.
  4. החליפו תורות ותנו להם לקבוע קטגוריה עבורכם.
- **HE household items:** לא צריך כלום
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 205. Guess my sorting rule `cog-guess-my-rule` (early-school)

- **HE title:** נחשו את כלל המיון שלי
- **HE what it builds:** הסקה לוגית — זיהוי הכלל הנסתר שמאחורי אופן הקיבוץ של הדברים.
- **HE steps:**
  1. בחרו בסתר כלל (למשל 'דברים עגולים').
  2. מיינו כמה חפצים לערימות 'מתאים' ו'לא מתאים'.
  3. תנו להם לנחש את הכלל שלכם לפי מעקב לאן הדברים הולכים.
  4. כשהם פיצחו, הם ממציאים את הכלל הסודי הבא.
- **HE household items:** חופן מעורב של חפצים קטנים
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 206. Build a bridge that holds `cog-bridge-challenge` (early-school)

- **HE title:** בונים גשר שמחזיק
- **HE what it builds:** חשיבה הנדסית — תכנון, בדיקה ושיפור כדי לפתור אתגר אמיתי.
- **HE steps:**
  1. הציבו את האתגר: 'בנו גשר נייר בין שני ספרים.'
  2. תנו להם לנסות, ואז בדקו אותו עם צעצוע קטן למעלה.
  3. כשזה שוקע, שאלו 'מה יכול לחזק את זה?' ובנו מחדש.
  4. חגגו את הגרסה שסוף סוף מחזיקה.
- **HE household items:** נייר · נייר דבק · צעצוע קטן לבדיקה
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 207. Tic-tac-toe strategy `cog-tic-tac-toe` (early-school)

- **HE title:** אסטרטגיית איקס-עיגול
- **HE what it builds:** חשיבה צעד קדימה — תכנון וחסימה כדי להגיע ליעד.
- **HE steps:**
  1. ציירו את הלוח ושחקו סבב של איקסים ועיגולים.
  2. אחרי משחק, תהו בקול: 'איפה יכולת לחסום אותי?'
  3. שחקו שוב ותנו להם לנסות לתכנן מראש.
  4. שימו לב בקול כשהם טומנים מלכודת חכמה.
- **HE household items:** נייר ועט
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 208. What's missing from the tray? `cog-memory-tray` (early-school)

- **HE title:** מה חסר מהמגש?
- **HE what it builds:** זיכרון חזותי — לימוד מערך של דברים ושימת לב למה שהשתנה.
- **HE steps:**
  1. שימו חמישה-שישה חפצים על מגש והתבוננו בהם יחד.
  2. כסו אותו ובסתר הסירו חפץ אחד.
  3. גלו אותו ושאלו 'מה חסר?'
  4. הוסיפו עוד חפצים ככל שהזיכרון שלהם נמתח, ותנו להם לבחון אתכם.
- **HE household items:** מגש · כמה חפצים קטנים · בד
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 209. Guess how many, then count `cog-estimate-and-check` (early-school)

- **HE title:** מנחשים כמה, ואז סופרים
- **HE what it builds:** תחושת כמות — ניחוש מחושב ובדיקתו על ידי ספירה.
- **HE steps:**
  1. מלאו צנצנת קטנה בשעועית או כפתורים.
  2. כל אחד מנחש: 'כמה לדעתך יש שם?'
  3. שפכו החוצה וספרו יחד כדי לבדוק.
  4. מלאו מחדש בכמות אחרת ונחשו שוב, קרוב יותר הפעם.
- **HE household items:** צנצנת או קערה · חופן פריטים קטנים (שעועית, כפתורים)
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 210. Sink or float? `cog-sink-or-float` (preschool, early-school)

- **HE title:** שוקע או צף?
- **HE what it builds:** לנחש, לבדוק, ולשים לב מה באמת קורה.
- **HE steps:**
  1. אוספים כמה חפצים בטוחים — כף, פקק, מכסה פלסטיק.
  2. לפני שכל אחד נכנס, מנחשים יחד: ישקע או יצוף?
  3. מכניסים למים ומתבוננים מה קורה.
  4. תוהים בקול למה הכבדים לפעמים מפתיעים.
- **HE household items:** קערה או כיור עם מים · כמה חפצים בטוחים מהבית · מגבת
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 211. Everyday-things treasure basket `std-infant-treasure-basket` (infant)

- **HE title:** סל אוצרות של חפצים יומיומיים
- **HE what it builds:** התבוננות עמוקה בקצב שלהם והפיכת חפצים מכל צד — גילוי בהובלת התינוק.
- **HE steps:**
  1. מלאו סל שטוח בכשישה חפצים יומיומיים בטוחים ומעניינים.
  2. הניחו אותו מולם והישארו קרובים, אבל תנו להם לבחור.
  3. התבוננו במה שהם מרימים, טועמים וחוזרים אליו, בלי לכוון.
  4. החליפו שני חפצים בחדשים בפעם הבאה כדי לשמור על הסל מעניין.
- **HE household items:** סל או קופסה שטוחים · שישה חפצים ביתיים בטוחים — כף עץ, פיסת בד, כוס פלסטיק
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 212. Build a little block city `std-toddler-block-city` (toddler)

- **HE title:** בונים עיר קוביות קטנה
- **HE what it builds:** בנייה עם רעיון בראש — כביש, מגדל, מוסך — ואז לשחק בתוכה.
- **HE steps:**
  1. פנו קטע רצפה ושפכו את הקוביות.
  2. שאלו מה העיר צריכה קודם ובנו את זה יחד.
  3. הוסיפו כביש בין הבניינים למכוניות או לחיות.
  4. תנו להם להפיל הכול בסוף — הריסות הן חלק מחיי העיר.
- **HE household items:** קוביות או כוסות מגדל · דמויות צעצוע או מכוניות · קטע רצפה פנוי
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 213. Build a cardboard box town `ext-cardboard-box-town` (toddler, preschool)

- **HE title:** בונים עיר מקופסאות קרטון
- **HE what it builds:** להחזיק תוכנית בראש ולהצמיח אותה, בניין אחד בכל פעם.
- **HE steps:**
  1. אספו כמה קופסאות והחליטו יחד מה העיר צריכה קודם — בית? מוסך?
  2. ציירו דלתות וחלונות על כל קופסה וסדרו אותן לאורך 'רחובות'.
  3. הוסיפו דמויות צעצוע או מכוניות ותנו לעיר לקום לחיים.
  4. השאירו אותה בנויה, כך שהמשחק של מחר ימשיך מאיפה שהיום נגמר.
- **HE household items:** כמה קופסאות קרטון או קופסאות נעליים · צבעים או טושים · דמויות צעצוע או מכוניות
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 214. Bake something simple together `ext-kitchen-bake-together` (toddler, preschool)

- **HE title:** אופים משהו פשוט יחד
- **HE what it builds:** לעקוב אחרי שלבים בסדר הנכון ולחכות לתוצאה ששווה לחכות לה.
- **HE steps:**
  1. בחרו מתכון קצר וקראו אותו בקול יחד לפני שמתחילים.
  2. מסרו את העבודות האמיתיות: למזוג, לערבב, להעביר בכף לתבנית.
  3. דברו על כל שלב תוך כדי: קודם, אחר כך, בסוף.
  4. בזמן האפייה סדרו יחד ונחשו איך זה יריח.
- **HE household items:** מתכון פשוט (עוגיות או מאפינס) · קערה וכף · כוסות מדידה
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 215. Draw a treasure map, run the hunt `ext-treasure-map-hunt` (preschool, early-school)

- **HE title:** מציירים מפת אוצר ויוצאים לחפש
- **HE what it builds:** להפוך תוכנית על נייר לצעדים אמיתיים בחדרים אמיתיים.
- **HE steps:**
  1. החביאו אוצר קטן בזמן שהם מחכים בחדר אחר.
  2. ציירו יחד מפה פשוטה של הבית, עם X על המקום.
  3. תנו להם לנווט — התאפקו מלהצביע, תנו למפה לעבוד.
  4. התחלפו: הם מחביאים, הם מציירים, אתם מחפשים.
- **HE household items:** נייר · עטים או צבעים · 'אוצר' קטן להחביא
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 216. Pocket-museum of found things `ext-nature-collection-museum` (early-school)

- **HE title:** מוזיאון כיס של מציאות מהטבע
- **HE what it builds:** התבוננות מקרוב, מיון לפי תכונות אמיתיות, והסבר הבחירות בקול רם.
- **HE steps:**
  1. צאו החוצה ואספו שמונה-עשרה מציאות קטנות.
  2. בבית, מיינו אותן: לפי צבע, לפי מרקם, לפי מאיפה שהגיעו.
  3. הכינו תוויות קטנות וסדרו את 'המוזיאון' בתבנית הביצים.
  4. ערכו סיור מודרך — הם המדריכים, אתם המבקרים עם השאלות.
- **HE household items:** קופסה או תבנית ביצים · מציאות מבחוץ — אבנים, עלים, זרעים · נייר לתוויות
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

### Domain: social — playing with others / משחק עם אחרים (51)

#### 217. One-block-each tower `turn-taking-tower` (toddler, preschool)

- **HE title:** מגדל של קובייה לכל אחד
- **HE what it builds:** לקיחת תורות והתמודדות עם הרעידה כשהדברים נופלים.
- **HE steps:**
  1. הניחו קובייה אחת כל אחד, בתורות מדויקים.
  2. תנו שם להמתנה: 'התור שלי, אחר כך התור שלך'.
  3. כשזה מתמוטט, הריעו למפולת במקום לתקן.
  4. בנו אותו גבוה יותר בסיבוב הבא.
- **HE household items:** קוביות בנייה, כוסות או ספרים
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 218. Real-job helper `helper-of-the-day` (preschool, early-school)

- **HE title:** עוזר עם עבודה אמיתית
- **HE what it builds:** תחושת מסוגלות וצורך, דרך עשיית עבודה אמיתית היטב.
- **HE steps:**
  1. הציעו עבודה אמיתית אחת: לסדר מזלגות, להאכיל את החיה, להשקות צמח.
  2. הראו פעם אחת, לאט, ואז מסרו את זה לגמרי.
  3. התאפקו מלתקן, תנו לגרסה שלהם לעמוד.
  4. הודו להם על העזרה הספציפית, לא רק 'כל הכבוד'.
- **HE household items:** מטלת בית פשוטה אחת
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 219. Copy-my-face game `mirror-faces` (infant, toddler)

- **HE title:** משחק חיקוי הפרצופים
- **HE what it builds:** קריאת פרצופים והלולאה החמה של תשומת לב הדדית.
- **HE steps:**
  1. עשו פרצוף שמח גדול וחכו שיחקו אתכם.
  2. נסו פרצופים מופתעים, מנומנמים ומצחיקים.
  3. קראו בשם לכל אחד כשאתם עושים אותו.
  4. תנו להם להוביל פרצוף שאתם תחקו.
- **HE household items:** רק הפרצופים שלכם, או מראה
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 220. Roll the ball back and forth `ball-roll` (toddler)

- **HE title:** לגלגל את הכדור הלוך ושוב
- **HE what it builds:** לקיחת תורות מוקדמת והכיף של הלוך ושוב, עם משחק של שרירים גדולים.
- **HE steps:**
  1. שבו על הרצפה זה מול זה, רגליים פתוחות.
  2. גלגלו אליהם את הכדור ואמרו 'התור שלך'.
  3. חכו, ואז הריעו כשהם דוחפים אותו בחזרה.
  4. תנו לזה שם בכל פעם: 'התור שלי... התור שלך'.
- **HE household items:** כדור רך כלשהו
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 221. Pretend tea for teddy `pretend-snack` (toddler, preschool)

- **HE title:** תה מדומה לדובי
- **HE what it builds:** דמיון ודאגה לאחר דרך משחק 'כאילו' פשוט.
- **HE steps:**
  1. הציעו לדובי 'שתייה' ו'חטיף'.
  2. ספרו: 'דובי צמא. דובי אומר תודה.'
  3. תנו להם להשתלט על ההאכלה והדאגה.
  4. עקבו אחרי הסיפור שלהם לאן שהוא הולך.
- **HE household items:** כוס, כף, בובה רכה
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 222. Peekaboo and hide-the-toy `peekaboo` (infant)

- **HE title:** קוקו ומחבואים לצעצוע
- **HE what it builds:** שאנשים ודברים עדיין קיימים כשהם מוסתרים, וההפתעה החמה של המפגש מחדש.
- **HE steps:**
  1. כסו את הפנים בידיים, ואז 'קוקו!'
  2. חכו לחיוך שלהם ועשו את זה שוב.
  3. הסתירו צעצוע מתחת לבד וחשפו אותו.
  4. תנו להם למשוך את הבד בעצמם.
- **HE household items:** בד קטן או הידיים שלכם
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 223. High and low of the day `high-low-share` (early-school)

- **HE title:** השיא והשפל של היום
- **HE what it builds:** מתן שם לרגשות, הקשבה לאחרים, והרגל של חיבור כן.
- **HE steps:**
  1. כל אחד משתף שיא אחד ושפל אחד מהיום.
  2. הקשיבו עד הסוף לפני שמגיבים.
  3. שאלו שאלת המשך עדינה על השפל שלהם.
  4. סיימו במה שכל אחד מצפה לו.
- **HE household items:** לא צריך כלום — עובד ליד שולחן האוכל
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 224. Feelings charades `feelings-charades` (preschool, early-school)

- **HE title:** פנטומימה של רגשות
- **HE what it builds:** קריאת פרצופים וגוף, ומתן שם למה שאחרים אולי מרגישים.
- **HE steps:**
  1. בתורות, גלמו רגש עם הפנים והגוף.
  2. השני מנחש: שמח, עצוב, כועס, מופתע?
  3. דברו על מתי כל אחד הרגיש כך לאחרונה.
  4. שמרו על חום ושטות — אין ניחושים שגויים.
- **HE household items:** לא צריך כלום
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 225. Gaze-and-grin hello `soc-gaze-and-grin` (infant)

- **HE title:** שלום של מבט וחיוך
- **HE what it builds:** ההלוך ושוב הראשון: מבט וחיוך שאומרים 'אני רואה אותך'.
- **HE steps:**
  1. החזיקו אותם במרחק אמה בערך, פנים אל פנים.
  2. תפסו את המבט שלהם, רככו את הפנים, וחייכו.
  3. כשהם מביטים או מחייכים בחזרה, האירו ובָרכו אותם בחום.
  4. הסיטו מבט לרגע, ואז התחברו שוב כדי שזה יהפוך לקצב עדין.
- **HE household items:** רק אתם, מקרוב
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 226. Turn-to-your-voice game `soc-name-turn` (infant)

- **HE title:** משחק הפנייה לקול
- **HE what it builds:** כיוונון לקול מוכר ופנייה אל האדם שמאחוריו.
- **HE steps:**
  1. מחוץ לשדה הראייה שלהם, אמרו את שמם בחום.
  2. חכו שהם יפנו או יחפשו אתכם.
  3. כשהם מוצאים את הפנים שלכם, תגמלו בחיוך גדול.
  4. זוזו קצת וקראו שוב, בלולאת 'מצא אותי' שמחה.
- **HE household items:** רק הקול שלכם
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 227. 'So big!' arms-up game `soc-so-big` (infant)

- **HE title:** משחק 'כזה גדול!' עם ידיים למעלה
- **HE what it builds:** הנאה משותפת והכיף של משחק שאתם בונים יחד, שוב ושוב.
- **HE steps:**
  1. שאלו 'כמה גדול התינוק?' ועצרו עם פנים מאירות.
  2. פרשו את הידיים לרווחה והריעו 'כזה גדוול!'
  3. חכו והסתכלו — בקרוב הם ירימו את הידיים שלהם להצטרף.
  4. חזרו על אותן מילים בכל פעם כדי שילמדו מה בא אחר כך.
- **HE household items:** רק אתם
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 228. Pat-a-cake clapping copy `soc-pat-a-cake` (infant)

- **HE title:** חיקוי מחיאות כפיים
- **HE what it builds:** חיקוי פעולה פשוטה הלוך ושוב — הזרע של למידה דרך חיקוי.
- **HE steps:**
  1. מחאו כפיים לאט ושירו חרוז קטן.
  2. בעדינות טפחו את כפות ידיהם יחד בקצב.
  3. עצרו וראו אם ינסו מחיאה משלהם.
  4. חקו בחום כל דבר שהם עושים.
- **HE household items:** רק הידיים שלכם
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 229. Wave hello and bye-bye `soc-wave-hello-bye` (infant)

- **HE title:** לנופף שלום וביי-ביי
- **HE what it builds:** אות חברתי ראשון — שימוש בנפנוף כדי לברך ולהיפרד.
- **HE steps:**
  1. בכל פעם שמישהו בא או הולך, נפנפו ואמרו 'שלום' או 'ביי-ביי'.
  2. קחו את ידם ועזרו לה לנפנף יחד עם שלכם.
  3. עצרו ותנו להם הזדמנות לנסות לבד.
  4. חגגו כל נפנוף מתנדנד כאילו הוא הכי טוב בעולם.
- **HE household items:** רק היד שלכם
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 230. Meet the mirror baby `soc-mirror-buddy` (infant)

- **HE title:** להכיר את תינוק המראה
- **HE what it builds:** התבוננות משותפת וסקרנות מוקדמת לגבי פרצופים — שלהם ושלכם.
- **HE steps:**
  1. שבו יחד מול מראה, לחי אל לחי.
  2. הצביעו ואמרו 'מי זה? זה אתה! וזאת אני.'
  3. נפנפו, חייכו והעוו פרצופים עדינים להשתקפויות שלכם.
  4. עקבו אחרי המבט שלהם וקראו בשם למה שתופס את עינם.
- **HE household items:** מראה
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 231. Give-it, take-it exchange `soc-give-and-take` (infant)

- **HE title:** חילופי 'תן וקח'
- **HE what it builds:** ה'תן וקח' המוקדם ביותר — שורש עדין של שיתוף ולקיחת תורות.
- **HE steps:**
  1. הציעו צעצוע קטן ובטוח ואמרו 'הנה בשבילך'.
  2. הושיטו יד פתוחה ושאלו 'אפשר לקבל?'
  3. קבלו אותו בשמחה, ואז הציעו אותו מיד בחזרה.
  4. שמרו על הלולאה קלילה ושובבה — לעולם לא מלחמת משיכה.
- **HE household items:** צעצוע קטן ובטוח
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 232. Bouncy-knee anticipation rhyme `soc-knee-bounce` (infant)

- **HE title:** חרוז ציפייה של קפיצות ברכיים
- **HE what it builds:** קריאה של מה בא אחר כך במשחק משותף ובקשה, עם הגוף, ל'עוד'.
- **HE steps:**
  1. הושיבו אותם מולכם על הברכיים והחזיקו אותם היטב.
  2. קפצו בעדינות לחרוז שמתקדם ל'נפילה' קטנה.
  3. עצרו ממש לפני הסוף וחכו, גבות מורמות.
  4. כשהם מתנועעים או צווחים ל'עוד', תנו את הסיום והתחילו שוב.
- **HE household items:** החיק שלכם
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 233. Follow-my-point discovery `soc-follow-my-point` (infant)

- **HE title:** גילוי של 'עקוב אחרי ההצבעה'
- **HE what it builds:** שיתוף קשב — להסתכל לאן שאתם מסתכלים, בסיס לחיבור ולשפה.
- **HE steps:**
  1. הצביעו על משהו מעניין ואמרו 'תראה, אור!'
  2. בדקו אם העיניים שלהם עוקבות אחרי האצבע.
  3. הביטו בהם בחזרה ושתפו הבעה מרוצה.
  4. עקבו גם אחרי ההצבעה שלהם, וקראו בשם למה שהם מראים לכם.
- **HE household items:** כל דבר מעניין בחדר
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 234. Tickle-and-wait game `soc-tickle-pause` (infant)

- **HE title:** משחק דגדוג-והמתנה
- **HE what it builds:** קריאת רמזים של תינוק — נטייה קדימה לעוד, או בקשה להפסקה עדינה.
- **HE steps:**
  1. טיילו עם האצבעות לאט על הבטן שלהם, ושירו 'הנה זה בא…'
  2. דגדגו הכי קלות, ואז עצרו והסתכלו בפנים שלהם.
  3. אם הם מחייכים ונוטים קדימה, המשיכו; אם הם מפנים מבט, עצרו.
  4. תנו לגוף שלהם לומר לכם מתי לשחק ומתי לנוח.
- **HE household items:** רק האצבעות שלכם
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 235. Push the car back and forth `soc-car-back-forth` (toddler)

- **HE title:** לדחוף את המכונית הלוך ושוב
- **HE what it builds:** לקיחת תורות והכיף הפשוט של משחק שעובד רק עם שניים.
- **HE steps:**
  1. שבו זה מול זה במרחק דחיפה קצרה.
  2. שלחו את המכונית ואמרו 'אליך!'
  3. חכו שהם ידחפו בחזרה, והריעו כשהיא מגיעה.
  4. תנו שם לקצב: 'התור שלי… התור שלך… התור שלי.'
- **HE household items:** מכונית צעצוע או כל חפץ שמתגלגל
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 236. Build side by side `soc-side-by-side-build` (toddler)

- **HE title:** לבנות זה לצד זה
- **HE what it builds:** נוחות במשחק לצד מישהו — הצעד הטבעי שלפני משחק ביחד.
- **HE steps:**
  1. שבו קרוב, לכל אחד ערימת קוביות משלו.
  2. בנו את הדבר שלכם תוך תיאור עדין של שלהם.
  3. חקו קצת ממה שהם בנו: 'בנית גבוה, גם אני אבנה.'
  4. תנו להם לשאול מהערימה שלכם אם הם מושיטים יד.
- **HE household items:** שתי ערכות של קוביות, כוסות או קופסאות
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 237. My-turn, your-turn drum `soc-my-turn-drum` (toddler)

- **HE title:** תוף של 'התור שלי, התור שלך'
- **HE what it builds:** המתנה לתור והקשבה לפני שקופצים פנימה — סבלנות דרך משחק.
- **HE steps:**
  1. החזיקו את הכף וטפחו קצב קצר: 'התור שלי.'
  2. העבירו אותה ואמרו 'התור שלך.'
  3. קחו אותה בחזרה בעדינות והוסיפו טפיחה בכל סיבוב.
  4. שמרו על תורות קצרים בהתחלה כדי שההמתנה תרגיש קלה.
- **HE household items:** סיר או קופסה · כף עץ
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 238. One-crayon-each colouring `soc-one-each-crayons` (toddler)

- **HE title:** צביעה עם צבע אחד לכל אחד
- **HE what it builds:** שיתוף מוקדם — העברת צבעים הלוך ושוב על ציור אחד משותף.
- **HE steps:**
  1. שימו דף גדול אחד ביניכם.
  2. קחו צבע אחד כל אחד וצבעו יחד.
  3. הציעו החלפה: 'אחליף לך את האדום בכחול.'
  4. התפעלו מהציור המשותף וציינו מי הוסיף מה.
- **HE household items:** נייר · כמה צבעים
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 239. Carry it together `soc-carry-together` (toddler)

- **HE title:** לשאת את זה יחד
- **HE what it builds:** עבודת צוות למען מטרה אחת — אי אפשר לבד, אז עושים יחד.
- **HE steps:**
  1. מצאו משהו קל שקל יותר לשאת בשניים: סל, כרית.
  2. כל אחד יאחז בצד וספרו 'אחת, שתיים, שלוש, מרימים!'
  3. לכו בקצב אחד לאן שזה הולך, בהתאמה לקצב שלהם.
  4. הריעו לעבודת הצוות: 'עשינו את זה יחד!'
- **HE household items:** סל או קופסה קלים
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 240. Tuck the doll into bed `soc-tuck-in-dolly` (toddler)

- **HE title:** להשכיב את הבובה לישון
- **HE what it builds:** דאגה למישהו אחר — תרגול עדינות ונחמה על צעצוע אהוב.
- **HE steps:**
  1. אמרו שהבובה עייפה ופהקו יחד.
  2. עזרו להם להשכיב את הבובה ולכסות אותה בבד.
  3. טפחו לה ברכות וזמזמו שיר שקט.
  4. לחשו 'לילה טוב' ותנו להם להוביל את הדאגה.
- **HE household items:** בובה או צעצוע רך · בד קטן לשמיכה
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 241. Hello and goodbye at the door `soc-door-greetings` (toddler)

- **HE title:** שלום ולהתראות ליד הדלת
- **HE what it builds:** טקסים חברתיים יומיומיים — לברך אנשים בחום ולהיפרד בנעימות.
- **HE steps:**
  1. כשמישהו מגיע, לכו יחד לומר 'שלום!' גדול.
  2. הוסיפו נפנוף, כיף, או חיבוק — לבחירתם.
  3. בפרידות, נפנפו מהחלון עד שהם נעלמים.
  4. תנו שם לרגש: 'אנחנו שמחים לראות את סבתא!'
- **HE household items:** דלת הכניסה או חלון
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 242. Copy-the-animal parade `soc-copy-the-animal` (toddler)

- **HE title:** מצעד חיקוי החיות
- **HE what it builds:** עשיית פעולה יחד ולקיחת תורות בהובלה — חיקוי משותף ושובב.
- **HE steps:**
  1. בחרו חיה וזוזו כמוה: קפצו כמו ארנב.
  2. הזמינו אותם לחקות אתכם, ואז קפאו.
  3. שאלו 'מה נהיה עכשיו?' ועקבו אחרי הרעיון שלהם.
  4. התחלפו בהובלת המצעד.
- **HE household items:** לא צריך כלום
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 243. Gentle-hands practice `soc-gentle-hands` (toddler)

- **HE title:** תרגול ידיים עדינות
- **HE what it builds:** ללמוד מגע רך ושמעשינו משפיעים על איך שאחרים מרגישים.
- **HE steps:**
  1. הדגימו 'עדין' בליטוף איטי של צעצוע או חיה עם אצבע אחת.
  2. הובילו את ידם לנסות את אותו מגע רך.
  3. אמרו בחום 'עדין… זה מרגיש נעים.'
  4. אם זה נעשה מחוספס, הדגימו שוב עדינות ברוגע — בלי נזיפה.
- **HE household items:** צעצוע רך או חיית מחמד מסכימה
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 244. Hold-hands ring game `soc-ring-circle` (toddler)

- **HE title:** משחק מעגל אחיזת ידיים
- **HE what it builds:** תנועה בסנכרון עם אחרים והכיף המצחקק של עשייה כקבוצה.
- **HE steps:**
  1. אחזו ידיים והלכו במעגל איטי יחד.
  2. שירו חרוז מעגל שמסתיים בכולם מתמוטטים למטה.
  3. ב'כולם נופלים!', שבו בעדינות יחד וצחקו.
  4. קפצו חזרה למעלה ולכו שוב — החזרה היא החלק הכי טוב.
- **HE household items:** לא צריך כלום
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 245. Set up a little shop `soc-play-shop` (preschool)

- **HE title:** להקים חנות קטנה
- **HE what it builds:** התנסות בתפקידים ולקיחת תורות בין מוכר ללקוח.
- **HE steps:**
  1. סדרו כמה 'מוצרים' על חנות-שולחן.
  2. התחלפו: אחד הוא המוכר, אחד הוא הלקוח.
  3. תרגלו את התסריט המנומס: 'שלום, מה תרצה?'
  4. החליפו תפקידים כדי שכל אחד יקבל תור בשני הצדדים.
- **HE household items:** כמה קופסאות או פחיות · 'כסף' מנייר או עלים
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 246. Play restaurant `soc-restaurant-play` (preschool)

- **HE title:** לשחק מסעדה
- **HE what it builds:** שיתוף פעולה על עולם דמיוני משותף ותרגול שיחה הלוך ושוב.
- **HE steps:**
  1. ציירו יחד תפריט פשוט עם כמה תמונות.
  2. אחד לוקח את ההזמנה ו'מבשל'; השני הוא האורח.
  3. השתמשו ב'בבקשה' ו'תודה' כחלק מהמשחק.
  4. החליפו תפקידים כדי ששניכם תגישו ותקבלו שירות.
- **HE household items:** כלים אמיתיים או צעצוע · נייר לתפריט
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 247. Animal doctor clinic `soc-vet-clinic` (preschool)

- **HE title:** מרפאת רופא חיות
- **HE what it builds:** לדמיין איך אחר מרגיש ולהציע טיפול — אמפתיה דרך משחק דמיוני.
- **HE steps:**
  1. סדרו את הצעצועים הרכים כמטופלים חולים.
  2. שאלו כל אחד 'איפה כואב?' והקשיבו לתשובה שלו.
  3. חבשו, נחמו ותנו בדיקה מדומה.
  4. שלחו כל מטופל הביתה מרגיש טוב יותר עם חיבוק.
- **HE household items:** צעצועים רכים · בד לתחבושות
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 248. Build one tower together `soc-build-one-tower` (preschool)

- **HE title:** לבנות מגדל אחד יחד
- **HE what it builds:** עבודה לפי תוכנית משותפת אחת והתמודדות יחד כשהדברים מתנדנדים.
- **HE steps:**
  1. הסכימו על דבר אחד לבנות יחד: 'מגדל גבוה מהחתול.'
  2. התחלפו בהוספת חלק, תוך שיחה על התוכנית.
  3. כשזה מתנדנד, פתרו בעיה כצוות במקום להאשים.
  4. התפעלו ממה שיצרתם יחד והפילו אותו בספירה עד שלוש.
- **HE household items:** קוביות, כוסות או קופסאות
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 249. One for you, one for me `soc-fair-shares` (preschool)

- **HE title:** אחד לך, אחד לי
- **HE what it builds:** הרעיון של חלוקה הוגנת — לחלק דברים כך שכולם יקבלו אותו דבר.
- **HE steps:**
  1. שימו ערימה קטנה של קרקרים או קוביות ביניכם.
  2. חלקו אותם יחד: 'אחד לך, אחד לי.'
  3. ספרו את הערימה של כל אחד ובדקו שהן שוות.
  4. דברו על איך זה מרגיש כשחלוקה היא הוגנת.
- **HE household items:** חטיף או חפצים קטנים לחלוקה
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 250. Draw the feeling faces `soc-feeling-faces` (preschool)

- **HE title:** לצייר את פרצופי הרגשות
- **HE what it builds:** מתן שם לרגשות בפרצופים וניחוש מה יכול לגרום למישהו להרגיש כל אחד.
- **HE steps:**
  1. ציירו כמה פרצופים פשוטים: שמח, עצוב, כועס, מפוחד.
  2. קראו בשם לכל אחד יחד וחקו אותו עם הפנים שלכם.
  3. תהו בקול: 'מה יכול לגרום למישהו להרגיש עצוב?'
  4. הצביעו על הפרצוף שמתאים לאיך שכל אחד מכם מרגיש עכשיו.
- **HE household items:** נייר · צבעים או טושים
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 251. A kindness mission `soc-kindness-mission` (preschool)

- **HE title:** משימת חסד
- **HE what it builds:** לשים לב למה שמישהו אחר אולי צריך ולבחור לעזור — חסד יומיומי.
- **HE steps:**
  1. לחשו 'משימה סודית': לעשות דבר טוב אחד למישהו בבית.
  2. העלו רעיונות: ציור, יד עוזרת, חיבוק.
  3. בצעו אותה יחד וצפו בתגובה של האדם.
  4. דברו אחר כך על איך הפרצוף השמח שלו גרם לכם להרגיש.
- **HE household items:** לא צריך כלום
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 252. Puppet friends make up `soc-puppet-friends` (preschool)

- **HE title:** בובות חברות מתפייסות
- **HE what it builds:** לראות מהמורה קטנה בחברות ולמצוא דרך טובה לתקן אותה.
- **HE steps:**
  1. תנו לכל בובה שם ובעיה קטנה: שתיהן רוצות צעצוע אחד.
  2. גלמו את הרגשות הכועסים בצורה עדינה ומצחיקה.
  3. שאלו את הילד 'מה הבובות יכולות לעשות?'
  4. שחקו את הרעיון שלהם וסיימו בבובות חברות שוב.
- **HE household items:** שני גרביים או צעצועים רכים כבובות
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 253. Roll-and-move turn game `soc-roll-and-move` (preschool)

- **HE title:** משחק תורות של 'גלגל וזוז'
- **HE what it builds:** המתנה לתור והישארות במשחק בין אם אתה מוביל או מפגר.
- **HE steps:**
  1. ציירו מסלול קצר של משבצות מהתחלה לסוף.
  2. התחלפו בגלגול והזזת כפתור לאורך המסלול.
  3. תנו שם להמתנה בקול: 'הגלגול שלי, ואז שלך.'
  4. עודדו זה את זה, לא רק את עצמכם, עד הסוף.
- **HE household items:** קובייה · נייר למסלול פשוט
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 254. Superhero rescue team `soc-superhero-team` (preschool)

- **HE title:** צוות הצלה של גיבורי על
- **HE what it builds:** משחק דמיוני כצוות, לכל אחד תפקיד, כולם חותרים לאותה הצלה.
- **HE steps:**
  1. לבשו גלימות וכל אחד יבחר כוח על.
  2. קבעו משימה ידידותית: 'להציל את הצעצועים מהר הספה.'
  3. תנו לכל גיבור תפקיד כך שתזדקקו זה לזה באמת.
  4. חגגו את ניצחון הצוות, וציינו מה כל גיבור עשה.
- **HE household items:** מגבות או צעיפים לגלימות
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 255. Back-to-back building `soc-back-to-back-build` (early-school)

- **HE title:** בנייה גב אל גב
- **HE what it builds:** הסבר ברור והקשבה קשובה — עבודת צוות כשאי אפשר פשוט להצביע.
- **HE steps:**
  1. שבו גב אל גב עם קוביות תואמות לכל אחד.
  2. אחד בונה משהו, ואז מתאר אותו במילים בלבד.
  3. השני מנסה לבנות את אותו דבר מהתיאור.
  4. השוו, צחקו על ההבדלים, ואז החליפו תפקידים.
- **HE household items:** שתי ערכות תואמות של קוביות, או נייר ועטים
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 256. In their shoes `soc-in-their-shoes` (early-school)

- **HE title:** בנעליים שלהם
- **HE what it builds:** לדמיין רגע מהצד של מישהו אחר — לב ההבנה של אחרים.
- **HE steps:**
  1. בחרו רגע יומיומי קטן: ילד חדש ביום הראשון.
  2. שאלו 'איך אתה חושב שהוא הרגיש?' והקשיבו במלואו.
  3. תהו יחד מה היה יכול לעזור לו.
  4. עברו לאדם אחר בסיפור ודמיינו גם את הצד שלו.
- **HE household items:** לא צריך כלום
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 257. Compliment round `soc-compliment-round` (early-school)

- **HE title:** סבב מחמאות
- **HE what it builds:** לשים לב לטוב שבאחרים ולומר אותו בקול — בניית חיבורים חמים.
- **HE steps:**
  1. עברו בסבב וכל אחד ייתן מחמאה אמיתית אחת לאדם משמאלו.
  2. עשו אותה ספציפית: 'היית סבלני כשהייתי אטי.'
  3. המקבל פשוט אומר 'תודה' — בלי לבטל.
  4. שימו לב איך החדר מרגיש אחרי סבב של מילים טובות.
- **HE household items:** לא צריך כלום — עובד ליד השולחן
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 258. Recipe for a good friend `soc-friend-recipe` (early-school)

- **HE title:** מתכון לחבר טוב
- **HE what it builds:** לתת מילים למה שעושה חבר טוב — ואיך להיות כזה.
- **HE steps:**
  1. כתבו 'מתכון לחבר טוב' בראש הדף.
  2. הוסיפו 'מרכיבים' יחד: כוס הקשבה, כף שיתוף.
  3. דברו על פעם שכל אחד מכם היה חבר טוב.
  4. תלו אותו כתזכורת ששניכם עזרתם לכתוב.
- **HE household items:** נייר · עט
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 259. Describe-and-guess teamwork `soc-describe-and-guess` (early-school)

- **HE title:** עבודת צוות של 'תאר ונחש'
- **HE what it builds:** עבודה כשותפים — לתת רמזים שהאדם השני באמת יכול להשתמש בהם.
- **HE steps:**
  1. כתבו כמה מילים פשוטות על כרטיסים והפכו אותם.
  2. אחד בוחר כרטיס ומתאר אותו בלי לומר את המילה.
  3. השותף מנחש; אתם צוות שמנצח את השעון, לא זה את זה.
  4. החליפו מתאר ומנחש בכל סיבוב.
- **HE household items:** נייר טיוטה לכרטיסי מילים
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 260. The repair role-play `soc-repair-role-play` (early-school)

- **HE title:** משחק התפקידים של התיקון
- **HE what it builds:** תרגול איך לתקן דברים אחרי מריבה — לתת שם, לקחת אחריות ולהתפייס.
- **HE steps:**
  1. המציאו חוסר הסכמה קטן ומדומה בין שני חברים.
  2. גלמו את המהמורה, ואז עצרו: 'מה יכול לתקן את זה?'
  3. נסו תיקון יחד: סליחה אמיתית, פתרון הוגן, התחלה חדשה.
  4. דברו על אילו תיקונים מרגישים טוב לתת ולקבל.
- **HE household items:** לא צריך כלום
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 261. Good-sport game night `soc-good-sport` (early-school)

- **HE title:** ערב משחקים של ספורטיביות
- **HE what it builds:** לשחק הוגן ולהישאר נחמד בין אם ניצחת או הפסדת — חן תחת לחץ.
- **HE steps:**
  1. לפני שמתחילים, הסכימו על כלל אחד: המנצח והמפסיד נשארים ידידותיים.
  2. שחקו סיבוב מהיר, ושמרו על תורות הוגנים.
  3. תרגלו את המשפטים: 'משחק טוב' ו'שיחקת יפה.'
  4. אחר כך, ציינו רגע שכל אחד מכם היה ספורטיבי.
- **HE household items:** כל משחק לוח או קלפים פשוט
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 262. Secret act of kindness `soc-secret-kindness` (early-school)

- **HE title:** מעשה חסד סודי
- **HE what it builds:** לעשות משהו טוב בלי לצפות להכרה — חסד לשם עצמו.
- **HE steps:**
  1. בחרו בן משפחה לעזור לו או להפתיע אותו בסתר.
  2. תכננו מעשה טוב שקט: חדר מסודר, פתק חבוי.
  3. עשו אותו בלי שיראו אתכם ובלי לבקש תודה.
  4. אחר כך, שתפו איך זה הרגיש לתת בסתר.
- **HE household items:** נייר או משימת עזרה קטנה
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 263. Two-person team job `soc-team-job` (early-school)

- **HE title:** עבודת צוות של שניים
- **HE what it builds:** לחלק עבודה אמיתית, לחלוק את המאמץ, ולסיים משהו כצוות.
- **HE steps:**
  1. בחרו עבודה שטובה יותר בשניים: להציע מיטה, לסדר מדף.
  2. החליטו יחד מי עושה איזה חלק.
  3. עבדו זה לצד זה, ותשאלו זה את זה: 'צריך עזרה?'
  4. עמדו אחורה והתפעלו מהעבודה המוגמרת שחלקתם.
- **HE household items:** מטלת בית אמיתית לשניים
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 264. How would they feel? `soc-how-would-they-feel` (early-school)

- **HE title:** איך הם ירגישו?
- **HE what it builds:** לקרוא מצב מכל זווית — לדמיין את רגשותיהם של כמה אנשים בבת אחת.
- **HE steps:**
  1. תארו סצנה קצרה: מישהו לא משותף במשחק.
  2. שאלו איך כל אחד בה אולי מרגיש — כולל אלה שלא שיתפו אותו.
  3. תהו מה יכול להיות צעד המשך טוב.
  4. התחלפו בהמצאת סצנות זה עבור זה לפתור.
- **HE household items:** לא צריך כלום
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 265. Teddy bear picnic `std-toddler-teddy-picnic` (toddler)

- **HE title:** פיקניק דובים
- **HE what it builds:** דאגה לאחרים ואירוח פשוט — להגיש, לחלוק, להגיד תודה.
- **HE steps:**
  1. פרסו את השמיכה והושיבו את האורחים במעגל.
  2. חלקו צלחות ותנו להם 'להגיש' לכל אורח בתור המארחים.
  3. דובבו אורח — 'עוד בבקשה!' — ותנו להם להגיב.
  4. סיימו את הפיקניק יחד: האורחים אומרים תודה, המארחים מנופפים לשלום.
- **HE household items:** שמיכה · צלחות צעצוע או כוסות אמיתיות · בובות פרווה · חטיף אמיתי קטן
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 266. Run tonight's family restaurant `ext-family-restaurant-night` (preschool, early-school)

- **HE title:** מנהלים הערב מסעדה משפחתית
- **HE what it builds:** להריץ עבודה אמיתית מההתחלה עד הסוף — לקבל פנים, להגיש, ולקבל תודה.
- **HE steps:**
  1. כתבו וקשטו יחד את התפריט של הערב.
  2. הם עורכים את השולחן, מושיבים את האורחים ולוקחים הזמנות כמו מלצר אמיתי.
  3. הגישו את האוכל מנה אחרי מנה, עם המון תודות.
  4. התחלפו בתפקידים לקינוח — עכשיו הם האורחים.
- **HE household items:** נייר לתפריטים · עטים · ארוחת הערב שהכנתם ממילא
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

#### 267. Invent your own board game `ext-invent-a-board-game` (early-school)

- **HE title:** ממציאים משחק קופסה משלכם
- **HE what it builds:** להמציא חוקים יחד, לנסות אותם, ולנהל משא ומתן כשהם לא עובדים.
- **HE steps:**
  1. ציירו שביל מתפתל של משבצות על הלוח.
  2. המציאו חוקים יחד: מה קורה במשבצות אדומות? בכוכבים?
  3. שחקו סיבוב ראשון ותנו לחוקים השבורים להתגלות.
  4. תקנו את החוקים יחד ושחקו את הגרסה המשופרת.
- **HE household items:** נייר או קרטון · עטים · קובייה וכפתורים או מטבעות ככלי משחק
- **Reviewer verdict:** ☐ approved ☐ corrected (see inline)

---

## Sign-off

| Field | Value |
|---|---|
| Reviewer (native HE) | _(GD-7 — to be named by Guy)_ |
| Review date | |
| Result | ☐ approved as-is ☐ corrections attached (data-only PR) |

On sign-off: apply corrections as a data-only PR, then replace the first-draft annotation above
`PLAY_ACTIVITIES_HE` in `content.ts` with: `Native-reviewed by <name>, <date> (GD-7)`.

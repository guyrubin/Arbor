/**
 * Learn Library seed catalogue — batch B (play · screens · eating · motion ·
 * parent). Same editorial stance as batch A (see learnCardsCore.ts).
 */
import type { LocalizedText } from "../content/governance";
import type { LearnCard } from "./learnLibrary";

const L = (en: string, he: string): LocalizedText => ({ en, he });

export const LEARN_CARDS_MORE: LearnCard[] = [
  // ── Play & Learning ──────────────────────────────────────────────────────
  {
    id: "pretend-play",
    category: "play",
    domains: ["cognition_executive_function", "social_development", "language_communication"],
    ageMin: 2,
    ageMax: 6,
    minutes: 4,
    title: L("Pretend play: the theory-of-mind gym", "משחק דמיוני: חדר הכושר של תיאוריית המיינד"),
    hook: L("A cardboard box becoming a spaceship is your child running advanced simulations of minds, rules and worlds.", "קופסת קרטון שהופכת לחללית היא הילד שלכם מריץ סימולציות מתקדמות של מוחות, חוקים ועולמות."),
    keyPoints: [
      L("Pretending 'this banana is a phone' requires holding two realities at once — a genuine cognitive feat that emerges around age two.", "להעמיד פנים ש'הבננה היא טלפון' דורש להחזיק שתי מציאויות בבת אחת — הישג קוגניטיבי אמיתי שמופיע סביב גיל שנתיים."),
      L("Role play is perspective practice: being the doctor, the dragon or the baby means simulating another mind from inside.", "משחק תפקידים הוא תרגול נקודות מבט: להיות הרופאה, הדרקון או התינוק פירושו לדמות מוח אחר מבפנים."),
      L("Staying in character is self-regulation in disguise; children follow pretend rules they'd resist as instructions.", "להישאר בדמות זה ויסות עצמי בתחפושת; ילדים מצייתים לחוקי כאילו שהיו מתנגדים להם כהוראות."),
      L("Rich pretend play feeds language: roles demand new registers, words and negotiations ('you be the customer, I'll say welcome').", "משחק דמיוני עשיר מזין שפה: תפקידים דורשים משלבים, מילים ומשא ומתן חדשים (\"את הלקוחה, אני אגיד ברוכה הבאה\")."),
      L("The adult's best move is usually a supporting role: follow their script, add one prop or twist, resist directing.", "המהלך הטוב ביותר של המבוגר הוא לרוב תפקיד משנה: לכו אחרי התסריט שלהם, הוסיפו אביזר או טוויסט אחד, התאפקו מלביים."),
    ],
    body: L(
      "Somewhere around the second birthday, a child feeds a teddy bear invisible soup — and quietly demonstrates one of the most sophisticated things a human brain does. Pretense requires representing reality (it's a spoon of air) and a second, imagined layer (it's soup) at the same time, without confusing the two. Developmental psychologists treat the arrival of pretend play as a milestone of symbolic thought, the same capacity that later powers language, storytelling and mathematics.\n\nAs pretend play matures into role play, it becomes a social simulator. To play shopkeeper, a child must imagine what a shopkeeper knows, wants and says — and coordinate it with what the customer (a friend with ideas of their own) is doing. Researchers link rich sociodramatic play with growth in theory of mind and self-regulation, and the regulation finding has a lovely twist: children hold still longer, wait better and follow rules more thoroughly inside a role than outside one. The same child who cannot 'stand still' can stand guard.\n\nLanguage rides along. Pretend scenarios demand narration, negotiation and vocabulary that daily life never requires — patients, menus, missions, spells. Listen in on long pretend sessions and you hear children stretching grammar and register far beyond their everyday speech.\n\nAdults help most by being scarce and useful. Provide raw material — fabric, boxes, spoons, dolls; open-ended junk outperforms scripted toys — and take small roles when invited. Extend rather than direct: one new complication ('oh no, the dragon is vegetarian?') keeps a scenario alive without taking it over. And protect the time. Unhurried, screen-free stretches are where the deepest pretending grows.",
      "אי שם סביב יום ההולדת השני, ילד מאכיל דובי במרק בלתי נראה — ומדגים בשקט את אחד הדברים המתוחכמים שמוח אנושי עושה. העמדת פנים דורשת לייצג את המציאות (זו כף של אוויר) ושכבה מדומיינת שנייה (זה מרק) בו־זמנית, בלי לבלבל ביניהן. פסיכולוגים התפתחותיים רואים בהופעת המשחק הדמיוני אבן דרך של חשיבה סמלית — אותה יכולת שתניע בהמשך שפה, סיפור ומתמטיקה.\n\nכשהמשחק הדמיוני מבשיל למשחק תפקידים, הוא נעשה סימולטור חברתי. כדי לשחק מוכר בחנות, ילד צריך לדמיין מה מוכר יודע, רוצה ואומר — ולתאם זאת עם מה שהלקוחה (חברה עם רעיונות משלה) עושה. מחקרים קושרים משחק סוציודרמטי עשיר לצמיחה בתיאוריית המיינד ובוויסות עצמי, ולממצא הוויסות יש טוויסט מקסים: ילדים עומדים בשקט יותר זמן, מחכים טוב יותר ומצייתים לחוקים ביסודיות רבה יותר בתוך תפקיד מאשר מחוצה לו. אותו ילד ש'לא מסוגל לעמוד בשקט' מסוגל לעמוד על המשמר.\n\nהשפה נוסעת יחד. תרחישי כאילו דורשים קריינות, משא ומתן ואוצר מילים שחיי היומיום לא מצריכים — מטופלים, תפריטים, משימות, לחשים. הקשיבו למשחק דמיוני ארוך ותשמעו ילדים מותחים דקדוק ומשלב הרבה מעבר לדיבור הרגיל שלהם.\n\nמבוגרים עוזרים הכי הרבה כשהם נדירים ושימושיים. ספקו חומר גלם — בדים, קופסאות, כפות, בובות; גרוטאות פתוחות עולות על צעצועים מתוסרטים — וקחו תפקידים קטנים כשמזמינים אתכם. הרחיבו במקום לביים: סיבוך חדש אחד (\"אוי לא, הדרקון צמחוני?\") מחיה תרחיש בלי להשתלט עליו. והגנו על הזמן. רצועות רגועות ונטולות מסך הן המקום שבו הדמיון העמוק ביותר צומח."
    ),
    tryToday: L(
      "Put a 'maybe box' on the floor: fabric scraps, a wooden spoon, two boxes, a hat. Say nothing. Watch what world appears.",
      "הניחו על הרצפה 'קופסת אולי': פיסות בד, כף עץ, שתי קופסאות, כובע. אל תגידו כלום. ראו איזה עולם מופיע."
    ),
    ask: L("How can I extend my child's pretend play without taking it over?", "איך להרחיב את המשחק הדמיוני של הילד בלי להשתלט עליו?"),
  },
  {
    id: "boredom-benefits",
    category: "play",
    domains: ["cognition_executive_function", "independence_adaptive_skills"],
    ageMin: 3,
    ageMax: 10,
    minutes: 3,
    title: L("\"I'm bored\" is a beginning, not an emergency", "\"משעמם לי\" זו התחלה, לא מקרה חירום"),
    hook: L("The uncomfortable pause before self-directed play is where initiative is manufactured. Rescuing too fast cancels the process.", "ההשהיה הלא נוחה שלפני משחק עצמאי היא המקום שבו נוצרת יוזמה. חילוץ מהיר מדי מבטל את התהליך."),
    keyPoints: [
      L("Boredom is a functional signal — the mind casting about for engagement — not a problem the adult must solve.", "שעמום הוא אות תפקודי — התודעה מגששת אחר עניין — לא בעיה שהמבוגר חייב לפתור."),
      L("Tolerating the empty moment trains initiative: the child discovers they can generate their own engagement.", "לשאת את הרגע הריק מאמן יוזמה: הילד מגלה שהוא מסוגל לייצר עניין בעצמו."),
      L("Constant scheduled entertainment and instant screens teach the opposite reflex: stimulation is something delivered.", "בידור מתוזמן תמידי ומסכים זמינים מלמדים רפלקס הפוך: גירוי הוא משהו שמגישים לך."),
      L("A prepared environment beats a prepared activity: reachable open-ended materials let 'nothing to do' turn into something.", "סביבה מוכנה עדיפה על פעילות מוכנה: חומרים פתוחים בהישג יד נותנים ל\"אין מה לעשות\" להפוך למשהו."),
      L("The useful response is warm and brief: acknowledge, express confidence, resist programming. \"Bored is okay. I wonder what you'll find.\"", "התגובה המועילה חמה וקצרה: הכירו, הביעו אמון, התאפקו מלתכנת. \"משעמם זה בסדר. מעניין מה תמצא.\""),
    ],
    body: L(
      "\"I'm booored\" lands on a modern parent like an alarm. Somewhere along the way, a bored child began to feel like evidence of neglect, and family calendars and tablets filled in accordingly. It's worth recovering an older understanding: the ability to be bored and climb out of it under your own power is a skill, and children only build it by being allowed to practice.\n\nWatch what actually happens when a child hits boredom and no rescue arrives. There's friction — complaints, flopping, dramatic sighs. Then, if the vacuum holds, something switches on. A stick becomes a project. The couch cushions reorganize into architecture. Psychologists describe boredom as a search state: mild discomfort that motivates the mind to find or invent engagement. Interrupt the discomfort with delivered entertainment every time, and the search never completes; the child learns that stimulation comes from outside, and the muscle that turns 'nothing' into 'something' stays untrained.\n\nThis is not an argument for benign neglect. Children climb out of boredom best in a yes-space: open-ended materials within reach (paper, tape, blocks, dress-up junk, outdoor access), a base of felt security, and an adult nearby who is calm about the discomfort. The response that helps is short and warm: name it, bless it, step back. 'Being bored is allowed. Something will come to you.' Offering one open door — 'the tape drawer is free' — is fine; a menu of programmed options is the rescue you were avoiding.\n\nExpect the skill to build like any other: badly at first, then better. The child who has practiced turning empty time into projects owns a resource for life — and your afternoons get quieter too.",
      "\"משעמם ליייי\" נוחת על הורה מודרני כמו אזעקה. איפשהו בדרך, ילד משועמם התחיל להרגיש כמו עדות להזנחה, ולוחות השנה והטאבלטים התמלאו בהתאם. שווה להחזיר הבנה ישנה יותר: היכולת להשתעמם ולטפס החוצה בכוחות עצמך היא מיומנות, וילדים בונים אותה רק כשמרשים להם להתאמן.\n\nראו מה באמת קורה כשילד פוגש שעמום ואף חילוץ לא מגיע. יש חיכוך — תלונות, השתרעות, אנחות דרמטיות. ואז, אם הריק מחזיק, משהו נדלק. מקל הופך לפרויקט. כריות הספה מתארגנות מחדש לארכיטקטורה. פסיכולוגים מתארים שעמום כמצב חיפוש: אי־נוחות קלה שמניעה את התודעה למצוא או להמציא עניין. קטעו את אי־הנוחות בבידור מוגש בכל פעם — והחיפוש לעולם לא יושלם; הילד לומד שגירוי מגיע מבחוץ, והשריר שהופך 'כלום' ל'משהו' נשאר לא מאומן.\n\nזו אינה טענה בעד הזנחה נחמדה. ילדים מטפסים החוצה משעמום הכי טוב במרחב של כן: חומרים פתוחים בהישג יד (נייר, סלוטייפ, קוביות, בגדים לתחפושות, גישה לחצר), בסיס של ביטחון מורגש, ומבוגר קרוב שרגוע לנוכח אי־הנוחות. התגובה שעוזרת קצרה וחמה: תנו שם, ברכו, סגו אחורה. \"מותר להשתעמם. משהו יבוא אליך.\" דלת פתוחה אחת — \"מגירת הסלוטייפ פנויה\" — זה בסדר; תפריט אפשרויות מתוכנת הוא בדיוק החילוץ שניסיתם להימנע ממנו.\n\nצפו שהמיומנות תיבנה כמו כל אחרת: גרוע בהתחלה, ואז טוב יותר. ילד שתרגל להפוך זמן ריק לפרויקטים מחזיק משאב לכל החיים — וגם אחר הצהריים שלכם נעשים שקטים יותר."
    ),
    tryToday: L(
      "Next \"I'm bored,\" try the three-step: \"Bored is okay. I bet something will come to you. The craft drawer is open.\" Then busy yourself nearby and count to 300.",
      "ב\"משעמם לי\" הבא, נסו שלושה צעדים: \"משעמם זה בסדר. אני בטוחה שמשהו יבוא לך. מגירת היצירה פתוחה.\" ואז התעסקו בשלכם בקרבת מקום וספרו עד 300."
    ),
    ask: L("How do I set up our home so boredom turns into play by itself?", "איך לארגן את הבית כך ששעמום יהפוך למשחק מעצמו?"),
  },

  // ── Screens & Digital ────────────────────────────────────────────────────
  {
    id: "co-viewing",
    category: "screens",
    domains: ["ecosystem_stressors", "language_communication"],
    ageMin: 1,
    ageMax: 6,
    minutes: 3,
    title: L("Co-viewing: the variable that changes what screens do", "צפייה משותפת: המשתנה שמשנה מה מסכים עושים"),
    hook: L("The same episode is a different experience with a parent in the loop. Who watches with the child matters as much as what plays.", "אותו פרק הוא חוויה אחרת כשהורה נמצא בלולאה. מי צופה עם הילד חשוב לא פחות ממה שמוקרן."),
    keyPoints: [
      L("Young children learn poorly from screens alone — the well-documented 'video deficit' — but an engaged adult narrows the gap substantially.", "ילדים צעירים לומדים חלש ממסכים לבד — 'גירעון הווידאו' המתועד היטב — אבל מבוגר מעורב מצמצם את הפער משמעותית."),
      L("Talking during and after — naming, asking, connecting to the child's life — converts passive exposure into a shared language event.", "דיבור תוך כדי ואחרי — לתת שמות, לשאול, לחבר לחיי הילד — הופך חשיפה סבילה לאירוע שפה משותף."),
      L("Slow, story-driven, question-asking content invites participation; frenetic content crowds it out.", "תוכן איטי, סיפורי, ששואל שאלות מזמין השתתפות; תוכן קדחתני דוחק אותה החוצה."),
      L("Video calls with loved ones are the screen exception precisely because they are contingent — a real person responding in real time.", "שיחות וידאו עם אנשים אהובים הן החריג המסכי בדיוק כי הן מגיבות — אדם אמיתי עונה בזמן אמת."),
      L("Co-viewing every minute isn't realistic; aim for bookends — start together, land it together with two minutes of talk.", "צפייה משותפת בכל דקה אינה ריאלית; כוונו לסוגריים — להתחיל יחד ולנחות יחד עם שתי דקות שיחה."),
    ],
    body: L(
      "The screen-time conversation usually fixates on quantity, but research keeps pointing at two quieter variables: what plays, and whether an adult is in the loop. The second one is co-viewing, and it changes the transaction more than most parents expect.\n\nThe backdrop is the video deficit: before roughly age three, children learn noticeably less from a demonstration on a screen than from the identical demonstration live. Screens are hard for young brains — flat, non-responsive, and blind to the child's reactions. What repairs much of the deficit is a responsive human alongside: when a parent watches too, names what's happening, and connects it to the child's world ('a digger! like the one by our house'), the child's learning from the same content improves measurably. The adult supplies what the screen cannot — timing, relevance and conversation.\n\nCo-viewing also quietly teaches media itself: that content is something you think and talk about, question, laugh at together — not a firehose you open alone. Those habits, seeded early, are the roots of media literacy.\n\nPractically, nobody co-views everything, and the goal isn't surveillance. Favor content built for participation — slower pacing, direct questions, story over stimulation. Join the start when you can, and reliably collect the landing: two minutes of 'what happened? which part was your favorite?' turns even solo viewing into conversational material. And keep video calls with grandparents in their own category; a responsive face on a screen is contingent interaction, the very thing ordinary video lacks.",
      "שיחת זמן־המסך מקובעת בדרך כלל על כמות, אבל המחקר מצביע שוב ושוב על שני משתנים שקטים יותר: מה מוקרן, והאם מבוגר נמצא בלולאה. השני הוא צפייה משותפת, והיא משנה את העסקה יותר משרוב ההורים מצפים.\n\nהרקע הוא גירעון הווידאו: עד גיל שלוש בערך, ילדים לומדים פחות באופן ניכר מהדגמה על מסך מאשר מאותה הדגמה בדיוק פנים אל פנים. מסכים קשים למוחות צעירים — שטוחים, לא מגיבים, ועיוורים לתגובות הילד. מה שמתקן חלק גדול מהגירעון הוא אדם מגיב לצד הילד: כשהורה צופה גם, נותן שמות למתרחש ומחבר לעולם הילד (\"מחפר! כמו זה שליד הבית שלנו\"), הלמידה מאותו תוכן משתפרת באופן מדיד. המבוגר מספק את מה שהמסך לא יכול — תזמון, רלוונטיות ושיחה.\n\nצפייה משותפת גם מלמדת בשקט את המדיה עצמה: שתוכן הוא דבר שחושבים ומדברים עליו, שואלים עליו, צוחקים עליו יחד — לא צינור שפותחים לבד. ההרגלים האלה, שנזרעים מוקדם, הם שורשי האוריינות הדיגיטלית.\n\nמעשית, אף אחד לא צופה יחד בהכול, והמטרה אינה פיקוח. העדיפו תוכן שנבנה להשתתפות — קצב איטי יותר, שאלות ישירות, סיפור על פני גירוי. הצטרפו להתחלה כשאפשר, ואספו באמינות את הנחיתה: שתי דקות של \"מה קרה? איזה חלק הכי אהבת?\" הופכות גם צפייה לבד לחומר שיחה. ושמרו לשיחות וידאו עם סבים קטגוריה משלהן; פנים מגיבות על מסך הן אינטראקציה נענית — בדיוק הדבר שחסר לווידאו רגיל."
    ),
    tryToday: L(
      "After today's episode, ask two questions before the next thing starts: \"What happened? What was the silliest part?\" The recap is where the learning lands.",
      "אחרי הפרק של היום, שאלו שתי שאלות לפני שהדבר הבא מתחיל: \"מה קרה? מה היה הכי מצחיק?\" הסיכום הוא המקום שבו הלמידה נוחתת."
    ),
    ask: L("Which shows at my child's age invite the most participation?", "אילו תוכניות בגיל של הילד שלי מזמינות הכי הרבה השתתפות?"),
  },
  {
    id: "ending-screen-time",
    category: "screens",
    domains: ["ecosystem_stressors", "attachment_regulation"],
    ageMin: 2,
    ageMax: 8,
    minutes: 3,
    title: L("Ending screen time without the meltdown", "לסיים זמן מסך בלי התמוטטות"),
    hook: L("Screens end badly because they're engineered not to end. A few structural moves beat willpower — theirs and yours.", "מסכים נגמרים רע כי הם מהונדסים לא להיגמר. כמה מהלכים מבניים מנצחים כוח רצון — שלהם ושלכם."),
    keyPoints: [
      L("Autoplay and endless feeds remove natural stopping points; the fight at the end is partly with the design, not just the child.", "ניגון אוטומטי ופידים אינסופיים מבטלים נקודות עצירה טבעיות; המאבק בסוף הוא חלקית עם העיצוב, לא רק עם הילד."),
      L("End at story boundaries, not clock boundaries: 'after this episode' cooperates with the brain; mid-scene cutoffs fight it.", "סיימו בגבולות סיפור, לא בגבולות שעון: \"אחרי הפרק הזה\" משתף פעולה עם המוח; ניתוק באמצע סצנה נלחם בו."),
      L("Announce the landing in advance and hand the child the controls: pressing 'off' themselves converts defeat into agency.", "הכריזו על הנחיתה מראש ותנו לילד את השליטה: ללחוץ 'כיבוי' בעצמו הופך תבוסה לסוכנות."),
      L("A warm hand-off beats a void: the next thing ('snack's on the table') should already exist when the screen goes dark.", "מסירה חמה עדיפה על ריק: הדבר הבא (\"החטיף על השולחן\") צריך כבר להתקיים כשהמסך נכבה."),
      L("Consistency shrinks the battle over weeks: when the rule truly holds every day, testing it gradually stops paying.", "עקביות מכווצת את הקרב לאורך שבועות: כשהחוק באמת מחזיק כל יום, לבדוק אותו מפסיק בהדרגה להשתלם."),
    ],
    body: L(
      "There's a specific despair to the moment the tablet goes off — the wail, the bargaining, the boneless collapse. Take some comfort in this: the difficulty is partly structural. Modern children's content is built for retention. Autoplay starts the next episode before a decision can happen; games sit permanently mid-quest. Asking a child to stop is asking them to exit an environment optimized against exits — with an executive-function toolkit still under construction.\n\nSo borrow structure back. First, end on the content's own seams: 'one more episode' lands enormously better than 'ten more minutes,' because episodes actually end while minutes are invisible. Turning autoplay off in settings restores the seam the design removed. Second, telegraph the landing: a warning at the start ('two episodes today') and near the end makes the stop a scheduled event rather than an ambush. Third, hand over the mechanics — a child who presses the off button themselves keeps a piece of authorship in the ending; it's a small thing that repeatedly proves large.\n\nWhat happens next matters as much as the stop. A screen ending into a vacuum invites mourning; a screen ending into 'come stir the pasta' is a transition to somewhere. Plan the hand-off before you start the timer, and for a heavy-transition child make it physical and appealing.\n\nExpect protest anyway, especially the first weeks of any new rule — that's the old rule being renegotiated, and calm consistency is the message that renegotiation is closed. And notice your own exits: children study how the adults around them put their phones down. Ending your scroll out loud ('okay, phone away, I want to hear about the fort') is the most persuasive tutorial you will ever run.",
      "יש ייאוש מסוים ברגע שבו הטאבלט נכבה — היללה, המשא ומתן, הקריסה נטולת העצמות. הנה נחמה: הקושי הוא חלקית מבני. תוכן ילדים מודרני בנוי לשימור. ניגון אוטומטי מתחיל את הפרק הבא לפני שהחלטה יכולה לקרות; משחקים תקועים לנצח באמצע משימה. לבקש מילד להפסיק זה לבקש ממנו לצאת מסביבה שמותאמת נגד יציאות — עם ערכת תפקודים ניהוליים שעדיין בבנייה.\n\nאז תשאילו מבנה בחזרה. ראשית, סיימו בתפרים של התוכן עצמו: \"עוד פרק אחד\" נוחת הרבה יותר טוב מ\"עוד עשר דקות\", כי פרקים באמת נגמרים ודקות בלתי נראות. כיבוי הניגון האוטומטי בהגדרות מחזיר את התפר שהעיצוב מחק. שנית, שדרו את הנחיתה: התרעה בהתחלה (\"שני פרקים היום\") ולקראת הסוף הופכת את העצירה לאירוע מתוכנן במקום מארב. שלישית, מסרו את המכניקה — ילד שלוחץ על כפתור הכיבוי בעצמו שומר פיסת בעלות על הסיום; דבר קטן שמוכיח את עצמו גדול שוב ושוב.\n\nמה שקורה אחר כך חשוב לא פחות מהעצירה. מסך שנגמר אל תוך ריק מזמין אֵבל; מסך שנגמר אל תוך \"בוא לערבב את הפסטה\" הוא מעבר אל מקום. תכננו את המסירה לפני שהטיימר מתחיל, ולילד שמעברים קשים לו — עשו אותה פיזית ומושכת.\n\nצפו למחאה בכל זאת, במיוחד בשבועות הראשונים של כלל חדש — זה הכלל הישן במשא ומתן חוזר, ועקביות רגועה היא ההודעה שהמשא ומתן סגור. ושימו לב ליציאות שלכם: ילדים חוקרים איך המבוגרים סביבם מניחים את הטלפון. לסיים את הגלילה שלכם בקול (\"טוב, טלפון בצד, אני רוצה לשמוע על המבצר\") הוא המדריך המשכנע ביותר שתריצו אי פעם."
    ),
    tryToday: L(
      "Tonight: autoplay off, a two-sentence start (\"Two episodes. You press off after the second\"), and a hand-off waiting. Run the same script all week.",
      "הערב: ניגון אוטומטי כבוי, פתיחה בשני משפטים (\"שני פרקים. אתה לוחץ כיבוי אחרי השני\"), ומסירה מחכה. הריצו את אותו תסריט כל השבוע."
    ),
    ask: L("Build me a calm end-of-screen-time script for this week.", "בנה לי תסריט רגוע לסיום זמן מסך לשבוע הזה."),
  },

  // ── Eating & Growing ─────────────────────────────────────────────────────
  {
    id: "division-of-responsibility",
    category: "eating",
    domains: ["independence_adaptive_skills", "ecosystem_stressors"],
    ageMin: 1,
    ageMax: 10,
    minutes: 4,
    title: L("You decide what, they decide how much", "אתם קובעים מה, הם קובעים כמה"),
    hook: L("The most-recommended feeding framework splits the job in two — and ends most table battles by ending the tug-of-war itself.", "מסגרת ההאכלה המומלצת ביותר מחלקת את העבודה לשניים — ומסיימת את רוב קרבות השולחן בכך שהיא מסיימת את משיכת החבל עצמה."),
    keyPoints: [
      L("The division of responsibility: parents own what, when and where food is served; the child owns whether and how much to eat.", "חלוקת האחריות: ההורים אחראים על מה, מתי ואיפה מוגש אוכל; הילד אחראי על האם וכמה לאכול."),
      L("Appetites in young children swing widely and normally — regulation happens across days, not per meal.", "התיאבון של ילדים צעירים מתנדנד חזק ובאופן תקין — הוויסות קורה על פני ימים, לא בכל ארוחה."),
      L("Pressure backfires in both directions: pushing bites teaches distrust of fullness; restricting treats inflates their glamour.", "לחץ פועל לרעה בשני הכיוונים: לדחוף ביסים מלמד חוסר אמון בשובע; להגביל ממתקים מנפח את הזוהר שלהם."),
      L("Structure does the quiet work: predictable meals and snacks at the table, water in between, no grazing economy to game.", "המבנה עושה את העבודה השקטה: ארוחות וחטיפים צפויים ליד השולחן, מים בין לבין, בלי כלכלת נשנושים שאפשר לתמרן."),
      L("Keep one 'safe' food on the table and let exposure work without commentary; tastes widen on their own timeline.", "השאירו מאכל 'בטוח' אחד על השולחן ותנו לחשיפה לעבוד בלי פרשנות; טעמים מתרחבים בקצב משלהם."),
    ],
    body: L(
      "Mealtime power struggles have a way of consuming family evenings: the negotiation, the airplane spoon, the two-more-bites treaty. Dietitian Ellyn Satter's division of responsibility — the framework most widely recommended by pediatric feeding professionals — dissolves the struggle by splitting the job cleanly. Parents decide what food is offered, when, and where. Children decide whether to eat it and how much. Each side owns their half completely, and neither crosses the line.\n\nThe framework works because it matches the biology. Young children's appetites fluctuate dramatically and normally — growth comes in bursts, and intake self-balances across days in ways that look chaotic meal to meal. A child permitted to eat two bites at dinner without commentary, knowing the next meal arrives predictably, keeps their internal fullness signals intact. A child pressured past those signals learns to distrust them; research links pressure to eat with more pickiness and poorer self-regulation later, and heavy restriction of desirable foods with stronger craving for exactly those foods.\n\nYour half of the deal has real teeth. Structure — meals and sit-down snacks at predictable times, water between, no wandering grazing — is what makes the child's autonomy safe. Skipping dinner has gentle natural consequences when breakfast reliably comes; it has none in a house where crackers float freely at all hours. Include one thing the child usually accepts alongside whatever the family eats, and your job at the table shrinks to pleasant company.\n\nThe hardest part is the silence: no praising bites, no scoring plates, no dessert diplomacy. It feels passive for a few weeks, and then the table gets calmer — because the tug-of-war needed two hands on the rope, and you put yours down.",
      "מאבקי כוח סביב האוכל יודעים לבלוע ערבים שלמים: המשא ומתן, כפית האווירון, הסכם שני־הביסים. חלוקת האחריות של הדיאטנית אלין סאטר — המסגרת המומלצת ביותר על ידי אנשי מקצוע בתחום האכלת ילדים — ממוססת את המאבק בחלוקה נקייה של העבודה. ההורים מחליטים איזה אוכל מוגש, מתי ואיפה. הילדים מחליטים אם לאכול וכמה. כל צד מחזיק בחצי שלו במלואו, ואף אחד לא חוצה את הקו.\n\nהמסגרת עובדת כי היא תואמת את הביולוגיה. התיאבון של ילדים צעירים מתנדנד באופן דרמטי ותקין — הגדילה באה בפרצים, והצריכה מאזנת את עצמה על פני ימים בדרכים שנראות כאוטיות מארוחה לארוחה. ילד שמותר לו לאכול שני ביסים בערב בלי פרשנות, בידיעה שהארוחה הבאה תגיע בזמן צפוי, שומר על אותות השובע הפנימיים שלו. ילד שנדחף מעבר לאותות האלה לומד לא לסמוך עליהם; מחקרים קושרים לחץ לאכול עם יותר בררנות וויסות חלש יותר בהמשך, והגבלה כבדה של מאכלים נחשקים — עם חשק גדול יותר לאותם מאכלים בדיוק.\n\nלחצי שלכם יש שיניים אמיתיות. מבנה — ארוחות וחטיפים בישיבה בזמנים צפויים, מים בין לבין, בלי רעייה חופשית — הוא מה שהופך את האוטונומיה של הילד לבטוחה. לדלג על ארוחת ערב יש השלכות טבעיות עדינות כשארוחת בוקר מגיעה באמינות; אין לזה שום השלכות בבית שבו קרקרים מרחפים חופשי בכל שעה. כללו דבר אחד שהילד בדרך כלל מקבל לצד מה שהמשפחה אוכלת, והתפקיד שלכם ליד השולחן מצטמצם לחברה נעימה.\n\nהחלק הקשה הוא השתיקה: בלי לשבח ביסים, בלי לנקד צלחות, בלי דיפלומטיית קינוחים. זה מרגיש פסיבי כמה שבועות, ואז השולחן נרגע — כי משיכת החבל הצריכה שתי ידיים על החבל, ואתם הנחתם את שלכם."
    ),
    tryToday: L(
      "At dinner tonight, serve one safe food with the meal, then say nothing about amounts — not one bite-count. Notice how the table feels without the rope.",
      "בארוחת הערב, הגישו מאכל בטוח אחד לצד הארוחה, ואז אל תגידו דבר על כמויות — אף ספירת ביסים. שימו לב איך השולחן מרגיש בלי החבל."
    ),
    ask: L("How do I set up meal structure so the division of responsibility works?", "איך לבנות מבנה ארוחות כך שחלוקת האחריות תעבוד?"),
  },
  {
    id: "picky-eating-arc",
    category: "eating",
    domains: ["independence_adaptive_skills"],
    ageMin: 1,
    ageMax: 6,
    minutes: 4,
    title: L("Picky eating: the normal arc and the long game", "אכילה בררנית: המסלול הרגיל והמשחק הארוך"),
    hook: L("The toddler who ate everything now eats beige. This arc is so common it has a biology — and a patient playbook.", "הפעוט שאכל הכול אוכל עכשיו רק בז'. המסלול הזה כל כך שכיח שיש לו ביולוגיה — וגם תוכנית משחק סבלנית."),
    keyPoints: [
      L("Food neophobia — wariness of new foods — typically rises sharply around age two and eases through the school years. It's developmental, not defiance.", "נאופוביית מזון — חשדנות כלפי אוכל חדש — מזנקת בדרך כלל סביב גיל שנתיים ומתמתנת לקראת בית הספר. זה התפתחותי, לא התרסה."),
      L("Acceptance is a numbers game: a new food can take 10-15 relaxed exposures; most families stop offering after two or three.", "קבלה היא משחק מספרים: מאכל חדש יכול לדרוש 10–15 חשיפות רגועות; רוב המשפחות מפסיקות להגיש אחרי שתיים־שלוש."),
      L("Exposure counts without eating: seeing, smelling, touching, helping cook — every contact lowers the strangeness.", "חשיפה נספרת גם בלי אכילה: לראות, להריח, לגעת, לעזור לבשל — כל מגע מפחית את הזרות."),
      L("Pressure, bribes and applause all raise the stakes; the fastest route to a taste is a table where tasting is unremarkable.", "לחץ, שוחד ומחיאות כפיים מעלים את ההימור; הדרך המהירה לטעימה היא שולחן שבו טעימה היא לא־אירוע."),
      L("Watch the pattern, not the plate: energy, growth and variety-across-weeks tell the story. A shrinking food list or mealtime distress is professional-conversation territory.", "צפו בדפוס, לא בצלחת: אנרגיה, גדילה ומגוון לאורך שבועות מספרים את הסיפור. רשימת מאכלים שמתכווצת או מצוקה בארוחות הן טריטוריה לשיחה מקצועית."),
    ],
    body: L(
      "Somewhere around the second birthday, a switch flips: the baby who gummed salmon and spinach becomes a toddler with a five-item menu and strong opinions about sauce placement. Parents often read this as something gone wrong. Feeding research reads it as schedule: food neophobia — hesitancy toward unfamiliar foods — climbs steeply in the toddler years and recedes gradually with age and exposure.\n\nAgainst that backdrop, the numbers matter enormously. Studies of repeated exposure find children may need ten to fifteen encounters with a food before accepting it — while most caregivers, understandably, retire a rejected food after two or three attempts. The gap between how long acceptance takes and how long families persist is where much 'pickiness' lives. And exposure is broader than eating: a cherry tomato that gets grown, washed, rolled, smelled and abandoned on the plate edge has still moved closer to familiar. Cooking together is exposure. Serving family-style, where the child spoons their own, is exposure.\n\nWhat slows the arc down is pressure, in all its friendly costumes — the cheering, the one-bite rules, the dessert treaties. Each raises the emotional stakes of tasting, and wariness feeds on stakes. The evidence-aligned posture is almost anticlimactic: keep offering variety alongside a safe food, model eating it yourself with visible enjoyment, and let tasting be boring.\n\nZoom out for the real signal. Over weeks — not meals — is the child energetic, growing, eating from a few food groups? That pattern is reassuring even when Tuesday was pure crackers. The patterns worth bringing to a professional look different: an accepted-foods list that keeps shrinking, whole food groups gone, distress at meals, or growth concerns. For everyone else, the long game wins — usually sometime around the moment you stop watching for it.",
      "אי שם סביב יום ההולדת השני מתהפך מתג: התינוק שגרס סלמון ותרד הופך לפעוט עם תפריט של חמישה פריטים ודעות נחרצות על מיקום הרוטב. הורים קוראים את זה לעתים כמשהו שהשתבש. מחקר ההאכלה קורא את זה כלוח זמנים: נאופוביית מזון — היסוס כלפי מאכלים לא מוכרים — מטפסת בחדות בשנות הפעוטות ונסוגה בהדרגה עם גיל וחשיפה.\n\nעל הרקע הזה, המספרים חשובים מאוד. מחקרי חשיפה חוזרת מוצאים שילדים עשויים להזדקק לעשרה עד חמישה־עשר מפגשים עם מאכל לפני קבלה — בעוד רוב ההורים, באופן מובן, גונזים מאכל שנדחה אחרי שניים־שלושה ניסיונות. הפער בין כמה זמן קבלה דורשת לכמה זמן משפחות מתמידות — שם גרה הרבה 'בררנות'. וחשיפה רחבה מאכילה: עגבניית שרי שגודלה, נשטפה, גולגלה, הורחה וננטשה בקצה הצלחת — עדיין התקרבה למוכר. בישול משותף הוא חשיפה. הגשה משפחתית, שבה הילד מעביר לעצמו, היא חשיפה.\n\nמה שמאט את המסלול הוא לחץ, על כל תחפושותיו הידידותיות — העידוד, חוקי הביס־האחד, הסכמי הקינוח. כל אחד מהם מעלה את ההימור הרגשי של הטעימה, וחשדנות ניזונה מהימורים. העמדה שתואמת את הראיות כמעט אנטי־קליימקטית: המשיכו להציע מגוון לצד מאכל בטוח, אכלו אותו בעצמכם בהנאה גלויה, ותנו לטעימה להיות משעממת.\n\nהתרחקו לתמונה הרחבה בשביל האות האמיתי. על פני שבועות — לא ארוחות — האם הילד אנרגטי, גדל, אוכל מכמה קבוצות מזון? הדפוס הזה מרגיע גם כשיום שלישי היה קרקרים בלבד. הדפוסים ששווה להביא לאיש מקצוע נראים אחרת: רשימת מאכלים שממשיכה להתכווץ, קבוצות מזון שלמות שנעלמו, מצוקה בארוחות, או דאגות גדילה. לכל השאר — המשחק הארוך מנצח, בדרך כלל בערך ברגע שמפסיקים לחכות לזה."
    ),
    tryToday: L(
      "Pick one rejected vegetable and give it a no-pressure cameo three times this week: on the table, in the shopping bag they carry, in a dish they help stir.",
      "בחרו ירק דחוי אחד ותנו לו הופעת אורח בלי לחץ שלוש פעמים השבוע: על השולחן, בשקית הקניות שהם סוחבים, בתבשיל שהם עוזרים לערבב."
    ),
    ask: L("Track this with me: which foods has my child been exposed to lately, and what should rotate in next?", "עקוב איתי: לאילו מאכלים הילד נחשף לאחרונה, ומה כדאי לסבב פנימה עכשיו?"),
  },

  // ── Body & Motion ────────────────────────────────────────────────────────
  {
    id: "motor-range",
    category: "motion",
    domains: ["sensory_motor_patterns"],
    ageMin: 0,
    ageMax: 2,
    minutes: 3,
    title: L("Walking at 9 months or 17: how wide motor-normal really is", "ללכת ב־9 חודשים או ב־17: כמה רחב באמת הטווח המוטורי"),
    hook: L("Motor milestones have some of the widest healthy ranges in development — and the order matters less than the momentum.", "לאבני דרך מוטוריות יש מהטווחים הבריאים הרחבים ביותר בהתפתחות — והסדר חשוב פחות מהתנופה."),
    keyPoints: [
      L("Independent walking anywhere from about 9 to 17 months sits within typical development; the WHO's own studies span that range.", "הליכה עצמאית בין בערך 9 ל־17 חודשים נמצאת בתוך התפתחות טיפוסית; מחקרי ארגון הבריאות העולמי עצמם מקיפים את הטווח הזה."),
      L("Sequences vary too: some babies skip crawling entirely, bottom-shuffle or roll — and walk on time anyway.", "גם הרצפים משתנים: יש תינוקות שמדלגים על זחילה לגמרי, מחליקים על הישבן או מתגלגלים — והולכים בזמן בכל זאת."),
      L("Practice opportunity beats equipment: floor time, safe furniture to cruise, bare feet. Containers (seats, walkers) subtract practice.", "הזדמנות לתרגול מנצחת ציוד: זמן רצפה, רהיטים בטוחים להיתלות בהם, רגליים יחפות. 'מכלים' (סלקלים, הליכונים) מחסירים תרגול."),
      L("Watch momentum and symmetry rather than dates: steady gains, both sides used alike.", "צפו בתנופה ובסימטריה במקום בתאריכים: התקדמות עקבית, שני צדדים פועלים דומה."),
      L("Worth a professional conversation: months without new motor ground, a strong one-sided preference in the first year, lost skills, or marked floppiness/stiffness.", "שווה שיחה מקצועית: חודשים בלי התקדמות מוטורית, העדפת צד חזקה בשנה הראשונה, אובדן מיומנויות, או רפיסות/נוקשות בולטת."),
    ],
    body: L(
      "At a first-birthday party, one guest toddles importantly across the room while another — same age — has never taken a step and is happily demolishing a cushion tower on all fours. Both grandmothers have opinions. Development science mostly doesn't: gross-motor milestones carry some of the widest normal windows in all of early childhood, and walking is the famous one. Large multi-country studies place independent walking anywhere from around nine months to about seventeen, with the median near twelve or thirteen — and age of first steps within that band tells you essentially nothing about later athleticism or intelligence.\n\nThe route varies as much as the timing. The tidy textbook sequence — roll, sit, crawl, cruise, walk — is a common path, not a required one. A meaningful share of babies never crawl on hands and knees: they shuffle on their bottoms, commando-drag, or simply stand up one day. Skipped stages on the way to working skills are style, not shortfall.\n\nWhat genuinely helps is unglamorous: opportunity. Floor time in open space, things worth reaching for, sturdy furniture at pulling height, bare feet on varied surfaces. The main modern obstacle is well-meaning containment — swings, seats, walkers and other holders that subtract exactly the floor practice motor development runs on. Short stints are life; hours are lost training time.\n\nInstead of dates, watch two quieter signals. Momentum: over months, is there steady new ground — stronger, more mobile, more coordinated? And symmetry: both arms and legs recruited about equally (a strong hand preference in the first year is worth mentioning to your doctor). Long plateaus, lost skills, or notable floppiness or stiffness are likewise bring-to-the-professional observations — described, as always, in whens and whats rather than labels. For everyone else: clear the floor, take off the socks, and let the cushion tower fall.",
      "במסיבת יום הולדת שנה, אורח אחד מדדה בחשיבות לרוחב הסלון בעוד אחר — באותו גיל — מעולם לא עשה צעד ומפרק בשמחה מגדל כריות על ארבע. לשתי הסבתות יש דעות. למדע ההתפתחות לרוב אין: אבני דרך מוטוריות גסות נושאות מהחלונות התקינים הרחבים ביותר בילדות המוקדמת, והליכה היא המפורסמת שבהן. מחקרים רב־מדינתיים גדולים ממקמים הליכה עצמאית בין בערך תשעה חודשים לשבעה־עשר, עם חציון סביב שנים־עשר או שלושה־עשר — וגיל הצעד הראשון בתוך הרצועה הזאת לא אומר למעשה דבר על ספורטיביות או אינטליגנציה בהמשך.\n\nהמסלול משתנה לא פחות מהתזמון. הרצף הספרי המסודר — גלגול, ישיבה, זחילה, הליכה לאורך רהיטים, הליכה — הוא דרך שכיחה, לא דרך חובה. חלק ניכר מהתינוקות לא זוחלים על ארבע מעולם: הם מחליקים על הישבן, זוחלים זחילת קומנדו, או פשוט קמים יום אחד. שלבים שדולגו בדרך למיומנויות עובדות הם סגנון, לא חסר.\n\nמה שבאמת עוזר הוא לא זוהר: הזדמנות. זמן רצפה במרחב פתוח, דברים ששווה להושיט אליהם יד, רהיטים יציבים בגובה משיכה, רגליים יחפות על משטחים מגוונים. המכשול המודרני העיקרי הוא הכלה מתוך כוונה טובה — נדנדות, סלקלים, הליכונים ושאר מחזיקים שמחסירים בדיוק את תרגול הרצפה שההתפתחות המוטורית רצה עליו. פרקי זמן קצרים הם החיים; שעות הן זמן אימון אבוד.\n\nבמקום תאריכים, צפו בשני אותות שקטים. תנופה: על פני חודשים, האם יש קרקע חדשה בעקביות — חזק יותר, נייד יותר, מתואם יותר? וסימטריה: שתי הידיים והרגליים מגויסות בערך שווה (העדפת יד חזקה בשנה הראשונה שווה אזכור לרופא). רמות ממושכות, מיומנויות שאבדו, או רפיסות/נוקשות בולטת הן גם תצפיות להביא לאיש מקצוע — מתוארות, כתמיד, במתי ומה ולא בתוויות. לכל השאר: פנו את הרצפה, הורידו את הגרביים, ותנו למגדל הכריות ליפול."
    ),
    tryToday: L(
      "Clear one safe floor zone, socks off, favorite object just out of reach. Twenty container-free minutes is a full motor workout at any pre-walking stage.",
      "פנו אזור רצפה בטוח אחד, גרביים בחוץ, חפץ אהוב קצת מעבר להישג יד. עשרים דקות בלי 'מכלים' הן אימון מוטורי מלא בכל שלב טרום־הליכה."
    ),
    ask: L("What floor-time setups fit my baby's current motor stage?", "אילו סידורי זמן־רצפה מתאימים לשלב המוטורי הנוכחי של התינוק שלי?"),
  },
  {
    id: "risky-play",
    category: "motion",
    domains: ["sensory_motor_patterns", "independence_adaptive_skills"],
    ageMin: 2,
    ageMax: 10,
    minutes: 4,
    title: L("Risky play: what climbing high actually builds", "משחק נועז: מה טיפוס גבוה באמת בונה"),
    hook: L("Children seek thrilling play on purpose — and the research keeps finding that the payoff is judgment, confidence and fewer fears.", "ילדים מחפשים משחק מסעיר בכוונה — והמחקר מוצא שוב ושוב שהתמורה היא שיקול דעת, ביטחון ופחות פחדים."),
    keyPoints: [
      L("Height, speed, rough-and-tumble, tools, wandering-from-adult: children gravitate to graded thrills across all cultures — it looks like a designed feature of development.", "גובה, מהירות, השתוללות, כלים, התרחקות מהמבוגר: ילדים נמשכים לריגושים מדורגים בכל התרבויות — זה נראה כמו תכונה מתוכננת של ההתפתחות."),
      L("Self-directed risk is calibrated: children given freedom typically inch upward in challenge, training judgment with each rung.", "סיכון בהכוונה עצמית הוא מכויל: ילדים שמקבלים חופש מטפסים באתגר סנטימטר־סנטימטר, ומאמנים שיקול דעת בכל שלב."),
      L("Overprotection has a cost: research associates thwarted risky play with more anxiety and less physical confidence, not more safety.", "להגנת־יתר יש מחיר: המחקר קושר משחק נועז שנחסם ליותר חרדה ופחות ביטחון גופני — לא ליותר בטיחות."),
      L("The professional distinction is hazard vs. risk: remove what the child can't perceive (broken glass, traffic); keep what they can size up (height, wobble).", "ההבחנה המקצועית היא מפגע מול סיכון: הסירו את מה שהילד לא יכול לזהות (זכוכית, כביש); השאירו את מה שהוא יכול לשקול (גובה, נדנוד)."),
      L("Swap 'be careful!' for information: 'that branch is thinner — test it before you trust it.'", "החליפו את \"זהירות!\" במידע: \"הענף הזה דק יותר — תבדוק אותו לפני שאתה סומך עליו.\""),
    ],
    body: L(
      "Watch children loose on a good playground and a pattern emerges: they find the edge of what they can do, and play exactly there. A rung higher than last week. A bit faster down the hill. Researchers who study play describe six recurring flavors of 'risky play' — heights, speed, rough-and-tumble, tools, elements like water and fire, and roaming out of adult sight — and find children seeking them everywhere on earth. When something shows up that universally, development is usually using it for something.\n\nThe going theory is elegant: thrilling play is exposure therapy run by the child. Approaching a fear in careful, self-chosen doses — a little higher, a little faster — teaches both the skill and the emotional regulation for the situation. Children granted this practice tend toward better risk judgment and physical confidence; studies link blocked risky play with more anxiety, not less injury. There's an ironic corollary on equipment: surfaces and structures engineered to feel perfectly safe invite children to find their thrill in ways designers never planned.\n\nNone of this means standing back from real danger. The field's key distinction is between hazards — dangers a child cannot perceive or assess, like traffic, broken glass, water they can drown in unclocked — and risks, challenges they can see and size up, like height, wobble and speed. The adult job is removing hazards and then, harder, tolerating risks. A child mid-climb is usually running a careful calculation; the evidence-aligned move is to let the calculation finish rather than interrupt it with a shouted 'careful!', which mostly teaches that your judgment replaces theirs.\n\nWhen you do speak, give data instead of alarm: 'those rocks are slippery when wet'; 'test the branch before you trust it.' And when they come down glowing — that glow is the point. It's what earned confidence looks like at age five.",
      "צפו בילדים משוחררים בגן שעשועים טוב ודפוס עולה: הם מוצאים את קצה היכולת שלהם, ומשחקים בדיוק שם. שלב אחד גבוה יותר משבוע שעבר. קצת יותר מהר במורד. חוקרי משחק מתארים שישה טעמים חוזרים של 'משחק נועז' — גבהים, מהירות, השתוללות, כלים, איתני טבע כמו מים ואש, ושוטטות מחוץ לטווח ראיית המבוגר — ומוצאים ילדים מחפשים אותם בכל מקום על פני כדור הארץ. כשמשהו מופיע באוניברסליות כזאת, ההתפתחות בדרך כלל משתמשת בו למשהו.\n\nהתיאוריה המקובלת אלגנטית: משחק מסעיר הוא טיפול בחשיפה שהילד מנהל בעצמו. התקרבות לפחד במנות זהירות שנבחרו עצמאית — קצת יותר גבוה, קצת יותר מהר — מלמדת גם את המיומנות וגם את הוויסות הרגשי למצב. ילדים שמקבלים את התרגול הזה נוטים לשיקול סיכונים וביטחון גופני טובים יותר; מחקרים קושרים משחק נועז שנחסם ליותר חרדה, לא לפחות פציעות. יש מסקנה אירונית לגבי מתקנים: משטחים ומבנים שהונדסו להרגיש בטוחים לחלוטין מזמינים ילדים למצוא את הריגוש שלהם בדרכים שהמתכננים לא חלמו עליהן.\n\nכל זה לא אומר לעמוד מנגד מול סכנה אמיתית. ההבחנה המרכזית בתחום היא בין מפגעים — סכנות שילד לא יכול לזהות או להעריך, כמו תנועה, זכוכית שבורה, מים שאפשר לטבוע בהם בלי השגחה — לבין סיכונים, אתגרים שהוא רואה ויכול לשקול, כמו גובה, נדנוד ומהירות. תפקיד המבוגר הוא להסיר מפגעים ואז, הקשה מכול, לסבול סיכונים. ילד באמצע טיפוס מריץ בדרך כלל חישוב זהיר; המהלך שתואם את הראיות הוא לתת לחישוב להסתיים במקום לקטוע אותו ב\"זהירות!\" צעקני, שבעיקר מלמד שהשיפוט שלכם מחליף את שלו.\n\nכשאתם כן מדברים, תנו נתונים במקום אזעקה: \"הסלעים האלה חלקים כשהם רטובים\"; \"תבדוק את הענף לפני שאתה סומך עליו.\" וכשהם יורדים זוהרים — הזוהר הוא הנקודה. כך נראה ביטחון שהורווח ביושר בגיל חמש."
    ),
    tryToday: L(
      "At the playground, run one experiment: when you feel 'be careful!' rising, swap it for information or silence, and let one climb finish on its own terms.",
      "בגן השעשועים, הריצו ניסוי אחד: כשאתם מרגישים את ה\"זהירות!\" עולה, החליפו אותו במידע או בשתיקה, ותנו לטיפוס אחד להסתיים בתנאיו שלו."
    ),
    ask: L("Help me tell hazards from healthy risks for my child's age.", "עזור לי להבחין בין מפגעים לסיכונים בריאים בגיל של הילד שלי."),
  },

  // ── The Parent ───────────────────────────────────────────────────────────
  {
    id: "good-enough-parent",
    category: "parent",
    domains: ["attachment_regulation", "ecosystem_stressors"],
    ageMin: 0,
    ageMax: 12,
    minutes: 4,
    title: L("The good-enough parent: why imperfection is the design", "ההורה הטוב־דיו: למה חוסר שלמות הוא התכנון"),
    hook: L("Attunement research has a startling headline: ordinary, flawed, repairing parents are not falling short of the ideal. They are the ideal.", "למחקר ההתכווננות יש כותרת מפתיעה: הורים רגילים, לא מושלמים, שמתקנים — אינם נופלים מהאידיאל. הם האידיאל."),
    keyPoints: [
      L("'Good enough' is a serious clinical concept (Winnicott), not a consolation prize: children need reliable-enough care, not perfect care.", "'טוב דיו' הוא מושג קליני רציני (ויניקוט), לא פרס ניחומים: ילדים זקוקים לטיפול אמין־דיו, לא מושלם."),
      L("Interaction studies find even well-attuned parent-infant pairs are 'in sync' a minority of the time; what distinguishes strong pairs is repair, not attunement rate.", "מחקרי אינטראקציה מוצאים שגם צמדי הורה־תינוק מכווננים היטב מסונכרנים מיעוט מהזמן; מה שמבחין צמדים חזקים הוא התיקון, לא אחוז ההתכווננות."),
      L("Rupture-and-repair cycles are the actual curriculum: manageable misses, reliably mended, teach that relationships survive stress.", "מחזורי קרע־ותיקון הם תוכנית הלימודים האמיתית: החמצות נסבלות שמתוקנות באמינות מלמדות שקשרים שורדים לחץ."),
      L("A parent chasing perfection often becomes anxious and self-monitoring — states children read fluently and absorb.", "הורה שרודף שלמות נעשה לא פעם חרד ועסוק בעצמו — מצבים שילדים קוראים שוטף וסופגים."),
      L("Apologizing to a child after you lose it isn't undermining authority; it's a live demonstration of accountability.", "להתנצל בפני ילד אחרי שהתפרצתם אינו ערעור סמכות; זו הדגמה חיה של אחריות."),
    ],
    body: L(
      "The pediatrician and psychoanalyst Donald Winnicott, after watching thousands of mothers and babies, landed on a phrase that has comforted and confused parents ever since: the good-enough mother. His claim was not that mediocrity is acceptable. It was sharper: that the ordinary devoted parent — attentive, fallible, gradually less instantly available — is precisely what a developing child needs, and that a hypothetical perfect parent would actually serve the child worse.\n\nModern interaction research backs the intuition with numbers. Frame-by-frame studies of parent-infant pairs find that even sensitive, connected dyads are truly 'matched' a minority of their time together; they drift out of sync constantly and — this is the finding that matters — come back. The repair is the event the child's system learns from. A miss that gets mended teaches: disconnection is temporary, distress is survivable, people return. Run thousands of times, that lesson becomes the deep settings of a child's relational world.\n\nThis reframes the bad moments that haunt parents. The snapped word, the distracted afternoon, the bedtime you rushed — followed by reconnection, these aren't scratches on a perfect record. They are the record: manageable doses of rupture with reliable repair. Which makes the repair itself worth doing well: 'I yelled. That must have felt scary. I'm sorry — let's try again' is a complete masterclass in accountability, delivered in fifteen seconds.\n\nThere's also an oxygen-mask clause. Perfectionist parenting runs on vigilance, and vigilance is expensive; children are exquisite readers of a parent's state, and an anxious, self-monitoring adult teaches its own lesson. Tending your own steadiness — rest, help, forgiveness for Tuesday — is not time stolen from the child. It's maintenance on the instrument they regulate against. Aim for reliable, warm and repairing. That target, unlike perfect, is reachable — and it is, by the evidence, the better one.",
      "רופא הילדים והפסיכואנליטיקאי דונלד ויניקוט, אחרי שצפה באלפי אימהות ותינוקות, טבע ביטוי שמנחם ומבלבל הורים מאז: האם הטובה־דיה. טענתו לא הייתה שבינוניות מקובלת. היא הייתה חדה יותר: שההורה המסור הרגיל — קשוב, טועה, זמין פחות ופחות באופן מיידי — הוא בדיוק מה שילד מתפתח צריך, ושהורה מושלם היפותטי היה משרת את הילד דווקא פחות טוב.\n\nמחקר האינטראקציה המודרני מגבה את האינטואיציה במספרים. מחקרים פריים־אחר־פריים של צמדי הורה־תינוק מוצאים שגם צמדים רגישים ומחוברים 'תואמים' באמת מיעוט מזמנם יחד; הם יוצאים מסנכרון כל הזמן ו— זה הממצא שחשוב — חוזרים. התיקון הוא האירוע שמערכת הילד לומדת ממנו. החמצה שמתוקנת מלמדת: נתק הוא זמני, מצוקה שרידה, אנשים חוזרים. אחרי אלפי חזרות, השיעור הזה נעשה הגדרות העומק של עולמו הקשרי של הילד.\n\nזה ממסגר מחדש את הרגעים הרעים שרודפים הורים. המילה שנפלטה, אחר הצהריים המפוזר, ההשכבה שמיהרתם בה — כשאחריהם חיבור מחודש, אלה אינם שריטות על תקליט מושלם. אלה התקליט: מנות נסבלות של קרע עם תיקון אמין. ולכן שווה לעשות את התיקון עצמו היטב: \"צעקתי. זה בטח הפחיד. סליחה — בוא ננסה שוב\" הוא שיעור מלא באחריות, בחמש־עשרה שניות.\n\nיש גם סעיף מסכת־חמצן. הורות פרפקציוניסטית רצה על דריכות, ודריכות יקרה; ילדים הם קוראים מעולים של מצב ההורה, ומבוגר חרד שמפקח על עצמו מלמד שיעור משלו. טיפוח היציבות שלכם — מנוחה, עזרה, סליחה על יום שלישי — אינו זמן שנגנב מהילד. זו תחזוקה של הכלי שהוא מווסת מולו. כוונו לאמין, חם ומתקן. היעד הזה, בניגוד למושלם, בר־השגה — ולפי הראיות, הוא גם הטוב יותר."
    ),
    tryToday: L(
      "Next time you snap, run the 15-second repair once the storm passes: name it, own it, reconnect. One honest repair outweighs an hour of guilt.",
      "בפעם הבאה שתתפרצו, הריצו את תיקון 15 השניות אחרי שהסערה חולפת: תנו שם, קחו אחריות, התחברו מחדש. תיקון כן אחד שוקל יותר משעה של אשמה."
    ),
    ask: L("Help me build a short repair script for after I lose my patience.", "עזור לי לבנות תסריט תיקון קצר לאחרי שאני מאבד סבלנות."),
  },
  {
    id: "calm-contagious",
    category: "parent",
    domains: ["attachment_regulation", "ecosystem_stressors"],
    ageMin: 0,
    ageMax: 12,
    minutes: 3,
    title: L("Your calm is contagious (so is your stress)", "הרוגע שלכם מדבק (וגם הלחץ)"),
    hook: L("Children don't just hear your words — their nervous systems tune to yours. Which makes your own regulation a parenting tool, not a luxury.", "ילדים לא רק שומעים את המילים שלכם — מערכת העצבים שלהם מתכווננת לשלכם. ולכן הוויסות שלכם הוא כלי הורות, לא מותרות."),
    keyPoints: [
      L("Emotional states transmit: studies find infants' stress physiology shifts to track their parent's within minutes of reunion.", "מצבים רגשיים עוברים: מחקרים מוצאים שהפיזיולוגיה של תינוקות משתנה בעקבות זו של ההורה בתוך דקות מהמפגש."),
      L("This is the machinery of co-regulation — children borrow the nearest adult's state long before they can generate calm alone.", "זו המכניקה של ויסות משותף — ילדים שואלים את מצבו של המבוגר הקרוב הרבה לפני שהם מסוגלים לייצר רוגע לבד."),
      L("In hot moments, regulating yourself first isn't selfish sequencing; it's the only order that works.", "ברגעים חמים, לווסת את עצמכם קודם אינו סדר אנוכי; זה הסדר היחיד שעובד."),
      L("Small tools count: one slow exhale, dropped shoulders, a lower and slower voice — children read the body more than the script.", "כלים קטנים נחשבים: נשיפה איטית אחת, כתפיים שצונחות, קול נמוך ואיטי — ילדים קוראים את הגוף יותר מהתסריט."),
      L("Chronic parental depletion is a family-level signal worth acting on — support for you is support for the child.", "שחיקה הורית מתמשכת היא אות ברמת המשפחה ששווה לפעול עליו — תמיכה בכם היא תמיכה בילד."),
    ],
    body: L(
      "Every parent has lived the experiment: you walk in the door wound tight from the day, and within minutes the whole house is somehow tighter — the toddler whinier, the bedtime rockier. It isn't imagination. In laboratory studies, parents were stressed in a separate room and then reunited with their babies; the infants' heart-rate patterns shifted measurably toward their parent's stressed profile within minutes, without a harsh word spoken. Nervous systems in close relationships listen to each other directly — through face, voice, muscle tone, pace.\n\nFor children this open channel is not a bug. It's how regulation gets installed. Long before a child can settle themselves, they settle by proximity to someone settled: the biology of co-regulation. But the channel carries whatever is actually there. A parent saying calm words over a clenched jaw transmits the jaw. In a heated moment, the honest sequence is to reach for your own steadiness first — one long exhale, shoulders down, voice slower and lower — and only then reach for the child. Those seconds aren't a delay in the parenting; they are the parenting.\n\nTwo honest footnotes. First, this is about patterns, not moments: a stressed day in a mostly-steady home teaches resilience, especially when it ends in repair. Children need to see feelings managed, not absent. Second, chronic depletion can't be breathed away. If you are running empty for weeks — rage close to the surface, sleep wrecked, joy gone — that is not a personal failing to hide but a family-level signal to act on: share the load, claim rest, talk to someone. The steadiest gift you can hand a child is a nervous system that has itself been cared for. Start there, without guilt. It was never a detour from the job; it is the job.",
      "כל הורה חי את הניסוי: אתם נכנסים הביתה מתוחים מהיום, ובתוך דקות כל הבית איכשהו מתוח יותר — הפעוט בכיין יותר, ההשכבה סוערת יותר. זה לא דמיון. במחקרי מעבדה, הורים עברו לחץ בחדר נפרד ואוחדו עם תינוקותיהם; דפוסי הדופק של התינוקות זזו באופן מדיד לעבר הפרופיל הלחוץ של ההורה בתוך דקות, בלי שנאמרה מילה קשה. מערכות עצבים בקשר קרוב מקשיבות זו לזו ישירות — דרך פנים, קול, מתח שרירים, קצב.\n\nעבור ילדים הערוץ הפתוח הזה אינו תקלה. כך ויסות מותקן. הרבה לפני שילד מסוגל להרגיע את עצמו, הוא נרגע דרך קרבה למישהו רגוע: הביולוגיה של ויסות משותף. אבל הערוץ נושא את מה שבאמת נמצא שם. הורה שאומר מילים רגועות מעל לסת קפוצה משדר את הלסת. ברגע חם, הרצף הכן הוא להושיט יד קודם ליציבות שלכם — נשיפה ארוכה אחת, כתפיים למטה, קול איטי ונמוך יותר — ורק אז להושיט יד לילד. השניות האלה אינן עיכוב בהורות; הן ההורות.\n\nשתי הערות כנות. ראשית, מדובר בדפוסים, לא ברגעים: יום לחוץ בבית יציב־בדרך־כלל מלמד חוסן, במיוחד כשהוא נגמר בתיקון. ילדים צריכים לראות רגשות מנוהלים, לא נעדרים. שנית, שחיקה כרונית אי אפשר לנשוף החוצה. אם אתם רצים על ריק שבועות — הזעם קרוב לפני השטח, השינה הרוסה, השמחה נעלמה — זה לא כישלון אישי להסתיר אלא אות משפחתי לפעול עליו: חלקו את העומס, תבעו מנוחה, דברו עם מישהו. המתנה היציבה ביותר שאפשר לתת לילד היא מערכת עצבים שטופלה בעצמה. התחילו שם, בלי אשמה. זו מעולם לא הייתה סטייה מהתפקיד; זה התפקיד."
    ),
    tryToday: L(
      "Install one threshold ritual: before walking in the door (or into a hard moment), one long exhale and shoulders down. Ten seconds, every time, same trigger.",
      "התקינו טקס סף אחד: לפני הכניסה הביתה (או לרגע קשה), נשיפה ארוכה אחת וכתפיים למטה. עשר שניות, כל פעם, אותו טריגר."
    ),
    ask: L("What's a realistic way to refill my own tank this month?", "מהי דרך ריאלית למלא את המצברים שלי החודש?"),
  },
];

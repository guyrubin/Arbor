/**
 * "Abram's Long Road" — B-BOOK-02: the proof book of the new kid library, as
 * data. Source of record: execution/2026-10-06--kids-books/lane-A-story-craft.md
 * §6 (manuscript, slots, plate ledger) and §6.2 (parent panel), with lane A's
 * own C8 fix applied: "Abram is waiting." / "אברם מחכה." is cut from p7b's
 * before-text (it stays in the picture only).
 *
 * Every Hebrew line is "native review owed" (lane A §3.10). Choice labels are
 * Hebrew infinitives, so one label serves both genders. The choice `type` is
 * for critics only and is never rendered. Slots are exactly as written in §6.1
 * (pose · x,y feet anchor · scale · z · facing); `facing` is resolved from the
 * manuscript's direction words (sprites are authored facing right). Two values
 * are the builder's, not the manuscript's: every `phoneCrop` (the 3:4 window
 * centre, chosen to hold the slot; the layout function guarantees it) and
 * p7b's `heroAfter` (the hero runs out of the barley toward the road).
 */
import type { Book, Page } from "../types";

const BOOK_ID = "abrams-long-road";

const cover: Page = {
  id: "cover",
  plateId: "P3",
  phoneCrop: 0.36,
  hero: { pose: "walk", x: 0.3, y: 0.88, scale: 0.4, facing: "right", z: "fr" },
  text: {
    en: `A long road, four little goats, and a land nobody has seen.`,
    he: {
      m: `דרך ארוכה, ארבעה גדיים, וארץ שאיש עוד לא ראה.`,
      f: `דרך ארוכה, ארבעה גדיים, וארץ שאיש עוד לא ראה.`,
    },
  },
};

const p1: Page = {
  id: "p1",
  plateId: "P1e",
  phoneCrop: 0.5,
  hero: { pose: "run", x: 0.55, y: 0.86, scale: 0.34, facing: "left", z: "fr" },
  text: {
    en: `In Haran, by the old well, {hero} swings in the fig tree. {hero} races a best friend to the water. At night, the tent is warm. Every day is the same, until one night…`,
    he: {
      m: `בחרן, ליד הבאר הישנה, {hero} מתנדנד בנדנדה של עץ התאנה. {hero} מתחרה עם החבר הכי טוב עד המים. בלילה, האוהל חמים. כל יום הוא אותו יום, עד לילה אחד…`,
      f: `בחרן, ליד הבאר הישנה, {hero} מתנדנדת בנדנדה של עץ התאנה. {hero} מתחרה עם החבר הכי טוב עד המים. בלילה, האוהל חמים. כל יום הוא אותו יום, עד לילה אחד…`,
    },
  },
};

const p2: Page = {
  id: "p2",
  plateId: "P2",
  phoneCrop: 0.25,
  hero: { pose: "stand", x: 0.18, y: 0.94, scale: 0.48, facing: "right", z: "fg" },
  text: {
    en: `{hero} peeks out of the tent. Old Abram stands under the stars, very still, listening. And God says to Abram: “Go. Go from your land, from your home, from your father's house, to the land that I will show you.”`,
    he: {
      m: `{hero} מציץ מן האוהל. אברם הזקן עומד תחת הכוכבים, דומם, מקשיב. ואלוהים אומר לאברם: "לֶךְ־לְךָ מֵאַרְצְךָ וּמִמּוֹלַדְתְּךָ וּמִבֵּית אָבִיךָ, אֶל־הָאָרֶץ אֲשֶׁר אַרְאֶךָּ."`,
      f: `{hero} מציצה מן האוהל. אברם הזקן עומד תחת הכוכבים, דומם, מקשיב. ואלוהים אומר לאברם: "לֶךְ־לְךָ מֵאַרְצְךָ וּמִמּוֹלַדְתְּךָ וּמִבֵּית אָבִיךָ, אֶל־הָאָרֶץ אֲשֶׁר אַרְאֶךָּ."`,
    },
  },
};

const p3: Page = {
  id: "p3",
  plateId: "P1m",
  phoneCrop: 0.36,
  hero: { pose: "wave", x: 0.4, y: 0.9, scale: 0.36, facing: "left", z: "fr" },
  text: {
    en: `In the morning, everyone packs. Abram rolls up the tent. Sarai bakes bread. Lot loads the camels. {hero} counts the little goats: one, two, three, four. “You lead them,” says Abram. “If the goats don't go, nobody goes.”`,
    he: {
      m: `בבוקר, כולם אורזים. אברם מקפל את האוהל. שרי אופה לחם. לוט מעמיס את הגמלים. {hero} סופר את הגדיים: אחד, שניים, שלושה, ארבעה. "אתה תוביל אותם," אומר אברם. "אם הגדיים לא הולכים, אף אחד לא הולך."`,
      f: `בבוקר, כולם אורזים. אברם מקפל את האוהל. שרי אופה לחם. לוט מעמיס את הגמלים. {hero} סופרת את הגדיים: אחד, שניים, שלושה, ארבעה. "את תובילי אותם," אומר אברם. "אם הגדיים לא הולכים, אף אחד לא הולך."`,
    },
  },
};

const p4: Page = {
  id: "p4",
  plateId: "P1m",
  phoneCrop: 0.45,
  hero: { pose: "stand", x: 0.5, y: 0.92, scale: 0.44, facing: "right", z: "fr" },
  text: {
    en: `But {hero}'s best friend is not packing. “My family is staying,” says the friend. “Stay too! Who will race me to the well?” {hero} turns to the well. {hero} turns to the long road. Where is the land? Nobody knows.`,
    he: {
      m: `אבל החבר הכי טוב של {hero} לא אורז. "המשפחה שלי נשארת," אומר החבר. "תישאר גם אתה! עם מי אתחרה עד הבאר?" {hero} מסתובב אל הבאר. {hero} מסתובב אל הדרך הארוכה. איפה הארץ? אף אחד לא יודע.`,
      f: `אבל החבר הכי טוב של {hero} לא אורז. "המשפחה שלי נשארת," אומר החבר. "תישארי גם את! עם מי אתחרה עד הבאר?" {hero} מסתובבת אל הבאר. {hero} מסתובבת אל הדרך הארוכה. איפה הארץ? אף אחד לא יודע.`,
    },
  },
};

const p5: Page = {
  id: "p5",
  plateId: "P1m",
  phoneCrop: 0.5,
  hero: { pose: "stand", x: 0.48, y: 0.92, scale: 0.4, facing: "right", z: "fr" },
  text: {
    en: `The camels are ready. Abram and Sarai are ready. The little goats look up at {hero}: maa? If the goats don't go, nobody goes. What will {hero} do?`,
    he: {
      m: `הגמלים מוכנים. אברם ושרי מוכנים. הגדיים מרימים עיניים אל {hero}: מֶהֶה? אם הגדיים לא הולכים, אף אחד לא הולך. מה {hero} יעשה?`,
      f: `הגמלים מוכנים. אברם ושרי מוכנים. הגדיים מרימים עיניים אל {hero}: מֶהֶה? אם הגדיים לא הולכים, אף אחד לא הולך. מה {hero} תעשה?`,
    },
  },
};

// ── Branch A — HARD: "Say goodbye and go" ─────────────────────────────────────
const p6a: Page = {
  id: "p6a",
  plateId: "P1m",
  phoneCrop: 0.55,
  hero: { pose: "wave", x: 0.62, y: 0.9, scale: 0.38, facing: "left", z: "fr" },
  text: {
    en: `{hero} waves to the best friend. “Goodbye! Goodbye!” {hero} walks, and looks back, and walks. The well is a tiny dot now. It is hard to leave. The little goats trot behind: tip, tap, tip.`,
    he: {
      m: `{hero} מנופף לחבר הכי טוב. "שלום! שלום!" {hero} הולך, ומביט אחורה, והולך. עכשיו הבאר היא נקודה קטנטנה. קשה לעזוב. הגדיים מקפצים מאחור: טיפ, טאפ, טיפ.`,
      f: `{hero} מנופפת לחבר הכי טוב. "שלום! שלום!" {hero} הולכת, ומביטה אחורה, והולכת. עכשיו הבאר היא נקודה קטנטנה. קשה לעזוב. הגדיים מקפצים מאחור: טיפ, טאפ, טיפ.`,
    },
  },
};

const p7a: Page = {
  id: "p7a",
  plateId: "P3",
  phoneCrop: 0.38,
  hero: { pose: "walk", x: 0.28, y: 0.88, scale: 0.36, facing: "right", z: "fr" },
  text: {
    en: `And because the goats go, everyone goes: camels, donkeys, Abram, Sarai, Lot. {hero} leads them out in the cool morning. Step, and step, and step. Is this the land? Not yet.`,
    he: {
      m: `ומפני שהגדיים הולכים, כולם הולכים: גמלים, חמורים, אברם, שרי ולוט. {hero} מוביל אותם בבוקר הקריר. צעד, ועוד צעד, ועוד צעד. הזאת הארץ? עוד לא.`,
      f: `ומפני שהגדיים הולכים, כולם הולכים: גמלים, חמורים, אברם, שרי ולוט. {hero} מובילה אותם בבוקר הקריר. צעד, ועוד צעד, ועוד צעד. הזאת הארץ? עוד לא.`,
    },
  },
};

// ── Branch B — EASY: "One more race first" ────────────────────────────────────
const p6bHe = `{hero} מתחרה עם החבר הכי טוב עד הבאר. עוד מרוץ אחד! למעלה בדרך, השיירה עומדת בשמש החמה. אם הגדיים לא הולכים, אף אחד לא הולך. והגדיים נכנסים לשדה השעורים: כְּרְס, כְּרְס.`;
const p6b: Page = {
  id: "p6b",
  plateId: "P1b",
  phoneCrop: 0.42,
  hero: { pose: "run", x: 0.35, y: 0.88, scale: 0.34, facing: "left", z: "fr" },
  text: {
    en: `{hero} races the best friend to the well. One more race! Up on the road, the line stands still in the hot sun. If the goats don't go, nobody goes. And the little goats wander into the barley: munch, munch.`,
    // Lane A: HE-f is identical in spelling (מתחרה m/f differ only in nikud).
    he: { m: p6bHe, f: p6bHe },
  },
};

const p7b: Page = {
  id: "p7b",
  plateId: "P1b",
  phoneCrop: 0.62,
  hero: { pose: "run", x: 0.58, y: 0.9, scale: 0.4, facing: "left", z: "fg" },
  // C8 fix: "Abram is waiting." is cut (it stays in the picture only).
  text: {
    en: `{hero} stops. Everyone is waiting.`,
    he: { m: `{hero} נעצר. כולם מחכים.`, f: `{hero} נעצרת. כולם מחכים.` },
  },
  actionTap: {
    label: { en: `Bring the goats!`, he: `להביא את הגדיים!` },
    textAfter: {
      en: `{hero} runs into the barley. “Come, goats, come!” One, two, three, four. Now the line can go. The sun is high, the road is hot. They start late.`,
      he: {
        m: `{hero} רץ לתוך השעורים. "בואו, גדיים, בואו!" אחד, שניים, שלושה, ארבעה. עכשיו השיירה יכולה לצאת. השמש כבר גבוהה, הדרך חמה. הם יוצאים מאוחר.`,
        f: `{hero} רצה לתוך השעורים. "בואו, גדיים, בואו!" אחד, שניים, שלושה, ארבעה. עכשיו השיירה יכולה לצאת. השמש כבר גבוהה, הדרך חמה. הם יוצאים מאוחר.`,
      },
    },
    heroAfter: { pose: "run", x: 0.72, y: 0.88, scale: 0.38, facing: "right", z: "fr" },
  },
};

// ── Branch C — THIRD: "Take all my treasures" ─────────────────────────────────
const p6c: Page = {
  id: "p6c",
  plateId: "P1c",
  phoneCrop: 0.45,
  hero: { pose: "arms-wide", x: 0.4, y: 0.9, scale: 0.38, facing: "right", z: "fr" },
  text: {
    en: `{hero} packs everything: the clay lion, the little drum, the shiny stones, the pillow, the big round pot. Up it goes, onto the little donkey. The donkey looks at the pile. The donkey sits down. Plop.`,
    he: {
      m: `{hero} אורז הכול: את אריה החימר, את התוף הקטן, את האבנים הנוצצות, את הכרית ואת הסיר העגול הגדול. הכול עולה על החמור הקטן. החמור מסתכל על הערימה. החמור מתיישב. פְּלוֹפּ.`,
      f: `{hero} אורזת הכול: את אריה החימר, את התוף הקטן, את האבנים הנוצצות, את הכרית ואת הסיר העגול הגדול. הכול עולה על החמור הקטן. החמור מסתכל על הערימה. החמור מתיישב. פְּלוֹפּ.`,
    },
  },
};

const p7c: Page = {
  id: "p7c",
  plateId: "P1c",
  phoneCrop: 0.55,
  hero: { pose: "wave", x: 0.55, y: 0.9, scale: 0.38, facing: "right", z: "fr" },
  text: {
    en: `{hero} takes just one thing: a smooth stone from the old well. The rest {hero} gives to the best friend, to keep. The donkey stands up. Hee-haw! The line can go, a little late. Step, and step, and step.`,
    he: {
      m: `{hero} לוקח רק דבר אחד: אבן חלקה מהבאר הישנה. את כל השאר {hero} נותן לחבר הכי טוב, שישמור. החמור קם. אִי־אָה! השיירה יוצאת, קצת באיחור. צעד, ועוד צעד, ועוד צעד.`,
      f: `{hero} לוקחת רק דבר אחד: אבן חלקה מהבאר הישנה. את כל השאר {hero} נותנת לחבר הכי טוב, שישמור. החמור קם. אִי־אָה! השיירה יוצאת, קצת באיחור. צעד, ועוד צעד, ועוד צעד.`,
    },
  },
};

// ── Rejoin and ending ─────────────────────────────────────────────────────────
const p8: Page = {
  id: "p8",
  plateId: "P4",
  phoneCrop: 0.42,
  hero: { pose: "arms-wide", x: 0.45, y: 0.8, scale: 0.34, facing: "left", z: "fr" },
  text: {
    en: `At the great river, the littlest goat stops. Maa! Is this the land? Not yet. {hero} steps onto the first stone, arms out wide. “Step where I step.” Step, step, step, across!`,
    he: {
      m: `ליד הנהר הגדול, הגדי הקטן ביותר נעצר. מֶהֶה! הזאת הארץ? עוד לא. {hero} עולה על האבן הראשונה, ידיים פרושות: "תדרוך איפה שאני דורך." צעד, צעד, צעד, ועברו!`,
      f: `ליד הנהר הגדול, הגדי הקטן ביותר נעצר. מֶהֶה! הזאת הארץ? עוד לא. {hero} עולה על האבן הראשונה, ידיים פרושות: "תדרוך איפה שאני דורכת." צעד, צעד, צעד, ועברו!`,
    },
  },
  echo: {
    a: { en: `Behind them, the morning is still cool.`, he: { m: `מאחוריהם, הבוקר עוד קריר.`, f: `מאחוריהם, הבוקר עוד קריר.` } },
    b: { en: `The sun is hot on {hero}'s neck.`, he: { m: `השמש חמה על העורף של {hero}.`, f: `השמש חמה על העורף של {hero}.` } },
    c: { en: `On the donkey's bag, the smooth stone glints.`, he: { m: `על התיק של החמור, האבן החלקה נוצצת.`, f: `על התיק של החמור, האבן החלקה נוצצת.` } },
  },
};

const p9: Page = {
  id: "p9",
  plateId: "P5",
  phoneCrop: 0.58,
  hero: { pose: "run", x: 0.6, y: 0.72, scale: 0.28, facing: "right", z: "fr" },
  text: {
    en: `Many days later, they climb a hill with a great oak. {hero} runs up first. Below: a green land. God says to Abram: “To your children I will give this land.” Is this the land? Yes. This is the land.`,
    he: {
      m: `ימים רבים אחר כך, הם מטפסים על גבעה עם אלון גדול. {hero} רץ ראשון למעלה. למטה: ארץ ירוקה. ואלוהים אומר לאברם: "לְזַרְעֲךָ אֶתֵּן אֶת־הָאָרֶץ הַזֹּאת." הזאת הארץ? כן. זאת הארץ.`,
      f: `ימים רבים אחר כך, הם מטפסים על גבעה עם אלון גדול. {hero} רצה ראשונה למעלה. למטה: ארץ ירוקה. ואלוהים אומר לאברם: "לְזַרְעֲךָ אֶתֵּן אֶת־הָאָרֶץ הַזֹּאת." הזאת הארץ? כן. זאת הארץ.`,
    },
  },
};

const p10: Page = {
  id: "p10",
  plateId: "P6",
  phoneCrop: 0.5,
  hero: { pose: "sit", x: 0.52, y: 0.9, scale: 0.36, facing: "right", z: "fr" },
  text: {
    en: `Under the oak, Abram builds an altar of stones. The tent goes up again. {hero} sits at the tent door with Bun. New land, new stars, the same warm tent.`,
    he: {
      m: `תחת האלון, אברם בונה מזבח מאבנים. האוהל עולה שוב. {hero} יושב בפתח האוהל עם ארנבוני. ארץ חדשה, כוכבים חדשים, אותו אוהל חמים.`,
      f: `תחת האלון, אברם בונה מזבח מאבנים. האוהל עולה שוב. {hero} יושבת בפתח האוהל עם ארנבוני. ארץ חדשה, כוכבים חדשים, אותו אוהל חמים.`,
    },
  },
  echo: {
    a: { en: `{hero} thinks of the old well, and smiles.`, he: { m: `{hero} נזכר בבאר הישנה, ומחייך.`, f: `{hero} נזכרת בבאר הישנה, ומחייכת.` } },
    b: { en: `The long, hot day is done.`, he: { m: `היום הארוך והחם נגמר.`, f: `היום הארוך והחם נגמר.` } },
    c: { en: `By the door: the stone from Haran.`, he: { m: `ליד הפתח: האבן מחרן.`, f: `ליד הפתח: האבן מחרן.` } },
  },
  closing: { en: `Goodnight.`, he: { m: `לילה טוב.`, f: `לילה טוב.` } },
};

export const abramsLongRoad: Book = {
  id: BOOK_ID,
  title: { en: `Abram's Long Road`, he: `לֶךְ לְךָ — הדרך הארוכה של אברם` },
  coverLine: {
    en: `A long road, four little goats, and a land nobody has seen.`,
    he: `דרך ארוכה, ארבעה גדיים, וארץ שאיש עוד לא ראה.`,
  },
  sourceRef: "Genesis 12:1-9",
  knowledge:
    "A good life sometimes asks you to leave the comfortable and familiar for a good you cannot yet see, and to carry your own part so everyone can go.",
  childRole: "COMPANION — one of \"the souls that they had gotten in Haran\" (Gen 12:5); leads the little goats.",
  additions: [
    "the hero",
    "the four goats",
    "the best friend at the well (Nahor's household stays in Haran, Gen 11:31-32, 24:10)",
    "the treasures and the donkey",
    "the river crossing (tradition: Abram \"from the other side of the river\", Josh 24:3)",
  ],
  ageBand: "4-7",
  cover,
  pages: [p1, p2, p3, p4, p5, p8, p9, p10],
  decision: {
    pageId: "p5",
    choices: [
      { id: "a", type: "hard", label: { en: `Say goodbye and go`, he: `להיפרד וללכת` }, icon: "waving_hand", branch: [p6a, p7a] },
      { id: "b", type: "easy", label: { en: `One more race first`, he: `לרוץ עוד מרוץ אחד` }, icon: "directions_run", branch: [p6b, p7b] },
      { id: "c", type: "third", label: { en: `Take all my treasures`, he: `לקחת את כל האוצרות` }, icon: "backpack", branch: [p6c, p7c] },
    ],
  },
  rejoinPageId: "p8",
  parent: {
    builds: {
      en: `Leaving the familiar for a good you cannot yet see, and carrying your own part so everyone can go.`,
      he: `לעזוב את המוכר לטובת משהו טוב שעוד לא רואים, ולשאת את החלק שלך, כדי שכולם יוכלו ללכת.`,
    },
    why: {
      en: `Abram's story is told as Genesis tells it. Beside him, your child makes a smaller choice of the same kind: each road costs something, and each reaches the land.`,
      he: `הסיפור של אברם מסופר כמו בבראשית. לצידו, ילדכם בוחר בחירה קטנה מאותו סוג: לכל דרך יש מחיר, וכל דרך מגיעה אל הארץ.`,
    },
    askAfter: {
      en: `What did {hero} leave behind, and what did {hero} take?`,
      he: { m: `מה {hero} השאיר מאחור, ומה {hero} לקח?`, f: `מה {hero} השאירה מאחור, ומה {hero} לקחה?` },
    },
    askAfterOptional: {
      en: `If we moved far away, what one thing would you take?`,
      he: { m: `אם היינו עוברים רחוק, איזה דבר אחד היית לוקח?`, f: `אם היינו עוברים רחוק, איזה דבר אחד היית לוקחת?` },
    },
    sourceNote: {
      en: `Genesis 12:1–9. The words of God are the Bible's own (12:1, 12:7). Added to the story: {hero}, the goats, the best friend, the treasures and the river crossing.`,
      he: `בראשית יב, א–ט. דברי אלוהים הם לשון המקרא (יב, א; יב, ז). נוספו לסיפור: {hero}, הגדיים, החבר מהבאר, האוצרות ומעבר הנהר.`,
    },
  },
};

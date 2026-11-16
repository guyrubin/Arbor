/** Weather Maker words. Hebrew is gender-free: nouns, plural verbs and
 * infinitives only (the friends are told through their things, never a
 * gendered verb). `title`, `description` and `instruction` are the Studio
 * tile and intro card (studioCopy reads them); the rest is the game's own.
 * It is a make-believe machine and says so: nothing suggests that a real dial
 * changes the seasons. `phases` follow seasonDialRules `phaseAt`, in order;
 * `asks` and `nudges` follow seasonDialPlay. Blanks are filled by
 * `seasonLine` (seasonDialRules). Coach lines are Aya's, eight words or fewer. */
export const SEASON_DIAL_COPY = {
  en: {
    title: 'Weather Maker', description: 'A pretend machine that turns the year over Horizon Valley.',
    instruction: 'On the Sky Gardens terrace, turn the big brass dial and watch the valley and the old apple tree go through the year: blossom, sunshine, falling leaves and snow.',
    place: 'Sky Gardens · the high terrace',
    seasons: ['Spring', 'Summer', 'Autumn', 'Winter'],
    phases: [
      'Late winter. Buds on the branches.', 'Spring. The apple tree is in blossom. Aya has a seedling.', 'Spring rain. New leaves are growing. GobGob is out in the yellow jacket.',
      'Summer. Green leaves and little apples. Chock stands in the shade.', 'Late summer. The leaves begin to change.', 'Autumn. Gold and red leaves. Pep is nosing through them.',
      'Autumn wind. The leaves are falling.', 'Winter. Snow on the branches and on the valley. Bebe stands by the snow friend.',
    ],
    dial: 'The season dial', scene: 'The apple tree on the Sky Gardens terrace',
    aya: 'Aya', lab: 'Aya’s LeafLab',
    labMoisture: ['dry soil', 'damp soil', 'wet soil'], labLight: ['dim light', 'soft light', 'bright light'], labWarmth: ['cold air', 'mild air', 'warm air'],
    wants: 'The seedling asks for {0}.',
    chapters: ['Meet the four seasons', 'Grow Aya’s seedling', 'Conduct a whole year'],
    quarters: ['First quarter', 'Second quarter', 'Third quarter', 'Fourth quarter'],
    steps: ['First leaf', 'Bud', 'Flower'],
    hello: 'Welcome to the terrace! Turn the brass dial.',
    meet: ['Spring! Tap the blossom.', 'Summer! Shake an apple down.', 'Autumn! Swipe to blow the leaves.', 'Winter! Brush the snow off the wall.'],
    keepTurning: 'Turn the dial to meet every season.',
    metAll: 'You met the whole year!',
    seedling: 'My seedling needs help. Watch LeafLab.',
    asks: { springShower: 'It asks for a mild rain shower.', summerSun: 'It asks for summer sun on damp soil.', mildDay: 'It asks for a mild, soft day.', winterRest: 'It asks for a cold, dim rest.', warmDrink: 'It asks for a long, warm drink.', dryBask: 'It asks for hot sun and dry soil.' },
    nudges: {
      moistureUp: 'More water. Tap a cloud for rain.', moistureDown: 'Too wet. Swipe the clouds off and wait.', lightUp: 'More light. Swipe the clouds away.',
      lightDown: 'Softer light. Tap the clouds together.', warmthUp: 'Warmer. Turn the dial toward summer.', warmthDown: 'Cooler. Turn the dial toward winter.',
    },
    hold: 'Just right! Hold it there.', grew: 'It grew!', bloomed: 'It bloomed! Thank you.',
    conduct: 'Now conduct a year. Turn all the way round.', conducting: 'Keep turning. The year is singing.',
    rest: 'Stop on the season you love best.', playYear: 'Play my year',
    film: 'Your year over Horizon Valley', filmEnd: '{0} at golden hour',
    rainMade: 'You made it rain!', snowMade: 'You made it snow!', blown: 'Whoosh! The clouds are leaving.', rainbow: 'A rainbow! Sun and rain together.',
    echo: 'The mountain answered!', echoChip: 'Echo found',
    gather: 'Gather a rain cloud', shine: 'Let the sun out', shake: 'Shake the tree', blow: 'Blow the wind',
    friends: { ayaSpring: 'Aya with a seedling', ayaWinter: 'Aya in the snow', chockSummer: 'Chock in the shade', pepAutumn: 'Pep in the leaves', gobgobRain: 'GobGob in the rain', bebeSnow: 'Bebe by the snow friend', planter: 'Aya’s seedling' },
    lit: '{0} is on the dial.',
    finish: 'A whole year, conducted!', transfer: 'Away from the screen: look out of a window. Which season is it outside today?',
  },
  he: {
    title: 'מכונת מזג האוויר', description: 'מכונת דמיון שמסובבת את השנה מעל עמק האופק.',
    instruction: 'במרפסת של גני השמיים מסובבים את חוגת הפליז הגדולה ורואים איך העמק ועץ התפוח הזקן עוברים את כל השנה: פריחה, שמש, עלים נושרים ושלג.',
    place: 'גני השמיים · המרפסת הגבוהה',
    seasons: ['אביב', 'קיץ', 'סתיו', 'חורף'],
    phases: [
      'סוף החורף. ניצנים על הענפים.', 'אביב. עץ התפוח פורח. השתיל של איה מוכן.', 'גשם של אביב. עלים חדשים צומחים. המעיל הצהוב של גובגוב בחוץ.',
      'קיץ. עלים ירוקים ותפוחים קטנים. המקום של צ׳וק בצל.', 'סוף הקיץ. העלים מתחילים להחליף צבע.', 'סתיו. עלים בצבעי זהב ואדום. האף של פפ בין העלים.',
      'רוח של סתיו. העלים נושרים.', 'חורף. שלג על הענפים ועל העמק. המקום של בבה ליד בובת השלג.',
    ],
    dial: 'חוגת העונות', scene: 'עץ התפוח במרפסת של גני השמיים',
    aya: 'איה', lab: 'מעבדת העלים של איה',
    labMoisture: ['אדמה יבשה', 'אדמה לחה', 'אדמה רטובה'], labLight: ['אור עמום', 'אור רך', 'אור חזק'], labWarmth: ['אוויר קר', 'אוויר נעים', 'אוויר חם'],
    wants: 'השתיל מבקש {0}.',
    chapters: ['פוגשים את ארבע העונות', 'מגדלים את השתיל של איה', 'מנצחים על שנה שלמה'],
    quarters: ['רבע ראשון', 'רבע שני', 'רבע שלישי', 'רבע רביעי'],
    steps: ['עלה ראשון', 'ניצן', 'פרח'],
    hello: 'ברוכים הבאים למרפסת! מסובבים את החוגה.',
    meet: ['אביב! נוגעים בפריחה.', 'קיץ! מנערים תפוח מהעץ.', 'סתיו! מחליקים אצבע ומעיפים עלים.', 'חורף! מנקים את השלג מהמעקה.'],
    keepTurning: 'מסובבים את החוגה ופוגשים כל עונה.',
    metAll: 'פגשנו את כל השנה!',
    seedling: 'השתיל שלי צריך עזרה. מסתכלים במעבדת העלים.',
    asks: { springShower: 'השתיל מבקש גשם ביום נעים.', summerSun: 'השתיל מבקש שמש של קיץ ואדמה לחה.', mildDay: 'השתיל מבקש יום נעים ואור רך.', winterRest: 'השתיל מבקש מנוחה קרה ועמומה.', warmDrink: 'השתיל מבקש שתייה ארוכה ביום חם.', dryBask: 'השתיל מבקש שמש חמה ואדמה יבשה.' },
    nudges: {
      moistureUp: 'עוד מים. נוגעים בענן ויורד גשם.', moistureDown: 'רטוב מדי. מעיפים עננים ומחכים לשמש.', lightUp: 'עוד אור. מחליקים ומעיפים עננים.',
      lightDown: 'אור רך יותר. נוגעים בעננים.', warmthUp: 'חם יותר. מסובבים אל הקיץ.', warmthDown: 'קריר יותר. מסובבים אל החורף.',
    },
    hold: 'בדיוק ככה! מחזיקים רגע.', grew: 'השתיל גדל!', bloomed: 'השתיל פרח! תודה.',
    conduct: 'עכשיו מנצחים על שנה. מסובבים סיבוב שלם.', conducting: 'ממשיכים לסובב. השנה שרה.',
    rest: 'עוצרים על העונה הכי אהובה.', playYear: 'מקרינים את השנה',
    film: 'השנה שלנו מעל עמק האופק', filmEnd: '{0} בשעת הזהב',
    rainMade: 'ירד גשם בזכותנו!', snowMade: 'ירד שלג בזכותנו!', blown: 'וּוּש! העננים עוזבים.', rainbow: 'קשת בענן! שמש וגשם יחד.',
    echo: 'ההר ענה!', echoChip: 'מצאנו הד',
    gather: 'אוספים ענן גשם', shine: 'מוציאים את השמש', shake: 'מנערים את העץ', blow: 'מעיפים רוח',
    friends: { ayaSpring: 'איה עם שתיל', ayaWinter: 'איה בשלג', chockSummer: 'צ׳וק בצל', pepAutumn: 'פפ בין העלים', gobgobRain: 'גובגוב בגשם', bebeSnow: 'בבה ליד בובת השלג', planter: 'השתיל של איה' },
    lit: '{0} על החוגה.',
    finish: 'ניצחנו על שנה שלמה!', transfer: 'הרחק מהמסך: מסתכלים מהחלון. איזו עונה יש בחוץ היום?',
  },
} as const;
export type SeasonDialWords = typeof SEASON_DIAL_COPY['en'] | typeof SEASON_DIAL_COPY['he'];

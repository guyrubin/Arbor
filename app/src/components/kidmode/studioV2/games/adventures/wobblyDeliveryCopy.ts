import type { DeliveryItem } from './wobblyDeliveryRules';

/** Wobbly Delivery words. Hebrew is gender-free: nouns, plural verbs and
 * infinitives only. The friends never speak; their ears and tails show how
 * they feel. Lists of three follow the round order: Aya, Pep, Chock. */
export const WOBBLY_DELIVERY_COPY = {
  en: {
    hear: 'Hear it again',
    title: 'Wobbly Delivery', description: 'Listen. Remember. Deliver.', instruction: 'Listen to what a friend needs, then bring each thing in order.',
    ready: 'Three friends need a few things. Ready to listen?', start: 'Start',
    asks: ['Aya needs ', 'Pep needs ', 'Chock needs '], then: ', then ', stop: '.', listJoin: ', ',
    things: { 'item-can': 'the watering can', 'item-journal': 'the journal', 'item-band': 'the flower band', 'item-lamp': 'the lamp', 'item-cushion': 'the cushion', 'item-disc': 'the blue disc' },
    items: { 'item-can': 'Watering can', 'item-journal': 'Journal', 'item-band': 'Flower band', 'item-lamp': 'Lamp', 'item-cushion': 'Cushion', 'item-disc': 'Blue disc' },
    fetchFirst: ['What does Aya need first?', 'What does Pep need first?', 'What does Chock need first?'],
    fetchNext: 'What comes next?', fetchLast: 'One more thing. Which one?',
    notYet: 'Not that one yet. You can ask again.', askAgain: 'Ask again', goodAsking: 'Good asking.',
    thanks: ['Aya hops for joy. Everything is here.', 'Pep hops for joy. Everything is here.', 'Chock hops for joy. Everything is here.'],
    bloom: 'Every friend has what they need. The flower opens.',
    finishTitle: 'Delivered!', transfer: 'Try it for real: ask a grown-up for two things to bring, and carry them in order.',
    quiet: 'Sound is off. Watch the cards, then bring each thing in order.',
    shelf: 'The shelf', cards: 'What to bring, in order', card: 'Card', faceDown: 'face down', onRug: 'already on the rug',
    rug: ['Aya’s rug', 'Pep’s rug', 'Chock’s rug'], rugEmpty: 'nothing here yet',
  },
  he: {
    hear: 'לשמוע שוב',
    title: 'משלוח מתנדנד', description: 'מקשיבים. זוכרים. מביאים.', instruction: 'מקשיבים למה שחסר לחברים, ואז מביאים כל דבר לפי הסדר.',
    ready: 'שלושה חברים מחכים לכמה דברים. מוכנים להקשיב?', start: 'מתחילים',
    asks: ['מביאים לאיה ', 'מביאים לפפ ', 'מביאים לצ׳וק '], then: ', ואחר כך ', stop: '.', listJoin: ', ',
    things: { 'item-can': 'את המשפך', 'item-journal': 'את היומן', 'item-band': 'את צמיד הפרח', 'item-lamp': 'את המנורה', 'item-cushion': 'את הכרית', 'item-disc': 'את העיגול הכחול' },
    items: { 'item-can': 'משפך', 'item-journal': 'יומן', 'item-band': 'צמיד פרח', 'item-lamp': 'מנורה', 'item-cushion': 'כרית', 'item-disc': 'עיגול כחול' },
    fetchFirst: ['מה מביאים לאיה קודם?', 'מה מביאים לפפ קודם?', 'מה מביאים לצ׳וק קודם?'],
    fetchNext: 'מה מביאים עכשיו?', fetchLast: 'נשאר עוד דבר אחד. איזה?',
    notYet: 'עדיין לא זה. אפשר לשאול שוב.', askAgain: 'לשאול שוב', goodAsking: 'טוב ששואלים.',
    thanks: ['קפיצת שמחה של איה. הכול הגיע.', 'קפיצת שמחה של פפ. הכול הגיע.', 'קפיצת שמחה של צ׳וק. הכול הגיע.'],
    bloom: 'לכל החברים יש מה שהיה חסר. הפרח נפתח.',
    finishTitle: 'המשלוח הגיע!', transfer: 'מנסים באמת: מבקשים מאחד המבוגרים שני דברים להביא, ומביאים אותם לפי הסדר.',
    quiet: 'הצליל כבוי. מסתכלים בכרטיסים, ואז מביאים כל דבר לפי הסדר.',
    shelf: 'המדף', cards: 'מה מביאים, לפי הסדר', card: 'כרטיס', faceDown: 'הפוך', onRug: 'כבר על השטיח',
    rug: ['השטיח של איה', 'השטיח של פפ', 'השטיח של צ׳וק'], rugEmpty: 'עדיין ריק',
  },
} as const;
export type WobblyDeliveryWords = typeof WOBBLY_DELIVERY_COPY['en'] | typeof WOBBLY_DELIVERY_COPY['he'];

/** The whole request as one sentence, in the order to bring it. Built only
 * from the words above, so it reads the same on the heading and aloud. */
export function requestLine(words: WobblyDeliveryWords, friend: number, request: readonly DeliveryItem[]): string {
  return `${words.asks[friend]}${request.map(item => words.things[item]).join(words.then)}${words.stop}`;
}

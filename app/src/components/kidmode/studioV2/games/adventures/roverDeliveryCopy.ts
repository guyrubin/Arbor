/** Rover Delivery words. Hebrew is gender-free: nouns, plural verbs and
 * infinitives only. Pep never speaks; a happy hop shows the welcome.
 * The direction names and the parked lines are keyed by the codes of the
 * rules: the four headings of the board and the four ways a run can park.
 * `{0}` in a line is filled with one of the direction names. */
export const ROVER_DELIVERY_COPY = {
  en: {
    hear: 'Hear it again',
    title: 'Rover Delivery', description: 'Plan the way. Fix one thing.', instruction: 'Turn the signs so the rover reaches Pep, then press start.',
    plan: 'Turn the signs so the rover reaches Pep.', start: 'Start',
    drive: 'The rover is on its way.', parked: 'Change one thing, then press Start.', replan: 'Send the same rover again. Press Start.',
    arrived: 'The rover reached Pep. Pep hops for joy.',
    ends: {
      edge: 'The rover stopped at the edge. Which sign needs a turn?',
      planter: 'The rover stopped at the planter. Which sign needs a turn?',
      bloom: 'The rover stopped at the flower. Tap the flower to fold it down.',
      loop: 'The rover is going in circles. Turn one sign.',
    },
    directions: { n: 'up', e: 'right', s: 'down', w: 'left' },
    sign: 'Sign pointing {0}. Tap to turn.', signNow: 'The sign is pointing {0}.', hintHere: 'This one may need a change.',
    bloomOpen: 'Open flower. Tap to fold it down.', bloomFolded: 'Folded flower. Tap to open it.',
    bloomNowFolded: 'The flower is folded down. The way is clear.', bloomNowOpen: 'The flower is open again.',
    rover: 'The rover, facing {0}', goal: 'Pep’s rug', planter: 'Planter', startMat: 'The rover’s starting place', board: 'The play-room floor',
    finishTitle: 'Delivered!', transfer: 'Away from the screen: put paper arrows on the floor and drive a toy car to a teddy.',
  },
  he: {
    hear: 'לשמוע שוב',
    title: 'רובר המשלוחים', description: 'מתכננים דרך. מתקנים דבר אחד.', instruction: 'מסובבים את השלטים כדי שהרובר יגיע אל פפ, ואז יוצאים לדרך.',
    plan: 'מסובבים את השלטים כדי שהרובר יגיע אל פפ.', start: 'יוצאים לדרך',
    drive: 'הרובר בדרך.', parked: 'משנים דבר אחד ולוחצים על ״יוצאים לדרך״.', replan: 'שולחים שוב את אותו הרובר. לוחצים על ״יוצאים לדרך״.',
    arrived: 'הרובר הגיע אל פפ. פפ קופץ משמחה.',
    ends: {
      edge: 'הרובר נעצר בקצה הרצפה. איזה שלט צריך לסובב?',
      planter: 'הרובר נעצר ליד העציץ. איזה שלט צריך לסובב?',
      bloom: 'הרובר נעצר ליד הפרח. נוגעים בפרח כדי לקפל אותו.',
      loop: 'הרובר נוסע במעגלים. מסובבים שלט אחד.',
    },
    directions: { n: 'למעלה', e: 'ימינה', s: 'למטה', w: 'שמאלה' },
    sign: 'שלט שמצביע {0}. נוגעים כדי לסובב.', signNow: 'השלט מצביע {0}.', hintHere: 'אולי כאן צריך שינוי.',
    bloomOpen: 'פרח פתוח. נוגעים כדי לקפל אותו.', bloomFolded: 'פרח מקופל. נוגעים כדי לפתוח אותו.',
    bloomNowFolded: 'הפרח מקופל. הדרך פנויה.', bloomNowOpen: 'הפרח שוב פתוח.',
    rover: 'הרובר, פונה {0}', goal: 'השטיח של פפ', planter: 'עציץ', startMat: 'נקודת ההתחלה של הרובר', board: 'רצפת חדר המשחקים',
    finishTitle: 'המשלוח הגיע!', transfer: 'מחוץ למסך: מניחים חצים מנייר על הרצפה ומסיעים מכונית צעצוע אל דובי.',
  },
} as const;
export type RoverDeliveryWords = typeof ROVER_DELIVERY_COPY['en'] | typeof ROVER_DELIVERY_COPY['he'];

/** Fills `{0}` in a line from the words above. */
export function roverLine(template: string, ...values: readonly string[]): string {
  return template.replace(/\{(\d)\}/g, (_match, slot: string) => values[Number(slot)] ?? '');
}

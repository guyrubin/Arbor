/**
 * Prints Wobbly Delivery's voice lines (EN + HE, by clip id) as JSON, built
 * from the game's own copy, for scripts/render-delivery-voice.py:
 *   npx tsx scripts/delivery-voice-lines.mts > lines.json
 */
import { WOBBLY_DELIVERY_COPY } from "../src/components/kidmode/studioV2/games/adventures/wobblyDeliveryCopy";
import { voiceLines } from "../src/components/kidmode/studioV2/games/adventures/wobblyDeliveryVoice";

process.stdout.write(`${JSON.stringify({ en: voiceLines(WOBBLY_DELIVERY_COPY.en), he: voiceLines(WOBBLY_DELIVERY_COPY.he) }, null, 1)}\n`);

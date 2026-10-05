/**
 * B-PLAY-14 — "From today" on the Stories Tonight cover.
 *
 * The bedtime form + reader rendered inline on #/stories: the SAME body
 * #/bedtime-stories renders (BedtimeStoryBody), embedded — no page header, no
 * route stamps (the cover section is the module). Generate-and-discard is
 * unchanged: no story is persisted; "Good night" and "Keep what {name} said"
 * each write one parent moment through addMoment.
 */
import { BedtimeStoryBody } from "../tabs/BedtimeStoriesTab";

export default function TonightFromToday() {
  return (
    <div data-testid="stories-tonight-from-today">
      <BedtimeStoryBody embedded />
    </div>
  );
}

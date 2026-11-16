import { ArborMascot } from "../../ui/ArborMascot";
import { BopSprite } from "./games/adventures/BopArt";
import type { StudioGuideId } from "./studioGameVoice";

/** B-GAME-42: the game's own crew guide, cut out of the kit (never redrawn), with a
 *  speech bubble in that guide's voice. Sprout guides only the games Sprout is in. */
export function StudioGameGuide({ guide, name, line, celebrate = false }: { guide: StudioGuideId; name: string; line: string; celebrate?: boolean }) {
  return <div className="studio-game-guide" data-studio-guide={guide}>
    {/* A portrait badge: the kit's full-body cut-out, framed head and chest. */}
    <span className="studio-game-guide__face" data-celebrate={celebrate || undefined} aria-hidden="true">
      {guide === "sprout" ? <ArborMascot size={70} mood={celebrate ? "cheer" : "wave"} animate={false} />
        : <BopSprite name={`${guide}-idle`} className="studio-game-guide__crew" />}
    </span>
    <p className="studio-game-guide__bubble"><b>{name}</b>{line}</p>
  </div>;
}

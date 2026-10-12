/** F-TALK-2 — the floating post-capture strip is retired.
 *
 *  The v3 mock (L570-578) has no floating card after a capture: the offer
 *  lives in the capture sheet's saved state, whose "Talk it through" prefills
 *  the composer through seedCoach (source 'post-capture'), never a send.
 *  Shell still mounts this component because Shell belongs to the shell lane;
 *  until that lane drops the mount, it renders nothing. */
export default function PostCaptureCoachStrip() {
  return null;
}

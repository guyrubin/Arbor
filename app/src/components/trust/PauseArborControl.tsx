import { Icon } from "../ui/Icon";
import { fmtDay } from "../../lib/formatDate";
import { useArborPause } from "../../lib/pauseArborStore";
import type { PauseStretch } from "../../lib/pauseArbor";
import { useLanguage } from "../../context/LanguageContext";

const STRETCHES: { id: PauseStretch; label: string; hint: string; testId: string }[] = [
  { id: "this-weekend", label: "companion.pause.weekend", hint: "companion.pause.hint.weekend", testId: "pause-weekend" },
  { id: "seven-days", label: "companion.pause.week", hint: "companion.pause.hint.week", testId: "pause-week" },
  { id: "until-resume", label: "companion.pause.untilResume", hint: "companion.pause.hint.open", testId: "pause-until-resume" },
];

type Translate = (key: string, vars?: Record<string, string | number>) => string;

/** The settings control. Three quiet choices, or one Resume. Not three primaries. */
export function PauseArborView({
  t,
  paused,
  untilLine,
  onStart,
  onResume,
}: {
  t: Translate;
  paused: boolean;
  untilLine: string;
  onStart: (stretch: PauseStretch) => void;
  onResume: () => void;
}) {
  return (
    <div data-testid="settings-pause-arbor" className="flex flex-col gap-3">
      <div className="flex items-start gap-3 min-w-0">
        <span className="inline-flex items-center justify-center w-8 h-8 rounded-xl flex-shrink-0" style={{ background: "var(--arbor-clay-dim)", color: "var(--arbor-clay-deep)" }}>
          <Icon name="schedule" size={18} />
        </span>
        <div className="min-w-0">
          <p className="font-bold" style={{ color: "var(--arbor-ink)" }}>{t(paused ? "companion.pause.on" : "companion.pause.title")}</p>
          <p className="text-xs" style={{ color: "var(--arbor-muted)" }}>{paused ? untilLine : t("companion.pause.sub")}</p>
          {paused && <p className="text-xs mt-1" style={{ color: "var(--arbor-muted)" }}>{t("companion.pause.kept")}</p>}
        </div>
      </div>
      {paused ? (
        <button
          type="button"
          data-testid="pause-resume"
          onClick={onResume}
          className="self-start text-xs font-bold rounded-xl px-3 min-h-11"
          style={{ background: "var(--arbor-clay)", color: "var(--arbor-on-accent)" }}
        >
          {t("companion.pause.resume")}
        </button>
      ) : (
        <div role="group" aria-label={t("companion.pause.title")} className="flex flex-col gap-2">
          {STRETCHES.map((row) => (
            <button
              key={row.id}
              type="button"
              data-testid={row.testId}
              onClick={() => onStart(row.id)}
              className="flex min-h-11 w-full items-center justify-between gap-3 rounded-xl px-3 text-start text-xs font-bold"
              style={{ background: "var(--arbor-paper-deep)", color: "var(--arbor-ink)", border: "1px solid var(--arbor-rule)" }}
            >
              <span>{t(row.label)}</span>
              <span className="font-semibold" style={{ color: "var(--arbor-muted)" }}>{t(row.hint)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function PauseArborControl() {
  const pause = useArborPause();
  const { t, uiLang } = useLanguage();
  const untilLine = pause.record?.until
    ? t("companion.pause.until", { when: fmtDay(pause.record.until, uiLang) })
    : t("companion.pause.untilYou");
  return (
    <PauseArborView
      t={t}
      paused={pause.paused}
      untilLine={untilLine}
      onStart={pause.start}
      onResume={pause.resume}
    />
  );
}

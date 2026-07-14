import { Timer } from "lucide-react";

// Cue 편집 UI만 담당한다. 재생·저장 상태와 동기화는 App이 계속 소유한다.
export function CuePanel({
  t,
  total,
  cueText,
  seq,
  armed,
  tapCursor,
  tuneMode,
  tuneRepeat,
  playDisabled,
  tapOverflow,
  curFrom,
  curDest,
  cueRowsRef,
  onToggleRepeat,
  onEnterTune,
  onTap,
  onClear,
  onSetSequencePage,
  onSetCue,
  onNudgeCue,
  onNow,
  onRemove,
  onAdd,
}) {
  const pages = Array.from({ length: total }, (_, index) => index + 1);

  return (
    <div className="cuePanel">
      <div className="cueHead">
        <div className="cueDesc">
          {tuneMode ? t("cueDescTune") : t("cueDescNormal")}
        </div>
        <label className="switch-mini cueRepeatToggle" title={t("repeatToggleTitle")}>
          <input type="checkbox" checked={tuneRepeat} onChange={onToggleRepeat} />
          <span className="box"></span>
          <span>{t("repeatToggle")}</span>
        </label>
        <div className="cueActions">
          {!tuneMode && (
            <button
              id="tune-enter-button"
              className="btn small tonal tuneEnter"
              onClick={onEnterTune}
              disabled={playDisabled}
              title={playDisabled ? t("tuneEnterDisabledTitle") : t("tuneEnterTitle")}
            >
              <Timer size={14} /> {t("tuneEnter")}
            </button>
          )}
          <button className="btn ghost small" onClick={onClear}>
            {t("clearBtn")}
          </button>
        </div>
      </div>
      <div className="cueRows" ref={cueRowsRef}>
        {cueText.map((value, index) => (
          <div className={"cueRow" + (armed && index === tapCursor ? " hot" : "")} key={index}>
            <span className="cueLabel">
              {t("cuePagePrefix")}
              <select
                className="cueSel"
                value={seq[index] ?? 1}
                onChange={(event) => onSetSequencePage(index, +event.target.value)}
                aria-label={t("fromPageAria")}
              >
                {pages.map((page) => <option key={page} value={page}>{page}</option>)}
              </select>
              <span className="cueArrow">
                {seq[index + 1] != null && seq[index + 1] <= seq[index] ? "↩" : "→"}
              </span>
              <select
                className="cueSel"
                value={seq[index + 1] ?? Math.min((seq[index] || 1) + 1, total)}
                onChange={(event) => onSetSequencePage(index + 1, +event.target.value)}
                aria-label={t("toPageAria")}
              >
                {pages.map((page) => <option key={page} value={page}>{page}</option>)}
              </select>
              {t("cuePageSuffix")}
            </span>
            <input
              type="text"
              value={value}
              placeholder="0:00"
              onChange={(event) => onSetCue(index, event.target.value)}
            />
            {tuneMode ? (
              <span className="cueRowTools">
                <button className="btn ghost tiny" title={t("nudgeEarlier")} onClick={() => onNudgeCue(index, -0.5)}>−</button>
                <button className="btn ghost tiny" title={t("nudgeLater")} onClick={() => onNudgeCue(index, 0.5)}>＋</button>
              </span>
            ) : (
              <button className="btn ghost tiny" onClick={() => onNow(index)} disabled={!armed}>
                {t("nowBtn")}
              </button>
            )}
            <button
              className="cueDelBtn"
              onClick={() => onRemove(index)}
              title={t("delCueTitle")}
              aria-label={t("delCueAria", seq[index], seq[index + 1])}
            >
              ×
            </button>
          </div>
        ))}
        <button type="button" className="btn ghost small cueAdd" onClick={onAdd}>
          {t("addCue")}
        </button>
      </div>
    </div>
  );
}

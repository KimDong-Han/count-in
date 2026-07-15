import { Pause } from "lucide-react";

export function PlaybackOverlays({
  t,
  total,
  pendingTap,
  countText,
  tapOverflow,
  curFrom,
  curDest,
  formatCue,
  onCommitPending,
  onCancelPending,
  onCancelCountdown,
  playBlocked,
  onResumeBlocked,
}) {
  return (
    <>
      {pendingTap != null && (
        <div className="overlay show pickOverlay" role="dialog" aria-label={t("pickAria")}>
          <div className="pickCard">
            <div className="pickTime"><Pause size={12} /> {t("pickTime", formatCue(pendingTap.t))}</div>
            <div className="pickTitle">{t("pickTitle")}</div>
            {!tapOverflow && (
              <button className="btn pickNext" onClick={() => onCommitPending(null)}>
                {t("pickNext", curDest)}
              </button>
            )}
            <div className="pickPages" aria-label={t("pickPagesAria")}>
              {Array.from({ length: total }, (_, index) => index + 1).map((page) => (
                <button
                  key={page}
                  type="button"
                  className="tuneJumpBtn"
                  disabled={page === curFrom}
                  onClick={() => onCommitPending(page)}
                  title={t("pickPageTitle", page)}
                >
                  {page}
                </button>
              ))}
            </div>
            <button className="cancel" onClick={onCancelPending}>{t("pickCancel")}</button>
          </div>
        </div>
      )}

      {/* 자동재생 차단(주로 첫 방문): 탭 = 새 제스처라 확실히 재생됨 */}
      {playBlocked && (
        <div className="overlay show" role="alertdialog" aria-label={t("playBlockedHint")}>
          <div className="get-ready">{t("playBlockedHint")}</div>
          <button className="btn resumeBtn" onClick={onResumeBlocked}>
            ▶ {t("playBlockedBtn")}
          </button>
        </div>
      )}

      {countText != null && (
        <div className="overlay show" role="alertdialog" aria-label={t("countdownAria")} aria-live="assertive">
          <div className="get-ready">{t("getReady")}</div>
          {countText === "▶" ? (
            <div className="go">▶</div>
          ) : (
            <div className="count tick" key={countText}>{countText}</div>
          )}
          <button className="cancel" onClick={onCancelCountdown}>{t("cancel")}</button>
        </div>
      )}
    </>
  );
}

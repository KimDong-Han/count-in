// 공유 등록(POST)/수정(PATCH) 공통: 요청 body → preset 컬럼값 파싱·검증.
// 실패 시 { error }, 성공 시 { fields } 반환. (uploader·비번은 각 핸들러가 따로 처리)
export function parseShareFields(b) {
  const songName = (b.song_name ?? b.name ?? "").toString().trim();
  const singer = (b.singer ?? "").toString().trim();
  const ytbUrl = (b.ytb_url ?? b.url ?? "").toString().trim();
  if (!songName) return { error: "song_name required" };
  if (!singer) return { error: "singer required" };
  if (!ytbUrl) return { error: "ytb_url required" };

  const flipMode = (b.flip_mode ?? b.flipMode ?? "cue").toString();
  // interval 모드면 총 초. flip_sec 우선, 없으면 ivMin/ivSec로 환산.
  let flipSec = null;
  if (flipMode === "interval") {
    flipSec =
      b.flip_sec != null
        ? Number(b.flip_sec)
        : (Number(b.ivMin) || 0) * 60 + (Number(b.ivSec) || 0);
  }

  const cues = Array.isArray(b.cues) ? b.cues : [];
  const seq = Array.isArray(b.seq) ? b.seq : [];
  if (JSON.stringify({ cues, seq }).length > 100_000)
    return { error: "too large" };

  const totalPage = Number.isFinite(b.total_page)
    ? b.total_page
    : Number.isFinite(b.pageCount)
      ? b.pageCount
      : null;

  return {
    fields: {
      songName: songName.slice(0, 100),
      singer: singer.slice(0, 200),
      ytbUrl,
      flipMode,
      flipSec,
      cues,
      seq,
      totalPage,
    },
  };
}

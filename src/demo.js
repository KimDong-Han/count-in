// 내장 데모: 빈 화면의 "예제로 30초 체험" 버튼이 로드하는 예제 프리셋.
// PDF 원본은 scripts/demo-score.html — 문구 수정 후 Chrome으로 재생성:
//   chrome --headless --no-pdf-header-footer --print-to-pdf=public/demo.pdf scripts/demo-score.html
// PDF(public/demo.pdf)는 스스로 설명하는 3쪽 악보 — 페이지 글이 넘김을 예고하므로
// 반주가 무엇이든 고정 타이밍(0:12 → 0:24)으로 시연이 성립한다.
// 반주: 메이플스토리 BGM — 헤네시스 (임베드 허용 확인: oEmbed 200, 2026-07)
export const DEMO_PRESET = {
  id: "demo",
  name: "데모 · 헤네시스 BGM",
  url: "https://youtu.be/ChQZjVBJtWI",
  delay: 3,
  volume: 80,
  rate: 1,
  soundMode: "stick",
  flipMode: "cue",
  ivMin: 0,
  ivSec: 20,
  loopOn: false,
  preLoad: true,
  noWait: false,
  cues: ["0:12", "0:24"], // 1→2쪽, 2→3쪽 넘김 시각 (PDF 본문의 예고와 일치해야 함)
  seq: [1, 2, 3],
  pageCount: 3,
};

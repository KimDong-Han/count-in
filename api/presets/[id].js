import { neon } from "@neondatabase/serverless";

// 개별 공유 프리셋 조회 — 컬럼들을 앱이 아는 프리셋 객체로 재조립해서 반환.
// 프론트는 이 객체를 loadPreset()에 그대로 넘겨 적용한다.
// (배속·볼륨·대기·효과음 등 로컬 취향값은 공유 안 함 → loadPreset의 기본값이 채움)

// Vercel Neon 연동 env — 접두어(STORAGE 등) 유무에 상관없이 잡히도록 폴백
const DB_URL =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  process.env.STORAGE_DATABASE_URL ||
  process.env.STORAGE_POSTGRES_URL ||
  process.env.STORAGE_URL;
const sql = neon(DB_URL);

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") {
      res.setHeader("Allow", "GET");
      return res.status(405).json({ error: "method not allowed" });
    }
    const id = Number(req.query.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: "bad id" });
    const rows = await sql`
      SELECT song_name, ytb_url, flip_mode, flip_sec, cues, seq, total_page
      FROM preset
      WHERE preset_id = ${id} AND del_at IS NULL
      LIMIT 1`;
    if (!rows.length) return res.status(404).json({ error: "not found" });

    // 고른 횟수 +1 (인기순 정렬용)
    await sql`UPDATE preset SET select_count = select_count + 1 WHERE preset_id = ${id}`;

    const p = rows[0];
    const flipMode = p.flip_mode || "cue";
    const interval = flipMode === "interval" && p.flip_sec != null;
    const preset = {
      name: p.song_name,
      url: p.ytb_url,
      flipMode,
      // 총 초 → 분/초 환산
      ivMin: interval ? Math.floor(p.flip_sec / 60) : 0,
      ivSec: interval ? p.flip_sec % 60 : 20,
      cues: Array.isArray(p.cues) ? p.cues : [],
      seq: Array.isArray(p.seq) ? p.seq : [],
      pageCount: p.total_page,
    };
    return res.status(200).json(preset);
  } catch (e) {
    return res.status(500).json({ error: "server error" });
  }
}

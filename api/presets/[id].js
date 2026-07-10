import { neon } from "@neondatabase/serverless";
import { verifyPw } from "../../lib/pw.js";
import { parseShareFields } from "../../lib/preset.js";

// 개별 공유 프리셋: 조회(GET) · 수정(PATCH) · 삭제(DELETE) — 수정/삭제는 아이템 비번 필요
// GET은 컬럼을 앱 프리셋 객체로 재조립해 반환(loadPreset이 그대로 소비).
// (배속·볼륨·대기 등 로컬 취향값은 공유 안 함 → loadPreset 기본값이 채움)

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
    const id = Number(req.query.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: "bad id" });

    if (req.method === "GET") {
      const rows = await sql`
        SELECT song_name, singer, ytb_url, flip_mode, flip_sec, cues, seq, total_page
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
        singer: p.singer, // 수정 폼 프리필용 (loadPreset은 무시)
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
    }

    if (req.method === "PATCH") {
      const b = req.body || {};
      const pw = (b.uploader_pw ?? "").toString();
      if (!pw) return res.status(400).json({ error: "password required" });
      const parsed = parseShareFields(b);
      if (parsed.error)
        return res
          .status(parsed.error === "too large" ? 413 : 400)
          .json({ error: parsed.error });

      const rows = await sql`
        SELECT uploader_pw FROM preset
        WHERE preset_id = ${id} AND del_at IS NULL LIMIT 1`;
      if (!rows.length) return res.status(404).json({ error: "not found" });
      if (!verifyPw(pw, rows[0].uploader_pw))
        return res.status(403).json({ error: "wrong password" });

      // uploader·uploader_pw·select_count·reg_at는 유지, 나머지만 갱신
      const f = parsed.fields;
      await sql`
        UPDATE preset SET
          song_name = ${f.songName}, singer = ${f.singer}, ytb_url = ${f.ytbUrl},
          flip_mode = ${f.flipMode}, flip_sec = ${f.flipSec},
          cues = ${JSON.stringify(f.cues)}::jsonb, seq = ${JSON.stringify(f.seq)}::jsonb,
          total_page = ${f.totalPage}, mod_at = now()
        WHERE preset_id = ${id}`;
      return res.status(200).json({ ok: true });
    }

    if (req.method === "DELETE") {
      const pw = (req.body?.uploader_pw ?? "").toString();
      if (!pw) return res.status(400).json({ error: "password required" });
      const rows = await sql`
        SELECT uploader_pw FROM preset
        WHERE preset_id = ${id} AND del_at IS NULL LIMIT 1`;
      if (!rows.length) return res.status(404).json({ error: "not found" });
      if (!verifyPw(pw, rows[0].uploader_pw))
        return res.status(403).json({ error: "wrong password" });
      await sql`UPDATE preset SET del_at = now() WHERE preset_id = ${id}`;
      return res.status(200).json({ ok: true });
    }

    res.setHeader("Allow", "GET, PATCH, DELETE");
    return res.status(405).json({ error: "method not allowed" });
  } catch (e) {
    return res.status(500).json({ error: "server error" });
  }
}

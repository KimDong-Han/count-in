import { neon } from "@neondatabase/serverless";
import { hashPw } from "../../lib/pw.js";
import { parseShareFields } from "../../lib/preset.js";

// 공유 프리셋 API — 목록 검색(GET) · 공유 등록(POST)
//
// 테이블 계약 (소유자 확정 스키마):
//   preset (
//     preset_id    bigint identity PK, -- 오토인크리먼트 (DB 생성)
//     song_name    varchar(100),
//     singer       varchar(200),
//     uploader     varchar(30),
//     uploader_pw  text,              -- 'salt:sha256(salt+pw)' hex, nullable
//     select_count int default 0,     -- 고른 횟수
//     ytb_url      text,
//     flip_mode    text,              -- 'cue' | 'interval'
//     flip_sec     int null,          -- interval 모드 간격(총 초)
//     cues         jsonb,             -- ["0:45","1:40",...]
//     seq          jsonb,             -- [1,2,3,1,2,4]
//     total_page   int,
//     reg_at       timestamptz default now(),
//     mod_at       timestamptz,
//     del_at       timestamptz null   -- 소프트 삭제
//   )
//
// 환경변수: Vercel Neon 연동이 DATABASE_URL / POSTGRES_URL 자동 주입.

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
    if (req.method === "GET") {
      const q = (req.query.q || "").toString().trim();
      if (!q) return res.status(200).json([]);
      const like = "%" + q + "%";
      // 검색 기준: name(제목) | singer(가수) | uploader(닉네임). 컬럼명은
      // 파라미터화 불가라 분기. 결과는 카드용 {id,name,author,pages}로 별칭.
      const by = (req.query.by || "name").toString();
      let rows;
      if (by === "singer") {
        rows = await sql`
          SELECT preset_id AS id, song_name AS name, singer, uploader AS author, total_page AS pages
          FROM preset WHERE del_at IS NULL AND lower(singer) LIKE lower(${like})
          ORDER BY select_count DESC, reg_at DESC LIMIT 50`;
      } else if (by === "uploader") {
        rows = await sql`
          SELECT preset_id AS id, song_name AS name, singer, uploader AS author, total_page AS pages
          FROM preset WHERE del_at IS NULL AND lower(uploader) LIKE lower(${like})
          ORDER BY select_count DESC, reg_at DESC LIMIT 50`;
      } else {
        rows = await sql`
          SELECT preset_id AS id, song_name AS name, singer, uploader AS author, total_page AS pages
          FROM preset WHERE del_at IS NULL AND lower(song_name) LIKE lower(${like})
          ORDER BY select_count DESC, reg_at DESC LIMIT 50`;
      }
      return res.status(200).json(rows);
    }

    if (req.method === "POST") {
      const b = req.body || {};
      const uploaderIn = (b.uploader ?? "").toString().trim();
      const pwIn = (b.uploader_pw ?? "").toString();
      const parsed = parseShareFields(b);
      if (parsed.error)
        return res
          .status(parsed.error === "too large" ? 413 : 400)
          .json({ error: parsed.error });
      // 닉네임·비밀번호는 등록 전용 필수
      if (!uploaderIn) return res.status(400).json({ error: "uploader required" });
      if (!pwIn) return res.status(400).json({ error: "password required" });

      const f = parsed.fields;
      const uploader = uploaderIn.slice(0, 30);
      const uploaderPw = hashPw(pwIn);

      // preset_id는 DB가 생성 → RETURNING으로 받아서 반환
      const inserted = await sql`
        INSERT INTO preset
          (song_name, singer, uploader, uploader_pw,
           ytb_url, flip_mode, flip_sec, cues, seq, total_page)
        VALUES
          (${f.songName}, ${f.singer}, ${uploader}, ${uploaderPw},
           ${f.ytbUrl}, ${f.flipMode}, ${f.flipSec},
           ${JSON.stringify(f.cues)}::jsonb, ${JSON.stringify(f.seq)}::jsonb, ${f.totalPage})
        RETURNING preset_id`;

      return res.status(200).json({ id: inserted[0].preset_id });
    }

    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "method not allowed" });
  } catch (e) {
    return res.status(500).json({ error: "server error" });
  }
}

import { neon } from "@neondatabase/serverless";
import { createHash, randomUUID } from "crypto";

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

// 아이템 패스워드 해시: 행별 랜덤 솔트로 섞어 'salt:hash'로 저장.
// (수정/삭제 검증 시 salt 떼어내 재계산 → verifyPw)
function hashPw(pw) {
  const salt = randomUUID().replace(/-/g, "").slice(0, 12);
  const h = createHash("sha256").update(salt + ":" + pw).digest("hex");
  return salt + ":" + h;
}
// 나중에 수정/삭제에서 쓸 검증 헬퍼
export function verifyPw(pw, stored) {
  if (!stored) return false;
  const [salt, h] = stored.split(":");
  return createHash("sha256").update(salt + ":" + pw).digest("hex") === h;
}

export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      const q = (req.query.q || "").toString().trim();
      if (!q) return res.status(200).json([]);
      const like = "%" + q + "%";
      // 결과 카드가 기대하는 {id, name, author, pages} 형태로 별칭
      const rows = await sql`
        SELECT preset_id AS id, song_name AS name, uploader AS author, total_page AS pages
        FROM preset
        WHERE del_at IS NULL
          AND (lower(song_name) LIKE lower(${like}) OR lower(singer) LIKE lower(${like}))
        ORDER BY select_count DESC, reg_at DESC
        LIMIT 50`;
      return res.status(200).json(rows);
    }

    if (req.method === "POST") {
      const b = req.body || {};
      const songName = (b.song_name ?? b.name ?? "").toString().trim();
      const ytbUrl = (b.ytb_url ?? b.url ?? "").toString().trim();
      const singerIn = (b.singer ?? "").toString().trim();
      const uploaderIn = (b.uploader ?? "").toString().trim();
      const pwIn = (b.uploader_pw ?? "").toString();
      if (!songName) return res.status(400).json({ error: "song_name required" });
      if (!ytbUrl) return res.status(400).json({ error: "ytb_url required" });
      // 가수·닉네임·비밀번호 필수 (공유 등록 조건)
      if (!singerIn) return res.status(400).json({ error: "singer required" });
      if (!uploaderIn) return res.status(400).json({ error: "uploader required" });
      if (!pwIn) return res.status(400).json({ error: "password required" });

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
      const totalPage = Number.isFinite(b.total_page)
        ? b.total_page
        : Number.isFinite(b.pageCount)
          ? b.pageCount
          : null;

      // 과대 페이로드 방지
      if (JSON.stringify({ cues, seq }).length > 100_000)
        return res.status(413).json({ error: "too large" });

      const uploader = uploaderIn.slice(0, 30);
      const singer = singerIn.slice(0, 200);
      const uploaderPw = hashPw(pwIn);

      // preset_id는 DB가 생성 → RETURNING으로 받아서 반환
      const inserted = await sql`
        INSERT INTO preset
          (song_name, singer, uploader, uploader_pw,
           ytb_url, flip_mode, flip_sec, cues, seq, total_page)
        VALUES
          (${songName.slice(0, 100)}, ${singer}, ${uploader}, ${uploaderPw},
           ${ytbUrl}, ${flipMode}, ${flipSec},
           ${JSON.stringify(cues)}::jsonb, ${JSON.stringify(seq)}::jsonb, ${totalPage})
        RETURNING preset_id`;

      return res.status(200).json({ id: inserted[0].preset_id });
    }

    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "method not allowed" });
  } catch (e) {
    return res.status(500).json({ error: "server error" });
  }
}

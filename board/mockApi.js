// 선곡 보드 mock API — 서버(Vercel Functions + Postgres)가 생기면 이 모듈만 교체한다.
// 의도적으로 "서버가 강제해야 하는 규칙"(블라인드 가리기, 마감 잠금, 포지션 선점/검증)을
// 전부 여기서 수행해서, 화면 코드가 서버 계약에 맞게 작성되도록 한다.
// 데이터는 메모리에만 있음 — 새로고침하면 데모 방만 남는다. (기획 §4)

const LATENCY = 120; // 네트워크 흉내
const delay = (v) => new Promise((r) => setTimeout(() => r(v), LATENCY));
const fail = (code, msg) => {
  const e = new Error(msg || code);
  e.code = code;
  return Promise.reject(e).then(undefined, (err) => {
    throw err;
  });
};

let seq = 100;
const id = () => ++seq;
const slugGen = () =>
  Math.random().toString(36).slice(2, 8) + Math.random().toString(36).slice(2, 6);

// rooms: slug → room
const rooms = new Map();

/* ---------- 데모 방 시드 ---------- */
function seedDemo() {
  const mk = (position) => ({ id: id(), position, pw: null, claimedAt: null });
  const members = ["보컬", "기타", "베이스", "드럼", "키보드", "바이올린"].map(mk);
  const m = (pos) => members.find((x) => x.position === pos).id;
  // 데모용: 일부 포지션은 이미 선점된 상태 (비번 '1234')
  for (const pos of ["보컬", "기타", "베이스", "드럼"])
    Object.assign(
      members.find((x) => x.position === pos),
      { pw: "1234", claimedAt: Date.now() },
    );

  const songs = [
    {
      id: id(), proposerMemberId: m("드럼"), title: "주저하는 연인들을 위해",
      artist: "잔나비", vocalType: "male", sheetReady: true,
      ytUrl: "https://youtu.be/0Nx7hDCcuNo", status: "confirmed",
      votes: { [m("보컬")]: 3, [m("기타")]: 3, [m("베이스")]: 2, [m("드럼")]: 3 },
      comments: [],
    },
    {
      id: id(), proposerMemberId: m("보컬"), title: "고민중독",
      artist: "QWER", vocalType: "female", sheetReady: true,
      ytUrl: "https://youtu.be/ImuWa3SJulY", status: "proposed",
      votes: { [m("보컬")]: 3, [m("기타")]: 3, [m("베이스")]: 2, [m("드럼")]: 2 },
      comments: [{ id: id(), memberId: m("베이스"), body: "키 반 내리면 될 듯" }],
    },
    {
      id: id(), proposerMemberId: m("보컬"), title: "Freesia",
      artist: "데이식스", vocalType: "male", sheetReady: false,
      ytUrl: "https://youtu.be/kJk-2n8QqbY", status: "proposed",
      votes: { [m("보컬")]: 2, [m("기타")]: 0, [m("베이스")]: 2 },
      comments: [{ id: id(), memberId: m("기타"), body: "이 곡은 못해먹겠다" }],
    },
    {
      id: id(), proposerMemberId: m("바이올린"), title: "사건의 지평선",
      artist: "윤하", vocalType: "female", sheetReady: true,
      ytUrl: "https://youtu.be/BBdC1rl5sKY", status: "proposed",
      votes: { [m("드럼")]: 2 },
      comments: [],
    },
  ];

  rooms.set("demo", {
    slug: "demo", name: "9월 정기합주 (데모)",
    adminPw: "0000", entryPw: null,
    scoreVisibility: "blind",
    voteDeadline: new Date(Date.now() + 3 * 864e5).toISOString(),
    members, songs,
  });
}
seedDemo();

/* ---------- 내부 헬퍼 ---------- */
const findRoom = (slug) => rooms.get(slug);
const memberByPos = (room, position) =>
  room.members.find((x) => x.position === position);
const deadlinePassed = (room) =>
  !!room.voteDeadline && Date.now() > new Date(room.voteDeadline).getTime();
// 블라인드 해제 조건: open이거나 마감 지남
const scoresVisible = (room) =>
  room.scoreVisibility === "open" || deadlinePassed(room);

// 쓰기 공통: 포지션 선점/검증 (기획 §4 "쓰기 공통 규칙")
function authMember(room, position, pw) {
  const mem = memberByPos(room, position);
  if (!mem) throw Object.assign(new Error("포지션이 없어요"), { code: "no-member" });
  if (mem.pw == null) {
    if (!pw || pw.length < 4)
      throw Object.assign(new Error("첫 참여 — 4자 이상 비밀번호를 정해주세요"), {
        code: "need-claim",
      });
    mem.pw = pw; // 실제 서버에선 해시 저장
    mem.claimedAt = Date.now();
    return mem;
  }
  if (pw !== mem.pw)
    throw Object.assign(new Error("비밀번호가 달라요"), {
      code: pw ? "wrong-pw" : "need-pw",
    });
  return mem;
}

function guardWrite(room) {
  if (deadlinePassed(room))
    throw Object.assign(new Error("투표가 마감됐어요"), { code: "closed" });
}

// GET 응답 성형 — 서버가 주게 될 모양 그대로 (블라인드면 타인 점수·총점 미포함)
function viewRoom(room, { myPosition } = {}) {
  const visible = scoresVisible(room);
  const my = myPosition ? memberByPos(room, myPosition) : null;
  return {
    slug: room.slug,
    name: room.name,
    scoreVisibility: room.scoreVisibility,
    scoresVisible: visible,
    voteDeadline: room.voteDeadline,
    deadlinePassed: deadlinePassed(room),
    members: room.members.map((x) => ({
      id: x.id, position: x.position, claimed: x.pw != null,
    })),
    songs: room.songs.map((s) => {
      const entries = Object.entries(s.votes).map(([mid, score]) => ({
        memberId: +mid, score,
      }));
      const mine = my ? entries.find((v) => v.memberId === my.id) : null;
      return {
        id: s.id,
        proposerPosition:
          room.members.find((x) => x.id === s.proposerMemberId)?.position ?? "?",
        title: s.title, artist: s.artist, vocalType: s.vocalType,
        sheetReady: s.sheetReady, ytUrl: s.ytUrl, status: s.status,
        voteCount: entries.length,
        myScore: mine ? mine.score : null,
        // 블라인드면 서버가 아예 안 보냄
        votes: visible ? entries : null,
        total: visible ? entries.reduce((a, v) => a + v.score, 0) : null,
        impossibleCount: visible
          ? entries.filter((v) => v.score === 0).length
          : null,
        comments: s.comments.map((c) => ({
          id: c.id,
          position:
            room.members.find((x) => x.id === c.memberId)?.position ?? "?",
          body: c.body,
        })),
      };
    }),
  };
}

/* ---------- 공개 API (기획 §4와 1:1) ---------- */
export async function createRoom({ name, positions, adminPw, entryPw }) {
  if (!name?.trim()) return fail("bad-name", "방 이름을 입력해 주세요");
  if (!positions?.length) return fail("bad-members", "멤버 구성을 골라주세요");
  if (!adminPw || adminPw.length < 4)
    return fail("bad-admin-pw", "방장 비밀번호는 4자 이상이에요");
  const slug = slugGen();
  rooms.set(slug, {
    slug, name: name.trim(),
    adminPw, entryPw: entryPw || null,
    scoreVisibility: "open", voteDeadline: null,
    members: positions.map((p) => ({ id: id(), position: p, pw: null, claimedAt: null })),
    songs: [],
  });
  return delay({ slug });
}

export async function getRoom(slug, { entryPw, myPosition } = {}) {
  const room = findRoom(slug);
  if (!room) return fail("not-found", "방을 찾을 수 없어요");
  if (room.entryPw && entryPw !== room.entryPw)
    return delay({ needEntry: true, name: room.name });
  return delay(viewRoom(room, { myPosition }));
}

// 점수는 탭마다 쏘지 않고 로컬 초안 → "저장하기"로 일괄 전송 (요청 1회, 커넥션·비용 절약)
export async function voteBatch(slug, { position, pw, votes }) {
  const room = findRoom(slug);
  if (!room) return fail("not-found");
  guardWrite(room);
  const mem = authMember(room, position, pw);
  for (const { songId, score } of votes) {
    const song = room.songs.find((s) => s.id === songId);
    if (song) song.votes[mem.id] = score;
  }
  return delay(viewRoom(room, { myPosition: position }));
}

export async function addSong(slug, { position, pw, title, artist, vocalType, sheetReady, ytUrl }) {
  const room = findRoom(slug);
  if (!room) return fail("not-found");
  guardWrite(room);
  const mem = authMember(room, position, pw);
  if (!title?.trim()) return fail("bad-title", "곡 이름을 입력해 주세요");
  room.songs.push({
    id: id(), proposerMemberId: mem.id,
    title: title.trim(), artist: (artist || "").trim(),
    vocalType: vocalType || "none", sheetReady: !!sheetReady,
    ytUrl: (ytUrl || "").trim(), status: "proposed", votes: {}, comments: [],
  });
  return delay(viewRoom(room, { myPosition: position }));
}

export async function addComment(slug, songId, { position, pw, body }) {
  const room = findRoom(slug);
  if (!room) return fail("not-found");
  const mem = authMember(room, position, pw); // 코멘트는 마감 후에도 허용 (기획 §5)
  const song = room.songs.find((s) => s.id === songId);
  if (!song) return fail("no-song");
  if (!body?.trim()) return fail("bad-body");
  song.comments.push({ id: id(), memberId: mem.id, body: body.trim() });
  return delay(viewRoom(room, { myPosition: position }));
}

/* ---------- 방장 ---------- */
function authAdmin(slug, adminPw) {
  const room = findRoom(slug);
  if (!room) throw Object.assign(new Error("방 없음"), { code: "not-found" });
  if (adminPw !== room.adminPw)
    throw Object.assign(new Error("방장 비밀번호가 달라요"), { code: "wrong-admin" });
  return room;
}

export async function adminCheck(slug, adminPw) {
  authAdmin(slug, adminPw);
  return delay({ ok: true });
}

export async function adminUpdate(slug, adminPw, patch) {
  const room = authAdmin(slug, adminPw);
  if (patch.scoreVisibility) room.scoreVisibility = patch.scoreVisibility;
  if ("voteDeadline" in patch) room.voteDeadline = patch.voteDeadline;
  return delay(viewRoom(room, {}));
}

export async function toggleConfirm(slug, adminPw, songId) {
  const room = authAdmin(slug, adminPw);
  const song = room.songs.find((s) => s.id === songId);
  if (!song) return fail("no-song");
  song.status = song.status === "confirmed" ? "proposed" : "confirmed";
  return delay(viewRoom(room, {}));
}

export async function resetMemberPw(slug, adminPw, memberId) {
  const room = authAdmin(slug, adminPw);
  const mem = room.members.find((x) => x.id === memberId);
  if (!mem) return fail("no-member");
  mem.pw = null;
  mem.claimedAt = null;
  return delay(viewRoom(room, {}));
}

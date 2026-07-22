// 선곡 보드 프론트엔드 (프로토타입) — mockApi 위에서 동작, 서버 붙이면 mockApi만 교체.
// 라우팅: #/r/<slug> = 방, 그 외 = 진입 화면. 비밀번호는 어디에도 저장하지 않는다
// (포지션 비번·입장 비번·방장 비번 전부 메모리만 — 기획 §2).
import React, { useEffect, useMemo, useRef, useState } from "react";
import * as api from "./mockApi.js";

const POSITION_PRESETS = ["보컬", "기타", "베이스", "드럼", "키보드", "퍼커션"];
const SCORE_LABELS = ["0 불가능", "1 보통", "2 좋음", "3 매우좋음"];
const RECENT_KEY = "cinboard:recent";
const posKey = (slug) => `cinboard:pos:${slug}`;

const readRecent = () => {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
  } catch {
    return [];
  }
};
const pushRecent = (slug, name) => {
  const list = [{ slug, name }, ...readRecent().filter((r) => r.slug !== slug)];
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, 5)));
  } catch {}
};

const vocalLabel = { male: "보컬 남", female: "보컬 여", duet: "듀엣", none: null };

function useHashRoute() {
  const parse = () => {
    const m = location.hash.match(/^#\/r\/([\w-]+)/);
    return m ? m[1] : null;
  };
  const [slug, setSlug] = useState(parse);
  useEffect(() => {
    const on = () => setSlug(parse());
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return slug;
}

function deadlineText(iso, passed) {
  if (!iso) return null;
  if (passed) return "투표 마감됨";
  const ms = new Date(iso).getTime() - Date.now();
  const d = Math.floor(ms / 864e5);
  const h = Math.floor((ms % 864e5) / 36e5);
  if (d > 0) return `마감까지 ${d}일 ${h}시간`;
  if (h > 0) return `마감까지 ${h}시간`;
  return `마감까지 ${Math.max(1, Math.floor(ms / 6e4))}분`;
}

/* ==================== 루트 ==================== */
export default function BoardApp() {
  const slug = useHashRoute();
  const [toastMsg, setToastMsg] = useState(null);
  const toastTimer = useRef(null);
  const toast = (msg) => {
    setToastMsg(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMsg(null), 2600);
  };
  return (
    <>
      {slug ? (
        <RoomScreen key={slug} slug={slug} toast={toast} />
      ) : (
        <EntryScreen toast={toast} />
      )}
      {toastMsg && <div className="toast">{toastMsg}</div>}
    </>
  );
}

/* ==================== 진입 화면 ==================== */
function EntryScreen({ toast }) {
  const [name, setName] = useState("");
  const [positions, setPositions] = useState(["보컬", "기타", "베이스", "드럼"]);
  const [custom, setCustom] = useState("");
  const [adminPw, setAdminPw] = useState("");
  const [entryOn, setEntryOn] = useState(false);
  const [entryPw, setEntryPw] = useState("");
  const [busy, setBusy] = useState(false);
  const recent = readRecent();

  const togglePos = (p) =>
    setPositions((cur) =>
      cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p],
    );
  const addCustom = () => {
    const v = custom.trim();
    if (!v) return;
    if (positions.includes(v)) return toast("이미 있는 포지션이에요");
    setPositions((cur) => [...cur, v]);
    setCustom("");
  };

  const create = async () => {
    setBusy(true);
    try {
      const { slug } = await api.createRoom({
        name,
        positions,
        adminPw,
        entryPw: entryOn ? entryPw : null,
      });
      pushRecent(slug, name.trim());
      const url = `${location.origin}${location.pathname}#/r/${slug}`;
      try {
        await navigator.clipboard.writeText(url);
        toast("방 링크를 복사했어요 — 단톡방에 붙여넣으세요");
      } catch {
        toast("방을 만들었어요 — 주소창의 링크를 공유하세요");
      }
      location.hash = `#/r/${slug}`;
    } catch (e) {
      toast(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="wrap">
      <header className="brand">
        <span className="brandName">Count-In 선곡 보드</span>
        <a className="brandLink" href="/">연습 플레이어 ›</a>
      </header>
      <div className="hero">
        <h1>합주곡, 투표로 정해요</h1>
        <p>가입 없이 방 링크 하나로 멤버를 모아요. 이름 대신 포지션으로 참여해요.</p>
      </div>

      <section className="card">
        <div className="cardTitle">새 선곡 방 만들기</div>
        <label className="lbl" htmlFor="roomName">방 이름</label>
        <input id="roomName" className="field" placeholder="예: 9월 정기합주"
          value={name} onChange={(e) => setName(e.target.value)} />

        <span className="lbl">멤버 구성 <span className="hint">· 포지션으로만, 이름 없어요</span></span>
        <div className="chips">
          {POSITION_PRESETS.map((p) => (
            <button key={p} type="button"
              className={"chip" + (positions.includes(p) ? " on" : "")}
              onClick={() => togglePos(p)}>{p}</button>
          ))}
          {positions.filter((p) => !POSITION_PRESETS.includes(p)).map((p) => (
            <button key={p} type="button" className="chip on"
              onClick={() => togglePos(p)}>{p} ✕</button>
          ))}
        </div>
        <div className="cmtRow">
          <input className="field" placeholder="직접 입력 — 바이올린, 기타2 …"
            value={custom} onChange={(e) => setCustom(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addCustom()} />
          <button type="button" className="btn grey" onClick={addCustom}>추가</button>
        </div>
        <p className="sub">같은 포지션이 둘이면 "기타1·기타2"처럼 나눠주세요</p>

        <label className="lbl" htmlFor="adminPw">방장 비밀번호 <span className="hint">· 확정·마감 관리용, 4자 이상</span></label>
        <input id="adminPw" className="field" type="password" placeholder="••••"
          value={adminPw} onChange={(e) => setAdminPw(e.target.value)} />

        <div className="optRow">
          <span className="optTxt">
            <b>입장 비밀번호 걸기</b>
            <span>링크가 새어도 멤버만 · 브라우저에 저장 안 해요</span>
          </span>
          <button type="button" aria-pressed={entryOn}
            className={"switch" + (entryOn ? " on" : "")}
            onClick={() => setEntryOn(!entryOn)} aria-label="입장 비밀번호 걸기" />
        </div>
        {entryOn && (
          <input className="field" type="password" placeholder="입장 비밀번호"
            value={entryPw} onChange={(e) => setEntryPw(e.target.value)} />
        )}

        <button type="button" className="btn" style={{ marginTop: 16 }}
          disabled={busy} onClick={create}>
          방 만들기 → 링크 복사
        </button>
      </section>

      <section className="card">
        <div className="cardTitle" style={{ fontSize: 13, color: "var(--muted)" }}>
          {recent.length ? "최근 연 방" : "구경해보기"}
        </div>
        {recent.map((r) => (
          <div className="optRow" key={r.slug} style={{ marginTop: 10 }}>
            <span className="optTxt"><b>{r.name || r.slug}</b></span>
            <button type="button" className="btn sm weak"
              onClick={() => (location.hash = `#/r/${r.slug}`)}>열기</button>
          </div>
        ))}
        <div className="optRow" style={{ marginTop: 10 }}>
          <span className="optTxt">
            <b>데모 방</b>
            <span>미리 채워진 예시 — 방장 비번 0000</span>
          </span>
          <button type="button" className="btn sm weak"
            onClick={() => (location.hash = "#/r/demo")}>열기</button>
        </div>
      </section>
    </div>
  );
}

/* ==================== 방 화면 ==================== */
function RoomScreen({ slug, toast }) {
  const [data, setData] = useState(null); // viewRoom 응답 | {needEntry,name}
  const [loadErr, setLoadErr] = useState(null);
  const [myPos, setMyPos] = useState(() => {
    try { return localStorage.getItem(posKey(slug)) || ""; } catch { return ""; }
  });
  // card | table — #/r/slug?view=table 딥링크 허용 (공유·검증용)
  const [view, setView] = useState(() =>
    location.hash.includes("view=table") ? "table" : "card",
  );
  const [pwModal, setPwModal] = useState(null); // {mode, position, error, resolve}
  const [propose, setPropose] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const posPwMem = useRef({}); // 포지션 비번 — 세션 메모리만
  const adminPwMem = useRef(null);
  const entryPwMem = useRef(null);

  const load = async () => {
    try {
      setData(await api.getRoom(slug, {
        entryPw: entryPwMem.current, myPosition: myPos || undefined,
      }));
      setLoadErr(null);
    } catch (e) {
      setLoadErr(e.message);
    }
  };
  useEffect(() => { load(); }, [slug, myPos]);

  const askPw = (opts) =>
    new Promise((resolve) => setPwModal({ ...opts, resolve }));
  const closePwModal = (value) => {
    pwModal?.resolve(value);
    setPwModal(null);
  };

  // 쓰기 공통: 선점/검증 플로우 (기획 §4) — 실패 시 모달로 1회 재시도
  const withAuth = async (fn) => {
    if (!myPos) { toast("먼저 내 포지션을 골라주세요"); return; }
    const claimed = data?.members?.find((m) => m.position === myPos)?.claimed;
    let pw = posPwMem.current[myPos] ?? null;
    if (pw == null) {
      pw = await askPw({ mode: claimed ? "verify" : "claim", position: myPos });
      if (pw == null) return;
    }
    const attempt = async (p) => {
      const next = await fn(p);
      posPwMem.current[myPos] = p;
      setData(next);
      return true;
    };
    try {
      return await attempt(pw);
    } catch (e) {
      delete posPwMem.current[myPos];
      if (["wrong-pw", "need-pw", "need-claim"].includes(e.code)) {
        const pw2 = await askPw({
          mode: e.code === "need-claim" ? "claim" : "verify",
          position: myPos, error: e.message,
        });
        if (pw2 == null) return;
        try { return await attempt(pw2); } catch (e2) { toast(e2.message); }
      } else toast(e.message);
    }
  };

  // 점수 초안 — 탭은 로컬에만 쌓고 "저장하기"로 일괄 전송 (커넥션·비용 절약)
  const [draft, setDraft] = useState({}); // songId → score
  const setScore = (songId, score) => {
    if (!myPos) { toast("먼저 내 포지션을 골라주세요"); return; }
    setDraft((d) => {
      const server = data?.songs?.find((s) => s.id === songId)?.myScore;
      const next = { ...d };
      if (server === score) delete next[songId];
      else next[songId] = score;
      return next;
    });
  };
  const effScore = (s) => draft[s.id] ?? s.myScore;
  const dirtyCount = Object.keys(draft).length;
  const saveVotes = async () => {
    const votes = Object.entries(draft).map(([songId, score]) => ({
      songId: +songId, score,
    }));
    const ok = await withAuth((pw) =>
      api.voteBatch(slug, { position: myPos, pw, votes }),
    );
    if (ok) { setDraft({}); toast(`${votes.length}곡 점수를 저장했어요`); }
  };
  // 저장 안 한 초안이 있으면 이탈 경고
  useEffect(() => {
    if (!dirtyCount) return;
    const warn = (e) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirtyCount]);

  const doComment = (songId, body) =>
    withAuth((pw) => api.addComment(slug, songId, { position: myPos, pw, body }));

  const ensureAdmin = async () => {
    if (adminPwMem.current) return adminPwMem.current;
    const pw = await askPw({ mode: "admin" });
    if (pw == null) return null;
    try {
      await api.adminCheck(slug, pw);
      adminPwMem.current = pw;
      return pw;
    } catch (e) { toast(e.message); return null; }
  };
  const adminDo = async (fn) => {
    const pw = await ensureAdmin();
    if (!pw) return;
    try { setData(await fn(pw)); } catch (e) { toast(e.message); }
  };

  /* ---- 로딩·입장 게이트 ---- */
  if (loadErr)
    return (
      <div className="wrap">
        <p className="empty">{loadErr}</p>
        <button type="button" className="btn grey" onClick={() => (location.hash = "")}>← 처음으로</button>
      </div>
    );
  if (!data) return <div className="wrap"><p className="empty">불러오는 중…</p></div>;
  if (data.needEntry)
    return (
      <EntryGate name={data.name}
        onSubmit={(pw) => { entryPwMem.current = pw; load(); }} />
    );

  const confirmed = data.songs.filter((s) => s.status === "confirmed");
  const candidates = data.songs.filter((s) => s.status !== "confirmed");
  const sorted = data.scoresVisible
    ? [...candidates].sort((a, b) => (b.total ?? 0) - (a.total ?? 0))
    : candidates;
  const locked = data.deadlinePassed;

  return (
    <div className={view === "table" ? "wide" : ""}>
      <div className="wrap">
        <header className="brand">
          <button type="button" className="brandLink" onClick={() => (location.hash = "")}>← 선곡 보드</button>
          <button type="button" className="brandLink"
            onClick={async () => { if (await ensureAdmin()) setAdminOpen((v) => !v); }}>
            🔧 방장
          </button>
        </header>

        <div className="roomHead">
          <div>
            <div className="roomName">{data.name}</div>
            <div className="roomMeta">
              멤버 {data.members.length}포지션 · 후보 {candidates.length}곡
              {!data.scoresVisible && " · 🙈 블라인드 투표 중"}
            </div>
          </div>
          {data.voteDeadline && (
            <span className={"deadline" + (locked ? " over" : "")}>
              ⏳ {deadlineText(data.voteDeadline, locked)}
            </span>
          )}
        </div>

        {adminOpen && (
          <AdminPanel data={data} slug={slug} adminDo={adminDo} toast={toast} />
        )}

        {/* 내 포지션 */}
        <div className="posBar">
          <span>내 포지션</span>
          <div className="chips">
            {data.members.map((mem) => (
              <button key={mem.id} type="button"
                className={
                  "chip" + (myPos === mem.position ? " on" : "") +
                  (mem.claimed && myPos !== mem.position ? " claimed" : "")
                }
                onClick={() => {
                  setMyPos(mem.position);
                  try { localStorage.setItem(posKey(slug), mem.position); } catch {}
                }}>
                {mem.position}
              </button>
            ))}
          </div>
        </div>

        {/* 확정 곡 */}
        {confirmed.length > 0 && (
          <>
            <div className="secTitle">✅ 확정된 곡 ({confirmed.length})</div>
            {confirmed.map((s) => (
              <div className="card" key={s.id} style={{ padding: "13px 16px" }}>
                <div className="songTop">
                  <div className="songTitle">
                    {s.title} <small>— {s.artist}</small>
                  </div>
                  {s.ytUrl && (
                    <a className="badge blue" href={s.ytUrl} target="_blank" rel="noreferrer">▶ 원곡</a>
                  )}
                </div>
              </div>
            ))}
          </>
        )}

        {/* 후보 곡 + 뷰 토글 */}
        <div className="secTitle" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>🗳 후보 곡{data.scoresVisible ? " — 총점순" : ""}</span>
          <span className="viewToggle">
            <button type="button" className={view === "card" ? "on" : ""} onClick={() => setView("card")}>카드</button>
            <button type="button" className={view === "table" ? "on" : ""} onClick={() => setView("table")}>표</button>
          </span>
        </div>

        {candidates.length === 0 && (
          <p className="empty">아직 후보 곡이 없어요 — 첫 곡을 제안해 보세요</p>
        )}

        {view === "card"
          ? sorted.map((s) => (
              <SongCard key={s.id} song={s} data={data} myPos={myPos}
                locked={locked} myScore={effScore(s)} dirty={s.id in draft}
                onScore={setScore} onComment={doComment}
                admin={adminOpen} onConfirm={(id) => adminDo((pw) => api.toggleConfirm(slug, pw, id))} />
            ))
          : (
            <SongTable songs={data.songs} data={data} myPos={myPos}
              locked={locked} effScore={effScore} draft={draft} onScore={setScore} />
          )}

        <div style={{ height: 40 }} />
        <div className="fab">
          {dirtyCount > 0 ? (
            <div className="fabRow">
              <button type="button" className="btn" onClick={saveVotes}>
                내 점수 저장하기 ({dirtyCount}곡)
              </button>
              <button type="button" className="btn grey fabSq" disabled={locked}
                onClick={() => setPropose(true)} aria-label="곡 제안하기">＋</button>
            </div>
          ) : (
            <button type="button" className="btn" disabled={locked}
              onClick={() => setPropose(true)}>
              {locked ? "투표가 마감됐어요" : "＋ 곡 제안하기"}
            </button>
          )}
        </div>
      </div>

      {propose && (
        <ProposeModal
          onClose={() => setPropose(false)}
          onSubmit={async (fields) => {
            const ok = await withAuth((pw) =>
              api.addSong(slug, { position: myPos, pw, ...fields }),
            );
            if (ok) { setPropose(false); toast("곡을 제안했어요"); }
          }}
        />
      )}
      {pwModal && <PwModal {...pwModal} onClose={closePwModal} />}
    </div>
  );
}

/* ==================== 곡 카드 ==================== */
function SongCard({ song: s, data, myPos, locked, myScore, dirty, onScore, onComment, admin, onConfirm }) {
  const [open, setOpen] = useState(false);
  const [cmt, setCmt] = useState("");
  const submitCmt = async () => {
    const body = cmt.trim();
    if (!body) return;
    if (await onComment(s.id, body)) setCmt("");
  };
  return (
    <div className="card">
      <div className="songTop">
        <div>
          <div className="songTitle">{s.title} <small>— {s.artist}</small></div>
          <div className="badges">
            <span className="badge">제안: {s.proposerPosition}</span>
            {vocalLabel[s.vocalType] && <span className="badge">{vocalLabel[s.vocalType]}</span>}
            <span className={"badge" + (s.sheetReady ? " blue" : "")}>악보 {s.sheetReady ? "✓" : "✗"}</span>
            {s.ytUrl && <a className="badge blue" href={s.ytUrl} target="_blank" rel="noreferrer">▶ 원곡</a>}
            {s.impossibleCount > 0 && <span className="badge warn">불가 {s.impossibleCount}명</span>}
          </div>
        </div>
        <div className="songAgg">
          <div className={"total" + (s.total == null ? " hidden" : "")}>
            총점 {s.total == null ? "?" : s.total}
          </div>
          <div className="cnt">{data.members.length}명 중 {s.voteCount}명</div>
        </div>
      </div>

      <span className="lbl">
        내 점수{myPos ? ` (${myPos})` : ""}
        {dirty && <span className="dirtyMark"> · 저장 전</span>}
      </span>
      <div className="seg">
        {SCORE_LABELS.map((label, score) => (
          <button key={score} type="button" disabled={locked}
            className={myScore === score ? (score === 0 ? "on0" : "on") : ""}
            onClick={() => onScore(s.id, score)}>
            {label}
          </button>
        ))}
      </div>

      {open && (
        data.scoresVisible ? (
          <div className="voteGrid">
            {data.members.map((mem) => {
              const v = s.votes?.find((x) => x.memberId === mem.id);
              return (
                <span key={mem.id} className={v ? "" : "none"}>
                  {mem.position}{" "}
                  {v ? <b className={v.score === 0 ? "zero" : ""}>{v.score}</b> : "— 미투표"}
                </span>
              );
            })}
          </div>
        ) : (
          <div className="blindNote">
            <div className="q">? ? ? ? ?</div>
            다른 포지션 점수는 마감 후 한 번에 공개돼요
          </div>
        )
      )}
      {open && (
        <>
          {s.comments.map((c) => (
            <div className="cmt" key={c.id}><b>{c.position}</b> {c.body}</div>
          ))}
          <div className="cmtRow">
            <input className="field" placeholder="자유 의견 — '이 곡은 못해먹겠다' 등"
              value={cmt} onChange={(e) => setCmt(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submitCmt()} />
            <button type="button" className="btn grey" onClick={submitCmt}>남기기</button>
          </div>
          {admin && (
            <button type="button" className="btn weak" style={{ marginTop: 10 }}
              onClick={() => onConfirm(s.id)}>
              {s.status === "confirmed" ? "확정 취소" : "이 곡 선곡 확정 ✓"}
            </button>
          )}
        </>
      )}
      <button type="button" className="moreBtn" onClick={() => setOpen(!open)}>
        {open ? "접기 ▲" : `자세히 · 코멘트 ${s.comments.length} ▼`}
      </button>
    </div>
  );
}

/* ==================== 표 모드 ==================== */
function SongTable({ songs, data, myPos, locked, effScore, draft, onScore }) {
  // 제안자(포지션) 기준 그룹핑 — 엑셀 셀 합치기 감성 (rowspan)
  const groups = useMemo(() => {
    const map = new Map();
    for (const s of songs) {
      if (!map.has(s.proposerPosition)) map.set(s.proposerPosition, []);
      map.get(s.proposerPosition).push(s);
    }
    return [...map.entries()];
  }, [songs]);
  const show = data.scoresVisible;

  return (
    <div className="card tblCard">
      <table>
        <thead>
          <tr>
            <th style={{ textAlign: "left" }}>제안자</th>
            <th style={{ textAlign: "left" }}>곡</th>
            <th>내 점수</th>
            {show && data.members.map((m) => (
              <th key={m.id} className="posCol">{m.position}</th>
            ))}
            {show && <th className="posCol">총점</th>}
            <th className="posCol">확정</th>
          </tr>
        </thead>
        <tbody>
          {groups.map(([pos, list]) =>
            list.map((s, i) => (
              <tr key={s.id}>
                {i === 0 && <td className="prop" rowSpan={list.length}>{pos}</td>}
                <td className="song">
                  <b>{s.title}</b>
                  <small>
                    {s.artist}
                    {s.ytUrl && <> · <a href={s.ytUrl} target="_blank" rel="noreferrer">▶</a></>}
                    {s.status === "confirmed" && <> · <span className="conf">확정</span></>}
                  </small>
                </td>
                <td>
                  <div className={"mini" + (s.id in draft ? " dirty" : "")}>
                    {[0, 1, 2, 3].map((score) => (
                      <button key={score} type="button" disabled={locked}
                        className={effScore(s) === score ? (score === 0 ? "on0" : "on") : ""}
                        onClick={() => onScore(s.id, score)}>
                        {score}
                      </button>
                    ))}
                  </div>
                </td>
                {show && data.members.map((m) => {
                  const v = s.votes?.find((x) => x.memberId === m.id);
                  return (
                    <td key={m.id} className="posCol">
                      {v ? <b className={v.score === 0 ? "zero" : ""}>{v.score}</b> : <span style={{ color: "var(--placeholder)" }}>—</span>}
                    </td>
                  );
                })}
                {show && (
                  <td className="posCol">
                    <b>{s.total}</b>
                    {s.impossibleCount > 0 && <span className="zero" style={{ fontSize: 11 }}> 불가{s.impossibleCount}</span>}
                  </td>
                )}
                <td className="posCol">{s.status === "confirmed" ? <span className="conf">✓</span> : ""}</td>
              </tr>
            )),
          )}
        </tbody>
      </table>
      {!show && (
        <p className="sub" style={{ padding: "10px 8px 4px" }}>
          🙈 블라인드 중 — 표에는 내 점수만 보여요. 마감 후 전체 점수·총점 열이 열려요.
        </p>
      )}
    </div>
  );
}

/* ==================== 방장 패널 ==================== */
function AdminPanel({ data, slug, adminDo, toast }) {
  const [dl, setDl] = useState(
    data.voteDeadline ? data.voteDeadline.slice(0, 16) : "",
  );
  const blind = data.scoreVisibility === "blind";
  return (
    <section className="card adminCard">
      <div className="cardTitle">🔧 방장 패널</div>
      <div className="optRow">
        <span className="optTxt">
          <b>블라인드 투표</b>
          <span>남의 점수·총점을 마감까지 가려요</span>
        </span>
        <button type="button" className={"switch" + (blind ? " on" : "")}
          aria-pressed={blind} aria-label="블라인드 투표"
          onClick={() => adminDo((pw) =>
            api.adminUpdate(slug, pw, { scoreVisibility: blind ? "open" : "blind" }),
          )} />
      </div>
      <label className="lbl" htmlFor="dl">투표 마감 일시</label>
      <input id="dl" type="datetime-local" className="field" value={dl}
        onChange={(e) => setDl(e.target.value)} />
      <div className="adminRowBtns">
        <button type="button" className="btn sm weak"
          onClick={() => {
            if (!dl) return toast("마감 일시를 골라주세요");
            adminDo((pw) => api.adminUpdate(slug, pw, {
              voteDeadline: new Date(dl).toISOString(),
            }));
          }}>마감 설정</button>
        <button type="button" className="btn sm grey"
          onClick={() => adminDo((pw) => api.adminUpdate(slug, pw, { voteDeadline: null }))}>
          마감 해제
        </button>
        {blind && (
          <button type="button" className="btn sm weak"
            onClick={() => adminDo((pw) => api.adminUpdate(slug, pw, { scoreVisibility: "open" }))}>
            지금 바로 공개
          </button>
        )}
      </div>
      <span className="lbl">포지션 비번 리셋 <span className="hint">· 비번 잊은 멤버용, 선점 해제</span></span>
      <div className="resetList">
        {data.members.filter((m) => m.claimed).map((m) => (
          <button key={m.id} type="button" className="btn sm danger"
            onClick={() => adminDo((pw) => api.resetMemberPw(slug, pw, m.id))}>
            {m.position} 리셋
          </button>
        ))}
        {data.members.every((m) => !m.claimed) && (
          <span className="sub">아직 선점된 포지션이 없어요</span>
        )}
      </div>
    </section>
  );
}

/* ==================== 모달들 ==================== */
function ModalShell({ children, onClose }) {
  return (
    <div className="overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">{children}</div>
    </div>
  );
}

// 비밀번호 모달 — claim(선점) / verify(재입력) / admin(방장)
function PwModal({ mode, position, error, onClose }) {
  const [pw, setPw] = useState("");
  const claim = mode === "claim";
  const admin = mode === "admin";
  const title = admin
    ? "방장 비밀번호"
    : claim
      ? `${position} 포지션 첫 참여네요!`
      : `${position} 비밀번호`;
  const desc = admin
    ? "방을 만들 때 정한 관리 비밀번호를 입력하세요."
    : claim
      ? "이 포지션으로 계속 투표·수정하려면 비밀번호를 정해주세요 (4자 이상). 어디에도 저장되지 않으니 기억해 주세요!"
      : "이 포지션을 선점할 때 정한 비밀번호를 입력하세요.";
  const valid = admin ? pw.length > 0 : claim ? pw.length >= 4 : pw.length > 0;
  const submit = () => valid && onClose(pw);
  return (
    <ModalShell onClose={() => onClose(null)}>
      <div className="modalTitle">{title}</div>
      <p className="sub">{desc}</p>
      {error && <p className="sub" style={{ color: "var(--danger)" }}>{error}</p>}
      <input autoFocus type="password" className="field"
        placeholder={claim ? "새 비밀번호 (4자 이상)" : "비밀번호"}
        value={pw} onChange={(e) => setPw(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submit()} />
      <div className="modalActions">
        <button type="button" className="btn grey" onClick={() => onClose(null)}>취소</button>
        <button type="button" className="btn" disabled={!valid} onClick={submit}>
          {claim ? "정하고 계속" : "확인"}
        </button>
      </div>
    </ModalShell>
  );
}

// 곡 제안 모달 — 엑셀 열 그대로 (기획 §1.5)
function ProposeModal({ onClose, onSubmit }) {
  const [f, setF] = useState({
    title: "", artist: "", vocalType: "none", sheetReady: false, ytUrl: "",
  });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  return (
    <ModalShell onClose={onClose}>
      <div className="modalTitle">곡 제안하기</div>
      <label className="lbl" htmlFor="pTitle">곡 이름</label>
      <input id="pTitle" className="field" placeholder="예: 고민중독" value={f.title} onChange={set("title")} />
      <label className="lbl" htmlFor="pArtist">아티스트</label>
      <input id="pArtist" className="field" placeholder="예: QWER" value={f.artist} onChange={set("artist")} />
      <label className="lbl" htmlFor="pYt">유튜브 링크 <span className="hint">· 원곡이면 원곡 링크로</span></label>
      <input id="pYt" className="field" placeholder="https://youtu.be/…" value={f.ytUrl} onChange={set("ytUrl")} />
      <span className="lbl">보컬</span>
      <div className="chips">
        {[["none", "해당 없음"], ["male", "남"], ["female", "여"], ["duet", "듀엣"]].map(([v, label]) => (
          <button key={v} type="button" className={"chip" + (f.vocalType === v ? " on" : "")}
            onClick={() => setF({ ...f, vocalType: v })}>{label}</button>
        ))}
      </div>
      <div className="optRow">
        <span className="optTxt"><b>악보 있어요</b><span>구했거나 만들 수 있으면 켜기</span></span>
        <button type="button" className={"switch" + (f.sheetReady ? " on" : "")}
          aria-pressed={f.sheetReady} aria-label="악보 있어요"
          onClick={() => setF({ ...f, sheetReady: !f.sheetReady })} />
      </div>
      <div className="modalActions">
        <button type="button" className="btn grey" onClick={onClose}>취소</button>
        <button type="button" className="btn" disabled={!f.title.trim()}
          onClick={() => onSubmit(f)}>제안하기</button>
      </div>
    </ModalShell>
  );
}

/* ==================== 입장 게이트 ==================== */
function EntryGate({ name, onSubmit }) {
  const [pw, setPw] = useState("");
  return (
    <div className="wrap">
      <div className="hero" style={{ paddingTop: 40 }}>
        <h1>🔒 {name}</h1>
        <p>입장 비밀번호가 있는 방이에요. 저장하지 않으니 올 때마다 입력해요.</p>
      </div>
      <div className="card">
        <input autoFocus type="password" className="field" placeholder="입장 비밀번호"
          value={pw} onChange={(e) => setPw(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && pw && onSubmit(pw)} />
        <button type="button" className="btn" style={{ marginTop: 12 }}
          disabled={!pw} onClick={() => onSubmit(pw)}>들어가기</button>
      </div>
    </div>
  );
}

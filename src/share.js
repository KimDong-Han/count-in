// 공유 프리셋 API 클라이언트.
// 백엔드(Neon + Vercel Functions)가 아직 안 붙었을 때는 데모 데이터로 폴백해
// 목업 UI가 계속 동작하도록 한다. 실제 연결되면 자동으로 서버 결과를 쓴다.

const BASE = "/api/presets";

// 서버 미연결 시 검색 폴백용 데모 (실제 연결되면 안 쓰임)
const DEMO = [
  { id: "demo-1", name: "봄날", author: "count-in", pages: 4 },
  { id: "demo-2", name: "Canon in D", author: "practice-room", pages: 6 },
  { id: "demo-3", name: "작은 별", author: "music-friend", pages: 3 },
];

// 이름으로 공유 프리셋 검색 → [{id, name, author, pages}]
export async function searchSharedPresets(query) {
  const q = (query || "").trim();
  if (!q) return [];
  try {
    const res = await fetch(`${BASE}?q=${encodeURIComponent(q)}`);
    if (!res.ok) throw new Error("search failed");
    return await res.json();
  } catch (e) {
    // 백엔드 미연결 → 데모로 폴백
    const lower = q.toLowerCase();
    return DEMO.filter((p) => p.name.toLowerCase().includes(lower));
  }
}

// 개별 공유 프리셋 조회 → 프리셋 블롭(loadPreset에 넘길 형태)
export async function getSharedPreset(id) {
  const res = await fetch(`${BASE}/${encodeURIComponent(id)}`);
  if (!res.ok) throw new Error("load failed");
  return await res.json();
}

// 프리셋 공유 등록 → { id }
export async function sharePreset(preset) {
  const res = await fetch(BASE, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(preset),
  });
  if (!res.ok) throw new Error("share failed");
  return await res.json();
}

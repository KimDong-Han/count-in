// 경로 기반 미니 라우팅 유틸. Root(main.jsx)가 popstate를 구독한다.

export const getPath = () =>
  window.location.pathname.replace(/\/+$/, "") || "/";

// 페이지 새로고침 없이 경로 전환 (링크 onClick에서 사용)
export function navigate(path) {
  if (getPath() === path) return;
  window.history.pushState(null, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

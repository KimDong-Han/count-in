// 라이트/다크 테마: 기본은 시스템 설정을 따르고, 버튼으로 바꾸면 그 선택을 기억한다.
const KEY = 'cin:theme'

function systemDark() {
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
}

export function currentDark() {
  try {
    const s = localStorage.getItem(KEY)
    if (s === 'dark') return true
    if (s === 'light') return false
  } catch (e) {}
  return systemDark()
}

export function applyTheme() {
  const dark = currentDark()
  document.documentElement.dataset.theme = dark ? 'dark' : 'light'
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', dark ? '#101419' : '#f2f4f6')
}

export function setDark(dark) {
  try {
    localStorage.setItem(KEY, dark ? 'dark' : 'light')
  } catch (e) {}
  applyTheme()
}

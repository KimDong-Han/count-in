import React, { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Analytics } from '@vercel/analytics/react' // Vite라 next가 아닌 react 진입점
import App from './App.jsx'
import Metronome from './Metronome.jsx'
import { getPath } from './router.js'
import { applyTheme } from './theme.js'
import './styles.css'

applyTheme() // 렌더 전에 테마 적용 (라이트/다크 깜빡임 방지)

// 경로별 문서 메타(SEO). 직접 접근은 정적 HTML(index/metronome.html)이 담당하고,
// 여기서는 앱 내 경로 전환 시 title·description·canonical을 맞춰 준다.
const META = {
  '/': {
    title: 'Count-In — 악보 PDF 자동 넘김 · 유튜브 카운트다운 재생',
    desc: '유튜브 반주에 맞춰 악보 PDF가 자동으로 넘어가는 무료 연습 도구예요. 카운트다운 후 반주가 시작되고, 정해둔 시각에 악보가 넘어가요. 온라인 메트로놈도 함께 제공해요.',
    canonical: 'https://www.count-in.com/',
  },
  '/metronome': {
    title: '온라인 메트로놈 (Metronome Online) — Count-In',
    desc: '설치 없이 브라우저에서 바로 쓰는 무료 온라인 메트로놈이에요. 30~240 BPM, 박자·첫박 강세·탭 템포를 지원하고, Web Audio 기반이라 박자가 밀리지 않아요. Free online metronome.',
    canonical: 'https://www.count-in.com/metronome',
  },
}

// 경로 기반 미니 라우팅: /metronome → 메트로놈, 그 외 → 연습 플레이어.
// 정적 호스팅에서 경로 직접 접근이 되도록 vercel.json이 모든 경로를 index.html로 리라이트한다.
function Root() {
  const [route, setRoute] = useState(getPath)
  useEffect(() => {
    // 예전 해시 주소(#/metronome) 호환: 경로로 바꿔치기
    if (window.location.hash === '#/metronome' && getPath() !== '/metronome') {
      window.history.replaceState(null, '', '/metronome')
      setRoute('/metronome')
    }
    const onPop = () => setRoute(getPath())
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])
  useEffect(() => {
    const m = META[route] || META['/']
    document.title = m.title
    document.querySelector('meta[name="description"]')?.setAttribute('content', m.desc)
    document.querySelector('link[rel="canonical"]')?.setAttribute('href', m.canonical)
  }, [route])
  return (
    <>
      {route === '/metronome' ? <Metronome /> : <App />}
      <Analytics /> {/* Vercel Analytics — index/metronome 두 엔트리 모두 이 Root를 쓴다 */}
    </>
  )
}

// StrictMode는 개발 중 effect를 두 번 호출해 유튜브 플레이어 DOM을
// 중복 생성할 수 있어 사용하지 않는다.
createRoot(document.getElementById('root')).render(<Root />)

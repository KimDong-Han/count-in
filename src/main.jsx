import React, { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import Metronome from './Metronome.jsx'
import { getPath } from './router.js'
import './styles.css'

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
  return route === '/metronome' ? <Metronome /> : <App />
}

// StrictMode는 개발 중 effect를 두 번 호출해 유튜브 플레이어 DOM을
// 중복 생성할 수 있어 사용하지 않는다.
createRoot(document.getElementById('root')).render(<Root />)

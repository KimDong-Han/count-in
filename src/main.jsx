import React, { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import Metronome from './Metronome.jsx'
import './styles.css'

// 해시 기반 미니 라우팅: #/metronome → 메트로놈, 그 외 → 연습 플레이어
function Root(){
  const [route, setRoute] = useState(window.location.hash)
  useEffect(() => {
    const onHash = () => setRoute(window.location.hash)
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])
  return route === '#/metronome' ? <Metronome /> : <App />
}

// StrictMode는 개발 중 effect를 두 번 호출해 유튜브 플레이어 DOM을
// 중복 생성할 수 있어 사용하지 않는다.
createRoot(document.getElementById('root')).render(<Root />)

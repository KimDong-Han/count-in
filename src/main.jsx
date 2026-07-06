import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './styles.css'

// StrictMode는 개발 중 effect를 두 번 호출해 유튜브 플레이어 DOM을
// 중복 생성할 수 있어 사용하지 않는다.
createRoot(document.getElementById('root')).render(<App />)

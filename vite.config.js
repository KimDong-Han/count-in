import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// 로컬 개발 서버(localhost)로 열리므로 유튜브 IFrame API의
// referrer/origin 제약(에러 153 등)에서 자유롭다.
export default defineConfig({
  plugins: [react()],
  server: { host: '127.0.0.1', port: 5173, open: true },
})

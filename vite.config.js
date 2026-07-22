import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

// 로컬 개발 서버(localhost)로 열리므로 유튜브 IFrame API의
// referrer/origin 제약(에러 153 등)에서 자유롭다.
export default defineConfig({
  plugins: [react()],
  server: { host: '127.0.0.1', port: 5173, open: true },
  build: {
    rollupOptions: {
      // 페이지별 정적 메타(SEO)를 위해 메트로놈을 별도 HTML 엔트리로 빌드.
      // /metronome 접근은 vercel.json이 /metronome.html로 리라이트한다.
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        metronome: fileURLToPath(new URL('./metronome.html', import.meta.url)),
        // 선곡 보드(board/)는 아직 미공개 — 빌드에서 제외해 프로덕션 접근 차단.
        // dev 서버에선 /board/ 로 접근 가능. 공개 시점에 아래 줄을 살리고
        // vercel.json에 /board 리라이트(+캐치올 제외)를 되돌릴 것 (WORKLOG §32).
        // board: fileURLToPath(new URL('./board/index.html', import.meta.url)),
      },
    },
  },
})

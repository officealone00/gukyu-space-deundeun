import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// dev: /datago/* 를 data.go.kr로 프록시(CORS 우회). serviceKey는 클라가 .env.local의
//      VITE_DATAGO_KEY로 쿼리에 붙인다(개발 편의). prod: Cloudflare Worker가 키를 주입.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react()],
    base: env.VITE_BASE ?? '/',
    server: {
      proxy: {
        '/datago': {
          target: 'https://apis.data.go.kr',
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/datago/, ''),
          headers: { Accept: 'application/json' },
        },
        // dev OpenAI 프록시: 키는 .env.local의 VITE_OPENAI_KEY(로컬 전용). prod는 Worker secret.
        '/ai': {
          target: 'https://api.openai.com',
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/ai/, ''),
          headers: env.VITE_OPENAI_KEY ? { Authorization: `Bearer ${env.VITE_OPENAI_KEY}` } : {},
        },
      },
    },
    define: {
      __APP_NAME__: JSON.stringify(env.VITE_APP_NAME ?? '국유공간든든'),
    },
  }
})

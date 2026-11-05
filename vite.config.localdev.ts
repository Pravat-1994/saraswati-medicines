import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Local development. `npm run dev` runs in "demo" mode (mock data, no Decisions needed).
// `npm run localdev` proxies /decisionsproxy to the Decisions instance in .env.localdevelopment.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const proxyTarget = env.VITE_DEC_PORTAL_FOR_PROXY

  return {
    plugins: [react(), tailwindcss()],
    base: 'saraswatimedicines/',
    server: {
      proxy: proxyTarget
        ? {
            '/decisionsproxy': {
              target: proxyTarget,
              changeOrigin: true,
              secure: false,
              rewrite: (path) => path.replace(/^\/decisionsproxy/, ''),
            },
          }
        : undefined,
    },
  }
})

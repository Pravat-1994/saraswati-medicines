import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { viteSingleFile } from 'vite-plugin-singlefile'

// Standalone demo: one self-contained index.html (JS, CSS and fonts inlined)
// that opens by double-clicking — no web server needed. Uses the .env.pages
// demo settings (no Decisions login).
export default defineConfig(() => ({
  plugins: [react(), tailwindcss(), viteSingleFile({ removeViteModuleLoader: true })],
  base: './',
  build: {
    outDir: 'standalone',
    emptyOutDir: true,
    sourcemap: false,
    chunkSizeWarningLimit: 6000,
  },
}))

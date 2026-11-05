import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { buildOptions } from './vite.shared'

// GitHub Pages build: relative asset paths ('./') so the site works at
// https://<user>.github.io/<repo>/ under any repository name. HashRouter
// handles deep links, so no 404.html redirect trick is needed.
export default defineConfig(() => ({
  plugins: [react(), tailwindcss()],
  base: './',
  build: buildOptions,
}))

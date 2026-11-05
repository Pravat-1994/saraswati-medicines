import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { buildOptions } from './vite.shared'

export default defineConfig(() => ({
  plugins: [react(), tailwindcss()],
  base: 'saraswatimedicines/',
  build: buildOptions,
}))

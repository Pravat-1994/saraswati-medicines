import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Default config (used only if vite is run without --config). Mirrors the template.
export default defineConfig(({ command }) => ({
  plugins: [react(), tailwindcss()],
  base: command === 'serve' ? '/saraswatimedicines/' : 'saraswatimedicines/',
}))

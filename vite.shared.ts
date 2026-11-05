import type { BuildOptions } from 'vite'

// Shared production build options for Decisions Custom Web App packages.
// Chunking is left to Rollup: hand-written manualChunks split react / react-hook-form / zod
// into mutually dependent chunks, which crashes at load time ("Cannot access before initialization").
// Pages are still code-split via React.lazy in src/app/routes.tsx.
export const buildOptions: BuildOptions = {
  outDir: 'dist',
  emptyOutDir: true,
  sourcemap: false,
  assetsInlineLimit: 4096,
  chunkSizeWarningLimit: 1200,
}

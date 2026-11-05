/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DEMO_MODE?: string
  readonly VITE_REQUIRE_DECISIONS_AUTH?: string
  readonly VITE_DEC_PORTAL_BASE?: string
  readonly VITE_DEC_PROJECT_API_BASE_URL?: string
  readonly VITE_DEC_PORTAL_FOR_PROXY?: string
  readonly VITE_DEC_FORCE_SESSION_ID?: string
  readonly VITE_API_TIMEOUT_MS?: string
  readonly VITE_MOCK_LATENCY_MS?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

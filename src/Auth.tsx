// Decisions authentication helpers (from the Decisions Custom Web App template).
// When hosted inside Decisions the session is established by Decisions itself;
// this module only stores the JWT returned by AccountService/GetJWT.
const COOKIE_NAME = 'itportal_auth'

// Cookies set from JS cannot carry the HttpOnly flag — that requires a server-side Set-Cookie header.
// Using Secure + SameSite=Strict is the best available protection from the client side.
function cookieFlags(): string {
  const secure = window.location.protocol === 'https:' ? '; Secure' : ''
  return `; path=/; SameSite=Strict${secure}`
}

export function storeAuthToken(token: string): void {
  document.cookie = `${COOKIE_NAME}=${encodeURIComponent(token)}${cookieFlags()}`
}

export function clearAuthToken(): void {
  document.cookie = `${COOKIE_NAME}=; expires=Thu, 01 Jan 1970 00:00:00 GMT${cookieFlags()}`
}

export function getAuthToken(): string | null {
  try {
    const match = document.cookie.match(new RegExp(`(?:^|; )${COOKIE_NAME}=([^;]*)`))
    return match ? decodeURIComponent(match[1]) : null
  } catch {
    return null
  }
}

export function redirectToLogin(): void {
  const env = import.meta.env
  const portalBase = env.VITE_DEC_PORTAL_BASE ?? '/Primary'
  if (env.VITE_DEC_PORTAL_FOR_PROXY) {
    window.location.href = `${env.VITE_DEC_PORTAL_FOR_PROXY}/Login?ReturnURL=${encodeURIComponent(window.location.href)}`
  } else {
    window.location.href = `${portalBase.replace('/Primary', '')}/Login?ReturnURL=${import.meta.env.BASE_URL}index.html`
  }
}

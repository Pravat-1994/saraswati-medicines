/**
 * Thin HTTP client for Decisions BPM.
 *
 * Authentication reuses the template's approach (src/Auth.tsx): when hosted as
 * a Decisions Custom Web App, a JWT is obtained from AccountService/GetJWT and
 * sent as a Bearer token. No separate auth system is implemented here.
 *
 * Flow invocation follows the Decisions REST convention
 *   POST {portalBase}/REST/{flowPath}   body: { ...inputs, outputtype: 'Json' }
 * Adjust `buildFlowUrl` once the actual flow endpoints are published (see
 * docs/DECISIONS_INTEGRATION.md). Generated methods in src/api/apiclient.ts can
 * also be called directly from services when available.
 */
import { appConfig } from '../../config/env'
import { getAuthToken, redirectToLogin } from '../../Auth'
import { ServiceError } from '../../types/api'

function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  const token = getAuthToken() ?? appConfig.forceSessionId ?? null
  if (token) headers.Authorization = `Bearer ${token}`
  return headers
}

export function buildFlowUrl(flowPath: string): string {
  const base = `${appConfig.portalBase}${appConfig.projectApiBase}`.replace(/\/+$/, '')
  return `${base}/REST/${flowPath.replace(/^\/+/, '')}`
}

async function request<T>(url: string, body: unknown): Promise<T> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), appConfig.apiTimeoutMs)
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ ...(body as object), outputtype: 'Json' }),
      signal: controller.signal,
    })
    if (res.status === 401) {
      redirectToLogin()
      throw new ServiceError('Your Decisions session has expired. Please sign in again.', 'UNAUTHORIZED', 401)
    }
    if (res.status === 403) throw new ServiceError('You do not have permission to perform this action.', 'FORBIDDEN', 403)
    const text = await res.text()
    const data = text ? (JSON.parse(text) as unknown) : undefined
    if (!res.ok) {
      const message = (data as { ErrorMessage?: string; message?: string } | undefined)?.ErrorMessage ?? `Request failed (HTTP ${res.status})`
      throw new ServiceError(message, 'HTTP_ERROR', res.status, data)
    }
    return unwrapResult<T>(data)
  } catch (err) {
    if (err instanceof ServiceError) throw err
    if (err instanceof DOMException && err.name === 'AbortError') throw new ServiceError('The server took too long to respond.', 'TIMEOUT')
    throw new ServiceError('Unable to reach the server. Check your connection.', 'NETWORK_ERROR', undefined, err)
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Decisions wraps flow output as `{ "<FlowName>Result": ... }` or `{ Done: {...} }`.
 * Return the inner payload so services receive the typed model directly.
 */
function unwrapResult<T>(data: unknown): T {
  if (data && typeof data === 'object') {
    const keys = Object.keys(data as object)
    if (keys.length === 1) {
      const only = (data as Record<string, unknown>)[keys[0]]
      if (keys[0].endsWith('Result') || keys[0] === 'Done') return only as T
    }
  }
  return data as T
}

export const decisionsClient = {
  runFlow<T>(flowPath: string, payload: unknown): Promise<T> {
    return request<T>(buildFlowUrl(flowPath), payload ?? {})
  },
}

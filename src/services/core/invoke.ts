/**
 * Single switch-point between the mock data provider and Decisions BPM.
 *
 *  - Demo mode (VITE_DEMO_MODE=true): runs the mock handler against the local
 *    demo database with simulated latency, and returns a deep copy so UI code
 *    can never mutate the store directly.
 *  - Integrated mode: calls the Decisions flow registered in `FLOWS`.
 */
import { appConfig } from '../../config/env'
import { ServiceError } from '../../types/api'
import { decisionsClient } from './decisionsClient'

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export async function invoke<T>(flowPath: string, payload: unknown, mock: () => T | Promise<T>): Promise<T> {
  if (appConfig.demoMode) {
    await delay(appConfig.mockLatencyMs)
    try {
      const result = await mock()
      return result === undefined ? result : structuredClone(result)
    } catch (err) {
      if (err instanceof ServiceError) throw err
      throw new ServiceError(err instanceof Error ? err.message : 'Unexpected error', 'MOCK_ERROR', undefined, err)
    }
  }
  return decisionsClient.runFlow<T>(flowPath, payload)
}

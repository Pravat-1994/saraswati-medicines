import { create } from 'zustand'
import { userService } from '../services/userService'
import { errorMessage, invalidate } from '../hooks/useQuery'
import type { AppSettings } from '../types/domain'

interface SettingsState {
  settings: AppSettings | null
  error?: string
  load: () => Promise<void>
  save: (s: AppSettings) => Promise<AppSettings>
}

/** Store configuration (GST, expiry windows, locations…) needed across the app. */
export const useSettingsStore = create<SettingsState>((set) => ({
  settings: null,
  load: async () => {
    try {
      set({ settings: await userService.settings(), error: undefined })
    } catch (err) {
      set({ error: errorMessage(err) })
    }
  },
  save: async (s) => {
    const saved = await userService.saveSettings(s)
    set({ settings: saved })
    invalidate()
    return saved
  },
}))

/** Settings are loaded before the shell renders, so this is safe inside pages. */
export function useSettings(): AppSettings {
  const s = useSettingsStore((st) => st.settings)
  if (!s) throw new Error('Settings not loaded')
  return s
}

import { create } from 'zustand'
import { GetCurrentUserAccount } from './apiclient'

export interface UserInfo {
  EmailAddress: string
  FirstName?: string
  LastName?: string
  DisplayName?: string
}

interface UserInfoStore {
  user: UserInfo | null
  isLoading: boolean
  error: string | null
  loadUser: () => Promise<void>
}

export const useUserInfoStore = create<UserInfoStore>((set, get) => ({
  user: null,
  isLoading: false,
  error: null,

  loadUser: async () => {
    if (get().user) return
    set({ isLoading: true, error: null })
    try {
      const user = await GetCurrentUserAccount()
      set({ user, isLoading: false })
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to load user', isLoading: false })
    }
  },
}))
